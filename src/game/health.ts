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
