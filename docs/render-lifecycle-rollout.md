# Render lifecycle patch — rollout and remaining work

This branch is not production-ready until its database migration and Remotion site deployment have both been verified. The production app still uses the previous diagnostic patch.

## Changes

- The process route verifies the signed-in user, owns the requested video, validates the upload URL and claims a pending video once before expensive work.
- Remotion is called directly from server code. The old public render endpoint returns 410 instead of permitting a render without billing checks.
- Render provider, bucket, function and region are persisted. Polling uses those saved values and the authenticated owner, not client-supplied render identifiers.
- Both providers' completed and failed renders are handled. Temporary polling failures leave jobs available for retry. Old Remotion jobs without bucket metadata cannot be recovered automatically; create a new video.
- Media duration from transcription includes instrumental endings. The Remotion composition uses dynamic frame counts.
- Upload validation limits files to 25 MB and supported extensions. API failures are displayed rather than silently redirecting to the dashboard.
- The four Remotion packages are pinned to 4.0.512, matching the Lambda function named in the handoff. Confirm the actual AWS function version before deployment.

## Database change

`supabase/migrations/20260919030554_render_tracking_and_account_access.sql` adds four nullable video metadata columns. It enables profile RLS, removes browser write access to plans/credits/Stripe IDs, limits video inserts to upload fields and pending state, and adds owner-only deletion. Service-role writes remain available. Existing frontend profile operations are reads only.

Live inspection found profile RLS disabled. This branch PREPARES the remediation; it does not apply it. The policy and privilege tests use an isolated PGlite database, not customer data. The existing schema file is an incomplete snapshot of production; do not use it to recreate production.

## Deployment order

1. Verify current production policies/grants and take a schema backup. Run the migration in a test database; test signup, own profile reads, cross-account access rejection, and service-role billing writes.
2. Apply the reviewed migration to the intended production project before merging the code. New columns are nullable; old app inserts and service-role writes remain compatible.
3. Confirm Lambda is 4.0.512 and redeploy `src/remotion/index.ts` with the matching Remotion CLI to the AWS site. Vercel deployment alone does not update that S3-hosted composition. Credentials must stay in the authorized environment, not in chat or git.
4. Verify the preview build, merge the application branch, and verify production readiness.
5. Use a short MP3 on a test account. Confirm render starts once, reaches done, downloads, has audio, and has the expected duration. Repeat with a track longer than 60 seconds and an instrumental outro. Check an existing Creatomate video too.
6. If runtime issues occur, revert the application commit. The additive columns can remain; do not disable profile RLS to roll back.

## Local verification

- `node --test tests/rendering.test.cjs`
- `npx tsc --noEmit`
- `git diff --check`
- For isolated SQL checks, install `@electric-sql/pglite` into a temporary directory, then run `tests/security-migration.cjs` with that directory's node_modules on NODE_PATH.

No paid API render is performed by these checks. Live AWS rendering remains unverified.

## Remaining launch blockers

- Credit deduction is still a read-then-write and asynchronous failures do not yet receive an idempotent refund. Different simultaneous videos can race. Add a transaction-backed credit ledger/reservation workflow before launch.
- Stripe events still require idempotency and correct subscription/top-up accounting.
- Dark Lyrics still does not honor all caption variants, free watermark, and premium resolution. Do not promise these capabilities until implemented and rendered.
- The Next.js dependency is 14.2.5 and npm flags it as vulnerable. Upgrade in a separate tested patch before launch.
- The actual AWS failure from the user's test remains undiagnosed. Direct invocation removes the self-HTTP dependency but does not prove AWS permissions or runtime configuration are correct.
- Polling currently depends on the dashboard being open. Durable background completion/recovery is separate work.
- AWS site access, stock-footage rights, retention jobs, annual billing, mobile QA, and paid-mode checkout validation remain outstanding.

References: [Remotion progress API](https://www.remotion.dev/docs/lambda/getrenderprogress), [dynamic duration](https://www.remotion.dev/docs/calculate-metadata), [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).
