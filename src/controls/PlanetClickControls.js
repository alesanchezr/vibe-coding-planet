import * as THREE from 'three';
import { SphericalPathFinder } from '../physics/SphericalPathFinder.js';
import { Atmosphere } from '../objects/Atmosphere.js';
import { InputManager } from '../input/InputManager.js';

/**
 * Controls for clicking on planet surfaces and detecting intersection points
 * @class
 */
export class PlanetClickControls {
  /**
   * Create new planet click controls
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {THREE.Camera} camera - The camera used for ray casting
   * @param {HTMLElement} domElement - The DOM element to listen for events on (typically canvas)
   * @param {Object} options - Optional configuration options
   */
  constructor(scene, camera, domElement, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement || document;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.enabled = false; // Initially disabled until camera focuses on a planet
    
    // Objects that can be clicked (planets)
    this.clickableObjects = [];
    
    // Optional callback for when a planet surface is clicked
    this.onPlanetClick = null;
    
    // Visual marker for clicked point
    this.marker = this._createMarker();
    this.scene.add(this.marker); // Initially added to scene but will be re-parented when clicked
    this.marker.visible = false;
    
    // Current planet the marker is attached to
    this.markerPlanet = null;
    
    // Path finder for calculating and visualizing paths
    this.pathFinder = new SphericalPathFinder({
      segmentCount: options.pathSegmentCount || 30
    });
    
    // Active path visualization
    this.activePath = null;
    
    // Reference to planet rotation controls for coordination
    this.planetRotationControls = options.planetRotationControls || [];
    
    // Initialize the input manager for unified mouse/touch handling
    this.inputManager = new InputManager(this.domElement, {
      dragThreshold: options.dragThreshold || 5,
      clickTimeThreshold: options.clickTimeThreshold || 300
    });
    
    // Set up input callbacks
    this._setupInputCallbacks();
    
    console.log('PlanetClickControls initialized with unified input handling');
  }
  
  /**
   * Set up callbacks for the input manager
   * @private
   */
  _setupInputCallbacks() {
    // Handle clicks (both mouse and touch)
    this.inputManager.setClickCallback((event) => {
      if (!this.enabled) return;
      
      // Update mouse coordinates for raycasting
      this.mouse.x = event.normalizedX;
      this.mouse.y = event.normalizedY;
      
      // Process the click
      this._processClick(event.originalEvent);
    });
    
    // We don't need to implement the drag handlers here since
    // the InputManager already handles distinguishing between
    // clicks and drags, and will only call our click handler
    // for proper clicks.
  }
  
  /**
   * Add a list of planets to the clickable objects
   * @param {Planet[]} planets - Array of planets to add
   */
  addClickablePlanets(planets) {
    if (!planets || !Array.isArray(planets)) return;
    
    planets.forEach(planet => {
      this.addClickableObject(planet);
    });
  }
  
  /**
   * Add a planet to the list of clickable objects
   * @param {THREE.Object3D} planet - Planet object to add
   */
  addClickableObject(planet) {
    if (planet && planet.mesh) {
      this.clickableObjects.push(planet.mesh);
      console.log(`Added ${planet.name} to clickable objects`);
    }
  }
  
  /**
   * Enable or disable the controls
   * @param {boolean} enabled - Whether controls should be enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // When disabling, hide the marker
    if (!enabled) {
      this.marker.visible = false;
    }
  }
  
  /**
   * Set planet rotation controls for coordination
   * @param {PlanetRotationControls[]} controls - Array of rotation controls
   */
  setPlanetRotationControls(controls) {
    this.planetRotationControls = controls || [];
  }
  
  /**
   * Create a visual marker for the clicked point
   * @returns {THREE.Object3D} Marker mesh
   * @private
   */
  _createMarker() {
    // Create a marker group to hold all visual elements
    const markerGroup = new THREE.Group();
    
    // Create a small sphere to mark the clicked location
    const sphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      opacity: 0.8,
      transparent: true
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    markerGroup.add(sphere);
    
    // Add a larger, pulsing ring
    const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00, 
      opacity: 0.6,
      transparent: true,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // Orient the ring to face outward from the planet surface
    ring.rotation.x = Math.PI / 2;
    markerGroup.add(ring);
    
    // Add a pin/arrow pointing from the surface
    const pinGeometry = new THREE.ConeGeometry(0.15, 0.5, 8);
    const pinMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    pin.rotation.x = Math.PI; // Point away from the center
    pin.position.y = 0.4; // Position above the sphere
    markerGroup.add(pin);
    
    // Store references for animation
    markerGroup.ring = ring;
    markerGroup.sphere = sphere;
    markerGroup.pin = pin;
    
    // Add animation properties
    markerGroup.animationTime = 0;
    
    return markerGroup;
  }
  
  /**
   * Update the marker animation
   * @param {number} deltaTime - Time in seconds since last update
   */
  update(deltaTime) {
    if (this.marker && this.marker.visible) {
      // Update animation time
      this.marker.animationTime += deltaTime;
      
      // Animate the pin up and down
      if (this.marker.pin) {
        this.marker.pin.position.y = 0.4 + Math.sin(this.marker.animationTime * 5) * 0.1;
      }
      
      // Animate the ring size
      if (this.marker.ring) {
        const scale = 1 + Math.sin(this.marker.animationTime * 3) * 0.2;
        this.marker.ring.scale.set(scale, scale, scale);
      }
      
      // Animate the sphere pulsing
      if (this.marker.sphere) {
        const opacity = 0.6 + Math.sin(this.marker.animationTime * 7) * 0.4;
        this.marker.sphere.material.opacity = Math.max(0.2, opacity);
      }
    }
  }
  
  /**
   * Process a click event when not dragging
   * @param {MouseEvent|TouchEvent} event - The original event
   * @private
   */
  _processClick(event) {
    // Perform raycasting
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get intersections with clickable objects (recursive check)
    let intersects = this.raycaster.intersectObjects(this.clickableObjects, true);
    
    // Filter out intersections with Atmosphere objects
    intersects = intersects.filter(intersection => {
        // Check the intersected object itself
        if (intersection.object instanceof Atmosphere) {
            return false;
        }
        // Also check if any ancestor is an Atmosphere object (though less likely with current setup)
        let parent = intersection.object.parent;
        while (parent) {
            if (parent instanceof Atmosphere) {
                console.log('Ignoring click on child of Atmosphere object.');
                return false;
            }
            parent = parent.parent;
        }
        return true; // Keep this intersection
    });
    
    if (intersects.length > 0) {
      // Get the first *valid* (non-atmosphere) intersection
      const intersection = intersects[0];
      
      // Check if the clicked object is a buildable element (rocket, construction site, etc.)
      let buildableObject = null;

      // Traverse up from the clicked object to find the top-level buildable group
      let potentialBuildable = intersection.object;
      
      // First, find which planet was clicked (we need this information for rockets)
      let clickedPlanetName = null;
      let planetObject = intersection.object;
      while (planetObject && !clickedPlanetName) {
          // Look for earth or mars in the name
          if (planetObject.name.includes('earth')) {
              clickedPlanetName = 'earth';
          } else if (planetObject.name.includes('mars')) {
              clickedPlanetName = 'mars';
          }
          // Move up to parent
          if (!clickedPlanetName && planetObject.parent) {
              planetObject = planetObject.parent;
          } else {
              break;
          }
      }
      
      console.log(`Planet determined from click: ${clickedPlanetName || 'unknown'}`);
      
      // Now look for buildable
      while (potentialBuildable) {
          // Check if this object is marked as buildable in its userData
          if (potentialBuildable.userData && 
              (potentialBuildable.userData.isRocket || 
               potentialBuildable.userData.isBuildable || 
               potentialBuildable.userData.isHitbox)) {
              
              // Found a buildable part or the main group itself.
              // Now, ensure we get the TOP-LEVEL buildable group.
              let topLevelBuildable = potentialBuildable;
              while (topLevelBuildable.parent && 
                     topLevelBuildable.parent.userData && 
                     (topLevelBuildable.parent.userData.isRocket || 
                      topLevelBuildable.parent.userData.isBuildable)) {
                   // Keep going up as long as the parent is also marked as buildable.
                   // This handles nested structures and finds the outermost marked group.
                   topLevelBuildable = topLevelBuildable.parent;
              }
              
              // We found the correct top-level object
              buildableObject = topLevelBuildable;
              
              // If the object doesn't have planetName in its userData, add it
              if (clickedPlanetName && (!buildableObject.userData.planetName)) {
                  console.log(`Adding planetName ${clickedPlanetName} to buildable userData`);
                  buildableObject.userData.planetName = clickedPlanetName;
              }
              
              console.log('Buildable element clicked, passing top-level object:', buildableObject.name, 
                          'planetName:', buildableObject.userData.planetName || clickedPlanetName || 'unknown');
              break; // Exit the outer while loop, we found our object
          }
          // Move up to the parent if the current one wasn't marked
          potentialBuildable = potentialBuildable.parent;
      }

      // If we found a buildable object after traversing up
      if (buildableObject) {
          // Invoke buildable click handler in game if available
          if (window.game && typeof window.game.handleBuildableClick === 'function') {
            window.game.handleBuildableClick(buildableObject); // Pass the identified top-level object
          } else if (window.game && typeof window.game.handleRocketClick === 'function') {
            // Fallback to older handler for backward compatibility
            window.game.handleRocketClick(buildableObject);
          }
          
          // Don't process this click for movement
          return;
      }
      
      // Check if the click is near a buildable element even if not directly on it
      // This helps prevent clicks very close to buildable elements from triggering movement
      const clickPosition = intersection.point.clone();
      const isNearBuildable = this._isNearAnyBuildable(clickPosition, 2.5); // 2.5 units threshold
      
      if (isNearBuildable) {
        console.log('Click detected near a buildable element - ignoring for movement');
        return;
      }
      
      // Find which planet was clicked
      let planet = null;
      
      // Reuse the planetObject from earlier
      // No need to retraverse the hierarchy since we already found the planet name
      
      // Find the planet mesh in the scene - we need the top-level planet object
      let planetMesh = null;
      let planetRadius = 15; // Default radius
      
      this.clickableObjects.forEach(obj => {
        if (obj.name === clickedPlanetName || (obj.parent && obj.parent.name === clickedPlanetName)) {
          planetMesh = obj;
          // Extract radius from userData if available
          if (obj.userData && obj.userData.radius) {
            planetRadius = obj.userData.radius;
          }
        }
      });
      
      if (!planetMesh) {
        // Fallback search in the whole scene
        this.scene.traverse(object => {
          if (object.name === clickedPlanetName) {
            planetMesh = object;
            if (object.userData && object.userData.radius) {
              planetRadius = object.userData.radius;
            }
          }
        });
      }
      
      // If we found the proper planet mesh, use it
      if (planetMesh) {
        planet = planetMesh;
      } else {
        console.warn(`Could not find planet mesh for ${clickedPlanetName}, using clicked object`);
        planet = planetObject;
      }
      
      // Log debug information about the planet
      console.log('Planet details:', {
        name: clickedPlanetName,
        mesh: planetMesh ? 'found' : 'not found',
        radius: planetRadius,
        position: planet ? new THREE.Vector3().setFromMatrixPosition(planet.matrixWorld) : 'unknown'
      });
      
      // If the marker is already attached to a different planet, remove it first
      if (this.markerPlanet && this.markerPlanet !== planet) {
        this.markerPlanet.remove(this.marker);
        this.scene.add(this.marker); // Add back to scene temporarily
      }
      
      // Get the world position for the intersection point
      const worldIntersectionPoint = intersection.point.clone();
      
      // Reset marker animation time
      this.marker.animationTime = 0;
      
      // Get the planet's center and world position
      const planetCenter = new THREE.Vector3();
      if (planet && planet.getWorldPosition) {
        planet.getWorldPosition(planetCenter);
      }
      
      // If we have a valid planet to attach to
      if (planet && planet.add) {
        // Use proper world-to-local transformation to account for planet rotation
        // This converts the intersection point from world space to the planet's local space
        const worldToLocal = new THREE.Matrix4().copy(planet.matrixWorld).invert();
        const localPosition = worldIntersectionPoint.clone().applyMatrix4(worldToLocal);
        
        // Position marker using the properly transformed local coordinates
        this.marker.position.copy(localPosition);
        
        // Orient marker to face outward along the normal
        if (intersection.face) {
          const normal = intersection.face.normal.clone();
          // Transform the normal to world space
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld);
          normal.applyMatrix3(normalMatrix).normalize();
          
          // Create a quaternion that orients the marker to face along the normal
          const upVector = new THREE.Vector3(0, 1, 0);
          this.marker.quaternion.setFromUnitVectors(upVector, normal);
        }
        
        // Make marker a child of planet
        planet.add(this.marker);
        this.markerPlanet = planet;
        this.marker.visible = true;
        
        console.log('Marker attached to planet at local position:', localPosition);
      } else {
        // Fallback to just placing marker at world position 
        this.marker.position.copy(worldIntersectionPoint);
        
        // Orient marker to face outward along the normal
        if (intersection.face) {
          const normal = intersection.face.normal.clone();
          // Transform the normal to world space
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld);
          normal.applyMatrix3(normalMatrix).normalize();
          
          // Create a quaternion that orients the marker to face along the normal
          const upVector = new THREE.Vector3(0, 1, 0);
          this.marker.quaternion.setFromUnitVectors(upVector, normal);
        }
        
        this.marker.visible = true;
        console.warn('Could not attach marker to planet, using world position');
      }
      
      // Remove any existing path visualization
      this._clearPathVisualization();
      
      // Get player position for path calculation
      const playerPosition = this._getPlayerPosition(clickedPlanetName);
      
      if (playerPosition) {
        // Calculate and display path from player to clicked point
        this._createAndShowPath(playerPosition, worldIntersectionPoint, planetRadius, planet);
      }
      
      // Call the callback if it exists
      if (this.onPlanetClick) {
        this.onPlanetClick({
          point: worldIntersectionPoint,
          planetName: clickedPlanetName,
          normal: intersection.face ? intersection.face.normal.clone() : new THREE.Vector3(0, 1, 0),
          distance: intersection.distance,
          path: this.activePath ? this.activePath.points : null
        });
      }
      
      console.log(`Planet surface clicked at: (${worldIntersectionPoint.x.toFixed(2)}, ${worldIntersectionPoint.y.toFixed(2)}, ${worldIntersectionPoint.z.toFixed(2)}) on ${clickedPlanetName}`);
    } else {
      // Hide marker if no planet was clicked
      this.marker.visible = false;
    }
  }
  
  /**
   * Get the player's current position on a planet
   * This is a placeholder - the actual implementation would come from your player system
   * @param {string} planetName - The name of the planet
   * @returns {THREE.Vector3|null} The player's position or null if not found
   * @private
   */
  _getPlayerPosition(planetName) {
    // This is a placeholder - you'll need to implement this based on your game's architecture
    // It should return the position of the player's body on the specified planet
    
    // For now, we'll get the player position from window.game if available
    if (window.game && window.game.getCurrentPlayerPosition) {
      const position = window.game.getCurrentPlayerPosition();
      if (position) {
        return new THREE.Vector3(position.x, position.y, position.z);
      }
    }
    
    // If no player position is available, return null
    return null;
  }
  
  /**
   * Create and show a path from the player to the clicked point
   * @param {THREE.Vector3} startPoint - The starting point (player position)
   * @param {THREE.Vector3} endPoint - The ending point (clicked position)
   * @param {number} radius - The radius of the planet
   * @param {Object} planet - The planet object
   * @private
   */
  _createAndShowPath(startPoint, endPoint, radius, planet) {
    // Get the planet center position
    const planetCenter = new THREE.Vector3();
    if (planet && planet.getWorldPosition) {
      planet.getWorldPosition(planetCenter);
    } else {
      console.warn('Cannot get planet world position, using default center (0,0,0)');
    }
    
    console.log('Creating path from', startPoint, 'to', endPoint, 'with planet center', planetCenter, 'and radius', radius);
    
    // Calculate path points using findPath which accounts for planet center
    const pathPoints = this.pathFinder.findPath(startPoint, endPoint, planetCenter, radius);
    
    // Create path visualization
    const pathVisualization = this.pathFinder.createPathVisualization(pathPoints);
    
    // Important: Properly transform the path to the planet's local coordinate system
    if (planet && planet.add) {
      // Get the world-to-local transformation matrix that accounts for planet rotation
      const worldToLocal = new THREE.Matrix4().copy(planet.matrixWorld).invert();
      
      // If the path visualization has any position offset, transform it
      if (pathVisualization.position) {
        pathVisualization.position.set(0, 0, 0); // Reset position to origin
      }
      
      // For each child in the path group
      if (pathVisualization.children) {
        pathVisualization.children.forEach(child => {
          // Get the geometry attributes
          if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
            const positions = child.geometry.attributes.position;
            const positionArray = positions.array;
            
            // Update each vertex position by transforming it from world to local space
            for (let i = 0; i < positionArray.length; i += 3) {
              const vertex = new THREE.Vector3(
                positionArray[i],
                positionArray[i + 1],
                positionArray[i + 2]
              );
              
              // Apply the world-to-local transformation
              vertex.applyMatrix4(worldToLocal);
              
              // Update the position array
              positionArray[i] = vertex.x;
              positionArray[i + 1] = vertex.y;
              positionArray[i + 2] = vertex.z;
            }
            
            // Mark attributes for update
            positions.needsUpdate = true;
            
            // Update any associated line distances
            if (child.geometry.attributes.lineDistance) {
              child.computeLineDistances();
            }
          }
        });
      }
      
      // Add to planet
      planet.add(pathVisualization);
      console.log('Path added as child of planet with properly transformed vertices');
    } else {
      // Fallback to adding directly to scene
      this.scene.add(pathVisualization);
      console.log('Path added directly to scene');
    }
    
    // Store the active path
    this.activePath = {
      points: pathPoints,
      line: pathVisualization
    };
    
    // Calculate path length for debug
    const pathLength = this.pathFinder.calculatePathLength(pathPoints);
    console.log(`Path created with length: ${pathLength.toFixed(2)} units (${pathPoints.length} points)`);
  }
  
  /**
   * Clear any existing path visualization
   * @private
   */
  _clearPathVisualization() {
    if (this.activePath && this.activePath.line) {
      // Remove from scene or parent
      if (this.activePath.line.parent) {
        this.activePath.line.parent.remove(this.activePath.line);
      } else {
        this.scene.remove(this.activePath.line);
      }
      
      // If line is a group, dispose of all children
      if (this.activePath.line.dashedLine) {
        // Dispose of dashed line
        if (this.activePath.line.dashedLine.geometry) {
          this.activePath.line.dashedLine.geometry.dispose();
        }
        if (this.activePath.line.dashedLine.material) {
          this.activePath.line.dashedLine.material.dispose();
        }
      }
      
      if (this.activePath.line.glowLine) {
        // Dispose of glow line
        if (this.activePath.line.glowLine.geometry) {
          this.activePath.line.glowLine.geometry.dispose();
        }
        if (this.activePath.line.glowLine.material) {
          this.activePath.line.glowLine.material.dispose();
        }
      }
      
      // If it's not a group with children, dispose of geometry and material directly
      if (!this.activePath.line.dashedLine && this.activePath.line.geometry) {
        this.activePath.line.geometry.dispose();
      }
      
      if (!this.activePath.line.dashedLine && this.activePath.line.material) {
        this.activePath.line.material.dispose();
      }
      
      // Clear reference
      this.activePath = null;
    }
  }
  
  /**
   * Check if any planet is currently being dragged
   * @returns {boolean} Whether any planet is being dragged
   * @private
   */
  _isPlanetBeingDragged() {
    if (!this.planetRotationControls || this.planetRotationControls.length === 0) {
      return false;
    }
    
    // Check if any rotation controls are currently dragging
    const isDragging = this.planetRotationControls.some(control => control && control.isDragging);
    
    // Debug: Log the dragging state of each control
    if (isDragging) {
      console.log('Planet rotation controls dragging states:', 
        this.planetRotationControls.map(control => control ? control.isDragging : false)
      );
    }
    
    return isDragging;
  }
  
  /**
   * Force reset drag state of all rotation controls
   * @private
   */
  _resetAllPlanetDragStates() {
    if (!this.planetRotationControls || this.planetRotationControls.length === 0) {
      return;
    }
    
    this.planetRotationControls.forEach(control => {
      if (control && typeof control.resetDragState === 'function') {
        control.resetDragState();
      } else if (control && control.isDragging) {
        // Fallback if resetDragState isn't available
        console.log('Forcibly resetting drag state on a planet control');
        control.isDragging = false;
      }
    });
  }
  
  /**
   * Check if a point is near any buildable element
   * @param {THREE.Vector3} position - Position to check
   * @param {number} threshold - Distance threshold
   * @returns {boolean} Whether the point is near any buildable
   * @private
   */
  _isNearAnyBuildable(position, threshold = 3.0) {  // Increased default threshold from 2.0 to 3.0
    // Find all buildable elements in the scene
    const buildableElements = [];
    
    // First check the clickable objects
    this.clickableObjects.forEach(obj => {
      if ((obj.name && (obj.name.includes('rocket') || obj.name.includes('rocketHitbox'))) || 
          (obj.name && obj.name.includes('buildable')) ||
          (obj.userData && 
            (obj.userData.isRocket || obj.userData.isBuildable || obj.userData.isHitbox))) {
        buildableElements.push(obj);
      }
    });
    
    // If we don't find any buildable elements in clickable objects, search the whole scene
    if (buildableElements.length === 0) {
      this.scene.traverse(obj => {
        if ((obj.name && (obj.name.includes('rocket') || obj.name.includes('rocketHitbox'))) || 
            (obj.name && obj.name.includes('buildable')) ||
            (obj.userData && 
              (obj.userData.isRocket || obj.userData.isBuildable || obj.userData.isHitbox))) {
          buildableElements.push(obj);
        }
      });
    }
    
    // Get game's buildable objects if available
    if (window.game && window.game.planetSystem && window.game.planetSystem.buildables) {
      window.game.planetSystem.buildables.forEach(buildable => {
        if (buildable.mesh && !buildableElements.includes(buildable.mesh)) {
          buildableElements.push(buildable.mesh);
        }
      });
    }
    
    // Check distance to each buildable element
    for (const buildable of buildableElements) {
      // Get the world position of the buildable element
      const buildablePosition = new THREE.Vector3();
      buildable.getWorldPosition(buildablePosition);
      
      // Calculate distance
      const distance = position.distanceTo(buildablePosition);
      
      // Check if within threshold
      if (distance < threshold) {
        console.log(`Position is near a buildable element: ${distance.toFixed(2)} units away`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Set camera to look at the path
   * @param {THREE.Vector3} startPoint - Start point
   * @param {THREE.Vector3} endPoint - End point
   * @param {THREE.Vector3} planetCenter - Center of the planet
   * @private
   */
  _setCameraLookAtPath(startPoint, endPoint, planetCenter) {
    // Implementation of _setCameraLookAtPath method
  }
  
  /**
   * Clear the active path visualization
   * @private
   */
  _clearActivePath() {
    // Implementation of _clearActivePath method
  }
  
  /**
   * Create a path visualization
   * @param {THREE.Vector3[]} pathPoints - Array of points in the path
   * @returns {THREE.Line} The path line
   * @private
   */
  _createPathVisualization(pathPoints) {
    // Implementation of _createPathVisualization method
  }
  
  /**
   * Set a callback function for when a planet is clicked
   * @param {Function} callback - Function to call when a planet is clicked
   */
  setClickCallback(callback) {
    if (typeof callback === 'function') {
      this.onPlanetClick = callback;
    }
  }
  
  /**
   * Dispose of resources and remove event listeners
   */
  dispose() {
    // Dispose of the input manager to clean up event listeners
    if (this.inputManager) {
      this.inputManager.dispose();
    }
    
    // Clear the active path
    this._clearActivePath();
    
    // Remove the marker
    if (this.marker) {
      this.scene.remove(this.marker);
      if (this.marker.sphere) {
        this.marker.sphere.geometry.dispose();
        this.marker.sphere.material.dispose();
      }
    }
  }
} 