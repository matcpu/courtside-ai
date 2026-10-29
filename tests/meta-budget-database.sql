-- Financial/security contract tests only. No provider endpoint or API key is used.
-- Every fixture, budget observation and simulated reservation is rolled back.
begin;
create temp table assertions(name text primary key,passed boolean not null);
grant select,insert on assertions to authenticated,anon,service_role;
create function pg_temp.ok(n text,b boolean) returns void language plpgsql as $$begin if b is distinct from true then raise exception 'FAILED: %',n;end if;insert into assertions values(n,true);end$$;
create function pg_temp.denied(s text,w text) returns boolean language plpgsql as $$begin execute s;return false;exception when others then return position(lower(w) in lower(sqlerrm))>0;end$$;
create function pg_temp.financial_denied(a text,p jsonb,w text) returns boolean language sql as $$select pg_temp.denied(format('select public.meta_finance(%L,%L::jsonb)',a,p),w)$$;
create function pg_temp.request(l uuid,a uuid,k text,d text,f text default 'placement',c uuid default null) returns jsonb language sql as $$select jsonb_build_object('league',l,'actor',a,'request_key',k,'request_digest',d,'feature',f,'model','muse-spark-1.3','max_output_tokens',4000,'case_id',c)$$;
create temp table original_finance as select row_to_json(b)::jsonb budget,(select count(*) from private.meta_spend_ledger) ledger_count from private.meta_credit_budget b;

insert into auth.users(id,aud,role,email) values
 ('dd000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic-budget-admin@example.invalid'),
 ('dd000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic-budget-coach@example.invalid'),
 ('dd000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic-budget-outsider@example.invalid');
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare l uuid;l2 uuid;pub uuid;begin
 l:=(public.league_command(null,'create_league','{"name":"Synthetic Budget Rollback A","season":"Budget test","cutoff":"2026-09-01"}')->>'id')::uuid;
 l2:=(public.league_command(null,'create_league','{"name":"Synthetic Budget Rollback B","season":"Budget test","cutoff":"2026-09-01"}')->>'id')::uuid;
 pub:=(public.league_command(null,'create_league','{"name":"Synthetic Budget Public Rollback","season":"Budget test","cutoff":"2026-09-01"}')->>'id')::uuid;
 perform public.league_command(pub,'configure_public','{"enabled":true}');
 perform public.league_command(l,'invite_member','{"email":"synthetic-budget-coach@example.invalid","role":"coach"}');
 perform set_config('test.meta_league',l::text,true);perform set_config('test.meta_league_two',l2::text,true);perform set_config('test.meta_public',pub::text,true);
 perform pg_temp.ok('authenticated browser cannot observe credits',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"Synthetic rollback observation"}'::jsonb||jsonb_build_object('observed_at',now()),'permission denied'));
 perform pg_temp.ok('authenticated browser cannot authorize finance scope',pg_temp.financial_denied('authorize_scope',jsonb_build_object('league',l,'actor','dd000000-0000-4000-8000-000000000001','feature','operations'),'permission denied'));
 perform pg_temp.ok('authenticated browser cannot register model cases',pg_temp.financial_denied('register_case',jsonb_build_object('league',l,'actor','dd000000-0000-4000-8000-000000000001'),'permission denied'));
 perform pg_temp.ok('authenticated browser cannot reserve model funds',pg_temp.financial_denied('reserve',pg_temp.request(l,'dd000000-0000-4000-8000-000000000001','synthetic-browser-denied',repeat('a',64)),'permission denied'));
 perform pg_temp.ok('authenticated browser cannot settle response receipts',pg_temp.financial_denied('settle','{}','permission denied'));
 perform pg_temp.ok('authenticated browser cannot read finance summary',pg_temp.financial_denied('summary','{}','permission denied'));
 perform pg_temp.ok('authenticated browser cannot annotate validation',pg_temp.financial_denied('annotate','{}','permission denied'));
 perform pg_temp.ok('authenticated browser cannot read raw spend ledger',pg_temp.denied('select * from private.meta_spend_ledger','permission denied'));
end$$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
select pg_temp.ok('anonymous caller cannot read financial summary',pg_temp.financial_denied('summary','{}','permission denied'));
select pg_temp.ok('anonymous caller cannot inspect private evidence',pg_temp.denied(format('select public.meta_evidence_list(%L)',current_setting('test.meta_league')),'permission denied'));
reset role;

-- A single shared account lock is held throughout these rollback-only tests.
select pg_temp.ok('shared finance account serializes through a row lock',position('for update' in lower(pg_get_functiondef('private.meta_finance(text,jsonb)'::regprocedure)))>0);
select pg_temp.ok('configured safety multiplier covers max-context reservation',(select 3 >= ((1048576::numeric*1.25+8000::numeric*4.25)/1000000)*credit_safety_multiplier from private.meta_credit_budget));
select pg_temp.ok('approved spend cannot be expanded beyond 120 guard units',pg_temp.denied('update private.meta_credit_budget set approved_credit_units=121 where id=true','check constraint'));
select pg_temp.ok('private financial tables retain row security',(select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('meta_credit_budget','meta_authorized_scopes','meta_evaluation_cases','meta_spend_ledger')));
select pg_temp.ok('test began without uncertain existing provider outcomes',not exists(select 1 from private.meta_spend_ledger where status='uncertain' or status='reserved' and created_at<now()-interval '2 minutes'));

select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
do $$declare l uuid:=current_setting('test.meta_league')::uuid;l2 uuid:=current_setting('test.meta_league_two')::uuid;a uuid:='dd000000-0000-4000-8000-000000000001';c uuid;r jsonb;begin
 perform pg_temp.ok('public league cannot be authorized for paid inference',pg_temp.financial_denied('authorize_scope',jsonb_build_object('league',current_setting('test.meta_public'),'actor',a,'feature','operations'),'Private synthetic operator scope'));
 perform pg_temp.ok('nonmember actor cannot be authorized for private inference',pg_temp.financial_denied('authorize_scope',jsonb_build_object('league',l,'actor','dd000000-0000-4000-8000-000000000003','feature','operations'),'Private synthetic operator scope'));
 perform pg_temp.ok('coach cannot authorize operations-agent scope',pg_temp.financial_denied('authorize_scope',jsonb_build_object('league',l,'actor','dd000000-0000-4000-8000-000000000002','feature','operations'),'Private synthetic operator scope'));
 perform pg_temp.ok('membership alone does not authorize paid scope',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-not-authorized',repeat('a',64)),'not in authorized synthetic scope'));
 perform public.meta_finance('authorize_scope',jsonb_build_object('league',l,'actor',a,'feature','operations'));
 perform public.meta_finance('authorize_scope',jsonb_build_object('league',l2,'actor',a,'feature','operations'));
 perform pg_temp.ok('non-synthetic evaluation registration is rejected',pg_temp.financial_denied('register_case',jsonb_build_object('league',l,'actor',a,'feature','evaluation_scoresheet','case_key','synthetic-budget-case','input_digest',repeat('b',64),'label','Synthetic rollback image','synthetic',false),'Explicit generated synthetic'));
 r:=public.meta_finance('register_case',jsonb_build_object('league',l,'actor',a,'feature','evaluation_scoresheet','case_key','synthetic-budget-case','input_digest',repeat('b',64),'label','Synthetic rollback image','synthetic',true));c:=(r->>'id')::uuid;perform set_config('test.meta_case',c::text,true);
 perform pg_temp.ok('synthetic registration is idempotent for immutable input',(public.meta_finance('register_case',jsonb_build_object('league',l,'actor',a,'feature','evaluation_scoresheet','case_key','synthetic-budget-case','input_digest',repeat('b',64),'label','Synthetic rollback image','synthetic',true))->>'id')::uuid=c);
 perform pg_temp.ok('registered synthetic input cannot be replaced',pg_temp.financial_denied('register_case',jsonb_build_object('league',l,'actor',a,'feature','evaluation_scoresheet','case_key','synthetic-budget-case','input_digest',repeat('c',64),'label','Synthetic rollback replacement','synthetic',true),'Synthetic case changed'));
 perform pg_temp.ok('insufficient credit observation is rejected',pg_temp.financial_denied('observe_credits','{"remaining":29,"source":"Synthetic rollback observation"}'::jsonb||jsonb_build_object('observed_at',now()),'Verified promotional balance'));
 perform pg_temp.ok('implausible credit observation is rejected',pg_temp.financial_denied('observe_credits','{"remaining":151,"source":"Synthetic rollback observation"}'::jsonb||jsonb_build_object('observed_at',now()),'Verified promotional balance'));
 perform pg_temp.ok('unverifiable credit source is rejected',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"none"}'::jsonb||jsonb_build_object('observed_at',now()),'Verified promotional balance'));
 perform pg_temp.ok('missing credit observation timestamp is rejected',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"Synthetic rollback observation"}','explicit credit observation timestamp'));
 perform pg_temp.ok('null credit observation timestamp is rejected',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","observed_at":null}','explicit credit observation timestamp'));
 perform pg_temp.ok('blank credit observation timestamp is rejected',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","observed_at":"  "}','explicit credit observation timestamp'));
 perform pg_temp.ok('malformed credit observation timestamp is rejected',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","observed_at":"not-a-timestamp"}','invalid input syntax for type timestamp'));
 perform pg_temp.ok('future credit observation timestamp is rejected',pg_temp.financial_denied('observe_credits',jsonb_build_object('remaining',150,'source','Synthetic rollback observation','observed_at',now()+interval '1 minute'),'recent, nonfuture credit observation'));
 perform pg_temp.ok('stale credit observation timestamp is rejected',pg_temp.financial_denied('observe_credits',jsonb_build_object('remaining',150,'source','Synthetic rollback observation','observed_at',now()-interval '61 minutes'),'recent, nonfuture credit observation'));
 perform public.meta_finance('observe_credits',jsonb_build_object('remaining',150,'source','Synthetic rollback observation','observed_at',now()-interval '5 minutes','paused',false));
 perform pg_temp.ok('recent credit observation retains original timestamp',(public.meta_finance('summary','{}')->>'observedAt')::timestamptz=now()-interval '5 minutes');
 perform pg_temp.ok('rejected observation cannot refresh original timestamp',pg_temp.financial_denied('observe_credits','{"remaining":150,"source":"Synthetic rollback observation"}','explicit credit observation timestamp') and (public.meta_finance('summary','{}')->>'observedAt')::timestamptz=now()-interval '5 minutes');

end$$;
reset role;
update private.meta_credit_budget set paused=true,observed_at=null,observed_remaining=0 where id=true;
set local role service_role;
select pg_temp.ok('unconfirmed credits block paid reservation',pg_temp.financial_denied('reserve',pg_temp.request(current_setting('test.meta_league')::uuid,'dd000000-0000-4000-8000-000000000001','synthetic-no-credit-observation',repeat('c',64)),'verify available promotional credits'));
select public.meta_finance('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","paused":false}'::jsonb||jsonb_build_object('observed_at',now()));
reset role;
update private.meta_credit_budget set observed_at=now()-interval '61 minutes' where id=true;
set local role service_role;
select pg_temp.ok('stale credits block paid reservation',pg_temp.financial_denied('reserve',pg_temp.request(current_setting('test.meta_league')::uuid,'dd000000-0000-4000-8000-000000000001','synthetic-stale-credit-observation',repeat('c',64)),'verify available promotional credits'));
select public.meta_finance('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","paused":false}'::jsonb||jsonb_build_object('observed_at',now()));
do $$declare l uuid:=current_setting('test.meta_league')::uuid;a uuid:='dd000000-0000-4000-8000-000000000001';r jsonb;rid uuid;begin
 perform pg_temp.ok('another provider model is rejected before reservation',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-invalid-model',repeat('c',64))||'{"model":"other-model"}','Invalid bounded model'));
 perform pg_temp.ok('unbounded output allowance is rejected',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-invalid-output',repeat('c',64))||'{"max_output_tokens":8001}','Invalid bounded model'));
 perform pg_temp.ok('evaluation needs its registered case',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-missing-case',repeat('c',64),'evaluation_scoresheet'),'Registered synthetic evaluation'));
 r:=public.meta_finance('reserve',pg_temp.request(l,a,'synthetic-first-dispatch',repeat('d',64),'evaluation_scoresheet',current_setting('test.meta_case')::uuid));rid:=(r->>'id')::uuid;perform set_config('test.meta_reservation',rid::text,true);
 perform pg_temp.ok('reservation returns durable hold before any provider dispatch',(r->>'reservedGuardUnits')::numeric=3 and rid is not null);
 perform pg_temp.ok('same request key cannot be dispatched twice',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-first-dispatch',repeat('e',64),'evaluation_scoresheet',current_setting('test.meta_case')::uuid),'exact request was already attempted'));
 perform pg_temp.ok('same request digest cannot hide behind another key',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-alternate-dispatch',repeat('d',64),'evaluation_scoresheet',current_setting('test.meta_case')::uuid),'exact request was already attempted'));
 perform pg_temp.ok('missing provider usage cannot be settled',pg_temp.financial_denied('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-missing-usage','usage','{}'::jsonb),'Unverifiable provider usage'));
 perform pg_temp.ok('fractional provider token counts cannot be settled',pg_temp.financial_denied('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-fractional-usage','usage','{"input_tokens":1.5,"output_tokens":10}'::jsonb),'Unverifiable provider usage'));
 perform pg_temp.ok('output over reservation limit cannot be settled',pg_temp.financial_denied('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-high-output','usage','{"input_tokens":100,"output_tokens":4001}'::jsonb),'Unverifiable provider usage'));
 perform pg_temp.ok('negative provider usage cannot be settled',pg_temp.financial_denied('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-negative-usage','usage','{"input_tokens":-1,"output_tokens":10}'::jsonb),'Unverifiable provider usage'));
 perform pg_temp.ok('provider response identity is required for settlement',pg_temp.financial_denied('settle',jsonb_build_object('id',rid,'usage','{"input_tokens":100,"output_tokens":10}'::jsonb),'Unverifiable provider usage'));
end$$;
reset role;
select pg_temp.ok('unsettled row contains no claimed provider response',exists(select 1 from private.meta_spend_ledger where id=current_setting('test.meta_reservation')::uuid and status='reserved' and usage is null and response_id is null and charged_credit_units is null and reserved_credit_units=3));
set local role service_role;
do $$declare rid uuid:=current_setting('test.meta_reservation')::uuid;r jsonb;begin
 r:=public.meta_finance('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-budget-completed','usage','{"input_tokens":1000,"output_tokens":100,"input_tokens_details":{"cached_tokens":999}}'::jsonb,'summary','{"status":"completed","model":"muse-spark-1.3","validation":"not-yet-validated","execution":"No action executed; transactional test fixture only"}'::jsonb));
 perform pg_temp.ok('settlement conservatively charges cached input at full standard rate',(r->>'conservativeUSD')::numeric=.001675 and (r->>'guardUnits')::numeric=.00335);
 perform pg_temp.ok('settlement cannot run twice',pg_temp.financial_denied('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-budget-completed','usage','{"input_tokens":1000,"output_tokens":100}'::jsonb),'already settled'));
 perform pg_temp.ok('unknown response cannot receive a validation annotation',pg_temp.financial_denied('annotate','{"response_id":"synthetic-test-nonexistent","validation":"schema_validated"}','Actual settled response required'));
 perform public.meta_finance('annotate','{"response_id":"synthetic-test-budget-completed","validation":"schema_validation_failed"}');
end$$;
reset role;
select pg_temp.ok('failed output validation remains inspectable without claiming an action',exists(select 1 from private.meta_spend_ledger where id=current_setting('test.meta_reservation')::uuid and status='completed' and response_summary->>'validation'='schema_validation_failed' and response_summary->>'execution' like 'No action executed%'));

select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select pg_temp.ok('administrator sees actual settled evaluation metadata',exists(select 1 from jsonb_array_elements(public.meta_evidence_list(current_setting('test.meta_league')::uuid)) e where e->>'response_id'='synthetic-test-budget-completed' and e#>>'{response,evaluation,synthetic}'='true' and e#>>'{response,validation}'='schema_validation_failed'));
reset role;
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000002","role":"authenticated"}',true);set local role authenticated;
select pg_temp.ok('coach cannot inspect private genuine response list',pg_temp.denied(format('select public.meta_evidence_list(%L)',current_setting('test.meta_league')),'Administrator evidence required'));
reset role;
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000003","role":"authenticated"}',true);set local role authenticated;
select pg_temp.ok('outsider cannot inspect private genuine response list',pg_temp.denied(format('select public.meta_evidence_list(%L)',current_setting('test.meta_league')),'Administrator evidence required'));
reset role;

select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
do $$declare l uuid:=current_setting('test.meta_league')::uuid;a uuid:='dd000000-0000-4000-8000-000000000001';rid uuid;r jsonb;begin
 rid:=(public.meta_finance('reserve',pg_temp.request(l,a,'synthetic-incomplete-response',repeat('f',64)))->>'id')::uuid;perform set_config('test.meta_incomplete',rid::text,true);
 perform public.meta_finance('settle',jsonb_build_object('id',rid,'response_id','synthetic-test-budget-incomplete','usage','{"input_tokens":100,"output_tokens":4000}'::jsonb,'summary','{"status":"incomplete","model":"muse-spark-1.3","validation":"not-yet-validated","execution":"No successful action is claimed"}'::jsonb));
 -- Incomplete generation may still be billed: account for its valid usage and
 -- preserve status rather than discarding cost. App completion validation is separate.
 rid:=(public.meta_finance('reserve',pg_temp.request(l,a,'synthetic-uncertain-response',repeat('1',64)))->>'id')::uuid;perform set_config('test.meta_uncertain',rid::text,true);
 perform public.meta_finance('uncertain',jsonb_build_object('id',rid,'summary','{"status":"uncertain","reason":"Synthetic timeout test; no provider called"}'::jsonb));
 perform pg_temp.ok('uncertain response pauses further inference',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-after-uncertain',repeat('2',64)),'verify available promotional credits'));
 perform public.meta_finance('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","paused":false}'::jsonb||jsonb_build_object('observed_at',now()));
 perform pg_temp.ok('fresh credit observation does not erase uncertain usage',pg_temp.financial_denied('reserve',pg_temp.request(l,a,'synthetic-after-unpause',repeat('2',64)),'Uncertain provider usage'));
end$$;
reset role;
select pg_temp.ok('incomplete billed response preserves incomplete status and no success claim',exists(select 1 from private.meta_spend_ledger where id=current_setting('test.meta_incomplete')::uuid and status='completed' and response_summary->>'status'='incomplete' and response_summary->>'execution'='No successful action is claimed' and charged_credit_units>0));
select pg_temp.ok('uncertain provider outcome retains the full conservative hold',exists(select 1 from private.meta_spend_ledger where id=current_setting('test.meta_uncertain')::uuid and status='uncertain' and reserved_credit_units=3 and charged_credit_units is null));
-- Remove only this transaction's simulated records to exercise independent gates.
delete from private.meta_spend_ledger where actor_id='dd000000-0000-4000-8000-000000000001';
update private.meta_credit_budget set paused=false,observed_at=now(),observed_remaining=150 where id=true;
set local role service_role;
select set_config('test.meta_aged',(public.meta_finance('reserve',pg_temp.request(current_setting('test.meta_league')::uuid,'dd000000-0000-4000-8000-000000000001','synthetic-abandoned-reservation',repeat('3',64)))->>'id'),true);
reset role;
update private.meta_spend_ledger set created_at=now()-interval '3 minutes' where id=current_setting('test.meta_aged')::uuid;
set local role service_role;
select pg_temp.ok('abandoned reservation blocks further inference without automatic retry',pg_temp.financial_denied('reserve',pg_temp.request(current_setting('test.meta_league')::uuid,'dd000000-0000-4000-8000-000000000001','synthetic-after-abandoned',repeat('4',64)),'Uncertain provider usage'));
reset role;
delete from private.meta_spend_ledger where actor_id='dd000000-0000-4000-8000-000000000001';
update private.meta_credit_budget set paused=false,observed_at=now(),observed_remaining=32 where id=true;
set local role service_role;
select pg_temp.ok('30-credit reserve buffer blocks an otherwise affordable request',pg_temp.financial_denied('reserve',pg_temp.request(current_setting('test.meta_league')::uuid,'dd000000-0000-4000-8000-000000000001','synthetic-buffer-floor',repeat('5',64)),'Promotional safety allowance exhausted'));
select public.meta_finance('observe_credits','{"remaining":150,"source":"Synthetic rollback observation","paused":false}'::jsonb||jsonb_build_object('observed_at',now()));
reset role;
do $$declare l uuid:=current_setting('test.meta_league')::uuid;l2 uuid:=current_setting('test.meta_league_two')::uuid;a uuid:='dd000000-0000-4000-8000-000000000001';i int;accepted int:=0;expected int;spent numeric;stopped boolean:=false;begin
 select coalesce(sum(coalesce(charged_credit_units,reserved_credit_units)),0) into spent from private.meta_spend_ledger;
 expected:=floor((120-spent)/3);
 for i in 1..50 loop
  begin
   perform public.meta_finance('reserve',pg_temp.request(case when i%2=0 then l else l2 end,a,'synthetic-shared-exhaustion-'||i,repeat(md5('synthetic-shared/'||i),2),'operations'));
   accepted:=accepted+1;
  exception when others then
   if position('Promotional safety allowance exhausted' in sqlerrm)=0 then raise;end if;stopped:=true;exit;
  end;
 end loop;
 perform pg_temp.ok('shared reservations exhaust globally across different private leagues',accepted=expected and stopped);
 select coalesce(sum(coalesce(charged_credit_units,reserved_credit_units)),0) into spent from private.meta_spend_ledger;
 perform pg_temp.ok('global held and charged total never exceeds 120 guard units',spent<=120);
 perform pg_temp.ok('global reservation exhaustion preserves at least 30 observed credit units',150-spent>=30);
 perform pg_temp.ok('reservation exhaustion does not depend on paid provider calls',not exists(select 1 from private.meta_spend_ledger where actor_id=a and (response_id is not null or usage is not null)));
end$$;
select jsonb_build_object('passed',count(*),'tests',jsonb_agg(name order by name),'provider_calls',0,'all_changes_rolled_back',true) as test_results from assertions;
rollback;
