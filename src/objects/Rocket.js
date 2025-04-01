import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameObject } from './GameObject.js';

/**
 * Rocket object placed at the north pole of a planet
 * @class
 * @extends GameObject
 */
export class Rocket extends GameObject {
  /**
   * Create a new rocket
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} world - The Cannon.js world
   * @param {Object} options - Rocket options
   * @param {THREE.Vector3} options.position - The position of the rocket
   * @param {THREE.Vector3} options.planetPosition - The position of the planet
   * @param {number} options.rotation - Rotation angle in radians
   * @param {number} options.size - Size scaling factor
   * @param {string} options.planetName - Name of the planet it belongs to
   */
  constructor(scene, world, options = {}) {
    super(scene, world);
    
    // Save options
    this.position = options.position || new THREE.Vector3(0, 0, 0);
    this.planetPosition = options.planetPosition || new THREE.Vector3(0, 0, 0);
    this.rotation = options.rotation || 0;
    this.size = options.size || 1;
    this.planetName = options.planetName || 'earth';
    
    // Initialize the rocket
    this.init();
  }
  
  /**
   * Initialize the rocket
   */
  init() {
    this.createMesh();
    this.createBody();
    this.isInitialized = true;
  }
  
  /**
   * Create the visual mesh for the rocket
   * @private
   */
  createMesh() {
    // Create group to hold all rocket parts
    this.mesh = new THREE.Group();
    this.mesh.name = 'rocket'; // Keep the name for potential selection/identification
    
    // Add rocket and buildable identification to the main group's userData
    this.mesh.userData.isRocket = true;
    this.mesh.userData.isBuildable = true;
    this.mesh.userData.buildType = 'rocket';

    const whiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, 
        roughness: 0.5,
        metalness: 0.5
    });
    const greyMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc, 
        roughness: 0.5,
        metalness: 0.7
    });
    const darkGreyMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555, 
        roughness: 0.4,
        metalness: 0.8
    });
    const redMaterial = new THREE.MeshStandardMaterial({
        color: 0xcc0000, 
        roughness: 0.5,
        metalness: 0.5
    });

    let currentY = 0; // Keep track of vertical position for stacking

    // --- Stage 1 (Booster) ---
    const stage1Height = 2.0 * this.size;
    const stage1Radius = 0.4 * this.size;
    const stage1Geo = new THREE.CylinderGeometry(stage1Radius, stage1Radius, stage1Height, 24);
    const stage1Mesh = new THREE.Mesh(stage1Geo, whiteMaterial);
    stage1Mesh.position.y = currentY + stage1Height / 2;
    stage1Mesh.name = 'rocketStage1';
    stage1Mesh.userData = { ...this.mesh.userData }; // Copy userData
    this.mesh.add(stage1Mesh);
    currentY += stage1Height;

    // --- Interstage ---
    const interstageHeight = 0.1 * this.size;
    const interstageRadius = stage1Radius * 1.05; // Slightly wider
    const interstageGeo = new THREE.CylinderGeometry(interstageRadius, interstageRadius, interstageHeight, 24);
    const interstageMesh = new THREE.Mesh(interstageGeo, darkGreyMaterial);
    interstageMesh.position.y = currentY + interstageHeight / 2;
    interstageMesh.name = 'rocketInterstage';
    interstageMesh.userData = { ...this.mesh.userData };
    this.mesh.add(interstageMesh);
    currentY += interstageHeight;

    // --- Stage 2 (Upper Stage) ---
    const stage2Height = 1.2 * this.size;
    const stage2Radius = stage1Radius * 0.85; // Narrower
    const stage2Geo = new THREE.CylinderGeometry(stage2Radius, stage2Radius, stage2Height, 24);
    const stage2Mesh = new THREE.Mesh(stage2Geo, greyMaterial);
    stage2Mesh.position.y = currentY + stage2Height / 2;
    stage2Mesh.name = 'rocketStage2';
    stage2Mesh.userData = { ...this.mesh.userData };
    this.mesh.add(stage2Mesh);
    currentY += stage2Height;

    // --- Nose Cone / Payload Fairing ---
    const noseHeight = 0.8 * this.size;
    const noseGeo = new THREE.ConeGeometry(stage2Radius, noseHeight, 24);
    const noseMesh = new THREE.Mesh(noseGeo, redMaterial);
    noseMesh.position.y = currentY + noseHeight / 2;
    noseMesh.name = 'rocketNoseCone';
    noseMesh.userData = { ...this.mesh.userData };
    this.mesh.add(noseMesh);

    // --- Fins (4) attached to Stage 1 ---
    const finCount = 4;
    const finWidth = 0.8 * this.size;
    const finHeight = 1.0 * this.size;
    const finDepth = 0.05 * this.size;
    const finGeo = new THREE.BoxGeometry(finWidth, finHeight, finDepth);
    
    for (let i = 0; i < finCount; i++) {
      const fin = new THREE.Mesh(finGeo, darkGreyMaterial);
      const angle = (i / finCount) * Math.PI * 2;
      const attachRadius = stage1Radius; // Attach near the edge of stage 1
      
      fin.name = `rocketFin${i}`;
      fin.userData = { ...this.mesh.userData };
      
      // Position near the bottom of stage 1, extending outwards
      fin.position.set(
        Math.cos(angle) * attachRadius,
        finHeight * 0.3, // Position slightly up from the base
        Math.sin(angle) * attachRadius
      );
      
      // Rotate fin to align radially
      fin.rotation.y = -angle; // Align the flat side outwards
      
      this.mesh.add(fin);
    }
    
    // Apply specified initial rotation (if any, around the local Y axis)
    this.mesh.rotation.y = this.rotation;
    
    // Orient the whole rocket group to point away from the planet center
    this.alignWithPlanet();
    
    // Set the final position of the group
    this.mesh.position.copy(this.position);
    
    // Add the completed group to the scene
    this.scene.add(this.mesh);
    
    console.log(`2-Stage Rocket mesh created at position (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`);
  }
  
  /**
   * Create a static physics body for the rocket
   * @private
   */
  createBody() {
    // Create a compound shape for the physics body
    const bodyHeight = 2.0 * this.size;
    const bodyRadius = 0.3 * this.size;
    
    // Create main body shape
    const bodyShape = new CANNON.Cylinder(
      bodyRadius, bodyRadius, bodyHeight, 16
    );
    
    // Create physics body (static)
    this.body = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(
        this.position.x,
        this.position.y,
        this.position.z
      ),
      type: CANNON.Body.STATIC
    });
    
    // Calculate orientation to point away from planet
    const direction = new CANNON.Vec3(
      this.position.x - this.planetPosition.x,
      this.position.y - this.planetPosition.y,
      this.position.z - this.planetPosition.z
    ).unit();
    
    // Find rotation to align cylinder with direction
    const upVector = new CANNON.Vec3(0, 1, 0);
    const rotationAxis = new CANNON.Vec3();
    upVector.cross(direction, rotationAxis);
    
    if (rotationAxis.length() > 0.001) {
      rotationAxis.normalize();
      const angle = Math.acos(upVector.dot(direction));
      const quaternion = new CANNON.Quaternion();
      quaternion.setFromAxisAngle(rotationAxis, angle);
      this.body.quaternion = quaternion;
    }
    
    // Add body shape
    this.body.addShape(bodyShape);
    
    // Add to physics world
    this.world.addBody(this.body);
  }
  
  /**
   * Align the rocket mesh with the planet's surface normal
   */
  alignWithPlanet() {
    if (!this.mesh) return;
    
    // Calculate direction from planet center to rocket position
    const directionToRocket = new THREE.Vector3()
      .subVectors(this.position, this.planetPosition)
      .normalize();
    
    // Create quaternion to rotate the default up vector (0,1,0) to match the direction
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, directionToRocket);
    
    // Apply the quaternion to orient the rocket
    this.mesh.quaternion.copy(quaternion);
  }
  
  /**
   * Update rocket rotation based on planet rotation
   * @param {THREE.Quaternion} planetQuaternion - The planet's rotation quaternion
   */
  updateWithPlanetRotation(planetQuaternion) {
    if (!this.mesh || !this.body) return;
    
    // Get planet center
    const planetCenter = this.planetPosition.clone();
    
    // Calculate the rocket's position relative to planet center
    const relativePosition = new THREE.Vector3()
      .subVectors(this.position, planetCenter);
    
    // Apply the rotation quaternion to this relative position
    // Create a copy to avoid modifying the original position vector
    const rotatedPosition = relativePosition.clone().applyQuaternion(planetQuaternion);
    
    // Calculate the new position
    const newPosition = new THREE.Vector3()
      .addVectors(planetCenter, rotatedPosition);
    
    // Update the mesh position
    this.mesh.position.copy(newPosition);
    
    // Update the body position
    this.body.position.set(
      newPosition.x,
      newPosition.y,
      newPosition.z
    );
    
    // Calculate the direction from planet center to new rocket position
    const directionToRocket = new THREE.Vector3()
      .subVectors(newPosition, planetCenter)
      .normalize();
    
    // Create quaternion to rotate the default up vector (0,1,0) to match the direction
    const up = new THREE.Vector3(0, 1, 0);
    const orientQuaternion = new THREE.Quaternion();
    orientQuaternion.setFromUnitVectors(up, directionToRocket);
    
    // Apply the quaternion to keep rocket pointing away from planet
    this.mesh.quaternion.copy(orientQuaternion);
    
    // Update physics body quaternion to match
    this.body.quaternion.set(
      orientQuaternion.x,
      orientQuaternion.y,
      orientQuaternion.z,
      orientQuaternion.w
    );
    
    // Store the new position
    this.position.copy(newPosition);
  }
  
  /**
   * Custom update method for rocket
   */
  update() {
    // The rocket is static, so no standard update needed
    // The rocket position/rotation is updated by the planet system
  }
} 