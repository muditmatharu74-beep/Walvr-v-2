# Railway rehearsal and October launch gates

Status checked 2026-10-22. This is a deployment checklist, not an activation record.
The target is a limited beta by October 31, conditional on the checks below.
Do not merge draft PRs or change production as part of this rehearsal.

## Verified starting point

- The owner-reviewed 154-second pixel bike export works; the red edge overlay is removed.
  It uses saved captions. It does not demonstrate the new vocal worker end to end.
- The worker image failed in Debian's ca-certificates installation because TMPDIR
  pointed at /tmp/walvr before that directory existed. The Dockerfile now creates
  it before installation. CPU-image CI passed on commit 2b687c60ef9f894a537d40dd033f6132d8c2787e,
  including native imports, non-root readiness and real model warm-up.
- The app has been upgraded from Next.js 14.2.5 to 15.5.28 with React/React DOM
  19.2.9 and compatible theme/types packages. Next's nested PostCSS is overridden
  to patched 8.5.31. The installed production dependency audit reports zero known
  vulnerabilities. This does not certify the whole app or replace live Auth checks.
- Local regression checks: 115 Node tests and 33 Python tests pass. Container model
  imports, cache permissions and actual model warm-up are separate CI gates.
- PRs #3, #4, #5 and #7 remain draft and unmerged. Their earlier descriptions may
  predate subsequent tests; use current CI and this rehearsal's evidence.
- Supabase project bugfbeqwcatakmativkg has no development branches. Its migration
  history lists render tracking and render-credit refunds, not the vocal queue.
  A catalog check found reserve_video_credits but no enqueue_vocal_job or
  claim_vocal_analysis. Do not infer the complete schema from migration names.
- Railway's status page reported a platform outage on October 22, including
  unavailable Hobby builds. Recheck https://status.railway.com before paying or
  deploying; do not repeatedly enqueue the same deployment during the incident.

## Connection and budget

Connect Railway to GitHub with access to muditmatharu74-beep/Walvr-v-2.
Use the provider's connection flow; do not paste passwords or secrets into chat.
Choose a plan only after reviewing its checkout total. The initial intended
resource-usage limit is $20/month; a larger limit requires the owner's decision.
Railway usage limits stop workloads when exceeded, so exhaustion is an availability
event. Account for the plan charge and other providers separately. Configure a
warning below the chosen hard limit and check projected usage after the first song.
References: https://docs.railway.com/pricing/cost-control and https://railway.com/pricing.

## Database and app first

1. Provision an isolated Supabase branch/project with its own Auth users, uploads
   and credentials. Confirm the project reference differs from production. Branches
   may add cost; review it before provisioning. Never use production to bypass this gate.
2. Compare the isolated schema with the ordered repository migrations. Apply missing
   tracking, atomic billing, render recovery and vocal-job migrations to that isolated
   database. Reconcile previously applied tracking/refund equivalents rather than
   replaying migrations blindly. See docs/vocal-worker-rollout.md for the queue migration.
3. Bind a feature-branch Vercel preview to that same database: public URL/key and
   server-only service-role key must all belong to it. Configure preview Auth URLs,
   templates and Storage policies. Create a disposable tester and explicit test credits.
4. Keep WALVR_VOCAL_TIMING_ENABLED=false while configuring. Generate one random
   server-only WALVR_VOCAL_WORKER_SECRET of at least 32 characters and put the same
   value in the preview and Railway secret stores. Do not print it or use NEXT_PUBLIC_.
5. Verify the preview's Remotion serve URL matches its reviewed composition. Preserve
   the original-audio rendering configuration. Set the background mode to pixel-ride.
   A Vercel app deploy alone does not publish a new Remotion site.

## Railway service settings

| Setting | Value |
| --- | --- |
| Service | walvr-vocal-preview-worker |
| Source | Walvr-v-2, feature/neon-captions, reviewed commit with passing CPU-image CI |
| Root/build context | Repository root |
| Config path | /experiments/vocal-timing/railway.json |
| Dockerfile | experiments/vocal-timing/Dockerfile (selected by config) |
| Start command override | Leave empty; use the image entrypoint |
| Replicas | 1 |
| Initial memory ceiling | 8 GiB for the rehearsal; measure actual usage and cost |
| Restart | ON_FAILURE, at most 3 retries (in config) |
| Public domain / HTTP healthcheck | None; this is a pull worker with no HTTP server |
| Serverless sleeping | Disabled |
| Automatic deploys | Disable during the controlled rehearsal; deploy one reviewed commit |
| Cache | Start without a mounted volume, or verify /cache is writable by UID/GID 10001 |

The image runs as an unprivileged user. Railway mounts volumes as root; attaching
one without resolving permissions can break model warm-up. Do not run the audio
pipeline as root to work around that. Without a volume, replacements must download
models again. See https://docs.railway.com/volumes/reference.

| Private Railway variable | Meaning |
| --- | --- |
| WALVR_APP_URL | Exact HTTPS origin of the isolated feature preview, no path/query |
| WALVR_STORAGE_ORIGIN | HTTPS origin of its isolated Supabase project, no Storage path |
| WALVR_VOCAL_WORKER_SECRET | Same generated secret as the preview app |
| WALVR_PREVIEW_BYPASS_TOKEN | Only if Vercel protection requires an automation bypass |
| WALVR_ASR_MODEL | small (current evaluated baseline) |
| WALVR_WARM_LANGUAGE | en (alignment warm-up only; recognition still detects language) |

Do not give the worker Supabase service-role, AWS, Stripe or database credentials.
Do not set PORT or add a web start command. The Dockerfile supplies cache/thread
settings. Its startup warms models before it claims jobs, but a readiness log alone
does not prove app authentication, queue access or successful audio processing.

## First acceptance run

1. Require all current CI checks to pass, including native container imports,
   non-root cache checks and actual CPU model downloads/loads. A later commit
   must also have its applicable checks completed before selection.
2. Deploy once. Confirm the selected commit, absence of restart loops, and startup
   readiness with modelsWarmed=true. Record startup duration and memory peak.
3. When the isolated app/database/worker all match, enable the vocal flag only on
   that preview and redeploy it. Update WALVR_APP_URL if the chosen origin changes.
   Confirm authorized worker polls succeed and unauthorized requests receive 401.
4. Upload the known working MP3 through the normal authenticated UI. Click Create
   twice quickly: require one durable job and one charge. Close the browser.
   Require analysis, saved results, one render, and a completed downloadable MP4.
5. Listen to the entire output: original mix present, correct full duration,
   cyan single-word captions, fade in/out, pixel bike scene and no red edge tint.
   Record recognition mistakes and timing drift; do not mark ASR text human-verified.
6. Use a controlled bad/empty upload: require a clear failure, no render, one refund.
   Restart during a separate analysis: require lease recovery and one final render.
7. Exercise transient worker/app reporting failures, persisted-result resumption,
   provider-confirmed failure and provider-status outage. Confirm no duplicate
   rendering/refunds. An uncertain submission must remain for reconciliation.
8. Record wall time, billed cost, CPU/memory peak, model cache behavior and queue
   age. Test several complete songs with quiet vocals, rap, held notes, repeated
   choruses and instrumental breaks, including the previously difficult upload.

Keep aggregate evidence (job IDs, statuses, charge/refund counts and timings).
Do not commit customer audio, lyric transcripts or credentials.

## Operating and launch gates

Before beta, name the person checking worker restarts, queue age, failed jobs,
manual-review submissions and provider spend. Set a response interval and an
incident contact. The existing daily recovery cron handles only ten due jobs;
verify hosting capacity and a suitable schedule before accepting paid traffic.
Do not call the system unattended until browser-closed recovery has passed live.

Drain/resolve existing jobs before disabling the vocal flag: disabling it also
blocks worker APIs. Preserve reservations for uncertain provider submissions until
the provider state is reconciled. Do not roll back to old balance-writing code
after atomic billing is active. Rollback must preserve the ledger and job records.

Proposed dates (America/New_York), subject to passing evidence:

| Date | Required outcome |
| --- | --- |
| October 22 | Fix container packaging, finish CI, connect account/budget, provision isolated test setup when providers permit |
| October 23–24 | First live worker-to-MP4 run; browser-closed, restart, duplicate and failure checks |
| October 25–27 | Full-song listening and timing scores; measure cost/latency; fix failed cases |
| October 28–29 | Small invited beta; Auth/Storage security, dependency advisories and Stripe test-mode checks resolved |
| October 30 | Release decision, operational checklist, rollback rehearsal and support readiness |
| October 31 | Limited launch only if gates pass; keep paid access closed if billing/recovery or security remains unverified |

Launch also requires reviewing current production dependency advisories, signup/Auth
advisor findings, clear purchased-credit renewal policy, Stripe webhook retry tests,
and the production migration/application cutover. Railway does not resolve these.
Production vocal timing is currently blocked by a preview-only code gate; that
needs its own reviewed rollout after the live rehearsal, not merely an env toggle.
This schedule is a target, not a guarantee of perfect lyrics or outage-free hosting.
