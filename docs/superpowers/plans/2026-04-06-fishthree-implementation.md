# FishThree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based 3D fish tank viewer and decoration editor using vanilla Three.js and TypeScript.

**Architecture:** Vanilla Three.js with HTML/CSS UI overlay. Fish entities use a simple state machine for ecosystem behaviors (schooling, territorial, fleeing). Decorations placed in predefined slot zones. All state persisted to localStorage.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-fishthree-design.md`

**Constants used throughout (tank dimensions):**
- Tank width: 16, height: 9, depth: 8
- Tank center: (0, 0, 0)
- Bounds: x [-8, 8], y [-4.5, 4.5], z [-4, 4]
- Camera at (0, 0.5, 14), FOV 45

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/maximo/workspace/fishthree
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install three
npm install -D typescript vite vitest @types/three
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FishThree</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #app { width: 100%; height: 100%; position: relative; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 7: Create src/main.ts with a minimal Three.js scene**

```typescript
import * as THREE from 'three'

const app = document.getElementById('app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a3d6b)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0.5, 14)

// Placeholder cube to verify rendering
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function animate() {
  requestAnimationFrame(animate)
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}

animate()
```

- [ ] **Step 8: Add scripts to package.json**

Add to the `"scripts"` section:
```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 9: Verify it works**

Run: `npm run dev`
Expected: Vite dev server starts. Opening the URL in a browser shows a spinning green cube on a dark blue background.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/main.ts
git commit -m "feat: project scaffolding with Three.js + Vite + TypeScript"
```

---

### Task 2: Tank Geometry

**Files:**
- Create: `src/scene/tank.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/scene/tank.ts**

```typescript
import * as THREE from 'three'

export const TANK = {
  width: 16,
  height: 9,
  depth: 8,
} as const

export interface TankMeshes {
  backWall: THREE.Mesh
  leftWall: THREE.Mesh
  rightWall: THREE.Mesh
  floor: THREE.Mesh
  waterSurface: THREE.Mesh
}

export function createTank(scene: THREE.Scene): TankMeshes {
  // Back wall — deep blue gradient via vertex colors
  const backGeo = new THREE.PlaneGeometry(TANK.width, TANK.height, 1, 10)
  const backColors: number[] = []
  const backPos = backGeo.attributes.position
  for (let i = 0; i < backPos.count; i++) {
    const y = backPos.getY(i)
    const t = (y + TANK.height / 2) / TANK.height // 0 at bottom, 1 at top
    const r = THREE.MathUtils.lerp(0.02, 0.06, t)
    const g = THREE.MathUtils.lerp(0.15, 0.30, t)
    const b = THREE.MathUtils.lerp(0.35, 0.55, t)
    backColors.push(r, g, b)
  }
  backGeo.setAttribute('color', new THREE.Float32BufferAttribute(backColors, 3))
  const backMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide })
  const backWall = new THREE.Mesh(backGeo, backMat)
  backWall.position.set(0, 0, -TANK.depth / 2)
  backWall.receiveShadow = true
  scene.add(backWall)

  // Side walls — semi-transparent glass
  const sideGeo = new THREE.PlaneGeometry(TANK.depth, TANK.height)
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  })

  const leftWall = new THREE.Mesh(sideGeo, sideMat)
  leftWall.position.set(-TANK.width / 2, 0, 0)
  leftWall.rotation.y = Math.PI / 2
  scene.add(leftWall)

  const rightWall = new THREE.Mesh(sideGeo, sideMat.clone())
  rightWall.position.set(TANK.width / 2, 0, 0)
  rightWall.rotation.y = -Math.PI / 2
  scene.add(rightWall)

  // Floor — sandy color
  const floorGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -TANK.height / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Water surface — animated in render loop via effects
  const waterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth, 32, 32)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  })
  const waterSurface = new THREE.Mesh(waterGeo, waterMat)
  waterSurface.rotation.x = -Math.PI / 2
  waterSurface.position.y = TANK.height / 2
  scene.add(waterSurface)

  return { backWall, leftWall, rightWall, floor, waterSurface }
}

export function updateWaterSurface(water: THREE.Mesh, time: number): void {
  const pos = water.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, Math.sin(x * 0.5 + time * 1.5) * 0.05 + Math.cos(z * 0.7 + time * 1.2) * 0.03)
  }
  pos.needsUpdate = true
}
```

- [ ] **Step 2: Update src/main.ts to use the tank**

Replace the entire contents of `src/main.ts`:

```typescript
import * as THREE from 'three'
import { createTank, updateWaterSurface } from './scene/tank'

const app = document.getElementById('app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a3d6b)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0.5, 14)

// Temporary light so we can see the tank
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const tank = createTank(scene)

const clock = new THREE.Clock()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function animate() {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  updateWaterSurface(tank.waterSurface, elapsed)
  renderer.render(scene, camera)
}

animate()
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: A rectangular tank visible from the front. Dark blue gradient back wall, sandy floor, faint glass side walls, and a subtle rippling water surface on top.

- [ ] **Step 4: Commit**

```bash
git add src/scene/tank.ts src/main.ts
git commit -m "feat: tank geometry with back wall, sides, floor, and water surface"
```

---

### Task 3: Camera with Parallax

**Files:**
- Create: `src/scene/camera.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/scene/camera.ts**

```typescript
import * as THREE from 'three'

const BASE_POSITION = new THREE.Vector3(0, 0.5, 14)
const PARALLAX_STRENGTH = 0.3 // max offset in world units
const PARALLAX_SMOOTHING = 0.05 // lerp factor per frame

// Normalized mouse position: (-1, -1) bottom-left to (1, 1) top-right
const mouse = { x: 0, y: 0 }
const smoothMouse = { x: 0, y: 0 }

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100)
  camera.position.copy(BASE_POSITION)

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  })

  return camera
}

export function updateParallax(camera: THREE.PerspectiveCamera): void {
  smoothMouse.x += (mouse.x - smoothMouse.x) * PARALLAX_SMOOTHING
  smoothMouse.y += (mouse.y - smoothMouse.y) * PARALLAX_SMOOTHING

  camera.position.x = BASE_POSITION.x + smoothMouse.x * PARALLAX_STRENGTH
  camera.position.y = BASE_POSITION.y + smoothMouse.y * PARALLAX_STRENGTH * 0.5
  camera.lookAt(0, 0, 0)
}
```

- [ ] **Step 2: Update src/main.ts to use camera module**

Replace the camera creation line and add parallax update:

Replace:
```typescript
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0.5, 14)
```

With:
```typescript
import { createCamera, updateParallax } from './scene/camera'
// ... (keep other imports)

const camera = createCamera(window.innerWidth / window.innerHeight)
```

In the `animate()` function, add before `renderer.render()`:
```typescript
  updateParallax(camera)
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: Moving the mouse across the screen causes the tank view to shift subtly, creating a parallax depth effect. Movement is smoothed, not jerky.

- [ ] **Step 4: Commit**

```bash
git add src/scene/camera.ts src/main.ts
git commit -m "feat: camera with smooth mouse-driven parallax"
```

---

### Task 4: Lighting System

**Files:**
- Create: `src/scene/lighting.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/scene/lighting.ts**

```typescript
import * as THREE from 'three'
import { TANK } from './tank'

export interface Lights {
  ambient: THREE.AmbientLight
  overhead: THREE.DirectionalLight
  causticLight: THREE.SpotLight
}

export function createLighting(scene: THREE.Scene): Lights {
  // Ambient — soft base light
  const ambient = new THREE.AmbientLight(0x446688, 0.6)
  scene.add(ambient)

  // Overhead directional — simulates tank lamp
  const overhead = new THREE.DirectionalLight(0xffffff, 1.2)
  overhead.position.set(0, TANK.height, 2)
  overhead.target.position.set(0, -TANK.height / 2, 0)
  overhead.castShadow = true
  overhead.shadow.mapSize.width = 1024
  overhead.shadow.mapSize.height = 1024
  overhead.shadow.camera.left = -TANK.width / 2
  overhead.shadow.camera.right = TANK.width / 2
  overhead.shadow.camera.top = TANK.depth / 2
  overhead.shadow.camera.bottom = -TANK.depth / 2
  overhead.shadow.camera.near = 1
  overhead.shadow.camera.far = TANK.height * 3
  scene.add(overhead)
  scene.add(overhead.target)

  // Caustic spotlight — projects a moving pattern onto the floor
  const causticLight = new THREE.SpotLight(0x66ccff, 0.8, 20, Math.PI / 4, 0.5)
  causticLight.position.set(0, TANK.height / 2 + 1, 0)
  causticLight.target.position.set(0, -TANK.height / 2, 0)
  scene.add(causticLight)
  scene.add(causticLight.target)

  return { ambient, overhead, causticLight }
}

export function updateCaustics(lights: Lights, time: number): void {
  // Animate the caustic spotlight position to simulate moving water refraction
  lights.causticLight.position.x = Math.sin(time * 0.4) * 2
  lights.causticLight.position.z = Math.cos(time * 0.3) * 1.5
}
```

- [ ] **Step 2: Update src/main.ts**

Remove the temporary ambient light and use the lighting module:

Replace:
```typescript
// Temporary light so we can see the tank
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)
```

With:
```typescript
import { createLighting, updateCaustics } from './scene/lighting'

const lights = createLighting(scene)
```

In `animate()`, add:
```typescript
  updateCaustics(lights, elapsed)
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: Tank is lit from above with soft shadows on the floor. A subtle blue-tinted light moves slowly across the floor, simulating caustic patterns. The overall mood is an underwater aquarium.

- [ ] **Step 4: Commit**

```bash
git add src/scene/lighting.ts src/main.ts
git commit -m "feat: lighting system with ambient, overhead, and caustics"
```

---

### Task 5: Low-Poly Geometry Helpers

**Files:**
- Create: `src/utils/geometry.ts`
- Create: `src/utils/geometry.test.ts`

- [ ] **Step 1: Write tests for geometry helpers**

```typescript
// src/utils/geometry.test.ts
import { describe, it, expect } from 'vitest'
import { jitterVertices, mergeIntoGroup } from './geometry'
import * as THREE from 'three'

describe('jitterVertices', () => {
  it('displaces vertices within the given amount', () => {
    const geo = new THREE.IcosahedronGeometry(1, 0)
    const originalPositions = Float32Array.from(geo.attributes.position.array)
    jitterVertices(geo, 0.1)
    const newPositions = geo.attributes.position.array

    let anyDifferent = false
    for (let i = 0; i < originalPositions.length; i++) {
      const diff = Math.abs(newPositions[i] - originalPositions[i])
      expect(diff).toBeLessThanOrEqual(0.1)
      if (diff > 0) anyDifferent = true
    }
    expect(anyDifferent).toBe(true)
  })
})

describe('mergeIntoGroup', () => {
  it('creates a group with the given meshes as children', () => {
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.5))
    const group = mergeIntoGroup([m1, m2])
    expect(group).toBeInstanceOf(THREE.Group)
    expect(group.children).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/geometry.test.ts`
Expected: FAIL — `jitterVertices` and `mergeIntoGroup` not found

- [ ] **Step 3: Create src/utils/geometry.ts**

```typescript
import * as THREE from 'three'

/**
 * Displaces every vertex in a geometry by a random amount up to `amount`.
 * Gives low-poly meshes an organic, hand-crafted feel.
 */
export function jitterVertices(geometry: THREE.BufferGeometry, amount: number): void {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 2 * amount)
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 2 * amount)
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 2 * amount)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

/**
 * Wraps an array of meshes into a THREE.Group for easy manipulation.
 */
export function mergeIntoGroup(meshes: THREE.Mesh[]): THREE.Group {
  const group = new THREE.Group()
  for (const mesh of meshes) {
    group.add(mesh)
  }
  return group
}

/**
 * Creates a low-poly material with a flat-shaded look.
 */
export function lowPolyMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.8,
    metalness: 0.1,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/geometry.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/geometry.ts src/utils/geometry.test.ts
git commit -m "feat: low-poly geometry helper utilities"
```

---

### Task 6: Fish Species Definitions

**Files:**
- Create: `src/fish/species.ts`
- Create: `src/fish/species.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/fish/species.test.ts
import { describe, it, expect } from 'vitest'
import { SPECIES, type SpeciesId } from './species'

describe('SPECIES', () => {
  const speciesIds: SpeciesId[] = ['tetra', 'clownfish', 'angelfish', 'pufferfish', 'barracuda', 'seahorse']

  it('defines all 6 species', () => {
    expect(Object.keys(SPECIES)).toHaveLength(6)
    for (const id of speciesIds) {
      expect(SPECIES[id]).toBeDefined()
    }
  })

  it('each species has required fields', () => {
    for (const id of speciesIds) {
      const s = SPECIES[id]
      expect(s.name).toBeTruthy()
      expect(s.size).toBeGreaterThan(0)
      expect(s.speed).toBeGreaterThan(0)
      expect(s.tailFrequency).toBeGreaterThan(0)
      expect(s.behaviorType).toBeTruthy()
      expect(s.color).toBeGreaterThanOrEqual(0)
      expect(s.personality).toBeTruthy()
    }
  })

  it('barracuda is the largest, tetra is the smallest', () => {
    expect(SPECIES.barracuda.size).toBeGreaterThan(SPECIES.tetra.size)
    expect(SPECIES.tetra.size).toBeLessThanOrEqual(SPECIES.clownfish.size)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fish/species.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/fish/species.ts**

```typescript
export type BehaviorType = 'schooling' | 'territorial' | 'wanderer' | 'shy' | 'predator' | 'anchorer'
export type Personality = 'skittish' | 'curious' | 'neutral'

export interface SpeciesDefinition {
  name: string
  size: number        // radius of bounding sphere
  speed: number       // base movement speed (units/sec)
  tailFrequency: number // tail wag cycles per second
  behaviorType: BehaviorType
  personality: Personality
  color: number       // hex color
  bodyWidth: number   // x scale factor
  bodyHeight: number  // y scale factor
  bodyLength: number  // z scale factor
}

export type SpeciesId = 'tetra' | 'clownfish' | 'angelfish' | 'pufferfish' | 'barracuda' | 'seahorse'

export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
  tetra: {
    name: 'Tetra',
    size: 0.15,
    speed: 2.5,
    tailFrequency: 8,
    behaviorType: 'schooling',
    personality: 'skittish',
    color: 0x00ccff,
    bodyWidth: 0.12,
    bodyHeight: 0.15,
    bodyLength: 0.3,
  },
  clownfish: {
    name: 'Clownfish',
    size: 0.25,
    speed: 1.8,
    tailFrequency: 6,
    behaviorType: 'territorial',
    personality: 'curious',
    color: 0xff6622,
    bodyWidth: 0.2,
    bodyHeight: 0.25,
    bodyLength: 0.35,
  },
  angelfish: {
    name: 'Angelfish',
    size: 0.4,
    speed: 1.2,
    tailFrequency: 3,
    behaviorType: 'wanderer',
    personality: 'neutral',
    color: 0xffee44,
    bodyWidth: 0.1,
    bodyHeight: 0.5,
    bodyLength: 0.4,
  },
  pufferfish: {
    name: 'Pufferfish',
    size: 0.35,
    speed: 1.0,
    tailFrequency: 4,
    behaviorType: 'shy',
    personality: 'skittish',
    color: 0xaacc44,
    bodyWidth: 0.35,
    bodyHeight: 0.35,
    bodyLength: 0.35,
  },
  barracuda: {
    name: 'Barracuda',
    size: 0.6,
    speed: 2.0,
    tailFrequency: 5,
    behaviorType: 'predator',
    personality: 'neutral',
    color: 0x778899,
    bodyWidth: 0.15,
    bodyHeight: 0.2,
    bodyLength: 0.9,
  },
  seahorse: {
    name: 'Seahorse',
    size: 0.25,
    speed: 0.6,
    tailFrequency: 2,
    behaviorType: 'anchorer',
    personality: 'curious',
    color: 0xff88cc,
    bodyWidth: 0.1,
    bodyHeight: 0.35,
    bodyLength: 0.12,
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/fish/species.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fish/species.ts src/fish/species.test.ts
git commit -m "feat: fish species definitions for all 6 types"
```

---

### Task 7: Fish Mesh Builder

**Files:**
- Create: `src/fish/mesh.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/fish/mesh.ts**

Builds a low-poly fish mesh from primitives based on species proportions.

```typescript
import * as THREE from 'three'
import { type SpeciesDefinition } from './species'
import { lowPolyMaterial, jitterVertices } from '../utils/geometry'

export function createFishMesh(species: SpeciesDefinition): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(species.color)

  // Body — elongated icosahedron
  const bodyGeo = new THREE.IcosahedronGeometry(1, 1)
  bodyGeo.scale(species.bodyWidth, species.bodyHeight, species.bodyLength)
  jitterVertices(bodyGeo, 0.02)
  const body = new THREE.Mesh(bodyGeo, mat)
  body.castShadow = true
  body.name = 'body'
  group.add(body)

  // Tail fin — cone pointing backward
  const tailGeo = new THREE.ConeGeometry(species.bodyHeight * 0.8, species.bodyLength * 0.6, 4)
  tailGeo.rotateX(Math.PI / 2)
  const tail = new THREE.Mesh(tailGeo, mat)
  tail.position.z = species.bodyLength * 0.8
  tail.name = 'tail'
  group.add(tail)

  // Dorsal fin — small triangle on top
  const dorsalGeo = new THREE.ConeGeometry(species.bodyHeight * 0.3, species.bodyHeight * 0.5, 3)
  const dorsal = new THREE.Mesh(dorsalGeo, mat)
  dorsal.position.y = species.bodyHeight * 0.7
  dorsal.position.z = -species.bodyLength * 0.1
  dorsal.name = 'dorsal'
  group.add(dorsal)

  // Pectoral fins — two small triangles on sides
  const pectoralGeo = new THREE.ConeGeometry(species.bodyWidth * 0.4, species.bodyHeight * 0.4, 3)
  pectoralGeo.rotateZ(Math.PI / 2)

  const leftFin = new THREE.Mesh(pectoralGeo, mat)
  leftFin.position.set(-species.bodyWidth * 0.8, -species.bodyHeight * 0.1, 0)
  leftFin.name = 'leftFin'
  group.add(leftFin)

  const rightFin = new THREE.Mesh(pectoralGeo.clone(), mat)
  rightFin.position.set(species.bodyWidth * 0.8, -species.bodyHeight * 0.1, 0)
  rightFin.rotation.z = Math.PI
  rightFin.name = 'rightFin'
  group.add(rightFin)

  // Eye — two small white spheres with black pupils
  const eyeGeo = new THREE.SphereGeometry(species.size * 0.15, 6, 6)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
  const pupilGeo = new THREE.SphereGeometry(species.size * 0.08, 6, 6)
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 })

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(species.bodyWidth * 0.6 * side, species.bodyHeight * 0.25, -species.bodyLength * 0.5)
    group.add(eye)

    const pupil = new THREE.Mesh(pupilGeo, pupilMat)
    pupil.position.set(species.bodyWidth * 0.75 * side, species.bodyHeight * 0.25, -species.bodyLength * 0.55)
    group.add(pupil)
  }

  return group
}

/**
 * Animates the fish tail and body wiggle. Call every frame.
 */
export function animateFishMesh(group: THREE.Group, time: number, speed: number, tailFrequency: number): void {
  const tail = group.getObjectByName('tail')
  if (tail) {
    tail.rotation.y = Math.sin(time * tailFrequency * Math.PI * 2) * 0.3 * speed
  }

  // Body wiggle — slight lateral sway
  const body = group.getObjectByName('body')
  if (body) {
    body.rotation.y = Math.sin(time * tailFrequency * Math.PI * 2 + 0.5) * 0.05 * speed
  }
}
```

- [ ] **Step 2: Add a test fish to main.ts to verify visually**

Add to `src/main.ts` after tank creation:

```typescript
import { SPECIES } from './fish/species'
import { createFishMesh, animateFishMesh } from './fish/mesh'

// Test fish — remove later
const testFish = createFishMesh(SPECIES.clownfish)
testFish.position.set(0, 0, 0)
scene.add(testFish)
```

In `animate()`, add:
```typescript
  animateFishMesh(testFish, elapsed, 1.0, SPECIES.clownfish.tailFrequency)
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: An orange low-poly clownfish in the center of the tank, tail wagging and body gently swaying.

- [ ] **Step 4: Commit**

```bash
git add src/fish/mesh.ts src/main.ts
git commit -m "feat: low-poly fish mesh builder with tail and body animation"
```

---

### Task 8: Fish Entity and State Machine

**Files:**
- Create: `src/fish/fish.ts`
- Create: `src/fish/fish.test.ts`

- [ ] **Step 1: Write tests for the state machine**

```typescript
// src/fish/fish.test.ts
import { describe, it, expect } from 'vitest'
import { FishStateMachine, type FishState } from './fish'

describe('FishStateMachine', () => {
  it('starts in idle state', () => {
    const sm = new FishStateMachine('wanderer')
    expect(sm.current).toBe('idle')
  })

  it('transitions from idle to wander after timer', () => {
    const sm = new FishStateMachine('wanderer')
    sm.update(2.0, { threats: [], shelters: [], school: [], mouse: null, homeDecor: null })
    expect(sm.current).toBe('wander')
  })

  it('transitions to flee when threat is near', () => {
    const sm = new FishStateMachine('wanderer')
    sm.current = 'wander' as FishState
    sm.update(0.1, {
      threats: [{ distance: 1.5 }],
      shelters: [],
      school: [],
      mouse: null,
      homeDecor: null,
    })
    expect(sm.current).toBe('flee')
  })

  it('schooling type enters school state with neighbors', () => {
    const sm = new FishStateMachine('schooling')
    sm.current = 'idle' as FishState
    sm.update(0.1, {
      threats: [],
      shelters: [],
      school: [{ distance: 1.0 }, { distance: 2.0 }],
      mouse: null,
      homeDecor: null,
    })
    expect(sm.current).toBe('school')
  })

  it('shy type enters hide when threatened', () => {
    const sm = new FishStateMachine('shy')
    sm.current = 'wander' as FishState
    sm.update(0.1, {
      threats: [{ distance: 2.0 }],
      shelters: [{ distance: 1.0 }],
      school: [],
      mouse: null,
      homeDecor: null,
    })
    expect(sm.current).toBe('hide')
  })

  it('reacts to mouse when close', () => {
    const sm = new FishStateMachine('wanderer')
    sm.current = 'wander' as FishState
    sm.update(0.1, {
      threats: [],
      shelters: [],
      school: [],
      mouse: { distance: 1.0 },
      homeDecor: null,
    })
    expect(sm.current).toBe('react')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fish/fish.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/fish/fish.ts**

```typescript
import * as THREE from 'three'
import { type SpeciesId, type SpeciesDefinition, type BehaviorType, SPECIES } from './species'
import { createFishMesh, animateFishMesh } from './mesh'
import { TANK } from '../scene/tank'

export type FishState = 'idle' | 'wander' | 'school' | 'flee' | 'hide' | 'territorial' | 'react'

const FLEE_THRESHOLD = 3.0
const REACT_THRESHOLD = 2.0
const IDLE_DURATION = 1.0

interface ProximityInfo {
  distance: number
}

export interface StateContext {
  threats: ProximityInfo[]
  shelters: ProximityInfo[]
  school: ProximityInfo[]
  mouse: ProximityInfo | null
  homeDecor: ProximityInfo | null
}

export class FishStateMachine {
  current: FishState = 'idle'
  private idleTimer = 0
  private behaviorType: BehaviorType

  constructor(behaviorType: BehaviorType) {
    this.behaviorType = behaviorType
  }

  update(dt: number, ctx: StateContext): void {
    const hasNearThreat = ctx.threats.some(t => t.distance < FLEE_THRESHOLD)
    const hasNearShelter = ctx.shelters.some(s => s.distance < FLEE_THRESHOLD)
    const hasMouseNear = ctx.mouse !== null && ctx.mouse.distance < REACT_THRESHOLD
    const hasSchoolmates = ctx.school.length >= 1

    // Flee / hide takes priority
    if (hasNearThreat) {
      if (this.behaviorType === 'shy' && hasNearShelter) {
        this.current = 'hide'
        return
      }
      if (this.behaviorType !== 'predator') {
        this.current = 'flee'
        return
      }
    }

    // Mouse reaction
    if (hasMouseNear && this.current !== 'flee' && this.current !== 'hide') {
      this.current = 'react'
      return
    }

    // Behavior-specific states
    switch (this.behaviorType) {
      case 'schooling':
        if (hasSchoolmates) {
          this.current = 'school'
          return
        }
        break
      case 'territorial':
        if (ctx.homeDecor !== null) {
          this.current = 'territorial'
          return
        }
        break
      case 'anchorer':
        if (ctx.homeDecor !== null) {
          this.current = 'territorial' // anchorer reuses territorial for "stay near plant"
          return
        }
        break
    }

    // Default: idle -> wander cycle
    if (this.current === 'idle') {
      this.idleTimer += dt
      if (this.idleTimer > IDLE_DURATION) {
        this.idleTimer = 0
        this.current = 'wander'
      }
    } else if (this.current !== 'wander') {
      // Return to wander if no special state applies
      this.current = 'wander'
    }
  }
}

export class Fish {
  mesh: THREE.Group
  species: SpeciesDefinition
  speciesId: SpeciesId
  name: string
  stateMachine: FishStateMachine
  velocity: THREE.Vector3
  targetVelocity: THREE.Vector3

  private time = Math.random() * 100 // offset so fish don't sync

  constructor(speciesId: SpeciesId, name: string) {
    this.speciesId = speciesId
    this.species = SPECIES[speciesId]
    this.name = name
    this.mesh = createFishMesh(this.species)
    this.stateMachine = new FishStateMachine(this.species.behaviorType)
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * this.species.speed,
      (Math.random() - 0.5) * this.species.speed * 0.3,
      (Math.random() - 0.5) * this.species.speed * 0.3,
    )
    this.targetVelocity = this.velocity.clone()

    // Random starting position within tank bounds
    const margin = this.species.size * 2
    this.mesh.position.set(
      THREE.MathUtils.randFloat(-TANK.width / 2 + margin, TANK.width / 2 - margin),
      THREE.MathUtils.randFloat(-TANK.height / 2 + margin, TANK.height / 2 - margin),
      THREE.MathUtils.randFloat(-TANK.depth / 2 + margin, TANK.depth / 2 - margin),
    )
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  update(dt: number): void {
    this.time += dt

    // Smoothly blend velocity toward target
    this.velocity.lerp(this.targetVelocity, 0.02)

    // Move
    this.mesh.position.addScaledVector(this.velocity, dt)

    // Keep within tank bounds
    this.clampToTank()

    // Face movement direction
    if (this.velocity.lengthSq() > 0.001) {
      const lookTarget = this.mesh.position.clone().add(this.velocity)
      this.mesh.lookAt(lookTarget)
    }

    // Animate mesh
    const speedFactor = this.velocity.length() / this.species.speed
    animateFishMesh(this.mesh, this.time, speedFactor, this.species.tailFrequency)
  }

  private clampToTank(): void {
    const m = this.species.size
    const pos = this.mesh.position
    const hw = TANK.width / 2 - m
    const hh = TANK.height / 2 - m
    const hd = TANK.depth / 2 - m

    if (pos.x < -hw) { pos.x = -hw; this.velocity.x *= -1; this.targetVelocity.x *= -1 }
    if (pos.x > hw) { pos.x = hw; this.velocity.x *= -1; this.targetVelocity.x *= -1 }
    if (pos.y < -hh) { pos.y = -hh; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
    if (pos.y > hh) { pos.y = hh; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
    if (pos.z < -hd) { pos.z = -hd; this.velocity.z *= -1; this.targetVelocity.z *= -1 }
    if (pos.z > hd) { pos.z = hd; this.velocity.z *= -1; this.targetVelocity.z *= -1 }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/fish/fish.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fish/fish.ts src/fish/fish.test.ts
git commit -m "feat: fish entity class with state machine"
```

---

### Task 9: Boids Algorithm

**Files:**
- Create: `src/fish/boids.ts`
- Create: `src/fish/boids.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/fish/boids.test.ts
import { describe, it, expect } from 'vitest'
import { computeBoids, type BoidAgent, BOIDS_DEFAULTS } from './boids'
import * as THREE from 'three'

function makeBoid(x: number, y: number, z: number, vx = 0, vy = 0, vz = 0): BoidAgent {
  return {
    position: new THREE.Vector3(x, y, z),
    velocity: new THREE.Vector3(vx, vy, vz),
  }
}

describe('computeBoids', () => {
  it('returns zero vector for a lone boid', () => {
    const self = makeBoid(0, 0, 0, 1, 0, 0)
    const result = computeBoids(self, [], BOIDS_DEFAULTS)
    expect(result.length()).toBe(0)
  })

  it('separation pushes boids apart when too close', () => {
    const self = makeBoid(0, 0, 0, 1, 0, 0)
    const neighbor = makeBoid(0.3, 0, 0, 1, 0, 0)
    const result = computeBoids(self, [neighbor], BOIDS_DEFAULTS)
    // Should push self in -x direction (away from neighbor)
    expect(result.x).toBeLessThan(0)
  })

  it('cohesion pulls boid toward center of flock', () => {
    const self = makeBoid(0, 0, 0, 0, 0, 0)
    const neighbors = [
      makeBoid(3, 0, 0, 0, 0, 0),
      makeBoid(3, 1, 0, 0, 0, 0),
    ]
    const result = computeBoids(self, neighbors, { ...BOIDS_DEFAULTS, separationRadius: 0.1 })
    // Should pull self in +x direction
    expect(result.x).toBeGreaterThan(0)
  })

  it('alignment steers toward average velocity', () => {
    const self = makeBoid(0, 0, 0, 0, 0, 0)
    const neighbors = [
      makeBoid(1, 0, 0, 0, 2, 0),
      makeBoid(-1, 0, 0, 0, 2, 0),
    ]
    const result = computeBoids(self, neighbors, BOIDS_DEFAULTS)
    // Should steer in +y direction (neighbors moving up)
    expect(result.y).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fish/boids.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/fish/boids.ts**

```typescript
import * as THREE from 'three'

export interface BoidAgent {
  position: THREE.Vector3
  velocity: THREE.Vector3
}

export interface BoidsParams {
  separationRadius: number
  separationWeight: number
  alignmentWeight: number
  cohesionWeight: number
  neighborRadius: number
}

export const BOIDS_DEFAULTS: BoidsParams = {
  separationRadius: 0.8,
  separationWeight: 2.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  neighborRadius: 3.0,
}

const _separation = new THREE.Vector3()
const _alignment = new THREE.Vector3()
const _cohesion = new THREE.Vector3()
const _diff = new THREE.Vector3()

export function computeBoids(self: BoidAgent, neighbors: BoidAgent[], params: BoidsParams): THREE.Vector3 {
  const result = new THREE.Vector3()
  if (neighbors.length === 0) return result

  _separation.set(0, 0, 0)
  _alignment.set(0, 0, 0)
  _cohesion.set(0, 0, 0)

  let separationCount = 0
  let neighborCount = 0

  for (const other of neighbors) {
    const dist = self.position.distanceTo(other.position)
    if (dist > params.neighborRadius || dist < 0.001) continue

    neighborCount++

    // Cohesion: average position of neighbors
    _cohesion.add(other.position)

    // Alignment: average velocity of neighbors
    _alignment.add(other.velocity)

    // Separation: steer away from very close neighbors
    if (dist < params.separationRadius) {
      _diff.subVectors(self.position, other.position)
      _diff.divideScalar(dist * dist) // stronger when closer
      _separation.add(_diff)
      separationCount++
    }
  }

  if (neighborCount === 0) return result

  // Cohesion: steer toward center of mass
  _cohesion.divideScalar(neighborCount)
  _cohesion.sub(self.position)
  _cohesion.multiplyScalar(params.cohesionWeight)
  result.add(_cohesion)

  // Alignment: steer toward average heading
  _alignment.divideScalar(neighborCount)
  _alignment.sub(self.velocity)
  _alignment.multiplyScalar(params.alignmentWeight)
  result.add(_alignment)

  // Separation
  if (separationCount > 0) {
    _separation.divideScalar(separationCount)
    _separation.multiplyScalar(params.separationWeight)
    result.add(_separation)
  }

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/fish/boids.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fish/boids.ts src/fish/boids.test.ts
git commit -m "feat: boids algorithm for fish schooling behavior"
```

---

### Task 10: Fish Behaviors

**Files:**
- Create: `src/fish/behaviors.ts`
- Modify: `src/fish/fish.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/fish/behaviors.ts**

```typescript
import * as THREE from 'three'
import { type Fish } from './fish'
import { computeBoids, BOIDS_DEFAULTS } from './boids'
import { TANK } from '../scene/tank'

const _dir = new THREE.Vector3()
const _toHome = new THREE.Vector3()

/** Wander: pick a random direction periodically */
export function updateWander(fish: Fish, dt: number): void {
  // Occasionally pick a new random target velocity
  if (Math.random() < dt * 0.5) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 2,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
    )
  }
}

/** School: apply boids forces from same-species neighbors */
export function updateSchool(fish: Fish, school: Fish[], _dt: number): void {
  const agents = school.map(f => ({ position: f.position, velocity: f.velocity }))
  const self = { position: fish.position, velocity: fish.velocity }
  const force = computeBoids(self, agents, BOIDS_DEFAULTS)
  fish.targetVelocity.add(force).clampLength(0, fish.species.speed)
}

/** Flee: move directly away from the nearest threat */
export function updateFlee(fish: Fish, threats: THREE.Vector3[], _dt: number): void {
  if (threats.length === 0) return
  let nearest = threats[0]
  let minDist = fish.position.distanceTo(threats[0])
  for (let i = 1; i < threats.length; i++) {
    const d = fish.position.distanceTo(threats[i])
    if (d < minDist) { minDist = d; nearest = threats[i] }
  }
  _dir.subVectors(fish.position, nearest).normalize().multiplyScalar(fish.species.speed * 1.5)
  fish.targetVelocity.copy(_dir)
}

/** Hide: move toward the nearest shelter */
export function updateHide(fish: Fish, shelters: THREE.Vector3[], _dt: number): void {
  if (shelters.length === 0) { updateWander(fish, _dt); return }
  let nearest = shelters[0]
  let minDist = fish.position.distanceTo(shelters[0])
  for (let i = 1; i < shelters.length; i++) {
    const d = fish.position.distanceTo(shelters[i])
    if (d < minDist) { minDist = d; nearest = shelters[i] }
  }
  _dir.subVectors(nearest, fish.position).normalize().multiplyScalar(fish.species.speed * 0.8)
  fish.targetVelocity.copy(_dir)
  // Slow down when close to shelter
  if (minDist < 0.5) {
    fish.targetVelocity.multiplyScalar(0.2)
  }
}

/** Territorial: orbit around a home decoration, chase intruders */
export function updateTerritorial(fish: Fish, homePos: THREE.Vector3, intruders: Fish[], _dt: number): void {
  const orbitRadius = 1.2
  _toHome.subVectors(homePos, fish.position)
  const dist = _toHome.length()

  // If an intruder is closer to home than us, chase them
  for (const intruder of intruders) {
    const intruderDist = intruder.position.distanceTo(homePos)
    if (intruderDist < orbitRadius * 1.5 && intruder.speciesId !== fish.speciesId) {
      _dir.subVectors(intruder.position, fish.position).normalize().multiplyScalar(fish.species.speed * 1.3)
      fish.targetVelocity.copy(_dir)
      return
    }
  }

  // Otherwise orbit: move perpendicular to the vector toward home
  if (dist > orbitRadius * 1.5) {
    // Too far — head back
    _dir.copy(_toHome).normalize().multiplyScalar(fish.species.speed * 0.8)
  } else if (dist < orbitRadius * 0.5) {
    // Too close — push out
    _dir.copy(_toHome).normalize().multiplyScalar(-fish.species.speed * 0.4)
  } else {
    // Orbit: cross product to get perpendicular
    _dir.crossVectors(_toHome, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(fish.species.speed * 0.6)
  }
  fish.targetVelocity.copy(_dir)
}

/** Predator patrol: slow laps around the tank perimeter */
export function updatePredatorPatrol(fish: Fish, dt: number): void {
  // Follow a wide elliptical path
  if (Math.random() < dt * 0.2) {
    const hw = TANK.width / 2 - 2
    const hd = TANK.depth / 2 - 1
    const angle = Math.atan2(fish.position.z, fish.position.x) + 0.3
    const tx = Math.cos(angle) * hw
    const tz = Math.sin(angle) * hd
    _dir.set(tx - fish.position.x, (Math.random() - 0.5) * 0.5, tz - fish.position.z)
    _dir.normalize().multiplyScalar(fish.species.speed * 0.7)
    fish.targetVelocity.copy(_dir)
  }
}

/** React to mouse: skittish fish flee, curious fish approach */
export function updateReact(fish: Fish, mouseWorldPos: THREE.Vector3, _dt: number): void {
  _dir.subVectors(mouseWorldPos, fish.position)
  if (fish.species.personality === 'skittish') {
    _dir.negate()
  }
  _dir.normalize().multiplyScalar(fish.species.speed * 0.8)
  fish.targetVelocity.copy(_dir)
}
```

- [ ] **Step 2: Update src/main.ts — create a FishManager and wire it in**

Replace the test fish code and add a proper fish manager loop:

Replace the full contents of `src/main.ts`:

```typescript
import * as THREE from 'three'
import { createTank, updateWaterSurface } from './scene/tank'
import { createCamera, updateParallax } from './scene/camera'
import { createLighting, updateCaustics } from './scene/lighting'
import { Fish, type StateContext } from './fish/fish'
import { type SpeciesId, SPECIES } from './fish/species'
import {
  updateWander, updateSchool, updateFlee, updateHide,
  updateTerritorial, updatePredatorPatrol, updateReact,
} from './fish/behaviors'

const app = document.getElementById('app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a3d6b)

const camera = createCamera(window.innerWidth / window.innerHeight)
const tank = createTank(scene)
const lights = createLighting(scene)

// Mouse world position (projected onto z=0 plane)
const raycaster = new THREE.Raycaster()
const mouseNDC = new THREE.Vector2(999, 999) // offscreen initially
const mouseWorld = new THREE.Vector3()
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

window.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
})

// Spawn initial fish
const fishes: Fish[] = []

function addFish(speciesId: SpeciesId, name: string): Fish {
  const fish = new Fish(speciesId, name)
  fishes.push(fish)
  scene.add(fish.mesh)
  return fish
}

// Default tank population
addFish('tetra', 'Neon 1')
addFish('tetra', 'Neon 2')
addFish('tetra', 'Neon 3')
addFish('clownfish', 'Nemo')
addFish('angelfish', 'Grace')
addFish('pufferfish', 'Puff')
addFish('barracuda', 'Cuda')
addFish('seahorse', 'Coral')

const clock = new THREE.Clock()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function updateFishBehaviors(dt: number): void {
  // Project mouse into world space
  raycaster.setFromCamera(mouseNDC, camera)
  raycaster.ray.intersectPlane(mousePlane, mouseWorld)

  for (const fish of fishes) {
    // Build state context
    const threats: THREE.Vector3[] = []
    const school: Fish[] = []
    const intruders: Fish[] = []

    for (const other of fishes) {
      if (other === fish) continue
      const dist = fish.position.distanceTo(other.position)
      if (other.species.behaviorType === 'predator' && dist < 3.0) {
        threats.push(other.position)
      }
      if (other.speciesId === fish.speciesId && dist < 3.0) {
        school.push(other)
      }
      if (dist < 2.0) {
        intruders.push(other)
      }
    }

    const mouseDist = fish.position.distanceTo(mouseWorld)

    const ctx: StateContext = {
      threats: threats.map(t => ({ distance: fish.position.distanceTo(t) })),
      shelters: [], // populated when decorations exist
      school: school.map(s => ({ distance: fish.position.distanceTo(s.position) })),
      mouse: mouseDist < 3.0 ? { distance: mouseDist } : null,
      homeDecor: null, // populated when decorations exist
    }

    fish.stateMachine.update(dt, ctx)

    // Apply behavior based on current state
    switch (fish.stateMachine.current) {
      case 'wander':
      case 'idle':
        if (fish.species.behaviorType === 'predator') {
          updatePredatorPatrol(fish, dt)
        } else {
          updateWander(fish, dt)
        }
        break
      case 'school':
        updateSchool(fish, school, dt)
        break
      case 'flee':
        updateFlee(fish, threats, dt)
        break
      case 'hide':
        updateHide(fish, [], dt) // shelters added later with decorations
        break
      case 'territorial':
        updateTerritorial(fish, new THREE.Vector3(0, -2, 0), intruders, dt)
        break
      case 'react':
        updateReact(fish, mouseWorld, dt)
        break
    }

    fish.update(dt)
  }
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05) // cap to prevent huge jumps
  const elapsed = clock.getElapsedTime()

  updateFishBehaviors(dt)
  updateWaterSurface(tank.waterSurface, elapsed)
  updateCaustics(lights, elapsed)
  updateParallax(camera)

  renderer.render(scene, camera)
}

animate()
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: 8 fish swimming in the tank with different behaviors. Tetras school together, barracuda patrols, fish scatter from the mouse cursor. Pufferfish is slow and skittish.

- [ ] **Step 4: Commit**

```bash
git add src/fish/behaviors.ts src/main.ts
git commit -m "feat: fish behaviors — wander, school, flee, hide, territorial, react"
```

---

### Task 11: Decoration Catalog and Geometry

**Files:**
- Create: `src/decorations/catalog.ts`
- Create: `src/decorations/catalog.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/decorations/catalog.test.ts
import { describe, it, expect } from 'vitest'
import { DECORATIONS, type DecorationId, type DecorationCategory } from './catalog'

describe('DECORATIONS', () => {
  it('has 11 items', () => {
    expect(Object.keys(DECORATIONS)).toHaveLength(11)
  })

  it('every item has required fields', () => {
    for (const [id, def] of Object.entries(DECORATIONS)) {
      expect(def.name, `${id} missing name`).toBeTruthy()
      expect(def.category, `${id} missing category`).toBeTruthy()
      expect(def.size, `${id} missing size`).toBeTruthy()
      expect(typeof def.createMesh, `${id} missing createMesh`).toBe('function')
    }
  })

  it('categories are valid', () => {
    const validCategories: DecorationCategory[] = ['plants', 'rocks', 'accessories', 'fun']
    for (const def of Object.values(DECORATIONS)) {
      expect(validCategories).toContain(def.category)
    }
  })

  it('sizes are valid', () => {
    const validSizes = ['small', 'medium', 'large']
    for (const def of Object.values(DECORATIONS)) {
      expect(validSizes).toContain(def.size)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/decorations/catalog.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/decorations/catalog.ts**

```typescript
import * as THREE from 'three'
import { lowPolyMaterial, jitterVertices } from '../utils/geometry'

export type DecorationCategory = 'plants' | 'rocks' | 'accessories' | 'fun'
export type DecorationSize = 'small' | 'medium' | 'large'

export interface DecorationDefinition {
  name: string
  category: DecorationCategory
  size: DecorationSize
  createMesh: () => THREE.Group
}

export type DecorationId =
  | 'seaweed' | 'coral_fan' | 'anemone'
  | 'boulder' | 'rock_arch' | 'driftwood'
  | 'bubbler' | 'tank_light'
  | 'treasure_chest' | 'diver' | 'sunken_ship'

function createSeaweed(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x22aa44)
  const segments = 5
  for (let i = 0; i < segments; i++) {
    const radius = 0.12 - i * 0.015
    const geo = new THREE.CylinderGeometry(radius, radius + 0.02, 0.35, 5)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = i * 0.3
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function createCoralFan(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0xff6688)
  const geo = new THREE.CircleGeometry(0.6, 8)
  jitterVertices(geo, 0.08)
  const fan = new THREE.Mesh(geo, mat)
  fan.castShadow = true
  group.add(fan)
  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 4)
  const stem = new THREE.Mesh(stemGeo, lowPolyMaterial(0xcc5566))
  stem.position.y = -0.5
  group.add(stem)
  return group
}

function createAnemone(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0xee44aa)
  const tentacles = 8
  for (let i = 0; i < tentacles; i++) {
    const angle = (i / tentacles) * Math.PI * 2
    const geo = new THREE.CylinderGeometry(0.03, 0.05, 0.35, 4)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(Math.cos(angle) * 0.15, 0.15, Math.sin(angle) * 0.15)
    mesh.rotation.z = Math.cos(angle) * 0.3
    mesh.rotation.x = Math.sin(angle) * 0.3
    mesh.castShadow = true
    group.add(mesh)
  }
  // Base
  const baseGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.1, 6)
  const base = new THREE.Mesh(baseGeo, lowPolyMaterial(0xcc3388))
  group.add(base)
  return group
}

function createBoulder(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.IcosahedronGeometry(0.5, 1)
  geo.scale(1.2, 0.8, 1.0)
  jitterVertices(geo, 0.06)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0x888877))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

function createRockArch(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x887766)
  // Left column
  const colGeo = new THREE.CylinderGeometry(0.2, 0.25, 1.0, 5)
  jitterVertices(colGeo, 0.04)
  const left = new THREE.Mesh(colGeo, mat)
  left.position.set(-0.5, 0.5, 0)
  left.castShadow = true
  group.add(left)
  // Right column
  const right = new THREE.Mesh(colGeo.clone(), mat)
  right.position.set(0.5, 0.5, 0)
  right.castShadow = true
  group.add(right)
  // Bridge
  const bridgeGeo = new THREE.BoxGeometry(1.2, 0.2, 0.4)
  jitterVertices(bridgeGeo, 0.03)
  const bridge = new THREE.Mesh(bridgeGeo, mat)
  bridge.position.y = 1.05
  bridge.castShadow = true
  group.add(bridge)
  return group
}

function createDriftwood(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.CylinderGeometry(0.08, 0.12, 1.2, 5)
  jitterVertices(geo, 0.03)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0x8b6914))
  mesh.rotation.z = 0.3
  mesh.castShadow = true
  group.add(mesh)
  // Branch
  const branchGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.5, 4)
  const branch = new THREE.Mesh(branchGeo, lowPolyMaterial(0x7a5c12))
  branch.position.set(0.2, 0.3, 0)
  branch.rotation.z = -0.6
  branch.castShadow = true
  group.add(branch)
  return group
}

function createBubbler(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(0.25, 0.15, 0.2)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0x555555))
  mesh.castShadow = true
  group.add(mesh)
  // Small nozzle on top
  const nozzleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 4)
  const nozzle = new THREE.Mesh(nozzleGeo, lowPolyMaterial(0x666666))
  nozzle.position.y = 0.12
  group.add(nozzle)
  return group
}

function createTankLight(): THREE.Group {
  const group = new THREE.Group()
  // Housing
  const housingGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.12, 6)
  const housing = new THREE.Mesh(housingGeo, lowPolyMaterial(0x333333))
  group.add(housing)
  // Lens
  const lensGeo = new THREE.CircleGeometry(0.14, 6)
  const lens = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 0.5,
  }))
  lens.rotation.x = -Math.PI / 2
  lens.position.y = -0.07
  group.add(lens)
  return group
}

function createTreasureChest(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x8b4513)
  // Base box
  const baseGeo = new THREE.BoxGeometry(0.6, 0.35, 0.4)
  const base = new THREE.Mesh(baseGeo, mat)
  base.castShadow = true
  group.add(base)
  // Lid (slightly open)
  const lidGeo = new THREE.BoxGeometry(0.6, 0.08, 0.4)
  const lid = new THREE.Mesh(lidGeo, mat)
  lid.position.set(0, 0.2, -0.1)
  lid.rotation.x = -0.3
  lid.castShadow = true
  group.add(lid)
  // Gold inside
  const goldGeo = new THREE.SphereGeometry(0.08, 4, 4)
  const goldMat = lowPolyMaterial(0xffd700)
  for (let i = 0; i < 3; i++) {
    const gold = new THREE.Mesh(goldGeo, goldMat)
    gold.position.set((i - 1) * 0.12, 0.15, 0)
    group.add(gold)
  }
  return group
}

function createDiver(): THREE.Group {
  const group = new THREE.Group()
  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.4, 5)
  const body = new THREE.Mesh(bodyGeo, lowPolyMaterial(0x222222))
  body.castShadow = true
  group.add(body)
  // Head / helmet
  const headGeo = new THREE.SphereGeometry(0.12, 5, 5)
  const head = new THREE.Mesh(headGeo, lowPolyMaterial(0xddaa00))
  head.position.y = 0.3
  head.castShadow = true
  group.add(head)
  // Visor
  const visorGeo = new THREE.CircleGeometry(0.06, 5)
  const visor = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: 0x4488ff }))
  visor.position.set(0, 0.3, 0.12)
  group.add(visor)
  return group
}

function createSunkenShip(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x6b4226)
  // Hull — wedge shape (rotated box)
  const hullGeo = new THREE.BoxGeometry(1.6, 0.5, 0.6)
  jitterVertices(hullGeo, 0.04)
  const hull = new THREE.Mesh(hullGeo, mat)
  hull.rotation.z = 0.15 // slightly tilted
  hull.castShadow = true
  group.add(hull)
  // Mast
  const mastGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.0, 4)
  const mast = new THREE.Mesh(mastGeo, lowPolyMaterial(0x5a3820))
  mast.position.set(-0.2, 0.6, 0)
  mast.rotation.z = -0.1
  mast.castShadow = true
  group.add(mast)
  // Tattered sail
  const sailGeo = new THREE.PlaneGeometry(0.4, 0.5)
  jitterVertices(sailGeo, 0.05)
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({
    color: 0xccbb99,
    side: THREE.DoubleSide,
    flatShading: true,
  }))
  sail.position.set(-0.2, 0.7, 0.05)
  group.add(sail)
  return group
}

export const DECORATIONS: Record<DecorationId, DecorationDefinition> = {
  seaweed:        { name: 'Seaweed',        category: 'plants',      size: 'medium', createMesh: createSeaweed },
  coral_fan:      { name: 'Coral Fan',      category: 'plants',      size: 'medium', createMesh: createCoralFan },
  anemone:        { name: 'Anemone',        category: 'plants',      size: 'small',  createMesh: createAnemone },
  boulder:        { name: 'Boulder',        category: 'rocks',       size: 'medium', createMesh: createBoulder },
  rock_arch:      { name: 'Rock Arch',      category: 'rocks',       size: 'large',  createMesh: createRockArch },
  driftwood:      { name: 'Driftwood',      category: 'rocks',       size: 'medium', createMesh: createDriftwood },
  bubbler:        { name: 'Bubbler',        category: 'accessories', size: 'small',  createMesh: createBubbler },
  tank_light:     { name: 'Tank Light',     category: 'accessories', size: 'medium', createMesh: createTankLight },
  treasure_chest: { name: 'Treasure Chest', category: 'fun',         size: 'medium', createMesh: createTreasureChest },
  diver:          { name: 'Diver',          category: 'fun',         size: 'small',  createMesh: createDiver },
  sunken_ship:    { name: 'Sunken Ship',    category: 'fun',         size: 'large',  createMesh: createSunkenShip },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/decorations/catalog.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/decorations/catalog.ts src/decorations/catalog.test.ts
git commit -m "feat: decoration catalog with 11 low-poly items"
```

---

### Task 12: Slot System

**Files:**
- Create: `src/decorations/slots.ts`
- Create: `src/decorations/slots.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/decorations/slots.test.ts
import { describe, it, expect } from 'vitest'
import { SlotManager, SLOT_DEFINITIONS } from './slots'

describe('SLOT_DEFINITIONS', () => {
  it('defines 20 slots total', () => {
    expect(SLOT_DEFINITIONS).toHaveLength(20)
  })

  it('each slot has a zone, position, and accepted sizes', () => {
    for (const slot of SLOT_DEFINITIONS) {
      expect(slot.zone).toBeTruthy()
      expect(slot.position).toBeDefined()
      expect(slot.acceptedSizes.length).toBeGreaterThan(0)
    }
  })
})

describe('SlotManager', () => {
  it('starts with all slots empty', () => {
    const mgr = new SlotManager()
    expect(mgr.getOccupied()).toHaveLength(0)
    expect(mgr.getEmpty()).toHaveLength(20)
  })

  it('places a decoration in a slot', () => {
    const mgr = new SlotManager()
    const result = mgr.place(0, 'boulder')
    expect(result).toBe(true)
    expect(mgr.getOccupied()).toHaveLength(1)
    expect(mgr.getSlot(0).decorationId).toBe('boulder')
  })

  it('rejects placement if size does not fit', () => {
    const mgr = new SlotManager()
    // Ceiling slot (index 18) only accepts small/medium
    const ceilingSlot = SLOT_DEFINITIONS.findIndex(s => s.zone === 'ceiling')
    const result = mgr.place(ceilingSlot, 'sunken_ship') // large item
    expect(result).toBe(false)
  })

  it('removes a decoration from a slot', () => {
    const mgr = new SlotManager()
    mgr.place(0, 'boulder')
    mgr.remove(0)
    expect(mgr.getSlot(0).decorationId).toBeNull()
    expect(mgr.getOccupied()).toHaveLength(0)
  })

  it('rejects placement in an occupied slot', () => {
    const mgr = new SlotManager()
    mgr.place(0, 'boulder')
    const result = mgr.place(0, 'driftwood')
    expect(result).toBe(false)
  })

  it('allows placement after removing', () => {
    const mgr = new SlotManager()
    mgr.place(0, 'boulder')
    mgr.remove(0)
    const result = mgr.place(0, 'driftwood')
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/decorations/slots.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/decorations/slots.ts**

```typescript
import * as THREE from 'three'
import { TANK } from '../scene/tank'
import { DECORATIONS, type DecorationId, type DecorationSize } from './catalog'

export type SlotZone = 'floor_back' | 'floor_front' | 'wall_upper' | 'wall_lower' | 'ceiling'

export interface SlotDefinition {
  zone: SlotZone
  position: THREE.Vector3
  acceptedSizes: DecorationSize[]
}

export interface SlotState {
  decorationId: DecorationId | null
  mesh: THREE.Group | null
}

const HW = TANK.width / 2
const HH = TANK.height / 2
const HD = TANK.depth / 2

function makeSlots(zone: SlotZone, count: number, y: number, z: number, acceptedSizes: DecorationSize[]): SlotDefinition[] {
  const slots: SlotDefinition[] = []
  const spacing = (TANK.width - 2) / (count - 1)
  const startX = -(TANK.width - 2) / 2
  for (let i = 0; i < count; i++) {
    slots.push({
      zone,
      position: new THREE.Vector3(startX + i * spacing, y, z),
      acceptedSizes,
    })
  }
  return slots
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  // Floor back row (5) — large, medium, small
  ...makeSlots('floor_back', 5, -HH + 0.01, -HD + 1.5, ['small', 'medium', 'large']),
  // Floor front row (5) — small, medium
  ...makeSlots('floor_front', 5, -HH + 0.01, HD - 2.0, ['small', 'medium']),
  // Back wall upper (4) — medium, small
  ...makeSlots('wall_upper', 4, HH * 0.3, -HD + 0.3, ['small', 'medium']),
  // Back wall lower (4) — small, medium
  ...makeSlots('wall_lower', 4, -HH * 0.3, -HD + 0.3, ['small', 'medium']),
  // Ceiling (2) — small, medium
  ...makeSlots('ceiling', 2, HH - 0.2, 0, ['small', 'medium']),
]

export class SlotManager {
  private slots: SlotState[]

  constructor() {
    this.slots = SLOT_DEFINITIONS.map(() => ({ decorationId: null, mesh: null }))
  }

  getSlot(index: number): SlotState {
    return this.slots[index]
  }

  getOccupied(): { index: number; state: SlotState }[] {
    return this.slots
      .map((state, index) => ({ index, state }))
      .filter(({ state }) => state.decorationId !== null)
  }

  getEmpty(): { index: number; def: SlotDefinition }[] {
    return this.slots
      .map((state, index) => ({ index, state, def: SLOT_DEFINITIONS[index] }))
      .filter(({ state }) => state.decorationId === null)
      .map(({ index, def }) => ({ index, def }))
  }

  canPlace(slotIndex: number, decorationId: DecorationId): boolean {
    const slot = this.slots[slotIndex]
    if (slot.decorationId !== null) return false
    const def = SLOT_DEFINITIONS[slotIndex]
    const decor = DECORATIONS[decorationId]
    return def.acceptedSizes.includes(decor.size)
  }

  place(slotIndex: number, decorationId: DecorationId): boolean {
    if (!this.canPlace(slotIndex, decorationId)) return false
    const decor = DECORATIONS[decorationId]
    const mesh = decor.createMesh()
    const pos = SLOT_DEFINITIONS[slotIndex].position
    mesh.position.copy(pos)
    this.slots[slotIndex] = { decorationId, mesh }
    return true
  }

  remove(slotIndex: number): THREE.Group | null {
    const slot = this.slots[slotIndex]
    const mesh = slot.mesh
    this.slots[slotIndex] = { decorationId: null, mesh: null }
    return mesh
  }

  /** Export state for persistence (no meshes) */
  serialize(): { slotIndex: number; decorationId: DecorationId }[] {
    return this.slots
      .map((state, index) => ({ slotIndex: index, decorationId: state.decorationId }))
      .filter((s): s is { slotIndex: number; decorationId: DecorationId } => s.decorationId !== null)
  }

  /** Restore from serialized data. Returns meshes that need to be added to scene. */
  deserialize(data: { slotIndex: number; decorationId: DecorationId }[]): THREE.Group[] {
    const meshes: THREE.Group[] = []
    for (const { slotIndex, decorationId } of data) {
      if (this.place(slotIndex, decorationId)) {
        const mesh = this.slots[slotIndex].mesh
        if (mesh) meshes.push(mesh)
      }
    }
    return meshes
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/decorations/slots.test.ts`
Expected: PASS (7 tests total across 2 describe blocks)

- [ ] **Step 5: Commit**

```bash
git add src/decorations/slots.ts src/decorations/slots.test.ts
git commit -m "feat: slot system with 20 predefined zones and placement logic"
```

---

### Task 13: Decoration Effects

**Files:**
- Create: `src/decorations/effects.ts`

- [ ] **Step 1: Create src/decorations/effects.ts**

```typescript
import * as THREE from 'three'
import { type DecorationId } from './catalog'
import { TANK } from '../scene/tank'

interface BubbleParticle {
  mesh: THREE.Mesh
  speed: number
  offset: number
}

export class DecorationEffects {
  private swayingMeshes: { mesh: THREE.Group; speed: number; amplitude: number }[] = []
  private bubblers: { origin: THREE.Vector3; particles: BubbleParticle[] }[] = []
  private spotlights: THREE.SpotLight[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  register(decorationId: DecorationId, mesh: THREE.Group): void {
    switch (decorationId) {
      case 'seaweed':
        this.swayingMeshes.push({ mesh, speed: 1.5, amplitude: 0.1 })
        break
      case 'coral_fan':
        this.swayingMeshes.push({ mesh, speed: 0.8, amplitude: 0.05 })
        break
      case 'anemone':
        this.swayingMeshes.push({ mesh, speed: 2.0, amplitude: 0.06 })
        break
      case 'bubbler':
        this.addBubbler(mesh.position.clone().add(new THREE.Vector3(0, 0.15, 0)))
        break
      case 'tank_light':
        this.addSpotlight(mesh.position)
        break
    }
  }

  unregister(mesh: THREE.Group): void {
    this.swayingMeshes = this.swayingMeshes.filter(s => s.mesh !== mesh)
    // Bubblers and spotlights stay until full cleanup — fine for v1
  }

  private addBubbler(origin: THREE.Vector3): void {
    const particles: BubbleParticle[] = []
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.4,
    })
    for (let i = 0; i < 6; i++) {
      const size = 0.02 + Math.random() * 0.03
      const geo = new THREE.SphereGeometry(size, 4, 4)
      const mesh = new THREE.Mesh(geo, bubbleMat)
      mesh.position.copy(origin)
      mesh.visible = false
      this.scene.add(mesh)
      particles.push({
        mesh,
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
      })
    }
    this.bubblers.push({ origin, particles })
  }

  private addSpotlight(position: THREE.Vector3): void {
    const light = new THREE.SpotLight(0xffffaa, 0.6, 5, Math.PI / 6, 0.5)
    light.position.copy(position)
    light.target.position.set(position.x, position.y - 3, position.z)
    this.scene.add(light)
    this.scene.add(light.target)
    this.spotlights.push(light)
  }

  update(time: number): void {
    // Sway plants
    for (const { mesh, speed, amplitude } of this.swayingMeshes) {
      mesh.children.forEach((child, i) => {
        child.rotation.z = Math.sin(time * speed + i * 0.5) * amplitude * (i + 1)
      })
    }

    // Animate bubbles
    const waterY = TANK.height / 2
    for (const bubbler of this.bubblers) {
      for (const particle of bubbler.particles) {
        if (!particle.mesh.visible) {
          // Respawn with random delay
          if (Math.random() < 0.02) {
            particle.mesh.visible = true
            particle.mesh.position.copy(bubbler.origin)
          }
          continue
        }
        particle.mesh.position.y += particle.speed * 0.016 // ~60fps assumed for visual
        particle.mesh.position.x = bubbler.origin.x + Math.sin(time * 2 + particle.offset) * 0.05
        particle.mesh.position.z = bubbler.origin.z + Math.cos(time * 1.5 + particle.offset) * 0.03

        // Reset when reaching water surface
        if (particle.mesh.position.y > waterY) {
          particle.mesh.visible = false
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/decorations/effects.ts
git commit -m "feat: decoration effects — plant sway, bubble particles, spotlights"
```

---

### Task 14: HUD Overlay (HTML/CSS)

**Files:**
- Create: `src/ui/hud.ts`
- Create: `src/ui/hud.css`
- Modify: `index.html`

- [ ] **Step 1: Create src/ui/hud.css**

```css
/* src/ui/hud.css */
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');

#hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: 'Fredoka', sans-serif;
  color: #fff;
  user-select: none;
}

#hud * {
  pointer-events: auto;
}

/* Top bar */
.hud-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  background: linear-gradient(180deg, rgba(10, 30, 60, 0.9), rgba(10, 30, 60, 0.7));
  border-bottom: 1px solid rgba(100, 180, 255, 0.3);
}

.tank-name {
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: none;
  color: #fff;
  font-family: inherit;
}

.tank-name:hover {
  border-color: rgba(100, 180, 255, 0.5);
  background: rgba(100, 180, 255, 0.1);
}

.tank-name:focus {
  outline: none;
  border-color: rgba(100, 180, 255, 0.8);
  background: rgba(100, 180, 255, 0.15);
}

.hud-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  opacity: 0.8;
}

/* Left sidebar */
.hud-sidebar {
  position: absolute;
  left: 0;
  top: 44px;
  bottom: 52px;
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 8px;
  background: linear-gradient(90deg, rgba(10, 30, 60, 0.85), rgba(10, 30, 60, 0.5));
  border-right: 1px solid rgba(100, 180, 255, 0.2);
}

.sidebar-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(100, 180, 255, 0.3);
  background: rgba(30, 60, 100, 0.6);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.sidebar-btn:hover {
  background: rgba(50, 100, 180, 0.7);
  border-color: rgba(100, 180, 255, 0.6);
}

/* Bottom bar */
.hud-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 60px 0 60px;
  gap: 8px;
  background: linear-gradient(0deg, rgba(10, 30, 60, 0.9), rgba(10, 30, 60, 0.7));
  border-top: 1px solid rgba(100, 180, 255, 0.3);
}

.decor-thumbnails {
  display: flex;
  gap: 6px;
  flex: 1;
  overflow-x: auto;
}

.decor-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(30, 60, 100, 0.6);
  border: 1px solid rgba(100, 180, 255, 0.3);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edit-btn {
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #22aa55, #1b8844);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.edit-btn:hover {
  background: linear-gradient(135deg, #2bc866, #22aa55);
}

/* Panels (fish list, add fish, settings) */
.panel-overlay {
  position: absolute;
  left: 60px;
  top: 44px;
  bottom: 52px;
  width: 280px;
  background: rgba(10, 25, 50, 0.95);
  border-right: 1px solid rgba(100, 180, 255, 0.3);
  padding: 16px;
  overflow-y: auto;
  display: none;
  flex-direction: column;
  gap: 12px;
}

.panel-overlay.open {
  display: flex;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.panel-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.7;
}

.panel-close:hover {
  opacity: 1;
}

/* Fish list items */
.fish-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(30, 60, 100, 0.4);
}

.fish-item-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.fish-item-name {
  font-size: 14px;
}

.fish-item-species {
  font-size: 12px;
  opacity: 0.6;
  margin-left: auto;
}

/* Species picker */
.species-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(30, 60, 100, 0.4);
  border: 1px solid rgba(100, 180, 255, 0.2);
  cursor: pointer;
  transition: all 0.15s;
}

.species-card:hover {
  background: rgba(50, 100, 180, 0.5);
  border-color: rgba(100, 180, 255, 0.5);
}

.species-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.species-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.species-info-name {
  font-size: 14px;
  font-weight: 600;
}

.species-info-desc {
  font-size: 11px;
  opacity: 0.6;
}

/* Settings panel */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.setting-label {
  font-size: 14px;
}

.setting-toggle {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: rgba(100, 100, 100, 0.6);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.setting-toggle.on {
  background: rgba(34, 170, 85, 0.8);
}

.setting-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.setting-toggle.on::after {
  transform: translateX(18px);
}

.setting-slider {
  width: 100px;
  accent-color: #22aa55;
}
```

- [ ] **Step 2: Create src/ui/hud.ts**

```typescript
import './hud.css'

export interface HUDCallbacks {
  onEditTank: () => void
  onFishList: () => void
  onAddFish: () => void
  onScreenshot: () => void
  onSettings: () => void
  onTankNameChange: (name: string) => void
}

export class HUD {
  private container: HTMLDivElement
  private tankNameInput: HTMLInputElement
  private fishCountEl: HTMLSpanElement
  private decorCountEl: HTMLSpanElement
  private bottomBar: HTMLDivElement
  private decorThumbnails: HTMLDivElement
  private editBtn: HTMLButtonElement
  private panelOverlay: HTMLDivElement

  constructor(parent: HTMLElement, callbacks: HUDCallbacks) {
    this.container = document.createElement('div')
    this.container.id = 'hud'

    // Top bar
    const top = document.createElement('div')
    top.className = 'hud-top'

    this.tankNameInput = document.createElement('input')
    this.tankNameInput.className = 'tank-name'
    this.tankNameInput.value = 'My Reef Tank'
    this.tankNameInput.addEventListener('change', () => callbacks.onTankNameChange(this.tankNameInput.value))
    top.appendChild(this.tankNameInput)

    const stats = document.createElement('div')
    stats.className = 'hud-stats'
    this.fishCountEl = document.createElement('span')
    this.fishCountEl.textContent = '0/12 Fish'
    this.decorCountEl = document.createElement('span')
    this.decorCountEl.textContent = '0/20 Decor'
    stats.appendChild(this.fishCountEl)
    stats.appendChild(this.decorCountEl)
    top.appendChild(stats)

    this.container.appendChild(top)

    // Left sidebar
    const sidebar = document.createElement('div')
    sidebar.className = 'hud-sidebar'

    const buttons: { icon: string; action: () => void; title: string }[] = [
      { icon: '\u{1F41F}', action: callbacks.onFishList, title: 'Fish List' },
      { icon: '\u{2795}',  action: callbacks.onAddFish,  title: 'Add Fish' },
      { icon: '\u{1F4F7}', action: callbacks.onScreenshot, title: 'Screenshot' },
      { icon: '\u{2699}',  action: callbacks.onSettings, title: 'Settings' },
    ]

    for (const btn of buttons) {
      const el = document.createElement('button')
      el.className = 'sidebar-btn'
      el.textContent = btn.icon
      el.title = btn.title
      el.addEventListener('click', btn.action)
      sidebar.appendChild(el)
    }

    this.container.appendChild(sidebar)

    // Bottom bar
    this.bottomBar = document.createElement('div')
    this.bottomBar.className = 'hud-bottom'

    this.decorThumbnails = document.createElement('div')
    this.decorThumbnails.className = 'decor-thumbnails'
    this.bottomBar.appendChild(this.decorThumbnails)

    this.editBtn = document.createElement('button')
    this.editBtn.className = 'edit-btn'
    this.editBtn.textContent = 'Edit Tank'
    this.editBtn.addEventListener('click', callbacks.onEditTank)
    this.bottomBar.appendChild(this.editBtn)

    this.container.appendChild(this.bottomBar)

    // Panel overlay (reused for fish list, add fish, settings)
    this.panelOverlay = document.createElement('div')
    this.panelOverlay.className = 'panel-overlay'
    this.container.appendChild(this.panelOverlay)

    parent.appendChild(this.container)
  }

  setTankName(name: string): void {
    this.tankNameInput.value = name
  }

  updateCounts(fishCount: number, maxFish: number, decorCount: number, maxDecor: number): void {
    this.fishCountEl.textContent = `${fishCount}/${maxFish} Fish`
    this.decorCountEl.textContent = `${decorCount}/${maxDecor} Decor`
  }

  getBottomBar(): HTMLDivElement {
    return this.bottomBar
  }

  getPanel(): HTMLDivElement {
    return this.panelOverlay
  }

  showPanel(html: string): void {
    this.panelOverlay.innerHTML = html
    this.panelOverlay.classList.add('open')

    const closeBtn = this.panelOverlay.querySelector('.panel-close')
    closeBtn?.addEventListener('click', () => this.hidePanel())
  }

  hidePanel(): void {
    this.panelOverlay.classList.remove('open')
  }

  updateDecorationThumbnails(decorations: { id: string; icon: string }[]): void {
    this.decorThumbnails.innerHTML = ''
    for (const d of decorations) {
      const thumb = document.createElement('div')
      thumb.className = 'decor-thumb'
      thumb.textContent = d.icon
      thumb.title = d.id
      this.decorThumbnails.appendChild(thumb)
    }
  }
}
```

- [ ] **Step 3: Add CSS import to index.html**

No change needed — Vite handles the CSS import from the `import './hud.css'` in `hud.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/hud.ts src/ui/hud.css
git commit -m "feat: HUD overlay with top bar, sidebar, and bottom bar"
```

---

### Task 15: Edit Mode UI

**Files:**
- Create: `src/ui/edit-mode.ts`
- Create: `src/ui/edit-mode.css`

- [ ] **Step 1: Create src/ui/edit-mode.css**

```css
/* src/ui/edit-mode.css */

.edit-mode-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(0deg, rgba(10, 25, 50, 0.95), rgba(10, 25, 50, 0.85));
  border-top: 1px solid rgba(100, 180, 255, 0.4);
  display: flex;
  flex-direction: column;
  padding: 8px 60px;
  gap: 8px;
}

.edit-tabs {
  display: flex;
  gap: 4px;
}

.edit-tab {
  padding: 4px 14px;
  border-radius: 6px 6px 0 0;
  border: 1px solid rgba(100, 180, 255, 0.3);
  border-bottom: none;
  background: rgba(30, 60, 100, 0.4);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.edit-tab.active {
  background: rgba(50, 100, 180, 0.7);
  border-color: rgba(100, 180, 255, 0.6);
}

.edit-items {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
  align-items: center;
}

.edit-item {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  border: 2px solid rgba(100, 180, 255, 0.3);
  background: rgba(30, 60, 100, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.edit-item:hover {
  border-color: rgba(100, 180, 255, 0.7);
  background: rgba(50, 100, 180, 0.6);
}

.edit-item.selected {
  border-color: #22aa55;
  background: rgba(34, 170, 85, 0.2);
}

.edit-item-icon {
  font-size: 24px;
}

.edit-item-name {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.edit-done-btn {
  padding: 8px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #22aa55, #1b8844);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-end;
}

.edit-done-btn:hover {
  background: linear-gradient(135deg, #2bc866, #22aa55);
}

/* Slot indicators in 3D scene — styled via Three.js, not CSS */

/* Dim overlay for edit mode */
.edit-dim-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  pointer-events: none;
}
```

- [ ] **Step 2: Create src/ui/edit-mode.ts**

```typescript
import './edit-mode.css'
import { DECORATIONS, type DecorationId, type DecorationCategory } from '../decorations/catalog'

const CATEGORY_ICONS: Record<DecorationCategory, string> = {
  plants: '\u{1F33F}',
  rocks: '\u{1FAA8}',
  accessories: '\u{2699}',
  fun: '\u{2B50}',
}

const ITEM_ICONS: Partial<Record<DecorationId, string>> = {
  seaweed: '\u{1F33F}',
  coral_fan: '\u{1FAB8}',
  anemone: '\u{1F338}',
  boulder: '\u{1FAA8}',
  rock_arch: '\u{1F3DB}',
  driftwood: '\u{1FAB5}',
  bubbler: '\u{1FAE7}',
  tank_light: '\u{1F4A1}',
  treasure_chest: '\u{1F4E6}',
  diver: '\u{1F93F}',
  sunken_ship: '\u{26F5}',
}

export interface EditModeCallbacks {
  onSelectItem: (decorationId: DecorationId) => void
  onDone: () => void
}

export class EditModeUI {
  private container: HTMLDivElement
  private dimOverlay: HTMLDivElement
  private itemsContainer: HTMLDivElement
  private activeCategory: DecorationCategory = 'plants'
  private selectedItem: DecorationId | null = null
  private callbacks: EditModeCallbacks

  constructor(parent: HTMLElement, callbacks: EditModeCallbacks) {
    this.callbacks = callbacks

    // Dim overlay
    this.dimOverlay = document.createElement('div')
    this.dimOverlay.className = 'edit-dim-overlay'

    // Bottom panel
    this.container = document.createElement('div')
    this.container.className = 'edit-mode-bottom'

    // Tabs
    const tabs = document.createElement('div')
    tabs.className = 'edit-tabs'
    const categories: DecorationCategory[] = ['plants', 'rocks', 'accessories', 'fun']
    for (const cat of categories) {
      const tab = document.createElement('button')
      tab.className = `edit-tab${cat === this.activeCategory ? ' active' : ''}`
      tab.textContent = `${CATEGORY_ICONS[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`
      tab.addEventListener('click', () => {
        this.activeCategory = cat
        tabs.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        this.renderItems()
      })
      tabs.appendChild(tab)
    }

    const doneBtn = document.createElement('button')
    doneBtn.className = 'edit-done-btn'
    doneBtn.textContent = 'Done'
    doneBtn.addEventListener('click', callbacks.onDone)

    const topRow = document.createElement('div')
    topRow.style.display = 'flex'
    topRow.style.justifyContent = 'space-between'
    topRow.style.alignItems = 'center'
    topRow.appendChild(tabs)
    topRow.appendChild(doneBtn)
    this.container.appendChild(topRow)

    // Items
    this.itemsContainer = document.createElement('div')
    this.itemsContainer.className = 'edit-items'
    this.container.appendChild(this.itemsContainer)

    this.renderItems()

    parent.appendChild(this.dimOverlay)
    parent.appendChild(this.container)
  }

  private renderItems(): void {
    this.itemsContainer.innerHTML = ''
    for (const [id, def] of Object.entries(DECORATIONS)) {
      if (def.category !== this.activeCategory) continue
      const item = document.createElement('div')
      item.className = `edit-item${this.selectedItem === id ? ' selected' : ''}`
      item.innerHTML = `
        <span class="edit-item-icon">${ITEM_ICONS[id as DecorationId] || '?'}</span>
        <span class="edit-item-name">${def.name}</span>
      `
      item.addEventListener('click', () => {
        this.selectedItem = id as DecorationId
        this.renderItems()
        this.callbacks.onSelectItem(id as DecorationId)
      })
      this.itemsContainer.appendChild(item)
    }
  }

  getSelectedItem(): DecorationId | null {
    return this.selectedItem
  }

  destroy(): void {
    this.dimOverlay.remove()
    this.container.remove()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/edit-mode.ts src/ui/edit-mode.css
git commit -m "feat: edit mode UI with category tabs and item selection"
```

---

### Task 16: Side Panels (Fish List, Add Fish, Settings)

**Files:**
- Create: `src/ui/panels.ts`

- [ ] **Step 1: Create src/ui/panels.ts**

```typescript
import { type SpeciesId, SPECIES } from '../fish/species'
import { type Fish } from '../fish/fish'
import { type HUD } from './hud'

export interface PanelCallbacks {
  onAddFish: (speciesId: SpeciesId, name: string) => void
  onRemoveFish: (index: number) => void
  onToggleCaustics: (on: boolean) => void
  onToggleBloom: (on: boolean) => void
  onSwayIntensity: (value: number) => void
  onScreenshot: () => void
}

export function showFishListPanel(hud: HUD, fishes: Fish[], callbacks: PanelCallbacks): void {
  let html = `
    <div class="panel-title">Fish in Tank</div>
    <button class="panel-close">&times;</button>
  `
  if (fishes.length === 0) {
    html += '<p style="opacity:0.6;font-size:13px;">No fish yet. Add some!</p>'
  }
  for (let i = 0; i < fishes.length; i++) {
    const fish = fishes[i]
    const color = '#' + fish.species.color.toString(16).padStart(6, '0')
    html += `
      <div class="fish-item">
        <div class="fish-item-color" style="background:${color}"></div>
        <span class="fish-item-name">${fish.name}</span>
        <span class="fish-item-species">${fish.species.name}</span>
        <button class="sidebar-btn" style="width:24px;height:24px;font-size:12px;margin-left:4px" data-remove="${i}">&times;</button>
      </div>
    `
  }

  hud.showPanel(html)

  // Bind remove buttons
  const panel = hud.getPanel()
  panel.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.remove!, 10)
      callbacks.onRemoveFish(idx)
      showFishListPanel(hud, fishes, callbacks) // re-render
    })
  })
}

export function showAddFishPanel(hud: HUD, currentCount: number, maxCount: number, callbacks: PanelCallbacks): void {
  let html = `
    <div class="panel-title">Add Fish (${currentCount}/${maxCount})</div>
    <button class="panel-close">&times;</button>
  `

  if (currentCount >= maxCount) {
    html += '<p style="opacity:0.6;font-size:13px;">Tank is full!</p>'
    hud.showPanel(html)
    return
  }

  const descriptions: Record<SpeciesId, string> = {
    tetra: 'Tiny schooling fish',
    clownfish: 'Territorial, claims decorations',
    angelfish: 'Graceful wanderer',
    pufferfish: 'Shy, hides near rocks',
    barracuda: 'Large predator patrol',
    seahorse: 'Clings to plants',
  }

  for (const [id, species] of Object.entries(SPECIES)) {
    const color = '#' + species.color.toString(16).padStart(6, '0')
    html += `
      <div class="species-card" data-species="${id}">
        <div class="species-color" style="background:${color}"></div>
        <div class="species-info">
          <span class="species-info-name">${species.name}</span>
          <span class="species-info-desc">${descriptions[id as SpeciesId]}</span>
        </div>
      </div>
    `
  }

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('.species-card').forEach(card => {
    card.addEventListener('click', () => {
      const speciesId = (card as HTMLElement).dataset.species as SpeciesId
      const name = SPECIES[speciesId].name + ' ' + (currentCount + 1)
      callbacks.onAddFish(speciesId, name)
      hud.hidePanel()
    })
  })
}

export function showSettingsPanel(
  hud: HUD,
  settings: { caustics: boolean; bloom: boolean; swayIntensity: number },
  callbacks: PanelCallbacks,
): void {
  const html = `
    <div class="panel-title">Settings</div>
    <button class="panel-close">&times;</button>
    <div class="setting-row">
      <span class="setting-label">Caustics</span>
      <button class="setting-toggle${settings.caustics ? ' on' : ''}" data-setting="caustics"></button>
    </div>
    <div class="setting-row">
      <span class="setting-label">Bloom</span>
      <button class="setting-toggle${settings.bloom ? ' on' : ''}" data-setting="bloom"></button>
    </div>
    <div class="setting-row">
      <span class="setting-label">Camera Sway</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.swayIntensity * 100}" data-setting="sway" />
    </div>
  `

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('.setting-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('on')
      const setting = (btn as HTMLElement).dataset.setting
      const isOn = btn.classList.contains('on')
      if (setting === 'caustics') callbacks.onToggleCaustics(isOn)
      if (setting === 'bloom') callbacks.onToggleBloom(isOn)
    })
  })

  const slider = panel.querySelector('[data-setting="sway"]') as HTMLInputElement
  slider?.addEventListener('input', () => {
    callbacks.onSwayIntensity(parseInt(slider.value, 10) / 100)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels.ts
git commit -m "feat: side panels for fish list, add fish, and settings"
```

---

### Task 17: State Persistence

**Files:**
- Create: `src/utils/storage.ts`
- Create: `src/utils/storage.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/utils/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveState, loadState, type TankState } from './storage'

// Mock localStorage
const store: Record<string, string> = {}
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
  })
})

describe('saveState / loadState', () => {
  it('saves and loads a tank state', () => {
    const state: TankState = {
      tankName: 'Test Tank',
      fishes: [
        { speciesId: 'tetra', name: 'Neon 1' },
        { speciesId: 'clownfish', name: 'Nemo' },
      ],
      decorations: [
        { slotIndex: 0, decorationId: 'boulder' },
      ],
      settings: {
        caustics: true,
        bloom: false,
        swayIntensity: 0.5,
      },
    }

    saveState(state)
    const loaded = loadState()
    expect(loaded).toEqual(state)
  })

  it('returns null when nothing is saved', () => {
    expect(loadState()).toBeNull()
  })

  it('returns null on corrupted data', () => {
    store['fishthree-state'] = 'not json'
    expect(loadState()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create src/utils/storage.ts**

```typescript
import { type SpeciesId } from '../fish/species'
import { type DecorationId } from '../decorations/catalog'

const STORAGE_KEY = 'fishthree-state'

export interface FishSave {
  speciesId: SpeciesId
  name: string
}

export interface DecorationSave {
  slotIndex: number
  decorationId: DecorationId
}

export interface TankSettings {
  caustics: boolean
  bloom: boolean
  swayIntensity: number
}

export interface TankState {
  tankName: string
  fishes: FishSave[]
  decorations: DecorationSave[]
  settings: TankSettings
}

export function saveState(state: TankState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadState(): TankState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TankState
  } catch {
    return null
  }
}

export const DEFAULT_SETTINGS: TankSettings = {
  caustics: true,
  bloom: true,
  swayIntensity: 0.5,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.ts src/utils/storage.test.ts
git commit -m "feat: localStorage persistence for tank state"
```

---

### Task 18: Integration — Wire Everything Together

**Files:**
- Rewrite: `src/main.ts`

This task connects all systems: tank scene, fish, decorations, effects, UI, edit mode, panels, and persistence.

- [ ] **Step 1: Rewrite src/main.ts**

```typescript
import * as THREE from 'three'
import { createTank, updateWaterSurface, TANK } from './scene/tank'
import { createCamera, updateParallax } from './scene/camera'
import { createLighting, updateCaustics } from './scene/lighting'
import { Fish, type StateContext } from './fish/fish'
import { type SpeciesId } from './fish/species'
import {
  updateWander, updateSchool, updateFlee, updateHide,
  updateTerritorial, updatePredatorPatrol, updateReact,
} from './fish/behaviors'
import { SlotManager, SLOT_DEFINITIONS } from './decorations/slots'
import { type DecorationId } from './decorations/catalog'
import { DecorationEffects } from './decorations/effects'
import { HUD } from './ui/hud'
import { EditModeUI } from './ui/edit-mode'
import { showFishListPanel, showAddFishPanel, showSettingsPanel, type PanelCallbacks } from './ui/panels'
import { saveState, loadState, DEFAULT_SETTINGS, type TankState, type TankSettings } from './utils/storage'

// --- Renderer setup ---
const app = document.getElementById('app')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a3d6b)

const camera = createCamera(window.innerWidth / window.innerHeight)
const tankMeshes = createTank(scene)
const lights = createLighting(scene)
const slotManager = new SlotManager()
const effects = new DecorationEffects(scene)

// --- State ---
const fishes: Fish[] = []
let tankName = 'My Reef Tank'
let settings: TankSettings = { ...DEFAULT_SETTINGS }
let isEditMode = false
let editModeUI: EditModeUI | null = null
let selectedDecorationId: DecorationId | null = null

const MAX_FISH = 12
const MAX_DECOR = 20

// --- Mouse tracking ---
const raycaster = new THREE.Raycaster()
const mouseNDC = new THREE.Vector2(999, 999)
const mouseWorld = new THREE.Vector3()
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

window.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
})

// --- Slot click detection ---
const slotIndicators: THREE.Mesh[] = []

function createSlotIndicators(): void {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const mat = new THREE.MeshBasicMaterial({
    color: 0x22aa55,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
  })
  for (const def of SLOT_DEFINITIONS) {
    const indicator = new THREE.Mesh(geo, mat.clone())
    indicator.position.copy(def.position)
    indicator.visible = false
    scene.add(indicator)
    slotIndicators.push(indicator)
  }
}
createSlotIndicators()

function showSlotIndicators(): void {
  slotIndicators.forEach((ind, i) => {
    const slot = slotManager.getSlot(i)
    ind.visible = true
    ;(ind.material as THREE.MeshBasicMaterial).color.setHex(
      slot.decorationId ? 0xff6644 : 0x22aa55
    )
  })
}

function hideSlotIndicators(): void {
  slotIndicators.forEach(ind => { ind.visible = false })
}

// --- Click handler for slot placement ---
window.addEventListener('click', (e) => {
  if (!isEditMode) return

  raycaster.setFromCamera(
    new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    ),
    camera,
  )

  const hits = raycaster.intersectObjects(slotIndicators)
  if (hits.length > 0) {
    const slotIndex = slotIndicators.indexOf(hits[0].object as THREE.Mesh)
    if (slotIndex === -1) return

    const slot = slotManager.getSlot(slotIndex)
    if (slot.decorationId) {
      // Remove existing decoration
      const mesh = slotManager.remove(slotIndex)
      if (mesh) {
        effects.unregister(mesh)
        scene.remove(mesh)
      }
    } else if (selectedDecorationId) {
      // Place selected decoration
      if (slotManager.place(slotIndex, selectedDecorationId)) {
        const newSlot = slotManager.getSlot(slotIndex)
        if (newSlot.mesh) {
          scene.add(newSlot.mesh)
          effects.register(selectedDecorationId, newSlot.mesh)
        }
      }
    }

    showSlotIndicators() // refresh colors
    updateHUDCounts()
    persistState()
  }
})

// --- Fish management ---
function addFish(speciesId: SpeciesId, name: string): void {
  if (fishes.length >= MAX_FISH) return
  const fish = new Fish(speciesId, name)
  fishes.push(fish)
  scene.add(fish.mesh)
  updateHUDCounts()
  persistState()
}

function removeFish(index: number): void {
  if (index < 0 || index >= fishes.length) return
  const fish = fishes.splice(index, 1)[0]
  scene.remove(fish.mesh)
  updateHUDCounts()
  persistState()
}

// --- HUD ---
const panelCallbacks: PanelCallbacks = {
  onAddFish: (speciesId, name) => { addFish(speciesId, name) },
  onRemoveFish: (index) => { removeFish(index) },
  onToggleCaustics: (on) => {
    settings.caustics = on
    lights.causticLight.visible = on
    persistState()
  },
  onToggleBloom: (on) => {
    settings.bloom = on
    persistState()
  },
  onSwayIntensity: (value) => {
    settings.swayIntensity = value
    persistState()
  },
  onScreenshot: () => {
    renderer.render(scene, camera)
    const link = document.createElement('a')
    link.download = 'fishtank.png'
    link.href = renderer.domElement.toDataURL('image/png')
    link.click()
  },
}

const hud = new HUD(app, {
  onEditTank: () => enterEditMode(),
  onFishList: () => showFishListPanel(hud, fishes, panelCallbacks),
  onAddFish: () => showAddFishPanel(hud, fishes.length, MAX_FISH, panelCallbacks),
  onScreenshot: panelCallbacks.onScreenshot,
  onSettings: () => showSettingsPanel(hud, settings, panelCallbacks),
  onTankNameChange: (name) => {
    tankName = name
    persistState()
  },
})

function updateHUDCounts(): void {
  hud.updateCounts(fishes.length, MAX_FISH, slotManager.getOccupied().length, MAX_DECOR)
}

// --- Edit mode ---
function enterEditMode(): void {
  isEditMode = true
  selectedDecorationId = null
  showSlotIndicators()
  hud.getBottomBar().style.display = 'none'

  editModeUI = new EditModeUI(app, {
    onSelectItem: (id) => { selectedDecorationId = id },
    onDone: () => exitEditMode(),
  })
}

function exitEditMode(): void {
  isEditMode = false
  hideSlotIndicators()
  hud.getBottomBar().style.display = ''
  editModeUI?.destroy()
  editModeUI = null
}

// --- Persistence ---
function persistState(): void {
  const state: TankState = {
    tankName,
    fishes: fishes.map(f => ({ speciesId: f.speciesId, name: f.name })),
    decorations: slotManager.serialize(),
    settings,
  }
  saveState(state)
}

function restoreState(): void {
  const state = loadState()
  if (!state) {
    // Spawn default fish
    addFish('tetra', 'Neon 1')
    addFish('tetra', 'Neon 2')
    addFish('tetra', 'Neon 3')
    addFish('clownfish', 'Nemo')
    addFish('angelfish', 'Grace')
    addFish('pufferfish', 'Puff')
    addFish('barracuda', 'Cuda')
    addFish('seahorse', 'Coral')
    return
  }

  tankName = state.tankName
  hud.setTankName(tankName)
  settings = { ...DEFAULT_SETTINGS, ...state.settings }
  lights.causticLight.visible = settings.caustics

  for (const fishSave of state.fishes) {
    addFish(fishSave.speciesId, fishSave.name)
  }

  const meshes = slotManager.deserialize(state.decorations)
  for (let i = 0; i < state.decorations.length; i++) {
    const mesh = meshes[i]
    if (mesh) {
      scene.add(mesh)
      effects.register(state.decorations[i].decorationId, mesh)
    }
  }

  updateHUDCounts()
}

restoreState()

// --- Fish behavior update ---
function getDecorationPositions(): THREE.Vector3[] {
  return slotManager.getOccupied().map(({ index }) => SLOT_DEFINITIONS[index].position)
}

function getRockPositions(): THREE.Vector3[] {
  return slotManager.getOccupied()
    .filter(({ state }) => {
      const id = state.decorationId
      return id === 'boulder' || id === 'rock_arch' || id === 'driftwood'
    })
    .map(({ index }) => SLOT_DEFINITIONS[index].position)
}

function getPlantPositions(): THREE.Vector3[] {
  return slotManager.getOccupied()
    .filter(({ state }) => {
      const id = state.decorationId
      return id === 'seaweed' || id === 'coral_fan' || id === 'anemone'
    })
    .map(({ index }) => SLOT_DEFINITIONS[index].position)
}

function updateFishBehaviors(dt: number): void {
  raycaster.setFromCamera(mouseNDC, camera)
  raycaster.ray.intersectPlane(mousePlane, mouseWorld)

  const decorPositions = getDecorationPositions()
  const rockPositions = getRockPositions()
  const plantPositions = getPlantPositions()

  for (const fish of fishes) {
    const threats: THREE.Vector3[] = []
    const school: Fish[] = []
    const intruders: Fish[] = []

    for (const other of fishes) {
      if (other === fish) continue
      const dist = fish.position.distanceTo(other.position)
      if (other.species.behaviorType === 'predator' && dist < 3.0) {
        threats.push(other.position)
      }
      if (other.speciesId === fish.speciesId && dist < 3.0) {
        school.push(other)
      }
      if (dist < 2.0) {
        intruders.push(other)
      }
    }

    const mouseDist = fish.position.distanceTo(mouseWorld)
    const shelters = rockPositions
    const homes = fish.species.behaviorType === 'anchorer' ? plantPositions : decorPositions

    // Find nearest home decoration
    let nearestHomeDist = Infinity
    let nearestHomePos: THREE.Vector3 | null = null
    for (const pos of homes) {
      const d = fish.position.distanceTo(pos)
      if (d < nearestHomeDist) {
        nearestHomeDist = d
        nearestHomePos = pos
      }
    }

    const ctx: StateContext = {
      threats: threats.map(t => ({ distance: fish.position.distanceTo(t) })),
      shelters: shelters.map(s => ({ distance: fish.position.distanceTo(s) })),
      school: school.map(s => ({ distance: fish.position.distanceTo(s.position) })),
      mouse: mouseDist < 3.0 ? { distance: mouseDist } : null,
      homeDecor: nearestHomePos ? { distance: nearestHomeDist } : null,
    }

    fish.stateMachine.update(dt, ctx)

    switch (fish.stateMachine.current) {
      case 'wander':
      case 'idle':
        if (fish.species.behaviorType === 'predator') {
          updatePredatorPatrol(fish, dt)
        } else {
          updateWander(fish, dt)
        }
        break
      case 'school':
        updateSchool(fish, school, dt)
        break
      case 'flee':
        updateFlee(fish, threats, dt)
        break
      case 'hide':
        updateHide(fish, shelters, dt)
        break
      case 'territorial':
        if (nearestHomePos) {
          updateTerritorial(fish, nearestHomePos, intruders, dt)
        } else {
          updateWander(fish, dt)
        }
        break
      case 'react':
        updateReact(fish, mouseWorld, dt)
        break
    }

    fish.update(dt)
  }
}

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// --- Render loop ---
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const elapsed = clock.getElapsedTime()

  updateFishBehaviors(dt)
  updateWaterSurface(tankMeshes.waterSurface, elapsed)
  if (settings.caustics) updateCaustics(lights, elapsed)
  updateParallax(camera)
  effects.update(elapsed)

  renderer.render(scene, camera)
}

animate()
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Expected:
- Full tank with 8 default fish swimming with behaviors
- HUD visible: top bar with tank name and counts, sidebar with 4 buttons, bottom bar with Edit Tank button
- Click "Edit Tank" → slot indicators appear, bottom panel shows decoration categories
- Select an item, click a slot to place it. Fish react to decorations.
- Settings panel toggles work. Screenshot downloads a PNG.
- Refresh the page — state persists from localStorage.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (across species, boids, fish, slots, storage, geometry tests)

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: full integration — fish, decorations, UI, edit mode, persistence"
```

---

### Task 19: Post-Processing (Bloom and Depth of Field)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Install Three.js post-processing examples**

Three.js ships post-processing in `three/examples/jsm/`. No extra npm install needed.

- [ ] **Step 2: Add post-processing imports and setup to src/main.ts**

Add these imports at the top of `src/main.ts`:

```typescript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
```

After the `renderer` setup block, add:

```typescript
// --- Post-processing ---
const composer = new EffectComposer(renderer)
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3,  // strength
  0.4,  // radius
  0.85, // threshold
)
composer.addPass(bloomPass)

const bokehPass = new BokehPass(scene, camera, {
  focus: 14.0,
  aperture: 0.002,
  maxblur: 0.005,
})
composer.addPass(bokehPass)
```

In the resize handler, add after `renderer.setSize`:
```typescript
  composer.setSize(window.innerWidth, window.innerHeight)
```

In the `animate()` function, replace `renderer.render(scene, camera)` with:
```typescript
  bloomPass.enabled = settings.bloom
  composer.render()
```

Update the screenshot function to render with the composer:
In the `panelCallbacks.onScreenshot`, replace `renderer.render(scene, camera)` with:
```typescript
    composer.render()
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: Subtle bloom glow around the tank light and bright areas. Very slight depth-of-field blur on objects far from the camera focal point. Toggle bloom off in settings — glow disappears.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: post-processing — bloom and depth of field"
```

---

### Task 20: Final Polish and Verification

**Files:**
- All existing files (read-only verification)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Build for production**

Run: `npm run build`
Expected: Build succeeds, outputs to `dist/`

- [ ] **Step 4: Visual verification checklist**

Run `npm run dev` and verify:
- [ ] Tank renders with back wall gradient, sand floor, glass sides, animated water surface
- [ ] Camera parallax responds to mouse movement
- [ ] Overhead light casts shadows, caustics animate on floor
- [ ] 8 fish swim with different behaviors (schooling tetras, patrolling barracuda, etc.)
- [ ] Fish react to mouse cursor (scatter or approach)
- [ ] Edit mode: slot indicators show, decorations can be placed and removed
- [ ] Decorations: plants sway, bubblers emit particles, lights cast spotlights
- [ ] Fish interact with decorations (clownfish orbits, seahorse clings, pufferfish hides)
- [ ] HUD: tank name editable, fish/decor counts update, all sidebar buttons work
- [ ] Settings: caustics toggle, bloom toggle, camera sway slider
- [ ] Screenshot downloads a PNG
- [ ] State persists across page refresh
- [ ] Bloom and depth-of-field post-processing visible

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification — all systems operational"
```
