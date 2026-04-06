import { describe, it, expect } from 'vitest'
import { SlotManager, SLOT_DEFINITIONS } from './slots'

describe('SLOT_DEFINITIONS', () => {
  it('defines 20 slots total', () => {
    expect(SLOT_DEFINITIONS).toHaveLength(20)
  })

  it('each slot has a zone, position, and accepted sizes', () => {
    for (const slot of SLOT_DEFINITIONS) {
      expect(slot.zone).toBeTruthy()
      expect(slot.position).toBeDefined()
      expect(slot.acceptedSizes.length).toBeGreaterThan(0)
    }
  })
})

describe('SlotManager', () => {
  it('starts with all slots empty', () => {
    const mgr = new SlotManager()
    expect(mgr.getOccupied()).toHaveLength(0)
    expect(mgr.getEmpty()).toHaveLength(20)
  })

  it('places a decoration in a slot', () => {
    const mgr = new SlotManager()
    const result = mgr.place(0, 'boulder')
    expect(result).toBe(true)
    expect(mgr.getOccupied()).toHaveLength(1)
    expect(mgr.getSlot(0).decorationId).toBe('boulder')
  })

  it('rejects placement if size does not fit', () => {
    const mgr = new SlotManager()
    const ceilingSlot = SLOT_DEFINITIONS.findIndex(s => s.zone === 'ceiling')
    const result = mgr.place(ceilingSlot, 'sunken_ship')
    expect(result).toBe(false)
  })

  it('removes a decoration from a slot', () => {
    const mgr = new SlotManager()
    mgr.place(0, 'boulder')
    mgr.remove(0)
    expect(mgr.getSlot(0).decorationId).toBeNull()
    expect(mgr.getOccupied()).toHaveLength(0)
  })

  it('rejects placement in an occupied slot', () => {
    const mgr = new SlotManager()
    mgr.place(0, 'boulder')
    const result = mgr.place(0, 'driftwood')
    expect(result).toBe(false)
  })

  it('allows placement after removing', () => {
    const mgr = new SlotManager()
    mgr.place(0, 'boulder')
    mgr.remove(0)
    const result = mgr.place(0, 'driftwood')
    expect(result).toBe(true)
  })
})
