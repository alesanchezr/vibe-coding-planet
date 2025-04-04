# Building with Clicks Implementation Plan

## Overview
This plan outlines how to implement the "clicker" functionality for buildable objects like rockets. Players can click on buildable objects to contribute to their construction, with visual feedback and progress tracking. Each game has a time limit of 6 minutes, after which a tie is declared if no planet has completed their rocket.

## Database Structure
Use the "game_log" table in Supabase (renamed from "Game") with columns:
- Game Number (incremental)
- Planet name
- Player Session Id
- Player clicks
- Last_update
- Created_at
- has_won (boolean to track winning players)

## Step 1: Enhance Buildable Object Class
1. Create or modify the Buildable class to track construction progress with the following properties:
   - Type (rocket, etc.)
   - Current state (0-4 for construction stages)
   - Current click count
   - Clicks needed per state (default 720)
   - Total clicks needed (clicks per state × 4)
   - Planet name
   - Methods for handling clicks and updating state

**Testing**: Open the browser console and manually create a new Buildable instance. Call the addClick method multiple times and verify that currentState updates correctly at the appropriate thresholds.

## Step 2: Create Progress Bar Visualization
1. Add a visual progress bar above buildable objects that shows:
   - Background bar (dark color)
   - Progress indicator (green/color-coded)
   - Proper positioning above the object
   - Visual updates when progress changes

**Testing**: Click on a buildable object and observe if the progress bar appears above it. Continue clicking and verify the progress bar fills proportionally to the number of clicks.

## Step 3: Enhance Click Handler
1. Modify the click handler in Game.js to:
   - Find the clicked buildable object
   - Check if the player is allowed to interact with it
   - Add the click to the object's counter
   - Show visual feedback
   - Save the click to the database
   - Check for completion

**Testing**: Log in as a player assigned to a planet, focus on that planet, and click on a buildable object. Verify in the console logs that clicks are being registered and the proper functions are being called.

## Step 4: Create Click Visual Effect
1. Add a "+1" visual effect that:
   - Appears at the click position
   - Animates upward
   - Fades out over time
   - Cleans up after animation completes

**Testing**: Click on a buildable object and verify that a "+1" indicator appears, floats upward, and fades away. Try clicking multiple times in different spots to ensure effects appear at click locations.

## Step 5: Game Timer Implementation
1. Add a game timer system with:
   - 6-minute countdown for the active game phase
   - Visual countdown timer displayed prominently
   - Function to handle game end when time expires
   - 2-minute cooldown timer between games
   - Server synchronization for accurate timing

**Testing**: Start a new game and verify the 6-minute timer counts down correctly. Let the timer expire and confirm that clicking is disabled and the tie condition is properly handled.

## Step 6: Game Queue Management
6.1. Create a GameQueue table in Supabase with the following columns:
   - id (primary key)
   - cooldown_duration (in seconds)
   - waiting_duration (in seconds)
   - active_duration (in seconds)
   - started_at (timestamp)
   - ended_at (timestamp)
   - winner_planet (string, null if tied)
   - assignation_algo (enum: 'roundrobin', 'random', 'free')
   - current_state (enum: 'waiting_for_players', 'active', 'cooldown', 'victory', 'ended')

6.2. Create a Vercel API endpoint for automated game state management:
   - Create `/api/updateGameState.js` endpoint that:
     - Checks current game state in Supabase
     - Calculates if state transitions are needed based on elapsed time
     - Updates game state when transitions are required
     - Creates a new game automatically when cooldown ends
     - Uses Supabase service role key for secure access

6.3. Set up Vercel cron job:
   - Configure `vercel.json` with a cron job that runs every minute
   - Schedule the cron job to call the `/api/updateGameState` endpoint
   - Ensure proper authentication using environment variables

6.4. Implement game state synchronization using Supabase's real-time functionality:
   - Subscribe to changes in the GameQueue table
   - Update local game state based on server state
   - Ensure timer synchronization across all clients
   - Handle player reconnections by fetching current game state

6.5. Implement state change event handlers:
   - Waiting → Active: Automatically after waiting period expires
   - Active → Ended: When time expires
   - Active → Victory: When a rocket completes
   - Victory → Cooldown: Immediately after victory is declared
   - Cooldown → Ended + New Game: When cooldown timer expires

**Testing**: Open multiple browser windows and verify that game state changes are synchronized across all clients. Test reconnection by refreshing a browser during an active game and confirming it rejoins with the correct game state and timer. Verify that state transitions occur automatically without manual intervention.

## Step 7: Database Integration
1. Implement database interaction to:
   - Save each click with the player's ID and planet to the game_log table
   - Update the last_update timestamp
   - Associate clicks with the specific buildable type
   - Handle conflicts appropriately
   - Update has_won column when a game concludes

**Testing**: Click on a buildable object, then check the Supabase table data (through the Supabase dashboard) to confirm your clicks are being recorded with correct player ID, planet name, and timestamps.

## Step 8: Subscribe to Real-time Updates
1. Set up real-time subscription to the game_log table that:
   - Listens for all changes to click data
   - Updates the appropriate buildable object when data changes
   - Updates progress bars and visual state accordingly
   - Syncs game timer state across all clients

**Testing**: Open two browser windows with different player accounts. Make clicks in one window and verify that the progress updates in real-time in the other window without refreshing. Also verify timer synchronization.

## Step 9: Visual State Changes
1. Create different visual appearances for each state (0-4) of buildable objects:
   - State 0: Base structure
   - State 1: Additional components
   - State 2: Engines
   - State 3: Fins and details
   - State 4: Complete and ready for launch

**Testing**: Use a debug command to quickly increase clicks to each threshold and observe the visual changes to the buildable object at each state. Verify all 5 states display correctly.

## Step 10: Victory and Tie Conditions
1. Implement the victory sequence for when a rocket is completed:
   - Freeze game physics and controls
   - Animate the rocket orbiting its planet
   - Animate the rocket flying to the enemy planet
   - Create explosion effect on the enemy planet
   - Show victory screen with the winning planet
   - Update has_won column for players on winning planet
   - Update GameQueue state to 'victory' with winner_planet set

2. Implement tie condition when time expires:
   - Freeze game physics and controls
   - Display tie announcement
   - Show statistics from both planets
   - Update database with game end status (no winners)
   - Let the Vercel cron job handle transition to cooldown

**Testing**: 
- For victory: Use a debug command to set a rocket to nearly complete (state 3 with almost enough clicks for state 4). Add the final clicks and verify the full victory sequence plays correctly.
- For tie: Debug-accelerate the timer to near completion and verify the tie handling works correctly when time expires.

## Step 11: Between-Game Cooldown
1. Implement the between-game cooldown:
   - 2-minute countdown timer after game ends (managed by the Vercel cron job)
   - Display of previous game results during cooldown
   - Reset of all game objects and states
   - Clear indication of when the next game will start

**Testing**: After a game ends (either by victory or time expiry), verify the 2-minute cooldown begins and displays correctly. Confirm that a new game properly initializes automatically after the cooldown period.

## Step 12: Testing and Debugging
1. Create tools for testing:
   - Debug panel with click simulation buttons
   - Visual indicators for current state and click counts
   - Method to reset progress for testing
   - Error logging for database interactions
   - Timer acceleration for testing end-game conditions
   - Vercel deployment logs for monitoring cron job execution

**Testing**: Use the debug panel to simulate various scenarios (partial completion, quick completion, time expiry) and verify all game states transition properly without errors. Check Vercel logs to verify the cron job is running correctly.

## Step 13: Optimization and Polish
1. Finalize the implementation with:
   - Performance optimizations for many simultaneous players
   - Sound effects for clicks and state changes
   - Animation optimizations for lower-end devices
   - Visual polish to progress bar and click effects
   - CSS styling for the victory/tie screens
   - Timer visibility and audio cues for final countdown
   - Robust error handling for API endpoint and network failures

**Testing**: Have multiple players (5+) simultaneously click on buildable objects and verify the game maintains good performance. Test on both high-end and low-end devices to ensure smooth animations and transitions. Validate that game state transitions are reliable even under network stress. 