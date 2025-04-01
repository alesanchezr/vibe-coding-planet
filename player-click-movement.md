# Spherebot Movement Implementation Plan

## Overview
This document outlines the steps to implement spherebot movement around the planet in two scenarios:
1. Player-initiated movement via clicking on the planet surface
2. Server-updated position reconciliation

## Implementation Steps

### 1. Ray Casting for Planet Surface Detection ✅ DONE
**Implementation:** Created a ray casting system that detects the point on the planet surface where the player clicks. The ray originates from the camera and extends through the mouse click position into the scene.

**Completed Details:**
- Created `PlanetClickControls` class to handle ray casting and planet surface detection
- Implemented visual feedback with an animated marker (sphere, ring, and pin)
- Added coordination with planet rotation controls to prevent movement during planet dragging
- Distinguished between clicks and drags using movement thresholds (7px)
- Added time threshold (300ms) to prevent long presses from triggering movement
- Ensured click detection only works when camera is focused on the player's current planet
- Optimized database interaction by only saving destination positions instead of intermediate positions
- Added proper cleanup and initialization processes for event listeners

**Test:** Enter a planet's atmosphere so the camera is focused on it. Click on different parts of the planet surface and verify that a visual marker (pin, sphere, and animated ring) appears exactly at the clicked location. Test various angles and surface areas to confirm the ray casting is accurate across the entire visible surface.

### 2. Path Finding on Spherical Surface ✅ DONE
**Implementation:** Developed a path finding algorithm that calculates the shortest path between two points on a spherical surface, accounting for the curvature of the planet.

**Completed Details:**
- Created `SphericalPathFinder` class to handle geodesic (great circle) path calculation
- Implemented proper world-to-local space coordinate transformations for path visualization
- Added visualization with dashed line and glow effect to make paths easily visible
- Ensured paths stay on the planet surface using proper spherical mathematics
- Made paths properly follow planet rotation by attaching them as children
- Added debugging capabilities to verify path lengths and point counts
- Fixed common visual glitches with proper geometry handling and coordinate transformations
- Implemented reusable path creation methods that work from any two points on the planet
- Added intelligent filtering to distinguish between buildable elements (rockets) and planet surface
- Prevented movement path creation when clicking on or near rockets or other buildable elements
- Implemented separate click handling for buildable elements with visual feedback
- Fixed rocket positioning to ensure correct placement at planet poles on initial render
- Added proper rotation handling to make rockets follow planet rotation smoothly
- Implemented generic "buildable" concept for future extensibility (not just rockets)

**Test:** Place a spherebot at one location on the planet. Click a distant point and verify that a dashed line appears on the planet surface showing the calculated path. Confirm that this path follows the curvature of the planet (rather than going through it or taking an unnecessarily long route). Also test clicking on rockets and verify that no movement path is created and proper buildable-specific feedback appears instead.

### 3. Smooth Movement Animation ✅ DONE
**Implementation:** Create a movement animation system that smoothly moves the spherebot along the calculated path at a consistent speed. Include acceleration at the start and deceleration at the end for natural-looking movement.

**Completed Details:**
- Created `SphericalMovement` class to handle movement along paths
- Implemented speed calculations with acceleration and deceleration phases
- Added trail visualization to show the path behind moving objects
- Implemented core path following logic using interpolation between points
- Added event callbacks for movement start, progress, and completion
- Set up proper surface contact maintenance during movement
- Integrated movement system with click handling in the Game class
- Added movement start visual effects and sound feedback
- Implemented proper handling for stopping and transitioning to new paths when a new click happens
- Ensured physics body orientation follows planet curvature during movement
- Created a movement manager in the Game class to centralize movement control
- Set up proper movement updates in the game loop 

**Test:** Trigger movement by clicking on a distant point. Observe that the spherebot follows the previously visualized path, with smooth acceleration at the start and deceleration when approaching the destination. The movement should maintain consistent contact with the planet surface.

### 4. Click-to-Move Interaction ✅ DONE
**Implementation:** Connect the ray casting and path finding systems to user input, enabling players to click anywhere on the visible planet surface to initiate movement.

**Completed Details:**
- Integrated click detection with planet surface ray casting
- Connected path visualization to click events
- Added proper planet focus checks before allowing movement
- Implemented visual feedback for click events
- Added proper handling of clicks on buildable elements vs planet surface
- Ensured movement only starts when clicking on the player's current planet
- Added proper camera focus checks to prevent unwanted movements
- Implemented proper cleanup of previous paths when starting new movement

**Test:** Enter a planet's atmosphere, click on various points of the planet surface, and confirm that both the destination marker appears and the spherebot immediately begins moving along the visualized path. Try clicking on different terrain features and at various distances to ensure the interaction works consistently.

### 5. Movement Cancellation ✅ DONE
**Implementation:** Allow new movement commands to cancel and override previous movement. When a player clicks a new location while the spherebot is already moving, it should adjust its path to the new destination.

**Completed Details:**
- Implemented proper movement cancellation when new click occurs
- Added smooth transition to new path when movement is cancelled
- Ensured proper cleanup of previous path visualization
- Added proper handling of movement state during cancellation
- Implemented proper physics body state management during cancellation
- Added visual feedback for movement cancellation
- Ensured proper event handling during movement transitions

**Test:** Start a movement by clicking one location, then quickly click another before the spherebot reaches the first destination. Verify that the first path visualization disappears, a new path appears, and the spherebot smoothly transitions to following the new path without completing the first movement or abruptly changing position.

### 6. Server Position Data Processing
**Implementation:** Create a system to process incoming server updates that include the positions of all active players using Supabase real-time subscriptions on the existing players table.

**Implementation Steps:**
6.1. Set up Supabase real-time subscription: ✅ DONE
   - Enable real-time for the existing players table that already contains position_x, position_y, position_z columns
   - Verify row level security (RLS) policies allow read access to position data for all authenticated users
   - Configure the subscription to track only position-related column changes for efficiency
   - Create a channel that subscribes to the players table with a filter for the current planet

**Completed Details:**
- Enabled real-time functionality for the players table in Supabase
- Configured RLS policies to ensure proper access control for position data
- Set up subscription filtering to only track position-related changes
- Created and tested channel subscription with appropriate filters for the current planet
- Verified subscription works correctly with existing database structure

6.2. Create a real-time subscription handler: ✅ DONE
   - Implement a RealtimeManager class to handle position updates through Supabase channels
   - Filter updates to only process changes for players on the current planet
   - Add properly formatted method declarations with appropriate error handling
   - Implement reconnection logic with exponential backoff
   - Add detailed logging for subscription status changes

**Completed Details:**
- Created RealtimeManager class to centralize Supabase channel management
- Implemented planet-specific filtering to only process relevant player updates
- Added robust error handling with try/catch blocks and fallback mechanisms
- Implemented reconnection logic with exponential backoff to handle network issues
- Added comprehensive logging for subscription lifecycle events
- Created proper cleanup methods to handle component unmounting
- Added support for multiple simultaneous channel subscriptions
- Implemented proper event emission for position update notifications

6.3. Process position updates:
   - Compare each player's current position with their new expected position from the subscription
   - Calculate the distance between current and expected positions
   - Skip processing updates from the current player to avoid feedback loops
   - Store the last known good position for each player

6.4. Integrate test player functionality:
   - Modify the existing "Add Test Player" button to only create players in the database
   - Let the real-time subscription handle new player appearance automatically

6.5. Visual debugging system:
   - Add visual indicators (connecting lines) between current and expected positions
   - Make indicators fade out after a few seconds

6.6. Performance optimization:
   - **Throttling for position updates:** Limit position updates to 10 per second per player to reduce network traffic and processing load.
     - Test by enabling a debug option to show "update received" indicators and verify they appear at most 10 times per second
     - Check CPU/network usage in browser developer tools to confirm reduced load
     - Verify that movement still appears smooth despite fewer updates

   - **Position interpolation:** Smoothly transition between received position updates instead of teleporting players.
     - Test by intentionally slowing down update frequency and observing that movement remains fluid
     - Verify that even with network lag, player movements look natural without jerky transitions
     - Enable a debug option to show interpolation paths as faint trails behind moving players

   - **Object pooling for visual indicators:** Reuse visual objects instead of creating new ones to prevent performance hitches.
     - Test with a debug counter showing "active indicators" and "pool size"
     - Verify the counter doesn't continually increase as new indicators are needed
     - Confirm smooth framerates even when many indicators are active simultaneously
     - Check memory usage in browser developer tools to ensure it remains stable

   - Use a spatial indexing system to prioritize nearby players
   - Implement distance-based update frequency
   - Implement a priority queue for processing updates
   - Use binary encoding for position data
   - Add client-side prediction for responsive movement
   - Implement delta compression for smaller network packets
   - Use WebWorkers for position processing
   - Add network quality detection with adaptive update rates

**Test Steps:**
1. Open the game in two different browsers/tabs
2. Join the same planet in both instances
3. Move one player and observe the real-time updates in the other instance
4. Click "Add Test Player" and verify the test player appears in both instances automatically
5. Verify that visual indicators appear and accurately show position differences
6. Check that indicators update smoothly without performance issues
7. Verify that indicators properly clean up when no longer needed
8. Test network disconnection scenarios to ensure proper reconnection
9. Monitor console logs to verify proper update processing

**Expected Behavior:**
- When a player moves, other players should see visual indicators showing the position difference
- When a test player is added, it should appear in all connected clients automatically through the real-time channel
- Test players should be visually distinguishable from real players but follow the same movement rules
- Indicators should update in real-time as positions change
- The system should handle network issues gracefully with automatic reconnection
- Performance should remain smooth even with many simultaneous updates
- Visual indicators should be clear but not distracting
- Throttling should prevent overwhelming the network with too many updates

### 7. Distance Threshold Configuration
**Implementation:** Define a threshold distance that determines when a player is considered "far enough" from their expected position to trigger movement reconciliation.

**Test:** In the test environment, add a colored indicator (like a red glow) that appears on players when their position discrepancy exceeds the threshold. Simulate various discrepancy magnitudes and confirm that the indicator only appears when the distance exceeds the configured threshold. Check threshold behavior at different planet scales.

### 8. Automated Movement to Server Positions
**Implementation:** When a position discrepancy exceeds the threshold, automatically calculate a path and initiate movement to the new coordinates without user input.

**Test:** Force a server update with significant position changes. Observe that affected spherebots automatically display path visualizations and begin moving toward their updated positions. The paths should use the same visualization as player-clicked movement, but perhaps with a different color to distinguish server-initiated movement.

### 9. Movement Priority System
**Implementation:** Establish priority rules for when both user-initiated movement and server reconciliation movement might occur simultaneously. Server positions should typically take precedence.

**Test:** While a server reconciliation is in progress (visible by its distinct path color), click to initiate a player movement. Verify that the system responds according to priority rules – either by ignoring the click, showing a warning indicator, or canceling the server reconciliation in favor of the player command (depending on your implementation choice).

### 10. Visual Feedback for Movement
**Implementation:** Add visual indicators that show the destination point and possibly the path when movement is initiated, whether by click or server update.

**Test:** Trigger both types of movement and confirm that appropriate visual indicators appear – such as pulsing destination markers, progress indicators along the path, or different colored paths for different movement types. Verify these indicators are visible but not distracting during gameplay.

### 11. Movement Completion Events
**Implementation:** Create an event system that fires when movement is completed, allowing other game systems to react accordingly.

**Test:** Complete various movements and verify that visual/audio feedback occurs (such as a subtle particle effect, sound, or UI update). If other game systems should respond to movement completion, verify they activate appropriately (e.g., unlocking actions that are disabled during movement).

### 12. Error Handling for Invalid Movements
**Implementation:** Add robust error handling for cases where movement cannot be completed (obstacles, restricted areas, etc.).

**Test:** Attempt to move to invalid locations and verify that visual feedback appears (such as a red X at the clicked location, a warning message, or a "no-go" indicator). The spherebot should not attempt to move or should stop moving if an obstacle is encountered mid-path, with appropriate visual feedback explaining why.

## Integration Testing

After implementing all steps, perform these integrated tests:

1. **Multi-player Movement Test:** Have multiple players move around the same planet simultaneously. Verify that all path visualizations appear correctly without visual clutter, and that each spherebot follows its own path without interference.

2. **Edge Case Testing:** Test movement across planet seams, poles, and different terrain types. Verify that path visualizations and movement remain smooth even across these transition areas.

3. **Performance Testing:** Simulate many simultaneous movements with all visual indicators enabled. Confirm the frame rate remains acceptable and that path visualizations scale appropriately (perhaps showing simplified paths when many are visible at once). 