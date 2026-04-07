import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveState, loadState, type TankState } from './storage'

const store: Record<string, string> = {}
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
  })
})

describe('saveState / loadState', () => {
  it('saves and loads a tank state', () => {
    const state: TankState = {
      tankName: 'Test Tank',
      fishes: [
        { speciesId: 'tetra', name: 'Neon 1' },
        { speciesId: 'clownfish', name: 'Nemo' },
      ],
      decorations: [
        { slotIndex: 0, decorationId: 'boulder' },
      ],
      settings: {
        caustics: true,
        bloom: false,
        dayNightCycle: true,
        swayIntensity: 0.5,
        masterVolume: 0.5,
        ambientVolume: 0.5,
        sfxVolume: 0.5,
      },
    }

    saveState(state)
    const loaded = loadState()
    expect(loaded).toEqual(state)
  })

  it('returns null when nothing is saved', () => {
    expect(loadState()).toBeNull()
  })

  it('returns null on corrupted data', () => {
    store['fishthree-state'] = 'not json'
    expect(loadState()).toBeNull()
  })
})
