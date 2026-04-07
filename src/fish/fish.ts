import * as THREE from 'three'
import { type SpeciesId, type SpeciesDefinition, type BehaviorType, SPECIES } from './species'
import { createFishMesh, animateFishMesh } from './mesh'
import { TANK, SAND_SURFACE_Y } from '../scene/tank'

export type FishState = 'idle' | 'wander' | 'school' | 'flee' | 'hide' | 'territorial' | 'react' | 'feed'

const FLEE_THRESHOLD = 3.0
const REACT_THRESHOLD = 2.0
const IDLE_DURATION = 1.0

interface ProximityInfo {
  distance: number
}

export interface StateContext {
  threats: ProximityInfo[]
  shelters: ProximityInfo[]
  school: ProximityInfo[]
  mouse: ProximityInfo | null
  homeDecor: ProximityInfo | null
  nearestFlake: { distance: number } | null
  timeOfDay?: string
}

export class FishStateMachine {
  current: FishState = 'idle'
  private idleTimer = 0
  private behaviorType: BehaviorType

  constructor(behaviorType: BehaviorType) {
    this.behaviorType = behaviorType
  }

  update(dt: number, ctx: StateContext): void {
    const hasNearThreat = ctx.threats.some(t => t.distance < FLEE_THRESHOLD)
    const hasNearShelter = ctx.shelters.some(s => s.distance < FLEE_THRESHOLD)
    const hasMouseNear = ctx.mouse !== null && ctx.mouse.distance < REACT_THRESHOLD
    const hasSchoolmates = ctx.school.length >= 1

    // Flee / hide takes priority
    if (hasNearThreat) {
      if (this.behaviorType === 'shy' && hasNearShelter) {
        this.current = 'hide'
        return
      }
      if (this.behaviorType !== 'predator') {
        this.current = 'flee'
        return
      }
    }

    // Mouse reaction
    if (hasMouseNear && this.current !== 'flee' && this.current !== 'hide') {
      this.current = 'react'
      return
    }

    // Feed — if food is nearby and not fleeing/hiding
    const hasNearFlake = ctx.nearestFlake !== null && ctx.nearestFlake.distance < 4.0
    if (hasNearFlake && this.current !== 'flee' && this.current !== 'hide'
        && this.behaviorType !== 'predator') {
      this.current = 'feed'
      return
    }

    // Behavior-specific states
    switch (this.behaviorType) {
      case 'schooling':
        if (hasSchoolmates) {
          this.current = 'school'
          return
        }
        break
      case 'territorial':
        if (ctx.homeDecor !== null) {
          this.current = 'territorial'
          return
        }
        break
      case 'anchorer':
        if (ctx.homeDecor !== null) {
          this.current = 'territorial'
          return
        }
        break
      case 'bottom-dweller':
        this.current = 'wander' // uses custom wander function in main
        return
      case 'drifter':
        this.current = 'wander' // uses custom drift function in main
        return
      case 'surface-swimmer':
        if (hasSchoolmates) {
          this.current = 'school' // uses custom surface school in main
          return
        }
        break
    }

    // Default: idle -> wander cycle
    if (this.current === 'idle') {
      this.idleTimer += dt
      if (this.idleTimer > IDLE_DURATION) {
        this.idleTimer = 0
        this.current = 'wander'
      }
    } else if (this.current !== 'wander') {
      this.current = 'wander'
    }
  }
}

export class Fish {
  mesh: THREE.Group
  species: SpeciesDefinition
  speciesId: SpeciesId
  name: string
  stateMachine: FishStateMachine
  velocity: THREE.Vector3
  targetVelocity: THREE.Vector3
  targetFlakeId: number | null = null
  speedMultiplier = 1.0

  private time = Math.random() * 100
  private bubbleTimer = Math.random() * 5
  private bubbleInterval = 3 + Math.random() * 5

  constructor(speciesId: SpeciesId, name: string) {
    this.speciesId = speciesId
    this.species = SPECIES[speciesId]
    this.name = name
    this.mesh = createFishMesh(this.species, speciesId)
    this.stateMachine = new FishStateMachine(this.species.behaviorType)
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * this.species.speed,
      (Math.random() - 0.5) * this.species.speed * 0.3,
      (Math.random() - 0.5) * this.species.speed * 0.3,
    )
    this.targetVelocity = this.velocity.clone()

    const margin = this.species.size * 2 + TANK.frameBar
    this.mesh.position.set(
      THREE.MathUtils.randFloat(-TANK.width / 2 + margin, TANK.width / 2 - margin),
      THREE.MathUtils.randFloat(SAND_SURFACE_Y + margin, TANK.height / 2 - margin),
      THREE.MathUtils.randFloat(-TANK.depth / 2 + margin, TANK.depth / 2 - margin),
    )
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  setName(name: string): void {
    this.name = name
  }

  update(dt: number): void {
    this.time += dt
    this.applyWallAvoidance()
    this.velocity.lerp(this.targetVelocity, 0.05)
    this.mesh.position.addScaledVector(this.velocity, dt * this.speedMultiplier)
    this.clampToTank()

    // Orient fish to face movement direction using yaw/pitch (no lookAt — avoids up-vector flips)
    if (this.velocity.lengthSq() > 0.001) {
      const dir = this.velocity
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z)
      this.mesh.rotation.x = Math.asin(-dir.y / dir.length())
      // Don't touch rotation.z — leave it at 0 (sway is on the inner model)
    }

    const speedFactor = this.velocity.length() / this.species.speed
    animateFishMesh(this.mesh, this.time, speedFactor, this.species.tailFrequency)
  }

  private applyWallAvoidance(): void {
    const pos = this.mesh.position
    const m = this.species.size + TANK.frameBar
    const hw = TANK.width / 2 - m
    const hh = TANK.height / 2 - m
    const hd = TANK.depth / 2 - m
    const margin = 2.0
    const strength = this.species.speed * 1.5

    if (pos.x > hw - margin) {
      const t = (pos.x - (hw - margin)) / margin
      this.targetVelocity.x -= strength * t * t
    } else if (pos.x < -hw + margin) {
      const t = ((-hw + margin) - pos.x) / margin
      this.targetVelocity.x += strength * t * t
    }

    if (pos.y > hh - margin) {
      const t = (pos.y - (hh - margin)) / margin
      this.targetVelocity.y -= strength * t * t
    }
    const sandFloor = SAND_SURFACE_Y + m
    if (pos.y < sandFloor + margin) {
      const t = ((sandFloor + margin) - pos.y) / margin
      this.targetVelocity.y += strength * t * t
    }

    if (pos.z > hd - margin) {
      const t = (pos.z - (hd - margin)) / margin
      this.targetVelocity.z -= strength * t * t
    } else if (pos.z < -hd + margin) {
      const t = ((-hd + margin) - pos.z) / margin
      this.targetVelocity.z += strength * t * t
    }
  }

  private clampToTank(): void {
    const m = this.species.size + TANK.frameBar
    const pos = this.mesh.position
    const hw = TANK.width / 2 - m
    const hh = TANK.height / 2 - m
    const hd = TANK.depth / 2 - m

    if (pos.x < -hw) { pos.x = -hw; this.velocity.x *= -1; this.targetVelocity.x *= -1 }
    if (pos.x > hw) { pos.x = hw; this.velocity.x *= -1; this.targetVelocity.x *= -1 }
    const sandFloorClamp = SAND_SURFACE_Y + m
    if (pos.y < sandFloorClamp) { pos.y = sandFloorClamp; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
    if (pos.y > hh) { pos.y = hh; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
    if (pos.z < -hd) { pos.z = -hd; this.velocity.z *= -1; this.targetVelocity.z *= -1 }
    if (pos.z > hd) { pos.z = hd; this.velocity.z *= -1; this.targetVelocity.z *= -1 }
  }

  /** Returns true when this fish should emit mouth bubbles. */
  shouldEmitBubble(dt: number): boolean {
    this.bubbleTimer += dt
    if (this.bubbleTimer >= this.bubbleInterval) {
      this.bubbleTimer = 0
      this.bubbleInterval = 3 + Math.random() * 5
      return true
    }
    return false
  }

  /** World position of the fish's mouth (front of body along facing direction). */
  getMouthPosition(): THREE.Vector3 {
    const dir = this.velocity.lengthSq() > 0.001
      ? _dir.copy(this.velocity).normalize()
      : _dir.set(0, 0, 1).applyEuler(this.mesh.rotation)
    return _mouth.copy(this.mesh.position).addScaledVector(dir, this.species.bodyLength * 0.6)
  }
}

const _dir = new THREE.Vector3()
const _mouth = new THREE.Vector3()
