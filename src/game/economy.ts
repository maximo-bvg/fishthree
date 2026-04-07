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
export const MERCY_THRESHOLD = 10
export const DAILY_BONUS_BASE = 25
export const DAILY_STREAK_CAP = 7
export const OFFLINE_HUNGER_CAP_HOURS = 4
export const HEALTH_DRAIN_HUNGER_THRESHOLD = 0.8
export const HEALTH_REGEN_HUNGER_THRESHOLD = 0.5
export const HEALTH_DRAIN_RATE = 0.05
export const HEALTH_REGEN_RATE = 0.02
export const HUNGER_FEED_THRESHOLD = 0.6
export const PASSIVE_INCOME_HEALTH_FLOOR = 0.5
