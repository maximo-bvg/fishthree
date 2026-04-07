# FishThree

An interactive 3D fish tank simulator built with [Three.js](https://threejs.org/). Watch colorful fish swim, school, and interact in a realistic underwater environment — all rendered in real-time in your browser.

## Features

- **Realistic underwater rendering** — depth-based Beer-Lambert light absorption, animated turbidity, volumetric haze, and noise-driven wave distortion
- **Multiple fish species** — tetras, clownfish, angelfish, pufferfish, barracuda, seahorses, and more, each with unique behaviors (schooling, predator patrol, bottom-dwelling, drifting)
- **Fish AI & state machine** — fish wander, school, flee from predators, hide near rocks, react to your mouse cursor, and feed on flakes
- **Day/night cycle** — smooth transitions through dawn, day, dusk, and midnight with dynamic lighting, fog, and water tint changes
- **Decorations** — place corals, rocks, seaweed, and other items in slot-based positions via an edit mode
- **Feeding** — click the water surface to drop food flakes that fish swim up to eat
- **Camera modes** — default parallax view, orbit mode, and click-to-follow individual fish
- **Procedural effects** — Voronoi caustics on the floor, Gerstner wave water surface, god rays, rising bubbles, floating particles
- **Procedural sand floor** — FBM noise-generated sand texture with dune variation, ripples, and scattered pebbles
- **Audio** — ambient underwater sounds and UI sound effects with volume controls
- **Tank customization** — rename your tank, toggle caustics and bloom, adjust sway intensity, take screenshots
- **Persistent state** — fish, decorations, and settings are saved to localStorage

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Controls

- **Mouse move** — subtle camera parallax
- **Click fish** — follow that fish with the camera
- **Click water surface** — drop food flakes
- **Click empty space** (while following) — return to default view
- **Orbit button** — free orbit camera around the tank
- **Edit mode** — place and remove decorations

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Vite](https://vite.dev/) — dev server and bundling
- [Vitest](https://vitest.dev/) — testing

## Build

```bash
npm run build    # Production build to dist/
npm test         # Run tests
```
