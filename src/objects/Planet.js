import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameObject } from './GameObject.js';
import { SimplexTerrain } from '../terrain/SimplexTerrain.js';

/**
 * Planet object with visual representation and physics
 * @class
 * @extends GameObject
 */
export class Planet extends GameObject {
  /**
   * Create a new planet
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} world - The Cannon.js world
   * @param {Object} options - Planet options
   * @param {number} [options.radius=10] - Planet radius
   * @param {number} [options.segments=20] - Number of segments (resolution)
   * @param {number} [options.position] - Planet position
   * @param {number} [options.color=0x888888] - Planet color
   * @param {number} [options.noiseAmplitude=2] - Noise amplitude
   * @param {number} [options.noiseScale=5] - Noise scale
   * @param {string} [options.name="Planet"] - Planet name
   * @param {number} [options.waterRadius=9.9] - Radius of the water sphere (null for no water)
   * @param {string[]} [options.biomes=["plains", "mountains", "lakes"]] - Allowed biome types
   */
  constructor(scene, world, options = {}) {
    super(scene, world);
    
    // Define planet properties
    this.radius = options.radius || 10;
    this.segments = options.segments || 20;
    this.position = options.position || new THREE.Vector3(0, 0, 0);
    this.color = options.color || 0x888888; // Default gray as specified in step 16
    this.noiseAmplitude = options.noiseAmplitude || 2;
    this.noiseScale = options.noiseScale || 5;
    this.name = options.name || "Planet";
    this.waterRadius = options.waterRadius || 9.9; // Water level radius (null for no water)
    this.biomes = options.biomes || ["plains", "mountains", "lakes"];
    
    // Initialize terrain generator
    this.terrainGenerator = new SimplexTerrain();
    
    // Initialize the planet
    this.init();
    
    console.log(`Planet "${this.name}" created at position:`, this.position);
  }
  
  /**
   * Initialize the planet
   * @override
   */
  init() {
    this.createGeometry();
    this.applyTerrain();
    this.createMesh();
    this.createBody();
    
    this.isInitialized = true;
  }
  
  /**
   * Create the planet geometry
   * @private
   */
  createGeometry() {
    // Create a sphere geometry with the specified radius and segments
    this.geometry = new THREE.SphereGeometry(
      this.radius,
      this.segments,
      this.segments
    );
    
    console.log(`Created geometry for "${this.name}" with ${this.geometry.attributes.position.count} vertices`);
  }
  
  /**
   * Apply terrain noise to the geometry
   * @private
   */
  applyTerrain() {
    this.terrainGenerator.applyNoiseToGeometry(
      this.geometry,
      this.noiseAmplitude,
      this.noiseScale,
      this.radius,
      this.waterRadius,
      this.biomes
    );
    
    console.log(`Applied terrain to "${this.name}" with amplitude ${this.noiseAmplitude}, scale ${this.noiseScale}, and biomes: ${this.biomes.join(', ')}`);
  }
  
  /**
   * Create the planet mesh with materials based on planet type and regions
   * @private
   */
  createMesh() {
    // Get the terrain generator to access region data
    const terrainGenerator = this.terrainGenerator;
    
    // Create vertex colors for the geometry based on elevation and regions
    const positionAttribute = this.geometry.getAttribute('position');
    const colors = new Float32Array(positionAttribute.count * 3);
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    
    // Determine color palette based on planet type
    let beachColor, plainColor, lowlandColor, highlandColor, mountainColor, peakColor;
    
    if (this.name === "mars") {
      // Mars color palette (dirt browns)
      beachColor = new THREE.Color(0xb39069);      // Light sandy brown
      plainColor = new THREE.Color(0x8b6d4b);      // Medium earthy brown
      lowlandColor = new THREE.Color(0x6e583c);    // Mid-brown
      highlandColor = new THREE.Color(0x5e4a34);   // Dark soil brown
      mountainColor = new THREE.Color(0x3d2e1d);   // Very dark brown
      peakColor = new THREE.Color(0xc9b190);       // Light beige for highlights
    } else {
      // Earth color palette
      beachColor = new THREE.Color(0xd6bb74);      // Sandy beach
      plainColor = new THREE.Color(0x7d9551);      // Plains (light green)
      lowlandColor = new THREE.Color(0x8a7842);    // Lowland brown
      highlandColor = new THREE.Color(0x644e2d);   // Highland brown
      mountainColor = new THREE.Color(0x5c4425);   // Mountain brown
      peakColor = new THREE.Color(0xffffff);       // Snowy peaks
    }
    
    // Reference water color (not used directly)
    const waterColor = new THREE.Color(0x1a8bb9);  // Ocean blue
    
    // Region scale should match what's used in terrain generation
    const regionScale = this.noiseScale * 0.1;
    
    // Set vertex colors based on regions and elevation
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      const z = positionAttribute.getZ(i);
      
      // Calculate distance from center (normalized between 0-1 for elevation)
      const distance = Math.sqrt(x * x + y * y + z * z);
      
      // Normalize coordinates for sampling
      const nx = x / distance;
      const ny = y / distance;
      const nz = z / distance;
      
      // Get region value to determine if this is plains or mountains
      const regionValue = terrainGenerator.getRegionValue(nx, ny, nz, regionScale);
      
      // Normalize elevation based on base radius and noise amplitude
      const normalizedElevation = (distance - (this.radius * 0.9)) / (this.radius * 0.3);
      
      // Select color based on region and elevation
      let terrainColor = new THREE.Color();
      
      if (regionValue < 0.3) {
        // Plains regions
        if (normalizedElevation < 0.2) {
          // Low areas in plains (beaches)
          terrainColor.copy(beachColor);
        } else {
          // Plains (green for Earth, rust for Mars)
          terrainColor.copy(plainColor);
        }
      } else if (regionValue > 0.7) {
        // Mountain regions
        if (normalizedElevation < 0.3) {
          // Low areas in mountains (still use lowland color)
          terrainColor.copy(lowlandColor);
        } else if (normalizedElevation < 0.6) {
          // Highlands in mountains
          terrainColor.copy(highlandColor);
        } else {
          // Peaks in mountains
          terrainColor.copy(mountainColor);
          
          // Add snow/light coloring to highest peaks
          if (normalizedElevation > 0.8) {
            terrainColor.lerp(peakColor, (normalizedElevation - 0.8) * 5);
          }
        }
      } else {
        // Transition zones - blend between plains and mountains
        if (normalizedElevation < 0.2) {
          // Low areas in transition (beaches)
          terrainColor.copy(beachColor);
        } else if (normalizedElevation < 0.5) {
          // Middle elevations - blend plain and lowland based on region
          const blend = (regionValue - 0.3) / 0.4;
          terrainColor.copy(plainColor).lerp(lowlandColor, blend);
        } else {
          // Higher areas - blend lowland and highland based on region
          const blend = (regionValue - 0.3) / 0.4;
          terrainColor.copy(lowlandColor).lerp(highlandColor, blend);
        }
      }
      
      // Set the color in the attribute
      colorAttribute.setXYZ(i, terrainColor.r, terrainColor.g, terrainColor.b);
    }
    
    // Add the color attribute to the geometry
    this.geometry.setAttribute('color', colorAttribute);
    
    // Create material that uses vertex colors
    this.material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: this.name === "mars" ? 10 : 30, // Lower shininess for Mars
      flatShading: false, // Keep smooth shading for better appearance
    });
    
    // Create mesh with the noisy geometry and material
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = this.name;
    
    // Position the mesh
    this.mesh.position.copy(this.position);
    
    // Add to scene
    this.scene.add(this.mesh);
    
    console.log(`Added "${this.name}" mesh to scene with ${this.name === "mars" ? "Mars-like" : "Earth-like"} terrain`);
  }
  
  /**
   * Create the physics body for the planet
   * @private
   */
  createBody() {
    // Create physics shape and body
    const shape = new CANNON.Sphere(this.radius);
    
    this.body = new CANNON.Body({
      mass: 0, // Static body
      material: this.world.defaultMaterial,
      shape: shape
    });
    
    // Position the body to match the mesh
    this.body.position.copy(this.position);
    
    // Add to physics world
    this.world.addBody(this.body);
    
    console.log(`Added physics body for "${this.name}"`);
  }
  
  /**
   * Toggle wireframe mode on the material
   * @param {boolean} enabled - Whether wireframe should be enabled
   */
  toggleWireframe(enabled) {
    if (this.material) {
      this.material.wireframe = enabled;
    }
  }
  
  /**
   * Update the noise parameters and regenerate terrain
   * @param {number} amplitude - New noise amplitude
   * @param {number} scale - New noise scale
   */
  updateTerrain(amplitude, scale) {
    this.noiseAmplitude = amplitude;
    this.noiseScale = scale;
    
    // Re-create geometry
    this.geometry.dispose();
    this.createGeometry();
    this.applyTerrain();
    
    // Update mesh with new geometry
    this.mesh.geometry = this.geometry;
    
    console.log(`Updated terrain for "${this.name}" with new parameters`);
  }
  
  /**
   * Update the planet's position and rotation
   * Called every frame by the game loop
   * @override
   */
  update() {
    // Update the mesh from the physics body if needed
    if (this.body && this.mesh) {
      // Update the mesh position from the physics body
      this.mesh.position.copy(this.body.position);
      
      // Update water mesh if present
      if (this.waterMesh) {
        this.waterMesh.position.copy(this.mesh.position);
      }
      
      // Ensure the matrix is updated for rotation changes
      this.mesh.matrixWorldNeedsUpdate = true;
    }
  }
} 