-- In-app delivery has no external provider dependency. Recipients and receipts are private.
alter table public.notifications drop constraint notifications_channel_check;
alter table public.notifications add constraint notifications_channel_check check(channel in ('email','sms','in_app'));
alter table public.notifications add column recipient_id uuid references auth.users(id) on delete set null;
alter table public.notifications add column read_at timestamptz;
create index notifications_recipient on public.notifications(recipient_id,league_id,created_at desc) where channel='in_app';
drop policy member_read on public.notifications;
create policy member_read on public.notifications for select to authenticated using (
 private.member_role(league_id)='admin' or (channel='in_app' and recipient_id=(select auth.uid()) and private.member_role(league_id) is not null)
);
create or replace function private.publish_inbox() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and old.status is distinct from 'published' then
 insert into public.notifications(league_id,team_id,channel,destination,recipient_id,subject,body,status,idempotency_key)
 select new.league_id,t.id,'in_app',t.coach_id::text,t.coach_id,'Schedule v'||new.number||' published',
 format('%s: schedule version %s is approved. %s. Open Schedule to see current fixtures. Previous future fixtures may have changed or been removed.',t.name,new.number,new.explanation),
 'delivered',new.id::text||':'||t.id::text||':in_app'
 from public.teams t where t.league_id=new.league_id and t.status='approved' and t.coach_id is not null
 on conflict(idempotency_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.publish_inbox() from public,anon,authenticated;
create trigger schedule_inbox after update of status on public.schedule_versions for each row execute function private.publish_inbox();
create or replace function private.command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r text; id uuid; tid uuid; div_id uuid; v record; le record; t record; g record; item jsonb; stat jsonb;
 queue_result jsonb; lease_token uuid; rating_value int; tier_value int; n int; hs int; aws int; target int; margin numeric; played int; wins int; losses int;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if action='create_league' then
 insert into public.leagues(name,slug,season_name,cutoff_date,owner_id,is_demo) values (p->>'name', 'league-'||gen_random_uuid()::text,coalesce(p->>'season','Fall 2026'),coalesce((p->>'cutoff')::date,'2026-09-01'),actor,coalesce((p->>'demo')::boolean,false)) returning * into le;
 l:=le.id;insert into public.memberships values(l,actor,'admin');
 insert into public.divisions(league_id,name,tier) values(l,'U14 · Premier',1),(l,'U14 · Competitive',2),(l,'U14 · Development',3);
 insert into public.audit_events(league_id,actor_id,action) values(l,actor,'league.created');return jsonb_build_object('id',l);
 end if;
 select * into le from public.leagues where leagues.id=l for update;
 if not found then raise exception 'League not found'; end if;
 r:=private.member_role(l);
 if action='register_team' then
 if r is null then
 if not le.is_public or le.is_demo then raise exception 'Registration is closed' using errcode='42501';end if;
 insert into public.memberships values(l,actor,'coach'); r:='coach'; end if;
 if r not in ('admin','coach') then raise exception 'Coach or administrator required' using errcode='42501';end if;
 if coalesce((p#>>'{assessment,experience}')::int,0) not between 1 and 5 or coalesce((p#>>'{assessment,yearsTogether}')::int,-1) not between 0 and 15 or coalesce((p#>>'{assessment,practicesPerWeek}')::int,-1) not between 0 and 7 then raise exception 'Invalid questionnaire';end if;
 rating_value:=800+(p#>>'{assessment,experience}')::int*75+least((p#>>'{assessment,yearsTogether}')::int,4)*25+least((p#>>'{assessment,practicesPerWeek}')::int,4)*15;
 tier_value:=case when rating_value>=1150 then 1 when rating_value>=950 then 2 else 3 end;
 insert into public.teams(league_id,name,coach_id,coach_email,phone,sms_consent,recommended_division,assessment,assessment_explanation,initial_rating,rating)
 values(l,p->>'name',actor,(select email from auth.users where auth.users.id=actor),nullif(p->>'phone',''),coalesce((p->>'sms_consent')::boolean,false),tier_value,p->'assessment',left(p->>'explanation',4000),rating_value,rating_value) returning teams.id into id;
 elsif action='set_sms_consent' then
 select * into t from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l;
 if t.coach_id is distinct from actor then raise exception 'Only the coach can change SMS consent' using errcode='42501';end if;
 update public.teams set sms_consent=(p->>'consent')::boolean,phone=nullif(p->>'phone','') where teams.id=t.id;
 update public.notifications set status='suppressed',last_error='Coach opted out' where team_id=t.id and channel='sms' and status in ('pending','failed');
 elsif action='mark_notification_read' then
 update public.notifications set read_at=coalesce(read_at,now()) where notifications.id=(p->>'notification_id')::uuid and league_id=l and channel='in_app' and recipient_id=actor and r is not null;
 if not found then raise exception 'Notification access denied' using errcode='42501';end if;
 elsif action='add_player' then
 select * into t from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l;
 if t.id is null or (r is distinct from 'admin' and t.coach_id is distinct from actor) then raise exception 'Roster access denied' using errcode='42501';end if;
 if (p->>'birth_date')::date>le.cutoff_date or (p->>'birth_date')::date<le.cutoff_date-interval '21 years' then raise exception 'Invalid birth date';end if;
 insert into public.players(league_id,team_id,display_name,jersey,birth_date,guardian_consent) values(l,t.id,p->>'display_name',p->>'jersey',(p->>'birth_date')::date,coalesce((p->>'guardian_consent')::boolean,false)) returning players.id into id;
 elsif action='submit_scoresheet' then
 select * into g from public.games where games.id=(p->>'game_id')::uuid and league_id=l;
 if g.id is null or (r not in ('admin','scorekeeper') and not exists(select 1 from public.teams where teams.id in (g.home_team_id,g.away_team_id) and coach_id=actor)) or r is null then raise exception 'Scoresheet access denied' using errcode='42501';end if;
 if not exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published') then raise exception 'Game must be on the published schedule';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='scoresheets' and o.name=p->>'storage_path' and split_part(o.name,'/',1)=l::text and split_part(o.name,'/',2)=actor::text) then raise exception 'Private scoresheet upload is required';end if;
 if p->>'source' not in ('meta','manual') then raise exception 'Invalid extraction provenance';end if;
 insert into public.scoresheets(league_id,game_id,sha256,storage_path,extraction,original_extraction,source,submitted_by) values(l,g.id,p->>'sha256',p->>'storage_path',p->'extraction',p->'extraction',p->>'source',actor) returning scoresheets.id into id;
 else
 if r is null or (r<>'admin' and not(r='scorekeeper' and action in ('confirm_result','reject_scoresheet','reopen_result'))) then raise exception 'Administrator required' using errcode='42501';end if;
 case action
 when 'configure_public' then update public.leagues set is_public=(p->>'enabled')::boolean where leagues.id=l;
 when 'invite_member' then
 if p->>'role' not in ('coach','scorekeeper','referee') then raise exception 'Invalid member role';end if;
 select users.id into tid from auth.users where lower(email)=lower(p->>'email');
 if tid is null then raise exception 'This user must first create an account';end if;
 insert into public.memberships values(l,tid,p->>'role') on conflict(league_id,user_id) do update set role=excluded.role where memberships.role<>'admin';
 when 'assign_coach' then
 select users.id into tid from auth.users where lower(email)=lower(p->>'email');
 if tid is null or not exists(select 1 from public.memberships where league_id=l and user_id=tid and role in ('coach','admin')) then raise exception 'Invite this account as a coach first';end if;
 update public.teams set coach_id=tid,coach_email=(select email from auth.users where users.id=tid),phone=null,sms_consent=false where teams.id=(p->>'team_id')::uuid and league_id=l;
 if not found then raise exception 'Team not found';end if;
 update public.notifications set status='suppressed',last_error='Coach reassigned' where team_id=(p->>'team_id')::uuid and channel in ('email','sms') and status in ('pending','failed');
 when 'approve_team' then
 select * into t from public.teams where teams.id=(p->>'team_id')::uuid and league_id=l and status='pending';if t.id is null then raise exception 'Pending team not found';end if;
 select divisions.id into div_id from public.divisions where league_id=l and tier=coalesce((p->>'tier')::int,t.recommended_division);
 if div_id is null then raise exception 'Invalid division';end if;
 update public.teams set status='approved',division_id=div_id where teams.id=t.id;
 when 'reject_team' then update public.teams set status='rejected' where teams.id=(p->>'team_id')::uuid and league_id=l and status='pending';
 when 'add_court' then insert into public.courts(league_id,name,venue) values(l,p->>'name',p->>'venue') returning courts.id into id;
 when 'add_availability' then insert into public.availability(league_id,court_id,starts_at,ends_at) values(l,(p->>'court_id')::uuid,(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz) returning availability.id into id;
 when 'verify_player' then
 select pl.*,d.max_age into t from public.players pl join public.teams te on te.id=pl.team_id join public.divisions d on d.id=te.division_id where pl.id=(p->>'player_id')::uuid and pl.league_id=l;
 if t.id is null then raise exception 'Player must be on an approved team';end if;
 update public.players set eligibility_status=case when t.guardian_consent and extract(year from age(le.cutoff_date,t.birth_date))<=t.max_age then 'verified' else 'ineligible' end where players.id=t.id;
 when 'draft_schedule' then
 if (p->>'base_revision')::int is distinct from le.revision or (p->>'data_revision')::int is distinct from le.data_revision then raise exception 'Stale league state. Refresh and regenerate.';end if;
 if jsonb_array_length(p->'fixtures')>3000 then raise exception 'Too many fixtures';end if;
 select coalesce(max(number),0)+1 into n from public.schedule_versions where league_id=l;
 insert into public.schedule_versions(league_id,number,base_revision,data_revision,explanation,created_by) values(l,n,le.revision,le.data_revision,left(p->>'explanation',4000),actor) returning schedule_versions.id into id;
 for item in select value from jsonb_array_elements(p->'fixtures') loop
 tid:=(item->>'game_id')::uuid;
 if not exists(select 1 from public.games where games.id=tid and league_id=l) then
 insert into public.games(id,league_id,home_team_id,away_team_id) values(tid,l,(item->>'home_team_id')::uuid,(item->>'away_team_id')::uuid);
 elsif not exists(select 1 from public.games where games.id=tid and league_id=l and home_team_id=(item->>'home_team_id')::uuid and away_team_id=(item->>'away_team_id')::uuid) then raise exception 'Game participants cannot change';end if;
 insert into public.fixtures(league_id,version_id,game_id,court_id,starts_at,ends_at) values(l,id,tid,(item->>'court_id')::uuid,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz);
 end loop;
 perform private.validate_schedule(l,id);
 when 'reject_schedule' then update public.schedule_versions set status='rejected' where schedule_versions.id=(p->>'version_id')::uuid and league_id=l and status='draft';
 when 'publish_schedule' then
 select * into v from public.schedule_versions where schedule_versions.id=(p->>'version_id')::uuid and league_id=l and status='draft';
 if v.id is null then raise exception 'Draft schedule not found';end if;
 if v.base_revision<>le.revision or v.data_revision<>le.data_revision then raise exception 'Draft is stale. Regenerate before approval.';end if;
 perform private.validate_schedule(l,v.id);
 update public.schedule_versions set status='superseded' where league_id=l and status='published';
 update public.schedule_versions set status='published',approved_by=actor where schedule_versions.id=v.id;
 update public.leagues set revision=revision+1 where leagues.id=l;
 for t in select * from public.teams where league_id=l and status='approved' loop
 insert into public.notifications(league_id,team_id,channel,destination,subject,body,idempotency_key)
 values(l,t.id,'email',t.coach_email,'Your Courtside schedule has been published',format('%s: schedule version %s has been approved. %s. Check the league schedule for your updated fixtures.',le.name,v.number,v.explanation),v.id::text||':'||t.id::text||':email') on conflict(idempotency_key) do nothing;
 if t.sms_consent and t.phone is not null then insert into public.notifications(league_id,team_id,channel,destination,subject,body,idempotency_key) values(l,t.id,'sms',t.phone,'Schedule updated',format('%s schedule v%s is approved. Check your coach portal. Reply STOP to opt out.',le.name,v.number),v.id::text||':'||t.id::text||':sms') on conflict(idempotency_key) do nothing;end if;
 end loop;
 when 'reopen_result' then
 if length(coalesce(p->>'correction_reason',''))<5 then raise exception 'A correction reason is required';end if;
 update public.scoresheets set status='review',reopened=true where scoresheets.id=(p->>'sheet_id')::uuid and league_id=l and status='confirmed';
 if not found then raise exception 'Only a confirmed scoresheet can be reopened';end if;
 when 'reject_scoresheet' then update public.scoresheets set status=case when reopened then 'confirmed' else 'rejected' end,reopened=false where scoresheets.id=(p->>'sheet_id')::uuid and league_id=l and status='review';
 when 'confirm_result' then
 select * into v from public.scoresheets where scoresheets.id=(p->>'sheet_id')::uuid and league_id=l and status='review';if v.id is null then raise exception 'Scoresheet already reviewed or missing';end if;
 select * into g from public.games where games.id=v.game_id for update;
 if g.status='confirmed' and length(coalesce(p->>'correction_reason',''))<5 then raise exception 'A correction reason is required for an official result';end if;
 if not coalesce((p->>'reviewed')::boolean,false) then raise exception 'Human review confirmation required';end if;
 hs:=(p#>>'{extraction,homeScore}')::int;aws:=(p#>>'{extraction,awayScore}')::int;
 if hs is null or aws is null or hs not between 0 and 300 or aws not between 0 and 300 then raise exception 'Both valid final scores are required';end if;
 if (p#>>'{extraction,homeTeam}') is distinct from (select name from public.teams where teams.id=g.home_team_id) or (p#>>'{extraction,awayTeam}') is distinct from (select name from public.teams where teams.id=g.away_team_id) then raise exception 'Scoresheet team names do not match fixture';end if;
 if not exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published' and f.starts_at<=now()) then raise exception 'Cannot confirm a game before its scheduled start';end if;
 insert into public.result_revisions(league_id,game_id,scoresheet_id,actor_id,previous_score,confirmed_score,reason,extraction)
 values(l,g.id,v.id,actor,jsonb_build_object('home',g.home_score,'away',g.away_score),jsonb_build_object('home',hs,'away',aws),p->>'correction_reason',p->'extraction');
 delete from public.player_statistics where game_id=g.id;
 for stat in select value from jsonb_array_elements(coalesce(p#>'{extraction,players}','[]')) loop
 if stat->>'team' not in ('home','away') then raise exception 'Invalid player team';end if;
 insert into public.player_statistics(league_id,game_id,team_id,jersey,points,rebounds,assists) values(l,g.id,case when stat->>'team'='home' then g.home_team_id else g.away_team_id end,stat->>'jersey',(stat->>'points')::int,(stat->>'rebounds')::int,(stat->>'assists')::int);
 end loop;
 if coalesce((select sum(points) from public.player_statistics where game_id=g.id and team_id=g.home_team_id),0)>hs or coalesce((select sum(points) from public.player_statistics where game_id=g.id and team_id=g.away_team_id),0)>aws then raise exception 'Player points exceed final team score';end if;
 update public.games set status='confirmed',home_score=hs,away_score=aws,played_at=coalesce(played_at,(select f.starts_at from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published' limit 1)) where games.id=g.id;
 update public.scoresheets set status='superseded' where game_id=g.id and status='confirmed';
 update public.scoresheets set status='confirmed',reopened=false,extraction=p->'extraction' where scoresheets.id=v.id;
 perform private.recalculate(l);
 update public.division_proposals set status='stale' where league_id=l and status='pending';
 when 'propose_balance' then
 update public.division_proposals set status='stale' where league_id=l and status='pending';
 for t in select te.*,d.tier from public.teams te join public.divisions d on d.id=te.division_id where te.league_id=l and te.status='approved' loop
 select count(*),count(*) filter(where diff>0),count(*) filter(where diff<0),avg(diff) into played,wins,losses,margin from
 (select case when home_team_id=t.id then home_score-away_score else away_score-home_score end diff from public.games where league_id=l and status='confirmed' and t.id in (home_team_id,away_team_id) order by played_at desc,games.id desc limit 3) recent;
 target:=case when played=3 and wins=3 and margin>=15 then greatest(1,t.tier-1) when played=3 and losses=3 and margin<=-15 then least(3,t.tier+1) else t.tier end;
 if target<>t.tier then
 select divisions.id into div_id from public.divisions where league_id=l and tier=target;
 insert into public.division_proposals(league_id,team_id,from_division_id,to_division_id,reason,evidence,data_revision) values(l,t.id,t.division_id,div_id,format('Last 3 verified games: %s wins, %s losses, average margin %s. Recommend one tier %s; administrator review required.',wins,losses,round(margin,1),case when target<t.tier then 'up' else 'down' end),jsonb_build_object('games',played,'wins',wins,'losses',losses,'average_margin',margin,'rating',t.rating),le.data_revision);
 end if;
 end loop;
 when 'decide_proposal' then
 select * into v from public.division_proposals where division_proposals.id=(p->>'proposal_id')::uuid and league_id=l and status='pending';
 if v.id is null or v.data_revision<>le.data_revision then raise exception 'Proposal is missing or stale';end if;
 if (p->>'approve')::boolean then
 if exists(select 1 from public.players pl join public.divisions d on d.id=v.to_division_id where pl.team_id=v.team_id and (not pl.guardian_consent or pl.eligibility_status<>'verified' or extract(year from age(le.cutoff_date,pl.birth_date))>d.max_age)) then raise exception 'Resolve roster eligibility and guardian consent before moving division';end if;
 update public.teams set division_id=v.to_division_id where teams.id=v.team_id and division_id=v.from_division_id;
 update public.division_proposals set status='approved' where division_proposals.id=v.id;
 else update public.division_proposals set status='rejected' where division_proposals.id=v.id;end if;
 when 'claim_notifications' then
 id:=gen_random_uuid();lease_token:=id;
 with q as (
 update public.notifications set status='processing',attempts=attempts+1,lease_id=lease_token,lease_until=now()+interval '2 minutes'
 where notifications.id in (select nn.id from public.notifications nn where nn.league_id=l and nn.channel in ('email','sms') and nn.attempts<5 and nn.created_at>now()-interval '23 hours' and ((nn.status in ('pending','failed') and nn.next_attempt_at<=now()) or(nn.status='processing' and nn.lease_until<now())) order by nn.created_at limit 20 for update skip locked)
 returning * ) select coalesce(jsonb_agg(to_jsonb(q)),'[]') into queue_result from q; return queue_result;
 when 'finish_notification' then
 if p->>'status' not in ('accepted','failed','suppressed') then raise exception 'Invalid delivery state';end if;
 update public.notifications set status=p->>'status',provider_id=p->>'provider_id',last_error=left(p->>'error',300),next_attempt_at=now()+make_interval(secs=>least(3600,power(2,attempts)::int*30)),lease_until=null
 where notifications.id=(p->>'notification_id')::uuid and league_id=l and lease_id=(p->>'lease_id')::uuid and status='processing';
 else raise exception 'Unknown action';
 end case;
 end if;
 if action in ('register_team','approve_team','reject_team','add_court','add_availability','confirm_result','decide_proposal','add_player','verify_player') then update public.leagues set data_revision=data_revision+1 where leagues.id=l;end if;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,action,jsonb_build_object('entity_id',coalesce(id::text,p->>'sheet_id',p->>'version_id',p->>'team_id',p->>'proposal_id'),'correction_reason',p->>'correction_reason'));
 return jsonb_build_object('id',id,'ok',true);
end $$;

create or replace function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb; le public.leagues;
begin
 select * into le from public.leagues where id=l;
 r:=private.member_role(l);
 if le.id is null or (public_only and not le.is_public) or (not public_only and r is null) then raise exception 'League access denied' using errcode='42501';end if;
 result:=jsonb_build_object('league',jsonb_build_object('id',le.id,'name',le.name,'slug',le.slug,'season_name',le.season_name,'cutoff_date',le.cutoff_date,'revision',le.revision,'data_revision',le.data_revision,'is_demo',le.is_demo,'timezone',le.timezone),'role',case when public_only then 'public' else r end,
 'divisions',(select coalesce(jsonb_agg(to_jsonb(d) order by tier),'[]') from public.divisions d where league_id=l),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'division_id',t.division_id,'recommended_division',t.recommended_division,'rating',t.rating,'initial_rating',t.initial_rating,'status',t.status)||case when not public_only and (r='admin' or t.coach_id=auth.uid()) then jsonb_build_object('coach_id',t.coach_id,'coach_email',t.coach_email,'phone',t.phone,'sms_consent',t.sms_consent,'assessment',t.assessment,'assessment_explanation',t.assessment_explanation) else '{}'::jsonb end order by t.name),'[]') from public.teams t where league_id=l and (not public_only or status='approved')),
 'courts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.courts c where league_id=l),
 'games',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.games g where league_id=l and (not public_only or exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published'))),
 'fixtures',(select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('home_team_id',g.home_team_id,'away_team_id',g.away_team_id) order by f.starts_at),'[]') from public.fixtures f join public.games g on g.id=f.game_id join public.schedule_versions sv on sv.id=f.version_id where f.league_id=l and (not public_only or sv.status='published')),
 'versions',(select coalesce(jsonb_agg(to_jsonb(sv) order by number desc),'[]') from public.schedule_versions sv where league_id=l and (not public_only or status='published')));
 if public_only then return result||jsonb_build_object('availability','[]'::jsonb,'scoresheets','[]'::jsonb,'players','[]'::jsonb,'notifications','[]'::jsonb,'audit','[]'::jsonb,'proposals','[]'::jsonb);end if;
 return result||jsonb_build_object(
 'availability',(select coalesce(jsonb_agg(to_jsonb(a) order by starts_at),'[]') from public.availability a where league_id=l),
 'scoresheets',(select coalesce(jsonb_agg(to_jsonb(s) order by created_at desc),'[]') from public.scoresheets s where league_id=l and (r in ('admin','scorekeeper') or submitted_by=auth.uid())),
 'players',(select coalesce(jsonb_agg(to_jsonb(pl)),'[]') from public.players pl where league_id=l and (r='admin' or exists(select 1 from public.teams t where t.id=pl.team_id and t.coach_id=auth.uid()))),
 'notifications',(select coalesce(jsonb_agg(to_jsonb(n)-'destination'-'lease_id'-'lease_until' order by created_at desc),'[]') from public.notifications n where league_id=l and (r='admin' or (n.channel='in_app' and n.recipient_id=auth.uid()))),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc),'[]') from (select * from public.audit_events where league_id=l and r='admin' order by created_at desc limit 100) a),
 'proposals',(select coalesce(jsonb_agg(to_jsonb(dp) order by created_at desc),'[]') from public.division_proposals dp where league_id=l and r='admin'));
end $$;
