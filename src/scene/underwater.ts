import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { TANK } from './tank'

// --- Floating particles (plankton / dust motes) ---

const PARTICLE_COUNT = 60

let particleSystem: THREE.Points
let particleVelocities: Float32Array

export function createParticles(scene: THREE.Scene): THREE.Points {
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const sizes = new Float32Array(PARTICLE_COUNT)
  const opacities = new Float32Array(PARTICLE_COUNT)
  particleVelocities = new Float32Array(PARTICLE_COUNT * 3)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3
    positions[i3] = (Math.random() - 0.5) * TANK.width * 0.9
    positions[i3 + 1] = (Math.random() - 0.5) * TANK.height * 0.9
    positions[i3 + 2] = (Math.random() - 0.5) * TANK.depth * 0.9
    sizes[i] = Math.random() * 1.5 + 0.8
    opacities[i] = Math.random() * 0.15 + 0.05

    // Slow drift velocities
    particleVelocities[i3] = (Math.random() - 0.5) * 0.08
    particleVelocities[i3 + 1] = Math.random() * 0.04 + 0.01 // slight upward bias
    particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.06
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1))
  geo.setAttribute('alpha', new THREE.Float32BufferAttribute(opacities, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xaaddee) },
    },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (150.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = vAlpha * (1.0 - d * d);
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  particleSystem = new THREE.Points(geo, mat)
  scene.add(particleSystem)
  return particleSystem
}

export function updateParticles(time: number, dt: number): void {
  if (!particleSystem) return
  const pos = particleSystem.geometry.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array

  const halfW = TANK.width * 0.45
  const halfH = TANK.height * 0.45
  const halfD = TANK.depth * 0.45

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3
    // Drift + gentle sine wobble
    arr[i3] += particleVelocities[i3] * dt + Math.sin(time * 0.5 + i) * 0.002
    arr[i3 + 1] += particleVelocities[i3 + 1] * dt
    arr[i3 + 2] += particleVelocities[i3 + 2] * dt + Math.cos(time * 0.4 + i) * 0.002

    // Wrap around tank bounds
    if (arr[i3] > halfW) arr[i3] = -halfW
    if (arr[i3] < -halfW) arr[i3] = halfW
    if (arr[i3 + 1] > halfH) arr[i3 + 1] = -halfH
    if (arr[i3 + 1] < -halfH) arr[i3 + 1] = halfH
    if (arr[i3 + 2] > halfD) arr[i3 + 2] = -halfD
    if (arr[i3 + 2] < -halfD) arr[i3 + 2] = halfD
  }
  pos.needsUpdate = true
}

// --- Light rays (god rays from surface) ---

const RAY_COUNT = 5

export function createLightRays(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group()

  for (let i = 0; i < RAY_COUNT; i++) {
    const width = Math.random() * 1.2 + 0.4
    const height = TANK.height * 0.95
    const geo = new THREE.PlaneGeometry(width, height)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIndex: { value: i },
        uColor: { value: new THREE.Color(0x88ccff) },
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
        uniform float uIndex;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          // Fade from top to bottom
          float vertFade = pow(1.0 - vUv.y, 1.5);
          // Fade at horizontal edges
          float horizFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);
          // Animated shimmer
          float shimmer = 0.6 + 0.4 * sin(uTime * 0.8 + uIndex * 2.0 + vUv.y * 3.0);
          float alpha = vertFade * horizFade * shimmer * 0.06;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      (i - (RAY_COUNT - 1) / 2) * (TANK.width / (RAY_COUNT + 1)) + (Math.random() - 0.5) * 2,
      0,
      (Math.random() - 0.5) * TANK.depth * 0.5,
    )
    mesh.rotation.z = (Math.random() - 0.5) * 0.12
    group.add(mesh)
  }

  scene.add(group)
  return group
}

export function updateLightRays(group: THREE.Group, time: number): void {
  for (const child of group.children) {
    const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
    mesh.material.uniforms.uTime.value = time
  }
}

// --- Spontaneous bubbles (billboard sprites with ring shader) ---

interface Bubble {
  mesh: THREE.Mesh
  speed: number
  wobbleOffset: number
  baseScale: number
  life: number
  maxLife: number
}

const MAX_BUBBLES = 30
const bubbles: Bubble[] = []
let bubbleMat: THREE.ShaderMaterial
let bubbleGeo: THREE.PlaneGeometry
let bubbleScene: THREE.Scene

export function initBubbles(scene: THREE.Scene): void {
  bubbleScene = scene
  bubbleGeo = new THREE.PlaneGeometry(1, 1)
  bubbleMat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center) * 2.0;
        if (dist > 1.0) discard;

        // Thin bright rim — this is what makes a bubble look like a bubble
        float rim = smoothstep(0.75, 0.92, dist) - smoothstep(0.92, 1.0, dist);
        // Faint specular highlight near top-left
        float highlight = smoothstep(0.3, 0.0, length(center - vec2(-0.12, 0.12))) * 0.5;
        // Very faint interior
        float interior = (1.0 - dist) * 0.04;

        float alpha = (rim * 0.6 + highlight + interior) * uOpacity;
        vec3 col = vec3(0.7, 0.9, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function spawnBubble(): void {
  if (bubbles.length >= MAX_BUBBLES) return

  const size = Math.random() * 0.12 + 0.04 // 0.04–0.16 world units
  const mat = bubbleMat.clone()
  const mesh = new THREE.Mesh(bubbleGeo, mat)
  mesh.scale.setScalar(size)

  // Spawn from bottom third of tank
  mesh.position.set(
    (Math.random() - 0.5) * TANK.width * 0.7,
    -TANK.height * 0.4 + Math.random() * TANK.height * 0.15,
    (Math.random() - 0.5) * TANK.depth * 0.5,
  )

  bubbles.push({
    mesh,
    speed: 0.8 + Math.random() * 1.0,
    wobbleOffset: Math.random() * Math.PI * 2,
    baseScale: size,
    life: 0,
    maxLife: 4 + Math.random() * 5,
  })
  bubbleScene.add(mesh)
}

export function updateBubbles(time: number, dt: number, camera: THREE.Camera): void {
  // ~1.5 bubbles per second on average
  if (Math.random() < dt * 1.5) {
    spawnBubble()
  }

  const waterY = TANK.height / 2

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]
    b.life += dt

    // Rise with gentle side-to-side wobble
    b.mesh.position.y += b.speed * dt
    b.mesh.position.x += Math.sin(time * 2.5 + b.wobbleOffset) * 0.15 * dt
    b.mesh.position.z += Math.cos(time * 2.0 + b.wobbleOffset) * 0.1 * dt

    // Billboard — always face camera
    b.mesh.quaternion.copy(camera.quaternion)

    // Fade out near surface or end of life
    const mat = b.mesh.material as THREE.ShaderMaterial
    const lifeFade = b.life > b.maxLife * 0.7
      ? 1 - (b.life - b.maxLife * 0.7) / (b.maxLife * 0.3)
      : 1
    const surfaceFade = b.mesh.position.y > waterY - 0.3
      ? Math.max(0, (waterY - b.mesh.position.y) / 0.3)
      : 1
    mat.uniforms.uOpacity.value = lifeFade * surfaceFade

    if (b.life >= b.maxLife || b.mesh.position.y >= waterY) {
      bubbleScene.remove(b.mesh)
      mat.dispose()
      bubbles.splice(i, 1)
    }
  }
}

// --- Caustic light overlay on floor and back wall ---

let causticFloorMesh: THREE.Mesh
let causticBackMesh: THREE.Mesh

const causticShader = {
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

    float causticLayer(vec2 uv, float t) {
      vec2 p = uv * 5.0;
      float a = sin(p.x * 2.1 + t * 0.7) * cos(p.y * 1.8 - t * 0.5);
      float b = cos(p.x * 1.7 - t * 0.6) * sin(p.y * 2.3 + t * 0.8);
      float c = sin((p.x + p.y) * 1.5 + t * 0.4);
      float v = (a + b + c) / 3.0;
      return pow(max(0.0, v), 1.5);
    }

    void main() {
      float c1 = causticLayer(vUv, uTime);
      float c2 = causticLayer(vUv + vec2(0.3, 0.7), uTime * 1.3 + 5.0);
      float caustic = (c1 + c2) * 0.5;

      vec3 color = vec3(0.4, 0.8, 1.0) * caustic;
      float alpha = caustic * 0.8;
      gl_FragColor = vec4(color, alpha);
    }
  `,
}

export function createCausticOverlays(scene: THREE.Scene): void {
  // Floor caustics
  const floorGeo = new THREE.PlaneGeometry(TANK.width, TANK.depth)
  const floorMat = new THREE.ShaderMaterial({
    ...causticShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  causticFloorMesh = new THREE.Mesh(floorGeo, floorMat)
  causticFloorMesh.rotation.x = -Math.PI / 2
  causticFloorMesh.position.y = -TANK.height / 2 + 0.02
  scene.add(causticFloorMesh)

  // Back wall caustics
  const backGeo = new THREE.PlaneGeometry(TANK.width, TANK.height)
  const backMat = new THREE.ShaderMaterial({
    ...causticShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  causticBackMesh = new THREE.Mesh(backGeo, backMat)
  causticBackMesh.position.set(0, 0, -TANK.depth / 2 + 0.02)
  scene.add(causticBackMesh)
}

export function updateCausticOverlays(time: number): void {
  if (causticFloorMesh) {
    ;(causticFloorMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  }
  if (causticBackMesh) {
    ;(causticBackMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time
  }
}

// --- Underwater post-processing pass (wave distortion + color grading) ---

export function createUnderwaterPass(): ShaderPass {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
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
      uniform sampler2D tDiffuse;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        // Gentle wave distortion — everything ripples subtly
        vec2 uv = vUv;
        uv.x += sin(vUv.y * 12.0 + uTime * 1.2) * 0.002;
        uv.y += cos(vUv.x * 10.0 + uTime * 0.9) * 0.0015;

        vec4 color = texture2D(tDiffuse, uv);

        // Underwater color grading — tint toward deep blue-green
        vec3 waterTint = vec3(0.05, 0.25, 0.4);
        color.rgb = mix(color.rgb, waterTint, 0.15);

        // Slight desaturation — water absorbs warm colors
        float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(color.rgb, vec3(lum) * vec3(0.6, 0.8, 1.0), 0.1);

        gl_FragColor = color;
      }
    `,
  })
  return pass
}

export function updateUnderwaterPass(pass: ShaderPass, time: number): void {
  pass.uniforms['uTime'].value = time
}
