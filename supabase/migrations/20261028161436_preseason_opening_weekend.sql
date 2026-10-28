alter function private.validate_schedule(uuid,uuid) rename to core_validate_schedule;
revoke all on function private.core_validate_schedule(uuid,uuid) from public,anon,authenticated;
create function private.validate_schedule(l uuid,v uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.core_validate_schedule(l,v);
 if exists(select 1 from public.preseason_settings c join public.leagues le on le.id=c.league_id join public.fixtures f on f.league_id=le.id join public.games g on g.id=f.game_id where c.league_id=l and c.enabled and f.version_id=v and g.status<>'confirmed' and f.starts_at<(c.season_start::timestamp at time zone le.timezone)) then raise exception 'Fixtures cannot begin before the configured opening weekend';end if;
end $$;
revoke all on function private.validate_schedule(uuid,uuid) from public,anon,authenticated;
create or replace function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 result:=private.core_snapshot(l,public_only);
 result:=jsonb_set(result,'{league}',(result->'league')||jsonb_build_object('preseason_enabled',(select enabled from public.preseason_settings where league_id=l),'season_start',(select season_start from public.preseason_settings where league_id=l)));
 if public_only then return result;end if;
 return result||jsonb_build_object('readiness',(select coalesce(jsonb_agg(private.team_readiness(l,id)),'[]') from public.teams where league_id=l));
end $$;
