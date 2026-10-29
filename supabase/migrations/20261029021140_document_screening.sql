-- Local-only screening shares the original document's authorization and lifetime.
alter table public.age_documents add column screening jsonb, add column visual_hash text check(visual_hash is null or visual_hash ~ '^[a-f0-9]{16}$');
create index age_documents_league_visual on public.age_documents(league_id,visual_hash) where visual_hash is not null;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('private.finalize_age_upload(text,uuid,jsonb)'::regprocedure) into definition;
 if position('set sha256=p->>''sha256''' in definition)=0 then raise exception 'Expected trusted finalizer not found'; end if;
 definition:=replace(definition,'set sha256=p->>''sha256''','set screening=nullif(p->''screening'',''null''::jsonb),visual_hash=p->''screening''->>''perceptualHash'',sha256=p->>''sha256''');
 execute definition;
 select pg_get_functiondef('private.document_maintenance(text,jsonb)'::regprocedure) into definition;
 if position('set status=''deleted''' in definition)=0 then raise exception 'Expected deletion bridge not found'; end if;
 definition:=replace(definition,'set status=''deleted''','set screening=null,visual_hash=null,sha256=null,status=''deleted''');
 execute definition;
end $migration$;
alter table public.eligibility_reviews drop constraint eligibility_reviews_decision_check;
alter table public.eligibility_reviews add constraint eligibility_reviews_decision_check check(decision in ('approved','rejected','resubmission','viewed','deletion_requested','escalated'));

create function private.document_screening(l uuid,did uuid,action text,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare doc public.age_documents; pl public.players; d public.divisions; cutoff date; exact_count int; similar_count int; result jsonb;
begin
 if auth.uid() is null or private.member_role(l) is distinct from 'admin' then raise exception 'Administrator document reviewer required' using errcode='42501'; end if;
 perform 1 from public.leagues where id=l for update;
 select * into doc from public.age_documents where id=did and league_id=l for update;
 if doc.id is null or doc.status in ('reserved','deleted','deleting') or doc.retain_until<=now() then raise exception 'Document screening unavailable' using errcode='42501'; end if;
 select * into pl from public.players where id=doc.player_id and league_id=l;
 select div.* into d from public.divisions div join public.teams t on t.division_id=div.id where t.id=pl.team_id and div.league_id=l;
 select cutoff_date into cutoff from public.leagues where id=l;
 if action='escalate' then
   if doc.status<>'submitted' or length(coalesce(reason,'')) not between 10 and 1000 then raise exception 'Escalation requires a pending original and a meaningful reason';end if;
   insert into public.eligibility_reviews(league_id,player_id,document_id,reviewer_id,decision,reason) values(l,pl.id,doc.id,auth.uid(),'escalated',reason);
   insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'preseason.document_escalated',jsonb_build_object('document_id',doc.id));
   return jsonb_build_object('ok',true,'humanReviewRequired',true);
 elsif action<>'read' then raise exception 'Unsupported screening action';end if;
 select count(*) into exact_count from public.age_documents other where other.league_id=l and other.player_id<>pl.id and other.sha256=doc.sha256 and other.status not in ('reserved','deleted','deleting') and other.retain_until>now();
 select count(*) into similar_count from public.age_documents other where other.league_id=l and other.player_id<>pl.id and other.id<>doc.id and other.status not in ('reserved','deleted','deleting') and other.retain_until>now() and other.visual_hash is not null and doc.visual_hash is not null and other.visual_hash not in ('0000000000000000','ffffffffffffffff') and doc.visual_hash not in ('0000000000000000','ffffffffffffffff') and other.sha256 is distinct from doc.sha256 and bit_count(('x'||other.visual_hash)::bit(64) # ('x'||doc.visual_hash)::bit(64))<=4;
 result:=coalesce(doc.screening,'{"version":1,"status":"unable_to_assess","authenticity":"unverified","findings":[],"limitations":["This original predates local screening. Review it manually; do not infer a completed check."]}'::jsonb);
 result:=result-'perceptualHash';
 result:=result||jsonb_build_object('exactDuplicates',exact_count,'possibleSimilarDocuments',similar_count,'ageEligible',case when d.id is null then null else extract(year from age(cutoff,pl.birth_date)) between d.min_age and d.max_age end,'ageAtCutoff',extract(year from age(cutoff,pl.birth_date))::int,'cutoffDate',cutoff,'minimumAge',d.min_age,'maximumAge',d.max_age,'humanReviewRequired',true);
 if exact_count>0 or similar_count>0 or d.id is null or not (extract(year from age(cutoff,pl.birth_date)) between d.min_age and d.max_age) then result:=result||'{"status":"review_required"}'::jsonb;end if;
 insert into public.audit_events(league_id,actor_id,action,detail) values(l,auth.uid(),'preseason.screening_viewed',jsonb_build_object('document_id',doc.id));
 return result;
end $$;
revoke all on function private.document_screening(uuid,uuid,text,text) from public,anon;
grant execute on function private.document_screening(uuid,uuid,text,text) to authenticated;
create function public.document_screening(p_league uuid,p_document uuid,p_action text default 'read',p_reason text default '') returns jsonb language sql security invoker set search_path='' as $$ select private.document_screening(p_league,p_document,p_action,p_reason) $$;
revoke all on function public.document_screening(uuid,uuid,text,text) from public,anon;
grant execute on function public.document_screening(uuid,uuid,text,text) to authenticated;
