import { describe, it, expect } from 'vitest'
import { SPECIES, type SpeciesId } from './species'

describe('SPECIES', () => {
  const speciesIds: SpeciesId[] = ['tetra', 'clownfish', 'angelfish', 'pufferfish', 'barracuda', 'seahorse']

  it('defines all 6 species', () => {
    expect(Object.keys(SPECIES)).toHaveLength(6)
    for (const id of speciesIds) {
      expect(SPECIES[id]).toBeDefined()
    }
  })

  it('each species has required fields', () => {
    for (const id of speciesIds) {
      const s = SPECIES[id]
      expect(s.name).toBeTruthy()
      expect(s.size).toBeGreaterThan(0)
      expect(s.speed).toBeGreaterThan(0)
      expect(s.tailFrequency).toBeGreaterThan(0)
      expect(s.behaviorType).toBeTruthy()
      expect(s.color).toBeGreaterThanOrEqual(0)
      expect(s.personality).toBeTruthy()
    }
  })

  it('barracuda is the largest, tetra is the smallest', () => {
    expect(SPECIES.barracuda.size).toBeGreaterThan(SPECIES.tetra.size)
    expect(SPECIES.tetra.size).toBeLessThanOrEqual(SPECIES.clownfish.size)
  })
})
