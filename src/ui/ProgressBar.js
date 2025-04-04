import * as THREE from 'three';

/**
 * Creates and manages a visual progress bar in the 3D scene.
 */
export class ProgressBar {
  /**
   * @param {Object} options - Configuration options.
   * @param {THREE.Scene} options.scene - The scene to add the progress bar to.
   * @param {number} [options.width=2] - The width of the progress bar.
   * @param {number} [options.height=0.2] - The height of the progress bar.
   * @param {THREE.Color} [options.backgroundColor=0x555555] - Background color.
   * @param {THREE.Color} [options.foregroundColor=0x00ff00] - Foreground (progress) color.
   * @param {number} [options.offsetY=1.5] - Vertical offset above the target object.
   * @param {number} [options.offsetX=1.5] - Horizontal offset from the target object.
   * @param {string} [options.positionStyle='top'] - Where to position the bar ('top', 'side').
   */
  constructor(options = {}) {
    this.scene = options.scene;
    this.width = options.width || 2;
    this.height = options.height || 0.2;
    this.backgroundColor = options.backgroundColor || new THREE.Color(0x555555); // Dark grey
    this.foregroundColor = options.foregroundColor || new THREE.Color(0x00ff00); // Green
    this.offsetY = options.offsetY || 1.5; // Default offset above the object
    this.offsetX = options.offsetX || 1.5; // Default offset to the side of the object
    this.positionStyle = options.positionStyle || 'top'; // 'top' or 'side'

    this.progress = 0; // 0 to 100
    this.isVisible = false;
    this.targetObject = null; // The object this bar is attached to
    
    // Count text properties
    this.clickCount = 0;
    this.clickCountText = null;
    
    // Pulsing effect properties
    this.isPulsing = false;
    this.pulseTime = 0;
    this.pulseSpeed = 5; // Speed of pulsing
    this.baseOpacity = 0.9; // Base opacity for the foreground

    this._createMesh();
  }

  /**
   * Creates the Three.js mesh for the progress bar.
   * @private
   */
  _createMesh() {
    this.group = new THREE.Group();
    this.group.name = 'progressBarGroup';

    // Background
    const backgroundGeometry = new THREE.PlaneGeometry(this.width, this.height);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: this.backgroundColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    this.backgroundMesh.position.z = 0.01; // Slightly behind foreground
    this.group.add(this.backgroundMesh);

    // Foreground (progress indicator)
    const foregroundGeometry = new THREE.PlaneGeometry(this.width, this.height);
    const foregroundMaterial = new THREE.MeshBasicMaterial({
      color: this.foregroundColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    this.foregroundMesh = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
    this.foregroundMesh.position.x = -this.width / 2; // Start aligned left
    this.group.add(this.foregroundMesh);
    
    // Create text for the click count
    this._createClickCountText();

    this.group.visible = false; // Initially hidden
    this.scene.add(this.group);
  }
  
  /**
   * Creates the text sprite for displaying click count
   * @private
   */
  _createClickCountText() {
    // Create a canvas for the text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    // Set canvas background to transparent
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    ctx.font = 'Bold 60px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    // Create sprite
    this.clickCountText = new THREE.Sprite(spriteMaterial);
    this.clickCountText.scale.set(0.5, 0.25, 1); // Adjust scale as needed
    
    // Add to group
    this.group.add(this.clickCountText);
    
    // Store canvas and context for later updates
    this.canvas = canvas;
    this.context = ctx;
  }
  
  /**
   * Updates the click count text
   * @param {number} count - The number of clicks to display
   */
  setClickCount(count) {
    this.clickCount = count;
    
    // Update the text sprite
    if (this.clickCountText && this.canvas && this.context) {
      const ctx = this.context;
      
      // Clear canvas
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw text
      ctx.font = 'Bold 60px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count.toString(), this.canvas.width / 2, this.canvas.height / 2);
      
      // Update texture
      this.clickCountText.material.map.needsUpdate = true;
    }
  }

  /**
   * Attaches the progress bar to a target object.
   * @param {THREE.Object3D} targetObject - The object to follow.
   */
  attachToObject(targetObject) {
    this.targetObject = targetObject;
    this.updatePosition();
    this.show();
  }

  /**
   * Detaches the progress bar from the target object.
   */
  detachFromObject() {
    this.targetObject = null;
    this.hide();
  }

  /**
   * Updates the progress bar's position based on the target object.
   */
  updatePosition() {
    if (!this.targetObject || !this.isVisible) return;

    // Calculate bounding box of the target object
    const targetBox = new THREE.Box3().setFromObject(this.targetObject);
    const targetSize = new THREE.Vector3();
    targetBox.getSize(targetSize);
    const targetCenter = new THREE.Vector3();
    targetBox.getCenter(targetCenter);

    // Position based on the selected style
    let progressBarPosition;
    
    if (this.positionStyle === 'side') {
      // Position on the right side of the object
      progressBarPosition = new THREE.Vector3(
        targetBox.max.x + this.offsetX, // Right side of the object plus offset
        targetCenter.y,                 // Centered vertically
        targetCenter.z                  // Centered in Z
      );
      
      // For side position, rotate the bar to be vertical
      this.group.rotation.z = Math.PI / 2; // Rotate 90 degrees
      
      // Position the click count text
      if (this.clickCountText) {
        this.clickCountText.position.set(0, -0.5, 0.1); // Adjust based on your UI design
      }
    } else {
      // Default 'top' position
      progressBarPosition = new THREE.Vector3(
        targetCenter.x,
        targetBox.max.y + this.offsetY, // Above the object
        targetCenter.z
      );
      
      // Reset rotation for top position
      this.group.rotation.z = 0;
      
      // Position the click count text
      if (this.clickCountText) {
        this.clickCountText.position.set(0, 0.2, 0.1); // Adjust based on your UI design
      }
    }

    this.group.position.copy(progressBarPosition);

    // Make the progress bar always face the camera
    if (window.camera) {
        this.group.lookAt(window.camera.position);
    }
  }

  /**
   * Updates the visual progress.
   * @param {number} progressPercent - The progress value (0-100).
   */
  setProgress(progressPercent) {
    this.progress = Math.max(0, Math.min(100, progressPercent)); // Clamp between 0 and 100
    const progressRatio = this.progress / 100;

    // Scale the foreground mesh width
    this.foregroundMesh.scale.x = progressRatio;
    // Adjust position so it fills from the left
    this.foregroundMesh.position.x = -this.width / 2 + (this.width * progressRatio) / 2;

    // Optionally change color based on progress
    // Example: Red -> Yellow -> Green
    const color = new THREE.Color();
    if (progressRatio < 0.5) {
        color.lerpColors(new THREE.Color(0xff0000), new THREE.Color(0xffff00), progressRatio * 2);
    } else {
        color.lerpColors(new THREE.Color(0xffff00), new THREE.Color(0x00ff00), (progressRatio - 0.5) * 2);
    }
    this.foregroundMesh.material.color.copy(color);
  }

  /**
   * Makes the progress bar visible.
   */
  show() {
    this.isVisible = true;
    this.group.visible = true;
    this.updatePosition(); // Update position when shown
  }

  /**
   * Hides the progress bar.
   */
  hide() {
    this.isVisible = false;
    this.group.visible = false;
  }

  /**
   * Updates the progress bar (e.g., position if target moves).
   * Should be called in the main game loop.
   */
  update(deltaTime = 1/60) {
    if (this.isVisible && this.targetObject) {
      this.updatePosition();
      
      // Update pulsing effect if enabled
      if (this.isPulsing) {
        this.updatePulse(deltaTime);
      }
    }
  }

  /**
   * Enable or disable pulsing effect for urgency
   * @param {boolean} enabled - Whether pulsing should be enabled
   */
  setPulsing(enabled) {
    if (this.isPulsing !== enabled) {
      this.isPulsing = enabled;
      
      // Reset pulse effect when turning on
      if (enabled) {
        this.pulseTime = 0;
      } else {
        // Reset to base opacity when turning off
        if (this.foregroundMesh && this.foregroundMesh.material) {
          this.foregroundMesh.material.opacity = this.baseOpacity;
        }
      }
    }
  }
  
  /**
   * Update the pulse animation
   * @param {number} deltaTime - Time since last update
   * @private
   */
  updatePulse(deltaTime) {
    // Increment pulse time
    this.pulseTime += deltaTime * this.pulseSpeed;
    
    // Calculate pulse factor (0-1) using sine wave for smooth oscillation
    const pulseFactor = (Math.sin(this.pulseTime) + 1) / 2; // Range 0-1
    
    // Apply pulsing effect to opacity (between 0.5 and 1.0)
    if (this.foregroundMesh && this.foregroundMesh.material) {
      this.foregroundMesh.material.opacity = 0.5 + (pulseFactor * 0.5);
    }
    
    // Apply pulsing effect to color (pulse between current color and brighter version)
    if (this.foregroundMesh && this.foregroundMesh.material) {
      // Store original color if first time
      if (!this._originalColor) {
        this._originalColor = this.foregroundMesh.material.color.clone();
      }
      
      // Create a brighter version of the color
      const brightColor = this._originalColor.clone().multiplyScalar(1.5);
      
      // Interpolate between original and bright color
      this.foregroundMesh.material.color.lerpColors(
        this._originalColor,
        brightColor,
        pulseFactor
      );
    }
  }

  /**
   * Removes the progress bar from the scene and cleans up resources.
   */
  dispose() {
    if (this.backgroundMesh) {
      this.backgroundMesh.geometry.dispose();
      this.backgroundMesh.material.dispose();
    }
    
    if (this.foregroundMesh) {
      this.foregroundMesh.geometry.dispose();
      this.foregroundMesh.material.dispose();
    }
    
    if (this.clickCountText) {
      if (this.clickCountText.material.map) {
        this.clickCountText.material.map.dispose();
      }
      this.clickCountText.material.dispose();
    }
    
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
    
    this.isVisible = false;
    this.targetObject = null;
    console.log('ProgressBar disposed');
  }
} 