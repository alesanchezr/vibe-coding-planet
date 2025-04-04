import { supabase } from './supabase-client.js';

/**
 * GameQueueManager - Handles game state synchronization using the GameQueue table
 * 
 * This class is responsible for:
 * - Subscribing to game state changes
 * - Tracking the current active game
 * - Handling transitions between game states
 * - Synchronizing game timers across clients
 */
class GameQueueManager {
  /**
   * Create a new GameQueueManager instance
   * @constructor
   */
  constructor() {
    // Current game data
    this.currentGame = null;
    
    // Subscription for real-time updates
    this.subscription = null;
    
    // Game state
    this.isSubscribed = false;
    
    // Event callbacks
    this.onGameStateChanged = null;
    this.onGameCreated = null;
    this.onGameEnded = null;
    
    // Debug mode
    this.debug = true;
  }
  
  /**
   * Log debug messages if debug mode is enabled
   * @param {...any} args - Arguments to log
   * @private
   */
  _logDebug(...args) {
    if (this.debug) {
      console.log('[GameQueueManager]', ...args);
    }
  }
  
  /**
   * Log error messages
   * @param {...any} args - Arguments to log
   * @private
   */
  _logError(...args) {
    console.error('[GameQueueManager]', ...args);
  }
  
  /**
   * Initialize the GameQueueManager and subscribe to game state changes
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      this._logDebug('Initializing GameQueueManager...');
      
      // Get the current game from the database
      await this.fetchCurrentGame();
      
      // Subscribe to game_queue changes
      await this.subscribeToGameQueue();
      
      this._logDebug('GameQueueManager initialized successfully');
      return true;
    } catch (error) {
      this._logError('Failed to initialize GameQueueManager:', error);
      return false;
    }
  }
  
  /**
   * Fetch the current active game from the database
   * @returns {Promise<Object|null>} The current game data
   */
  async fetchCurrentGame() {
    try {
      const { data, error } = await supabase.rpc('get_current_game');
      
      if (error) {
        throw error;
      }
      
      if (data) {
        this._logDebug('Current game fetched:', data);
        this.currentGame = data;
        return data;
      }
      
      this._logDebug('No active game found');
      return null;
    } catch (error) {
      this._logError('Error fetching current game:', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to game_queue changes
   * @returns {Promise<boolean>} Whether subscription was successful
   */
  async subscribeToGameQueue() {
    try {
      if (this.isSubscribed) {
        this._logDebug('Already subscribed to game_queue changes');
        return true;
      }
      
      this._logDebug('Subscribing to game_queue changes...');
      
      // Create handlers for different events
      const handleGameChange = (payload) => {
        try {
          this._handleGameChange(payload);
        } catch (error) {
          this._logError('Error handling game change:', error);
        }
      };
      
      const handleGameInsert = (payload) => {
        try {
          this._handleGameInsert(payload);
        } catch (error) {
          this._logError('Error handling game insert:', error);
        }
      };
      
      const handleSystemMessage = (message) => {
        try {
          this._logDebug('System message received:', message);
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
      
      // Create the subscription
      this.subscription = supabase
        .channel('game-queue')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_queue'
          },
          handleGameChange
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'game_queue'
          },
          handleGameInsert
        )
        .on('system', handleSystemMessage)
        .subscribe(handleSubscriptionStatus);
      
      return true;
    } catch (error) {
      this._logError('Error subscribing to game_queue changes:', error);
      return false;
    }
  }
  
  /**
   * Handle subscription status
   * @param {Object} status - Subscription status
   * @private
   */
  _handleSubscriptionStatus(status) {
    this._logDebug('Subscription status:', status);
    
    if (status === 'SUBSCRIBED') {
      this.isSubscribed = true;
    } else if (status === 'CHANNEL_ERROR') {
      this.isSubscribed = false;
      this._logError('Channel error!');
      
      // Try to resubscribe after a delay
      setTimeout(() => this.subscribeToGameQueue(), 5000);
    }
  }
  
  /**
   * Handle game change event
   * @param {Object} payload - Payload from Supabase
   * @private
   */
  _handleGameChange(payload) {
    const { new: newGame } = payload;
    
    this._logDebug('Game updated:', newGame);
    
    // Store the updated game
    this.currentGame = newGame;
    
    // Trigger callback if defined
    if (this.onGameStateChanged) {
      this.onGameStateChanged(newGame);
    }
    
    // Check for game ended
    if (newGame.current_state === 'ended' && this.onGameEnded) {
      this.onGameEnded(newGame);
    }
  }
  
  /**
   * Handle game insert event
   * @param {Object} payload - Payload from Supabase
   * @private
   */
  _handleGameInsert(payload) {
    const { new: newGame } = payload;
    
    this._logDebug('New game created:', newGame);
    
    // Store the new game
    this.currentGame = newGame;
    
    // Trigger callback if defined
    if (this.onGameCreated) {
      this.onGameCreated(newGame);
    }
  }
  
  /**
   * Create a new game in the database
   * @param {Object} options - Game options
   * @param {number} [options.cooldownDuration=120] - Cooldown duration in seconds
   * @param {number} [options.waitingDuration=60] - Waiting duration in seconds
   * @param {number} [options.activeDuration=360] - Active duration in seconds
   * @param {string} [options.assignationAlgo='roundrobin'] - Planet assignment algorithm
   * @returns {Promise<Object>} The created game
   */
  async createNewGame(options = {}) {
    try {
      const cooldownDuration = options.cooldownDuration || 120;
      const waitingDuration = options.waitingDuration || 60;
      const activeDuration = options.activeDuration || 360;
      const assignationAlgo = options.assignationAlgo || 'roundrobin';
      
      this._logDebug('Creating new game with options:', {
        cooldownDuration,
        waitingDuration,
        activeDuration,
        assignationAlgo
      });
      
      const { data, error } = await supabase.rpc('create_new_game', {
        p_cooldown_duration: cooldownDuration,
        p_waiting_duration: waitingDuration,
        p_active_duration: activeDuration,
        p_assignation_algo: assignationAlgo
      });
      
      if (error) {
        throw error;
      }
      
      this._logDebug('New game created:', data);
      this.currentGame = data;
      return data;
    } catch (error) {
      this._logError('Error creating new game:', error);
      throw error;
    }
  }
  
  /**
   * Trigger the database function to run automatic state transitions
   * This should only be used by server or admin processes, not clients
   * @returns {Promise<void>}
   */
  async triggerStateTransitions() {
    try {
      this._logDebug('Triggering automatic state transitions...');
      
      const { error } = await supabase.rpc('auto_update_game_states');
      
      if (error) {
        throw error;
      }
      
      // Refresh current game after transitions
      await this.fetchCurrentGame();
      
      this._logDebug('State transitions completed');
    } catch (error) {
      this._logError('Error triggering state transitions:', error);
      throw error;
    }
  }
  
  /**
   * Get the current game state
   * @returns {string|null} Current game state or null if no game
   */
  getCurrentGameState() {
    return this.currentGame ? this.currentGame.current_state : null;
  }
  
  /**
   * Calculate remaining time for the current game phase
   * @returns {number} Remaining time in seconds
   */
  calculateRemainingTime() {
    if (!this.currentGame) {
      return 0;
    }
    
    const now = new Date();
    const state = this.currentGame.current_state;
    
    // For waiting and active states, use started_at
    if (state === 'waiting_for_players' || state === 'active') {
      const startedAt = this.currentGame.started_at 
        ? new Date(this.currentGame.started_at) 
        : new Date(this.currentGame.created_at);
      
      const duration = state === 'waiting_for_players'
        ? this.currentGame.waiting_duration
        : this.currentGame.active_duration;
      
      const endTime = new Date(startedAt.getTime() + (duration * 1000));
      const remainingMs = endTime - now;
      
      return Math.max(0, Math.floor(remainingMs / 1000));
    }
    
    // For cooldown state, use ended_at
    if (state === 'cooldown') {
      const endedAt = new Date(this.currentGame.ended_at);
      const cooldownEndTime = new Date(endedAt.getTime() + (this.currentGame.cooldown_duration * 1000));
      const remainingMs = cooldownEndTime - now;
      
      return Math.max(0, Math.floor(remainingMs / 1000));
    }
    
    // For other states, return 0
    return 0;
  }
  
  /**
   * Clean up resources used by this object
   */
  cleanup() {
    this._logDebug('Cleaning up GameQueueManager...');
    
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    this.isSubscribed = false;
    this.currentGame = null;
  }
}

// Create and export a singleton instance
export const gameQueueManager = new GameQueueManager(); 