import * as THREE from 'three'
import { lowPolyMaterial, jitterVertices } from '../utils/geometry'

export type DecorationCategory = 'plants' | 'rocks' | 'accessories' | 'fun'
export type DecorationSize = 'small' | 'medium' | 'large'

export interface DecorationDefinition {
  name: string
  category: DecorationCategory
  size: DecorationSize
  createMesh: () => THREE.Group
}

export type DecorationId =
  | 'seaweed' | 'coral_fan' | 'anemone'
  | 'boulder' | 'rock_arch' | 'driftwood'
  | 'bubbler' | 'tank_light'
  | 'treasure_chest' | 'diver' | 'sunken_ship'
  | 'brain_coral' | 'kelp' | 'coral_cluster' | 'volcano_bubbler' | 'treasure_map'

function createSeaweed(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x22aa44)
  const segments = 5
  for (let i = 0; i < segments; i++) {
    const radius = 0.12 - i * 0.015
    const geo = new THREE.CylinderGeometry(radius, radius + 0.02, 0.35, 5)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = i * 0.3
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function createCoralFan(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0xff6688)
  const geo = new THREE.CircleGeometry(0.6, 8)
  jitterVertices(geo, 0.08)
  const fan = new THREE.Mesh(geo, mat)
  fan.castShadow = true
  group.add(fan)
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 4)
  const stem = new THREE.Mesh(stemGeo, lowPolyMaterial(0xcc5566))
  stem.position.y = -0.5
  group.add(stem)
  return group
}

function createAnemone(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0xee44aa)
  const tentacles = 8
  for (let i = 0; i < tentacles; i++) {
    const angle = (i / tentacles) * Math.PI * 2
    const geo = new THREE.CylinderGeometry(0.03, 0.05, 0.35, 4)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(Math.cos(angle) * 0.15, 0.15, Math.sin(angle) * 0.15)
    mesh.rotation.z = Math.cos(angle) * 0.3
    mesh.rotation.x = Math.sin(angle) * 0.3
    mesh.castShadow = true
    group.add(mesh)
  }
  const baseGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.1, 6)
  const base = new THREE.Mesh(baseGeo, lowPolyMaterial(0xcc3388))
  group.add(base)
  return group
}

function createBoulder(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.IcosahedronGeometry(0.5, 1)
  geo.scale(1.2, 0.8, 1.0)
  jitterVertices(geo, 0.06)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0x888877))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

function createRockArch(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x887766)
  const colGeo = new THREE.CylinderGeometry(0.2, 0.25, 1.0, 5)
  jitterVertices(colGeo, 0.04)
  const left = new THREE.Mesh(colGeo, mat)
  left.position.set(-0.5, 0.5, 0)
  left.castShadow = true
  group.add(left)
  const right = new THREE.Mesh(colGeo.clone(), mat)
  right.position.set(0.5, 0.5, 0)
  right.castShadow = true
  group.add(right)
  const bridgeGeo = new THREE.BoxGeometry(1.2, 0.2, 0.4)
  jitterVertices(bridgeGeo, 0.03)
  const bridge = new THREE.Mesh(bridgeGeo, mat)
  bridge.position.y = 1.05
  bridge.castShadow = true
  group.add(bridge)
  return group
}

function createDriftwood(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.CylinderGeometry(0.08, 0.12, 1.2, 5)
  jitterVertices(geo, 0.03)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0x8b6914))
  mesh.rotation.z = 0.3
  mesh.castShadow = true
  group.add(mesh)
  const branchGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.5, 4)
  const branch = new THREE.Mesh(branchGeo, lowPolyMaterial(0x7a5c12))
  branch.position.set(0.2, 0.3, 0)
  branch.rotation.z = -0.6
  branch.castShadow = true
  group.add(branch)
  return group
}

function createBubbler(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(0.25, 0.15, 0.2)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0x555555))
  mesh.castShadow = true
  group.add(mesh)
  const nozzleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 4)
  const nozzle = new THREE.Mesh(nozzleGeo, lowPolyMaterial(0x666666))
  nozzle.position.y = 0.12
  group.add(nozzle)
  return group
}

function createTankLight(): THREE.Group {
  const group = new THREE.Group()
  const housingGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.12, 6)
  const housing = new THREE.Mesh(housingGeo, lowPolyMaterial(0x333333))
  group.add(housing)
  const lensGeo = new THREE.CircleGeometry(0.14, 6)
  const lens = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 2.0,
  }))
  lens.name = 'tank_light_lens'
  lens.rotation.x = -Math.PI / 2
  lens.position.y = -0.07
  group.add(lens)
  return group
}

function createTreasureChest(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x8b4513)
  const baseGeo = new THREE.BoxGeometry(0.6, 0.35, 0.4)
  const base = new THREE.Mesh(baseGeo, mat)
  base.castShadow = true
  group.add(base)
  const lidGeo = new THREE.BoxGeometry(0.6, 0.08, 0.4)
  const lid = new THREE.Mesh(lidGeo, mat)
  lid.position.set(0, 0.2, -0.1)
  lid.rotation.x = -0.3
  lid.castShadow = true
  group.add(lid)
  const goldGeo = new THREE.SphereGeometry(0.08, 4, 4)
  const goldMat = lowPolyMaterial(0xffd700)
  for (let i = 0; i < 3; i++) {
    const gold = new THREE.Mesh(goldGeo, goldMat)
    gold.position.set((i - 1) * 0.12, 0.15, 0)
    group.add(gold)
  }
  return group
}

function createDiver(): THREE.Group {
  const group = new THREE.Group()
  const bodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.4, 5)
  const body = new THREE.Mesh(bodyGeo, lowPolyMaterial(0x222222))
  body.castShadow = true
  group.add(body)
  const headGeo = new THREE.SphereGeometry(0.12, 5, 5)
  const head = new THREE.Mesh(headGeo, lowPolyMaterial(0xddaa00))
  head.position.y = 0.3
  head.castShadow = true
  group.add(head)
  const visorGeo = new THREE.CircleGeometry(0.06, 5)
  const visor = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: 0x4488ff }))
  visor.position.set(0, 0.3, 0.12)
  group.add(visor)
  return group
}

function createSunkenShip(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x6b4226)
  const hullGeo = new THREE.BoxGeometry(1.6, 0.5, 0.6)
  jitterVertices(hullGeo, 0.04)
  const hull = new THREE.Mesh(hullGeo, mat)
  hull.rotation.z = 0.15
  hull.castShadow = true
  group.add(hull)
  const mastGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.0, 4)
  const mast = new THREE.Mesh(mastGeo, lowPolyMaterial(0x5a3820))
  mast.position.set(-0.2, 0.6, 0)
  mast.rotation.z = -0.1
  mast.castShadow = true
  group.add(mast)
  const sailGeo = new THREE.PlaneGeometry(0.4, 0.5)
  jitterVertices(sailGeo, 0.05)
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({
    color: 0xccbb99,
    side: THREE.DoubleSide,
    flatShading: true,
  }))
  sail.position.set(-0.2, 0.7, 0.05)
  group.add(sail)
  return group
}

function createBrainCoral(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  jitterVertices(geo, 0.04)
  const mesh = new THREE.Mesh(geo, lowPolyMaterial(0xee8866))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

function createKelp(): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(0x337733)
  const segments = 8
  for (let i = 0; i < segments; i++) {
    const radius = 0.1 - i * 0.008
    const geo = new THREE.CylinderGeometry(radius, radius + 0.015, 0.3, 5)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = i * 0.27
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function createCoralCluster(): THREE.Group {
  const group = new THREE.Group()
  const colors = [0xff6655, 0xffaa44, 0xff88aa]
  const heights = [0.5, 0.35, 0.45, 0.3]
  for (let i = 0; i < heights.length; i++) {
    const geo = new THREE.CylinderGeometry(0.06, 0.08, heights[i], 5)
    const mesh = new THREE.Mesh(geo, lowPolyMaterial(colors[i % colors.length]))
    const angle = (i / heights.length) * Math.PI * 2
    mesh.position.set(Math.cos(angle) * 0.12, heights[i] / 2, Math.sin(angle) * 0.12)
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function createVolcanoBubbler(): THREE.Group {
  const group = new THREE.Group()
  const coneGeo = new THREE.ConeGeometry(0.4, 0.8, 6)
  const cone = new THREE.Mesh(coneGeo, lowPolyMaterial(0x444444))
  cone.position.y = 0.4
  cone.castShadow = true
  group.add(cone)
  // Crater at top
  const craterGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.1, 6)
  const crater = new THREE.Mesh(craterGeo, lowPolyMaterial(0x332211))
  crater.position.y = 0.8
  group.add(crater)
  return group
}

function createTreasureMap(): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.PlaneGeometry(0.5, 0.4)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xddcc88,
    side: THREE.DoubleSide,
    roughness: 0.9,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2 + 0.05 // nearly flat on floor
  mesh.position.y = 0.02
  mesh.castShadow = true
  group.add(mesh)
  return group
}

export const DECORATIONS: Record<DecorationId, DecorationDefinition> = {
  seaweed:        { name: 'Seaweed',        category: 'plants',      size: 'medium', createMesh: createSeaweed },
  coral_fan:      { name: 'Coral Fan',      category: 'plants',      size: 'medium', createMesh: createCoralFan },
  anemone:        { name: 'Anemone',        category: 'plants',      size: 'small',  createMesh: createAnemone },
  boulder:        { name: 'Boulder',        category: 'rocks',       size: 'medium', createMesh: createBoulder },
  rock_arch:      { name: 'Rock Arch',      category: 'rocks',       size: 'large',  createMesh: createRockArch },
  driftwood:      { name: 'Driftwood',      category: 'rocks',       size: 'medium', createMesh: createDriftwood },
  bubbler:        { name: 'Bubbler',        category: 'accessories', size: 'small',  createMesh: createBubbler },
  tank_light:     { name: 'Tank Light',     category: 'accessories', size: 'medium', createMesh: createTankLight },
  treasure_chest: { name: 'Treasure Chest', category: 'fun',         size: 'medium', createMesh: createTreasureChest },
  diver:          { name: 'Diver',          category: 'fun',         size: 'small',  createMesh: createDiver },
  sunken_ship:    { name: 'Sunken Ship',    category: 'fun',         size: 'large',  createMesh: createSunkenShip },
  brain_coral:      { name: 'Brain Coral',      category: 'plants',      size: 'medium', createMesh: createBrainCoral },
  kelp:             { name: 'Kelp',             category: 'plants',      size: 'medium', createMesh: createKelp },
  coral_cluster:    { name: 'Coral Cluster',    category: 'rocks',       size: 'medium', createMesh: createCoralCluster },
  volcano_bubbler:  { name: 'Volcano Bubbler',  category: 'accessories', size: 'medium', createMesh: createVolcanoBubbler },
  treasure_map:     { name: 'Treasure Map',     category: 'fun',         size: 'small',  createMesh: createTreasureMap },
}
