import { createNoise3D } from 'simplex-noise';

/**
 * Handles terrain generation using Simplex Noise
 * @class
 */
export class SimplexTerrain {
  /**
   * Create a new SimplexTerrain instance
   * @constructor
   */
  constructor(seed = 42) {
    // Use a fixed seed for consistent terrain generation between refreshes
    this.seed = seed;
    
    // We can't directly seed the simplex-noise library, but we can
    // use consistent offset values based on the seed to achieve similar effect
    this.seedOffsets = {
      x: Math.cos(seed) * 10000,
      y: Math.sin(seed) * 10000,
      z: Math.tan(seed) * 10000
    };
    
    // Create 3D noise function
    this.noise3D = createNoise3D();
    console.log(`SimplexTerrain initialized with seed: ${seed}`);
    
    // Test the noise function
    const testValue = this.getNoise(0, 0, 0);
    console.log('Test noise value at (0,0,0):', testValue);
    
    // Cache for region values to improve performance
    this.regionCache = new Map();
  }
  
  /**
   * Get a noise value at the specified coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   * @param {number} [scale=1] - Scale factor
   * @returns {number} - Noise value between -1 and 1
   */
  getNoise(x, y, z, scale = 1) {
    // Apply seed offsets to coordinates for consistent noise between refreshes
    const seedX = x * scale + this.seedOffsets.x;
    const seedY = y * scale + this.seedOffsets.y;
    const seedZ = z * scale + this.seedOffsets.z;
    
    return this.noise3D(seedX, seedY, seedZ);
  }
  
  /**
   * Get a cached region value or compute it if not cached
   * @param {string} key - Cache key (typically coordinates)
   * @param {function} computeFunc - Function to compute value if not in cache
   * @returns {number} - Cached or computed value
   */
  getCachedValue(key, computeFunc) {
    if (!this.regionCache.has(key)) {
      this.regionCache.set(key, computeFunc());
    }
    return this.regionCache.get(key);
  }
  
  /**
   * Generate a region value for a point on the sphere
   * @param {number} nx - Normalized X coordinate
   * @param {number} ny - Normalized Y coordinate
   * @param {number} nz - Normalized Z coordinate
   * @param {number} regionScale - Scale for region noise (should be much lower than terrain scale)
   * @returns {number} - Region value between 0 and 1
   */
  getRegionValue(nx, ny, nz, regionScale) {
    // Use very low frequency noise for regions
    const key = `${nx.toFixed(2)},${ny.toFixed(2)},${nz.toFixed(2)}`;
    return this.getCachedValue(key, () => {
      // Get base region noise
      const baseNoise = this.getNoise(nx, ny, nz, regionScale);
      
      // Transform from -1,1 to 0,1 range
      return (baseNoise + 1) * 0.5;
    });
  }
  
  /**
   * Apply region-based noise to a sphere geometry to create terrain with plains and mountains
   * @param {THREE.SphereGeometry} geometry - Sphere geometry to modify
   * @param {number} [amplitude=2] - Height of the terrain features
   * @param {number} [scale=5] - Scale of the noise pattern
   * @param {number} [baseRadius=10] - Base radius of the planet
   * @param {number} [waterLevel=9.9] - Water level radius (null for planets without water)
   * @param {string[]} [biomes=["plains", "mountains", "lakes"]] - Allowed biome types
   */
  applyNoiseToGeometry(geometry, amplitude = 2, scale = 5, baseRadius = 10, waterLevel = 9.9, biomes = ["plains", "mountains", "lakes"]) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      console.error('Invalid geometry provided');
      return;
    }
    
    console.log(`Applying noise with biomes: ${biomes.join(', ')}`);
    
    // Reset region cache for a new geometry
    this.regionCache.clear();
    
    // Get position attributes
    const positionAttribute = geometry.attributes.position;
    
    // Region scale should be much lower than terrain scale
    const regionScale = scale * 0.1;
    
    // Calculate minimum elevation required to stay above water (if water exists)
    const minElevationAboveWater = waterLevel ? (waterLevel - baseRadius + 0.1) : 0; // 0.1 is safety margin
    
    // Check for available biomes
    const hasMountains = biomes.includes("mountains");
    const hasLakes = biomes.includes("lakes") && waterLevel !== null;
    
    // For each vertex
    for (let i = 0; i < positionAttribute.count; i++) {
      // Get the vertex coordinates
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      const z = positionAttribute.getZ(i);
      
      // Calculate distance from origin (center of the sphere)
      const distance = Math.sqrt(x * x + y * y + z * z);
      
      // Normalize the coordinates to get a unit vector
      const nx = x / distance;
      const ny = y / distance;
      const nz = z / distance;
      
      // Get region value (0-1) to determine if this is plains or mountains
      const regionValue = this.getRegionValue(nx, ny, nz, regionScale);
      
      // Calculate fine detail noise using the normalized coordinates
      let detailNoise = this.getNoise(nx, ny, nz, scale);
      
      // Apply cubic smoothing to noise value to create more gentle transitions
      // This transforms the -1 to 1 range with more values clustered toward the middle
      detailNoise = Math.pow(detailNoise, 3) * 1.0; // Increased from 0.9 for fully pronounced features
      
      // Apply different noise amplitude based on region:
      // - Low values (0-0.3): Plains (very low amplitude)
      // - High values (0.7-1.0): Mountains (moderate amplitude)
      // - Mid values (0.3-0.7): Gradual transition
      let adjustedAmplitude;
      let elevationOffset = 0;
      
      if (regionValue < 0.3) {
        // Plains - very low terrain variations
        adjustedAmplitude = amplitude * 0.3; // Increased from 0.25
      } else if (regionValue > 0.7 && hasMountains) {
        // Mountains - moderate amplitude for smoother terrain
        adjustedAmplitude = amplitude * 1.1; // Increased from 0.95
        
        // If water exists, ensure mountains are always above water level
        if (waterLevel !== null && detailNoise > 0) {
          elevationOffset = Math.max(0, minElevationAboveWater - (detailNoise * adjustedAmplitude));
        }
      } else {
        // Transition zones - smoothly interpolate between plains and mountains
        if (hasMountains) {
          // Smooth blend between plains and mountains
          const blend = (regionValue - 0.3) / 0.4; // 0 to 1 across the transition
          
          // Use sinusoidal interpolation for smoother transitions
          const smoothBlend = (1 - Math.cos(blend * Math.PI)) * 0.5;
          adjustedAmplitude = amplitude * (0.3 + (smoothBlend * 0.8)); // Increased from 0.25 + 0.7
        } else {
          // For planets without mountains, just use plains values with slight variation
          adjustedAmplitude = amplitude * 0.35; // Increased from 0.3
        }
      }
      
      // Apply a global smoothing to all elevations
      // This creates more gradual transitions everywhere
      const smoothingFactor = 0.25; // Reduced from 0.3 for even less smoothing
      const smoothedNoise = detailNoise * (1 - smoothingFactor) + 
                          detailNoise * detailNoise * Math.sign(detailNoise) * smoothingFactor;
      
      // Adjust the position by adding region-based noise and elevation offset
      const adjustedDistance = distance + (smoothedNoise * adjustedAmplitude) + elevationOffset;
      
      // Update the vertex position
      positionAttribute.setX(i, nx * adjustedDistance);
      positionAttribute.setY(i, ny * adjustedDistance);
      positionAttribute.setZ(i, nz * adjustedDistance);
    }
    
    // Flag the position attribute for update
    positionAttribute.needsUpdate = true;
    
    // Recalculate normals
    geometry.computeVertexNormals();
    
    console.log('Applied smooth region-based noise to geometry with', positionAttribute.count, 'vertices');
    console.log('Created terrain with gradual transitions for all elevation changes');
  }
} 