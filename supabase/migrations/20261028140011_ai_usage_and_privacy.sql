create table public.ai_requests(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),actor_id uuid not null references auth.users(id),purpose text not null,created_at timestamptz not null default now());
create index ai_requests_actor on public.ai_requests(actor_id,created_at desc);
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon,authenticated;
grant select on public.ai_requests to authenticated;
create policy actor_read on public.ai_requests for select to authenticated using(actor_id=(select auth.uid()));
create function private.reserve_ai(l uuid,purpose text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if private.member_role(l) is null and not exists(select 1 from public.leagues where id=l and is_public and not is_demo and purpose='registration') then raise exception 'League access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if (select count(*) from public.ai_requests where actor_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'AI hourly request limit reached';end if;
 if (select count(*) from public.ai_requests where actor_id=actor and created_at>now()-interval '1 day')>=100 then raise exception 'AI daily request limit reached';end if;
 insert into public.ai_requests(league_id,actor_id,purpose) values(l,actor,left(purpose,100));
end $$;
revoke all on function private.reserve_ai(uuid,text) from public,anon;
grant execute on function private.reserve_ai(uuid,text) to authenticated;
create function public.reserve_ai(p_league uuid,p_purpose text) returns void language sql security invoker set search_path='' as $$select private.reserve_ai(p_league,p_purpose)$$;
revoke all on function public.reserve_ai(uuid,text) from public,anon;
grant execute on function public.reserve_ai(uuid,text) to authenticated;
