import * as CANNON from 'cannon-es';

/**
 * Manages Cannon.js physics simulation
 * Follows the cannonjs-physics-rules
 * @class
 */
export class PhysicsWorld {
  /**
   * Create a new physics world
   * @constructor
   */
  constructor() {
    // Physics constants
    this.GRAVITY = 0; // Set to zero - we'll use custom planet gravity
    
    this.initWorld();
    console.log('PhysicsWorld initialized with zero global gravity');
  }
  
  /**
   * Initialize the Cannon.js world
   * @private
   */
  initWorld() {
    try {
      this.world = new CANNON.World();
      
      // Set zero gravity as we'll use custom planet gravity
      this.world.gravity.set(0, 0, 0);
      
      // Use SAPBroadphase for better performance
      this.world.broadphase = new CANNON.SAPBroadphase(this.world);
      
      // Set default contact material properties
      this.defaultMaterial = new CANNON.Material('default');
      const defaultContactMaterial = new CANNON.ContactMaterial(
        this.defaultMaterial,
        this.defaultMaterial,
        {
          friction: 0.3,
          restitution: 0.3
        }
      );
      this.world.addContactMaterial(defaultContactMaterial);
      this.world.defaultContactMaterial = defaultContactMaterial;
    } catch (error) {
      console.error('Failed to initialize physics world:', error);
      throw error;
    }
  }
  
  /**
   * Create a static sphere body for a planet
   * @param {number} radius - Planet radius
   * @param {THREE.Vector3} position - Planet position
   * @returns {CANNON.Body} - The created physics body
   */
  createPlanetBody(radius, position) {
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
      mass: 0, // Static body
      material: this.defaultMaterial
    });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    this.world.addBody(body);
    return body;
  }
  
  /**
   * Create a dynamic sphere body for a player
   * @param {number} radius - Player radius
   * @param {THREE.Vector3} position - Initial position
   * @returns {CANNON.Body} - The created physics body
   */
  createPlayerBody(radius, position) {
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
      mass: 1, // Dynamic body
      material: this.defaultMaterial
    });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    this.world.addBody(body);
    return body;
  }
  
  /**
   * Update the physics simulation
   * @param {number} timeStep - Fixed time step
   */
  update(timeStep) {
    this.world.step(timeStep);
  }
  
  /**
   * Remove a body from the physics world
   * @param {CANNON.Body} body - The body to remove
   */
  removeBody(body) {
    this.world.removeBody(body);
  }
} 