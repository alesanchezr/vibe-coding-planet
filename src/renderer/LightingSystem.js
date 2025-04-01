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
    
  }
  
  /**
   * Set up standard lighting for the scene
   * @private
   */
  setupLighting() {
    // Ambient light for fill
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Lower intensity, white
    this.scene.add(this.ambientLight);
    this.lights.ambient = this.ambientLight;
    
    // Main directional light (Sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8); // Slightly less than full intensity
    sunLight.position.set(100, 100, 100); // Position: high up, right, front
    sunLight.target.position.set(0, 0, 0); // Target the origin
    this.scene.add(sunLight);
    this.scene.add(sunLight.target); // Target needs to be added too
    this.lights.sun = sunLight;

    // Configure shadows for the sun light
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; // Increase shadow map resolution
    sunLight.shadow.mapSize.height = 2048;
    // Define the shadow camera frustum (needs to encompass both planets)
    const shadowCamSize = 50; // Reduced from 60 to fit smaller scene
    sunLight.shadow.camera.left = -shadowCamSize;
    sunLight.shadow.camera.right = shadowCamSize;
    sunLight.shadow.camera.top = shadowCamSize;
    sunLight.shadow.camera.bottom = -shadowCamSize;
    sunLight.shadow.camera.near = 50; // Adjust near/far to focus shadow calculation
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.bias = -0.001; // Adjust bias to prevent shadow acne
    
    // Optional: Add a helper to visualize the shadow camera
    // const shadowHelper = new THREE.CameraHelper(sunLight.shadow.camera);
    // this.scene.add(shadowHelper);
    
    // Store the initial settings for testing/verification (updated)
    this.initialSettings = {
      ambientColor: 0xffffff,
      ambientIntensity: 0.2,
      sunPosition: new THREE.Vector3(100, 100, 100),
      sunIntensity: 0.8
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
   * Verify that step 17 is properly implemented (updated)
   * @returns {boolean} Whether ambient lighting is correctly set up
   */
  verifyAmbientLight() {
    if (!this.ambientLight) {
      console.error("Ambient light missing!");
      return false;
    }
    const colorHex = this.ambientLight.color.getHex();
    const intensity = this.ambientLight.intensity;
    const isCorrectColor = colorHex === this.initialSettings.ambientColor;
    const isCorrectIntensity = Math.abs(intensity - this.initialSettings.ambientIntensity) < 0.01;
    
    if (!isCorrectColor || !isCorrectIntensity) {
      console.error(`Ambient light incorrect. Color: 0x${colorHex.toString(16)}, Intensity: ${intensity}`);
      return false;
    }
    return true;
  }
  
  /**
   * Verify that the main directional light is set up (replaces point light verification)
   * @returns {boolean} Whether sun lighting is correctly set up
   */
  verifySunLight() {
    const sunLight = this.lights.sun;
    if (!sunLight || !(sunLight instanceof THREE.DirectionalLight)) {
        console.error("Sun DirectionalLight missing!");
        return false;
    }

    const positionMatches = sunLight.position.equals(this.initialSettings.sunPosition);
    const intensityMatches = Math.abs(sunLight.intensity - this.initialSettings.sunIntensity) < 0.01;
    const castsShadow = sunLight.castShadow === true;

    if (!positionMatches || !intensityMatches || !castsShadow) {
        console.error(`Sun light incorrect. Pos: ${sunLight.position.toArray()}, Intensity: ${sunLight.intensity}, CastsShadow: ${sunLight.castShadow}`);
        return false;
    }
    return true;
  }
} 