export class AmbientSoundscape {
  private ctx: AudioContext
  private masterGain: GainNode
  private running = false
  private bubbleTimer = 0

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(destination)
  }

  start(): void {
    if (this.running) return
    this.running = true

    // Layer 1: Deep underwater rumble — very low filtered noise
    const rumbleLen = this.ctx.sampleRate * 4
    const rumbleBuf = this.ctx.createBuffer(1, rumbleLen, this.ctx.sampleRate)
    const rumbleData = rumbleBuf.getChannelData(0)
    for (let i = 0; i < rumbleLen; i++) {
      rumbleData[i] = Math.random() * 2 - 1
    }
    const rumble = this.ctx.createBufferSource()
    rumble.buffer = rumbleBuf
    rumble.loop = true
    const rumbleFilter = this.ctx.createBiquadFilter()
    rumbleFilter.type = 'lowpass'
    rumbleFilter.frequency.value = 80
    rumbleFilter.Q.value = 1
    const rumbleGain = this.ctx.createGain()
    rumbleGain.gain.value = 0.25
    rumble.connect(rumbleFilter)
    rumbleFilter.connect(rumbleGain)
    rumbleGain.connect(this.masterGain)
    rumble.start()

    // Layer 2: Muffled water texture — lowpass filtered noise (NOT bandpass, so no wind sound)
    const waterLen = this.ctx.sampleRate * 6
    const waterBuf = this.ctx.createBuffer(1, waterLen, this.ctx.sampleRate)
    const waterData = waterBuf.getChannelData(0)
    // Brown noise (integrated white noise) for smoother underwater feel
    let lastVal = 0
    for (let i = 0; i < waterLen; i++) {
      lastVal += (Math.random() * 2 - 1) * 0.02
      lastVal *= 0.998 // prevent drift
      waterData[i] = lastVal
    }
    const water = this.ctx.createBufferSource()
    water.buffer = waterBuf
    water.loop = true
    const waterFilter = this.ctx.createBiquadFilter()
    waterFilter.type = 'lowpass'
    waterFilter.frequency.value = 250
    waterFilter.Q.value = 0.5
    // Slow LFO on volume for gentle ebb and flow
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.04
    lfo.connect(lfoGain)
    const waterGain = this.ctx.createGain()
    waterGain.gain.value = 0.15
    lfoGain.connect(waterGain.gain)
    water.connect(waterFilter)
    waterFilter.connect(waterGain)
    waterGain.connect(this.masterGain)
    water.start()
    lfo.start()

    // Layer 3: Gentle low-frequency hum (tank equipment vibe)
    const hum = this.ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 50
    const humGain = this.ctx.createGain()
    humGain.gain.value = 0.06
    hum.connect(humGain)
    humGain.connect(this.masterGain)
    hum.start()
  }

  /** Trigger a random ambient bubble sound */
  triggerBubble(): void {
    if (!this.running) return
    const now = this.ctx.currentTime

    // Bubbles: short sine blip with pitch drop — sounds like an actual bubble
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    const startFreq = 400 + Math.random() * 600
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.4, now + 0.15)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.15)

    // Sometimes spawn a second bubble for a "blub-blub" effect
    if (Math.random() < 0.4) {
      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      const freq2 = startFreq * (0.6 + Math.random() * 0.3)
      const delay = 0.06 + Math.random() * 0.04
      osc2.frequency.setValueAtTime(freq2, now + delay)
      osc2.frequency.exponentialRampToValueAtTime(freq2 * 0.4, now + delay + 0.12)
      const gain2 = this.ctx.createGain()
      gain2.gain.setValueAtTime(0.08, now + delay)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12)
      osc2.connect(gain2)
      gain2.connect(this.masterGain)
      osc2.start(now + delay)
      osc2.stop(now + delay + 0.12)
    }
  }

  /** Call periodically (~every frame) to trigger random ambient bubbles */
  updateBubbleTimer(dt: number): void {
    this.bubbleTimer -= dt
    if (this.bubbleTimer <= 0) {
      this.triggerBubble()
      this.bubbleTimer = 1.5 + Math.random() * 2 // 1.5-3.5 seconds
    }
  }

  setVolume(value: number): void {
    this.masterGain.gain.value = value
  }

  stop(): void {
    this.running = false
  }
}
