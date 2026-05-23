# R7-3.10 Contact Shadow Root Cause Analysis

Date: 2026-05-17
Branch: `codex/r7-3-10-beam-column-bake-expansion`
Status: updated with east-wall same-view guard-texel fix, southeast-column shadow still pending same-pose work

Correction note:

The first draft over-collapsed the five user-reported symptoms into one root cause. The safer reading is that all five sit in the broader bake-boundary / reconstruction problem space, while the actual root causes may split into two or three mechanisms. This document now treats the shared framing as a working model, not a conclusion.

## User-Reported Symptoms

1. East wall bake ON + structural bake ON:
   - East beam shadow on the east wall / southeast flat column remains discontinuous.
   - The soft falloff reads like a shortened or stepped gradient.

2. East side A/B:
   - LIVE view keeps a softer diagonal / continuous shadow.
   - Baked view shows rectangular or ladder-like shadow bands.

3. West wall + west beam:
   - Similar discontinuity appears on the west side.
   - West beam top edge also shows a dark line.

4. South wall window reveal:
   - The lower reveal corner / right-angle turn has a dark seam.
   - The upper reveal corner is visually much less obvious.

## First Principles

Static diffuse bake has two separate jobs: capture physically correct radiance, then reconstruct that radiance back onto visible surfaces without edge artifacts.

For the baked result to match LIVE at close range, all of these conditions must hold:

1. Every visible runtime hit must map to a valid texel.
2. Every visible edge must have a valid border policy.
3. The sampler must reconstruct soft gradients smoothly enough for the viewing distance.
4. Packed atlas islands must not expose black or stale texels at physical seams.
5. Physical surfaces that share an edge need either one continuous chart or an explicit seam contract.

The current implementation satisfies the light-path side of the contract better than the reconstruction side:

- bake capture is diffuse-only and contamination guard is clean.
- runtime reflection remains LIVE.
- runtime short-circuit is primary-hit only.
- atlas lookup uses slot half-texel protection.
- packed islands and hole boundaries do not have a complete gutter / dilation policy.
- runtime combined diffuse texture uses `THREE.NearestFilter`.

## Evidence Collected

### 2026-05-18 East Wall Same-View Guard Result

The closer same-view baked-OFF reference changed the east-wall diagnosis.

The first same-view fix tried to clamp the runtime atlas rect away from the southeast `z=2.49` / east-beam `y=2.515` contact. That reduced black texel exposure, but it also shortened the diagonal shadow and repeated edge texels into a local dark blob.

The final east-wall result uses:

```glsl
r7310C1FullRoomDiffuseSampleRectTent3(atlasUv, 2.0, r7310C1EastWallAtlasRect())
```

with:

```glsl
r7310C1EastWallAtlasRect() == vec4(0.0, 0.0, 1.0, 1.0)
```

The missing piece was not another clamp. The formal east-wall atlas needed valid guard texels:

```text
before_guard_fill:
  y=2.460 z=2.500 luma=0.0000
  y=2.540 z=2.420 luma=0.0000

after_guard_fill:
  y=2.460 z=2.500 luma=0.3374
  y=2.540 z=2.420 luma=0.1588
```

Current same-view evidence:

```text
.omc/r7-3-10-east-wall-shadow-visual/20260518-003331/east-wall-shadow-same-view.png
.omc/r7-3-10-east-wall-shadow-visual/20260518-003331/east-wall-shadow-all-bakes-off-reference.png
```

Updated interpretation:

- East wall stepping was not only nearest reconstruction.
- East wall also needed a same-owner guard-fill policy at the southeast contact edge.
- Runtime smoothing works only after the guard region contains plausible east-wall values.
- The southeast flat-column air-conditioner shadow should be checked next with the same camera-pose method.

### Runtime Texture Filtering

`js/InitCommon.js` builds the combined R7-3.10 diffuse runtime texture with:

```js
texture.minFilter = THREE.NearestFilter;
texture.magFilter = THREE.NearestFilter;
```

This protects against cross-slot bleeding, but close-range soft shadows become visible texel steps.

### East Wall Shadow Edge

Atlas samples near the east beam contact show a valid-to-black boundary just above the beam underside:

```text
east wall z=2.49
y2.20: 0.4608
y2.35: 0.3809
y2.50: 0.2854
y2.515: 0.1402
y2.53: 0.0000
y2.65: 0.0000
y2.80: 0.0000
```

Interpretation:

- The visible wall below the beam has shadow gradient values.
- The hidden region behind / above the beam is black.
- A close runtime sample near the physical edge can visibly step from soft shadow to black / hard cutoff.
- Nearest reconstruction makes the transition look like blocks.

### West Wall Mirror Case

West wall shows the same pattern near the west beam / southwest column:

```text
west wall z=2.848
y2.20: 0.3571
y2.40: 0.2874
y2.52: 0.1124
y2.535: 0.0000
y2.65: 0.0000
y2.80: 0.0000
```

Interpretation:

- This is the mirror version of the east-side valid-to-black edge.
- The west-side issue is therefore expected under the same chart policy.

### Structural Packed Island Gaps

Some structural metadata-invalid texels contain nonzero atlas RGB:

```text
struct west gap metadata valid: 0
struct west gap atlas RGB: [0.466849, 0.342432, 0.247917, 1]

struct east gap metadata valid: 0
struct east gap atlas RGB: [0.447194, 0.367899, 0.284856, 1]
```

Interpretation:

- Metadata says these cells are outside any declared island.
- Atlas RGB still contains radiance-like values.
- Invalid cells are currently not guaranteed to be black, dilated, or owned.
- This can create both dark seams and unexpected bright / dirty seams depending on which invalid cells the runtime touches.

### South Reveal Lower Corner

South reveal atlas has a literal black gap between the bottom reveal and side reveal regions:

```text
bottom_reveal_right_inside x=0.39  y=1.185 luma=0.276953
gap_bottom_to_right_mid    x=0.425 y=1.185 luma=0.000000
right_reveal_lower_inside  x=0.46  y=1.185 luma=0.329475

bottom_reveal_left_inside  x=-1.45  y=1.185 luma=0.257361
gap_bottom_to_left_mid     x=-1.485 y=1.185 luma=0.000000
left_reveal_lower_inside   x=-1.52  y=1.185 luma=0.221060
```

Interpretation:

- The physical right-angle corner is represented by two separate atlas rectangles.
- The rectangles have a black gap between them.
- The lower reveal corner can expose that gap.
- The upper reveal has a similar atlas gap, but the lighting / view angle makes it less visible in the current report.

## Confidence Boundaries

Current evidence supports a shared problem family. It does not yet prove a single root cause.

The five symptoms can plausibly split into these mechanisms:

1. Soft-shadow reconstruction:
   - Runtime uses `THREE.NearestFilter`.
   - Close-up soft gradients can become visible texel steps.
   - Strongest fit: east / west wall beam-shadow discontinuity.

2. Atlas gap / invalid texel exposure:
   - South reveal has measured black gaps between physically adjacent cuts.
   - Structural packed atlas has metadata-invalid cells with nonzero RGB.
   - Strongest fit: south lower reveal seam and some structural edge seams.

3. Geometry ownership / missing chart face:
   - Some physical contact or top faces are excluded from structural bake ownership.
   - Strongest fit: west beam top-edge dark line.

These mechanisms may interact. A black gap can look worse under nearest sampling; a missing chart face can expose an invalid texel; an invalid texel with stale RGB can create either dark or bright edge artifacts.

## Root-Cause Working Model

The common frame is incomplete chart-edge reconstruction policy.

The current R7-3.10 bake path has strong per-surface capture, but weak seam reconstruction:

1. Main wall charts contain black hidden regions next to visible shadow edges.
2. Packed structural islands have no formal gutter ownership.
3. South reveal slices are packed with black gaps between physically adjacent cuts.
4. The runtime texture uses nearest sampling, so soft shadows become visible texel steps at close range.
5. Previous fixes patched individual contact texels, which can remove one black line while creating or revealing the next seam.

This explains why the same broad artifact family repeats on east, west, and south reveal corners. It does not yet identify the exact mechanism for each individual screenshot.

## Why The Previous Fix Did Not Solve It

The previous southeast-column refinement only changed a tiny set of contact source positions:

- structural `se_column_north_z` edge band
- east wall `z=2.49` contact band

That fixed one local invalid-contact symptom, but it did not change:

- nearest runtime reconstruction
- packed-island gutters
- invalid atlas cell policy
- wall hidden-region boundaries
- south reveal atlas packing gaps

The reported shadow still looks stepped because the system is still reconstructing a close-up soft shadow from discrete nearest texels next to invalid / hidden zones.

## Five-Issue Working Classification

| issue | likely immediate trigger | current class | confidence |
| --- | --- | --- | --- |
| east wall / east beam discontinuous shadow | east wall valid shadow texels border black hidden beam/column texels; nearest sampling exposes steps | soft-shadow reconstruction + edge invalid boundary | medium |
| southeast flat column shadow discontinuity | `se_column_north_z` contains visible, contact, and hidden zones inside one rectangular island | sub-island ownership + edge invalid boundary | medium |
| west wall / west beam discontinuous shadow | mirror of east wall valid-to-black boundary at west beam / southwest column | soft-shadow reconstruction + edge invalid boundary | medium |
| west beam top dark line | structural top/contact edge has no owned top-face chart and no seam gutter against ceiling/contact | geometry ownership / missing chart face | low-to-medium |
| south reveal lower-corner black seam | bottom reveal and side reveal are separate atlas rectangles with black gap between them | atlas gap / invalid texel exposure | high |

## Candidate Directions

### Direction A: Atlas Gutter / Dilation Contract

Create a formal post-bake or bake-time dilation step:

- use metadata valid flags and island ownership.
- fill invalid texels around each valid chart edge with the nearest valid texel from the same owner.
- do not borrow across unrelated physical surfaces.
- ensure every packed island has at least 2-4 texels of owned border.
- then evaluate whether runtime can use smoother reconstruction safely.

This directly addresses black seams and stale invalid cells. It may reduce soft-shadow discontinuity only after the sampler policy is also reviewed.

### Direction B: Runtime UV Clamp Per Chart

Clamp runtime UVs into each chart interior:

- structural packed islands clamp to their own rect interior.
- reveal slices clamp away from black gaps.
- wall contact edges clamp away from hidden zones.

This is surgical, but every chart needs hand rules. It risks repeating the current patch-by-patch cycle unless an audit proves the exact chart classes first.

### Direction C: Higher Local Resolution

Increase resolution for walls / structural charts near close-up shadows:

- reduces visible texel stepping.
- does not solve black gaps by itself.
- costs memory and bake time.

This can help after Direction A, but it does not address atlas gaps or missing ownership by itself.

## 2026-05-17 East Wall Same-View Update

User supplied this exact failing east-wall view:

```text
cameraState={"position":{"x":1.772783,"y":2.418704,"z":2.267062},"yaw":-0.462793,"pitch":0.396,"fov":55}
forward={"x":0.413879,"y":0.385731,"z":0.82457}
view={"facing":"南(+Z)","config":1,"samples":1,"paused":true,"sppCap":1000}
```

They also supplied a south-wall reference view where the air-conditioner shadow looks smooth:

```text
cameraState={"position":{"x":0.684479,"y":2.318837,"z":2.545346},"yaw":-0.810793,"pitch":0.339,"fov":55}
forward={"x":0.685139,"y":0.332544,"z":0.648073}
view={"facing":"東(+X)","config":1,"samples":1,"paused":true,"sppCap":1000}
```

### Revised Root Cause For East-Wall Beam Shadow

The east-wall and south-wall packages both use 1024 / 1000spp diffuse bake packages. The useful difference was the runtime reconstruction path exposed by the reported camera, not the bake resolution.

Before the fix, east-wall slot 2 still used the global nearest lookup:

```glsl
r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 2.0))
```

At the supplied camera position, the view is close to the east wall and aligned with the east-beam soft-shadow gradient. Nearest reconstruction made individual atlas texels visible as a stair-step shadow. The visible east-wall chart also sits next to the southeast-column contact at `z = 2.49`, so a generic linear texture filter would risk blending into hidden black texels behind the column.

The fix keeps the combined runtime texture on `NearestFilter`, then performs chart-aware manual linear reconstruction only for the east-wall slot:

```glsl
r7310C1FullRoomDiffuseSampleRectLinear(atlasUv, 2.0, r7310C1EastWallAtlasRect())
```

`r7310C1EastWallAtlasRect()` clamps the east-wall reconstruction to the visible side of the southeast-column contact plus half a texel. This addresses the same-view east-wall stair-step without changing the physical bake package or borrowing from unrelated charts.

### Validation

```text
node --check js/Home_Studio.js
status: pass

node --check js/InitCommon.js
status: pass

node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
status: pass

node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
status: pass

node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-runtime-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
status: pass
eastWallSurfaceHitCount: 699773
eastWallShortCircuitCount: 699773
package: .omc/r7-3-10-full-room-diffuse-runtime/20260517-214255

node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-shadow-visual-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
status: pass
samples: 203
screenshot: .omc/r7-3-10-east-wall-shadow-visual/20260517-214040/east-wall-shadow-same-view.png

node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
status: pass
package: .omc/r7-3-10-full-room-diffuse-runtime/20260517-214349

git diff --check
status: pass
```

### Remaining Scope

This update targets only the east-beam shadow on the east wall. The southeast flat-column air-conditioner shadow remains a separate same-pose target. Do not mark that issue complete from this east-wall evidence.

## 2026-05-17 Close East-Wall Pose Correction

The user rejected the first east-wall same-view fix and supplied a closer pose:

```text
cameraState={"position":{"x":1.830026,"y":2.469767,"z":2.391893},"yaw":-0.547993,"pitch":0.342,"fov":55}
forward={"x":0.490803,"y":0.335372,"z":0.804138}
view={"facing":"南(+Z)","config":1,"samples":1,"paused":true,"sppCap":1000}
```

The earlier visual proof was incomplete. It covered the previous camera, not this closer beam / wall contact view.

### Corrected Finding

All-surfaces runtime probe showed:

- the beam underside sample is structural island 4.
- the shadow-band samples are east-wall hits with normal `(-1, 0, 0)`.
- their world positions sit at `y = 2.47..2.50`, just below the east-beam underside at `y = 2.515`.

East-wall atlas samples near the reported band show large local jumps:

```text
row 850 maxStep 0.04455
row 860 maxStep 0.05554
row 880 maxStep 0.04749
col 805 maxStep near contact 0.19451
```

So the close-view artifact is not only the southeast-column `z = 2.49` chart edge. It is also the east-beam underside chart edge and the one-texel reconstruction footprint preserving baked texel steps at high magnification.

### Implemented Correction

`r7310C1EastWallAtlasRect()` now clamps both edges:

```text
uMax: visible side of southeast-column z=2.49 contact
vMax: visible side of east-beam y=2.515 contact
```

East-wall slot 2 now uses chart-clamped 3x3 tent reconstruction:

```glsl
r7310C1FullRoomDiffuseSampleRectTent3(atlasUv, 2.0, r7310C1EastWallAtlasRect())
```

Validation screenshot:

```text
.omc/r7-3-10-east-wall-shadow-visual/20260517-221418/east-wall-shadow-same-view.png
```

Refresh URL:

```text
http://localhost:9002/Home_Studio.html?v=r7310-east-wall-tent-reconstruct-v1
```

### Direction D: Repack Physically Adjacent Surfaces

Put physically adjacent reveal / beam / wall edge surfaces into continuous or explicitly padded charts:

- best for visual continuity.
- larger implementation cost.
- requires clear ownership registry and new bake packages.

## Recommended Next Step

Before editing shader behavior again, add one audit tool:

```bash
node docs/tools/r7-3-10-atlas-seam-audit.mjs
```

The tool should read all formal package pointers and report separate buckets:

1. valid texels adjacent to invalid black texels.
2. invalid texels with nonzero RGB.
3. packed island borders with missing gutter.
4. large luma jumps at declared physical seams.
5. east / west beam contact rows and south reveal lower-corner gaps as named probes.
6. soft-gradient stair-step metrics along the reported wall shadow bands.
7. suspected missing-ownership edges such as west beam top contact.

Acceptance for the audit:

- it reproduces the five reported seam families numerically.
- it classifies each symptom into one of the buckets above instead of forcing one shared root cause.
- it does not need browser rendering.
- it gives a before/after table for any future fix.

After the audit exists, choose one root-level fix direction and apply it to the smallest representative set:

1. south reveal lower corner, because the atlas gap is explicit and easy to verify.
2. east wall / east beam shadow edge, because it tests soft gradient reconstruction.
3. west wall / west beam mirror, because it confirms symmetry.

## Current Conclusion

The strongest current conclusion is:

The artifacts are related by the bake-boundary / reconstruction layer, but current evidence does not prove a single root cause.

The current best classification is:

1. east / west soft shadow discontinuity: likely reconstruction + edge invalid boundary.
2. south reveal lower-corner seam: confirmed atlas black gap.
3. west beam top dark line: suspected ownership / missing chart face.

The next fix should start with a seam audit that separates these buckets. After that, the implementation can target the smallest proven class first. More local contact padding is likely to move at least some artifacts rather than remove the cause.

## 2026-05-17 Audit And South Reveal Fix Result

`docs/tools/r7-3-10-atlas-seam-audit.mjs` was added and now reads the seven formal R7-3.10 runtime package pointers without browser rendering.

Before the first fix, the audit classified the reported south reveal lower-corner issue as `gap_or_strong_luma_jump_present`:

```text
bottom_reveal_right_inside: 0.2688
gap_bottom_to_right_mid:   0 / invalid
right_reveal_lower_inside: 0.3172

bottom_reveal_left_inside: 0.2497
gap_bottom_to_left_mid:    0 / invalid
left_reveal_lower_inside:  0.2136
```

The first fix changed the south reveal atlas ownership contract:

```text
bottomReveal x range: -1.45..0.39 -> -1.52..0.46
topReveal x range:    -1.45..0.39 -> -1.52..0.46
```

This makes the horizontal reveal islands meet the left / right reveal entrance positions instead of leaving black invalid atlas cells between them. It changes only the south wall bake mapping and the formal south wall package. Runtime reflection stays LIVE.

After rebaking the formal south wall 1024 / 1000spp package, the audit reports `no_large_gap_jump_at_probe_points`:

```text
bottom_reveal_right_inside: 0.2550
gap_bottom_to_right_mid:   0.2589
right_reveal_lower_inside: 0.3172

bottom_reveal_left_inside: 0.2256
gap_bottom_to_left_mid:    0.2391
left_reveal_lower_inside:  0.2136

top_reveal_right_gap_mid:  0.1375
top_reveal_left_gap_mid:   0.1160
```

Validation passed:

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=south-wall --samples=1000 --target-samples=1000 --atlas-resolution=1024 --timeout-ms=3600000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-wall-runtime-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Remaining buckets from the audit are still separate issues:

```text
east / west wall shadow edge:
  still classified as edge / reconstruction risk, not solved by the south reveal fix.

structural invalid nonzero RGB:
  still present and should be handled as structural package hygiene.

west beam top:
  still classified as suspected ownership / hidden-contact edge.
```

## 2026-05-17 Follow-Up: South Window Front-Edge Guard

The first south reveal fix was not enough. The user refreshed the page and the two south-window black lines were still visible.

The missed root cause was narrower than a full rebake problem:

```text
The atlas midpoint gaps between reveal rectangles were fixed.
But primary hits on the south wall front plane inside the window hole could still land close to the opening edge.
Those hits were rejected as window-hole texels and never routed to the reveal bake.
```

New measured evidence from the formal south package:

```text
bottom_hole_gap_center:     0 / invalid
bottom_hole_gap_near_edge:  0 / invalid
right_hole_gap_mid:         0 / invalid
bottom_left_corner_exact:   0 valid corner
bottom_right_corner_exact:  0 valid corner
```

The implemented correction is a runtime ownership guard in `shaders/Home_Studio_Fragment.glsl`:

```text
r7310C1SouthWallWindowFrontEdgeDiffuseUv
  - detects front-plane south-wall hits inside the window hole near the physical opening edge.
  - routes them to the matching reveal island.
  - clamps packed UVs one texel inward to avoid exact black corner texels.
```

`docs/tools/r7-3-10-atlas-seam-audit.mjs` is now `v2` and reports the new bucket:

```text
south window front edge guard: runtime_front_edge_guard_present
```

Validation passed:

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-wall-runtime-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-window-front-edge-visual-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
git diff --check
```

Visual evidence:

```text
.omc/r7-3-10-south-window-front-edge-visual/20260517-202553/south-window-front-edge.png
```

This step does not generate a new south bake package. It changes runtime UV ownership for the window front-edge tolerance zone and leaves reflection LIVE.

## 2026-05-17 Follow-Up: South Window Reveal 90-Degree Corner Clamp

The user corrected the target after the front-edge guard: the remaining line was at the 90-degree inside corner between the south window lower reveal and the side reveal.

Measured evidence from the formal south package:

```text
right_side_reveal_bottom_row_front: 0 valid
right_side_reveal_bottom_row_mid:   0 valid
right_side_reveal_interior_mid:     0.2986

left_side_reveal_bottom_row_front:  0 valid
left_side_reveal_bottom_row_mid:    0 valid
left_side_reveal_interior_mid:      0.2684

bottom_reveal_right_corner_edge:    0
bottom_reveal_right_inner:          0.2949
bottom_reveal_left_corner_edge:     0
bottom_reveal_left_inner:           0.2879
```

Root cause:

```text
The side reveal bottom chart row is valid but black.
Runtime reveal UVs mapped physical reveal edges directly to packed chart exact edges.
The lower reveal side endpoints could therefore sample the black side-reveal bottom row / corner texels.
```

Implemented correction:

```text
r7310C1SouthWallWindowRevealDiffuseUv
  - clamps left / right side reveal runtime packed UVs one texel inward.
  - clamps bottom / top reveal runtime packed UVs one texel inward.
  - keeps the formal south bake package unchanged.
```

The audit now reports:

```text
south reveal 90-degree corner clamp: runtime_reveal_corner_clamp_present
```

Close visual evidence:

```text
.omc/r7-3-10-south-reveal-corner-visual/20260517-204043/south-reveal-right-lower-corner.png
.omc/r7-3-10-south-reveal-corner-visual/20260517-204043/south-reveal-left-lower-corner.png
.omc/r7-3-10-south-reveal-corner-visual/20260517-204043/south-reveal-lower-span.png
```

Validation passed:

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-wall-runtime-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-reveal-corner-visual-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
```

This is a runtime reveal-surface exact-edge fix. Reflection remains LIVE. Same-view user validation is still the final acceptance signal.

## 2026-05-17 Follow-Up: Southeast Column Shadow Gradient Reconstruction

The user confirmed the south window lower reveal corner line was fixed, then reported a different class of issue:

```text
The air-conditioner diagonal shadow on the south wall is smooth.
The air-conditioner / east-beam shadow on the southeast flat column shows discontinuous gradient steps.
```

Difference review:

```text
South wall:
  runtime slot 4
  large continuous south-wall atlas plane / reveal charts
  nearest reconstruction is less visible at the reported view scale

Southeast flat column:
  runtime slot 6
  small structural packed islands
  affected islands: se_column_inner_x and se_column_north_z
  nearest reconstruction exposes texel steps at close camera distance
```

Measured evidence:

```text
se_column_inner_x y profile at z=2.72:
  nearest maxStep 0.051043, largeStepsOver003 10
  rect-clamped linear maxStep 0.040203, largeStepsOver003 1

se_column_inner_x z profile at y=1.6:
  nearest maxStep 0.133365, largeStepsOver003 19
  rect-clamped linear maxStep 0.022191, largeStepsOver003 0

se_column_north_z y profile at x=1.825:
  nearest maxStep 0.043501, largeStepsOver003 16
  rect-clamped linear maxStep 0.029625, largeStepsOver003 0
```

Implemented correction:

```text
Structural slot 6 now uses manual rect-clamped linear reconstruction.
The combined bake texture remains NearestFilter.
Floor / north / east / west / south / ceiling sampling routes stay unchanged.
No bake package was regenerated.
```

Files changed for this correction:

```text
shaders/Home_Studio_Fragment.glsl
js/Home_Studio.js
Home_Studio.html
docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
docs/tools/r7-3-8-c1-bake-capture-runner.mjs
```

Validation passed:

```bash
node --check js/Home_Studio.js
node --check js/InitCommon.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-structural-runtime-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-se-column-shadow-visual-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Visual helper output:

```text
.omc/r7-3-10-se-column-shadow-visual/20260517-205951/
```

Same-view user validation remains the final acceptance signal.

## 2026-05-17 Follow-Up: Same-View Camera Pose Gate

User validation after refresh rejected the structural linear reconstruction for the reported views:

```text
East-beam shadow on the east wall still shows discontinuous gradient.
Air-conditioner shadow on the southeast flat column still shows discontinuous gradient.
```

The correction above remains useful as a reconstruction experiment, but it is not accepted as the visual fix for the user's reported camera positions.

New same-view tool:

```text
Home_Studio now displays a readonly pure-text INFO field.
The field outputs:
  cameraState={...}
  forward={...}
  view={...}

The cameraState line can be applied through the existing validation camera route.
Future shadow debugging must start from the user-pasted cameraState text.
```

Validation:

```bash
node --check js/Home_Studio.js
node --check js/InitCommon.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-camera-pose-info-test --timeout-ms=120000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Runtime evidence:

```text
.omc/r7-3-10-camera-pose-info/20260517-212142/camera-pose-info-report.json
```

Next investigation gate:

```text
1. Reproduce the exact user view from pasted cameraState.
2. Compare baked ON/OFF for east wall and structural toggles at the same view.
3. Probe the exact canvas pixels from that camera before changing shader or bake assets again.
```

## 2026-05-18 Follow-Up: East Beam Same-View Structural Source

The user supplied a closer exact camera and rejected the `r7310-east-wall-guard-texel-v2` result.

Acceptance criterion for this target is now:

```text
cameraState={"position":{"x":1.786518,"y":2.426144,"z":2.375295},"yaw":-2.5156,"pitch":0.613,"fov":55,"forward":{"x":0.479224,"y":0.575324,"z":0.662832}}

With east wall + structural bake ON, the image must closely match all bakes OFF after about 100 SPP.
The diagonal shadow must stay continuous. Any stair-like dark band is failure.
```

Correction to the previous diagnosis:

```text
The east-wall guard-texel route did not isolate the latest same-view artifact.
Four-way same-view isolation showed the structural slot is the dominant source:
  structural OFF was closest to the all-bakes-OFF reference.
  east wall OFF with structural still ON retained the stair artifact family.
```

Root cause candidate now supported by atlas evidence:

```text
`se_column_inner_x` claimed the full southeast column inner face:
  x=1.78, y=0..2.905, z=2.49..3.056

The southeast bookshelf touches that same plane:
  x=1.02..1.78, y=0..2.04, z=2.73..3.056

That bookshelf overlap is hidden and should be excluded from structural bake/runtime ownership.
Before correction, around 40 percent of the `se_column_inner_x` texels were black zero texels in this hidden overlap.
Close-view reconstruction near the visible edge could pull those zeros into the beam shadow, producing stair-like bands.
```

Candidate correction applied:

```text
1. Add southeast bookshelf as a geometry gate blocker.
2. Add `se_column_inner_x_bookshelf_overlap` as a mixed checked face.
3. Exclude `x=1.78, y=0..2.04, z=2.73..3.056` from structural ownership.
4. Reject that overlap during shader bake capture and runtime island matching.
5. Guard-fill hidden texels from the adjacent visible side after structural bake capture.
```

Same-view evidence after the candidate:

```text
.omc/r7-3-10-east-wall-shadow-visual/20260518-014555/east-wall-shadow-same-view.png
.omc/r7-3-10-east-wall-shadow-visual/20260518-014555/east-wall-shadow-all-bakes-off-reference.png
.omc/r7-3-10-east-wall-shadow-visual/20260518-014555/crop-montage-on-ref-structuralOff.png
.omc/r7-3-10-east-wall-shadow-visual/20260518-014555/crop-diff-summary.json
```

Measured change:

```text
se_column_inner_x zero texel ratio:
  before: about 0.4045
  after:  about 0.0008

same-view crop baked ON vs all-bakes-OFF reference:
  meanDiff: 1.2142
  p95: 3.0
  p99: 6.6667
  target samples reached: 109
  forwardDelta: 0,0,0
```

Validation caveat:

```text
`validation-report.json` can still report `status: pass` while `reprojectionStatus: fail` and `reprojectionComparisons: 0`.
That report is not visual acceptance.
For this target, only same-view ON/OFF evidence counts.
```
