import * as THREE from 'three'
import { TANK, SAND_SURFACE_Y } from '../scene/tank'
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
  scale: number
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
  ...makeSlots('floor_back', 5, SAND_SURFACE_Y + 0.01, -HD + 1.5, ['small', 'medium', 'large']),
  ...makeSlots('floor_front', 5, SAND_SURFACE_Y + 0.01, HD - 2.0, ['small', 'medium']),
  ...makeSlots('wall_upper', 4, HH * 0.3, -HD + 0.3, ['small', 'medium']),
  ...makeSlots('wall_lower', 4, -HH * 0.3, -HD + 0.3, ['small', 'medium']),
  ...makeSlots('ceiling', 2, HH - 0.2, 0, ['small', 'medium']),
]

/** Adjust mesh Y so it sits correctly in its zone */
function alignToSlot(mesh: THREE.Group, zone: SlotZone, slotY: number): void {
  // Force a world-matrix update so the bounding box is accurate
  mesh.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(mesh)
  if (zone === 'floor_back' || zone === 'floor_front') {
    // Bottom of model should rest on the slot Y (sand surface)
    mesh.position.y += slotY - box.min.y
  } else if (zone === 'ceiling') {
    // Top of model should touch the slot Y (ceiling)
    mesh.position.y += slotY - box.max.y
  }
  // wall slots: keep centered (default)
}

export class SlotManager {
  private slots: SlotState[]

  constructor() {
    this.slots = SLOT_DEFINITIONS.map(() => ({ decorationId: null, mesh: null, scale: 1 }))
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

  place(slotIndex: number, decorationId: DecorationId, scale = 1): boolean {
    if (!this.canPlace(slotIndex, decorationId)) return false
    const def = SLOT_DEFINITIONS[slotIndex]
    const decor = DECORATIONS[decorationId]
    const mesh = decor.createMesh()
    mesh.position.copy(def.position)
    mesh.scale.multiplyScalar(scale)
    alignToSlot(mesh, def.zone, def.position.y)
    this.slots[slotIndex] = { decorationId, mesh, scale }
    return true
  }

  remove(slotIndex: number): THREE.Group | null {
    const slot = this.slots[slotIndex]
    const mesh = slot.mesh
    this.slots[slotIndex] = { decorationId: null, mesh: null, scale: 1 }
    return mesh
  }

  /** Rebuild a placed decoration at a new scale. Returns [oldMesh, newMesh] for scene swap. */
  rescale(slotIndex: number, newScale: number): [THREE.Group | null, THREE.Group | null] {
    const slot = this.slots[slotIndex]
    if (!slot.mesh || !slot.decorationId) return [null, null]
    const clampedScale = Math.max(0.3, Math.min(3.0, newScale))
    const def = SLOT_DEFINITIONS[slotIndex]
    const oldMesh = slot.mesh
    const decor = DECORATIONS[slot.decorationId]
    const mesh = decor.createMesh()
    mesh.position.copy(def.position)
    mesh.scale.multiplyScalar(clampedScale)
    alignToSlot(mesh, def.zone, def.position.y)
    slot.mesh = mesh
    slot.scale = clampedScale
    return [oldMesh, mesh]
  }

  serialize(): { slotIndex: number; decorationId: DecorationId; scale?: number }[] {
    const result: { slotIndex: number; decorationId: DecorationId; scale?: number }[] = []
    for (let i = 0; i < this.slots.length; i++) {
      const state = this.slots[i]
      if (state.decorationId !== null) {
        result.push({
          slotIndex: i,
          decorationId: state.decorationId,
          scale: state.scale !== 1 ? state.scale : undefined,
        })
      }
    }
    return result
  }

  deserialize(data: { slotIndex: number; decorationId: DecorationId; scale?: number }[]): THREE.Group[] {
    const meshes: THREE.Group[] = []
    for (const { slotIndex, decorationId, scale } of data) {
      if (this.place(slotIndex, decorationId, scale ?? 1)) {
        const mesh = this.slots[slotIndex].mesh
        if (mesh) meshes.push(mesh)
      }
    }
    return meshes
  }
}
