# More Species & Decorations — Design Spec

## Overview

Expand the fish catalog by 4 new species and the decoration catalog by 5 new items. New species fill behavioral gaps (bottom-dweller, fast schooler, jellyfish, surface fish). New decorations add variety across all categories.

## Current State

**File:** `src/fish/species.ts`

6 species: tetra (schooling), clownfish (territorial), angelfish (wanderer), pufferfish (shy), barracuda (predator), seahorse (anchorer).

All use a generic rigged GLB model with per-species color tinting (except seahorse which has its own model).

**File:** `src/decorations/catalog.ts`

11 decorations across 4 categories: plants (3), rocks (3), accessories (2), fun (3).

## Design

### New Fish Species

#### 1. Pleco (Bottom-Dweller)

| Property | Value |
|----------|-------|
| Behavior | New: `bottom-dweller` |
| Personality | `neutral` |
| Size | `0.45` |
| Speed | `0.8` (very slow) |
| Color | `0x554433` (dark brown) |
| Model | Generic fish model, color-tinted |

**Behavior: `bottom-dweller`**

New behavior type. The pleco stays near the tank floor:
- Wanders only in the bottom 20% of the tank (`y` clamped to `-TANK.height/2` to `-TANK.height/2 + TANK.height * 0.2`)
- Slowly drifts along the floor, occasionally stopping for 2-3 seconds
- Does not flee from the barracuda (too armored / slow to bother)
- Does not react to mouse (personality: neutral, but overridden to ignore)

Add `'bottom-dweller'` to the `BehaviorType` union.

New behavior function: `updateBottomDwell(fish: Fish, dt: number)` in `behaviors.ts`.

#### 2. Danio (Fast Schooler)

| Property | Value |
|----------|-------|
| Behavior | `schooling` |
| Personality | `skittish` |
| Size | `0.12` |
| Speed | `3.5` (fastest fish) |
| Color | `0x4488ff` (bright blue with stripes — achieved via color tint) |
| Model | Generic fish model |

Uses the existing schooling behavior. Schools with other danios (not tetras — schooling is per-species). Their high speed makes them visually distinct from the slower tetras.

#### 3. Jellyfish

| Property | Value |
|----------|-------|
| Behavior | New: `drifter` |
| Personality | `neutral` |
| Size | `0.35` |
| Speed | `0.4` (very slow, drifting) |
| Color | `0xddaaff` (translucent purple) |
| Model | Custom procedural mesh (no GLB) |

**Mesh:** Custom geometry — a half-sphere bell (`SphereGeometry` with `phiLength: Math.PI`) plus 6-8 trailing tentacle lines (thin `CylinderGeometry` segments). Material is `MeshStandardMaterial` with `transparent: true`, `opacity: 0.6`. The bell pulses (scale oscillation on Y axis).

**Behavior: `drifter`**

New behavior type. The jellyfish drifts aimlessly:
- Very slow random wandering with heavy direction smoothing (changes direction every 5-8 seconds)
- Stays in the upper 60% of the tank
- Does not flee, does not react to mouse, does not school
- Other fish avoid it (treated as a mild obstacle — fish steer around within 1.5 unit radius)

Add `'drifter'` to the `BehaviorType` union.

New behavior function: `updateDrift(fish: Fish, dt: number)` in `behaviors.ts`.

**Animation:** Bell pulsing is handled in `mesh.ts` — scale.y oscillates on a sine wave (0.9–1.1, frequency 0.8 Hz). Tentacles sway using the same vertex animation pattern as seaweed decorations.

#### 4. Guppy (Surface Swimmer)

| Property | Value |
|----------|-------|
| Behavior | New: `surface-swimmer` |
| Personality | `curious` |
| Size | `0.1` |
| Speed | `2.0` |
| Color | `0xff6699` (bright pink/red) |
| Model | Generic fish model |

**Behavior: `surface-swimmer`**

New behavior type. The guppy stays near the water surface:
- Wanders only in the top 20% of the tank
- Occasionally "breaks" the surface — position.y briefly equals `TANK.height / 2` then dips back (visual effect only)
- Schools loosely with other guppies (uses boids but with larger separation distance — `2.0` instead of `1.0`)
- Flees from barracuda like other small fish

Add `'surface-swimmer'` to the `BehaviorType` union.

New behavior function: `updateSurfaceSwim(fish: Fish, school: Fish[], dt: number)` in `behaviors.ts`.

### Species Type Updates

**File:** `src/fish/species.ts`

```typescript
export type SpeciesId = 'tetra' | 'clownfish' | 'angelfish' | 'pufferfish' 
  | 'barracuda' | 'seahorse' | 'pleco' | 'danio' | 'jellyfish' | 'guppy'

export type BehaviorType = 'schooling' | 'territorial' | 'wanderer' | 'shy' 
  | 'predator' | 'anchorer' | 'bottom-dweller' | 'drifter' | 'surface-swimmer'
```

### New Decorations

#### Plants & Coral

**1. Brain Coral** (medium, plants)
- Hemisphere shape: `SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)`
- Color: `0xee8866` (pinkish coral)
- Jittered vertices for organic look
- Subtle pulsing animation (scale oscillation, amplitude 0.02)

**2. Kelp** (medium, plants)
- Tall variant of seaweed: 8 stacked tapered cylinders (vs seaweed's 5)
- Color: `0x337733` (darker green than seaweed)
- Stronger sway animation (amplitude `0.15` vs seaweed's `0.1`)
- Seahorses can cling to it (treated as a plant for anchorer behavior)

#### Rocks & Structures

**3. Coral Cluster** (medium, rocks)
- 3-4 small cylinders of varying heights grouped together
- Colors: mix of `0xff6655`, `0xffaa44`, `0xff88aa` (colorful coral)
- No animation — static

#### Accessories

**4. Volcano Bubbler** (medium, accessories)
- Cone shape: `ConeGeometry(0.4, 0.8, 6)` in dark gray (`0x444444`)
- Crater at top: small inverted cone
- Emits orange-tinted bubble particles (reuses DecorationEffects bubbler system but with `color: 0xff6633`)
- The particles rise faster than normal bubblers (`speed: 1.0` vs `0.5`)

#### Fun

**5. Treasure Map** (small, fun)
- Flat plane with scroll shape: `PlaneGeometry(0.5, 0.4)` with curled edges (extra vertices displaced)
- Color: `0xddcc88` (parchment)
- Slight rotation for a "resting on floor" look
- No animation

### Decoration Type Updates

**File:** `src/decorations/catalog.ts`

```typescript
export type DecorationId =
  | 'seaweed' | 'coral_fan' | 'anemone'
  | 'boulder' | 'rock_arch' | 'driftwood'
  | 'bubbler' | 'tank_light'
  | 'treasure_chest' | 'diver' | 'sunken_ship'
  | 'brain_coral' | 'kelp' | 'coral_cluster' | 'volcano_bubbler' | 'treasure_map'
```

### DecorationEffects Updates

**File:** `src/decorations/effects.ts`

- `brain_coral`: Register with slow pulsing (scale oscillation)
- `kelp`: Register as swaying mesh (same as seaweed, stronger amplitude)
- `volcano_bubbler`: Register as bubbler with orange-tinted particles

### Jellyfish Mesh

**File:** `src/fish/mesh.ts`

Add a special case for jellyfish in `createFishMesh`:
- If `speciesId === 'jellyfish'`, build the custom bell + tentacles geometry instead of loading the GLB model
- The bell mesh gets a transparent material
- Tentacles are child meshes that sway via vertex animation

The jellyfish animation (bell pulsing) is handled in `animateFishMesh` with a special case.

### UI: Add Fish Panel

**File:** `src/ui/panels.ts`

The species picker already iterates over `SPECIES`. Adding new entries to the `SPECIES` record automatically makes them available in the panel. No UI code changes needed.

## Files Changed

| File | Change |
|------|--------|
| `src/fish/species.ts` | Add 4 species definitions, expand SpeciesId and BehaviorType |
| `src/fish/behaviors.ts` | Add `updateBottomDwell`, `updateDrift`, `updateSurfaceSwim` |
| `src/fish/fish.ts` | Handle new behavior types in state machine |
| `src/fish/mesh.ts` | Custom jellyfish mesh creation + animation |
| `src/decorations/catalog.ts` | Add 5 decoration definitions, expand DecorationId |
| `src/decorations/effects.ts` | Register effects for brain coral, kelp, volcano bubbler |
| `src/main.ts` | Handle new behavior types in the behavior switch statement |

## Performance

4 more fish + 5 more decorations stay within the existing budget (12 fish max, 20 decoration slots). Jellyfish transparency adds one more blended object but is negligible.

## Scope Boundary

- No new GLB models — all new species use the generic model or procedural geometry (jellyfish)
- No new behavior interactions between new and existing species beyond what's specified
- No new decoration categories
- No new slot zones
- Jellyfish tentacles are simple cylinders, not physics-simulated
