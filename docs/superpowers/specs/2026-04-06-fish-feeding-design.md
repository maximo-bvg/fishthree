# Fish Feeding — Design Spec

## Overview

Click the water surface to drop food flakes. Flakes drift downward, nearby fish swim to eat them, and uneaten flakes dissolve after a few seconds. Purely visual — no hunger, consequences, or progression.

## Current State

**File:** `src/main.ts`

Click events are handled for edit-mode slot placement. The water surface is at `y = TANK.height / 2` (`4.5`). Fish have a behavior state machine with states including `react` (responds to mouse cursor).

**File:** `src/fish/fish.ts`

Fish have `targetVelocity` that behaviors set, and `velocity` that lerps toward it. A new `feed` state can be added to the state machine.

## Design

### Food Flake System

**New file:** `src/feeding/flakes.ts`

A `FlakeManager` class manages all active food flakes.

#### Flake Lifecycle

1. **Spawn:** Player clicks the water surface → spawn 4-6 flakes in a small random cluster around the click point
2. **Drift:** Flakes sink slowly (`speed: 0.3-0.5 units/sec`) with gentle horizontal wobble (sine wave, amplitude `0.02`)
3. **Eaten:** When a fish reaches within `0.3` units of a flake, the flake is consumed (removed from scene)
4. **Dissolve:** Uneaten flakes fade out after `8` seconds (opacity lerp to 0 over last 2 seconds), then are removed
5. **Floor:** If a flake reaches the tank floor (`y = -TANK.height/2`), it rests there and dissolves over 3 seconds

#### Flake Mesh

Each flake is a small flat disc:
- `CircleGeometry(0.06, 5)` — tiny pentagon shape
- `MeshStandardMaterial` with random warm color from palette: `[0xcc6633, 0xdd8844, 0xbb5522, 0xeea055]`
- Random slight rotation on spawn for variety
- No shadows (too small to matter)

#### Capacity

Max `30` active flakes at once. If at capacity, new clicks are ignored.

### Click Detection

**File:** `src/main.ts`

When not in edit mode, handle clicks:
1. Raycast from mouse against the water surface plane (`y = TANK.height / 2`)
2. If the ray hits the water plane, get the intersection point
3. Call `flakeManager.spawnCluster(intersectionPoint)`

Since the water surface is a Water2 object that may not raycast cleanly, use a `THREE.Plane` at `y = TANK.height / 2` for the intersection test instead of raycasting against the mesh.

### Fish Feeding Behavior

**New state: `feed`**

**File:** `src/fish/fish.ts`

Add `'feed'` to the `FishState` type.

**File:** `src/fish/behaviors.ts`

New function: `updateFeed(fish: Fish, targetPos: THREE.Vector3, dt: number)`
- Fish swims toward the flake position at `speed * 1.2` (slightly eager)
- When within `0.3` units, the flake is "eaten" — the behavior signals this via a callback

**File:** `src/fish/fish.ts` — `FishStateMachine`

Add feed transition logic:
- Fish enters `feed` state when a flake exists within `4.0` units AND the fish is not currently fleeing or hiding
- `feed` has lower priority than `flee` and `hide` but higher than `wander`, `school`, `territorial`
- When the target flake is eaten (by this fish or another), the fish returns to its previous behavior
- Predator fish (barracuda) ignore food — they don't enter feed state

### Integration with Main Loop

**File:** `src/main.ts`

1. Create `FlakeManager` alongside other systems
2. In `updateFishBehaviors`, pass nearby flakes to each fish's context
3. Add to `StateContext`:
   ```typescript
   nearestFlake: { position: THREE.Vector3; distance: number } | null
   ```
4. In the behavior switch, add `case 'feed'`
5. In the render loop, call `flakeManager.update(dt)` to advance flake physics

### Flake-Fish Coordination

The `FlakeManager` exposes:
- `getActiveFlakes(): { position: THREE.Vector3; id: number }[]` — for fish to find targets
- `consume(id: number): boolean` — fish calls this when it reaches a flake; returns false if already eaten
- `spawnCluster(center: THREE.Vector3): void` — spawns the cluster
- `update(dt: number): void` — physics + dissolve

Each fish in `feed` state claims a flake by ID. If two fish target the same flake and one eats it first, the other's `consume()` call returns false and it picks a new target or reverts to wander.

### UI Changes

None. Feeding is done by clicking the water surface directly — no button needed. This keeps it discoverable-by-experimentation, which fits the casual toy nature.

## Files Changed

| File | Change |
|------|--------|
| `src/feeding/flakes.ts` | **New** — FlakeManager class |
| `src/fish/fish.ts` | Add `feed` state, add `nearestFlake` to StateContext |
| `src/fish/behaviors.ts` | Add `updateFeed` function |
| `src/main.ts` | Click-to-feed handler, FlakeManager integration in loop |

## Performance

Max 30 tiny circle meshes. Negligible impact.

## Scope Boundary

- No hunger or consequences for not feeding
- No different food types
- No feeding button in UI — click-only
- No fish growth from feeding
- No feeding animations beyond swimming to the flake
