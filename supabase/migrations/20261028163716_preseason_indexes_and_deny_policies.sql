create index age_documents_tenant_player on public.age_documents(league_id,player_id);
create index questionnaires_tenant_team on public.coach_questionnaires(league_id,team_id);
create index eligibility_reviews_tenant_player on public.eligibility_reviews(league_id,player_id);
create index invitations_tenant_player on public.guardian_invitations(league_id,player_id);
-- These tables are intentionally RPC-only. Explicit denial protects against a
-- later accidental GRANT without broadening access to birth dates or proofs.
do $$declare tab text;begin
 foreach tab in array array['preseason_settings','coach_questionnaires','guardian_invitations','age_documents','eligibility_reviews','meta_evidence'] loop
 execute format('create policy no_direct_client_access on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',tab);
 end loop;
end $$;
