import * as THREE from 'three'

export const TANK = {
  width: 16,
  height: 9,
  depth: 8,
} as const

export interface TankMeshes {
  backWall: THREE.Mesh
  leftWall: THREE.Mesh
  rightWall: THREE.Mesh
  floor: THREE.Mesh
  waterSurface: THREE.Mesh
}

export function createTank(scene: THREE.Scene): TankMeshes {
  // Back wall — deep blue gradient via vertex colors
  const backGeo = new THREE.PlaneGeometry(TANK.width, TANK.height, 1, 10)
  const backColors: number[] = []
  const backPos = backGeo.attributes.position
  for (let i = 0; i < backPos.count; i++) {
    const y = backPos.getY(i)
    const t = (y + TANK.height / 2) / TANK.height
    const r = THREE.MathUtils.lerp(0.02, 0.06, t)
    const g = THREE.MathUtils.lerp(0.15, 0.30, t)
    const b = THREE.MathUtils.lerp(0.35, 0.55, t)
    backColors.push(r, g, b)
  }
  backGeo.setAttribute('color', new THREE.Float32BufferAttribute(backColors, 3))
  const backMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide })
  const backWall = new THREE.Mesh(backGeo, backMat)
  backWall.position.set(0, 0, -TANK.depth / 2)
  backWall.receiveShadow = true
  scene.add(backWall)

  // Side walls — semi-transparent glass
  const sideGeo = new THREE.PlaneGeometry(TANK.depth, TANK.height)
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  })

  const leftWall = new THREE.Mesh(sideGeo, sideMat)
  leftWall.position.set(-TANK.width / 2, 0, 0)
  leftWall.rotation.y = Math.PI / 2
  scene.add(leftWall)

  const rightWall = new THREE.Mesh(sideGeo, sideMat.clone())
  rightWall.position.set(TANK.width / 2, 0, 0)
  rightWall.rotation.y = -Math.PI / 2
  scene.add(rightWall)

  // Floor — sandy color
  const floorGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -TANK.height / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Water surface
  const waterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth, 32, 32)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  })
  const waterSurface = new THREE.Mesh(waterGeo, waterMat)
  waterSurface.rotation.x = -Math.PI / 2
  waterSurface.position.y = TANK.height / 2
  scene.add(waterSurface)

  return { backWall, leftWall, rightWall, floor, waterSurface }
}

export function updateWaterSurface(water: THREE.Mesh, time: number): void {
  const pos = water.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, Math.sin(x * 0.5 + time * 1.5) * 0.05 + Math.cos(z * 0.7 + time * 1.2) * 0.03)
  }
  pos.needsUpdate = true
}
