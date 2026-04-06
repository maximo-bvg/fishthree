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
