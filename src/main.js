import './style.css'
import { Game } from './core/Game.js'
import { networkManager } from './network/network-manager.js'

/**
 * Planet Clicker Wars - Main Entry Point
 * A multiplayer physics-based clicker game where two planets compete
 * to build a rocket first and destroy the other planet.
 */

// Wait for DOM to be fully loaded before starting the game
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Initializing Planet Clicker Wars...')
    
    // Get UI elements
    const joinButton = document.getElementById('joinButton');
    const loadingIndicator = document.getElementById('loadingIndicator') || createLoadingIndicator();
    const connectionDot = document.getElementById('connectionDot');
    const connectionStatus = document.getElementById('connectionStatus');
    const userId = document.getElementById('userId');
    const destroySessionButton = document.getElementById('destroySession');
    
    // Initial UI state
    connectionDot.className = 'dot connecting';
    connectionStatus.textContent = 'Connecting...';
    userId.textContent = 'Initializing...';
    
    // Show loading indicator
    loadingIndicator.style.display = 'block';
    
    // Hide join button until connection is established
    if (joinButton) {
      joinButton.style.display = 'none';
    }
    
    // Set up destroy session button listener
    if (destroySessionButton) {
      destroySessionButton.addEventListener('click', async () => {
        try {
          console.log('Destroying session by user request');
          destroySessionButton.disabled = true;
          destroySessionButton.textContent = 'Destroying...';
          
          await networkManager.destroySession();
          
          // Reload the page to get a fresh state
          window.location.reload();
        } catch (error) {
          console.error('Failed to destroy session:', error);
          destroySessionButton.textContent = 'Destroy Failed';
          setTimeout(() => {
            destroySessionButton.disabled = false;
            destroySessionButton.textContent = 'Destroy Session';
          }, 3000);
        }
      });
    }
    
    // Set up connection status listener
    networkManager.on('onConnectionStateChanged', (connectionData) => {
      const { isConnected, session, isActive } = connectionData;
      
      console.log('Connection state changed:', connectionData);
      
      // Update connection indicators
      if (isConnected && isActive) {
        connectionDot.className = 'dot connected';
        connectionStatus.textContent = 'Ready to continue';
      } else if (isConnected && !isActive) {
        connectionDot.className = 'dot idle';
        connectionStatus.textContent = 'Ready to join';
      } else {
        connectionDot.className = 'dot disconnected';
        connectionStatus.textContent = 'Disconnected';
      }
      
      if (isConnected && session) {
        // Update user ID display
        userId.textContent = `User ID: ${session.user.id.slice(0, 8)}...`;
        
        // Update UI based on session data
        const planetName = session.user.user_metadata?.planet_name;
        const color = session.user.user_metadata?.color;
        
        // Update UI based on player assignment and activity
        if (isActive && planetName) {
            joinButton.textContent = `Re-enter ${planetName} atmosphere`;
        } else {
          joinButton.textContent = 'Join a planet mission';
        }
        
        // Hide loading indicator when connected
        loadingIndicator.style.display = 'none';
        joinButton.style.display = 'block';
      } else {
        // Not connected or no session
        userId.textContent = 'Not connected';
      }
    });
    
    // Set up player join listener
    networkManager.on('onPlayerJoined', (playerId, data) => {
      console.log(`Player joined: ${playerId}`, data);
      // The UI will be updated when the connection state changes
    });
    
    // Create the game instance
    const game = new Game();
    
    // Make game globally accessible for debugging in development
    if (process.env.NODE_ENV !== 'production') {
      window.game = game;
    }
    
    // Start network initialization (non-blocking)
    networkManager.initialize().catch(error => {
      console.error('Failed to initialize network manager:', error);
      // Update UI for error state
      connectionDot.className = 'dot disconnected';
      connectionStatus.textContent = 'Connection Failed';
      loadingIndicator.style.display = 'none';
      // Still show join button to allow retry
      if (joinButton) {
        joinButton.style.display = 'block';
        joinButton.textContent = 'Try Again';
      }
    });
    
  } catch (error) {
    console.error('Failed to initialize game:', error);
  }
});

// Helper function to create a loading indicator if it doesn't exist
function createLoadingIndicator() {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loadingIndicator';
  loadingDiv.textContent = 'Loading...';
  loadingDiv.style.position = 'absolute';
  loadingDiv.style.top = '50%';
  loadingDiv.style.left = '50%';
  loadingDiv.style.transform = 'translate(-50%, -50%)';
  loadingDiv.style.padding = '20px';
  loadingDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  loadingDiv.style.color = 'white';
  loadingDiv.style.borderRadius = '5px';
  loadingDiv.style.zIndex = '1000';
  document.body.appendChild(loadingDiv);
  return loadingDiv;
}
