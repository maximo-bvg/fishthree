import * as THREE from 'three'
import { type Fish } from './fish'
import { computeBoids, BOIDS_DEFAULTS } from './boids'
import { TANK } from '../scene/tank'

const _dir = new THREE.Vector3()
const _toHome = new THREE.Vector3()

export function updateWander(fish: Fish, dt: number): void {
  if (Math.random() < dt * 0.5) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 2,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
    )
  }
}

export function updateSchool(fish: Fish, school: Fish[], _dt: number): void {
  const agents = school.map(f => ({ position: f.position, velocity: f.velocity }))
  const self = { position: fish.position, velocity: fish.velocity }
  const force = computeBoids(self, agents, BOIDS_DEFAULTS)
  fish.targetVelocity.add(force).clampLength(0, fish.species.speed)
}

export function updateFlee(fish: Fish, threats: THREE.Vector3[], _dt: number): void {
  if (threats.length === 0) return
  let nearest = threats[0]
  let minDist = fish.position.distanceTo(threats[0])
  for (let i = 1; i < threats.length; i++) {
    const d = fish.position.distanceTo(threats[i])
    if (d < minDist) { minDist = d; nearest = threats[i] }
  }
  _dir.subVectors(fish.position, nearest).normalize().multiplyScalar(fish.species.speed * 1.5)
  fish.targetVelocity.copy(_dir)
}

export function updateHide(fish: Fish, shelters: THREE.Vector3[], _dt: number): void {
  if (shelters.length === 0) { updateWander(fish, _dt); return }
  let nearest = shelters[0]
  let minDist = fish.position.distanceTo(shelters[0])
  for (let i = 1; i < shelters.length; i++) {
    const d = fish.position.distanceTo(shelters[i])
    if (d < minDist) { minDist = d; nearest = shelters[i] }
  }
  _dir.subVectors(nearest, fish.position).normalize().multiplyScalar(fish.species.speed * 0.8)
  fish.targetVelocity.copy(_dir)
  if (minDist < 0.5) {
    fish.targetVelocity.multiplyScalar(0.2)
  }
}

export function updateTerritorial(fish: Fish, homePos: THREE.Vector3, intruders: Fish[], _dt: number): void {
  const orbitRadius = 1.2
  _toHome.subVectors(homePos, fish.position)
  const dist = _toHome.length()

  for (const intruder of intruders) {
    const intruderDist = intruder.position.distanceTo(homePos)
    if (intruderDist < orbitRadius * 1.5 && intruder.speciesId !== fish.speciesId) {
      _dir.subVectors(intruder.position, fish.position).normalize().multiplyScalar(fish.species.speed * 1.3)
      fish.targetVelocity.copy(_dir)
      return
    }
  }

  if (dist > orbitRadius * 1.5) {
    _dir.copy(_toHome).normalize().multiplyScalar(fish.species.speed * 0.8)
  } else if (dist < orbitRadius * 0.5) {
    _dir.copy(_toHome).normalize().multiplyScalar(-fish.species.speed * 0.4)
  } else {
    _dir.crossVectors(_toHome, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(fish.species.speed * 0.6)
  }
  fish.targetVelocity.copy(_dir)
}

export function updatePredatorPatrol(fish: Fish, dt: number): void {
  // Update patrol direction frequently so barracuda keeps moving
  if (Math.random() < dt * 1.5) {
    const hw = TANK.width / 2 - 2
    const hd = TANK.depth / 2 - 1
    const angle = Math.atan2(fish.position.z, fish.position.x) + 0.4
    const tx = Math.cos(angle) * hw
    const tz = Math.sin(angle) * hd
    _dir.set(tx - fish.position.x, (Math.random() - 0.5) * 0.8, tz - fish.position.z)
    _dir.normalize().multiplyScalar(fish.species.speed * 0.9)
    fish.targetVelocity.copy(_dir)
  }
}

export function updateReact(fish: Fish, mouseWorldPos: THREE.Vector3, _dt: number): void {
  _dir.subVectors(mouseWorldPos, fish.position)
  if (fish.species.personality === 'skittish') {
    _dir.negate()
  }
  _dir.normalize().multiplyScalar(fish.species.speed * 0.8)
  fish.targetVelocity.copy(_dir)
}
