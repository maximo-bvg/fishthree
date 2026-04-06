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

  // Top-view water surface — Gerstner wave displacement + analytic normals
  const topWaterGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth, 200, 100)
  const topWaterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal_w;
      varying vec3 vViewDir;

      // Gerstner wave: displaces position, accumulates normal
      // dir = wave direction, f = frequency, a = amplitude, s = speed, q = steepness
      vec3 gerstner(vec2 dir, float f, float a, float s, float q, vec2 p, float t, inout vec3 n) {
        float phase = dot(dir, p) * f + t * s;
        float sn = sin(phase);
        float cs = cos(phase);
        n.x -= dir.x * f * a * cs;
        n.y -= dir.y * f * a * cs;
        n.z -= q * f * a * sn;
        return vec3(q * a * dir.x * cs, q * a * dir.y * cs, a * sn);
      }

      void main() {
        vUv = uv;
        vec3 pos = position;
        vec3 n = vec3(0.0, 0.0, 1.0);
        vec2 p = pos.xy;
        float t = uTime;

        // 8 Gerstner waves at varied angles for organic interference
        pos += gerstner(normalize(vec2(1.0, 0.4)),   2.2, 0.05,  1.0, 0.45, p, t, n);
        pos += gerstner(normalize(vec2(-0.6, 1.0)),   3.0, 0.04,  0.8, 0.40, p, t, n);
        pos += gerstner(normalize(vec2(0.3, -0.9)),   4.2, 0.03,  1.3, 0.35, p, t, n);
        pos += gerstner(normalize(vec2(-1.0, -0.2)),  5.5, 0.022, 1.7, 0.30, p, t, n);
        pos += gerstner(normalize(vec2(0.7, 0.7)),    7.0, 0.015, 2.1, 0.25, p, t, n);
        pos += gerstner(normalize(vec2(-0.4, 0.8)),   9.5, 0.010, 2.6, 0.20, p, t, n);
        pos += gerstner(normalize(vec2(0.9, -0.5)),  12.0, 0.006, 3.2, 0.15, p, t, n);
        pos += gerstner(normalize(vec2(-0.2, -1.0)), 16.0, 0.004, 3.8, 0.10, p, t, n);

        vNormal_w = normalize(normalMatrix * normalize(n));
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal_w;
      varying vec3 vViewDir;

      void main() {
        vec3 n = normalize(vNormal_w);
        vec3 v = normalize(vViewDir);

        // Fresnel — Schlick approximation
        float cosTheta = max(dot(v, n), 0.0);
        float fresnel = pow(1.0 - cosTheta, 5.0) * 0.85 + 0.15;

        // Water colors
        vec3 deep    = vec3(0.02, 0.08, 0.16);
        vec3 surface = vec3(0.08, 0.28, 0.42);
        vec3 sky     = vec3(0.35, 0.60, 0.82);

        vec3 refractCol = mix(deep, surface, cosTheta);
        vec3 col = mix(refractCol, sky, fresnel);

        // Primary specular — sun-like
        vec3 l1 = normalize(vec3(0.4, 1.0, 0.3));
        float spec1 = pow(max(dot(n, normalize(l1 + v)), 0.0), 120.0);
        col += vec3(1.0, 0.97, 0.92) * spec1 * 0.7;

        // Secondary specular — fill sparkle
        vec3 l2 = normalize(vec3(-0.6, 0.8, -0.3));
        float spec2 = pow(max(dot(n, normalize(l2 + v)), 0.0), 200.0);
        col += vec3(0.85, 0.92, 1.0) * spec2 * 0.4;

        // Edge darkening near tank walls
        float edge = smoothstep(0.0, 0.12, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        col *= mix(0.6, 1.0, edge);

        float alpha = mix(0.45, 0.88, fresnel);
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
  topWater.visible = false
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
