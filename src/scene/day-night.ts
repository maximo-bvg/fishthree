import * as THREE from 'three'
import { type Lights } from './lighting'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { type DecorationEffects } from '../decorations/effects'

// --- Keyframe types ---

interface LightingKeyframe {
  ambientColor: THREE.Color
  ambientIntensity: number
  hemiSkyColor: THREE.Color
  hemiGroundColor: THREE.Color
  hemiIntensity: number
  overheadColor: THREE.Color
  overheadIntensity: number
  fillColor: THREE.Color
  fillIntensity: number
  sideFillColor: THREE.Color
  sideFillIntensity: number
  causticColor: THREE.Color
  causticIntensity: number
  fogColor: THREE.Color
  fogDensity: number
  bgColor: THREE.Color
  waterTint: THREE.Color
}

// --- 5 keyframed states ---

const MIDNIGHT: LightingKeyframe = {
  ambientColor: new THREE.Color(0x112233),
  ambientIntensity: 0.6,
  hemiSkyColor: new THREE.Color(0x0a1428),
  hemiGroundColor: new THREE.Color(0x0a0f1e),
  hemiIntensity: 1.2,
  overheadColor: new THREE.Color(0x334466),
  overheadIntensity: 0.3,
  fillColor: new THREE.Color(0x223344),
  fillIntensity: 0.3,
  sideFillColor: new THREE.Color(0x1a2a3a),
  sideFillIntensity: 0.2,
  causticColor: new THREE.Color(0x224466),
  causticIntensity: 0.1,
  fogColor: new THREE.Color(0x050d1a),
  fogDensity: 0.08,
  bgColor: new THREE.Color(0x050d1a),
  waterTint: new THREE.Color(0x04101e),
}

const DAWN: LightingKeyframe = {
  ambientColor: new THREE.Color(0x8a6a55),
  ambientIntensity: 2.5,
  hemiSkyColor: new THREE.Color(0xdda070),
  hemiGroundColor: new THREE.Color(0x334455),
  hemiIntensity: 5.0,
  overheadColor: new THREE.Color(0xffcc88),
  overheadIntensity: 1.8,
  fillColor: new THREE.Color(0xcc8855),
  fillIntensity: 1.2,
  sideFillColor: new THREE.Color(0x886644),
  sideFillIntensity: 0.6,
  causticColor: new THREE.Color(0xddaa66),
  causticIntensity: 0.5,
  fogColor: new THREE.Color(0x1a4a6a),
  fogDensity: 0.06,
  bgColor: new THREE.Color(0x1a4a6a),
  waterTint: new THREE.Color(0x15303a),
}

const NOON: LightingKeyframe = {
  ambientColor: new THREE.Color(0xaaddee),
  ambientIntensity: 4.0,
  hemiSkyColor: new THREE.Color(0xffffff),
  hemiGroundColor: new THREE.Color(0x446688),
  hemiIntensity: 8.0,
  overheadColor: new THREE.Color(0xffffff),
  overheadIntensity: 2.85,
  fillColor: new THREE.Color(0x8899bb),
  fillIntensity: 2.0,
  sideFillColor: new THREE.Color(0x6688aa),
  sideFillIntensity: 1.0,
  causticColor: new THREE.Color(0x66ccff),
  causticIntensity: 0.8,
  fogColor: new THREE.Color(0x1a7aaa),
  fogDensity: 0.05,
  bgColor: new THREE.Color(0x2a7abb),
  waterTint: new THREE.Color(0x1a5570),
}

const DUSK: LightingKeyframe = {
  ambientColor: new THREE.Color(0x7a5544),
  ambientIntensity: 2.0,
  hemiSkyColor: new THREE.Color(0xcc7755),
  hemiGroundColor: new THREE.Color(0x2a3344),
  hemiIntensity: 4.0,
  overheadColor: new THREE.Color(0xff9966),
  overheadIntensity: 1.5,
  fillColor: new THREE.Color(0xaa6644),
  fillIntensity: 1.0,
  sideFillColor: new THREE.Color(0x775533),
  sideFillIntensity: 0.5,
  causticColor: new THREE.Color(0xcc8844),
  causticIntensity: 0.4,
  fogColor: new THREE.Color(0x153050),
  fogDensity: 0.065,
  bgColor: new THREE.Color(0x153050),
  waterTint: new THREE.Color(0x122535),
}

// Keyframe stops: [0, 0.2, 0.5, 0.8, 1.0] = midnight, dawn, noon, dusk, midnight
const KEYFRAMES: { t: number; kf: LightingKeyframe }[] = [
  { t: 0.0, kf: MIDNIGHT },
  { t: 0.2, kf: DAWN },
  { t: 0.5, kf: NOON },
  { t: 0.8, kf: DUSK },
  { t: 1.0, kf: MIDNIGHT },
]

// --- Interpolation helpers ---

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().copy(a).lerp(b, t)
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateKeyframes(progress: number): LightingKeyframe {
  // Clamp to [0, 1)
  const p = progress - Math.floor(progress)

  // Find surrounding keyframes
  let i = 0
  for (; i < KEYFRAMES.length - 1; i++) {
    if (p < KEYFRAMES[i + 1].t) break
  }

  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const segLen = b.t - a.t
  const localT = segLen > 0 ? (p - a.t) / segLen : 0
  // Smooth step for gentle transitions
  const t = localT * localT * (3 - 2 * localT)

  return {
    ambientColor: lerpColor(a.kf.ambientColor, b.kf.ambientColor, t),
    ambientIntensity: lerpScalar(a.kf.ambientIntensity, b.kf.ambientIntensity, t),
    hemiSkyColor: lerpColor(a.kf.hemiSkyColor, b.kf.hemiSkyColor, t),
    hemiGroundColor: lerpColor(a.kf.hemiGroundColor, b.kf.hemiGroundColor, t),
    hemiIntensity: lerpScalar(a.kf.hemiIntensity, b.kf.hemiIntensity, t),
    overheadColor: lerpColor(a.kf.overheadColor, b.kf.overheadColor, t),
    overheadIntensity: lerpScalar(a.kf.overheadIntensity, b.kf.overheadIntensity, t),
    fillColor: lerpColor(a.kf.fillColor, b.kf.fillColor, t),
    fillIntensity: lerpScalar(a.kf.fillIntensity, b.kf.fillIntensity, t),
    sideFillColor: lerpColor(a.kf.sideFillColor, b.kf.sideFillColor, t),
    sideFillIntensity: lerpScalar(a.kf.sideFillIntensity, b.kf.sideFillIntensity, t),
    causticColor: lerpColor(a.kf.causticColor, b.kf.causticColor, t),
    causticIntensity: lerpScalar(a.kf.causticIntensity, b.kf.causticIntensity, t),
    fogColor: lerpColor(a.kf.fogColor, b.kf.fogColor, t),
    fogDensity: lerpScalar(a.kf.fogDensity, b.kf.fogDensity, t),
    bgColor: lerpColor(a.kf.bgColor, b.kf.bgColor, t),
    waterTint: lerpColor(a.kf.waterTint, b.kf.waterTint, t),
  }
}

// --- Speed multiplier based on time of day ---

export function getSpeedMultiplier(progress: number): number {
  const p = progress - Math.floor(progress)
  // Night (0.0-0.15, 0.85-1.0) -> slow (0.5x)
  // Dawn (0.15-0.3) -> fast (1.3x)
  // Noon (0.3-0.7) -> normal (1.0x)
  // Dusk (0.7-0.85) -> slightly slow (0.8x)
  if (p < 0.15 || p > 0.85) return 0.5
  if (p < 0.3) {
    // Ramp from slow to fast
    const t = (p - 0.15) / 0.15
    return 0.5 + t * 0.8 // 0.5 -> 1.3
  }
  if (p < 0.7) return 1.0
  if (p < 0.85) {
    // Ramp from normal to slow
    const t = (p - 0.7) / 0.15
    return 1.0 - t * 0.5 // 1.0 -> 0.5 (via 0.8)
  }
  return 0.5
}

// --- Time of day label ---

export type TimeOfDay = 'midnight' | 'dawn' | 'noon' | 'dusk' | 'night'

export function getTimeOfDay(progress: number): TimeOfDay {
  const p = progress - Math.floor(progress)
  if (p < 0.1 || p >= 0.9) return 'midnight'
  if (p < 0.3) return 'dawn'
  if (p < 0.7) return 'noon'
  if (p < 0.9) return 'dusk'
  return 'night'
}

// --- Main class ---

const CYCLE_DURATION = 720 // 12 minutes in seconds

export class DayNightCycle {
  private elapsed = 0
  private progress = 0
  private lights: Lights
  private scene: THREE.Scene
  private underwaterPass: ShaderPass | null = null
  private decorationEffects: DecorationEffects | null = null

  /** Current speed multiplier for fish (0.5 to 1.3) */
  speedMultiplier = 1.0

  /** Current time label */
  timeOfDay: TimeOfDay = 'noon'

  /** Cycle progress 0-1 */
  get cycleProgress(): number {
    return this.progress
  }

  constructor(lights: Lights, scene: THREE.Scene) {
    this.lights = lights
    this.scene = scene
    // Start at noon so the scene looks familiar on load
    this.elapsed = CYCLE_DURATION * 0.5
    this.progress = 0.5
  }

  /** Optionally link the underwater post-processing pass for tint updates */
  setUnderwaterPass(pass: ShaderPass): void {
    this.underwaterPass = pass
  }

  /** Link decoration effects for tank light modulation */
  setDecorationEffects(effects: DecorationEffects): void {
    this.decorationEffects = effects
  }

  update(dt: number): void {
    this.elapsed += dt
    this.progress = (this.elapsed % CYCLE_DURATION) / CYCLE_DURATION

    const kf = interpolateKeyframes(this.progress)

    // Ambient
    this.lights.ambient.color.copy(kf.ambientColor)
    this.lights.ambient.intensity = kf.ambientIntensity

    // Hemisphere
    this.lights.hemi.color.copy(kf.hemiSkyColor)
    this.lights.hemi.groundColor.copy(kf.hemiGroundColor)
    this.lights.hemi.intensity = kf.hemiIntensity

    // Overhead directional
    this.lights.overhead.color.copy(kf.overheadColor)
    this.lights.overhead.intensity = kf.overheadIntensity

    // Front fill
    this.lights.fill.color.copy(kf.fillColor)
    this.lights.fill.intensity = kf.fillIntensity

    // Side fills
    this.lights.leftFill.color.copy(kf.sideFillColor)
    this.lights.leftFill.intensity = kf.sideFillIntensity
    this.lights.rightFill.color.copy(kf.sideFillColor)
    this.lights.rightFill.intensity = kf.sideFillIntensity

    // Caustic spotlight
    this.lights.causticLight.color.copy(kf.causticColor)
    this.lights.causticLight.intensity = kf.causticIntensity

    // Fog
    const fog = this.scene.fog as THREE.FogExp2
    if (fog) {
      fog.color.copy(kf.fogColor)
      fog.density = kf.fogDensity
    }

    // Background
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(kf.bgColor)
    }

    // Underwater tint uniform
    if (this.underwaterPass) {
      const u = this.underwaterPass.uniforms['uWaterTint']
      if (u) {
        u.value.copy(kf.waterTint)
      }
    }

    // Speed multiplier
    this.speedMultiplier = getSpeedMultiplier(this.progress)

    // Time label
    this.timeOfDay = getTimeOfDay(this.progress)

    // Modulate tank light decorations — brighter at night, dimmer in daylight
    if (this.decorationEffects) {
      // Inverse of ambient: dark scene = bright tank light
      const nightFactor = 1.0 - Math.min(kf.ambientIntensity / 4.0, 1.0)
      // Range: 0.2 (noon) to 1.0 (midnight)
      const lightStrength = 0.2 + nightFactor * 0.8

      for (const spot of this.decorationEffects.getSpotlights()) {
        spot.intensity = 30.0 * lightStrength
      }
      for (const cone of this.decorationEffects.getLightCones()) {
        const mat = cone.material as THREE.MeshBasicMaterial
        mat.opacity = 0.03 + nightFactor * 0.15
      }
      for (const lens of this.decorationEffects.getLightLenses()) {
        const mat = lens.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = 1.0 + nightFactor * 4.0
      }
    }
  }
}
