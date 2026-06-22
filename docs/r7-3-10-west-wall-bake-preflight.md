# R7-3.10 西牆烘焙 Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:systematic-debugging` before changing code or rebaking. This document is the working plan for the C1 west wall bake pass. Track steps with checkbox syntax and update this file only when the user or CODEX asks for file updates.

**Goal:** Rebuild the C1 west wall quick-preview bake path with the current R7-3.10 architecture, including the iron-door reveal and the long-standing iron-door lower frame / floor color bleed issue.

**Architecture:** Start from repo reality, then treat old west-wall packages as reference-only evidence. The official west-wall pass must use the current architecture and fresh accepted packages. Existing packages can explain history, sample density, and failure modes, but they are not candidates for final acceptance.

**Tech Stack:** `Home_Studio_3D`, WebGL path tracer, R7-3.10 full-room diffuse runner, C1 static diffuse packages, runtime pointer JSON, OIDN bridge, Surface Ownership / Occlusion Exclusion registry.

---

## 0. Scope And Red Lines

This pass covers C1 quick-preview bake only.

```text
1. Scope
   1.1. West wall main surface.
   1.2. Iron-door reveal: top, bottom, north jamb, south jamb.
   1.3. West wall beam / SE column / west beam dedicated shadow packages when they affect visible west-wall seams.
   1.4. Iron-door lower frame / floor color bleed ROI, treated as a formal gate with the user's cameraState as authority.

2. Out of scope
   2.1. C2/C3/C4 baking.
   2.2. Real Mode 1600 texel/m work.
   2.3. Object lightmap baking for furniture, speaker, desk, panel, rack.
   2.4. WebGPU or sampler-array prototype.

3. Red lines
   3.1. Do not change GLSL before root cause is identified.
   3.2. Do not run heavy preview tabs in parallel with a bake.
   3.3. Do not touch Brave.
   3.4. Do not cut pointers to a new package until RAW and OIDN both pass gates.
   3.5. Do not override the user's ROI with a self-made ROI.
   3.6. Do not use fill, blur, or color patching as a formal fix for the iron-door lower-frame issue.
   3.7. Do not commit or push without explicit user/CODEX instruction.
   3.8. Do not propose final reuse of old west-wall packages. Old packages are reference-only.
```

## 1. Current Ground Truth

### 1.1 Scene Geometry

The west wall and iron-door geometry currently live in `js/Home_Studio.js`.

```text
1. West wall / iron door boxes
   1.1. Box 9: west wall above iron door
        addBox([MIN_X, 2.04, -1.874], [-1.91, 2.905, -0.984], ...)
   1.2. Box 10: west wall threshold
        addBox([MIN_X, 0.0, -1.874], [-1.91, 0.09, -0.984], ...)
   1.3. Box 11: west wall south segment
        addBox([MIN_X, 0.0, -0.984], [-1.91, 2.905, 3.056], ...)
   1.4. Box 12: west wall beam
        addBox([-1.91, 2.525, -1.874], [-1.75, 2.905, 2.848], ...)
   1.5. Box 14: southwest column
        addBox([-1.91, 0.0, 2.846], [-1.75, 2.905, 3.056], ...)
   1.6. Box 26: iron door
        addBox([-2.00, 0.09, -1.874], [-1.96, 2.04, -0.984], ..., C_METAL, ...)

2. Small west-wall fixtures
   2.1. West outlet lower: x[-1.91,-1.90], y[0.325,0.395], z[-0.024,0.096].
   2.2. West outlet upper: x[-1.91,-1.90], y[0.585,0.655], z[0.656,0.776].
   2.3. West switch panel: x[-1.91,-1.90], y[1.148,1.218], z[-0.089,0.031].
```

### 1.2 Existing Runtime Packages

```text
1. West wall main
   1.1. Pointer:
        docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json
   1.2. packageDir:
        assets/bakes/r7-3-10/c1-static-diffuse/west-wall-iron-door-hole-1024px-1000spp
   1.3. surfaceName: c1_west_wall
   1.4. targetId: 1004
   1.5. runtimeScope: c1_west_wall_diffuse_short_circuit
   1.6. runtimeArchitecture: single_full_west_wall_first_hit_hybrid
   1.7. note: pointer/manifest requestedSamples says 10000 while package folder says 1000spp. Treat the folder name as stale until verified.

2. Iron-door reveal
   2.1. Pointer:
        docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json
   2.2. packageDir:
        assets/bakes/r7-3-10/c1-static-diffuse/iron-door-reveal-1024px-1000spp
   2.3. surfaceName: c1_iron_door_reveal
   2.4. targetId: 1023
   2.5. mapping: iron_door_reveal_four_band_combined

3. Related west-side packages
   3.1. docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json
   3.2. docs/data/r7-3-10-c1-se-column-west-shadow-runtime-package.json
   3.3. docs/data/r7-3-10-c1-west-beam-inner-shadow-runtime-package.json
   3.4. docs/data/r7-3-10-c1-west-beam-under-shadow-runtime-package.json

4. A1 diagnostic packages
   4.1. docs/data/r7-3-10-xatlas-a1-westbeam-full4x-1000spp-runtime-package.json
   4.2. docs/data/r7-3-10-xatlas-a1-westbeam-height4x-1000spp-runtime-package.json
   4.3. These are A1 diagnostic/probe packages. Do not mix them into the C1 west wall acceptance path without a separate CODEX decision.
```

### 1.3 Existing Shader Contract

```text
1. West wall main target 1004
   1.1. Bake point:
        position = vec3(-1.91, y, z)
        normal = vec3(1, 0, 0)
        z = mix(-1.874, 3.056, uv.x)
        y = mix(0.0, 2.905, uv.y)
   1.2. Excludes iron door hole:
        z[-1.874,-0.984] and y[0.09,2.04]
   1.3. Excludes beam / southwest column hidden area through:
        r7310C1WestWallHiddenByBeamOrSwColumn(z, y)

2. Runtime west wall UV
   2.1. Owner predicate:
        r7310C1RuntimeSurfaceIsWestWall(...)
   2.2. Main wall handoff thresholds:
        R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN = 2.7179
        R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN = 2.515
   2.3. Bake helper hidden cutoff:
        west beam uses y >= 2.525 and southwest column uses z >= 2.846
   2.4. This mismatch is a preflight audit item. Any visible seam near z 2.718..2.846 or y 2.515..2.525 must be classified before rebake.

3. Iron-door reveal target 1023
   3.1. Combined atlas slot: 22.
   3.2. Patch count must remain 23.
   3.3. Four packed bands:
        top face, bottom face, north jamb, south jamb.
   3.4. Contract helper:
        docs/tools/check-r7310-iron-door-reveal-consts.cjs
```

## 2. Known User-Visible Risk: Iron-Door Lower Frame / Floor Color Bleed

The user specifically remembers a small dyed/colored patch near the lower iron-door frame and floor junction. This issue is part of the west-wall pass.

```text
1. Treat this as a gate
   1.1. The west wall is not accepted until this ROI is checked.
   1.2. The worker must use the user's screenshot/camera as authority.
   1.3. The current authoritative ROI is:
        cameraState={"position":{"x":-1.872575,"y":0.029234,"z":-1.844154},"yaw":0.8636,"pitch":-0.512,"fov":55,"forward":{"x":-0.662705,"y":-0.489922,"z":-0.566391}}
        forward={"x":-0.662705,"y":-0.489922,"z":-0.566391}
        view={"facing":"西(-X)","config":1,"samples":107,"paused":false,"sppCap":1000}
        viewport={"innerWidth":727,"innerHeight":741,"canvasCssWidth":727,"canvasCssHeight":409,"drawingBufferWidth":1280,"drawingBufferHeight":720,"devicePixelRatio":3.5,"aspect":1.777778}
        evidence="/Users/eajrockmacmini/Desktop/截圖 2026-06-18 上午11.50.56 西牆門框染色BUG.png"
   1.4. Do not replace this with a centered door-frame view.

2. Candidate sources to investigate
   2.1. Iron-door reveal bottom band guard or UV bleed.
   2.2. West wall main hole handoff to iron-door reveal.
   2.3. Floor alpha / occlusion exclusion near the west wall and door threshold.
   2.4. Iron door material reflection or metal albedo leaking into the floor/contact patch.
   2.5. Old static floor package residue when full non-square master is off.
   2.6. Target 1004 west wall package and target 1023 iron reveal package disagreeing on the same visible junction.

3. Required evidence
   3.1. Same camera, same SPP cap, compare LIVE / RAW / OIDN.
   3.2. Render-space crop around the lower iron-door frame.
   3.3. Data-space sample from relevant atlases:
        west wall target 1004, iron reveal target 1023, floor_open target 1001.
   3.4. Console must have no shader errors or context lost messages.
```

## 3. Phase A: Read-Only Audit

Phase A produces a short report. It does not bake and does not edit code.

```text
- [ ] 1. Confirm working tree state
      Run:
        git status --short
      Expected:
        List only known unrelated files or current authorized edits.

- [ ] 2. Confirm package pointers
      Read:
        docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json
        docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json
        docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json
        docs/data/r7-3-10-c1-se-column-west-shadow-runtime-package.json
        docs/data/r7-3-10-c1-west-beam-inner-shadow-runtime-package.json
        docs/data/r7-3-10-c1-west-beam-under-shadow-runtime-package.json
      Expected:
        targetId, surfaceName, packageDir, samples, runtimeScope are recorded.

- [ ] 3. Confirm package validation reports
      For each packageDir, inspect:
        validation-report.json
        manifest.json
        texel-metadata-patch-000-f32.bin
      Expected:
        status pass or a documented reason for provisional status.

- [ ] 4. Confirm iron-door reveal contract
      Run:
        node docs/tools/check-r7310-iron-door-reveal-consts.cjs
      Expected:
        All checks print OK and final line says the contract is in sync.

- [ ] 5. Confirm west wall tests
      Run:
        node docs/tests/r7-3-10-west-wall-single-hybrid.test.js
        node docs/tests/r7-3-10-west-wall-switch-geometry.test.js
        node docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
        node docs/tests/r7-3-10-se-column-west-shadow.test.js
      Expected:
        All pass. If any fail, stop at report.

- [ ] 6. Audit seam and lower-door ROI
      Use the user's authoritative ROI from section 2.
      Expected:
        A compact LIVE / RAW / OIDN comparison and a verdict:
        clean, visible mismatch, or inconclusive.

- [ ] 7. Report before changing anything
      Include:
        old packages used as reference,
        packages needing OIDN,
        packages needing rebake,
        lower-door ROI classification,
        exact next command candidates.
```

## 4. Phase B: Decision Gate

Phase B decides the exact rebuild scope. Old packages can only be used as references.

```text
1. Required rebuild surfaces
   1.1. West wall main target 1004.
   1.2. Iron-door reveal target 1023 if the authoritative ROI or four-band close-up touches reveal contribution.
   1.3. Related west-side dedicated packages only when Phase A shows they contribute to visible seams.

2. Old package role
   2.1. Old west-wall packages may be used for comparison.
   2.2. Old package validation pass does not grant final acceptance.
   2.3. Old package screenshots do not override the user's authoritative ROI.

3. Required root-cause classification for the color bleed ROI
   3.1. west wall target 1004
   3.2. iron reveal target 1023
   3.3. floor target 1001
   3.4. stale static floor package
   3.5. owner/occlusion handoff
   3.6. unknown, with evidence still missing

4. Rebuild must wait when any are true
   4.1. The authoritative ROI has not been compared in LIVE / RAW.
   4.2. The worker cannot identify which package contributes to the colored patch.
   4.3. The final command has not been pasted to the user.

5. Pointer cut must wait when any are true
   5.1. RAW accepted package is missing.
   5.2. OIDN accepted package is missing.
   5.3. RAW and OIDN point to different package generations.
   5.4. The authoritative ROI still shows visible color bleed.
```

## 5. Phase C: Bake Commands

These commands are templates. OPUS must re-check the runner flags and paste the final command to the user before execution.

### 5.1 West Wall Main

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=west-wall \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --samples=1000 \
  --timeout-ms=3600000 \
  --http-port=9011 \
  --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

### 5.2 Iron-Door Reveal

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=iron-door-reveal \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --samples=1000 \
  --timeout-ms=3600000 \
  --http-port=9011 \
  --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

### 5.3 Related West-Side Dedicated Packages

Run these only when Phase A identifies a visible seam tied to that package.

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=west-wall-beam-shadow \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --samples=1000 \
  --timeout-ms=3600000 \
  --http-port=9011 \
  --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=se-column-west-shadow \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --samples=1000 \
  --timeout-ms=3600000 \
  --http-port=9011 \
  --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=west-beam-inner-shadow \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --samples=1000 \
  --timeout-ms=3600000 \
  --http-port=9011 \
  --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=west-beam-under-shadow \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --samples=1000 \
  --timeout-ms=3600000 \
  --http-port=9011 \
  --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

## 6. Phase D: Post-Bake Gates

Every new package must pass these gates before pointer changes.

```text
- [ ] 1. Metadata identity
      West wall:
        surfaceName == c1_west_wall
        targetId == 1004
        normal == [1,0,0]
        x approximately -1.91
        z/y bounds match west wall mapping
      Iron-door reveal:
        surfaceName == c1_iron_door_reveal
        targetId == 1023
        four-band mapping matches contract

- [ ] 2. Package artifacts exist
      Required files:
        manifest.json
        validation-report.json
        atlas-patch-000-rgba-f32.bin
        texel-metadata-patch-000-f32.bin

- [ ] 3. Validation status
      status == pass
      runnerStatus == pass
      browserValidationStatus == pass

- [ ] 4. RAW render-space acceptance
      Use the same camera for LIVE and RAW.
      West wall seams are visually stable.
      Iron-door lower-frame ROI has no visible color bleed.

- [ ] 5. OIDN bridge
      Run OIDN only after RAW passes.
      Use the established RTLightmap/high pipeline unless CODEX specifies otherwise.
      Confirm metrics passDecision == pass.

- [ ] 6. Pointer sync
      RAW and OIDN pointers must point to the same accepted package generation.
      A stale OIDN pointer blocks acceptance.

- [ ] 7. GLSL safety
      No GLSL change unless a separate CODEX-approved shader task exists.
      If GLSL changes, stop and ask before asking the user to reload.
```

## 7. Phase E: User Visual Acceptance

Use the current local URL when asking the user to check:

```text
http://localhost:9002/Home_Studio.html
```

Minimum visual checks:

```text
1. West wall full view
   1.1. LIVE vs RAW.
   1.2. LIVE vs OIDN.
   1.3. Look for beam / southwest-column seam around z 2.718..2.846 and y 2.515..2.525.

2. Iron-door reveal close-up
   2.1. Top reveal.
   2.2. Bottom reveal.
   2.3. North jamb.
   2.4. South jamb.

3. Iron-door lower-frame / floor ROI
   3.1. This is mandatory.
   3.2. Same camera for LIVE / RAW / OIDN.
   3.3. Acceptance means no visible color bleed, no stale old package residue, and no hard seam.

4. Interaction with floor bake
   4.1. Full non-square on + west wall on + floor on.
   4.2. Full non-square on + west wall on + floor off.
   4.3. Full non-square off, only to confirm the known old static-floor mode does not get mistaken for the accepted path.
```

## 8. Commit Scope

Commit only after user/CODEX acceptance.

```text
1. Candidate files to include
   1.1. New or updated west wall / iron-door pointer JSON.
   1.2. This preflight MD if CODEX accepts it as the west-wall task record.
   1.3. Small audit evidence images only when requested.

2. Files to keep out
   2.1. .omc/** bake binaries.
   2.2. Temporary scripts in docs/tools unless CODEX asks to keep them.
   2.3. deploy-pathB documents.
   2.4. Unrelated Real Mode, WebGPU, object-bake, or screenshot-only changes.
```

## 9. Clean Handoff Summary For OPUS

The worker should follow this exact order:

```text
1. Run Phase A read-only audit.
2. Treat old west-wall packages as reference-only, not final acceptance candidates.
3. Use the user's authoritative cameraState for the iron-door lower-frame ROI.
4. Report package identity, validation status, lower-door ROI classification, and exact proposed bake commands.
5. Wait for CODEX/user confirmation before baking.
6. If baking, run one surface at a time with Google Chrome and no competing preview tab.
7. After RAW passes, run OIDN and sync RAW/OIDN pointers to the same package generation.
8. Give the user the 9002 URL and the exact camera/mode checklist for visual acceptance.
9. Commit only after acceptance and explicit instruction.
```
