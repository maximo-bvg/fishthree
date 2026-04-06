# Sound & Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full sound design — ambient underwater soundscape, event sounds (feeding, darting, bubbles), and UI sounds (clicks, panels, edit mode) — all procedurally generated with Web Audio API.

**Architecture:** A singleton `AudioManager` in `src/audio/audio-manager.ts` owns the `AudioContext` and delegates to three subsystems: ambient (looping procedural layers), effects (one-shot event sounds), and UI sounds. All sounds are synthesized — no audio files.

**Tech Stack:** Web Audio API (AudioContext, OscillatorNode, GainNode, BiquadFilterNode).

---

## File Structure

| File | Role |
|------|------|
| `src/audio/audio-manager.ts` | **New** — Central AudioManager singleton |
| `src/audio/ambient.ts` | **New** — Procedural ambient soundscape |
| `src/audio/effects.ts` | **New** — Event sound synthesis |
| `src/audio/ui-sounds.ts` | **New** — UI sound synthesis |
| `src/utils/storage.ts` | **Modify** — Add volume settings |
| `src/ui/panels.ts` | **Modify** — Add volume sliders to settings |
| `src/ui/hud.ts` | **Modify** — Add audio triggers to button clicks |
| `src/ui/edit-mode.ts` | **Modify** — Add audio triggers for edit mode |
| `src/main.ts` | **Modify** — Create AudioManager, wire event triggers |

---

### Task 1: Create Ambient Soundscape

**Files:**
- Create: `src/audio/ambient.ts`

- [ ] **Step 1: Create the ambient module**

Create `src/audio/ambient.ts`:

```typescript
export class AmbientSoundscape {
  private ctx: AudioContext
  private masterGain: GainNode
  private humGain: GainNode
  private waterGain: GainNode
  private bubbleGain: GainNode
  private humOsc: OscillatorNode | null = null
  private noiseSource: AudioBufferSourceNode | null = null
  private running = false
  private bubbleTimer = 0

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(destination)

    this.humGain = ctx.createGain()
    this.humGain.gain.value = 0.15
    this.humGain.connect(this.masterGain)

    this.waterGain = ctx.createGain()
    this.waterGain.gain.value = 0.08
    this.waterGain.connect(this.masterGain)

    this.bubbleGain = ctx.createGain()
    this.bubbleGain.gain.value = 0.06
    this.bubbleGain.connect(this.masterGain)
  }

  start(): void {
    if (this.running) return
    this.running = true

    // Deep hum — low filtered oscillator
    this.humOsc = this.ctx.createOscillator()
    this.humOsc.type = 'sawtooth'
    this.humOsc.frequency.value = 60
    const humFilter = this.ctx.createBiquadFilter()
    humFilter.type = 'lowpass'
    humFilter.frequency.value = 120
    humFilter.Q.value = 2
    this.humOsc.connect(humFilter)
    humFilter.connect(this.humGain)
    this.humOsc.start()

    // Water movement — filtered noise with LFO
    const bufferSize = this.ctx.sampleRate * 4
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    this.noiseSource = this.ctx.createBufferSource()
    this.noiseSource.buffer = noiseBuffer
    this.noiseSource.loop = true
    const waterFilter = this.ctx.createBiquadFilter()
    waterFilter.type = 'bandpass'
    waterFilter.frequency.value = 400
    waterFilter.Q.value = 1
    // LFO on filter frequency
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.15
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 200
    lfo.connect(lfoGain)
    lfoGain.connect(waterFilter.frequency)
    lfo.start()

    this.noiseSource.connect(waterFilter)
    waterFilter.connect(this.waterGain)
    this.noiseSource.start()
  }

  /** Trigger a random ambient bubble sound */
  triggerBubble(): void {
    if (!this.running) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 300 + Math.random() * 400
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 500
    filter.Q.value = 3
    const gain = this.ctx.createGain()
    gain.gain.value = 0.06
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.bubbleGain)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.3)
  }

  /** Call periodically (~every frame) to trigger random ambient bubbles */
  updateBubbleTimer(dt: number): void {
    this.bubbleTimer -= dt
    if (this.bubbleTimer <= 0) {
      this.triggerBubble()
      this.bubbleTimer = 2 + Math.random() * 3 // 2-5 seconds
    }
  }

  setVolume(value: number): void {
    this.masterGain.gain.value = value
  }

  stop(): void {
    this.running = false
    this.humOsc?.stop()
    this.noiseSource?.stop()
  }
}
```

- [ ] **Step 2: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/audio/ambient.ts
git commit -m "feat: add procedural ambient underwater soundscape"
```

---

### Task 2: Create Effect Sounds

**Files:**
- Create: `src/audio/effects.ts`

- [ ] **Step 1: Create the effects module**

Create `src/audio/effects.ts`:

```typescript
export type EffectName = 'feed-splash' | 'fish-dart' | 'bubble-pop' | 'flake-eaten'

export class EffectSounds {
  private ctx: AudioContext
  private masterGain: GainNode

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(destination)
  }

  play(name: EffectName): void {
    switch (name) {
      case 'feed-splash': this.feedSplash(); break
      case 'fish-dart': this.fishDart(); break
      case 'bubble-pop': this.bubblePop(); break
      case 'flake-eaten': this.flakeEaten(); break
    }
  }

  setVolume(value: number): void {
    this.masterGain.gain.value = value
  }

  private feedSplash(): void {
    const now = this.ctx.currentTime
    // Noise burst through high-pass
    const bufferSize = this.ctx.sampleRate * 0.2
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2000 + Math.random() * 1000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    source.start(now)
    source.stop(now + 0.2)
  }

  private fishDart(): void {
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.04, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  private bubblePop(): void {
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1200
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.03)
  }

  private flakeEaten(): void {
    const now = this.ctx.currentTime
    const bufferSize = this.ctx.sampleRate * 0.02
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 3000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    source.start(now)
    source.stop(now + 0.02)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/audio/effects.ts
git commit -m "feat: add procedural event sound effects"
```

---

### Task 3: Create UI Sounds

**Files:**
- Create: `src/audio/ui-sounds.ts`

- [ ] **Step 1: Create the UI sounds module**

Create `src/audio/ui-sounds.ts`:

```typescript
export type UISound = 'button-click' | 'panel-open' | 'panel-close' | 'edit-enter' | 'edit-exit' | 'decor-placed' | 'screenshot'

export class UISounds {
  private ctx: AudioContext
  private masterGain: GainNode

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(destination)
  }

  play(name: UISound): void {
    switch (name) {
      case 'button-click': this.buttonClick(); break
      case 'panel-open': this.panelOpen(); break
      case 'panel-close': this.panelClose(); break
      case 'edit-enter': this.editEnter(); break
      case 'edit-exit': this.editExit(); break
      case 'decor-placed': this.decorPlaced(); break
      case 'screenshot': this.screenshot(); break
    }
  }

  setVolume(value: number): void {
    this.masterGain.gain.value = value
  }

  private tone(freq: number, duration: number, volume = 0.1): void {
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + duration)
  }

  private sweep(startFreq: number, endFreq: number, duration: number, volume = 0.08): void {
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + duration)
  }

  private buttonClick(): void { this.tone(600, 0.04) }
  private panelOpen(): void { this.sweep(400, 800, 0.1) }
  private panelClose(): void { this.sweep(800, 400, 0.08) }

  private editEnter(): void {
    // Two-note ascending chime C5→E5
    this.tone(523, 0.08) // C5
    setTimeout(() => this.tone(659, 0.08), 80) // E5
  }

  private editExit(): void {
    // Two-note descending chime E5→C5
    this.tone(659, 0.08) // E5
    setTimeout(() => this.tone(523, 0.08), 80) // C5
  }

  private decorPlaced(): void {
    const now = this.ctx.currentTime
    // Low thud
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 200
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  private screenshot(): void {
    const now = this.ctx.currentTime
    // Shutter — noise burst with resonant filter
    const bufferSize = this.ctx.sampleRate * 0.08
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 4000
    filter.Q.value = 5
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    source.start(now)
    source.stop(now + 0.08)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/audio/ui-sounds.ts
git commit -m "feat: add procedural UI sounds"
```

---

### Task 4: Create AudioManager

**Files:**
- Create: `src/audio/audio-manager.ts`

- [ ] **Step 1: Create the AudioManager**

Create `src/audio/audio-manager.ts`:

```typescript
import { AmbientSoundscape } from './ambient'
import { EffectSounds, type EffectName } from './effects'
import { UISounds, type UISound } from './ui-sounds'

export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  ambient: AmbientSoundscape | null = null
  effects: EffectSounds | null = null
  ui: UISounds | null = null
  private initialized = false
  private pendingInit = false

  constructor() {
    // Wait for user interaction to create AudioContext
    const initOnInteraction = () => {
      if (this.initialized || this.pendingInit) return
      this.pendingInit = true
      this.init()
      window.removeEventListener('click', initOnInteraction)
      window.removeEventListener('touchstart', initOnInteraction)
    }
    window.addEventListener('click', initOnInteraction)
    window.addEventListener('touchstart', initOnInteraction)
  }

  private init(): void {
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(this.ctx.destination)

    this.ambient = new AmbientSoundscape(this.ctx, this.masterGain)
    this.effects = new EffectSounds(this.ctx, this.masterGain)
    this.ui = new UISounds(this.ctx, this.masterGain)

    this.ambient.start()
    this.initialized = true
  }

  playEffect(name: EffectName): void {
    this.effects?.play(name)
  }

  playUI(name: UISound): void {
    this.ui?.play(name)
  }

  updateAmbient(dt: number): void {
    this.ambient?.updateBubbleTimer(dt)
  }

  setMasterVolume(value: number): void {
    if (this.masterGain) this.masterGain.gain.value = value
  }

  setAmbientVolume(value: number): void {
    this.ambient?.setVolume(value)
  }

  setSfxVolume(value: number): void {
    this.effects?.setVolume(value)
    this.ui?.setVolume(value)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/audio/audio-manager.ts
git commit -m "feat: add AudioManager with auto-init on user interaction"
```

---

### Task 5: Add Volume Settings

**Files:**
- Modify: `src/utils/storage.ts`

- [ ] **Step 1: Add volume fields to TankSettings**

In `src/utils/storage.ts`, add to the `TankSettings` interface:

```typescript
export interface TankSettings {
  caustics: boolean
  bloom: boolean
  swayIntensity: number
  masterVolume: number
  ambientVolume: number
  sfxVolume: number
}
```

Update `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: TankSettings = {
  caustics: true,
  bloom: true,
  swayIntensity: 0.5,
  masterVolume: 0.5,
  ambientVolume: 0.5,
  sfxVolume: 0.5,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/storage.ts
git commit -m "feat: add volume settings to TankSettings"
```

---

### Task 6: Add Volume Sliders to Settings Panel

**Files:**
- Modify: `src/ui/panels.ts`

- [ ] **Step 1: Add audio callbacks to PanelCallbacks**

In `src/ui/panels.ts`, add to `PanelCallbacks`:

```typescript
  onMasterVolume: (value: number) => void
  onAmbientVolume: (value: number) => void
  onSfxVolume: (value: number) => void
```

- [ ] **Step 2: Update settings parameter type and add sliders**

Update the `showSettingsPanel` function signature to include the volume settings:

```typescript
export function showSettingsPanel(
  hud: HUD,
  settings: { caustics: boolean; bloom: boolean; swayIntensity: number; masterVolume: number; ambientVolume: number; sfxVolume: number },
  callbacks: PanelCallbacks,
): void {
```

Add volume sliders to the HTML after the existing sway slider:

```html
    <div class="setting-row">
      <span class="setting-label">Master Volume</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.masterVolume * 100}" data-setting="masterVolume" />
    </div>
    <div class="setting-row">
      <span class="setting-label">Ambient Volume</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.ambientVolume * 100}" data-setting="ambientVolume" />
    </div>
    <div class="setting-row">
      <span class="setting-label">SFX Volume</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.sfxVolume * 100}" data-setting="sfxVolume" />
    </div>
```

Add event listeners for the new sliders (after the existing sway slider listener):

```typescript
  const masterSlider = panel.querySelector('[data-setting="masterVolume"]') as HTMLInputElement
  masterSlider?.addEventListener('input', () => {
    callbacks.onMasterVolume(parseInt(masterSlider.value, 10) / 100)
  })

  const ambientSlider = panel.querySelector('[data-setting="ambientVolume"]') as HTMLInputElement
  ambientSlider?.addEventListener('input', () => {
    callbacks.onAmbientVolume(parseInt(ambientSlider.value, 10) / 100)
  })

  const sfxSlider = panel.querySelector('[data-setting="sfxVolume"]') as HTMLInputElement
  sfxSlider?.addEventListener('input', () => {
    callbacks.onSfxVolume(parseInt(sfxSlider.value, 10) / 100)
  })
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/panels.ts
git commit -m "feat: add volume sliders to settings panel"
```

---

### Task 7: Add Audio Triggers to UI Components

**Files:**
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/edit-mode.ts`

- [ ] **Step 1: Add audio callback to HUD**

In `src/ui/hud.ts`, add to `HUDCallbacks`:

```typescript
  onButtonClick?: () => void
  onPanelOpen?: () => void
  onPanelClose?: () => void
```

In the sidebar button loop, add after `el.addEventListener('click', btn.action)`:

```typescript
      el.addEventListener('click', () => callbacks.onButtonClick?.())
```

In the `showPanel` method, add:

```typescript
    callbacks?.onPanelOpen?.()
```

Wait — `HUD` doesn't store callbacks after construction. Instead, add a simple audio hook:

Add a public field to the HUD class:

```typescript
  onAudioTrigger: ((sound: string) => void) | null = null
```

In the sidebar button event listeners, add:

```typescript
      el.addEventListener('click', () => this.onAudioTrigger?.('button-click'))
```

In `showPanel`, add at the start:

```typescript
    this.onAudioTrigger?.('panel-open')
```

In `hidePanel`, add at the start:

```typescript
    this.onAudioTrigger?.('panel-close')
```

- [ ] **Step 2: Add audio trigger to EditModeUI**

In `src/ui/edit-mode.ts`, add a public field:

```typescript
  onAudioTrigger: ((sound: string) => void) | null = null
```

In the item click handler (`item.addEventListener`), add:

```typescript
        this.onAudioTrigger?.('decor-placed')
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud.ts src/ui/edit-mode.ts
git commit -m "feat: add audio trigger hooks to HUD and EditModeUI"
```

---

### Task 8: Wire AudioManager into Main

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import and create AudioManager**

Add import:

```typescript
import { AudioManager } from './audio/audio-manager'
```

Create the manager after the HUD is set up:

```typescript
const audioManager = new AudioManager()
```

- [ ] **Step 2: Connect HUD audio triggers**

After the HUD is created:

```typescript
hud.onAudioTrigger = (sound) => {
  audioManager.playUI(sound as any)
}
```

- [ ] **Step 3: Connect edit mode audio**

In the `enterEditMode` function, after creating the EditModeUI:

```typescript
  audioManager.playUI('edit-enter')
  editModeUI.onAudioTrigger = (sound) => {
    audioManager.playUI(sound as any)
  }
```

In `exitEditMode`, before destroying:

```typescript
  audioManager.playUI('edit-exit')
```

- [ ] **Step 4: Add volume callbacks to panelCallbacks**

In the `panelCallbacks` object, add:

```typescript
  onMasterVolume: (value) => {
    settings.masterVolume = value
    audioManager.setMasterVolume(value)
    persistState()
  },
  onAmbientVolume: (value) => {
    settings.ambientVolume = value
    audioManager.setAmbientVolume(value)
    persistState()
  },
  onSfxVolume: (value) => {
    settings.sfxVolume = value
    audioManager.setSfxVolume(value)
    persistState()
  },
```

- [ ] **Step 5: Add screenshot sound**

In the `onScreenshot` callback, add before the download logic:

```typescript
    audioManager.playUI('screenshot')
```

- [ ] **Step 6: Update ambient in render loop**

In `animate()`, add:

```typescript
  audioManager.updateAmbient(dt)
```

- [ ] **Step 7: Restore volume settings on load**

In `restoreState()`, after restoring settings, apply volumes:

```typescript
  audioManager.setMasterVolume(settings.masterVolume)
  audioManager.setAmbientVolume(settings.ambientVolume)
  audioManager.setSfxVolume(settings.sfxVolume)
```

- [ ] **Step 8: Verify the build works**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire AudioManager into main — ambient, events, UI sounds"
```

---

### Task 9: Manual Testing

- [ ] **Step 1: Test ambient**

Run: `npx vite dev`

Open in browser. Click anywhere to trigger audio context. Verify:
- Continuous underwater hum plays
- Water movement sounds are audible
- Random bubble sounds trigger every few seconds

- [ ] **Step 2: Test UI sounds**

Click sidebar buttons — hear button click. Open fish list — hear panel open. Close it — hear panel close. Enter edit mode — hear chime. Exit — hear descending chime.

- [ ] **Step 3: Test volume sliders**

Open settings. Adjust Master, Ambient, and SFX sliders. Verify:
- Master affects everything
- Ambient affects only the background soundscape
- SFX affects button clicks and event sounds

- [ ] **Step 4: Test persistence**

Change volume settings. Refresh page. Click to activate audio. Verify volumes are restored.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: sound & audio polish after manual testing"
```
