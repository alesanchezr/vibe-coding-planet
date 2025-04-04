-- GameQueue table for game state synchronization
-- This needs to be executed in the Supabase SQL Editor

-- Create the GameQueue table
CREATE TABLE IF NOT EXISTS public.game_queue (
  id SERIAL PRIMARY KEY,
  cooldown_duration INTEGER NOT NULL DEFAULT 120, -- 2 minutes in seconds
  waiting_duration INTEGER NOT NULL DEFAULT 60,   -- 1 minute in seconds
  active_duration INTEGER NOT NULL DEFAULT 360,   -- 6 minutes in seconds
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  winner_planet TEXT CHECK (winner_planet IS NULL OR winner_planet IN ('earth', 'mars')),
  assignation_algo TEXT NOT NULL DEFAULT 'roundrobin' CHECK (assignation_algo IN ('roundrobin', 'random', 'free')),
  current_state TEXT NOT NULL DEFAULT 'waiting_for_players' CHECK (current_state IN ('waiting_for_players', 'active', 'cooldown', 'victory', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries on the game state
CREATE INDEX IF NOT EXISTS idx_game_queue_state 
  ON public.game_queue (current_state);

-- Enable Row Level Security (RLS)
ALTER TABLE public.game_queue ENABLE ROW LEVEL SECURITY;

-- Create policy for read access to the game queue
CREATE POLICY "Allow public read access to game_queue" 
  ON public.game_queue 
  FOR SELECT 
  USING (true);

-- Create policy for service role to update game_queue
CREATE POLICY "Allow service role to update game_queue" 
  ON public.game_queue 
  FOR ALL 
  TO service_role
  USING (true);

-- Enable real-time for the game_queue table
-- This can't be done via SQL directly, but this is for documentation
COMMENT ON TABLE public.game_queue IS 'Game queue for synchronizing game state across clients';

-- Create a function to get the current active game
CREATE OR REPLACE FUNCTION public.get_current_game()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Get the most recent game record
  SELECT row_to_json(g)
  FROM public.game_queue g
  WHERE g.current_state != 'ended'
  ORDER BY g.id DESC
  LIMIT 1
  INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to create a new game
CREATE OR REPLACE FUNCTION public.create_new_game(
  p_cooldown_duration INTEGER DEFAULT 120,
  p_waiting_duration INTEGER DEFAULT 60,
  p_active_duration INTEGER DEFAULT 360,
  p_assignation_algo TEXT DEFAULT 'roundrobin'
)
RETURNS JSON AS $$
DECLARE
  new_game RECORD;
BEGIN
  -- Insert a new game record
  INSERT INTO public.game_queue (
    cooldown_duration,
    waiting_duration,
    active_duration,
    assignation_algo,
    current_state
  )
  VALUES (
    p_cooldown_duration,
    p_waiting_duration,
    p_active_duration,
    p_assignation_algo,
    'waiting_for_players'
  )
  RETURNING *
  INTO new_game;
  
  RETURN row_to_json(new_game);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update the game state
CREATE OR REPLACE FUNCTION public.update_game_state(
  p_game_id INTEGER,
  p_current_state TEXT,
  p_winner_planet TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  updated_game RECORD;
BEGIN
  -- Validate the state
  IF p_current_state NOT IN ('waiting_for_players', 'active', 'cooldown', 'victory', 'ended') THEN
    RAISE EXCEPTION 'Invalid game state. Must be one of: waiting_for_players, active, cooldown, victory, ended';
  END IF;
  
  -- Update timestamps based on state change
  IF p_current_state = 'active' THEN
    -- Game is starting, update started_at
    UPDATE public.game_queue
    SET 
      current_state = p_current_state,
      started_at = NOW()
    WHERE id = p_game_id
    RETURNING *
    INTO updated_game;
  ELSIF p_current_state IN ('cooldown', 'victory', 'ended') THEN
    -- Game is ending, update ended_at and winner if applicable
    UPDATE public.game_queue
    SET 
      current_state = p_current_state,
      ended_at = NOW(),
      winner_planet = p_winner_planet
    WHERE id = p_game_id
    RETURNING *
    INTO updated_game;
  ELSE
    -- Regular state update
    UPDATE public.game_queue
    SET current_state = p_current_state
    WHERE id = p_game_id
    RETURNING *
    INTO updated_game;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game with ID % not found', p_game_id;
  END IF;
  
  RETURN row_to_json(updated_game);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the table is included in the publication for real-time updates
-- This requires superuser access, so may need to be run by the project owner
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.game_queue;

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_current_game() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_new_game(INTEGER, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_game_state(INTEGER, TEXT, TEXT) TO service_role; 