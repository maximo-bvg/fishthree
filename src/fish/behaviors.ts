import * as THREE from 'three'
import { type Fish } from './fish'
import { computeBoids, BOIDS_DEFAULTS } from './boids'
import { TANK, SAND_SURFACE_Y } from '../scene/tank'

const _dir = new THREE.Vector3()
const _toHome = new THREE.Vector3()

export function updateWander(fish: Fish, dt: number): void {
  // Ensure fish always has some minimum velocity
  if (fish.targetVelocity.lengthSq() < 0.01) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 2,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
    )
  }
  if (Math.random() < dt * 1.0) {
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

  // Start from current velocity and apply boid steering (don't accumulate)
  fish.targetVelocity.copy(fish.velocity).add(force)

  // If velocity is near zero (deadlocked school), pick a random direction
  if (fish.targetVelocity.lengthSq() < 0.1) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.6,
    )
  }

  // Boids steer direction — always maintain swimming speed
  fish.targetVelocity.normalize().multiplyScalar(fish.species.speed)
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

export function updateFeed(fish: Fish, flakePos: THREE.Vector3, _dt: number): void {
  _dir.subVectors(flakePos, fish.position).normalize().multiplyScalar(fish.species.speed * 1.2)
  fish.targetVelocity.copy(_dir)
}

export function updateBottomDwell(fish: Fish, dt: number): void {
  const floorY = SAND_SURFACE_Y
  const ceilingY = floorY + TANK.height * 0.2

  if (fish.targetVelocity.lengthSq() < 0.01 || Math.random() < dt * 0.3) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 2,
      0,
      (Math.random() - 0.5) * fish.species.speed * 0.6,
    )
  }

  if (fish.position.y > ceilingY) {
    fish.targetVelocity.y = -fish.species.speed * 0.5
  } else if (fish.position.y < floorY + fish.species.size) {
    fish.targetVelocity.y = fish.species.speed * 0.2
  } else {
    fish.targetVelocity.y *= 0.9
  }
}

export function updateDrift(fish: Fish, dt: number): void {
  if (Math.random() < dt * 0.15) {
    fish.targetVelocity.set(
      (Math.random() - 0.5) * fish.species.speed * 1.5,
      (Math.random() - 0.5) * fish.species.speed * 0.5,
      (Math.random() - 0.5) * fish.species.speed * 0.5,
    )
  }

  const minY = SAND_SURFACE_Y + TANK.height * 0.3
  if (fish.position.y < minY) {
    fish.targetVelocity.y = fish.species.speed * 0.3
  }
}

export function updateSurfaceSwim(fish: Fish, school: Fish[], dt: number): void {
  if (school.length > 0) {
    const agents = school.map(f => ({ position: f.position, velocity: f.velocity }))
    const self = { position: fish.position, velocity: fish.velocity }
    const force = computeBoids(self, agents, { ...BOIDS_DEFAULTS, separationDist: 2.0 })
    fish.targetVelocity.copy(fish.velocity).add(force)

    if (fish.targetVelocity.lengthSq() < 0.1) {
      fish.targetVelocity.set(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 0.6,
      )
    }
    fish.targetVelocity.normalize().multiplyScalar(fish.species.speed)
  } else {
    updateWander(fish, dt)
  }

  const surfaceY = TANK.height / 2
  const minY = surfaceY - TANK.height * 0.2
  if (fish.position.y < minY) {
    fish.targetVelocity.y = fish.species.speed * 0.5
  } else if (fish.position.y > surfaceY - fish.species.size) {
    fish.targetVelocity.y = -fish.species.speed * 0.2
  }
}
