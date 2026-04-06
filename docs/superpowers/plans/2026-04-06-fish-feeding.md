# Fish Feeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click the water surface to drop food flakes that drift down; fish swim to eat them.

**Architecture:** A `FlakeManager` class in `src/feeding/flakes.ts` handles flake lifecycle (spawn, drift, dissolve, consume). Fish gain a new `feed` behavior state. The main loop coordinates flake positions with fish AI.

**Tech Stack:** Three.js geometry + materials, existing fish state machine.

---

## File Structure

| File | Role |
|------|------|
| `src/feeding/flakes.ts` | **New** — FlakeManager class |
| `src/fish/fish.ts` | **Modify** — Add `feed` state and `nearestFlake` to StateContext |
| `src/fish/behaviors.ts` | **Modify** — Add `updateFeed` function |
| `src/main.ts` | **Modify** — Click handler, FlakeManager in render loop |

---

### Task 1: Create FlakeManager

**Files:**
- Create: `src/feeding/flakes.ts`

- [ ] **Step 1: Create the FlakeManager class**

Create `src/feeding/flakes.ts`:

```typescript
import * as THREE from 'three'
import { TANK } from '../scene/tank'

const MAX_FLAKES = 30
const CLUSTER_SIZE_MIN = 4
const CLUSTER_SIZE_MAX = 6
const SINK_SPEED_MIN = 0.3
const SINK_SPEED_MAX = 0.5
const WOBBLE_AMP = 0.02
const MAX_LIFE = 8
const FADE_START = 6 // start fading at 6s
const FLOOR_DISSOLVE_TIME = 3
const FLAKE_RADIUS = 0.06
const FLAKE_COLORS = [0xcc6633, 0xdd8844, 0xbb5522, 0xeea055]

interface Flake {
  id: number
  mesh: THREE.Mesh
  speed: number
  wobbleOffset: number
  life: number
  onFloor: boolean
  consumed: boolean
}

let nextId = 0

export class FlakeManager {
  private flakes: Flake[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawnCluster(center: THREE.Vector3): void {
    const count = CLUSTER_SIZE_MIN + Math.floor(Math.random() * (CLUSTER_SIZE_MAX - CLUSTER_SIZE_MIN + 1))
    for (let i = 0; i < count; i++) {
      if (this.flakes.length >= MAX_FLAKES) break

      const geo = new THREE.CircleGeometry(FLAKE_RADIUS, 5)
      const color = FLAKE_COLORS[Math.floor(Math.random() * FLAKE_COLORS.length)]
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)

      // Scatter around center
      mesh.position.set(
        center.x + (Math.random() - 0.5) * 0.5,
        TANK.height / 2 - 0.1,
        center.z + (Math.random() - 0.5) * 0.5,
      )
      // Random rotation for variety
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      )

      this.scene.add(mesh)
      this.flakes.push({
        id: nextId++,
        mesh,
        speed: SINK_SPEED_MIN + Math.random() * (SINK_SPEED_MAX - SINK_SPEED_MIN),
        wobbleOffset: Math.random() * Math.PI * 2,
        life: 0,
        onFloor: false,
        consumed: false,
      })
    }
  }

  getActiveFlakes(): { position: THREE.Vector3; id: number }[] {
    return this.flakes
      .filter(f => !f.consumed)
      .map(f => ({ position: f.mesh.position, id: f.id }))
  }

  consume(id: number): boolean {
    const flake = this.flakes.find(f => f.id === id)
    if (!flake || flake.consumed) return false
    flake.consumed = true
    this.scene.remove(flake.mesh)
    flake.mesh.geometry.dispose()
    ;(flake.mesh.material as THREE.MeshStandardMaterial).dispose()
    return true
  }

  update(dt: number): void {
    const floorY = -TANK.height / 2

    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i]
      if (f.consumed) {
        this.flakes.splice(i, 1)
        continue
      }

      f.life += dt

      if (!f.onFloor) {
        // Sink
        f.mesh.position.y -= f.speed * dt
        // Wobble
        f.mesh.position.x += Math.sin(f.life * 2 + f.wobbleOffset) * WOBBLE_AMP * dt
        f.mesh.position.z += Math.cos(f.life * 1.5 + f.wobbleOffset) * WOBBLE_AMP * dt

        // Hit floor
        if (f.mesh.position.y <= floorY) {
          f.mesh.position.y = floorY + 0.02
          f.onFloor = true
          f.life = MAX_LIFE - FLOOR_DISSOLVE_TIME // start dissolving immediately
        }
      }

      // Fade out
      const mat = f.mesh.material as THREE.MeshStandardMaterial
      if (f.life > FADE_START) {
        const fadeProgress = (f.life - FADE_START) / (MAX_LIFE - FADE_START)
        mat.opacity = Math.max(0, 1 - fadeProgress)
      }

      // Remove expired
      if (f.life >= MAX_LIFE) {
        this.scene.remove(f.mesh)
        f.mesh.geometry.dispose()
        mat.dispose()
        this.flakes.splice(i, 1)
      }
    }
  }
}
```

- [ ] **Step 2: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/feeding/flakes.ts
git commit -m "feat: add FlakeManager for food flake lifecycle"
```

---

### Task 2: Add Feed State to Fish

**Files:**
- Modify: `src/fish/fish.ts`

- [ ] **Step 1: Add feed state and flake context**

In `src/fish/fish.ts`, add `'feed'` to the `FishState` type (line 6):

```typescript
export type FishState = 'idle' | 'wander' | 'school' | 'flee' | 'hide' | 'territorial' | 'react' | 'feed'
```

Add `nearestFlake` to `StateContext` (after `homeDecor`):

```typescript
export interface StateContext {
  threats: ProximityInfo[]
  shelters: ProximityInfo[]
  school: ProximityInfo[]
  mouse: ProximityInfo | null
  homeDecor: ProximityInfo | null
  nearestFlake: { distance: number } | null
}
```

- [ ] **Step 2: Add feed transition to state machine**

In `FishStateMachine.update()`, add feed state logic after the mouse reaction block (after line 55) but before the behavior-specific states (line 57):

```typescript
    // Feed — if food is nearby and not fleeing/hiding
    const hasNearFlake = ctx.nearestFlake !== null && ctx.nearestFlake.distance < 4.0
    if (hasNearFlake && this.current !== 'flee' && this.current !== 'hide'
        && this.behaviorType !== 'predator') {
      this.current = 'feed'
      return
    }
```

- [ ] **Step 3: Add targetFlakeId to Fish class**

Add a public field to the `Fish` class for tracking which flake it's targeting:

```typescript
  targetFlakeId: number | null = null
```

Add this after the `targetVelocity` declaration (line 99).

- [ ] **Step 4: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/fish/fish.ts
git commit -m "feat: add feed state to fish state machine"
```

---

### Task 3: Add updateFeed Behavior

**Files:**
- Modify: `src/fish/behaviors.ts`

- [ ] **Step 1: Add updateFeed function**

Add at the end of `src/fish/behaviors.ts`:

```typescript
export function updateFeed(fish: Fish, flakePos: THREE.Vector3, _dt: number): void {
  _dir.subVectors(flakePos, fish.position).normalize().multiplyScalar(fish.species.speed * 1.2)
  fish.targetVelocity.copy(_dir)
}
```

- [ ] **Step 2: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/fish/behaviors.ts
git commit -m "feat: add updateFeed behavior for fish swimming to flakes"
```

---

### Task 4: Wire Everything into Main

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import FlakeManager and updateFeed**

Add imports at the top of `src/main.ts`:

```typescript
import { FlakeManager } from './feeding/flakes'
import { updateFeed } from './fish/behaviors'  // add updateFeed to existing import
```

(Merge `updateFeed` into the existing behaviors import line.)

- [ ] **Step 2: Create FlakeManager**

After `const effects = new DecorationEffects(scene)` (line 81), add:

```typescript
const flakeManager = new FlakeManager(scene)
```

- [ ] **Step 3: Add click-to-feed handler**

Add a new click handler after the existing slot click handler (after line 177). Use a `THREE.Plane` to detect water surface clicks:

```typescript
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TANK.height / 2)
const waterIntersect = new THREE.Vector3()

window.addEventListener('click', (e) => {
  if (isEditMode) return

  raycaster.setFromCamera(
    new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    ),
    camera,
  )

  if (raycaster.ray.intersectPlane(waterPlane, waterIntersect)) {
    // Only spawn if click is within tank bounds
    if (
      Math.abs(waterIntersect.x) < TANK.width / 2 &&
      Math.abs(waterIntersect.z) < TANK.depth / 2
    ) {
      flakeManager.spawnCluster(waterIntersect.clone())
    }
  }
})
```

- [ ] **Step 4: Pass flakes to fish behavior context**

In `updateFishBehaviors()`, before the per-fish loop, get the active flakes:

```typescript
  const activeFlakes = flakeManager.getActiveFlakes()
```

Inside the per-fish loop, after the `nearestHomeDist`/`nearestHomePos` calculation, find the nearest flake:

```typescript
    let nearestFlakeDist = Infinity
    let nearestFlakePos: THREE.Vector3 | null = null
    let nearestFlakeId: number | null = null
    for (const flake of activeFlakes) {
      const d = fish.position.distanceTo(flake.position)
      if (d < nearestFlakeDist) {
        nearestFlakeDist = d
        nearestFlakePos = flake.position
        nearestFlakeId = flake.id
      }
    }
```

Add `nearestFlake` to the `StateContext` object:

```typescript
      nearestFlake: nearestFlakePos ? { distance: nearestFlakeDist } : null,
```

- [ ] **Step 5: Handle feed behavior in the switch**

In the behavior switch statement, add the `feed` case:

```typescript
      case 'feed':
        if (nearestFlakePos && nearestFlakeId !== null) {
          fish.targetFlakeId = nearestFlakeId
          updateFeed(fish, nearestFlakePos, dt)
          // Check if fish reached the flake
          if (nearestFlakeDist < 0.3) {
            flakeManager.consume(nearestFlakeId)
            fish.targetFlakeId = null
          }
        } else {
          fish.targetFlakeId = null
          updateWander(fish, dt)
        }
        break
```

- [ ] **Step 6: Update flakes in the render loop**

In the `animate()` function, add after `effects.update(elapsed)`:

```typescript
  flakeManager.update(dt)
```

- [ ] **Step 7: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire fish feeding — click water to drop flakes, fish swim to eat"
```

---

### Task 5: Manual Testing

- [ ] **Step 1: Test basic feeding**

Run: `npx vite dev`

Click near the water surface. Verify:
- 4-6 small flakes appear at the water line
- Flakes drift downward with slight wobble
- Nearby fish swim toward the flakes

- [ ] **Step 2: Test flake consumption**

Watch a fish reach a flake. Verify:
- The flake disappears when a fish reaches it
- The fish returns to its normal behavior after eating

- [ ] **Step 3: Test flake dissolve**

Don't click on any more flakes. Wait 8 seconds. Verify:
- Uneaten flakes fade out and disappear
- Flakes that reach the floor dissolve over 3 seconds

- [ ] **Step 4: Test capacity**

Click rapidly many times to spawn lots of flakes. Verify:
- Never more than 30 flakes visible
- No errors in console

- [ ] **Step 5: Test barracuda ignores food**

Verify the barracuda never enters the feed state.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: fish feeding polish after manual testing"
```
