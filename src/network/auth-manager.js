import { supabase } from './supabase-client.js';
import { INACTIVE_THRESHOLD } from './network-manager.js';

/**
 * Auth Manager - Handles user authentication and session management
 * Follows the "fix-user-initialization" plan to provide a consistent session experience
 */
class AuthManager {
  constructor() {
    this.currentSession = null;
  }

  /**
   * Initialize or retrieve a session
   * Combined implementation for all session types (new, active, inactive)
   * @returns {Promise<Object>} The session object
   */
  async initializeSession() {
    try {
      console.log("Initializing session...");
      
      // First check if we have a current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log("Found existing session", session.user.id);
        
        // Check if session is inactive (no activity for 5+ minutes)
        const lastActivity = session.user.user_metadata?.last_activity;
        const now = new Date().getTime();
        
        if (lastActivity && (now - lastActivity) > INACTIVE_THRESHOLD) {
          console.log("Session is inactive, creating new session");
          
          // Sign out user and create new session
          await supabase.auth.signOut();
          return this.createNewSession();
        }
        
        this.currentSession = session;
        return session;
      } else {
        console.log("No existing session found, creating new session");
        return this.createNewSession();
      }
    } catch (error) {
      console.error("Error initializing session:", error);
      throw error;
    }
  }
  
  /**
   * Create a new anonymous session
   * @returns {Promise<Object>} The new session
   */
  async createNewSession() {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        throw error;
      }
      
      // Initialize session with required metadata
      await this.updateSessionMetadata(data.session, {
        last_activity: new Date().getTime()
      });
      
      this.currentSession = data.session;
      return data.session;
    } catch (error) {
      console.error("Error creating new session:", error);
      throw error;
    }
  }
  
  /**
   * Update the last activity time for the session
   * @param {Object} session - The session to update
   * @returns {Promise<Object>} The updated session
   */
  async updateSessionActivity(session) {
    try {
      const now = new Date().getTime();
      console.log("Updating session activity timestamp:", new Date(now).toISOString());
      return this.updateSessionMetadata(session, { last_activity: now });
    } catch (error) {
      console.error("Error updating session activity:", error);
      throw error;
    }
  }
  
  /**
   * Update session metadata
   * @param {Object} session - The session to update 
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object>} Updated session
   */
  async updateSessionMetadata(session, metadata) {
    try {
      // Merge new metadata with existing metadata
      const updatedMetadata = {
        ...session.user.user_metadata,
        ...metadata
      };
      
      const { data, error } = await supabase.auth.updateUser({
        data: updatedMetadata
      });
      
      if (error) {
        throw error;
      }
      
      // Update current session reference
      if (this.currentSession && this.currentSession.user.id === data.user.id) {
        this.currentSession = {
          ...this.currentSession,
          user: data.user
        };
      }
      
      return data.session;
    } catch (error) {
      console.error("Error updating session metadata:", error);
      throw error;
    }
  }
  
  /**
   * Assign a planet to the current user
   * @param {string} planetName - The name of the planet to assign
   * @param {string} color - The color to assign to the user
   * @returns {Promise<Object>} The updated session
   */
  async assignPlanetToUser(planetName, color) {
    console.log("Assigning planet to user:", planetName, color);
    try {
      if (!this.currentSession) {
        throw new Error("No active session");
      }
      
      return this.updateSessionMetadata(this.currentSession, {
        planet_name: planetName,
        color: color,
        last_activity: new Date().getTime()
      });
    } catch (error) {
      console.error("Error assigning planet to user:", error);
      throw error;
    }
  }
  
  /**
   * Check if there is an active session
   * @returns {boolean} True if there is an active session
   */
  hasActiveSession() {
    return !!this.currentSession;
  }
  
  /**
   * Get the current user ID
   * @returns {string|null} The current user ID or null if no session
   */
  getCurrentUserId() {
    return this.currentSession?.user?.id || null;
  }
  
  /**
   * Get the current user's planet
   * @returns {string|null} The current user's planet or null if not assigned
   */
  getCurrentUserPlanet() {
    return this.currentSession?.user?.user_metadata?.planet_name || null;
  }
  
  /**
   * Destroy the current session by signing out and clearing session data
   * @returns {Promise<void>}
   */
  async destroySession() {
    try {
      console.log("Destroying current session");
      
      // Sign out the user
      await supabase.auth.signOut();
      
      // Clear the current session
      this.currentSession = null;
      
      console.log("Session destroyed successfully");
    } catch (error) {
      console.error("Error destroying session:", error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const authManager = new AuthManager(); 