# 🛠️ Technology Stack

## Core Technologies

### 🔷 Vite
- **Purpose**: Fast development environment and build tool
- **Features**: Hot Module Replacement, optimized production builds
- **Setup**: `npm create vite@latest . -- --template vanilla`

### 🔷 Three.js
- **Purpose**: 3D rendering engine
- **Key Components**:
  - Scene graph for organizing game objects
  - WebGLRenderer for hardware-accelerated rendering
  - BufferGeometry for efficient mesh representation
  - LOD (Level of Detail) for performance optimization
  - InstancedMesh for efficient player rendering
- **Installation**: `npm install three`

### 🔷 Cannon.js
- **Purpose**: Physics simulation
- **Key Components**:
  - Physics World with gravity (-9.82 m/s² on Y-axis)
  - Static bodies for planets
  - Dynamic bodies for players
  - SAPBroadphase for efficient collision detection
  - Fixed timestep (1/60s) for stable simulation
- **Installation**: `npm install cannon-es`

### 🔷 Simplex Noise
- **Purpose**: Procedural terrain generation
- **Usage**: Apply to planet geometry vertices
- **Installation**: `npm install simplex-noise`

### 🔷 WebSocket
- **Purpose**: Real-time multiplayer communication
- **Features**:
  - Player assignment to planets
  - Click synchronization across clients
  - Minimal data transfer (100ms batched updates)
- **Server-side**: Node.js with `ws` package
- **Installation**: `npm install ws`

## Development Environment

### Prerequisites
- **Node.js**: v22+ recommended
- **npm**: Latest version
- **Browser**: Modern browser with WebGL support

### Project Setup Commands
```bash
# Create project with Vite
npm create vite@latest . -- --template vanilla

# Install dependencies
npm install three cannon-es simplex-noise ws

# Start development server
npm run dev

# Build for production
npm run build
```

## Performance Considerations

- Use BufferGeometry for all 3D objects
- Implement InstancedMesh for player avatars (up to 100 per planet)
- Minimize draw calls with efficient material setup
- Implement frustum culling for off-screen objects
- Use Level of Detail (LOD) for planets based on distance
- Target 60 FPS with 20+ simultaneous players

## Implementation Notes

- All rendering is done on client-side using WebGL
- Physics is calculated client-side with server verification
- Server primarily handles player assignment and click synchronization
- Game state is minimally tracked (planet click counts and player positions)
- Optimized for modern browsers with WebGL 2.0 support