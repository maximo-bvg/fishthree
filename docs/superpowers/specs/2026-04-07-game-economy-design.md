# Game Economy & Leaderboard Design

## Overview

Transform FishThree from a free-form aquarium visualizer into a casual idle game with a coin economy, fish health/hunger system, shop, and online leaderboard. Built around a central GameState manager (Approach B) that owns all game logic.

## Build Order

1. Coins + GameState (foundation)
2. Shop + pricing (gives coins purpose)
3. Health/hunger (adds depth)
4. Leaderboard (online layer, last)

---

## 1. GameState Manager

New file: `src/game/state.ts`

A central class that owns all economy and health logic. The main loop calls `gameState.update(dt)` once per frame, and the UI reads state from it.

### Core State

- `coins: number` -- current balance
- `totalCoinsEarned: number` -- all-time total (leaderboard score)
- `lastDailyBonus: string | null` -- ISO date string of last daily claim
- `dailyStreak: number` -- consecutive days visited
- `milestones: Set<string>` -- earned milestone IDs (e.g., `"first_clownfish"`, `"10_fish"`)

### Frame Update (`update(dt)`)

Each frame:
1. Tick passive coin income based on alive, healthy fish
2. Tick fish hunger up over time (species-specific rate)
3. Check health drain for starving fish (hunger > 0.8)
4. Check health regen for fed fish (hunger < 0.5)
5. Remove fish that hit 0 health
6. Check milestone completions
7. Check mercy mechanic (0 fish + coins < 10 → set coins to 10)

### Methods

- `earnCoins(amount, reason)` -- adds to both `coins` and `totalCoinsEarned`
- `spendCoins(amount): boolean` -- returns false if insufficient
- `canAfford(amount): boolean`
- `claimDailyBonus(): number` -- returns coins awarded (base 25 * streak multiplier)

### Persistence

Serializes to a new `economy` field in `TankState`:

```typescript
interface EconomyState {
  coins: number
  totalCoinsEarned: number
  lastDailyBonus: string | null
  dailyStreak: number
  milestones: string[]
  lastSaveTimestamp: string  // for offline hunger calculation
}
```

Loaded on startup, saved on every state change (same pattern as current persistence).

---

## 2. Fish Health & Hunger

### New Fish Properties

- `hunger: number` (0-1, starts at 0). 0 = full, 1 = starving.
- `health: number` (0-1, starts at 1). 1 = healthy, 0 = dead.

### Hunger Rates

Species-specific `hungerRate` (hunger units per minute). Fast/active fish get hungry faster:

- Danio/Tetra: 0.03/min (fast, active)
- Guppy: 0.025/min
- Clownfish/Pufferfish: 0.02/min
- Angelfish/Pleco/Seahorse: 0.015/min
- Barracuda: 0.025/min (large, active)
- Jellyfish: 0.01/min (slow drifter)

These are starting values to be tuned during playtesting.

### Health Mechanics

- Hunger > 0.8: health drains at 0.05/min
- Hunger < 0.5: health regens at 0.02/min
- Health hits 0: fish dies and is removed (fade-out animation, bubble burst)
- No coins refunded on death

### Behavioral Changes

- Hunger > 0.6: fish seek food more aggressively (detection range increases from 4.0 to 6.0)
- Health < 0.3: swim speed reduced (0.5x multiplier)
- Hunger > 0.9: stop schooling/territorial behavior, only wander sluggishly or seek food

### Visual Indicators

- Small health bar above fish, only visible when health < 1.0 (fades in)
- Color desaturation as health drops
- No hunger bar -- hunger is read through behavior changes

### Eating Effects

- Hunger resets to 0
- Health begins slow regen (not instant full)
- Coins awarded via `gameState.earnCoins(5, 'feeding')`

---

## 3. Coin Economy

### Passive Income

Each species has a `coinRate` (coins per minute when healthy):

| Species    | Cost | Coin Rate | ROI (minutes to recoup) |
|------------|------|-----------|-------------------------|
| Guppy      | 10   | 1/min     | 10                      |
| Tetra      | 15   | 1/min     | 15                      |
| Danio      | 15   | 1/min     | 15                      |
| Clownfish  | 40   | 2/min     | 20                      |
| Pufferfish | 45   | 2/min     | 22.5                    |
| Pleco      | 55   | 3/min     | 18.3                    |
| Angelfish  | 60   | 3/min     | 20                      |
| Seahorse   | 65   | 3/min     | 21.7                    |
| Jellyfish  | 80   | 4/min     | 20                      |
| Barracuda  | 100  | 5/min     | 20                      |

Fish below 50% health produce nothing. Between 50-100% health, proportional output.

### Feeding Bonus

Each fish that eats a flake: +5 coins. Incentivizes active play.

### Daily Bonus

- First visit each day: base 25 coins * streak multiplier
- Streak caps at 7x (max 175 coins/day)
- Streak resets if a day is missed
- Shown as a toast notification on load

### Milestones (one-time bonuses)

| Milestone              | Coins |
|------------------------|-------|
| First fish purchased   | 50    |
| Each new species       | 25    |
| 5 fish in tank         | 50    |
| 10 fish in tank        | 100   |
| 12 fish (full tank)    | 200   |
| 5 decorations placed   | 50    |
| 10 decorations placed  | 100   |
| 20 decorations (full)  | 200   |
| First fish death       | 10    |

### Starting Coins

New players begin with **100 coins** and an empty tank.

### Mercy Mechanic

If a player reaches 0 fish and has fewer than 10 coins (cost of cheapest fish, the guppy), auto-grant 10 coins. Message: "Your tank is empty. Here's enough to start over." This prevents an unplayable dead end while preserving the consequence of failure.

### Coin Display

- Persistent coin counter in top HUD bar (next to fish/decoration counts)
- Brief "+N" / "-N" floating text on earn/spend (subtle, not distracting)

---

## 4. Shop & Pricing

### Fish Shop

Replaces the current free Add Fish panel. Same species card layout with coin prices displayed on each card.

**Pricing:**

| Species    | Price |
|------------|-------|
| Guppy      | 10    |
| Tetra      | 15    |
| Danio      | 15    |
| Clownfish  | 40    |
| Pufferfish | 45    |
| Pleco      | 55    |
| Angelfish  | 60    |
| Seahorse   | 65    |
| Jellyfish  | 80    |
| Barracuda  | 100   |

- Cards grayed out if can't afford
- Price shown in red if insufficient coins
- No confirmation dialog -- keeps it snappy
- Purchase sound effect (reuse existing UI SFX)

### Decoration Shop

Replaces the current free Edit Mode catalog. Same category tabs and item grid with prices.

**Pricing by tier:**

- Small plants/rocks: 15-25 coins
- Medium plants/rocks: 30-50 coins
- Large items: 60-80 coins
- Fun/themed items: 40-100 coins

- Same grayed-out / red price behavior as fish shop
- Decorations are cosmetic only (no coin production)

### Food Cost

- Each click to drop food: **2 coins**
- Small cost indicator near cursor or in HUD when feeding
- Prevents mindless spam-clicking while keeping feeding accessible

### No Refunds

Removing decorations or losing fish does not return coins. Keeps economy simple, gives weight to decisions.

---

## 5. Leaderboard

### Backend (Vercel KV)

Two serverless API routes:

**`POST /api/scores`**
- Body: `{ playerName: string, totalCoinsEarned: number }`
- Validates: name 1-20 chars, score > 0
- Rate limited: 1 submit per IP per minute (KV TTL key)
- Uses `ZADD` on sorted set key `leaderboard`

**`GET /api/scores`**
- Returns top 50 entries: `{ rank, playerName, totalCoinsEarned }[]`
- Uses `ZREVRANGE` with scores

### Frontend

- New "Leaderboard" button in left sidebar (trophy icon)
- Opens a panel (same pattern as fish list/settings)
- Scrollable list: rank, name, total coins earned
- Own entry highlighted if present
- "Submit Score" button with name input at the bottom
- Player name saved to localStorage (no re-entry)

### Score Submission

- Manual, not automatic -- player chooses when to submit
- Submits current `totalCoinsEarned` from GameState
- Higher score updates existing entry (sorted set handles naturally)

### Offline Resilience

- Fetch failure: "Could not load leaderboard" with retry button
- Submit failure: toast notification, no gameplay impact
- All gameplay works fully offline

### Anti-Abuse

- No auth (casual game, not competitive)
- Rate limiting per IP via KV TTL
- If abuse becomes a problem later: server-side score signing or simple auth

---

## 6. Migration & Starter Experience

### Existing Players (have localStorage data)

On first load after update, detect missing `economy` field in saved state:

- Grant migration bonus: `(fishCount * 30) + (decorationCount * 20)` coins
- Keep all existing fish and decorations (already "paid for")
- All fish start at full health, hunger at 0
- Toast: "Welcome to the new economy! You've been awarded X coins for your existing tank."

### New Players (no localStorage)

- Empty tank (no default fish spawn -- removes current 8-fish default)
- Start with 100 coins
- Onboarding prompt: "Welcome! Visit the shop to buy your first fish." pointing at shop button
- No tutorial, no forced flow

### Offline Hunger Calculation

When the app loads, calculate elapsed time since `lastSaveTimestamp`:

- Apply hunger ticks for elapsed real time
- Cap offline hunger accrual at **4 hours** worth
- This means leaving overnight: fish are hungry but not dead
- Multi-day neglect: fish will have taken health damage, some may die

---

## 7. Persistence Changes

### Updated TankState

```typescript
interface TankState {
  tankName: string
  fishes: FishSave[]
  decorations: DecorationSave[]
  settings: TankSettings
  economy: EconomyState        // NEW
}

interface FishSave {
  speciesId: SpeciesId
  name: string
  hunger: number               // NEW
  health: number               // NEW
}

interface EconomyState {
  coins: number
  totalCoinsEarned: number
  lastDailyBonus: string | null
  dailyStreak: number
  milestones: string[]
  lastSaveTimestamp: string
  playerName: string | null     // for leaderboard
}
```

### Save Triggers

Same as current: save on every state change (fish added/removed, decoration placed, settings changed) plus:
- After coin earn/spend
- After hunger/health tick (throttled to once per 10 seconds to avoid excessive writes)
- On page unload (`beforeunload` event, already likely in place)

---

## 8. New File Structure

```
src/
├── game/
│   ├── state.ts           # GameState class (economy, health, milestones)
│   ├── economy.ts         # Coin rates, prices, milestone definitions
│   └── health.ts          # Hunger/health tick logic, offline calculation
├── api/                   # Vercel serverless functions
│   └── scores.ts          # POST and GET leaderboard endpoints
```

All other changes are modifications to existing files (species.ts for pricing/rates, ui/ for shop and leaderboard panels, main.ts for wiring, storage.ts for new state shape).

---

## 9. UI Changes Summary

| Current                  | After                                          |
|--------------------------|------------------------------------------------|
| Add Fish panel (free)    | Fish Shop panel (prices, grayed if can't afford)|
| Edit Mode catalog (free) | Decoration Shop (prices in catalog grid)        |
| Feed (free clicks)       | Feed (2 coins per click, cost shown)            |
| HUD top bar              | + coin counter                                  |
| Left sidebar             | + Leaderboard button                            |
| No health indicators     | Health bars above damaged fish                  |
| 8 default fish on start  | Empty tank, 100 starting coins, onboarding hint |
