import * as THREE from 'three';
import noiseFunctions from '../shaders/noise-functions.glsl?raw';
import atmosphereVertexShader from '../shaders/atmosphere.vert?raw';
import atmosphereFragmentShaderSource from '../shaders/atmosphere.frag?raw';

const texLoader = new THREE.TextureLoader();
// Load texture from the public directory (served at root)
const cloudTex = texLoader.load('/cloud.png');

/**
 * Creates a particle-based atmosphere effect around a celestial body.
 * Uses custom shaders for appearance and animation.
 * @class
 * @extends THREE.Points
 */
export class Atmosphere extends THREE.Points {
  /**
   * Creates an instance of Atmosphere.
   * @param {object} options - Configuration options for the atmosphere.
   * @param {number} [options.radius=10] - The base radius around which the atmosphere forms.
   * @param {number} [options.thickness=1] - The thickness of the atmosphere layer above the radius.
   * @param {number} [options.particles=5000] - The number of particles in the atmosphere.
   * @param {number} [options.minParticleSize=5] - Minimum size of the atmosphere particles.
   * @param {number} [options.maxParticleSize=15] - Maximum size of the atmosphere particles.
   * @param {THREE.Color} [options.color=0xffffff] - The color tint of the atmosphere particles.
   * @param {number} [options.opacity=0.5] - Base opacity of the particles.
   * @param {number} [options.density=0.5] - Controls the noise threshold for particle visibility.
   * @param {number} [options.scale=5] - Scale factor for the noise function affecting particle distribution.
   * @param {number} [options.speed=0.05] - Speed at which the noise pattern evolves over time.
   * @param {THREE.Vector3} [options.lightDirection=new THREE.Vector3(1, 1, 1)] - Direction of the primary light source.
   */
  constructor(options = {}) {
    super();

    // Default parameters merged with provided options
    this.params = {
      radius: options.radius !== undefined ? options.radius : 10,
      thickness: options.thickness !== undefined ? options.thickness : 1,
      particles: options.particles !== undefined ? options.particles : 5000,
      minParticleSize: options.minParticleSize !== undefined ? options.minParticleSize : 5,
      maxParticleSize: options.maxParticleSize !== undefined ? options.maxParticleSize : 15,
      color: options.color instanceof THREE.Color ? options.color : new THREE.Color(options.color !== undefined ? options.color : 0xffffff),
      opacity: options.opacity !== undefined ? options.opacity : 0.5,
      density: options.density !== undefined ? options.density : 0.5,
      scale: options.scale !== undefined ? options.scale : 5,
      speed: options.speed !== undefined ? options.speed : 0.05,
      lightDirection: options.lightDirection instanceof THREE.Vector3 ? options.lightDirection : new THREE.Vector3(1, 1, 1).normalize(),
    };

    // Combine noise functions with the main fragment shader code
    const fragmentShader = `${noiseFunctions}\n${atmosphereFragmentShaderSource}`;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pointTexture: { value: cloudTex },
        radius: { value: this.params.radius },
        thickness: { value: this.params.thickness },
        minParticleSize: { value: this.params.minParticleSize },
        maxParticleSize: { value: this.params.maxParticleSize },
        color: { value: this.params.color },
        opacity: { value: this.params.opacity },
        density: { value: this.params.density },
        scale: { value: this.params.scale },
        speed: { value: this.params.speed },
        lightDirection: { value: this.params.lightDirection },
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: fragmentShader,
      blending: THREE.NormalBlending,
      depthWrite: false,
      transparent: true
    });

    // Generate initial geometry
    this.updateGeometry();

    console.log("Atmosphere created with params:", this.params);
  }

  /**
   * Regenerates the BufferGeometry for the particles.
   * Should be called if particle count or distribution parameters change.
   * @private
   */
  updateGeometry() {
    if (this.geometry) {
      this.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    const verts = [];
    const sizes = [];

    const numParticles = this.params.particles;
    const radius = this.params.radius;
    const thickness = this.params.thickness;
    const minSize = this.params.minParticleSize;
    const maxSize = this.params.maxParticleSize;

    // Sample points within the atmosphere shell
    for (let i = 0; i < numParticles; i++) {
      // Random distance within the shell
      let r = Math.random() * thickness + radius;

      // Pick a random point within a cube [-1, 1] and normalize
      // to get a uniform distribution on a sphere surface.
      const p = new THREE.Vector3(
        2 * Math.random() - 1,
        2 * Math.random() - 1,
        2 * Math.random() - 1
      );
      p.normalize();

      // Scale to the random distance r
      p.multiplyScalar(r);

      // Random size for the particle
      const size = Math.random() * (maxSize - minSize) + minSize;

      verts.push(p.x, p.y, p.z);
      sizes.push(size);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    // Assign the new geometry
    this.geometry = geometry;
    // console.log(`Atmosphere geometry updated with ${numParticles} particles.`);
  }

  /**
   * Updates the atmosphere's time uniform for animation.
   * @param {number} deltaTime - Time elapsed since the last frame.
   */
  update(deltaTime) {
    // Add slow independent rotation for the cloud layer
    const rotationSpeed = 0.04; // Doubled rotation speed (was 0.02)
    this.rotation.y += deltaTime * rotationSpeed;

    if (this.material && this.material.uniforms.time) {
      this.material.uniforms.time.value += deltaTime;
    }
  }

  /**
   * Disposes of the geometry and material used by the atmosphere.
   */
  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      // Dispose texture if it's unique to this instance (currently shared)
      // if (this.material.uniforms.pointTexture.value) {
      //   this.material.uniforms.pointTexture.value.dispose();
      // }
      this.material.dispose();
    }
     console.log("Atmosphere disposed.");
  }
}