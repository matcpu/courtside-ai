-- Local review only. No hosted application is authorized by this file.
-- Existing policies/records retain their values. New leagues must choose accepted proofs.
alter table public.preseason_settings add column proof_required boolean not null default true;
alter table public.preseason_settings alter column allowed_document_types set default array[]::text[];
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.preseason_settings'::regclass and contype='c' and pg_get_constraintdef(oid) like '%cardinality(allowed_document_types)%' loop
  execute format('alter table public.preseason_settings drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.preseason_settings add constraint accepted_proof_types check(allowed_document_types<@array['birth_certificate','passport','government_id']::text[]);
-- Empty selections are permitted for unfinished new leagues, never a configured required policy.
alter table public.players add column declaration_consent_at timestamptz;
alter table public.players drop constraint players_verification_status_check;
alter table public.players add constraint players_verification_status_check check(verification_status in ('not_invited','invited','pending','approved','declaration_approved','rejected','resubmission','withdrawn'));

alter function private.preseason_command(uuid,text,jsonb) rename to preseason_document_command;
revoke all on function private.preseason_document_command(uuid,text,jsonb) from public,anon,authenticated;
create function private.preseason_command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.preseason_settings;req boolean;res jsonb;pl public.players;dv public.divisions;cutoff date;age_value int;dup boolean;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select cutoff_date into cutoff from public.leagues where id=l for update;
 select * into cfg from public.preseason_settings where league_id=l;
 if action='configure' then
  if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator reviewer required' using errcode='42501';end if;
  if p ? 'expected_rules_version' and (p->>'expected_rules_version')::int is distinct from cfg.rules_version then raise exception 'Season rules changed. Reload and review the current settings before saving.' using errcode='40001';end if;
  req:=coalesce((p->>'proof_required')::boolean,cfg.proof_required);
  if jsonb_typeof(p->'allowed_document_types') is distinct from 'array' or jsonb_array_length(p->'allowed_document_types')>3 or not (p->'allowed_document_types'<@'["birth_certificate","passport","government_id"]'::jsonb) then raise exception 'Invalid accepted proof-of-age types';end if;
  if req and jsonb_array_length(p->'allowed_document_types')=0 then raise exception 'Select at least one accepted document when proof of age is required';end if;
  res:=private.preseason_document_command(l,action,p);
  update public.preseason_settings set proof_required=req where league_id=l;
  if req is distinct from cfg.proof_required then
   -- A policy change never manufactures document approval or carries a stale declaration forward.
   update public.players set verification_status='not_invited',eligibility_status='pending',declaration_consent_at=null where league_id=l and active and verification_status<>'approved';
   insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'preseason.proof_policy_changed',jsonb_build_object('proof_required',req));
  end if;
  return res;
 elsif action='review_declaration' then
  if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator reviewer required' using errcode='42501';end if;
  if cfg.proof_required then raise exception 'Proof is required. Review an original document instead.';end if;
  select * into pl from public.players where id=(p->>'player_id')::uuid and league_id=l for update;
  select * into dv from public.divisions where id=(select division_id from public.teams where id=pl.team_id and league_id=l);
  if pl.id is null or not pl.active or pl.verification_status<>'pending' or not pl.guardian_consent or pl.declaration_consent_at is null then raise exception 'A pending guardian confirmation and consent are required';end if;
  if p->>'decision' is null or p->>'decision' not in ('approved','rejected','resubmission') or length(coalesce(p->>'reason','')) not between 10 and 1000 or coalesce((p->>'details_checked')::boolean,false) is distinct from true then raise exception 'Review the declaration and provide a reasoned human decision';end if;
  age_value:=extract(year from age(cutoff,pl.birth_date))::int;
  dup:=exists(select 1 from public.players other where other.league_id=l and other.id<>pl.id and other.active and lower(trim(other.display_name))=lower(trim(pl.display_name)) and other.birth_date=pl.birth_date);
  if p->>'decision'='approved' then
   if dv.id is null or age_value not between dv.min_age and dv.max_age or dv.age_category<>(select age_category from public.teams where id=pl.team_id) then raise exception 'Player is outside the configured division age range';end if;
   if dup and coalesce((p->>'duplicate_acknowledged')::boolean,false) is distinct from true then raise exception 'Investigate and acknowledge the duplicate flag before approval';end if;
  end if;
  update public.players set verification_status=case when p->>'decision'='approved' then 'declaration_approved' else p->>'decision' end,eligibility_status=case when p->>'decision'='approved' then 'verified' else 'pending' end where id=pl.id;
  insert into public.eligibility_reviews(league_id,player_id,reviewer_id,decision,reason,age_at_cutoff,cutoff_date,min_age,max_age,document_checked,duplicate_acknowledged) values(l,pl.id,auth.uid(),p->>'decision','Declaration only; no document verified. '||(p->>'reason'),age_value,cutoff,dv.min_age,dv.max_age,false,coalesce((p->>'duplicate_acknowledged')::boolean,false));
  update public.leagues set data_revision=data_revision+1 where id=l;
  insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'preseason.declaration_reviewed',jsonb_build_object('player_id',pl.id,'decision',p->>'decision','document_verified',false));
  return jsonb_build_object('ok',true);
 end if;
 if action='review_document' and p->>'decision'='approved' and exists(select 1 from public.age_documents where id=(p->>'document_id')::uuid and league_id=l and not(document_type=any(cfg.allowed_document_types))) then raise exception 'This proof type is no longer accepted. Request resubmission using the current policy.';end if;
 if action='create_invitation' and exists(select 1 from public.players where id=(p->>'player_id')::uuid and league_id=l and verification_status='declaration_approved') then raise exception 'Only active players awaiting verification can be invited';end if;
 return private.preseason_document_command(l,action,p);
end $$;
revoke all on function private.preseason_command(uuid,text,jsonb) from public,anon;
grant execute on function private.preseason_command(uuid,text,jsonb) to authenticated;

alter function private.guardian_gateway(text,text,jsonb) rename to guardian_document_gateway;
revoke all on function private.guardian_document_gateway(text,text,jsonb) from public,anon,authenticated;
create function private.guardian_gateway(h text,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.guardian_invitations;pl public.players;cfg public.preseason_settings;res jsonb;begin
 -- League before invitation, matching configure/review/invite and finalization.
 select league_id into inv.league_id from public.guardian_invitations where token_hash=h;
 perform 1 from public.leagues where id=inv.league_id for update;
 select * into inv from public.guardian_invitations where token_hash=h for update;
 if inv.id is null or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable or expired' using errcode='42501';end if;
 select * into pl from public.players where id=inv.player_id;
 select * into cfg from public.preseason_settings where league_id=inv.league_id;
 if not pl.active then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if action='submit_declaration' then
  if p->>'invitation_id' is distinct from inv.id::text then raise exception 'Invitation changed' using errcode='42501';end if;
  if cfg.proof_required or now()>=cfg.verification_deadline or pl.verification_status in ('approved','declaration_approved','pending') then raise exception 'Guardian confirmation is not accepting submissions';end if;
  if coalesce((p->>'consent')::boolean,false) is distinct from true or coalesce((p->>'confirmed_details')::boolean,false) is distinct from true then raise exception 'Details confirmation and guardian consent are required';end if;
  update public.players set guardian_consent=true,declaration_consent_at=now(),verification_status='pending',eligibility_status='pending' where id=pl.id;
  update public.leagues set data_revision=data_revision+1 where id=inv.league_id;
  insert into public.audit_events(league_id,action,detail) values(inv.league_id,'guardian.declaration_submitted',jsonb_build_object('invitation_id',inv.id,'player_id',pl.id,'consent_version','declaration-v1','confirmed_details',true));
  return jsonb_build_object('ok',true);
 end if;
 if action='reserve_upload' and not cfg.proof_required then raise exception 'This league does not collect proof-of-age documents';end if;
 res:=private.guardian_document_gateway(h,action,p);
 if action='status' then return res||jsonb_build_object('proof_required',cfg.proof_required,'can_submit',now()<cfg.verification_deadline and (not cfg.proof_required or cardinality(cfg.allowed_document_types)>0) and pl.verification_status not in ('approved','declaration_approved','pending'));end if;
 return res;
end $$;
revoke all on function private.guardian_gateway(text,text,jsonb) from public;
grant execute on function private.guardian_gateway(text,text,jsonb) to anon,authenticated;

-- Final upload rechecks policy under the same league lock, including uploads reserved before a policy change.
alter function private.finalize_age_upload(text,uuid,jsonb) rename to finalize_document_upload;
revoke all on function private.finalize_document_upload(text,uuid,jsonb) from public,anon,authenticated,service_role;
create function private.finalize_age_upload(h text,did uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l uuid;begin
 select league_id into l from public.guardian_invitations where token_hash=h;
 perform 1 from public.leagues where id=l for update;
 if not coalesce((select proof_required from public.preseason_settings where league_id=l),true) then raise exception 'Document collection is disabled; refresh the guardian page';end if;
 if exists(select 1 from public.age_documents d join public.preseason_settings c on c.league_id=d.league_id where d.id=did and not(d.document_type=any(c.allowed_document_types))) then raise exception 'This proof-of-age type is no longer accepted; refresh the guardian page';end if;
 return private.finalize_document_upload(h,did,p);
end $$;
revoke all on function private.finalize_age_upload(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.finalize_age_upload(text,uuid,jsonb) to service_role;

create or replace function private.team_readiness(l uuid,tid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare te public.teams;cfg public.preseason_settings;q public.coach_questionnaires;total int;verified int;eligible int;blockers jsonb:='[]';placement boolean;begin
 select * into te from public.teams where id=tid and league_id=l;
 select * into cfg from public.preseason_settings where league_id=l;
 select * into q from public.coach_questionnaires where team_id=tid;
 select count(*),count(*) filter(where pl.verification_status='approved' and pl.eligibility_status='verified' and pl.guardian_consent and extract(year from age(le.cutoff_date,pl.birth_date)) between d.min_age and d.max_age and d.age_category=te.age_category),count(*) filter(where (pl.verification_status='approved' or (not cfg.proof_required and pl.verification_status='declaration_approved' and pl.declaration_consent_at is not null)) and pl.eligibility_status='verified' and pl.guardian_consent and extract(year from age(le.cutoff_date,pl.birth_date)) between d.min_age and d.max_age and d.age_category=te.age_category) into total,verified,eligible from public.players pl join public.leagues le on le.id=pl.league_id left join public.divisions d on d.id=te.division_id where pl.team_id=tid and pl.active;
 placement:=te.status='approved' and te.placement_revision=q.revision and q.status='submitted';
 if q.status is distinct from 'submitted' then blockers:=blockers||'"Questionnaire not submitted"'::jsonb;end if;
 if placement is distinct from true then blockers:=blockers||'"Placement needs approval for the current questionnaire"'::jsonb;end if;
 if te.roster_submitted_at is null then blockers:=blockers||'"Roster not submitted"'::jsonb;end if;
 if total<cfg.min_roster or total>cfg.max_roster then blockers:=blockers||to_jsonb(format('Roster must contain %s–%s active players',cfg.min_roster,cfg.max_roster));end if;
 if cfg.proof_required and cardinality(cfg.allowed_document_types)=0 then blockers:=blockers||'"Choose the accepted proof-of-age documents in season rules"'::jsonb;end if;
 if eligible<>total then blockers:=blockers||to_jsonb(case when cfg.proof_required then 'Every active player requires guardian consent, administrator document approval and current age eligibility' else 'Every active player requires guardian confirmation, a human eligibility decision and current age eligibility; documents are not verified' end);end if;
 return jsonb_build_object('team_id',tid,'questionnaire_completed',q.status='submitted','placement_approved',coalesce(placement,false),'roster_submitted',te.roster_submitted_at is not null,'players',total,'verified',verified,'eligible_players',eligible,'eligible_for_scheduling',case when cfg.enabled then jsonb_array_length(blockers)=0 else te.status='approved' end,'blockers',case when cfg.enabled then blockers else '["Legacy mode: document readiness is not enforced"]'::jsonb end);
end $$;

do $$declare definition text;old_definition text;begin
 select pg_get_functiondef('private.validate_organizer_setup(jsonb,boolean)'::regprocedure) into definition;
 old_definition:=definition;
 definition:=replace(definition,$old$jsonb_array_length(p->'allowedDocumentTypes') not between 1 and 3$old$,$new$jsonb_array_length(p->'allowedDocumentTypes') not between 0 and 3$new$);
 definition:=replace(definition,$old$ foreach k in array array['start'$old$, $patch$
 if p ? 'proofRequired' and jsonb_typeof(p->'proofRequired') is distinct from 'boolean' then raise exception 'Invalid proof policy';end if;
 if complete and coalesce((p->>'proofRequired')::boolean,true) and jsonb_array_length(p->'allowedDocumentTypes')=0 then raise exception 'Select at least one accepted proof-of-age document';end if;
 foreach k in array array['start'$patch$);
 if definition=old_definition then raise exception 'Expected setup validation contract missing';end if;execute definition;
 select pg_get_functiondef('private.organizer_command(text,jsonb)'::regprocedure) into definition;
 old_definition:=definition;
 definition:=replace(definition,$old$'enabled',true,'season_name'$old$,$patch$'enabled',true,'proof_required',coalesce((cfg->>'proofRequired')::boolean,(select proof_required from public.preseason_settings where league_id=l),true),'season_name'$patch$);
 definition:=replace(definition,$old$'minRoster',(select min_roster from public.preseason_settings where league_id=l)$old$,$patch$'proofRequired',(select proof_required from public.preseason_settings where league_id=l),'minRoster',(select min_roster from public.preseason_settings where league_id=l)$patch$);
 if definition=old_definition then raise exception 'Expected setup policy contract missing';end if;execute definition;
end $$;

-- Rebind the exposed invoker bodies to the new policy-aware implementations.
create or replace function public.preseason_command(p_league uuid,p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.preseason_command(p_league,p_action,p_payload)$$;
create or replace function public.guardian_gateway(p_hash text,p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.guardian_gateway(p_hash,p_action,p_payload)$$;
create or replace function public.finalize_age_upload(p_hash text,p_document uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.finalize_age_upload(p_hash,p_document,p_payload)$$;
