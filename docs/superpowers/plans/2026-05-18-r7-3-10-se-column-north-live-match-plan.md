# R7-3.10 SE Column North Live Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated high-resolution static diffuse bake path for the southeast column north face so the east-beam shadow can be judged against the live path from the same camera view.

**Architecture:** Keep the accepted room surfaces and the existing structural package intact. Add one dedicated southeast-column north-face target, pointer, shader lookup, and same-view visual helper. Acceptance compares only live path tracing against the new dedicated bake path. Runtime data now rides in combined atlas slot 7, raising the atlas to 8 slots, because activating one more sampler caused black path-tracing output during the floor smoke test.

**Tech Stack:** Three.js, WebGL2 GLSL, existing R7-3.10 direct surface texel bake runner, Node.js contract tests.

---

## File Structure

```text
1.  docs/tests/r7-3-10-se-column-north-shadow.test.js
    Locks the new contract:
    - targetId 1008 exists.
    - the dedicated surface owns targetId 1008 and runtime atlas slot 7.
    - runtime lookup happens before the broad structural lookup.
    - visual helper emits only live reference and new bake output.

2.  js/InitCommon.js
    Owns constants, package pointer, runtime loader, texture creation, bake metadata, and report fields.

3.  shaders/Home_Studio_Fragment.glsl
    Owns the dedicated southeast-column north-face UV, valid-data-aware sampling, and short-circuit priority.

4.  docs/tools/r7-3-8-c1-bake-capture-runner.mjs
    Owns the same-view live/new-bake capture helper and the dedicated bake surface name.

5.  docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json
    Points runtime to the accepted dedicated bake package.

6.  assets/bakes/r7-3-10/c1-static-diffuse/se-column-north-shadow-1024px-1000spp/
    Holds the first accepted dedicated bake package.

7.  .omc/r7-3-10-se-column-north-shadow-live-match/20260518-124711/
    Holds the same-view live reference and new bake screenshots:
    - live-reference.png
    - se-column-north-shadow-bake.png
    - visual-report.json
```

## Task 1: Contract Test

**Files:**
- Create: `docs/tests/r7-3-10-se-column-north-shadow.test.js`

- [x] **Step 1: Write failing contract test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID\s*=\s*1008/);
assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME\s*=\s*'c1_se_column_north_shadow'/);
assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1SeColumnNorthShadowRuntimePackage/);
assert.match(initCommon, /tR7310C1SeColumnNorthShadowTexture/);

assert.match(shader, /uniform sampler2D tR7310C1SeColumnNorthShadowTexture/);
assert.match(shader, /uniform float uR7310C1SeColumnNorthShadowMode/);
assert.match(shader, /uniform float uR7310C1SeColumnNorthShadowResolution/);
assert.match(shader, /bool r7310C1SeColumnNorthShadowDiffuseUv/);
assert.match(shader, /r7310C1SeColumnNorthShadowSampleValidLinear/);

const shortCircuitStart = shader.indexOf('bool r7310C1FullRoomDiffuseShortCircuit');
const dedicatedLookup = shader.indexOf('uR7310C1SeColumnNorthShadowMode', shortCircuitStart);
const structuralLookup = shader.indexOf('uR7310C1StructuralDiffuseMode', shortCircuitStart);
assert.ok(dedicatedLookup > shortCircuitStart);
assert.ok(structuralLookup > shortCircuitStart);
assert.ok(dedicatedLookup < structuralLookup);

assert.match(runner, /--r7310-se-column-north-shadow-visual-test/);
assert.match(runner, /live-reference\.png/);
assert.match(runner, /se-column-north-shadow-bake\.png/);
assert.doesNotMatch(runner, /old-structural-bake-reference\.png/);

assert.equal(contract.c1SeColumnNorthShadowBatch.targetId, 1008);
assert.equal(contract.c1SeColumnNorthShadowBatch.surfaceName, 'c1_se_column_north_shadow');
assert.equal(contract.c1SeColumnNorthShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');

console.log('R7-3.10 southeast column north shadow contract passed');
```

- [x] **Step 2: Run failure**

Run:

```bash
node docs/tests/r7-3-10-se-column-north-shadow.test.js
```

Expected: failure because the dedicated target, shader uniforms, runner helper, and contract entry do not exist yet.

## Task 2: Dedicated Runtime And Bake Target

**Files:**
- Modify: `js/InitCommon.js`
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `js/Home_Studio.js`
- Create: `docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json`

- [x] **Step 1: Add constants and runtime state**

Add target id `1008`, surface name `c1_se_column_north_shadow`, world face `z=2.49, x=1.78..1.91, y=0..2.905`, and a pointer URL.

- [x] **Step 2: Add bake surface mapping**

`r7310C1BakeSurfacePoint()` handles patch id `1008` as one continuous rectangular surface. Metadata marks visible texels and keeps alpha as the valid-data flag.

- [x] **Step 3: Add runtime texture**

The first implementation loaded the package into `tR7310C1SeColumnNorthShadowTexture`, then the renderer turned black even for a 1 spp floor smoke test. The accepted implementation keeps the uniform name as a contract alias, stores the data in `tR7310C1FullRoomDiffuseAtlasTexture` slot `7`, and sets `uR7310C1RuntimeAtlasPatchCount` to `8.0`.

- [x] **Step 4: Add shader lookup**

When the visible hit is the southeast column north face, sample the dedicated texture first. Use valid-data-aware bilinear sampling so invalid alpha texels do not pollute the result.

## Task 3: Same-View Live Versus New Bake Helper

**Files:**
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`

- [x] **Step 1: Add CLI flag**

Add `--r7310-se-column-north-shadow-visual-test`.

- [x] **Step 2: Output only two screenshots**

The helper writes:

```text
live-reference.png
se-column-north-shadow-bake.png
visual-report.json
```

It does not output old structural bake images.

## Task 4: Bake Package

**Files:**
- Create: `assets/bakes/r7-3-10/c1-static-diffuse/se-column-north-shadow-1024px-1000spp/`
- Modify: `docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json`

- [x] **Step 1: Generate first dedicated package**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=se-column-north-shadow --samples=1000 --target-samples=1000 --atlas-resolution=1024 --timeout-ms=3600000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Actual accepted run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=se-column-north-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

Result package:

```text
assets/bakes/r7-3-10/c1-static-diffuse/se-column-north-shadow-1024px-1000spp
```

- [x] **Step 2: Run same-view helper**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-se-column-north-shadow-visual-test --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```

Expected output package contains only the live reference and the new dedicated bake screenshot.

Actual accepted run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-se-column-north-shadow-visual-test --target-samples=1000 --timeout-ms=900000 --angle=metal
```

Result package:

```text
.omc/r7-3-10-se-column-north-shadow-live-match/20260518-124711
```

## Task 5: Verification And Documentation

**Files:**
- Modify: `docs/SOP/Debug_Log.md`
- Modify: `docs/SOP/Debug_Log_Index.md`

- [x] **Step 1: Run checks**

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check docs/tools/r7-3-10-atlas-seam-audit.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tests/r7-3-10-structural-sampling-guard.test.js
node docs/tests/r7-3-10-se-column-north-shadow.test.js
node docs/tools/r7-3-10-atlas-seam-audit.mjs
git diff --check
```

Actual result:

```text
node --check js/InitCommon.js                                                pass
node --check js/Home_Studio.js                                                pass
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs                    pass
node --check docs/tools/r7-3-10-atlas-seam-audit.mjs                         pass
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js              pass
node docs/tests/r7-3-10-structural-sampling-guard.test.js                    pass
node docs/tests/r7-3-10-se-column-north-shadow.test.js                       pass
node docs/tools/r7-3-10-atlas-seam-audit.mjs                                 pass
git diff --check                                                             pass
```

- [x] **Step 2: Record result**

Document that the failed old structural route is no longer the acceptance target. The acceptance target is live path tracing versus the new southeast column north-face bake from the same camera.

## 2026-05-18 Hybrid Pivot

User visual feedback after the first dedicated full-diffuse package:

```text
The old dedicated package still showed a visible stair-step diagonal, so it is superseded.
The current target for this face is baked indirect diffuse plus live direct shadow.
```

Implemented change:

```text
TargetId 1008 now stores `indirect_diffuse_radiance`.
Runtime first hit on `c1_se_column_north_shadow` adds that baked indirect term.
The direct light and diagonal direct shadow stay on the live path-traced route.
```

New accepted run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=se-column-north-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-se-column-north-shadow-visual-test --target-samples=1000 --timeout-ms=900000 --angle=metal
```

New same-view package:

```text
.omc/r7-3-10-se-column-north-shadow-live-match/20260518-134435
```

## 2026-05-18 East Wall Beam Shadow Extension

User asked to continue from the accepted south-wall AC shadow result to the east wall where the east beam casts a visible diagonal shadow.

Implemented change:

```text
TargetId 1011 stores `indirect_diffuse_radiance` for `c1_east_wall_beam_shadow`.
Runtime slot 10 reads that indirect term on first visible hit.
The direct light, east-beam diagonal shadow, and reflections stay on the live path-traced route.
At this east-wall step the combined runtime atlas had 11 slots; the later west-beam mirror extension raises the current count to 13 slots.
```

New bake package:

```text
assets/bakes/r7-3-10/c1-static-diffuse/east-wall-beam-shadow-1024px-1000spp
```

New same-view package using the user-provided east-facing camera:

```text
.omc/r7-3-10-east-wall-beam-shadow-live-match/20260518-173350
```

Verification run:

```bash
node docs/tests/r7-3-10-east-wall-beam-shadow.test.js
node docs/tests/r7-3-10-south-wall-ac-shadow.test.js
node docs/tests/r7-3-10-se-column-west-shadow.test.js
node docs/tests/r7-3-10-se-column-north-shadow.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=east-wall-beam-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-beam-shadow-visual-test --target-samples=1 --timeout-ms=180000 --angle=metal --camera-state-json='{"position":{"x":1.752762,"y":2.439962,"z":2.328648},"yaw":-2.3416,"pitch":0.292,"fov":53,"forward":{"x":0.686986,"y":0.287868,"z":0.66722}}'
```

Current pointer semantics:

```text
bakedRadianceKind: indirect_diffuse_radiance
directLightAlreadyIncluded: false
addDirectLightAfterBakeLookup: true
```

## 2026-05-18 East Wall Beam Shadow Seam Guard Fix

User follow-up:

```text
The east wall east-beam shadow is OK, but a new black vertical line appears at the east wall / southeast flat-column contact.
```

User camera:

```text
cameraState={"position":{"x":1.82148,"y":2.422026,"z":2.379761},"yaw":-1.906,"pitch":0.635,"fov":55,"forward":{"x":0.760264,"y":0.593178,"z":0.264838}}
view={"facing":"東(+X)","config":1,"samples":167,"paused":true,"sppCap":1000}
```

Root cause:

```text
The first east-wall beam hybrid helper matched the whole east wall.
That let slot 10 own the physical z=2.49 contact between the east wall and southeast column.
With all bakes enabled, the contact showed as a black vertical line.
```

Implemented fix:

```text
Add R7310_C1_EAST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX = 2.475.
Require visiblePosition.z < 2.475 for the east-wall beam hybrid receiver.
Record the same seamGuard contract in the full-room diffuse contract and the east-wall-beam runtime package.
Bump cache token to r7310-east-wall-beam-seam-guard-v1.
```

Before / after evidence:

```text
before_guard_package: .omc/r7-3-10-east-wall-shadow-visual/20260518-175430
after_guard_package_64_samples: .omc/r7-3-10-east-wall-shadow-visual/20260518-180124
after_guard_package_167_samples: .omc/r7-3-10-east-wall-shadow-visual/20260518-180308
after_guard_screenshot: .omc/r7-3-10-east-wall-shadow-visual/20260518-180308/east-wall-shadow-same-view.png
```

Verification:

```bash
node docs/tests/r7-3-10-east-wall-beam-shadow.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-east-wall-shadow-visual-test --target-samples=167 --timeout-ms=300000 --angle=metal --camera-state-json='{"position":{"x":1.82148,"y":2.422026,"z":2.379761},"yaw":-1.906,"pitch":0.635,"fov":55,"forward":{"x":0.760264,"y":0.593178,"z":0.264838}}'
```

## 2026-05-18 User Acceptance Closeout

User acceptance camera:

```text
cameraState={"position":{"x":1.862444,"y":2.493635,"z":2.45656},"yaw":-2.7244,"pitch":0.447,"fov":55,"forward":{"x":0.365384,"y":0.432262,"z":0.824405}}
forward={"x":0.365384,"y":0.432262,"z":0.824405}
view={"facing":"南(+Z)","config":1,"samples":1,"paused":true,"sppCap":1000}
viewport={"innerWidth":727,"innerHeight":741,"canvasCssWidth":727,"canvasCssHeight":409,"drawingBufferWidth":1280,"drawingBufferHeight":720,"devicePixelRatio":3.5,"aspect":1.777778}
```

User verdict:

```text
The hybrid route succeeded.
Even at extreme close-up, the southeast column north-face shadow stays smooth and no longer shows stair-step artifacts.
The cost is slightly dirtier 1SPP output, and that tradeoff is accepted.
```

Carry-forward rule:

```text
For visible stair-step direct-shadow artifacts on baked static diffuse surfaces, do not force the direct shadow into the bake.
Use baked indirect diffuse for the affected face.
Keep direct light, the visible shadow edge, and reflection on the live path-traced route.
```

## 2026-05-18 West Face Extension

User request:

```text
Apply the same successful hybrid architecture to the southeast column west face.
```

Implemented change:

```text
TargetId 1009 owns `c1_se_column_west_shadow`.
The bake stores `indirect_diffuse_radiance`.
Runtime atlas slot 8 stores the west-face package.
Runtime first hit on the west face adds baked indirect diffuse.
Direct light, the visible direct-shadow edge, and reflection stay live path traced.
The southeast bookshelf overlap is invalidated in the west-face bake metadata.
The broad structural slot 6 is guarded so west-face first hits do not double-apply structural baked diffuse.
```

New accepted-by-runner bake:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=se-column-west-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

Result package:

```text
assets/bakes/r7-3-10/c1-static-diffuse/se-column-west-shadow-1024px-1000spp
```

Runtime pointer:

```text
docs/data/r7-3-10-c1-se-column-west-shadow-runtime-package.json
```

Pointer semantics:

```text
bakedRadianceKind: indirect_diffuse_radiance
directLightAlreadyIncluded: false
addDirectLightAfterBakeLookup: true
runtimeAtlasSlot: 8
validTexelRatio: 0.5954418182373047
```

Same-view helper:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-se-column-west-shadow-visual-test --target-samples=1 --timeout-ms=180000 --angle=metal
```

Same-view package:

```text
.omc/r7-3-10-se-column-west-shadow-live-match/20260518-155345
```

Current status:

```text
Tool validation passed.
User reported the west face succeeded.
```

## 2026-05-18 South Wall AC Shadow Extension

User request:

```text
After confirming the southeast column west face succeeded, apply the same hybrid architecture to the AC shadow on the south wall.
```

Implemented change:

```text
TargetId 1010 owns `c1_south_wall_ac_shadow`.
The bake stores `indirect_diffuse_radiance`.
Runtime atlas slot 9 stores the south-wall AC-shadow package.
Runtime first hit on the south wall main face adds baked indirect diffuse.
Direct light, the visible direct-shadow edge, and reflection stay live path traced.
The south window hole is invalidated in the bake metadata.
The full south-wall slot 4 is bypassed for this first-hit hybrid path.
```

New accepted-by-runner bake:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=south-wall-ac-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

Result package:

```text
assets/bakes/r7-3-10/c1-static-diffuse/south-wall-ac-shadow-1024px-1000spp
```

Runtime pointer:

```text
docs/data/r7-3-10-c1-south-wall-ac-shadow-runtime-package.json
```

Pointer semantics:

```text
bakedRadianceKind: indirect_diffuse_radiance
directLightAlreadyIncluded: false
addDirectLightAfterBakeLookup: true
runtimeAtlasSlot: 9
validTexelRatio: 0.6290740966796875
```

Same-view helper:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-wall-ac-shadow-visual-test --target-samples=1 --timeout-ms=180000 --angle=metal
```

Same-view package:

```text
.omc/r7-3-10-south-wall-ac-shadow-live-match/20260518-164308
```

Current status:

```text
Tool validation passed.
The south-wall AC-shadow screenshot is self-checked only.
Wait for user visual acceptance before marking it accepted.
```

## 2026-05-18 West Beam Mirror Extension

User request:

```text
East wall beam shadow is OK.
Apply the same architecture to the southwest column and west wall, both carrying the west beam shadow.
```

Implemented change:

```text
TargetId 1012 owns `c1_sw_column_north_shadow`.
TargetId 1013 owns `c1_west_wall_beam_shadow`.
The bake stores `indirect_diffuse_radiance`.
Runtime atlas slot 11 stores the southwest-column north-face package.
Runtime atlas slot 12 stores the west-wall beam-shadow package.
The runtime atlas patch count is now 13.0.
Runtime first hit on either west-side target adds baked indirect diffuse.
Direct light, the visible direct-shadow edge, and reflection stay live path traced.
The west wall package invalidates the iron-door hole.
The west wall beam-shadow path has a seam guard near the southwest-column contact.
```

New accepted-by-runner bakes:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=sw-column-north-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-wall-beam-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

Result packages:

```text
assets/bakes/r7-3-10/c1-static-diffuse/sw-column-north-shadow-1024px-1000spp
assets/bakes/r7-3-10/c1-static-diffuse/west-wall-beam-shadow-1024px-1000spp
```

Runtime pointers:

```text
docs/data/r7-3-10-c1-sw-column-north-shadow-runtime-package.json
docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json
```

Pointer semantics:

```text
sw column:
  bakedRadianceKind: indirect_diffuse_radiance
  directLightAlreadyIncluded: false
  addDirectLightAfterBakeLookup: true
  runtimeAtlasSlot: 11
  validTexelRatio: 1

west wall:
  bakedRadianceKind: indirect_diffuse_radiance
  directLightAlreadyIncluded: false
  addDirectLightAfterBakeLookup: true
  runtimeAtlasSlot: 12
  validTexelRatio: 0.8787927627563477
  validTexelRatioMinimum: 0.80
```

Same-view helpers:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-sw-column-north-shadow-visual-test --target-samples=1 --timeout-ms=180000 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-west-wall-beam-shadow-visual-test --target-samples=1 --timeout-ms=180000 --angle=metal
```

Same-view packages:

```text
.omc/r7-3-10-sw-column-north-shadow-live-match/20260518-190721
.omc/r7-3-10-west-wall-beam-shadow-live-match/20260518-190911
```

Current status:

```text
Tool validation passed.
The west-side screenshots are self-checked only.
Wait for user visual acceptance before marking them accepted.
```

## 2026-05-18 West Beam Bake-Point Fix

User correction:

```text
The southwest-column north face and west wall were showing the same wrong compressed picture.
The failure was a bad bake capture source, not a brightness issue.
```

Root cause:

```text
The west-side metadata, runtime slot, and packages existed.
The shader bake-time surface mapper still ended at patchId 1011.
patchId 1012 and 1013 were missing from `r7310C1BakeSurfacePoint`.
The bake therefore did not sample each west-side target from its own world plane.
```

Fix:

```text
patchId 1012 now maps to the southwest-column north Z plane:
  position = vec3(x, y, 2.848)
  normal = vec3(0.0, 0.0, -1.0)

patchId 1013 now maps to the west-wall X plane:
  position = vec3(-1.91, y, z)
  normal = vec3(1.0, 0.0, 0.0)
```

Re-baked after fix:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=sw-column-north-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-wall-beam-shadow --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
```

Regression guard:

```text
docs/tests/r7-3-10-west-beam-shadow-mirror.test.js now asserts that patchId 1012 and 1013 have explicit bake-time world-plane mappings.
Cache token: r7310-west-beam-mirror-bake-point-v3.
```
