# Render recovery (stacked on billing PR #4)

This change is draft code, not an enabled production worker.

## Behavior

The protected GET /api/cron/recover-renders endpoint checks up to ten due jobs concurrently. It uses a compare-and-swap lease on each video so overlapping invocations cannot claim the same due row. A lease expires after 15 minutes if a worker terminates. The existing atomic settlement RPC handles races with dashboard polling and prevents duplicate refunds.

Provider-confirmed completion saves the output; confirmed failure refunds the recorded charge once. Temporary provider/settlement errors defer the job. Processing jobs and missing tracking metadata are marked `manual_review_missing_submission_tracking`; they are never blindly resubmitted or refunded. Review markers can be inspected in the database; no admin review UI or alert delivery is included.

The submission route now treats exceptions after entering the provider-submission boundary as uncertain. A lost provider response cannot establish whether the job started. Pre-submission processing failures still use the one-time refund transaction. This deliberately means some clearly rejected submissions also need review until provider-specific rejection classification is added.

## Activation

1. Complete the prerequisite migration/application rollout for PRs #3 and #4.
2. Apply the render_recovery migration before deploying this branch.
3. Configure a long random CRON_SECRET in the production environment. Never put it in source or a NEXT_PUBLIC variable. Without it the worker returns 503; unauthorized requests return 401.
4. The included cron runs daily at 08:00 UTC, with ten jobs per run. This is a conservative fallback, NOT a paid-launch recovery SLA. Confirm the hosting plan before increasing frequency (e.g. every five minutes) and load-test batch capacity. Dashboard polling continues normally.
5. Test authorized invocation in staging with provider credentials, a success, a confirmed failure, and a transient lookup failure. Inspect database recovery markers and logs. Monitor queue age/count and review markers before paid launch.

No credentials, production balances or external renders were used by local tests. The CI workflow provisions disposable PostgreSQL and checks actual overlapping financial transactions; its result must be checked before declaring the concurrency gate passed.

## Limits

This recovers jobs with saved provider tracking even when the browser is closed. It does not automatically reconstruct a lost submission response, restart interrupted transcription, or guarantee refunds for untracked jobs. Such cases still require operator reconciliation. No purchased-credit rollover policy changes are included.
