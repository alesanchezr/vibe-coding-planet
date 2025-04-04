# Game Queue System for Planet Clicker Wars

This document explains how to set up and use the Game Queue system for managing game states across clients in Planet Clicker Wars.

## Overview

The Game Queue system provides a synchronized game state management mechanism using Supabase's real-time functionality. It handles:

- Game state transitions (waiting, active, cooldown, victory, ended)
- Timers for each game phase
- Player assignment to planets
- Victory and tie conditions

## Step 1: Database Setup

1. Log in to the [Supabase Dashboard](https://app.supabase.com)
2. Navigate to your project
3. Go to the SQL Editor
4. Open and execute the `02_game_queue.sql` file in this directory
   - This will create the `game_queue` table, indexes, RLS policies, and helper functions
   - Note that some operations may require superuser access

## Step 2: Enable Real-time in Supabase Dashboard

Since enabling real-time can't be done directly via SQL, follow these steps:

1. In the Supabase Dashboard, go to **Database → Replication**
2. Find the `game_queue` table in the list
3. Enable real-time for this table
4. Set the real-time mode to **Send all changes**

## Step 3: Set up Vercel Cron Job for Game State Updates

We use a Vercel API endpoint with a cron job to update game states automatically:

1. Ensure the `/api/updateGameState.js` file is in your project
2. Add a `vercel.json` file to your project with the cron configuration
3. Set up environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: The service role key with admin access

The Vercel cron job runs every minute and:
- Checks the current game state
- Calculates if a state transition is needed based on elapsed time
- Updates the game state in the database
- Creates a new game when needed

## Step 4: Verify RLS Policies

1. Go to **Authentication → Policies**
2. Verify that the `game_queue` table has the following policies:
   - `Allow public read access to game_queue`
   - `Allow service role to update game_queue`

## Step 5: Configuration

The Game Queue system supports the following configurations:

- `cooldown_duration`: Duration in seconds for the cooldown phase (default: 120 seconds)
- `waiting_duration`: Duration in seconds for the waiting phase (default: 60 seconds)
- `active_duration`: Duration in seconds for the active game phase (default: 360 seconds)
- `assignation_algo`: Algorithm for assigning players to planets (default: 'roundrobin')

## Database Functions

The following functions are available for interacting with the Game Queue:

### `get_current_game()`

Returns the current active game as a JSON object, or null if no active game exists.

Example:
```sql
SELECT * FROM public.get_current_game();
```

### `create_new_game(cooldown_duration, waiting_duration, active_duration, assignation_algo)`

Creates a new game with the specified parameters and returns it as a JSON object.

Example:
```sql
SELECT * FROM public.create_new_game(120, 60, 360, 'roundrobin');
```

## Game State Update Logic

Game states are automatically updated by the Vercel API endpoint based on the following rules:

1. `waiting_for_players` → `active`: When waiting_duration seconds have passed since game creation
2. `active` → `ended`: When active_duration seconds have passed since game started
3. `victory` → `cooldown`: Immediately after a victory condition is met
4. `cooldown` → `ended` + new game: When cooldown_duration seconds have passed since game ended

The state update endpoint also handles creating a new game automatically when the current game's cooldown period ends.

## Integration with NetworkManager

The Game Queue system is integrated with the NetworkManager class, which provides methods for:

- Tracking the current game state
- Calculating remaining time for the current phase
- Creating new games
- Listening to game state changes

Example:
```javascript
// Get the current game state
const gameState = networkManager.getCurrentGameState();

// Get the remaining time for the current phase
const remainingTime = networkManager.getRemainingTime();

// Start a new game (admin only)
await networkManager.startNewGame();

// Listen for game state changes
networkManager.on('onGameStateChanged', (gameData) => {
  console.log('Game state changed:', gameData);
});
```

## Game State Flow

Game states transition automatically based on configured durations:

1. `waiting_for_players`: Initial state when a new game is created
   - Automatically transitions to `active` after `waiting_duration` seconds

2. `active`: Game is in progress
   - Automatically transitions to `ended` after `active_duration` seconds
   - Can transition to `victory` if one planet reaches the victory condition

3. `cooldown`: Short period before the next game
   - Automatically transitions to `ended` and creates a new game after `cooldown_duration` seconds

4. `victory`: Game ended with a winner
   - Automatically transitions to `cooldown` soon after

5. `ended`: Final state before a new game starts

## Automated State Transitions

Game states transition automatically based on configured durations. This ensures that all clients see the same game state at the same time. The automatic transitions are handled by:

1. A Vercel API endpoint (`/api/updateGameState.js`) that checks the current game state and elapsed time
2. A scheduled cron job that calls this endpoint every minute (configured in `vercel.json`)
3. The Vercel endpoint uses the Supabase service role key to make authorized updates to the database

## Troubleshooting

If game state synchronization is not working:

1. Check that real-time is enabled for the `game_queue` table in Supabase
2. Verify that RLS policies are correctly set up
3. Make sure the GameQueueManager is properly initialized in NetworkManager
4. Check that the Vercel cron job is running (check Vercel logs)
5. Verify the Supabase service role key has proper permissions
6. Check browser console for errors related to Supabase subscriptions 