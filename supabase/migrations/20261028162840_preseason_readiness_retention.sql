-- Reuse the existing implementations while strengthening the policy boundary.
do $$declare definition text;begin
 select pg_get_functiondef('private.command(uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$ update public.teams set placement_revision=q.revision where id=te.id;$old$,$patch$ update public.teams set placement_revision=q.revision where id=te.id;
 update public.players set eligibility_status='pending',verification_status='pending' where team_id=te.id and active and verification_status='approved';$patch$);
 execute definition;
 select pg_get_functiondef('private.core_command(uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'where pl.team_id=v.team_id and (not pl.guardian_consent', 'where pl.team_id=v.team_id and pl.active and (extract(year from age(le.cutoff_date,pl.birth_date))<d.min_age or not pl.guardian_consent');
 execute definition;
 select pg_get_functiondef('private.document_maintenance(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$and status<>'deleted' order by retain_until limit 30$old$,$patch$and status<>'deleted' and (p->>'league_id' is null or league_id=(p->>'league_id')::uuid) order by retain_until limit 30$patch$);
 definition:=replace(definition,$old$if doc.id is null then raise exception 'Deletion lease is stale';end if;$old$,$patch$if doc.id is null then raise exception 'Deletion lease is stale';end if;
 if exists(select 1 from storage.objects where bucket_id='youth-documents' and name=doc.storage_path) then raise exception 'Private Storage still contains this document';end if;
 update public.guardian_invitations set guardian_email=null where id=doc.invitation_id;$patch$);
 execute definition;
end $$;
create or replace function private.team_readiness(l uuid,tid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare te public.teams;cfg public.preseason_settings;q public.coach_questionnaires;total int;verified int;blockers jsonb:='[]';placement boolean;begin
 select * into te from public.teams where id=tid and league_id=l;
 select * into cfg from public.preseason_settings where league_id=l;
 select * into q from public.coach_questionnaires where team_id=tid;
 select count(*),count(*) filter(where pl.verification_status='approved' and pl.eligibility_status='verified' and pl.guardian_consent and extract(year from age(le.cutoff_date,pl.birth_date)) between d.min_age and d.max_age and d.age_category=te.age_category) into total,verified from public.players pl join public.leagues le on le.id=pl.league_id left join public.divisions d on d.id=te.division_id where pl.team_id=tid and pl.active;
 placement:=te.status='approved' and te.placement_revision=q.revision and q.status='submitted';
 if q.status is distinct from 'submitted' then blockers:=blockers||'"Questionnaire not submitted"'::jsonb;end if;
 if placement is distinct from true then blockers:=blockers||'"Placement needs approval for the current questionnaire"'::jsonb;end if;
 if te.roster_submitted_at is null then blockers:=blockers||'"Roster not submitted"'::jsonb;end if;
 if total<cfg.min_roster or total>cfg.max_roster then blockers:=blockers||to_jsonb(format('Roster must contain %s–%s active players',cfg.min_roster,cfg.max_roster));end if;
 if verified<>total then blockers:=blockers||'"Every active player requires guardian consent, administrator document approval and current age eligibility"'::jsonb;end if;
 return jsonb_build_object('team_id',tid,'questionnaire_completed',q.status='submitted','placement_approved',coalesce(placement,false),'roster_submitted',te.roster_submitted_at is not null,'players',total,'verified',verified,'eligible_for_scheduling',case when cfg.enabled then jsonb_array_length(blockers)=0 else te.status='approved' end,'blockers',case when cfg.enabled then blockers else '["Legacy mode: document readiness is not enforced"]'::jsonb end);
end $$;
