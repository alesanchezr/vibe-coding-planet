import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameObject } from './GameObject.js';
import { SimplexTerrain } from '../terrain/SimplexTerrain.js';
import { Atmosphere } from './Atmosphere.js';

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
   * @param {Object} [options.biomeColors={}] - Object containing colors for different biomes
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
    this.waterRadius = options.waterRadius === undefined ? (options.radius ? options.radius * 0.99 : 9.9) : options.waterRadius; // Adjusted default based on radius
    this.biomes = options.biomes || ["plains", "mountains", "lakes"];
    this.biomeColors = options.biomeColors || {}; // Store biome colors
    
    // Use fixed seed based on planet name for consistent terrain between refreshes
    const planetSeed = this.name === "earth" ? 123456 : 789012;
    
    // Initialize terrain generator with planet-specific seed
    this.terrainGenerator = new SimplexTerrain(planetSeed);
    
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
    
    if (!this.loadTerrainData()) {
      this.applyTerrain();
      this.saveTerrainData();
    }
    
    this.createMesh();
    this.createBody();
    
    // Create atmosphere after mesh and body
    this.createAtmosphere();
    
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
   * Save terrain data to localStorage
   * @private
   */
  saveTerrainData() {
    try {
      // Get position data
      const positionAttribute = this.geometry.getAttribute('position');
      const positionArray = Array.from(positionAttribute.array);
      
      // Create a storage key unique to this planet and its parameters
      const storageKey = `planet_terrain_${this.name}_${this.radius}_${this.segments}`;
      
      // Save to localStorage (convert to JSON string)
      localStorage.setItem(storageKey, JSON.stringify(positionArray));
      
      console.log(`Terrain data saved for "${this.name}"`);
      return true;
    } catch (error) {
      console.error(`Error saving terrain data for "${this.name}":`, error);
      return false;
    }
  }
  
  /**
   * Save color data to localStorage
   * @private
   */
  saveColorData() {
    try {
      // Get color data (this will be called after createMesh() has set the colors)
      const colorAttribute = this.geometry.getAttribute('color');
      if (!colorAttribute) {
        console.warn(`No color attribute found for "${this.name}"`);
        return false;
      }
      
      const colorArray = Array.from(colorAttribute.array);
      
      // Create a storage key unique to this planet's colors
      const storageKey = `planet_colors_${this.name}_${this.radius}_${this.segments}`;
      
      // Save to localStorage (convert to JSON string)
      localStorage.setItem(storageKey, JSON.stringify(colorArray));
      
      console.log(`Color data saved for "${this.name}"`);
      return true;
    } catch (error) {
      console.error(`Error saving color data for "${this.name}":`, error);
      return false;
    }
  }
  
  /**
   * Load terrain data from localStorage
   * @private
   * @returns {boolean} True if data was loaded successfully
   */
  loadTerrainData() {
    try {
      // Create a storage key unique to this planet and its parameters
      const storageKey = `planet_terrain_${this.name}_${this.radius}_${this.segments}`;
      
      // Try to get saved data
      const savedData = localStorage.getItem(storageKey);
      
      if (!savedData) {
        console.log(`No saved terrain found for "${this.name}"`);
        return false;
      }
      
      // Parse the data back to an array
      const positionArray = JSON.parse(savedData);
      
      // Apply to geometry
      const positionAttribute = this.geometry.getAttribute('position');
      
      // Make sure the arrays are the same length
      if (positionArray.length !== positionAttribute.array.length) {
        console.warn(`Saved terrain data doesn't match current geometry (${positionArray.length} vs ${positionAttribute.array.length})`);
        return false;
      }
      
      // Copy the saved positions back to the geometry
      for (let i = 0; i < positionArray.length; i++) {
        positionAttribute.array[i] = positionArray[i];
      }
      
      // Mark the attribute as needing update
      positionAttribute.needsUpdate = true;
      
      // Recompute normals
      this.geometry.computeVertexNormals();
      
      console.log(`Loaded saved terrain for "${this.name}"`);
      return true;
    } catch (error) {
      console.error(`Error loading terrain data for "${this.name}":`, error);
      return false;
    }
  }
  
  /**
   * Load color data from localStorage
   * @private
   * @returns {boolean} True if color data was loaded successfully
   */
  loadColorData() {
    try {
      // Create a storage key unique to this planet's colors
      const storageKey = `planet_colors_${this.name}_${this.radius}_${this.segments}`;
      
      // Try to get saved color data
      const savedData = localStorage.getItem(storageKey);
      
      if (!savedData) {
        console.log(`No saved color data found for "${this.name}"`);
        return false;
      }
      
      // Parse the data back to an array
      const colorArray = JSON.parse(savedData);
      
      // Create color attribute if it doesn't exist yet
      if (!this.geometry.getAttribute('color')) {
        const colors = new Float32Array(colorArray);
        const colorAttribute = new THREE.BufferAttribute(colors, 3);
        this.geometry.setAttribute('color', colorAttribute);
      } else {
        // Apply to existing color attribute
        const colorAttribute = this.geometry.getAttribute('color');
        
        // Make sure the arrays are the same length
        if (colorArray.length !== colorAttribute.array.length) {
          console.warn(`Saved color data doesn't match current geometry (${colorArray.length} vs ${colorAttribute.array.length})`);
          return false;
        }
        
        // Copy the saved colors back to the geometry
        for (let i = 0; i < colorArray.length; i++) {
          colorAttribute.array[i] = colorArray[i];
        }
        
        // Mark the attribute as needing update
        colorAttribute.needsUpdate = true;
      }
      
      console.log(`Loaded saved color data for "${this.name}"`);
      return true;
    } catch (error) {
      console.error(`Error loading color data for "${this.name}":`, error);
      return false;
    }
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
    
    // Recompute normals after applying noise
    this.geometry.computeVertexNormals();
    
    console.log(`Applied terrain to "${this.name}" with amplitude ${this.noiseAmplitude}, scale ${this.noiseScale}, and biomes: ${this.biomes.join(', ')}`);
  }
  
  /**
   * Create the planet mesh
   * @private
   */
  createMesh() {
    // Apply colors to the geometry if we have biome data (and not loading colors)
    if (!this.loadColorData()) {
      this.applyBiomeColors();
    }
    
    // Create a mesh using the geometry
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false // Changed to false for smoother lighting, critical bugfix (step 9)
    });
    
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = this.name;
    
    // Enable shadows
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Store the radius in userData for path finding and other systems
    this.mesh.userData.radius = this.radius;
    
    // Position the mesh
    this.mesh.position.copy(this.position);
    
    // Add to scene
    this.scene.add(this.mesh);
    
    // Save color data (for restoration on reload)
    this.saveColorData();
    
    console.log(`Created mesh for "${this.name}" at position:`, this.position);
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
   * Create the atmosphere for the planet
   * @private
   */
  createAtmosphere() {
    // Determine atmosphere color based on planet type
    const atmosphereColor = this.name === 'earth' ? 0x87CEEB : 0xEAA189; // Light blue for Earth, reddish for Mars
    const atmosphereThickness = this.name === 'earth' ? 0.8 : 0.5; // Thicker for Earth
    const atmosphereOpacity = this.name === 'earth' ? 0.6 : 0.4; // More opaque for Earth

    this.atmosphere = new Atmosphere({
        radius: this.radius * 1.15, // Start atmosphere higher above the planet surface (was 1.05)
        thickness: atmosphereThickness, // Keep thickness the same for now
        particles: 4879, // Reduced particle count by 30% (was 6970)
        minParticleSize: 20, // Reverted min size (was 40)
        maxParticleSize: 40, // Reverted max size (was 80)
        color: 0xffffff, // Use white color for the clouds
        opacity: atmosphereOpacity,
        density: 0.6,
        scale: 8,
        speed: 0.01, // Reduced speed for slower cloud movement (was 0.03)
        // Get light direction from the scene's sun light if available
        lightDirection: this.scene.getObjectByName('SunLight')?.position.clone().normalize() || new THREE.Vector3(1, 1, 1).normalize(),
    });

    // Position the atmosphere at the planet's center (relative to the parent mesh)
    // this.atmosphere.position.copy(this.position); // No longer needed, position is relative to parent (mesh)

    // Add atmosphere directly to the planet mesh instead of the scene
    if (this.mesh) {
        this.mesh.add(this.atmosphere);
    } else {
        console.warn(`Cannot add atmosphere to ${this.name}: mesh not created yet.`);
        // Fallback: add to scene (though it won't rotate with planet)
        this.scene.add(this.atmosphere);
    }

    console.log(`Created atmosphere for "${this.name}" and added to planet mesh`);
  }
  
  /**
   * Apply biome-based colors to the geometry vertices
   * @private
   */
  applyBiomeColors() {
    if (!this.geometry || !this.geometry.attributes || !this.geometry.attributes.position) {
      console.error(`Cannot apply biome colors: invalid geometry for ${this.name}`);
      return;
    }

    const positionAttribute = this.geometry.getAttribute('position');
    const vertexCount = positionAttribute.count;
    const colors = new Float32Array(vertexCount * 3); // RGB for each vertex

    // Select the appropriate color palette (now passed in via constructor)
    const colorsBiome = this.biomeColors;
    const hasWater = this.waterRadius !== null && colorsBiome.water !== undefined;

    // Use the same region scale as applyTerrain for consistency
    const regionScale = this.noiseScale * 0.1;

    for (let i = 0; i < vertexCount; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      const z = positionAttribute.getZ(i);

      const distance = Math.sqrt(x * x + y * y + z * z);
      const elevation = distance - this.radius;

      // Normalized coordinates for noise sampling
      const nx = x / distance;
      const ny = y / distance;
      const nz = z / distance;

      let color;

      // Determine biome based on elevation and potentially region noise
      if (hasWater && distance < this.waterRadius) {
          // Below water level (only if water exists and color is defined)
          color = colorsBiome.water;
      } else {
          // Above water level or no water
          const regionValue = this.terrainGenerator.getRegionValue(nx, ny, nz, regionScale);
          const isMountainBiome = regionValue > 0.7 && this.biomes.includes("mountains");

          if (isMountainBiome) {
              // Mountains
              if (elevation > this.noiseAmplitude * 0.6 && colorsBiome.snow) {
                  color = colorsBiome.snow;
              } else if (colorsBiome.mountains) {
                  color = colorsBiome.mountains;
              }
          } else {
              // Plains or transition zones
              if (colorsBiome.plains) {
                  color = colorsBiome.plains;
              }
          }
      }

      // Fallback color if biome logic didn't assign one or color is missing
      if (!color) {
          color = new THREE.Color(this.color); // Use the base planet color
      }

      // Set color in the buffer
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    // Add or update the color attribute
    if (!this.geometry.getAttribute('color')) {
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    } else {
        this.geometry.getAttribute('color').array = colors;
        this.geometry.getAttribute('color').needsUpdate = true;
    }

    console.log(`Applied biome colors to ${this.name} using provided palette`);

    // Save the newly generated color data so it doesn't need regeneration on next load
    this.saveColorData();
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
  update(deltaTime) {
    // Update the mesh from the physics body if needed
    if (this.body && this.mesh) {
      // Update the mesh position from the physics body
      this.mesh.position.copy(this.body.position);
      
      // Update water mesh if present
      if (this.waterMesh) {
        this.waterMesh.position.copy(this.mesh.position);
      }
      
      // Update atmosphere animation
      if (this.atmosphere) {
        // this.atmosphere.position.copy(this.mesh.position); // No longer needed, inherits position from mesh
        this.atmosphere.update(deltaTime); // Pass deltaTime for animation
      }
      
      // Ensure the matrix is updated for rotation changes
      this.mesh.matrixWorldNeedsUpdate = true;
    }
  }
  
  /**
   * Dispose of planet resources
   * @override
   */
  dispose() {
    // Dispose geometry and material
    if (this.geometry) this.geometry.dispose();
    if (this.mesh && this.mesh.material) this.mesh.material.dispose();
    
    // Remove mesh from scene
    if (this.mesh) this.scene.remove(this.mesh);
    
    // Dispose water mesh if it exists
    if (this.waterMesh) {
        if (this.waterMesh.geometry) this.waterMesh.geometry.dispose();
        if (this.waterMesh.material) this.waterMesh.material.dispose();
        this.scene.remove(this.waterMesh);
    }

    // Dispose atmosphere if it exists
    if (this.atmosphere) {
        this.atmosphere.dispose();
        // Remove from parent mesh (or scene if fallback was used)
        if (this.atmosphere.parent) {
            this.atmosphere.parent.remove(this.atmosphere);
        } else {
             this.scene.remove(this.atmosphere);
        }
    }

    // Remove body from physics world
    if (this.body) this.world.removeBody(this.body);

    console.log(`Disposed resources for planet "${this.name}"`);
  }
} 