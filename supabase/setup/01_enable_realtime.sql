-- Enable real-time functionality for the players table
-- This needs to be executed in the Supabase SQL Editor

-- First, make sure the players table has the proper column structure
-- Uncomment and adjust if your table is different
/*
CREATE TABLE IF NOT EXISTS public.players (
  id uuid primary key default uuid_generate_v4(),
  session_id text not null unique,
  planet_name text not null,
  color text not null,
  position_x float,
  position_y float, 
  position_z float,
  created_at timestamp with time zone default now(),
  last_active timestamp with time zone default now()
);
*/

-- Enable Row Level Security (RLS) if not already enabled
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Make sure there's a policy that allows reading player data
CREATE POLICY IF NOT EXISTS "Allow public read access to players" 
  ON public.players 
  FOR SELECT 
  USING (true);

-- Make sure there's a policy that allows updating own records
CREATE POLICY IF NOT EXISTS "Allow users to update their own player records" 
  ON public.players 
  FOR UPDATE 
  USING (auth.uid()::text = session_id);

-- Enable real-time for the players table
-- Execute this in the Supabase dashboard:
-- 1. Go to Database -> Replication
-- 2. Enable real-time for the players table
-- 3. Set the real-time mode to "Send all changes"

-- This can't be done via SQL directly, but this is for documentation
COMMENT ON TABLE public.players IS 'Player data with real-time enabled for position tracking';

-- Add indexes for position queries for better performance
CREATE INDEX IF NOT EXISTS idx_players_position_xyz 
  ON public.players (position_x, position_y, position_z);
  
CREATE INDEX IF NOT EXISTS idx_players_planet_name
  ON public.players (planet_name);

-- Make sure the table is included in the publication
-- This requires superuser access, so may need to be run by the project owner
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.players; 