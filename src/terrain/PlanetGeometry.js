import * as THREE from 'three';
import { SimplexTerrain } from './SimplexTerrain.js';

/**
 * Creates and tests planet base geometry
 * Following steps 14 and 15 of the implementation plan
 */
export class PlanetGeometry {
  /**
   * Create a planet base geometry for testing
   * @returns {THREE.SphereGeometry} The created geometry
   */
  static createBaseGeometry() {
    // Define a sphere geometry with radius 10 and 20 segments for both width and height
    const radius = 10;
    const widthSegments = 20;
    const heightSegments = 20;
    
    const geometry = new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments
    );
    
    // Log the number of vertices for testing
    const vertexCount = geometry.attributes.position.count;
    console.log(`Planet base geometry created with ${vertexCount} vertices`);
    
    // Check if vertex count matches expected value (21x21 = 441)
    // The formula for vertex count in a sphere is (widthSegments+1) × (heightSegments+1)
    const expectedVertexCount = (widthSegments + 1) * (heightSegments + 1);
    console.log(`Expected vertex count: ${expectedVertexCount}`);
    
    if (vertexCount !== expectedVertexCount) {
      console.warn(`Vertex count mismatch! Expected ${expectedVertexCount}, got ${vertexCount}`);
    } else {
      console.log('✓ Vertex count matches expected value');
    }
    
    return geometry;
  }
  
  /**
   * Apply noise to the geometry to create terrain (Step 15)
   * @param {THREE.SphereGeometry} geometry - The sphere geometry to modify
   * @param {number} amplitude - Height of the terrain features (default: 2)
   * @param {number} scale - Scale of the noise pattern (default: 5)
   * @returns {THREE.SphereGeometry} - The modified geometry
   */
  static applyNoiseToTerrain(geometry, amplitude = 2, scale = 5) {
    console.log('Applying noise to terrain...');
    
    // Create terrain generator
    const terrainGenerator = new SimplexTerrain();
    
    // Apply noise using the terrain generator with increased amplitude
    terrainGenerator.applyNoiseToGeometry(geometry, amplitude * 2, scale);
    
    return geometry;
  }
  
  /**
   * Create a test mesh with the base geometry
   * @param {THREE.Scene} scene - The scene to add the mesh to
   * @param {boolean} applyNoise - Whether to apply noise to the terrain
   * @param {boolean} useWireframe - Whether to use wireframe for visibility
   * @returns {THREE.Mesh} The created mesh
   */
  static createTestMesh(scene, applyNoise = false, useWireframe = true) {
    // Create base geometry
    const geometry = this.createBaseGeometry();
    
    // Apply noise if requested (Step 15)
    if (applyNoise) {
      // Use more pronounced noise for visibility
      this.applyNoiseToTerrain(geometry, 4, 3);
      console.log('✓ Noise applied to terrain with increased amplitude');
    }
    
    // Create material with better visualization properties
    const material = new THREE.MeshPhongMaterial({
      color: applyNoise ? 0x4488ff : 0xff0000, // Blue for noisy terrain, red for base
      wireframe: useWireframe,
      flatShading: true, // Better for seeing the terrain details
      shininess: applyNoise ? 10 : 30, // Lower shininess for noisy terrain to see details better
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the mesh in front of the camera
    mesh.position.set(0, 0, -20);
    
    // Add to scene
    scene.add(mesh);
    console.log(`Test ${applyNoise ? 'noisy' : 'base'} planet mesh added to scene at:`, mesh.position);
    
    return mesh;
  }
  
  /**
   * Create two test meshes - one with base geometry and one with noisy terrain
   * @param {THREE.Scene} scene - The scene to add the meshes to
   * @returns {Object} Object containing both meshes
   */
  static createComparisonMeshes(scene) {
    // Create base geometry mesh (wireframe)
    const baseMesh = this.createTestMesh(scene, false, true);
    baseMesh.position.set(-15, 0, -20);
    
    // Create noisy terrain mesh (solid)
    const noisyMesh = this.createTestMesh(scene, true, false);
    noisyMesh.position.set(15, 0, -20);
    
    console.log('Created comparison meshes - base (left) and noisy (right)');
    
    return { baseMesh, noisyMesh };
  }
} 