export type BehaviorType = 'schooling' | 'territorial' | 'wanderer' | 'shy' | 'predator' | 'anchorer'
export type Personality = 'skittish' | 'curious' | 'neutral'

export interface SpeciesDefinition {
  name: string
  size: number
  speed: number
  tailFrequency: number
  behaviorType: BehaviorType
  personality: Personality
  color: number
  bodyWidth: number
  bodyHeight: number
  bodyLength: number
}

export type SpeciesId = 'tetra' | 'clownfish' | 'angelfish' | 'pufferfish' | 'barracuda' | 'seahorse'

export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
  tetra: {
    name: 'Tetra',
    size: 0.15,
    speed: 2.5,
    tailFrequency: 8,
    behaviorType: 'schooling',
    personality: 'skittish',
    color: 0x00ccff,
    bodyWidth: 0.12,
    bodyHeight: 0.15,
    bodyLength: 0.3,
  },
  clownfish: {
    name: 'Clownfish',
    size: 0.25,
    speed: 1.8,
    tailFrequency: 6,
    behaviorType: 'territorial',
    personality: 'curious',
    color: 0xff6622,
    bodyWidth: 0.2,
    bodyHeight: 0.25,
    bodyLength: 0.35,
  },
  angelfish: {
    name: 'Angelfish',
    size: 0.4,
    speed: 1.2,
    tailFrequency: 3,
    behaviorType: 'wanderer',
    personality: 'neutral',
    color: 0xffee44,
    bodyWidth: 0.1,
    bodyHeight: 0.5,
    bodyLength: 0.4,
  },
  pufferfish: {
    name: 'Pufferfish',
    size: 0.35,
    speed: 1.0,
    tailFrequency: 4,
    behaviorType: 'shy',
    personality: 'skittish',
    color: 0xaacc44,
    bodyWidth: 0.35,
    bodyHeight: 0.35,
    bodyLength: 0.35,
  },
  barracuda: {
    name: 'Barracuda',
    size: 0.6,
    speed: 2.0,
    tailFrequency: 5,
    behaviorType: 'predator',
    personality: 'neutral',
    color: 0x778899,
    bodyWidth: 0.15,
    bodyHeight: 0.2,
    bodyLength: 0.9,
  },
  seahorse: {
    name: 'Seahorse',
    size: 0.25,
    speed: 0.6,
    tailFrequency: 2,
    behaviorType: 'anchorer',
    personality: 'curious',
    color: 0xff88cc,
    bodyWidth: 0.1,
    bodyHeight: 0.35,
    bodyLength: 0.12,
  },
}
