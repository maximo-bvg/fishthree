# Game Economy & Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FishThree from a free-form aquarium into a casual idle game with a coin economy, fish health/hunger, shop, and online leaderboard.

**Architecture:** A central `GameState` class (Approach B) owns all economy and health logic. The main loop calls `gameState.update(dt)` once per frame. The UI reads from GameState to display coins, prices, and health. A Vercel KV backend powers the leaderboard.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, Vercel KV (`@vercel/kv`), Vercel Serverless Functions

**Spec:** `docs/superpowers/specs/2026-04-07-game-economy-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/game/economy.ts` | Pure data: species prices, coin rates, hunger rates, decoration prices, milestone definitions, constants |
| `src/game/economy.test.ts` | Tests for economy data integrity |
| `src/game/state.ts` | GameState class: coin tracking, milestone checking, daily bonus, mercy mechanic |
| `src/game/state.test.ts` | Tests for GameState logic |
| `src/game/health.ts` | Pure functions: hunger tick, health drain/regen, offline hunger calculation |
| `src/game/health.test.ts` | Tests for health tick logic |
| `api/scores.ts` | Vercel serverless function: POST/GET leaderboard scores |

### Modified Files

| File | Changes |
|------|---------|
| `src/fish/species.ts` | Add `cost`, `coinRate`, `hungerRate` fields to `SpeciesDefinition` and all species entries |
| `src/fish/fish.ts` | Add `hunger`, `health` properties to `Fish` class; pass hunger to state machine; health-based speed modifier |
| `src/utils/storage.ts` | Add `EconomyState` interface, expand `TankState` with `economy` field, expand `FishSave` with `hunger`/`health` |
| `src/ui/hud.ts` | Add coin counter element to top bar, `updateCoins()` method, coin animation |
| `src/ui/hud.css` | Styles for coin counter and coin animation |
| `src/ui/panels.ts` | Update `showAddFishPanel` to show prices, add `showLeaderboardPanel` function |
| `src/ui/edit-mode.ts` | Show prices on decoration items, gray out unaffordable items |
| `src/main.ts` | Wire GameState, update `persistState`/`restoreState`, feed cost check, migration logic, health bar sprites, remove default fish spawn |
| `package.json` | Add `@vercel/kv` dev dependency |

---

## Phase 1: Coins + GameState

### Task 1: Economy Data Module

**Files:**
- Create: `src/game/economy.ts`
- Create: `src/game/economy.test.ts`
- Modify: `src/fish/species.ts:4-18` (SpeciesDefinition interface)
- Modify: `src/fish/species.ts:22-171` (SPECIES entries)

- [ ] **Step 1: Write test for economy data integrity**

Create `src/game/economy.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/economy.test.ts`
Expected: FAIL — module `./economy` does not exist

- [ ] **Step 3: Create economy data module**

Create `src/game/economy.ts`:

```typescript
import { type SpeciesId } from '../fish/species'
import { type DecorationId } from '../decorations/catalog'

export interface SpeciesEconomy {
  cost: number       // coins to purchase
  coinRate: number   // coins earned per minute when healthy
  hungerRate: number // hunger units per minute (0→1 scale)
}

export const SPECIES_ECONOMY: Record<SpeciesId, SpeciesEconomy> = {
  guppy:      { cost: 10,  coinRate: 1, hungerRate: 0.025 },
  tetra:      { cost: 15,  coinRate: 1, hungerRate: 0.03  },
  danio:      { cost: 15,  coinRate: 1, hungerRate: 0.03  },
  clownfish:  { cost: 40,  coinRate: 2, hungerRate: 0.02  },
  pufferfish: { cost: 45,  coinRate: 2, hungerRate: 0.02  },
  pleco:      { cost: 55,  coinRate: 3, hungerRate: 0.015 },
  angelfish:  { cost: 60,  coinRate: 3, hungerRate: 0.015 },
  seahorse:   { cost: 65,  coinRate: 3, hungerRate: 0.015 },
  jellyfish:  { cost: 80,  coinRate: 4, hungerRate: 0.01  },
  barracuda:  { cost: 100, coinRate: 5, hungerRate: 0.025 },
}

export const DECORATION_PRICES: Record<DecorationId, number> = {
  // Plants
  seaweed: 20, coral_fan: 25, anemone: 15, brain_coral: 35,
  kelp: 30, coral_cluster: 40, bush: 25,
  // Rocks
  boulder: 35, rock_arch: 70, driftwood: 30, rock_pile: 40,
  stone_ring: 20, rock_cave: 50,
  // Accessories
  bubbler: 25, tank_light: 40, volcano_bubbler: 45,
  // Fun
  treasure_chest: 60, diver: 40, sunken_ship: 100,
  treasure_map: 20, barrel: 25, cannon: 50, bottle: 15, pirate_flag: 30,
}

export interface MilestoneDefinition {
  id: string
  label: string
  coins: number
  check: (ctx: MilestoneContext) => boolean
}

export interface MilestoneContext {
  fishCount: number
  decorCount: number
  speciesOwned: Set<SpeciesId>
  totalDeaths: number
}

export const MILESTONES: MilestoneDefinition[] = [
  { id: 'first_fish',    label: 'First fish purchased',    coins: 50,  check: (c) => c.fishCount >= 1 },
  { id: 'species_2',     label: 'Second species discovered', coins: 25, check: (c) => c.speciesOwned.size >= 2 },
  { id: 'species_3',     label: 'Third species discovered',  coins: 25, check: (c) => c.speciesOwned.size >= 3 },
  { id: 'species_4',     label: 'Fourth species discovered', coins: 25, check: (c) => c.speciesOwned.size >= 4 },
  { id: 'species_5',     label: 'Fifth species discovered',  coins: 25, check: (c) => c.speciesOwned.size >= 5 },
  { id: 'species_6',     label: 'Sixth species discovered',  coins: 25, check: (c) => c.speciesOwned.size >= 6 },
  { id: 'species_7',     label: 'Seventh species discovered', coins: 25, check: (c) => c.speciesOwned.size >= 7 },
  { id: 'species_8',     label: 'Eighth species discovered', coins: 25, check: (c) => c.speciesOwned.size >= 8 },
  { id: 'species_9',     label: 'Ninth species discovered',  coins: 25, check: (c) => c.speciesOwned.size >= 9 },
  { id: 'species_10',    label: 'All species discovered',    coins: 25, check: (c) => c.speciesOwned.size >= 10 },
  { id: 'fish_5',        label: '5 fish in tank',            coins: 50, check: (c) => c.fishCount >= 5 },
  { id: 'fish_10',       label: '10 fish in tank',           coins: 100, check: (c) => c.fishCount >= 10 },
  { id: 'fish_12',       label: 'Full tank (12 fish)',       coins: 200, check: (c) => c.fishCount >= 12 },
  { id: 'decor_5',       label: '5 decorations placed',      coins: 50, check: (c) => c.decorCount >= 5 },
  { id: 'decor_10',      label: '10 decorations placed',     coins: 100, check: (c) => c.decorCount >= 10 },
  { id: 'decor_20',      label: 'All slots decorated',       coins: 200, check: (c) => c.decorCount >= 20 },
  { id: 'first_death',   label: 'First fish death',          coins: 10, check: (c) => c.totalDeaths >= 1 },
]

export const FOOD_COST = 2
export const FEEDING_BONUS = 5
export const STARTING_COINS = 100
export const MERCY_THRESHOLD = 10 // cheapest fish cost
export const DAILY_BONUS_BASE = 25
export const DAILY_STREAK_CAP = 7
export const OFFLINE_HUNGER_CAP_HOURS = 4
export const HEALTH_DRAIN_HUNGER_THRESHOLD = 0.8
export const HEALTH_REGEN_HUNGER_THRESHOLD = 0.5
export const HEALTH_DRAIN_RATE = 0.05   // per minute
export const HEALTH_REGEN_RATE = 0.02   // per minute
export const HUNGER_FEED_THRESHOLD = 0.6 // above this, fish seek food more aggressively
export const PASSIVE_INCOME_HEALTH_FLOOR = 0.5 // below this health, no passive income
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/economy.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/game/economy.ts src/game/economy.test.ts
git commit -m "feat: add economy data module with species pricing and milestones"
```

---

### Task 2: Storage Schema Update

**Files:**
- Modify: `src/utils/storage.ts:1-57`
- Modify: `src/utils/storage.test.ts`

- [ ] **Step 1: Write test for new storage schema**

Add to `src/utils/storage.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: FAIL — TypeScript error, `economy` not in `TankState`, `hunger`/`health` not in `FishSave`

- [ ] **Step 3: Update storage interfaces**

In `src/utils/storage.ts`, replace the entire file:

```typescript
import { type SpeciesId } from '../fish/species'
import { type DecorationId } from '../decorations/catalog'

const STORAGE_KEY = 'fishthree-state'

export interface FishSave {
  speciesId: SpeciesId
  name: string
  hunger: number
  health: number
}

export interface DecorationSave {
  slotIndex: number
  decorationId: DecorationId
  scale?: number
}

export interface TankSettings {
  caustics: boolean
  bloom: boolean
  dayNightCycle: boolean
  swayIntensity: number
  masterVolume: number
  ambientVolume: number
  sfxVolume: number
}

export interface EconomyState {
  coins: number
  totalCoinsEarned: number
  lastDailyBonus: string | null
  dailyStreak: number
  milestones: string[]
  lastSaveTimestamp: string
  playerName: string | null
  totalDeaths: number
}

export interface TankState {
  tankName: string
  fishes: FishSave[]
  decorations: DecorationSave[]
  settings: TankSettings
  economy?: EconomyState
}

export function saveState(state: TankState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadState(): TankState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TankState
  } catch {
    return null
  }
}

export const DEFAULT_SETTINGS: TankSettings = {
  caustics: true,
  bloom: true,
  dayNightCycle: true,
  swayIntensity: 0.5,
  masterVolume: 0.5,
  ambientVolume: 0.5,
  sfxVolume: 0.5,
}

export const DEFAULT_ECONOMY: EconomyState = {
  coins: 0,
  totalCoinsEarned: 0,
  lastDailyBonus: null,
  dailyStreak: 0,
  milestones: [],
  lastSaveTimestamp: new Date().toISOString(),
  playerName: null,
  totalDeaths: 0,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Fix any other tests broken by the schema change**

Run: `npx vitest run`
Expected: Some tests in `src/fish/fish.test.ts` may break because `StateContext` needs `nearestFlake`. Check and fix if needed. The fish.test.ts tests already pass `nearestFlake: null` (or omit it) — the existing tests don't use the new fields yet, so they should still pass. If storage.test.ts had the old shape, it's already replaced above.

- [ ] **Step 6: Commit**

```bash
git add src/utils/storage.ts src/utils/storage.test.ts
git commit -m "feat: extend storage schema with economy state and fish hunger/health"
```

---

### Task 3: GameState Class

**Files:**
- Create: `src/game/state.ts`
- Create: `src/game/state.test.ts`

- [ ] **Step 1: Write tests for GameState**

Create `src/game/state.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameState } from './state'
import { STARTING_COINS, MERCY_THRESHOLD, DAILY_BONUS_BASE, DAILY_STREAK_CAP } from './economy'

describe('GameState', () => {
  let gs: GameState

  beforeEach(() => {
    gs = new GameState()
  })

  describe('coin management', () => {
    it('starts with 0 coins (starting coins applied by main.ts on new game)', () => {
      expect(gs.coins).toBe(0)
    })

    it('earns coins and tracks total', () => {
      gs.earnCoins(50, 'test')
      expect(gs.coins).toBe(50)
      expect(gs.totalCoinsEarned).toBe(50)
    })

    it('spends coins and returns true if affordable', () => {
      gs.earnCoins(100, 'test')
      expect(gs.spendCoins(40)).toBe(true)
      expect(gs.coins).toBe(60)
      expect(gs.totalCoinsEarned).toBe(100) // total earned doesn't decrease
    })

    it('rejects spending more than balance', () => {
      gs.earnCoins(10, 'test')
      expect(gs.spendCoins(20)).toBe(false)
      expect(gs.coins).toBe(10)
    })

    it('canAfford checks balance', () => {
      gs.earnCoins(50, 'test')
      expect(gs.canAfford(50)).toBe(true)
      expect(gs.canAfford(51)).toBe(false)
    })
  })

  describe('milestones', () => {
    it('awards coins for newly completed milestones', () => {
      const earned = gs.checkMilestones({
        fishCount: 1,
        decorCount: 0,
        speciesOwned: new Set(['guppy']),
        totalDeaths: 0,
      })
      expect(earned).toBeGreaterThan(0) // first_fish milestone
      expect(gs.completedMilestones.has('first_fish')).toBe(true)
    })

    it('does not double-award milestones', () => {
      gs.checkMilestones({
        fishCount: 1, decorCount: 0,
        speciesOwned: new Set(['guppy']), totalDeaths: 0,
      })
      const coins = gs.coins
      gs.checkMilestones({
        fishCount: 1, decorCount: 0,
        speciesOwned: new Set(['guppy']), totalDeaths: 0,
      })
      expect(gs.coins).toBe(coins)
    })
  })

  describe('daily bonus', () => {
    it('awards base bonus on first claim', () => {
      const award = gs.claimDailyBonus('2026-04-07')
      expect(award).toBe(DAILY_BONUS_BASE * 1)
      expect(gs.dailyStreak).toBe(1)
    })

    it('increases streak on consecutive days', () => {
      gs.claimDailyBonus('2026-04-07')
      const award = gs.claimDailyBonus('2026-04-08')
      expect(award).toBe(DAILY_BONUS_BASE * 2)
      expect(gs.dailyStreak).toBe(2)
    })

    it('resets streak on non-consecutive days', () => {
      gs.claimDailyBonus('2026-04-07')
      gs.claimDailyBonus('2026-04-08')
      const award = gs.claimDailyBonus('2026-04-11') // skipped 2 days
      expect(award).toBe(DAILY_BONUS_BASE * 1)
      expect(gs.dailyStreak).toBe(1)
    })

    it('caps streak multiplier', () => {
      let date = 7
      for (let i = 0; i < 10; i++) {
        gs.claimDailyBonus(`2026-04-${String(date + i).padStart(2, '0')}`)
      }
      expect(gs.dailyStreak).toBe(DAILY_STREAK_CAP)
    })

    it('returns 0 if already claimed today', () => {
      gs.claimDailyBonus('2026-04-07')
      const award = gs.claimDailyBonus('2026-04-07')
      expect(award).toBe(0)
    })
  })

  describe('mercy mechanic', () => {
    it('grants mercy coins when fish=0 and coins < threshold', () => {
      gs.earnCoins(3, 'test')
      const granted = gs.checkMercy(0)
      expect(granted).toBe(true)
      expect(gs.coins).toBe(MERCY_THRESHOLD)
    })

    it('does not grant mercy when player has enough coins', () => {
      gs.earnCoins(50, 'test')
      expect(gs.checkMercy(0)).toBe(false)
    })

    it('does not grant mercy when fish exist', () => {
      gs.earnCoins(3, 'test')
      expect(gs.checkMercy(1)).toBe(false)
    })
  })

  describe('serialization', () => {
    it('serializes and deserializes', () => {
      gs.earnCoins(100, 'test')
      gs.checkMilestones({
        fishCount: 1, decorCount: 0,
        speciesOwned: new Set(['guppy']), totalDeaths: 0,
      })
      gs.playerName = 'TestPlayer'

      const data = gs.serialize()
      const gs2 = GameState.deserialize(data)

      expect(gs2.coins).toBe(gs.coins)
      expect(gs2.totalCoinsEarned).toBe(gs.totalCoinsEarned)
      expect(gs2.completedMilestones).toEqual(gs.completedMilestones)
      expect(gs2.playerName).toBe('TestPlayer')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/state.test.ts`
Expected: FAIL — module `./state` does not exist

- [ ] **Step 3: Implement GameState class**

Create `src/game/state.ts`:

```typescript
import {
  MILESTONES, type MilestoneContext,
  MERCY_THRESHOLD, DAILY_BONUS_BASE, DAILY_STREAK_CAP,
} from './economy'
import { type EconomyState, DEFAULT_ECONOMY } from '../utils/storage'

export class GameState {
  coins = 0
  totalCoinsEarned = 0
  lastDailyBonus: string | null = null
  dailyStreak = 0
  completedMilestones: Set<string> = new Set()
  lastSaveTimestamp: string = new Date().toISOString()
  playerName: string | null = null
  totalDeaths = 0

  earnCoins(amount: number, _reason: string): void {
    this.coins += amount
    this.totalCoinsEarned += amount
  }

  spendCoins(amount: number): boolean {
    if (this.coins < amount) return false
    this.coins -= amount
    return true
  }

  canAfford(amount: number): boolean {
    return this.coins >= amount
  }

  checkMilestones(ctx: MilestoneContext): number {
    let totalAwarded = 0
    for (const milestone of MILESTONES) {
      if (this.completedMilestones.has(milestone.id)) continue
      if (milestone.check(ctx)) {
        this.completedMilestones.add(milestone.id)
        this.earnCoins(milestone.coins, `milestone:${milestone.id}`)
        totalAwarded += milestone.coins
      }
    }
    return totalAwarded
  }

  claimDailyBonus(todayISO: string): number {
    const today = todayISO.slice(0, 10) // YYYY-MM-DD
    if (this.lastDailyBonus === today) return 0

    if (this.lastDailyBonus) {
      const last = new Date(this.lastDailyBonus)
      const curr = new Date(today)
      const diffDays = Math.round((curr.getTime() - last.getTime()) / 86400000)
      if (diffDays === 1) {
        this.dailyStreak = Math.min(this.dailyStreak + 1, DAILY_STREAK_CAP)
      } else {
        this.dailyStreak = 1
      }
    } else {
      this.dailyStreak = 1
    }

    this.lastDailyBonus = today
    const award = DAILY_BONUS_BASE * this.dailyStreak
    this.earnCoins(award, 'daily_bonus')
    return award
  }

  checkMercy(fishCount: number): boolean {
    if (fishCount > 0 || this.coins >= MERCY_THRESHOLD) return false
    this.coins = MERCY_THRESHOLD
    return true
  }

  serialize(): EconomyState {
    return {
      coins: this.coins,
      totalCoinsEarned: this.totalCoinsEarned,
      lastDailyBonus: this.lastDailyBonus,
      dailyStreak: this.dailyStreak,
      milestones: [...this.completedMilestones],
      lastSaveTimestamp: new Date().toISOString(),
      playerName: this.playerName,
      totalDeaths: this.totalDeaths,
    }
  }

  static deserialize(data: EconomyState): GameState {
    const gs = new GameState()
    gs.coins = data.coins
    gs.totalCoinsEarned = data.totalCoinsEarned
    gs.lastDailyBonus = data.lastDailyBonus
    gs.dailyStreak = data.dailyStreak
    gs.completedMilestones = new Set(data.milestones)
    gs.lastSaveTimestamp = data.lastSaveTimestamp
    gs.playerName = data.playerName
    gs.totalDeaths = data.totalDeaths
    return gs
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/state.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/game/state.ts src/game/state.test.ts
git commit -m "feat: add GameState class with coins, milestones, daily bonus, mercy"
```

---

### Task 4: Health Module

**Files:**
- Create: `src/game/health.ts`
- Create: `src/game/health.test.ts`

- [ ] **Step 1: Write tests for health logic**

Create `src/game/health.test.ts`:

```typescript
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
    const result = tickHunger(0.99, 0.1, 60) // would exceed 1.0
    expect(result).toBe(1.0)
  })

  it('does not go below 0', () => {
    const result = tickHunger(0, 0.02, 0) // 0 seconds
    expect(result).toBe(0)
  })
})

describe('tickHealth', () => {
  it('drains health when hunger > threshold', () => {
    const result = tickHealth(1.0, 0.9, 60) // 1 min, hungry
    expect(result).toBeLessThan(1.0)
  })

  it('regens health when hunger < threshold', () => {
    const result = tickHealth(0.5, 0.2, 60) // 1 min, fed
    expect(result).toBeGreaterThan(0.5)
  })

  it('does not change health in neutral zone', () => {
    const result = tickHealth(0.8, 0.6, 60) // between thresholds
    expect(result).toBe(0.8)
  })

  it('clamps health to [0, 1]', () => {
    expect(tickHealth(0.01, 1.0, 600)).toBe(0)   // drains to 0
    expect(tickHealth(0.99, 0.0, 600)).toBe(1.0)  // regens to 1
  })
})

describe('computeOfflineHunger', () => {
  it('applies hunger for elapsed time', () => {
    const result = computeOfflineHunger(0, 0.02, 3600) // 1 hour
    expect(result).toBeCloseTo(0.02 * 60) // 1.2, clamped to 1.0
    expect(result).toBeLessThanOrEqual(1.0)
  })

  it('caps at OFFLINE_HUNGER_CAP_HOURS', () => {
    // 24 hours elapsed, but cap is 4 hours
    const capped = computeOfflineHunger(0, 0.02, 24 * 3600)
    const expected = computeOfflineHunger(0, 0.02, OFFLINE_HUNGER_CAP_HOURS * 3600)
    expect(capped).toBeCloseTo(expected)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/health.test.ts`
Expected: FAIL — module `./health` does not exist

- [ ] **Step 3: Implement health module**

Create `src/game/health.ts`:

```typescript
import {
  HEALTH_DRAIN_HUNGER_THRESHOLD,
  HEALTH_REGEN_HUNGER_THRESHOLD,
  HEALTH_DRAIN_RATE,
  HEALTH_REGEN_RATE,
  OFFLINE_HUNGER_CAP_HOURS,
} from './economy'

/**
 * Tick hunger up over time.
 * @param hunger Current hunger (0–1)
 * @param hungerRate Hunger units per minute
 * @param dtSeconds Delta time in seconds
 * @returns New hunger value, clamped to [0, 1]
 */
export function tickHunger(hunger: number, hungerRate: number, dtSeconds: number): number {
  const dtMinutes = dtSeconds / 60
  return Math.min(1.0, Math.max(0, hunger + hungerRate * dtMinutes))
}

/**
 * Tick health based on current hunger.
 * @param health Current health (0–1)
 * @param hunger Current hunger (0–1)
 * @param dtSeconds Delta time in seconds
 * @returns New health value, clamped to [0, 1]
 */
export function tickHealth(health: number, hunger: number, dtSeconds: number): number {
  const dtMinutes = dtSeconds / 60
  if (hunger > HEALTH_DRAIN_HUNGER_THRESHOLD) {
    return Math.max(0, health - HEALTH_DRAIN_RATE * dtMinutes)
  }
  if (hunger < HEALTH_REGEN_HUNGER_THRESHOLD) {
    return Math.min(1.0, health + HEALTH_REGEN_RATE * dtMinutes)
  }
  return health
}

/**
 * Compute hunger after offline period (capped).
 * @param hunger Current hunger (0–1)
 * @param hungerRate Hunger units per minute
 * @param elapsedSeconds Total seconds since last save
 * @returns New hunger value, clamped to [0, 1]
 */
export function computeOfflineHunger(
  hunger: number,
  hungerRate: number,
  elapsedSeconds: number,
): number {
  const cappedSeconds = Math.min(elapsedSeconds, OFFLINE_HUNGER_CAP_HOURS * 3600)
  return tickHunger(hunger, hungerRate, cappedSeconds)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/health.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/game/health.ts src/game/health.test.ts
git commit -m "feat: add health module with hunger/health tick and offline calculation"
```

---

### Task 5: Add Hunger/Health to Fish Class

**Files:**
- Modify: `src/fish/fish.ts:129-168` (Fish class constructor and properties)
- Modify: `src/fish/fish.ts:44-75` (FishStateMachine — hunger-aware feed threshold)

- [ ] **Step 1: Add hunger/health properties to Fish class**

In `src/fish/fish.ts`, add two new properties after `speedMultiplier` (line 138):

```typescript
// After: speedMultiplier = 1.0
hunger = 0
health = 1.0
```

- [ ] **Step 2: Add hunger-aware feed detection to FishStateMachine**

In `src/fish/fish.ts`, the `StateContext` interface (line 25-33) needs a `hunger` field:

Add to `StateContext`:
```typescript
hunger?: number
```

Then modify the feed check in `FishStateMachine.update()` (around line 69-71). Replace:

```typescript
    const hasNearFlake = ctx.nearestFlake !== null && ctx.nearestFlake.distance < 4.0
```

With:

```typescript
    const feedRange = (ctx.hunger ?? 0) > 0.6 ? 6.0 : 4.0
    const hasNearFlake = ctx.nearestFlake !== null && ctx.nearestFlake.distance < feedRange
```

- [ ] **Step 3: Add health-based speed modifier to Fish.update()**

In `src/fish/fish.ts`, in the `update(dt)` method (line 174), add a health speed modifier. After the existing `this.speedMultiplier` usage on line 179:

Replace:
```typescript
    this.mesh.position.addScaledVector(this.velocity, dt * this.speedMultiplier)
```

With:
```typescript
    const healthSpeedMod = this.health < 0.3 ? 0.5 : 1.0
    this.mesh.position.addScaledVector(this.velocity, dt * this.speedMultiplier * healthSpeedMod)
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS — existing fish state machine tests still pass (they don't set hunger in context, so it defaults to `undefined` which `?? 0` handles)

- [ ] **Step 5: Commit**

```bash
git add src/fish/fish.ts
git commit -m "feat: add hunger/health to Fish class with hunger-aware feed range"
```

---

### Task 6: HUD Coin Counter

**Files:**
- Modify: `src/ui/hud.ts:14-101` (add coin counter element)
- Modify: `src/ui/hud.css` (add coin counter styles)

- [ ] **Step 1: Add coin counter to HUD class**

In `src/ui/hud.ts`, add a new private property after `decorCountEl` (line 19):

```typescript
private coinCountEl: HTMLSpanElement
```

In the constructor, after the stats div is created (after line 53, where `stats` is appended to `top`), add the coin counter to the stats div. Insert before `top.appendChild(stats)`:

```typescript
    this.coinCountEl = document.createElement('span')
    this.coinCountEl.className = 'coin-count'
    this.coinCountEl.textContent = '0 Coins'
    stats.appendChild(this.coinCountEl)
```

Add a new public method after `updateCounts` (after line 123):

```typescript
  updateCoins(coins: number): void {
    this.coinCountEl.textContent = `${Math.floor(coins)} Coins`
  }

  showCoinAnimation(amount: number): void {
    const el = document.createElement('span')
    el.className = 'coin-anim'
    el.textContent = amount > 0 ? `+${amount}` : `${amount}`
    el.style.color = amount > 0 ? '#44dd66' : '#ff6644'
    this.coinCountEl.parentElement!.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
```

- [ ] **Step 2: Add coin counter CSS**

In `src/ui/hud.css`, add at the end:

```css
.coin-count {
  color: #ffd700;
  font-weight: 600;
}

.coin-anim {
  position: absolute;
  font-size: 13px;
  font-weight: 600;
  animation: coin-float 1s ease-out forwards;
  pointer-events: none;
}

@keyframes coin-float {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-20px); }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/hud.ts src/ui/hud.css
git commit -m "feat: add coin counter to HUD with earn/spend animation"
```

---

## Phase 2: Shop + Pricing

### Task 7: Fish Shop Panel

**Files:**
- Modify: `src/ui/panels.ts:60-109` (replace `showAddFishPanel`)

- [ ] **Step 1: Update showAddFishPanel with prices**

Replace the `showAddFishPanel` function in `src/ui/panels.ts`. The function signature changes to accept `coins`:

Replace the entire `showAddFishPanel` function (lines 60-109):

```typescript
export function showAddFishPanel(
  hud: HUD,
  currentCount: number,
  maxCount: number,
  coins: number,
  callbacks: PanelCallbacks,
): void {
  let html = `
    <div class="panel-title">Fish Shop (${currentCount}/${maxCount})</div>
    <button class="panel-close">&times;</button>
  `

  if (currentCount >= maxCount) {
    html += '<p style="opacity:0.6;font-size:13px;">Tank is full!</p>'
    hud.showPanel(html)
    return
  }

  const descriptions: Record<SpeciesId, string> = {
    tetra: 'Tiny schooling fish',
    clownfish: 'Territorial, claims decorations',
    angelfish: 'Graceful wanderer',
    pufferfish: 'Shy, hides near rocks',
    barracuda: 'Large predator patrol',
    seahorse: 'Clings to plants',
    pleco: 'Slow bottom-dweller',
    danio: 'Fast schooling fish',
    jellyfish: 'Drifting, translucent',
    guppy: 'Playful surface swimmer',
  }

  for (const [id, species] of Object.entries(SPECIES)) {
    const color = '#' + species.color.toString(16).padStart(6, '0')
    const price = SPECIES_ECONOMY[id as SpeciesId].cost
    const canAfford = coins >= price
    html += `
      <div class="species-card${canAfford ? '' : ' disabled'}" data-species="${id}">
        <div class="species-color" style="background:${color}"></div>
        <div class="species-info">
          <span class="species-info-name">${species.name}</span>
          <span class="species-info-desc">${descriptions[id as SpeciesId]}</span>
        </div>
        <span class="species-price${canAfford ? '' : ' insufficient'}">${price} coins</span>
      </div>
    `
  }

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('.species-card:not(.disabled)').forEach(card => {
    card.addEventListener('click', () => {
      const speciesId = (card as HTMLElement).dataset.species as SpeciesId
      const name = SPECIES[speciesId].name + ' ' + (currentCount + 1)
      callbacks.onAddFish(speciesId, name)
      hud.hidePanel()
    })
  })
}
```

- [ ] **Step 2: Add the import for SPECIES_ECONOMY**

At the top of `src/ui/panels.ts`, add:

```typescript
import { SPECIES_ECONOMY } from '../game/economy'
```

- [ ] **Step 3: Add CSS for disabled cards and price display**

In `src/ui/hud.css`, add:

```css
.species-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.species-price {
  font-size: 12px;
  color: #ffd700;
  font-weight: 600;
  margin-left: auto;
  white-space: nowrap;
}

.species-price.insufficient {
  color: #ff4444;
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Error in `main.ts` because `showAddFishPanel` now requires a `coins` argument. This will be fixed in Task 10 when we wire everything together. For now, note the expected breakage.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels.ts src/ui/hud.css
git commit -m "feat: convert add fish panel to shop with coin prices"
```

---

### Task 8: Decoration Shop Pricing

**Files:**
- Modify: `src/ui/edit-mode.ts:116-134` (renderItems — add prices)
- Modify: `src/ui/edit-mode.css` (price styles)
- Modify: `src/ui/edit-mode.ts:38-52` (constructor — accept coins getter)

- [ ] **Step 1: Update EditModeUI to accept a coin balance getter**

In `src/ui/edit-mode.ts`, update the `EditModeCallbacks` interface (line 38):

```typescript
export interface EditModeCallbacks {
  onSelectItem: (decorationId: DecorationId) => void
  onDone: () => void
  onRescale?: (slotIndex: number, newScale: number) => void
  getCoins: () => number
  onBuyDecoration: (decorationId: DecorationId) => boolean // returns false if can't afford
}
```

- [ ] **Step 2: Add import for DECORATION_PRICES**

At top of `src/ui/edit-mode.ts`, add:

```typescript
import { DECORATION_PRICES } from '../game/economy'
```

- [ ] **Step 3: Update renderItems to show prices and disable unaffordable**

Replace the `renderItems` method (lines 116-134):

```typescript
  private renderItems(): void {
    this.itemsContainer.innerHTML = ''
    const coins = this.callbacks.getCoins()
    for (const [id, def] of Object.entries(DECORATIONS)) {
      if (def.category !== this.activeCategory) continue
      const price = DECORATION_PRICES[id as DecorationId]
      const canAfford = coins >= price
      const item = document.createElement('div')
      item.className = `edit-item${this.selectedItem === id ? ' selected' : ''}${canAfford ? '' : ' disabled'}`
      item.innerHTML = `
        <span class="edit-item-icon">${ITEM_ICONS[id as DecorationId] || '?'}</span>
        <span class="edit-item-name">${def.name}</span>
        <span class="edit-item-price${canAfford ? '' : ' insufficient'}">${price}</span>
      `
      if (canAfford) {
        item.addEventListener('click', () => {
          if (!this.callbacks.onBuyDecoration(id as DecorationId)) return
          this.selectedItem = id as DecorationId
          this.renderItems()
          this.callbacks.onSelectItem(id as DecorationId)
          this.onAudioTrigger?.('decor-placed')
        })
      }
      this.itemsContainer.appendChild(item)
    }
  }
```

- [ ] **Step 4: Add CSS for decoration prices**

In `src/ui/edit-mode.css`, add:

```css
.edit-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.edit-item-price {
  font-size: 9px;
  color: #ffd700;
  font-weight: 600;
}

.edit-item-price.insufficient {
  color: #ff4444;
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Errors in `main.ts` because `EditModeCallbacks` now requires `getCoins` and `onBuyDecoration`. Will be fixed in Task 10.

- [ ] **Step 6: Commit**

```bash
git add src/ui/edit-mode.ts src/ui/edit-mode.css
git commit -m "feat: add coin prices to decoration shop UI"
```

---

### Task 9: Toast Notification System

**Files:**
- Create: `src/ui/toast.ts`
- Modify: `src/ui/hud.css` (toast styles)

The toast is needed for daily bonus, mercy coins, migration bonus, and milestone awards.

- [ ] **Step 1: Create toast module**

Create `src/ui/toast.ts`:

```typescript
import './hud.css'

let toastContainer: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.getElementById('hud')?.appendChild(toastContainer)
  }
  return toastContainer
}

export function showToast(message: string, duration = 3000): void {
  const container = ensureContainer()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  container.appendChild(toast)

  // Force reflow then animate in
  toast.offsetHeight
  toast.classList.add('visible')

  setTimeout(() => {
    toast.classList.remove('visible')
    toast.addEventListener('transitionend', () => toast.remove())
  }, duration)
}
```

- [ ] **Step 2: Add toast CSS**

In `src/ui/hud.css`, add:

```css
.toast-container {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
  z-index: 20;
}

.toast {
  background: rgba(10, 25, 50, 0.9);
  border: 1px solid rgba(100, 180, 255, 0.4);
  border-radius: 8px;
  padding: 8px 20px;
  color: #fff;
  font-size: 14px;
  font-family: 'Fredoka', sans-serif;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.3s, transform 0.3s;
}

.toast.visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/toast.ts src/ui/hud.css
git commit -m "feat: add toast notification system for game events"
```

---

### Task 10: Wire Everything Into Main Loop

**Files:**
- Modify: `src/main.ts` (large — wiring GameState, updating persistence, migration, food cost, starter experience)

This is the integration task that connects all the new systems. Work through it methodically.

- [ ] **Step 1: Add imports to main.ts**

At the top of `src/main.ts`, add these imports after the existing ones:

```typescript
import { GameState } from './game/state'
import {
  SPECIES_ECONOMY, DECORATION_PRICES, FOOD_COST, FEEDING_BONUS,
  STARTING_COINS, PASSIVE_INCOME_HEALTH_FLOOR,
} from './game/economy'
import { tickHunger, tickHealth, computeOfflineHunger } from './game/health'
import { type EconomyState, DEFAULT_ECONOMY } from './utils/storage'
import { showToast } from './ui/toast'
```

- [ ] **Step 2: Add GameState instance to state section**

After `let selectedDecorationId` (line 110), add:

```typescript
const gameState = new GameState()
```

- [ ] **Step 3: Update persistState to include economy and fish health**

Replace the `persistState` function (lines 423-431):

```typescript
function persistState(): void {
  const state: TankState = {
    tankName,
    fishes: fishes.map(f => ({
      speciesId: f.speciesId,
      name: f.name,
      hunger: f.hunger,
      health: f.health,
    })),
    decorations: slotManager.serialize(),
    settings,
    economy: gameState.serialize(),
  }
  saveState(state)
}
```

- [ ] **Step 4: Update restoreState with migration and economy loading**

Replace the `restoreState` function (lines 433-472):

```typescript
function restoreState(): void {
  const state = loadState()
  if (!state) {
    // New player: empty tank, starting coins
    gameState.earnCoins(STARTING_COINS, 'new_game')
    showToast('Welcome! Visit the shop to buy your first fish.')
    return
  }

  tankName = state.tankName
  hud.setTankName(tankName)
  settings = { ...DEFAULT_SETTINGS, ...state.settings }
  lights.causticLight.visible = settings.caustics
  dayNight.enabled = settings.dayNightCycle
  audioManager.setMasterVolume(settings.masterVolume)
  audioManager.setAmbientVolume(settings.ambientVolume)
  audioManager.setSfxVolume(settings.sfxVolume)

  // Restore economy (or migrate)
  if (state.economy) {
    const restored = GameState.deserialize(state.economy)
    gameState.coins = restored.coins
    gameState.totalCoinsEarned = restored.totalCoinsEarned
    gameState.lastDailyBonus = restored.lastDailyBonus
    gameState.dailyStreak = restored.dailyStreak
    gameState.completedMilestones = restored.completedMilestones
    gameState.lastSaveTimestamp = restored.lastSaveTimestamp
    gameState.playerName = restored.playerName
    gameState.totalDeaths = restored.totalDeaths
  } else {
    // Migration: existing player without economy data
    const migrationBonus = state.fishes.length * 30 + state.decorations.length * 20
    gameState.earnCoins(migrationBonus, 'migration')
    showToast(`Welcome to the new economy! You've been awarded ${migrationBonus} coins for your existing tank.`)
  }

  // Restore fish with hunger/health (handle old saves without these fields)
  const elapsedSec = state.economy
    ? (Date.now() - new Date(state.economy.lastSaveTimestamp).getTime()) / 1000
    : 0

  for (const fishSave of state.fishes) {
    addFish(fishSave.speciesId, fishSave.name)
    const fish = fishes[fishes.length - 1]
    const savedHunger = fishSave.hunger ?? 0
    const savedHealth = fishSave.health ?? 1
    const hungerRate = SPECIES_ECONOMY[fishSave.speciesId].hungerRate
    fish.hunger = elapsedSec > 0
      ? computeOfflineHunger(savedHunger, hungerRate, elapsedSec)
      : savedHunger
    fish.health = savedHealth
  }

  // Apply offline health drain after computing hunger
  if (elapsedSec > 0) {
    for (const fish of fishes) {
      fish.health = tickHealth(fish.health, fish.hunger, Math.min(elapsedSec, 4 * 3600))
    }
    // Remove dead fish from offline health drain
    for (let i = fishes.length - 1; i >= 0; i--) {
      if (fishes[i].health <= 0) {
        const dead = fishes.splice(i, 1)[0]
        scene.remove(dead.mesh)
        gameState.totalDeaths++
      }
    }
  }

  const meshes = slotManager.deserialize(state.decorations)
  for (let i = 0; i < state.decorations.length; i++) {
    const mesh = meshes[i]
    if (mesh) {
      scene.add(mesh)
      effects.register(state.decorations[i].decorationId, mesh, SLOT_DEFINITIONS[state.decorations[i].slotIndex].zone)
    }
  }

  remoundSand()
  updateHUDCounts()

  // Daily bonus check
  const today = new Date().toISOString().slice(0, 10)
  const bonus = gameState.claimDailyBonus(today)
  if (bonus > 0) {
    showToast(`Daily bonus: +${bonus} coins! (${gameState.dailyStreak} day streak)`)
  }

  // Mercy check
  if (gameState.checkMercy(fishes.length)) {
    showToast("Your tank is empty. Here's enough to start over.")
  }

  persistState()
}
```

- [ ] **Step 5: Update feed click handler with food cost**

In the fish click + feed handler (around line 253-298), update the feeding section. Replace:

```typescript
  if (raycaster.ray.intersectPlane(waterPlane, waterIntersect)) {
    if (
      Math.abs(waterIntersect.x) < TANK.width / 2 &&
      Math.abs(waterIntersect.z) < TANK.depth / 2
    ) {
      flakeManager.spawnCluster(waterIntersect.clone())
    }
  }
```

With:

```typescript
  if (raycaster.ray.intersectPlane(waterPlane, waterIntersect)) {
    if (
      Math.abs(waterIntersect.x) < TANK.width / 2 &&
      Math.abs(waterIntersect.z) < TANK.depth / 2
    ) {
      if (gameState.spendCoins(FOOD_COST)) {
        flakeManager.spawnCluster(waterIntersect.clone())
        hud.updateCoins(gameState.coins)
        hud.showCoinAnimation(-FOOD_COST)
      }
    }
  }
```

- [ ] **Step 6: Update fish flake consumption to award coins**

In `updateFishBehaviors` (around line 636-639), where flake consumption happens, add coin earning. Replace:

```typescript
          if (nearestFlakeDist < 0.3) {
            flakeManager.consume(nearestFlakeId)
            fish.targetFlakeId = null
          }
```

With:

```typescript
          if (nearestFlakeDist < 0.3) {
            flakeManager.consume(nearestFlakeId)
            fish.targetFlakeId = null
            fish.hunger = 0
            gameState.earnCoins(FEEDING_BONUS, 'feeding')
            hud.showCoinAnimation(FEEDING_BONUS)
          }
```

- [ ] **Step 7: Add passive income and health ticks to game loop**

In the `animate` function (line 667), after `dayNight.update(dt)` and before `updateFishBehaviors(dt)`, add economy and health ticks:

```typescript
  // Economy: passive income from healthy fish
  for (const fish of fishes) {
    const eco = SPECIES_ECONOMY[fish.speciesId]
    if (fish.health >= PASSIVE_INCOME_HEALTH_FLOOR) {
      const healthScale = (fish.health - PASSIVE_INCOME_HEALTH_FLOOR) / (1.0 - PASSIVE_INCOME_HEALTH_FLOOR)
      gameState.earnCoins(eco.coinRate * (dt / 60) * healthScale, 'passive')
    }
    fish.hunger = tickHunger(fish.hunger, eco.hungerRate, dt)
    fish.health = tickHealth(fish.health, fish.hunger, dt)
  }

  // Remove dead fish
  for (let i = fishes.length - 1; i >= 0; i--) {
    if (fishes[i].health <= 0) {
      const dead = fishes.splice(i, 1)[0]
      scene.remove(dead.mesh)
      cameraController.onFollowTargetRemoved()
      gameState.totalDeaths++
      showToast(`${dead.name} has died...`)
    }
  }

  // Milestone check (throttle to once per second)
  if (Math.floor(elapsed) !== Math.floor(elapsed - dt)) {
    const speciesOwned = new Set(fishes.map(f => f.speciesId))
    const milestoneAward = gameState.checkMilestones({
      fishCount: fishes.length,
      decorCount: slotManager.getOccupied().length,
      speciesOwned,
      totalDeaths: gameState.totalDeaths,
    })
    if (milestoneAward > 0) {
      showToast(`Milestone unlocked! +${milestoneAward} coins`)
      hud.showCoinAnimation(milestoneAward)
    }
    gameState.checkMercy(fishes.length)
    hud.updateCoins(gameState.coins)
  }
```

- [ ] **Step 8: Pass hunger to fish state context**

In `updateFishBehaviors`, update the `StateContext` construction (around line 584-591). Add `hunger`:

Replace:
```typescript
    const ctx: StateContext = {
      threats: threats.map(t => ({ distance: fish.position.distanceTo(t) })),
      shelters: shelters.map(s => ({ distance: fish.position.distanceTo(s) })),
      school: school.map(s => ({ distance: fish.position.distanceTo(s.position) })),
      mouse: mouseDist < 3.0 ? { distance: mouseDist } : null,
      homeDecor: nearestHomePos ? { distance: nearestHomeDist } : null,
      nearestFlake: nearestFlakePos ? { distance: nearestFlakeDist } : null,
    }
```

With:
```typescript
    const ctx: StateContext = {
      threats: threats.map(t => ({ distance: fish.position.distanceTo(t) })),
      shelters: shelters.map(s => ({ distance: fish.position.distanceTo(s) })),
      school: school.map(s => ({ distance: fish.position.distanceTo(s.position) })),
      mouse: mouseDist < 3.0 ? { distance: mouseDist } : null,
      homeDecor: nearestHomePos ? { distance: nearestHomeDist } : null,
      nearestFlake: nearestFlakePos ? { distance: nearestFlakeDist } : null,
      hunger: fish.hunger,
    }
```

- [ ] **Step 9: Update addFish to cost coins (for shop purchases)**

Replace `addFish` (line 301-308) to accept an optional `fromShop` flag:

```typescript
function addFish(speciesId: SpeciesId, name: string, fromShop = false): void {
  if (fishes.length >= MAX_FISH) return
  if (fromShop) {
    const price = SPECIES_ECONOMY[speciesId].cost
    if (!gameState.spendCoins(price)) return
    hud.showCoinAnimation(-price)
  }
  const fish = new Fish(speciesId, name)
  fishes.push(fish)
  scene.add(fish.mesh)
  updateHUDCounts()
  hud.updateCoins(gameState.coins)
  persistState()
}
```

- [ ] **Step 10: Update HUD callbacks to use shop**

Update the `onAddFish` panel callback (line 321):

Replace:
```typescript
  onAddFish: (speciesId, name) => { addFish(speciesId, name) },
```

With:
```typescript
  onAddFish: (speciesId, name) => { addFish(speciesId, name, true) },
```

Update the `showAddFishPanel` call to pass coins (around line 375):

Replace:
```typescript
  onAddFish: () => showAddFishPanel(hud, fishes.length, MAX_FISH, panelCallbacks),
```

With:
```typescript
  onAddFish: () => showAddFishPanel(hud, fishes.length, MAX_FISH, gameState.coins, panelCallbacks),
```

- [ ] **Step 11: Update enterEditMode to pass economy callbacks**

Replace the `EditModeUI` construction in `enterEditMode` (lines 403-410):

```typescript
  editModeUI = new EditModeUI(app, {
    onSelectItem: (id) => { selectedDecorationId = id },
    onDone: () => exitEditMode(),
    getCoins: () => gameState.coins,
    onBuyDecoration: (id) => {
      const price = DECORATION_PRICES[id]
      if (!gameState.spendCoins(price)) return false
      hud.showCoinAnimation(-price)
      hud.updateCoins(gameState.coins)
      return true
    },
  })
```

- [ ] **Step 12: Add periodic save throttle for economy ticks**

Add a save throttle variable after the `clock` declaration (around line 664):

```typescript
let lastEconomySave = 0
```

In the animate loop, after the milestone check block, add:

```typescript
  // Throttled save for economy ticks (every 10 seconds)
  if (elapsed - lastEconomySave > 10) {
    lastEconomySave = elapsed
    persistState()
  }
```

- [ ] **Step 13: Verify build compiles and run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — all tests pass, no type errors

- [ ] **Step 14: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire GameState into main loop with economy, health ticks, shop, migration"
```

---

## Phase 3: Health Visual Indicators

### Task 11: Fish Health Bars

**Files:**
- Modify: `src/fish/fish.ts` (add health bar sprite)
- Modify: `src/main.ts` (update health bar position each frame)

- [ ] **Step 1: Add health bar creation to Fish class**

In `src/fish/fish.ts`, add a health bar sprite to the Fish class. Add property after `health`:

```typescript
healthBar: THREE.Sprite | null = null
private healthBarBg: THREE.Sprite | null = null
```

Add a method to Fish class:

```typescript
  createHealthBar(): void {
    // Background (red)
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = 64
    bgCanvas.height = 8
    const bgCtx = bgCanvas.getContext('2d')!
    bgCtx.fillStyle = '#ff3333'
    bgCtx.roundRect(0, 0, 64, 8, 3)
    bgCtx.fill()
    const bgTex = new THREE.CanvasTexture(bgCanvas)
    const bgMat = new THREE.SpriteMaterial({ map: bgTex, transparent: true, depthTest: false })
    this.healthBarBg = new THREE.Sprite(bgMat)
    this.healthBarBg.scale.set(0.5, 0.06, 1)
    this.healthBarBg.visible = false
    this.mesh.add(this.healthBarBg)

    // Foreground (green)
    const fgCanvas = document.createElement('canvas')
    fgCanvas.width = 64
    fgCanvas.height = 8
    const fgCtx = fgCanvas.getContext('2d')!
    fgCtx.fillStyle = '#33ff55'
    fgCtx.roundRect(0, 0, 64, 8, 3)
    fgCtx.fill()
    const fgTex = new THREE.CanvasTexture(fgCanvas)
    const fgMat = new THREE.SpriteMaterial({ map: fgTex, transparent: true, depthTest: false })
    this.healthBar = new THREE.Sprite(fgMat)
    this.healthBar.scale.set(0.5, 0.06, 1)
    this.healthBar.visible = false
    this.mesh.add(this.healthBar)
  }

  updateHealthBar(): void {
    if (!this.healthBar || !this.healthBarBg) return
    const show = this.health < 1.0
    this.healthBar.visible = show
    this.healthBarBg.visible = show
    if (show) {
      const yOffset = this.species.size + 0.15
      this.healthBarBg.position.set(0, yOffset, 0)
      this.healthBar.position.set(0, yOffset, 0)
      this.healthBar.scale.x = 0.5 * this.health
      // Shift bar left to align left edge with bg
      this.healthBar.position.x = -0.25 * (1 - this.health)
    }
  }
```

Call `this.createHealthBar()` at the end of the Fish constructor (after position setup).

- [ ] **Step 2: Call updateHealthBar in the main loop**

In `src/main.ts`, in `updateFishBehaviors`, after `fish.update(dt)` (around line 647), add:

```typescript
    fish.updateHealthBar()
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected: Health bars appear above fish when health < 1.0. They shrink as health decreases.

- [ ] **Step 4: Commit**

```bash
git add src/fish/fish.ts src/main.ts
git commit -m "feat: add health bar sprites above damaged fish"
```

---

### Task 12: Starving Behavior Override

**Files:**
- Modify: `src/fish/fish.ts:44-120` (FishStateMachine — starving overrides)

- [ ] **Step 1: Add starving behavior to state machine**

In `FishStateMachine.update()`, after the feed check (around line 74), add a starving override before the behavior-specific states:

```typescript
    // Starving fish lose behavior — only seek food or wander sluggishly
    if ((ctx.hunger ?? 0) > 0.9) {
      if (hasNearFlake) {
        this.current = 'feed'
        return
      }
      this.current = 'wander'
      return
    }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/fish/fish.test.ts`
Expected: PASS — existing tests don't set hunger > 0.9

- [ ] **Step 3: Commit**

```bash
git add src/fish/fish.ts
git commit -m "feat: starving fish override normal behavior, only seek food or wander"
```

---

## Phase 4: Leaderboard

### Task 13: Vercel KV Backend

**Files:**
- Create: `api/scores.ts`
- Modify: `package.json` (add `@vercel/kv`)

- [ ] **Step 1: Install @vercel/kv**

Run: `npm install @vercel/kv`

- [ ] **Step 2: Create the leaderboard API route**

Create `api/scores.ts`:

```typescript
import { kv } from '@vercel/kv'

const LEADERBOARD_KEY = 'fishthree:leaderboard'
const RATE_LIMIT_PREFIX = 'fishthree:rate:'
const RATE_LIMIT_SECONDS = 60
const MAX_NAME_LENGTH = 20
const TOP_N = 50

interface LeaderboardEntry {
  playerName: string
  totalCoinsEarned: number
  rank: number
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    return handleGet()
  }

  if (req.method === 'POST') {
    return handlePost(req)
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleGet(): Promise<Response> {
  const results = await kv.zrange(LEADERBOARD_KEY, 0, TOP_N - 1, { rev: true, withScores: true })

  const entries: LeaderboardEntry[] = []
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      playerName: results[i] as string,
      totalCoinsEarned: results[i + 1] as number,
      rank: Math.floor(i / 2) + 1,
    })
  }

  return new Response(JSON.stringify(entries), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handlePost(req: Request): Promise<Response> {
  let body: { playerName?: string; totalCoinsEarned?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { playerName, totalCoinsEarned } = body
  if (!playerName || typeof playerName !== 'string' || playerName.length < 1 || playerName.length > MAX_NAME_LENGTH) {
    return new Response(JSON.stringify({ error: 'Name must be 1-20 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (typeof totalCoinsEarned !== 'number' || totalCoinsEarned <= 0) {
    return new Response(JSON.stringify({ error: 'Score must be positive' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limiting by player name
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${playerName}`
  const existing = await kv.get(rateLimitKey)
  if (existing) {
    return new Response(JSON.stringify({ error: 'Rate limited. Try again in a minute.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await kv.zadd(LEADERBOARD_KEY, { score: totalCoinsEarned, member: playerName })
  await kv.set(rateLimitKey, 1, { ex: RATE_LIMIT_SECONDS })

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add api/scores.ts package.json package-lock.json
git commit -m "feat: add Vercel KV leaderboard API with rate limiting"
```

---

### Task 14: Leaderboard UI Panel

**Files:**
- Modify: `src/ui/panels.ts` (add `showLeaderboardPanel`)
- Modify: `src/ui/hud.ts` (add leaderboard button to sidebar)
- Modify: `src/ui/hud.css` (leaderboard styles)
- Modify: `src/main.ts` (wire leaderboard button)

- [ ] **Step 1: Add leaderboard panel function**

At the bottom of `src/ui/panels.ts`, add:

```typescript
export function showLeaderboardPanel(
  hud: HUD,
  playerName: string | null,
  totalCoinsEarned: number,
  onSubmit: (name: string) => void,
): void {
  let html = `
    <div class="panel-title">Leaderboard</div>
    <button class="panel-close">&times;</button>
    <div id="leaderboard-list" style="font-size:13px;opacity:0.6;">Loading...</div>
    <div class="leaderboard-submit" style="margin-top:12px;border-top:1px solid rgba(100,180,255,0.2);padding-top:12px;">
      <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">Your score: ${Math.floor(totalCoinsEarned)} coins</div>
      <div style="display:flex;gap:8px;">
        <input id="lb-name" class="tank-name" placeholder="Your name" value="${playerName || ''}" style="flex:1;font-size:13px;" maxlength="20" />
        <button class="edit-btn" id="lb-submit" style="padding:6px 14px;font-size:13px;">Submit</button>
      </div>
      <div id="lb-status" style="font-size:11px;margin-top:4px;opacity:0.6;"></div>
    </div>
  `

  hud.showPanel(html)

  // Fetch scores
  fetch('/api/scores')
    .then(r => r.json())
    .then((entries: { rank: number; playerName: string; totalCoinsEarned: number }[]) => {
      const listEl = document.getElementById('leaderboard-list')
      if (!listEl) return
      if (entries.length === 0) {
        listEl.innerHTML = '<p style="opacity:0.6;">No scores yet. Be the first!</p>'
        return
      }
      listEl.innerHTML = entries.map(e =>
        `<div class="lb-row${e.playerName === playerName ? ' lb-self' : ''}">
          <span class="lb-rank">#${e.rank}</span>
          <span class="lb-name">${e.playerName}</span>
          <span class="lb-score">${Math.floor(e.totalCoinsEarned)}</span>
        </div>`
      ).join('')
    })
    .catch(() => {
      const listEl = document.getElementById('leaderboard-list')
      if (listEl) listEl.innerHTML = '<p style="opacity:0.6;">Could not load leaderboard.</p>'
    })

  // Submit handler
  const panel = hud.getPanel()
  const submitBtn = panel.querySelector('#lb-submit')
  submitBtn?.addEventListener('click', () => {
    const nameInput = panel.querySelector('#lb-name') as HTMLInputElement
    const name = nameInput?.value.trim()
    if (!name) return
    onSubmit(name)

    const statusEl = panel.querySelector('#lb-status')
    if (statusEl) statusEl.textContent = 'Submitting...'

    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: name, totalCoinsEarned }),
    })
      .then(r => {
        if (r.ok) {
          if (statusEl) statusEl.textContent = 'Score submitted!'
        } else {
          return r.json().then(d => {
            if (statusEl) statusEl.textContent = d.error || 'Failed to submit.'
          })
        }
      })
      .catch(() => {
        if (statusEl) statusEl.textContent = 'Network error. Try again.'
      })
  })
}
```

- [ ] **Step 2: Add leaderboard CSS**

In `src/ui/hud.css`, add:

```css
.lb-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  gap: 8px;
  border-bottom: 1px solid rgba(100, 180, 255, 0.1);
}

.lb-row.lb-self {
  color: #ffd700;
  font-weight: 600;
}

.lb-rank {
  width: 30px;
  font-size: 12px;
  opacity: 0.6;
}

.lb-name {
  flex: 1;
  font-size: 13px;
}

.lb-score {
  font-size: 13px;
  color: #ffd700;
}
```

- [ ] **Step 3: Add leaderboard button to HUD sidebar**

In `src/ui/hud.ts`, update the `HUDCallbacks` interface to add `onLeaderboard`:

```typescript
export interface HUDCallbacks {
  onEditTank: () => void
  onFishList: () => void
  onAddFish: () => void
  onScreenshot: () => void
  onOrbitToggle: () => void
  onResetCamera: () => void
  onSettings: () => void
  onTankNameChange: (name: string) => void
  onLeaderboard: () => void
}
```

In the constructor's buttons array (around line 60-67), add a leaderboard entry after the settings button:

```typescript
      { icon: '\u{1F3C6}', action: callbacks.onLeaderboard, title: 'Leaderboard' },
```

- [ ] **Step 4: Wire leaderboard in main.ts**

In `src/main.ts`, update the HUD constructor (around line 372-384) to add the leaderboard callback:

```typescript
  onLeaderboard: () => showLeaderboardPanel(
    hud,
    gameState.playerName,
    gameState.totalCoinsEarned,
    (name) => { gameState.playerName = name; persistState() },
  ),
```

Add the import at the top of `main.ts`:

```typescript
import { showFishListPanel, showAddFishPanel, showSettingsPanel, showLeaderboardPanel, type PanelCallbacks } from './ui/panels'
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/panels.ts src/ui/hud.ts src/ui/hud.css src/main.ts
git commit -m "feat: add leaderboard UI panel with score submission"
```

---

## Phase 5: Final Integration

### Task 15: Onboarding Hint for New Players

**Files:**
- Modify: `src/main.ts` (add visual pointer to shop button for new players)

- [ ] **Step 1: Add onboarding hint**

In `restoreState()` in `main.ts`, after the `showToast('Welcome! ...')` for new players, add a subtle highlight on the Add Fish (shop) button. After the toast line, add:

```typescript
    // Brief pulse on the shop button to guide new players
    const shopBtn = document.querySelectorAll('.sidebar-btn')[1] as HTMLElement
    if (shopBtn) {
      shopBtn.style.animation = 'pulse-hint 1.5s ease-in-out 3'
      setTimeout(() => { shopBtn.style.animation = '' }, 4500)
    }
```

- [ ] **Step 2: Add pulse animation to CSS**

In `src/ui/hud.css`, add:

```css
@keyframes pulse-hint {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 12px rgba(34, 170, 85, 0.8); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main.ts src/ui/hud.css
git commit -m "feat: add onboarding pulse hint on shop button for new players"
```

---

### Task 16: Final Run — Full Test Suite + Manual Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type checker**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Manual verification checklist:
- Clear localStorage and reload — should see empty tank, 100 coins, welcome toast, shop button pulse
- Buy a guppy (10 coins) — coins decrease, fish appears
- Feed fish — 2 coins deducted, fish eats, +5 coins earned
- Wait — passive income ticks up coins
- Daily bonus toast appears on first load
- Fish health bars appear when hunger rises
- Decoration shop shows prices, unaffordable items grayed out
- Leaderboard panel opens, shows loading state
- Fish die when health hits 0 (may need to wait or set low health via console)
- Mercy mechanic triggers when at 0 fish and < 10 coins
- Refresh page — state persists correctly, offline hunger applied

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification for game economy"
```
