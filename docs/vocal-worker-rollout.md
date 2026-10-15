# Vocal timing worker: staged rollout

The preview code connects Create → durable analysis queue → vocal separation →
recognition → forced alignment → original-audio Remotion render. It is disabled
by default and refuses activation when `VERCEL_ENV` is not `preview`. The first
integration supports Dark Lyrics (`dark-solid`) templates only. Other templates
retain their existing transcription path.

## What is implemented

- The server authenticates the uploader, checks ownership/template/plan, then
  downloads at most 25 MB and hashes the original before reserving credits.
- `enqueue_vocal_job` reserves credits and inserts the job in one transaction.
  Queue insertion failure rolls back the charge. Duplicate Create calls cannot
  reserve the same video twice. Create returns a durable `202 queued` receipt.
- Private `vocal_jobs` rows contain source binding, analysis, attempts and leases.
  Browser roles cannot read them or call their RPCs. No transcript is logged.
- The Python pull worker gets a fenced 20-minute lease and renews it each minute.
  It downloads only the owned Storage URL, rejects redirects/changed originals,
  probes duration independently, analyzes up to ten minutes, and cleans up local
  audio, stems and logs. It needs a dedicated worker secret, not database or AWS
  credentials. Speech VAD is off; language detection is automatic.
- Saved results survive app/worker restarts. Expired analysis can retry up to
  three attempts. Old tokens cannot overwrite a newer attempt. Empty, partial,
  flagged, source-mismatched or malformed results stop and refund exactly once.
- A later pull resumes ready results without redoing ML or requiring the browser.
  The app rechecks the original hash before a paid render, uses aligned absolute
  word times and beats measured from the original mix, and preserves full duration.
- Submission is claimed once. Lost provider responses or tracking writes require
  review, preserving the reservation. They never cause automatic resubmission or
  an assumed refund. A crash after claiming submission has the same uncertainty.
  Existing render recovery settles successfully tracked renders.

Queue reservation is atomic, but a lost HTTP response can still hide acceptance.
The upload UI tells the user to check the dashboard before creating another video.
The existing dashboard reloads processing rows every ten seconds; it can see the
worker switch them to rendering/error even though it only polls the provider once
tracking exists.

## Preview setup after review

1. Use a disposable preview database containing the earlier tracking, atomic
   billing and render-recovery migrations. Apply
   `20261011202223_vocal_analysis_jobs.sql` there; do not activate it on production.
2. Configure a random server-only `WALVR_VOCAL_WORKER_SECRET` of at least 32
   characters on the preview app and worker. Set app `WALVR_VOCAL_TIMING_ENABLED=true`
   only after the worker is available. Existing Remotion configuration is required.
3. Run the worker as a supervised long-lived process/container with the isolated
   Python 3.12 ML environment from `experiments/vocal-timing/README.md`, ffmpeg,
   ffprobe and a persistent model cache. Model versions are pinned; warm the cache
   before accepting jobs. Scale with multiple pull workers, not request subprocesses.
4. Give the worker `WALVR_APP_URL` (preview HTTPS origin), `WALVR_STORAGE_ORIGIN`
   (the matching Supabase HTTPS origin), and the secret. For a protected preview,
   provide `WALVR_PREVIEW_BYPASS_TOKEN` scoped to that deployment; it is sent only
   to the app, never to Storage. Do not reuse an interactive browser session.
5. Start `python experiments/vocal-timing/worker.py`; `--once` handles one poll.
   Set `WALVR_ASR_MODEL` only to an evaluated model. Keep lyrics/results private
   and define retention/cleanup before any wider rollout.
6. Test Create from an authenticated account, confirm one reservation, close the
   browser, and check that processing proceeds. Then interrupt an analysis worker,
   allow the lease to expire, and verify that one replacement finishes it.

Disabling the flag stops new queued jobs and blocks the worker API. Drain or
explicitly resolve existing jobs before disabling it. Do not refund a job in
`submitting`/`review` without confirming whether a provider accepted the render.

## Validation

```sh
node --test tests/*.test.cjs
python -m unittest discover -s experiments/vocal-timing -p 'test_*.py'
npx tsc --noEmit
NODE_PATH=/path/to/test/dependencies node tests/billing-migration.cjs
```

The SQL test applies all migrations to disposable PGlite and checks queue/charge
rollback, lease fencing, bounded retries, refunds, exclusive submission, tracking
and browser permissions. CI additionally uses real PostgreSQL connections to
check competing analysis and render claims with `SKIP LOCKED`.

Rehearse the actual Create route, Python worker protocol, result persistence and
renderer handoff against a disposable local database with a saved analysis:

```sh
NODE_PATH=/path/to/test/dependencies node scripts/rehearse-vocal-worker.cjs \
  /private/original.mp3 /private/full-analysis.json
```

This script uses a loopback test server, disposable identities and a **mock**
renderer. It reuses saved ML output, makes no external provider calls and prints
only counts. It does not establish live deployment readiness or lyric accuracy.

Current accuracy evidence remains limited: one earlier upload produces aligned
lyrics; a second upload produced zero words even after disabling speech VAD and
using automatic language detection. The latter is an explicit failure, not a
successful lyric video. Source separation and forced alignment do not guarantee
correct words; a confidently wrong word can still receive a timestamp. Compare
several full songs to human-checked words/timings before production, including
quiet vocals, rap, held notes, repeated choruses and instrumental breaks.

No preview worker host or live migration is activated by committing this code.

The pipeline's empty-vocal recovery checks the original mix before returning
no usable lyrics. Positive-length ASR words are required for a mix candidate;
candidate words are aligned against the original mix, not the failed stem.
Every original-mix fallback is flagged for review and remains blocked by the
worker's final-render adapter. Empty results remain explicit failures. This
adds a diagnostic recovery path without activating the worker or asserting
that a sparse original-mix transcript is a correct lyric sequence.

## CPU container rehearsal

The worker image uses Python 3.12.14, pinned CPU Torch/Torchaudio 2.8.0 and the
pilot's pinned recognition/alignment dependencies. It runs as UID/GID 10001,
keeps job audio in private temporary directories, and never contains service
credentials. CI builds it and checks native imports and worker/timeline tests
with networking disabled. This checks packaging, not model accuracy or a live job.

Build from the repository root:

```sh
docker build -f experiments/vocal-timing/Dockerfile -t walvr-vocal-worker:preview .
```

On the intended supervised host, supply configuration through its secret store
or a private environment file, not an image layer. Mount a persistent `/cache`
volume writable by UID/GID 10001 for Hugging Face and Torch model downloads.
Use the preview configuration described above. A deployment bypass credential,
if needed, belongs only in that host's secrets. Start one worker per container
and configure restart supervision plus termination of the full container's
process tree. Warm and measure the models on that host before enabling new jobs.
No host or live queue is provisioned by building this image.

The analysis timeout now stops the pipeline's entire POSIX process group,
including a Demucs child that ignores SIGTERM. ffprobe has a separate 30-second
timeout. These bounds avoid orphaned model processes after an analysis failure;
they do not guarantee completion of every ten-minute song within 1100 seconds.

## Railway preview setup

The prepared configuration is `/experiments/vocal-timing/railway.json`. Set that
as the service's config path and keep the build context at the repository root;
it selects the CPU Dockerfile and bounded restart policy. Create a background
service named `walvr-vocal-preview-worker` from the reviewed feature branch,
with one replica, no public domain, and serverless sleeping disabled. Provision
an 8 GiB memory limit for the initial rehearsal, then right-size from measured
usage. Neither a paid service nor a database branch is created by this config.

Configure the app origin, isolated Storage origin, worker secret and any preview
bypass in Railway's private variables. Check the container with
`python preflight.py --warm-models` before allowing jobs. Worker startup performs
native-library, writable-cache and model-load checks before its first claim,
and exits with a generic error if any check fails.

Railway documents permission problems when a volume is mounted into a non-root
container. Verify that a `/cache` volume is writable by UID/GID 10001 before
attaching it. Do not solve this by running the audio pipeline as root. Without
a volume, the image's writable cache can be used for an initial rehearsal, but
models must be downloaded again after each replacement deployment. Warm and
measure those downloads before enabling the preview flag.

The checked Supabase project had no development branch on 2026-10-12. Its
connected cost-check operation was unavailable, so branch creation could not
complete its required confirmation flow. A `walvr-vocal-preview` branch must
exist and be verified separately before rebinding the preview app to it. Do
not substitute the production database merely to unblock deployment.

## Model warm-up before claims

Worker startup now runs native/cache checks and loads all three model stages
in a child process before its first queue claim. That child has a 600-second
timeout with process-group cleanup. A download failure, malformed readiness
report or native crash exits startup; no analysis job is claimed. The child
exits after loading, so model weights do not remain in the idle worker's memory.
Job processes still load cached weights during analysis.

The default is the evaluated `small` recognizer and English alignment warm-up.
`WALVR_WARM_LANGUAGE` selects the alignment language to pre-load; it does not
force the language used during recognition. Other detected languages may need
an additional alignment download during their first analysis.

Check warm-up separately without app credentials or customer audio:

```sh
python experiments/vocal-timing/preflight.py --warm-models --asr-model small --language en
```

CI performs this real download/load check in the non-root CPU container. The
offline tests also verify that warm-up completes before a claim, and that a
failed warm-up cannot claim a job. A warm cache is not evidence of lyric accuracy.

## Accuracy against a checked reference

`evaluate.py` compares an analysis with a private reference containing
`humanVerified: true`, the original `sourceSha256`, `songDuration`,
`excerptStart`, `excerptDuration`, and ordered `words` (`word`, `start`, `end`).
A person must verify those words/times against the audio first; copying ASR
output and marking it verified does not create a valid reference.

```sh
python experiments/vocal-timing/evaluate.py /private/analysis.json /private/reference.json --tolerance-ms 150
```

It prints counts of missing, extra and substituted words, word-error rate,
matched-word timing errors, and the fraction of reference words that are both
correct and within the timing tolerance. The 150 ms default is an adjustable
test target. Repeated words use timing to break ties between equally good text
alignments. Timing statistics cover correctly matched words, so inspect them
together with word-error rate and reference coverage.

A human-confirmed instrumental reference can have no words; the report then
counts false-positive caption words and leaves word-error rate undefined.
Punctuation and case are normalized; Unicode letters and numbers are retained.
Different source hashes/intervals, invalid timings and unverified references
are rejected. Reports contain aggregates only, not the private lyric text.
The scoring tests use synthetic references; no human accuracy score is claimed
for either saved upload yet.

## Completion reporting outages

After analysis succeeds, the worker retries the same fenced completion report up
to three times. If every response is unavailable (including blocked redirects),
it removes temporary audio and stops heartbeats without sending an analysis
failure. A completion may already have persisted. The database state determines
whether a saved result can render or an expired analysis lease can retry; no
worker-side assumption of failure triggers a refund. Genuine input and model
failures before reporting still use the existing fenced failure path.

Regression tests cover exhausted completion responses, identical report payloads,
a single analysis per claim, temporary-audio cleanup and genuine model failures.
These checks do not replace a live outage/restart rehearsal on the preview host.
