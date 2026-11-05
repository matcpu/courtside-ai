-- PostgREST 14 retries SQLSTATE 40001 indefinitely, including deterministic
-- revision conflicts. Translate only at the public RPC boundary. The private
-- commands retain their row locks, atomic validation and transaction rollback.
-- Supabase: high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions
create or replace function public.organizer_command(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 return private.organizer_command(p_action,p_payload);
exception when sqlstate '40001' then
 raise sqlstate 'PT409' using message=sqlerrm,
  hint='Reload and review the current settings. Do not automatically retry the stale draft.';
end $$;

create or replace function public.preseason_command(p_league uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 return private.preseason_command(p_league,p_action,p_payload);
exception when sqlstate '40001' then
 raise sqlstate 'PT409' using message=sqlerrm,
  hint='Reload and review the current season rules before saving again.';
end $$;

revoke all on function public.organizer_command(text,jsonb) from public,anon;
revoke all on function public.preseason_command(uuid,text,jsonb) from public,anon;
grant execute on function public.organizer_command(text,jsonb) to authenticated;
grant execute on function public.preseason_command(uuid,text,jsonb) to authenticated;
