        // Uniforms passed from ShaderMaterial
        uniform float time;
        uniform float speed;
        uniform float opacity;
        uniform float density;
        uniform float scale;
        uniform vec3 color;
        uniform vec3 lightDirection; // Should be normalized world direction
        uniform sampler2D pointTexture;

        // Varyings received from Vertex Shader
        varying vec3 vWorldPosition;

        // Include noise functions (provided separately)
        // [noise-functions.glsl content will be prepended here by the JS]


        vec2 rotateUV(vec2 uv, float rotation) {
            float mid = 0.5;
            return vec2(
                cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
                cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
            );
        }

        // --- Noise Function Declaration ---
        // We need to declare simplex3 here because it's used directly in this shader
        // The actual definition comes from the included noise-functions.glsl
        float simplex3(vec3 v);
        // --- End Noise Declaration ---


        void main() {
          // --- Lighting ---
          // Calculate direction from fragment towards origin (approx surface normal for sphere)
          vec3 R = normalize(vWorldPosition); // Use world position relative to model origin
          // Light direction should already be normalized world direction
          vec3 L = normalize(lightDirection); // Ensure it's normalized
          // Basic diffuse lighting model based on angle between surface normal and light direction
          float light = max(0.3, dot(R, L)); // Increased minimum light level (was 0.1)

          // --- Noise Calculation ---
          // Use world position and time for noise calculation
          // Adding time * speed makes the noise evolve
          // Dividing position by scale controls the noise frequency/size
          float n = simplex3((vWorldPosition / scale) + (time * speed)); // Noise value [-1, 1]

          // --- Alpha Calculation ---
          // Map noise [-1, 1] to alpha [0, 1] using density and opacity
          // density acts like a threshold or bias for the noise
          float noiseMapped = (n + 1.0) * 0.5; // Map noise to [0, 1]
          float alphaBase = clamp(noiseMapped - (1.0 - density), 0.0, 1.0); // Apply density threshold
          float alpha = opacity * alphaBase; // Apply overall opacity

          // --- Texture Sampling ---
          // Get the texture color/alpha from the cloud texture based on particle coordinates
          // Optional: Rotate texture coordinates based on noise for more variation
          // vec2 rotCoords = rotateUV(gl_PointCoord, n * 3.14159);
          // vec4 texColor = texture2D(pointTexture, rotCoords);
          vec4 texColor = texture2D(pointTexture, gl_PointCoord); // Standard texture lookup

          // --- Final Color ---
          // Modulate texture alpha with calculated noise alpha
          // Apply lighting intensity to the base color
          // Multiply by the texture color (which includes its own alpha)
          gl_FragColor = vec4(light * color, texColor.a * alpha) * texColor;

          // Premultiplied alpha blending might be needed depending on Three.js setup
          // gl_FragColor.rgb *= gl_FragColor.a;
        }