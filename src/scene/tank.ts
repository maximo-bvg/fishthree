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
  waterLine: THREE.Mesh
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

  // Water surface — animated rippling plane
  const waterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth, 32, 32)
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x66bbee) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vY;
      void main() {
        vUv = uv;
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        // Ripple pattern visible on the surface
        float ripple1 = sin(vUv.x * 20.0 + uTime * 2.0) * 0.5 + 0.5;
        float ripple2 = sin(vUv.y * 15.0 - uTime * 1.5) * 0.5 + 0.5;
        float pattern = ripple1 * ripple2;
        float alpha = 0.12 + pattern * 0.1;
        vec3 col = uColor + vec3(pattern * 0.15);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const waterSurface = new THREE.Mesh(waterGeo, waterMat)
  waterSurface.rotation.x = -Math.PI / 2
  waterSurface.position.y = TANK.height / 2
  scene.add(waterSurface)

  // Water line — visible edge where water meets air at top of tank
  const waterLineGeo = new THREE.PlaneGeometry(TANK.width, 0.3)
  const waterLineMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        // Bright line at water surface with shimmer
        float shimmer = 0.7 + 0.3 * sin(vUv.x * 40.0 + uTime * 3.0);
        // Fade below the line
        float fade = 1.0 - vUv.y;
        float alpha = fade * shimmer * 0.35;
        vec3 color = mix(vec3(0.6, 0.85, 1.0), vec3(0.9, 0.95, 1.0), fade);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const waterLine = new THREE.Mesh(waterLineGeo, waterLineMat)
  waterLine.position.set(0, TANK.height / 2, TANK.depth / 2 + 0.01) // just in front of tank front edge
  scene.add(waterLine)

  return { backWall, leftWall, rightWall, floor, waterSurface, waterLine }
}

export function updateWaterSurface(meshes: TankMeshes, time: number): void {
  const water = meshes.waterSurface
  const pos = water.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, Math.sin(x * 0.5 + time * 1.5) * 0.05 + Math.cos(z * 0.7 + time * 1.2) * 0.03)
  }
  pos.needsUpdate = true

  // Update shader time uniforms
  ;(water.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  ;(meshes.waterLine.material as THREE.ShaderMaterial).uniforms.uTime.value = time
}
