import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water2.js'

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
  waterSurface: Water
  topWater: THREE.Mesh
  frontGlass: THREE.Mesh
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
    const r = THREE.MathUtils.lerp(0.06, 0.15, t)
    const g = THREE.MathUtils.lerp(0.30, 0.55, t)
    const b = THREE.MathUtils.lerp(0.55, 0.85, t)
    backColors.push(r, g, b)
  }
  backGeo.setAttribute('color', new THREE.Float32BufferAttribute(backColors, 3))
  const backMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide })
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

  // Front glass — subtle animated water refraction overlay
  const frontGlassGeo = new THREE.PlaneGeometry(TANK.width, TANK.height)
  const frontGlassMat = new THREE.ShaderMaterial({
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
        // Animated refraction-like ripple on the glass
        float wave1 = sin(vUv.x * 8.0 + uTime * 0.8) * cos(vUv.y * 6.0 + uTime * 0.6);
        float wave2 = sin((vUv.x + vUv.y) * 5.0 - uTime * 0.5) * 0.7;
        float wave3 = cos(vUv.x * 12.0 - uTime * 1.1) * sin(vUv.y * 10.0 + uTime * 0.7) * 0.5;
        float pattern = (wave1 + wave2 + wave3) * 0.33 + 0.5;

        // Bright caustic-like highlights
        float highlights = pow(max(0.0, pattern), 3.0);

        // Very subtle — just enough to see the glass distortion
        vec3 col = vec3(0.5, 0.8, 1.0);
        float alpha = highlights * 0.07 + pattern * 0.02;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const frontGlass = new THREE.Mesh(frontGlassGeo, frontGlassMat)
  frontGlass.position.set(0, 0, TANK.depth / 2)
  scene.add(frontGlass)

  // Floor — sandy color
  const floorGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x9a7a45, roughness: 0.95, side: THREE.DoubleSide })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -TANK.height / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Water surface — Three.js Water2 with flow-based dual normals, reflections + refractions
  const waterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const waterSurface = new Water(waterGeo, {
    color: 0x99e0ff,
    scale: 7,
    flowDirection: new THREE.Vector2(1, 1),
    flowSpeed: 0.03,
    reflectivity: 0.5,
    textureWidth: 1024,
    textureHeight: 1024,
  })
  waterSurface.rotation.x = -Math.PI / 2
  waterSurface.position.y = TANK.height / 2
  waterSurface.material.side = THREE.DoubleSide
  scene.add(waterSurface)

  // Top-view water surface — custom ripple shader visible when camera is above
  const topWaterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const topWaterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vViewDir;

      vec3 getRippleNormal(vec2 uv, float t) {
        float eps = 0.008;
        // Multi-octave height field
        float h = 0.0;
        h += sin(uv.x * 6.5 + t * 0.9) * cos(uv.y * 5.8 + t * 0.7) * 0.35;
        h += sin((uv.x + uv.y) * 11.0 + t * 1.3) * 0.22;
        h += cos(uv.x * 17.0 - uv.y * 14.0 - t * 1.7) * 0.13;
        h += sin(uv.x * 23.0 + uv.y * 19.0 + t * 2.1) * 0.08;
        h += cos((uv.x - uv.y) * 31.0 + t * 0.6) * 0.05;

        float hx = 0.0;
        hx += sin((uv.x + eps) * 6.5 + t * 0.9) * cos(uv.y * 5.8 + t * 0.7) * 0.35;
        hx += sin(((uv.x + eps) + uv.y) * 11.0 + t * 1.3) * 0.22;
        hx += cos((uv.x + eps) * 17.0 - uv.y * 14.0 - t * 1.7) * 0.13;
        hx += sin((uv.x + eps) * 23.0 + uv.y * 19.0 + t * 2.1) * 0.08;
        hx += cos(((uv.x + eps) - uv.y) * 31.0 + t * 0.6) * 0.05;

        float hy = 0.0;
        hy += sin(uv.x * 6.5 + t * 0.9) * cos((uv.y + eps) * 5.8 + t * 0.7) * 0.35;
        hy += sin((uv.x + (uv.y + eps)) * 11.0 + t * 1.3) * 0.22;
        hy += cos(uv.x * 17.0 - (uv.y + eps) * 14.0 - t * 1.7) * 0.13;
        hy += sin(uv.x * 23.0 + (uv.y + eps) * 19.0 + t * 2.1) * 0.08;
        hy += cos((uv.x - (uv.y + eps)) * 31.0 + t * 0.6) * 0.05;

        return normalize(vec3(h - hx, eps, h - hy));
      }

      void main() {
        vec3 n = getRippleNormal(vUv * 7.0, uTime);

        // Fresnel — more reflective at grazing angles
        float cosTheta = max(dot(vViewDir, vec3(0.0, 1.0, 0.0)), 0.0);
        float fresnel = pow(1.0 - cosTheta, 4.0) * 0.85 + 0.15;

        // Water colors
        vec3 deep = vec3(0.04, 0.12, 0.22);
        vec3 mid = vec3(0.15, 0.38, 0.52);
        vec3 highlight = vec3(0.55, 0.82, 0.95);

        // Directional ripple lighting
        vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
        float diff = dot(n, lightDir) * 0.5 + 0.5;

        vec3 col = mix(deep, mid, diff);
        col = mix(col, highlight, pow(diff, 5.0) * 0.6);

        // Specular highlights from ripples
        vec3 halfDir = normalize(lightDir + vViewDir);
        float spec = pow(max(dot(n, halfDir), 0.0), 80.0);
        col += vec3(0.9, 0.95, 1.0) * spec * 0.5;

        // Secondary specular for sparkle
        vec3 lightDir2 = normalize(vec3(-0.5, 0.8, -0.3));
        vec3 halfDir2 = normalize(lightDir2 + vViewDir);
        float spec2 = pow(max(dot(n, halfDir2), 0.0), 120.0);
        col += vec3(0.8, 0.9, 1.0) * spec2 * 0.3;

        float alpha = mix(0.55, 0.92, fresnel);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  const topWater = new THREE.Mesh(topWaterGeo, topWaterMat)
  topWater.rotation.x = -Math.PI / 2
  topWater.position.y = TANK.height / 2 + 0.01
  topWater.visible = false // toggled in render loop
  scene.add(topWater)

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
  return { backWall, leftWall, rightWall, floor, waterSurface, topWater, frontGlass, waterLines }
}

export function updateWaterSurface(meshes: TankMeshes, dt: number, time: number): void {
  ;(meshes.frontGlass.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  ;(meshes.topWater.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  for (const wl of meshes.waterLines) {
    ;(wl.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  }
}
