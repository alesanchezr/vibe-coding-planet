import { authManager } from './auth-manager.js';
import { playerManager } from './player-manager.js';

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
    this.realtimeManager = null; // Will be implemented later
    
    // Internal state
    this.isInitialized = false;
    this.events = {
      onPlayersUpdated: [],
      onPlayerJoined: [],
      onPlayerLeft: [],
      onPositionUpdated: [],
      onConnectionStateChanged: []
    };
    
    // Position buffer for interpolation (playerId -> array of timestamped positions)
    this.positionBuffer = {};
    
    // Maximum entries per player in position buffer
    this.maxBufferSize = 10;
    
    // Network settings
    this.interpolationDelay = 100; // ms of delay for smoother interpolation
    
    // Connection state
    this.isConnected = false;
    this._reconnectAttempts = 0;
  }

  /**
   * Initialize the network manager and connect to services
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
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
      
      // Set up heartbeat to keep session alive
      this._setupHeartbeat();
      
      this.isInitialized = true;
      this.isConnected = true;
      
      // Calculate if the session is active (last activity < 5 min ago)
      const lastActivity = session.user.user_metadata?.last_activity;
      const now = Date.now();
      const isActive = lastActivity && ((now - lastActivity) < INACTIVE_THRESHOLD);
      console.log(now - lastActivity, INACTIVE_THRESHOLD);
      
      // Trigger event with session object and activity status
      this._triggerEvent('onConnectionStateChanged', { 
        isConnected: this.isConnected,
        session: session,
        isActive: isActive
      });

      if(!isActive) playerManager.deletePlayer();
      
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
    
    // Trigger event for subscribers
    this._triggerEvent('onPositionUpdated', playerId, position);
    
    // Send to realtime manager when available
    if (this.realtimeManager) {
      this.realtimeManager.sendPosition(playerId, position);
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
}

// Create and export a singleton instance
export const networkManager = new NetworkManager(); 