import {
  MILESTONES, type MilestoneContext,
  MERCY_THRESHOLD, DAILY_BONUS_BASE, DAILY_STREAK_CAP,
} from './economy'
import { type EconomyState } from '../utils/storage'

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
    const today = todayISO.slice(0, 10)
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
