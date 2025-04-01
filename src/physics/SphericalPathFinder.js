import * as THREE from 'three';

/**
 * Handles path finding between two points on a spherical surface
 * Calculates geodesic (great circle) paths which are the shortest paths between points on a sphere
 * @class
 */
export class SphericalPathFinder {
  /**
   * Create a new spherical path finder
   * @param {Object} options - Configuration options
   * @param {number} options.segmentCount - Number of segments in the path (higher = smoother)
   */
  constructor(options = {}) {
    this.segmentCount = options.segmentCount || 30;
    this.pathMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
      dashSize: 0.5,
      gapSize: 0.3
    });
  }
  
  /**
   * Calculate a path between two points on a sphere
   * @param {THREE.Vector3} startPoint - The starting point on the sphere surface
   * @param {THREE.Vector3} endPoint - The ending point on the sphere surface
   * @param {number} radius - The radius of the sphere
   * @returns {THREE.Vector3[]} Array of points along the path
   */
  calculatePath(startPoint, endPoint, radius) {
    // Ensure we have the right radius by normalizing and rescaling
    const start = startPoint.clone().normalize().multiplyScalar(radius);
    const end = endPoint.clone().normalize().multiplyScalar(radius);
    
    // Calculate the angle between the start and end points (in radians)
    const angle = start.angleTo(end);
    
    // Log the angle for debugging
    console.log(`Great circle path angle: ${(angle * 180 / Math.PI).toFixed(2)} degrees`);
    
    // If the points are very close, just return a direct line
    if (angle < 0.01) {
      console.log('Points are very close, using direct line');
      return [start.clone(), end.clone()];
    }
    
    // Calculate the number of segments based on the angle
    // More segments for longer paths for smooth curves
    const adaptiveSegments = Math.max(
      this.segmentCount, 
      Math.ceil(this.segmentCount * angle / Math.PI)
    );
    
    console.log(`Using ${adaptiveSegments} segments for path`);
    
    // Create path points array
    const pathPoints = [];
    
    // Alternative method using vector calculations directly
    // This is often more stable than quaternion-based slerp
    // Calculate the axis of rotation (perpendicular to both vectors)
    const rotationAxis = start.clone().cross(end).normalize();
    
    // If vectors are parallel or anti-parallel, choose an arbitrary perpendicular axis
    if (rotationAxis.lengthSq() < 0.001) {
      // Find an arbitrary perpendicular vector
      if (Math.abs(start.x) < Math.abs(start.y)) {
        rotationAxis.set(1, 0, 0);
      } else {
        rotationAxis.set(0, 1, 0);
      }
      rotationAxis.cross(start).normalize();
    }
    
    // Add the first point
    pathPoints.push(start.clone());
    
    // Calculate intermediate points
    for (let i = 1; i < adaptiveSegments; i++) {
      const t = i / adaptiveSegments;
      
      // Create rotation matrix for the current angle
      const currentAngle = angle * t;
      const rotMatrix = new THREE.Matrix4().makeRotationAxis(rotationAxis, currentAngle);
      
      // Rotate the start point
      const point = start.clone().applyMatrix4(rotMatrix);
      
      // Ensure the point is exactly at the right radius
      point.normalize().multiplyScalar(radius);
      
      pathPoints.push(point);
    }
    
    // Add the end point
    pathPoints.push(end.clone());
    
    return pathPoints;
  }
  
  /**
   * Create a visual representation of the path
   * @param {THREE.Vector3[]} pathPoints - Array of points defining the path
   * @returns {THREE.Line} Line object representing the path
   */
  createPathVisualization(pathPoints) {
    // Create a geometry from the path points
    const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    
    // Create a dashed line using LineDashedMaterial
    const dashedLine = new THREE.Line(
      geometry.clone(),
      new THREE.LineDashedMaterial({
        color: 0xffffff,    // White for high visibility
        dashSize: 0.5,
        gapSize: 0.3,
        linewidth: 2,
        opacity: 0.9,
        transparent: true
      })
    );
    
    // Compute line distances for dashed line rendering
    dashedLine.computeLineDistances();
    
    // Create a thicker glow line behind the dashed line for better visibility
    const glowGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const glowLine = new THREE.Line(
      glowGeometry,
      new THREE.LineBasicMaterial({
        color: 0x4deeea,   // Cyan glow
        linewidth: 4,
        opacity: 0.4,
        transparent: true
      })
    );
    
    // Create a group to hold both lines
    const pathGroup = new THREE.Group();
    pathGroup.add(glowLine);
    pathGroup.add(dashedLine);
    
    // Store references to the components for disposal later
    pathGroup.dashedLine = dashedLine;
    pathGroup.glowLine = glowLine;
    
    return pathGroup;
  }
  
  /**
   * Calculate and create a visualized path in one step
   * @param {THREE.Vector3} startPoint - The starting point on the sphere surface
   * @param {THREE.Vector3} endPoint - The ending point on the sphere surface
   * @param {number} radius - The radius of the sphere
   * @returns {Object} Object containing the path points and visual representation
   */
  createPath(startPoint, endPoint, radius) {
    const pathPoints = this.calculatePath(startPoint, endPoint, radius);
    const pathVisualization = this.createPathVisualization(pathPoints);
    
    return {
      points: pathPoints,
      line: pathVisualization
    };
  }
  
  /**
   * Calculate the length of a path
   * @param {THREE.Vector3[]} pathPoints - Array of points defining the path
   * @returns {number} Length of the path
   */
  calculatePathLength(pathPoints) {
    let length = 0;
    
    for (let i = 1; i < pathPoints.length; i++) {
      length += pathPoints[i].distanceTo(pathPoints[i - 1]);
    }
    
    return length;
  }
  
  /**
   * Find a path from start to end on a sphere
   * @param {THREE.Vector3} start - The starting point (can be not on surface)
   * @param {THREE.Vector3} end - The ending point (can be not on surface)
   * @param {THREE.Vector3} planetCenter - The center of the planet
   * @param {number} planetRadius - The radius of the planet
   * @returns {Array} Array of points defining the path
   */
  findPath(start, end, planetCenter, planetRadius) {
    // Debug the input points
    console.log('Finding path with inputs:', {
      start: start.clone(),
      end: end.clone(),
      planetCenter: planetCenter.clone(),
      planetRadius: planetRadius
    });
    
    // Calculate vectors from planet center to start and end points
    const startToPlanetCenter = start.clone().sub(planetCenter);
    const endToPlanetCenter = end.clone().sub(planetCenter);
    
    // Get the distance from planet center to start and end points
    const startDistance = startToPlanetCenter.length();
    const endDistance = endToPlanetCenter.length();
    
    // Check if points are already on surface (within small tolerance)
    const isStartOnSurface = Math.abs(startDistance - planetRadius) < 0.1;
    const isEndOnSurface = Math.abs(endDistance - planetRadius) < 0.1;
    
    // Normalize vectors to get directions from center
    const startDir = startToPlanetCenter.clone().normalize();
    const endDir = endToPlanetCenter.clone().normalize();
    
    // Project points to surface - ensure we use fresh clones to avoid contamination
    const startSurface = planetCenter.clone().add(startDir.clone().multiplyScalar(planetRadius));
    const endSurface = planetCenter.clone().add(endDir.clone().multiplyScalar(planetRadius));
    
    // Debug the calculated surface points
    console.log('Projected points to surface:', {
      startOriginal: start.clone(),
      startSurface: startSurface.clone(),
      startOnSurface: isStartOnSurface,
      endOriginal: end.clone(),
      endSurface: endSurface.clone(),
      endOnSurface: isEndOnSurface
    });
    
    // Calculate intermediary points using the great circle path on the unit sphere
    const pathPoints = [];
    
    // Number of segments to create
    const segments = this.segmentCount;
    
    // Calculate the angle between the start and end direction vectors
    const angle = startDir.angleTo(endDir);
    
    console.log(`Great circle angle: ${(angle * 180 / Math.PI).toFixed(2)} degrees`);
    
    // Calculate the axis of rotation (perpendicular to the plane containing both vectors)
    const rotationAxis = startDir.clone().cross(endDir).normalize();
    
    // If the rotation axis is very small (points are nearly aligned), use an arbitrary perpendicular axis
    if (rotationAxis.lengthSq() < 0.001) {
      if (Math.abs(startDir.x) < Math.abs(startDir.y)) {
        rotationAxis.set(1, 0, 0);
      } else {
        rotationAxis.set(0, 1, 0);
      }
      rotationAxis.cross(startDir).normalize();
    }
    
    // Add the starting point
    pathPoints.push(startSurface.clone());
    
    // Generate the intermediate points along the great circle
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const currentAngle = angle * t;
      
      // Create the rotation matrix for this angle around the rotation axis
      const rotMatrix = new THREE.Matrix4().makeRotationAxis(rotationAxis, currentAngle);
      
      // Start with the start direction and apply the rotation
      const pointDir = startDir.clone().applyMatrix4(rotMatrix).normalize();
      
      // Calculate the point on the sphere surface
      const point = planetCenter.clone().add(pointDir.multiplyScalar(planetRadius));
      
      // Validate the point's distance from planet center
      const distFromCenter = point.distanceTo(planetCenter);
      if (Math.abs(distFromCenter - planetRadius) > 0.01) {
        console.warn(`Path point not on surface: ${distFromCenter} vs ${planetRadius}`);
        // Force it to be exactly at the right radius
        const correctedPoint = planetCenter.clone().add(
          point.clone().sub(planetCenter).normalize().multiplyScalar(planetRadius)
        );
        pathPoints.push(correctedPoint);
      } else {
        pathPoints.push(point);
      }
    }
    
    // Add the ending point
    pathPoints.push(endSurface.clone());
    
    // Verify all points are on the surface
    for (let i = 0; i < pathPoints.length; i++) {
      const distToCenter = pathPoints[i].distanceTo(planetCenter);
      if (Math.abs(distToCenter - planetRadius) > 0.01) {
        console.warn(`Final check: Point ${i} not on surface: ${distToCenter} vs ${planetRadius}`);
        // Correct the point
        pathPoints[i] = planetCenter.clone().add(
          pathPoints[i].clone().sub(planetCenter).normalize().multiplyScalar(planetRadius)
        );
      }
    }
    
    // Debug the output
    console.log('Path created with', pathPoints.length, 'points');
    
    return pathPoints;
  }
} 