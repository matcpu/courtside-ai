-- Failed validation remains inspectable without manufacturing a saved league action.
do $migration$
declare definition text;needle text:=$needle$elsif action in ('settle','uncertain') then$needle$;
begin
 select pg_get_functiondef('private.meta_finance(text,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Expected financial settlement guard not found';end if;
 definition:=replace(definition,needle,$patch$elsif action='annotate' then
  if p->>'validation' not in ('schema_validated','schema_validation_failed') then raise exception 'Invalid validation annotation';end if;
  update private.meta_spend_ledger set response_summary=jsonb_set(response_summary,'{validation}',to_jsonb(p->>'validation')) where response_id=p->>'response_id' and status='completed';
  if not found then raise exception 'Actual settled response required';end if;
  return '{"annotated":true}'::jsonb;
 $patch$||needle);
 execute definition;
end $migration$;
create or replace function private.meta_evidence_list(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.member_role(l) is distinct from 'admin' then raise exception 'Administrator evidence required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(item order by created_at desc),'[]') from (
  select to_jsonb(e) as item,e.created_at from public.meta_evidence e where e.league_id=l
  union all
  select jsonb_build_object('id',ml.id,'league_id',ml.league_id,'feature',ml.feature,'model',ml.response_summary->>'model','response_id',ml.response_id,'object_id',coalesce(ml.case_id,ml.id),'request_digest',ml.request_digest,
    'response',ml.response_summary||case when c.id is not null then jsonb_build_object('evaluation',jsonb_build_object('synthetic',true,'experimental',c.feature='synthetic_document_screening','label',c.label,'inputDigest',c.input_digest)) else '{}'::jsonb end,
    'tool_calls','[]'::jsonb,'created_at',ml.created_at),ml.created_at
   from private.meta_spend_ledger ml left join private.meta_evaluation_cases c on c.id=ml.case_id
   where ml.league_id=l and ml.response_id is not null and ml.response_summary is not null
    and not exists(select 1 from public.meta_evidence original where original.response_id=ml.response_id)
 ) combined);
end$$;
