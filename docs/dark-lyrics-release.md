# Dark Lyrics rendering repair

The process route now calls the Remotion Lambda client directly, preserving the original exception in server logs. It saves the AWS bucket, region, function and provider under videos.analysis.render. A signature binds those fields and the render ID to the authenticated owner and video, because videos are client-editable. No database migration is required for render tracking.

The status endpoint loads the owned video, validates signed Remotion tracking, polls the correct provider, and persists completion/failure. Legacy Creatomate jobs remain supported. Old unfinished Dark Lyrics jobs without a saved bucket become errors; submit a new video to retry them.

Duration comes from the transcription's full audio duration, including instrumental endings, and the composition calculates its frame count at 30 fps. All Remotion packages are pinned to 4.0.512, matching the function named in the project handoff. Verify the actual AWS function before deployment.

## Validation performed

- 18 automated tests covering full duration, resolution, owned audio URLs, authenticated ownership, duplicate requests, Remotion success/failure/in-progress, legacy Creatomate, missing output and metadata tampering.
- TypeScript check.
- Next.js production build using placeholder credentials (not a live-service test).
- Browser-based composition inspection: 190 seconds produces 5,700 frames at 1080 x 1920; 15.01 seconds on Business produces 451 frames at 2160 x 3840.
- A local rendered frame was inspected. Test captions were synthetic, not a transcription of the user's song.

## Deployment order

1. Check out this branch and run npm ci in an environment with the existing AWS render credentials securely configured.
2. Deploy a separate Remotion site, keeping the current site available for rollback:

   npx remotion lambda sites create src/remotion/index.ts --site-name=walvr-render-fix --region=us-east-1

3. Confirm the existing Lambda function uses Remotion 4.0.512. If it does not, provision a matching function before switching the app.
4. Configure the Vercel preview with the new REMOTION_SERVE_URL, matching REMOTION_FUNCTION_NAME, region and existing AWS credentials. Do not change production settings before testing the preview.
5. In the authenticated preview, upload the supplied MP3 with Dark Lyrics. Verify processing -> rendering -> done, playable output, full audio duration, captions and download. Inspect the original AWS error in process logs if startup fails.
6. Only promote after that test passes. Changing the Next.js deployment alone does not update the separate Remotion site on AWS.

## Remaining launch blockers (not changed here)

- Production profiles has RLS disabled and grants to anon/authenticated. Existing update policies also allow editing billing fields. Account and credit permissions need a separate tested database change.
- Credit deduction is still a read/update operation and is not atomic across different simultaneous video requests. Stripe event idempotency and render refunds require separate billing work.
- The dependency install reports existing security advisories, including Next.js 14.2.5. Upgrade and validate separately before paid launch.
- Full AWS execution, transcription of the supplied MP3, and live upload-to-download are not verified yet. No production deployment or database changes were performed.
- Rotating the service-role key invalidates signatures for unfinished jobs; retain/re-sign those jobs as part of any key rotation.
