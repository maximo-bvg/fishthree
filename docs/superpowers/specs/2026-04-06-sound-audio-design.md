# Sound & Audio — Design Spec

## Overview

Full sound design for FishThree: continuous ambient underwater soundscape, event-driven sounds (feeding, fish darting, bubbles), and UI sounds (clicks, panel open/close, edit mode). All audio is managed through a central audio system using the Web Audio API.

## Current State

No audio exists in the project. The game is completely silent.

## Design

### Audio System

**New file:** `src/audio/audio-manager.ts`

A singleton `AudioManager` class that:
- Creates and owns the `AudioContext`
- Manages ambient loops, one-shot effects, and UI sounds
- Handles the user-interaction gate (browsers require a user gesture before playing audio)
- Provides a master volume control and per-category volume (ambient, effects, UI)
- Exposes simple methods: `playAmbient()`, `playEffect(name)`, `playUI(name)`, `setVolume(category, value)`

#### AudioContext Initialization

Browsers block audio until user interaction. The manager creates the `AudioContext` on first user click/touch anywhere on the page, then starts the ambient loop automatically.

### Sound Categories

#### 1. Ambient (looping)

**New file:** `src/audio/ambient.ts`

A continuous underwater soundscape built from layered procedural + sample sources:

| Layer | Source | Volume | Notes |
|-------|--------|--------|-------|
| Deep hum | Procedural oscillator (low-pass filtered noise, 40-120 Hz) | `0.15` | Always playing, provides the "underwater" feel |
| Water movement | Procedural filtered noise (band-pass 200-800 Hz, slow LFO on frequency) | `0.08` | Gentle sloshing texture |
| Distant bubbles | Short noise bursts through band-pass, randomly triggered every 2-5s | `0.06` | Ambient background bubbling |

All ambient layers are generated procedurally using Web Audio oscillators and filters — no audio files needed for ambient.

#### 2. Event Sounds (one-shots)

**New file:** `src/audio/effects.ts`

Event sounds are procedurally generated using Web Audio synthesis — no sample files.

| Event | Trigger | Sound Design |
|-------|---------|-------------|
| Feed splash | Flakes spawned (click water surface) | Short noise burst → high-pass filter → quick volume envelope (attack 10ms, decay 200ms). Pitched slightly randomly each time. |
| Fish dart | Fish enters `flee` state | Very short sine sweep (800→400 Hz, 80ms). Quiet (`0.04`). Only triggers for the nearest fish to camera to avoid spam. |
| Bubble pop | Bubble reaches water surface and despawns | Tiny sine blip (1200 Hz, 30ms, quick decay). Triggers for ~1 in 5 bubbles to avoid constant popping. |
| Flake eaten | Fish consumes a flake | Soft click — very short noise burst, high-pass filtered, 20ms. |

#### 3. UI Sounds

**New file:** `src/audio/ui-sounds.ts`

Synthesized with Web Audio — no sample files.

| Event | Trigger | Sound Design |
|-------|---------|-------------|
| Button click | Any sidebar/UI button pressed | Short sine tone (600 Hz, 40ms, quick decay) |
| Panel open | Fish list, settings, etc. opens | Rising sine sweep (400→800 Hz, 100ms) |
| Panel close | Panel dismissed | Falling sine sweep (800→400 Hz, 80ms) |
| Edit mode enter | "Edit Tank" clicked | Two-note ascending chime (C5→E5, 80ms each) |
| Edit mode exit | "Done" clicked | Two-note descending chime (E5→C5, 80ms each) |
| Decoration placed | Item placed in slot | Soft thud — low sine (200 Hz, 60ms) + noise burst |
| Screenshot | Screenshot taken | Shutter sound — short noise burst with resonant filter |

### Integration Points

#### Main Loop

**File:** `src/main.ts`

```typescript
const audioManager = new AudioManager()
// First click anywhere starts audio context
// Ambient starts automatically once context is ready
```

No per-frame update needed for ambient (Web Audio runs on its own thread). Event sounds are triggered by the systems that cause them.

#### Feeding Events

**File:** `src/feeding/flakes.ts` (or `src/main.ts`)

- `flakeManager.spawnCluster()` → `audioManager.playEffect('feed-splash')`
- When a flake is consumed → `audioManager.playEffect('flake-eaten')`

#### Fish Behavior Events

**File:** `src/main.ts` (in `updateFishBehaviors`)

- When a fish transitions to `flee` and is within 6 units of the camera → `audioManager.playEffect('fish-dart')`
- Track previous state to detect transitions (only play on state change, not every frame)

#### Bubble Events

**File:** `src/scene/underwater.ts`

- When a bubble is removed at the water surface → `audioManager.playEffect('bubble-pop')` (with 20% probability)

#### UI Events

**File:** `src/ui/hud.ts`, `src/ui/panels.ts`, `src/ui/edit-mode.ts`

- Button click handlers call `audioManager.playUI('button-click')`
- Panel show/hide calls `playUI('panel-open')` / `playUI('panel-close')`
- Edit mode enter/exit calls `playUI('edit-enter')` / `playUI('edit-exit')`

### Settings Integration

**File:** `src/utils/storage.ts`

Add to `TankSettings`:
```typescript
masterVolume: number   // 0-1, default 0.5
musicVolume: number    // 0-1, default 0.5 (ambient)
sfxVolume: number      // 0-1, default 0.5 (effects + UI)
```

**File:** `src/ui/panels.ts`

Add volume sliders to the Settings panel:
- Master Volume
- Ambient Volume
- SFX Volume

### Day/Night Audio Changes

If the day/night cycle is also implemented, the ambient layer adjusts:
- **Night:** Deep hum volume increases to `0.2`, water movement decreases to `0.04`. More spacious, quieter feel.
- **Day:** Default volumes.
- **Dawn/Dusk:** Gradual crossfade between night and day ambient levels.

This is handled by `DayNightCycle` calling `audioManager.setAmbientMood('night' | 'day')`.

## Files Changed

| File | Change |
|------|--------|
| `src/audio/audio-manager.ts` | **New** — Central AudioManager class |
| `src/audio/ambient.ts` | **New** — Procedural ambient soundscape |
| `src/audio/effects.ts` | **New** — Event sound synthesis |
| `src/audio/ui-sounds.ts` | **New** — UI sound synthesis |
| `src/main.ts` | Create AudioManager, wire event triggers |
| `src/ui/hud.ts` | Add audio triggers to button clicks |
| `src/ui/panels.ts` | Add volume sliders to settings, audio triggers |
| `src/ui/edit-mode.ts` | Add audio triggers for edit mode |
| `src/utils/storage.ts` | Add volume settings to TankSettings |

## Performance

Web Audio runs on a separate thread. Procedural synthesis avoids file loading. No performance concern.

## Scope Boundary

- All sounds are procedurally generated — no audio files to load
- No music/soundtrack — ambient soundscape only
- No spatial/3D audio (fish position doesn't affect sound panning)
- No per-species unique sounds
- No sound when the tab is not focused (AudioContext suspends automatically)
