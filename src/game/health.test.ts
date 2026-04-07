import { describe, it, expect } from 'vitest'
import { tickHunger, tickHealth, computeOfflineHunger } from './health'
import {
  HEALTH_DRAIN_HUNGER_THRESHOLD,
  HEALTH_REGEN_HUNGER_THRESHOLD,
  OFFLINE_HUNGER_CAP_HOURS,
} from './economy'

describe('tickHunger', () => {
  it('increases hunger based on rate and dt', () => {
    const result = tickHunger(0, 0.02, 60) // 1 minute at 0.02/min
    expect(result).toBeCloseTo(0.02)
  })

  it('clamps hunger to 1.0', () => {
    const result = tickHunger(0.99, 0.1, 60)
    expect(result).toBe(1.0)
  })

  it('does not go below 0', () => {
    const result = tickHunger(0, 0.02, 0)
    expect(result).toBe(0)
  })
})

describe('tickHealth', () => {
  it('drains health when hunger > threshold', () => {
    const result = tickHealth(1.0, 0.9, 60)
    expect(result).toBeLessThan(1.0)
  })

  it('regens health when hunger < threshold', () => {
    const result = tickHealth(0.5, 0.2, 60)
    expect(result).toBeGreaterThan(0.5)
  })

  it('does not change health in neutral zone', () => {
    const result = tickHealth(0.8, 0.6, 60)
    expect(result).toBe(0.8)
  })

  it('clamps health to [0, 1]', () => {
    expect(tickHealth(0.01, 1.0, 600)).toBe(0)
    expect(tickHealth(0.99, 0.0, 600)).toBe(1.0)
  })
})

describe('computeOfflineHunger', () => {
  it('applies hunger for elapsed time', () => {
    const result = computeOfflineHunger(0, 0.02, 3600)
    expect(result).toBeLessThanOrEqual(1.0)
  })

  it('caps at OFFLINE_HUNGER_CAP_HOURS', () => {
    const capped = computeOfflineHunger(0, 0.02, 24 * 3600)
    const expected = computeOfflineHunger(0, 0.02, OFFLINE_HUNGER_CAP_HOURS * 3600)
    expect(capped).toBeCloseTo(expected)
  })
})
