# Planet Clicker Wars - Social Media Posts

This file contains drafts of social media posts about the Planet Clicker Wars development progress.

## Post #1 - May 25, 2023

🛠️ Got Vite and Three.js working today! Pretty happy with the ES6+ setup, though took longer than expected. Game loop hitting 60 FPS but might need tweaking later. Tackling physics next if I can figure out Cannon.js docs.

#GameDev #PlanetClickerWars #ThreeJS #IndieGame

## Post #2 - May 25, 2023

🪐 Finally got physics working! Set gravity to -9.82 m/s² after some weird behavior at -10. Had to use that fixed timestep trick (1/60) to stop objects from jittering. Need to figure out terrain generation next.

#GameDev #PlanetClickerWars #PhysicsEngine #WebGL

## Post #3 - May 25, 2023

🧮 Spent way too long debugging simplex noise today. Got it working eventually - had to create a proper class structure after my first attempt was a mess. Noise values look good, but let's see if they actually make decent terrain.

#GameDev #PlanetClickerWars #ProceduralGeneration #IndieGame

## Post #4 - May 25, 2023

🌍 Finally got planets looking decent! Made a sphere with 441 vertices and warped it with noise. First attempt was way too subtle - had to crank up the amplitude. Made a split-screen comparison tool so I can actually see what's happening. Materials coming next if I don't get distracted.

#GameDev #PlanetClickerWars #ProceduralTerrain #IndieGame

## Post #5 - May 25, 2023 <noisy-terrain>

🏔️ Had to tell the AI to make the terrain actually visible because everything was looking flat! Cranked up the amplitude and added interactive wireframe toggle to see the details. Can now actually see mountains and valleys. Needed proper directional lighting from different angles to show off the bumps. Planning to add water spheres next!

#GameDev #PlanetClickerWars #ProceduralTerrain #VibeCoding

## Post #6 - May 25, 2023 <proper-planet>

🌋 Finally ditched the test sphere and made a real planet class! Told the AI to create a proper gray Phong material so it actually reflects light. Needed a PlanetSystem to manage everything because keeping track of individual planets was getting messy. Positioning the camera was a pain - took 5 tries to get it right. Next up: lighting to make it pop!

#GameDev #PlanetClickerWars #ThreeJS #VibeCoding

## Post #7 - May 25, 2023 <ambient-light>

💡 Ambient lighting is in! Had to make the AI fix the lighting because the colors were too bright at 0x606060. Switched to a darker 0x404040 for that proper space ambience. Created a whole lighting system class to manage everything better - might have been overkill but at least it's future-proof. Now I can see the planet's terrain details without blinding myself. Next: adding some point lights for drama!

#GameDev #PlanetClickerWars #ThreeJS #VibeCoding

## Post #8 - May 25, 2023 <point-light>

✨ Added a point light to make the planet pop! Took me forever to decide where to position it - ended up at (50, 50, 50) so it highlights the terrain nicely. Had to clean up some duplicate lighting code that was making everything too bright. Found this weird validation pattern where the AI writes code to validate its own work - kinda smart actually. Getting closer to that dramatic space look I want!

#GameDev #PlanetClickerWars #ThreeJS #VibeCoding

## Post #9 - May 25, 2023 <smooth-terrain>

🔍 Planet terrain was looking too jagged and weird. Tried increasing the triangle count first, but performance was taking a hit. Found two better tricks: 1) Turned off flatShading for a smoother look and 2) Tweaked the noise params - lower amplitude (1.2) and higher frequency (8). Now I've got more detailed but less extreme terrain that actually looks like a planet and not a spiky death ball.

#GameDev #PlanetClickerWars #ProceduralGeneration #VibeCoding

## Post #10 - May 25, 2023 <render-physics-separation>

🧠 Did some serious digging into the rendering vs physics separation today. Worried that making the planet look smoother would mess with collisions, but turns out they're completely separate systems! The Cannon.js physics uses a perfect mathematical sphere while Three.js just handles the visuals. Super relieved because it means I can make things look pretty without breaking gameplay. Architecture win!

#GameDev #PlanetClickerWars #GameArchitecture #VibeCoding

## Post #11 - May 25, 2023 <water-spheres>

🌊 Just added water to the planets! Created transparent blue spheres that sit just above the terrain. Had to set opacity to 0.7 and enable double-sided rendering so the water looks realistic from any angle. Positioning them was trivial since they just follow the planets. The blue against the gray terrain creates this awesome Earth-like vibe, even with the simplistic approach. Next up: making these planets actually exist in the physics world!

#GameDev #PlanetClickerWars #ProceduralGeneration #VibeCoding

## Post #12 - May 25, 2023 <water-level-adjustment>

💧 Decreased the water levels on the planets today! The oceans were covering too much of the terrain features. Dropped the water sphere radius from 10.5 to 10.2, which exposes more of the mountains while still keeping the lowlands submerged. Much better balance now - you can actually see the coastlines and terrain features. Small change but makes a big visual difference. Next: implementing the physics for these planets!

#GameDev #PlanetClickerWars #GameDesign #VibeCoding

## Post #13 - May 25, 2023 <earth-like-terrain>

🌎 Made the planets actually look like Earth today! Took two approaches: 1) Made the oceans more realistic with a cyan-blue tint and higher transparency (0.4 opacity), and 2) Completely revamped the terrain with multiple brown tones based on elevation. Added sandy beaches, green-brown lowlands, darker highlands, and even snowy mountain peaks! Used vertex coloring instead of textures to keep it performant. The difference is HUGE - actually looks like real planets now instead of gray blobs.

#GameDev #PlanetClickerWars #ProceduralGeneration #VibeCoding

## Post #14 - May 25, 2023 <region-based-terrain>

🏔️ Major terrain upgrade! Implemented a region-based approach that creates distinct plains and mountain ranges instead of random noise everywhere. Used a two-layer noise system: first a low-frequency "region map" that divides the planet into different terrain types, then applied targeted noise with different amplitudes based on region type. Plains are nearly flat, mountains are dramatic, and transitions are smooth! Added appropriate coloring too - green plains, brown mountains, and snow-capped peaks. The planets finally look realistic and not just like noisy spheres! All this while keeping performance in mind with region caching. #LevelUp

#GameDev #PlanetClickerWars #ProceduralGeneration #VibeCoding

## Post #15 - May 25, 2023 <smoother-terrain>

🔎 The planets still looked a bit blocky in some areas, especially in the mountain regions. Told the AI to crank up the segment count by another 30% (from 26 to 34 segments). This adds ~680 more triangles to each planet but the extra smoothness is totally worth it! Also matched the water sphere resolution to the terrain for consistency. The terrain details are much clearer now, especially those coastlines where the water meets the land. Performance still solid at 60fps!

#GameDev #PlanetClickerWars #OptimizationDay #VibeCoding

## Post #16 - May 25, 2023 <mountain-water-fix>

⛰️ Fixed a major terrain issue today! Annoying bug where some mountain regions were dipping below water level. Had to rewrite the terrain generation algorithm to guarantee mountains stay above water. Used a minimum elevation offset that kicks in when the noise would otherwise create valleys in mountain regions. Also added a gradual transition so there's no abrupt "cliff" between terrain types. Mountains now look like proper continents rising from the oceans. Much more realistic looking planets now!

#GameDev #PlanetClickerWars #BugSquashing #VibeCoding

## Post #17 - May 25, 2023 <planet-physics>

🪨 Just realized the planets' physics was already implemented! The Planet class had proper Cannon.js physics bodies all along - static spheres with zero mass that match the visual meshes. Did a quick check with console.log and yep, both planets exist in the physics world! Perfect for what's coming next: player physics that will interact with these planet bodies. One cool thing about the architecture - we're using proper OOP with each GameObject handling both its visual and physics components. #GameDevArchitecture

#GameDev #PlanetClickerWars #CannonJS #VibeCoding

## Post #18 - May 25, 2023 <player-assignment>

🎮 Finally added player assignment logic! Made the join button actually do something - it assigns players to different planets based on a simple even/odd counter. First player gets Planet A, second gets Planet B, and so on. Had to store the assignments in an array for later when we spawn the actual player entities. Still only visual - nothing to see yet beyond a console log - but the foundation is there! Next up: creating player instances that you can actually see.

#GameDev #PlanetClickerWars #GameplayMechanics #VibeCoding

## Post #19 - May 25, 2023 <button-fix>

🔧 Fixed a silly bug in the join button! It was disappearing after the first click, which meant I couldn't test the alternating planet assignment. Changed it to update its text and color instead (green for Planet A, blue for Planet B). Now players can click multiple times to see how the assignment logic works. Small change, but makes testing way easier. Still need to get the actual player visuals in there!

#GameDev #PlanetClickerWars #UIFixes #VibeCoding

## Post #20 - May 25, 2023 <player-instancing>

👥 Set up instanced rendering for players today! Created two separate InstancedMesh collections - red spheres for Planet A and blue spheres for Planet B. Using instancing instead of individual meshes means we can have tons of players (up to 100 per planet) without performance problems. Nothing visible yet since we don't spawn instances until players join. Next: making join button actually spawn player entities that can interact with the planet physics!

#GameDev #PlanetClickerWars #ThreeJS #VibeCoding

## Post #21 - May 25, 2023 <player-spawning>

👾 Finally got player entities spawning! When you click join, a physics-enabled player sphere appears 50 units above your assigned planet and starts falling. Red spheres for Planet A, blue for Planet B. Had to create proper Cannon.js physics bodies with mass=1 so they're affected by gravity. There's a slight issue though - the spheres spawn and fall, but they don't update position after that. Need to implement position syncing next so they don't just fall through the planet!

#GameDev #PlanetClickerWars #PhysicsEngine #VibeCoding

## Post #22 - May 25, 2023 <player-position-sync>

🔄 Fixed the player spawning! Players were being created but not showing up because we forgot to sync their positions each frame. Now their visual positions actually match their physics positions. Had to add a syncPlayerPositions() method to the game loop that updates all those instanced meshes based on physics body movement. Now you can see the player spheres fall toward the planets and bounce off them properly! Next step: making the camera follow players as they enter the game.

#GameDev #PlanetClickerWars #ThreeJS #VibeCoding

## Post #23 - May 26, 2023 <multiplayer-planning>

🌐 Starting to plan our multiplayer system! Created a backend implementation doc using Supabase for real-time multiplayer. Going with Supabase's Realtime Presence feature which is perfect for tracking connected players. Added anonymous auth so players can jump in without signing up. The plan includes session persistence (so you stay on your planet after refresh) and position interpolation for smooth player movement. Two-tier approach: fast 10Hz position updates via broadcast + slower presence updates for player state. Can't wait to see multiple players building rockets together!

#GameDev #PlanetClickerWars #Multiplayer #Supabase

## Post #24 - May 26, 2023 <refined-backend-plan>

🔄 Spent today refining our multiplayer backend implementation plan! Now using a smart two-tier approach with Supabase: Realtime Presence for active players (Tier 1) and database storage only for persistent data like planet assignment (Tier 2). Position data stays in memory only - much more efficient! Using different update frequencies too: fast 10Hz broadcasts for positions but slower 0.2Hz for presence updates. This will give us smooth multiplayer with minimal overhead. Added detailed testing instructions for each step so implementation will be straightforward. Next: starting on the actual implementation!

#GameDev #PlanetClickerWars #Multiplayer #Supabase

## Post #26 - May 26, 2023 <physics-progress>

🎮 Look what we've built! Players now spawn with proper physics bodies that fall onto their assigned planets! The gravity system is working great - players fall naturally and bounce off the planet surface. Even better, we've got position syncing working so players can see each other move in real-time. The physics system is super stable with proper collision handling and velocity limits to keep everything under control.

Biggest wins:
- Working physics with proper gravity 🌍
- Real-time player position syncing 🔄
- Smooth player spawning and falling 🎯
- Multiplayer foundation with Supabase 🌐

Next up: letting players actually move around on their planets!

#GameDev #PlanetClickerWars #PhysicsEngine #VibeCoding

## Post #27 - March 28, 2023 <planet-click-detection>

🎯 Got the ray casting system working for player movement! Needed this to let players click anywhere on a planet surface to move there. Had to tell the AI to create a proper detection system with animated markers that highlight exactly where you clicked. The tricky part was avoiding accidental movement - added logic to distinguish between clicks and drags (7px threshold), plus a 300ms timer to ignore long presses. Also fixed a major Supabase issue - we were sending way too many requests during movement. Now only saving destination positions, not every step. Next: calculating movement paths along the planet surface!

#GameDev #PlanetClickerWars #RayCasting #VibeCoding 