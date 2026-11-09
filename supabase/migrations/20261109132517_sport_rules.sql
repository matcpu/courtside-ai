-- Additive, local-review migration. Existing leagues retain their exact 2/1/0 policy.
-- All writes use the existing authenticated RPC boundary and the league row lock.
create function public.sport_capabilities() returns jsonb language sql immutable security invoker set search_path='' as $$
 select '{"version":1,"sports":["basketball","hockey"]}'::jsonb
$$;
revoke all on function public.sport_capabilities() from public,anon;
grant execute on function public.sport_capabilities() to authenticated;
create function private.default_sport_rules(s text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('version',1,'winPoints',2,'drawPoints',1,'lossPoints',0,'overtimeLossPoints',case when s='hockey' then 1 else 0 end,
 'allowDraws',true,'allowOvertime',true,'allowShootout',s='hockey','maxScore',case when s='hockey' then 99 else 300 end,'gameMinutes',60,'restMinutes',30,'tieBreak','differential')
$$;
create function private.valid_sport_rules(s text,r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;begin
 if s not in ('basketball','hockey') or s is null or jsonb_typeof(r) is distinct from 'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(r))<>12 or r->>'version' is distinct from '1' then return false;end if;
 if r-array['version','winPoints','drawPoints','lossPoints','overtimeLossPoints','allowDraws','allowOvertime','allowShootout','maxScore','gameMinutes','restMinutes','tieBreak']<>'{}'::jsonb or jsonb_typeof(r->'tieBreak') is distinct from 'string' then return false;end if;
 foreach k in array array['version','winPoints','drawPoints','lossPoints','overtimeLossPoints','maxScore','gameMinutes','restMinutes'] loop
  if jsonb_typeof(r->k) is distinct from 'number' or r->>k !~ '^[0-9]+$' then return false;end if;
 end loop;
 foreach k in array array['winPoints','drawPoints','lossPoints','overtimeLossPoints'] loop if (r->>k)::int not between 0 and 10 then return false;end if;end loop;
 foreach k in array array['allowDraws','allowOvertime','allowShootout'] loop if jsonb_typeof(r->k) is distinct from 'boolean' then return false;end if;end loop;
 return (r->>'maxScore')::int between 1 and 300 and (r->>'gameMinutes')::int between 15 and 240 and (r->>'restMinutes')::int between 0 and 240
  and r->>'tieBreak' in ('differential','wins') and not(s='basketball' and (r->>'allowShootout')::boolean);
exception when numeric_value_out_of_range then return false;
end $$;
revoke all on function private.default_sport_rules(text),private.valid_sport_rules(text,jsonb) from public,anon,authenticated;
alter table public.leagues add column sport text not null default 'basketball' check(sport in ('basketball','hockey'));
alter table public.leagues add column sport_rules jsonb not null default private.default_sport_rules('basketball');
alter table public.leagues add column sport_revision int not null default 1;
alter table public.leagues add constraint league_sport_rules_valid check(private.valid_sport_rules(sport,sport_rules));
alter table public.games add column decision text not null default 'regulation' check(decision in ('regulation','overtime','shootout'));
alter table public.games add column result_rules jsonb;
alter table public.games add column result_sport_revision int;
create table public.sport_rule_revisions (
 league_id uuid not null references public.leagues(id), revision int not null, sport text not null, rules jsonb not null,
 changed_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(league_id,revision)
);
alter table public.sport_rule_revisions enable row level security;
revoke all on public.sport_rule_revisions from public,anon,authenticated;
grant select on public.sport_rule_revisions to authenticated;
create policy admin_read on public.sport_rule_revisions for select to authenticated using(private.member_role(league_id)='admin');

create function private.set_sport_rules(l uuid,s text,r jsonb) returns void language plpgsql security definer set search_path='' as $$
declare le public.leagues;begin
 select * into le from public.leagues where id=l for update;
 if auth.uid() is null or private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 if not private.valid_sport_rules(s,r) then raise exception 'Invalid sport rules';end if;
 if le.sport=s and le.sport_rules=r then return;end if;
 if le.sport<>s and exists(select 1 from public.teams where league_id=l) then raise exception 'Choose the sport before registering teams. Create a separate league for another sport.' using errcode='PT409';end if;
 if exists(select 1 from public.games where league_id=l and status='confirmed') or exists(select 1 from public.schedule_versions where league_id=l and status in ('published','superseded')) then
  raise exception 'Sport rules are locked after publication or official results. Copy to a fresh season to change them.' using errcode='PT409';end if;
 insert into public.sport_rule_revisions values(l,le.sport_revision,le.sport,le.sport_rules,auth.uid(),now()) on conflict do nothing;
 update public.leagues set sport=s,sport_rules=r,sport_revision=sport_revision+1,data_revision=data_revision+1 where id=l;
 insert into public.sport_rule_revisions values(l,le.sport_revision+1,s,r,auth.uid(),now());
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'sport.rules_changed',jsonb_build_object('sport',s,'rules',r,'revision',le.sport_revision+1));
end $$;
revoke all on function private.set_sport_rules(uuid,text,jsonb) from public,anon,authenticated;

-- Preserve the existing workflows behind an authorization/validation wrapper.
alter function private.command(uuid,text,jsonb) rename to basketball_command;
revoke all on function private.basketball_command(uuid,text,jsonb) from public,anon,authenticated;
create function private.command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare le public.leagues;res jsonb;s text;r jsonb;e jsonb;hs int;aws int;decision text;g uuid;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if action='create_league' then
  s:=coalesce(p->>'sport','basketball');r:=coalesce(p->'sportRules',private.default_sport_rules(s));
  if not private.valid_sport_rules(s,r) then raise exception 'Invalid sport rules';end if;
  res:=private.basketball_command(l,action,p);perform private.set_sport_rules((res->>'id')::uuid,s,r);return res;
 end if;
 select * into le from public.leagues where id=l for update;
 if le.id is null or (private.member_role(l) is null and action<>'register_team') then raise exception 'Administrator required or league access denied' using errcode='42501';end if;
 if action='configure_sport' then
  if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
  if (p->>'expected_sport_revision')::int is distinct from le.sport_revision then raise exception 'Sport rules changed. Reload and review the current league.' using errcode='PT409';end if;
  perform private.set_sport_rules(l,p->>'sport',p->'sportRules');return jsonb_build_object('ok',true);
 end if;
 if le.sport<>'basketball' and action in ('propose_balance','decide_proposal') then raise exception 'Automatic balancing is available for basketball only; hockey placement requires administrator review.';end if;
 if action in ('submit_scoresheet','confirm_result') then
  if action='confirm_result' and private.member_role(l) not in ('admin','scorekeeper') then raise exception 'Reviewer required' using errcode='42501';end if;
  e:=p->'extraction';decision:=coalesce(e->>'decision','regulation');
  if jsonb_typeof(e) is distinct from 'object' or decision not in ('regulation','overtime','shootout') then raise exception 'Invalid score entry';end if;
  if le.sport='hockey' and (coalesce(jsonb_array_length(e->'players'),0)>0 or (action='submit_scoresheet' and p->>'source' is distinct from 'manual')) then raise exception 'Hockey supports manual team scores only; basketball statistics and recognition are unavailable';end if;
  hs:=(e->>'homeScore')::int;aws:=(e->>'awayScore')::int;
  if action='confirm_result' or (hs is not null and aws is not null) then
   if hs is null or aws is null or hs not between 0 and (le.sport_rules->>'maxScore')::int or aws not between 0 and (le.sport_rules->>'maxScore')::int then raise exception 'Both valid final scores are required within configured bounds';end if;
   if hs=aws and (not(le.sport_rules->>'allowDraws')::boolean or decision<>'regulation') then raise exception 'Tied final scores are not allowed for this decision';end if;
   if decision='shootout' and abs(hs-aws)<>1 then raise exception 'Shootout final score must include exactly one deciding goal';end if;
  end if;
  if decision='overtime' and not(le.sport_rules->>'allowOvertime')::boolean or decision='shootout' and not(le.sport_rules->>'allowShootout')::boolean then raise exception 'Decision is not allowed by league rules';end if;
 end if;
 res:=private.basketball_command(l,action,p);
 if action='confirm_result' then
  select game_id into g from public.scoresheets where id=(p->>'sheet_id')::uuid and league_id=l;
  update public.games set decision=coalesce(p#>>'{extraction,decision}','regulation'),result_rules=le.sport_rules,result_sport_revision=le.sport_revision where id=g;
 end if;
 if le.sport='hockey' and action='register_team' then update public.teams set rating=1000,initial_rating=1000,recommended_division=2,assessment_explanation='Hockey placement requires administrator review; basketball rubric is not used.' where id=(res->>'id')::uuid and league_id=l;end if;
 return res;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public,anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

-- Score entries retain the submitted decision in result_revisions.extraction;
-- the immutable current rules snapshot is recorded on the official game.
alter function private.snapshot(uuid,boolean) rename to basketball_snapshot;
revoke all on function private.basketball_snapshot(uuid,boolean) from public,anon,authenticated;
create function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare res jsonb;begin
 res:=private.basketball_snapshot(l,public_only);
 return jsonb_set(res,'{league}',res->'league'||(select jsonb_build_object('sport',sport,'sport_rules',sport_rules,'sport_revision',sport_revision) from public.leagues where id=l));
end $$;
revoke all on function private.snapshot(uuid,boolean) from public;
grant execute on function private.snapshot(uuid,boolean) to anon,authenticated;

-- Existing-season drafts must compare sport configuration under the SAME lock.
alter function private.organizer_safety_snapshot(uuid) rename to basketball_safety_snapshot;
revoke all on function private.basketball_safety_snapshot(uuid) from public,anon,authenticated;
create function private.organizer_safety_snapshot(l uuid) returns jsonb language sql stable set search_path='' as $$
 select private.basketball_safety_snapshot(l)||jsonb_build_object('sport',le.sport,'sport_rules',le.sport_rules,'sport_revision',le.sport_revision) from public.leagues le where le.id=l
$$;
revoke all on function private.organizer_safety_snapshot(uuid) from public,anon,authenticated;
alter function private.validate_organizer_setup(jsonb,boolean) rename to basketball_validate_organizer_setup;
revoke all on function private.basketball_validate_organizer_setup(jsonb,boolean) from public,anon,authenticated;
create function private.validate_organizer_setup(p jsonb,complete boolean) returns void language plpgsql set search_path='' as $$begin
 perform private.basketball_validate_organizer_setup(p,complete);
 if not private.valid_sport_rules(coalesce(p->>'sport','basketball'),coalesce(p->'sportRules',private.default_sport_rules(coalesce(p->>'sport','basketball')))) then raise exception 'Invalid sport rules';end if;
end $$;
revoke all on function private.validate_organizer_setup(jsonb,boolean) from public,anon,authenticated;

alter function private.organizer_command(text,jsonb) rename to basketball_organizer_command;
revoke all on function private.basketball_organizer_command(text,jsonb) from public,anon,authenticated;
create function private.organizer_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare res jsonb;d public.organizer_drafts;l uuid;le public.leagues;draft_id uuid;s text;r jsonb;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if action='finish' then
  select * into d from public.organizer_drafts where id=(p->>'id')::uuid and owner_id=auth.uid();
  if d.id is null then raise exception 'Draft access denied' using errcode='42501';end if;
  -- Same lock order as the underlying command: league, then draft. New drafts
  -- only lock their draft; the created league is private to this transaction.
  if d.league_id is not null then select * into le from public.leagues where id=d.league_id for update;end if;
  select * into d from public.organizer_drafts where id=d.id for update;
  res:=private.basketball_organizer_command(action,p);
  if d.status<>'completed' then
   l:=(res->>'league_id')::uuid;
   s:=coalesce(d.data->>'sport',le.sport,'basketball');
   r:=coalesce(d.data->'sportRules',case when le.id is not null and le.sport=s then le.sport_rules else private.default_sport_rules(s) end);
   perform private.set_sport_rules(l,s,r);
  end if;
  return res;
 end if;
 res:=private.basketball_organizer_command(action,p);
 if action in ('copy','begin_edit') then
  select * into le from public.leagues where id=(p->>'league_id')::uuid;
  draft_id:=(res->>'id')::uuid;
  update public.organizer_drafts set data=data||jsonb_build_object('sport',le.sport,'sportRules',le.sport_rules) where id=draft_id;
  select to_jsonb(od)-'owner_id' into res from public.organizer_drafts od where od.id=draft_id;
 elsif action='workspace' and res->'setup' is not null and res->'setup'<>'null'::jsonb then
  select * into le from public.leagues where id=(p->>'league_id')::uuid;
  res:=jsonb_set(res,'{setup}',res->'setup'||jsonb_build_object('sport',le.sport,'sportRules',le.sport_rules));
 end if;
 return res;
end $$;
revoke all on function private.organizer_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.organizer_command(text,jsonb) to authenticated;

-- Hockey questionnaire validation is shared, but its placement is explicitly
-- human-led, never calibrated with basketball scoring-margin thresholds.
create function private.sport_preseason_recommend(l uuid,q jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare validated jsonb;begin
 validated:=private.preseason_recommend(q);
 if (select sport from public.leagues where id=l)='basketball' then return validated;end if;
 return jsonb_build_object('tier',(q->>'preferredTier')::int,'rating',1000,'confidence',0,'flags',jsonb_build_array('Hockey placement rubric is not calibrated. Administrator assessment required.'),'source','coach_preference','explanation','Coach preference only. Review this hockey assessment and approve or override placement before scheduling.','evidence','[]'::jsonb);
end $$;
revoke all on function private.sport_preseason_recommend(uuid,jsonb) from public,anon,authenticated;
do $$declare def text;begin
 def:=pg_get_functiondef('private.preseason_document_command(uuid,text,jsonb)'::regprocedure);
 if position('rec:=private.preseason_recommend(p->''data'');' in def)=0 then raise exception 'Unexpected preseason function; migration stopped';end if;
 execute replace(def,'rec:=private.preseason_recommend(p->''data'');','rec:=private.sport_preseason_recommend(l,p->''data'');');
 def:=pg_get_functiondef('private.core_validate_schedule(uuid,uuid)'::regprocedure);
 if position('interval ''30 minutes''' in def)=0 then raise exception 'Unexpected schedule function; migration stopped';end if;
 execute replace(def,'interval ''30 minutes''','make_interval(mins=>(select (sport_rules->>''restMinutes'')::int from public.leagues where id=l))');
end $$;
alter function private.validate_schedule(uuid,uuid) rename to basketball_validate_schedule;
revoke all on function private.basketball_validate_schedule(uuid,uuid) from public,anon,authenticated;
create function private.validate_schedule(l uuid,v uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.basketball_validate_schedule(l,v);
 if exists(select 1 from public.fixtures f join public.games g on g.id=f.game_id join public.leagues le on le.id=f.league_id where f.league_id=l and f.version_id=v and g.status<>'confirmed' and f.ends_at-f.starts_at<>make_interval(mins=>(le.sport_rules->>'gameMinutes')::int)) then raise exception 'Fixture duration must match the configured game slot';end if;
end $$;
revoke all on function private.validate_schedule(uuid,uuid) from public,anon,authenticated;

create function private.sport_standings(l uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(st)-'tie_wins' order by st.points desc,st.tie_wins desc,st.differential desc,st.name collate "C"),'[]') from (
 select t.name,count(g.id)::int played,
 count(g.id) filter(where (g.home_team_id=t.id and g.home_score>g.away_score) or (g.away_team_id=t.id and g.away_score>g.home_score))::int wins,
 count(g.id) filter(where (g.home_team_id=t.id and g.home_score<g.away_score) or (g.away_team_id=t.id and g.away_score<g.home_score))::int losses,
 count(g.id) filter(where g.home_score=g.away_score)::int draws,
 count(g.id) filter(where g.decision in ('overtime','shootout') and ((g.home_team_id=t.id and g.home_score<g.away_score) or (g.away_team_id=t.id and g.away_score<g.home_score)))::int "overtimeLosses",
 coalesce(sum(case when g.id is null then 0 when g.home_score=g.away_score then (le.sport_rules->>'drawPoints')::int
 when (g.home_team_id=t.id and g.home_score>g.away_score) or (g.away_team_id=t.id and g.away_score>g.home_score) then (le.sport_rules->>'winPoints')::int
 when g.decision in ('overtime','shootout') then (le.sport_rules->>'overtimeLossPoints')::int else (le.sport_rules->>'lossPoints')::int end),0)::int points,
 coalesce(sum(case when g.home_team_id=t.id then g.home_score-g.away_score else g.away_score-g.home_score end),0)::int differential,
 case when le.sport_rules->>'tieBreak'='wins' then count(g.id) filter(where (g.home_team_id=t.id and g.home_score>g.away_score) or (g.away_team_id=t.id and g.away_score>g.home_score)) else 0 end tie_wins
 from public.teams t join public.leagues le on le.id=t.league_id left join public.games g on g.league_id=l and g.status='confirmed' and g.home_score is not null and g.away_score is not null and t.id in(g.home_team_id,g.away_team_id)
 where t.league_id=l and t.status='approved' group by t.id,t.name,le.sport_rules) st
$$;
revoke all on function private.sport_standings(uuid) from public,anon,authenticated;
alter function private.launch_site_data(uuid,jsonb) rename to basketball_launch_site_data;
revoke all on function private.basketball_launch_site_data(uuid,jsonb) from public,anon,authenticated;
create function private.launch_site_data(l uuid,c jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare res jsonb;meta jsonb;begin
 res:=private.basketball_launch_site_data(l,c);
 select jsonb_build_object('sport',sport,'sport_rules',sport_rules) into meta from public.leagues where id=l;
 return jsonb_set(res,'{league}',res->'league'||meta)||jsonb_build_object('standings',private.sport_standings(l));
end
$$;
revoke all on function private.launch_site_data(uuid,jsonb) from public,anon,authenticated;
do $$declare def text;begin
 def:=pg_get_functiondef('private.basketball_launch_site_data(uuid,jsonb)'::regprocedure);
 if position('''status'',g.status' in def)=0 then raise exception 'Unexpected public site function; migration stopped';end if;
 execute replace(def,'''status'',g.status','''status'',g.status,''decision'',g.decision');
end $$;
