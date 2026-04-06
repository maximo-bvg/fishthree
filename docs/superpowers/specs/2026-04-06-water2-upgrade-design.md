# Water2 Flow-Based Water Upgrade

## Goal

Replace the current `Water` (single normal map, reflection-only) with `Water2` (dual normal maps, flow animation, reflections + refractions, Fresnel blending) to match the visual quality of the Three.js `webgpu_water` example, optimized for a front-viewing aquarium camera.

## Reference

- Three.js example: `examples/webgpu_water.html`
- Water2 WebGL source: `three/examples/jsm/objects/Water2.js`
- Technique: Vlachos, "Water Flow in Portal 2", SIGGRAPH 2010

## Design

### Water Surface Replacement

**File:** `src/scene/tank.ts`

Replace the `Water` import and instantiation with `Water2`:

```typescript
import { Water as Water2 } from 'three/examples/jsm/objects/Water2.js'
```

Configuration:
- `color`: `0x0a5088` (current water tint, preserved)
- `scale`: `4` (normal map tiling frequency)
- `flowDirection`: `new THREE.Vector2(0.5, 0.3)` (gentle diagonal flow)
- `reflectivity`: `0.02` (low reflectivity — underside should look tinted/rippling, not mirror-like)
- `textureWidth` / `textureHeight`: `512` (reflection/refraction FBO resolution)
- `normalMap0` / `normalMap1`: two flow normal map textures (see below)
- `side`: `THREE.DoubleSide` (visible from below)

Position and rotation stay the same: `rotation.x = -PI/2`, `position.y = TANK.height / 2`.

### Normal Map Textures

Add two textures to `public/textures/`:
- `Water_1_M_Normal.jpg` — sourced from Three.js examples (`examples/textures/water/`)
- `Water_2_M_Normal.jpg` — same source

Both set to `RepeatWrapping` on S and T.

The existing `waternormals.jpg` can be removed if no longer referenced.

### Type and Interface Updates

**File:** `src/scene/tank.ts`

- `TankMeshes.waterSurface` type changes from `Water` to `Water2` (the Water2 class is imported as `Water` from the Water2.js module, so the actual import alias handles this)
- `updateWaterSurface`: remove the `time` uniform update for the water surface. Water2 manages its own internal clock. The front glass and meniscus time updates remain unchanged.

### Tuning for Front-View Camera

The camera sits at or below the water line, looking through the front glass. The water surface is the "ceiling" of the tank.

- Low `reflectivity` (0.02) ensures the Fresnel blend favors the refraction/tint from the front viewing angle
- `DoubleSide` ensures the underside renders
- Flow direction creates visible movement from the front perspective
- Refraction is enabled but subtle — fish are visible through the surface if the camera orbits above

### Scope Boundary

These elements are NOT changed:
- Meniscus lines (4 shaders) — unchanged
- Front glass refraction shader — unchanged
- Underwater effects (particles, light rays, bubbles, caustics) — unchanged
- Post-processing pipeline (bloom, underwater pass) — unchanged
- Lighting setup — unchanged
- Tank geometry (walls, floor, rim, air gap) — unchanged

## Performance

Water2 adds two extra render passes per frame (reflection FBO + refraction FBO) at 512x512 resolution. For a single-tank scene this is negligible.

## Testing

- Visual: confirm water surface shows flowing dual-normal ripples from front camera
- Visual: confirm fish are visible through glass (not obscured by water)
- Visual: confirm meniscus lines still align at water level
- Visual: if camera orbits above tank, subtle refraction of fish visible through surface
- Performance: confirm no frame rate regression (should be <1ms additional GPU time)
