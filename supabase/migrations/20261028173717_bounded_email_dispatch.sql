-- Three 15-second provider attempts leave time for durable receipts within a 60-second function.
do $$
declare definition text;
begin
 definition := pg_get_functiondef('private.core_command(uuid,text,jsonb)'::regprocedure);
 if position('limit 20 for update skip locked' in definition)=0 then
  raise exception 'Expected notification claim bound was not found';
 end if;
 execute replace(definition,'limit 20 for update skip locked','limit 3 for update skip locked');
end $$;
