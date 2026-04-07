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
        { speciesId: 'tetra', name: 'Neon 1', hunger: 0, health: 1 },
        { speciesId: 'clownfish', name: 'Nemo', hunger: 0.5, health: 0.8 },
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
      economy: {
        coins: 150,
        totalCoinsEarned: 300,
        lastDailyBonus: '2026-04-07',
        dailyStreak: 3,
        milestones: ['first_fish', 'species_2'],
        lastSaveTimestamp: '2026-04-07T12:00:00.000Z',
        playerName: 'FishLord',
        totalDeaths: 1,
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
