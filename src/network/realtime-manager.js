import { supabase } from './supabase-client.js';
import { INACTIVE_THRESHOLD } from './network-manager.js';

/**
 * RealtimeManager - Handles real-time player position updates using Supabase subscriptions
 */
class RealtimeManager {
  /**
   * Create a new RealtimeManager instance
   * @param {string} [planetName=null] - Optional planet name for debugging purposes only, no longer used for filtering
   */
  constructor(planetName = null) {
    // Store the planet name for debugging only (no longer used for filtering)
    this.planetName = planetName;
    
    // Real-time subscription
    this.subscription = null;
    
    // Track the current user's ID to avoid processing own updates
    this.currentPlayerId = null;
    
    // Position buffer to store recent positions for each player
    this.positionBuffer = {};
    
    // Configuration
    this.throttleTime = 100; // Minimum time between processing updates for same player (ms)
    this.lastProcessedTime = {}; // Track when we last processed an update for each player
    
    // Debug mode
    this.debugMode = false;
    
    // Callback functions
    this.onPositionUpdate = null; // Called when a player's position is updated
    this.onPlayerJoined = null; // Called when a new player record is inserted
    this.onSubscriptionError = null; // Called when there's a subscription error
    this.onSubscriptionEvent = null; // Called for subscription status events (connect, disconnect)
  }
  
  /**
   * Log a debug message if debug mode is enabled
   * @param {...any} args - Arguments to log
   * @private
   */
  _logDebug(...args) {
    if (this.debugMode) {
      console.log('[RealtimeManager]', ...args);
    }
  }
  
  /**
   * Log an error message
   * @param {...any} args - Arguments to log
   * @private
   */
  _logError(...args) {
    console.error('[RealtimeManager]', ...args);
    
    // Log additional stack trace for debugging in development
    if (this.debugMode) {
      console.error(new Error().stack);
    }
  }
  
  /**
   * Verify Supabase is properly initialized
   * @private
   * @returns {boolean} True if Supabase is initialized
   */
  _verifySupabaseInitialization() {
    if (!supabase) {
      this._logError('Supabase client is not initialized');
      return false;
    }
    
    if (!supabase.channel) {
      this._logError('Supabase client does not have channel method. Check if you are using the correct version.');
      return false;
    }
    
    return true;
  }
  
  /**
   * Initialize the real-time subscription for player positions
   * @param {string} currentPlayerId - The current player's ID
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize(currentPlayerId) {
    try {
      // Enable debug mode in development environment
      if (import.meta.env.DEV) {
        this.debugMode = true;
      }
      
      // Verify Supabase is correctly initialized
      if (!this._verifySupabaseInitialization()) {
        this._logError('Failed to verify Supabase initialization');
        return false;
      }
      
      this.currentPlayerId = currentPlayerId;
      
      // Calculate cutoff time for active players (5 minutes ago)
      const activeTimeThreshold = new Date(Date.now() - INACTIVE_THRESHOLD).toISOString();
      
      // Create filter for active users only - no planet filtering
      let filter = `last_active=gt.${activeTimeThreshold}`;
      
      this._logDebug('Initializing real-time subscription for active users on all planets');
      
      // Bind the handler methods to preserve 'this' context
      const handlePositionChange = (payload) => {
        try {
          this._handlePositionChange(payload);
        } catch (error) {
          this._logError('Error handling position change:', error);
        }
      };
      
      const handlePlayerJoin = (payload) => {
        try {
          this._handlePlayerJoin(payload);
        } catch (error) {
          this._logError('Error handling player join:', error);
        }
      };
      
      const handleSystemMessage = (message) => {
        try {
          this._handleSystemMessage(message);
        } catch (error) {
          this._logError('Error handling system message:', error);
        }
      };
      
      const handleSubscriptionStatus = (status) => {
        try {
          this._handleSubscriptionStatus(status);
        } catch (error) {
          this._logError('Error handling subscription status:', error);
        }
      };
      
      // Create the channel with detailed debugging
      this._logDebug('Creating real-time channel with filter:', filter);
      
      // Create the channel config with proper filter syntax
      this.subscription = supabase
        .channel('player-positions')
        .on(
          'postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'players',
            filter: filter,
          },
          handlePositionChange
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'players',
            filter: filter, // Apply the same activity filter
          },
          handlePlayerJoin
        )
        .on('system', handleSystemMessage)
        .subscribe(handleSubscriptionStatus);
      
      this._logDebug('Real-time subscription initialized successfully with activity filter:', activeTimeThreshold);
      return true;
    } catch (error) {
      this._logError('Failed to initialize real-time subscription:', error);
      if (this.onSubscriptionError) {
        this.onSubscriptionError(error);
      }
      return false;
    }
  }
  
  /**
   * Clean up and remove the subscription
   */
  cleanup() {
    if (this.subscription) {
      this._logDebug('Cleaning up real-time subscription');
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    // Clear position buffers
    this.positionBuffer = {};
    this.lastProcessedTime = {};
  }
  
  /**
   * Handle a position change event from Supabase
   * @param {Object} payload - The subscription payload
   * @private
   */
  _handlePositionChange(payload) {
    // Extract player data
    const playerData = payload.new;
    const playerId = playerData.session_id;
    const planetName = playerData.planet_name;
    
    // Skip processing if this is our own update or if throttled
    if (!this._shouldProcessUpdate(playerId)) {
      return;
    }
    
    // Create a position object
    const position = {
      x: playerData.position_x,
      y: playerData.position_y,
      z: playerData.position_z
    };
    
    // Check if this is a test player (session ID starts with "fake_")
    const isTestPlayer = playerId.startsWith('fake_');
    
    this._logDebug(`Received position update for ${isTestPlayer ? 'test' : ''} player ${playerId} on planet ${planetName}:`, position);
    
    // Store in buffer for interpolation
    this._addPositionToBuffer(playerId, position);
    
    // Update last processed time
    this.lastProcessedTime[playerId] = Date.now();
    
    // Call the position update callback if set
    if (this.onPositionUpdate) {
      this.onPositionUpdate(playerId, position, playerData, isTestPlayer);
    }
  }
  
  /**
   * Handle a player join event (INSERT) from Supabase
   * @param {Object} payload - The subscription payload
   * @private
   */
  _handlePlayerJoin(payload) {
    // Extract player data
    const playerData = payload.new;
    const playerId = playerData.session_id;

    // Skip processing if this is our own join event
    if (playerId === this.currentPlayerId) {
      this._logDebug('Skipping own player join event');
      return;
    }

    // Check if this is a test player
    const isTestPlayer = playerId.startsWith('fake_');

    this._logDebug(`Received player join event for ${isTestPlayer ? 'test' : ''} player ${playerId} on planet ${playerData.planet_name}`);

    // Call the player joined callback if set
    if (this.onPlayerJoined) {
      this.onPlayerJoined(playerId, playerData, isTestPlayer);
    }
  }
  
  /**
   * Determine if we should process an update from this player
   * @param {string} playerId - The player ID
   * @returns {boolean} True if the update should be processed
   * @private
   */
  _shouldProcessUpdate(playerId) {
    // Skip if this is our own update
    if (playerId === this.currentPlayerId) {
      this._logDebug('Skipping own position update');
      return false;
    }
    
    // Check throttling
    const now = Date.now();
    const lastTime = this.lastProcessedTime[playerId] || 0;
    if (now - lastTime < this.throttleTime) {
      this._logDebug(`Throttling position update for player ${playerId}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Add a position to the buffer for a player
   * @param {string} playerId - The player ID
   * @param {Object} position - The position object {x, y, z}
   * @private
   */
  _addPositionToBuffer(playerId, position) {
    // Create buffer if it doesn't exist
    if (!this.positionBuffer[playerId]) {
      this.positionBuffer[playerId] = [];
    }
    
    // Add position with timestamp
    this.positionBuffer[playerId].push({
      position,
      timestamp: Date.now()
    });
    
    // Limit buffer size (keep last 10 positions)
    while (this.positionBuffer[playerId].length > 10) {
      this.positionBuffer[playerId].shift();
    }
  }
  
  /**
   * Handle a system message from the Supabase subscription
   * @param {Object} message - The system message
   * @private
   */
  _handleSystemMessage(message) {
    this._logDebug('Subscription system message:', message);
    
    // Forward to callback if set
    if (this.onSubscriptionEvent) {
      this.onSubscriptionEvent('system', message);
    }
  }
  
  /**
   * Handle subscription status changes
   * @param {string} status - The subscription status
   * @private
   */
  _handleSubscriptionStatus(status) {
    this._logDebug('Subscription status changed:', status);
    
    // Forward to callback if set
    if (this.onSubscriptionEvent) {
      this.onSubscriptionEvent('status', status);
    }
  }
  
  /**
   * Get interpolated position for a player
   * @param {string} playerId - The player ID
   * @returns {Object|null} The interpolated position {x, y, z} or null if not available
   */
  getInterpolatedPosition(playerId) {
    const buffer = this.positionBuffer[playerId];
    if (!buffer || buffer.length === 0) {
      return null;
    }
    
    // For simplicity, just return the most recent position
    // A more advanced implementation would interpolate between positions
    return buffer[buffer.length - 1].position;
  }
  
  /**
   * Set debug mode on/off
   * @param {boolean} enabled - Whether debug mode is enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
}

export default RealtimeManager; 