import { describe, it, expect } from 'vitest'
import { jitterVertices, mergeIntoGroup } from './geometry'
import * as THREE from 'three'

describe('jitterVertices', () => {
  it('displaces vertices within the given amount', () => {
    const geo = new THREE.IcosahedronGeometry(1, 0)
    const originalPositions = Float32Array.from(geo.attributes.position.array)
    jitterVertices(geo, 0.1)
    const newPositions = geo.attributes.position.array

    let anyDifferent = false
    for (let i = 0; i < originalPositions.length; i++) {
      const diff = Math.abs(newPositions[i] - originalPositions[i])
      expect(diff).toBeLessThanOrEqual(0.1)
      if (diff > 0) anyDifferent = true
    }
    expect(anyDifferent).toBe(true)
  })
})

describe('mergeIntoGroup', () => {
  it('creates a group with the given meshes as children', () => {
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.5))
    const group = mergeIntoGroup([m1, m2])
    expect(group).toBeInstanceOf(THREE.Group)
    expect(group.children).toHaveLength(2)
  })
})
