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
