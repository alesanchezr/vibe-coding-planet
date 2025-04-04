import { authManager } from './auth-manager.js';
import { playerManager } from './player-manager.js';
import { gameQueueManager } from './game-queue-manager.js';
import RealtimeManager from './realtime-manager.js';

/**
 * Threshold for considering a user inactive (5 minutes in milliseconds)
 * @type {number}
 */
export const INACTIVE_THRESHOLD = 5 * 60 * 1000;

/**
 * NetworkManager - Central class for coordinating all network operations
 * 
 * This class serves as an orchestrator for:
 * - Authentication and session management
 * - Player data assignment and synchronization
 * - Position interpolation for networked entities
 * - Event-based data propagation
 * - Game state synchronization
 */
class NetworkManager {
  /**
   * Create a new NetworkManager instance
   * @constructor
   */
  constructor() {
    // Store references to other network managers
    this.authManager = authManager;
    this.playerManager = playerManager;
    this.gameQueueManager = gameQueueManager;
    this.realtimeManager = null; // Will be implemented later
    
    // Internal state
    this.isInitialized = false;
    this.events = {
      onPlayersUpdated: [],
      onPlayerJoined: [],
      onPlayerLeft: [],
      onPositionUpdated: [],
      onConnectionStateChanged: [],
      onGameStateChanged: []
    };
    
    // Position buffer for interpolation (playerId -> array of timestamped positions)
    this.positionBuffer = {};
    
    // Maximum entries per player in position buffer
    this.maxBufferSize = 10;
    
    // Network settings
    this.interpolationDelay = 100; // ms of delay for smoother interpolation
    
    // Store the last known authoritative position from the server for each player
    this.lastServerPositions = {};
    
    // Connection state
    this.isConnected = false;
    this._reconnectAttempts = 0;
  }

  /**
   * Initialize the network manager and connect to services
   * @param {Object} options - Initialization options
   * @param {boolean} [options.subscribeToAllPlanets=false] - Whether to subscribe to all planets
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize(options = {}) {
    try {
      console.log('Initializing NetworkManager...');
      
      // Initialize session via auth manager
      const session = await this.authManager.initializeSession();
      if (!session) {
        console.error('Failed to initialize session');
        return false;
      }
      
      // Initialize player manager
      await this.playerManager.initialize(session);
      
      // Initialize game queue manager
      await this.gameQueueManager.initialize();
      
      // Setup game state change handlers
      this._setupGameStateHandlers();
      
      // Set up heartbeat to keep session alive
      this._setupHeartbeat();
      
      // Calculate if the session is active (last activity < 5 min ago)
      const lastActivity = session.user.user_metadata?.last_activity;
      const now = Date.now();
      const isActive = lastActivity && ((now - lastActivity) < INACTIVE_THRESHOLD);
      console.log(now - lastActivity, INACTIVE_THRESHOLD);
      
      // Delete player if inactive
      if(!isActive) playerManager.deletePlayer();
      
      // Initialize realtime subscription if player is active and has a planet
      if (isActive) {
        if (options.subscribeToAllPlanets) {
          await this.initializeGlobalRealtimeSubscription();
        } else if (this.playerManager.currentPlanet) {
          await this._initializeRealtimeSubscription();
        }
      }
      
      this.isInitialized = true;
      this.isConnected = true;
      
      // Trigger event with session object and activity status
      this._triggerEvent('onConnectionStateChanged', { 
        isConnected: this.isConnected,
        session: session,
        isActive: isActive
      });
      
      console.log('NetworkManager initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize network manager:', error);
      this.isConnected = false;
      
      // Trigger event with null session on failure
      this._triggerEvent('onConnectionStateChanged', { 
        isConnected: false,
        session: null,
        isActive: false
      });
      
      return false;
    }
  }
  
  /**
   * Set up handlers for game state changes
   * @private
   */
  _setupGameStateHandlers() {
    // Set up callback for game state changes
    this.gameQueueManager.onGameStateChanged = (gameData) => {
      console.log('Game state changed:', gameData);
      
      // Trigger event for game state change
      this._triggerEvent('onGameStateChanged', gameData);
    };
    
    // Set up callback for new game creation
    this.gameQueueManager.onGameCreated = (gameData) => {
      console.log('New game created:', gameData);
      
      // Trigger event for game state change
      this._triggerEvent('onGameStateChanged', gameData);
    };
    
    // Set up callback for game end
    this.gameQueueManager.onGameEnded = (gameData) => {
      console.log('Game ended:', gameData);
      
      // Trigger event for game state change
      this._triggerEvent('onGameStateChanged', gameData);
    };
  }
  
  /**
   * Get the current game state
   * @returns {string|null} The current game state or null if no game
   */
  getCurrentGameState() {
    return this.gameQueueManager.getCurrentGameState();
  }
  
  /**
   * Get the remaining time for the current game phase
   * @returns {number} Remaining time in seconds
   */
  getRemainingTime() {
    return this.gameQueueManager.calculateRemainingTime();
  }
  
  /**
   * Start a new game with default settings
   * @returns {Promise<Object>} The created game
   */
  async startNewGame() {
    try {
      console.log('Starting new game...');
      
      const game = await this.gameQueueManager.createNewGame();
      
      return game;
    } catch (error) {
      console.error('Error starting new game:', error);
      throw error;
    }
  }
  
  /**
   * Trigger automatic game state transitions based on timers
   * NOTE: This should only be called by server processes, not clients
   * @returns {Promise<void>}
   */
  async triggerStateTransitions() {
    try {
      if (!this.gameQueueManager) {
        throw new Error('GameQueueManager not initialized');
      }
      
      console.log('Triggering automatic game state transitions...');
      
      await this.gameQueueManager.triggerStateTransitions();
    } catch (error) {
      console.error('Error triggering game state transitions:', error);
      throw error;
    }
  }
  
  /**
   * Join the game, assigning the current player to a planet
   * @returns {Promise<object>} Object containing the planet assignment and player status
   */
  async joinGame() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Update last active timestamp since this is an explicit user action
      await this.updateLastActive();
      
      // Join a planet using player manager
      const { planetName, color } = await this.playerManager.joinPlanet();
      
      // Initialize realtime subscription now that we have a planet
      await this._initializeRealtimeSubscription();
      
      // Notify any listeners with active status set to true
      this._triggerEvent('onPlayerJoined', this.authManager.getCurrentUserId(), {
        planetName,
        color
      });
      
      // Update connection state to show user is now active
      if (this.authManager.currentSession) {
        this._triggerEvent('onConnectionStateChanged', { 
          isConnected: this.isConnected,
          session: this.authManager.currentSession,
          isActive: true // User just joined, so they're definitely active
        });
      }
      
      return { planetName, color };
    } catch (error) {
      console.error('Error joining game:', error);
      throw error;
    }
  }
  
  /**
   * Calculate the distance between two positions
   * @param {Object} pos1 - First position {x, y, z}
   * @param {Object} pos2 - Second position {x, y, z}
   * @returns {number} Distance between positions
   * @private
   */
  _calculatePositionDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }

  /**
   * Process a position update from the server
   * @param {string} playerId - The player's ID
   * @param {Object} serverPosition - The position from the server {x, y, z}
   * @param {Object} playerData - Full player data from the server
   * @param {boolean} isTestPlayer - Whether this is a test player
   * @private
   */
  _processServerPositionUpdate(playerId, serverPosition, playerData, isTestPlayer) {
    // Skip processing if this is our own update
    if (playerId === this.authManager.getCurrentUserId()) {
      return;
    }

    // Get the current interpolated position for this player
    // Note: Using interpolated position might smooth out small discrepancies. 
    // If you need exact comparison against the game object's *current* physics state,
    // you might need to get that state directly from the Game class.
    const currentPosition = this.getInterpolatedPosition(playerId);
    
    // Calculate distance between current interpolated and server position
    const distance = this._calculatePositionDistance(currentPosition, serverPosition);
    
    // Log the position difference for debugging (consider adding a debug flag)
    // console.log(`Position update for ${isTestPlayer ? 'test' : ''} player ${playerId}:`, {
    //   currentPosition,
    //   serverPosition,
    //   distance: distance.toFixed(2)
    // });

    // Store the last known good position from the server
    this.lastServerPositions[playerId] = { ...serverPosition };

    // If the distance is significant (e.g., > 0.1 units), trigger a position update event
    // This allows the game logic to decide *how* to reconcile (e.g., snap, smooth move)
    if (distance > 0.1) { // Threshold can be adjusted
      console.log(`Significant position difference (${distance.toFixed(2)}) for player ${playerId}. Triggering update.`);
      this._triggerEvent('onPositionUpdated', playerId, serverPosition, isTestPlayer, playerData.planet_name);
    } else {
      // If the distance is small, we might not need to trigger a full reconciliation event.
      // We still store the server position, and interpolation handles minor smoothing.
      // console.log(`Minor position difference (${distance.toFixed(2)}) for player ${playerId}. Relying on interpolation.`);
    }
  }

  /**
   * Update the player's position
   * @param {string} playerId - The player's ID
   * @param {object} position - The position {x, y, z}
   */
  updatePlayerPosition(playerId, position) {
    // Store in position buffer with timestamp
    if (!this.positionBuffer[playerId]) {
      this.positionBuffer[playerId] = [];
    }
    
    // Add new position to buffer
    this.positionBuffer[playerId].push({
      position: { ...position },
      timestamp: Date.now()
    });
    
    // Trim buffer if it exceeds max size
    if (this.positionBuffer[playerId].length > this.maxBufferSize) {
      this.positionBuffer[playerId].shift();
    }
    
    // Trigger event for local subscribers (e.g., UI updates)
    // Avoid triggering the main 'onPositionUpdated' used for reconciliation here
    // this._triggerEvent('onLocalPositionUpdated', playerId, position); // Example: If needed
    
    // Send to realtime manager when available
    if (this.realtimeManager) {
      // This function name might need adjustment based on RealtimeManager's actual methods
      // Assuming RealtimeManager sends the position update to Supabase
      // this.realtimeManager.sendPosition(playerId, position); 
    }
  }
  
  /**
   * Get interpolated position for a player
   * @param {string} playerId - The player's ID
   * @returns {object|null} Interpolated position {x, y, z} or null if unavailable
   */
  getInterpolatedPosition(playerId) {
    if (!this.positionBuffer[playerId] || this.positionBuffer[playerId].length === 0) {
      return null;
    }
    
    // Calculate render time with interpolation delay
    const renderTime = Date.now() - this.interpolationDelay;
    const buffer = this.positionBuffer[playerId];
    
    // Find positions before and after renderTime
    let before = null;
    let after = null;
    
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i].timestamp <= renderTime) {
        before = buffer[i];
      } else {
        after = buffer[i];
        break;
      }
    }
    
    // If we don't have both points, return the closest one
    if (!before) return after ? after.position : null;
    if (!after) return before.position;
    
    // Interpolate between positions
    const t = (renderTime - before.timestamp) / (after.timestamp - before.timestamp);
    return {
      x: before.position.x + (after.position.x - before.position.x) * t,
      y: before.position.y + (after.position.y - before.position.y) * t,
      z: before.position.z + (after.position.z - before.position.z) * t
    };
  }
  
  /**
   * Update the last active timestamp for the current player
   * @returns {Promise<void>}
   */
  async updateLastActive() {
    try {
      // Update session activity in auth manager
      if (this.authManager.currentSession) {
        await this.authManager.updateSessionActivity(this.authManager.currentSession);
      }
      
      // Update player record in database
      await this.playerManager.updatePlayerActivity();
    } catch (error) {
      console.error('Error updating last active timestamp:', error);
    }
  }
  
  /**
   * Load all active players
   * @returns {Promise<Array>} Array of active player data
   */
  async loadActivePlayers() {
    return this.playerManager.loadPlayers();
  }
  
  /**
   * Get count of players per planet
   * @returns {Promise<object>} Object with counts for each planet
   */
  async getPlayerCounts() {
    const players = await this.playerManager.loadPlayers();
    
    // Group by planet
    const counts = {};
    
    for (const player of players) {
      const planetName = player.planet_name;
      counts[planetName] = (counts[planetName] || 0) + 1;
    }
    
    return counts;
  }
  
  /**
   * Set up a heartbeat to keep the connection alive
   * @private
   */
  _setupHeartbeat() {
    // Send heartbeat every minute to check connection without updating activity timestamp
    // setInterval(async () => {
    //   try {
    //     // Don't update last_activity timestamp during heartbeat
    //     // Just check if the session is still valid
    //   } catch (error) {
    //     console.error('Heartbeat failed:', error);
    //     this._scheduleReconnect();
    //   }
    // }, 60 * 1000);
  }
  
  /**
   * Schedule a reconnection attempt with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    // Implement exponential backoff logic
    const backoffTime = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
    this._reconnectAttempts++;
    
    setTimeout(async () => {
      try {
        // Attempt to reconnect
        await this.initialize();
        
        if (this.isConnected) {
          // Reset reconnect counter on success
          this._reconnectAttempts = 0;
        }
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        // Schedule next attempt
        this._scheduleReconnect();
      }
    }, backoffTime);
  }
  
  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {NetworkManager} this instance for chaining
   */
  on(event, callback) {
    if (this.events[event]) {
      this.events[event].push(callback);
    }
    return this;
  }
  
  /**
   * Unregister an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {NetworkManager} this instance for chaining
   */
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    return this;
  }
  
  /**
   * Destroy the current session and reset network state
   * @returns {Promise<void>}
   */
  async destroySession() {
    try {
      console.log('Destroying session...');
      
      // Clean up realtime subscription
      if (this.realtimeManager) {
        this.realtimeManager.cleanup();
        this.realtimeManager = null;
      }
      
      // Clean up game queue manager
      if (this.gameQueueManager) {
        this.gameQueueManager.cleanup();
      }
      
      // First destroy the session in auth manager
      await this.authManager.destroySession();
      
      // Reset network state
      this.isConnected = false;
      this.isInitialized = false;
      this._reconnectAttempts = 0;
      
      // Clear player data
      if (this.playerManager) {
        // Delete the player record from database
        await this.playerManager.deletePlayer();
      }
      
      // Reset position buffer
      this.positionBuffer = {};
      
      // Trigger connection state changed event
      this._triggerEvent('onConnectionStateChanged', {
        isConnected: false,
        session: null,
        isActive: false
      });
      
      console.log('Session destroyed and state reset');
    } catch (error) {
      console.error('Error destroying session:', error);
      throw error;
    }
  }
  
  /**
   * Trigger an event for all listeners
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   * @private
   */
  _triggerEvent(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  /**
   * Initialize realtime subscription for player position updates
   * @param {boolean} [allPlanets=false] - Whether to subscribe to all planets or just the current one
   * @returns {Promise<boolean>} Whether initialization was successful
   * @private
   */
  async _initializeRealtimeSubscription(allPlanets = false) {
    try {
      // Clean up existing subscription if there is one
      if (this.realtimeManager) {
        this.realtimeManager.cleanup();
      }
      
      // Create new realtime manager
      let planetName = null;
      
      if (!allPlanets) {
        // Only subscribe to current planet
        planetName = this.playerManager.currentPlanet;
        if (!planetName) {
          console.warn('Cannot initialize planet-specific subscription: No planet assigned');
          return false;
        }
        console.log(`Initializing realtime subscription for active users on planet ${planetName}`);
      } else {
        console.log('Initializing realtime subscription for active users on all planets');
      }
      
      // Create and initialize the realtime manager
      this.realtimeManager = new RealtimeManager(planetName);
      
      // Set up event handlers
      this.realtimeManager.onPositionUpdate = (playerId, position, playerData, isTestPlayer) => {
        // Process the server position update using the new logic
        this._processServerPositionUpdate(playerId, position, playerData, isTestPlayer);
      };

      this.realtimeManager.onPlayerJoined = (playerId, playerData, isTestPlayer) => {
        // Skip if it's the current player (already handled elsewhere)
        if (playerId === this.authManager.getCurrentUserId()) {
          return;
        }

        // Check if player is already known locally (could happen with reconnects)
        if (this.playerManager.players.some(p => p.session_id === playerId)) {
          console.log(`Player ${playerId} joined event received, but player already known.`);
          // Optionally update existing player data here
          return;
        }

        // Add player to local list managed by PlayerManager
        this.playerManager.players.push(playerData);

        // Log the event
        console.log(`NetworkManager received player joined: ${isTestPlayer ? 'Test Player' : 'Player'} ${playerId} on ${playerData.planet_name}`);

        // Trigger the NetworkManager's onPlayerJoined event for the game logic
        this._triggerEvent('onPlayerJoined', playerId, playerData, isTestPlayer);
      };
      
      this.realtimeManager.onSubscriptionError = (error) => {
        console.error('Realtime subscription error:', error);
        // Schedule reconnection if needed
        this._scheduleReconnect();
      };
      
      this.realtimeManager.onSubscriptionEvent = (type, data) => {
        console.log(`Realtime subscription event: ${type}`, data);
      };
      
      // Enable debug mode in development
      if (import.meta.env.DEV) {
        this.realtimeManager.setDebugMode(true);
      }
      
      // Initialize the subscription with current player ID
      const success = await this.realtimeManager.initialize(
        this.authManager.getCurrentUserId()
      );
      
      return success;
    } catch (error) {
      console.error('Failed to initialize realtime subscription:', error);
      return false;
    }
  }
  
  /**
   * Initialize realtime subscription for all planets
   * Only active users will be included in the subscription
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initializeGlobalRealtimeSubscription() {
    return this._initializeRealtimeSubscription(true);
  }

  /**
   * Update the player's position in the database and notify other players
   * @param {object} position - The position {x, y, z}
   * @returns {Promise<void>}
   */
  async updateCurrentPlayerPosition(position) {
    try {
      const playerId = this.authManager.getCurrentUserId();
      if (!playerId) return;
      
      // Update locally first
      this.updatePlayerPosition(playerId, position);
      
      // Update in database via player manager
      await this.playerManager.updatePlayerPosition(position);
    } catch (error) {
      console.error('Error updating current player position:', error);
    }
  }
}

// Create and export a singleton instance
export const networkManager = new NetworkManager(); 