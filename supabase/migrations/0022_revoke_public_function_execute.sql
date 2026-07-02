-- 0022_revoke_public_function_execute.sql
-- Security-definer helpers are server-side primitives. Client roles should not
-- call them directly; API routes use the service-role client instead.

revoke execute on function public.sync_entitlement(text) from public, anon, authenticated;
revoke execute on function public.grant_credits_on_purchase(uuid) from public, anon, authenticated;

grant execute on function public.sync_entitlement(text) to service_role;
grant execute on function public.grant_credits_on_purchase(uuid) to service_role;
