# FishThree — 3D Fish Tank Game Design Spec

## Overview

A browser-based 3D fish tank game built with vanilla Three.js. Players view a low-poly geometric aquarium from the front, watch fish with ecosystem behaviors swim around, and decorate the tank by placing items into predefined slot zones. The UI uses a classic game frame layout (top bar, left sidebar, bottom bar) rendered as HTML/CSS overlaid on the Three.js canvas.

## Core Experience

- **View mode:** Watch fish swim in a front-facing 3D tank with depth parallax
- **Edit mode:** Place and arrange decorations in grid-based slot zones
- No backend, no currency, no shop — v1 is purely a tank viewer + decorator with localStorage persistence

---

## 1. Scene & Rendering

### Camera

- Front-facing camera aimed at the tank center, slightly off-center vertically for a natural viewing angle
- Mouse-driven parallax: camera shifts 1-2 degrees based on cursor position, creating a subtle depth effect
- Fish swim at different Z-depths, producing real parallax layering

### Tank Structure

| Element | Implementation |
|---|---|
| Back wall | Flat plane with deep blue gradient texture |
| Side walls | Semi-transparent planes with slight tint (glass effect) |
| Floor | Sand-textured plane |
| Water surface | Animated plane at the top with transparency and refraction-like distortion |
| Frame | No visible 3D rim — the HTML UI frame acts as the tank border |

Tank proportions: roughly 16:9 aspect ratio rectangular box.

### Lighting

- **Ambient light:** Base visibility across the scene
- **Directional overhead light:** Simulates a tank lamp, casts soft shadows downward
- **Caustic effect:** Animated UV texture or light cookie projected onto the sand floor

### Post-Processing

- Light bloom on the overhead lamp glow
- Subtle depth-of-field: objects very near the front glass or far back get slightly blurry

---

## 2. Fish System

### Art Style

Low-poly geometric. Each fish is built from Three.js primitives: elongated icosahedron body, triangle tail fin, small triangle dorsal/pectoral fins. Species vary by proportions.

### Species (v1 — 6 types)

| Species | Shape | Size | Primary Behavior |
|---|---|---|---|
| Tetra | Small, slim | Tiny | Schooling — swims in groups of 3-4 using boids algorithm |
| Clownfish | Round, stubby | Small | Territorial — claims a decoration and orbits near it, chases intruders |
| Angelfish | Tall, flat | Medium | Wanderer — graceful slow sweeps across the tank |
| Pufferfish | Spherical | Medium | Shy — hides near rocks, inflates when mouse approaches |
| Barracuda | Long, sleek | Large | Predator patrol — slow laps, small fish avoid it |
| Seahorse | Upright, curled tail | Small | Anchorer — clings to plants, drifts slowly between them |

### Tank Capacity

8-12 fish per tank.

### Behavior State Machine

Each fish has states: `idle`, `wander`, `school`, `flee`, `hide`, `territorial`, `react`.

Transitions are driven by:
- Proximity to other fish
- Proximity to decorations
- Proximity to tank walls
- Mouse cursor position

#### Behavior Details

- **Schooling (Tetra):** Boids algorithm with separation, alignment, and cohesion within the group
- **Territorial (Clownfish):** Picks nearest "home" decoration, orbits within a radius, chases fish that enter the zone
- **Flee:** Small fish flee when barracuda or mouse cursor gets within a distance threshold
- **Hide (Pufferfish):** Seeks nearest rock/structure when startled
- **Mouse reaction:** Fish near the cursor scatter (skittish) or approach (curious) depending on species personality

### Animation

- **Tail oscillation:** Sine wave on the tail joint; frequency varies by species
- **Body wiggle:** Slight sinusoidal lateral displacement along the spine
- **Speed coupling:** Faster swimming = faster tail wag and body wiggle frequency

---

## 3. Decoration System

### Slot Zones

The tank has 20 predefined placement slots organized by zone:

| Zone | Count | Suitable Items |
|---|---|---|
| Floor (back row) | 5 | Large rocks, castles, treasure chests |
| Floor (front row) | 5 | Small rocks, bubblers, novelty items |
| Back wall (upper) | 4 | Tall plants, coral fans |
| Back wall (lower) | 4 | Short plants, anemones |
| Ceiling | 2 | Lights, hanging accessories |

Each slot has a size category determining which items fit:
- **Small:** Anemone, bubbler, diver figurine
- **Medium:** Seaweed, coral fan, boulder, driftwood, treasure chest, tank light
- **Large:** Rock arch, sunken ship

### Edit Mode Flow

1. Click "Edit Tank" in the bottom bar
2. Tank dims slightly; slot outlines glow to show available positions
3. Fish keep swimming (no freeze)
4. Bottom bar transforms into category-tabbed inventory: Plants | Rocks | Accessories | Fun
5. Click a slot to select it, then click an inventory item to place it
6. Click an occupied slot to remove or swap the decoration
7. Click "Done" to exit — slot outlines fade, tank returns to normal

### Decoration Catalog (v1)

All decorations are low-poly geometry matching the fish art style, built from Three.js primitives.

**Plants & Coral:**
- Seaweed — stacked tapered cylinders that sway
- Coral fan — flat disc with holes
- Anemone — cluster of cylinders

**Rocks & Structures:**
- Boulder — low-poly icosahedron
- Rock arch — two columns + bridge
- Driftwood — irregular cylinder

**Tank Accessories:**
- Bubbler — small box that emits rising sphere particles
- Tank light — cone spotlight that tints nearby area with color

**Fun / Novelty:**
- Treasure chest — box with hinged lid
- Diver figurine — assembled primitives
- Sunken ship — wedge shape + mast

### Decoration Effects

- **Plants sway:** Vertex animation on a sine wave
- **Bubblers:** Stream of small translucent spheres rising to the water surface
- **Lights:** Cast a colored spotlight on the nearby area
- **Fish interactions:** Clownfish claim decorations as territory, seahorses cling to plants, pufferfish hide behind rocks

---

## 4. UI Layout

HTML/CSS overlay on the Three.js canvas. Classic game frame layout.

### Top Bar

- **Left:** Tank name (editable on click, default "My Reef Tank")
- **Right:** Fish count ("8/12 Fish"), decoration count ("6/20 Decor")

### Left Sidebar (icon buttons, top to bottom)

| Button | Action |
|---|---|
| Fish list | Opens panel listing all fish with species and name |
| Add fish | Opens species picker to add a new fish (max 12) |
| Screenshot | Captures current tank view as PNG download |
| Settings | Opens panel: toggle caustics, toggle bloom, camera sway intensity |

### Bottom Bar

- **Normal mode:** Thumbnails of currently placed decorations + "Edit Tank" button
- **Edit mode:** Category-tabbed inventory (Plants, Rocks, Accessories, Fun) with scrollable item grid + "Done" button

### Right Side

Empty in v1 — reserved for future features.

### Responsive Behavior

- **Desktop:** Full layout as described
- **Tablet:** Sidebar collapses to hamburger menu
- **Mobile:** Not a target for v1

---

## 5. State Persistence

All tank state saved to `localStorage`:
- Fish list (species, name, position)
- Decoration placements (slot ID, item type)
- Tank name
- Settings (caustics, bloom, sway)

Auto-save on every change. Load on startup. No backend for v1.

---

## 6. Tech Stack & Project Structure

### Dependencies

- `three` — core 3D rendering
- `vite` — dev server and bundling

No other runtime dependencies.

### Project Structure

```
fishthree/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js              — entry point, init scene/renderer/loop
│   ├── scene/
│   │   ├── tank.js           — tank geometry (walls, floor, water surface)
│   │   ├── lighting.js       — ambient, directional, caustics
│   │   └── camera.js         — camera setup, parallax mouse tracking
│   ├── fish/
│   │   ├── species.js        — species definitions (geometry, size, behavior type)
│   │   ├── fish.js           — fish entity class (mesh + state machine)
│   │   ├── behaviors.js      — behavior implementations (school, flee, hide, etc.)
│   │   └── boids.js          — boids algorithm for schooling
│   ├── decorations/
│   │   ├── catalog.js        — all decoration definitions
│   │   ├── slots.js          — slot zone positions and management
│   │   └── effects.js        — sway animation, bubbler particles
│   ├── ui/
│   │   ├── hud.js            — top bar, sidebar, bottom bar
│   │   ├── edit-mode.js      — edit mode overlay and inventory panel
│   │   └── panels.js         — fish list, species picker, settings
│   └── utils/
│       ├── storage.js        — localStorage save/load
│       └── geometry.js       — shared low-poly geometry helpers
└── public/
    └── textures/             — sand, caustic patterns (minimal)
```

### Render Loop

Single `requestAnimationFrame` loop:
1. Update fish state machines (behavior transitions, movement)
2. Update decoration effects (sway, bubbles)
3. Update camera parallax from mouse position
4. Render the scene

### Performance Budget

- Target: 60fps on mid-range hardware
- Max 12 fish, 20 decorations
- Low-poly geometry keeps vertex count low
- Bubbler particles capped at ~30 spheres total
