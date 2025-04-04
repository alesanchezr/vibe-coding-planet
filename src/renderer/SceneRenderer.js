import * as THREE from 'three';

/**
 * Handles Three.js scene setup, rendering, and camera management
 * Follows the threejs-rendering-rules
 * @class
 */
export class SceneRenderer {
  /**
   * Create a new SceneRenderer
   * @constructor
   */
  constructor() {
    this.initScene();
    this.initCamera();
    this.initRenderer();
    
    // Set up initial rendering
    this.render();
    
  }
  
  /**
   * Initialize the Three.js scene
   * @private
   */
  initScene() {
    this.scene = new THREE.Scene();
    
    // NOTE: All game lighting is now managed by LightingSystem.
    // Remove obsolete lights previously here:
    // this.ambientLight = new THREE.AmbientLight(0x404040);
    // this.scene.add(this.ambientLight);
    // const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    // directionalLight.position.set(0, 0, 50);
    // this.scene.add(directionalLight);
    // const sideLight = new THREE.DirectionalLight(0xffffff, 0.8);
    // sideLight.position.set(50, 10, 0);
    // this.scene.add(sideLight);
  }
  
  /**
   * Initialize the camera
   * @private
   */
  initCamera() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    this.camera.position.set(0, 0, 50);
    this.scene.add(this.camera);
  }
  
  /**
   * Initialize the WebGL renderer
   * @private
   */
  initRenderer() {
    try {
      this.canvas = document.getElementById('gameCanvas');
      
      // Create renderer with antialias per rendering rules
      this.renderer = new THREE.WebGLRenderer({ 
        canvas: this.canvas, 
        antialias: true 
      });
      
      // Set renderer properties
      this.resize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      
      // Disable physically correct lights to prevent light interpolation
      this.renderer.physicallyCorrectLights = false;
      
      // Disable automatic gamma correction to prevent light value interpolation
      this.renderer.outputEncoding = THREE.LinearEncoding;
      
      // Enable shadow mapping for better visuals
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
      throw error; // Re-throw to be caught by Game class
    }
  }
  
  /**
   * Resize the renderer and update camera
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.renderer.setSize(width, height);
    
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }
  
  /**
   * Render the current scene
   */
  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  /**
   * Clean up and dispose of Three.js objects
   */
  dispose() {
    this.renderer.dispose();
    // Additional cleanup could be added here for textures, geometries, etc.
  }
} 