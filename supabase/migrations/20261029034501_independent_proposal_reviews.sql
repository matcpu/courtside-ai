-- A reviewed sibling move does not change another team's verified game evidence.
-- Carry only unchanged same-revision candidates forward; all other stale checks remain.
do $migration$
declare definition text; needle text := $needle$if action in ('register_team','approve_team','reject_team','add_court','add_availability','confirm_result','decide_proposal','add_player','verify_player') then update public.leagues set data_revision=data_revision+1 where leagues.id=l;end if;$needle$;
begin
 select pg_get_functiondef('private.core_command(uuid,text,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Expected league revision guard not found'; end if;
 definition:=replace(definition,needle,needle||$patch$
 if action='decide_proposal' then
  update public.division_proposals sibling set data_revision=le.data_revision+1
  where sibling.league_id=l and sibling.status='pending' and sibling.data_revision=le.data_revision
    and sibling.team_id<>v.team_id
    and exists(select 1 from public.teams other where other.id=sibling.team_id and other.league_id=l and other.division_id=sibling.from_division_id and other.status='approved');
 end if;
 $patch$);
 execute definition;
end $migration$;
