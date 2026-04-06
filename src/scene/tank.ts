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
  waterLines: THREE.Mesh[]
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

  // Water surface — animated rippling plane, visible from above
  const waterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth, 32, 32)
  const waterMat = new THREE.ShaderMaterial({
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
        // Layered ripple pattern — multiple wave frequencies
        float r1 = sin(vUv.x * 18.0 + uTime * 2.0) * cos(vUv.y * 12.0 + uTime * 1.3);
        float r2 = sin((vUv.x + vUv.y) * 10.0 - uTime * 1.7) * 0.5;
        float r3 = cos(vUv.x * 25.0 - uTime * 2.5) * sin(vUv.y * 20.0 + uTime * 1.8) * 0.3;
        float pattern = (r1 + r2 + r3) * 0.5 + 0.5;

        // Bright specular-like highlights where waves peak
        float specular = pow(pattern, 3.0);

        vec3 deepColor = vec3(0.08, 0.25, 0.45);
        vec3 surfaceColor = vec3(0.25, 0.55, 0.75);
        vec3 highlightColor = vec3(0.7, 0.9, 1.0);
        vec3 col = mix(deepColor, surfaceColor, pattern);
        col = mix(col, highlightColor, specular * 0.6);

        float alpha = 0.55 + pattern * 0.25;
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

  // Water line / meniscus — bright shimmering strip on the front glass at water level
  const waterLineGeo = new THREE.PlaneGeometry(TANK.width, 0.15)
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
        // Bright shimmering meniscus
        float wave = sin(vUv.x * 60.0 + uTime * 4.0) * 0.5 + 0.5;
        float wave2 = sin(vUv.x * 35.0 - uTime * 3.0) * 0.5 + 0.5;
        float shimmer = mix(wave, wave2, 0.5);

        // Sharp bright band that fades below
        float band = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
        float alpha = band * (0.6 + shimmer * 0.4);
        vec3 color = vec3(0.6, 0.85, 1.0) + shimmer * vec3(0.3, 0.15, 0.05);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  // Front meniscus
  const waterLine = new THREE.Mesh(waterLineGeo, waterLineMat)
  waterLine.position.set(0, TANK.height / 2, TANK.depth / 2 + 0.02)
  scene.add(waterLine)
  // Back meniscus
  const waterLineBack = new THREE.Mesh(waterLineGeo, waterLineMat.clone())
  waterLineBack.position.set(0, TANK.height / 2, -TANK.depth / 2 + 0.02)
  scene.add(waterLineBack)
  // Side meniscus lines
  const sideLineGeo = new THREE.PlaneGeometry(TANK.depth, 0.15)
  const waterLineLeft = new THREE.Mesh(sideLineGeo, waterLineMat.clone())
  waterLineLeft.position.set(-TANK.width / 2 + 0.02, TANK.height / 2, 0)
  waterLineLeft.rotation.y = Math.PI / 2
  scene.add(waterLineLeft)
  const waterLineRight = new THREE.Mesh(sideLineGeo, waterLineMat.clone())
  waterLineRight.position.set(TANK.width / 2 - 0.02, TANK.height / 2, 0)
  waterLineRight.rotation.y = -Math.PI / 2
  scene.add(waterLineRight)

  // --- Tank rim (top frame) ---
  const rimThickness = 0.12
  const rimHeight = 0.8 // air gap above water + rim
  const topY = TANK.height / 2
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.3,
    metalness: 0.1,
  })

  // Front rim
  const frontRimGeo = new THREE.BoxGeometry(TANK.width + rimThickness * 2, rimHeight, rimThickness)
  const frontRim = new THREE.Mesh(frontRimGeo, rimMat)
  frontRim.position.set(0, topY + rimHeight / 2, TANK.depth / 2)
  scene.add(frontRim)

  // Back rim
  const backRim = new THREE.Mesh(frontRimGeo, rimMat)
  backRim.position.set(0, topY + rimHeight / 2, -TANK.depth / 2)
  scene.add(backRim)

  // Left rim
  const sideRimGeo = new THREE.BoxGeometry(rimThickness, rimHeight, TANK.depth)
  const leftRim = new THREE.Mesh(sideRimGeo, rimMat)
  leftRim.position.set(-TANK.width / 2, topY + rimHeight / 2, 0)
  scene.add(leftRim)

  // Right rim
  const rightRim = new THREE.Mesh(sideRimGeo, rimMat)
  rightRim.position.set(TANK.width / 2, topY + rimHeight / 2, 0)
  scene.add(rightRim)

  // Dark interior walls above water line (the air gap inside the tank)
  const airGapMat = new THREE.MeshStandardMaterial({
    color: 0x050a14,
    roughness: 0.9,
  })

  // Back air gap wall
  const airGapBackGeo = new THREE.PlaneGeometry(TANK.width, rimHeight)
  const airGapBack = new THREE.Mesh(airGapBackGeo, airGapMat)
  airGapBack.position.set(0, topY + rimHeight / 2, -TANK.depth / 2 + 0.01)
  scene.add(airGapBack)

  // Left air gap wall
  const airGapSideGeo = new THREE.PlaneGeometry(TANK.depth, rimHeight)
  const airGapLeft = new THREE.Mesh(airGapSideGeo, airGapMat)
  airGapLeft.position.set(-TANK.width / 2 + 0.01, topY + rimHeight / 2, 0)
  airGapLeft.rotation.y = Math.PI / 2
  scene.add(airGapLeft)

  // Right air gap wall
  const airGapRight = new THREE.Mesh(airGapSideGeo, airGapMat)
  airGapRight.position.set(TANK.width / 2 - 0.01, topY + rimHeight / 2, 0)
  airGapRight.rotation.y = -Math.PI / 2
  scene.add(airGapRight)

  const waterLines = [waterLine, waterLineBack, waterLineLeft, waterLineRight]
  return { backWall, leftWall, rightWall, floor, waterSurface, waterLines }
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
  for (const wl of meshes.waterLines) {
    ;(wl.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  }
}
