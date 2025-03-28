import * as THREE from 'three';
import { Planet } from './Planet.js';
import { PlanetRotationControls } from '../controls/PlanetRotationControls.js';

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
    this.playerBodies = {
      earth: [],
      mars: []
    };
    
    // Initialize planets
    this.createPlanets();
    
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
   * Create both planets
   * @private
   */
  createPlanets() {
    // Calculate 69% more segments for much smoother surface (20 -> 34)
    // First increase: 20 * 1.3 = 26
    // Second increase: 26 * 1.3 = 34 (rounded)
    const increasedSegments = Math.round(Math.round(20 * 1.3) * 1.3);
    
    // Water sphere parameters
    const waterRadius = 14.85; // Changed from 9.9 to 14.85 (50% larger)
    
    // Create first planet (Earth)
    const earth = new Planet(this.scene, this.world, {
      radius: 15, // Changed from 10 to 15 (50% larger)
      segments: increasedSegments,
      position: new THREE.Vector3(-30, 0, 0), // Increased from -20 to -30 (50% more separation)
      color: 0x888888, // Gray as specified in step 16
      noiseAmplitude: 0.8, // Reduced from 1.2 for less extreme terrain
      noiseScale: 8,    // Increased for more detailed, smaller features
      name: "earth",
      waterRadius: waterRadius, // Pass water radius for proper terrain generation
      biomes: ["plains", "mountains", "lakes"] // Earth has all biomes
    });
    
    // Create second planet (Mars) with reddish color and no water
    const mars = new Planet(this.scene, this.world, {
      radius: 15, // Changed from 10 to 15 (50% larger)
      segments: increasedSegments,
      position: new THREE.Vector3(30, 0, 0), // Increased from 20 to 30 (50% more separation)
      color: 0xff8e5e, // Changed to earthy brown color
      noiseAmplitude: 0.7, // Even lower amplitude for Mars
      noiseScale: 8,
      name: "mars",
      waterRadius: null, // No water for Mars
      biomes: ["plains", "mountains"] // Mars only has plains and mountains, no lakes
    });
    
    // Add planets to the array
    this.planets.push(earth);
    this.planets.push(mars);
    
    // Add water sphere only to Earth
    this.createWaterSpheres(waterRadius);
    
    // Add rotation controls to both planets
    this.planets.forEach(planet => this.addRotationControls(planet));
    
    console.log('Both planets created with appropriate materials and positions');
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
  update() {
    this.planets.forEach(planet => planet.update());
    
    // Update rotation controls for each planet
    this.planetControls.forEach(controls => controls.update());
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
} 