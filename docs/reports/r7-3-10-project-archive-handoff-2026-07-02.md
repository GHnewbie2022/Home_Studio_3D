# Home Studio 3D R7-3.10 Project Archive Handoff

Date: 2026-07-02

Status: archived by user decision. Codex subscription quota ended, project is paused instead of spending more money on iterative bake debugging.

## Plain Summary

The project reached a useful but unfinished state.

The room shell XATLAS migration is mostly in place for the major walls, ceiling, H2 south window top reveal, and the floor runtime route. The loading UI progress problem is fixed enough for the last checked URL. The iron door FIX7 LIVE reflection should be kept as the trusted visual reference.

The floor FULL BAKE is still visually wrong. The latest user screenshots show that the floor bake can be turned on, and the floor reflection appears, but the floor color and lighting do not match the expected LIVE look. This means the technical wiring smoke passed, while the actual visual acceptance failed.

Do not treat the current floor v5 as accepted.

## Latest User-Rejected Floor View

URL opened by user:

```text
http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-floor-full-bake-live-reflection-v5
```

Camera:

```json
{
  "position": { "x": -1.448249, "y": 1.728181, "z": 2.5895 },
  "yaw": -0.5296,
  "pitch": -0.597,
  "fov": 55,
  "forward": { "x": 0.417804, "y": -0.562164, "z": -0.713731 }
}
```

User screenshots:

```text
/var/folders/7p/hcmrsx8515s9v7h3g545ynn80000gn/T/codex-clipboard-f3eee630-3f7a-4300-b7bd-f918e6328444.png
/var/folders/7p/hcmrsx8515s9v7h3g545ynn80000gn/T/codex-clipboard-4e66889e-73ce-4b31-8ec5-d990a91004de.png
```

Observed from screenshots:

```text
1. 地板烘焙：關
   Floor returns to the noisy LIVE path at 1 SPP.

2. 地板烘焙：開
   Floor becomes smooth and has some reflection, but the floor color and light distribution look wrong.
   The bake is visually rejected.

3. Loading UI
   User reported the progress bar is now OK.
```

## Current Ground Truth References

Iron door trusted reference:

```text
http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7
```

Floor latest rejected candidate:

```text
http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-floor-full-bake-live-reflection-v5
```

## What Is Currently Working

```text
1. Loading progress UI
   The previous 5% stall / odd progress behavior was addressed by throttling page download progress updates.
   Important code area:
   js/InitCommon.js
   function fetchR7310C1XatlasRawLightmapPageAtlasBufferWithProgress

2. Runtime page loading direction
   atlasMaster=raw now avoids putting the floor into the already large wall sheet.
   Current report language says:
   lightmapStorageKind = wall_sheet_plus_floor_page_texture

   This means the floor is a separate runtime page texture.
   The wall pages are still effectively grouped through a shared sheet route.

3. Floor toggle wiring
   The last technical smoke confirmed:
   floor bake on  -> uniformFullFloor = 1
   floor bake off -> uniformFullFloor = 0

4. Floor reflection route
   The current intention is:
   floor diffuse/color = FULL BAKE candidate
   floor reflection = LIVE path

5. Iron door
   Keep FIX7 LIVE reflection as the stable accepted state.
   Do not promote the retired runtime planar half-finished attempts without a fresh architecture review.
```

## What Is Still Broken

```text
1. Floor FULL BAKE visual quality
   Main unresolved issue.
   It is technically connected, but visually wrong.
   The current smoke tests do not catch this visual mismatch.

2. Floor color and lighting convention
   Current RAW floor pointer:
   docs/data/r7-3-10-xatlas-full-floor-runtime-package.json

   Current package:
   .omc/r7-3-10-full-room-diffuse-bake/20260701-165401

   Current key fields:
   bakedRadianceKind = full_diffuse_radiance
   directLightAlreadyIncluded = true
   addDirectLightAfterBakeLookup = false
   multiplyAlbedoAfterBakeLookup = false
   liveSpecularReflection = true

   This wiring passes contract checks, but the visual result is rejected.

3. Floor OIDN pointer is stale
   docs/data/r7-3-10-xatlas-full-floor-oidn-runtime-package.json still points to:
   .omc/r7-3-10-full-room-diffuse-bake/20260618-083832

   It still describes indirect_diffuse_radiance and addDirectLightAfterBakeLookup=true.
   Treat floor OIDN as old and not aligned with the latest RAW floor route.

4. Visual acceptance gate is missing
   The last smoke only proved technical connection:
   page loaded, shader compiled, no 404, no WebGL context lost, floor uniforms changed.

   It did not prove that the floor matches the LIVE reference in color and light.
```

## Last Known Technical Verification

These commands passed in the last active session:

```bash
node docs/tests/r7-3-10-lightmap-pages-contract.test.js
node docs/tests/r7-3-10-floor-full-radiance-runner-contract.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node --check js/InitCommon.js
node --check js/Home_Studio.js
```

Chrome + Metal smoke outputs:

```text
FULL BAKE floor smoke:
/private/tmp/r7310-floor-ui-stream-final-smoke-v5/xatlas-shader-compile-smoke.json
/private/tmp/r7310-floor-ui-stream-final-smoke-v5/xatlas-shader-compile-smoke.png

Floor off / LIVE smoke:
/private/tmp/r7310-floor-ui-stream-live-smoke-v5/xatlas-shader-compile-smoke.json
/private/tmp/r7310-floor-ui-stream-live-smoke-v5/xatlas-shader-compile-smoke.png
```

Important caution:

```text
These smokes are technical sanity checks.
They do not prove the floor looks correct.
The user rejected the floor visually after these smokes.
```

## Current XATLAS Surface Pointer Snapshot

Major current RAW pointers observed on 2026-07-02:

```text
North wall:
docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json
.omc/r7-3-10-xatlas-bake-spike/20260623-101407
full_diffuse_radiance, direct light included

East wall:
docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json
.omc/r7-3-10-xatlas-bake-spike/20260630-191302
full_diffuse_radiance, direct light included

South wall:
docs/data/r7-3-10-xatlas-full-south-wall-1000spp-runtime-package.json
.omc/r7-3-10-xatlas-bake-spike/20260630-160747
full_diffuse_radiance, direct light included

West wall:
docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json
.omc/r7-3-10-xatlas-bake-spike/20260622-133608
full_diffuse_radiance, direct light included

Ceiling:
docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json
.omc/r7-3-10-xatlas-bake-spike/20260701-013637
full_diffuse_radiance, direct light included

H2 south window top reveal:
docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json
.omc/r7-3-10-full-room-diffuse-bake/20260701-151452
full_diffuse_radiance, direct light included

Floor RAW:
docs/data/r7-3-10-xatlas-full-floor-runtime-package.json
.omc/r7-3-10-full-room-diffuse-bake/20260701-165401
full_diffuse_radiance, direct light included, live reflection intended

Floor OIDN:
docs/data/r7-3-10-xatlas-full-floor-oidn-runtime-package.json
old package, not aligned with current RAW floor route
```

## Dirty Workspace Warning

The workspace is not clean. Do not assume this archive is committed.

At archive time, `git status --short` showed many modified files, including:

```text
docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-floor-runtime-package.json
docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
docs/tests/r7-3-10-lightmap-pages-contract.test.js
docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs
js/Home_Studio.js
js/InitCommon.js
js/PathTracingCommon.js
shaders/Home_Studio_Fragment.glsl
```

There are also many untracked iron-door diagnostic files and runtime-package files.

Future restart should begin with:

```bash
git status --short
git diff --stat
git diff -- docs/data/r7-3-10-xatlas-full-floor-runtime-package.json js/InitCommon.js shaders/Home_Studio_Fragment.glsl
```

## Things Future AI Should Not Do First

```text
1. Do not claim the floor is fixed because smoke passed.
   The user visually rejected it.

2. Do not rerun a large bake before proving the source of the floor mismatch.
   First compare current floor RAW data, LIVE reference, and floor material convention.

3. Do not delete .omc packages that are referenced by docs/data pointers.

4. Do not revive retired iron-door runtime planar experiments as formal mode.
   Keep FIX7 LIVE as the trusted iron-door reference.

5. Do not solve floor color by random brightness, roughness, blur, denoise, or hidden darkening.
   The issue is source-data and render-convention correctness.
```

## Recommended Restart Plan

```text
1. Freeze current state first
   Either commit/archive the dirty workspace intentionally, or create a clean worktree from the last trusted commit.

2. Add visual gate before more bake work
   Make a small screenshot comparison gate for the exact user floor camera.
   The gate should compare floor-on candidate against a known accepted LIVE reference crop.

3. Diagnose floor source
   Read the floor RAW atlas package 20260701-165401.
   Confirm whether it already includes correct floor albedo and direct light.
   Compare with the 20260701-171454 package because the atlas bytes were previously observed as identical while the manifest albedo fields differed.

4. Diagnose floor owner and exclusion masks
   Check the floor occlusion exclusion list in js/InitCommon.js around R7310_FLOOR_OCCLUSION_EXCLUSIONS.
   Verify desk, speaker stand bases, bed, wall footprints, and column invalidation.
   The current visual issue may come from the bake source or mask convention, not just runtime sampling.

5. Decide route
   If staying in WebGL, fix floor data and runtime convention with a small proof view before a full pass.
   If restarting with more advanced tools, consider rebuilding static-room bake validation in Blender/Cycles/OIDN first, then reconnect to the WebGL runtime only after the bake is visually trusted.
```

## Copy-Paste Handoff Message

```text
Please read this file first:
docs/reports/r7-3-10-project-archive-handoff-2026-07-02.md

Home_Studio_3D R7-3.10 is paused, not complete.

Current accepted reference:
Iron door must keep FIX7 LIVE reflection:
http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7

Current rejected candidate:
http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-floor-full-bake-live-reflection-v5

The loading progress UI is OK.
The floor FULL BAKE is still visually wrong.
Smoke pass only proves technical wiring, not visual correctness.

Before any new bake:
1. Check git status.
2. Add a visual floor acceptance gate for the latest user camera.
3. Diagnose the floor RAW package, albedo convention, and floor occlusion exclusions.
4. Keep floor reflection on LIVE.
5. Do not promote floor v5 as accepted.
```
