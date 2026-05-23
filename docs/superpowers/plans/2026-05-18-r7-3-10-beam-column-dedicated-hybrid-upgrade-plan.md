# R7-3.10 Beam Column Dedicated Hybrid Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the remaining east/west beam and southwest-column visible structural faces from the old combined structural bake to dedicated indirect-diffuse bake surfaces with live direct lighting.

**Architecture:** Keep the already accepted wall routes unchanged. Add five dedicated 1024px / 1000spp indirect-diffuse runtime slots after slot 12, one slot per visible face. Runtime first-hit adds the dedicated baked indirect diffuse, then live path tracing keeps the direct light, direct shadow edge, and reflection.

**Tech Stack:** HTML / JavaScript / WebGL2 path tracing, `shaders/Home_Studio_Fragment.glsl`, `js/InitCommon.js`, `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`, Node contract tests.

---

## Target Scope

Do not change these accepted routes:

```text
c1_east_wall
c1_east_wall_beam_shadow
c1_west_wall
c1_west_wall_beam_shadow
c1_se_column_north_shadow
c1_se_column_west_shadow
c1_sw_column_north_shadow
c1_south_wall_ac_shadow
```

Add these five dedicated targets:

```text
1014 / slot 13 / c1_sw_column_inner_shadow
  world face: x=-1.75, y=0..2.525, z=2.848..3.056, normal +X
  old island: sw_column_inner_x

1015 / slot 14 / c1_west_beam_inner_shadow
  world face: x=-1.75, y=2.525..2.905, z=-1.874..3.056, normal +X
  old island: west_beam_inner_x

1016 / slot 15 / c1_west_beam_under_shadow
  world face: y=2.525, x=-1.91..-1.75, z=-1.874..2.848, normal -Y
  old island: west_beam_under_y

1017 / slot 16 / c1_east_beam_inner_shadow
  world face: x=1.85, y=2.515..2.905, z=-1.874..2.49, normal -X
  old island: east_beam_inner_x

1018 / slot 17 / c1_east_beam_under_shadow
  world face: y=2.515, x=1.85..1.91, z=-1.874..2.49, normal -Y
  old island: east_beam_under_y
```

Runtime atlas patch count becomes `18.0`.

## Files

```text
Modify:
  Home_Studio.html
  js/Home_Studio.js
  js/InitCommon.js
  shaders/Home_Studio_Fragment.glsl
  docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  docs/data/r7-3-10-full-room-diffuse-bake-contract.json
  docs/SOP/Debug_Log.md
  docs/SOP/Debug_Log_Index.md

Create:
  docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js
  docs/data/r7-3-10-c1-sw-column-inner-shadow-runtime-package.json
  docs/data/r7-3-10-c1-west-beam-inner-shadow-runtime-package.json
  docs/data/r7-3-10-c1-west-beam-under-shadow-runtime-package.json
  docs/data/r7-3-10-c1-east-beam-inner-shadow-runtime-package.json
  docs/data/r7-3-10-c1-east-beam-under-shadow-runtime-package.json

Generate:
  assets/bakes/r7-3-10/c1-static-diffuse/sw-column-inner-shadow-1024px-1000spp/
  assets/bakes/r7-3-10/c1-static-diffuse/west-beam-inner-shadow-1024px-1000spp/
  assets/bakes/r7-3-10/c1-static-diffuse/west-beam-under-shadow-1024px-1000spp/
  assets/bakes/r7-3-10/c1-static-diffuse/east-beam-inner-shadow-1024px-1000spp/
  assets/bakes/r7-3-10/c1-static-diffuse/east-beam-under-shadow-1024px-1000spp/
```

### Task 1: Contract Test

**Files:**
- Create: `docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js`

- [x] **Step 1: Write the failing test**

The test must assert:

```text
InitCommon constants:
  targetId 1014..1018
  surface names
  runtime package URLs
  runtime atlas patch count 18.0

Shader:
  five sampler uniforms
  five mode/ready/resolution uniforms
  five runtime surface predicates
  five diffuse UV helpers
  five sample-valid-linear helpers
  five hybrid active/radiance helpers
  five indirect bake first-hit helpers
  patchId 1014..1018 in r7310C1BakeSurfacePoint
  five hybrid first-hit booleans in main path
  five guards in the old full-diffuse skip condition

Contract JSON:
  targetId, surfaceName, runtimeAtlasSlot, bakedRadianceKind
  directLightAlreadyIncluded=false
  addDirectLightAfterBakeLookup=true
```

- [x] **Step 2: Run test to verify it fails**

```bash
node docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js
```

Expected: fail before implementation because targetId 1014 is missing.

### Task 2: Runtime Constants And Packages

**Files:**
- Modify: `js/InitCommon.js`
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`
- Modify: `docs/data/r7-3-10-full-room-diffuse-bake-contract.json`

- [x] **Step 1: Add constants and state**

Add target IDs, surface names, package URLs, runtime enabled/pending/ready/error state, loaders, report fields, setters, and UI meaning strings for the five new surfaces.

- [x] **Step 2: Expand combined atlas**

Change the combined runtime atlas from 13 to 18 slots and copy the five new Float32Array surfaces into slots 13..17.

- [x] **Step 3: Add runner surface names**

Add accepted `--r7310-surface` values:

```text
sw-column-inner-shadow
west-beam-inner-shadow
west-beam-under-shadow
east-beam-inner-shadow
east-beam-under-shadow
```

Map them to the five new report functions and package folders.

### Task 3: Shader Dedicated Surface Support

**Files:**
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `js/Home_Studio.js`
- Modify: `Home_Studio.html`

- [x] **Step 1: Add uniforms**

Add the five sampler uniforms and mode/ready/resolution uniforms.

- [x] **Step 2: Add bake-time world mapping**

Add `patchId == 1014..1018` inside `r7310C1BakeSurfacePoint` using the exact world faces listed in Target Scope.

- [x] **Step 3: Add runtime surface predicates**

Add five `r7310C1RuntimeSurfaceIs...` functions using the same bounds as the bake-time mapping.

- [x] **Step 4: Add UV and sampling helpers**

Add five `DiffuseUv`, `Texel`, `SampleValidLinear`, `HybridActive`, `HybridRadiance`, and `IndirectBakeFirstHit` helpers. Slot numbers must be 13..17.

- [x] **Step 5: Update main path guards**

Add five first-hit booleans. Add them to:

```text
the hybrid radiance accumulation block
the old full-diffuse short-circuit skip condition
the direct-light continuation guard
the indirect-bake first-hit bounce handoff
```

- [x] **Step 6: Bump cache token**

Use:

```text
r7310-beam-column-dedicated-hybrid-v1
```

### Task 4: Re-bake Five Surfaces

**Files:**
- Generate package folders under `assets/bakes/r7-3-10/c1-static-diffuse/`

- [x] **Step 1: Bake southwest-column inner face**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=sw-column-inner-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

- [x] **Step 2: Bake west beam inner face**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-beam-inner-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

- [x] **Step 3: Bake west beam under face**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-beam-under-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

- [x] **Step 4: Bake east beam inner face**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=east-beam-inner-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

- [x] **Step 5: Bake east beam under face**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=east-beam-under-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

### Task 5: Verification

**Files:**
- Modify: `docs/SOP/Debug_Log.md`
- Modify: `docs/SOP/Debug_Log_Index.md`

- [x] **Step 1: Run contract tests**

```bash
node docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js
node docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
node docs/tests/r7-3-10-east-wall-beam-shadow.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tests/r7-3-10-structural-sampling-guard.test.js
node docs/tests/r7-3-10-structural-geometry-gate.test.js
```

- [x] **Step 2: Run syntax and diff checks**

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
git diff --check
```

- [x] **Step 3: Run runtime helper**

Run the runtime short-circuit helper after all packages are loaded. User visual verdict remains the final visual check.

- [x] **Step 4: Update logs**

Record:

```text
new target IDs
new runtime slots
new package folders
test commands
visual helper paths
cache token
```

## Self-Review

Spec coverage:

```text
East wall and west wall stay unchanged.
All remaining listed beam/column faces are included.
Each new surface has a dedicated slot and indirect-diffuse-only contract.
Direct shadow and reflection remain live.
```

Placeholder scan:

```text
No TBD items.
All target IDs, slots, world faces, file paths, commands, and package names are explicit.
```

Type consistency:

```text
Surface names use c1_*_shadow convention.
CLI names use kebab-case.
Runtime slots are consecutive 13..17.
Patch IDs are consecutive 1014..1018.
```

## Execution Summary

```text
Implemented on 2026-05-18.

Formal rebake result:
  sw-column-inner-shadow / targetId 1014 / slot 13 / samples 1000 / pass / dirtyModes 0
  west-beam-inner-shadow / targetId 1015 / slot 14 / samples 1000 / pass / dirtyModes 0
  west-beam-under-shadow / targetId 1016 / slot 15 / samples 1000 / pass / dirtyModes 0
  east-beam-inner-shadow / targetId 1017 / slot 16 / samples 1000 / pass / dirtyModes 0
  east-beam-under-shadow / targetId 1018 / slot 17 / samples 1000 / pass / dirtyModes 0

Verification:
  node docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  node docs/tests/r7-3-10-east-wall-beam-shadow.test.js
  node docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
  node docs/tests/r7-3-10-se-column-west-shadow.test.js
  node docs/tests/r7-3-10-se-column-north-shadow.test.js
  node docs/tests/r7-3-10-south-wall-ac-shadow.test.js
  node docs/tests/r7-3-10-structural-geometry-gate.test.js
  node docs/tests/r7-3-10-structural-sampling-guard.test.js
  node --check js/InitCommon.js
  node --check js/Home_Studio.js
  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  git diff --check
  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=240000 --angle=metal
```

## 2026-05-18 Runtime Atlas Failure Fix

```text
User report:
  After the 18-slot dedicated hybrid upgrade, opening the scene with all bake toggles on made large parts of the room render black.

Root cause:
  Runtime atlas slot count was raised from 13 to 18 while the combined texture still used one horizontal strip.
  With 1024px patches this produced 18432 x 1024.
  Common WebGL MAX_TEXTURE_SIZE is 16384, so the atlas could fail on the browser side and every baked surface sampling that atlas could collapse to black.

Fix:
  Keep all 18 1024px slots.
  Pack the combined runtime atlas as a 6 x 3 grid.
  Effective atlas size becomes 6144 x 3072.
  Add uR7310C1RuntimeAtlasGridColumns = 6.0 and update shader sampling to compute column / row per slot.

Guard:
  docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js now rejects the old one-row DataTexture layout.
  docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js now checks the grid sampling contract.

Verification after fix:
  node docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  node docs/tests/r7-3-10-east-wall-beam-shadow.test.js
  node docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
  node docs/tests/r7-3-10-structural-geometry-gate.test.js
  node docs/tests/r7-3-10-structural-sampling-guard.test.js
  node --check js/InitCommon.js
  node --check js/Home_Studio.js
  git diff --check
  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=240000 --angle=metal

Cache token:
  r7310-beam-column-atlas-grid-v1
```
