import * as THREE from 'three';

/**
 * Manages lighting for the scene
 * @class
 */
export class LightingSystem {
  /**
   * Create a new lighting system
   * @param {THREE.Scene} scene - The scene to add lights to
   */
  constructor(scene) {
    this.scene = scene;
    this.lights = {};
    
    // Initialize standard lighting setup
    this.setupLighting();
    
    console.log('LightingSystem initialized');
  }
  
  /**
   * Set up standard lighting for the scene
   * @private
   */
  setupLighting() {
    // Add ambient light (step 17)
    this.ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(this.ambientLight);
    this.lights.ambient = this.ambientLight;
    console.log('Step 17: Added ambient light with color 0x404040');
    
    // Add point light (step 18)
    this.pointLight = new THREE.PointLight(0xffffff, 1, 100);
    this.pointLight.position.set(50, 50, 50);
    this.scene.add(this.pointLight);
    this.lights.point = this.pointLight;
    console.log('Step 18: Added point light at position (50, 50, 50)');
    
    // Store the initial settings for testing/verification
    this.initialSettings = {
      ambientColor: 0x404040,
      pointLightPosition: new THREE.Vector3(50, 50, 50),
      pointLightIntensity: 1,
      pointLightDistance: 100
    };
  }
  
  /**
   * Adjust ambient light intensity
   * @param {number} intensity - New intensity (0.0 to 1.0)
   */
  setAmbientIntensity(intensity) {
    if (this.ambientLight) {
      this.ambientLight.intensity = intensity;
    }
  }
  
  /**
   * Change ambient light color
   * @param {number} color - New color as hex
   */
  setAmbientColor(color) {
    if (this.ambientLight) {
      this.ambientLight.color.setHex(color);
    }
  }
  
  /**
   * Adjust point light properties
   * @param {Object} properties - Properties to update
   * @param {THREE.Vector3} [properties.position] - New position
   * @param {number} [properties.intensity] - New intensity
   * @param {number} [properties.distance] - New distance
   */
  adjustPointLight(properties = {}) {
    if (this.pointLight) {
      if (properties.position) {
        this.pointLight.position.copy(properties.position);
      }
      
      if (properties.intensity !== undefined) {
        this.pointLight.intensity = properties.intensity;
      }
      
      if (properties.distance !== undefined) {
        this.pointLight.distance = properties.distance;
      }
      
      console.log('Updated point light properties');
    }
  }
  
  /**
   * Verify that step 17 is properly implemented
   * @returns {boolean} Whether ambient lighting is correctly set up
   */
  verifyAmbientLight() {
    // Check if ambient light exists and has the correct color
    if (!this.ambientLight) {
      console.error('Ambient light not found');
      return false;
    }
    
    // Check color (allowing for slight differences in representation)
    const colorHex = this.ambientLight.color.getHex();
    const isCorrectColor = colorHex === this.initialSettings.ambientColor;
    
    if (!isCorrectColor) {
      console.error(`Ambient light has incorrect color: 0x${colorHex.toString(16)}, expected: 0x${this.initialSettings.ambientColor.toString(16)}`);
      return false;
    }
    
    console.log('✓ Ambient light verified with correct color: 0x404040');
    return true;
  }
  
  /**
   * Verify that step 18 is properly implemented
   * @returns {boolean} Whether point lighting is correctly set up
   */
  verifyPointLight() {
    // Check if point light exists
    if (!this.pointLight) {
      console.error('Point light not found');
      return false;
    }
    
    // Check point light properties
    const positionMatches = this.pointLight.position.equals(this.initialSettings.pointLightPosition);
    const intensityMatches = this.pointLight.intensity === this.initialSettings.pointLightIntensity;
    const distanceMatches = this.pointLight.distance === this.initialSettings.pointLightDistance;
    
    if (!positionMatches) {
      console.error(`Point light has incorrect position: (${this.pointLight.position.x}, ${this.pointLight.position.y}, ${this.pointLight.position.z}), expected: (${this.initialSettings.pointLightPosition.x}, ${this.initialSettings.pointLightPosition.y}, ${this.initialSettings.pointLightPosition.z})`);
      return false;
    }
    
    if (!intensityMatches) {
      console.error(`Point light has incorrect intensity: ${this.pointLight.intensity}, expected: ${this.initialSettings.pointLightIntensity}`);
      return false;
    }
    
    if (!distanceMatches) {
      console.error(`Point light has incorrect distance: ${this.pointLight.distance}, expected: ${this.initialSettings.pointLightDistance}`);
      return false;
    }
    
    console.log('✓ Point light verified with correct properties');
    return true;
  }
} 