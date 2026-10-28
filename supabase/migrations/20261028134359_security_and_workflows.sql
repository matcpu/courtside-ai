-- Keep exposed functions invoker-only; the public directory returns four whitelisted fields.
create function private.public_league_directory() returns table(id uuid,name text,slug text,is_demo boolean) language sql stable security definer set search_path='' as $$select id,name,slug,is_demo from public.leagues where is_public order by created_at$$;
revoke all on function private.public_league_directory() from public;
grant execute on function private.public_league_directory() to anon,authenticated;
create or replace function public.public_leagues() returns table(id uuid,name text,slug text,is_demo boolean) language sql stable security invoker set search_path='' as $$ select * from private.public_league_directory() $$;

create function private.record_workflow(l uuid,run_id uuid,state text,trace jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); id uuid;
begin
 if actor is null or private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 if state not in ('running','awaiting_approval','completed','failed') or jsonb_array_length(trace)>12 then raise exception 'Invalid workflow state';end if;
 perform 1 from public.leagues where leagues.id=l for update;
 if run_id is null then
 if (select count(*) from public.workflow_runs where actor_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Workflow hourly limit reached';end if;
 insert into public.workflow_runs(league_id,actor_id,status,steps) values(l,actor,state,trace) returning workflow_runs.id into id;
 else update public.workflow_runs set status=state,steps=trace where workflow_runs.id=run_id and league_id=l and actor_id=actor returning workflow_runs.id into id;
 end if;
 return id;
end $$;
revoke all on function private.record_workflow(uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.record_workflow(uuid,uuid,text,jsonb) to authenticated;
create function public.record_workflow(p_league uuid,p_run uuid,p_status text,p_steps jsonb) returns uuid language sql security invoker set search_path='' as $$select private.record_workflow(p_league,p_run,p_status,p_steps)$$;
revoke all on function public.record_workflow(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.record_workflow(uuid,uuid,text,jsonb) to authenticated;
