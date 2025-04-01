import * as THREE from 'three';
import { Planet } from './Planet.js';
import { PlanetRotationControls } from '../controls/PlanetRotationControls.js';
import { Rocket } from './Rocket.js';

/**
 * Manages the planetary system with two competing planets
 * @class
 */
export class PlanetSystem {
  /**
   * Create the planetary system
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} world - The Cannon.js world
   */
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.planets = [];
    this.planetControls = [];
    this.rockets = [];
    this.playerBodies = {
      earth: [],
      mars: []
    };
    
    // Initialize planets with fixed initial rotation
    this.createPlanets();
    
    // Add rockets to north poles
    this.addRockets();
    
    console.log('Planet system initialized');
  }
  
  /**
   * Add a player body to a specific planet
   * @param {string} planetName - The name of the planet ("earth" or "mars")
   * @param {CANNON.Body} body - The physics body to add
   */
  addPlayerBody(planetName, body) {
    if (this.playerBodies[planetName]) {
      this.playerBodies[planetName].push(body);
      
      // Update the corresponding planet rotation controls
      this.updatePlanetControlsBodies(planetName);
      
      console.log(`Added player body to ${planetName}`);
    }
  }
  
  /**
   * Remove a player body from a specific planet
   * @param {string} planetName - The name of the planet ("earth" or "mars")
   * @param {CANNON.Body} body - The physics body to remove
   */
  removePlayerBody(planetName, body) {
    if (this.playerBodies[planetName]) {
      const index = this.playerBodies[planetName].indexOf(body);
      if (index !== -1) {
        this.playerBodies[planetName].splice(index, 1);
        
        // Update the corresponding planet rotation controls
        this.updatePlanetControlsBodies(planetName);
        
        console.log(`Removed player body from ${planetName}`);
      }
    }
  }
  
  /**
   * Update the rotation controls for a planet with current player bodies
   * @param {string} planetName - The name of the planet to update
   * @private
   */
  updatePlanetControlsBodies(planetName) {
    const planet = this.getPlanet(planetName);
    if (!planet) return;
    
    // Find the rotation controls for this planet
    const controls = this.planetControls.find(
      control => control.planet === planet
    );
    
    if (controls) {
      // Set the player bodies for this planet's controls
      controls.setPlayerBodies(this.playerBodies[planetName]);
    }
  }
  
  /**
   * Reset player bodies for all planet rotation controls.
   * This is typically called when reloading players.
   */
  resetPlayerBodies() {
    // Clear the stored player bodies in this system
    Object.keys(this.playerBodies).forEach(planetName => {
      this.playerBodies[planetName] = [];
    });

    // Tell each rotation control instance to clear its player bodies
    this.planetControls.forEach(controls => {
      if (typeof controls.resetPlayerBodies === 'function') {
        controls.resetPlayerBodies();
      } else {
        // Fallback if method doesn't exist: set to empty array
        const planetName = controls.planet?.name;
        if (planetName && this.playerBodies[planetName]) {
            controls.setPlayerBodies(this.playerBodies[planetName]); // Set to empty array
        }
      }
    });
    console.log('Reset player bodies for all planet controls.');
  }
  
  /**
   * Create both planets with consistent initial rotation
   * @private
   */
  createPlanets() {
    // Calculate 69% more segments for much smoother surface (20 -> 34)
    const increasedSegments = Math.round(Math.round(20 * 1.3) * 1.3);
    
    // New radius (30% smaller than 21)
    const newRadius = 15; 
    // New water sphere radius (scaled proportionally)
    const waterRadius = 14.85; // Simplified: 15 * (14.85 / 15)
    // New planet positions (separation = 2 * radius)
    const planetSeparation = 30;

    // --- Define Biome Colors ---
    const earthColors = {
      water: new THREE.Color(0x1a8bb9),   // Blue for water/lakes
      plains: new THREE.Color(0x98bf6b), // Green for plains
      mountains: new THREE.Color(0xaaaaaa), // Gray for mountains
      snow: new THREE.Color(0xffffff)      // White for snow caps
    };

    const marsColors = {
      // No water on Mars
      plains: new THREE.Color(0xD87F57),    // Dusty orange/light reddish-brown
      mountains: new THREE.Color(0x8B4513), // Darker, rockier reddish-brown
      snow: new THREE.Color(0xFFCCAA)       // Very light rusty/pinkish for high altitude/ice
    };
    // --- End Biome Colors ---

    // Create first planet (Earth)
    const earth = new Planet(this.scene, this.world, {
      radius: newRadius,
      segments: increasedSegments,
      position: new THREE.Vector3(-planetSeparation, 0, 0), // Position left
      color: 0x888888, // Base color (used as fallback)
      noiseAmplitude: 0.8, 
      noiseScale: 8,    
      name: "earth",
      waterRadius: waterRadius, 
      biomes: ["plains", "mountains", "lakes"], 
      biomeColors: earthColors // Pass Earth's biome colors
    });
    
    // Create second planet (Mars)
    const mars = new Planet(this.scene, this.world, {
      radius: newRadius,
      segments: increasedSegments,
      position: new THREE.Vector3(planetSeparation, 0, 0), // Position right
      color: 0xff8e5e, // Base color (used as fallback)
      noiseAmplitude: 0.7, 
      noiseScale: 8,
      name: "mars",
      waterRadius: null, 
      biomes: ["plains", "mountains"], 
      biomeColors: marsColors // Pass Mars' biome colors
    });
    
    // Set fixed initial rotation
    earth.mesh.rotation.set(0, 0, 0);
    mars.mesh.rotation.set(0, 0, 0);
    
    // Add planets to the array
    this.planets.push(earth);
    this.planets.push(mars);
    
    // Add water sphere only to Earth
    this.createWaterSpheres(waterRadius);
    
    // Add rotation controls to both planets
    this.planets.forEach(planet => this.addRotationControls(planet));
    
    console.log('Both planets created with consistent initial rotation');
  }
  
  /**
   * Create water spheres for each planet
   * @private
   * @param {number} waterRadius - The radius for the water spheres
   */
  createWaterSpheres(waterRadius = 9.9) {
    // Water sphere parameters
    const waterSegments = 34; // Match the higher terrain resolution
    const waterColor = 0x1a8bb9; // Changed to cyan-blue for more Earth-like oceans
    const waterOpacity = 0.4; // Increased transparency for more realistic oceans
    
    this.planets.forEach(planet => {
      // Skip Mars (no water)
      if (planet.name === "mars") {
        console.log(`Skipping water sphere for ${planet.name}`);
        return;
      }
      
      // Create water sphere geometry
      const waterGeometry = new THREE.SphereGeometry(
        waterRadius,
        waterSegments,
        waterSegments
      );
      
      // Create transparent blue material
      const waterMaterial = new THREE.MeshPhongMaterial({
        color: waterColor,
        transparent: true,
        opacity: waterOpacity,
        side: THREE.DoubleSide
      });
      
      // Create water mesh
      const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
      waterMesh.name = `${planet.name}Water`;
      
      // Position water at the same position as the planet
      waterMesh.position.copy(planet.position);
      
      // Add to scene
      this.scene.add(waterMesh);
      
      // Store reference to water mesh in planet
      planet.waterMesh = waterMesh;
      
      console.log(`Added water sphere to ${planet.name}`);
    });
  }
  
  /**
   * Get a planet by name
   * @param {string} name - Planet name ('earth' or 'mars')
   * @returns {Planet} The planet object
   */
  getPlanet(name) {
    return this.planets.find(planet => planet.name === name);
  }
  
  /**
   * Update all planets
   */
  update(deltaTime) {
    // Update planets
    this.planets.forEach(planet => planet.update(deltaTime));
    
    // Update rotation controls for each planet
    this.planetControls.forEach(controls => controls.update());
    
    // Initial render only - position rockets correctly once
    if (!this._rocketPositionsInitialized) {
      this.updateRocketPositions();
      this._rocketPositionsInitialized = true;
    }
  }
  
  /**
   * Ensure rockets are correctly positioned relative to their planets
   * Only needed for initial positioning - after that,
   * rockets are updated by PlanetRotationControls
   */
  updateRocketPositions() {
    console.log('Initializing rocket positions');
    
    // Make sure each rocket is associated with a planet control
    this.rockets.forEach(rocket => {
      // Find which planet control this rocket belongs to
      const controls = this.planetControls.find(control => 
        control.rockets && control.rockets.includes(rocket)
      );
      
      if (controls) {
        // Get planet's current rotation
        const planetQuaternion = controls.planet.mesh.quaternion.clone();
        
        // Apply to rocket to update its position
        rocket.updateWithPlanetRotation(planetQuaternion);
      }
    });
  }
  
  /**
   * Get all planet names
   * @returns {string[]} Array of planet names
   */
  getPlanetNames() {
    return this.planets.map(planet => planet.name);
  }
  
  /**
   * Add rotation controls to a planet
   * @param {Planet} planet - The planet to add controls to
   * @private
   */
  addRotationControls(planet) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      console.error('Cannot add rotation controls: gameCanvas not found');
      return;
    }
    
    // Get camera from scene
    const camera = this.scene.getObjectByProperty('type', 'PerspectiveCamera');
    if (!camera) {
      console.error('Cannot add rotation controls: camera not found');
      return;
    }
    
    // Create and add controls
    const controls = new PlanetRotationControls(planet, this.scene, camera, canvas);
    
    // Set player bodies for this planet
    if (this.playerBodies[planet.name]) {
      controls.setPlayerBodies(this.playerBodies[planet.name]);
    }
    
    this.planetControls.push(controls);
    
    console.log(`Added rotation controls to ${planet.name}`);
  }
  
  /**
   * Add rockets at the north pole of each planet
   * @private
   */
  addRockets() {
    this.planets.forEach(planet => {
      // Calculate north pole position (top of the planet)
      const rocketPosition = new THREE.Vector3(
        planet.position.x,
        planet.position.y + planet.radius,
        planet.position.z
      );
      
      // Create a rocket at the north pole
      const rocket = new Rocket(this.scene, this.world, {
        position: rocketPosition,
        planetPosition: planet.position, // Pass planet position
        size: 1.5,
        planetName: planet.name
      });
      
      // Register the rocket with the planet for rotation
      const controls = this.planetControls.find(control => control.planet === planet);
      if (controls) {
        if (!controls.rockets) {
          controls.rockets = [];
        }
        controls.rockets.push(rocket);
      }
      
      // Store reference to the rocket
      this.rockets.push(rocket);
      
      console.log(`Added rocket to ${planet.name}'s north pole`);
    });
    
    // Immediately position rockets correctly
    this.updateRocketPositions();
  }
} 