import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameObject } from './GameObject.js';

/**
 * Test cube with physics and visual representation
 * @class
 * @extends GameObject
 */
export class TestCube extends GameObject {
  /**
   * Create a new test cube
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} world - The Cannon.js world
   */
  constructor(scene, world) {
    super(scene, world);
    
    // Define object properties
    this.size = 1;
    this.color = 0x00ff00;
    
    // Initialize the object
    this.init();
  }
  
  /**
   * Initialize the test cube (creates both visual and physics components)
   * @override
   */
  init() {
    this.createMesh();
    this.createBody();
    this.isInitialized = true;
  }
  
  /**
   * Create the visual mesh for the cube
   * @private
   */
  createMesh() {
    // Create geometry and material (using BufferGeometry per performance rules)
    const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    
    // Create mesh and add to scene
    this.mesh = new THREE.Mesh(geometry, material);
    
    // Position the cube offset from center so it's not behind the Join button
    this.mesh.position.set(0, 0, -5); 
    
    this.scene.add(this.mesh);
    
    // Set initial rotation
    this.mesh.rotation.x = 0.5;
    this.mesh.rotation.y = 0.5;
  }
  
  /**
   * Create the physics body for the cube
   * @private
   */
  createBody() {
    // Create physics shape and body
    const shape = new CANNON.Box(new CANNON.Vec3(this.size/2, this.size/2, this.size/2));
    this.body = new CANNON.Body({
      mass: 0, // Static for now
      shape: shape
    });
    
    // Position the body to match the mesh
    this.body.position.set(0, 0, -5);
    
    // Add to physics world
    this.world.addBody(this.body);
  }
  
  /**
   * Update the test cube (add rotation for visual effect)
   * @override
   */
  update() {
    // Skip sync with physics and just rotate the mesh
    if (this.mesh) {
      this.mesh.rotation.x += 0.01;
      this.mesh.rotation.y += 0.01;
    }
  }
} 