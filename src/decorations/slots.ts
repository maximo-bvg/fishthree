import * as THREE from 'three'
import { TANK } from '../scene/tank'
import { DECORATIONS, type DecorationId, type DecorationSize } from './catalog'

export type SlotZone = 'floor_back' | 'floor_front' | 'wall_upper' | 'wall_lower' | 'ceiling'

export interface SlotDefinition {
  zone: SlotZone
  position: THREE.Vector3
  acceptedSizes: DecorationSize[]
}

export interface SlotState {
  decorationId: DecorationId | null
  mesh: THREE.Group | null
}

const HW = TANK.width / 2
const HH = TANK.height / 2
const HD = TANK.depth / 2

function makeSlots(zone: SlotZone, count: number, y: number, z: number, acceptedSizes: DecorationSize[]): SlotDefinition[] {
  const slots: SlotDefinition[] = []
  const spacing = (TANK.width - 2) / (count - 1)
  const startX = -(TANK.width - 2) / 2
  for (let i = 0; i < count; i++) {
    slots.push({
      zone,
      position: new THREE.Vector3(startX + i * spacing, y, z),
      acceptedSizes,
    })
  }
  return slots
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  ...makeSlots('floor_back', 5, -HH + 0.01, -HD + 1.5, ['small', 'medium', 'large']),
  ...makeSlots('floor_front', 5, -HH + 0.01, HD - 2.0, ['small', 'medium']),
  ...makeSlots('wall_upper', 4, HH * 0.3, -HD + 0.3, ['small', 'medium']),
  ...makeSlots('wall_lower', 4, -HH * 0.3, -HD + 0.3, ['small', 'medium']),
  ...makeSlots('ceiling', 2, HH - 0.2, 0, ['small', 'medium']),
]

export class SlotManager {
  private slots: SlotState[]

  constructor() {
    this.slots = SLOT_DEFINITIONS.map(() => ({ decorationId: null, mesh: null }))
  }

  getSlot(index: number): SlotState {
    return this.slots[index]
  }

  getOccupied(): { index: number; state: SlotState }[] {
    return this.slots
      .map((state, index) => ({ index, state }))
      .filter(({ state }) => state.decorationId !== null)
  }

  getEmpty(): { index: number; def: SlotDefinition }[] {
    return this.slots
      .map((state, index) => ({ index, state, def: SLOT_DEFINITIONS[index] }))
      .filter(({ state }) => state.decorationId === null)
      .map(({ index, def }) => ({ index, def }))
  }

  canPlace(slotIndex: number, decorationId: DecorationId): boolean {
    const slot = this.slots[slotIndex]
    if (slot.decorationId !== null) return false
    const def = SLOT_DEFINITIONS[slotIndex]
    const decor = DECORATIONS[decorationId]
    return def.acceptedSizes.includes(decor.size)
  }

  place(slotIndex: number, decorationId: DecorationId): boolean {
    if (!this.canPlace(slotIndex, decorationId)) return false
    const decor = DECORATIONS[decorationId]
    const mesh = decor.createMesh()
    const pos = SLOT_DEFINITIONS[slotIndex].position
    mesh.position.copy(pos)
    this.slots[slotIndex] = { decorationId, mesh }
    return true
  }

  remove(slotIndex: number): THREE.Group | null {
    const slot = this.slots[slotIndex]
    const mesh = slot.mesh
    this.slots[slotIndex] = { decorationId: null, mesh: null }
    return mesh
  }

  serialize(): { slotIndex: number; decorationId: DecorationId }[] {
    return this.slots
      .map((state, index) => ({ slotIndex: index, decorationId: state.decorationId }))
      .filter((s): s is { slotIndex: number; decorationId: DecorationId } => s.decorationId !== null)
  }

  deserialize(data: { slotIndex: number; decorationId: DecorationId }[]): THREE.Group[] {
    const meshes: THREE.Group[] = []
    for (const { slotIndex, decorationId } of data) {
      if (this.place(slotIndex, decorationId)) {
        const mesh = this.slots[slotIndex].mesh
        if (mesh) meshes.push(mesh)
      }
    }
    return meshes
  }
}
