# Signup trigger hardening

Prepared November 3, 2026. No hosted database or Auth configuration was changed.

The connected project's advisors still report an unset search path and browser
EXECUTE grants on public.handle_new_user(). Its inspected body inserts into
public.profiles and grants 300 starter credits. The repository bootstrap contains
an older body, so replacing the function during this fix could change signup credits.

The CLI-generated migration
20261103232036_harden_signup_trigger.sql changes only two things:

- Pin the existing function's search_path to the empty value.
- Revoke EXECUTE from PUBLIC, anon and authenticated, including explicit grants.

It preserves the function body, owner, SECURITY DEFINER status, existing trigger,
other function settings, existing service-role grants and all profile balances.
Auth continues to invoke the function through its existing signup trigger.
Do not grant browser access merely to silence a permissions error.

## Validation

Run from the repository root with the CI-pinned PGlite dependency on NODE_PATH:

```sh
node tests/signup-security.cjs
node tests/billing-migration.cjs
node tests/security-migration.cjs
```

The signup test reconstructs the inspected 300-credit behavior in a disposable
database, applies the migration twice, denies direct calls from both browser roles,
and verifies signup through an Auth-role insert still creates exactly one profile
with 300 credits. It also verifies existing balances, function identity/body/owner,
unrelated settings and trigger binding survive, and a temporary profiles table
cannot redirect the insert. This is a database rehearsal, not a live Auth signup.
The test is included in the billing/recovery CI workflow.

## Isolated rollout before production

1. Provision the isolated test project and compare its current function body,
   owner, settings, grants and trigger with the reviewed snapshot. Every relation
   referenced by a function with an empty search path must be schema-qualified.
   Stop if the function body differs in a way that needs review.
2. Record aggregate signup behavior and the intended starter-credit allowance.
   Apply this migration to that isolated database using the normal migration flow.
3. Re-run security advisors: the search-path and anon/authenticated EXECUTE warnings
   for this function should be absent. Verify the existing trigger is still bound.
4. Complete a real signup and login through the isolated application. Verify one
   owner profile, the intended credits, normal account access and denied cross-owner
   reads. Delete only the disposable test account after verification.
5. Review the evidence before scheduling the production migration. This commit does
   not apply the change to production or change a user's balance.

Do not roll back by granting EXECUTE to all users again. Investigate a failed test
in the isolated project; preserve the prior function snapshot for review.

## Separate outstanding findings

Leaked-password protection is an Auth setting, not fixed by this SQL migration.
Verify that setting and its availability in the intended project before public
signup opens. The credit_ledger RLS-without-policy informational finding is
consistent with a server-owned ledger: verify browser privileges remain denied;
do not add a browser policy just to remove that informational message.

References:
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/auth/password-security
