import * as THREE from 'three';

/**
 * Creates a "+1" floating sprite effect that animates upward and fades out.
 */
export class ClickEffect {
    /**
     * @param {Object} options
     * @param {THREE.Scene} options.scene - The scene to add the effect to.
     * @param {THREE.Vector3} options.position - The starting world position for the effect.
     * @param {THREE.Camera} options.camera - The main camera (not needed for sprites as they auto-billboard).
     * @param {string} [options.text="+1"] - The text to display (not used for sprites, kept for API compatibility).
     * @param {number} [options.duration=1] - Duration of the animation in seconds.
     * @param {number} [options.floatHeight=2] - How high the sprite floats.
     * @param {number} [options.size=0.3] - Size of the sprite.
     * @param {THREE.Color} [options.color=0x00ff00] - Tint color for the sprite.
     * @param {string} [options.imagePath='/plus-one.png'] - Path to the image to use for the sprite.
     */
    constructor(options) {
        this.scene = options.scene;
        this.startPosition = options.position.clone();
        this.camera = options.camera; // Still stored but not needed for billboarding
        this.text = options.text || '+1'; // Kept for API compatibility
        this.duration = options.duration || 1.0; // seconds
        this.floatHeight = options.floatHeight || 2.0;
        this.size = options.size || 9.0; // Increased default size for sprite (3x larger)
        this.color = options.color || new THREE.Color(0x00ff00);
        this.imagePath = options.imagePath || '/plus-one.png'; // Default image path

        this.sprite = null;
        this.startTime = performance.now();
        this.isComplete = false;

        this._init();
    }

    _init() {
        // Load the sprite texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            this.imagePath,
            (texture) => {
                // Create sprite material with the loaded texture
                const spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    color: this.color,
                    transparent: true,
                    opacity: 1.0,
                    depthTest: false, // Disable depth testing so it renders on top
                    depthWrite: false // Don't write to depth buffer
                });

                // Create sprite using the material
                this.sprite = new THREE.Sprite(spriteMaterial);
                
                // Set sprite scale (controls its size in the scene)
                this.sprite.scale.set(this.size, this.size, 1);
                
                // Set initial position
                this.sprite.position.copy(this.startPosition);
                
                // Ensure it renders on top of everything
                this.sprite.renderOrder = 9999; // Very high render order
                
                // Add to scene
                this.scene.add(this.sprite);
                
                console.log(`ClickEffect sprite created with image ${this.imagePath} and added to scene`);
            },
            undefined, // onProgress callback not needed
            (error) => {
                console.error(`Error loading sprite image ${this.imagePath}:`, error);
                this.isComplete = true; // Mark as complete if loading fails
            }
        );
    }

    /**
     * Updates the effect's animation.
     * @param {number} deltaTime - Time since the last frame.
     */
    update(deltaTime) {
        if (!this.sprite || this.isComplete) return;

        const elapsedTime = (performance.now() - this.startTime) / 1000; // in seconds
        const progress = Math.min(elapsedTime / this.duration, 1.0);

        if (progress >= 1.0) {
            this.dispose();
            return;
        }

        // Float upwards (eased out - starts fast, slows down)
        const easeOutQuad = t => t * (2 - t);
        const currentYOffset = this.floatHeight * easeOutQuad(progress);
        this.sprite.position.y = this.startPosition.y + currentYOffset;

        // Fade out (linear)
        this.sprite.material.opacity = 1.0 - progress;
    }

    /**
     * Cleans up resources when the effect is finished.
     */
    dispose() {
        if (this.isComplete) return;
        
        if (this.sprite) {
            this.scene.remove(this.sprite);
            this.sprite.material.map?.dispose(); // Dispose texture if owned by this material
            this.sprite.material.dispose();
        }
        this.sprite = null;
        this.isComplete = true;
    }
} 