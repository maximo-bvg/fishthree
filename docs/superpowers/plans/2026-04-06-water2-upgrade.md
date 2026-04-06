# Water2 Flow-Based Water Upgrade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic Water shader with flow-based Water2 for realistic dual-normal-map water with reflections, refractions, and Fresnel blending.

**Architecture:** Swap `Water` import from `Water.js` to `Water2.js` in `src/scene/tank.ts`, add two normal map textures, remove the now-unused time uniform update.

**Tech Stack:** Three.js Water2 (WebGL flow-based water), existing Vite + TypeScript setup.

---

### Task 1: Add Water Normal Map Textures

**Files:**
- Create: `public/textures/water/Water_1_M_Normal.jpg`
- Create: `public/textures/water/Water_2_M_Normal.jpg`

- [ ] **Step 1: Create textures/water directory and download normal maps**

```bash
mkdir -p public/textures/water
curl -L -o public/textures/water/Water_1_M_Normal.jpg \
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/water/Water_1_M_Normal.jpg"
curl -L -o public/textures/water/Water_2_M_Normal.jpg \
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/water/Water_2_M_Normal.jpg"
```

Expected: Two JPG files, ~400KB each.

- [ ] **Step 2: Verify files downloaded correctly**

```bash
file public/textures/water/Water_1_M_Normal.jpg
file public/textures/water/Water_2_M_Normal.jpg
```

Expected: Both report as JPEG image data.

- [ ] **Step 3: Commit**

```bash
git add public/textures/water/
git commit -m "feat: add Water2 flow normal map textures"
```

---

### Task 2: Replace Water with Water2 in tank.ts

**Files:**
- Modify: `src/scene/tank.ts:1-2` (import)
- Modify: `src/scene/tank.ts:108-127` (water surface creation)
- Modify: `src/scene/tank.ts:242-244` (update function)

- [ ] **Step 1: Change the import**

Replace line 2:
```typescript
// Old
import { Water } from 'three/examples/jsm/objects/Water.js'

// New
import { Water } from 'three/examples/jsm/objects/Water2.js'
```

The Water2.js module also exports the class as `Water`, so the `TankMeshes` interface type (`waterSurface: Water`) and all references remain valid with no further type changes.

- [ ] **Step 2: Replace water surface creation**

Replace lines 108-127 (the water surface block) with:

```typescript
// Water surface — Three.js Water2 with flow-based dual normals, reflections + refractions
const waterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
const waterSurface = new Water(waterGeo, {
  color: 0x0a5088,
  scale: 4,
  flowDirection: new THREE.Vector2(0.5, 0.3),
  flowSpeed: 0.03,
  reflectivity: 0.02,
  textureWidth: 512,
  textureHeight: 512,
})
waterSurface.rotation.x = -Math.PI / 2
waterSurface.position.y = TANK.height / 2
waterSurface.material.side = THREE.DoubleSide
scene.add(waterSurface)
```

Notes:
- `normalMap0` and `normalMap1` are omitted — Water2 auto-loads them from `textures/water/Water_1_M_Normal.jpg` and `Water_2_M_Normal.jpg` relative to the page root, which maps to our `public/textures/water/` directory.
- `reflectivity: 0.02` keeps it subtle from below.
- `flowDirection: (0.5, 0.3)` gives gentle diagonal movement.
- `material.side = DoubleSide` set after construction so underside is visible.

- [ ] **Step 3: Update the water surface update function**

Replace lines 242-244 in `updateWaterSurface`:

```typescript
// Old
meshes.waterSurface.material.uniforms['time'].value += dt

// New — Water2 manages its own internal clock, no time update needed
// (remove the line entirely)
```

The function body becomes:

```typescript
export function updateWaterSurface(meshes: TankMeshes, dt: number, time: number): void {
  ;(meshes.frontGlass.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  for (const wl of meshes.waterLines) {
    ;(wl.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  }
}
```

- [ ] **Step 4: Run the dev server and visually verify**

```bash
npm run dev
```

Verify in browser:
- Water surface shows flowing dual-normal ripples
- Fish visible through front glass (not obscured)
- Meniscus lines still align at water level
- No console errors

- [ ] **Step 5: Commit**

```bash
git add src/scene/tank.ts
git commit -m "feat: upgrade water surface to Water2 with flow-based reflections and refractions"
```

---

### Task 3: Clean Up Old Texture

**Files:**
- Delete: `public/textures/waternormals.jpg`

- [ ] **Step 1: Verify waternormals.jpg is no longer referenced**

```bash
grep -r "waternormals" src/
```

Expected: No matches (the Water2 constructor loads its own normal maps).

- [ ] **Step 2: Remove the old texture**

```bash
rm public/textures/waternormals.jpg
```

- [ ] **Step 3: Commit**

```bash
git add -u public/textures/waternormals.jpg
git commit -m "chore: remove unused waternormals.jpg texture"
```
