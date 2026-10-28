-- Discard unfinished upload reservations promptly, and do not retain an email
-- address that is needed only for the immediate invitation-send attempt.
do $$declare definition text;begin
 select pg_get_functiondef('private.guardian_gateway(text,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$p->>'document_type',now()+make_interval(days=>cfg.document_retention_days)$old$,$patch$p->>'document_type',now()+interval '2 hours'$patch$);
 execute definition;
 select pg_get_functiondef('private.finalize_age_upload(text,uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$if doc.id is null or now()>=cfg.verification_deadline$old$,$patch$if doc.id is null or doc.retain_until<=now() or now()>=cfg.verification_deadline$patch$);
 definition:=replace(definition,$old$consent_version='age-verification-v1',confirmed_details=true,status='submitted'$old$,$patch$consent_version='age-verification-v1',confirmed_details=true,status='submitted',retain_until=now()+make_interval(days=>cfg.document_retention_days)$patch$);
 execute definition;
 select pg_get_functiondef('private.preseason_command(uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$l,pl.id,p->>'token_hash',nullif(p->>'email',''),least$old$,$patch$l,pl.id,p->>'token_hash',null,least$patch$);
 execute definition;
end $$;
update public.guardian_invitations set guardian_email=null;
