import * as THREE from 'three'

export interface BoidAgent {
  position: THREE.Vector3
  velocity: THREE.Vector3
}

export interface BoidsParams {
  separationRadius: number
  separationWeight: number
  alignmentWeight: number
  cohesionWeight: number
  neighborRadius: number
}

export const BOIDS_DEFAULTS: BoidsParams = {
  separationRadius: 0.8,
  separationWeight: 2.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  neighborRadius: 3.0,
}

const _separation = new THREE.Vector3()
const _alignment = new THREE.Vector3()
const _cohesion = new THREE.Vector3()
const _diff = new THREE.Vector3()

export function computeBoids(self: BoidAgent, neighbors: BoidAgent[], params: BoidsParams): THREE.Vector3 {
  const result = new THREE.Vector3()
  if (neighbors.length === 0) return result

  _separation.set(0, 0, 0)
  _alignment.set(0, 0, 0)
  _cohesion.set(0, 0, 0)

  let separationCount = 0
  let neighborCount = 0

  for (const other of neighbors) {
    const dist = self.position.distanceTo(other.position)
    if (dist > params.neighborRadius || dist < 0.001) continue

    neighborCount++
    _cohesion.add(other.position)
    _alignment.add(other.velocity)

    if (dist < params.separationRadius) {
      _diff.subVectors(self.position, other.position)
      _diff.divideScalar(dist * dist)
      _separation.add(_diff)
      separationCount++
    }
  }

  if (neighborCount === 0) return result

  _cohesion.divideScalar(neighborCount)
  _cohesion.sub(self.position)
  _cohesion.multiplyScalar(params.cohesionWeight)
  result.add(_cohesion)

  _alignment.divideScalar(neighborCount)
  _alignment.sub(self.velocity)
  _alignment.multiplyScalar(params.alignmentWeight)
  result.add(_alignment)

  if (separationCount > 0) {
    _separation.divideScalar(separationCount)
    _separation.multiplyScalar(params.separationWeight)
    result.add(_separation)
  }

  return result
}
