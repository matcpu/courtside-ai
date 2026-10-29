do $migration$
declare definition text;needle text;
begin
 select pg_get_functiondef('private.document_screening(uuid,uuid,text,text)'::regprocedure) into definition;
 needle:=$old$and bit_count(('x'||other.visual_hash)::bit(64) # ('x'||doc.visual_hash)::bit(64))<=4;$old$;
 if position(needle in definition)=0 then raise exception 'Expected similarity implementation not found';end if;
 definition:=replace(definition,needle,$patch$
  and doc.screening->>'visualHashVersion'='2' and other.screening->>'visualHashVersion'='2'
  and abs((other.screening#>>'{image,aspectRatio}')::numeric/nullif((doc.screening#>>'{image,aspectRatio}')::numeric,0)-1)<=0.03
  and doc.screening->>'differenceHash' not in ('0000000000000000','ffffffffffffffff')
  and other.screening->>'differenceHash' not in ('0000000000000000','ffffffffffffffff')
  and bit_count(('x'||other.visual_hash)::bit(64) # ('x'||doc.visual_hash)::bit(64))<=4
  and bit_count(('x'||(other.screening->>'differenceHash'))::bit(64) # ('x'||(doc.screening->>'differenceHash'))::bit(64))<=8;$patch$);
 definition:=replace(definition,$old$result:=result-'perceptualHash';$old$,$patch$result:=result-'perceptualHash'-'differenceHash';$patch$);
 execute definition;
 select pg_get_functiondef('private.meta_finance(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'observed_at=now(),paused=', $patch$observed_at=coalesce((p->>'observed_at')::timestamptz,now()),paused=$patch$);
 definition:=replace(definition,'if action=''observe_credits'' then',$patch$if action='observe_credits' then
  if coalesce((p->>'observed_at')::timestamptz,now()) not between now()-interval '60 minutes' and now() then raise exception 'A recent, nonfuture credit observation is required';end if;$patch$);
 execute definition;
end $migration$;
