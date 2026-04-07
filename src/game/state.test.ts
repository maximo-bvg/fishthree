import { describe, it, expect, beforeEach } from 'vitest'
import { GameState } from './state'
import { STARTING_COINS, MERCY_THRESHOLD, DAILY_BONUS_BASE, DAILY_STREAK_CAP } from './economy'

describe('GameState', () => {
  let gs: GameState

  beforeEach(() => {
    gs = new GameState()
  })

  describe('coin management', () => {
    it('starts with 0 coins', () => {
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
      expect(gs.totalCoinsEarned).toBe(100)
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
      expect(earned).toBeGreaterThan(0)
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
      const award = gs.claimDailyBonus('2026-04-11')
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
