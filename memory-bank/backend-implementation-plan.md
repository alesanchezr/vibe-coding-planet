# Backend Implementation Plan: Planet Clicker Wars with Supabase

## Overview

This document outlines the implementation steps for creating a multiplayer backend for Planet Clicker Wars using Supabase. The plan uses a two-tier approach: Supabase's Realtime Presence feature for active player tracking and database storage for persistent player data. This provides efficient real-time synchronization with minimal overhead while maintaining session continuity across browser reloads.

## Technologies

- **Supabase**: Backend-as-a-Service with PostgreSQL database
- **Supabase Auth**: For anonymous authentication with built-in localStorage persistence
- **Supabase Realtime**: For real-time player presence and state synchronization
- **Environment Variables**: For secure configuration management

---

## Implementation Steps

### 1. Supabase Project Setup

#### 1.1. Create Supabase Account
- Sign up for a Supabase account if you don't have one
- Verify your email address

**Test**: You should be able to log in to the Supabase dashboard at https://app.supabase.com

#### 1.2. Create New Supabase Project
- Create a new project with name "planet-clicker-wars"
- Choose a strong database password
- Select the region closest to your target audience

**Test**: After project creation, you should see the project API dashboard with your API URL and anon/public key

#### 1.3. Record API Credentials
- Copy the project URL and anon/public key
- Store these securely for use in your application

**Test**: Verify you can access the API using these credentials with a simple test request using curl or Postman

#### 1.4. Set Up Environment Variables
- Create a `.env` file in the root of your project
- Add Supabase API URL and anon/public key in the format:
  ```
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-public-key
  ```
- Add `.env` to your `.gitignore` file to prevent committing sensitive information
- Create a `.env.example` file with the same variables but without actual values for reference

**Test**: Verify your application can read the environment variables using `import.meta.env.VITE_SUPABASE_URL`

#### 1.5. Enable Realtime Features
- Go to Database settings
- Enable Realtime functionality for the Presence feature
- Make sure broadcast functionality is enabled 

**Test**: Check the Realtime logs to confirm the feature is active

#### 1.6. Configure CORS Settings
- Go to API settings
- Add your game's domain to the allowed origins
- Include localhost domains for development

**Test**: Make a test request from your development environment and check the network tab for CORS-related errors

### 2. Database Schema Setup (Tier 2: Persistent Data)

#### 2.1. Create Players Table
- Create a table to store persistent player data
- Include fields for: id, session_id, planet_name, color, timestamps
- This table will be the source of truth for planet assignment

**Test**: Use the Supabase Table Editor to insert a test record and verify you can query it

#### 2.2. Set Up RLS Policies for Players Table
- Create a policy allowing anyone to read all player records
- Create a policy allowing users to update only their own records

**Test**: Try to read all players (should succeed) and update another player's record (should fail)

#### 2.3. Create Database Functions
- Create function for updating player's last active timestamp
- Create function for retrieving players by planet

**Test**: Execute the functions directly in the SQL editor to verify they return expected results

> Note: We won't persist player positions to the database. Positions will only be tracked in realtime via the socket connection. This means players will lose their position if they reload the browser, but this approach is simpler and reduces database writes.

### 3. Authentication Implementation

#### 3.1. Enable Anonymous Auth
- Go to Authentication settings
- Enable anonymous sign-ins

**Test**: Use the Supabase JS client to perform an anonymous sign-in and verify you receive a valid session

#### 3.2. Create Anonymous User Sign-Up Flow
- Create a function to handle anonymous sign-up
- Include error handling for failed sign-ups
- Note: Session persistence is handled automatically by Supabase using localStorage
- Note: Use Supabase's generated user.id for session identification

**Test**: Execute the function and verify a new user record appears in the Auth users list

#### 3.3. Implement Session Recovery
- Create a function to attempt to recover an existing session using Supabase's built-in session management
- Query database for previously stored planet assignment
- Fall back to creating a new session if recovery fails
- Note: No need to implement custom session storage as Supabase handles this in localStorage
- Note: Use Supabase's user.id for player identification and database queries

**Test**: Sign in anonymously, close and reopen the browser, and verify the same session is recovered and the player is connected to the same planet

### 4. Realtime Presence Implementation (Tier 1: Active Players)

#### 4.1. Verify Supabase Client Setup
- Confirm the existing Supabase client in `supabase-client.js` is properly configured:
  - Check that environment variables are correctly loaded
  - Verify the client is using the singleton pattern
  - Ensure error handling is in place
  - Confirm automatic reconnection logic is implemented
- Add any missing error handling or reconnection logic if needed
- Document the client's configuration and usage

**Test**: 
1. Import the client in a test file
2. Verify connection status in browser console
3. Test reconnection by temporarily disabling network
4. Confirm no duplicate client instances are created

#### 4.2. Implement Channel Subscription
- Create a function to join a channel based on planet name (e.g., `planet:earth`)
- Set up event listeners for presence events (sync, join, leave)
- Handle multiple connections with the same session ID (for same user in multiple tabs)

**Test**: Join a channel and verify in the Supabase dashboard Realtime inspector that a connection is established

#### 4.3. Implement Presence State Tracking
- Create a function to track the client's presence
- Include all required player data in the presence payload (user_id, planet_name, color)
- Include the initial position in the presence payload (will be used on reconnect)
- Use session hash as the presence key

**Test**: Use the Supabase Realtime inspector to verify your client is in the presence state

#### 4.4. Implement Presence Leave Handling
- Create a handler for when players leave the channel
- Clean up any associated resources
- Use Presence's built-in timeout mechanism for disconnection detection

**Test**: Join from two browsers, then close one and verify the presence event is detected

#### 4.5. Set Up Presence Heartbeat
- Implement periodic presence updates (low frequency - ~0.2Hz)
- Set appropriate update interval (e.g., every 5 seconds)
- Include last active timestamp

**Test**: Monitor network traffic and verify regular presence updates at the expected interval

#### 4.6. Implement Position Broadcast System
- Create a function to broadcast position updates (high frequency - ~10Hz)
- Set up a regular interval for position broadcasts
- Include timestamp with each broadcast for interpolation

**Test**: Use multiple browser windows and verify that position broadcasts are received by other clients

### 5. Player State Management

#### 5.1. Create Player List State
- Initialize a data structure to track all players
- Update it based on presence state
- Convert presence state to array of players for game use

**Test**: Join with multiple clients and verify the player list is correctly maintained on each client

#### 5.2. Implement Player Add/Remove Handlers
- Create functions to handle player joining
- Create functions to handle player leaving
- Ensure proper cleanup of resources when players disconnect

**Test**: Connect and disconnect clients and verify the handlers fire appropriately

#### 5.3. Create Position Update Handler
- Create a function to process incoming position updates
- Store the updates in a buffer for interpolation
- Note that positions are not persisted to database, only tracked in memory

**Test**: Move in one client and verify position updates are received by other clients

#### 5.4. Create Position Buffer System
- Implement a buffer to store position updates with timestamps
- Include cleanup logic for old entries
- Limit buffer size to about 10 recent positions per player

**Test**: Verify the buffer size stays within limits even after many updates

#### 5.5. Implement Position Interpolation
- Create a function to interpolate between position updates
- Add to the game loop for smooth movement
- Fall back to most recent position if suitable points aren't available

**Test**: Introduce artificial network lag and verify movement still appears smooth

### 6. Game Integration

#### 6.1. Create Network Manager Class
- Create a class to encapsulate all network functionality
- Include methods for connection, sending, and receiving data
- Implement conflict resolution if same user connects from multiple tabs

**Test**: Instantiate the class and verify no errors occur

#### 6.2. Implement Backend Initialization
- Create a function to initialize all backend systems
- Call it during game startup
- Check for existing session before creating a new one

**Test**: Verify all systems initialize without errors

#### 6.3. Create Session Management System
- Implement functions for session creation and recovery
- Use Supabase's built-in session management (no need for custom storage)
- Generate a new session hash if none exists

**Test**: Test session persistence across page reloads

#### 6.4. Implement Planet Assignment System
- Create functions to assign players to planets
- Persist only planet assignment in the database (not positions)
- Reset player position to a default spawn point when joining a planet
- Query database for previous assignments on reconnect

**Test**: Assign a player to a planet and verify the assignment is maintained after page reload

#### 6.5. Create Player State Sync System
- Synchronize game state with network state
- Update visuals based on network data
- Handle the case where the last active client's position takes precedence

**Test**: Make changes in one client and verify they appear in another client

### 7. Optimization

#### 7.1. Implement Throttling for Position Updates
- Only send position updates when they've changed significantly
- Add a minimum distance threshold
- Use the hybrid update pattern: high-frequency positions (10Hz), low-frequency presence (0.2Hz)

**Test**: Monitor network traffic and verify updates are not sent when barely moving

#### 7.2. Add Client-Side Prediction
- Implement local prediction of movement
- Apply corrections from server when necessary

**Test**: Introduce artificial lag and verify movement remains responsive

#### 7.3. Optimize Data Payload Size
- Minimize data sent in each update
- Use compact representation for positions (array instead of object)
- Quantize position values to reduce data size

**Test**: Monitor network payload size before and after optimization

#### 7.4. Add Reconnection Handling
- Implement automatic reconnection on network failure
- Include exponential backoff for retries
- Resume from last known state on reconnection

**Test**: Simulate network interruption and verify the client reconnects automatically

#### 7.5. Implement Error Recovery
- Add error handling for all network operations
- Include user feedback for network issues
- Support graceful degradation when offline

**Test**: Force various error conditions and verify the system recovers gracefully

