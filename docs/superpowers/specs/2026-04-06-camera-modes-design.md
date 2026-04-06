# Camera Modes — Design Spec

## Overview

Add three camera modes to FishThree: follow-fish (click a fish to track it), free orbit (drag to rotate, scroll to zoom), and preset angles (front, top-down, side) via buttons and keyboard shortcuts. A reset button returns to the default front view.

## Current State

**File:** `src/scene/camera.ts`

The camera is a `PerspectiveCamera` at position `(0, 0.5, 14)` looking at `(0, 0, 0)`. Mouse movement applies subtle parallax (±0.3 units). There is no orbit, zoom, or fish-tracking capability.

**File:** `src/main.ts`

The render loop calls `updateParallax(camera)` each frame. Mouse click events are only handled for edit-mode slot placement.

## Design

### Camera Mode System

**New file:** `src/scene/camera-modes.ts`

A `CameraController` class manages the active mode and transitions between them.

```
type CameraMode = 'default' | 'follow' | 'orbit' | 'preset'
```

The controller owns:
- The current mode
- Smooth transition state (lerping position/target over ~0.5s when switching modes)
- References to the camera and the scene

### Mode: Default (existing)

- Front-facing at `(0, 0.5, 14)`, looking at `(0, 0, 0)`
- Mouse parallax continues to work exactly as it does now
- This is the mode on startup and after pressing Reset

### Mode: Follow-Fish

- **Activation:** Click on a fish mesh (raycast against fish group meshes)
- **Behavior:** Camera follows the fish at a fixed offset behind and slightly above it. The offset is relative to the fish's facing direction:
  - Distance: `3.0` units behind
  - Height: `0.5` units above
  - The camera looks at the fish's position
- **Smoothing:** Camera position lerps toward the target offset each frame (`lerp factor 0.05`)
- **Exit:** Click elsewhere (not on a fish), press Escape, or press the Reset button
- **Edge case:** If the followed fish is removed (via fish list panel), revert to default mode
- **Parallax:** Disabled in follow mode

### Mode: Free Orbit

- **Activation:** Click the orbit button in the sidebar, or press `O` key
- **Behavior:** Uses `OrbitControls` from Three.js (`three/examples/jsm/controls/OrbitControls.js`)
  - Target: `(0, 0, 0)` (tank center)
  - Min distance: `8`, Max distance: `25`
  - Min polar angle: `0.2` (prevent going under the floor), Max polar angle: `Math.PI / 2` (prevent going below tank)
  - Enable damping: `true`, damping factor `0.05`
  - Mouse: left-drag rotates, scroll zooms
- **Exit:** Press Escape, click Reset, or select another mode
- **Parallax:** Disabled in orbit mode

### Mode: Preset Angles

- **Activation:** Keyboard shortcuts or sidebar buttons
- **Presets:**

| Name | Key | Position | Look At |
|------|-----|----------|---------|
| Front | `1` | `(0, 0.5, 14)` | `(0, 0, 0)` |
| Top-down | `2` | `(0, 14, 0.1)` | `(0, 0, 0)` |
| Left side | `3` | `(-14, 0.5, 0)` | `(0, 0, 0)` |
| Right side | `4` | `(14, 0.5, 0)` | `(0, 0, 0)` |

- Selecting a preset smoothly transitions the camera (lerp over 0.5s)
- After arriving, the camera is static (no parallax, no orbit)
- **Exit:** Press Escape or Reset to return to default

### Transitions

All mode switches animate the camera smoothly:
- Store the target position + lookAt
- Each frame, lerp `camera.position` and the lookAt target by a smoothing factor
- Once the camera is within `0.01` of the target, snap and mark transition complete
- During transition, no input is processed for the new mode (prevents jank)

### Fish Click Detection

**File:** `src/main.ts`

Add a click handler that raycasts against fish meshes:
1. On click (when not in edit mode), raycast against all `fish.mesh` objects
2. If a fish is hit, enter follow mode targeting that fish
3. If no fish is hit and we're in follow mode, exit to default

The raycast uses the existing `raycaster` already set up in main.ts.

### UI Changes

**File:** `src/ui/hud.ts`

Add to the sidebar (between Screenshot and Settings):

| Button | Icon | Action |
|--------|------|--------|
| Orbit | `🔄` | Toggle orbit mode |
| Reset Camera | `🏠` | Return to default view |

**File:** `src/ui/hud.ts` — Add keyboard shortcut hints as tooltips.

### HUD Callbacks

Add to `HUDCallbacks`:
- `onOrbitToggle: () => void`
- `onResetCamera: () => void`

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Front preset |
| `2` | Top-down preset |
| `3` | Left side preset |
| `4` | Right side preset |
| `O` | Toggle orbit mode |
| `Escape` | Return to default mode |

Keyboard handling lives in `camera-modes.ts`. Shortcuts are disabled when an input field is focused (tank name, panels).

### Render Loop Integration

**File:** `src/main.ts`

Replace the direct `updateParallax(camera)` call with `cameraController.update(dt)`. The controller internally calls `updateParallax` only when in default mode.

### State Persistence

Camera mode is NOT persisted — always starts in default mode on page load.

## Files Changed

| File | Change |
|------|--------|
| `src/scene/camera-modes.ts` | **New** — CameraController class |
| `src/scene/camera.ts` | Export `BASE_POSITION`, `LOOK_AT` constants for reuse |
| `src/main.ts` | Add fish click handler, replace parallax call, wire up camera controller |
| `src/ui/hud.ts` | Add orbit + reset buttons to sidebar |

## Performance

OrbitControls is lightweight. No performance concern — it's just camera math.

## Scope Boundary

- No cinematic camera paths or auto-tour
- No picture-in-picture or split-screen views
- No camera shake or screen effects tied to camera mode
- OrbitControls is only active during orbit mode; it's disabled/disposed in other modes
