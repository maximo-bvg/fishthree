import { describe, it, expect } from 'vitest'
import { DECORATIONS, type DecorationId, type DecorationCategory } from './catalog'

describe('DECORATIONS', () => {
  it('has 11 items', () => {
    expect(Object.keys(DECORATIONS)).toHaveLength(11)
  })

  it('every item has required fields', () => {
    for (const [id, def] of Object.entries(DECORATIONS)) {
      expect(def.name, `${id} missing name`).toBeTruthy()
      expect(def.category, `${id} missing category`).toBeTruthy()
      expect(def.size, `${id} missing size`).toBeTruthy()
      expect(typeof def.createMesh, `${id} missing createMesh`).toBe('function')
    }
  })

  it('categories are valid', () => {
    const validCategories: DecorationCategory[] = ['plants', 'rocks', 'accessories', 'fun']
    for (const def of Object.values(DECORATIONS)) {
      expect(validCategories).toContain(def.category)
    }
  })

  it('sizes are valid', () => {
    const validSizes = ['small', 'medium', 'large']
    for (const def of Object.values(DECORATIONS)) {
      expect(validSizes).toContain(def.size)
    }
  })
})
