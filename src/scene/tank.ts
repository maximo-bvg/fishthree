import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water2.js'

export const TANK = {
  width: 16,
  height: 9,
  depth: 8,
  frameBar: 0.4,
  sand: {
    depth: 1.0,
    segmentsX: 64,
    segmentsZ: 32,
    undulation: 0.15,
    grain: 0.03,
    moundRadius: 1.5,
    moundHeight: 0.25,
  },
} as const

/** Y position of the sand surface — single source of truth for all systems. */
export const SAND_SURFACE_Y = -TANK.height / 2 + TANK.sand.depth

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
    const r = THREE.MathUtils.lerp(0.12, 0.18, t)
    const g = THREE.MathUtils.lerp(0.38, 0.58, t)
    const b = THREE.MathUtils.lerp(0.62, 0.88, t)
    backColors.push(r, g, b)
  }
  backGeo.setAttribute('color', new THREE.Float32BufferAttribute(backColors, 3))
  const backMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x0a2040, emissiveIntensity: 1.0, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
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

  // Front glass — animated water ripple overlay matching top-water look
  const frontGlassGeo = new THREE.PlaneGeometry(TANK.width, TANK.height)
  const frontGlassMat = new THREE.ShaderMaterial({
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

      vec3 rippleNormal(vec2 uv, float t) {
        float eps = 0.008;
        // 5-octave height field — same density as top water
        float h = 0.0;
        h += sin(uv.x * 5.0 + t * 0.9) * cos(uv.y * 4.5 + t * 0.7) * 0.35;
        h += sin((uv.x + uv.y) * 9.0 + t * 1.2) * 0.22;
        h += cos(uv.x * 14.0 - uv.y * 11.0 - t * 1.5) * 0.14;
        h += sin(uv.x * 20.0 + uv.y * 17.0 + t * 1.9) * 0.09;
        h += cos((uv.x - uv.y) * 27.0 + t * 0.5) * 0.05;

        float hx = 0.0;
        hx += sin((uv.x+eps) * 5.0 + t * 0.9) * cos(uv.y * 4.5 + t * 0.7) * 0.35;
        hx += sin(((uv.x+eps) + uv.y) * 9.0 + t * 1.2) * 0.22;
        hx += cos((uv.x+eps) * 14.0 - uv.y * 11.0 - t * 1.5) * 0.14;
        hx += sin((uv.x+eps) * 20.0 + uv.y * 17.0 + t * 1.9) * 0.09;
        hx += cos(((uv.x+eps) - uv.y) * 27.0 + t * 0.5) * 0.05;

        float hy = 0.0;
        hy += sin(uv.x * 5.0 + t * 0.9) * cos((uv.y+eps) * 4.5 + t * 0.7) * 0.35;
        hy += sin((uv.x + (uv.y+eps)) * 9.0 + t * 1.2) * 0.22;
        hy += cos(uv.x * 14.0 - (uv.y+eps) * 11.0 - t * 1.5) * 0.14;
        hy += sin(uv.x * 20.0 + (uv.y+eps) * 17.0 + t * 1.9) * 0.09;
        hy += cos((uv.x - (uv.y+eps)) * 27.0 + t * 0.5) * 0.05;

        return normalize(vec3(h - hx, h - hy, eps));
      }

      void main() {
        vec2 scaled = vUv * vec2(7.0, 4.0);
        vec3 n = rippleNormal(scaled, uTime);
        vec3 v = normalize(vViewDir);

        // Fresnel — edges of glass more opaque/reflective
        float cosTheta = max(dot(v, vec3(0.0, 0.0, 1.0)), 0.0);
        float fresnel = pow(1.0 - cosTheta, 4.0) * 0.7 + 0.08;

        // Water colors matching top-water palette
        vec3 deep    = vec3(0.03, 0.10, 0.20);
        vec3 surface = vec3(0.10, 0.32, 0.48);
        vec3 sky     = vec3(0.35, 0.60, 0.82);

        // Ripple-based lighting
        vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));
        float diff = dot(n, lightDir) * 0.5 + 0.5;
        vec3 col = mix(deep, surface, diff);
        col = mix(col, sky, pow(diff, 4.0) * 0.5);

        // Specular highlights — visible ripple sparkle
        vec3 halfDir = normalize(lightDir + v);
        float spec = pow(max(dot(n, halfDir), 0.0), 100.0);
        col += vec3(0.9, 0.95, 1.0) * spec * 0.5;

        // Depth gradient — darker toward bottom
        float depthGrad = smoothstep(0.0, 0.6, vUv.y);
        col = mix(deep * 0.5, col, depthGrad);

        float alpha = fresnel * mix(0.3, 0.15, depthGrad);
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

  // Floor — procedural sand texture with variation
  const sandSize = 512
  const sandCanvas = document.createElement('canvas')
  sandCanvas.width = sandSize
  sandCanvas.height = sandSize
  const sandCtx = sandCanvas.getContext('2d')!
  const sandData = sandCtx.createImageData(sandSize, sandSize)
  const sd = sandData.data

  // Simple 2D hash for repeatable noise
  const hash2d = (x: number, y: number) => {
    let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return h - Math.floor(h)
  }
  // Value noise with smooth interpolation
  const vnoise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = x - ix, fy = y - iy
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = hash2d(ix, iy), b = hash2d(ix + 1, iy)
    const c = hash2d(ix, iy + 1), d = hash2d(ix + 1, iy + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
  // FBM — layered noise for organic variation
  const fbm = (x: number, y: number) => {
    let v = 0, amp = 0.5, freq = 1
    for (let o = 0; o < 5; o++) {
      v += vnoise(x * freq, y * freq) * amp
      amp *= 0.5; freq *= 2.1
    }
    return v
  }

  for (let py = 0; py < sandSize; py++) {
    for (let px = 0; px < sandSize; px++) {
      const i = (py * sandSize + px) * 4
      const u = px / sandSize, v = py / sandSize

      // Large-scale dunes / patches
      const dune = fbm(u * 8, v * 8) * 0.6
      // Medium ripples
      const ripple = fbm(u * 20 + 3.7, v * 20 + 1.2) * 0.25
      // Fine grain
      const grain = (Math.random() - 0.5) * 0.12

      const val = 0.45 + dune + ripple + grain

      // Warm sand palette — deeper contrast between troughs and crests
      const r = Math.min(255, Math.max(0, val * 220))
      const g = Math.min(255, Math.max(0, val * 190))
      const b = Math.min(255, Math.max(0, val * 125))

      // Occasional dark pebble
      if (Math.random() < 0.003) {
        const dark = 0.3 + Math.random() * 0.2
        sd[i] = dark * 140
        sd[i + 1] = dark * 120
        sd[i + 2] = dark * 90
      } else {
        sd[i] = r
        sd[i + 1] = g
        sd[i + 2] = b
      }
      sd[i + 3] = 255
    }
  }
  sandCtx.putImageData(sandData, 0, 0)
  const sandTex = new THREE.CanvasTexture(sandCanvas)
  sandTex.wrapS = THREE.RepeatWrapping
  sandTex.wrapT = THREE.RepeatWrapping
  sandTex.repeat.set(3, 1.5)

  const floorGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    color: 0xc8a870,
    emissive: 0x8a6530,
    emissiveIntensity: 0.6,
    roughness: 0.92,
    side: THREE.DoubleSide,
  })
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

  // --- Tank frame (full cage + base) ---
  const bar = 0.4 // frame bar cross-section
  const hw = TANK.width / 2
  const hh = TANK.height / 2
  const hd = TANK.depth / 2
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    roughness: 0.35,
    metalness: 0.15,
  })

  // Top horizontal bars (4)
  const topBarFBGeo = new THREE.BoxGeometry(TANK.width + bar * 2, bar, bar)
  const topBarLRGeo = new THREE.BoxGeometry(bar, bar, TANK.depth)

  const topFront = new THREE.Mesh(topBarFBGeo, frameMat)
  topFront.position.set(0, hh + bar / 2, hd + bar / 2)
  scene.add(topFront)

  const topBack = new THREE.Mesh(topBarFBGeo, frameMat)
  topBack.position.set(0, hh + bar / 2, -hd - bar / 2)
  scene.add(topBack)

  const topLeft = new THREE.Mesh(topBarLRGeo, frameMat)
  topLeft.position.set(-hw - bar / 2, hh + bar / 2, 0)
  scene.add(topLeft)

  const topRight = new THREE.Mesh(topBarLRGeo, frameMat)
  topRight.position.set(hw + bar / 2, hh + bar / 2, 0)
  scene.add(topRight)

  // Bottom horizontal bars (4)
  const botFront = new THREE.Mesh(topBarFBGeo, frameMat)
  botFront.position.set(0, -hh - bar / 2, hd + bar / 2)
  scene.add(botFront)

  const botBack = new THREE.Mesh(topBarFBGeo, frameMat)
  botBack.position.set(0, -hh - bar / 2, -hd - bar / 2)
  scene.add(botBack)

  const botLeft = new THREE.Mesh(topBarLRGeo, frameMat)
  botLeft.position.set(-hw - bar / 2, -hh - bar / 2, 0)
  scene.add(botLeft)

  const botRight = new THREE.Mesh(topBarLRGeo, frameMat)
  botRight.position.set(hw + bar / 2, -hh - bar / 2, 0)
  scene.add(botRight)

  // Vertical corner posts (4)
  const postGeo = new THREE.BoxGeometry(bar, TANK.height, bar)

  const postFL = new THREE.Mesh(postGeo, frameMat)
  postFL.position.set(-hw - bar / 2, 0, hd + bar / 2)
  scene.add(postFL)

  const postFR = new THREE.Mesh(postGeo, frameMat)
  postFR.position.set(hw + bar / 2, 0, hd + bar / 2)
  scene.add(postFR)

  const postBL = new THREE.Mesh(postGeo, frameMat)
  postBL.position.set(-hw - bar / 2, 0, -hd - bar / 2)
  scene.add(postBL)

  const postBR = new THREE.Mesh(postGeo, frameMat)
  postBR.position.set(hw + bar / 2, 0, -hd - bar / 2)
  scene.add(postBR)

  // Base/stand under the tank
  const baseGeo = new THREE.BoxGeometry(TANK.width + bar * 2, 0.6, TANK.depth + bar * 2)
  const base = new THREE.Mesh(baseGeo, frameMat)
  base.position.set(0, -hh - bar - 0.3, 0)
  scene.add(base)

  // All frame parts on layer 1 — rendered after post-processing
  // so the underwater wave distortion doesn't affect the rigid frame.
  const layer1Parts = [
    topFront, topBack, topLeft, topRight,
    botFront, botBack, botLeft, botRight,
    postFL, postFR, postBL, postBR,
    base,
  ]
  for (const part of layer1Parts) part.layers.set(1)

  // Dark interior walls above water line (air gap between water surface and top frame)
  const airGapHeight = bar
  const airGapMat = new THREE.MeshStandardMaterial({
    color: 0x050a14,
    roughness: 0.9,
  })

  const airGapBackGeo = new THREE.PlaneGeometry(TANK.width, airGapHeight)
  const airGapBack = new THREE.Mesh(airGapBackGeo, airGapMat)
  airGapBack.position.set(0, hh + airGapHeight / 2, -hd + 0.01)
  scene.add(airGapBack)

  const airGapSideGeo = new THREE.PlaneGeometry(TANK.depth, airGapHeight)
  const airGapLeft = new THREE.Mesh(airGapSideGeo, airGapMat)
  airGapLeft.position.set(-hw + 0.01, hh + airGapHeight / 2, 0)
  airGapLeft.rotation.y = Math.PI / 2
  scene.add(airGapLeft)

  const airGapRight = new THREE.Mesh(airGapSideGeo, airGapMat)
  airGapRight.position.set(hw - 0.01, hh + airGapHeight / 2, 0)
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
