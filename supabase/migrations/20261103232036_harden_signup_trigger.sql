-- Harden the existing Auth trigger without replacing its project-specific body.
-- In particular, preserve the live signup credit allowance and existing balances.
begin;

alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
