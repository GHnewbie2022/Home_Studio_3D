# R7-3.10 Bake Gap And Loading Debug Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:systematic-debugging` before fixing any visual regression or startup/runtime symptom. Use `superpowers:executing-plans` to work through this map task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Turn the latest user feedback into the next R7-3.10 debugging map: finish the remaining non-upgraded bake surfaces, fix newly confirmed continuity mismatches, then investigate startup SPP jitter and loading pause.

**Architecture:** Keep the accepted dedicated hybrid architecture: indirect diffuse comes from bake, direct light / direct shadow edge / reflection stay live. Treat user visual verdict as source of truth. Runtime atlas currently uses 22 slots packed as a `6 x 4` grid; any new slot expansion must keep texture dimensions within WebGL limits.

**Tech Stack:** HTML / JavaScript / WebGL2 path tracing, `js/InitCommon.js`, `js/Home_Studio.js`, `shaders/Home_Studio_Fragment.glsl`, `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`, Node contract tests, 1024px / 1000spp bake packages.

---

## User Feedback Snapshot

```text
1. 西樑的東面 OK，東樑的西面 OK，但是兩個樑的底面都沒升級到。（跟地板平行的那面）
2. 南牆的窗洞切面也沒升級到。
3. 西牆的鐵門旁邊有三個窄面沒烘焙到。
4. 北牆、地板、天花板也要升級。
5. 登入畫面 LOADING 完之後進去，一開始 SPP 會一直抽筋，大概過三秒之後才會正常。
6. 登入畫面會停在 6％ 左右大概三秒鐘，然後才會繼續讀完。這不是本版才出現，但本輪一起納入。
7. 2026-05-19：南牆窗洞切面已由使用者確認成功升級；新增問題是南牆西邊切面（法線朝東）與西南柱子的東面照理應連續，畫面卻出現明顯分界與色差。先登記為最高 ROI 待辦。
```

## Current Rules

```text
1. 以使用者肉眼回報為準。
   檔名或 target 名稱看起來像已做，不代表畫面已升級。

2. 新表面先做 inventory，再做 mapping，再重烘。
   每個新表面都要有 targetId、surfaceName、world bounds、UV mapping、runtime slot、loader、setter、uniform、contract test、正式 package pointer。

3. dedicated hybrid 的光學合約維持：
   baked = indirect diffuse
   live = direct light + direct shadow edge + reflection

4. runtime atlas 禁止回到單排無限加長。
   目前 22 槽使用 6 欄 x 4 列。
   新增槽位前先算寬高，1024px patch 下每 6 槽增加一列。

5. 西側任務要先檢查 bake-time surface point mapping。
   前一輪西側錯圖根因是 targetId 分支漏接，後續新增西牆鐵門窄面時先寫 gate。

6. 視覺修正與登入/載入效能分兩條線。
   表面升級先收斂畫面；SPP 抽筋與 6% pause 用 instrumentation 查根因。

7. 幾何上連續且法線一致的相鄰面，要額外檢查跨 target 亮度一致性。
   即使兩邊各自 target 都載入成功，邊界色差仍算待查視覺問題。
```

## Target Inventory

```text
已由使用者判定 OK：
  西樑東面
  東樑西面
  東牆
  西牆
  東南扁柱北面
  東南扁柱西面
  西南柱北面
  南牆冷氣陰影區
  南牆窗洞切面 Phase 2 dedicated hybrid
  西樑底面與西南柱北面交界黑線 / 縫隙 Phase 2B v5
  西牆與西樑 / 西南柱近距離馬賽克陰影 Phase 2B mosaic guard

待查 / 待升級：
  A. 西牆鐵門旁三個窄面
  B. 北牆
  C. 地板
  D. 天花板
  E. 登入後前 3 秒 SPP 抖動
  F. LOADING 6% 附近停頓約 3 秒

已自查，若使用者再回報才重開：
  H. 西樑底面，與地板平行
  I. 東樑底面，與地板平行
```

## Phase 0: Baseline And Reproduction

```text
- [x] Step 0.1: Capture the current all-on baseline.
      URL:
        http://localhost:9002/Home_Studio.html?v=r7310-beam-column-atlas-grid-v1
      Required report:
        window.reportR7310C1FullRoomDiffuseRuntimeConfig()
      Expected:
        runtimeAtlasPatchCount = 18
        runtimeAtlasGridColumns = 6
        runtimeAtlasGridRows = 3
        error = null

- [x] Step 0.2: Record user-facing camera poses for every visual gap.
      Need poses:
        beam underside east/west
        south wall window cut faces
        west iron door narrow faces
        north wall
        floor
        ceiling
      Output:
        add cameraState blocks into this MD or Debug_Log before implementation.

- [x] Step 0.3: Add an inventory test before changing shader behavior.
      Test file:
        docs/tests/r7-3-10-bake-gap-debug-map.test.js
      Checks:
        every new target has a unique targetId
        every new target has a unique runtime slot
        every new target appears in the runner surface allow-list
        runtime atlas grid dimensions are asserted after slot count changes
```

### Phase 0 Results

```text
date:
  2026-05-19

baseline command:
  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --timeout-ms=180000 --angle=metal

baseline package:
  .omc/r7-3-10-full-room-diffuse-ui-toggle/20260519-001446/ui-toggle-report.json

baseline report:
  source = initial.report
  status = pass
  runtimeAtlasPatchCount = 18
  runtimeAtlasGridColumns = 6
  runtimeAtlasGridRows = 3
  error = null

phase 0 inventory test:
  docs/tests/r7-3-10-bake-gap-debug-map.test.js

inventory test command:
  node docs/tests/r7-3-10-bake-gap-debug-map.test.js

inventory test result:
  pass

note:
  The all-on report has patch count / grid / error in the expected state.
  It also records several later dedicated slots as pending at first report time.
  Treat those slots as needing Phase 1 same-view probe evidence before saying the user-visible faces are upgraded.
```

### Phase 0 CameraState Blocks

```js
const r7310Phase0GapCameraStates = [
  {
    purpose: 'beam underside east side / east beam bottom face',
    cameraState: {
      name: 'r7310_phase0_east_beam_bottom_probe',
      position: { x: 1.786518, y: 2.426144, z: 2.375295 },
      yaw: -2.5156,
      pitch: 0.613,
      fov: 55,
      forward: { x: 0.479224, y: 0.575324, z: 0.662832 }
    }
  },
  {
    purpose: 'beam underside west side / west beam bottom face',
    cameraState: {
      name: 'r7310_phase0_west_beam_bottom_probe',
      position: { x: -1.652805, y: 2.453416, z: 2.729668 },
      yaw: 2.257985,
      pitch: 0.267,
      fov: 55,
      forward: { x: -0.745641, y: 0.263839, z: 0.611889 }
    }
  },
  {
    purpose: 'south wall window cut faces / full lower reveal span',
    cameraState: {
      name: 'r7310_phase0_south_window_reveal_span',
      position: { x: -0.50, y: 1.42, z: 2.08 },
      yaw: 3.14159265359,
      pitch: -0.24,
      fov: 58
    }
  },
  {
    purpose: 'south wall window cut faces / right lower inside corner',
    cameraState: {
      name: 'r7310_phase0_south_window_right_lower_corner',
      position: { x: 0.40, y: 1.36, z: 2.36 },
      yaw: 3.14159265359,
      pitch: -0.26,
      fov: 48
    }
  },
  {
    purpose: 'south wall window cut faces / left lower inside corner',
    cameraState: {
      name: 'r7310_phase0_south_window_left_lower_corner',
      position: { x: -1.42, y: 1.36, z: 2.36 },
      yaw: 3.14159265359,
      pitch: -0.26,
      fov: 48
    }
  },
  {
    purpose: 'west wall iron door narrow faces',
    cameraState: {
      name: 'r7310_phase0_west_iron_door_reveal_probe',
      position: { x: -0.55, y: 1.35, z: -1.15 },
      yaw: 1.57079632679,
      pitch: 0.0,
      fov: 55
    }
  },
  {
    purpose: 'north wall',
    cameraState: {
      name: 'r7310_phase0_north_wall_probe',
      position: { x: 0.0, y: 1.45, z: 0.8 },
      yaw: 0.0,
      pitch: 0.0,
      fov: 55
    }
  },
  {
    purpose: 'floor',
    cameraState: {
      name: 'r7310_phase0_floor_probe',
      position: { x: 1.6, y: 1.4, z: 0.5 },
      yaw: 0.0,
      pitch: -0.86,
      fov: 60
    }
  },
  {
    purpose: 'ceiling',
    cameraState: {
      name: 'r7310_phase0_ceiling_probe',
      position: { x: 0.0, y: 1.25, z: 0.0 },
      yaw: 0.0,
      pitch: 1.10,
      fov: 70
    }
  }
];
```

## Phase 1: Beam Undersides

```text
- [x] Step 1.1: Treat both beam underside faces as not upgraded until same-view evidence says otherwise.
      User verdict:
        west beam east-facing side OK
        east beam west-facing side OK
        both bottom faces missing
      Phase 1 evidence now available:
        same-view probe package:
          .omc/r7-3-10-beam-under-shadow-probe/20260519-010334/probe-report.json
        result:
          both existing under_shadow targets hit the intended visible underside route.

- [x] Step 1.2: Verify whether existing names map to the actual visible underside.
      Existing suspicious names:
        c1_west_beam_under_shadow
        c1_east_beam_under_shadow
      Required check:
        probe hitType / objectID / normal / world position on the visible bottom face.
      Expected:
        normal should be parallel to gravity direction.
        hit must enter the intended dedicated hybrid branch.
      Phase 1 result:
        west:
          route = west_beam_under_shadow_hybrid
          targetId = 1016
          accepted samples = 404
          best sample:
            screen = (990, 59)
            normal = (0, -1, 0)
            world = (-1.7503505468, 2.525, 2.7438486814)
            hitType/objectID = 1 / 1
        east:
          route = east_beam_under_shadow_hybrid
          targetId = 1018
          accepted samples = 282
          best sample:
            screen = (87, 59)
            normal = (0, -1, 0)
            world = (1.8764264822, 2.5149999619, 2.3731730819)
            hitType/objectID = 1 / 1

- [x] Step 1.3: If existing underside targets hit the wrong geometric strip, create corrected targets.
      Candidate names:
        c1_west_beam_bottom_shadow
        c1_east_beam_bottom_shadow
      Contract:
        indirect diffuse bake only
        live direct shadow
        live reflection
      Phase 1 result:
        corrected targets were not created.
        existing targets map to the intended visible underside route.

- [x] Step 1.4: Rebuild formal 1024px / 1000spp packages for the corrected bottom faces.
      Runner command shape:
        node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=<surface> --atlas-resolution=1024 --target-samples=1000 --timeout-ms=900000 --angle=metal
      Phase 1 result:
        rebuild skipped.
        reason:
          there are no corrected bottom targets to bake.
          the existing 1024px / 1000spp packages are the active target packages.

- [x] Step 1.5: Verify with a close same-view screenshot.
      Acceptance:
        bottom face uses the same low-noise indirect diffuse architecture as accepted beam side faces.
        direct shadow edge stays live and smooth.
      Phase 1 evidence:
        west screenshot:
          .omc/r7-3-10-beam-under-shadow-probe/20260519-010334/west-beam-under-shadow-probe.png
        east screenshot:
          .omc/r7-3-10-beam-under-shadow-probe/20260519-010334/east-beam-under-shadow-probe.png
        command:
          node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-beam-under-shadow-probe --timeout-ms=180000 --angle=metal
        code support:
          docs/tests/r7-3-10-beam-under-shadow-probe.test.js
          shader probe levels 11..14 encode route / normal / world position / hit object.
          runner uses fixed randomVec2 = (0.5, 0.5) so those four readbacks refer to the same camera rays.
```

## Phase 2: South Wall Window Cut Faces

```text
- [x] Step 2.1: List every visible south window cut face.
      Expected groups:
        left reveal
        right reveal
        top reveal
        bottom reveal
        front rim / opening edge if still visible
      Phase 2 result:
        four reveal faces are now explicit dedicated targets.
        front rim / opening edge hits route to the nearest reveal target.

- [x] Step 2.2: Check current south-wall package coverage.
      Files:
        docs/data/r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json
        assets/bakes/r7-3-10/c1-static-diffuse/south-wall-window-hole-1024px-1000spp/
      Question:
        Are cut faces still using old static diffuse sampling, live path tracing, or a mixed reveal fallback?
      Phase 2 result:
        before this phase, visible cut faces were owned by the south-wall slot 4 reveal mapping.
        that route used the broad south-wall package.
        the new route gives the four visible reveal faces their own indirect-diffuse hybrid targets.

- [x] Step 2.3: Add dedicated hybrid targets for missing cut faces.
      Candidate names:
        c1_south_window_left_reveal_shadow
        c1_south_window_right_reveal_shadow
        c1_south_window_top_reveal_shadow
        c1_south_window_bottom_reveal_shadow
      Contract:
        indirect diffuse bake only
        live direct shadow
        live reflection
      Phase 2 result:
        added targetId 1019..1022.
        added runtime slots 18..21.
        runtime atlas patch count is now 22, packed as 6 columns x 4 rows.

- [x] Step 2.4: Add a visual helper for window reveal same-view A/B.
      Output:
        live reference screenshot
        upgraded bake screenshot
        visual-report.json with cameraState
      Phase 2 result:
        .omc/r7-3-10-south-reveal-corner-visual/20260519-020357/visual-report.json

- [ ] Step 2.5: User visual pass decides completion.
      Acceptance:
        cut faces no longer show a different 1SPP noise family from the surrounding upgraded wall.
      Phase 2 status:
        implementation and self-checks complete.
        user visual pass pending.
```

### Phase 2 Results

```text
date:
  2026-05-19

user visual verdict:
  accepted.
  user confirmed the south wall window cut faces were successfully upgraded.

visible cut faces:
  left reveal:
    targetId = 1019
    runtime slot = 18
    world = x -1.75, y 1.04..2.905, z 3.056..3.256
    normal = +X
  right reveal:
    targetId = 1020
    runtime slot = 19
    world = x 0.69, y 1.04..2.905, z 3.056..3.256
    normal = -X
  bottom reveal:
    targetId = 1021
    runtime slot = 20
    world = y 1.04, x -1.75..0.69, z 3.056..3.256
    normal = +Y
  top reveal:
    targetId = 1022
    runtime slot = 21
    world = y 2.905, x -1.75..0.69, z 3.056..3.256
    normal = -Y
  front rim / opening edge:
    routed to the nearest dedicated reveal target at runtime.

coverage check:
  old route:
    cut faces were covered by south-wall slot 4 through r7310C1SouthWallWindowRevealDiffuseUv().
    that route used the older broad south wall package.
  new route:
    four dedicated hybrid targets now own first-hit reveal surfaces before the broad south-wall short-circuit can run.
    baked = indirect diffuse
    live = direct light + direct shadow edge + reflection

formal packages:
  left:
    docs/data/r7-3-10-c1-south-window-left-reveal-shadow-runtime-package.json
    assets/bakes/r7-3-10/c1-static-diffuse/south-window-left-reveal-shadow-1024px-1000spp/
  right:
    docs/data/r7-3-10-c1-south-window-right-reveal-shadow-runtime-package.json
    assets/bakes/r7-3-10/c1-static-diffuse/south-window-right-reveal-shadow-1024px-1000spp/
  bottom:
    docs/data/r7-3-10-c1-south-window-bottom-reveal-shadow-runtime-package.json
    assets/bakes/r7-3-10/c1-static-diffuse/south-window-bottom-reveal-shadow-1024px-1000spp/
  top:
    docs/data/r7-3-10-c1-south-window-top-reveal-shadow-runtime-package.json
    assets/bakes/r7-3-10/c1-static-diffuse/south-window-top-reveal-shadow-1024px-1000spp/

runtime atlas:
  patch count = 22
  grid = 6 columns x 4 rows
  south-wall UI button also toggles the four new reveal targets.

verification:
  node docs/tests/r7-3-10-bake-gap-debug-map.test.js
    pass
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    pass
  node --check js/InitCommon.js
    pass
  node --check js/Home_Studio.js
    pass
  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
    pass
  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --timeout-ms=180000 --angle=metal --http-port=9016 --cdp-port=9236
    pass
    report = .omc/r7-3-10-full-room-diffuse-ui-toggle/20260519-020226/ui-toggle-report.json
  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-reveal-corner-visual-test --timeout-ms=180000 --angle=metal --http-port=9017 --cdp-port=9237
    pass
    report = .omc/r7-3-10-south-reveal-corner-visual/20260519-020357/visual-report.json

validation URL:
  http://localhost:9002/Home_Studio.html?v=r7310-phase2-south-window-reveal-hybrid

user visual pass:
  pass
```

## Phase 2B: South Window West Reveal / Southwest Column East Continuity

```text
- [ ] Step 2B.1: Reproduce the exact user view.
      User report:
        the south wall west-side window reveal and the southwest column east face should read as one continuous face.
        the current image shows a visible boundary and color difference.
      Screenshot state:
        URL = http://localhost:9002/Home_Studio.html?v=r7310-phase2-south-window-reveal-hybrid
        samples = 1
        paused = true
        position ~= { x: 0.556955, y: 1.983879, z: 1.566054 }
        forward ~= { x: -0.870418, y: -0.075927, z: 0.486423 }
        facing = -X
      Required output:
        same-view live/off and all-on screenshots.
        route probe for both sides of the visible boundary.

- [ ] Step 2B.2: Identify both owners.
      Face 1:
        south wall west-side reveal, normal points east.
        candidate current target = c1_south_window_left_reveal_shadow / targetId 1019 / slot 18.
      Face 2:
        southwest column east face.
        candidate current target = c1_sw_column_inner_shadow / targetId 1014 / slot 13.
      Required probe fields:
        hitType
        objectID
        normal
        world position
        runtime route
        runtime atlas slot

- [ ] Step 2B.3: Compare the contracts on the two sides.
      Check:
        both sides use indirect diffuse bake only.
        both sides add live direct light and direct shadow edge the same way.
        both sides use compatible world bounds and UV orientation.
        neither side is accidentally using the older south-wall full diffuse route or structural route.

- [ ] Step 2B.4: Decide the fix only after the route probe.
      Candidate outcomes:
        one side is routed to the wrong target.
        both sides are correct targets but have mismatched bake-time sampling domains.
        a continuity guard or shared edge sampling rule is needed.
        one of the two surfaces should be merged or aligned with the other target family.

- [ ] Step 2B.5: Verify with same-view A/B.
      Acceptance:
        the boundary between the south wall west reveal and southwest column east face no longer shows a visible color step.
        1SPP noise family remains consistent with the accepted dedicated hybrid route.
```

## Phase 3: West Wall Iron Door Narrow Faces

```text
- [ ] Step 3.1: Identify the three narrow faces beside the iron door.
      Required probe:
        hitType
        objectID
        normal
        world position
        current runtime branch

- [ ] Step 3.2: Define three explicit surface specs.
      Candidate naming:
        c1_west_iron_door_reveal_left_shadow
        c1_west_iron_door_reveal_right_shadow
        c1_west_iron_door_reveal_top_shadow
      Adjust names after probe if the actual three faces differ.

- [ ] Step 3.3: Add bake-time point mapping before any formal bake.
      Guard:
        targetId branch must exist in r7310C1BakeSurfacePoint.
        world bounds must point to the actual west-wall door narrow face.
        no copied east/south camera projection.

- [ ] Step 3.4: Generate 1024px / 1000spp formal packages.
      Acceptance:
        validation-report status pass
        dirtyModes 0
        pointer JSON points to the new package

- [ ] Step 3.5: Verify with west-wall same-view close screenshot.
      Acceptance:
        three narrow faces visually match the upgraded west wall / west beam lighting family.
```

## Phase 4: North Wall, Floor, Ceiling Upgrade

```text
- [ ] Step 4.1: Decide upgrade form per broad surface.
      Candidate A:
        keep current full-surface static diffuse bake and add live direct only where direct shadow edge matters.
      Candidate B:
        convert the broad surface to the same dedicated hybrid route: indirect diffuse bake + live direct + live reflection.
      Decision rule:
        choose the route that matches accepted dedicated hybrid surfaces at 1SPP.

- [ ] Step 4.2: North wall.
      Required checks:
        door hole / side returns
        wall around door frame
        accepted north-wall 1024 package coverage
        1SPP noise family compared with upgraded faces

- [ ] Step 4.3: Floor.
      Required checks:
        contact edges already fixed in 1024 package
        reflection route remains live
        direct shadow behavior under furniture / stands / speakers

- [ ] Step 4.4: Ceiling.
      Required checks:
        ceiling light direct contribution remains live
        beam contact areas
        lamp edge and nearby shadow gradients

- [ ] Step 4.5: Add broad-surface regression tests.
      Tests:
        no old 512 package pointer
        no stale sprout paste ownership
        runtime atlas grid size stays valid after any slot expansion
        all broad surfaces can be toggled without changing unrelated surfaces
```

## Phase 5: Startup SPP Jitter

```text
- [ ] Step 5.1: Add startup instrumentation.
      Record during first 5 seconds after loading completes:
        sampleCounter
        frameTime
        fps
        framePending
        resize events
        texture upload completion time
        runtime bake ready state changes
        camera matrix changes

- [ ] Step 5.2: Determine the trigger.
      Candidate causes to test:
        texture uploads still finishing after LOADING disappears
        UI toggles wake render repeatedly
        camera pose or viewport resize fires after first render
        sampleCounter resets due to late uniform sync
        hibernation / wakeRender interaction

- [ ] Step 5.3: Add a reproducible runner check.
      Output:
        .omc/r7-3-10-startup-spp-jitter/<timestamp>/startup-report.json
      Pass condition:
        after LOADING completes, sampleCounter should increase monotonically except for intentional reset events listed in the report.

- [ ] Step 5.4: Fix only after root cause is proven.
      Acceptance:
        user no longer sees first 3 seconds of SPP jitter on fresh page load.
```

## Phase 6: LOADING 6% Pause

```text
- [ ] Step 6.1: Instrument the loading progress pipeline.
      Log each stage:
        HTML scripts loaded
        shader loaded
        texture pointers fetched
        binary bake packages fetched
        Float32Array decode
        combined atlas build
        DataTexture upload
        first render ready

- [ ] Step 6.2: Map 6% to the exact stage.
      Required output:
        loading percent
        stage name
        start time
        end time
        duration

- [ ] Step 6.3: Check whether the pause is CPU decode, atlas assembly, network/file fetch, or GPU upload.
      Evidence:
        timing markers around fetch / arrayBuffer / Float32Array view / buildR7310C1CombinedDiffuseRuntimeTexture / needsUpdate.

- [ ] Step 6.4: Apply targeted optimization after evidence.
      Candidate fixes after measurement:
        split progress into honest sub-stages
        build atlas incrementally across frames
        defer non-visible dedicated slots until first toggle needs them
        prebuild a persisted combined atlas package
        reduce duplicate fetch/decode work

- [ ] Step 6.5: Verify loading behavior.
      Acceptance:
        6% stall has a recorded root cause.
        If optimized, loading either advances smoothly or displays a stage label that matches the actual wait.
```

## Phase 2B Result: South Window West Reveal / Southwest Column East Continuity

```yaml
date: 2026-05-19
status: pass_after_v1_rejected_by_user
supersedes:
  rejected_v1:
    validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-continuity-material-v1
    user_camera: '{"position":{"x":-0.316405,"y":1.08795,"z":1.701729},"yaw":2.3108,"pitch":0.302,"fov":55,"forward":{"x":-0.705046,"y":0.29743,"z":0.643775}}'
    failure:
      - Southwest column top and lower area showed texture-like artifacts.
      - Southwest column / west beam and southwest column / south window west +X cut still showed visible color mismatch.
    reproduced_report: .omc/r7-3-10-south-window-sw-column-continuity/20260519-121841/south-window-sw-column-continuity-report.json
root_causes:
  - The visible +X plane was split across two dedicated bake domains: south_window_left_reveal_shadow and sw_column_inner_shadow.
  - V1 expanded runtime ownership and JS metadata for c1_sw_column_inner_shadow to z 2.848..3.256 / y 0..2.905, but the shader bake surface for patchId 1014 still emitted the old z 2.848..3.056 / y 0..2.525 plane. That stretched an old atlas over the new runtime area.
  - r7310C1DynamicSouthWallBaseColor returned beam base color vec3(1.0, 0.984, 0.949) and included uWallAlbedo, while the adjacent south wall cut uses wall base color vec3(0.75, 0.738, 0.71175) and receives uWallAlbedo later.
  - The two boxes also kept an internal z=3.056 join face, so ray tracing could shadow a plane that should behave as one continuous slab.
  - The V1 probe only checked the south-window/column join; it did not measure the west-beam adjacent area and did not hide cameraPoseInfo from screenshots.
fix:
  - Expanded c1_sw_column_inner_shadow bounds to include z 2.848..3.256 and y 0..2.905.
  - Updated r7310C1BakeSurfacePoint patchId 1014 to the same z 2.848..3.256 / y 0..2.905 plane.
  - Removed the left-reveal x-plane runtime ownership; the left reveal target now only owns the true front-edge reveal band.
  - Corrected r7310C1DynamicSouthWallBaseColor to return the actual south-wall base color vec3(0.75, 0.738, 0.71175), with uWallAlbedo applied once by the existing structural-material path.
  - Added r7310C1HiddenSwColumnSouthWallJoinFace so the internal south-wall/column join face no longer blocks rays.
  - Extended the Phase 2B probe to include west_beam_inner_shadow_hybrid, westBeamContinuityMeanDelta, and hidden cameraPoseInfo / bottom-right-group screenshots.
  - Re-baked assets/bakes/r7-3-10/c1-static-diffuse/sw-column-inner-shadow-1024px-1000spp/.
verification:
  contract:
    - node docs/tests/r7-3-10-phase2b-continuity.test.js
  whitespace:
    - git diff --check
  rebake:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=sw-column-inner-shadow --samples=1000 --atlas-resolution=1024 --timeout-ms=300000 --angle=metal --http-port=9021 --cdp-port=9241
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/sw-column-inner-shadow-1024px-1000spp
  same_view_probe:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-window-sw-column-continuity-probe --timeout-ms=240000 --angle=metal --http-port=9024 --cdp-port=9244 --camera-state-json='{"position":{"x":-0.316405,"y":1.08795,"z":1.701729},"yaw":2.3108,"pitch":0.302,"fov":55,"forward":{"x":-0.705046,"y":0.29743,"z":0.643775}}'
    status: pass
    report: .omc/r7-3-10-south-window-sw-column-continuity/20260519-130400/south-window-sw-column-continuity-report.json
    continuityMeanDelta: -0.006983810594261813
    westBeamContinuityMeanDelta: -0.012341558627094074
    visuals:
      bake_spp1: .omc/r7-3-10-south-window-sw-column-continuity/20260519-130400/south-window-sw-column-bake-spp1.png
      bake_spp96: .omc/r7-3-10-south-window-sw-column-continuity/20260519-130400/south-window-sw-column-bake-spp96.png
      live_spp96: .omc/r7-3-10-south-window-sw-column-continuity/20260519-130400/south-window-sw-column-live-spp96.png
    eyedropper:
      south_window_cut_vs_sw_column_mid_delta_luma: 0.0021
      south_window_cut_vs_sw_column_low_delta_luma: 0.0150
      sw_column_vs_west_beam_top_delta_luma: 0.0045
      sw_column_vs_west_beam_upper_mid_delta_luma: 0.0129
acceptance:
  - Same-view screenshot no longer shows the V1 texture artifacts on the southwest column top / lower area.
  - Southwest column / west beam and southwest column / south window west +X cut are within measured small color deltas; remaining differences read as shadow transition.
  - Remaining visible edge at the window/main-wall corner is outside the Phase 2B continuity fault.
validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-continuity-material-v2
next_roi_order:
  1: Phase 3 west wall iron door narrow faces.
  2: Phase 4 north wall / floor / ceiling.
  3: Phase 5 startup SPP jitter.
  4: Phase 6 LOADING 6% pause.
```

## Phase 2B L-Union Correction: West Beam / Southwest Column

```yaml
date: 2026-05-19
status: pass_after_user_marked_crop_rework
supersedes:
  previous_v2:
    validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-continuity-material-v2
    user_verdict:
      - Brightness improved.
      - West beam still looked like it protruded into the southwest column.
      - Correct target is one integrated L shape, with only shadow transition.
root_causes:
  - The visible +X L plane still had two ownership ideas: west_beam_inner_shadow owned the upper west-beam span, while sw_column_inner_shadow owned the vertical southwest-column span.
  - The west beam source box still extended to z=3.056 in part of the active structural contract/runtime path, so the top strip could visually read as a rectangular beam patch inside the column area.
  - The structural island contract could still assign the southwest-column upper +X coplanar face to west_beam_inner_x instead of sw_column_inner_x.
  - The hidden internal contact at z=2.848 was not fully guarded across scene intersection, structural atlas ownership, and dedicated hybrid routing.
fix:
  - Shortened the west beam geometry to zMax=2.848 in js/Home_Studio.js.
  - Updated r7310C1RuntimeSurfaceIsWestBeamInnerShadow, patchId 1015, UV scale, and R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS to stop at z=2.848.
  - Added r7310C1WestBeamSwColumnLUnionWallFace so west beam +X and southwest-column +X use the same wall-color material basis on the visible L.
  - Added r7310C1HiddenWestBeamSwColumnJoinFace so the z=2.848 internal contact face is skipped during scene intersection.
  - Updated R7310_C1_STRUCTURAL_ISLANDS and docs/tools/r7-3-10-structural-geometry-gate.mjs so sw_column_upper_inner_coplanar_x is visible and owned by sw_column_inner_x.
  - Synced docs/data/r7-3-10-full-room-diffuse-bake-contract.json to the current geometry gate.
rebake:
  west_beam_inner_shadow:
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/west-beam-inner-shadow-1024px-1000spp
  sw_column_inner_shadow:
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/sw-column-inner-shadow-1024px-1000spp
  structural_beams_columns:
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp
verification:
  commands:
    - node docs/tests/r7-3-10-phase2b-continuity.test.js
    - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    - node docs/tools/r7-3-10-structural-geometry-gate.mjs
    - node --check js/InitCommon.js
    - node --check js/Home_Studio.js
    - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  same_view_probe:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-window-sw-column-continuity-probe --timeout-ms=240000 --angle=metal --http-port=9036 --cdp-port=9256 --camera-state-json='{"position":{"x":0.211734,"y":1.541394,"z":1.997826},"yaw":1.9724,"pitch":0.119,"fov":55,"forward":{"x":-0.913926,"y":0.118719,"z":0.38813}}'
    status: pass
    report: .omc/r7-3-10-south-window-sw-column-continuity/20260519-151717/south-window-sw-column-continuity-report.json
    continuityMeanDelta: -0.006790035322859128
    westBeamContinuityMeanDelta: -0.011225053869436202
    visuals:
      bake_spp1: .omc/r7-3-10-south-window-sw-column-continuity/20260519-151717/south-window-sw-column-bake-spp1.png
      bake_spp96: .omc/r7-3-10-south-window-sw-column-continuity/20260519-151717/south-window-sw-column-bake-spp96.png
      live_spp96: .omc/r7-3-10-south-window-sw-column-continuity/20260519-151717/south-window-sw-column-live-spp96.png
  geometry_gate:
    west_beam_zMax: 2.848
    sw_column_upper_inner_coplanar_x_owner: sw_column_inner_x
    sw_column_upper_north_z: hidden_by_west_beam_internal_contact
acceptance:
  - User-marked crop area no longer shows a bright rectangular west-beam patch intruding into the southwest column.
  - West beam + southwest column reads as one L-shaped surface; remaining variation is shadow transition.
  - Dedicated hybrid routes and structural full diffuse contract now agree on the same visible ownership.
validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-l-union-material-v6
next_roi_order:
  1: Phase 3 west wall iron door narrow faces.
  2: Phase 4 north wall / floor / ceiling.
  3: Phase 5 startup SPP jitter.
  4: Phase 6 LOADING 6% pause.
```

## Phase 2B Gap Closure: West Beam Underside / Southwest Column North Face

```yaml
date: 2026-05-19
status: pass_same_view_baked_gap_closed_v5
supersedes:
  previous_v7:
    validation_url: http://127.0.0.1:9002/Home_Studio.html?v=r7310-phase2b-l-union-material-v7
    user_verdict:
      - West wall / west beam contact was confirmed clean.
      - Remaining black line was specifically the west beam underside / southwest column north-face junction.
      - User proved the black line was a real gap by looking south along the west wall and seeing the exterior night image through it.
root_cause:
  - The west beam south end and southwest column north face only touched at z=2.848.
  - That zero-overlap edge could leak primary rays at the close grazing same-view camera.
  - Follow-up correction from the user: LIVE is clean in the required view; the remaining visible problem is in the baked route only.
  - Final baked-route root cause was hidden internal contact ownership: sw-column-north-shadow and west-beam-under-shadow still included the west-beam / southwest-column overlap bands in bake/runtime mapping, so edge texels could preserve a seam-like dark row even after the geometry overlap closed the actual hole.
fix:
  - Kept west beam zMax at 2.848 to preserve the accepted L shape.
  - Extended southwest column zMin from 2.848 to 2.846 in js/Home_Studio.js.
  - This creates a 2mm physical overlap between the column north face and west beam underside, closing the primary-hit gap without adding a texture mask.
  - Clipped the visible bake/runtime ownership so sw-column-north-shadow ends at y=2.525 and west-beam-under-shadow ends at z=2.846.
  - Synchronized the structural island contract with the same west_beam_under_y zMax=2.846 and sw_column_north_z yMax=2.525 boundary.
  - Re-baked the affected formal 1024 / 1000spp packages.
  - Updated cache tokens to r7310-phase2b-l-gap-closure-v5.
rebake:
  sw_column_north_shadow:
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/sw-column-north-shadow-1024px-1000spp
  sw_column_inner_shadow:
    status: pass_v4
    package: assets/bakes/r7-3-10/c1-static-diffuse/sw-column-inner-shadow-1024px-1000spp
  west_beam_under_shadow:
    status: pass_v5
    package: assets/bakes/r7-3-10/c1-static-diffuse/west-beam-under-shadow-1024px-1000spp
  structural_beams_columns:
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp
verification:
  commands:
    - node docs/tests/r7-3-10-phase2b-continuity.test.js
    - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    - node docs/tools/r7-3-10-structural-geometry-gate.mjs
    - node --check js/Home_Studio.js
    - node --check js/InitCommon.js
    - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  same_view_capture:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-south-window-sw-column-continuity-probe --timeout-ms=240000 --target-samples=1 --angle=metal --http-port=9064 --cdp-port=9284 --camera-state-json='{"position":{"x":-1.805511,"y":2.481113,"z":2.782358},"yaw":2.8784,"pitch":0.509,"fov":55,"forward":{"x":-0.227184,"y":0.487304,"z":0.843162}}'
    package: .omc/r7-3-10-south-window-sw-column-continuity/20260519-221412
    bake_spp1: .omc/r7-3-10-south-window-sw-column-continuity/20260519-221412/south-window-sw-column-bake-spp1.png
    live_spp1: .omc/r7-3-10-south-window-sw-column-continuity/20260519-221412/south-window-sw-column-live-spp1.png
    note: The continuity report still prints fail because routeCounts does not classify this west-beam-underside / southwest-column-north same-view hit; visual and pixel checks are the acceptance evidence for this specific gap.
  beam_under_probe:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-beam-under-shadow-probe --timeout-ms=240000 --target-samples=1 --angle=metal --http-port=9066 --cdp-port=9286 --camera-state-json='{"position":{"x":-1.805511,"y":2.481113,"z":2.782358},"yaw":2.8784,"pitch":0.509,"fov":55,"forward":{"x":-0.227184,"y":0.487304,"z":0.843162}}'
    package: .omc/r7-3-10-beam-under-shadow-probe/20260519-222402
    status: pass
    accepted: 772
    routeMatches: 772
    directNonZero: 0
    sourceFacingNonZero: 0
  pixel_check:
    main_seam_no_window:
      crop: [900, 1680, 4800, 2100]
      dark_pixels: 0
      night_colored_pixels: 0
      min_rgb: [68, 55, 44]
      mean_rgb: [121.12, 104.58, 88.4]
    upper_join_no_window:
      crop: [900, 1450, 4800, 1760]
      dark_pixels: 0
      night_colored_pixels: 0
      min_rgb: [68, 55, 44]
      mean_rgb: [125.89, 108.46, 90.5]
acceptance:
  - Same-view baked screenshot no longer shows a black line or visible gap at the west beam underside / southwest column north-face junction.
  - User corrected the diagnosis: LIVE is fully fine; only baked had the issue.
  - User accepted the remaining diagonal dark band as normal shadow, with no black line or slit visible.
validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-l-gap-closure-v5
next_roi_order:
  1: Phase 3 west wall iron door narrow faces.
  2: Phase 4 north wall / floor / ceiling.
  3: Phase 5 startup SPP jitter.
  4: Phase 6 LOADING 6% pause.
```

## Phase 2B Close-Up Mosaic Guard: West Wall / West Beam / Southwest Column

```yaml
date: 2026-05-19
status: pass_same_view_closeup_mosaic_removed
scope:
  - Close-up baked shadow mosaic at the west wall / west beam and west wall / southwest-column contact area.
user_report:
  url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-l-gap-closure-v5
  cameraState: '{"position":{"x":-1.881727,"y":2.502503,"z":2.816512},"yaw":2.1224,"pitch":0.356,"fov":55,"forward":{"x":-0.798283,"y":0.348528,"z":0.491195}}'
  samples: 1
  finding:
    - The black line / gap was solved.
    - At very close distance, the west beam shadow on the west wall still showed rectangular baked shadow pixels near the beam / column / wall junction.
root_cause:
  - The dedicated c1_west_wall_beam_shadow atlas had hidden high-z contact texels beyond the runtime z guard.
  - Bilinear sampling pulled those contact texels into the visible west-wall shadow band.
  - After that was guarded, the remaining rectangles came from the full c1_west_wall atlas, which lacked the west-side mirror of the southeast/east-wall guard.
  - The full west-wall atlas therefore still exposed hidden southwest beam / column contact texels at z >= 2.833 and y >= 2.523 in close-up sampling.
fix:
  - Added fillR7310C1WestWallBeamShadowGuardTexels() for the c1_west_wall_beam_shadow package.
  - Added fillR7310C1WestWallSouthwestGuardTexels() for the full c1_west_wall package.
  - The guard copies valid adjacent wall texels into hidden contact texels before writing the atlas, so bilinear sampling cannot pull empty or stale contact values.
  - Re-baked west-wall-beam-shadow and west-wall formal 1024 / 1000spp packages.
  - Updated cache tokens to r7310-phase2b-west-wall-mosaic-guard-v1.
rebake:
  west_wall_beam_shadow:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-wall-beam-shadow --samples=1000 --atlas-resolution=1024 --timeout-ms=420000 --angle=metal --http-port=9014 --cdp-port=9234
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/west-wall-beam-shadow-1024px-1000spp
  west_wall:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-wall --samples=1000 --atlas-resolution=1024 --timeout-ms=420000 --angle=metal --http-port=9018 --cdp-port=9238
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/west-wall-iron-door-hole-1024px-1000spp
verification:
  commands:
    - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    - node docs/tests/r7-3-10-bake-gap-debug-map.test.js
    - node docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
    - node --check js/InitCommon.js
    - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  same_view_diagnostic:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-west-wall-mosaic-diagnostic --target-samples=1 --timeout-ms=240000 --angle=metal --http-port=9019 --cdp-port=9239 --camera-state-json='{"position":{"x":-1.881727,"y":2.502503,"z":2.816512},"yaw":2.1224,"pitch":0.356,"fov":55,"forward":{"x":-0.798283,"y":0.348528,"z":0.491195}}'
    package: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-004702
    all_on: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-004702/all-on.png
    crop: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-004702/all-on-problem-crop.png
acceptance:
  - Same-view all-on close-up screenshot no longer shows the original rectangular mosaic pixels inside the user-marked red area.
  - Remaining west beam / west wall shading is a continuous diagonal shadow transition.
validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-west-wall-mosaic-guard-v1
next_roi_order:
  1: Phase 3 west wall iron door narrow faces.
  2: Phase 4 north wall / floor / ceiling.
  3: Phase 5 startup SPP jitter.
  4: Phase 6 LOADING 6% pause.
```

## Phase 2B Close-Up Mosaic Ownership Correction: West Wall Live Direct

```yaml
date: 2026-05-20
status: pass_same_view_full_west_wall_live_direct_ownership
supersedes:
  previous: Phase 2B Close-Up Mosaic Guard: West Wall / West Beam / Southwest Column
scope:
  - West wall / west beam and west wall / southwest-column close-up contact shadows.
user_report:
  screenshot: /Users/eajrockmacmini/Desktop/截圖 2026-05-20 凌晨12.53.09.png
  cameraState: '{"position":{"x":-1.854712,"y":2.492962,"z":2.799862},"yaw":2.0384,"pitch":0.256,"fov":55,"forward":{"x":-0.86356,"y":0.253213,"z":0.436059}}'
  samples: 1
  finding:
    - Previous guard-fill result still showed close-up rectangular baked direct-shadow pixels.
    - The required architecture is direct light and direct shadow from LIVE, with only diffuse radiance coming from bake.
root_cause:
  - The red-marked close-up west-wall pixels still fell through to the old c1_west_wall full diffuse short-circuit.
  - That old route still carried direct-shadow-shaped baked pixels near the west beam and southwest-column contact.
  - The dedicated c1_west_wall_beam_shadow route owned only z < 2.833 and y <= 2.523, so the visible close-up contact region was split between two lighting architectures.
fix:
  - Expanded c1_west_wall_beam_shadow runtime ownership to the full c1_west_wall surface.
  - Kept c1_west_wall_beam_shadow as indirect_diffuse_radiance with addDirectLightAfterBakeLookup=true.
  - Removed the west-wall-beam-shadow guard-column copy from visible bake output; the rebake now writes real visible texels over the full west-wall bounds.
  - Left the old full c1_west_wall route loadable for diagnostics, but all-on runtime west-wall first hits are now claimed by the indirect + LIVE-direct dedicated route before the full route can short-circuit.
  - Updated cache tokens to r7310-phase2b-west-wall-live-direct-v1.
rebake:
  west_wall_beam_shadow:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=west-wall-beam-shadow --samples=1000 --atlas-resolution=1024 --timeout-ms=420000 --angle=metal --http-port=9024 --cdp-port=9244
    status: pass
    package: assets/bakes/r7-3-10/c1-static-diffuse/west-wall-beam-shadow-1024px-1000spp
    worldBounds: { zMin: -1.874, zMax: 3.056, yMin: 0, yMax: 2.905, x: -1.91 }
    validTexelRatio: 0.8787927627563477
    artifactHash: 8a562c107b223576fa0ebe626ff2ad6191d0a93001ce64da5352fe42f8c9cb90
verification:
  commands_passed:
    - node docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
    - node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    - node docs/tests/r7-3-10-bake-gap-debug-map.test.js
    - node docs/tests/r7-3-10-phase2b-continuity.test.js
    - node docs/tests/r7-3-10-loading-ui-contract.test.js
    - node --check js/InitCommon.js
    - node --check js/Home_Studio.js
    - node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  known_stale_tests:
    - docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js still expects runtime atlas patch count 18.0, while current runtime uses 22.0 after south-window reveal Phase 2.
    - docs/tests/r7-3-10-beam-under-shadow-probe.test.js still expects probe-level clamp 16, while current runtime has moved on.
  same_view_diagnostic:
    command: node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-west-wall-mosaic-diagnostic --target-samples=1 --timeout-ms=240000 --angle=metal --http-port=9025 --cdp-port=9245 --camera-state-json='{"position":{"x":-1.854712,"y":2.492962,"z":2.799862},"yaw":2.0384,"pitch":0.256,"fov":55,"forward":{"x":-0.86356,"y":0.253213,"z":0.436059}}'
    package: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-012349
    all_on: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-012349/all-on.png
    only_west_wall_full: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-012349/only-west-wall-full.png
acceptance:
  - Same-view all-on close-up screenshot no longer shows the red-marked rectangular baked direct-shadow mosaic.
  - only-west-wall-full still reproduces the old blocky direct-shadow pattern, confirming the full wall route was the source.
  - all-on now routes the west wall through indirect bake plus LIVE direct light / direct shadow.
validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-west-wall-live-direct-v1
next_roi_order:
  1: Phase 3 west wall iron door narrow faces.
  2: Phase 4 north wall / floor / ceiling.
  3: Phase 5 startup SPP jitter.
  4: Phase 6 LOADING 6% pause.
```

## Required Documentation Updates

## Phase 2B Strict Runtime Ready Guard: West Wall / West Beam / Southwest Column

```yaml
date: 2026-05-20
status: pass_strict_runtime_ready_black_rectangle_removed
supersedes:
  previous: Phase 2B Close-Up Mosaic Ownership Correction: West Wall Live Direct
scope:
  - West wall / west beam / southwest-column close-up visual diagnostics.
user_report:
  finding:
    - After the gray rectangle disappeared near the southwest desk, a black rectangle appeared near the southwest column lower area in the prior screenshot.
root_cause:
  - The visual diagnostic helper called waitForR7310C1FullRoomDiffuseRuntimeReady().
  - That wait helper treated pending dedicated runtime packages as acceptable for completion.
  - The old all-on diagnostic screenshot was captured while westWallBeamShadow, swColumnInnerShadow, westBeamInnerShadow, and westBeamUnderShadow were still pending; their package dirs were null and their uniforms were 0.
  - That half-loaded capture produced an apparent black rectangle even though the intended all-on route required those packages to be ready.
fix:
  - Changed waitForR7310C1FullRoomDiffuseRuntimeReady() so every enabled package must be actually ready before returning.
  - Added westJoin runtime probe levels 22..26 to identify which route owns the close-up pixel, its normal, world position, hit object, and indirect radiance.
  - Added southwest black-rectangle sample points to the runtime probe helper.
  - Updated cache tokens to r7310-phase2b-west-wall-strict-ready-v1.
verification:
  strict_same_view_diagnostic:
    primary_package: .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-035138
    black_pixel_check: 0 black pixels and 0 dark pixels in crop [1500,1000,2300,1600].
    config_ready: westWallBeamShadow, swColumnInnerShadow, westBeamInnerShadow, westBeamUnderShadow, and south-window reveal packages all ready with uniforms enabled.
  visual_views:
    - .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-035138/all-on.png
    - .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-033529/all-on.png
    - .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-033811/all-on.png
    - .omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-033819/all-on.png
  probe:
    package: .omc/r7-3-10-full-room-diffuse-runtime/20260520-032006
    sw_black_rect_center_route: sw_column_inner_shadow_hybrid
    sw_black_rect_center_luma: 0.2315
acceptance:
  - Strict-ready all-on screenshots no longer show the black rectangle near the southwest column lower area.
  - West wall large-surface views no longer show the earlier gray rectangles.
  - The old black rectangle was tied to a half-loaded diagnostic capture, not to a final ready all-on render path.
validation_url: http://localhost:9002/Home_Studio.html?v=r7310-phase2b-west-wall-strict-ready-v1
next_roi_order:
  1: Phase 3 west wall iron door narrow faces.
  2: Phase 4 north wall / floor / ceiling.
  3: Phase 5 startup SPP jitter.
  4: Phase 6 LOADING 6% pause.
```

```text
- [x] Update this MD after each completed phase.
- [x] Update docs/SOP/Debug_Log.md with root cause, fix, commands, package paths, and user visual verdict.
- [x] Update docs/SOP/Debug_Log_Index.md only when a new stable route or no-go rule is created.
- [x] Keep visual helper outputs under .omc with timestamped folders.
```

## Execution Order

```text
1. Phase 0 baseline and probes. Done.
2. Phase 1 beam undersides. Done; no corrected targets or rebake needed.
3. Phase 2 south window cut faces. Done; user confirmed visual upgrade.
4. Phase 2B south window west reveal / southwest column east continuity. Done.
5. Phase 2B west beam underside / southwest column north-face gap closure. Done.
6. Phase 2B west wall / west beam / southwest column close-up mosaic ownership correction and strict-ready visual guard. Done.
7. Phase 3 west iron door narrow faces. New highest ROI.
8. Phase 4 north wall / floor / ceiling.
9. Phase 5 startup SPP jitter.
10. Phase 6 LOADING 6% pause.
```

## Self-Review

```text
Spec coverage:
  Feedback item 1 maps to Phase 1.
  Feedback item 2 maps to Phase 2.
  Feedback item 3 maps to Phase 3.
  Feedback item 4 maps to Phase 4.
  Feedback item 5 maps to Phase 5.
  Feedback item 6 maps to Phase 6.
  Feedback item 7 maps to Phase 2B.

Placeholder scan:
  No unresolved placeholder item remains.
  Unknown exact face names are written as candidate names and paired with required probe steps.

Risk note:
  Phase 1 checked the suspicious "under" names.
  c1_west_beam_under_shadow and c1_east_beam_under_shadow both map to the intended visible underside hybrid routes.
  Keep the Phase 1 probe as the future guard before changing those targets.
  Phase 2B must not start from a fix guess.
  First prove which runtime target owns each side of the visible boundary.
```
