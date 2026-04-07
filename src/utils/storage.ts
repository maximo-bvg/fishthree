import { type SpeciesId } from '../fish/species'
import { type DecorationId } from '../decorations/catalog'

const STORAGE_KEY = 'fishthree-state'

export interface FishSave {
  speciesId: SpeciesId
  name: string
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

export interface TankState {
  tankName: string
  fishes: FishSave[]
  decorations: DecorationSave[]
  settings: TankSettings
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
