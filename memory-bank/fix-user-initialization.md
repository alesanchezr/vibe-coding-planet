# User Initialization Fix Implementation Plan

## Problem Statement
We're experiencing too many bugs with anonymous user authentication, user creation, and synchronization. This plan outlines a simplified approach with clear steps.

## Target Flow
1. User loads page → load users from DB + create/retrieve session simultaneously
2. Present appropriate button based on session state
3. Update session and DB only when necessary

## Implementation Steps

### Phase 1: Session Management
1. **Session Creation/Retrieval Logic**
   - Implement logic to check for existing session on page load
   - Test: Load page in incognito mode, verify new session created with no planet
   - Test: Load page with existing session cookie, verify session retrieved correctly

2. **Inactive Session Cleanup**
   - Add function to detect and delete inactive sessions (no activity for 5+ minutes)
   - Update session retrieval to handle inactive sessions (delete and create new)
   - Test: Create session, wait 6 minutes, reload page, verify old session deleted and new one created

3. **Session Storage Optimization**
   - Ensure session data has minimal necessary fields (sessionId, active status, planet, last activity time)
   - Test: Examine session storage, confirm only essential data is stored

### Phase 2: User Database Integration
4. **Database User Loading**
   - Optimize PlayerManager to load all active users in one efficient call
   - Test: With multiple active users, verify all load correctly and appear in their respective planets

5. **Active Users Assignment**
   - Create function to loop through active users and add them to their assigned planes
   - Test: Verify users appear on correct planet visualizations after page load

6. **Inactive User Cleanup**
   - Add function to delete database entries for inactive sessions during cleanup
   - Test: Create user, let session expire, verify database no longer contains the user entry

### Phase 3: User Interface Updates
7. **Loading State Management**
   - Implement a loading state tracker that monitors both session and user loading processes
   - Add proper UI indicators during loading (spinner, progress bar, etc.)
   - Ensure all interactive UI elements are disabled during loading
   - Test: Verify loading indicators appear appropriately during initialization

8. **Synchronization Gate Implementation**
   - Create a synchronization mechanism that only allows UI to progress when both session and user data are fully loaded
   - Implement Promise.all or similar pattern to await both loading processes
   - Test: Artificially delay one loading process, verify UI remains in loading state

9. **Dynamic Button Implementation**
   - Add conditional rendering for "Join a mission" vs "Continue the X mission" buttons
   - Ensure buttons remain hidden until both session and all users are completely loaded
   - Test: New user sees "Join" button only after loading completes
   - Test: Returning user sees "Continue" button with correct planet name only after loading completes
   - Test: During loading, neither button should be visible or clickable

10. **New User Planet Assignment**
    - Implement "Join a mission" handler to assign random planet and avatar color
    - Test: Click "Join" button, verify session updated with planet and user saved to database

11. **Existing User Continuation**
    - Implement "Continue mission" handler to update last_active time in database
    - Test: Click "Continue" button, verify last_active time updates in database

### Phase 4: Error Prevention & Recovery
12. **Parallel Loading Coordination**
    - Implement proper promises/async handling for parallel database and session operations
    - Test: Verify UI updates correctly after both operations complete, regardless of timing

13. **Planet Persistence Enforcement**
    - Add validation to prevent users from switching assigned planets
    - Test: Attempt to access alternate planet URL directly, verify redirect to assigned planet

14. **Session Validation**
    - Add periodic session validation checks during user activity
    - Test: Simulate network interruption, verify session remains valid after reconnection

### Phase 5: Testing & Monitoring
15. **Comprehensive Test Suite**
    - Create automated tests for all user flows and edge cases
    - Test: Run test suite, verify all scenarios handled correctly

16. **Performance Monitoring**
    - Add analytics to track session creation/retrieval times and error rates
    - Test: Load app with different connection speeds, verify acceptable performance metrics

17. **User Flow Validation**
    - Conduct end-to-end testing of complete user journeys
    - Test: Follow complete flow from first visit through mission continuation, verify all steps work correctly

## Required Refactoring

### Functions to Delete
1. **`createAnonymousUser`** - Replace with a unified session management flow that only creates DB users when needed
2. **`checkUserExists`** - Redundant with the new session retrieval logic
3. **`joinRandomPlanet`** - Replace with more deterministic planet assignment in join mission flow
4. **`syncLocalUsers`** - Replace with clear DB-first approach rather than local-first
5. **`refreshUserList`** - Consolidate into the new optimized user loading function

### Functions to Reimplement
1. **`initializeSession`** - Rewrite to handle all session scenarios (new, inactive, active) in one place
2. **`loadUsers`** in PlayerManager - Reimplement to efficiently load all users in one call
3. **`addUserToPlanet`** - Rewrite to work with the new session-first approach
4. **`updateUserActivity`** - Reimplement to only update the DB when session status changes
5. **`cleanInactiveUsers`** - Consolidate cleanup logic for both sessions and DB entries

### Single Source of Truth Changes
1. **Session Management** - Session becomes the authoritative source for user state
   - Session must be established before DB operations
   - All user state changes flow through session first, then to DB
   - Implement proper locking/transaction mechanism for critical updates

2. **User Creation/Updates** 
   - Move all user creation logic to a single service
   - Implement idempotent operations (same operation performed multiple times has same effect as once)
   - Ensure user ID consistency between session and DB

3. **Data Flow Direction**
   - Change from bidirectional sync to unidirectional: Session → DB → UI
   - Eliminate race conditions by having clear state ownership
   - Implement proper loading states to prevent partial data display

## Success Criteria
- No duplicate users created
- No orphaned sessions
- Users always return to their assigned planet
- New users have smooth onboarding experience
- Inactive users properly cleaned up
- Performance impact minimal on initial page load
- UI elements only appear when data is fully loaded 