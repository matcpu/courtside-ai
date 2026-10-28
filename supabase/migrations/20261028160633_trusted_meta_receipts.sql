create or replace function private.record_meta_evidence(l uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(p->>'actor_id')::uuid;r text;tid uuid;item uuid;begin
 select role into r from public.memberships where league_id=l and user_id=actor;
 if actor is null or r is null then raise exception 'Evidence access denied' using errcode='42501';end if;
 if p->>'feature'='placement' then
 select id into tid from public.teams where league_id=l and id=(p->>'object_id')::uuid and (coach_id=actor or r='admin');
 if tid is null then raise exception 'Team evidence denied' using errcode='42501';end if;
 if (p->>'revision')::int is distinct from (select revision from public.coach_questionnaires where team_id=tid) then raise exception 'Questionnaire changed while Meta was interpreting it';end if;
 update public.coach_questionnaires set meta_analysis=p->'response' where team_id=tid;
 elsif p->>'feature'='scoresheet' then
 if not exists(select 1 from public.scoresheets where id=(p->>'object_id')::uuid and league_id=l and (submitted_by=actor or r in ('admin','scorekeeper'))) then raise exception 'Scoresheet evidence denied' using errcode='42501';end if;
 elsif p->>'feature' in ('operations','schedule') then
 if r<>'admin' then raise exception 'Administrator evidence required' using errcode='42501';end if;
 else raise exception 'Invalid Meta evidence feature';end if;
 if length(coalesce(p->>'response_id','')) not between 3 and 200 or length(coalesce(p->>'model','')) not between 3 and 100 then raise exception 'Actual provider response metadata is required';end if;
 insert into public.meta_evidence(league_id,feature,object_id,initiated_by,model,response_id,request_digest,response,tool_calls) values(l,p->>'feature',(p->>'object_id')::uuid,actor,p->>'model',p->>'response_id',p->>'request_digest',p->'response',coalesce(p->'tool_calls','[]')) on conflict(response_id) do nothing returning id into item;
 return jsonb_build_object('id',item);
end $$;

revoke all on function private.record_meta_evidence(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.record_meta_evidence(uuid,jsonb) to service_role;
revoke all on function public.record_meta_evidence(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_meta_evidence(uuid,jsonb) to service_role;
