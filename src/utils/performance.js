import * as THREE from 'three';

/**
 * Set up performance monitoring for the game
 * Follows the performance-optimization-rules
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 */
export function setupPerformanceMonitoring(renderer) {
  try {
    // Add performance info to console on load
    console.log('Renderer info:', renderer.info);
    
  
  } catch (error) {
    console.error('Failed to set up performance monitoring:', error);
  }
}

/**
 * Optimize a 3D mesh for better performance
 * @param {THREE.Mesh} mesh - The mesh to optimize
 * @returns {THREE.Mesh} - The optimized mesh
 */
export function optimizeMesh(mesh) {
  // Ensure we're using BufferGeometry
  if (!(mesh.geometry instanceof THREE.BufferGeometry)) {
    console.warn('Converting to BufferGeometry for better performance');
    mesh.geometry = new THREE.BufferGeometry().fromGeometry(mesh.geometry);
  }
  
  // Compute vertex normals if not already computed
  mesh.geometry.computeVertexNormals();
  
  return mesh;
}

/**
 * Create instanced mesh for repeated objects
 * @param {THREE.BufferGeometry} geometry - The geometry to instance
 * @param {THREE.Material} material - The material to use
 * @param {number} count - Maximum number of instances
 * @returns {THREE.InstancedMesh} - The instanced mesh
 */
export function createInstancedMesh(geometry, material, count) {
  return new THREE.InstancedMesh(geometry, material, count);
}

/**
 * Create LOD (Level of Detail) for an object
 * @param {Array<{distance: number, object: THREE.Object3D}>} levels - Array of levels with distances
 * @returns {THREE.LOD} - The LOD object
 */
export function createLOD(levels) {
  const lod = new THREE.LOD();
  
  levels.forEach(level => {
    lod.addLevel(level.object, level.distance);
  });
  
  return lod;
} 