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
