# Realistic Sand Bed

## Goal

Replace the flat sand plane with a volumetric, white aragonite sand bed that matches the look of a real Italian reef tank. Sand should have subtle undulations, mound around decoration bases, and show visible thickness through the front glass. Sand sits above the bottom frame bars.

Reference: `~/Downloads/italian-reef-tanks-14.jpg`

## 1. Sand Geometry

Replace the current flat `PlaneGeometry` in `src/scene/tank.ts` (lines 150-235) with a subdivided plane and side panels.

**Top surface:**
- `PlaneGeometry(TANK.width, TANK.depth, 64, 32)` — 2,048 vertices
- Base Y position: `-TANK.height / 2 + TANK.sand.depth` (= -3.5)
- Rotated -PI/2 to lie flat

**Vertex displacement (applied once at init):**
- Large-scale undulation: FBM noise, low frequency, amplitude ~0.15 units
- Fine grain variation: high-frequency noise, amplitude ~0.03 units
- Combined max height variation: ~0.18 units

**Decoration mounding:**
- For each decoration position, vertices within `TANK.sand.moundRadius * decoration footprint` get raised
- Smooth falloff (cosine or smoothstep)
- Peak raise: ~0.25 units at decoration base, tapering to zero at edge

**Side panels (front, left, right):**
- Strip geometries whose top vertices match the displaced edge of the top surface
- Bottom vertices at Y = -4.5 (original floor)
- Gives visible cross-section through the glass that follows the sand contour
- No back panel needed (back wall obscures it)

## 2. Sand Material & Texture

**Procedural texture (512x512 canvas):**
- Keep existing layered noise approach (FBM dunes, ripples, grain, pebbles)
- Shift color channels to white aragonite:
  - Red: `val * 240`
  - Green: `val * 236`
  - Blue: `val * 224`

**Material properties:**
- Color: `0xf0ece0` (cream-white)
- Emissive: `0xd0c8b0` (light warm tone)
- Emissive intensity: 0.3
- Roughness: 0.92 (matte sand)
- Texture repeat: 3x width, 1.5x depth (unchanged)
- DoubleSide (unchanged)

**Shared material** for top surface and side panels. Side panel UVs stretch the texture vertically across the ~1 unit thickness so the cross-section reads as compacted sand.

## 3. Frame Bar & Dependent System Adjustments

**Bottom frame bars:** Stay at Y = -4.7. Sand surface (Y ~= -3.5) sits well above them, visually burying the bars. Matches reference photo.

**Systems that reference floor Y — update to sand surface height:**

| System | File | Current value | New value |
|--------|------|---------------|-----------|
| Feeding flakes settle | `src/feeding/flakes.ts:114` | `-TANK.height/2 + 0.02` | `sandSurfaceY + 0.02` |
| Bottom-dwelling fish | `src/fish/behaviors.ts:127-146` | `-TANK.height/2` | `sandSurfaceY` |
| Bottom light | `src/scene/lighting.ts` | Y = -4.5 | Y = `sandSurfaceY` |
| Caustic overlay | `src/scene/underwater.ts:370` | Y = -4.48 | `sandSurfaceY + 0.02` |
| Decoration base Y | `src/scene/decorations.ts` (or equivalent) | `-TANK.height/2` | `sandSurfaceY` |

**Decoration placement order:** Decorations are positioned first, then sand vertices are displaced around them.

## 4. Constants

Add `sand` config to the existing `TANK` object in `src/scene/tank.ts`:

```typescript
const TANK = {
  width: 16,
  height: 9,
  depth: 8,
  frameBar: 0.4,
  sand: {
    depth: 1.0,
    segments: [64, 32] as [number, number],
    undulation: 0.15,
    grain: 0.03,
    moundRadius: 1.5,
    moundHeight: 0.25,
  }
}
```

Derived sand surface Y: `-TANK.height / 2 + TANK.sand.depth`

All dependent systems use this derived value — single source of truth.

## 5. Performance

- 2,048 vertices for top surface (vs 20,000 for water — trivial)
- ~200 vertices for side panels
- All displacement is one-time at init — no per-frame cost
- No new shaders or render passes needed
- No measurable FPS impact expected

## 6. Out of Scope

- Animated sand (settling, shifting)
- Sand particle effects
- Per-grain rendering
- Sand interaction with fish movement
