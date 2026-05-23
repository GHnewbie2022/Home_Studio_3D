# R7-3.10 Beam Column Static Diffuse Bake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加入樑柱結構的 R7-3.10 C1 static diffuse bake，同時不影響既有已成功的 floor / north / east / west / south / ceiling 1024 bake，並保持反射走 LIVE path tracing。

**Architecture:** Extend the existing R7-3.10 full-room diffuse runtime from 6 atlas slots to 7 slots. The new slot is `c1_structural_beams_columns`, target id `1007`, loaded from one pointer JSON and sampled only by tight world-space face predicates for exposed beam / column faces. The current capture guard, primary-ray short-circuit, atlas half-texel inset, and per-surface UI toggle pattern stay in force.

**Tech Stack:** Plain HTML, JavaScript, Three.js `DataTexture`, WebGL2 GLSL, existing CDP bake runner `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`, Node contract tests.

## Scope

This plan prepares only the first structural static diffuse batch.

- [ ] Include structural boxes from `js/Home_Studio.js:114-117`, current `sceneBoxes` indexes 28-31.
- [ ] Include exposed room-facing faces from the two side beams and two south corner columns.
- [ ] Verify both asymmetric overlap zones before implementation:
  - east beam / southeast column overlap
  - west beam / southwest column overlap
- [ ] Keep furniture, acoustic panels, outlets, doors, fixture housings, speakers, and movable/configured geometry out of this batch.
- [ ] Keep all reflection behavior LIVE.
- [ ] Keep existing six 1024 bake packages, pointer files, UI defaults, and accepted seam fixes unchanged.
- [ ] Keep bake capture anti-contamination guards active: Option A snapshot and `uR738C1BakeCaptureMode != 0` early return.
- [ ] Keep current primary-hit runtime short-circuit: `bounces == 0 && r7310C1FullRoomDiffuseShortCircuit(...)`.
- [ ] Keep current atlas lookup math and half-texel inset.
- [ ] Do not return to C fallback.
- [ ] Do not use neighbor-cell sampling.

## Quality Contract

The formal structural package is promoted after smoke validation passes, then accepted after runtime verification passes with the formal pointer in place. The physical inputs stay the same:

- [ ] `diffuseOnly: true`
- [ ] `upscaled: false`
- [ ] `requestedSamples: 1000`
- [ ] `targetAtlasResolution: 1024`
- [ ] `bakedRadianceKind: full_diffuse_radiance`
- [ ] `directLightAlreadyIncluded: true`
- [ ] No extra direct light after bake lookup
- [ ] `C_BEAM = [1.0, 0.984, 0.949]`
- [ ] structural `boxIdx <= 31` auto material stays `roughness: 0.9`, `metalness: 0.0`
- [ ] Floor roughness and all live reflection uniforms stay untouched

Formal pointer pending contract:

- [ ] Through Step 8, the structural formal pointer may be absent.
- [ ] A missing structural formal pointer is recorded as `structuralPending: true`; runtime health remains clean.
- [ ] Pending structural state reports `structuralPending: true`, `structuralReady: false`, `uniformStructuralMode: 0`, and `structuralError: null`.
- [ ] Pending structural state leaves `waitForR7310C1FullRoomDiffuseRuntimeReady(...)` unblocked.
- [ ] Pending structural state must not hold the wabi-sabi loading UI at less than 100%; the loading denominator is the six accepted packages until the formal structural pointer exists.
- [ ] Pending structural state keeps floor / north / east / west / south / ceiling ready states and uniform modes independent.
- [ ] Pending structural state uses a black seventh slot only after the combined runtime texture has seven slots, so the first six slot offsets stay correct.
- [ ] After Step 9 creates the formal structural pointer, pending state must become false and formal runtime verification must require `structuralReady: true`, `uniformStructuralMode: 1`, and seven UI buttons default-on.

Any candidate that changes albedo, roughness, light strength, bounce count, material class, reflection route, atlas resolution, sample target, or accepted wall/floor sampling rules is outside this plan.

## Current Inventory

Current source geometry in `js/Home_Studio.js`:

| sceneBox index | label | bounds | material | type | cullable |
| --- | --- | --- | --- | --- | --- |
| 28 | west wall beam | `[-1.91, 2.525, -1.874]` to `[-1.75, 2.905, 3.056]` | `C_BEAM` | `DIFF` | `1` |
| 29 | east wall beam | `[1.85, 2.515, -1.874]` to `[MAX_X, 2.905, 3.056]` | `C_BEAM` | `DIFF` | `1` |
| 30 | southwest corner column | `[-1.91, 0.0, 2.848]` to `[-1.75, 2.905, 3.056]` | `C_BEAM` | `DIFF` | `3` |
| 31 | southeast corner column | `[1.78, 0.0, 2.49]` to `[1.91, 2.905, 3.056]` | `C_BEAM` | `DIFF` | `3` |

Important ownership facts:

- [ ] Shader object id cannot separate these from walls, ceiling, and floor because structural boxes with index `0..31` collapse to object id `1`.
- [ ] Runtime predicates must use tight world bounds plus normal direction.
- [ ] Contact faces against wall, ceiling, or south plane remain owned by the already accepted wall / ceiling packages or stay hidden.
- [ ] New structural runtime branch must match only exposed faces listed below.

## Proposed Atlas And Runtime Ownership

Packaging decision:

- [ ] Formal output is one combined structural package for all beam and column islands.
- [ ] The package contains the west wall beam, east wall beam, southwest corner column, and southeast corner column together.
- [ ] Runtime adds one atlas slot and one UI toggle: `c1_structural_beams_columns` / `樑柱烘焙`.
- [ ] Implementation and validation still inspect the geometry face by face:
  - west beam exposed faces
  - east beam exposed faces
  - southwest corner column exposed faces
  - southeast corner column exposed faces
- [ ] Each exposed ownership region maps to exactly one packed atlas island.
- [ ] A coplanar or adjacent strip may share an existing island only when the geometry gate records that single owner explicitly.
- [ ] Smoke bake must prove every island has valid nonzero radiance before formal 1024 / 1000spp bake.
- [ ] The formal 1024 / 1000spp bake runs once for the combined package after all islands pass smoke validation.
- [ ] Runtime pointer is updated only after the formal 1024 / 1000spp package exists.
- [ ] Smoke packages are capture-validation artifacts only and must not be wired into the formal runtime pointer.

One new package:

```json
{
  "targetId": 1007,
  "surfaceName": "c1_structural_beams_columns",
  "runtimeScope": "c1_structural_beams_columns_diffuse_short_circuit",
  "packageDir": "assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp",
  "artifacts": {
    "atlasPatch0": "atlas-patch-000-rgba-f32.bin",
    "texelMetadata0": "texel-metadata-000-rgba-f32.bin",
    "validationReport": "validation-report.json"
  }
}
```

Runtime atlas slot:

| slot | surface |
| --- | --- |
| 0 | floor |
| 1 | north wall |
| 2 | east wall |
| 3 | west wall |
| 4 | south wall and window reveal |
| 5 | ceiling |
| 6 | structural beams and columns |

Source-gated island registry starter for `targetId: 1007`:

Geometry verification gate before implementation:

- [ ] Gate input comes from source-box AABB overlap plus face-normal room-side tests.
- [ ] Gate output must be reproducible from a Node command and must not rely on visual judgment.
- [ ] Every checked face must emit:
  - `name`
  - `candidateFace`
  - `normal`
  - `method`
  - `decision`
  - `ownerIsland`
  - `occludingFace`
  - `excludedInterval`
- [ ] Verify the southeast column upper inner strip before locking the island table:
  - candidate face: `x=1.78, y=2.515..2.905, z=2.49..3.056`, normal `-X`
  - if visible, extend or add the matching `se_column_inner_x` island so this strip is baked
  - if hidden, record the exact occluding face in `excludedContactFaces` and keep the runtime predicate from matching it
- [ ] Verify the east beam / southeast column overlap region:
  - candidate beam overlap: `x=1.85, y=2.515..2.905, z=2.49..3.056`, normal `-X`
  - candidate underside overlap: `y=2.515, x=1.85..1.91, z=2.49..3.056`, normal `-Y`
  - assign visible pixels to exactly one island and record hidden/contact areas in `excludedContactFaces`
- [ ] Verify the southeast column upper north strip next to the east beam:
  - candidate column strip: `z=2.49, x=1.78..1.85, y=2.515..2.905`, normal `-Z`
  - assign the visible strip to the continuous `se_column_north_z` island, not to a separate patch
  - record the east-beam-hidden upper-right interval inside `excludedContactFaces`
- [ ] Verify the west beam / southwest column overlap region:
  - candidate beam underside overlap: `y=2.525, x=-1.91..-1.75, z=2.848..3.056`, normal `-Y`
  - candidate column upper north face: `z=2.848, x=-1.91..-1.75, y=2.525..2.905`, normal `-Z`
  - candidate coplanar inner strip: `x=-1.75, y=2.525..2.905, z=2.848..3.056`, normal `+X`
  - assign visible pixels to exactly one island and record hidden/contact areas in `excludedContactFaces`

| island | atlas rect | world face | normal | axes |
| --- | --- | --- | --- | --- |
| `west_beam_inner_x` | `[0.000, 0.000]..[0.500, 0.170]` | `x=-1.75, y=2.525..2.905, z=-1.874..3.056` | `+X` | `u=z, v=y` |
| `west_beam_under_y` | `[0.000, 0.180]..[0.500, 0.260]` | `y=2.525, x=-1.91..-1.75, z=-1.874..2.848` | `-Y` | `u=z, v=x` |
| `east_beam_inner_x` | `[0.000, 0.270]..[0.500, 0.440]` | `x=1.85, y=2.515..2.905, z=-1.874..2.49` | `-X` | `u=z, v=y` |
| `east_beam_under_y` | `[0.000, 0.450]..[0.500, 0.530]` | `y=2.515, x=1.85..1.91, z=-1.874..2.49` | `-Y` | `u=z, v=x` |
| `sw_column_inner_x` | `[0.520, 0.000]..[0.740, 0.360]` | `x=-1.75, y=0.0..2.525, z=2.848..3.056` | `+X` | `u=z, v=y` |
| `sw_column_north_z` | `[0.760, 0.000]..[0.940, 0.360]` | `z=2.848, x=-1.91..-1.75, y=0.0..2.525` | `-Z` | `u=x, v=y` |
| `se_column_inner_x` | `[0.520, 0.380]..[0.740, 0.760]` | `x=1.78, y=0.0..2.905, z=2.49..3.056` | `-X` | `u=z, v=y` |
| `se_column_north_z` | `[0.760, 0.380]..[0.940, 0.880]` | `z=2.49, x=1.78..1.91, y=0.0..2.905` | `-Z` | `u=x, v=y` |

Contact and hidden faces excluded from this package:

- [ ] beam and column top faces at `y=2.905`
- [ ] beam and column wall-contact faces at `x=-1.91` or `x=1.91`
- [ ] beam and column south-contact faces at `z=3.056`
- [ ] beam north end faces at `z=-1.874`
- [ ] floor-contact faces at `y=0.0`
- [ ] east beam underside wall-overlap interval `y=2.515, x=1.91..MAX_X, z=-1.874..3.056`
- [ ] east beam / southeast column overlap intervals:
  - `x=1.85, y=2.515..2.905, z=2.49..3.056`
  - `y=2.515, x=1.85..1.91, z=2.49..3.056`
- [ ] west beam / southwest column overlap intervals:
  - `y=2.525, x=-1.91..-1.75, z=2.848..3.056`
  - `z=2.848, x=-1.91..-1.75, y=2.525..2.905`
- [ ] any southeast column / east beam overlap faces proven hidden by the geometry verification gate
- [ ] any southwest column / west beam overlap faces proven hidden by the geometry verification gate

## Implementation Steps

### 2026-05-18 East-Wall Same-View Guard-Texel Addendum

- [x] User supplied an exact same-view `cameraState` for the east-beam shadow stepping on the east wall.
- [x] User supplied a same-view baked-OFF reference, so the east-wall fix was judged against the exact camera instead of a scripted angle.
- [x] The east-wall issue was traced to two interacting causes:
  - zero guard texels next to the southeast `z=2.49` / `y=2.515` contact.
  - too-wide or too-narrow runtime reconstruction around that guard.
- [x] The previous rect-clamp route is superseded.
- [x] East wall formal 1024px / 1000spp package now fills the southeast guard region from adjacent visible east-wall texels via `fillR7310C1EastWallSoutheastGuardTexels(...)`.
- [x] East wall slot 2 now uses full-rect chart-aware Tent3 reconstruction:

```glsl
r7310C1FullRoomDiffuseSampleRectTent3(atlasUv, 2.0, r7310C1EastWallAtlasRect())
```

- [x] The east-wall rect is now full atlas rect again:

```glsl
vec4(0.0, 0.0, 1.0, 1.0)
```

- [x] Guard luma proof after formal rebake:

```text
y=2.460 z=2.500 luma=0.3374
y=2.540 z=2.420 luma=0.1588
```

- [x] Same-view screenshot evidence:

```text
.omc/r7-3-10-east-wall-shadow-visual/20260518-003331/east-wall-shadow-same-view.png
.omc/r7-3-10-east-wall-shadow-visual/20260518-003331/east-wall-shadow-all-bakes-off-reference.png
```

- [ ] The southeast flat-column air-conditioner shadow remains a separate same-pose target after the east-wall fix is user-checked.

### 0. Geometry Gate Before Contract

- [ ] Inspect `js/Home_Studio.js:114-117` and confirm the current source boxes still match the inventory above.
- [ ] Add `docs/tools/r7-3-10-structural-geometry-gate.mjs`.
- [ ] The geometry gate tool must use source-box AABB overlap plus face-normal room-side tests:
  - load the four structural boxes from `js/Home_Studio.js:114-117`
  - load the accepted static shell blockers from `sceneBoxes` indexes `0..27`, including floor, ceiling, north, east, west, south, and south reveal owner planes
  - include the east wall box from `js/Home_Studio.js:103`, bounds `[1.91, 0.0, -1.874]..[MAX_X, 2.905, 3.056]`, for east beam wall-overlap checks
  - include the west wall boxes from `js/Home_Studio.js:111-113`, bounds ending at `x=-1.91`, for west beam wall-overlap checks
  - include the south wall boxes from `js/Home_Studio.js:105-110`, bounds beginning at `z=3.056`, for south-contact checks
  - include the ceiling boxes from `js/Home_Studio.js:89-95`, bounds beginning at `y=2.905`, for top-contact checks
  - use exact AABB face-rectangle subtraction to compute visible and excluded rectangles
  - use center plus four inset corners only as sanity samples after exact subtraction; sample-only classification is not enough to pass the gate
  - mark a face `hidden` when exact subtraction leaves no visible rectangle
  - mark a face `visible` when exact subtraction leaves one or more room-facing rectangles and no excluded rectangles
  - mark a face `mixed` when exact subtraction leaves both visible and excluded rectangles
  - resolve `mixed` by splitting the face into exact `visibleIntervals` and `excludedIntervals`, then assigning each visible interval to exactly one `ownerIsland`
  - emit `status: "fail"` with `unresolvedMixedFaces` when a mixed face has no exact interval split
  - assign visible samples to exactly one `ownerIsland`
  - record a concrete `occludingFace` string for every hidden face
  - fail if any visible rectangle is claimed by more than one island or by none
- [ ] Run the geometry gate:

```bash
node docs/tools/r7-3-10-structural-geometry-gate.mjs
```

- [ ] Verify southeast column upper inner strip visibility before writing the contract:
  - candidate face: `x=1.78, y=2.515..2.905, z=2.49..3.056`, normal `-X`
  - visible-case decision example; this is accepted only if produced by the geometry gate, and a hidden-case result is valid when exact subtraction proves occlusion:

```json
{
  "name": "se_column_upper_inner_x",
  "candidateFace": "x=1.78, y=2.515..2.905, z=2.49..3.056",
  "normal": "-X",
  "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
  "decision": "visible",
  "ownerIsland": "se_column_inner_x",
  "occludingFace": null,
  "excludedInterval": null,
  "reason": "room-facing strip is visible after east beam overlap check",
  "action": "extend_se_column_inner_x"
}
```

- [ ] If the same candidate face is hidden, record `decision: "hidden"`, `action: "record_exclusion"`, and the exact occluding face in `reason`.
- [ ] Verify east beam / southeast column overlap visibility before writing the contract:
  - candidate beam overlap: `x=1.85, y=2.515..2.905, z=2.49..3.056`, normal `-X`
  - candidate underside overlap: `y=2.515, x=1.85..1.91, z=2.49..3.056`, normal `-Y`
  - assign visible pixels to exactly one island
  - record hidden/contact areas in `excludedContactFaces`
- [ ] Verify west beam / southwest column overlap visibility before writing the contract:
  - candidate beam underside overlap: `y=2.525, x=-1.91..-1.75, z=2.848..3.056`, normal `-Y`
  - candidate column upper north face: `z=2.848, x=-1.91..-1.75, y=2.525..2.905`, normal `-Z`
  - candidate coplanar inner strip: `x=-1.75, y=2.525..2.905, z=2.848..3.056`, normal `+X`
  - assign visible pixels to exactly one island
  - record hidden/contact areas in `excludedContactFaces`
- [ ] Produce a `geometryGateReport` object for the contract and bake report. The JSON below is an example shape; the checked-face decisions must be replaced by the actual gate output:

```json
{
  "status": "pass",
  "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
  "unresolvedMixedFaces": [],
  "checkedFaces": [
    {
      "name": "se_column_upper_inner_x",
      "candidateFace": "x=1.78, y=2.515..2.905, z=2.49..3.056",
      "normal": "-X",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "visible",
      "ownerIsland": "se_column_inner_x",
      "occludingFace": null,
      "excludedInterval": null,
      "visibleIntervals": ["x=1.78, y=2.515..2.905, z=2.49..3.056"],
      "excludedIntervals": []
    },
    {
      "name": "east_beam_under_y_wall_overlap",
      "candidateFace": "y=2.515, x=1.91..MAX_X, z=-1.874..3.056",
      "normal": "-Y",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "hidden",
      "ownerIsland": null,
      "occludingFace": "east_wall_box x=1.91..MAX_X, y=0.0..2.905, z=-1.874..3.056",
      "excludedInterval": "y=2.515, x=1.91..MAX_X, z=-1.874..3.056",
      "visibleIntervals": [],
      "excludedIntervals": ["y=2.515, x=1.91..MAX_X, z=-1.874..3.056"]
    },
    {
      "name": "east_beam_se_column_overlap_x",
      "candidateFace": "x=1.85, y=2.515..2.905, z=2.49..3.056",
      "normal": "-X",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "hidden",
      "ownerIsland": null,
      "occludingFace": "southeast_column x=1.78..1.91, y=0.0..2.905, z=2.49..3.056",
      "excludedInterval": "x=1.85, y=2.515..2.905, z=2.49..3.056",
      "visibleIntervals": [],
      "excludedIntervals": ["x=1.85, y=2.515..2.905, z=2.49..3.056"]
    },
    {
      "name": "east_beam_se_column_overlap_under_y",
      "candidateFace": "y=2.515, x=1.85..1.91, z=2.49..3.056",
      "normal": "-Y",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "hidden",
      "ownerIsland": null,
      "occludingFace": "southeast_column x=1.78..1.91, y=0.0..2.905, z=2.49..3.056",
      "excludedInterval": "y=2.515, x=1.85..1.91, z=2.49..3.056",
      "visibleIntervals": [],
      "excludedIntervals": ["y=2.515, x=1.85..1.91, z=2.49..3.056"]
    },
    {
      "name": "west_beam_sw_column_overlap_under_y",
      "candidateFace": "y=2.525, x=-1.91..-1.75, z=2.848..3.056",
      "normal": "-Y",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "hidden",
      "ownerIsland": null,
      "occludingFace": "southwest_column x=-1.91..-1.75, y=0.0..2.905, z=2.848..3.056",
      "excludedInterval": "y=2.525, x=-1.91..-1.75, z=2.848..3.056",
      "visibleIntervals": [],
      "excludedIntervals": ["y=2.525, x=-1.91..-1.75, z=2.848..3.056"]
    },
    {
      "name": "sw_column_upper_north_z",
      "candidateFace": "z=2.848, x=-1.91..-1.75, y=2.525..2.905",
      "normal": "-Z",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "hidden",
      "ownerIsland": null,
      "occludingFace": "west_beam x=-1.91..-1.75, y=2.525..2.905, z=-1.874..3.056",
      "excludedInterval": "z=2.848, x=-1.91..-1.75, y=2.525..2.905",
      "visibleIntervals": [],
      "excludedIntervals": ["z=2.848, x=-1.91..-1.75, y=2.525..2.905"]
    },
    {
      "name": "sw_column_upper_inner_coplanar_x",
      "candidateFace": "x=-1.75, y=2.525..2.905, z=2.848..3.056",
      "normal": "+X",
      "method": "source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test",
      "decision": "visible",
      "ownerIsland": "west_beam_inner_x",
      "occludingFace": null,
      "excludedInterval": null,
      "visibleIntervals": ["x=-1.75, y=2.525..2.905, z=2.848..3.056"],
      "excludedIntervals": []
    }
  ],
  "finalIslandRegistrySource": "geometry_gate",
  "finalIslandCount": 8,
  "excludedContactFaces": [
    "east_beam_under_y wall-overlap y=2.515, x=1.91..MAX_X, z=-1.874..3.056",
    "east_beam_inner_x southeast-column overlap x=1.85, y=2.515..2.905, z=2.49..3.056",
    "east_beam_under_y southeast-column overlap y=2.515, x=1.85..1.91, z=2.49..3.056",
    "west_beam_under_y southwest-column overlap y=2.525, x=-1.91..-1.75, z=2.848..3.056",
    "sw_column_north_z west-beam overlap z=2.848, x=-1.91..-1.75, y=2.525..2.905"
  ],
  "notes": [
    "Use finalIslandCount 9 only when se_column_upper_inner_x is split into a separate island; default action extends se_column_inner_x",
    "The west/SW coplanar inner strip defaults to west_beam_inner_x ownership unless the exact gate proves a cleaner split"
  ]
}
```

- [ ] Update the final island registry from the gate result:
  - if `se_column_upper_inner_x` is visible, extend `se_column_inner_x` to `y=0.0..2.905` or add a separate island
  - if `sw_column_upper_inner_coplanar_x` is visible, keep it owned by `west_beam_inner_x` or split it into one explicit owner island
  - if any overlap face is visible, assign it to exactly one island
  - if any face is `mixed`, split the face into exact intervals and update both `islands` and `excludedContactFaces`
  - if any `mixed` face remains unsplit, keep `geometryGateReport.status = "fail"` and stop before Step 1
  - if a candidate face is hidden, record its exact occluding face in `excludedContactFaces`

Verification:

```bash
git diff --check
```

Expected result after Step 0: no contract is locked until `geometryGateReport.status` is `pass` and the final island registry is known.

### 1. Contract First

- [ ] Edit `docs/data/r7-3-10-full-room-diffuse-bake-contract.json`.
- [ ] Add `c1StructuralBeamColumnBatch`:
  - `targetId: 1007`
  - `surfaceName: "c1_structural_beams_columns"`
  - `surfaceClass: "structural"`
  - `mapping: "packed_rect_islands"`
  - `runtimeAtlasSlot: 6`
  - `requestedSamples: 1000`
  - `targetAtlasResolution: 1024`
  - `geometryGateReport` from Step 0
  - `islands` matching the final island registry from Step 0
  - `excludedContactFaces` matching the Step 0 gate result
- [ ] Extend `surfaceRolloutStrategy.batches` with `["structural_beams_columns"]` after `["ceiling"]`.
- [ ] Keep existing `c1FloorBatch` through `c1CeilingBatch` byte-for-byte unless the JSON formatter requires stable indentation only.

Verification:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result after Step 1: the JSON contract can be parsed, and existing tests may still pass because structural assertions have not been added yet. Expected result after Step 2: tests fail only on missing implementation symbols, which is the intended red phase.

### 2. Update Contract Test

- [ ] Edit `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js`.
- [ ] Add pointer path constant:
  - `docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json`
- [ ] Add pointer phase assertions:
  - before Step 9, missing structural formal pointer is an allowed pending state
  - before Step 9, contract must not require the pointer to reference a smoke package
  - before Step 9, pending structural state must leave six accepted runtime packages ready
  - before Step 9, pending structural state must report `structuralReady === false`, `structuralPending === true`, `uniformStructuralMode === 0`, and `structuralError === null`
  - after Step 9, the pointer must exist and target the formal `structural-beams-columns-1024px-1000spp` package
  - after Step 9, the pointer must reject any `.omc/` smoke package path
- [ ] Add contract assertions for target id, surface name, slot id, island count, excluded faces, and quality fields.
- [ ] Add contract assertions for `geometryGateReport.status === "pass"` and the final island registry.
- [ ] Add contract assertions that `geometryGateReport.checkedFaces` includes both east/SE and west/SW overlap decisions:
  - `se_column_upper_inner_x`
  - `east_beam_se_column_overlap_x`
  - `east_beam_se_column_overlap_under_y`
  - `west_beam_sw_column_overlap_under_y`
  - `sw_column_upper_north_z`
  - `sw_column_upper_inner_coplanar_x`
- [ ] Add contract assertions that every checked overlap face has deterministic `visibleIntervals` / `excludedIntervals` from exact rectangle subtraction, not sample-only classification.
- [ ] Update `surfaceRolloutStrategy` assertions:
  - `batches.length === 7`
  - `batches[0]` remains `["floor"]`
  - `batches[1]` remains `["walls"]`
  - `batches[2]` remains `["ceiling"]`
  - `batches[3]` is `["structural_beams_columns"]`
  - `batches[4]` is `["large_acoustic_panels", "door", "large_boxes", "large_static_furniture"]`
  - `batches[5]` is `["speaker_diffuse_shells", "speaker_stand_diffuse_components", "fixture_housings", "small_static_surfaces", "edges_and_corners"]`
  - `batches[6]` is `["reflective_surface_diffuse_components"]`
- [ ] Add shader assertions:
  - `uniform float uR7310C1StructuralDiffuseMode;`
  - `patchId == 1007`
  - `r7310C1RuntimeSurfaceIsStructuralBeamColumn`
  - `r7310C1StructuralBeamColumnDiffuseUv`
  - `r7310C1CombinedAtlasUv(atlasUv, 6.0)`
  - primary-hit short-circuit still contains `bounces == 0 &&`
- [ ] Add runtime assertions:
  - package URL constant
  - loader function
  - capture function
  - report function
  - setter function
  - UI button id `btn-r7310-structural-diffuse`
  - runtime patch count set to `7.0` only after the combined texture has seven slots
  - `pathTracingUniforms.uR7310C1StructuralDiffuseMode = { value: 0.0 }`
  - pending structural state reports `structuralPending`
  - pending structural state does not block `updateR7310C1RuntimeLoadingProgress()`
  - runtime config reports `uniformStructuralMode`
- [ ] Add atlas luma summary checks for every final structural island once the formal 1024 package exists.
- [ ] Keep contract tests from requiring the structural pointer to reference a smoke package.

Verification:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result after Step 2 and before implementation: fails on missing code symbols only. A missing formal structural pointer is allowed through Step 8 and becomes a required pass condition in Step 9.

### 3. Add JS Constants, State, Loader, And Combined Atlas Slot

- [ ] Edit `js/InitCommon.js`.
- [ ] Edit `js/Home_Studio.js`.
- [ ] Add constants:
  - `R7310_C1_STRUCTURAL_DIFFUSE_RUNTIME_PACKAGE_URL`
  - `R7310_C1_STRUCTURAL_TARGET_ID = 1007`
  - `R7310_C1_STRUCTURAL_SURFACE_NAME = "c1_structural_beams_columns"`
  - one frozen island registry mirroring the contract
- [ ] Add the path tracing uniform initialization beside the existing R7-3.10 diffuse uniforms:
  - `pathTracingUniforms.uR7310C1StructuralDiffuseMode = { value: 0.0 };`
- [ ] Add runtime state:
  - `r7310C1StructuralDiffuseRuntimeEnabled = true`
  - `r7310C1StructuralDiffuseRuntimePending = true` until the formal structural pointer fetch succeeds
  - `r7310C1StructuralDiffuseRuntimeReady`
  - `r7310C1StructuralDiffuseRuntimeLoadPromise`
  - `r7310C1StructuralDiffuseRuntimePackage`
  - `r7310C1StructuralDiffuseRuntimeTexture`
  - `r7310C1StructuralDiffuseRuntimeError`
- [ ] Extend `updateR7310C1FullRoomDiffuseRuntimeUniforms()`:
  - compute `structuralApplied`
  - include it in aggregate `applied`
  - set `uR7310C1StructuralDiffuseMode`
  - keep `uR7310C1StructuralDiffuseMode.value = 0.0` while `r7310C1StructuralDiffuseRuntimePending === true`
  - set `uR7310C1RuntimeAtlasPatchCount.value = 7.0` after the combined texture includes the structural slot
- [ ] Make `r7310C1RuntimeAtlasResolution()` pending-aware:
  - when `r7310C1StructuralDiffuseRuntimePending === true`, choose the atlas resolution from the accepted six loaded packages only
  - when the structural pointer exists, require `structuralPackage.targetAtlasResolution` to match the selected six-package resolution
  - when structural is pending, create the black structural slot using the selected six-package resolution
  - when structural is pending and the six accepted packages are still loading, keep the existing fallback resolution until one accepted package resolves
- [ ] Change `buildR7310C1CombinedDiffuseRuntimeTexture(...)` from 6 slots to 7 slots:
  - buffer length `resolution * resolution * 28`
  - texture width `resolution * 7`
  - structural slot offset `resolution * 6`
  - pending structural pointer uses a black structural slot and preserves the six accepted slot offsets
- [ ] Add `loadR7310C1StructuralDiffuseRuntimePackage()` using the same metadata checks as the six accepted loaders.
- [ ] Extend `loadR7310C1StructuralDiffuseRuntimePackage()` pending behavior:
  - HTTP 404 for the structural pointer before Step 9 sets `r7310C1StructuralDiffuseRuntimePending = true`
  - HTTP 404 before Step 9 sets `r7310C1StructuralDiffuseRuntimeReady = false`
  - HTTP 404 before Step 9 keeps `r7310C1StructuralDiffuseRuntimeError = null`
  - metadata mismatch after a pointer exists remains a hard error
- [ ] Extend `ensureR7310C1FullRoomDiffuseRuntimeLoading()`, `waitForR7310C1FullRoomDiffuseRuntimeReady()`, and `reportR7310C1FullRoomDiffuseRuntimeConfig()`:
  - pending structural state keeps the wait helper unblocked
  - pending structural state preserves every accepted six-surface ready state
  - report must include `structuralPending`, `structuralReady`, `structuralError`, and `uniformStructuralMode`
  - Step 9+ formal pointer state must require `structuralPending === false`
- [ ] Add `window.setR7310C1StructuralDiffuseRuntimeEnabled(enabled)`.
- [ ] Add loading UI progress key `structural`.
- [ ] Update `updateR7310C1RuntimeLoadingProgress()` so pending structural does not block first paint:
  - before the formal pointer exists, exclude structural from the loading denominator or count it as complete with `pending: true`
  - after the formal pointer exists, structural participates like the other six accepted packages
  - `structuralEnabled: true`, `structuralPending: true`, and `structuralReady: false` must still allow the loading screen to reach `100%`
  - the six accepted surfaces remain the only blocking runtime packages during Step 3 through Step 8

Verification:

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result: syntax passes; contract still fails until shader, UI, and runner symbols exist.

### 4. Add Shader Bake Target, Predicates, UV, And Short-Circuit

- [ ] Edit `shaders/Home_Studio_Fragment.glsl`.
- [ ] Add uniform `uR7310C1StructuralDiffuseMode`.
- [ ] Extend `r7310C1BakeSurfacePoint()` with `patchId == 1007`.
- [ ] Implement a packed-island decode that returns:
  - world position
  - face normal
  - `hitType = 1`
  - `objectID = 0.0`
- [ ] Implement `r7310C1RuntimeSurfaceIsStructuralBeamColumn(...)` with exact face predicates for every exposed face declared by Step 0 and the final island registry.
- [ ] Implement `r7310C1StructuralBeamColumnDiffuseUv(...)` that maps a runtime hit back to the same atlas rect.
- [ ] Implement a structural island resolver used by both runtime UV and probes:
  - returns a stable numeric island id for every declared exposed face
  - returns no match for every `excludedContactFaces` interval
  - proves each runtime hit maps to exactly one island
- [ ] Add a JS-side island id map:
  - `0` means no structural island match
  - positive integer ids map to final island names from the contract
  - shader diagnostics must encode numeric ids only; JS maps ids back to `islandName`
- [ ] Add the structural branch in `r7310C1FullRoomDiffuseShortCircuit(...)` after the accepted wall / ceiling branches.
- [ ] Use `r7310C1CombinedAtlasUv(atlasUv, 6.0)` for the new sample.
- [ ] Extend runtime probe mode for structural verification:
  - structural branch has a distinct diagnostic color from floor / north / east / west / south / ceiling
  - structural probe must use multiple explicit readback passes because one RGB float readback cannot carry island id, atlas UV, and world XYZ at the same time
  - structural probe level `structuralIslandUv` encodes `R = structuralIslandId / 255.0`, `G = atlasUv.x`, `B = atlasUv.y`
  - structural probe level `structuralWorldPosition` encodes raw float `R = worldPosition.x`, `G = worldPosition.y`, `B = worldPosition.z`
  - JS decode combines `structuralIslandUv` and `structuralWorldPosition` by camera case + sample point index
  - JS decode maps positive `structuralIslandId` values back to `islandName`
  - `structuralIslandId === 0` means no structural match and fails any sample point that was declared for a structural island
- [ ] Keep the existing `uR738C1BakeCaptureMode != 0` guard and `visibleIsRayExiting == TRUE` guard.
- [ ] Keep the current primary-hit caller in `CalculateRadiance()`.

Verification:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result: shader symbol assertions pass; test can still fail on JS/UI/runner symbols until later steps land.

### 5. Add Capture Report And Pointer Metadata

- [ ] Edit `js/InitCommon.js`.
- [ ] Add `captureR7310C1StructuralDiffuseAtlas(targetSamples, timeoutMs, options)`.
- [ ] Add `window.captureR7310C1StructuralDiffuseAtlas`.
- [ ] Add `window.reportR7310C1StructuralDiffuseBakeAfterSamples`.
- [ ] Use report fields:
  - `version: "r7-3-10-full-room-diffuse-bake-architecture-probe"`
  - `config: 1`
  - `batch: "structural_beams_columns"`
  - `targetId: 1007`
  - `surfaceName: "c1_structural_beams_columns"`
  - `upscaled: false`
  - `diffuseOnly: true`
  - `worldBounds` as four source box bounds
  - `geometryGateReport` from Step 0
  - `islands` from the registry
  - `islandCoverageByName` with one entry for every final island
  - `islandLumaByName` with one entry for every final island
  - `coverageReport.coveredSurfaceNames: ["c1_structural_beams_columns"]`
  - `coverageReport.missingSurfaceNames: []`
- [ ] Each `islandCoverageByName` entry must include:
  - `validTexels`
  - `totalTexels`
  - `validTexelRatio`
- [ ] Each `islandLumaByName` entry must include:
  - `nonzeroTexels`
  - `meanLuma`
  - `maxLuma`
- [ ] Structural smoke and formal validation must fail if any declared island has:
  - `validTexels <= 0`
  - `nonzeroTexels <= 0`
  - `maxLuma <= 0.01`
- [ ] Update `r7310C1ValidTexelRatioMinimumForSurface(surfaceName)`:
  - `c1_structural_beams_columns` minimum `0.45`
- [ ] Create the pointer file only after the formal 1024 / 1000spp package exists:
  - `docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json`

Verification:

```bash
node --check js/InitCommon.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result: test reaches runner/UI assertions before failing.

### 6. Add UI Toggle

- [ ] Edit `Home_Studio.html`.
- [ ] Add button inside `#r7310-full-floor-actions`:
  - id `btn-r7310-structural-diffuse`
  - class `snapshot-action-btn glow-white`
  - text `樑柱烘焙：開`
- [ ] Edit `js/Home_Studio.js`.
- [ ] Add button lookup in `refreshR7310SurfaceDiffuseButtons(report)`.
- [ ] Add active state from `report.structuralEnabled`.
- [ ] Add title:
  - on: `樑柱漫射使用 R7-3.10 1024 bake，反射仍即時計算`
  - off: `樑柱回到 live path tracing`
- [ ] Add click binding in `bindR7310FullFloorDiffuseControls()` using `setR7310C1StructuralDiffuseRuntimeEnabled`.
- [ ] Keep all seven buttons default-on.
- [ ] Through Step 8, if the formal structural pointer is pending, the structural button may show a pending title but must leave six accepted surface buttons active.
- [ ] After Step 9, the structural button must default to on with `structuralReady: true`.

Verification:

```bash
node --check js/Home_Studio.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result: UI assertions pass; runner assertions may still fail until Step 7.

### 7. Extend Runner

- [ ] Edit `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`.
- [ ] Allow `--r7310-surface=structural-beams-columns`.
- [ ] Map that surface to `reportR7310C1StructuralDiffuseBakeAfterSamples`.
- [ ] Add `--r7310-structural-runtime-test`.
- [ ] Add or extend per-surface runtime flags for all accepted surfaces:
  - `--r7310-runtime-short-circuit-test` for floor
  - `--r7310-north-wall-runtime-test`
  - `--r7310-east-wall-runtime-test`
  - `--r7310-west-wall-runtime-test`
  - `--r7310-south-wall-runtime-test`
  - `--r7310-ceiling-runtime-test`
- [ ] Extend accepted-surface runtime probes for south wall and ceiling:
  - support `southWallCamera: true`
  - support `ceilingCamera: true`
  - use deterministic camera states that put the target surface in primary view
  - enable only the target surface toggle during each surface-specific probe, except when the test explicitly checks all-surface mode
  - include `southWallSurfaceHitCount`
  - include `southWallShortCircuitCount`
  - include `southRevealShortCircuitCount`
  - include `southRevealProbeSamples`
  - include `ceilingSurfaceHitCount`
  - include `ceilingShortCircuitCount`
  - `--r7310-south-wall-runtime-test` fails unless south wall hit and short-circuit counts are both greater than `0`
  - `--r7310-south-wall-runtime-test` also fails unless south reveal has fixed probe samples with finite atlas UV and `southRevealShortCircuitCount > 0`
  - south reveal sample registry must include the accepted reveal ownership regions:
    - `south_reveal_left_x`
    - `south_reveal_right_x`
    - `south_reveal_bottom_y`
    - `south_reveal_top_y`
  - `--r7310-ceiling-runtime-test` fails unless ceiling hit and short-circuit counts are both greater than `0`
  - existing floor / north / east / west runtime pass criteria must stay unchanged
- [ ] Extend UI toggle test:
  - add pending-mode runner flag `--r7310-structural-pending-ok`
  - pending mode requires `btn-r7310-structural-diffuse`
  - pending mode requires `initial.report.structuralEnabled === true`
  - pending mode requires `initial.report.structuralPending === true`
  - pending mode requires `initial.report.structuralReady === false`
  - pending mode requires `initial.report.uniformStructuralMode === 0`
  - pending mode requires `initial.report.structuralError === null`
  - pending mode requires all six accepted surface buttons to stay active
  - formal mode requires `btn-r7310-structural-diffuse`
  - formal mode requires initial text `樑柱烘焙：開`
  - formal mode requires `initial.report.structuralEnabled === true`
  - formal mode requires `initial.report.structuralPending === false`
  - formal mode requires `initial.report.structuralReady === true`
  - formal mode requires `initial.report.uniformStructuralMode === 1`
  - formal mode verifies turning only structural off leaves six existing toggles on
  - formal mode verifies turning all seven off reports all-live path tracing
- [ ] Extend runtime config expectations:
  - `uiMeaningOn` includes structural 1024 baked diffuse plus live reflection
  - `uniformStructuralMode` present
  - `structuralPackageDir`, `structuralTargetId`, and `structuralSurfaceName` present
- [ ] Extend `reportR7310C1FullRoomDiffuseRuntimeProbe(...)` for structural:
  - support `structuralCamera: true`
  - support explicit structural `cameraState` cases
  - include `structuralSurfaceHitCount`
  - include `structuralShortCircuitCount`
  - include `structuralIslandHitByName`
  - include `structuralIslandShortCircuitByName`
  - include `structuralProbeSamples` with `structuralIslandId`, JS-decoded `islandName`, `atlasUv`, and `worldPosition`
  - include `structuralProbePasses` with separate `structuralIslandUv` and `structuralWorldPosition` readbacks
- [ ] Add a structural camera/sample registry derived from the final island registry:
  - registry entry fields: `name`, `targetIsland`, `cameraState`, `samplePoints`, `requiredProbeLevels`
  - `requiredProbeLevels` must include `structuralIslandUv` and `structuralWorldPosition`
  - every final island from Step 0 must have at least one registry entry
  - no registry entry may target an island absent from the final contract
  - aggregate results across all registry entries before deciding pass/fail
  - default starter registry must cover:
    - `west_beam_inner_x`
    - `west_beam_under_y`
    - `east_beam_inner_x`
    - `east_beam_under_y`
    - `sw_column_inner_x`
    - `sw_column_north_z`
    - `se_column_inner_x`
    - `se_column_north_z`
  - if Step 0 adds or splits an island, update this registry before smoke bake
- [ ] The structural runtime test must fail unless every final island from Step 0 has:
  - `structuralIslandHitByName[islandName] > 0`
  - `structuralIslandShortCircuitByName[islandName] > 0`
  - at least one finite `structuralIslandUv` probe sample mapped to that island
  - at least one finite `structuralWorldPosition` probe sample mapped to that island
  - matching camera case + sample point indexes between the two structural probe passes
- [ ] Update validation minimum for `c1_structural_beams_columns` to `0.45`.
- [ ] Extend runner `validatePayload(...)` for `surfaceName === "c1_structural_beams_columns"`:
  - require `report.islands` to list every final island from Step 0
  - require `report.islandCoverageByName` to include every final island
  - require `report.islandLumaByName` to include every final island
  - fail smoke and formal validation when any island has `validTexels <= 0`
  - fail smoke and formal validation when any island has `nonzeroTexels <= 0`
  - fail smoke and formal validation when any island has `maxLuma <= 0.01`
  - include the failing island name in `failedChecks`

Verification:

```bash
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --r7310-structural-pending-ok --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Expected result before the formal package exists: syntax passes; pending-mode UI toggle test passes with structural pending, loading UI complete, and six accepted surfaces active. Expected final result: contract passes after the pointer file targets the formal package.

### 8. Smoke Bake Before Formal 1024 Bake

- [ ] Run a small smoke package first.

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=structural-beams-columns --samples=1 --target-samples=1 --atlas-resolution=64 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal --smoke-test
```

Expected output:

```text
status: pass
package: .omc/r7-3-10-full-room-diffuse-bake/<timestamp>
```

- [ ] Inspect `validation-report.json`:
  - `runnerStatus: "pass"`
  - `bakeContaminationGuardSnapshot` keeps runtime bake disabled during capture
  - `surfaceName: "c1_structural_beams_columns"`
  - `targetId: 1007`
  - `atlasVisibleLuma.nonzeroTexels > 0`
  - `atlasVisibleLuma.maxLuma > 0.01`
- [ ] Inspect `islandCoverageByName` and `islandLumaByName`.
- [ ] Confirm every declared island satisfies:
  - `validTexels > 0`
  - `nonzeroTexels > 0`
  - `maxLuma > 0.01`
- [ ] Keep the structural runtime pointer unchanged after smoke bake.

Verification:

```bash
git diff --check
```

Expected result: smoke package exists under `.omc/`, and no formal pointer has been updated from smoke output.

### 9. Formal 1024 / 1000spp Bake And Pointer Promotion

- [ ] Run formal bake after smoke validation passes.

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=structural-beams-columns --samples=1000 --target-samples=1000 --atlas-resolution=1024 --timeout-ms=360000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Expected output:

```text
status: pass
package: .omc/r7-3-10-full-room-diffuse-bake/<timestamp>
```

- [ ] Promote the package to:

```text
assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp/
```

- [ ] Update:

```text
docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json
```

Expected pointer values:

```json
{
  "packageStatus": "architecture_probe",
  "runtimeScope": "c1_structural_beams_columns_diffuse_short_circuit",
  "targetId": 1007,
  "surfaceName": "c1_structural_beams_columns",
  "requestedSamples": 1000,
  "targetAtlasResolution": 1024,
  "diffuseOnly": true,
  "upscaled": false
}
```

Verification:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected result after Step 9: structural pointer assertions are active and pass against the formal package path. Smoke package paths remain rejected.

### 10. Runtime Smoke With Formal Package

- [ ] Start or reuse the local server at port 9002.

```bash
python3 -m http.server 9002
```

- [ ] Run UI toggle test after the formal structural pointer is in place.

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

- [ ] Run structural runtime test after the formal structural pointer is in place.

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-structural-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Expected output:

```text
status: pass
```

- [ ] Confirm `reportR7310C1FullRoomDiffuseRuntimeConfig()` shows:
  - `structuralEnabled: true`
  - `structuralReady: true`
  - `uniformStructuralMode: 1`
  - `uniformFloorMode` through `uniformCeilingMode` remain `1`
  - `sproutPasteApplied === false`
- [ ] Confirm structural runtime report shows:
  - `structuralSurfaceHitCount > 0`
  - `structuralShortCircuitCount > 0`
  - every final island has `structuralIslandHitByName[islandName] > 0`
  - every final island has `structuralIslandShortCircuitByName[islandName] > 0`
  - every declared island has at least one finite `structuralIslandUv` probe sample
  - every declared island has at least one finite `structuralWorldPosition` probe sample
  - every combined sample has finite `structuralIslandId`, JS-decoded `islandName`, `atlasUv`, and `worldPosition`
  - all structural probe samples are aggregated from the final structural camera/sample registry

### 11. Final Verification

- [ ] Syntax checks:

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check docs/tools/r7-3-10-structural-geometry-gate.mjs
```

- [ ] Geometry gate:

```bash
node docs/tools/r7-3-10-structural-geometry-gate.mjs
```

Expected output:

```text
status: pass
```

- [ ] Confirm geometry gate output:
  - `geometryGateReport.status === "pass"`
  - every `checkedFaces` entry includes `decision`, `ownerIsland`, `occludingFace`, and `excludedInterval`
  - `geometryGateReport` matches `docs/data/r7-3-10-full-room-diffuse-bake-contract.json`
  - formal structural `validation-report.json` contains the same `geometryGateReport`

- [ ] Contract:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected output:

```text
R7-3.10 full-room diffuse bake architecture contract passed
```

- [ ] UI toggle:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

- [ ] Runtime all-surface short-circuit:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

- [ ] Existing accepted surface runtime regressions:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-north-wall-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-west-wall-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-wall-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ceiling-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

- [ ] South reveal regression details:
  - the south wall runtime report includes `southRevealShortCircuitCount > 0`
  - `southRevealProbeSamples` includes finite samples for `south_reveal_left_x`, `south_reveal_right_x`, `south_reveal_bottom_y`, and `south_reveal_top_y`
  - each reveal sample reports finite `atlasUv` and confirms the south-wall slot `4`
  - the reveal-specific checks run without changing the accepted south bake package or south wall predicates

- [ ] Structural runtime:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-structural-runtime-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

- [ ] Diff hygiene:

```bash
git diff --check
```

Expected final conditions:

- [ ] seven UI buttons default to on
- [ ] existing six package pointers still target their accepted 1024 assets
- [ ] structural pointer targets the formal 1024 asset
- [ ] runtime atlas patch count is `7.0`
- [ ] all seven slot modes report `1` when default-on
- [ ] each structural island reports hit and short-circuit counts greater than `0`
- [ ] south wall and ceiling runtime regression reports each show hit and short-circuit counts greater than `0`
- [ ] south reveal regression reports `southRevealShortCircuitCount > 0` and finite samples for all four reveal regions
- [ ] turning structural off returns only structural faces to LIVE path tracing
- [ ] turning all seven off reports all-live path tracing
- [ ] bake contamination guard snapshot stays clean
- [ ] reflection remains LIVE

### 12. Documentation Sync

- [ ] Update `docs/SOP/Debug_Log.md` with:
  - branch name
  - package path
  - target id `1007`
  - atlas resolution and samples
  - validation commands and pass/fail status
  - note that six existing packages were left intact
- [ ] Update `docs/SOP/Debug_Log_Index.md` route with one line pointing to the new Debug Log section.
- [ ] Update this plan with completion notes only after formal bake and runtime verification pass.

## Review Checkpoints

- [ ] Checkpoint A: approve target inventory and atlas island ownership before implementation.
- [ ] Checkpoint B: approve smoke bake report before formal 1024 bake.
- [ ] Checkpoint C: user visual check after formal 1024 runtime is available at `http://localhost:9002/Home_Studio.html`.

## Known Risks And Guards

- [ ] Structural object id is shared with walls and ceiling. Guard: every runtime predicate must include normal direction plus tight world coordinate ranges.
- [ ] Some contact faces already sit on accepted wall / ceiling planes. Guard: exclude contact faces from target `1007`.
- [ ] West beam and southwest column overlap just like the east / southeast side. Guard: exact rectangle subtraction must prove hidden underside and north-face intervals before contract lock.
- [ ] Packed atlas has unused black area. Guard: structural valid-texel threshold is surface-specific, and runtime UV only samples declared islands.
- [ ] Column cullable mode differs from wall cullable mode. Guard: preserve `visibleIsRayExiting` early return and test structural runtime from visible room-facing camera points.
- [ ] Loading now fetches one more package. Guard: pending structural pointer must not block the loading UI; only the formal pointer state joins the blocking denominator.
- [ ] Whole-package structural short-circuit can hide per-island misses. Guard: runtime test must verify hit and short-circuit counts for every final island, not just the combined structural package.

## Completion Notes

```yaml
date: 2026-05-17
branch: codex/r7-3-10-beam-column-bake-expansion
status: formal_bake_and_runtime_verified
formal_asset:
  path: assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp/
  atlas: atlas-patch-000-rgba-f32.bin
  metadata: texel-metadata-patch-000-f32.bin
  targetId: 1007
  surfaceName: c1_structural_beams_columns
  atlasResolution: 1024
  samples: 1000
  finalIslandCount: 8
runtime_pointer:
  path: docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json
  runtimeScope: c1_structural_beams_columns_diffuse_short_circuit
  runtimeAtlasSlot: 6
  runtimeAtlasPatchCount: 7.0
  structuralPending: false
visual_fix_2026_05_17:
  user_report: east_beam_and_southeast_flat_column_contact_had_a_small_unbaked_patch
  root_cause: southeast_column_upper_north_z_strip_was_visible_but_absent_from_the_structural_island_registry
  first_fix_issue: separate_patch_baked_but_had_visible_color_difference_against_the_same_column_face
  final_fix: redefine_se_column_north_z_as_one_continuous_southeast_column_north_face
  worldFace: "z=2.49, x=1.78..1.91, y=0..2.905"
  atlasRect: "[0.760,0.380]..[0.940,0.880]"
  excludedInterval: "z=2.49, x=1.85..1.91, y=2.515..2.905"
  package_rerun: structural_beams_columns_only
  existing_six_1024_packages_changed: false
contact_padding_fix_2026_05_17:
  user_report: close_range_thin_dark_line_at_southeast_column_east_beam_east_wall_meet
  root_cause: se_column_north_z_east_beam_overlap_texels_baked_black_inside_the_continuous_island
  same_family_as_previous_wardrobe_seam: true
  superseded_by: shadow_preserving_contact_refinement_2026_05_17
  before_luma:
    visible_left_cut_x_1_849_y_2_70: 0.25197866321504114
    contact_right_top_x_1_851_y_2_70: 0
    contact_deep_right_top_x_1_88_y_2_70: 0
    beam_bottom_contact_x_1_88_y_2_515: 0
  first_fix_issue: broad_overlap_padding_brightened_deep_hidden_texels_and_created_a_short_rectangular_shadow_artifact
  first_fix: same_face_bake_source_contact_padding_for_entire_se_column_north_z_overlap_quadrant
  padding_region: "z=2.49, x>=1.85, y>=2.515"
  atlas_island_count: 8
  separate_patch_added: false
  existing_six_1024_packages_changed: false
east_wall_contact_edge_fix_2026_05_17:
  user_report: beam_column_contact_normal_but_southeast_column_to_east_wall_still_has_clear_dark_line
  root_cause: east_wall_z_2_49_contact_column_baked_black_next_to_southeast_column
  superseded_by: shadow_preserving_contact_refinement_2026_05_17
  before_luma:
    east_wall_visible_side_z_2_485_y_1_5: 0.6003693103253841
    east_wall_contact_edge_z_2_49_y_1_5: 0
    east_wall_hidden_behind_column_z_2_50_y_1_5: 0
  first_fix_issue: full_one_texel_inward_source_could_truncate_the_soft_beam_shadow_near_the_wall_contact
  first_fix: same_face_bake_source_contact_padding_for_east_wall_southeast_column_edge
  padding_region: "x=1.91, z around 2.49, y<2.515"
  runtime_uv_changed: false
  formal_east_wall_package_updated: true
shadow_preserving_contact_refinement_2026_05_17:
  user_report: black_lines_were_gone_but_east_beam_shadow_became_short_rectangular_or_truncated
  root_cause:
    - structural_contact_padding_used_the_whole_atlas_texel_width_and_covered_the_deep_hidden_overlap_quadrant
    - east_wall_contact_padding_used_a_full_texel_inward_source_on_the_visible_contact_edge
  final_fix:
    - structural_se_column_north_z_uses_rect_scaled_two_texel_contact_band_only
    - structural_contact_source_moves_to_the_visible_same_face_centroid_by_0_25_rect_texel
    - east_wall_z_2_49_contact_source_moves_to_the_visible_side_by_0_25_wall_texel
    - deep_hidden_structural_overlap_and_deeper_east_wall_column_backside_remain_black
  runtime_uv_changed: false
  neighbor_sampling_changed: false
  reflection_route: live
  rebaked_packages:
    structural: assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp/
    east_wall: assets/bakes/r7-3-10/c1-static-diffuse/east-wall-1024px-1000spp/
  structural_after_luma:
    contact_x_1_851_y_2_7: 0.23926041246652602
    beam_bottom_x_1_88_y_2_515: 0.2170319620579481
    deep_hidden_x_1_88_y_2_7: 0
    visible_below_x_1_88_y_2_50: 0.33503713339567187
  east_wall_after_luma:
    visible_z_2_485_y_1_5: 0.6060901952207087
    contact_z_2_49_y_1_5: 0.621544977748394
    hidden_z_2_50_y_1_5: 0
  artifact_hashes:
    structural_atlasPatch0Sha256: 95ab0051942bc986b89a2ede1c7de46fe30a976d2221933422c329b09989b37d
    structural_texelMetadataPatch0Sha256: 227d5685f8a25ebaf7ddd544c88b7b2e1c8e814f29a9eac49aa2f7b32f4df535
    east_wall_atlasPatch0Sha256: e73f7721db0bd99d8f97d898e84af02980da4d15d269158d4566f9d956dd470f
    east_wall_texelMetadataPatch0Sha256: 05ffa99d58cbd3e677f124bbb4baf3c1e5c66d24a0e0a0b80f8c889cabe4448b
validation_passed:
  - node --check docs/tools/r7-3-10-structural-geometry-gate.mjs
  - node --check js/InitCommon.js
  - node --check js/Home_Studio.js
  - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  - node docs/tests/r7-3-10-structural-geometry-gate.test.js
  - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=structural-beams-columns --atlas-resolution=1024 --samples=1000 --target-samples=1000 --timeout-ms=3600000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-structural-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-north-wall-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-west-wall-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-wall-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ceiling-runtime-test --timeout-ms=120000
  - git diff --check
contact_padding_validation_passed:
  - node --check js/InitCommon.js
  - node --check js/Home_Studio.js
  - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  - node docs/tests/r7-3-10-structural-geometry-gate.test.js
  - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  - git diff --check
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=structural-beams-columns --atlas-resolution=1024 --samples=1000 --target-samples=1000 --timeout-ms=3600000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-structural-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --timeout-ms=120000
east_wall_contact_edge_validation_passed:
  - node --check js/InitCommon.js
  - node --check js/Home_Studio.js
  - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  - node docs/tests/r7-3-10-structural-geometry-gate.test.js
  - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  - git diff --check
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=east-wall --atlas-resolution=1024 --samples=1000 --target-samples=1000 --timeout-ms=3600000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000
shadow_preserving_contact_refinement_validation_passed:
  - node --check js/InitCommon.js
  - node --check js/Home_Studio.js
  - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  - node docs/tests/r7-3-10-structural-geometry-gate.test.js
  - git diff --check
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=structural-beams-columns --atlas-resolution=1024 --samples=1000 --target-samples=1000 --timeout-ms=3600000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=east-wall --atlas-resolution=1024 --samples=1000 --target-samples=1000 --timeout-ms=3600000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-structural-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-runtime-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=120000
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --timeout-ms=120000
confirmed:
  - existing_floor_north_east_west_south_ceiling_pointers_left_intact: true
  - reflection_route: live
  - fallback_route_added: false
  - neighbor_sampling_changed: false
  - bake_contamination_guard_snapshot_all_runtime_modes_zero: true
```

```yaml
date: 2026-05-18
branch: codex/r7-3-10-beam-column-bake-expansion
status: same_view_root_cause_candidate_not_user_accepted_yet
user_no_go:
  - The user rejected the previous `r7310-east-wall-guard-texel-v2` result at a closer same-view camera.
  - The previous final screenshot compared different-looking views and should not have been called fixed.
  - Acceptance is now explicitly same-camera A/B: east wall + structural bake ON must closely match all bake OFF at about 100 SPP.
  - A continuous diagonal shadow is required. Stair-like shadow bands are failure.
camera:
  cameraState:
    position: { x: 1.786518, y: 2.426144, z: 2.375295 }
    yaw: -2.5156
    pitch: 0.613
    fov: 55
    forward: { x: 0.479224, y: 0.575324, z: 0.662832 }
  viewport:
    innerWidth: 1458
    innerHeight: 741
    canvasCssWidth: 1318
    canvasCssHeight: 741
    drawingBufferWidth: 1280
    drawingBufferHeight: 720
    devicePixelRatio: 3.5
    aspect: 1.777778
wrong_lessons:
  - Runner `status: pass` only proves the helper completed. It is not visual acceptance.
  - The earlier structural linear reconstruction helper used scripted camera angles and missed the user's close-range view.
  - The earlier east-wall guard-texel fix solved a measured zero-texel edge but did not isolate the latest stair source.
  - Re-baking structural without changing geometry ownership still left the reported artifact.
  - `validation-report.json` can contain `status: pass` while `reprojectionStatus: fail` and `reprojectionComparisons: 0`; that is a validation hole.
four_way_isolation:
  package: .omc/r7-3-10-east-wall-shadow-visual/20260518-010549
  finding:
    - Turning structural bake off was closest to the all-bake-off reference.
    - Turning east wall bake off while structural stayed on still retained the stair artifact family.
  conclusion: The latest same-view stair source is structural slot 6, not east wall slot 2.
root_cause:
  - `se_column_inner_x` treated the whole `x=1.78, y=0..2.905, z=2.49..3.056` face as bake/runtime-valid.
  - The southeast bookshelf touches the same plane at `x=1.78, y=0..2.04, z=2.73..3.056`.
  - That overlap is hidden by furniture and must not be valid structural surface.
  - Before the fix, about 40 percent of `se_column_inner_x` texels were black zero texels inside this hidden overlap.
  - Runtime reconstruction near the visible edge could pull those zero texels into the close-view shadow, creating stair-like dark bands.
fix_candidate:
  - Add the southeast bookshelf as a contact blocker in `docs/tools/r7-3-10-structural-geometry-gate.mjs`.
  - Mark the bookshelf overlap as an excluded contact interval for `se_column_inner_x`.
  - Reject that overlap in shader bake capture via `r7310C1StructuralSeColumnInnerHiddenByBookshelf(...)`.
  - Reject that overlap in runtime island matching via the same world-space test.
  - Guard-fill the hidden structural texels from the adjacent visible side after structural bake capture, so interpolation near the visible edge no longer sees black.
asset_after_candidate:
  package: assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp
  structural_se_column_inner_x_zero_ratio_before: approximately 0.4045
  structural_se_column_inner_x_zero_ratio_after: approximately 0.0008
same_view_evidence:
  package: .omc/r7-3-10-east-wall-shadow-visual/20260518-014555
  baked_on: .omc/r7-3-10-east-wall-shadow-visual/20260518-014555/east-wall-shadow-same-view.png
  baked_off_reference: .omc/r7-3-10-east-wall-shadow-visual/20260518-014555/east-wall-shadow-all-bakes-off-reference.png
  crop_montage: .omc/r7-3-10-east-wall-shadow-visual/20260518-014555/crop-montage-on-ref-structuralOff.png
  diff_summary: .omc/r7-3-10-east-wall-shadow-visual/20260518-014555/crop-diff-summary.json
  forwardDelta: { x: 0, y: 0, z: 0 }
  targetSamplesReached: 109
  crop_diff_on_vs_reference:
    meanDiff: 1.2142
    p95: 3.0
    p99: 6.6667
validation_rerun:
  - node docs/tests/r7-3-10-structural-geometry-gate.test.js
  - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  - node --check js/InitCommon.js
  - node --check js/Home_Studio.js
  - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=structural-beams-columns --samples=1000 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9323 --angle=metal
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-shadow-visual-test --target-samples=100 --timeout-ms=180000 --http-port=9002 --cdp-port=9323 --angle=metal --camera-state-json='<user cameraState>'
remaining_gate:
  - Do not call this accepted until the same-view baked ON image is checked against the user's visual criterion.
  - Future reports must include the exact cameraState and the ON/OFF evidence path.
```

```yaml
date: 2026-05-18
branch: codex/r7-3-10-beam-column-bake-expansion
status: same_view_structural_linear_sampling_candidate_self_checked
trigger:
  - User provided a closer red-box screenshot and rejected the previous candidate.
  - The reported region is the east beam / southeast flat-column junction, away from the southeast bookshelf.
  - Acceptance remains fixed-camera baked ON vs all-bakes-OFF: the diagonal shadow must stay continuous, without stair bands.
camera:
  cameraState:
    position: { x: 1.76428, y: 2.443067, z: 2.334591 }
    yaw: -2.4136
    pitch: 0.418
    fov: 55
    forward: { x: 0.608086, y: 0.405933, z: 0.682239 }
  viewport:
    innerWidth: 1458
    innerHeight: 741
    canvasCssWidth: 1318
    canvasCssHeight: 741
    drawingBufferWidth: 1280
    drawingBufferHeight: 720
    devicePixelRatio: 3.5
wrong_lessons:
  - The previous southeast-bookshelf explanation was a wrong candidate for this red-box report.
  - Runtime probe at the red-box coordinates hit structural island 4 `east_beam_under_y` and island 8 `se_column_north_z`.
  - Furniture is not part of this reported region.
  - The guard-fill + 6px Tent runtime sampling candidate removed the black-texel stair family but washed out the narrow beam shadow.
root_cause_candidate:
  - The structural atlas needs guard-filled hidden contact texels so runtime filtering does not sample invalid black.
  - The east-beam / southeast-column red-box shadow is very narrow in screen space.
  - Structural slot 6 used a 6px Tent filter after guard-fill; that filter averaged across the narrow contact shadow and made baked ON too bright.
fix_candidate:
  - Keep `se_column_north_z` east-beam hidden-overlap guard padding.
  - Keep runtime sampling inside each structural island's atlas rect.
  - Change structural runtime lookup from 6px Tent to rect-local linear sampling.
  - Keep east wall slot 2 Tent3 unchanged; the new change is structural-only.
probe_evidence:
  runtime_probe_package: .omc/r7-3-10-full-room-diffuse-runtime/20260518-053523
  probe_points:
    - redbox_left_shadow: island 4 `east_beam_under_y`, world { x: 1.894001, y: 2.515000, z: 2.463309 }
    - redbox_center_shadow: island 8 `se_column_north_z`, world { x: 1.880080, y: 2.511737, z: 2.490000 }
    - redbox_dark_core: island 8 `se_column_north_z`, world { x: 1.898336, y: 2.498230, z: 2.490000 }
failed_visual_before_linear_sampling:
  package: .omc/r7-3-10-east-wall-shadow-visual/20260518-051510
  finding: baked ON was visibly brighter in the red-box contact shadow than structural OFF / all-bakes-OFF.
self_checked_visual_after_linear_sampling:
  package: .omc/r7-3-10-east-wall-shadow-visual/20260518-054136
  baked_on_crop: .omc/r7-3-10-east-wall-shadow-visual/20260518-054136/redbox-on.png
  structural_off_crop: .omc/r7-3-10-east-wall-shadow-visual/20260518-054136/redbox-structural-off.png
  all_bakes_off_crop: .omc/r7-3-10-east-wall-shadow-visual/20260518-054136/redbox-all-off.png
  diff_redbox_on_vs_all_bakes_off:
    mean_rgb_diff_8bit: [1.2665, 1.2973, 1.2475]
    rms_rgb_diff_8bit: [2.2122, 2.2755, 2.2044]
    max_channel_diff_8bit: 25
validation:
  - node docs/tests/r7-3-10-structural-sampling-guard.test.js
  - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  - node docs/tests/r7-3-10-structural-geometry-gate.test.js
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-probe-sample-test --timeout-ms=180000 --http-port=9029 --cdp-port=9340 --angle=metal --camera-state-json='<user cameraState>'
  - node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-shadow-visual-test --target-samples=1000 --timeout-ms=240000 --http-port=9030 --cdp-port=9341 --angle=metal --camera-state-json='<user cameraState>'
acceptance_note:
  - This entry is self-checked evidence, not user acceptance.
  - Keep the exact camera and crop paths attached to any handoff.
```
