import { createClient } from '@supabase/supabase-js';

// This function will be called by Vercel Cron every minute
export default async function handler(req, res) {
  try {
    console.log('Game state update triggered at:', new Date().toISOString());
    
    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the current active game
    const { data: currentGame, error: fetchError } = await supabase
      .from('game_queue')
      .select('*')
      .not('current_state', 'eq', 'ended')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Error fetching current game: ${fetchError.message}`);
    }

    if (!currentGame) {
      console.log('No active game found, creating a new one');
      const now = new Date();
      
      // Create a new game if none exists - with explicit started_at
      const { data: newGame, error: createError } = await supabase.rpc('create_new_game', {
        p_cooldown_duration: 120,
        p_waiting_duration: 60,
        p_active_duration: 360,
        p_assignation_algo: 'roundrobin'
      });

      if (createError) {
        throw new Error(`Error creating new game: ${createError.message}`);
      }
      
      // Explicitly set started_at for the new game
      if (newGame && newGame.id) {
        const { error: updateError } = await supabase
          .from('game_queue')
          .update({ started_at: now })
          .eq('id', newGame.id);
          
        if (updateError) {
          console.error('Error setting started_at timestamp:', updateError);
        } else {
          console.log('Set started_at timestamp for new game:', now.toISOString());
          newGame.started_at = now;
        }
      }

      return res.status(200).json({ 
        success: true, 
        message: 'New game created',
        game: newGame
      });
    }

    console.log('Current game found:', currentGame);
    
    // Calculate state transitions based on durations
    const now = new Date();
    const currentState = currentGame.current_state;
    let newState = currentState;
    let updateData = {};
    let shouldCreateNewGame = false;

    // Check if started_at is missing but should exist - fix it
    if (!currentGame.started_at && (currentState === 'waiting_for_players' || currentState === 'active')) {
      updateData.started_at = now;
      console.log('Setting missing started_at timestamp');
    }

    // Handle state transitions based on the current state
    switch (currentState) {
      case 'waiting_for_players':
        const waitingSince = new Date(currentGame.started_at || currentGame.created_at);
        const waitingDuration = currentGame.waiting_duration * 1000; // convert to ms
        
        if (now - waitingSince >= waitingDuration) {
          newState = 'active';
          updateData.current_state = newState;
          // Don't overwrite started_at if it exists since we're continuing the same game
          if (!currentGame.started_at) {
            updateData.started_at = now;
          }
          console.log('Transitioning to active state');
        }
        break;
        
      case 'active':
        const activeSince = new Date(currentGame.started_at || currentGame.created_at);
        const activeDuration = currentGame.active_duration * 1000; // convert to ms
        
        if (now - activeSince >= activeDuration) {
          newState = 'ended';
          updateData.current_state = newState;
          updateData.ended_at = now;
          console.log('Transitioning to ended state (time expired)');
        }
        break;
        
      case 'cooldown':
        // Check for missing ended_at timestamp
        if (!currentGame.ended_at) {
          updateData.ended_at = now;
          console.log('Setting missing ended_at timestamp');
        }
        
        const cooldownSince = new Date(currentGame.ended_at || now);
        const cooldownDuration = currentGame.cooldown_duration * 1000; // convert to ms
        
        if (now - cooldownSince >= cooldownDuration) {
          newState = 'ended';
          updateData.current_state = newState;
          shouldCreateNewGame = true;
          console.log('Cooldown period ended, transitioning to ended state');
        }
        break;
        
      case 'victory':
        // Victory should quickly transition to cooldown
        newState = 'cooldown';
        updateData.current_state = newState;
        updateData.ended_at = now;
        console.log('Transitioning from victory to cooldown');
        break;
    }

    // Update the game state if needed
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('game_queue')
        .update(updateData)
        .eq('id', currentGame.id);

      if (updateError) {
        throw new Error(`Error updating game state: ${updateError.message}`);
      }
      
      console.log(`Game ${currentGame.id} updated: ${currentState} -> ${newState}`);

      // Create a new game if needed (after cooldown)
      if (shouldCreateNewGame) {
        const { data: newGame, error: createError } = await supabase.rpc('create_new_game', {
          p_cooldown_duration: currentGame.cooldown_duration,
          p_waiting_duration: currentGame.waiting_duration,
          p_active_duration: currentGame.active_duration,
          p_assignation_algo: currentGame.assignation_algo
        });

        if (createError) {
          throw new Error(`Error creating new game: ${createError.message}`);
        }
        
        // Explicitly set started_at for the new game
        if (newGame && newGame.id) {
          const { error: updateError } = await supabase
            .from('game_queue')
            .update({ started_at: now })
            .eq('id', newGame.id);
            
          if (updateError) {
            console.error('Error setting started_at timestamp for new game:', updateError);
          } else {
            console.log('Set started_at timestamp for new game:', now.toISOString());
            newGame.started_at = now;
          }
        }
        
        console.log('New game created after cooldown', newGame);
      }
    } else {
      console.log(`No state change needed for game ${currentGame.id} (${currentState})`);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Game state checked',
      stateChanged: Object.keys(updateData).length > 0,
      game: currentGame,
      newState: newState !== currentState ? newState : undefined
    });
  } catch (error) {
    console.error('Error in game state update:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
} 