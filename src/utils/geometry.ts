import * as THREE from 'three'

export function jitterVertices(geometry: THREE.BufferGeometry, amount: number): void {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 2 * amount)
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 2 * amount)
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 2 * amount)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

export function mergeIntoGroup(meshes: THREE.Mesh[]): THREE.Group {
  const group = new THREE.Group()
  for (const mesh of meshes) {
    group.add(mesh)
  }
  return group
}

export function lowPolyMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.8,
    metalness: 0.1,
  })
}
