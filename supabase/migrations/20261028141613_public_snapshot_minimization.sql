create or replace function public.league_snapshot(p_league uuid,p_public boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 result:=private.snapshot(p_league,p_public);
 if p_public then result:=jsonb_set(result,'{versions}',coalesce((select jsonb_agg(v-'created_by'-'approved_by') from jsonb_array_elements(result->'versions') v),'[]'::jsonb));end if;
 return result;
end $$;
