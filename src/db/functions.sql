-- Function to update player's last active timestamp
create or replace function public.update_player_last_active(
  p_session_id text
)
returns json as $$
declare
  updated_player record;
begin
  update public.players
  set last_active = now()
  where session_id = p_session_id
  returning *
  into updated_player;
  
  if not found then
    return null;
  end if;
  
  return row_to_json(updated_player);
end;
$$ language plpgsql security definer;

-- Function to retrieve players by planet
create or replace function public.get_players_by_planet(
  p_planet_name text,
  p_active_within_seconds int default 30
)
returns json as $$
declare
  result json;
begin
  -- Validate planet name
  if p_planet_name not in ('earth', 'mars') then
    raise exception 'Invalid planet name. Must be either ''earth'' or ''mars''';
  end if;

  select json_agg(p.*)
  from public.players p
  where p.planet_name = p_planet_name
  and p.last_active >= (now() - (p_active_within_seconds || ' seconds')::interval)
  into result;
  
  return coalesce(result, '[]'::json);
end;
$$ language plpgsql security definer;

-- Grant execute permissions to authenticated and anon users
grant execute on function public.update_player_last_active(text) to authenticated, anon;
grant execute on function public.get_players_by_planet(text, int) to authenticated, anon;

-- Test queries:
/*
-- Test updating last active timestamp
select public.update_player_last_active('test-session-id');

-- Test retrieving players by planet
select public.get_players_by_planet('A', 30);
*/ 