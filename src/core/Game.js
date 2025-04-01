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
import { supabase } from '../network/supabase-client.js';
import gsap from 'gsap'; // Import GSAP

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
    // Initialize particle effects array
    this.particleEffects = [];
    
    // Player management
    this.playerCount = 0;
    this.playerAssignments = [];
    
    // Planet interaction
    this.focusedPlanet = null;
    
    // Initialize core systems
    this.initRenderer();
    this.initPhysics();
    
    // Initialize lighting system (step 17)
    this.initLighting();
    
    // Initialize planet system (step 16)
    this.initPlanetSystem();
    
    // Initialize player structures dynamically based on planets
    this.playerBodies = {};
    this.planetSystem.getPlanetNames().forEach(planetName => {
      this.playerBodies[planetName] = [];
    });
    
    // Set up player system
    this.initPlayerInstancing();
    
    // Initialize movement and sound systems
    this.initMovementSystem();
    
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

    // Disable auto-rotation of planets on refresh
    this.disablePlanetAutoRotation();
    
    // Initialize click controls for planets
    this.initPlanetClickControls();
    
    console.log('Planet system added to game with fixed initial rotation');
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
    if (this.camera) {
      // Position the camera directly in front for proper perspective
      // Adjust Z position to make planets appear ~20% larger (57 / 1.2)
      this.camera.position.set(0, 0, 48); // Reduced Z distance (was 57)
      // Look at the center point between planets
      this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      
      // Disable click controls when not focused on a single planet
      if (this.planetClickControls) {
        this.planetClickControls.setEnabled(false);
      }
      
      // Clear focused planet tracking
      this.focusedPlanet = null;
      
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
      
      // Track which planet the camera is focused on
      this.focusedPlanet = planet.name;
      
      console.log('Camera positioned to view planet at:', planetPos);
    }
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
    
    // Listen for new players joining via network
    networkManager.on('onPlayerJoined', (playerId, playerData, isTestPlayer) => {
      this.handlePlayerSpawn(playerId, playerData, isTestPlayer);
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

      // Create player physics body with the assigned color
      const spawnResult = this.spawnPlayer(planetName, planetPosition, color);

      // Store the assignment
      this.playerAssignments.push({
        playerId: this.playerCount,
        planetName: planetName,
        instanceId: spawnResult.instanceIndex,
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
    // Increment time step
    this.time += this.FIXED_TIME_STEP;
    
    // Update physics world
    this.physics.update(this.FIXED_TIME_STEP);
    
    // Apply planet gravity to player objects
    this.applyPlanetGravity();
    
    // Sync player positions with server
    this.syncPlayerPositions();
    
    // Limit player velocities to prevent excessive speed
    this.limitPlayerVelocities();
    
    // Update the movement manager if it exists
    if (this.movementManager) {
      this.movementManager.update(this.FIXED_TIME_STEP);
    }
    
    // Update all game objects
    for (const object of this.gameObjects) {
      if (object.update) {
        // Pass deltaTime (FIXED_TIME_STEP) to objects that need it (like PlanetSystem)
        object.update(this.FIXED_TIME_STEP); 
      }
    }
    
    // Update click marker animations if controls exist
    if (this.planetClickControls) {
      this.planetClickControls.updateMarker(this.FIXED_TIME_STEP);
    }
    
    // Update particle effects
    this.updateParticleEffects(this.FIXED_TIME_STEP);
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
    
    // Verify step 18: point lighting
    if (this.lightingSystem) {
      this.lightingSystem.verifyPointLight();
    }
  }

  /**
   * Initialize player structures for all planets
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
   * Handle buildable element click event
   * @param {THREE.Object3D} buildableObject - The buildable object that was clicked
   * @private
   */
  handleBuildableClick(buildableObject) {
    // Find the buildable element (currently only rockets)
    const buildable = this.planetSystem.rockets.find(r => 
      r.mesh === buildableObject || r.mesh.id === buildableObject.id
    );
    
    if (!buildable) {
      console.log('Could not identify which buildable element was clicked');
      return;
    }
    
    // Get the player's assigned planet
    const playerPlanet = networkManager.playerManager.currentPlanet;
    if (!playerPlanet) {
      console.log('Player is not assigned to a planet yet');
      return;
    }
    
    // Find which planet this buildable element belongs to
    let buildablePlanet = '';
    for (const planet of this.planetSystem.planets) {
      // Check the distance between buildable and planet centers to determine ownership
      const distance = buildable.position.distanceTo(planet.position);
      if (distance < 30) { // Use a reasonable threshold
        buildablePlanet = planet.name;
        break;
      }
    }
    
    console.log(`Buildable element clicked! It belongs to planet: ${buildablePlanet}`);
    
    // Only allow building on your own planet
    if (buildablePlanet !== playerPlanet) {
      console.log(`Cannot build on enemy planet - your planet is ${playerPlanet}`);
      return;
    }
    
    // TODO: Implement building mechanics here
    console.log(`Building on ${playerPlanet}...`);
    
    // Visual feedback for click
    this._showBuildableClickEffect(buildable.mesh.position.clone());
    
    // For the future implementation, we'll send a message to the server
    // networkManager.sendBuildAction(playerPlanet, buildable.type);
  }

  /**
   * Show visual feedback when a buildable element is clicked
   * @param {THREE.Vector3} position - Position of the buildable element
   * @private
   */
  _showBuildableClickEffect(position) {
    // Create a simple pulse effect at the buildable element
    const effectGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const effectMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.7
    });
    
    const effect = new THREE.Mesh(effectGeometry, effectMaterial);
    effect.position.copy(position);
    
    this.scene.add(effect);
    
    // Animate the effect
    let scale = 0.1;
    const scaleUp = () => {
      if (scale < 2) {
        scale += 0.1;
        effect.scale.set(scale, scale, scale);
        effect.material.opacity = 0.7 * (1 - scale/2);
        
        requestAnimationFrame(scaleUp);
      } else {
        // Remove the effect when animation completes
        this.scene.remove(effect);
        effectGeometry.dispose();
        effectMaterial.dispose();
      }
    };
    
    // Start the animation
    scaleUp();
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
    const planetName = playerData.planet_name;
    const playerColor = playerData.color;
    const planet = this.planetSystem.getPlanet(planetName);
    if (!planet) {
      console.warn(`Cannot spawn player ${sessionId}, planet ${planetName} not found.`);
      return;
    }

    const planetPosition = planet.position;
    const planetRadius = planet.geometry.parameters.radius;

    // 1. Determine Target Position on Surface
    let targetPosition = new THREE.Vector3();
    if (playerData.position_x != null && playerData.position_y != null && playerData.position_z != null) {
      targetPosition.set(playerData.position_x, playerData.position_y, playerData.position_z);
      // Ensure it's exactly on the surface
      const direction = targetPosition.clone().sub(planetPosition).normalize();
      targetPosition.copy(planetPosition).addScaledVector(direction, planetRadius);
    } else {
      // Generate a random surface position if none provided
      const randomSurfacePos = this._generateRandomPositionOnPlanet(planetPosition, planetRadius);
      targetPosition.set(randomSurfacePos.x, randomSurfacePos.y, randomSurfacePos.z);
      // If this is the current player, update their position in DB
      if (sessionId === networkManager.authManager.getCurrentUserId()) {
        networkManager.updateCurrentPlayerPosition(targetPosition);
      }
    }

    // 2. Determine Starting Position (Above the Planet)
    const startDirection = targetPosition.clone().sub(planetPosition).normalize();
    const startHeight = planetRadius + 30 + Math.random() * 10; // 30-40 units above surface
    const startPosition = planetPosition.clone().addScaledVector(startDirection, startHeight);

    // 3. Create the SphereBot at the START position
    // Pass the actual session ID
    const assignment = this._createSphereBot(planetName, playerColor, startPosition, sessionId);
    const playerMesh = assignment.sphereBot.mesh; // Get the mesh from SphereBot
    const playerBody = assignment.sphereBot.body; // Get the body from SphereBot

    // Ensure mesh is visible and looking towards planet initially
    playerMesh.visible = true;
    playerMesh.lookAt(planetPosition); // Look towards planet center

    // Disable physics temporarily during animation to prevent gravity fight
    const originalType = playerBody.type;
    playerBody.type = CANNON.Body.STATIC; // Make it static during animation
    playerBody.velocity.set(0, 0, 0);
    playerBody.angularVelocity.set(0, 0, 0);

    // --- Comet Trail Particle Effect --- 
    const MAX_PARTICLES = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false, // Prevent particles from obscuring each other weirdly
        blending: THREE.AdditiveBlending // Brighter where particles overlap
    });

    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(particlePoints);

    const effect = {
        points: particlePoints,
        geometry: particleGeometry,
        material: particleMaterial,
        particles: [], // Array to store individual particle data
        spawning: true, // Flag to control particle emission
        playerVelocity: new THREE.Vector3() // To track player movement direction
    };
    this.particleEffects.push(effect);
    // --- End Particle Effect Setup ---

    // 4. Animate the Fall using GSAP
    let previousPosition = startPosition.clone();
    gsap.to(playerMesh.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 0.7 + Math.random() * 1.3, // Random duration between 0.7 and 2.0 seconds
        ease: "power2.in", // Accelerate downwards
        onUpdate: () => {
            // Keep the physics body synced with the visual mesh during animation
            playerBody.position.copy(playerMesh.position);

            // --- Spawn Particles --- 
            if (effect.spawning && effect.particles.length < MAX_PARTICLES) {
                const currentPosition = playerMesh.position;
                effect.playerVelocity.copy(currentPosition).sub(previousPosition); // Velocity vector
                const speed = effect.playerVelocity.length();
                const spawnCount = Math.min(5, Math.ceil(speed * 2)); // Spawn more if moving faster
                
                for (let i = 0; i < spawnCount; i++) {
                    if (effect.particles.length >= MAX_PARTICLES) break;
                    
                    const particleLifetime = 1.0 + Math.random() * 2.0; // Double lifetime range (1.0 - 3.0s)
                    const particleVelocity = effect.playerVelocity.clone().negate().normalize(); // Opposite direction of travel
                    
                    // --- Reduce Randomness for Less Dispersion ---
                    // Add smaller upward and outward randomness
                    particleVelocity.y += 0.1 + Math.random() * 0.2; // Reduced upward push
                    particleVelocity.x += (Math.random() - 0.5) * 0.5; // Reduced sideways spread
                    particleVelocity.z += (Math.random() - 0.5) * 0.5; // Reduced forward/backward spread
                    particleVelocity.multiplyScalar(1.5 + Math.random() * 0.5); // Reduced speed variation (1.5 - 2.0)
                    // --- End Reduction ---
                    
                    // Start color (changed to white)
                    const particleColor = new THREE.Color(0xffffff); 

                    effect.particles.push({
                        position: currentPosition.clone().add(new THREE.Vector3((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1)), // Start slightly offset
                        velocity: particleVelocity,
                        color: particleColor,
                        age: 0,
                        lifetime: particleLifetime
                    });
                }
            }
            previousPosition.copy(playerMesh.position);
            // --- End Spawn Particles ---
        },
        onComplete: () => {
            console.log(`Player ${sessionId} landed.`);
            // Re-enable physics
            playerBody.type = originalType; // Restore original body type (likely DYNAMIC)
            playerBody.position.copy(targetPosition); // Ensure exact final position
            playerBody.velocity.set(0, 0, 0); // Reset velocity after animation
            playerBody.wakeUp(); // Make sure physics engine knows it's active

            // --- Stop Particle Spawning --- 
            effect.spawning = false;
            // --- End Stop Particle Spawning ---

            // 5. Trigger Hit Wave Effect
            this.createHitWaveEffect(targetPosition, playerColor);

            // Update player position in DB if it changed (e.g., from random spawn)
            // This check prevents unnecessary updates if position was already correct
            if (!playerData.position_x || targetPosition.x !== playerData.position_x) {
                if (sessionId === networkManager.authManager.getCurrentUserId()) {
                     networkManager.updateCurrentPlayerPosition(targetPosition);
                } else if (isTestPlayer) {
                     this._updateTestPlayerPosition(sessionId, targetPosition);
                }
            }
        }
    });
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
} 