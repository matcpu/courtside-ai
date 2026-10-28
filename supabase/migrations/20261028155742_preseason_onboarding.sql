-- Existing leagues retain an explicitly labeled legacy mode. New ordinary
-- seasons require preseason readiness; demo seeding never fabricates documents.
alter table public.divisions add column age_category text not null default 'U14';
alter table public.divisions add column min_age int not null default 0 check(min_age between 0 and 20);
alter table public.divisions add constraint division_age_range check(min_age<=max_age);
alter table public.divisions drop constraint divisions_league_id_tier_key;
alter table public.divisions add unique(league_id,age_category,tier);
alter table public.teams add column age_category text not null default 'U14';
alter table public.teams add column roster_submitted_at timestamptz;
alter table public.teams add column placement_revision int;
alter table public.players add column verification_status text not null default 'not_invited' check(verification_status in ('not_invited','invited','pending','approved','rejected','resubmission','withdrawn'));
alter table public.players add column active boolean not null default true;
create table public.preseason_settings(
 league_id uuid primary key references public.leagues(id),enabled boolean not null default true,
 season_start date not null default '2026-11-07',registration_status text not null default 'draft' check(registration_status in ('draft','open','closed')),
 questionnaire_deadline timestamptz not null default now()+interval '14 days',roster_deadline timestamptz not null default now()+interval '21 days',verification_deadline timestamptz not null default now()+interval '28 days',
 min_roster int not null default 5 check(min_roster between 1 and 20),max_roster int not null default 20 check(max_roster between 1 and 30),
 document_retention_days int not null default 14 check(document_retention_days between 1 and 30),allowed_document_types text[] not null default array['birth_certificate','passport','government_id'],rules_version int not null default 1,
 check(min_roster<=max_roster),check(questionnaire_deadline<=roster_deadline and roster_deadline<=verification_deadline),check(cardinality(allowed_document_types)>0 and allowed_document_types<@array['birth_certificate','passport','government_id'])
);
insert into public.preseason_settings(league_id,enabled,registration_status) select id,false,'open' from public.leagues;
create function private.init_preseason() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.preseason_settings(league_id,enabled,registration_status) values(new.id,not new.is_demo,case when new.is_demo then 'open' else 'draft' end);return new;end $$;
revoke all on function private.init_preseason() from public,anon,authenticated;
create trigger league_preseason after insert on public.leagues for each row execute function private.init_preseason();
create table public.coach_questionnaires(
 league_id uuid not null references public.leagues(id),team_id uuid primary key,data jsonb not null default '{}',status text not null default 'draft' check(status in ('draft','submitted')),
 revision int not null default 1,recommendation jsonb,meta_analysis jsonb,submitted_at timestamptz,updated_at timestamptz not null default now(),foreign key(league_id,team_id) references public.teams(league_id,id),check(octet_length(data::text)<=16000)
);
create index questionnaires_league on public.coach_questionnaires(league_id);
create table public.guardian_invitations(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),player_id uuid not null,token_hash text unique not null check(token_hash~'^[a-f0-9]{64}$'),guardian_email text,
 expires_at timestamptz not null,revoked_at timestamptz,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),access_count int not null default 0,
 foreign key(league_id,player_id) references public.players(league_id,id)
);
create index invitations_player on public.guardian_invitations(player_id);
create index invitations_league on public.guardian_invitations(league_id);
create index invitations_actor on public.guardian_invitations(created_by);
create table public.age_documents(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),player_id uuid not null,invitation_id uuid not null references public.guardian_invitations(id),storage_path text unique not null,
 document_type text not null check(document_type in ('birth_certificate','passport','government_id')),status text not null default 'reserved' check(status in ('reserved','submitted','approved','rejected','resubmission','deleting','deleted')),
 sha256 text check(sha256~'^[a-f0-9]{64}$'),guardian_name text,relationship text,consent_at timestamptz,consent_version text,confirmed_details boolean not null default false,
 created_at timestamptz not null default now(),retain_until timestamptz not null,deleted_at timestamptz,delete_lease uuid,delete_lease_until timestamptz,
 foreign key(league_id,player_id) references public.players(league_id,id)
);
create index documents_player on public.age_documents(player_id);
create index documents_invitation on public.age_documents(invitation_id);
create index documents_league_hash on public.age_documents(league_id,sha256);
create index documents_retention on public.age_documents(retain_until) where status<>'deleted';
create table public.eligibility_reviews(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),player_id uuid not null,document_id uuid references public.age_documents(id),reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected','resubmission','viewed','deletion_requested')),reason text not null,age_at_cutoff int,cutoff_date date,min_age int,max_age int,document_checked boolean not null default false,duplicate_acknowledged boolean not null default false,
 created_at timestamptz not null default now(),foreign key(league_id,player_id) references public.players(league_id,id)
);
create index reviews_player on public.eligibility_reviews(player_id,created_at desc);
create index reviews_league on public.eligibility_reviews(league_id);
create index reviews_document on public.eligibility_reviews(document_id);
create index reviews_actor on public.eligibility_reviews(reviewer_id);
do $$declare tb text;begin
 foreach tb in array array['preseason_settings','coach_questionnaires','guardian_invitations','age_documents','eligibility_reviews'] loop
 execute format('alter table public.%I enable row level security',tb);
 execute format('revoke all on public.%I from public,anon,authenticated',tb);
 end loop;
end $$;
-- Document bytes are accessible only through audited, short-lived reviewer URLs.
drop policy youth_read on storage.objects;
drop policy youth_insert on storage.objects;
update storage.buckets set public=false,file_size_limit=6291456,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='youth-documents';

create function private.preseason_recommend(q jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;g int;decided int;record_adjust int;margin numeric;rating_value int;tier_value int;certainty numeric;flags jsonb:='[]';begin
 foreach k in array array['wins','losses','draws','winningMargin','losingMargin','returningPercent','competitivePlayers','experience','yearsTogether','practicesPerWeek','preferredTier','coachConfidence'] loop
 if q->k is null or jsonb_typeof(q->k)<>'number' then raise exception 'Complete all questionnaire numeric fields';end if;end loop;
 if coalesce(length(q->>'ageCategory'),0) not between 2 and 30 or coalesce(length(q->>'previousLeague'),101)>100 or coalesce(length(q->>'previousDivision'),101)>100 or coalesce(length(q->>'notes'),2001)>2000 then raise exception 'Invalid questionnaire text';end if;
 foreach k in array array['wins','losses','draws','competitivePlayers','experience','yearsTogether','practicesPerWeek','preferredTier'] loop
 if (q->>k)::numeric<>trunc((q->>k)::numeric) then raise exception 'Whole numbers required';end if;end loop;
 if (q->>'wins')::int not between 0 and 100 or (q->>'losses')::int not between 0 and 100 or (q->>'draws')::int not between 0 and 100 or (q->>'winningMargin')::numeric not between 0 and 60 or (q->>'losingMargin')::numeric not between 0 and 60 or (q->>'returningPercent')::numeric not between 0 and 100 or (q->>'competitivePlayers')::int not between 0 and 20 or (q->>'experience')::int not between 1 and 5 or (q->>'yearsTogether')::int not between 0 and 15 or (q->>'practicesPerWeek')::int not between 0 and 7 or (q->>'preferredTier')::int not between 1 and 3 or (q->>'coachConfidence')::numeric not between 0 and 100 then raise exception 'Questionnaire values out of range';end if;
 g:=(q->>'wins')::int+(q->>'losses')::int+(q->>'draws')::int;decided:=(q->>'wins')::int+(q->>'losses')::int;
 record_adjust:=case when g>0 then floor((((q->>'wins')::numeric+(q->>'draws')::numeric*.5)/g-.5)*180+.5)::int else 0 end;
 margin:=case when decided>0 then greatest(-25,least(25,((q->>'wins')::numeric*(q->>'winningMargin')::numeric-(q->>'losses')::numeric*(q->>'losingMargin')::numeric)/decided)) else 0 end;
 rating_value:=greatest(700,least(1600,floor(800+(q->>'experience')::int*75+least((q->>'yearsTogether')::int,4)*25+least((q->>'practicesPerWeek')::int,4)*15+record_adjust+margin*4+least((q->>'competitivePlayers')::int,12)*8+((q->>'returningPercent')::numeric-50)*.4+.5)::int));
 tier_value:=case when rating_value>=1150 then 1 when rating_value>=950 then 2 else 3 end;
 if g<4 then flags:=flags||'"Limited previous-season game evidence."'::jsonb;end if;
 if (q->>'wins')::int=0 and (q->>'winningMargin')::numeric>0 then flags:=flags||'"Winning margin was supplied with no wins."'::jsonb;end if;
 if (q->>'losses')::int=0 and (q->>'losingMargin')::numeric>0 then flags:=flags||'"Losing margin was supplied with no losses."'::jsonb;end if;
 if (q->>'returningPercent')::numeric>=80 and (q->>'yearsTogether')::int=0 then flags:=flags||'"High returning percentage with zero years together needs clarification."'::jsonb;end if;
 if abs((q->>'preferredTier')::int-tier_value)>=2 then flags:=flags||'"Coach preference differs by two tiers from the evidence rubric."'::jsonb;end if;
 if (q->>'coachConfidence')::numeric>=80 and g<4 then flags:=flags||'"High coach confidence is not supported by a substantial game history."'::jsonb;end if;
 if (q->>'experience')::int=1 and (q->>'competitivePlayers')::int>=8 then flags:=flags||'"New-team experience conflicts with many competitive players."'::jsonb;end if;
 certainty:=greatest(.2,least(.9,.4+case when g>=6 then .18 when g>0 then .06 else 0 end+case when length(q->>'previousLeague')>0 and length(q->>'previousDivision')>0 then .12 else 0 end+case when (q->>'returningPercent')::numeric>=60 then .1 else 0 end-jsonb_array_length(flags)*.08));
 return jsonb_build_object('tier',tier_value,'rating',rating_value,'confidence',round(certainty,2),'flags',flags,'source','deterministic','explanation',format('Evidence rubric recommends tier %s at rating %s. Self-reported record, margins, continuity and competitive experience inform the recommendation. Human placement approval is required.',tier_value,rating_value),'evidence',jsonb_build_array(format('%s previous games; %s wins, %s losses, %s draws.',g,q->>'wins',q->>'losses',q->>'draws'),format('%s%% returning; %s competitive players.',q->>'returningPercent',q->>'competitivePlayers'),format('%s years together; %s practices/week.',q->>'yearsTogether',q->>'practicesPerWeek')));
end $$;
revoke all on function private.preseason_recommend(jsonb) from public,anon,authenticated;

create function private.team_readiness(l uuid,tid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare te public.teams;cfg public.preseason_settings;q public.coach_questionnaires;total int;verified int;blockers jsonb:='[]';placement boolean;begin
 select * into te from public.teams where id=tid and league_id=l;
 select * into cfg from public.preseason_settings where league_id=l;
 select * into q from public.coach_questionnaires where team_id=tid;
 select count(*),count(*) filter(where verification_status='approved' and eligibility_status='verified' and guardian_consent) into total,verified from public.players where team_id=tid and active;
 placement:=te.status='approved' and te.placement_revision=q.revision and q.status='submitted';
 if q.status is distinct from 'submitted' then blockers:=blockers||'"Questionnaire not submitted"'::jsonb;end if;
 if placement is distinct from true then blockers:=blockers||'"Placement needs approval for the current questionnaire"'::jsonb;end if;
 if te.roster_submitted_at is null then blockers:=blockers||'"Roster not submitted"'::jsonb;end if;
 if total<cfg.min_roster or total>cfg.max_roster then blockers:=blockers||to_jsonb(format('Roster must contain %s–%s active players',cfg.min_roster,cfg.max_roster));end if;
 if verified<>total then blockers:=blockers||'"Every active player requires guardian consent and administrator document approval"'::jsonb;end if;
 return jsonb_build_object('team_id',tid,'questionnaire_completed',q.status='submitted','placement_approved',coalesce(placement,false),'roster_submitted',te.roster_submitted_at is not null,'players',total,'verified',verified,'eligible_for_scheduling',case when cfg.enabled then jsonb_array_length(blockers)=0 else te.status='approved' end,'blockers',case when cfg.enabled then blockers else '["Legacy mode: document readiness is not enforced"]'::jsonb end);
end $$;
revoke all on function private.team_readiness(uuid,uuid) from public,anon,authenticated;

alter function private.command(uuid,text,jsonb) rename to core_command;
revoke all on function private.core_command(uuid,text,jsonb) from public,anon,authenticated;

create function private.preseason_command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p->>'decision'='approved' then
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
revoke all on function private.preseason_command(uuid,text,jsonb) from public,anon;
grant execute on function private.preseason_command(uuid,text,jsonb) to authenticated;
create function public.preseason_command(p_league uuid,p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.preseason_command(p_league,p_action,p_payload)$$;
revoke all on function public.preseason_command(uuid,text,jsonb) from public,anon;
grant execute on function public.preseason_command(uuid,text,jsonb) to authenticated;

-- An invitation is a narrow, revocable capability for one player only. No raw
-- token, document URL or guardian identity is available through a public table.
create function private.guardian_gateway(h text,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.guardian_invitations;pl public.players;cfg public.preseason_settings;doc public.age_documents;latest_reason text;begin
 if h !~ '^[a-f0-9]{64}$' then raise exception 'Invitation unavailable' using errcode='42501';end if;
 select * into inv from public.guardian_invitations where token_hash=h for update;
 if inv.id is null or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable or expired' using errcode='42501';end if;
 select * into pl from public.players where id=inv.player_id;
 if pl.active is distinct from true then raise exception 'Invitation unavailable' using errcode='42501';end if;
 select * into cfg from public.preseason_settings where league_id=inv.league_id;
 if action<>'status' and p->>'invitation_id' is distinct from inv.id::text then raise exception 'Invitation changed. Refresh this page.' using errcode='42501';end if;
 if action='status' then
 if inv.access_count=0 then insert into public.audit_events(league_id,action,detail) values(inv.league_id,'guardian.invitation_opened',jsonb_build_object('invitation_id',inv.id,'player_id',pl.id));end if;
 update public.guardian_invitations set access_count=access_count+1 where id=inv.id;
 select reason into latest_reason from public.eligibility_reviews where player_id=pl.id and decision in ('approved','rejected','resubmission') order by created_at desc limit 1;
 return jsonb_build_object('invitation_id',inv.id,'child',jsonb_build_object('name',pl.display_name,'birth_date',pl.birth_date),'league',(select name from public.leagues where id=inv.league_id),'team',(select name from public.teams where id=pl.team_id),'status',pl.verification_status,'guardian_consent',pl.guardian_consent,'expires_at',inv.expires_at,'deadline',cfg.verification_deadline,'retention_days',cfg.document_retention_days,'allowed_document_types',cfg.allowed_document_types,'review_reason',latest_reason,'can_submit',now()<cfg.verification_deadline and pl.verification_status not in ('approved','pending'));
 elsif action='reserve_upload' then
 if now()>=cfg.verification_deadline or pl.verification_status in ('approved','pending') then raise exception 'Verification is not accepting a new document';end if;
 if p->>'document_type'<>all(cfg.allowed_document_types) or p->>'document_type' is null then raise exception 'This proof-of-age type is not accepted';end if;
 if (select count(*) from public.age_documents where invitation_id=inv.id and created_at>now()-interval '24 hours')>=5 then raise exception 'Upload limit reached; contact the league';end if;
 if p->>'extension' not in ('png','jpg','webp') then raise exception 'Use an accepted image format';end if;
 insert into public.age_documents(league_id,player_id,invitation_id,storage_path,document_type,retain_until) values(inv.league_id,pl.id,inv.id,inv.league_id::text||'/'||pl.id::text||'/'||gen_random_uuid()::text||'.'||(p->>'extension'),p->>'document_type',now()+make_interval(days=>cfg.document_retention_days)) returning * into doc;
 insert into public.audit_events(league_id,action,detail) values(inv.league_id,'guardian.upload_reserved',jsonb_build_object('player_id',pl.id,'document_id',doc.id));
 return jsonb_build_object('id',doc.id,'path',doc.storage_path);
 elsif action='withdraw_consent' then
 update public.players set guardian_consent=false,verification_status='withdrawn',eligibility_status='pending' where id=pl.id;
 update public.leagues set data_revision=data_revision+1 where id=inv.league_id;
 insert into public.audit_events(league_id,action,detail) values(inv.league_id,'guardian.consent_withdrawn',jsonb_build_object('player_id',pl.id));return jsonb_build_object('ok',true);
 else raise exception 'Unknown guardian action';end if;
end $$;
revoke all on function private.guardian_gateway(text,text,jsonb) from public;
grant execute on function private.guardian_gateway(text,text,jsonb) to anon,authenticated;
create function public.guardian_gateway(p_hash text,p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.guardian_gateway(p_hash,p_action,p_payload)$$;
revoke all on function public.guardian_gateway(text,text,jsonb) from public;
grant execute on function public.guardian_gateway(text,text,jsonb) to anon,authenticated;

-- Only the server's narrow Storage bridge may finalize a file after checking
-- actual uploaded bytes, MIME/magic, size, hash and the invitation again.
create function private.finalize_age_upload(h text,did uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.guardian_invitations;doc public.age_documents;cfg public.preseason_settings;begin
 select * into inv from public.guardian_invitations where token_hash=h for update;
 if inv.id is null or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501';end if;
 select * into cfg from public.preseason_settings where league_id=inv.league_id;
 select * into doc from public.age_documents where id=did and invitation_id=inv.id and status='reserved' for update;
 if doc.id is null or now()>=cfg.verification_deadline or exists(select 1 from public.players where id=inv.player_id and (not active or verification_status in ('approved','pending'))) then raise exception 'Upload cannot be submitted';end if;
 if p->>'sha256' !~ '^[a-f0-9]{64}$' or coalesce((p->>'consent')::boolean,false) is distinct from true or coalesce((p->>'confirmed_details')::boolean,false) is distinct from true or length(coalesce(p->>'guardian_name','')) not between 2 and 100 or length(coalesce(p->>'relationship','')) not between 2 and 80 then raise exception 'Guardian identity, details confirmation and consent are required';end if;
 if not exists(select 1 from storage.objects where bucket_id='youth-documents' and name=doc.storage_path) then raise exception 'Private document upload is missing';end if;
 update public.age_documents set sha256=p->>'sha256',guardian_name=p->>'guardian_name',relationship=p->>'relationship',consent_at=now(),consent_version='age-verification-v1',confirmed_details=true,status='submitted' where id=did;
 update public.players set guardian_consent=true,verification_status='pending',eligibility_status='pending' where id=inv.player_id;
 update public.leagues set data_revision=data_revision+1 where id=inv.league_id;
 insert into public.audit_events(league_id,action,detail) values(inv.league_id,'guardian.document_submitted',jsonb_build_object('player_id',inv.player_id,'document_id',did,'consent_version','age-verification-v1'));
 return jsonb_build_object('ok',true,'status','pending');
end $$;
revoke all on function private.finalize_age_upload(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.finalize_age_upload(text,uuid,jsonb) to service_role;
create function public.finalize_age_upload(p_hash text,p_document uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.finalize_age_upload(p_hash,p_document,p_payload)$$;
revoke all on function public.finalize_age_upload(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_age_upload(text,uuid,jsonb) to service_role;

create function private.document_maintenance(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare doc public.age_documents;lease uuid:=gen_random_uuid();result jsonb;begin
 if action='claim_due' then
 with claimed as(update public.age_documents set status='deleting',delete_lease=lease,delete_lease_until=now()+interval '5 minutes' where id in(select id from public.age_documents where (retain_until<=now() or status='deleting' and delete_lease_until<=now()) and status<>'deleted' order by retain_until limit 30 for update skip locked) returning id,storage_path,delete_lease)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'lease',delete_lease)),'[]') into result from claimed;return result;
 elsif action='finish_delete' then
 update public.age_documents set status='deleted',deleted_at=now(),guardian_name=null,relationship=null,delete_lease=null,delete_lease_until=null where id=(p->>'document_id')::uuid and status='deleting' and delete_lease=(p->>'lease')::uuid returning * into doc;
 if doc.id is null then raise exception 'Deletion lease is stale';end if;
 if not exists(select 1 from public.eligibility_reviews where player_id=doc.player_id and decision='approved') then update public.players set verification_status='resubmission',eligibility_status='pending' where id=doc.player_id;end if;
 insert into public.audit_events(league_id,action,detail) values(doc.league_id,'guardian.document_deleted',jsonb_build_object('player_id',doc.player_id,'document_id',doc.id));return jsonb_build_object('ok',true);
 elsif action='document_path' then
 select * into doc from public.age_documents where id=(p->>'document_id')::uuid and invitation_id in(select id from public.guardian_invitations where token_hash=p->>'hash' and revoked_at is null and expires_at>now()) and status='reserved';
 if doc.id is null then raise exception 'Upload access denied' using errcode='42501';end if;
 return jsonb_build_object('path',doc.storage_path);
 else raise exception 'Unknown maintenance action';end if;
end $$;
revoke all on function private.document_maintenance(text,jsonb) from public,anon,authenticated;
grant execute on function private.document_maintenance(text,jsonb) to service_role;
create function public.document_maintenance(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.document_maintenance(p_action,p_payload)$$;
revoke all on function public.document_maintenance(text,jsonb) from public,anon,authenticated;
grant execute on function public.document_maintenance(text,jsonb) to service_role;
create function private.command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.preseason_settings;te public.teams;q public.coach_questionnaires;result jsonb;fixture jsonb;gid uuid;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if action='create_league' then return private.core_command(l,action,p);end if;
 perform 1 from public.leagues where id=l for update;
 select * into cfg from public.preseason_settings where league_id=l;
 if cfg.enabled then
 if action='register_team' and private.member_role(l) is distinct from 'admin' and (cfg.registration_status<>'open' or now()>cfg.questionnaire_deadline) then raise exception 'Season registration is closed';end if;
 if action='verify_player' then raise exception 'Document review is required. Use the preseason verification queue.';end if;
 if action='add_player' then
 if private.member_role(l)<>'admin' and now()>cfg.roster_deadline then raise exception 'Roster deadline has passed';end if;
 if (select count(*) from public.players where team_id=(p->>'team_id')::uuid and active)>=cfg.max_roster then raise exception 'Maximum roster size reached';end if;
 p:=p||jsonb_build_object('guardian_consent',false);
 end if;
 if action='approve_team' then
 select * into te from public.teams where id=(p->>'team_id')::uuid and league_id=l;
 select * into q from public.coach_questionnaires where team_id=te.id;
 if q.status is distinct from 'submitted' then raise exception 'A submitted comprehensive questionnaire is required';end if;
 if coalesce((p->>'tier')::int,te.recommended_division)<>te.recommended_division and length(coalesce(p->>'override_reason',''))<10 then raise exception 'Explain a placement override in at least 10 characters';end if;
 end if;
 if action in ('draft_schedule','publish_schedule') then
 for fixture in select value from jsonb_array_elements(case when action='draft_schedule' then p->'fixtures' else (select jsonb_agg(to_jsonb(f)) from public.fixtures f where version_id=(p->>'version_id')::uuid and league_id=l) end) loop
 gid:=(fixture->>'game_id')::uuid;
 if exists(select 1 from public.games where id=gid and status='confirmed' and league_id=l) then continue;end if;
 if action='publish_schedule' then select to_jsonb(g) into fixture from public.games g where id=gid and league_id=l;end if;
 if not coalesce((private.team_readiness(l,(fixture->>'home_team_id')::uuid)->>'eligible_for_scheduling')::boolean,false) or not coalesce((private.team_readiness(l,(fixture->>'away_team_id')::uuid)->>'eligible_for_scheduling')::boolean,false) then raise exception 'Preseason eligibility blocks scheduling. Complete questionnaire, placement, roster and document reviews first.';end if;
 end loop;
 end if;
 end if;
 result:=private.core_command(l,action,p);
 if cfg.enabled and action='approve_team' then
 update public.teams set placement_revision=q.revision where id=te.id;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'preseason.placement_approved',jsonb_build_object('team_id',te.id,'questionnaire_revision',q.revision,'tier',coalesce((p->>'tier')::int,te.recommended_division),'override_reason',p->>'override_reason'));
 end if;
 if cfg.enabled and action='add_player' then update public.teams set roster_submitted_at=null where id=(p->>'team_id')::uuid and league_id=l;end if;
 return result;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public,anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

alter function private.snapshot(uuid,boolean) rename to core_snapshot;
revoke all on function private.core_snapshot(uuid,boolean) from public,anon,authenticated;
create function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 result:=private.core_snapshot(l,public_only);
 result:=jsonb_set(result,'{league}',(result->'league')||jsonb_build_object('preseason_enabled',(select enabled from public.preseason_settings where league_id=l)));
 if public_only then return result;end if;
 return result||jsonb_build_object('readiness',(select coalesce(jsonb_agg(private.team_readiness(l,id)),'[]') from public.teams where league_id=l));
end $$;
revoke all on function private.snapshot(uuid,boolean) from public;
grant execute on function private.snapshot(uuid,boolean) to authenticated,anon;

create function private.preseason_snapshot(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text:=private.member_role(l);begin
 if r not in ('admin','coach') or r is null then raise exception 'Preseason access denied' using errcode='42501';end if;
 return jsonb_build_object('role',r,
 'settings',(select to_jsonb(c)||jsonb_build_object('season_name',le.season_name,'cutoff_date',le.cutoff_date) from public.preseason_settings c join public.leagues le on le.id=c.league_id where c.league_id=l),
 'divisions',(select coalesce(jsonb_agg(to_jsonb(d) order by age_category,tier),'[]') from public.divisions d where league_id=l),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'status',t.status,'division_id',t.division_id,'age_category',t.age_category,'coach_id',t.coach_id) order by t.name),'[]') from public.teams t where league_id=l and (r='admin' or coach_id=auth.uid())),
 'questionnaires',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from public.coach_questionnaires q join public.teams t on t.id=q.team_id where q.league_id=l and (r='admin' or t.coach_id=auth.uid())),
 'players',(select coalesce(jsonb_agg(to_jsonb(pl)||jsonb_build_object('age',extract(year from age(le.cutoff_date,pl.birth_date))::int,'age_eligible',extract(year from age(le.cutoff_date,pl.birth_date)) between coalesce(d.min_age,0) and coalesce(d.max_age,13),'duplicate_identity',exists(select 1 from public.players other where other.league_id=l and other.id<>pl.id and other.active and lower(trim(other.display_name))=lower(trim(pl.display_name)) and other.birth_date=pl.birth_date)) order by pl.display_name),'[]') from public.players pl join public.teams t on t.id=pl.team_id join public.leagues le on le.id=pl.league_id left join public.divisions d on d.id=t.division_id where pl.league_id=l and (r='admin' or t.coach_id=auth.uid())),
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'player_id',d.player_id,'document_type',d.document_type,'status',d.status,'created_at',d.created_at,'retain_until',d.retain_until,'sha256',d.sha256,'duplicate_document',exists(select 1 from public.age_documents other where other.league_id=l and other.player_id<>d.player_id and other.sha256=d.sha256 and other.status not in ('reserved','deleted'))) order by d.created_at desc),'[]') from public.age_documents d where league_id=l and r='admin'),
 'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'player_id',i.player_id,'expires_at',i.expires_at,'revoked_at',i.revoked_at)),'[]') from public.guardian_invitations i join public.players pl on pl.id=i.player_id join public.teams t on t.id=pl.team_id where i.league_id=l and (r='admin' or t.coach_id=auth.uid())),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(rv) order by created_at desc),'[]') from public.eligibility_reviews rv where league_id=l and r='admin'),
 'readiness',(select coalesce(jsonb_agg(private.team_readiness(l,id)),'[]') from public.teams where league_id=l and (r='admin' or coach_id=auth.uid())));
end $$;
revoke all on function private.preseason_snapshot(uuid) from public,anon;
grant execute on function private.preseason_snapshot(uuid) to authenticated;
create function public.preseason_snapshot(p_league uuid) returns jsonb language sql security invoker set search_path='' as $$select private.preseason_snapshot(p_league)$$;
revoke all on function public.preseason_snapshot(uuid) from public,anon;
grant execute on function public.preseason_snapshot(uuid) to authenticated;

create or replace function private.core_command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select divisions.id into div_id from public.divisions where league_id=l and age_category=t.age_category and tier=coalesce((p->>'tier')::int,t.recommended_division);
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
 select divisions.id into div_id from public.divisions where league_id=l and age_category=t.age_category and tier=target;
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


revoke all on function private.core_command(uuid,text,jsonb) from public,anon,authenticated;
