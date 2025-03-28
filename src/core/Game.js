import * as THREE from 'three';
import { SceneRenderer } from '../renderer/SceneRenderer.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PlanetGeometry } from '../terrain/PlanetGeometry.js';
import { PlanetSystem } from '../objects/PlanetSystem.js';
import { LightingSystem } from '../renderer/LightingSystem.js';
import { setupPerformanceMonitoring } from '../utils/performance.js';
import * as CANNON from 'cannon-es';
import { networkManager } from '../network/network-manager.js';

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
    // Game constants
    this.FIXED_TIME_STEP = 1/60;
    
    // Initialize game objects array
    this.gameObjects = [];
    
    // Player management
    this.playerCount = 0;
    this.playerAssignments = [];
    
    // Initialize core systems
    this.initRenderer();
    this.initPhysics();
    
    // Initialize lighting system (step 17)
    this.initLighting();
    
    // Initialize planet system (step 16)
    this.initPlanetSystem();
    
    // Initialize player structures dynamically based on planets
    this.playerInstances = {};
    this.playerBodies = {};
    this.planetSystem.getPlanetNames().forEach(planetName => {
      this.playerInstances[planetName] = null;
      this.playerBodies[planetName] = [];
    });
    
    // Set up player instancing (step 25)
    this.initPlayerInstancing();
    
    // Create test geometry for steps 14 and 15 (optional for final game)
    // this.createTestPlanetGeometries();
    
    // Set up event listeners
    this.setupEventListeners();
    
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
    this.planetSystem = new PlanetSystem(this.scene, this.world);
    
    // Add to game objects for updating
    this.gameObjects.push(this.planetSystem);
    
    // Position camera to view both planets
    this.positionCameraForPlanets();
    
    console.log('Planet system added to game');
  }
  
  /**
   * Position camera to view both planets
   * @private
   */
  positionCameraForPlanets() {
    if (this.camera) {
      // Position the camera directly in front for proper perspective
      // Removed the vertical offset (Y) which was causing the oval appearance
      this.camera.position.set(0, 0, 70);
      // Look at the center point between planets
      this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      
      console.log('Camera positioned to view both planets');
    }
  }
  
  /**
   * Position camera to view a specific planet
   * @param {Planet} planet - The planet to focus on
   * @private
   */
  cameraFollowPlanet(planet) {
    if (this.camera && planet) {
      // Position the camera to look at the planet from an angle
      const planetPos = planet.position;
      this.camera.position.set(planetPos.x + 5, planetPos.y + 20, planetPos.z + 30);
      this.camera.lookAt(planetPos);
      
      console.log('Camera positioned to view planet at:', planetPos);
    }
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    
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
    
    console.log('Event listeners registered');
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

      const currentPlanet = networkManager.playerManager.currentPlanet;
      console.log("Current planet", currentPlanet);
      if (currentPlanet) {
        // This is a rejoin - focus camera on player's position on their assigned planet
        const planet = this.planetSystem.getPlanet(currentPlanet);
        
        // Find the player's body based on session ID
        const playerId = networkManager.authManager.getCurrentUserId();
        const playerAssignment = this.playerAssignments.find(a => a.sessionId === playerId);
        
        if (playerAssignment && planet) {

          joinButton.style.display = 'none';
          // Focus camera on the player's planet
          this.cameraFollowPlanet(planet);
          
          // Ensure last_active is updated
          await networkManager.updateLastActive();
          
          console.log(`Re-joining ${currentPlanet} mission, focused camera on player's planet`);
          return;
        }
      }

      // New join flow - proceed with assignment
      // Increment player count
      this.playerCount++;

      // Join game using network manager
      const { planetName, color } = await networkManager.joinGame();
      
      // Get the planet's position
      const planetPosition = this.planetSystem.getPlanet(planetName).position;

      // Create player physics body
      const spawnResult = this.spawnPlayer(planetName, planetPosition);

      // Store the assignment
      this.playerAssignments.push({
        playerId: this.playerCount,
        planetName: planetName,
        instanceId: spawnResult.instanceId,
        bodyIndex: spawnResult.bodyIndex,
        sessionId: networkManager.authManager.getCurrentUserId()
      });

      // Update button text to show assignment
      joinButton.textContent = `Enter ${planetName} atmosphere`;
      
      console.log(`Player ${this.playerCount} assigned to ${planetName}`);
    } catch (error) {
      console.error('Failed to assign player to planet:', error);
      // Show error to player
      const joinButton = document.getElementById('joinButton');
      if (joinButton) {
        joinButton.textContent = 'Error joining game. Try again.';
        joinButton.style.backgroundColor = '#f44336'; // Red for error
      }
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
      
      // Get the planet's position
      const planetPosition = this.planetSystem.getPlanet(planetName).position;

      // Generate a fake session ID
      const fakeSessionId = `fake_${Math.random().toString(36).substring(2, 15)}`;
      const playerColor = this._generateRandomColor();

      // Assign player to planet using NetworkManager with fake session
      await networkManager.playerManager.assignToPlanet(planetName, playerColor, fakeSessionId);

      // Create player physics body
      const spawnResult = this.spawnPlayer(planetName, planetPosition);

      // Store the assignment
      this.playerAssignments.push({
        playerId: this.playerCount,
        planetName: planetName,
        instanceId: spawnResult.instanceIndex,
        bodyIndex: spawnResult.bodyIndex,
        sessionId: fakeSessionId
      });

      // Update total player count after adding test player
      await this.updateTotalPlayerCount();
      
      console.log(`Test player ${this.playerCount} spawned on ${planetName} with session ID: ${fakeSessionId}`);
    } catch (error) {
      console.error('Failed to spawn test player:', error);
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
   * Spawn a player for the specified planet
   * @param {string} planetName - The planet name ('earth' or 'mars')
   * @param {THREE.Vector3} planetPosition - The planet's position
   * @returns {Object} - The player spawn result
   * @private
   */
  spawnPlayer(planetName, planetPosition) {
    // Create a player physics body
    const radius = 0.5; // Player radius
    const shape = new CANNON.Sphere(radius);
    
    const body = new CANNON.Body({
      mass: 1, // Dynamic body with mass 1
      shape: shape,
      material: this.playerMaterial, // Use player-specific material
      linearDamping: 0.7, // Increased damping to help players settle
      angularDamping: 0.99, // Add angular damping to reduce spinning
      collisionFilterGroup: 1, // Player collision group
      fixedRotation: true // Prevent rotation to avoid weird behaviors
    });
    
    // Get planet radius (assuming 10)
    const planetRadius = 10;
    
    // Position the body above the planet - position from center + random height
    // Calculate a random position on the planet surface + some height
    const randomAngle1 = Math.random() * Math.PI * 2;
    const randomAngle2 = Math.random() * Math.PI - Math.PI/2;
    
    // Start at a point much higher above the planet surface
    const minHeight = 40; // Minimum height above surface
    const heightVariation = 1; // Random variation in height
    const spawnDistance = planetRadius + minHeight + Math.random() * heightVariation; // 30-50 units above surface
    
    // Convert spherical to cartesian coordinates
    const x = planetPosition.x + Math.cos(randomAngle1) * Math.cos(randomAngle2) * spawnDistance;
    const y = planetPosition.y + Math.sin(randomAngle2) * spawnDistance;
    const z = planetPosition.z + Math.sin(randomAngle1) * Math.cos(randomAngle2) * spawnDistance;
    
    // Set the position
    body.position.set(x, y, z);
    
    // Reduce max velocity to prevent excessive speeds
    body.maxVelocity = 40;
    
    // Add collision velocity damping callback
    body.addEventListener('collide', function(e) {
      // Only apply damping if the collision is with another player
      if (e.body.collisionFilterGroup === 1) {
        // Calculate relative velocity magnitude
        const relVel = e.contact.getImpactVelocityAlongNormal();
        
        // Apply damping proportional to velocity
        if (Math.abs(relVel) > 5) {
          const dampingFactor = 0.8;
          body.velocity.scale(dampingFactor, body.velocity);
        }
      }
    });
    
    // Add the body to the physics world
    this.world.addBody(body);
    
    // Store the body in the appropriate array
    const bodyIndex = this.playerBodies[planetName].length;
    this.playerBodies[planetName].push(body);
    
    // Register this player body with the planet system for rotation
    this.planetSystem.addPlayerBody(planetName, body);
    
    // Set up the instance in the instanced mesh
    const instanceIndex = this.playerInstances[planetName].count;
    
    // Create a matrix for the instance
    const matrix = new THREE.Matrix4();
    matrix.setPosition(body.position.x, body.position.y, body.position.z);
    
    // Set the matrix for this instance
    this.playerInstances[planetName].setMatrixAt(instanceIndex, matrix);
    
    // Increment the instance count (makes the instance visible)
    this.playerInstances[planetName].count++;
    
    // Mark instance matrices as needing update
    this.playerInstances[planetName].instanceMatrix.needsUpdate = true;
    
    console.log(`Spawned player for planet ${planetName} at position:`, body.position, 
                `body index: ${bodyIndex}, instance index: ${instanceIndex}`);
    
    return {
      bodyIndex: bodyIndex,
      instanceIndex: instanceIndex,
      body: body
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
   * Update game state for each frame
   * @private
   */
  update() {
    // Apply planet gravity to players before stepping physics
    this.applyPlanetGravity();
    
    // Step the physics world
    this.physics.update(this.FIXED_TIME_STEP);
    
    // Limit player velocities to prevent excessive speed
    this.limitPlayerVelocities();
    
    // Update all game objects
    this.gameObjects.forEach(obj => obj.update());
    
    // Sync player instances with physics bodies (step 27)
    this.syncPlayerPositions();
  }
  
  /**
   * Apply gravity from planets to players
   * @private
   */
  applyPlanetGravity() {
    // Gravity constant
    const G = 200; // Increased from 100 to 200 for faster falling
    
    // Planet radii
    const planetRadii = {
      earth: 10,
      mars: 10
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
        
        // Skip if inside planet to prevent extreme forces
        if (dist < planetRadius * 0.9) {
          // Apply outward force to push player to surface
          const outwardForce = 50;
          body.force.x -= outwardForce * dx / dist;
          body.force.y -= outwardForce * dy / dist;
          body.force.z -= outwardForce * dz / dist;
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
   * @private
   */
  syncPlayerPositions() {
    // Create reusable matrix for position updates
    const matrix = new THREE.Matrix4();
    
    // Sync players for each planet
    Object.keys(this.playerBodies).forEach(planetName => {
      // Sync players for this planet
      for (let i = 0; i < this.playerBodies[planetName].length; i++) {
        // Get the physics body
        const body = this.playerBodies[planetName][i];
        
        // Skip if body is undefined
        if (!body) continue;
        
        // Create matrix from body position
        matrix.setPosition(
          body.position.x,
          body.position.y,
          body.position.z
        );
        
        // Update the instance matrix
        this.playerInstances[planetName].setMatrixAt(i, matrix);
      }
      
      // Make sure instance count matches the number of bodies
      if (this.playerInstances[planetName].count !== this.playerBodies[planetName].length) {
        this.playerInstances[planetName].count = this.playerBodies[planetName].length;
      }
      
      // Mark matrices for update
      this.playerInstances[planetName].instanceMatrix.needsUpdate = true;
    });
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
    
    // Verify step 18: point lighting
    if (this.lightingSystem) {
      this.lightingSystem.verifyPointLight();
    }
  }

  /**
   * Initialize player instancing for all planets
   * @private
   */
  initPlayerInstancing() {
    // Create player geometry (small sphere)
    const playerGeometry = new THREE.SphereGeometry(0.5, 12, 12);
    
    // Max number of player instances per planet
    const maxInstances = 100;
    
    // Create instanced mesh for each planet's players
    this.planetSystem.getPlanetNames().forEach(planetName => {
      // Create material with unique color for each planet
      const material = new THREE.MeshBasicMaterial({ 
        color: planetName === 'earth' ? 0xff3333 : 0x3333ff // Default colors, can be customized
      });
      
      // Create instanced mesh
      this.playerInstances[planetName] = new THREE.InstancedMesh(
        playerGeometry,
        material,
        maxInstances
      );
      this.playerInstances[planetName].name = `${planetName.charAt(0).toUpperCase() + planetName.slice(1)}Players`;
      this.playerInstances[planetName].frustumCulled = false;
      this.playerInstances[planetName].count = 0;
      this.scene.add(this.playerInstances[planetName]);
    });
    
    console.log('Player instancing initialized for all planets');
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
      
      // Update live player count
      const livePlayerCountElement = document.getElementById('livePlayerCount');
      if (livePlayerCountElement) {
        livePlayerCountElement.textContent = activePlayers.length;
      }
      
      this.updateTotalPlayerCount();
      
      // Reset player arrays and state
      this.playerBodies = {};
      Object.keys(this.playerInstances).forEach(planetName => {
        this.playerBodies[planetName] = [];
        if (this.playerInstances[planetName]) {
          this.playerInstances[planetName].count = 0;
        }
      });
      this.playerAssignments = [];
      this.playerCount = 0;
      
      // Group players by planet and spawn them
      const playersByPlanet = {};
      
      // Group players by planet
      for (const player of activePlayers) {
        const planetName = player.planet_name;
        if (!playersByPlanet[planetName]) {
          playersByPlanet[planetName] = [];
        }
        playersByPlanet[planetName].push(player);
      }
      
      // Spawn players for each planet
      for (const planetName in playersByPlanet) {
        const players = playersByPlanet[planetName];
        
        // Skip if we don't have this planet initialized in our system
        if (!this.playerInstances[planetName]) {
          console.warn(`Skipping players for unknown planet: ${planetName}`);
          continue;
        }
        
        const planetPosition = this.planetSystem.getPlanet(planetName).position;
        
        for (const player of players) {
          // Increment player count
          this.playerCount++;
          
          // Create player physics body and get spawn result
          const spawnResult = this.spawnPlayer(planetName, planetPosition);
          
          // Store the assignment
          this.playerAssignments.push({
            playerId: this.playerCount,
            planetName: planetName,
            instanceId: spawnResult.instanceIndex,
            bodyIndex: spawnResult.bodyIndex,
            sessionId: player.session_id
          });
        }
        
        // Force update instance matrices
        this.playerInstances[planetName].instanceMatrix.needsUpdate = true;
      }
      
    } catch (error) {
      console.error('Failed to load active players:', error);
    }
  }

  /**
   * Update the total player count display
   */
  async updateTotalPlayerCount() {
    try {
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
} 