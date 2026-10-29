-- Observation freshness comes from the operator's original timestamp, never
-- from when an old observation happens to be submitted to the budget guard.
do $migration$
declare definition text;validation text;storage text;
begin
 select pg_get_functiondef('private.meta_finance(text,jsonb)'::regprocedure) into definition;
 validation:=$old$if coalesce((p->>'observed_at')::timestamptz,now()) not between now()-interval '60 minutes' and now() then raise exception 'A recent, nonfuture credit observation is required';end if;$old$;
 storage:=$old$observed_at=coalesce((p->>'observed_at')::timestamptz,now()),paused=$old$;
 if position(validation in definition)=0 or position(storage in definition)=0 then
  raise exception 'Expected credit observation implementation not found';
 end if;
 definition:=replace(definition,validation,$patch$if nullif(btrim(p->>'observed_at'),'') is null then raise exception 'An explicit credit observation timestamp is required';end if;
  if (p->>'observed_at')::timestamptz not between now()-interval '60 minutes' and now() then raise exception 'A recent, nonfuture credit observation is required';end if;$patch$);
 definition:=replace(definition,storage,$patch$observed_at=(p->>'observed_at')::timestamptz,paused=$patch$);
 execute definition;
end $migration$;
