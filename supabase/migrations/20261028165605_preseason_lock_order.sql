-- All mutations share league -> invitation -> document lock order. No external
-- Storage call runs while a database transaction holds those row locks.
do $$declare definition text;sig regprocedure;begin
 foreach sig in array array['private.guardian_gateway(text,text,jsonb)'::regprocedure,'private.finalize_age_upload(text,uuid,jsonb)'::regprocedure] loop
 select pg_get_functiondef(sig) into definition;
 definition:=replace(definition,$old$select * into inv from public.guardian_invitations where token_hash=h for update;$old$,$patch$select * into inv from public.guardian_invitations where token_hash=h;
 if inv.id is null then raise exception 'Invitation unavailable' using errcode='42501';end if;
 perform 1 from public.leagues where id=inv.league_id for update;
 select * into inv from public.guardian_invitations where token_hash=h for update;$patch$);
 execute definition;
 end loop;
 select pg_get_functiondef('private.document_maintenance(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$elsif action='finish_delete' then$old$,$patch$elsif action='finish_delete' then
 select * into doc from public.age_documents where id=(p->>'document_id')::uuid;
 if doc.id is null then raise exception 'Document not found';end if;
 perform 1 from public.leagues where id=doc.league_id for update;$patch$);
 execute definition;
 -- Recheck revision in the UPDATE itself, after any concurrent row-lock wait.
 select pg_get_functiondef('private.record_meta_evidence(uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$update public.coach_questionnaires set meta_analysis=p->'response' where team_id=tid;$old$,$patch$update public.coach_questionnaires set meta_analysis=p->'response' where team_id=tid and revision=(p->>'revision')::int and status='submitted';
 if not found then raise exception 'Questionnaire changed while Meta was interpreting it';end if;$patch$);
 execute definition;
end $$;
