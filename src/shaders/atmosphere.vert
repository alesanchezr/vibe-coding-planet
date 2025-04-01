        // Attributes passed from BufferGeometry
        attribute float size; // Per-particle size

        // Varyings sent to Fragment Shader
        varying vec3 vWorldPosition; // Pass world position to frag shader

        void main() {
          // Calculate world position
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;

          // Calculate screen position
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Set particle size in screen space
          // Adjust size based on distance to make particles appear consistent size
          // or smaller further away. 100.0 is an arbitrary scaling factor.
          gl_PointSize = size * (100.0 / -mvPosition.z);
        }