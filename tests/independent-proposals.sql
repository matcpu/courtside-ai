-- Synthetic transactional fixture; no production league/response is modified.
begin;
create temp table assertions(name text primary key,passed boolean not null);
grant insert,select on assertions to authenticated;
create function pg_temp.ok(n text,b boolean) returns void language plpgsql as $$begin if b is distinct from true then raise exception 'FAILED: %',n;end if;insert into assertions values(n,true);end$$;
create function pg_temp.denied(s text) returns boolean language plpgsql as $$begin execute s;return false;exception when others then return position('stale' in lower(sqlerrm))>0;end$$;
insert into auth.users(id,aud,role,email) values('cc000000-0000-4000-8000-000000000001','authenticated','authenticated','proposal-review@example.invalid');
select set_config('request.jwt.claims','{"sub":"cc000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.proposal_league',public.create_demo()->>'id',true);
reset role;
-- Controlled input history creates a second independent deterministic candidate.
update public.games g set home_score=case when g.home_team_id=t.id then 30 else 70 end,away_score=case when g.away_team_id=t.id then 30 else 70 end
from public.teams t where g.league_id=current_setting('test.proposal_league')::uuid and t.league_id=g.league_id and t.name='Riverside Ravens' and g.status='confirmed' and t.id in (g.home_team_id,g.away_team_id);
set local role authenticated;
do $$declare l uuid:=current_setting('test.proposal_league')::uuid;s jsonb;first_id uuid;second_id uuid;begin
 perform public.league_command(l,'propose_balance');s:=public.league_snapshot(l,false);
 select (p->>'id')::uuid into first_id from jsonb_array_elements(s->'proposals') p join public.teams t on t.id=(p->>'team_id')::uuid where p->>'status'='pending' and t.name='Eastside Eagles';
 select (p->>'id')::uuid into second_id from jsonb_array_elements(s->'proposals') p join public.teams t on t.id=(p->>'team_id')::uuid where p->>'status'='pending' and t.name='Riverside Ravens';
 perform pg_temp.ok('two independent deterministic candidates exist',first_id is not null and second_id is not null);
 perform public.league_command(l,'decide_proposal',jsonb_build_object('proposal_id',first_id,'approve',true));
 perform pg_temp.ok('sibling original proposal remains valid',(select data_revision=(select data_revision from public.leagues where id=l) from public.division_proposals where id=second_id and status='pending'));
 perform public.league_command(l,'decide_proposal',jsonb_build_object('proposal_id',second_id,'approve',true));
 perform pg_temp.ok('both original IDs receive explicit administrator decisions',(select count(*)=2 from public.division_proposals where id in(first_id,second_id) and status='approved'));
 perform pg_temp.ok('decision history preserves both approvals',(select count(*)=2 from public.audit_events where league_id=l and action='decide_proposal'));
 -- A different mutation still invalidates pending evidence.
 perform public.league_command(l,'propose_balance');
 select (p->>'id')::uuid into second_id from jsonb_array_elements(public.league_snapshot(l,false)->'proposals') p where p->>'status'='pending' limit 1;
 if second_id is not null then
  perform public.league_command(l,'add_court','{"name":"Synthetic revision boundary"}');
  perform pg_temp.ok('unrelated data changes still stale proposals',pg_temp.denied(format('select public.league_command(%L,''decide_proposal'',%L::jsonb)',l,jsonb_build_object('proposal_id',second_id,'approve',true))));
 end if;
end$$;
reset role;
select jsonb_build_object('passed',count(*),'tests',jsonb_agg(name)) from assertions;
rollback;
