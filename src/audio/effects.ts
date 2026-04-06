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
