# 🌍 Planet Clicker Wars

> Two planets. One rocket. Infinite clicks. May the best planet win! 🚀

## What's This? 

Planet Clicker Wars is a multiplayer physics-based clicker game where two planets compete in an epic battle of clicks to build and launch a rocket first. Think Twitch Plays Pokemon meets Kerbal Space Program, but with more explosions! 💥

## Key Features

- 🎮 **Real-time Multiplayer**: Join forces with fellow geeks on your assigned planet
- 🌠 **Epic Entry**: Experience an atmospheric entry when you join (with actual physics!)
- 🏃‍♂️ **Planet Exploration**: Run around your spherical world with other players
- 🚀 **Collaborative Building**: Work together to construct your planet's rocket
- 💪 **Competitive**: First planet to launch their rocket gets to destroy the other one!

## Quick Start

1. Clone this repo
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Join a mission and start clicking!

## Tech Stack

We're using some seriously cool tech:
- Three.js for stunning 3D graphics
- Cannon.js for realistic physics
- WebSocket for real-time multiplayer action

## Documentation

Want to dive deeper? Check out our detailed docs:
- 📋 [Complete Game Design](./memory-bank/game-design.md)
- 🛠️ [Implementation Plan](./implementation-plan.md)
- 💻 [Technology Stack Details](./technology-stack.md)

## Contributing

Got ideas? Found bugs? Want to make the planets more explodey? 
1. Fork it
2. Create your feature branch
3. Submit a PR
4. Join our community!

## License

MIT - Go wild! 🎉

## Debugging Hitboxes

The buildable objects (like rockets) now have expanded hitboxes to make them easier to click. 
To debug and visualize these hitboxes:

1. Open the browser console
2. Run `window.game.toggleHitboxVisibility(true)` to show hitboxes
3. Run `window.game.toggleHitboxVisibility(false)` to hide hitboxes

The hitboxes will appear as red wireframe cylinders around the buildable objects.

---
*Remember: In space, no one can hear you click... but they can see your rocket coming!* 🌠