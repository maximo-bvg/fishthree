import { describe, it, expect } from 'vitest'
import { SPECIES_ECONOMY, DECORATION_PRICES, MILESTONES, FOOD_COST, STARTING_COINS } from './economy'
import { SPECIES, type SpeciesId } from '../fish/species'
import { DECORATIONS, type DecorationId } from '../decorations/catalog'

describe('economy data', () => {
  it('has economy data for every species', () => {
    for (const id of Object.keys(SPECIES) as SpeciesId[]) {
      const data = SPECIES_ECONOMY[id]
      expect(data, `missing economy data for ${id}`).toBeDefined()
      expect(data.cost).toBeGreaterThan(0)
      expect(data.coinRate).toBeGreaterThan(0)
      expect(data.hungerRate).toBeGreaterThan(0)
    }
  })

  it('has prices for every decoration', () => {
    for (const id of Object.keys(DECORATIONS) as DecorationId[]) {
      const price = DECORATION_PRICES[id]
      expect(price, `missing price for decoration ${id}`).toBeDefined()
      expect(price).toBeGreaterThan(0)
    }
  })

  it('starting coins can buy at least one fish', () => {
    const cheapest = Math.min(...Object.values(SPECIES_ECONOMY).map(s => s.cost))
    expect(STARTING_COINS).toBeGreaterThanOrEqual(cheapest)
  })

  it('food cost is positive', () => {
    expect(FOOD_COST).toBeGreaterThan(0)
  })

  it('milestones have unique ids', () => {
    const ids = MILESTONES.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
