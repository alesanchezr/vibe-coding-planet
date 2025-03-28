# Implementation Plan: Planet Clicker Wars with Vite

## Overview
"Planet Clicker Wars" is a multiplayer game where players join one of two planets, build a rocket by clicking near a site, and win by launching it to destroy the opposing planet. This plan uses Vite for fast development, Three.js for rendering, Cannon.js for physics, Simplex noise for terrain, and WebSocket for basic syncing. The steps are atomic, building incrementally toward a functional base game.

---

## Prerequisites
- **Node.js and npm installed**: Version 22+ recommended.
- **Empty project directory**: Create a folder (e.g., `planet-clicker-wars`) and open a terminal in it.
- **Vite project scaffolded**: Run `npm create vite@latest . -- --template vanilla` and follow prompts.
- **Dependencies installed**: Run `npm install three cannon-es simplex-noise ws`.
- **Server file prepared**: Create an empty `server.js` in the project root.

---

## Step-by-Step Instructions

### Project Setup
1. **Verify Vite Project Structure**
   - Ensure `index.html`, `main.js`, and `package.json` exist in the project root.
   - **Test**: Run `npm run dev`, open `http://localhost:5173`, and confirm the page loads with a "Vite App" title or similar.

2. **Add Canvas Element**
   - Open `index.html` and insert `<canvas id="gameCanvas"></canvas>` inside `<div id="app">`.
   - **Test**: Reload the page in the browser and confirm a blank canvas is visible.

3. **Test Main Script Execution**
   - Open `main.js` and add a console log statement: "Game script initialized".
   - **Test**: Reload the page and check the browser console for "Game script initialized".

### Scene Initialization
4. **Import Three.js**
   - Open `main.js` and add the Three.js import statement at the top.
   - **Test**: Add a console log of the Three.js library object and confirm it appears in the console as an object with properties like `Scene`.

5. **Create Scene Object**
   - In `main.js`, define a variable for a new Three.js scene.
   - **Test**: Log the scene variable and confirm it's an object with a `children` property (initially an empty array).

6. **Add Perspective Camera**
   - Define a perspective camera with FOV 75, aspect ratio based on window dimensions, near plane 0.1, far plane 1000.
   - Set its position to (0, 0, 50).
   - Add the camera to the scene.
   - **Test**: Log the camera's z-position and confirm it's 50.

7. **Initialize Renderer**
   - Create a WebGL renderer, targeting the canvas with ID "gameCanvas".
   - Set its size to the window's inner width and height.
   - **Test**: Render the scene with the camera once and confirm the canvas turns black.

8. **Add Test Object**
   - Create a 1x1x1 cube with a green basic material.
   - Add the cube to the scene.
   - Render the scene with the camera.
   - **Test**: Confirm a green cube appears centered on the canvas.

### Physics Setup
9. **Import Cannon.js**
   - Add the Cannon.js import statement at the top of `main.js`.
   - **Test**: Log the Cannon.js library object and confirm it's an object with properties like `World`.

10. **Create Physics World**
    - Define a new Cannon.js world variable.
    - Set its gravity to (0, -9.82, 0).
    - **Test**: Log the world's gravity y-component and confirm it's -9.82.

11. **Define Fixed Time Step**
    - Set a constant for the physics time step equal to 1/60.
    - **Test**: Log the time step value and confirm it's approximately 0.0167.

12. **Implement Game Loop**
    - Define an `animate` function that requests the next animation frame recursively.
    - Inside `animate`, step the physics world with the fixed time step.
    - Render the scene with the camera.
    - Start the loop by calling `animate` once.
    - **Test**: Run the game and confirm the green cube remains visible with no console errors.

### Planet Generation
13. **Import Simplex Noise**
    - Add the Simplex noise import statement at the top of `main.js`, importing the 3D noise function.
    - Create a 3D noise instance.
    - **Test**: Log the noise value at (0, 0, 0) and confirm it's a number between -1 and 1.

14. **Generate Base Planet Geometry**
    - Define a sphere geometry with radius 10 and 20 segments for both width and height.
    - **Test**: Log the number of vertices in the geometry's position attribute and confirm it's 441 (21 * 21).

15. **Apply Noise to Terrain**
    - Access the sphere geometry's position array.
    - For each vertex (every 3 elements):
      - Get the x, y, z coordinates.
      - Compute the distance from the origin.
      - Normalize the coordinates to a unit sphere.
      - Calculate noise using the normalized coordinates scaled by 5, multiplied by 2 for amplitude.
      - Adjust the vertex distance by adding the noise value.
      - Update the position array with the new coordinates.
    - Flag the position attribute for update.
    - Recalculate vertex normals.
    - **Test**: Temporarily create a mesh with this geometry and a gray Phong material, add it to the scene, render, and confirm an irregular gray sphere appears.

16. **Create First Planet Mesh**
    - Define a gray Phong material (color 0x888888).
    - Create a mesh with the noisy geometry and this material, named `earthMesh`.
    - Add it to the scene.
    - **Test**: Render and confirm a gray irregular sphere is visible.

17. **Add Ambient Lighting**
    - Create an ambient light with color 0x404040.
    - Add it to the scene.
    - **Test**: Render and confirm the planet is dimly lit evenly.

18. **Add Point Lighting**
    - Create a white point light with intensity 1 and distance 100.
    - Position it at (50, 50, 50).
    - Add it to the scene.
    - **Test**: Render and confirm the planet shows highlights and shadows.

19. **Create Second Planet Mesh**
    - Repeat steps 14-16 for a second planet, using a darker gray material (color 0x444444), named `marsMesh`.
    - **Test**: Render and confirm two distinct irregular planets are visible.

20. **Position Planets**
    - Set `earthMesh` position to (-20, 0, 0).
    - Set `marsMesh` position to (20, 0, 0).
    - **Test**: Render and confirm the planets are side by side along the x-axis.

21. **Add Water Spheres**
    - For each planet:
      - Create a sphere geometry with radius 10.5 and 20 segments.
      - Create a material with blue color (0x0000ff), transparency enabled, opacity 0.7, and double-sided rendering.
      - Create a mesh and position it at the planet's coordinates.
      - Add it to the scene.
    - **Test**: Render and confirm each planet is surrounded by a semi-transparent blue sphere.

22. **Add Physics to Planets**
    - For each planet:
      - Create a Cannon.js sphere shape with radius 10.
      - Create a body with mass 0 (static), attach the shape, and set its position to match the mesh.
      - Add the body to the physics world.
    - **Test**: Log the number of bodies in the world and confirm it's 2.

### Player Management
23. **Add Join Button**
    - In `index.html`, add a `<button id="joinButton">Join</button>` inside `<div id="app">`.
    - Use CSS to center it over the canvas (e.g., absolute positioning).
    - In `main.js`, add a click listener to hide the button.
    - **Test**: Load the page, confirm the button is centered, and hides when clicked.

24. **Assign Players to Planets**
    - Define a global `playerCount` variable initialized to 0.
    - In the join button listener, increment `playerCount`.
    - Assign to Earth if `playerCount` is even, Mars if odd.
    - **Test**: Click the button multiple times, log the assignment, and confirm it alternates between planets.

25. **Set Up Player Instancing**
    - For each planet:
      - Create an InstancedMesh with a sphere geometry (radius 0.5), a basic material (e.g., red for Earth, blue for Mars), and a count of 100.
      - Add it to the scene.
    - **Test**: Render and confirm no errors occur (no instances are visible yet).

26. **Spawn Player on Join**
    - In the join listener:
      - Determine the assigned planet (Earth or Mars).
      - Create a Cannon.js body with mass 1 and a sphere shape (radius 0.5), positioned at (x, 50, 0) where x is -20 or 20.
      - Add the body to the physics world.
      - Assign an instance in the planet's InstancedMesh, setting its initial position to match the body.
    - **Test**: Click join, confirm a colored sphere appears above the assigned planet and falls.

27. **Sync Player Positions**
    - In the `animate` function:
      - For each player body, update its corresponding InstancedMesh instance position to match the body's position.
      - Flag the instance matrix for update.
    - **Test**: Click join, confirm the player sphere falls smoothly toward the planet.

28. **Follow Player with Camera**
    - In the join listener, set an `isEntering` flag to true.
    - In `animate`, if `isEntering`:
      - Set the camera position to the player's position plus (0, 5, 10).
      - Check if the player's y-position is below 15; if so, set `isEntering` to false.
    - **Test**: Click join, confirm the camera follows the player during descent and stops near the surface.

### Player Controls
29. **Rotate Planet**
    - Add a mouse down listener (left button) to record the initial mouse x-position.
    - Add a mouse move listener (while down) to:
      - Calculate the x-delta from the initial position.
      - Rotate the assigned planet's mesh around the y-axis by delta * 0.01.
      - Update the planet's physics body quaternion to match.
    - Add a mouse up listener to reset tracking.
    - **Test**: Drag the mouse left, confirm the planet rotates smoothly.

30. **Move Player on Surface**
    - Add a right-click listener to:
      - Raycast from the camera through the mouse position to intersect the planet mesh.
      - Set the player body's position to the intersection point.
      - Update the InstancedMesh instance position to match.
    - **Test**: Right-click on the planet, confirm the player moves to the clicked spot.

### Rocket Construction
31. **Add Rocket Sites**
    - For each planet:
      - Create a cylinder geometry (radius 0.5, height 1) with a basic material (e.g., white).
      - Position it at (0, 10, 0) relative to the planet's center.
      - Add it to the scene.
    - **Test**: Rotate the planet, confirm a cylinder remains fixed on the surface.

32. **Count Clicks Near Rocket**
    - Add a left-click listener to:
      - Calculate the distance between the player's position and the rocket's position.
      - If within 2 units, increment a click counter for that planet.
    - **Test**: Move the player near the rocket, click, log the counter, and confirm it increases.

33. **Visualize Rocket Progress**
    - Every second (use a timer or frame counter):
      - Set each rocket's y-scale to its planet's click count divided by 14,400, capped at 10.
    - **Test**: Click near the rocket repeatedly, confirm the cylinder grows taller up to 10x its original height.

### Multiplayer Syncing
34. **Initialize WebSocket Server**
    - In `server.js`, set up a WebSocket server on port 8080.
    - Add basic connection and message logging.
    - **Test**: Run `node server.js`, confirm the terminal shows "Server running" or similar with no errors.

35. **Connect Client to Server**
    - In `main.js`, establish a WebSocket connection to `ws://localhost:8080`.
    - On join, send a message with the planet assignment (e.g., "join:earth").
    - On rocket click, send a "click" message with the planet ID.
    - Simulate receiving click messages by incrementing the other planet's counter.
    - **Test**: Click join and click the rocket, confirm the server terminal logs both messages.

### Victory Condition
36. **Detect Victory**
    - In `animate`, check if either planet's click count reaches 144,000.
    - If so:
      - Move the winning planet's rocket upward for 30 seconds (e.g., y += 0.1 per frame).
      - Then move it toward the other planet's position over 30 seconds.
      - Hide the losing planet's mesh and water sphere.
      - Display a "Victory!" text overlay (e.g., add a `<div>` via DOM).
    - **Test**: Manually set a planet's click count to 144,000, confirm the rocket launches, reaches the other planet, and victory text appears.

---

## Completion
This 36-step plan builds the base "Planet Clicker Wars" game incrementally, with each step validated by a clear test. You'll end with two irregular planets, players dropping in with atmospheric effects, clickable rocket construction, basic multiplayer sync, and a win condition—all using Vite's fast development environment. Focus on these steps to get a solid, playable core before considering enhancements!