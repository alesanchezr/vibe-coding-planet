import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Custom arcball rotation controls for planets
 * @class
 */
export class PlanetRotationControls {
  /**
   * Create rotation controls for a planet
   * @param {Planet} planet - The planet object to control
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {THREE.Camera} camera - The Three.js camera
   * @param {HTMLElement} domElement - The DOM element for event handling
   */
  constructor(planet, scene, camera, domElement) {
    this.planet = planet;
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = true;
    
    // Rotation properties
    this.radius = planet.radius || 15;
    this.rotationSensitivity = 0.6;
    this.dampingFactor = 0.85;
    this.enableDamping = true;
    this.maxAngularVelocity = 5.0;
    
    // Disable auto-rotation by default to maintain fixed north pole position
    this.autoRotate = false;
    this.autoRotateSpeed = 0;
    
    // Initialize rockets array
    this.rockets = [];
    
    // Internal state
    this.isDragging = false;
    this.previousMousePosition = new THREE.Vector2();
    this.currentMousePosition = new THREE.Vector2();
    this.mouseDelta = new THREE.Vector2();
    this.rotationQuaternion = new THREE.Quaternion();
    this.rotationAxis = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3(0, 0, 0);
    this.lastTime = performance.now();
    
    // Initialize event listeners
    this.addEventListeners();
    
    // Set initial rotation to ensure north pole is at the top
    this.resetRotation();
  }
  
  /**
   * Add event listeners
   * @private
   */
  addEventListeners() {
    // Mouse events
    this.onMouseDownBound = this.onMouseDown.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onMouseUpBound = this.onMouseUp.bind(this);
    
    // Touch events
    this.onTouchStartBound = this.onTouchStart.bind(this);
    this.onTouchMoveBound = this.onTouchMove.bind(this);
    this.onTouchEndBound = this.onTouchEnd.bind(this);
    
    // Window resize event
    this.onWindowResizeBound = this.onWindowResize.bind(this);
    
    // Add listeners
    this.domElement.addEventListener('mousedown', this.onMouseDownBound, false);
    this.domElement.addEventListener('touchstart', this.onTouchStartBound, { passive: false });
    window.addEventListener('resize', this.onWindowResizeBound, false);
  }
  
  /**
   * Remove event listeners
   * @private
   */
  removeEventListeners() {
    // Remove mouse events
    this.domElement.removeEventListener('mousedown', this.onMouseDownBound, false);
    document.removeEventListener('mousemove', this.onMouseMoveBound, false);
    document.removeEventListener('mouseup', this.onMouseUpBound, false);
    
    // Remove touch events
    this.domElement.removeEventListener('touchstart', this.onTouchStartBound, false);
    document.removeEventListener('touchmove', this.onTouchMoveBound, false);
    document.removeEventListener('touchend', this.onTouchEndBound, false);
    
    // Remove window resize event
    window.removeEventListener('resize', this.onWindowResizeBound, false);
  }
  
  /**
   * Check if a pointer position (mouse or touch) intersects with this planet
   * @param {number} x - Pointer X coordinate in client space
   * @param {number} y - Pointer Y coordinate in client space
   * @returns {boolean} True if the pointer intersects with this planet
   * @private
   */
  checkPlanetIntersection(x, y) {
    // Convert to normalized device coordinates (-1 to +1)
    const ndcX = (x / this.domElement.clientWidth) * 2 - 1;
    const ndcY = -(y / this.domElement.clientHeight) * 2 + 1;
    
    // Set up raycaster to detect clicks on this specific planet
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    
    // Check for intersection with THIS planet terrain mesh
    const terrainIntersects = raycaster.intersectObject(this.planet.mesh);
    
    // If we have the water mesh, check that too
    if (this.planet.waterMesh) {
      const waterIntersects = raycaster.intersectObject(this.planet.waterMesh);
      // Return true if either terrain or water is intersected
      return terrainIntersects.length > 0 || waterIntersects.length > 0;
    }
    
    // If no water mesh, just return terrain intersection result
    return terrainIntersects.length > 0;
  }
  
  /**
   * Handle mouse down event
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  onMouseDown(event) {
    if (!this.enabled) return;
    
    // Prevent default behavior
    event.preventDefault();
    
    // Check if it's a left mouse button click
    if (event.button !== 0) return;
    
    // Get mouse position
    const rect = this.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Only proceed if we clicked on this planet
    if (this.checkPlanetIntersection(x, y)) {
      // Store mouse position
      this.previousMousePosition.set(x, y);
      this.currentMousePosition.copy(this.previousMousePosition);
      
      // Start dragging
      this.isDragging = true;
      
      // Reset angular velocity
      this.angularVelocity.set(0, 0, 0);
      
      // Add document-level event listeners
      document.addEventListener('mousemove', this.onMouseMoveBound, false);
      document.addEventListener('mouseup', this.onMouseUpBound, false);
    }
  }
  
  /**
   * Set the player bodies that should rotate with the planet
   * @param {Array} bodies - Array of physics bodies to rotate with the planet
   */
  setPlayerBodies(bodies) {
    this.playerBodies = bodies || [];
  }
  
  /**
   * Apply rotation to planet and any associated meshes
   * @param {THREE.Quaternion} quaternion - The rotation quaternion to apply
   * @private
   */
  applyRotation(quaternion) {
    // Apply rotation to the planet mesh
    this.planet.mesh.quaternion.premultiply(quaternion);
    this.planet.mesh.updateMatrix();
    
    // If the planet has a water mesh, rotate it as well
    if (this.planet.waterMesh) {
      this.planet.waterMesh.quaternion.copy(this.planet.mesh.quaternion);
      this.planet.waterMesh.updateMatrix();
    }
    
    // If there are player bodies, rotate them around the planet center
    if (this.playerBodies && this.playerBodies.length > 0) {
      const planetCenter = this.planet.mesh.position.clone();
      
      // For each player body
      this.playerBodies.forEach(body => {
        if (!body) return;
        
        // Calculate the player's position relative to planet center
        const relativePosition = body.position.clone().vsub(new CANNON.Vec3(
          planetCenter.x, planetCenter.y, planetCenter.z
        ));
        
        // Convert to THREE.Vector3 for quaternion application
        const relativePositionThree = new THREE.Vector3(
          relativePosition.x, relativePosition.y, relativePosition.z
        );
        
        // Apply the rotation quaternion to this relative position
        relativePositionThree.applyQuaternion(quaternion);
        
        // Calculate the new position
        const newPosition = new CANNON.Vec3(
          planetCenter.x + relativePositionThree.x,
          planetCenter.y + relativePositionThree.y, 
          planetCenter.z + relativePositionThree.z
        );
        
        // Update the player's position
        body.position.copy(newPosition);
        
        // Also rotate the player's orientation
        const bodyQuaternion = new CANNON.Quaternion(
          body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w
        );
        
        const rotationQuaternionCannon = new CANNON.Quaternion(
          quaternion.x, quaternion.y, quaternion.z, quaternion.w
        );
        
        bodyQuaternion.mult(rotationQuaternionCannon, bodyQuaternion);
        body.quaternion.copy(bodyQuaternion);
        
        // Wake up the body if it's sleeping
        body.wakeUp();
      });
    }
    
    // If there are rockets, rotate them with the planet
    if (this.rockets && this.rockets.length > 0) {
      this.rockets.forEach(rocket => {
        if (rocket && typeof rocket.updateWithPlanetRotation === 'function') {
          rocket.updateWithPlanetRotation(quaternion);
        }
      });
    }
  }
  
  /**
   * Handle mouse move event
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  onMouseMove(event) {
    if (!this.enabled || !this.isDragging) return;
    
    // Prevent default behavior
    event.preventDefault();
    
    // Get current mouse position
    const rect = this.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Update current position
    this.currentMousePosition.set(x, y);
    
    // Calculate mouse delta
    this.mouseDelta.subVectors(this.currentMousePosition, this.previousMousePosition);
    
    // Skip if no movement
    if (this.mouseDelta.lengthSq() < 0.001) return;
    
    // Calculate rotation amount
    const rotX = this.mouseDelta.y / this.domElement.clientHeight * this.rotationSensitivity * Math.PI;
    const rotY = this.mouseDelta.x / this.domElement.clientWidth * this.rotationSensitivity * Math.PI;
    
    // Use camera's coordinate system for rotation to ensure consistent direction
    // regardless of planet orientation
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    // Create rotation quaternions in camera space (positive values for opposite direction)
    const qx = new THREE.Quaternion().setFromAxisAngle(right, rotX);
    const qy = new THREE.Quaternion().setFromAxisAngle(up, rotY);
    
    // Combine rotations
    this.rotationQuaternion.copy(qy).multiply(qx);
    
    // Apply rotation to planet and associated meshes
    this.applyRotation(this.rotationQuaternion);
    
    // Update angular velocity for momentum - lower coefficient to reduce momentum (from 60 to 15)
    const deltaTime = Math.max(0.001, (performance.now() - this.lastTime) / 1000);
    
    // Calculate new angular velocity
    const newVelX = rotX / deltaTime / this.rotationSensitivity * 15;
    const newVelY = rotY / deltaTime / this.rotationSensitivity * 15;
    
    // Apply a smoothing filter - blend with previous velocity for smoother transition
    const smoothFactor = 0.3;
    this.angularVelocity.x = this.angularVelocity.x * (1 - smoothFactor) + newVelX * smoothFactor;
    this.angularVelocity.y = this.angularVelocity.y * (1 - smoothFactor) + newVelY * smoothFactor;
    
    // Limit maximum angular velocity
    if (this.angularVelocity.length() > this.maxAngularVelocity) {
      this.angularVelocity.normalize().multiplyScalar(this.maxAngularVelocity);
    }
    
    // Update previous mouse position
    this.previousMousePosition.copy(this.currentMousePosition);
    this.lastTime = performance.now();
  }
  
  /**
   * Handle mouse up event
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  onMouseUp(event) {
    if (!this.enabled) return;
    
    // End dragging
    this.isDragging = false;
    
    // Reduce angular velocity on release for more controlled momentum
    this.angularVelocity.multiplyScalar(0.5);
    
    // Remove document-level event listeners
    document.removeEventListener('mousemove', this.onMouseMoveBound, false);
    document.removeEventListener('mouseup', this.onMouseUpBound, false);
  }
  
  /**
   * Reset drag state - called when controls are initialized or disabled
   * @public
   */
  resetDragState() {
    if (this.isDragging) {
      this.isDragging = false;
      
      // Also remove any lingering event listeners
      document.removeEventListener('mousemove', this.onMouseMoveBound, false);
      document.removeEventListener('mouseup', this.onMouseUpBound, false);
      document.removeEventListener('touchmove', this.onTouchMoveBound, false);
      document.removeEventListener('touchend', this.onTouchEndBound, false);
    }
  }
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - The touch event
   * @private
   */
  onTouchStart(event) {
    if (!this.enabled) return;
    
    // Prevent default behavior (scrolling)
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Single touch - handle like mouse down
      const touch = event.touches[0];
      const rect = this.domElement.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Only proceed if we touched this planet
      if (this.checkPlanetIntersection(x, y)) {
        // Store touch position
        this.previousMousePosition.set(x, y);
        this.currentMousePosition.copy(this.previousMousePosition);
        
        // Start dragging
        this.isDragging = true;
        
        // Reset angular velocity
        this.angularVelocity.set(0, 0, 0);
        
        // Add document-level event listeners
        document.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
        document.addEventListener('touchend', this.onTouchEndBound, false);
      }
    }
  }
  
  /**
   * Handle touch move event
   * @param {TouchEvent} event - The touch event
   * @private
   */
  onTouchMove(event) {
    if (!this.enabled || !this.isDragging) return;
    
    // Prevent default behavior (scrolling)
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Single touch - handle like mouse move
      const touch = event.touches[0];
      const rect = this.domElement.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Update current position
      this.currentMousePosition.set(x, y);
      
      // Calculate touch delta
      this.mouseDelta.subVectors(this.currentMousePosition, this.previousMousePosition);
      
      // Skip if no movement
      if (this.mouseDelta.lengthSq() < 0.001) return;
      
      // Calculate rotation amount
      const rotX = this.mouseDelta.y / this.domElement.clientHeight * this.rotationSensitivity * Math.PI;
      const rotY = this.mouseDelta.x / this.domElement.clientWidth * this.rotationSensitivity * Math.PI;
      
      // Use camera's coordinate system for rotation to ensure consistent direction
      // regardless of planet orientation
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      
      // Create rotation quaternions in camera space (positive values for opposite direction)
      const qx = new THREE.Quaternion().setFromAxisAngle(right, rotX);
      const qy = new THREE.Quaternion().setFromAxisAngle(up, rotY);
      
      // Combine rotations
      this.rotationQuaternion.copy(qy).multiply(qx);
      
      // Apply rotation to planet and associated meshes
      this.applyRotation(this.rotationQuaternion);
      
      // Update angular velocity for momentum
      const deltaTime = Math.max(0.001, (performance.now() - this.lastTime) / 1000);
      
      // Store angular velocity in camera space (positive values for consistent momentum)
      this.angularVelocity.set(
        rotX / deltaTime / this.rotationSensitivity * 60,
        rotY / deltaTime / this.rotationSensitivity * 60,
        0
      );
      
      // Update previous touch position
      this.previousMousePosition.copy(this.currentMousePosition);
      this.lastTime = performance.now();
    }
  }
  
  /**
   * Handle touch end event
   * @param {TouchEvent} event - The touch event
   * @private
   */
  onTouchEnd(event) {
    if (!this.enabled) return;
    
    
    // End dragging
    this.isDragging = false;
    
    // Remove document-level event listeners
    document.removeEventListener('touchmove', this.onTouchMoveBound, false);
    document.removeEventListener('touchend', this.onTouchEndBound, false);
  }
  
  /**
   * Handle window resize event
   * @private
   */
  onWindowResize() {
    // Nothing special needed here, just ensure the reference is kept up to date
  }
  
  /**
   * Reset rotation to the initial state with north pole at the top
   */
  resetRotation() {
    if (this.planet && this.planet.mesh) {
      // Reset rotation to identity (north pole at top)
      this.planet.mesh.rotation.set(0, 0, 0);
      this.planet.mesh.quaternion.set(0, 0, 0, 1);
      
      // If there's a water mesh, reset it too
      if (this.planet.waterMesh) {
        this.planet.waterMesh.rotation.set(0, 0, 0);
        this.planet.waterMesh.quaternion.set(0, 0, 0, 1);
      }
      
      // Reset angular velocity
      this.angularVelocity.set(0, 0, 0);
    }
  }
  
  /**
   * Reset all player bodies
   */
  resetPlayerBodies() {
    this.playerBodies = [];
  }
  
  /**
   * Update the control state
   */
  update() {
    const time = performance.now();
    const delta = (time - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = time;
    
    // Skip if disabled or time delta is unreasonable
    if (!this.enabled || delta > 0.2) return;
    
    // Apply damping if not dragging and damping is enabled
    if (!this.isDragging && this.enableDamping) {
      // Apply stronger damping at higher velocities for quicker deceleration
      const currentSpeed = this.angularVelocity.length();
      let dampingMultiplier = 1.0;
      
      if (currentSpeed > 1.0) {
        // Progressive damping - higher speeds get damped more aggressively
        dampingMultiplier = 1.0 + (currentSpeed - 1.0) * 0.2;
      }
      
      const effectiveDamping = Math.pow(this.dampingFactor, dampingMultiplier);
      this.angularVelocity.multiplyScalar(effectiveDamping);
      
      // Stop if below threshold
      if (this.angularVelocity.lengthSq() < 0.00001) {
        this.angularVelocity.set(0, 0, 0);
        return;
      }
      
      // Calculate rotation from angular velocity
      this.rotationAxis.copy(this.angularVelocity).normalize();
      const angle = this.angularVelocity.length() * delta;
      
      this.rotationQuaternion.setFromAxisAngle(
        this.rotationAxis,
        angle
      );
      
      // Apply rotation
      this.applyRotation(this.rotationQuaternion);
    }
    
    // Apply auto-rotation if enabled
    if (this.autoRotate && !this.isDragging) {
      const autoRotationAngle = this.autoRotateSpeed * delta;
      
      // Auto-rotate around the Y axis
      this.rotationQuaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        autoRotationAngle
      );
      
      // Apply rotation
      this.applyRotation(this.rotationQuaternion);
    }
  }
  
  /**
   * Enable or disable the rotation controls
   * @param {boolean} enabled - Whether the controls should be enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  
  /**
   * Handle window resize event
   */
  handleResize() {
    // Just call onWindowResize
    this.onWindowResize();
  }
  
  /**
   * Clean up and dispose of the controls
   */
  dispose() {
    this.removeEventListeners();
    this.enabled = false;
    this.isDragging = false;
  }
} 