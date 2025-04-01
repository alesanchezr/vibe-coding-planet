import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameObject } from './GameObject.js';

/**
 * SphereBot with a sphere body, cylinder legs, and simple eyes
 * @class
 * @extends GameObject
 */
export class SphereBot extends GameObject {
  /**
   * Create a new SphereBot
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} world - The Cannon.js world
   * @param {Object} options - Configuration options
   * @param {number} options.radius - Radius of the sphere body
   * @param {THREE.Color|string|number} options.color - Color of the sphere body
   * @param {Object} options.position - Initial position
   */
  constructor(scene, world, options = {}) {
    super(scene, world);
    
    // Define object properties
    this.radius = options.radius || 0.5;
    this.color = options.color || 0x44aa88;
    this.position = options.position || { x: 0, y: 3, z: 0 };
    
    // Animation parameters for sinusoidal movement
    this.animTime = Math.random() * Math.PI * 2; // Random starting phase
    this.bobAmplitude = 0.05; // Height of the bob
    this.bobSpeed = 10.5 + Math.random() * 1.0; // Speed of the bob (slightly randomized)
    
    // Initialize the object
    this.init();
  }
  
  /**
   * Initialize the SphereBot (creates both visual and physics components)
   * @override
   */
  init() {
    this.createMesh();
    this.createBody();
    this.isInitialized = true;
  }
  
  /**
   * Create the visual components for the SphereBot
   * @private
   */
  createMesh() {
    // Create group to hold all visual parts
    this.mesh = new THREE.Group();
    
    // Create sphere body
    const sphereGeometry = new THREE.SphereGeometry(this.radius);
    const sphereMaterial = new THREE.MeshStandardMaterial({ 
      color: this.color,
      roughness: 0.7,
      metalness: 0.3
    });
    this.bodyMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.mesh.add(this.bodyMesh);
    
    // Create legs
    const legRadius = this.radius * 0.2;
    const legHeight = this.radius * 0.8;
    const legGeometry = new THREE.CylinderGeometry(legRadius, legRadius, legHeight);
    const legMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    
    // Left leg
    this.leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    this.leftLeg.position.set(-this.radius * 0.5, -this.radius - legHeight/2, 0);
    this.mesh.add(this.leftLeg);
    
    // Right leg
    this.rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    this.rightLeg.position.set(this.radius * 0.5, -this.radius - legHeight/2, 0);
    this.mesh.add(this.rightLeg);
    
    // Create eyes
    const eyeRadius = this.radius * 0.2;
    const eyeGeometry = new THREE.CircleGeometry(eyeRadius);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    // Left eye
    this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    this.leftEye.position.set(-this.radius * 0.4, this.radius * 0.3, this.radius * 0.9);
    this.leftEye.lookAt(0, 0, this.radius * 5); // Make eyes look forward
    this.mesh.add(this.leftEye);
    
    // Right eye
    this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    this.rightEye.position.set(this.radius * 0.4, this.radius * 0.3, this.radius * 0.9);
    this.rightEye.lookAt(0, 0, this.radius * 5); // Make eyes look forward
    this.mesh.add(this.rightEye);
    
    // Set initial position
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    
    // Enable shadows for all parts of the bot
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = false; // Bots probably shouldn't receive shadows onto themselves
      }
    });
    
    // Add to scene
    this.scene.add(this.mesh);
  }
  
  /**
   * Create the physics body for the SphereBot
   * @private
   */
  createBody() {
    // Create a sphere physics body
    const shape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({
      mass: 5,
      shape: shape,
      material: new CANNON.Material({ friction: 0.3, restitution: 0.4 })
    });
    
    // Set damping to make movement more natural
    this.body.linearDamping = 0.4;
    this.body.angularDamping = 0.4;
    
    // Position the body to match the mesh
    this.body.position.set(this.position.x, this.position.y, this.position.z);
    
    // Add to physics world
    this.world.addBody(this.body);
  }
  
  /**
   * Apply force to move the SphereBot
   * @param {number} x - Force in x direction
   * @param {number} y - Force in y direction
   * @param {number} z - Force in z direction
   */
  applyForce(x, y, z) {
    this.body.applyForce(new CANNON.Vec3(x, y, z), this.body.position);
  }
  
  /**
   * Update the SphereBot position and rotation based on physics
   * @override
   */
  update() {
    if (!this.body || !this.mesh) return;
    
    // Update animation time
    this.animTime += 0.016; // Approximately 60fps
    
    // Update position from physics body
    this.mesh.position.copy(this.body.position);
    
    // Find the nearest planet to orient towards
    const nearestPlanet = this.findNearestPlanet();
    
    if (nearestPlanet) {
      // Calculate direction from SphereBot to planet center (gravity direction)
      const gravityDir = new THREE.Vector3();
      gravityDir.subVectors(nearestPlanet.position, this.mesh.position).normalize();
      
      // Calculate the surface normal (points away from planet center)
      const surfaceNormal = gravityDir.clone().negate(); 
      // Apply a visual offset along the surface normal to lift the mesh slightly
      // This makes the bottom of the sphere appear flush with the terrain
      const visualLiftOffset = surfaceNormal.multiplyScalar(this.radius); 
      this.mesh.position.add(visualLiftOffset);
      
      // Create a quaternion that will rotate the mesh to point legs toward planet
      // We want the "down" direction (0,-1,0) to point along gravity direction
      const upVector = new THREE.Vector3(0, 1, 0);
      this.mesh.quaternion.setFromUnitVectors(upVector.negate(), gravityDir);
      
      // Apply sinusoidal movement - offset in the direction away from planet
      const bobOffset = this.bobAmplitude * Math.sin(this.animTime * this.bobSpeed);
      const offsetVec = gravityDir.clone().multiplyScalar(-bobOffset);
      this.mesh.position.add(offsetVec);
      
      // Move the body mesh up and down slightly for extra liveliness
      if (this.bodyMesh) {
        this.bodyMesh.position.y = bobOffset * 0.5;
      }
      
      // Make legs move with the bobbing motion (opposite direction)
      if (this.leftLeg && this.rightLeg) {
        const legOffset = -bobOffset * 0.3;
        this.leftLeg.position.y = -this.radius - this.leftLeg.geometry.parameters.height/2 + legOffset;
        this.rightLeg.position.y = -this.radius - this.rightLeg.geometry.parameters.height/2 + legOffset;
      }
    } else {
      // If no planet found, just use physics rotation
      this.mesh.quaternion.copy(this.body.quaternion);
    }
  }
  
  /**
   * Find the nearest planet to this SphereBot
   * @returns {Object|null} The nearest planet or null if none found
   * @private
   */
  findNearestPlanet() {
    if (!this.scene) return null;
    
    let nearestPlanet = null;
    let minDistance = Infinity;
    
    // Search for objects named "earth" or "mars" in the scene
    this.scene.traverse(object => {
      if (object.name === "earth" || object.name === "mars") {
        const distance = object.position.distanceTo(this.mesh.position);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPlanet = object;
        }
      }
    });
    
    return nearestPlanet;
  }
  
  /**
   * Clean up resources used by this object
   * @override
   */
  dispose() {
    // Dispose of specific geometries and materials
    if (this.bodyMesh) {
      this.bodyMesh.geometry.dispose();
      this.bodyMesh.material.dispose();
    }
    
    if (this.leftLeg) {
      this.leftLeg.geometry.dispose();
      this.leftLeg.material.dispose();
    }
    
    if (this.rightLeg) {
      this.rightLeg.geometry.dispose();
      this.rightLeg.material.dispose();
    }
    
    if (this.leftEye) {
      this.leftEye.geometry.dispose();
      this.leftEye.material.dispose();
    }
    
    if (this.rightEye) {
      this.rightEye.geometry.dispose();
      this.rightEye.material.dispose();
    }
    
    // Call parent dispose to handle removing from scene and world
    super.dispose();
  }
}