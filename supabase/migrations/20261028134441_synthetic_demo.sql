-- Synthetic reference league and isolated per-user demo workspaces. Never real children.
create function private.seed_demo(l uuid,actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare names text[]:=array['Northside Falcons','Midtown Monarchs','West End Wolves','Lakeside Lynx','Eastside Eagles','Riverside Ravens','Summit Spartans','Cedar City Bears','Oakwood Owls','Harbour Hawks','Valley Vipers','Parkdale Panthers'];
 ids uuid[]:=array[]::uuid[];courts uuid[]:=array[]::uuid[];did uuid;tid uuid;cid uuid;vid uuid;gid uuid;i int;j int;r int;v_tier int;hs int;aws int;ts timestamptz;idx int;pair int[];
begin
 if exists(select 1 from public.teams where league_id=l) then raise exception 'Demo league is already seeded';end if;
 for i in 1..12 loop
 v_tier:=((i-1)/4)+1;select id into did from public.divisions where league_id=l and divisions.tier=v_tier;
 insert into public.teams(league_id,name,coach_id,coach_email,division_id,recommended_division,status,assessment,assessment_explanation,initial_rating,rating)
 values(l,names[i],actor,'coach-'||i||'@courtside.example.invalid',did,v_tier,'approved',jsonb_build_object('experience',case when v_tier=1 then 4 when v_tier=2 then 3 else 1 end,'yearsTogether',1,'practicesPerWeek',2,'notes','Fictional hackathon team.'),'Synthetic reference team. Initial placement approved for the demo season.',case when v_tier=1 then 1190 when v_tier=2 then 1080 else 920 end,1000) returning id into tid;
 ids:=array_append(ids,tid);
 end loop;
 for i in 1..2 loop
 insert into public.courts(league_id,name,venue) values(l,case when i=1 then 'North Court' else 'South Court' end,'Northstar Community Centre · Fictional venue') returning id into cid;
 courts:=array_append(courts,cid);
 for j in -7..14 loop
 ts:=date_trunc('day',now())+make_interval(days=>j)+interval '13 hours';
 insert into public.availability(league_id,court_id,starts_at,ends_at) values(l,cid,ts,ts+interval '10 hours');
 end loop;
 end loop;
 insert into public.schedule_versions(league_id,number,status,base_revision,data_revision,explanation,created_by,approved_by)
 values(l,1,'published',0,0,'Synthetic demo season. Historical scores are fictional verified examples; future fixtures use confirmed sample gym availability.',actor,actor) returning id into vid;
 for v_tier in 0..2 loop
 for r in 0..2 loop
 for j in 0..1 loop
 pair:=case when r=0 and j=0 then array[1,4] when r=0 then array[2,3] when r=1 and j=0 then array[1,3] when r=1 then array[4,2] when r=2 and j=0 then array[1,2] else array[3,4] end;
 hs:=case when v_tier=1 and j=0 then 78 else 48+(r*3+j*2) end;aws:=case when v_tier=1 and j=0 then 43 else 45+(r*2+j*3) end;
 ts:=date_trunc('day',now())-make_interval(days=>6-r*2)+interval '14 hours'+make_interval(hours=>v_tier*2);
 insert into public.games(league_id,home_team_id,away_team_id,status,home_score,away_score,played_at) values(l,ids[v_tier*4+pair[1]],ids[v_tier*4+pair[2]],'confirmed',hs,aws,ts) returning id into gid;
 insert into public.fixtures(league_id,version_id,game_id,court_id,starts_at,ends_at) values(l,vid,gid,courts[j+1],ts,ts+interval '1 hour');
 end loop;end loop;
 for j in 0..1 loop
 ts:=date_trunc('day',now())+interval '2 days 15 hours'+make_interval(hours=>v_tier*2);
 insert into public.games(league_id,home_team_id,away_team_id) values(l,ids[v_tier*4+j*2+1],ids[v_tier*4+j*2+2]) returning id into gid;
 insert into public.fixtures(league_id,version_id,game_id,court_id,starts_at,ends_at) values(l,vid,gid,courts[j+1],ts,ts+interval '1 hour');
 end loop;
 end loop;
 -- A past, unconfirmed fixture supports real scoresheet review in a live demo.
 ts:=date_trunc('day',now())-interval '1 day'+interval '17 hours';
 insert into public.games(league_id,home_team_id,away_team_id) values(l,ids[5],ids[6]) returning id into gid;
 insert into public.fixtures(league_id,version_id,game_id,court_id,starts_at,ends_at) values(l,vid,gid,courts[1],ts,ts+interval '1 hour');
 perform private.recalculate(l);
 update public.leagues set revision=1,data_revision=1 where id=l;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,actor,'demo.seeded',jsonb_build_object('synthetic',true,'teams',12,'confirmed_results',18));
end $$;
revoke all on function private.seed_demo(uuid,uuid) from public,anon,authenticated;
create function private.make_demo() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;l uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if (select count(*) from public.leagues where owner_id=actor and is_demo)>2 then raise exception 'Use an existing demo workspace (maximum 3)';end if;
 result:=private.command(null,'create_league',jsonb_build_object('name','Northstar Youth League · My Demo','season','Fall 2026','cutoff','2026-09-01','demo',true));l:=(result->>'id')::uuid;
 perform private.seed_demo(l,actor);return result;
end $$;
revoke all on function private.make_demo() from public,anon;
grant execute on function private.make_demo() to authenticated;
create function public.create_demo() returns jsonb language sql security invoker set search_path='' as $$select private.make_demo()$$;
revoke all on function public.create_demo() from public,anon;
grant execute on function public.create_demo() to authenticated;

do $$ declare l uuid;begin
 insert into public.leagues(name,slug,season_name,cutoff_date,is_public,is_demo) values('Northstar Youth League','northstar-demo','Fall 2026','2026-09-01',true,true) returning id into l;
 insert into public.divisions(league_id,name,tier) values(l,'U14 · Premier',1),(l,'U14 · Competitive',2),(l,'U14 · Development',3);
 perform private.seed_demo(l,null);
end $$;
