/**
 * Base class for all game objects with visual and physics components
 * Follows the game-object-rules
 * @class
 */
export class GameObject {
  /**
   * Create a new game object
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} world - The Cannon.js world
   */
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mesh = null;
    this.body = null;
    
    // Track initialization state
    this.isInitialized = false;
  }
  
  /**
   * Initialize the game object (to be implemented by subclasses)
   * @abstract
   */
  init() {
    throw new Error('GameObject.init() must be implemented by subclasses');
  }
  
  /**
   * Update the game object (typically syncs physics with visuals)
   */
  update() {
    // Base implementation - copy physics body position to visual mesh
    if (this.mesh && this.body) {
      this.mesh.position.copy(this.body.position);
      this.mesh.quaternion.copy(this.body.quaternion);
    }
  }
  
  /**
   * Clean up resources used by this object
   */
  dispose() {
    // Remove from scene
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    
    // Remove from physics world
    if (this.body && this.world) {
      this.world.removeBody(this.body);
    }
    
    // Clean up geometries and materials
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(material => material.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
    }
  }
} 