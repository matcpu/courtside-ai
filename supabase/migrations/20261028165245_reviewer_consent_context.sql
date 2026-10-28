do $$declare definition text;begin
 select pg_get_functiondef('private.preseason_snapshot(uuid)'::regprocedure) into definition;
 if position($old$'sha256',d.sha256,$old$ in definition)=0 then raise exception 'Expected document snapshot projection not found';end if;
 definition:=replace(definition,$old$'sha256',d.sha256,$old$,$patch$'sha256',d.sha256,'guardian_name',d.guardian_name,'relationship',d.relationship,'consent_at',d.consent_at,'consent_version',d.consent_version,'confirmed_details',d.confirmed_details,$patch$);
 execute definition;
end $$;
