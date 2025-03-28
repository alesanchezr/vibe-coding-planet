import { supabase } from './supabase-client.js';
import { authManager } from './auth-manager.js';
import { INACTIVE_THRESHOLD } from './network-manager.js';

/**
 * Player Manager - Handles user database operations and planet assignments
 * Follows the "fix-user-initialization" plan to provide consistent user data
 */
class PlayerManager {
  constructor() {
    this.players = [];
    this.currentPlanet = null;
    this.currentColor = null;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the player manager
   * - Load all active players from the database
   * - Setup cleanup for inactive players
   * @returns {Promise<void>}
   */
  async initialize(session=null) {
    try {
      console.log("Initializing player manager...");
      
      // Load all active players from database
      await this.loadPlayers();
      
      // Schedule cleanup of inactive players
      this.setupInactivePlayerCleanup();
      
      if(session) {
        // Set the current player to the session player
        this.currentPlanet = session.user.user_metadata.planet_name;
        this.currentColor = session.user.user_metadata.color;
      }

      this.isInitialized = true;
      console.log(`Player manager initialized successfully in ${this.currentPlanet}`);
    } catch (error) {
      console.error("Error initializing player manager:", error);
      throw error;
    }
  }
  
  /**
   * Load all active players from the database in a single efficient call
   * @param {string|null} cutoffTime - If null, returns all players. If undefined, uses inactivity threshold
   * @returns {Promise<Array>} The list of players
   */
  async loadPlayers(cutoffTime = undefined) {
    try {
      console.log("Loading players...");
      
      // Build the query
      let query = supabase
        .from('players')
        .select('*');
      
      // Only apply time filter if cutoffTime is not null
      if (cutoffTime !== null) {
        // If cutoffTime is undefined, use the inactivity threshold
        const timeFilter = cutoffTime || new Date(Date.now() - INACTIVE_THRESHOLD).toISOString();
        query = query.gt('last_active', timeFilter);
      }
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      this.players = data || [];
      console.log(`Loaded ${this.players.length} players${cutoffTime === null ? ' (including inactive)' : ' (active only)'}`);
      
      // Loop through players and add them to their respective planets
      await this.assignPlayersToTheirPlanets();
      
      return this.players;
    } catch (error) {
      console.error("Error loading players:", error);
      throw error;
    }
  }
  
  /**
   * Assign players to their planets in the game
   * @returns {Promise<void>}
   */
  async assignPlayersToTheirPlanets() {
    try {
      // Group players by planet
      const earthPlayers = this.players.filter(user => user.planet_name === 'earth');
      const marsPlayers = this.players.filter(user => user.planet_name === 'mars');
      
      console.log(`Assigning ${earthPlayers.length} players to Earth and ${marsPlayers.length} players to Mars`);
      
      // TODO: Add these players to the game's planet objects
      // This would typically integrate with your game engine
      // game.addPlayersToPlanet('earth', earthPlayers);
      // game.addPlayersToPlanet('mars', marsPlayers);
      
    } catch (error) {
      console.error("Error assigning players to planets:", error);
      throw error;
    }
  }
  
  /**
   * Setup a recurring job to clean up inactive players
   */
  setupInactivePlayerCleanup() {
    // Run cleanup at the same interval as our inactivity threshold
    setInterval(() => this.cleanInactivePlayers(), INACTIVE_THRESHOLD);
    
    // Also run cleanup immediately
    this.cleanInactivePlayers();
  }
  
  /**
   * Clean up inactive players from the database
   * @returns {Promise<void>}
   */
  async cleanInactivePlayers() {
    try {
      console.log("Cleaning up inactive players...");
      
      // Calculate the cutoff time using the same INACTIVE_THRESHOLD
      const cutoffTime = new Date(Date.now() - INACTIVE_THRESHOLD).toISOString();
      
      // Delete inactive players from the database
      const { error } = await supabase
        .from('players')
        .delete()
        .lt('last_active', cutoffTime);
      
      if (error) {
        throw error;
      }
      
      // Refresh the local player list
      await this.loadPlayers();
      
    } catch (error) {
      console.error("Error cleaning up inactive players:", error);
      // Don't throw, just log the error to prevent breaking the application
    }
  }
  
  /**
   * Set the initial state of the player based on session data
   * @param {string} planetName - The name of the planet
   * @param {string} color - The color of the player
   */
  setInitialState(planetName, color) {
    this.currentPlanet = planetName;
    this.currentColor = color;
  }
  
  /**
   * Create or update the current player in the database
   * @returns {Promise<Object>} The created or updated player
   */
  async saveCurrentPlayerToDatabase() {
    try {
      const playerId = authManager.getCurrentUserId()
      const planetName = this.currentPlanet;
      
      if (!playerId || !planetName) {
        throw new Error(`Cannot save player: missing playerId ${playerId} or planetName ${planetName}`);
      }
      
      const playerData = {
        session_id: playerId,
        planet_name: planetName,
        color: this.currentColor,
        last_active: new Date().toISOString()
      };
      console.log("Saving player to database", playerData);
      
      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from('players')
        .upsert(playerData)
        .select();
      
      if (error) {
        throw error;
      }
      
      console.log("Player saved to database", data[0]);
      
      // Refresh the local player list
      this.loadPlayers();
      
      return data[0];
    } catch (error) {
      console.error("Error saving player to database:", error);
      throw error;
    }
  }
  
  /**
   * Update the last activity time for the current player
   * @returns {Promise<Object>} The updated player
   */
  async updatePlayerActivity() {
    try {
      const playerId = authManager.getCurrentUserId();
      
      if (!playerId) {
        throw new Error("Cannot update activity: missing playerId");
      }
      
      const { data, error } = await supabase
        .from('players')
        .update({ last_active: new Date().toISOString() })
        .eq('session_id', playerId)
        .select();
      
      if (error) {
        throw error;
      }
      
      return data[0];
    } catch (error) {
      console.error("Error updating player activity:", error);
      throw error;
    }
  }
  
  /**
   * Join a random planet and assign a random color
   * @returns {Promise<Object>} The updated session with planet assignment
   */
  async joinPlanet() {
    try {
      // Determine which planet has fewer players
      const earthPlayers = this.players.filter(user => user.planet_name === 'earth');
      const marsPlayers = this.players.filter(user => user.planet_name === 'mars');
      
      // Assign to planet with fewer players, or randomly if equal
      let planetName;
      if (earthPlayers.length < marsPlayers.length) {
        planetName = 'earth';
      } else if (marsPlayers.length < earthPlayers.length) {
        planetName = 'mars';
      } else {
        // Equal players on both planets, assign randomly
        planetName = Math.random() < 0.5 ? 'earth' : 'mars';
      }
      
      console.log(`Assigning player to ${planetName}`);
      // Generate a random color
      const colors = [
        '#FF5252', '#FF4081', '#E040FB', '#7C4DFF',
        '#536DFE', '#448AFF', '#40C4FF', '#18FFFF',
        '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41',
        '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      this.currentPlanet = planetName;
      this.currentColor = color;
      
      // Update session with planet and color
      await authManager.assignPlanetToUser(planetName, color);
      
      // Save user to database
      const player = await this.saveCurrentPlayerToDatabase();
      
      return { planetName, color, player };
    } catch (error) {
      console.error("Error joining random planet:", error);
      throw error;
    }
  }
  
  /**
   * Get the total count of all players in the database
   * @returns {Promise<number>} The total number of players
   */
  async getTotalPlayerCount() {
    try {
      // Load all players without a time cutoff
      const { data, error } = await supabase
        .from('players')
        .select('*');
      
      if (error) {
        throw error;
      }
      
      return data?.length || 0;
    } catch (error) {
      console.error("Error getting total player count:", error);
      throw error;
    }
  }
  
  /**
   * Delete current player from the database
   * This is called when a player is detected as inactive
   * @returns {Promise<void>}
   */
  async deletePlayer() {
    try {
      const playerId = authManager.getCurrentUserId();
      
      if (!playerId) {
        console.warn("Cannot delete player: missing playerId");
        return;
      }
      
      console.log(`Deleting inactive player: ${playerId}`);
      
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('session_id', playerId);
      
      if (error) {
        throw error;
      }
      
      // Reset current player state
      this.currentPlanet = null;
      this.currentColor = null;
      
      // Refresh the local player list
      await this.loadPlayers();
      
      console.log(`Player ${playerId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting player:", error);
      // Don't throw, just log the error
    }
  }
}

// Create and export a singleton instance
export const playerManager = new PlayerManager(); 