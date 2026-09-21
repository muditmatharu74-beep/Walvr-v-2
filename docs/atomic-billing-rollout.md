# Atomic billing rollout

This branch depends on render lifecycle PR #3. It is not a production cutover.

## Behavior

- A server-only transaction locks the profile and video, checks the current plan and balance, records one charge, and marks the video processing. Repeated submissions do not start a second renderer; separate videos share the same profile lock.
- Pre-render processing errors and provider-confirmed failures use a transaction that returns the recorded charge once. Completed videos cannot later be refunded by a stale failure result. Legacy jobs with no ledger charge do not receive invented refunds.
- Successful settlement increments usage once. Clients cannot delete a processing/rendering video and destroy the reconciliation target.
- Stripe event receipts and business-object keys commit with their balance updates. Two event IDs for the same Checkout Session or invoice cannot grant twice. Database failures return HTTP 500 so Stripe retries.
- Checkout accepts configured prices only. Top-up fulfillment retrieves the Stripe Session and line items, requires paid status, and ignores client-supplied credit metadata. Subscription updates change entitlement but do not grant credits; first and recurring paid invoices supply credits.
- Cancellation removes the subscription entitlement but preserves the existing credit balance. Monthly paid renewals retain the existing product behavior of resetting the balance to the plan allowance, including unused top-ups. Separate purchased-credit rollover is not implemented; this policy needs resolution before marketing credit packs.
- The unsigned Creatomate callback is disabled. Authenticated polling verifies the provider result before settling credits.

## Validation performed locally

- `node --test tests/rendering.test.cjs tests/billing-routes.test.cjs`: 21 passing tests.
- `NODE_PATH=<pglite-install>/node_modules node tests/billing-migration.cjs`: applies both migrations to a fresh local PostgreSQL engine and checks charge/refund/event invariants, rollback/retry, stale invoice handling and privileges.
- `npx tsc --noEmit` and `git diff --check`.

PGlite serializes queries. These checks do not demonstrate multi-connection contention. Before deployment, use a disposable PostgreSQL/Supabase database and two connections to issue simultaneous reservations for the same video, different videos with insufficient combined funds, duplicate refunds, and two Stripe events for the same purchase. Expect one charge per video, no overspend, and one refund/grant per business key.

## Release sequence

1. Finish the end-to-end render verification in PR #3, including AWS access and a successful full video.
2. Verify the billing branch against an isolated database and Stripe test mode: new subscription, renewal, cancellation, top-up, duplicate delivery, failed database operation followed by retry, and payment arriving before customer linkage. Test event delivery after a price/plan change.
3. Before cutover, pause new video and checkout submissions and drain in-flight legacy requests. Record/reconcile existing balances and old jobs; the new ledger cannot reconstruct charges made by the old application.
4. Apply `20260921072556_atomic_video_credits_and_stripe_events.sql`, deploy the matching application, and ensure all old application instances stop writing balances. The schema migration alone does not fix old read/modify/write endpoints.
5. Confirm Stripe sends `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.payment_succeeded`, and the three subscription lifecycle events. Keep the price IDs and signing secret correctly scoped to test/live environments.
6. Verify a controlled charge/refund and a test-mode paid purchase before reopening traffic. Do not roll back to old balance writers while new ledger transactions are active.

## Recovery limits

Refunds for asynchronous renderer failures currently occur when the dashboard polls. There is no scheduled reconciliation worker yet. A process termination, a failed refund RPC, or a job whose tracking write fails can leave a reservation requiring operator reconciliation. The submission log records the video and returned provider identifiers for this purpose. Do not refund an uncertain job until its provider state is checked. If the provider accepts a job but its submission response is lost, the application cannot determine that result from the exception alone; durable submission/reconciliation is still needed before a fully unattended paid launch.

Multiple previously unlinked Stripe customers for one account or conflicting subscriptions are rejected for subscription operations and require reconciliation rather than silently linking the wrong billing identity. Paid top-ups identify the authenticated purchaser through server-set Checkout metadata and preserve any existing customer mapping.
