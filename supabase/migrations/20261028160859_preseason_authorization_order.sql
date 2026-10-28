create or replace function private.command(l uuid,action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.preseason_settings;te public.teams;q public.coach_questionnaires;result jsonb;fixture jsonb;gid uuid;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if action not in ('create_league','register_team','add_player','submit_scoresheet','set_sms_consent','mark_notification_read') and private.member_role(l) is distinct from 'admin' and not coalesce(private.member_role(l)='scorekeeper' and action in ('confirm_result','reject_scoresheet','reopen_result'),false) then raise exception 'Administrator required' using errcode='42501';end if;
 if action='create_league' then return private.core_command(l,action,p);end if;
 perform 1 from public.leagues where id=l for update;
 select * into cfg from public.preseason_settings where league_id=l;
 if cfg.enabled then
 if action='register_team' and private.member_role(l) is distinct from 'admin' and (cfg.registration_status<>'open' or now()>cfg.questionnaire_deadline) then raise exception 'Season registration is closed';end if;
 if action='verify_player' then raise exception 'Document review is required. Use the preseason verification queue.';end if;
 if action='add_player' then
 if not exists(select 1 from public.teams where id=(p->>'team_id')::uuid and league_id=l and (coach_id=auth.uid() or private.member_role(l)='admin')) then raise exception 'Roster access denied' using errcode='42501';end if;
 if private.member_role(l)<>'admin' and now()>cfg.roster_deadline then raise exception 'Roster deadline has passed';end if;
 if (select count(*) from public.players where team_id=(p->>'team_id')::uuid and active)>=cfg.max_roster then raise exception 'Maximum roster size reached';end if;
 p:=p||jsonb_build_object('guardian_consent',false);
 end if;
 if action='approve_team' then
 select * into te from public.teams where id=(p->>'team_id')::uuid and league_id=l;
 select * into q from public.coach_questionnaires where team_id=te.id;
 if q.status is distinct from 'submitted' then raise exception 'A submitted comprehensive questionnaire is required';end if;
 if coalesce((p->>'tier')::int,te.recommended_division)<>te.recommended_division and length(coalesce(p->>'override_reason',''))<10 then raise exception 'Explain a placement override in at least 10 characters';end if;
 end if;
 if action in ('draft_schedule','publish_schedule') then
 for fixture in select value from jsonb_array_elements(case when action='draft_schedule' then p->'fixtures' else (select jsonb_agg(to_jsonb(f)) from public.fixtures f where version_id=(p->>'version_id')::uuid and league_id=l) end) loop
 gid:=(fixture->>'game_id')::uuid;
 if exists(select 1 from public.games where id=gid and status='confirmed' and league_id=l) then continue;end if;
 if action='publish_schedule' then select to_jsonb(g) into fixture from public.games g where id=gid and league_id=l;end if;
 if not coalesce((private.team_readiness(l,(fixture->>'home_team_id')::uuid)->>'eligible_for_scheduling')::boolean,false) or not coalesce((private.team_readiness(l,(fixture->>'away_team_id')::uuid)->>'eligible_for_scheduling')::boolean,false) then raise exception 'Preseason eligibility blocks scheduling. Complete questionnaire, placement, roster and document reviews first.';end if;
 end loop;
 end if;
 end if;
 result:=private.core_command(l,action,p);
 if cfg.enabled and action='approve_team' then
 update public.teams set placement_revision=q.revision where id=te.id;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'preseason.placement_approved',jsonb_build_object('team_id',te.id,'questionnaire_revision',q.revision,'tier',coalesce((p->>'tier')::int,te.recommended_division),'override_reason',p->>'override_reason'));
 end if;
 if cfg.enabled and action='add_player' then update public.teams set roster_submitted_at=null where id=(p->>'team_id')::uuid and league_id=l;end if;
 return result;
end $$;
