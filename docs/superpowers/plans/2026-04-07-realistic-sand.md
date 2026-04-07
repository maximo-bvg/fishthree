# Realistic Sand Bed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat sand plane with a volumetric white aragonite sand bed featuring subtle undulations, visible thickness through the front glass, and mounding around decoration bases.

**Architecture:** The sand bed is built from a subdivided `PlaneGeometry` (64x32) with one-time vertex displacement via FBM noise, plus strip geometries along the front/left/right edges for visible sand depth. A post-placement mounding function raises sand vertices near decorations. All systems referencing the old floor Y (-4.5) are updated to use the new `SAND_SURFACE_Y` (-3.5).

**Tech Stack:** Three.js (PlaneGeometry, BufferGeometry, MeshStandardMaterial), procedural canvas textures, FBM noise.

---

### Task 1: Add sand constants and export SAND_SURFACE_Y

**Files:**
- Modify: `src/scene/tank.ts:4-9`

- [ ] **Step 1: Add sand config to TANK constant**

In `src/scene/tank.ts`, replace the TANK constant (lines 4-9):

```typescript
export const TANK = {
  width: 16,
  height: 9,
  depth: 8,
  frameBar: 0.4,
} as const
```

With:

```typescript
export const TANK = {
  width: 16,
  height: 9,
  depth: 8,
  frameBar: 0.4,
  sand: {
    depth: 1.0,
    segmentsX: 64,
    segmentsZ: 32,
    undulation: 0.15,
    grain: 0.03,
    moundRadius: 1.5,
    moundHeight: 0.25,
  },
} as const
```

- [ ] **Step 2: Export SAND_SURFACE_Y**

Add this line immediately after the TANK constant:

```typescript
/** Y position of the sand surface — single source of truth for all systems. */
export const SAND_SURFACE_Y = -TANK.height / 2 + TANK.sand.depth
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors (TANK is `as const`, so `sand` properties will be readonly literals).

- [ ] **Step 4: Run existing tests**

Run: `npm test`
Expected: All existing tests pass (we only added new properties, nothing breaking).

- [ ] **Step 5: Commit**

```bash
git add src/scene/tank.ts
git commit -m "feat(sand): add sand config to TANK constant and export SAND_SURFACE_Y"
```

---

### Task 2: Update sand texture to white aragonite

**Files:**
- Modify: `src/scene/tank.ts:183-230` (sand texture generation and material)

- [ ] **Step 1: Update procedural texture color channels**

In `src/scene/tank.ts`, replace the sand pixel color calculation (the section inside the pixel loop, approximately lines 198-212):

```typescript
      // Warm sand palette — deeper contrast between troughs and crests
      const r = Math.min(255, Math.max(0, val * 220))
      const g = Math.min(255, Math.max(0, val * 190))
      const b = Math.min(255, Math.max(0, val * 125))

      // Occasional dark pebble
      if (Math.random() < 0.003) {
        const dark = 0.3 + Math.random() * 0.2
        sd[i] = dark * 140
        sd[i + 1] = dark * 120
        sd[i + 2] = dark * 90
      } else {
        sd[i] = r
        sd[i + 1] = g
        sd[i + 2] = b
      }
```

With:

```typescript
      // White aragonite palette — bright with subtle warm variation
      const r = Math.min(255, Math.max(0, val * 240))
      const g = Math.min(255, Math.max(0, val * 236))
      const b = Math.min(255, Math.max(0, val * 224))

      // Occasional dark grain (less frequent in white sand)
      if (Math.random() < 0.002) {
        const dark = 0.6 + Math.random() * 0.2
        sd[i] = dark * 220
        sd[i + 1] = dark * 210
        sd[i + 2] = dark * 195
      } else {
        sd[i] = r
        sd[i + 1] = g
        sd[i + 2] = b
      }
```

- [ ] **Step 2: Update sand material properties**

Replace the floor material (approximately lines 223-230):

```typescript
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    color: 0xc8a870,
    emissive: 0x8a6530,
    emissiveIntensity: 0.6,
    roughness: 0.92,
    side: THREE.DoubleSide,
  })
```

With:

```typescript
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    color: 0xf0ece0,
    emissive: 0xd0c8b0,
    emissiveIntensity: 0.3,
    roughness: 0.92,
    side: THREE.DoubleSide,
  })
```

- [ ] **Step 3: Visual verification**

Run: `npm run dev`
Expected: Sand appears bright cream-white with subtle warm variation. Pebbles are lighter (barely noticeable dark grains instead of prominent dark spots).

- [ ] **Step 4: Commit**

```bash
git add src/scene/tank.ts
git commit -m "feat(sand): update sand color to white aragonite"
```

---

### Task 3: Replace flat plane with displaced sand geometry

**Files:**
- Modify: `src/scene/tank.ts:222-235` (floor geometry creation)

This task replaces the flat `PlaneGeometry` with a subdivided one and applies FBM vertex displacement for subtle undulations.

- [ ] **Step 1: Replace flat floor geometry with subdivided displaced plane**

Replace the floor geometry and mesh creation (lines 222-235):

```typescript
  const floorGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    color: 0xf0ece0,
    emissive: 0xd0c8b0,
    emissiveIntensity: 0.3,
    roughness: 0.92,
    side: THREE.DoubleSide,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -TANK.height / 2
  floor.receiveShadow = true
  scene.add(floor)
```

With:

```typescript
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    color: 0xf0ece0,
    emissive: 0xd0c8b0,
    emissiveIntensity: 0.3,
    roughness: 0.92,
    side: THREE.DoubleSide,
  })

  // Subdivided plane for vertex displacement
  const floorGeo = new THREE.PlaneGeometry(
    TANK.width, TANK.depth,
    TANK.sand.segmentsX, TANK.sand.segmentsZ,
  )
  const floorPos = floorGeo.attributes.position as THREE.BufferAttribute

  // Displace vertices with FBM noise for subtle undulations
  // PlaneGeometry is in X-Y plane. After rotation -PI/2 around X:
  //   world_x = local_x, world_z = -local_y, world_y = mesh.position.y + local_z
  // So we modify local Z to create world-Y displacement.
  for (let i = 0; i < floorPos.count; i++) {
    const lx = floorPos.getX(i)
    const ly = floorPos.getY(i)
    // Normalize to 0-1 range for noise input
    const u = (lx + TANK.width / 2) / TANK.width
    const v = (ly + TANK.depth / 2) / TANK.depth
    // Large-scale undulation
    const dune = fbm(u * 6, v * 6) * TANK.sand.undulation
    // Fine grain variation
    const fine = fbm(u * 25 + 7.3, v * 25 + 3.1) * TANK.sand.grain
    floorPos.setZ(i, dune + fine)
  }
  floorGeo.computeVertexNormals()

  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = SAND_SURFACE_Y
  floor.receiveShadow = true
  scene.add(floor)
```

- [ ] **Step 2: Visual verification**

Run: `npm run dev`
Expected: Sand surface is now at a higher Y position (-3.5 vs -4.5) with gentle, barely perceptible undulations. It sits visibly above the bottom frame bars.

- [ ] **Step 3: Commit**

```bash
git add src/scene/tank.ts
git commit -m "feat(sand): replace flat plane with subdivided displaced geometry"
```

---

### Task 4: Add side panels for visible sand thickness

**Files:**
- Modify: `src/scene/tank.ts` (after floor creation, before water surface)
- Modify: `src/scene/tank.ts:11-20` (TankMeshes interface)

Side panels create visible sand depth through the glass — a strip whose top edge follows the displaced sand surface and whose bottom edge sits at the tank floor.

- [ ] **Step 1: Update TankMeshes interface**

Replace the TankMeshes interface (lines 11-20):

```typescript
export interface TankMeshes {
  backWall: THREE.Mesh
  leftWall: THREE.Mesh
  rightWall: THREE.Mesh
  floor: THREE.Mesh
  waterSurface: Water
  topWater: THREE.Mesh
  frontGlass: THREE.Mesh
  waterLines: THREE.Mesh[]
}
```

With:

```typescript
export interface TankMeshes {
  backWall: THREE.Mesh
  leftWall: THREE.Mesh
  rightWall: THREE.Mesh
  floor: THREE.Mesh
  sandPanels: THREE.Mesh[]
  waterSurface: Water
  topWater: THREE.Mesh
  frontGlass: THREE.Mesh
  waterLines: THREE.Mesh[]
}
```

- [ ] **Step 2: Add helper function to build a sand side panel**

Add this function inside `createTank`, right after the floor mesh is added to the scene and before the water surface section. This function builds a strip geometry from an array of top-edge points down to the tank floor:

```typescript
  // --- Sand side panels (visible cross-section through glass) ---
  function buildSandPanel(
    edgePoints: { wx: number; wy: number; wz: number }[],
  ): THREE.BufferGeometry {
    // Each edge point generates two vertices: top (displaced surface) and bottom (tank floor)
    const vertCount = edgePoints.length * 2
    const positions = new Float32Array(vertCount * 3)
    const uvs = new Float32Array(vertCount * 2)
    const tankFloorY = -TANK.height / 2
    const panelHeight = SAND_SURFACE_Y - tankFloorY + TANK.sand.undulation

    for (let i = 0; i < edgePoints.length; i++) {
      const p = edgePoints[i]
      const topIdx = i * 2
      const botIdx = i * 2 + 1

      // Top vertex (displaced surface)
      positions[topIdx * 3] = p.wx
      positions[topIdx * 3 + 1] = p.wy
      positions[topIdx * 3 + 2] = p.wz

      // Bottom vertex (tank floor)
      positions[botIdx * 3] = p.wx
      positions[botIdx * 3 + 1] = tankFloorY
      positions[botIdx * 3 + 2] = p.wz

      // UVs — horizontal spread, vertical from 0 (bottom) to 1 (top)
      const u = i / (edgePoints.length - 1)
      uvs[topIdx * 2] = u * 3 // tile horizontally
      uvs[topIdx * 2 + 1] = 1
      uvs[botIdx * 2] = u * 3
      uvs[botIdx * 2 + 1] = 0
    }

    // Build triangle indices: two triangles per quad
    const quadCount = edgePoints.length - 1
    const indices: number[] = []
    for (let i = 0; i < quadCount; i++) {
      const tl = i * 2
      const bl = i * 2 + 1
      const tr = (i + 1) * 2
      const br = (i + 1) * 2 + 1
      indices.push(tl, bl, tr)
      indices.push(tr, bl, br)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }
```

- [ ] **Step 3: Extract edge points from displaced floor and create panels**

Add this code right after the `buildSandPanel` helper, still inside `createTank`:

```typescript
  // Extract displaced edge vertices from the floor plane (in world coords).
  // PlaneGeometry with rotation -PI/2 around X at position.y = SAND_SURFACE_Y:
  //   world_x = local_x
  //   world_y = SAND_SURFACE_Y + local_z (the displacement)
  //   world_z = -local_y
  const segX = TANK.sand.segmentsX
  const segZ = TANK.sand.segmentsZ
  const colCount = segX + 1  // vertices per row
  const rowCount = segZ + 1  // vertices per column

  // Front edge: last row of vertices (local_y = +TANK.depth/2 → world_z = -TANK.depth/2)
  // Wait — PlaneGeometry rows go from +height/2 to -height/2 (top to bottom in local Y).
  // Row 0 has local_y = +TANK.depth/2 → world_z = -TANK.depth/2 (back of tank)
  // Last row has local_y = -TANK.depth/2 → world_z = +TANK.depth/2 (front of tank)
  const frontEdge: { wx: number; wy: number; wz: number }[] = []
  for (let col = 0; col < colCount; col++) {
    const idx = (rowCount - 1) * colCount + col
    const lx = floorPos.getX(idx)
    const lz = floorPos.getZ(idx) // displacement
    frontEdge.push({ wx: lx, wy: SAND_SURFACE_Y + lz, wz: TANK.depth / 2 })
  }

  // Left edge: first column (local_x = -TANK.width/2)
  const leftEdge: { wx: number; wy: number; wz: number }[] = []
  for (let row = 0; row < rowCount; row++) {
    const idx = row * colCount
    const ly = floorPos.getY(idx)
    const lz = floorPos.getZ(idx)
    leftEdge.push({ wx: -TANK.width / 2, wy: SAND_SURFACE_Y + lz, wz: -ly })
  }

  // Right edge: last column (local_x = +TANK.width/2)
  const rightEdge: { wx: number; wy: number; wz: number }[] = []
  for (let row = 0; row < rowCount; row++) {
    const idx = row * colCount + segX
    const ly = floorPos.getY(idx)
    const lz = floorPos.getZ(idx)
    rightEdge.push({ wx: TANK.width / 2, wy: SAND_SURFACE_Y + lz, wz: -ly })
  }

  const sandPanels: THREE.Mesh[] = []
  for (const edge of [frontEdge, leftEdge, rightEdge]) {
    const panelGeo = buildSandPanel(edge)
    const panel = new THREE.Mesh(panelGeo, floorMat)
    panel.receiveShadow = true
    scene.add(panel)
    sandPanels.push(panel)
  }
```

- [ ] **Step 4: Update the return statement**

In the return statement at the end of `createTank`, add `sandPanels`:

```typescript
  return { backWall, leftWall, rightWall, floor, sandPanels, waterSurface, topWater, frontGlass, waterLines }
```

- [ ] **Step 5: Visual verification**

Run: `npm run dev`
Expected: Looking through the front glass, a visible band of white sand is seen at the bottom of the tank. The top edge of this band follows the subtle undulations of the sand surface. The sides also show sand depth.

- [ ] **Step 6: Run type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/scene/tank.ts
git commit -m "feat(sand): add side panels for visible sand bed thickness"
```

---

### Task 5: Add decoration mounding

**Files:**
- Modify: `src/scene/tank.ts` (add exported mounding function)
- Modify: `src/main.ts:411-421` (call mounding after decoration restore)

- [ ] **Step 1: Export mounding function from tank.ts**

Add this exported function at the end of `src/scene/tank.ts`, after the `updateWaterSurface` function:

```typescript
/**
 * Raises sand vertices near decoration positions to create natural mounding.
 * Call after decorations are placed. Mutates the floor and panel geometries.
 */
export function moundSandAroundDecorations(
  meshes: TankMeshes,
  decorationWorldPositions: THREE.Vector3[],
): void {
  if (decorationWorldPositions.length === 0) return

  const floorGeo = meshes.floor.geometry as THREE.PlaneGeometry
  const floorPos = floorGeo.attributes.position as THREE.BufferAttribute
  const radius = TANK.sand.moundRadius
  const peakHeight = TANK.sand.moundHeight

  // Displace floor vertices near decorations
  for (let i = 0; i < floorPos.count; i++) {
    const lx = floorPos.getX(i)
    const ly = floorPos.getY(i)
    // Convert to world XZ: world_x = lx, world_z = -ly
    const wx = lx
    const wz = -ly

    let maxRaise = 0
    for (const dpos of decorationWorldPositions) {
      const dx = wx - dpos.x
      const dz = wz - dpos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < radius) {
        // Smooth cosine falloff
        const t = dist / radius
        const raise = peakHeight * (Math.cos(t * Math.PI) * 0.5 + 0.5)
        maxRaise = Math.max(maxRaise, raise)
      }
    }

    if (maxRaise > 0) {
      floorPos.setZ(i, floorPos.getZ(i) + maxRaise)
    }
  }

  floorPos.needsUpdate = true
  floorGeo.computeVertexNormals()

  // Rebuild side panels to match updated surface
  const segX = TANK.sand.segmentsX
  const segZ = TANK.sand.segmentsZ
  const colCount = segX + 1
  const rowCount = segZ + 1

  // Update front panel (sandPanels[0])
  const frontPanel = meshes.sandPanels[0]
  const frontPanelPos = frontPanel.geometry.attributes.position as THREE.BufferAttribute
  for (let col = 0; col < colCount; col++) {
    const floorIdx = (rowCount - 1) * colCount + col
    const lz = floorPos.getZ(floorIdx)
    const topIdx = col * 2
    frontPanelPos.setY(topIdx, SAND_SURFACE_Y + lz)
  }
  frontPanelPos.needsUpdate = true
  frontPanel.geometry.computeVertexNormals()

  // Update left panel (sandPanels[1])
  const leftPanel = meshes.sandPanels[1]
  const leftPanelPos = leftPanel.geometry.attributes.position as THREE.BufferAttribute
  for (let row = 0; row < rowCount; row++) {
    const floorIdx = row * colCount
    const lz = floorPos.getZ(floorIdx)
    const topIdx = row * 2
    leftPanelPos.setY(topIdx, SAND_SURFACE_Y + lz)
  }
  leftPanelPos.needsUpdate = true
  leftPanel.geometry.computeVertexNormals()

  // Update right panel (sandPanels[2])
  const rightPanel = meshes.sandPanels[2]
  const rightPanelPos = rightPanel.geometry.attributes.position as THREE.BufferAttribute
  for (let row = 0; row < rowCount; row++) {
    const floorIdx = row * colCount + segX
    const lz = floorPos.getZ(floorIdx)
    const topIdx = row * 2
    rightPanelPos.setY(topIdx, SAND_SURFACE_Y + lz)
  }
  rightPanelPos.needsUpdate = true
  rightPanel.geometry.computeVertexNormals()
}
```

- [ ] **Step 2: Wire mounding into main.ts after decoration restore**

In `src/main.ts`, add the import for `moundSandAroundDecorations` and `SAND_SURFACE_Y`. Update the import line (line 6):

```typescript
import { createTank, updateWaterSurface, TANK, SAND_SURFACE_Y, moundSandAroundDecorations } from './scene/tank'
```

Then in the `restoreState` function, add a mounding call after decorations are deserialized. After the decoration loop (after line 418), add:

```typescript
  // Mound sand around placed decorations
  const floorSlotPositions = slotManager.getOccupied()
    .filter(({ index }) => {
      const zone = SLOT_DEFINITIONS[index].zone
      return zone === 'floor_back' || zone === 'floor_front'
    })
    .map(({ index }) => SLOT_DEFINITIONS[index].position)
  moundSandAroundDecorations(tankMeshes, floorSlotPositions)
```

- [ ] **Step 3: Also mound after placing a decoration in edit mode**

In the click handler for slot placement (around line 185), after a successful placement, add mounding. Replace the block:

```typescript
      if (slotManager.place(slotIndex, selectedDecorationId)) {
        const newSlot = slotManager.getSlot(slotIndex)
        if (newSlot.mesh) {
          scene.add(newSlot.mesh)
          effects.register(selectedDecorationId, newSlot.mesh, SLOT_DEFINITIONS[slotIndex].zone)
        }
      }
```

With:

```typescript
      if (slotManager.place(slotIndex, selectedDecorationId)) {
        const newSlot = slotManager.getSlot(slotIndex)
        if (newSlot.mesh) {
          scene.add(newSlot.mesh)
          effects.register(selectedDecorationId, newSlot.mesh, SLOT_DEFINITIONS[slotIndex].zone)
        }
        // Re-mound sand around all floor decorations
        const floorPositions = slotManager.getOccupied()
          .filter(({ index: idx }) => {
            const zone = SLOT_DEFINITIONS[idx].zone
            return zone === 'floor_back' || zone === 'floor_front'
          })
          .map(({ index: idx }) => SLOT_DEFINITIONS[idx].position)
        moundSandAroundDecorations(tankMeshes, floorPositions)
      }
```

Note: Since `moundSandAroundDecorations` adds to existing displacement, we need to reset the displacement before re-mounding when decorations change. This is handled in the next step.

- [ ] **Step 4: Add displacement reset to mounding function**

The mounding function currently adds to existing displacement, which means calling it multiple times would stack. We need to store the base displacement and reset to it before applying mounds. Update the mounding function's approach:

In `src/scene/tank.ts`, add a module-level variable to store base displacements, right before the `moundSandAroundDecorations` function:

```typescript
let baseDisplacements: Float32Array | null = null
```

At the end of the floor displacement loop in `createTank` (after the `for` loop that sets `floorPos.setZ`, before `floorGeo.computeVertexNormals()`), add:

```typescript
  // Store base displacements for later mounding reset
  baseDisplacements = new Float32Array(floorPos.count)
  for (let i = 0; i < floorPos.count; i++) {
    baseDisplacements[i] = floorPos.getZ(i)
  }
```

Then at the start of `moundSandAroundDecorations`, before the vertex loop, add a reset step:

```typescript
  // Reset to base displacement before applying mounds
  if (baseDisplacements) {
    for (let i = 0; i < floorPos.count; i++) {
      floorPos.setZ(i, baseDisplacements[i])
    }
  }
```

- [ ] **Step 5: Visual verification**

Run: `npm run dev`
Expected: Sand surface gently mounds upward around floor decorations. Adding/removing decorations in edit mode updates the mounding. The side panels follow the mounded contour.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/scene/tank.ts src/main.ts
git commit -m "feat(sand): add decoration mounding with smooth cosine falloff"
```

---

### Task 6: Update dependent systems to use SAND_SURFACE_Y

**Files:**
- Modify: `src/feeding/flakes.ts:94,113-114`
- Modify: `src/fish/behaviors.ts:128,157`
- Modify: `src/fish/fish.ts:181,215`
- Modify: `src/scene/lighting.ts:53-54`
- Modify: `src/scene/underwater.ts:382`
- Modify: `src/decorations/slots.ts:37-38`

- [ ] **Step 1: Update flakes floor Y**

In `src/feeding/flakes.ts`, add the import at line 2:

```typescript
import { TANK, SAND_SURFACE_Y } from '../scene/tank'
```

Replace the old import (line 2):
```typescript
import { TANK } from '../scene/tank'
```

Then replace line 94:

```typescript
    const floorY = -TANK.height / 2
```

With:

```typescript
    const floorY = SAND_SURFACE_Y
```

- [ ] **Step 2: Update bottom-dweller behavior floor Y**

In `src/fish/behaviors.ts`, add `SAND_SURFACE_Y` to the import (line 4):

```typescript
import { TANK, SAND_SURFACE_Y } from '../scene/tank'
```

Replace line 128:

```typescript
  const floorY = -TANK.height / 2
```

With:

```typescript
  const floorY = SAND_SURFACE_Y
```

Also update the drift behavior lower bound (line 157):

```typescript
  const minY = -TANK.height / 2 + TANK.height * 0.4
```

With:

```typescript
  const minY = SAND_SURFACE_Y + TANK.height * 0.3
```

- [ ] **Step 3: Update fish Y boundary clamping**

In `src/fish/fish.ts`, add `SAND_SURFACE_Y` to the TANK import. Then update the Y lower bound in `applyWallAvoidance` and `clampToTank`.

In `applyWallAvoidance` (around line 181), the lower Y bound is computed as `-hh + margin`. We need to use `SAND_SURFACE_Y + m` instead:

Replace the Y avoidance block (approximately lines 194-199):

```typescript
    if (pos.y > hh - margin) {
      const t = (pos.y - (hh - margin)) / margin
      this.targetVelocity.y -= strength * t * t
    } else if (pos.y < -hh + margin) {
      const t = ((-hh + margin) - pos.y) / margin
      this.targetVelocity.y += strength * t * t
    }
```

With:

```typescript
    if (pos.y > hh - margin) {
      const t = (pos.y - (hh - margin)) / margin
      this.targetVelocity.y -= strength * t * t
    }
    const sandFloor = SAND_SURFACE_Y + m
    if (pos.y < sandFloor + margin) {
      const t = ((sandFloor + margin) - pos.y) / margin
      this.targetVelocity.y += strength * t * t
    }
```

In `clampToTank` (around line 220), update the Y lower clamp:

Replace:

```typescript
    if (pos.y < -hh) { pos.y = -hh; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
```

With:

```typescript
    const sandFloorClamp = SAND_SURFACE_Y + m
    if (pos.y < sandFloorClamp) { pos.y = sandFloorClamp; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
```

- [ ] **Step 4: Update bottom light position**

In `src/scene/lighting.ts`, add the import:

```typescript
import { TANK, SAND_SURFACE_Y } from './tank'
```

Replace lines 53-54:

```typescript
  const bottomLight = new THREE.DirectionalLight(0x88bbdd, 3.0)
  bottomLight.position.set(0, -TANK.height / 2, 0)
```

With:

```typescript
  const bottomLight = new THREE.DirectionalLight(0x88bbdd, 3.0)
  bottomLight.position.set(0, SAND_SURFACE_Y, 0)
```

- [ ] **Step 5: Update caustic overlay position**

In `src/scene/underwater.ts`, add `SAND_SURFACE_Y` to the import:

```typescript
import { TANK, SAND_SURFACE_Y } from './tank'
```

Replace line 382:

```typescript
  causticFloorMesh.position.y = -TANK.height / 2 + 0.02
```

With:

```typescript
  causticFloorMesh.position.y = SAND_SURFACE_Y + 0.02
```

- [ ] **Step 6: Update decoration slot positions**

In `src/decorations/slots.ts`, add `SAND_SURFACE_Y` to the import:

```typescript
import { TANK, SAND_SURFACE_Y } from '../scene/tank'
```

Replace lines 37-38:

```typescript
  ...makeSlots('floor_back', 5, -HH + 0.01, -HD + 1.5, ['small', 'medium', 'large']),
  ...makeSlots('floor_front', 5, -HH + 0.01, HD - 2.0, ['small', 'medium']),
```

With:

```typescript
  ...makeSlots('floor_back', 5, SAND_SURFACE_Y + 0.01, -HD + 1.5, ['small', 'medium', 'large']),
  ...makeSlots('floor_front', 5, SAND_SURFACE_Y + 0.01, HD - 2.0, ['small', 'medium']),
```

- [ ] **Step 7: Run type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No type errors, all tests pass. (Slot tests may need attention if they check exact Y values — check test output.)

- [ ] **Step 8: Visual verification**

Run: `npm run dev`
Expected: 
- Fish swim above the sand surface (none clip through)
- Bottom-dwelling fish (catfish) glide along the sand surface
- Flakes settle on the visible sand, not below it
- Caustic light patterns play on the sand surface
- Decorations sit on top of the sand
- Bottom light illuminates upward from sand level

- [ ] **Step 9: Commit**

```bash
git add src/feeding/flakes.ts src/fish/behaviors.ts src/fish/fish.ts src/scene/lighting.ts src/scene/underwater.ts src/decorations/slots.ts
git commit -m "feat(sand): update all systems to use SAND_SURFACE_Y"
```

---

### Task 7: Update slot indicator positions and water plane for feeding

**Files:**
- Modify: `src/main.ts:128-143,201`

- [ ] **Step 1: Update slot indicator positions**

The slot indicators in main.ts are created using `SLOT_DEFINITIONS[i].position`, which we already updated in Task 6. No code change needed for the indicators themselves — they use the slot positions directly.

However, the water plane used for feeding click detection (line 201) uses the old floor Y for the intersection plane. This should be the water surface, not the floor. Check current code:

```typescript
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TANK.height / 2)
```

This is the click-to-feed plane. It should actually be at the water *surface* for spawning flakes at the top. Looking at the code, flakes spawn at `TANK.height / 2 - 0.1` (line 54 of flakes.ts), so this plane is for raycasting the water surface. The value `-TANK.height / 2` as the plane constant means the plane is at `y = TANK.height / 2` (the constant is the negative distance from origin). So this is actually already correct — it's the water surface plane, not the floor. No change needed.

- [ ] **Step 2: Verify no other hardcoded floor references remain**

Search for remaining references to `-TANK.height / 2` or `-4.5` across the codebase:

Run: `grep -rn "TANK.height / 2\|TANK\.height/2\|-4\.5" src/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"`

Review the results and confirm all floor references now use `SAND_SURFACE_Y` where appropriate. References to `-TANK.height / 2` for water surface plane, shadow camera bounds, and similar non-floor purposes should remain unchanged.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add src/main.ts
git commit -m "fix(sand): update remaining floor references in main.ts"
```

---

### Task 8: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Visual regression check**

Run: `npm run dev` and verify:

1. Sand is bright white/cream — matches aragonite reference
2. Sand surface has subtle undulations — gentle, barely visible from front
3. Sand sits above bottom frame bars — bars are visually buried
4. Visible sand thickness through front glass — contoured cross-section band
5. Sand mounds gently around floor decorations
6. Fish swim above the sand surface — no clipping
7. Bottom-dwelling fish glide along sand
8. Flakes settle on sand surface
9. Caustics dance on the sand surface
10. No performance regression — smooth 60fps

- [ ] **Step 4: Commit any final fixes**

If any issues found during verification, fix and commit.
