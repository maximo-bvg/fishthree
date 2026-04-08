export type BehaviorType = 'schooling' | 'territorial' | 'wanderer' | 'shy' | 'predator' | 'anchorer' | 'bottom-dweller' | 'drifter' | 'surface-swimmer'
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
  modelPath?: string   // path to GLB model in public/models/
  modelScale?: number  // scale factor for the loaded model
  modelRotation?: [number, number, number]  // [x, y, z] euler rotation correction for the inner model
}

export type SpeciesId = 'tetra' | 'clownfish' | 'angelfish' | 'pufferfish' | 'barracuda' | 'pleco' | 'danio' | 'jellyfish' | 'guppy'

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
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.15,
    modelRotation: [0, 0, 0],
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
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.25,
    modelRotation: [0, 0, 0],
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
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.4,
    modelRotation: [0, 0, 0],
  },
  pufferfish: {
    name: 'Pufferfish',
    size: 0.35,
    speed: 2.0,
    tailFrequency: 4,
    behaviorType: 'shy',
    personality: 'skittish',
    color: 0xaacc44,
    bodyWidth: 0.35,
    bodyHeight: 0.35,
    bodyLength: 0.35,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.35,
    modelRotation: [0, 0, 0],
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
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.6,
    modelRotation: [0, 0, 0],
  },
  pleco: {
    name: 'Pleco',
    size: 0.45,
    speed: 0.8,
    tailFrequency: 2,
    behaviorType: 'bottom-dweller',
    personality: 'neutral',
    color: 0x554433,
    bodyWidth: 0.2,
    bodyHeight: 0.15,
    bodyLength: 0.5,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.45,
    modelRotation: [0, 0, 0],
  },
  danio: {
    name: 'Danio',
    size: 0.12,
    speed: 3.5,
    tailFrequency: 10,
    behaviorType: 'schooling',
    personality: 'skittish',
    color: 0x4488ff,
    bodyWidth: 0.1,
    bodyHeight: 0.1,
    bodyLength: 0.25,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.12,
    modelRotation: [0, 0, 0],
  },
  jellyfish: {
    name: 'Jellyfish',
    size: 0.35,
    speed: 0.4,
    tailFrequency: 0.8,
    behaviorType: 'drifter',
    personality: 'neutral',
    color: 0xddaaff,
    bodyWidth: 0.3,
    bodyHeight: 0.35,
    bodyLength: 0.3,
    // No modelPath — uses custom procedural mesh
  },
  guppy: {
    name: 'Guppy',
    size: 0.1,
    speed: 2.0,
    tailFrequency: 9,
    behaviorType: 'surface-swimmer',
    personality: 'curious',
    color: 0xff6699,
    bodyWidth: 0.08,
    bodyHeight: 0.08,
    bodyLength: 0.2,
    modelPath: '/models/fish_generic_rigged.glb',
    modelScale: 0.1,
    modelRotation: [0, 0, 0],
  },
}
