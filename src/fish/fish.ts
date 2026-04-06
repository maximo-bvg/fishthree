import * as THREE from 'three'
import { type SpeciesId, type SpeciesDefinition, type BehaviorType, SPECIES } from './species'
import { createFishMesh, animateFishMesh } from './mesh'
import { TANK } from '../scene/tank'

export type FishState = 'idle' | 'wander' | 'school' | 'flee' | 'hide' | 'territorial' | 'react'

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

  private time = Math.random() * 100

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

    const margin = this.species.size * 2
    this.mesh.position.set(
      THREE.MathUtils.randFloat(-TANK.width / 2 + margin, TANK.width / 2 - margin),
      THREE.MathUtils.randFloat(-TANK.height / 2 + margin, TANK.height / 2 - margin),
      THREE.MathUtils.randFloat(-TANK.depth / 2 + margin, TANK.depth / 2 - margin),
    )
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  update(dt: number): void {
    this.time += dt
    this.velocity.lerp(this.targetVelocity, 0.05)
    this.mesh.position.addScaledVector(this.velocity, dt)
    this.clampToTank()

    if (this.velocity.lengthSq() > 0.001) {
      const lookTarget = this.mesh.position.clone().add(this.velocity)
      this.mesh.lookAt(lookTarget)
    }

    const speedFactor = this.velocity.length() / this.species.speed
    animateFishMesh(this.mesh, this.time, speedFactor, this.species.tailFrequency)
  }

  private clampToTank(): void {
    const m = this.species.size
    const pos = this.mesh.position
    const hw = TANK.width / 2 - m
    const hh = TANK.height / 2 - m
    const hd = TANK.depth / 2 - m

    if (pos.x < -hw) { pos.x = -hw; this.velocity.x *= -1; this.targetVelocity.x *= -1 }
    if (pos.x > hw) { pos.x = hw; this.velocity.x *= -1; this.targetVelocity.x *= -1 }
    if (pos.y < -hh) { pos.y = -hh; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
    if (pos.y > hh) { pos.y = hh; this.velocity.y *= -1; this.targetVelocity.y *= -1 }
    if (pos.z < -hd) { pos.z = -hd; this.velocity.z *= -1; this.targetVelocity.z *= -1 }
    if (pos.z > hd) { pos.z = hd; this.velocity.z *= -1; this.targetVelocity.z *= -1 }
  }
}
