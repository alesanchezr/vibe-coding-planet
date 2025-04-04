-- Game Queue Automations
-- This file adds automations to update game states based on timers

-- Function to automatically transition game states based on time
CREATE OR REPLACE FUNCTION public.auto_update_game_states()
RETURNS void AS $$
DECLARE
  game_record RECORD;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
  time_in_state INTERVAL;
BEGIN
  -- Get the current active game
  SELECT * FROM public.game_queue 
  WHERE current_state != 'ended'
  ORDER BY id DESC
  LIMIT 1
  INTO game_record;
  
  -- Exit if no active game found
  IF game_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Check for state transitions based on time
  CASE game_record.current_state
    WHEN 'waiting_for_players' THEN
      -- If we have a created_at time, check if waiting period is over
      IF game_record.created_at IS NOT NULL THEN
        time_in_state := current_time - game_record.created_at;
        
        IF EXTRACT(EPOCH FROM time_in_state) >= game_record.waiting_duration THEN
          -- Transition to active state
          UPDATE public.game_queue
          SET 
            current_state = 'active',
            started_at = current_time
          WHERE id = game_record.id;
        END IF;
      END IF;
      
    WHEN 'active' THEN
      -- If we have a started_at time, check if active period is over
      IF game_record.started_at IS NOT NULL THEN
        time_in_state := current_time - game_record.started_at;
        
        IF EXTRACT(EPOCH FROM time_in_state) >= game_record.active_duration THEN
          -- Transition to ended state with no winner (tie)
          UPDATE public.game_queue
          SET 
            current_state = 'ended',
            ended_at = current_time
          WHERE id = game_record.id;
        END IF;
      END IF;
      
    WHEN 'cooldown' THEN
      -- If we have an ended_at time, check if cooldown period is over
      IF game_record.ended_at IS NOT NULL THEN
        time_in_state := current_time - game_record.ended_at;
        
        IF EXTRACT(EPOCH FROM time_in_state) >= game_record.cooldown_duration THEN
          -- Mark current game as ended
          UPDATE public.game_queue
          SET current_state = 'ended'
          WHERE id = game_record.id;
          
          -- Create a new game for the next round
          PERFORM public.create_new_game(
            game_record.cooldown_duration,
            game_record.waiting_duration,
            game_record.active_duration,
            game_record.assignation_algo
          );
        END IF;
      END IF;
      
    ELSE
      -- Other states don't have auto-transitions
      NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up a scheduled job to run the auto-update function
-- This runs every minute to check for state transitions
SELECT cron.schedule(
  'update-game-states',  -- unique job name
  '* * * * *',           -- cron schedule (every minute)
  'SELECT public.auto_update_game_states()'
);

-- Alternatively, if you don't have pg_cron extension available,
-- you can trigger this function from your backend server periodically,
-- or add instructions to enable pg_cron in your Supabase project.

-- Modified version of update_game_state with restricted access
-- This version is only for special cases and not for regular clients
CREATE OR REPLACE FUNCTION public.admin_update_game_state(
  p_api_key TEXT,  -- Admin API key for verification
  p_game_id INTEGER,
  p_current_state TEXT,
  p_winner_planet TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  updated_game RECORD;
  valid_api_key TEXT := 'your_secret_admin_key'; -- Store this securely!
BEGIN
  -- Verify API key
  IF p_api_key != valid_api_key THEN
    RAISE EXCEPTION 'Invalid API key';
  END IF;

  -- Rest of the function is similar to update_game_state
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

-- Grant execute permission only to service_role
GRANT EXECUTE ON FUNCTION public.admin_update_game_state(TEXT, INTEGER, TEXT, TEXT) TO service_role;

-- Instructions for the README:
COMMENT ON FUNCTION public.auto_update_game_states IS 'Automatically transitions game states based on configured durations. Runs on a schedule.';
COMMENT ON FUNCTION public.admin_update_game_state IS 'Admin-only function to manually update game state. Requires API key.'; 