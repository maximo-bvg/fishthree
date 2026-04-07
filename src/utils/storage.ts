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
