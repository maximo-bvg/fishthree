# Day/Night Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 12-minute accelerated day/night cycle that smoothly shifts lighting, colors, fog, and fish behavior through dawn/day/dusk/night phases.

**Architecture:** A `DayNightCycle` class in `src/scene/day-night.ts` tracks normalized time `[0,1)` and interpolates between keyframed lighting states. It updates all scene lights, fog, and background each frame. Fish receive a `timeOfDay` context field that modifies their speed.

**Tech Stack:** Three.js lights and scene properties, existing lighting system.

---

## File Structure

| File | Role |
|------|------|
| `src/scene/day-night.ts` | **New** — DayNightCycle class |
| `src/scene/lighting.ts` | **Modify** — Export all lights |
| `src/scene/underwater.ts` | **Modify** — Add water tint uniform |
| `src/fish/fish.ts` | **Modify** — Add timeOfDay to StateContext, speed multiplier |
| `src/main.ts` | **Modify** — Wire DayNightCycle into render loop |
| `src/ui/hud.ts` | **Modify** — Add time-of-day icon |

---

### Task 1: Export All Lights

**Files:**
- Modify: `src/scene/lighting.ts`

- [ ] **Step 1: Expand the Lights interface**

In `src/scene/lighting.ts`, update the `Lights` interface:

```typescript
export interface Lights {
  ambient: THREE.AmbientLight
  overhead: THREE.DirectionalLight
  causticLight: THREE.SpotLight
  hemisphere: THREE.HemisphereLight
  frontFill: THREE.DirectionalLight
  leftFill: THREE.DirectionalLight
  rightFill: THREE.DirectionalLight
  bottomLight: THREE.DirectionalLight
}
```

- [ ] **Step 2: Return all lights from createLighting**

Update the return statement of `createLighting` to include all lights. Assign each light to a named variable first (some already are, some need names). The function body should assign:

```typescript
  return { ambient, overhead, causticLight, hemisphere: hemi, frontFill: fill, leftFill, rightFill, bottomLight }
```

- [ ] **Step 3: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds (existing code only uses `ambient`, `overhead`, `causticLight` from the return value).

- [ ] **Step 4: Commit**

```bash
git add src/scene/lighting.ts
git commit -m "refactor: export all lights from createLighting for day/night control"
```

---

### Task 2: Create DayNightCycle

**Files:**
- Create: `src/scene/day-night.ts`

- [ ] **Step 1: Create the DayNightCycle class**

Create `src/scene/day-night.ts`:

```typescript
import * as THREE from 'three'
import { type Lights } from './lighting'

export type TimePhase = 'night' | 'dawn' | 'day' | 'dusk'

const CYCLE_DURATION = 720 // 12 minutes in seconds
const START_TIME = 0.35 // mid-morning

interface LightingKeyframe {
  t: number
  ambientColor: THREE.Color
  ambientIntensity: number
  overheadColor: THREE.Color
  overheadIntensity: number
  hemiSkyColor: THREE.Color
  hemiGroundColor: THREE.Color
  hemiIntensity: number
  fogColor: THREE.Color
  backgroundColor: THREE.Color
  causticIntensity: number
  fillScale: number // multiplier for fill lights relative to their base intensity
  waterTint: THREE.Color
}

function kf(
  t: number,
  ambientColor: number, ambientIntensity: number,
  overheadColor: number, overheadIntensity: number,
  hemiSkyColor: number, hemiGroundColor: number, hemiIntensity: number,
  fogColor: number, backgroundColor: number,
  causticIntensity: number, fillScale: number,
  waterTint: number,
): LightingKeyframe {
  return {
    t,
    ambientColor: new THREE.Color(ambientColor),
    ambientIntensity,
    overheadColor: new THREE.Color(overheadColor),
    overheadIntensity,
    hemiSkyColor: new THREE.Color(hemiSkyColor),
    hemiGroundColor: new THREE.Color(hemiGroundColor),
    hemiIntensity,
    fogColor: new THREE.Color(fogColor),
    backgroundColor: new THREE.Color(backgroundColor),
    causticIntensity,
    fillScale,
    waterTint: new THREE.Color(waterTint),
  }
}

//                t    ambCol  ambI  ohdCol  ohdI  hSky    hGnd    hI   fogCol  bgCol   cauI  fill  waterTint
const KEYFRAMES: LightingKeyframe[] = [
  kf(0.0,  0x112244, 1.0,  0x223355, 0.3,  0x112244, 0x112244, 1.5, 0x0a1a2a, 0x0a1a2a, 0.2, 0.15, 0x051535),
  kf(0.25, 0x886655, 2.5,  0xffaa66, 1.5,  0xffaa66, 0x443322, 4.0, 0x2a4a5a, 0x2a4a5a, 0.5, 0.5,  0x153045),
  kf(0.5,  0xaaddee, 4.0,  0xffffff, 2.85, 0xffffff, 0x446688, 8.0, 0x1a7aaa, 0x2a7abb, 0.8, 1.0,  0x1a5a8e),
  kf(0.75, 0x775544, 2.0,  0xff8844, 1.2,  0xff8844, 0x332211, 3.5, 0x2a3a4a, 0x2a3a4a, 0.4, 0.4,  0x153045),
  kf(1.0,  0x112244, 1.0,  0x223355, 0.3,  0x112244, 0x112244, 1.5, 0x0a1a2a, 0x0a1a2a, 0.2, 0.15, 0x051535),
]

// Base fill light intensities (from lighting.ts)
const BASE_FRONT_FILL = 2.0
const BASE_SIDE_FILL = 1.0
const BASE_BOTTOM = 3.0

const _colorA = new THREE.Color()
const _colorB = new THREE.Color()

function lerpKeyframes(a: LightingKeyframe, b: LightingKeyframe, alpha: number): LightingKeyframe {
  return {
    t: THREE.MathUtils.lerp(a.t, b.t, alpha),
    ambientColor: _colorA.copy(a.ambientColor).lerp(b.ambientColor, alpha).clone(),
    ambientIntensity: THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, alpha),
    overheadColor: _colorA.copy(a.overheadColor).lerp(b.overheadColor, alpha).clone(),
    overheadIntensity: THREE.MathUtils.lerp(a.overheadIntensity, b.overheadIntensity, alpha),
    hemiSkyColor: _colorA.copy(a.hemiSkyColor).lerp(b.hemiSkyColor, alpha).clone(),
    hemiGroundColor: _colorA.copy(a.hemiGroundColor).lerp(b.hemiGroundColor, alpha).clone(),
    hemiIntensity: THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, alpha),
    fogColor: _colorA.copy(a.fogColor).lerp(b.fogColor, alpha).clone(),
    backgroundColor: _colorA.copy(a.backgroundColor).lerp(b.backgroundColor, alpha).clone(),
    causticIntensity: THREE.MathUtils.lerp(a.causticIntensity, b.causticIntensity, alpha),
    fillScale: THREE.MathUtils.lerp(a.fillScale, b.fillScale, alpha),
    waterTint: _colorA.copy(a.waterTint).lerp(b.waterTint, alpha).clone(),
  }
}

export class DayNightCycle {
  private t = START_TIME
  private lights: Lights
  private scene: THREE.Scene
  private waterTintTarget = new THREE.Color(0x1a5a8e)

  constructor(lights: Lights, scene: THREE.Scene) {
    this.lights = lights
    this.scene = scene
  }

  getPhase(): TimePhase {
    const t = this.t
    if (t < 0.2 || t >= 0.8) return 'night'
    if (t < 0.3) return 'dawn'
    if (t < 0.7) return 'day'
    return 'dusk'
  }

  getWaterTint(): THREE.Color {
    return this.waterTintTarget
  }

  getSpeedMultiplier(): number {
    switch (this.getPhase()) {
      case 'night': return 0.5
      case 'dawn': return 1.3
      case 'day': return 1.0
      case 'dusk': return 0.8
    }
  }

  update(dt: number): void {
    this.t = (this.t + dt / CYCLE_DURATION) % 1.0

    // Find surrounding keyframes
    let a = KEYFRAMES[KEYFRAMES.length - 2]
    let b = KEYFRAMES[KEYFRAMES.length - 1]
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (this.t >= KEYFRAMES[i].t && this.t < KEYFRAMES[i + 1].t) {
        a = KEYFRAMES[i]
        b = KEYFRAMES[i + 1]
        break
      }
    }

    const alpha = (this.t - a.t) / (b.t - a.t)
    const state = lerpKeyframes(a, b, alpha)

    // Apply to lights
    this.lights.ambient.color.copy(state.ambientColor)
    this.lights.ambient.intensity = state.ambientIntensity

    this.lights.overhead.color.copy(state.overheadColor)
    this.lights.overhead.intensity = state.overheadIntensity

    this.lights.hemisphere.color.copy(state.hemiSkyColor)
    this.lights.hemisphere.groundColor.copy(state.hemiGroundColor)
    this.lights.hemisphere.intensity = state.hemiIntensity

    this.lights.causticLight.intensity = state.causticIntensity

    this.lights.frontFill.intensity = BASE_FRONT_FILL * state.fillScale
    this.lights.leftFill.intensity = BASE_SIDE_FILL * state.fillScale
    this.lights.rightFill.intensity = BASE_SIDE_FILL * state.fillScale
    this.lights.bottomLight.intensity = BASE_BOTTOM * state.fillScale

    // Apply to scene
    ;(this.scene.background as THREE.Color).copy(state.backgroundColor)
    ;(this.scene.fog as THREE.FogExp2).color.copy(state.fogColor)

    // Store water tint for underwater pass
    this.waterTintTarget.copy(state.waterTint)
  }
}
```

- [ ] **Step 2: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/scene/day-night.ts
git commit -m "feat: add DayNightCycle with keyframed lighting interpolation"
```

---

### Task 3: Add Water Tint Uniform to Underwater Pass

**Files:**
- Modify: `src/scene/underwater.ts`

- [ ] **Step 1: Add uWaterTint uniform**

In `src/scene/underwater.ts`, in the `createUnderwaterPass` function, add `uWaterTint` to the uniforms:

```typescript
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uWaterTint: { value: new THREE.Vector3(0.1, 0.35, 0.55) },
    },
```

Update the fragment shader to use the uniform instead of the hardcoded tint:

```glsl
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec3 uWaterTint;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        uv.x += sin(vUv.y * 12.0 + uTime * 1.2) * 0.002;
        uv.y += cos(vUv.x * 10.0 + uTime * 0.9) * 0.0015;

        vec4 color = texture2D(tDiffuse, uv);

        // Underwater color grading — tint toward day/night water color
        color.rgb = mix(color.rgb, uWaterTint, 0.25);

        // Desaturation
        float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(color.rgb, vec3(lum) * vec3(0.5, 0.75, 1.0), 0.2);

        gl_FragColor = color;
      }
```

- [ ] **Step 2: Export a function to update the water tint**

Modify `updateUnderwaterPass` to accept an optional tint:

```typescript
export function updateUnderwaterPass(pass: ShaderPass, time: number, waterTint?: THREE.Color): void {
  pass.uniforms['uTime'].value = time
  if (waterTint) {
    pass.uniforms['uWaterTint'].value.set(waterTint.r, waterTint.g, waterTint.b)
  }
}
```

- [ ] **Step 3: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/scene/underwater.ts
git commit -m "feat: add dynamic water tint uniform to underwater pass"
```

---

### Task 4: Add Time-of-Day to Fish Behavior

**Files:**
- Modify: `src/fish/fish.ts`

- [ ] **Step 1: Add timeOfDay to StateContext**

In `src/fish/fish.ts`, import `TimePhase`:

```typescript
import { type TimePhase } from '../scene/day-night'
```

Add to `StateContext`:

```typescript
export interface StateContext {
  threats: ProximityInfo[]
  shelters: ProximityInfo[]
  school: ProximityInfo[]
  mouse: ProximityInfo | null
  homeDecor: ProximityInfo | null
  timeOfDay: TimePhase
}
```

- [ ] **Step 2: Add speedMultiplier to Fish class**

Add a public field to the `Fish` class:

```typescript
  speedMultiplier = 1.0
```

In the `update` method, apply the multiplier when moving:

Replace:
```typescript
    this.mesh.position.addScaledVector(this.velocity, dt)
```

With:
```typescript
    this.mesh.position.addScaledVector(this.velocity, dt * this.speedMultiplier)
```

- [ ] **Step 3: Verify the build works**

Run: `npx vite build`
Expected: May fail if `nearestFlake` was already added by the feeding feature — if so, keep both fields. Otherwise build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/fish/fish.ts
git commit -m "feat: add timeOfDay to StateContext and speedMultiplier to Fish"
```

---

### Task 5: Add Time-of-Day Icon to HUD

**Files:**
- Modify: `src/ui/hud.ts`

- [ ] **Step 1: Add time icon element**

In the `HUD` class, add a private field:

```typescript
  private timeIcon: HTMLSpanElement
```

In the constructor, after the `stats` element is created and before it's appended to `top`, create the time icon and insert it between the tank name and stats:

```typescript
    this.timeIcon = document.createElement('span')
    this.timeIcon.className = 'time-icon'
    this.timeIcon.textContent = '\u{2600}\u{FE0F}' // sun
    top.insertBefore(this.timeIcon, stats)
```

- [ ] **Step 2: Add updateTimeIcon method**

Add a public method:

```typescript
  updateTimeIcon(phase: 'night' | 'dawn' | 'day' | 'dusk'): void {
    switch (phase) {
      case 'day': this.timeIcon.textContent = '\u{2600}\u{FE0F}'; break
      case 'dawn': case 'dusk': this.timeIcon.textContent = '\u{1F305}'; break
      case 'night': this.timeIcon.textContent = '\u{1F319}'; break
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts
git commit -m "feat: add time-of-day icon to HUD top bar"
```

---

### Task 6: Wire DayNightCycle into Main

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import and create DayNightCycle**

Add import:

```typescript
import { DayNightCycle } from './scene/day-night'
```

After `const lights = createLighting(scene)` (line 49), create the cycle:

```typescript
const dayNight = new DayNightCycle(lights, scene)
```

- [ ] **Step 2: Update render loop**

In the `animate()` function, add after the fish behaviors update:

```typescript
  dayNight.update(dt)
  hud.updateTimeIcon(dayNight.getPhase())
```

Update the `updateUnderwaterPass` call to pass the water tint:

```typescript
  updateUnderwaterPass(underwaterPass, elapsed, dayNight.getWaterTint())
```

- [ ] **Step 3: Pass timeOfDay to fish context**

In `updateFishBehaviors`, add `timeOfDay` to the `StateContext`:

```typescript
      timeOfDay: dayNight.getPhase(),
```

After the state machine update, apply the speed multiplier:

```typescript
    fish.speedMultiplier = dayNight.getSpeedMultiplier()
```

- [ ] **Step 4: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire day/night cycle into render loop and fish behaviors"
```

---

### Task 7: Manual Testing

- [ ] **Step 1: Watch a full cycle**

Run: `npx vite dev`

Open in browser. Wait and watch for 12 minutes (or reduce `CYCLE_DURATION` to 60 temporarily for faster testing). Verify:
- Lighting smoothly transitions through dawn → day → dusk → night
- Background and fog colors change
- Fish slow down at night, speed up at dawn
- The time icon changes (sun/sunrise/moon)

- [ ] **Step 2: Verify no visual glitches**

- Check that the transition from night→dawn and dusk→night is smooth (no sudden jumps)
- Check that the underwater color grading shifts subtly
- Verify caustics dim at night

- [ ] **Step 3: Reset CYCLE_DURATION if changed**

Make sure `CYCLE_DURATION` is back to `720`.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: day/night cycle polish after manual testing"
```
