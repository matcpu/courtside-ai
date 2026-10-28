-- Recorded statistics are visible to the operations roles and the owning coach only.
drop policy member_read on public.player_statistics;
create policy member_read on public.player_statistics for select to authenticated using (
 private.member_role(league_id) in ('admin','scorekeeper') or exists(select 1 from public.teams t where t.id=team_id and t.coach_id=(select auth.uid()))
);
create or replace function private.snapshot(l uuid,public_only boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb; le public.leagues;
begin
 select * into le from public.leagues where id=l;
 r:=private.member_role(l);
 if le.id is null or (public_only and not le.is_public) or (not public_only and r is null) then raise exception 'League access denied' using errcode='42501';end if;
 result:=jsonb_build_object('league',jsonb_build_object('id',le.id,'name',le.name,'slug',le.slug,'season_name',le.season_name,'cutoff_date',le.cutoff_date,'revision',le.revision,'data_revision',le.data_revision,'is_demo',le.is_demo,'timezone',le.timezone),'role',case when public_only then 'public' else r end,
 'divisions',(select coalesce(jsonb_agg(to_jsonb(d) order by tier),'[]') from public.divisions d where league_id=l),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'division_id',t.division_id,'recommended_division',t.recommended_division,'rating',t.rating,'initial_rating',t.initial_rating,'status',t.status)||case when not public_only and (r='admin' or t.coach_id=auth.uid()) then jsonb_build_object('coach_id',t.coach_id,'coach_email',t.coach_email,'phone',t.phone,'sms_consent',t.sms_consent,'assessment',t.assessment,'assessment_explanation',t.assessment_explanation) else '{}'::jsonb end order by t.name),'[]') from public.teams t where league_id=l and (not public_only or status='approved')),
 'courts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.courts c where league_id=l),
 'games',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.games g where league_id=l and (not public_only or exists(select 1 from public.fixtures f join public.schedule_versions sv on sv.id=f.version_id where f.game_id=g.id and sv.status='published'))),
 'fixtures',(select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('home_team_id',g.home_team_id,'away_team_id',g.away_team_id) order by f.starts_at),'[]') from public.fixtures f join public.games g on g.id=f.game_id join public.schedule_versions sv on sv.id=f.version_id where f.league_id=l and (not public_only or sv.status='published')),
 'versions',(select coalesce(jsonb_agg(to_jsonb(sv) order by number desc),'[]') from public.schedule_versions sv where league_id=l and (not public_only or status='published')));
 if public_only then return result||jsonb_build_object('availability','[]'::jsonb,'scoresheets','[]'::jsonb,'players','[]'::jsonb,'statistics','[]'::jsonb,'notifications','[]'::jsonb,'audit','[]'::jsonb,'proposals','[]'::jsonb);end if;
 return result||jsonb_build_object(
 'statistics',(select coalesce(jsonb_agg(to_jsonb(ps) order by ps.game_id,ps.team_id,ps.jersey),'[]') from public.player_statistics ps where league_id=l and (r in ('admin','scorekeeper') or exists(select 1 from public.teams t where t.id=ps.team_id and t.coach_id=auth.uid()))),
 'availability',(select coalesce(jsonb_agg(to_jsonb(a) order by starts_at),'[]') from public.availability a where league_id=l),
 'scoresheets',(select coalesce(jsonb_agg(to_jsonb(s) order by created_at desc),'[]') from public.scoresheets s where league_id=l and (r in ('admin','scorekeeper') or submitted_by=auth.uid())),
 'players',(select coalesce(jsonb_agg(to_jsonb(pl)),'[]') from public.players pl where league_id=l and (r='admin' or exists(select 1 from public.teams t where t.id=pl.team_id and t.coach_id=auth.uid()))),
 'notifications',(select coalesce(jsonb_agg(to_jsonb(n)-'destination'-'lease_id'-'lease_until' order by created_at desc),'[]') from public.notifications n where league_id=l and (r='admin' or (n.channel='in_app' and n.recipient_id=auth.uid()))),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc),'[]') from (select * from public.audit_events where league_id=l and r='admin' order by created_at desc limit 100) a),
 'proposals',(select coalesce(jsonb_agg(to_jsonb(dp) order by created_at desc),'[]') from public.division_proposals dp where league_id=l and r='admin'));
end $$;
