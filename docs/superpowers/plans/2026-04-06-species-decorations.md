# More Species & Decorations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new fish species (pleco, danio, jellyfish, guppy) with 3 new behavior types, and 5 new decorations (brain coral, kelp, coral cluster, volcano bubbler, treasure map).

**Architecture:** Extend existing type unions, species definitions, and behavior functions. Jellyfish gets custom procedural geometry. New decorations follow the existing catalog pattern with mesh factory functions.

**Tech Stack:** Three.js geometry, existing fish/decoration systems.

---

## File Structure

| File | Role |
|------|------|
| `src/fish/species.ts` | **Modify** — Add 4 species definitions, expand types |
| `src/fish/behaviors.ts` | **Modify** — Add 3 new behavior functions |
| `src/fish/fish.ts` | **Modify** — Handle new behavior types in state machine |
| `src/fish/mesh.ts` | **Modify** — Custom jellyfish mesh + animation |
| `src/decorations/catalog.ts` | **Modify** — Add 5 decorations, expand types |
| `src/decorations/effects.ts` | **Modify** — Register effects for new decorations |
| `src/ui/panels.ts` | **Modify** — Add descriptions for new species |
| `src/ui/edit-mode.ts` | **Modify** — Add icons for new decorations |
| `src/main.ts` | **Modify** — Handle new behavior types in switch |

---

### Task 1: Add New Species Definitions

**Files:**
- Modify: `src/fish/species.ts`

- [ ] **Step 1: Expand type unions**

In `src/fish/species.ts`, update the types:

```typescript
export type BehaviorType = 'schooling' | 'territorial' | 'wanderer' | 'shy' | 'predator' | 'anchorer' | 'bottom-dweller' | 'drifter' | 'surface-swimmer'
```

```typescript
export type SpeciesId = 'tetra' | 'clownfish' | 'angelfish' | 'pufferfish' | 'barracuda' | 'seahorse' | 'pleco' | 'danio' | 'jellyfish' | 'guppy'
```

- [ ] **Step 2: Add species definitions**

Add to the `SPECIES` record after `seahorse`:

```typescript
  pleco: {
    name: 'Pleco',
    size: 0.45,
    speed: 0.8,
    tailFrequency: 2,
    behaviorType: 'bottom-dweller',
    personality: 'neutral',
    color: 0x554433,
    bodyWidth: 0.2,
    bodyHeight: 0.15,
    bodyLength: 0.5,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.45,
    modelRotation: [0, 0, 0],
  },
  danio: {
    name: 'Danio',
    size: 0.12,
    speed: 3.5,
    tailFrequency: 10,
    behaviorType: 'schooling',
    personality: 'skittish',
    color: 0x4488ff,
    bodyWidth: 0.1,
    bodyHeight: 0.1,
    bodyLength: 0.25,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.12,
    modelRotation: [0, 0, 0],
  },
  jellyfish: {
    name: 'Jellyfish',
    size: 0.35,
    speed: 0.4,
    tailFrequency: 0.8,
    behaviorType: 'drifter',
    personality: 'neutral',
    color: 0xddaaff,
    bodyWidth: 0.3,
    bodyHeight: 0.35,
    bodyLength: 0.3,
    // No modelPath — uses custom procedural mesh
  },
  guppy: {
    name: 'Guppy',
    size: 0.1,
    speed: 2.0,
    tailFrequency: 9,
    behaviorType: 'surface-swimmer',
    personality: 'curious',
    color: 0xff6699,
    bodyWidth: 0.08,
    bodyHeight: 0.08,
    bodyLength: 0.2,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.1,
    modelRotation: [0, 0, 0],
  },
```

- [ ] **Step 3: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/fish/species.ts
git commit -m "feat: add pleco, danio, jellyfish, and guppy species definitions"
```

---

### Task 2: Add New Behavior Functions

**Files:**
- Modify: `src/fish/behaviors.ts`

- [ ] **Step 1: Add updateBottomDwell**

Add at the end of `src/fish/behaviors.ts`:

```typescript
export function updateBottomDwell(fish: Fish, dt: number): void {
  // Stay near the floor
  const floorY = -TANK.height / 2
  const ceilingY = floorY + TANK.height * 0.2

  // Slow wandering along the floor
  if (fish.targetVelocity.lengthSq() < 0.01 || Math.random() < dt * 0.3) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 2,
      0,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
    )
  }

  // Pull toward floor if too high
  if (fish.position.y > ceilingY) {
    fish.targetVelocity.y = -fish.species.speed * 0.5
  } else if (fish.position.y < floorY + fish.species.size) {
    fish.targetVelocity.y = fish.species.speed * 0.2
  } else {
    fish.targetVelocity.y *= 0.9 // damp vertical movement
  }
}
```

- [ ] **Step 2: Add updateDrift**

```typescript
export function updateDrift(fish: Fish, dt: number): void {
  // Very slow direction changes
  if (Math.random() < dt * 0.15) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 1.5,
      (Math.random() - 0.5) * fish.species.speed * 0.5,
      (Math.random() - 0.5) * fish.species.speed * 0.5,
    )
  }

  // Stay in upper 60% of tank
  const minY = -TANK.height / 2 + TANK.height * 0.4
  if (fish.position.y < minY) {
    fish.targetVelocity.y = fish.species.speed * 0.3
  }
}
```

- [ ] **Step 3: Add updateSurfaceSwim**

```typescript
export function updateSurfaceSwim(fish: Fish, school: Fish[], dt: number): void {
  // Loose schooling with other surface swimmers
  if (school.length > 0) {
    const agents = school.map(f => ({ position: f.position, velocity: f.velocity }))
    const self = { position: fish.position, velocity: fish.velocity }
    const force = computeBoids(self, agents, { ...BOIDS_DEFAULTS, separationDist: 2.0 })
    fish.targetVelocity.copy(fish.velocity).add(force)

    if (fish.targetVelocity.lengthSq() < 0.1) {
      fish.targetVelocity.set(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 0.6,
      )
    }
    fish.targetVelocity.normalize().multiplyScalar(fish.species.speed)
  } else {
    updateWander(fish, dt)
  }

  // Stay in top 20% of tank
  const surfaceY = TANK.height / 2
  const minY = surfaceY - TANK.height * 0.2
  if (fish.position.y < minY) {
    fish.targetVelocity.y = fish.species.speed * 0.5
  } else if (fish.position.y > surfaceY - fish.species.size) {
    fish.targetVelocity.y = -fish.species.speed * 0.2
  }
}
```

- [ ] **Step 4: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/fish/behaviors.ts
git commit -m "feat: add bottom-dwell, drift, and surface-swim behaviors"
```

---

### Task 3: Handle New Behaviors in State Machine and Main

**Files:**
- Modify: `src/fish/fish.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add new behavior types to state machine**

In `src/fish/fish.ts`, in the `FishStateMachine.update()` method, add cases in the behavior-specific switch (after the `anchorer` case):

```typescript
      case 'bottom-dweller':
        this.current = 'wander' // uses custom wander function in main
        return
      case 'drifter':
        this.current = 'wander' // uses custom drift function in main
        return
      case 'surface-swimmer':
        if (hasSchoolmates) {
          this.current = 'school' // uses custom surface school in main
          return
        }
        break
```

- [ ] **Step 2: Handle new behaviors in main.ts switch**

In `src/main.ts`, in the `updateFishBehaviors` function's behavior switch, update the `wander`/`idle` case to handle new behavior types:

```typescript
      case 'wander':
      case 'idle':
        if (fish.species.behaviorType === 'predator') {
          updatePredatorPatrol(fish, dt)
        } else if (fish.species.behaviorType === 'bottom-dweller') {
          updateBottomDwell(fish, dt)
        } else if (fish.species.behaviorType === 'drifter') {
          updateDrift(fish, dt)
        } else {
          updateWander(fish, dt)
        }
        break
      case 'school':
        if (fish.species.behaviorType === 'surface-swimmer') {
          updateSurfaceSwim(fish, school, dt)
        } else {
          updateSchool(fish, school, dt)
        }
        break
```

Add the imports at the top of main.ts:

```typescript
import { updateBottomDwell, updateDrift, updateSurfaceSwim } from './fish/behaviors'
```

(Merge into the existing behaviors import.)

- [ ] **Step 3: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/fish/fish.ts src/main.ts
git commit -m "feat: handle new behavior types in state machine and render loop"
```

---

### Task 4: Add Jellyfish Procedural Mesh

**Files:**
- Modify: `src/fish/mesh.ts`

- [ ] **Step 1: Add jellyfish mesh creation**

In `src/fish/mesh.ts`, add a new function before `createProceduralFishMesh`:

```typescript
function createJellyfishMesh(species: SpeciesDefinition): THREE.Group {
  const group = new THREE.Group()

  // Bell — half-sphere
  const bellGeo = new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  const bellMat = new THREE.MeshStandardMaterial({
    color: species.color,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  })
  const bell = new THREE.Mesh(bellGeo, bellMat)
  bell.name = 'bell'
  bell.castShadow = true
  group.add(bell)

  // Tentacles — 8 thin cylinders
  const tentacleCount = 8
  const tentacleMat = new THREE.MeshStandardMaterial({
    color: species.color,
    transparent: true,
    opacity: 0.4,
  })
  for (let i = 0; i < tentacleCount; i++) {
    const angle = (i / tentacleCount) * Math.PI * 2
    const radius = 0.15
    const tentacle = new THREE.Group()
    tentacle.name = `tentacle_${i}`

    // 3 segments per tentacle for sway
    for (let s = 0; s < 3; s++) {
      const segGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4)
      const seg = new THREE.Mesh(segGeo, tentacleMat)
      seg.position.y = -s * 0.18
      seg.name = `seg_${s}`
      tentacle.add(seg)
    }

    tentacle.position.set(
      Math.cos(angle) * radius,
      -0.05,
      Math.sin(angle) * radius,
    )
    group.add(tentacle)
  }

  group.userData.isJellyfish = true
  return group
}
```

- [ ] **Step 2: Hook into createFishMesh**

In the `createFishMesh` function, add a check before the GLB path:

```typescript
export function createFishMesh(species: SpeciesDefinition, speciesId?: SpeciesId): THREE.Group {
  if (speciesId === 'jellyfish') {
    return createJellyfishMesh(species)
  }
  if (speciesId && modelCache.has(speciesId)) {
    return createGLBFishMesh(modelCache.get(speciesId)!, species)
  }
  return createProceduralFishMesh(species)
}
```

- [ ] **Step 3: Add jellyfish animation**

In `animateFishMesh`, add a jellyfish-specific case at the top:

```typescript
export function animateFishMesh(group: THREE.Group, time: number, speed: number, tailFrequency: number): void {
  if (group.userData.isJellyfish) {
    // Bell pulsing
    const bell = group.getObjectByName('bell')
    if (bell) {
      bell.scale.y = 0.9 + Math.sin(time * tailFrequency * Math.PI * 2) * 0.1
    }
    // Tentacle sway
    for (const child of group.children) {
      if (child.name.startsWith('tentacle_')) {
        const idx = parseInt(child.name.split('_')[1])
        for (const seg of child.children) {
          const s = parseInt(seg.name.split('_')[1])
          seg.rotation.x = Math.sin(time * 1.5 + idx * 0.8 + s * 0.5) * 0.15 * (s + 1)
          seg.rotation.z = Math.cos(time * 1.2 + idx * 0.6 + s * 0.3) * 0.1 * (s + 1)
        }
      }
    }
    return
  }

  // ... rest of existing function
```

- [ ] **Step 4: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/fish/mesh.ts
git commit -m "feat: add custom jellyfish procedural mesh with bell pulsing and tentacle sway"
```

---

### Task 5: Add New Decorations

**Files:**
- Modify: `src/decorations/catalog.ts`

- [ ] **Step 1: Expand DecorationId type**

In `src/decorations/catalog.ts`, update the type:

```typescript
export type DecorationId =
  | 'seaweed' | 'coral_fan' | 'anemone'
  | 'boulder' | 'rock_arch' | 'driftwood'
  | 'bubbler' | 'tank_light'
  | 'treasure_chest' | 'diver' | 'sunken_ship'
  | 'brain_coral' | 'kelp' | 'coral_cluster' | 'volcano_bubbler' | 'treasure_map'
```

- [ ] **Step 2: Add decoration factory functions**

Add before the `DECORATIONS` record:

```typescript
function createBrainCoral(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  jitterVertices(geo, 0.04)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0xee8866))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

function createKelp(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x337733)
  const segments = 8
  for (let i = 0; i < segments; i++) {
    const radius = 0.1 - i * 0.008
    const geo = new THREE.CylinderGeometry(radius, radius + 0.015, 0.3, 5)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = i * 0.27
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function createCoralCluster(): THREE.Group {
  const group = new THREE.Group()
  const colors = [0xff6655, 0xffaa44, 0xff88aa]
  const heights = [0.5, 0.35, 0.45, 0.3]
  for (let i = 0; i < heights.length; i++) {
    const geo = new THREE.CylinderGeometry(0.06, 0.08, heights[i], 5)
    const mesh = new THREE.Mesh(geo, lowPolyMaterial(colors[i % colors.length]))
    const angle = (i / heights.length) * Math.PI * 2
    mesh.position.set(Math.cos(angle) * 0.12, heights[i] / 2, Math.sin(angle) * 0.12)
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function createVolcanoBubbler(): THREE.Group {
  const group = new THREE.Group()
  const coneGeo = new THREE.ConeGeometry(0.4, 0.8, 6)
  const cone = new THREE.Mesh(coneGeo, lowPolyMaterial(0x444444))
  cone.position.y = 0.4
  cone.castShadow = true
  group.add(cone)
  // Crater at top
  const craterGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.1, 6)
  const crater = new THREE.Mesh(craterGeo, lowPolyMaterial(0x332211))
  crater.position.y = 0.8
  group.add(crater)
  return group
}

function createTreasureMap(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.PlaneGeometry(0.5, 0.4)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xddcc88,
    side: THREE.DoubleSide,
    roughness: 0.9,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2 + 0.05 // nearly flat on floor
  mesh.position.y = 0.02
  mesh.castShadow = true
  group.add(mesh)
  return group
}
```

- [ ] **Step 3: Add to DECORATIONS record**

Add to the `DECORATIONS` record after `sunken_ship`:

```typescript
  brain_coral:      { name: 'Brain Coral',      category: 'plants',      size: 'medium', createMesh: createBrainCoral },
  kelp:             { name: 'Kelp',             category: 'plants',      size: 'medium', createMesh: createKelp },
  coral_cluster:    { name: 'Coral Cluster',    category: 'rocks',       size: 'medium', createMesh: createCoralCluster },
  volcano_bubbler:  { name: 'Volcano Bubbler',  category: 'accessories', size: 'medium', createMesh: createVolcanoBubbler },
  treasure_map:     { name: 'Treasure Map',     category: 'fun',         size: 'small',  createMesh: createTreasureMap },
```

- [ ] **Step 4: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/decorations/catalog.ts
git commit -m "feat: add brain coral, kelp, coral cluster, volcano bubbler, treasure map"
```

---

### Task 6: Register Decoration Effects

**Files:**
- Modify: `src/decorations/effects.ts`

- [ ] **Step 1: Add effect registrations**

In `src/decorations/effects.ts`, add cases to the `register` method's switch:

```typescript
      case 'brain_coral':
        this.swayingMeshes.push({ mesh, speed: 0.3, amplitude: 0.02 })
        break
      case 'kelp':
        this.swayingMeshes.push({ mesh, speed: 1.5, amplitude: 0.15 })
        break
      case 'volcano_bubbler':
        this.addBubbler(mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)))
        break
```

- [ ] **Step 2: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/decorations/effects.ts
git commit -m "feat: register effects for new decorations"
```

---

### Task 7: Update UI for New Content

**Files:**
- Modify: `src/ui/panels.ts`
- Modify: `src/ui/edit-mode.ts`

- [ ] **Step 1: Add species descriptions**

In `src/ui/panels.ts`, in `showAddFishPanel`, update the `descriptions` record:

```typescript
  const descriptions: Record<SpeciesId, string> = {
    tetra: 'Tiny schooling fish',
    clownfish: 'Territorial, claims decorations',
    angelfish: 'Graceful wanderer',
    pufferfish: 'Shy, hides near rocks',
    barracuda: 'Large predator patrol',
    seahorse: 'Clings to plants',
    pleco: 'Slow bottom-dweller',
    danio: 'Fast schooling fish',
    jellyfish: 'Drifting, translucent',
    guppy: 'Playful surface swimmer',
  }
```

- [ ] **Step 2: Add decoration icons**

In `src/ui/edit-mode.ts`, add to the `ITEM_ICONS` record:

```typescript
  brain_coral: '\u{1F9E0}',
  kelp: '\u{1F33F}',
  coral_cluster: '\u{1FAB8}',
  volcano_bubbler: '\u{1F30B}',
  treasure_map: '\u{1F5FA}',
```

- [ ] **Step 3: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panels.ts src/ui/edit-mode.ts
git commit -m "feat: add UI descriptions and icons for new species and decorations"
```

---

### Task 8: Manual Testing

- [ ] **Step 1: Add each new fish species**

Run: `npx vite dev`

Use the Add Fish panel to add one of each new species. Verify:
- **Pleco:** Stays near the bottom, moves slowly
- **Danio:** Schools with other danios, very fast
- **Jellyfish:** Transparent bell mesh, tentacles sway, drifts slowly in upper tank
- **Guppy:** Stays near the surface, schools loosely

- [ ] **Step 2: Place new decorations**

Enter edit mode. Place each new decoration. Verify:
- **Brain Coral:** Hemisphere shape, subtle pulsing
- **Kelp:** Tall swaying plant
- **Coral Cluster:** Colorful cylinders grouped together
- **Volcano Bubbler:** Cone with bubbles rising from the top
- **Treasure Map:** Flat parchment on the floor

- [ ] **Step 3: Test interactions**

- Verify seahorses cling to kelp (it's a plant)
- Verify barracuda still scares small fish (including new danios and guppies)
- Verify jellyfish doesn't react to mouse or threats

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: new species and decorations polish after manual testing"
```
