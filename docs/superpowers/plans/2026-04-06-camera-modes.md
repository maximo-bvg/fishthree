# Camera Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add follow-fish, free orbit, and preset camera modes with smooth transitions and keyboard shortcuts.

**Architecture:** A `CameraController` class in `src/scene/camera-modes.ts` manages the active mode and transitions. It wraps the existing parallax system and Three.js `OrbitControls`. The controller replaces the direct `updateParallax()` call in the render loop.

**Tech Stack:** Three.js OrbitControls, existing camera/parallax system.

---

## File Structure

| File | Role |
|------|------|
| `src/scene/camera-modes.ts` | **New** — CameraController class with mode management |
| `src/scene/camera.ts` | **Modify** — Export constants for reuse |
| `src/main.ts` | **Modify** — Wire CameraController, add fish click handler |
| `src/ui/hud.ts` | **Modify** — Add orbit + reset buttons to sidebar |

---

### Task 1: Export Camera Constants

**Files:**
- Modify: `src/scene/camera.ts`

- [ ] **Step 1: Export BASE_POSITION and LOOK_AT**

In `src/scene/camera.ts`, change the `const` declarations at lines 3-4 from private to exported:

```typescript
export const BASE_POSITION = new THREE.Vector3(0, 0.5, 14)
export const LOOK_AT = new THREE.Vector3(0, 0, 0)
```

- [ ] **Step 2: Verify the build still works**

Run: `npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scene/camera.ts
git commit -m "refactor: export camera constants for reuse"
```

---

### Task 2: Create CameraController

**Files:**
- Create: `src/scene/camera-modes.ts`

- [ ] **Step 1: Create the CameraController class**

Create `src/scene/camera-modes.ts`:

```typescript
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BASE_POSITION, LOOK_AT, updateParallax } from './camera'

export type CameraMode = 'default' | 'follow' | 'orbit' | 'preset'

interface CameraPreset {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

export const PRESETS: Record<string, CameraPreset> = {
  front:    { position: new THREE.Vector3(0, 0.5, 14),   lookAt: new THREE.Vector3(0, 0, 0) },
  topDown:  { position: new THREE.Vector3(0, 14, 0.1),   lookAt: new THREE.Vector3(0, 0, 0) },
  leftSide: { position: new THREE.Vector3(-14, 0.5, 0),  lookAt: new THREE.Vector3(0, 0, 0) },
  rightSide:{ position: new THREE.Vector3(14, 0.5, 0),   lookAt: new THREE.Vector3(0, 0, 0) },
}

const TRANSITION_SPEED = 0.05
const FOLLOW_DISTANCE = 3.0
const FOLLOW_HEIGHT = 0.5
const SNAP_THRESHOLD = 0.01

export class CameraController {
  mode: CameraMode = 'default'
  private camera: THREE.PerspectiveCamera
  private orbitControls: OrbitControls
  private followTarget: THREE.Object3D | null = null
  private transitioning = false
  private targetPosition = new THREE.Vector3()
  private targetLookAt = new THREE.Vector3()
  private currentLookAt = new THREE.Vector3()
  private onModeChange: ((mode: CameraMode) => void) | null = null

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.currentLookAt.copy(LOOK_AT)

    this.orbitControls = new OrbitControls(camera, domElement)
    this.orbitControls.target.copy(LOOK_AT)
    this.orbitControls.minDistance = 8
    this.orbitControls.maxDistance = 25
    this.orbitControls.minPolarAngle = 0.2
    this.orbitControls.maxPolarAngle = Math.PI / 2
    this.orbitControls.enableDamping = true
    this.orbitControls.dampingFactor = 0.05
    this.orbitControls.enabled = false
  }

  setModeChangeCallback(cb: (mode: CameraMode) => void): void {
    this.onModeChange = cb
  }

  private setMode(mode: CameraMode): void {
    this.mode = mode
    this.onModeChange?.(mode)
  }

  toDefault(): void {
    this.orbitControls.enabled = false
    this.followTarget = null
    this.startTransition(BASE_POSITION, LOOK_AT)
    this.setMode('default')
  }

  toFollow(target: THREE.Object3D): void {
    this.orbitControls.enabled = false
    this.followTarget = target
    this.transitioning = false
    this.setMode('follow')
  }

  toOrbit(): void {
    if (this.mode === 'orbit') {
      this.toDefault()
      return
    }
    this.followTarget = null
    this.orbitControls.target.copy(LOOK_AT)
    this.orbitControls.enabled = true
    this.transitioning = false
    this.setMode('orbit')
  }

  toPreset(name: string): void {
    const preset = PRESETS[name]
    if (!preset) return
    this.orbitControls.enabled = false
    this.followTarget = null
    this.startTransition(preset.position, preset.lookAt)
    this.setMode('preset')
  }

  /** Called when the followed fish is removed from the scene */
  onFollowTargetRemoved(): void {
    if (this.mode === 'follow') {
      this.toDefault()
    }
  }

  private startTransition(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.targetPosition.copy(position)
    this.targetLookAt.copy(lookAt)
    this.transitioning = true
  }

  update(dt: number): void {
    if (this.transitioning) {
      this.camera.position.lerp(this.targetPosition, TRANSITION_SPEED)
      this.currentLookAt.lerp(this.targetLookAt, TRANSITION_SPEED)
      this.camera.lookAt(this.currentLookAt)

      if (
        this.camera.position.distanceTo(this.targetPosition) < SNAP_THRESHOLD &&
        this.currentLookAt.distanceTo(this.targetLookAt) < SNAP_THRESHOLD
      ) {
        this.camera.position.copy(this.targetPosition)
        this.currentLookAt.copy(this.targetLookAt)
        this.camera.lookAt(this.currentLookAt)
        this.transitioning = false
      }
      return
    }

    switch (this.mode) {
      case 'default':
        updateParallax(this.camera)
        break

      case 'follow':
        if (this.followTarget) {
          const fishPos = this.followTarget.position
          const fishDir = new THREE.Vector3(0, 0, -1)
          this.followTarget.getWorldDirection(fishDir)

          const desiredPos = fishPos.clone()
            .sub(fishDir.multiplyScalar(FOLLOW_DISTANCE))
            .add(new THREE.Vector3(0, FOLLOW_HEIGHT, 0))

          this.camera.position.lerp(desiredPos, TRANSITION_SPEED)
          this.currentLookAt.lerp(fishPos, TRANSITION_SPEED)
          this.camera.lookAt(this.currentLookAt)
        }
        break

      case 'orbit':
        this.orbitControls.update()
        break

      case 'preset':
        // Static — camera is already at the preset position after transition
        break
    }
  }

  dispose(): void {
    this.orbitControls.dispose()
  }
}
```

- [ ] **Step 2: Verify the build still works**

Run: `npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scene/camera-modes.ts
git commit -m "feat: add CameraController with follow, orbit, and preset modes"
```

---

### Task 3: Add Keyboard Shortcuts

**Files:**
- Modify: `src/scene/camera-modes.ts`

- [ ] **Step 1: Add keyboard listener to CameraController**

Add this method to the `CameraController` class, and call it at the end of the constructor:

```typescript
  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      // Don't capture keys when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case '1': this.toDefault(); break
        case '2': this.toPreset('topDown'); break
        case '3': this.toPreset('leftSide'); break
        case '4': this.toPreset('rightSide'); break
        case 'o': case 'O': this.toOrbit(); break
        case 'Escape': this.toDefault(); break
      }
    })
  }
```

In the constructor, add at the end:
```typescript
    this.setupKeyboard()
```

- [ ] **Step 2: Verify the build still works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/scene/camera-modes.ts
git commit -m "feat: add keyboard shortcuts for camera modes"
```

---

### Task 4: Add HUD Buttons

**Files:**
- Modify: `src/ui/hud.ts`

- [ ] **Step 1: Add orbit and reset callbacks to HUDCallbacks**

In `src/ui/hud.ts`, add to the `HUDCallbacks` interface:

```typescript
  onOrbitToggle: () => void
  onResetCamera: () => void
```

- [ ] **Step 2: Add buttons to the sidebar**

In the `constructor`, find the `buttons` array (line 50-55) and add two entries between Screenshot and Settings:

```typescript
    const buttons: { icon: string; action: () => void; title: string }[] = [
      { icon: '\u{1F41F}', action: callbacks.onFishList, title: 'Fish List' },
      { icon: '\u{2795}',  action: callbacks.onAddFish,  title: 'Add Fish' },
      { icon: '\u{1F4F7}', action: callbacks.onScreenshot, title: 'Screenshot' },
      { icon: '\u{1F504}', action: callbacks.onOrbitToggle, title: 'Orbit Camera (O)' },
      { icon: '\u{1F3E0}', action: callbacks.onResetCamera, title: 'Reset Camera (1)' },
      { icon: '\u{2699}',  action: callbacks.onSettings, title: 'Settings' },
    ]
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat: add orbit and reset camera buttons to HUD sidebar"
```

---

### Task 5: Wire CameraController into Main

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import and create CameraController**

Add import at the top of `src/main.ts`:

```typescript
import { CameraController } from './scene/camera-modes'
```

After `const camera = createCamera(...)` (line 47), create the controller:

```typescript
const cameraController = new CameraController(camera, renderer.domElement)
```

- [ ] **Step 2: Replace updateParallax call**

In the `animate()` function, replace:

```typescript
  updateParallax(camera)
```

with:

```typescript
  cameraController.update(dt)
```

- [ ] **Step 3: Add fish click handler**

After the existing click handler for slot placement (after line 177), add a new click handler:

```typescript
window.addEventListener('click', (e) => {
  if (isEditMode) return

  raycaster.setFromCamera(
    new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    ),
    camera,
  )

  const fishMeshes = fishes.map(f => f.mesh)
  const hits = raycaster.intersectObjects(fishMeshes, true)
  if (hits.length > 0) {
    // Find which fish owns the hit mesh
    const hitObj = hits[0].object
    const fish = fishes.find(f => {
      let obj: THREE.Object3D | null = hitObj
      while (obj) {
        if (obj === f.mesh) return true
        obj = obj.parent
      }
      return false
    })
    if (fish) {
      cameraController.toFollow(fish.mesh)
      return
    }
  }

  // Clicked empty space — if in follow mode, return to default
  if (cameraController.mode === 'follow') {
    cameraController.toDefault()
  }
})
```

- [ ] **Step 4: Wire HUD callbacks**

In the `HUD` constructor call, add the two new callbacks:

```typescript
  onOrbitToggle: () => cameraController.toOrbit(),
  onResetCamera: () => cameraController.toDefault(),
```

- [ ] **Step 5: Handle followed fish removal**

In the `removeFish` function, after removing the fish from the scene, add:

```typescript
  cameraController.onFollowTargetRemoved()
```

(Add this check: if the removed fish's mesh was the follow target, revert to default.)

- [ ] **Step 6: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire CameraController into render loop with fish click tracking"
```

---

### Task 6: Manual Testing

- [ ] **Step 1: Test default mode**

Run: `npx vite dev`

Open in browser. Verify the tank renders normally with mouse parallax.

- [ ] **Step 2: Test follow-fish mode**

Click on a fish. Verify the camera smoothly transitions to follow behind it. Click empty space — verify camera returns to default.

- [ ] **Step 3: Test orbit mode**

Press `O` or click the orbit button. Drag to rotate around the tank. Scroll to zoom. Press Escape — verify camera returns to default.

- [ ] **Step 4: Test presets**

Press `2` (top-down), `3` (left side), `4` (right side), `1` (front/default). Verify each smoothly transitions.

- [ ] **Step 5: Test edge cases**

- Follow a fish, then remove it via fish list panel — camera should revert to default
- Enter edit mode while in orbit — orbit should still work (or be disabled, verify no crash)
- Resize window during orbit — should not break

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: camera modes polish after manual testing"
```
