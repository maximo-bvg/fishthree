# Day/Night Cycle — Design Spec

## Overview

An accelerated day/night cycle that completes in ~12 minutes. Lighting, colors, and fish behavior shift through four phases: dawn, day, dusk, night. The tank feels alive even when you're just watching.

## Current State

**File:** `src/scene/lighting.ts`

The scene has: ambient light (`0xaaddee`, intensity `4.0`), hemisphere light (`8.0`), overhead directional (`2.85`), front fill (`2.0`), side fills (`1.0` each), bottom light (`3.0`), and a caustic spotlight. All intensities and colors are fixed.

**File:** `src/main.ts`

The render loop uses `clock.getElapsedTime()` for time. Scene background is `0x2a7abb` and fog is `FogExp2(0x1a7aaa, 0.05)`.

## Design

### Time System

**New file:** `src/scene/day-night.ts`

A `DayNightCycle` class tracks the current time of day and applies lighting changes.

#### Time Model

- Full cycle: `720` seconds (12 minutes)
- Time is stored as a normalized value `t ∈ [0, 1)` where:
  - `0.0` = midnight
  - `0.25` = dawn (6:00 AM)
  - `0.5` = noon
  - `0.75` = dusk (6:00 PM)
- Starts at `t = 0.35` (mid-morning) so the player sees a bright tank on load

#### Phases

| Phase | Range | Duration |
|-------|-------|----------|
| Night | `0.0 – 0.2` | 2.4 min |
| Dawn | `0.2 – 0.3` | 1.2 min |
| Day | `0.3 – 0.7` | 4.8 min |
| Dusk | `0.7 – 0.8` | 1.2 min |
| Night | `0.8 – 1.0` | 2.4 min |

### Lighting Interpolation

The cycle smoothly interpolates between keyframed lighting states. Each keyframe defines:

```typescript
interface LightingKeyframe {
  t: number                    // time position [0, 1]
  ambientColor: number         // ambient light color
  ambientIntensity: number
  overheadColor: number
  overheadIntensity: number
  hemiSkyColor: number
  hemiGroundColor: number
  hemiIntensity: number
  fogColor: number
  backgroundColor: number
  causticIntensity: number
}
```

#### Keyframes

| Time | Phase | Ambient | Overhead | Fog/BG | Mood |
|------|-------|---------|----------|--------|------|
| `0.0` | Midnight | `0x112244` @ 1.0 | `0x223355` @ 0.3 | `0x0a1a2a` | Deep blue, very dim |
| `0.25` | Dawn | `0x886655` @ 2.5 | `0xffaa66` @ 1.5 | `0x2a4a5a` | Warm orange creeping in |
| `0.5` | Noon | `0xaaddee` @ 4.0 | `0xffffff` @ 2.85 | `0x2a7abb` | Current bright daytime (unchanged) |
| `0.75` | Dusk | `0x775544` @ 2.0 | `0xff8844` @ 1.2 | `0x2a3a4a` | Warm, dimming |
| `1.0` | Midnight | same as `0.0` | same as `0.0` | same as `0.0` | Wraps |

Between keyframes, all values are linearly interpolated (colors via `THREE.Color.lerpColors`).

### Lights Modified

The `DayNightCycle` receives the `Lights` interface plus additional references:

- `lights.ambient` — color + intensity
- `lights.overhead` — color + intensity
- Hemisphere light — needs to be added to the `Lights` interface (currently created but not exported)
- `lights.causticLight` — intensity only
- `scene.background` — color
- `scene.fog` — color
- Fill lights — scale intensity proportionally (e.g., fill intensities = base × `overheadIntensity / 2.85`)
- Bottom light — scale proportionally

### Changes to `lighting.ts`

Export the hemisphere light, fill lights, and bottom light by adding them to the `Lights` interface:

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

### Fish Behavior Changes

**File:** `src/fish/fish.ts`

Add time-of-day awareness to `StateContext`:

```typescript
timeOfDay: 'night' | 'dawn' | 'day' | 'dusk'
```

Behavior changes:
- **Night:** All fish move at `0.5x` speed. Schooling fish break formation and drift independently. Shy fish (pufferfish) always hide if shelters exist.
- **Dawn:** Fish gradually speed up. Schooling resumes. Brief "activity burst" — wander speed at `1.3x` for the dawn phase.
- **Day:** Normal behavior (current implementation, no changes).
- **Dusk:** Fish begin slowing (`0.8x` speed). Territorial fish return closer to their home decorations.

These modifiers are applied as a `speedMultiplier` on `fish.species.speed` rather than changing the behavior logic itself.

### Underwater Effects Changes

The underwater post-processing pass tint should shift with time of day:
- Day: current blue-green tint (`0.1, 0.35, 0.55`)
- Night: deeper blue tint (`0.05, 0.15, 0.35`)
- Dawn/Dusk: warmer tint (`0.15, 0.30, 0.45`)

Pass the water tint color as a uniform to the underwater shader.

### UI: Time Indicator

**File:** `src/ui/hud.ts`

Add a small time indicator to the top bar (between tank name and stats):
- A sun/moon icon that changes with the phase: ☀️ (day), 🌅 (dawn/dusk), 🌙 (night)
- No clock display — the icon is enough

### Render Loop Integration

**File:** `src/main.ts`

```typescript
const dayNight = new DayNightCycle(lights, scene)
// In animate():
dayNight.update(dt)
const timeOfDay = dayNight.getPhase()
// Pass timeOfDay into fish behavior context
```

### State Persistence

The current time `t` is NOT persisted — cycle restarts at mid-morning on each page load. This avoids the player always loading into nighttime.

## Files Changed

| File | Change |
|------|--------|
| `src/scene/day-night.ts` | **New** — DayNightCycle class |
| `src/scene/lighting.ts` | Export all lights in the Lights interface |
| `src/scene/underwater.ts` | Add waterTint uniform to underwater pass |
| `src/fish/fish.ts` | Add `timeOfDay` to StateContext, speed multiplier |
| `src/main.ts` | Instantiate DayNightCycle, wire into render loop |
| `src/ui/hud.ts` | Add time-of-day icon to top bar |

## Performance

No new render passes or geometry. Just uniform updates and color lerps — negligible.

## Scope Boundary

- No manual time-of-day control or pause
- No weather effects (storms, rain on surface)
- No separate nocturnal fish species
- No tank light decorations turning on at night (could be a future enhancement)
- Cycle speed is not configurable in v1
