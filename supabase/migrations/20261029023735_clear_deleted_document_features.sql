-- Apply the strengthened minimization policy to originals already deleted under
-- the former policy, which retained SHA-256. Human decision history is preserved.
update public.age_documents set sha256=null,visual_hash=null,screening=null
where status='deleted' and (sha256 is not null or visual_hash is not null or screening is not null);
