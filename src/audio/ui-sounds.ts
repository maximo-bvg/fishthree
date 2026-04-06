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
