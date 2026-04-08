import * as THREE from 'three'
import { type Fish } from './fish'
import { computeBoids, BOIDS_DEFAULTS } from './boids'
import { TANK, SAND_SURFACE_Y } from '../scene/tank'

const _dir = new THREE.Vector3()
const _toHome = new THREE.Vector3()

/**
 * Craig Reynolds' wander steering behavior.
 * Projects a circle in front of the fish and picks a target point on the
 * circle's perimeter.  The target drifts smoothly each frame via small
 * angular jitter, producing organic S-curve swimming paths instead of
 * jerky random direction changes.
 */
export function updateWander(fish: Fish, dt: number): void {
  const speed = fish.species.speed

  // Wander circle parameters (tuned for natural fish motion)
  const wanderDistance = 2.0   // how far ahead the circle is projected
  const wanderRadius = 1.2    // radius of the wander circle
  const jitterRate = 1.8      // radians/sec max angular drift

  // Smoothly drift the wander angle — small random jitter each frame
  fish.wanderAngle += (Math.random() - 0.5) * 2 * jitterRate * dt

  // Current heading in the XZ plane (horizontal)
  const vx = fish.velocity.x
  const vz = fish.velocity.z
  const headingLen = Math.sqrt(vx * vx + vz * vz)
  let headingAngle: number
  if (headingLen > 0.001) {
    headingAngle = Math.atan2(vz, vx)
  } else {
    // No horizontal velocity yet — use the wander angle directly
    headingAngle = fish.wanderAngle
  }

  // Project circle center ahead of the fish along current heading
  const cx = Math.cos(headingAngle) * wanderDistance
  const cz = Math.sin(headingAngle) * wanderDistance

  // Pick a point on the wander circle perimeter
  const tx = cx + Math.cos(fish.wanderAngle) * wanderRadius
  const tz = cz + Math.sin(fish.wanderAngle) * wanderRadius

  // Gentle vertical undulation — sine wave for natural up/down drift
  const verticalAmplitude = speed * 0.15
  const verticalFreq = 0.4 + (fish.wanderAngle % 1.0) * 0.3 // slightly varied per fish
  const ty = Math.sin(fish.wanderAngle * verticalFreq) * verticalAmplitude

  _dir.set(tx, ty, tz).normalize().multiplyScalar(speed)
  fish.targetVelocity.copy(_dir)
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

/** Find the obstacle radius for a position (0 if no obstacle there) */
function obstacleRadiusAt(fish: Fish, pos: THREE.Vector3): number {
  for (const obs of fish.obstacles) {
    if (obs.position.distanceTo(pos) < obs.radius) return obs.radius
  }
  return 0
}

export function updateHide(fish: Fish, shelters: THREE.Vector3[], _dt: number): void {
  if (shelters.length === 0) { updateWander(fish, _dt); return }
  let nearest = shelters[0]
  let minDist = fish.position.distanceTo(shelters[0])
  for (let i = 1; i < shelters.length; i++) {
    const d = fish.position.distanceTo(shelters[i])
    if (d < minDist) { minDist = d; nearest = shelters[i] }
  }
  const safeRadius = obstacleRadiusAt(fish, nearest) + fish.species.size + 0.5
  if (minDist > safeRadius) {
    _dir.subVectors(nearest, fish.position).normalize().multiplyScalar(fish.species.speed * 0.8)
    fish.targetVelocity.copy(_dir)
  } else {
    // Orbit at safe distance
    _dir.subVectors(fish.position, nearest)
    _dir.crossVectors(_dir, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(fish.species.speed * 0.3)
    fish.targetVelocity.copy(_dir)
  }
}

export function updateTerritorial(fish: Fish, homePos: THREE.Vector3, intruders: Fish[], _dt: number): void {
  const minOrbit = obstacleRadiusAt(fish, homePos) + fish.species.size + 0.5
  const orbitRadius = Math.max(minOrbit, 1.2)
  _toHome.subVectors(homePos, fish.position)
  const dist = _toHome.length()

  for (const intruder of intruders) {
    const intruderDist = intruder.position.distanceTo(homePos)
    if (intruderDist < orbitRadius * 1.5 && intruder.speciesId !== fish.speciesId) {
      const toIntruder = fish.position.distanceTo(intruder.position)
      const minApproach = fish.species.size + intruder.species.size
      if (toIntruder < minApproach * 1.2) {
        // Too close to intruder — back off instead of driving into them
        _dir.subVectors(fish.position, intruder.position).normalize().multiplyScalar(fish.species.speed * 0.8)
      } else {
        _dir.subVectors(intruder.position, fish.position).normalize().multiplyScalar(fish.species.speed * 1.3)
      }
      fish.targetVelocity.copy(_dir)
      return
    }
  }

  if (dist > orbitRadius * 1.5) {
    _dir.copy(_toHome).normalize().multiplyScalar(fish.species.speed * 0.8)
  } else if (dist < orbitRadius * 0.8) {
    _dir.copy(_toHome).normalize().multiplyScalar(-fish.species.speed * 0.5)
  } else {
    _dir.crossVectors(_toHome, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(fish.species.speed * 0.6)
  }
  fish.targetVelocity.copy(_dir)
}

/**
 * Predator patrol: smooth elliptical patrol path with gentle wander drift.
 * Instead of random direction flips, the predator continuously sweeps along
 * an elliptical route that slowly drifts, creating menacing cruising behavior.
 */
export function updatePredatorPatrol(fish: Fish, dt: number): void {
  const speed = fish.species.speed
  const hw = TANK.width / 2 - 2
  const hd = TANK.depth / 2 - 1

  // Slowly advance the patrol angle for smooth elliptical sweeping
  const patrolRate = 0.3 // radians/sec — slow, deliberate cruising
  fish.wanderAngle += patrolRate * dt

  // Add gentle jitter so the path isn't a perfect ellipse
  fish.wanderAngle += (Math.random() - 0.5) * 0.4 * dt

  // Target point on the patrol ellipse
  const tx = Math.cos(fish.wanderAngle) * hw * 0.7
  const tz = Math.sin(fish.wanderAngle) * hd * 0.7

  _dir.set(tx - fish.position.x, 0, tz - fish.position.z)

  // Gentle vertical undulation
  const vertY = Math.sin(fish.wanderAngle * 1.5) * speed * 0.1
  _dir.y = vertY - fish.position.y * 0.1 // subtle centering bias

  _dir.normalize().multiplyScalar(speed * 0.9)
  fish.targetVelocity.copy(_dir)
}

const _tangent = new THREE.Vector3()

export function updateReact(fish: Fish, mouseWorldPos: THREE.Vector3, _dt: number): void {
  _dir.subVectors(mouseWorldPos, fish.position)
  const dist = _dir.length()

  // Skittish fish flee from mouse (existing behavior, works fine)
  if (fish.species.personality === 'skittish') {
    if (dist < 0.01) {
      // Degenerate case: pick a random escape direction
      _dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
    }
    _dir.normalize().negate().multiplyScalar(fish.species.speed * 1.2)
    fish.targetVelocity.copy(_dir)
    return
  }

  // Curious / neutral fish: orbit the mouse at a comfortable distance
  const orbitRadius = 0.9
  const speed = fish.species.speed

  if (dist < 0.01) {
    // Fish is essentially ON the mouse — nudge outward randomly
    _dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    fish.targetVelocity.copy(_dir).multiplyScalar(speed * 0.5)
    return
  }

  _dir.normalize()

  if (dist > orbitRadius * 1.6) {
    // Far from mouse — approach, but not at full speed
    fish.targetVelocity.copy(_dir).multiplyScalar(speed * 0.6)
  } else if (dist < orbitRadius * 0.5) {
    // Too close — back away gently
    fish.targetVelocity.copy(_dir).multiplyScalar(-speed * 0.4)
  } else {
    // In the orbit zone — swim tangentially around the mouse
    _tangent.crossVectors(_dir, new THREE.Vector3(0, 1, 0))
    if (_tangent.lengthSq() < 0.001) {
      _tangent.crossVectors(_dir, new THREE.Vector3(1, 0, 0))
    }
    _tangent.normalize()

    // Blend in a small radial correction to maintain orbit distance
    const radialCorrection = (dist - orbitRadius) / orbitRadius // >0 means too far, <0 means too close
    fish.targetVelocity.copy(_tangent).multiplyScalar(speed * 0.5)
    fish.targetVelocity.addScaledVector(_dir, speed * 0.2 * radialCorrection)
  }
}

export function updateFeed(fish: Fish, flakePos: THREE.Vector3, _dt: number): void {
  _dir.subVectors(flakePos, fish.position).normalize().multiplyScalar(fish.species.speed * 1.2)
  fish.targetVelocity.copy(_dir)
}

/**
 * Bottom dweller: smooth wandering near the substrate using wander steering.
 * Horizontal movement uses the same Reynolds circle approach as updateWander
 * but constrained to the bottom layer, with nearly zero vertical movement.
 */
export function updateBottomDwell(fish: Fish, dt: number): void {
  const speed = fish.species.speed
  const floorY = SAND_SURFACE_Y
  const ceilingY = floorY + TANK.height * 0.2

  // Slower, more deliberate wander jitter for bottom dwellers
  const jitterRate = 1.2
  fish.wanderAngle += (Math.random() - 0.5) * 2 * jitterRate * dt

  const wanderDistance = 1.5
  const wanderRadius = 0.8

  // Heading from current horizontal velocity
  const vx = fish.velocity.x
  const vz = fish.velocity.z
  const headingLen = Math.sqrt(vx * vx + vz * vz)
  const headingAngle = headingLen > 0.001
    ? Math.atan2(vz, vx)
    : fish.wanderAngle

  const cx = Math.cos(headingAngle) * wanderDistance
  const cz = Math.sin(headingAngle) * wanderDistance
  const tx = cx + Math.cos(fish.wanderAngle) * wanderRadius
  const tz = cz + Math.sin(fish.wanderAngle) * wanderRadius

  _dir.set(tx, 0, tz).normalize().multiplyScalar(speed)
  fish.targetVelocity.copy(_dir)

  // Vertical constraint: stay near the bottom
  if (fish.position.y > ceilingY) {
    fish.targetVelocity.y = -speed * 0.5
  } else if (fish.position.y < floorY + fish.species.size) {
    fish.targetVelocity.y = speed * 0.2
  } else {
    // Very gentle vertical component — bottom dwellers hug the substrate
    fish.targetVelocity.y *= 0.9
  }
}

/**
 * Drift: very slow, languid wander steering for jellyfish / drifter types.
 * Uses the same Reynolds circle approach but with very low jitter and speed,
 * plus gentle vertical bobbing via sine oscillation.
 */
export function updateDrift(fish: Fish, dt: number): void {
  const speed = fish.species.speed

  // Very slow wander jitter — drifters barely change course
  const jitterRate = 0.6
  fish.wanderAngle += (Math.random() - 0.5) * 2 * jitterRate * dt

  const wanderDistance = 1.0
  const wanderRadius = 0.6

  const vx = fish.velocity.x
  const vz = fish.velocity.z
  const headingLen = Math.sqrt(vx * vx + vz * vz)
  const headingAngle = headingLen > 0.001
    ? Math.atan2(vz, vx)
    : fish.wanderAngle

  const cx = Math.cos(headingAngle) * wanderDistance
  const cz = Math.sin(headingAngle) * wanderDistance
  const tx = cx + Math.cos(fish.wanderAngle) * wanderRadius
  const tz = cz + Math.sin(fish.wanderAngle) * wanderRadius

  // Gentle vertical bobbing — drifters float up and down slowly
  const bobFreq = 0.5
  const bobAmp = speed * 0.25
  const ty = Math.sin(fish.wanderAngle * bobFreq) * bobAmp

  _dir.set(tx, ty, tz).normalize().multiplyScalar(speed)
  fish.targetVelocity.copy(_dir)

  // Hard constraint: drifters stay in the upper water column
  const minY = SAND_SURFACE_Y + TANK.height * 0.3
  if (fish.position.y < minY) {
    fish.targetVelocity.y = speed * 0.3
  }
}

export function updateSurfaceSwim(fish: Fish, school: Fish[], dt: number): void {
  if (school.length > 0) {
    const agents = school.map(f => ({ position: f.position, velocity: f.velocity }))
    const self = { position: fish.position, velocity: fish.velocity }
    const force = computeBoids(self, agents, { ...BOIDS_DEFAULTS, separationRadius: 2.0 })
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
