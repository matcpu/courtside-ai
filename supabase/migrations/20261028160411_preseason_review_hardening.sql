grant usage on schema private to service_role;
create table public.meta_evidence(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),feature text not null check(feature in ('scoresheet','placement','operations','schedule')),
 object_id uuid,initiated_by uuid not null references auth.users(id),model text not null,response_id text not null unique,request_digest text not null check(request_digest~'^[a-f0-9]{64}$'),
 response jsonb not null,tool_calls jsonb not null default '[]',created_at timestamptz not null default now(),check(octet_length(response::text)<=60000),check(octet_length(tool_calls::text)<=60000)
);
create index meta_evidence_league on public.meta_evidence(league_id,created_at desc);
create index meta_evidence_actor on public.meta_evidence(initiated_by);
alter table public.meta_evidence enable row level security;
revoke all on public.meta_evidence from public,anon,authenticated;
create function private.record_meta_evidence(l uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=private.member_role(l);tid uuid;item uuid;begin
 if auth.uid() is null or r is null then raise exception 'Evidence access denied' using errcode='42501';end if;
 if p->>'feature'='placement' then
 select id into tid from public.teams where league_id=l and id=(p->>'object_id')::uuid and (coach_id=auth.uid() or r='admin');
 if tid is null then raise exception 'Team evidence denied' using errcode='42501';end if;
 if (p->>'revision')::int is distinct from (select revision from public.coach_questionnaires where team_id=tid) then raise exception 'Questionnaire changed while Meta was interpreting it';end if;
 update public.coach_questionnaires set meta_analysis=p->'response' where team_id=tid;
 elsif p->>'feature'='scoresheet' then
 if not exists(select 1 from public.scoresheets where id=(p->>'object_id')::uuid and league_id=l and (submitted_by=auth.uid() or r in ('admin','scorekeeper'))) then raise exception 'Scoresheet evidence denied' using errcode='42501';end if;
 elsif p->>'feature' in ('operations','schedule') then
 if r<>'admin' then raise exception 'Administrator evidence required' using errcode='42501';end if;
 else raise exception 'Invalid Meta evidence feature';end if;
 if length(coalesce(p->>'response_id','')) not between 3 and 200 or length(coalesce(p->>'model','')) not between 3 and 100 then raise exception 'Actual provider response metadata is required';end if;
 insert into public.meta_evidence(league_id,feature,object_id,initiated_by,model,response_id,request_digest,response,tool_calls) values(l,p->>'feature',(p->>'object_id')::uuid,auth.uid(),p->>'model',p->>'response_id',p->>'request_digest',p->'response',coalesce(p->'tool_calls','[]')) on conflict(response_id) do nothing returning id into item;
 return jsonb_build_object('id',item);
end $$;
revoke all on function private.record_meta_evidence(uuid,jsonb) from public,anon;
grant execute on function private.record_meta_evidence(uuid,jsonb) to authenticated;
create function public.record_meta_evidence(p_league uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.record_meta_evidence(p_league,p_payload)$$;
revoke all on function public.record_meta_evidence(uuid,jsonb) from public,anon;
grant execute on function public.record_meta_evidence(uuid,jsonb) to authenticated;
create function private.meta_evidence_list(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator evidence required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc),'[]') from (select * from public.meta_evidence where league_id=l order by created_at desc limit 50)e);
end $$;
revoke all on function private.meta_evidence_list(uuid) from public,anon;
grant execute on function private.meta_evidence_list(uuid) to authenticated;
create function public.meta_evidence_list(p_league uuid) returns jsonb language sql security invoker set search_path='' as $$select private.meta_evidence_list(p_league)$$;
revoke all on function public.meta_evidence_list(uuid) from public,anon;
grant execute on function public.meta_evidence_list(uuid) to authenticated;
create or replace function private.preseason_command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r text:=private.member_role(l);cfg public.preseason_settings;te public.teams;pl public.players;doc public.age_documents;rec jsonb;q public.coach_questionnaires;result jsonb;tid uuid;inv_id uuid;old_cutoff date;age_value int;d public.divisions;duplicate_found boolean;begin
 if actor is null then raise exception 'Preseason access denied' using errcode='42501';end if;
 if r is null and action='save_questionnaire' and nullif(p->>'team_id','') is null and exists(select 1 from public.leagues le join public.preseason_settings c on c.league_id=le.id where le.id=l and le.is_public and not le.is_demo and c.registration_status='open' and now()<=c.questionnaire_deadline) then r:='coach';end if;
 if r not in ('admin','coach') or r is null then raise exception 'Preseason access denied' using errcode='42501';end if;
 select cutoff_date into old_cutoff from public.leagues where id=l for update;
 select * into cfg from public.preseason_settings where league_id=l;
 if action='save_questionnaire' then
 if now()>cfg.questionnaire_deadline and r<>'admin' then raise exception 'Questionnaire deadline has passed';end if;
 if jsonb_typeof(p->'data')<>'object' or octet_length((p->'data')::text)>16000 then raise exception 'Invalid questionnaire draft';end if;
 tid:=(p->>'team_id')::uuid;
 if tid is null then
 result:=private.command(l,'register_team',jsonb_build_object('name',p->>'name','assessment',jsonb_build_object('experience',coalesce((p#>>'{data,experience}')::int,1),'yearsTogether',coalesce((p#>>'{data,yearsTogether}')::int,0),'practicesPerWeek',coalesce((p#>>'{data,practicesPerWeek}')::int,0),'notes','Preseason draft'),'phone','','sms_consent',false,'explanation','Comprehensive preseason questionnaire is in draft.'));
 tid:=(result->>'id')::uuid;
 end if;
 select * into te from public.teams where id=tid and league_id=l;
 if te.id is null or (r<>'admin' and te.coach_id<>actor) then raise exception 'Team access denied' using errcode='42501';end if;
 if exists(select 1 from public.games where league_id=l and status='confirmed' and tid in(home_team_id,away_team_id)) then raise exception 'Questionnaire is locked after official games begin';end if;
 if coalesce((p->>'submit')::boolean,false) then
 rec:=private.preseason_recommend(p->'data');
 if not exists(select 1 from public.divisions where league_id=l and age_category=p#>>'{data,ageCategory}' and tier=(rec->>'tier')::int) then raise exception 'No configured division matches this age category and recommendation';end if;
 end if;
 insert into public.coach_questionnaires(league_id,team_id,data,status,recommendation,submitted_at) values(l,tid,p->'data',case when coalesce((p->>'submit')::boolean,false) then 'submitted' else 'draft' end,rec,case when coalesce((p->>'submit')::boolean,false) then now() end)
 on conflict(team_id) do update set data=excluded.data,status=excluded.status,recommendation=excluded.recommendation,meta_analysis=null,submitted_at=excluded.submitted_at,revision=coach_questionnaires.revision+1,updated_at=now();
 if coalesce(p#>>'{data,ageCategory}',te.age_category)<>te.age_category then update public.players set eligibility_status='pending',verification_status=case when guardian_consent then 'pending' else verification_status end where team_id=tid;end if;
 update public.teams set status='pending',placement_revision=null,division_id=null,age_category=coalesce(p#>>'{data,ageCategory}',age_category),recommended_division=coalesce((rec->>'tier')::int,recommended_division),rating=coalesce((rec->>'rating')::int,rating),initial_rating=coalesce((rec->>'rating')::int,initial_rating),assessment_explanation=coalesce(rec->>'explanation','Questionnaire draft; no placement approval yet.') where id=tid;
 result:=jsonb_build_object('team_id',tid,'recommendation',rec);
 elsif action in ('submit_roster','withdraw_player','create_invitation','revoke_invitation') then
 if action='submit_roster' then tid:=(p->>'team_id')::uuid;
 elsif action='revoke_invitation' then select player_id into tid from public.guardian_invitations where id=(p->>'invitation_id')::uuid and league_id=l;select * into pl from public.players where id=tid and league_id=l;tid:=pl.team_id;
 else select * into pl from public.players where id=(p->>'player_id')::uuid and league_id=l;tid:=pl.team_id;end if;
 select * into te from public.teams where id=tid and league_id=l;
 if te.id is null or (r<>'admin' and te.coach_id<>actor) then raise exception 'Roster access denied' using errcode='42501';end if;
 if action in ('submit_roster','withdraw_player') and now()>cfg.roster_deadline and r<>'admin' then raise exception 'Roster deadline has passed';end if;
 if action='submit_roster' then
 if (select count(*) from public.players where team_id=tid and active) not between cfg.min_roster and cfg.max_roster then raise exception 'Roster does not meet the configured size requirements';end if;
 update public.teams set roster_submitted_at=now() where id=tid;
 elsif action='withdraw_player' then
 update public.players set active=false where id=pl.id;update public.teams set roster_submitted_at=null where id=tid;
 update public.guardian_invitations set revoked_at=now() where player_id=pl.id and revoked_at is null;
 elsif action='revoke_invitation' then update public.guardian_invitations set revoked_at=now() where id=(p->>'invitation_id')::uuid and league_id=l;
 else
 if pl.active is distinct from true or pl.verification_status='approved' then raise exception 'Only active players awaiting verification can be invited';end if;
 if now()>=cfg.verification_deadline then raise exception 'Verification deadline has passed';end if;
 if p->>'token_hash' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation';end if;
 update public.guardian_invitations set revoked_at=now() where player_id=pl.id and revoked_at is null;
 insert into public.guardian_invitations(league_id,player_id,token_hash,guardian_email,expires_at,created_by) values(l,pl.id,p->>'token_hash',nullif(p->>'email',''),least(now()+interval '72 hours',cfg.verification_deadline),actor) returning id into inv_id;
 update public.players set verification_status='invited' where id=pl.id and verification_status not in ('pending','resubmission');
 result:=jsonb_build_object('id',inv_id,'expires_at',least(now()+interval '72 hours',cfg.verification_deadline));
 end if;
 else
 if r<>'admin' then raise exception 'Administrator reviewer required' using errcode='42501';end if;
 if action='configure' then
 if length(p->>'season_name') not between 2 and 80 or (p->>'min_roster')::int not between 1 and 20 or (p->>'max_roster')::int not between 1 and 30 or (p->>'document_retention_days')::int not between 1 and 30 then raise exception 'Invalid season settings';end if;
 update public.leagues set season_name=p->>'season_name',cutoff_date=(p->>'cutoff_date')::date where id=l;
 update public.preseason_settings set enabled=(p->>'enabled')::boolean,season_start=(p->>'season_start')::date,registration_status=p->>'registration_status',questionnaire_deadline=(p->>'questionnaire_deadline')::timestamptz,roster_deadline=(p->>'roster_deadline')::timestamptz,verification_deadline=(p->>'verification_deadline')::timestamptz,min_roster=(p->>'min_roster')::int,max_roster=(p->>'max_roster')::int,document_retention_days=(p->>'document_retention_days')::int,allowed_document_types=array(select jsonb_array_elements_text(p->'allowed_document_types')),rules_version=rules_version+1 where league_id=l;
 if old_cutoff<>(p->>'cutoff_date')::date then update public.players set eligibility_status='pending',verification_status=case when guardian_consent then 'pending' else verification_status end where league_id=l and active;end if;
 -- Shortening retention applies to already stored documents too.
 update public.age_documents set retain_until=least(retain_until,created_at+make_interval(days=>(p->>'document_retention_days')::int)) where league_id=l and status<>'deleted';
 elsif action='configure_division' then
 if length(p->>'name') not between 2 and 100 or length(p->>'age_category') not between 2 and 30 or (p->>'tier')::int not between 1 and 3 then raise exception 'Invalid division';end if;
 insert into public.divisions(league_id,name,age_category,tier,min_age,max_age) values(l,p->>'name',p->>'age_category',(p->>'tier')::int,(p->>'min_age')::int,(p->>'max_age')::int)
 on conflict(league_id,age_category,tier) do update set name=excluded.name,min_age=excluded.min_age,max_age=excluded.max_age;
 update public.players set eligibility_status='pending',verification_status=case when guardian_consent then 'pending' else verification_status end where league_id=l and active and team_id in(select id from public.teams where league_id=l and age_category=p->>'age_category');
 elsif action in ('review_document','open_document','delete_document') then
 select * into doc from public.age_documents where id=(p->>'document_id')::uuid and league_id=l for update;
 select * into pl from public.players where id=doc.player_id and league_id=l;
 if doc.id is null or doc.status in ('reserved','deleted','deleting') then raise exception 'Document is unavailable';end if;
 select * into d from public.divisions where id=(select division_id from public.teams where id=pl.team_id);
 age_value:=extract(year from age(old_cutoff,pl.birth_date))::int;
 if action='open_document' then
 if doc.retain_until<=now() then raise exception 'Document retention expired; delete the stored copy';end if;
 insert into public.eligibility_reviews(league_id,player_id,document_id,reviewer_id,decision,reason) values(l,pl.id,doc.id,actor,'viewed','Private document opened by authorized reviewer');
 return jsonb_build_object('path',doc.storage_path);
 elsif action='delete_document' then
 update public.age_documents set status='deleting',delete_lease=gen_random_uuid(),delete_lease_until=now()+interval '5 minutes' where id=doc.id returning * into doc;
 insert into public.eligibility_reviews(league_id,player_id,document_id,reviewer_id,decision,reason) values(l,pl.id,doc.id,actor,'deletion_requested','Administrator requested permanent document deletion');
 return jsonb_build_object('id',doc.id,'path',doc.storage_path,'lease',doc.delete_lease);
 end if;
 if p->>'decision' not in ('approved','rejected','resubmission') or length(coalesce(p->>'reason','')) not between 10 and 1000 then raise exception 'A decision and meaningful review reason are required';end if;
 if doc.id is distinct from (select id from public.age_documents where player_id=pl.id and status not in ('reserved','deleted','deleting') order by created_at desc,id desc limit 1) then raise exception 'Review the latest submitted document';end if;
 if p->>'decision'='approved' then
 if not exists(select 1 from public.eligibility_reviews where document_id=doc.id and reviewer_id=actor and decision='viewed' and created_at>now()-interval '24 hours') then raise exception 'Open the private document before approving it';end if;
 if d.id is null or pl.active is distinct from true or pl.guardian_consent is distinct from true or doc.confirmed_details is distinct from true or doc.consent_at is null or coalesce((p->>'document_checked')::boolean,false) is distinct from true then raise exception 'Compare the document with the child details and confirm guardian consent';end if;
 if age_value not between d.min_age and d.max_age then raise exception 'Player is outside the configured division age range';end if;
 if doc.retain_until<=now() then raise exception 'An expired document must be resubmitted';end if;
 duplicate_found:=exists(select 1 from public.age_documents other where other.league_id=l and other.player_id<>pl.id and other.sha256=doc.sha256 and other.status not in ('reserved','deleted')) or exists(select 1 from public.players other where other.league_id=l and other.id<>pl.id and other.active and lower(trim(other.display_name))=lower(trim(pl.display_name)) and other.birth_date=pl.birth_date);
 if duplicate_found and coalesce((p->>'duplicate_acknowledged')::boolean,false) is distinct from true then raise exception 'Acknowledge and explain the duplicate flag before approval';end if;
 end if;
 update public.age_documents set status=p->>'decision',retain_until=least(retain_until,now()+make_interval(days=>cfg.document_retention_days)) where id=doc.id;
 update public.players set verification_status=case when p->>'decision'='resubmission' then 'resubmission' else p->>'decision' end,eligibility_status=case when p->>'decision'='approved' then 'verified' when age_value not between coalesce(d.min_age,0) and coalesce(d.max_age,13) then 'ineligible' else 'pending' end where id=pl.id;
 insert into public.eligibility_reviews(league_id,player_id,document_id,reviewer_id,decision,reason,age_at_cutoff,cutoff_date,min_age,max_age,document_checked,duplicate_acknowledged) values(l,pl.id,doc.id,actor,p->>'decision',p->>'reason',age_value,old_cutoff,d.min_age,d.max_age,coalesce((p->>'document_checked')::boolean,false),coalesce((p->>'duplicate_acknowledged')::boolean,false));
 else raise exception 'Unknown preseason command';end if;
 end if;
 update public.leagues set data_revision=data_revision+1 where id=l;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,'preseason.'||action,jsonb_build_object('team_id',tid,'player_id',pl.id,'document_id',doc.id));
 return coalesce(result,jsonb_build_object('ok',true));
end $$;
