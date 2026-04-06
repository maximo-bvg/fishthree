import { describe, it, expect } from 'vitest'
import { computeBoids, type BoidAgent, BOIDS_DEFAULTS } from './boids'
import * as THREE from 'three'

function makeBoid(x: number, y: number, z: number, vx = 0, vy = 0, vz = 0): BoidAgent {
  return {
    position: new THREE.Vector3(x, y, z),
    velocity: new THREE.Vector3(vx, vy, vz),
  }
}

describe('computeBoids', () => {
  it('returns zero vector for a lone boid', () => {
    const self = makeBoid(0, 0, 0, 1, 0, 0)
    const result = computeBoids(self, [], BOIDS_DEFAULTS)
    expect(result.length()).toBe(0)
  })

  it('separation pushes boids apart when too close', () => {
    const self = makeBoid(0, 0, 0, 1, 0, 0)
    const neighbor = makeBoid(0.3, 0, 0, 1, 0, 0)
    const result = computeBoids(self, [neighbor], BOIDS_DEFAULTS)
    expect(result.x).toBeLessThan(0)
  })

  it('cohesion pulls boid toward center of flock', () => {
    const self = makeBoid(0, 0, 0, 0, 0, 0)
    const neighbors = [
      makeBoid(3, 0, 0, 0, 0, 0),
      makeBoid(3, 1, 0, 0, 0, 0),
    ]
    const result = computeBoids(self, neighbors, { ...BOIDS_DEFAULTS, separationRadius: 0.1 })
    expect(result.x).toBeGreaterThan(0)
  })

  it('alignment steers toward average velocity', () => {
    const self = makeBoid(0, 0, 0, 0, 0, 0)
    const neighbors = [
      makeBoid(1, 0, 0, 0, 2, 0),
      makeBoid(-1, 0, 0, 0, 2, 0),
    ]
    const result = computeBoids(self, neighbors, BOIDS_DEFAULTS)
    expect(result.y).toBeGreaterThan(0)
  })
})
