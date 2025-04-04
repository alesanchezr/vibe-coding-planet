import * as THREE from 'three';
import { SceneRenderer } from '../renderer/SceneRenderer.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PlanetGeometry } from '../terrain/PlanetGeometry.js';
import { PlanetSystem } from '../objects/PlanetSystem.js';
import { LightingSystem } from '../renderer/LightingSystem.js';
import { setupPerformanceMonitoring } from '../utils/performance.js';
import * as CANNON from 'cannon-es';
import { networkManager } from '../network/network-manager.js';
import { SphereBot } from '../objects/SphereBot.js';
import { PlanetClickControls } from '../controls/PlanetClickControls.js';
import { SphericalMovement } from '../physics/SphericalMovement.js';
import { SphericalPathFinder } from '../physics/SphericalPathFinder.js';
import { supabase } from '../network/supabase-client.js';
import gsap from 'gsap'; // Import GSAP
import { ProgressBar } from '../ui/ProgressBar.js'; // Import ProgressBar
import { ClickEffect } from '../ui/ClickEffect.js'; // Import ClickEffect
import { GameTimer } from './GameTimer.js';

// --- Zoom Constants ---
const MIN_ZOOM_DISTANCE = 15; // Minimum distance from planet center
const MAX_ZOOM_DISTANCE = 80; // Maximum distance from planet center
const ZOOM_SENSITIVITY = 0.001;
// --- End Zoom Constants ---

/**
 * Core Game class for Planet Clicker Wars
 * Handles initialization and main game loop
 * @class
 */
export class Game {
  /**
   * Create a new Game instance
   * @constructor
   */
  constructor() {
    // Create a clock for timing
    this.clock = new THREE.Clock();
    
    // Game objects array
    this.gameObjects = [];
    
    // Progress bars for buildable objects
    this.progressBars = new Map();
    
    // Click effects array
    this.clickEffects = [];
    
    // Particle effects array
    this.particleEffects = [];
    
    // Player tracking
    this.playerAssignments = [];
    this.playerCount = 0;
    this.playerBodies = {};
    
    // Track player contributions to each planet's rocket
    this.rocketContributions = {
      earth: new Map(), // Map of player ID to click count
      mars: new Map()   // Map of player ID to click count
    };
    
    // Game state
    this.gameState = 'waiting_for_players';
    this.buildingEnabled = false;
    
    // Back button listener state
    this._backButtonListenerAdded = false;

    // Initialize Three.js renderer and scene
    this.initRenderer();
    
    // Game constants
    this.FIXED_TIME_STEP = 1/60;
    
    // Initialize core systems
    this.initPhysics();
    
    // Initialize lighting system (step 17)
    this.initLighting();
    
    // Initialize planet system (step 16)
    this.initPlanetSystem();
    
    // Initialize game timer
    this.initGameTimer();
    
    // Initialize player structures dynamically based on planets
    this.playerBodies = {};
    this.planetSystem.getPlanetNames().forEach(planetName => {
      this.playerBodies[planetName] = [];
    });
    
    // Set up player system
    this.initPlayerInstancing();
    
    // Initialize movement and pathfinding systems
    this.initMovementSystem();
    this.initPathFinder();
    
    // Create test geometry for steps 14 and 15 (optional for final game)
    // this.createTestPlanetGeometries();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Add wheel listener specifically for zoom
    this.renderer.canvas.addEventListener('wheel', this._handleMouseWheel.bind(this), { passive: false });
    
    // Set up performance monitoring
    setupPerformanceMonitoring(this.renderer.renderer);
    
    // Initialize the game with a first render
    this.update();
    this.render();
    
    // Load active players - doing this after initial render
    this.initializePlayers();
    
    // Start the game loop
    this.animate();
    
    // Verify proper implementation
    this.verifyImplementation();
    
    console.log('Game initialized');
    
    // Planet interaction
    this.focusedPlanet = null;
  }

  /**
   * Initialize the renderer and scene
   * @private
   */
  initRenderer() {
    try {
      this.renderer = new SceneRenderer();
      this.scene = this.renderer.scene;
      this.camera = this.renderer.camera;
      
      // Adjust camera position to better view the planets
      this.camera.position.z = 50;
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
    }
  }

  /**
   * Initialize the physics world
   * @private
   */
  initPhysics() {
    try {
      this.physics = new PhysicsWorld();
      this.world = this.physics.world;
      
      // Create player-specific contact material to handle player-player collisions
      this.playerMaterial = new CANNON.Material('playerMaterial');
      const playerContactMaterial = new CANNON.ContactMaterial(
        this.playerMaterial,
        this.playerMaterial,
        {
          friction: 0.8,        // High friction between players
          restitution: 0.1,     // Low restitution (not bouncy)
          contactEquationStiffness: 1e6,
          contactEquationRelaxation: 3
        }
      );
      this.world.addContactMaterial(playerContactMaterial);
      
      // Player to default material (for planet collisions)
      const playerDefaultContactMaterial = new CANNON.ContactMaterial(
        this.playerMaterial,
        this.world.defaultMaterial,
        {
          friction: 0.5,
          restitution: 0.2,
          contactEquationStiffness: 1e6,
          contactEquationRelaxation: 3
        }
      );
      this.world.addContactMaterial(playerDefaultContactMaterial);
      
    } catch (error) {
      console.error('Failed to initialize physics:', error);
    }
  }
  
  /**
   * Initialize the lighting system
   * @private
   */
  initLighting() {
    // Create lighting system
    this.lightingSystem = new LightingSystem(this.scene);
    
    console.log('Lighting system initialized');
  }
  
  /**
   * Initialize the planet system with two planets
   * @private
   */
  initPlanetSystem() {
    try {
      this.planetSystem = new PlanetSystem(this.scene, this.world);
      
      // Add to game objects for updating
      this.gameObjects.push(this.planetSystem);
      
      // Create progress bars for existing rockets
      this.planetSystem.rockets.forEach(rocket => {
        this.createProgressBarForRocket(rocket);
      });

      // Position camera to view both planets
      this.positionCameraForPlanets();

      // Disable auto-rotation of planets on refresh
      this.disablePlanetAutoRotation();
      
      // Initialize click controls for planets
      this.initPlanetClickControls();
      
      // Make sure progress bars are hidden initially
      this.updateProgressBarsVisibility();
      
      console.log('Planet system added to game with fixed initial rotation');
    } catch (error) {
      console.error('Failed to initialize planet system:', error);
    }
  }
  
  /**
   * Initialize the game timer
   * @private
   */
  initGameTimer() {
    // Set up the timer with callbacks
    this.gameTimer = new GameTimer({
      gameDuration: 360, // 6 minutes
      cooldownDuration: 120, // 2 minutes
      onGameEnd: () => {
        console.log('Game time expired - starting cooldown');
        this.handleGameEnd();
      },
      onCooldownEnd: () => {
        console.log('Cooldown ended - resetting game');
        this.resetGame();
      }
    });
    
    // Set initial waiting status
    this.gameTimer.setWaitingStatus();
    
    console.log('Game timer initialized');
  }
  
  /**
   * Initialize the player instancing system
   * @private
   */
  initPlayerInstancing() {
    // With SphereBot, we no longer need instanced meshes
    // but we'll keep the playerBodies structure for planet assignment
    this.playerBodies = {};
    this.planetSystem.getPlanetNames().forEach(planetName => {
      this.playerBodies[planetName] = [];
    });
    
    console.log('Player structures initialized for all planets');
  }
  
  /**
   * Disable auto-rotation to ensure planets maintain fixed initial rotation
   * @private
   */
  disablePlanetAutoRotation() {
    // Disable auto-rotation for the rotation controls
    this.planetSystem.planetControls.forEach(control => {
      // Set auto-rotation speed to 0
      if (control.autoRotate) {
        control.autoRotate = false;
      }
      
      // Reset any rotation that might have happened
      if (control.planet && control.planet.mesh) {
        control.planet.mesh.rotation.set(0, 0, 0);
      }
    });
    
    console.log('Planet auto-rotation disabled for consistent orientation');
  }
  
  /**
   * Position camera to view both planets
   * @private
   */
  positionCameraForPlanets() {
    this.cameraStopFollowingPlanet();
  }
  
  /**
   * Position camera to view a specific planet
   * @param {Planet} planet - The planet to focus on
   * @private
   */
  cameraFollowPlanet(planet) {
    if (this.camera && planet) {
      // Position the camera to look at the planet from an angle
      // Scale camera offset based on the new planet size (radius 15)
      // Increase offset distance slightly to zoom out 20% (reverting previous zoom)
      const planetPos = planet.position;
      const offsetScale = 1.0; // Scale factor (15 / 15) remains 1.0
      const baseOffsetX = 5; // Reverted from 4
      const baseOffsetY = 20; // Reverted from 17
      const baseOffsetZ = 30; // Reverted from 25
      this.camera.position.set(
        planetPos.x + baseOffsetX * offsetScale, 
        planetPos.y + baseOffsetY * offsetScale, 
        planetPos.z + baseOffsetZ * offsetScale
      ); 
      this.camera.lookAt(planetPos);
      
      // Reset any lingering drag states in planet rotation controls
      if (this.planetSystem && this.planetSystem.planetControls) {
        this.planetSystem.planetControls.forEach(control => {
          if (control && typeof control.resetDragState === 'function') {
            control.resetDragState();
          }
        });
      }
      
      // Enable click controls only when focused on a planet
      if (this.planetClickControls) {
        this.planetClickControls.setEnabled(true);
      }
      
      // Move game timer to right side of screen
      const timerContainer = document.getElementById('gameTimerContainer');
      if (timerContainer) {
        timerContainer.style.left = 'auto';
        timerContainer.style.right = '20px';
        timerContainer.style.transform = 'none';
      }
      
      // Show "Back to outer space" button
      const backToSpaceButton = document.getElementById('backToSpaceButton');
      if (backToSpaceButton) {
        backToSpaceButton.style.display = 'block';
        
        // Add event listener if not already added
        if (!this._backButtonListenerAdded) {
          backToSpaceButton.addEventListener('click', () => this.cameraStopFollowingPlanet());
          this._backButtonListenerAdded = true;
        }
      }
      
      // Show player contributions leaderboard for this planet
      this.showPlayerContributions(planet.name);
      
      // Hide the planet indicators when focusing on a specific planet
      const planetIndicators = document.getElementById('planetIndicators');
      if (planetIndicators) {
        planetIndicators.style.display = 'none';
      }
      
      // Hide the join button when focused on a planet
      const joinButton = document.getElementById('joinButton');
      if (joinButton) {
        joinButton.style.display = 'none';
      }
      
      // Track which planet the camera is focused on
      this.focusedPlanet = planet.name;
      
      // Hide all planets except the focused one
      if (this.planetSystem && this.planetSystem.planets) {
        this.planetSystem.planets.forEach(p => {
          if (p.mesh) {
            p.mesh.visible = p.name === planet.name;
          }
        });
      }
      
      // Hide rockets and progress bars from other planets
      if (this.planetSystem && this.planetSystem.rockets) {
        this.planetSystem.rockets.forEach(rocket => {
          if (rocket && rocket.mesh) {
            rocket.mesh.visible = rocket.planetName === planet.name;
            
            // Also hide associated progress bar
            const progressBar = this.progressBars.get(rocket);
            if (progressBar) {
              if (rocket.planetName === planet.name) {
                progressBar.show();
              } else {
                progressBar.hide();
              }
            }
          }
        });
      }
      
      // Hide players from other planets
      this.playerAssignments.forEach(assignment => {
        if (assignment.sphereBot && assignment.sphereBot.mesh) {
          assignment.sphereBot.mesh.visible = assignment.planetName === planet.name;
        }
      });
      
      console.log('Camera positioned to view planet at:', planetPos);
    }
  }

  /**
   * Stop camera following a planet and return to showing all planets
   * @private
   */
  cameraStopFollowingPlanet() {
    if (this.camera) {
      // Remember which planet we were viewing
      const previousPlanet = this.focusedPlanet;
      
      // Reset camera to view both planets
      this.camera.position.set(0, 0, 48);
      this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      
      // Disable click controls when not focused on a single planet
      if (this.planetClickControls) {
        this.planetClickControls.setEnabled(false);
      }
      
      // Hide "Back to outer space" button
      const backToSpaceButton = document.getElementById('backToSpaceButton');
      if (backToSpaceButton) {
        backToSpaceButton.style.display = 'none';
      }
      
      // Hide player contributions panel
      const contributionsPanel = document.getElementById('playerContributions');
      if (contributionsPanel) {
        contributionsPanel.style.display = 'none';
      }
      
      // Show and update planet indicators with current player counts
      this.createAndUpdatePlanetIndicators();
      
      // Show "re-enter planet atmosphere" button if we were previously viewing a planet
      if (previousPlanet) {
        const joinButton = document.getElementById('joinButton');
        if (joinButton) {
          // Display a planet-specific message on the button
          joinButton.textContent = `Re-enter ${previousPlanet} atmosphere`;
          joinButton.style.display = 'block';
          
          // Store the planet name for later use
          joinButton.dataset.targetPlanet = previousPlanet;
        }
      }
      
      // Show all planets
      if (this.planetSystem && this.planetSystem.planets) {
        this.planetSystem.planets.forEach(p => {
          if (p.mesh) {
            p.mesh.visible = true;
          }
        });
      }
      
      // Show all rockets and progress bars
      if (this.planetSystem && this.planetSystem.rockets) {
        this.planetSystem.rockets.forEach(rocket => {
          if (rocket && rocket.mesh) {
            rocket.mesh.visible = true;
            
            // Also show associated progress bar
            const progressBar = this.progressBars.get(rocket);
            if (progressBar) {
              progressBar.show();
            }
          }
        });
      }
      
      // Show all players
      this.playerAssignments.forEach(assignment => {
        if (assignment.sphereBot && assignment.sphereBot.mesh) {
          assignment.sphereBot.mesh.visible = true;
        }
      });
      
      // Reset the focused planet tracking
      this.focusedPlanet = null;
      
      // Move game timer back to center
      const timerContainer = document.getElementById('gameTimerContainer');
      if (timerContainer) {
        timerContainer.style.left = '50%';
        timerContainer.style.right = 'auto';
        timerContainer.style.transform = 'translateX(-50%)';
      }
      
      console.log('Camera reset to view all planets');
    }
  }

  /**
   * Create and update planet indicators with current player counts
   * @private
   */
  async createAndUpdatePlanetIndicators() {
    try {
      // Get planet counts from network manager
      const planetCounts = await networkManager.getPlayerCounts();
      
      // Get the container element
      const container = document.getElementById('planetIndicators');
      if (!container) return;
      
      // Clear existing indicators
      container.innerHTML = '';
      
      // Define planet-specific display names for inhabitants
      const inhabitantNames = {
        earth: 'Terrans',
        mars: 'Martians'
      };
      
      // Create an indicator for each planet in the system
      if (this.planetSystem && this.planetSystem.planets) {
        // Sort planets by X position (left to right)
        const sortedPlanets = [...this.planetSystem.planets].sort((a, b) => a.position.x - b.position.x);
        
        sortedPlanets.forEach(planet => {
          // Get planet name and count
          const planetName = planet.name;
          const count = planetCounts[planetName] || 0;
          
          // Get inhabitant name or use generic fallback
          const inhabitants = inhabitantNames[planetName] || `${planetName} Settlers`;
          
          // Create the indicator element
          const indicator = document.createElement('div');
          indicator.className = 'planet-indicator';
          indicator.id = `${planetName}Indicator`;
          
          // Create name element
          const nameElement = document.createElement('div');
          nameElement.className = `planet-name planet-name-${planetName}`;
          nameElement.textContent = planetName.charAt(0).toUpperCase() + planetName.slice(1);
          
          // Create population element
          const populationElement = document.createElement('div');
          populationElement.className = 'planet-population';
          
          // Add count span
          const countSpan = document.createElement('span');
          countSpan.id = `${planetName}Population`;
          countSpan.textContent = count;
          
          // Assemble the elements
          populationElement.appendChild(countSpan);
          populationElement.append(` ${inhabitants}`);
          
          indicator.appendChild(nameElement);
          indicator.appendChild(populationElement);
          
          // Add to container
          container.appendChild(indicator);
        });
      }
      
      // Show the indicators container
      container.style.display = 'flex';
      
    } catch (error) {
      console.error('Error updating planet indicators:', error);
    }
  }

  /**
   * Initialize the pathfinder system
   * @private
   */
  initPathFinder() {
    this.pathFinder = new SphericalPathFinder({
      segmentCount: 40 // Use a reasonable segment count
    });
    console.log('Pathfinder system initialized');
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Add cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanupControls());
    
    // Add join button listener (step 23 & 24)
    const joinButton = document.getElementById('joinButton');
    if (joinButton) {
      joinButton.addEventListener('click', () => this.onJoinButtonClick());
    }

    // Add test player button listener
    const addTestPlayerButton = document.getElementById('addTestPlayer');
    if (addTestPlayerButton) {
      addTestPlayerButton.addEventListener('click', () => this.onAddTestPlayerClick());
    }

    // Add destroy session button listener
    const destroySessionButton = document.getElementById('destroySession');
    if (destroySessionButton) {
      destroySessionButton.addEventListener('click', () => this.onDestroySessionClick());
    }
    
    // Listen for new players joining via network
    networkManager.on('onPlayerJoined', (playerId, playerData, isTestPlayer) => {
      // Ensure player doesn't already exist before spawning
      if (!this.playerAssignments.some(a => a.sessionId === playerId)) {
         this.handlePlayerSpawn(playerId, playerData, isTestPlayer);
      } else {
         console.log(`Spawn request for existing player ${playerId}, ignoring.`);
      }
    });

    // Listen for server position updates (for reconciliation)
    networkManager.on('onPositionUpdated', (playerId, serverPosition, isTestPlayer, planetName) => {
      this.handleServerPositionUpdate(playerId, serverPosition, isTestPlayer, planetName);
    });

    console.log('Event listeners registered');
  }
  
  /**
   * Clean up controls when page is unloaded
   * @private
   */
  cleanupControls() {
    // Ensure planet click controls are properly disposed
    if (this.planetClickControls) {
      this.planetClickControls.dispose();
    }
    
    // Reset drag states for all rotation controls
    if (this.planetSystem && this.planetSystem.planetControls) {
      this.planetSystem.planetControls.forEach(control => {
        if (control && typeof control.resetDragState === 'function') {
          control.resetDragState();
        }
      });
    }
  }
  
  /**
   * Handle join button click
   * @private
   */
  async onJoinButtonClick() {
    try {
      // Get the join button
      const joinButton = document.getElementById('joinButton');
      if (!joinButton) return;

      // Check if this is a "re-enter atmosphere" action based on button text
      if (joinButton.textContent.includes('Re-enter') && joinButton.dataset.targetPlanet) {
        // This is a re-enter action, just focus the camera on the specified planet
        const targetPlanet = joinButton.dataset.targetPlanet;
        const planet = this.planetSystem.getPlanet(targetPlanet);
        
        if (planet) {
          console.log(`Re-entering ${targetPlanet} atmosphere`);
          this.cameraFollowPlanet(planet);
          return;
        }
      }

      // Check if we're in a state that allows joining
      if (this.gameState === 'active' || this.gameState === 'ended') {
        console.log(`Cannot join in game state: ${this.gameState}`);
        
        // Display error message
        const message = this.gameState === 'active' 
          ? 'Game is already in progress' 
          : 'Game has ended';
        
        // TODO: Add visual error message
        
        return;
      }

      // Check if player is already in the game
      const currentPlanet = networkManager.playerManager.currentPlanet;
      console.log("Current planet", currentPlanet);
      if (currentPlanet) {
        // This is a rejoin - focus camera on player's position on their assigned planet
        const planet = this.planetSystem.getPlanet(currentPlanet);
        
        // Find the player's body based on session ID
        const playerId = networkManager.authManager.getCurrentUserId();
        const playerAssignment = this.playerAssignments.find(a => a.sessionId === playerId);
        
        if (playerAssignment && planet) {
          // Focus camera on the player's planet
          this.cameraFollowPlanet(planet);
          
          // Ensure last_active is updated
          await networkManager.updateLastActive();

          
          joinButton.style.display = 'none';
          
          console.log(`Re-joining ${currentPlanet} mission, focused camera on player's planet`);
          return;
        }
      }

      // New join flow - proceed with assignment if in waiting_for_players state
      // Increment player count
      this.playerCount++;

      // Join game using network manager
      const { planetName, color } = await networkManager.joinGame();
      
      // Get the planet's position
      const planetPosition = this.planetSystem.getPlanet(planetName).position;

      // Create player physics body with the assigned color
      const spawnResult = this.spawnPlayer(planetName, planetPosition, color);

      // Store the assignment
      this.playerAssignments.push({
        playerId: this.playerCount,
        planetName: planetName,
        instanceId: spawnResult.instanceId,
        bodyIndex: spawnResult.bodyIndex,
        sessionId: networkManager.authManager.getCurrentUserId()
      });
      
      // Change the join button to "Re-enter <planet> atmosphere" instead of hiding it
      joinButton.textContent = `Re-enter ${planetName} atmosphere`;
      
      // If we have enough players and still in waiting state, start the game
      if (this.gameState === 'waiting_for_players') {
        const planetCounts = await networkManager.getPlayerCounts();
        const totalPlayers = Object.values(planetCounts).reduce((sum, count) => sum + count, 0);
        
        // Auto-start the game when we have at least 2 players total with at least 1 on each planet
        if (totalPlayers >= 2 && 
            planetCounts['earth'] >= 1 && 
            planetCounts['mars'] >= 1) {
          this.startGame();
        }
      }
      
      // Update the planet indicators with new counts
      this.createAndUpdatePlanetIndicators();
      
      // Success message
      console.log(`Player successfully joined planet ${planetName}`);
    } catch (error) {
      console.error('Failed to join game:', error);
    }
  }

  /**
   * Handle add test player button click
   * @private
   */
  async onAddTestPlayerClick() {
    try {
      // Increment player count
      this.playerCount++;

      const planetName = this.playerCount % 2 === 0 ? "earth" : "mars";
      
      // Generate a fake session ID
      const fakeSessionId = `fake_${Math.random().toString(36).substring(2, 15)}`;
      const playerColor = this._generateRandomColor();

      // Create a test player using the PlayerManager
      // This will trigger the Supabase real-time subscription for all connected clients
      try {
        const testPlayer = await networkManager.playerManager.createTestPlayer(
          fakeSessionId,
          planetName,
          playerColor
        );
        console.log(`Test player created for ${planetName} with color ${playerColor}`);
        
        // Generate a random position on the planet's surface
        const planet = this.planetSystem.getPlanet(planetName);
        const planetRadius = planet.geometry.parameters.radius;
        const randomPos = this._generateRandomPositionOnPlanet(planet.position, planetRadius);
        
        // Update the test player's position in the database
        // This will also trigger the real-time subscription
        await this._updateTestPlayerPosition(fakeSessionId, randomPos);
        
        console.log(`Test player position set to:`, randomPos);
      } catch (error) {
        console.error('Failed to create test player:', error);
      }
      
      // Update total player count after adding test player
      await this.updateTotalPlayerCount();
    } catch (error) {
      console.error('Failed to add test player:', error);
    }
  }

  /**
   * Generate a random color for the player
   * @private
   * @returns {string} A random color in hex format
   */
  _generateRandomColor() {
    return `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')}`;
  }

  /**
   * Generate a random position on a planet
   * @param {THREE.Vector3} planetPosition - The planet's position
   * @param {number} planetRadius - The planet's radius
   * @returns {Object} - The position {x, y, z}
   * @private
   */
  _generateRandomPositionOnPlanet(planetPosition, planetRadius) {
    const randomAngle1 = Math.random() * Math.PI * 2;
    const randomAngle2 = Math.random() * Math.PI - Math.PI/2;
    
    // Get position on planet surface
    const x = planetPosition.x + Math.cos(randomAngle1) * Math.cos(randomAngle2) * planetRadius;
    const y = planetPosition.y + Math.sin(randomAngle2) * planetRadius;
    const z = planetPosition.z + Math.sin(randomAngle1) * Math.cos(randomAngle2) * planetRadius;
    
    return { x, y, z };
  }
  
  /**
   * Update a test player's position in the database
   * @param {string} sessionId - The test player's session ID
   * @param {Object} position - The position {x, y, z}
   * @returns {Promise<void>}
   * @private
   */
  async _updateTestPlayerPosition(sessionId, position) {
    try {
      // Update position in the database directly using Supabase
      const { error } = await supabase
        .from('players')
        .update({ 
          position_x: position.x,
          position_y: position.y,
          position_z: position.z,
          last_active: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating test player position:', error);
      throw error;
    }
  }

  /**
   * Spawn a player for the specified planet
   * @param {string} planetName - The planet name ('earth' or 'mars')
   * @param {THREE.Vector3} planetPosition - The planet's position
   * @param {string} [overrideColor] - Optional color to override the session color
   * @returns {Object} - The player spawn result
   * @private
   */
  spawnPlayer(planetName, planetPosition, color, savedPosition = null) {
    // If we have a saved position, use it instead of generating random
    let x, y, z;
    let newPositionGenerated = false;
    
    // Check if this is the first appearance in this browser session
    // We'll use sessionStorage to track if this player has already appeared
    const playerId = networkManager.authManager.getCurrentUserId();
    const sessionKey = `player_appeared_${playerId}_${planetName}`;
    const hasAppearedBefore = sessionStorage.getItem(sessionKey);
    
    if (!hasAppearedBefore && savedPosition && savedPosition.x !== null) {
      // First appearance in this session, generate high position for falling animation
      // even though we have a saved position from the database
      const randomAngle1 = Math.random() * Math.PI * 2;
      const randomAngle2 = Math.random() * Math.PI - Math.PI/2;
      
      // Start at a point much higher above the planet surface
      const minHeight = 40; // Minimum height above surface
      const heightVariation = 1; // Random variation in height
      const spawnDistance = 10 + minHeight + Math.random() * heightVariation; // 30-50 units above surface
      
      // Convert spherical to cartesian coordinates
      x = planetPosition.x + Math.cos(randomAngle1) * Math.cos(randomAngle2) * spawnDistance;
      y = planetPosition.y + Math.sin(randomAngle2) * spawnDistance;
      z = planetPosition.z + Math.sin(randomAngle1) * Math.cos(randomAngle2) * spawnDistance;
      
      // Mark that this player has appeared in this session
      sessionStorage.setItem(sessionKey, 'true');
      
      // Mark that we generated a new position
      newPositionGenerated = true;
      console.log("First appearance in this session - generating high position for falling animation:", { x, y, z });
    } else if (savedPosition && savedPosition.x !== null) {
      // Already appeared in this session, use saved position from database
      x = savedPosition.x;
      y = savedPosition.y;
      z = savedPosition.z;
      console.log("Using saved position for returning player:", { x, y, z });
    } else {
      // No saved position (new player) - generate high position for falling animation
      const randomAngle1 = Math.random() * Math.PI * 2;
      const randomAngle2 = Math.random() * Math.PI - Math.PI/2;
      
      // Start at a point much higher above the planet surface
      const minHeight = 40; // Minimum height above surface
      const heightVariation = 1; // Random variation in height
      const spawnDistance = 10 + minHeight + Math.random() * heightVariation; // 30-50 units above surface
      
      // Convert spherical to cartesian coordinates
      x = planetPosition.x + Math.cos(randomAngle1) * Math.cos(randomAngle2) * spawnDistance;
      y = planetPosition.y + Math.sin(randomAngle2) * spawnDistance;
      z = planetPosition.z + Math.sin(randomAngle1) * Math.cos(randomAngle2) * spawnDistance;
      
      // Mark that this player has appeared in this session
      if (playerId) {
        sessionStorage.setItem(sessionKey, 'true');
      }
      
      // Mark that we generated a new position
      newPositionGenerated = true;
      console.log("New player - generating high position for falling animation:", { x, y, z });
    }
    
    // Create SphereBot at the position (saved or random)
    const sphereBot = new SphereBot(this.scene, this.world, {
      radius: 0.5,
      color: color || 0x44aa88,
      position: { x, y, z }
    });
    
    // Apply same physics properties as before
    sphereBot.body.material = this.playerMaterial; // Use player-specific material
    sphereBot.body.linearDamping = 0.7; // Increased damping to help players settle
    sphereBot.body.angularDamping = 0.99; // Add angular damping to reduce spinning
    sphereBot.body.collisionFilterGroup = 1; // Player collision group
    sphereBot.body.fixedRotation = true; // Prevent rotation to avoid weird behaviors
    sphereBot.body.maxVelocity = 40; // Reduce max velocity to prevent excessive speeds
    
    // Add collision velocity damping callback
    sphereBot.body.addEventListener('collide', function(e) {
      // Only apply damping if the collision is with another player
      if (e.body.collisionFilterGroup === 1) {
        // Calculate relative velocity magnitude
        const relVel = e.contact.getImpactVelocityAlongNormal();
        
        // Apply damping proportional to velocity
        if (Math.abs(relVel) > 5) {
          const dampingFactor = 0.8;
          sphereBot.body.velocity.scale(dampingFactor, sphereBot.body.velocity);
        }
      }
    });
    
    // Store the body in the appropriate array
    const bodyIndex = this.playerBodies[planetName].length;
    this.playerBodies[planetName].push(sphereBot.body);
    
    // Register this player body with the planet system for rotation
    this.planetSystem.addPlayerBody(planetName, sphereBot.body);
    
    // Add to game objects array to ensure it's updated
    this.gameObjects.push(sphereBot);
    
    console.log(`Spawned SphereBot player for planet ${planetName} at position:`, 
                { x, y, z }, `body index: ${bodyIndex}`);
    
    // If we generated a new position (not from saved data), save it to the database now
    if (newPositionGenerated && networkManager.authManager.getCurrentUserId()) {
      const position = { x, y, z };
      networkManager.authManager.updatePlayerPosition(position);
    }
    
    return {
      bodyIndex: bodyIndex,
      instanceIndex: bodyIndex, // Use same index for consistency
      body: sphereBot.body,
      sphereBot: sphereBot // Return the created SphereBot
    };
  }

  /**
   * Handle window resize event
   * @private
   */
  onWindowResize() {
    // Update renderer and camera aspect ratio
    this.renderer.resize(window.innerWidth, window.innerHeight);
    
    // Update rotation controls for each planet
    if (this.planetSystem && this.planetSystem.planetControls) {
      this.planetSystem.planetControls.forEach(controls => controls.handleResize());
    }
  }

  /**
   * Main game loop
   * @private
   */
  animate() {
    // Use arrow function to preserve 'this' context
    requestAnimationFrame(() => this.animate());
    
    // Rotate test planet meshes for visibility, a bit slower for better examination
    if (this.basePlanetMesh && this.noisyPlanetMesh) {
      this.basePlanetMesh.rotation.y += 0.003;
      this.noisyPlanetMesh.rotation.y += 0.003;
    }
    
    this.update();
    this.render();
  }

  /**
   * Update game state
   * @private
   */
  update() {
    // Get delta time since last frame
    const deltaTime = this.clock ? this.clock.getDelta() : 1/60;
    
    // Update physics
    if (this.world) {
      this.world.step(1/60, deltaTime, 3);
    }
    
    // Update movement manager for player movement
    if (this.movementManager) {
      this.movementManager.update(deltaTime);
    }
    
    // We don't need to call updatePhysics() on sphere bots, as they're
    // already included in the gameObjects array which is updated below.
    // The sphereBot.update() method is called in the gameObjects loop.
    
    // Update planet click controls marker
    if (this.planetClickControls) {
      this.planetClickControls.update(deltaTime);
    }
    
    // Update all game objects (including sphere bots)
    this.gameObjects.forEach(obj => {
      if (obj && typeof obj.update === 'function') {
        obj.update(deltaTime);
      }
    });
    
    // Update progress bars if they exist (only if game is active)
    if (this.progressBars) {
      this.progressBars.forEach(progressBar => {
        // Always update position but only show if game is active
        if (progressBar && typeof progressBar.update === 'function') {
          progressBar.update(deltaTime);
        }
      });
    }
    
    // Apply planet gravity to all player bodies
    this.applyPlanetGravity();
    
    // Limit player velocities to prevent extreme speeds
    this.limitPlayerVelocities();
    
    // Update network player positions for multiplayer synchronization
    this.syncPlayerPositions();
    
    // Update click effects
    this.updateClickEffects(deltaTime);
    
    // Update particle effects (condensation, etc.)
    this.updateParticleEffects(deltaTime);
    
    // Check if we're in the last minute countdown
    if (this.gameState === 'active' && !this.gameTimer.isInCooldown() && this.gameTimer.getTimeRemaining() <= 60) {
      // Update visual urgency effects here if needed
      if (!this._lastMinuteWarningShown) {
        console.log("LAST MINUTE COUNTDOWN!");
        this._lastMinuteWarningShown = true;
        
        // Add visual urgency like pulsing progress bars
        this.progressBars.forEach(progressBar => {
          if (progressBar && typeof progressBar.setPulsing === 'function') {
            progressBar.setPulsing(true);
          }
        });
      }
    }
  }

  /**
   * Show or hide all progress bars based on game state
   * @private
   */
  updateProgressBarsVisibility() {
    if (!this.progressBars) return;
    
    const shouldBeVisible = this.gameState === 'active';
    
    this.progressBars.forEach(progressBar => {
      if (progressBar) {
        if (shouldBeVisible) {
          progressBar.show();
        } else {
          progressBar.hide();
        }
      }
    });
    
    console.log(`Progress bars visibility set to: ${shouldBeVisible}`);
  }

  /**
   * Update all active particle effects
   * @param {number} deltaTime - Time since last update
   * @private
   */
  updateParticleEffects(deltaTime) {
    const effectsToRemove = [];
    this.particleEffects.forEach((effect, index) => {
      const particlesToRemove = [];
      const positions = effect.geometry.attributes.position.array;
      const colors = effect.geometry.attributes.color.array;
      let activeParticleCount = 0;

      effect.particles.forEach((particle, pIndex) => {
        if (particle.age < particle.lifetime) {
          // Update age
          particle.age += deltaTime;
          const lifeRatio = particle.age / particle.lifetime;

          // Update position (simple linear movement + slight upward drift)
          particle.position.addScaledVector(particle.velocity, deltaTime);
          particle.velocity.y += 0.5 * deltaTime; // Simple upward drift/anti-gravity

          // Update geometry attributes
          positions[activeParticleCount * 3] = particle.position.x;
          positions[activeParticleCount * 3 + 1] = particle.position.y;
          positions[activeParticleCount * 3 + 2] = particle.position.z;

          // Fade out color (alpha)
          effect.material.opacity = 1.0 - lifeRatio;
          // You could also fade the color itself, e.g., to red or grey
          // Example: Lerping color towards grey
          // const grey = new THREE.Color(0x888888);
          // particle.color.lerp(grey, lifeRatio);
          colors[activeParticleCount * 3] = particle.color.r;
          colors[activeParticleCount * 3 + 1] = particle.color.g;
          colors[activeParticleCount * 3 + 2] = particle.color.b;

          activeParticleCount++;
        } else {
          // Mark for removal
          particlesToRemove.push(pIndex);
        }
      });

      // Remove dead particles (iterating backwards to avoid index issues)
      for (let i = particlesToRemove.length - 1; i >= 0; i--) {
        effect.particles.splice(particlesToRemove[i], 1);
      }

      // Update draw range and needsUpdate flags
      effect.geometry.setDrawRange(0, activeParticleCount);
      effect.geometry.attributes.position.needsUpdate = true;
      effect.geometry.attributes.color.needsUpdate = true;

      // Check if the effect should be removed
      if (!effect.spawning && effect.particles.length === 0) {
        effectsToRemove.push(index);
        this.scene.remove(effect.points);
        effect.geometry.dispose();
        effect.material.dispose();
        console.log('Removed completed particle effect.');
      }
    });

    // Remove completed effects (iterating backwards)
    for (let i = effectsToRemove.length - 1; i >= 0; i--) {
      this.particleEffects.splice(effectsToRemove[i], 1);
    }
  }

  /**
   * Apply gravity from planets to players
   * @private
   */
  applyPlanetGravity() {
    // Gravity constant
    const G = 200; // Increased from 100 to 200 for faster falling
    
    // Planet radii - MUST match the physics body radius in Planet.js
    const planetRadii = {
      earth: 15, // Updated from 21
      mars: 15   // Updated from 21
    };
    
    // Surface gravity (Earth is about 1g, Mars is about 0.38g)
    const surfaceGravity = {
      earth: 1.5, // Increased from 1.0 to 1.5
      mars: 0.57  // Increased from 0.38 to 0.57 (same proportional increase)
    };
    
    // Apply gravity for each planet
    Object.keys(this.playerBodies).forEach(planetName => {
      const planet = this.planetSystem.getPlanet(planetName);
      const planetPos = planet.position;
      const planetRadius = planetRadii[planetName];
      const gravity = surfaceGravity[planetName];
      
      // Apply gravity to players on this planet
      for (const body of this.playerBodies[planetName]) {
        if (!body) continue;
        
        // Clear previous forces
        body.force.set(0, 0, 0);
        
        // Calculate direction to planet center
        const dx = planetPos.x - body.position.x;
        const dy = planetPos.y - body.position.y;
        const dz = planetPos.z - body.position.z;
        
        // Calculate distance squared
        const distSq = dx*dx + dy*dy + dz*dz;
        const dist = Math.sqrt(distSq);
        
        // Check if player center is inside the planet's physics radius
        if (dist < planetRadius) {
          // Apply outward force to push player center back towards the surface
          const outwardForce = 60; // Slightly increased force
          const penetrationDepth = planetRadius - dist;
          // Scale force by penetration depth to make it stronger the deeper it goes
          const effectiveForce = outwardForce * (1 + penetrationDepth * 2); 

          body.force.x -= effectiveForce * dx / dist;
          body.force.y -= effectiveForce * dy / dist;
          body.force.z -= effectiveForce * dz / dist;

          // Also apply a small impulse to immediately correct deep penetrations
          if (penetrationDepth > 0.1) { // Only if penetration is significant
              const impulseMagnitude = penetrationDepth * body.mass * 0.5; // Small corrective impulse
              body.applyImpulse(
                  new CANNON.Vec3(-impulseMagnitude * dx / dist, -impulseMagnitude * dy / dist, -impulseMagnitude * dz / dist),
                  body.position // Apply at center of mass
              );
          }
          
          // Skip normal gravity calculation when pushing out
          continue;
        }
        
        // Calculate normalized direction
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        
        // Calculate gravity force, scaled by planet's surface gravity
        // Force is stronger near surface and weakens with distance
        const force = G * gravity * Math.pow(planetRadius / dist, 2);
        
        // Apply force toward planet center
        body.force.x += force * nx;
        body.force.y += force * ny;
        body.force.z += force * nz;
        
        // Apply slight damping force when close to surface to help players settle
        if (dist < planetRadius * 1.2) {
          const velocityDot = body.velocity.x * nx + body.velocity.y * ny + body.velocity.z * nz;
          if (velocityDot < 0) { // Only damp if moving toward planet
            const dampingForce = -velocityDot * 0.8;
            body.force.x += dampingForce * nx;
            body.force.y += dampingForce * ny;
            body.force.z += dampingForce * nz;
          }
        }
      }
    });
  }
  
  /**
   * Sync player visual instances with physics bodies
   * Note: This method is no longer needed with SphereBots handling their own updates,
   * but is kept for backward compatibility
   * @private
   */
  syncPlayerPositions() {
    // No longer needed - SphereBots handle their own updates
    // This is now just a placeholder for backward compatibility
  }

  /**
   * Render the current scene
   * @private
   */
  render() {
    this.renderer.render();
  }

  /**
   * Verify proper implementation of requirements
   * @private
   */
  verifyImplementation() {
    // Verify step 17: ambient lighting
    if (this.lightingSystem) {
      this.lightingSystem.verifyAmbientLight();
    }
    
    /* // Remove check for non-existent method
    // Verify step 18: point lighting
    if (this.lightingSystem) {
      this.lightingSystem.verifyPointLight();
    }
    */
  }

  /**
   * Initialize players by loading active ones from the database
   * @private
   */
  async initializePlayers() {
    try {
      console.log('Initializing player loading...');
      
      // Initialize the network manager
      await networkManager.initialize();
      
      // Then load all active players
      this.loadActivePlayers();
      
      // Set initial game state - waiting for players
      this.gameState = 'waiting_for_players';
      this.buildingEnabled = false;
      
      // Update timer status to waiting
      if (this.gameTimer) {
        this.gameTimer.setWaitingStatus();
      }
      
      // Force an update and render after loading players
      this.update();
      this.render();
    } catch (error) {
      console.error('Failed to initialize players:', error);
    }
  }

  /**
   * Load and spawn active players from the database
   * @private
   */
  async loadActivePlayers() {
    try {
      // Get active players from NetworkManager
      const activePlayers = await networkManager.loadActivePlayers();
      
      // Update live player count display
      this.updateLivePlayerCount(activePlayers.length);
      this.updateTotalPlayerCount(); // Update total count as well
      
      // Clean up existing SphereBots and associated physics bodies/assignments
      this.cleanupExistingPlayers();

      // Spawn players using the new handlePlayerSpawn logic
      for (const player of activePlayers) {
         // Check if player already exists from a previous partial load or reconnect
         if (!this.playerAssignments.some(a => a.sessionId === player.session_id)) {
              this.handlePlayerSpawn(player.session_id, player, false);
         }
      }
      
      // Update planet indicators with current player counts
      this.createAndUpdatePlanetIndicators();
      
    } catch (error) {
      console.error('Failed to load active players:', error);
    }
  }

  /**
   * Helper to update the live player count display
   * @param {number} count 
   */
   updateLivePlayerCount(count) {
      const livePlayerCountElement = document.getElementById('livePlayerCount');
      if (livePlayerCountElement) {
        livePlayerCountElement.textContent = count;
      }
   }

  /**
   * Helper to clean up existing players (meshes, bodies, assignments)
   * @private
   */
   cleanupExistingPlayers() {
        // Remove SphereBots from gameObjects and dispose them
        this.gameObjects = this.gameObjects.filter(obj => {
          if (obj instanceof SphereBot) {
            // Find assignment to remove body correctly
             const assignment = this.playerAssignments.find(a => a.sphereBot === obj);
             if (assignment) {
                 // Remove from physics world and planet system tracking
                 if (this.playerBodies[assignment.planetName]) {
                    const bodyIndex = this.playerBodies[assignment.planetName].indexOf(obj.body);
                    if (bodyIndex > -1) {
                        this.playerBodies[assignment.planetName].splice(bodyIndex, 1);
                    }
                 }
                 this.planetSystem.removePlayerBody(assignment.planetName, obj.body);
             }
             obj.dispose(); // Clean up Three.js and Cannon.js objects within SphereBot
             return false; // Remove from gameObjects array
          }
          return true; // Keep non-SphereBot objects
        });
      
        // Reset player arrays and state
        this.playerBodies = {};
        this.planetSystem.getPlanetNames().forEach(planetName => {
          this.playerBodies[planetName] = [];
        });
        this.playerAssignments = [];
        this.playerCount = 0; // Reset internal counter, will be incremented by spawns

        console.log("Cleaned up existing player objects.");
   }

  /**
   * Update the total player count display
   */
  async updateTotalPlayerCount() {
    try {
      // Throttle count updates to prevent excessive API calls
      const now = Date.now();
      if (this.lastPlayerCountUpdate && now - this.lastPlayerCountUpdate < 30000) {
        // Skip update if less than 30 seconds since last update
        return;
      }
      this.lastPlayerCountUpdate = now;
      
      // Load all players (including inactive) by passing null
      const players = await networkManager.playerManager.loadPlayers(null);
      const totalPlayers = players.length;
      
      // Update the display
      const playerCountElement = document.getElementById('totalPlayerCount');
      if (playerCountElement) {
        playerCountElement.textContent = totalPlayers;
      }
    } catch (error) {
      console.error('Failed to update total player count:', error);
    }
  }

  /**
   * Limit player velocities to prevent them from flying off too quickly
   * @private
   */
  limitPlayerVelocities() {
    const MAX_VELOCITY = 15; // Maximum velocity magnitude
    const MAX_DISTANCE_FROM_PLANET = 60; // Maximum distance from planet center
    
    // Process players for each planet
    Object.keys(this.playerBodies).forEach(planetName => {
      const planetPos = this.planetSystem.getPlanet(planetName).position;
      
      for (const body of this.playerBodies[planetName]) {
        if (!body) continue;
        
        // Check if player is too far from planet
        const dx = body.position.x - planetPos.x;
        const dy = body.position.y - planetPos.y;
        const dz = body.position.z - planetPos.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq > MAX_DISTANCE_FROM_PLANET * MAX_DISTANCE_FROM_PLANET) {
          // Player is too far, teleport back to planet surface
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          
          // Position slightly above surface
          const newPos = {
            x: planetPos.x + nx * 12, // Slightly above surface (radius is 10)
            y: planetPos.y + ny * 12,
            z: planetPos.z + nz * 12
          };
          
          // Reset position and velocity
          body.position.set(newPos.x, newPos.y, newPos.z);
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          console.log(`Reset ${planetName} player position - too far from planet`);
          continue;
        }
        
        // Limit velocity if too high
        const velMagSq = body.velocity.x*body.velocity.x + 
                        body.velocity.y*body.velocity.y + 
                        body.velocity.z*body.velocity.z;
        
        if (velMagSq > MAX_VELOCITY * MAX_VELOCITY) {
          const velMag = Math.sqrt(velMagSq);
          const scaleFactor = MAX_VELOCITY / velMag;
          body.velocity.scale(scaleFactor, body.velocity);
        }
      }
    });
  }

  /**
   * Get the current player position without saving it
   * @returns {Object|null} The current player position or null if not found
   * @public
   */
  getCurrentPlayerPosition() {
    const playerId = networkManager.authManager.getCurrentUserId();
    if (!playerId) return null;
    
    const playerAssignment = this.playerAssignments.find(a => a.sessionId === playerId);
    if (!playerAssignment) return null;
    
    const body = this.playerBodies[playerAssignment.planetName][playerAssignment.bodyIndex];
    if (!body) return null;
    
    return {
      x: body.position.x,
      y: body.position.y, 
      z: body.position.z
    };
  }

  /**
   * Initialize controls for clicking on planet surfaces
   * @private 
   */
  initPlanetClickControls() {
    try {
      // Get the canvas element from the renderer
      const canvas = this.renderer.canvas;
      
      // Create the planet click controls
      this.planetClickControls = new PlanetClickControls(this.scene, this.camera, canvas, {
        // Use a slightly higher drag threshold to avoid false positives
        dragThreshold: 7,
        // Set a reasonable click time threshold (300ms)
        clickTimeThreshold: 300,
        // Configure path visualization
        pathSegmentCount: 40
      });
      
      // Add all planets as clickable objects
      this.planetClickControls.addClickablePlanets(this.planetSystem.planets);
      
      // Add buildable elements (rockets, etc.) as clickable objects
      if (this.planetSystem && this.planetSystem.rockets) {
        console.log(`Adding ${this.planetSystem.rockets.length} buildable elements to clickable objects`);
        this.planetSystem.rockets.forEach(buildable => {
          if (buildable && buildable.mesh) {
            this.planetClickControls.addClickableObject({ mesh: buildable.mesh, name: buildable.mesh.name });
          }
        });
      }
      
      // Link planet rotation controls with click controls
      if (this.planetSystem && this.planetSystem.planetControls) {
        // Ensure rotation controls have proper initial state
        this.planetSystem.planetControls.forEach(control => {
          if (control) {
            // Make sure isDragging is initially false
            control.isDragging = false;
          }
        });
        
        // Set up the link
        this.planetClickControls.setPlanetRotationControls(this.planetSystem.planetControls);
      }
      
      // Set callback for when a planet is clicked
      this.planetClickControls.setClickCallback(this.onPlanetClicked.bind(this));
      
      // Make player position function available to the click controls
      // This allows the path finder to get the current player position
      window.game = window.game || {};
      window.game.getCurrentPlayerPosition = this.getCurrentPlayerPosition.bind(this);
      window.game.handleRocketClick = this.handleBuildableClick.bind(this);
      window.game.handleBuildableClick = this.handleBuildableClick.bind(this);
      
      console.log('Planet click controls initialized and connected to rotation controls');
    } catch (error) {
      console.error('Failed to initialize planet click controls:', error);
    }
  }

  /**
   * Handle planet surface click events
   * @param {Object} clickData - Data about the click event
   * @param {THREE.Vector3} clickData.point - The point on the planet that was clicked
   * @param {string} clickData.planetName - The name of the clicked planet
   * @param {THREE.Vector3} clickData.normal - The surface normal at the clicked point
   * @param {Array} clickData.path - Array of path points if a path was created
   * @private
   */
  onPlanetClicked(clickData) {
    // Ignore clicks if player is not on a planet
    if (!networkManager.playerManager.currentPlanet) {
      console.log('Player is not on a planet, ignoring click');
      return;
    }
    
    // Ignore clicks on planets other than the one the player is currently on
    if (clickData.planetName !== networkManager.playerManager.currentPlanet) {
      console.log(`Clicked on ${clickData.planetName} but player is on ${networkManager.playerManager.currentPlanet}, ignoring`);
      return;
    }
    
    // Ignore clicks if camera is not focused on a planet
    if (!this.focusedPlanet) {
      console.log('Camera is not focused on a planet, ignoring click');
      return;
    }
    
    // Ignore clicks if camera is focused on a different planet
    if (this.focusedPlanet !== clickData.planetName) {
      console.log(`Camera is focused on ${this.focusedPlanet} but click was on ${clickData.planetName}, ignoring`);
      return;
    }
    
    // Log the click details for verification
    console.log('Player clicked on planet:', {
      point: clickData.point,
      planetName: clickData.planetName,
      normal: clickData.normal,
      distance: clickData.distance,
      pathPoints: clickData.path ? clickData.path.length : 0
    });
    
    // Get the current player's body
    const playerBody = this.getCurrentPlayerBody();
    if (!playerBody) {
      console.log('Could not find player body for movement');
      return;
    }
    
    // Get the current planet
    const planet = this.planetSystem.getPlanet(clickData.planetName);
    if (!planet) {
      console.log('Could not find clicked planet');
      return;
    }
    
    // If a movement is in progress, stop it
    if (this.movementManager && this.movementManager.isMoving) {
      console.log('Stopping previous movement to start new one');
      this.movementManager.stopMovement();
    }
    
    // Start movement along the path
    if (clickData.path && clickData.path.length > 1) {
      const planetData = {
        position: planet.position,
        radius: planet.mesh.userData.radius || 10
      };
      
      // Visual indication that movement is about to start
      this._showMovementStartEffect(playerBody.position);
      
      // Start movement immediately
      const movementStarted = this.movementManager.startMovement(
        clickData.path,
        playerBody,
        null, // No separate mesh for SphereBot
        planetData
      );
      
      if (movementStarted) {
        console.log('Movement started along path with', clickData.path.length, 'points');
        
        // Enable DEBUG_MOVEMENT flag for visual debugging
        window.DEBUG_MOVEMENT = true;
      } else {
        console.log('Failed to start movement');
      }
    } else {
      console.log('No valid path available for movement');
    }
    
    // Save the clicked destination position to the database
    this.saveDestinationPosition(clickData.point);
  }
  
  /**
   * Show visual feedback when movement starts
   * @param {THREE.Vector3} position - The starting position
   * @private
   */
  _showMovementStartEffect(position) {
    // Create a ripple effect at the starting position
    const ringGeometry = new THREE.RingGeometry(0.2, 0.3, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    
    // Orient the ring to face the camera
    ring.lookAt(this.camera.position);
    
    this.scene.add(ring);
    
    // Animate the effect
    let scale = 0.1;
    const expand = () => {
      if (scale < 1.5) {
        scale += 0.1;
        ring.scale.set(scale, scale, scale);
        ring.material.opacity = 0.9 * (1 - scale/1.5);
        
        // Keep ring facing the camera
        ring.lookAt(this.camera.position);
        
        requestAnimationFrame(expand);
      } else {
        // Remove the effect when animation completes
        this.scene.remove(ring);
        ringGeometry.dispose();
        ringMaterial.dispose();
      }
    };
    
    // Start the animation
    expand();
  }
  
  /**
   * Save the destination position when a player clicks on the planet
   * This replaces frequent position saving with just saving the destination
   * @param {THREE.Vector3} position - The destination position
   * @private
   */
  saveDestinationPosition(position) {
    const playerId = networkManager.authManager.getCurrentUserId();
    if (!playerId) return;
    
    const positionData = {
      x: position.x,
      y: position.y, 
      z: position.z
    };
    
    // Save the destination position to the database using the new method
    networkManager.updateCurrentPlayerPosition(positionData);
    console.log("Destination position saved to database:", positionData);
  }

  /**
   * Handle buildable object clicks
   * @param {Object} buildableObject - The clicked buildable object
   * @private
   */
  handleBuildableClick(buildable) {
    if (!buildable) {
      console.error('No buildable object provided');
      return;
    }
    
    // More precise rocket identification logic
    // Step 1: Check if the buildable has planetName in userData
    let targetPlanetName = null;
    if (buildable.userData && buildable.userData.planetName) {
      targetPlanetName = buildable.userData.planetName;
      console.log(`Found planet name in userData: ${targetPlanetName}`);
    }
    
    // Step 2: Find the actual rocket instance that matches both the mesh and planet (if available)
    const buildableRocket = this.planetSystem.rockets.find(rocket => {
      // If we know the planet name, strictly match on that first
      if (targetPlanetName && rocket.planetName !== targetPlanetName) {
        return false;
      }
      
      // Then check for mesh match or userData flags
      return rocket.mesh === buildable || 
            (buildable.userData && 
             (buildable.userData.isRocket || buildable.userData.isBuildable));
    });
    
    if (!buildableRocket) {
      console.error('Could not find rocket instance for clicked object');
      return;
    }
    
    // Debug log for rocket identification
    console.log(`Matched rocket: ${buildableRocket.planetName}`, {
      position: buildableRocket.mesh.position.clone(),
      userData: buildableRocket.mesh.userData
    });
    
    // Check if building is enabled based on game state
    if (this.gameState !== 'active') {
      console.log(`Building not allowed in game state: ${this.gameState}`);
      
      // Show appropriate message based on game state
      let message = 'WAIT';
      let messageColor = new THREE.Color(0xffffff); // Use white for close.png to maintain its original color
      
      switch (this.gameState) {
        case 'waiting_for_players':
          message = 'WAITING FOR PLAYERS';
          // Using white color to preserve the original close.png color
          break;
        case 'cooldown':
          message = 'COOLDOWN';
          // Using white color to preserve the original close.png color
          break;
        case 'victory':
          message = 'GAME OVER';
          // Using white color to preserve the original close.png color
          break;
        case 'ended':
          message = 'GAME ENDED';
          // Using white color to preserve the original close.png color
          break;
      }
      
      // Get the position for the effect
      const effectPosition = buildableRocket.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      const clickEffect = new ClickEffect({
        scene: this.scene,
        position: effectPosition,
        camera: this.camera,
        text: message,
        color: messageColor,
        size: 2.0,
        floatHeight: 2.5,
        imagePath: '/close.png' // Use close.png instead of default plus-one.png
      });
      this.clickEffects.push(clickEffect);
      return;
    }

    // Get the player's current planet from network manager
    const playerPlanet = networkManager.playerManager.currentPlanet;
    if (!playerPlanet) {
      console.log('Player not assigned to a planet');
      return;
    }
    
    // Check if player is assigned to the planet this buildable belongs to
    if (playerPlanet !== buildableRocket.planetName) {
      console.log(`Player assigned to ${playerPlanet}, cannot interact with buildable on ${buildableRocket.planetName}`);
      
      // Show negative visual feedback
      const effectPosition = buildableRocket.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      const clickEffect = new ClickEffect({
        scene: this.scene,
        position: effectPosition,
        camera: this.camera,
        text: 'WRONG PLANET',
        color: new THREE.Color(0xffffff), // White color to preserve original close.png color
        size: 2.0,
        floatHeight: 2.5,
        imagePath: '/close.png' // Use close.png instead of default plus-one.png
      });
      this.clickEffects.push(clickEffect);
      return;
    }
    
    // Log the click
    console.log(`Player clicked on buildable (${buildableRocket.type}) on planet ${buildableRocket.planetName}`);
    
    // Get the current player ID
    const playerId = networkManager.authManager.getCurrentUserId();
    
    // Track the player's contribution to this rocket
    if (!this.rocketContributions[buildableRocket.planetName]) {
      this.rocketContributions[buildableRocket.planetName] = new Map();
    }
    
    // Get current count or default to 0
    const currentCount = this.rocketContributions[buildableRocket.planetName].get(playerId) || 0;
    // Increment the count
    this.rocketContributions[buildableRocket.planetName].set(playerId, currentCount + 1);
    
    // Log contribution
    console.log(`Player ${playerId} now has ${currentCount + 1} contributions to ${buildableRocket.planetName} rocket`);
    
    // Call the rocket's addClick method
    buildableRocket.addClick();
    
    // Update player contributions display if this planet is focused
    if (this.focusedPlanet === buildableRocket.planetName) {
      this.updatePlayerContributions(buildableRocket.planetName);
    }
    
    // Save the click to database (to be implemented in step 6)
    // For now just log it
    console.log(`Click saved for player ${networkManager.authManager.getCurrentUserId()} on ${buildableRocket.planetName}`);
    
    // Check if construction is complete
    const isComplete = buildableRocket.currentState === 4;
    if (isComplete) {
      console.log('Buildable is complete!');
      this.handleVictory(buildableRocket.planetName);
      return;
    }
    
    // Update the progress bar if it exists
    if (!this.progressBars.has(buildableRocket)) {
        this.createProgressBarForRocket(buildableRocket);
        this.progressBars.get(buildableRocket)?.setProgress(buildableRocket.getTotalProgressPercent());
    } else {
        // Update both progress and click count
        console.log('Updating progress bar for rocket:', buildableRocket.currentClickCount);
        const progressBar = this.progressBars.get(buildableRocket);
        progressBar.setProgress(buildableRocket.getTotalProgressPercent());
        progressBar.setClickCount(buildableRocket.currentClickCount);
    }

    // --- Step 4: Create +1 Click Effect ---
    // Find the rocket in the scene to get its current world position
    const rocketMesh = buildableRocket.mesh;
    console.log('Creating +1 effect for rocket:', rocketMesh.name, 'on planet:', buildableRocket.planetName);
    
    // Get the current world position of the rocket mesh
    const worldPos = new THREE.Vector3();
    rocketMesh.getWorldPosition(worldPos);
    
    // Add a slight vertical offset so it appears above the click point
    const effectPosition = worldPos.add(new THREE.Vector3(0, 1, 0));
    
    console.log('Effect position:', effectPosition);
    
    const clickEffect = new ClickEffect({
      scene: this.scene,
      position: effectPosition,
      camera: this.camera,
      text: '+1',
      color: new THREE.Color(0x90EE90), // Light green
      size: 2.0,
      floatHeight: 2.5
    });
    this.clickEffects.push(clickEffect);
    // --- End Step 4 ---

    // For the future implementation, we'll send a message to the server
    // networkManager.sendBuildAction(playerPlanet, buildableRocket.type);
  }

  /**
   * Updates all active ClickEffect instances.
   * @param {number} deltaTime - Time since last update.
   * @private
   */
  updateClickEffects(deltaTime) {
    // Iterate backwards for safe removal
    for (let i = this.clickEffects.length - 1; i >= 0; i--) {
      const effect = this.clickEffects[i];
      effect.update(deltaTime);
      if (effect.isComplete) {
        this.clickEffects.splice(i, 1); // Remove completed effect
      }
    }
  }

  /**
   * Clean up and dispose of resources
   */
  dispose() {
    // Dispose of all game objects
    this.gameObjects.forEach(obj => {
      if (typeof obj.dispose === 'function') {
        obj.dispose();
      }
    });
    
    // Dispose of planet click controls
    if (this.planetClickControls) {
      this.planetClickControls.dispose();
    }
    
    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
    }

    // Dispose of progress bars
    this.progressBars.forEach(bar => bar.dispose());
    this.progressBars.clear();

    // Dispose of any active click effects
    this.clickEffects.forEach(effect => effect.dispose());
    this.clickEffects = [];
    
    // Dispose of game timer
    if (this.gameTimer) {
      this.gameTimer.dispose();
    }

    // Dispose wheel listener
    this.renderer.canvas.removeEventListener('wheel', this._handleMouseWheel.bind(this));
  }

  /**
   * Initialize the movement system for smooth player movement
   * @private
   */
  initMovementSystem() {
    // Create the movement manager with custom settings
    this.movementManager = new SphericalMovement({
      speed: 15,              // Base movement speed (units per second)
      accelerationTime: 0.5,  // Time to reach full speed
      decelerationTime: 0.8,  // Time to decelerate to stop
      trailLength: 20,        // Number of positions to track for trail
      trailColor: new THREE.Color(0x4deeea), // Cyan-blue trail
      trailFade: true         // Fade out the trail toward the end
    });
    
    // Set up event callbacks
    this.movementManager.onMoveStart = (data) => {
      console.log('Movement started:', {
        distance: data.totalDistance, 
        estimatedTime: data.estimatedTime
      });
    };
    
    this.movementManager.onMoveProgress = (data) => {
      // Only log at 25%, 50%, 75% to avoid console spam
      if (Math.floor(data.progress * 4) > Math.floor((data.progress - 0.01) * 4)) {
        console.log(`Movement progress: ${Math.floor(data.progress * 100)}%`);
      }
    };
    
    this.movementManager.onMoveComplete = () => {
      console.log('Movement completed');
    };
    
    console.log('Movement system initialized');
  }

  /**
   * Get the current player's physics body
   * @returns {CANNON.Body|null} The player's physics body or null if not found
   * @private
   */
  getCurrentPlayerBody() {
    const playerId = networkManager.authManager.getCurrentUserId();
    if (!playerId) return null;
    
    // Find the player assignment for this session
    const assignment = this.playerAssignments.find(a => a.sessionId === playerId);
    if (!assignment) {
      console.log('No assignment found for player with ID', playerId);
      return null;
    }
    
    // Get the player's current planet
    const planetName = networkManager.playerManager.currentPlanet;
    if (!planetName) {
      console.log('Player is not assigned to a planet');
      return null;
    }
    
    // Get the player's body from the appropriate array using the body index
    if (this.playerBodies[planetName] && this.playerBodies[planetName][assignment.bodyIndex]) {
      return this.playerBodies[planetName][assignment.bodyIndex];
    }
    
    console.log('Player body not found for planet', planetName, 'with index', assignment.bodyIndex);
    return null;
  }

  /**
   * Handle spawning players, including the drop animation.
   * This is triggered by initial load and network 'onPlayerJoined' events.
   * @param {string} sessionId - The player's session ID (real or fake)
   * @param {Object} playerData - Player data from network/database
   * @param {boolean} isTestPlayer - Flag if it's a test player
   * @private
   */
  handlePlayerSpawn(sessionId, playerData, isTestPlayer = false) {
    try {
      console.log(`Handling spawn for player ${sessionId}:`, playerData);
      
      // Extract the player's planet and color
      const { planet_name: planetName, color } = playerData;
      
      if (!planetName) {
        console.error('No planet name found in player data');
        return;
      }
      
      // Get the planet's position
      const planet = this.planetSystem.getPlanet(planetName);
      if (!planet) {
        console.error(`Planet ${planetName} not found`);
        return;
      }

      // Create player sphere bot at a random position on the planet
      // For test players, we'll use the position from the database
      let spawnPosition;
      
      if (isTestPlayer && playerData.position_x !== null) {
        // Use the stored position for test players
        spawnPosition = new THREE.Vector3(
          playerData.position_x,
          playerData.position_y,
          playerData.position_z
        );
      } else {
        // Generate a random spawn position for real players
        const surfaceOffset = 0.5; // Offset from planet surface
        const planetRadius = planet.radius || 15;
        spawnPosition = this._generateRandomPositionOnPlanet(
          planet.position,
          planetRadius + surfaceOffset
        );
      }
      
      // Create the player's sphere bot
      const assignment = this._createSphereBot(
        planetName,
        color || '#ff0000',
        spawnPosition,
        sessionId
      );
      
      console.log(`Player ${sessionId} spawned on ${planetName}`);
      
      // Update the status panel with total player count
      this.updateTotalPlayerCount();
      
      // Update the planet indicators with new counts
      this.createAndUpdatePlanetIndicators();
      
      return assignment;
      
    } catch (error) {
      console.error('Error spawning player:', error);
      return null;
    }
  }

  /**
   * Create a landing hit wave effect
   * @param {THREE.Vector3} position - The landing position
   * @param {string|number} color - Color for the wave (e.g., player's color)
   * @private
   */
  createHitWaveEffect(position, color = 0x87CEFA) {
    const waveGeometry = new THREE.RingGeometry(0.1, 0.2, 32); // Start small
    const waveMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false // Prevent depth sorting issues
    });

    const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
    waveMesh.position.copy(position);

    // Calculate the surface normal (vector from planet center to impact point)
    let surfaceNormal = new THREE.Vector3();
    let parentPlanetCenter = new THREE.Vector3(); // Default to origin

    // Find the planet it landed on to get the center
    let minDistSq = Infinity;
    this.planetSystem.planets.forEach(p => {
        const distSq = p.position.distanceToSquared(position);
        if (distSq < minDistSq) {
            minDistSq = distSq;
            parentPlanetCenter.copy(p.position);
        }
    });

    surfaceNormal.copy(position).sub(parentPlanetCenter).normalize();

    // Orient the ring using the surface normal
    // The default orientation of RingGeometry is in the XY plane.
    // We want its normal (Z-axis) to align with the surfaceNormal.
    const quaternion = new THREE.Quaternion();
    // Create a quaternion that rotates the default Z-axis (0,0,1) to the surfaceNormal
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal);
    waveMesh.quaternion.copy(quaternion);

    this.scene.add(waveMesh);

    // Animate the effect using GSAP
    gsap.to(waveMesh.scale, {
      x: 8, // Expand scale
      y: 8,
      z: 8,
      duration: 0.5,
      ease: "power1.out",
    });
    gsap.to(waveMaterial, {
      opacity: 0,
      duration: 0.6, // Slightly longer fade
      ease: "power1.in",
      onComplete: () => {
        this.scene.remove(waveMesh);
        waveGeometry.dispose();
        waveMaterial.dispose();
      }
    });
  }

  /**
   * Spawn a player for the specified planet. 
   * This now just creates the SphereBot at a given position without the height logic.
   * @param {string} planetName - The planet name ('earth' or 'mars')
   * @param {string} color - The player's color
   * @param {Object} position - The position {x, y, z} to spawn at
   * @param {string} sessionId - The player's session ID
   * @returns {Object} - The player spawn result containing the SphereBot and indices
   * @private
   */
  _createSphereBot(planetName, color, position, sessionId) {
    // Create SphereBot at the specified position
    const sphereBot = new SphereBot(this.scene, this.world, {
      radius: 0.5,
      color: color || 0x44aa88,
      position: { x: position.x, y: position.y, z: position.z }
    });
    
    // Apply physics properties
    sphereBot.body.material = this.playerMaterial;
    sphereBot.body.linearDamping = 0.7;
    sphereBot.body.angularDamping = 0.99;
    sphereBot.body.collisionFilterGroup = 1;
    sphereBot.body.fixedRotation = true;
    sphereBot.body.maxVelocity = 40;
    
    // Add collision velocity damping callback
    sphereBot.body.addEventListener('collide', function(e) {
      if (e.body.collisionFilterGroup === 1) {
        const relVel = e.contact.getImpactVelocityAlongNormal();
        if (Math.abs(relVel) > 5) {
          const dampingFactor = 0.8;
          sphereBot.body.velocity.scale(dampingFactor, sphereBot.body.velocity);
        }
      }
    });
    
    // Store the body in the appropriate array
    if (!this.playerBodies[planetName]) {
        this.playerBodies[planetName] = []; // Ensure array exists
    }
    const bodyIndex = this.playerBodies[planetName].length;
    this.playerBodies[planetName].push(sphereBot.body);
    
    // Register this player body with the planet system for rotation
    this.planetSystem.addPlayerBody(planetName, sphereBot.body);
    
    // Add to game objects array to ensure it's updated
    this.gameObjects.push(sphereBot);
    
    // Increment player count and store assignment
    this.playerCount++;
    const assignment = {
      playerId: this.playerCount, // Use internal counter for now
      planetName: planetName,
      instanceId: bodyIndex, // Keep consistent
      bodyIndex: bodyIndex,
      sessionId: sessionId, // Use the actual session ID
      sphereBot: sphereBot // Store reference to the bot
    };
    this.playerAssignments.push(assignment);

    console.log(`Created SphereBot for player ${sessionId} on planet ${planetName} at index: ${bodyIndex}`);
    
    return assignment; // Return the full assignment details
  }

  /**
   * Handle server position updates for reconciliation.
   * This is called when NetworkManager detects a significant discrepancy.
   * @param {string} playerId - The session ID of the player whose position needs update.
   * @param {Object} serverPosition - The authoritative position from the server {x, y, z}.
   * @param {boolean} isTestPlayer - Flag if this is a test player.
   * @param {string} planetName - The name of the planet the player is on.
   * @private
   */
  handleServerPositionUpdate(playerId, serverPosition, isTestPlayer, planetName) {
    console.log(`Handling server position update for player ${playerId} on ${planetName}`);

    // Find the player's assignment and SphereBot instance
    const assignment = this.playerAssignments.find(a => a.sessionId === playerId);
    if (!assignment || !assignment.sphereBot) {
      console.warn(`Could not find SphereBot instance for player ${playerId} to reconcile position.`);
      return;
    }
    const sphereBot = assignment.sphereBot;
    const playerBody = sphereBot.body;

    // Get the planet object
    const planet = this.planetSystem.getPlanet(planetName);
    if (!planet) {
      console.warn(`Could not find planet ${planetName} for player ${playerId} reconciliation.`);
      return;
    }
    const planetData = {
      position: planet.position,
      radius: planet.mesh.userData.radius || 10
    };

    // Get current physics body position
    const currentPosition = new THREE.Vector3().copy(playerBody.position);
    
    // Convert server position to THREE.Vector3
    const targetPosition = new THREE.Vector3(serverPosition.x, serverPosition.y, serverPosition.z);

    // Ensure target position is on the planet surface
    const direction = targetPosition.clone().sub(planetData.position).normalize();
    targetPosition.copy(planetData.position).addScaledVector(direction, planetData.radius);

    console.log(`Reconciling player ${playerId}: Current:`, currentPosition, `Target:`, targetPosition);

    // Calculate the path from current position to target server position
    // Use the Game's pathFinder instance
    const pathPoints = this.pathFinder.findPath(
      currentPosition,
      targetPosition,
      planetData.position,
      planetData.radius
    );

    if (!pathPoints || pathPoints.length < 2) {
      console.warn(`Could not calculate reconciliation path for player ${playerId}. Snapping instead.`);
      // Fallback: Snap position directly (might look jerky)
      playerBody.position.copy(targetPosition);
      playerBody.velocity.set(0, 0, 0); // Reset velocity
      if(sphereBot.mesh) sphereBot.mesh.position.copy(targetPosition);
      return;
    }

    // If a movement is already in progress *for this specific bot*, stop it
    if (this.movementManager && this.movementManager.isMoving && this.movementManager.targetBody === playerBody) {
      console.log(`Stopping existing movement for player ${playerId} before server reconciliation.`);
      this.movementManager.stopMovement();
    }

    // Start movement along the reconciliation path
    console.log(`Starting server-reconciliation movement for player ${playerId} along path with ${pathPoints.length} points.`);
    const movementStarted = this.movementManager.startMovement(
      pathPoints,
      playerBody,
      null, // No separate mesh for SphereBot
      planetData
    );

    if (!movementStarted) {
      console.warn(`Failed to start reconciliation movement for player ${playerId}.`);
    }
  }

  /**
   * Creates and attaches a progress bar to a given rocket.
   * @param {Rocket} rocket - The rocket object.
   * @private
   */
  createProgressBarForRocket(rocket) {
      if (!rocket || !rocket.mesh || this.progressBars.has(rocket)) return;

      console.log('Creating progress bar for rocket', rocket.planetName);
      const progressBar = new ProgressBar({
          scene: this.scene,
          offsetX: 1.8,                   // Horizontal offset from the rocket
          positionStyle: 'side',          // Position on the side instead of on top
          width: 0.2,                     // Smaller width (becomes height when rotated)
          height: 2.0                     // Larger height (becomes width when rotated)
      });
      
      // Attach to object (this initializes the position)
      progressBar.attachToObject(rocket.mesh);
      
      // Set initial progress and click count
      progressBar.setProgress(rocket.getTotalProgressPercent());
      progressBar.setClickCount(rocket.currentClickCount);
      
      // Set visibility based on game state
      if (this.gameState !== 'active') {
          progressBar.hide();
      }
      
      // Store in the progress bars map
      this.progressBars.set(rocket, progressBar);
  }

  /**
   * Handles mouse wheel events for zooming when focused on a planet.
   * @param {WheelEvent} event - The wheel event.
   * @private
   */
  _handleMouseWheel(event) {
      // Only zoom if focused on a planet
      if (!this.focusedPlanet || !this.camera) return;

      // Prevent default scroll page behavior
      event.preventDefault();

      // Get the planet object
      const planet = this.planetSystem.getPlanet(this.focusedPlanet);
      if (!planet) return;

      const planetCenter = planet.position.clone();

      // Get current distance from planet center
      const currentDistance = this.camera.position.distanceTo(planetCenter);

      // Calculate zoom amount based on deltaY
      // Positive deltaY = scroll down (zoom out), Negative deltaY = scroll up (zoom in)
      // Adjust sensitivity slightly for a smoother feel
      const zoomAmount = event.deltaY * (ZOOM_SENSITIVITY * currentDistance * 0.1);

      // Calculate new distance
      let newDistance = currentDistance + zoomAmount;

      // Clamp distance within min/max bounds
      newDistance = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, newDistance));

      // Calculate direction vector from planet to camera
      const direction = new THREE.Vector3().subVectors(this.camera.position, planetCenter).normalize();

      // Calculate new camera position
      const newPosition = planetCenter.clone().addScaledVector(direction, newDistance);

      // Update camera position and lookAt
      this.camera.position.copy(newPosition);
      this.camera.lookAt(planetCenter);

      // console.log('Zoom - New Distance:', newDistance); // Optional: for debugging
  }

  /**
   * Start a new game
   */
  startGame() {
    console.log('Starting new game');
    this.gameState = 'active';
    this.buildingEnabled = true;
    
    // Reset buildable objects
    this.resetBuildables();
    
    // Start the game timer - this will also set ACTIVE status
    this.gameTimer.startGameTimer();
    
    // Show progress bars now that game is active
    this.updateProgressBarsVisibility();
    
    // Notify players that the game has started
    this.showGameStartMessage();
  }

  /**
   * Reset all buildable objects to initial state
   */
  resetBuildables() {
    if (this.planetSystem && this.planetSystem.rockets) {
      this.planetSystem.rockets.forEach(rocket => {
        // Reset to initial state
        rocket.currentState = 0;
        rocket.currentClickCount = 0;
        
        // Update visuals
        rocket.updateMeshForState();
        
        // Reset progress bar
        if (this.progressBars.has(rocket)) {
          const progressBar = this.progressBars.get(rocket);
          progressBar.setProgress(0);
          progressBar.setClickCount(0); // Reset click count display
        }
      });
      
      console.log('All buildables reset to initial state');
    }
  }

  /**
   * Show a message that the game has started
   */
  showGameStartMessage() {
    // Create a temporary message that fades out
    const message = document.createElement('div');
    message.textContent = 'GAME STARTED';
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.color = '#4CAF50';
    message.style.padding = '20px 40px';
    message.style.borderRadius = '10px';
    message.style.fontSize = '32px';
    message.style.fontWeight = 'bold';
    message.style.zIndex = '2000';
    message.style.transition = 'opacity 1s ease-in-out';
    
    document.body.appendChild(message);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => {
        if (message.parentNode) {
          document.body.removeChild(message);
        }
      }, 1000);
    }, 2000);
  }

  /**
   * Handle game end when the timer expires
   */
  handleGameEnd() {
    console.log('Game ended - starting cooldown');
    
    // Update game state
    this.gameState = 'cooldown';
    this.buildingEnabled = false;
    
    // Start cooldown timer
    this.gameTimer.startCooldownTimer();
    
    // Hide progress bars during cooldown
    this.updateProgressBarsVisibility();
    
    // Display results to players
    this.showGameResults();
  }
  
  /**
   * Reset the game after cooldown
   * @private
   */
  resetGame() {
    console.log('Resetting game after cooldown');
    
    // Reset game state to waiting
    this.gameState = 'waiting_for_players';
    this.buildingEnabled = false;
    
    // Reset timer
    this.gameTimer.resetTimer();
    
    // Reset buildable objects
    this.resetBuildables();
    
    // Reset player contributions
    this.rocketContributions = {
      earth: new Map(),
      mars: new Map()
    };
    
    // Update UI elements
    this.updateProgressBarsVisibility();
    
    console.log('Game reset completed');
  }
  
  /**
   * Show game results to players
   * @private
   */
  showGameResults() {
    // Create a temporary message showing game results
    const message = document.createElement('div');
    message.innerHTML = `
      <h2>GAME ENDED</h2>
      <p>Game time expired. Starting cooldown period.</p>
    `;
    
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.color = '#FF9800'; // Orange for cooldown
    message.style.padding = '30px 50px';
    message.style.borderRadius = '10px';
    message.style.textAlign = 'center';
    message.style.zIndex = '2000';
    message.style.transition = 'opacity 1s ease-in-out';
    
    // Add message to DOM
    document.body.appendChild(message);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
      }, 1000);
    }, 3000);
  }

  /**
   * Handle victory when a rocket is completed
   * @param {string} winningPlanet - The name of the winning planet
   */
  handleVictory(winningPlanet) {
    console.log(`Victory for planet ${winningPlanet}!`);
    
    // Set game state
    this.gameState = 'victory';
    this.buildingEnabled = false;
    
    // Hide progress bars after victory
    this.updateProgressBarsVisibility();
    
    // Stop the game timer and update status
    this.gameTimer.stopTimer();
    this.gameTimer.setVictoryStatus();
    
    // Show victory message
    this.showVictoryMessage(winningPlanet);
    
    // Animate rocket victory sequence (to be implemented in step 9)
    
    // After victory sequence, transition to cooldown
    setTimeout(() => {
      // Remove victory message
      const victoryMessage = document.getElementById('gameEndMessage');
      if (victoryMessage && victoryMessage.parentNode) {
        document.body.removeChild(victoryMessage);
      }
      
      // Start cooldown
      this.gameState = 'cooldown';
      this.gameTimer.startCooldownTimer();
    }, 5000); // Show victory for 5 seconds before cooldown
    
    // Update database to record the victory (will be implemented in step 6)
  }

  /**
   * Show victory message when a rocket is completed
   * @param {string} winningPlanet - The name of the winning planet
   */
  showVictoryMessage(winningPlanet) {
    // Create a message that stays visible during victory sequence
    const message = document.createElement('div');
    message.id = 'gameEndMessage';
    message.innerHTML = `
      <h2>VICTORY FOR ${winningPlanet.toUpperCase()}!</h2>
      <p>The ${winningPlanet} team has completed their rocket first!</p>
      <p>Preparing for rocket launch...</p>
    `;
    
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.color = 'white';
    message.style.padding = '30px 50px';
    message.style.borderRadius = '10px';
    message.style.textAlign = 'center';
    message.style.zIndex = '2000';
    
    // Style the heading with planet-specific color
    const heading = message.querySelector('h2');
    if (heading) {
      heading.style.color = winningPlanet === 'earth' ? '#4CAF50' : '#FF5722';
      heading.style.marginBottom = '15px';
    }
    
    document.body.appendChild(message);
  }

  /**
   * Handle cooldown end
   */
  handleCooldownEnd() {
    console.log('Cooldown ended - starting new game');
    
    // Remove game end message if it exists
    const gameEndMessage = document.getElementById('gameEndMessage');
    if (gameEndMessage && gameEndMessage.parentNode) {
      document.body.removeChild(gameEndMessage);
    }
    
    // Start a new game
    this.startGame();
  }

  /**
   * End the game completely (used for server shutdowns, etc.)
   */
  endGame() {
    console.log('Ending game completely');
    
    // Set game state to ended
    this.gameState = 'ended';
    this.buildingEnabled = false;
    
    // Stop the timer and update status
    this.gameTimer.stopTimer();
    this.gameTimer.setEndedStatus();
    
    // Show game ended message
    const message = document.createElement('div');
    message.id = 'gameEndMessage';
    message.innerHTML = `
      <h2>GAME ENDED</h2>
      <p>This game session has been terminated.</p>
      <p>Please refresh the page to start a new session.</p>
    `;
    
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.color = 'white';
    message.style.padding = '30px 50px';
    message.style.borderRadius = '10px';
    message.style.textAlign = 'center';
    message.style.zIndex = '2000';
    
    // Style the heading
    const heading = message.querySelector('h2');
    if (heading) {
      heading.style.color = '#FF5722';
      heading.style.marginBottom = '15px';
    }
    
    document.body.appendChild(message);
    
    // Reset and hide join button
    const joinButton = document.getElementById('joinButton');
    if (joinButton) {
      joinButton.textContent = 'Join a mission'; // Reset text to default
      joinButton.style.display = 'none';
    }
    
    // Clean up network connections
    networkManager.destroySession().catch(error => {
      console.error('Error destroying session:', error);
    });
  }

  /**
   * Generate a player icon SVG with the player's color
   * @param {string} color - The player's color (hex format)
   * @returns {string} SVG string with the player's color applied
   * @private
   */
  getPlayerIcon(color) {
    // The SVG content of earthian.svg with color replaced
    return `<svg width="24" height="24" viewBox="0 0 170 168" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M55.5 115L70 116L70.5 121.5V155.5L70 159L68.5 161.5L67 163L65 164H60L57 162.5L56 160.5L55 158V155.5L55.5 115Z" fill="${color}" stroke="${color}"/>
      <path d="M103.5 115L118 116L118.5 121.5V155.5L118 159L116.5 161.5L115 163L113 164H108L105 162.5L104 160.5L103 158V155.5L103.5 115Z" fill="${color}" stroke="${color}"/>
      <path d="M153 71.5C153 108.779 122.555 139 85 139C47.4446 139 17 108.779 17 71.5C17 34.2208 47.4446 4 85 4C122.555 4 153 34.2208 153 71.5Z" fill="${color}"/>
      <ellipse cx="110.5" cy="65" rx="12.5" ry="19" fill="white"/>
      <ellipse cx="62.5" cy="65" rx="12.5" ry="19" fill="white"/>
    </svg>`;
  }

  /**
   * Show and update player contributions leaderboard for the specified planet
   * @param {string} planetName - The name of the planet to show contributions for
   * @private
   */
  updatePlayerContributions(planetName) {
    // Get the container element
    const container = document.getElementById('contributionsList');
    if (!container) return;
    
    // Clear existing items
    container.innerHTML = '';
    
    // Find all players assigned to this planet
    const planetPlayers = this.playerAssignments.filter(assignment => 
      assignment.planetName.toLowerCase() === planetName.toLowerCase()
    );
    
    // Get current player ID
    const currentPlayerId = networkManager.authManager.getCurrentUserId();
    
    // If no players on this planet, show placeholder
    if (planetPlayers.length === 0) {
      const item = document.createElement('div');
      item.className = 'contribution-item';
      item.innerHTML = '<span>No players on this planet</span>';
      container.appendChild(item);
      return;
    }
    
    // Get the contributions for this planet
    const contributions = this.rocketContributions[planetName] || new Map();
    
    // Create an array combining all players with their contributions
    const contributionsArray = planetPlayers.map(player => {
      const tempName = player.username || `Anon ${player.sessionId}`;
      // Get contribution count or 0 if none
      const clicks = contributions.get(tempName) || 0;
      return [tempName, clicks, player];
    });
    
    // Sort by contribution count (highest first)
    contributionsArray.sort((a, b) => b[1] - a[1]);
    
    // Create an item for each player
    contributionsArray.forEach(([tempName, clicks, assignment]) => {
      const item = document.createElement('div');
      item.className = 'contribution-item';
      
      // Try to get player name or use session ID
      let playerName = tempName;
      
      // Check if this is the current player
      const isCurrentPlayer = assignment.sessionId === currentPlayerId;
      
      // Safely get player color from assignment
      const playerColor = assignment.sphereBot && assignment.sphereBot.color ? assignment.sphereBot.color : '#FFFFFF';
      
      // Get the player icon SVG from the SphereBot or use a default
      let iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="' + playerColor + '"/></svg>';
      if (assignment.sphereBot && typeof assignment.sphereBot.getIcon === 'function') {
        iconSvg = assignment.sphereBot.getIcon();
      }
      
      // Create player icon element
      const iconElement = document.createElement('div');
      iconElement.className = 'player-icon';
      iconElement.innerHTML = iconSvg;
      
      // Create player name element with color
      const nameElement = document.createElement('div');
      nameElement.className = `player-name ${isCurrentPlayer ? 'player-name-current' : ''}`;
      nameElement.textContent = playerName;
      nameElement.style.color = playerColor;
      
      // Create clicks element
      const clicksElement = document.createElement('div');
      clicksElement.className = 'player-clicks';
      clicksElement.textContent = clicks.toString();
      
      // Create player info container (for icon and name)
      const playerInfoElement = document.createElement('div');
      playerInfoElement.className = 'player-info';
      playerInfoElement.appendChild(iconElement);
      playerInfoElement.appendChild(nameElement);
      
      // Add elements to item
      item.appendChild(playerInfoElement);
      item.appendChild(clicksElement);
      
      // Add item to container
      container.appendChild(item);
    });
  }
  
  /**
   * Show player contributions panel
   * @param {string} planetName - The name of the planet to show contributions for
   * @private
   */
  showPlayerContributions(planetName) {
    
    // Update the contributions list
    this.updatePlayerContributions(planetName);
    
    // Show the panel
    const panel = document.getElementById('playerContributions');
    if (panel) {
      panel.style.display = 'block';
    }
  }
} 