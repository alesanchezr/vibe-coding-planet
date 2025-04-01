import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Handles movement of objects along spherical paths
 * Provides smooth movement with acceleration and deceleration
 * @class
 */
export class SphericalMovement {
  /**
   * Create a new spherical movement handler
   * @param {Object} options - Configuration options
   * @param {number} options.speed - Base movement speed (units per second)
   * @param {number} options.accelerationTime - Time (seconds) to reach full speed
   * @param {number} options.decelerationTime - Time (seconds) to stop from full speed
   * @param {number} options.trailLength - Number of positions to track for the trail effect
   * @param {THREE.Color} options.trailColor - Color of the trail effect
   */
  constructor(options = {}) {
    // Movement parameters
    this.speed = options.speed || 10;
    this.accelerationTime = options.accelerationTime || 0.5;
    this.decelerationTime = options.decelerationTime || 0.8;
    
    // Current movement state
    this.isMoving = false;
    this.currentPath = null;
    this.targetBody = null;
    this.targetMesh = null;
    this.pathIndex = 0;
    this.totalPathLength = 0;
    this.currentDistance = 0;
    this.planet = null;
    this.planetRadius = 15;
    
    // Animation timing
    this.startTime = 0;
    this.lastTime = 0;
    this.journeyLength = 0;
    
    // Event callbacks
    this.onMoveStart = null;
    this.onMoveProgress = null;
    this.onMoveComplete = null;
    
    // Debug visualization
    this.progressMarker = null;
    
    // Trail effect
    this.trailLength = options.trailLength || 10;
    this.trailPositions = [];
    this.trailMesh = null;
    this.trailColor = options.trailColor || new THREE.Color(0x4deeea);
    this.trailFade = options.trailFade !== undefined ? options.trailFade : true;
  }
  
  /**
   * Start moving an object along a path
   * @param {Array} pathPoints - Array of points defining the path
   * @param {CANNON.Body} body - The physics body to move
   * @param {THREE.Object3D} mesh - The visual mesh to move (optional)
   * @param {Object} planetData - Data about the planet (for gravity/orientation)
   * @param {THREE.Vector3} planetData.position - Planet center position
   * @param {number} planetData.radius - Planet radius
   * @returns {boolean} True if movement was started
   */
  startMovement(pathPoints, body, mesh, planetData) {
    if (!pathPoints || pathPoints.length < 2 || !body) {
      console.warn('Invalid path or body for movement');
      return false;
    }
    
    // Store the path and target
    this.currentPath = pathPoints;
    this.targetBody = body;
    this.targetMesh = mesh;
    this.pathIndex = 0;
    this.currentDistance = 0;
    
    // Store planet data
    this.planet = planetData;
    this.planetRadius = planetData.radius || 15;
    
    // Debug log the start and end points of the path
    console.log('Movement start:', {
      pathStart: pathPoints[0].clone(),
      pathEnd: pathPoints[pathPoints.length - 1].clone(),
      planetCenter: planetData.position.clone(),
      bodyPosition: new THREE.Vector3(body.position.x, body.position.y, body.position.z),
      pathLength: pathPoints.length,
      surfaceRadius: this.planetRadius
    });
    
    // Calculate total path length
    this.totalPathLength = this.calculatePathLength(pathPoints);
    
    // Set timing parameters
    this.startTime = performance.now() / 1000; // Convert to seconds
    this.lastTime = this.startTime;
    this.journeyLength = this.totalPathLength;
    this.isMoving = true;
    
    // Reset trail
    this.clearTrail();
    
    // Create progress marker if debug is enabled
    this.createProgressMarker();
    
    // Call the move start callback if set
    if (this.onMoveStart) {
      this.onMoveStart({
        path: pathPoints,
        totalDistance: this.totalPathLength,
        estimatedTime: this.calculateEstimatedTime(this.totalPathLength)
      });
    }
    
    return true;
  }
  
  /**
   * Update the movement animation
   * @param {number} deltaTime - Time in seconds since last update
   * @returns {boolean} True if still moving, false if complete
   */
  update(deltaTime) {
    if (!this.isMoving || !this.currentPath || !this.targetBody) {
      return false;
    }
    
    // Update current time
    const currentTime = performance.now() / 1000;
    deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Calculate elapsed time since movement started
    const elapsedTime = currentTime - this.startTime;
    
    // Calculate current speed with acceleration/deceleration
    const currentSpeed = this.calculateSpeed(elapsedTime);
    
    // Calculate how far to move this frame
    const distanceToMove = currentSpeed * deltaTime;
    
    // Update position along the path
    const reachedEnd = this.moveAlongPath(distanceToMove);
    
    // Update progress marker if it exists
    this.updateProgressMarker();
    
    // Update trail effect
    this.updateTrail();
    
    // Call the progress callback if set
    if (this.onMoveProgress) {
      this.onMoveProgress({
        elapsedTime: elapsedTime,
        totalDistance: this.totalPathLength,
        currentDistance: this.currentDistance,
        progress: this.currentDistance / this.totalPathLength,
        speed: currentSpeed
      });
    }
    
    // Check if we've reached the end
    if (reachedEnd) {
      this.completeMovement();
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate current speed with acceleration and deceleration
   * @param {number} elapsedTime - Time elapsed since movement started
   * @returns {number} Current speed
   * @private
   */
  calculateSpeed(elapsedTime) {
    // Estimate total movement time
    const estimatedTotalTime = this.calculateEstimatedTime(this.totalPathLength);
    
    // Time remaining until end
    const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
    
    // Base speed
    let currentSpeed = this.speed;
    
    // Apply acceleration at the start
    if (elapsedTime < this.accelerationTime) {
      const accelerationFactor = elapsedTime / this.accelerationTime;
      currentSpeed *= accelerationFactor;
    }
    
    // Apply deceleration at the end
    if (remainingTime < this.decelerationTime) {
      const decelerationFactor = remainingTime / this.decelerationTime;
      currentSpeed *= decelerationFactor;
    }
    
    // Ensure minimum speed to avoid getting stuck
    return Math.max(currentSpeed, this.speed * 0.1);
  }
  
  /**
   * Move the target along the path by the specified distance
   * @param {number} distance - Distance to move
   * @returns {boolean} True if reached the end of the path
   * @private
   */
  moveAlongPath(distance) {
    if (!this.currentPath || this.pathIndex >= this.currentPath.length - 1) {
      return true;
    }
    
    // Update current distance along path
    this.currentDistance += distance;
    
    // Find current position along the path
    let distanceCovered = 0;
    let i = 0;
    
    // Find the two points we're currently between
    while (i < this.currentPath.length - 1) {
      const segmentLength = this.currentPath[i].distanceTo(this.currentPath[i + 1]);
      if (distanceCovered + segmentLength >= this.currentDistance) {
        break;
      }
      distanceCovered += segmentLength;
      i++;
    }
    
    // If we reached the end of the path
    if (i >= this.currentPath.length - 1) {
      // Snap to the final position
      this.updatePosition(this.currentPath[this.currentPath.length - 1]);
      return true;
    }
    
    // Calculate position between the two points
    const start = this.currentPath[i];
    const end = this.currentPath[i + 1];
    const segmentLength = start.distanceTo(end);
    const t = Math.min(1, (this.currentDistance - distanceCovered) / segmentLength);
    
    // Interpolate between the two points
    const interpolatedPosition = start.clone().lerp(end, t);
    
    // Ensure consistent planet surface contact by normalizing to the planet radius
    if (this.planet && this.planet.position) {
      const planetCenter = this.planet.position;
      const dirFromCenter = interpolatedPosition.clone().sub(planetCenter).normalize();
      
      // Adjust position to be exactly at planet radius
      const surfacePosition = planetCenter.clone().add(dirFromCenter.multiplyScalar(this.planetRadius));
      
      // Log debug info occasionally
      if (Math.floor(this.currentDistance) % 5 === 0) {
        console.log('Movement update:', {
          pathProgress: `${(this.currentDistance / this.totalPathLength * 100).toFixed(1)}%`,
          rawPosition: interpolatedPosition.clone(),
          adjustedPosition: surfacePosition.clone(),
          distanceFromCenter: surfacePosition.distanceTo(planetCenter)
        });
      }
      
      // Use the corrected surface position
      this.updatePosition(surfacePosition);
    } else {
      // Use the interpolated position if no planet data
      this.updatePosition(interpolatedPosition);
    }
    
    // Update current path index
    this.pathIndex = i;
    
    // Check if we're close to the end
    const remainingDistance = this.totalPathLength - this.currentDistance;
    return remainingDistance < 0.01;
  }
  
  /**
   * Update the position of the target body and mesh
   * @param {THREE.Vector3} position - New position
   * @private
   */
  updatePosition(position) {
    if (this.targetBody) {
      // Update physics body position
      this.targetBody.position.set(position.x, position.y, position.z);
      
      // Wake up the body in case it was sleeping
      this.targetBody.wakeUp();
      
      // Calculate orientation to face away from planet center
      if (this.planet && this.planet.position) {
        const planetCenter = this.planet.position;
        const dirToPlanet = new CANNON.Vec3().copy(position).vsub(new CANNON.Vec3().copy(planetCenter));
        dirToPlanet.normalize();
        
        // Calculate quaternion to orient the body
        const upVec = new CANNON.Vec3(0, 1, 0);
        const quatRotation = new CANNON.Quaternion();
        quatRotation.setFromVectors(upVec, dirToPlanet);
        
        // Apply orientation
        this.targetBody.quaternion.copy(quatRotation);
      }
      
      // Add the current position to the trail
      if (this.trailPositions.length < this.trailLength) {
        this.trailPositions.push(position.clone());
      } else {
        // Shift positions and add new one
        this.trailPositions.shift();
        this.trailPositions.push(position.clone());
      }
    }
    
    // If there's a separate visual mesh, update it too (may not be needed with SphereBot)
    if (this.targetMesh) {
      this.targetMesh.position.copy(position);
    }
  }
  
  /**
   * Update the trail visualization
   * @private
   */
  updateTrail() {
    // If we don't have enough positions yet or no scene, don't create the trail
    if (this.trailPositions.length < 2 || !this.targetBody) {
      return;
    }
    
    // Get the scene from the target mesh if available
    const scene = this.targetBody && this.targetBody.world ? 
                  this._findScene() : null;
    
    if (!scene) return;
    
    // If we already have a trail mesh, remove it
    if (this.trailMesh) {
      scene.remove(this.trailMesh);
      this.trailMesh.geometry.dispose();
      this.trailMesh.material.dispose();
    }
    
    // Create new trail geometry
    const geometry = new THREE.BufferGeometry();
    
    // Create arrays for vertices and colors
    const vertices = [];
    const colors = [];
    
    // Add vertices for each position in the trail
    for (let i = 0; i < this.trailPositions.length; i++) {
      const position = this.trailPositions[i];
      vertices.push(position.x, position.y, position.z);
      
      // Calculate color opacity based on position in trail (older = more transparent)
      const alpha = this.trailFade ? i / (this.trailPositions.length - 1) : 1.0;
      colors.push(this.trailColor.r, this.trailColor.g, this.trailColor.b, alpha);
    }
    
    // Set vertices and colors
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    
    // Create material with per-vertex coloring
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      linewidth: 3
    });
    
    // Create the line
    this.trailMesh = new THREE.Line(geometry, material);
    scene.add(this.trailMesh);
  }
  
  /**
   * Find the scene by traversing up from a mesh
   * @returns {THREE.Scene|null} The scene or null if not found
   * @private
   */
  _findScene() {
    // Try to get scene reference from the physics world's userData, if available
    if (this.targetBody && this.targetBody.world && this.targetBody.world.userData && this.targetBody.world.userData.scene) {
      return this.targetBody.world.userData.scene;
    }
    
    // Look for scene in global window object as fallback
    if (window.game && window.game.scene) {
      return window.game.scene;
    }
    
    return null;
  }
  
  /**
   * Clear the trail visualization
   * @private
   */
  clearTrail() {
    if (this.trailMesh && this.trailMesh.parent) {
      this.trailMesh.parent.remove(this.trailMesh);
      this.trailMesh.geometry.dispose();
      this.trailMesh.material.dispose();
      this.trailMesh = null;
    }
    
    // Reset trail positions
    this.trailPositions = [];
  }
  
  /**
   * Complete the movement and trigger the completion callback
   * @private
   */
  completeMovement() {
    // Ensure we're at the final position
    if (this.currentPath && this.currentPath.length > 0) {
      const finalPosition = this.currentPath[this.currentPath.length - 1];
      this.updatePosition(finalPosition);
    }
    
    // Call the completion callback if set
    if (this.onMoveComplete) {
      this.onMoveComplete({
        totalDistance: this.totalPathLength,
        elapsedTime: this.lastTime - this.startTime
      });
    }
    
    // Clean up
    this.isMoving = false;
    this.removeProgressMarker();
    this.clearTrail();
  }
  
  /**
   * Stop movement immediately
   */
  stopMovement() {
    if (this.isMoving) {
      this.isMoving = false;
      this.removeProgressMarker();
      this.clearTrail();
    }
  }
  
  /**
   * Calculate the total length of a path
   * @param {Array} pathPoints - Array of points defining the path
   * @returns {number} Length of the path
   * @private
   */
  calculatePathLength(pathPoints) {
    let length = 0;
    
    for (let i = 1; i < pathPoints.length; i++) {
      length += pathPoints[i].distanceTo(pathPoints[i - 1]);
    }
    
    return length;
  }
  
  /**
   * Calculate estimated time to complete the movement
   * @param {number} distance - The distance to travel
   * @returns {number} Estimated time in seconds
   * @private
   */
  calculateEstimatedTime(distance) {
    // Base time at constant speed
    const baseTime = distance / this.speed;
    
    // Add time for acceleration and deceleration
    // (simplified - in reality would depend on the path profile)
    return baseTime + (this.accelerationTime + this.decelerationTime) * 0.5;
  }
  
  /**
   * Create a visual marker to show movement progress (for debugging)
   * @private
   */
  createProgressMarker() {
    // Only create if we're debugging and in a scene
    if (!window.DEBUG_MOVEMENT || !this.currentPath || this.currentPath.length === 0) {
      return;
    }
    
    // Get the scene from the target mesh if available
    const scene = this.targetMesh && this.targetMesh.parent ? this.targetMesh.parent : null;
    if (!scene) return;
    
    // Create a small sphere to mark our current position
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.progressMarker = new THREE.Mesh(geometry, material);
    this.progressMarker.position.copy(this.currentPath[0]);
    
    // Add to scene
    scene.add(this.progressMarker);
  }
  
  /**
   * Update the position of the progress marker
   * @private
   */
  updateProgressMarker() {
    if (!this.progressMarker || !this.targetBody) return;
    
    // Update marker position to match the body
    this.progressMarker.position.copy(this.targetBody.position);
  }
  
  /**
   * Remove the progress marker from the scene
   * @private
   */
  removeProgressMarker() {
    if (this.progressMarker && this.progressMarker.parent) {
      this.progressMarker.parent.remove(this.progressMarker);
      this.progressMarker.geometry.dispose();
      this.progressMarker.material.dispose();
      this.progressMarker = null;
    }
  }
} 