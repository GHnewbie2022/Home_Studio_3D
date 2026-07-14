# R7-3.10 鐵門 Runtime Planar / FIX7 視覺對齊 Roadmap

> **給 agentic worker:** REQUIRED SUB-SKILL: Use `superpowers:systematic-debugging` before changing behavior, then use `superpowers:test-driven-development` for any code or contract change.

**Current decision tokens:**

```text
runtime_planar_bake_lit_direct_parity_candidate_is_rejected_diagnostic
runtime_planar_v2_restore_is_regression_baseline
proxy_bake_lit_source_failed_fix7_visual_gate
main_path_tracer_mirrored_runtime_planar_source
source_bounce_mode_main_path_tracer_same_scene_reflection_bounce_source
runtime_planar_source_first_hit_bake_shortcuts_disabled
rough_metal_one_sample_response_required
directional_rough_planar_sampling_rejected_diagnostic
rough_planar_cone_radius_uses_texture_height
same_scene_render_parity_required
fix7_visual_gate_is_authority
spp_1_only
```

**Goal:** 鐵門反射使用 runtime planar reflection camera。反射內容位置要跟玩家位置與目前視線方向一起變動，視覺目標對齊 FIX7 LIVE reflection。FIX7 只作權威對照；runtime planar 候選獨立運作，不使用 LIVE reflection fallback。

**Current candidate:** `runtime_planar_main_shader_v12_reflection_bounce` 把正式 `same-scene` 來源維持為主 path tracer 鏡射相機輸出，並保留主場景 bake/runtime uniforms。source scene kind 必須回報 `main_path_tracer_mirrored_runtime_planar_source`，source bounce mode 必須回報 `main-path-tracer-same-scene-reflection-bounce-source`。v12 在鏡射 source pass 啟用 `uR7310C1IronDoorRuntimePlanarReflectionSourcePass`，讓反射內容避開 primary first-hit bake/hybrid shortcut，改走更接近 FIX7 LIVE 的反射後光路語意。這是待 Chrome + Metal SPP=1 與肉眼對照 FIX7 的候選，尚未宣告達標。

**Regression baseline:** `runtime_planar_v2_restore_is_regression_baseline`。v2 能證明 projection / view-dependent reflection 已走對，但它的 source lighting 是手工近似，只能當回歸基準。

**Next candidate family:** `runtime_planar_same_scene_parity_candidate`。runtime planar camera 保留；reflection texture 的來源要改成同一套可渲染場景語意，包含同一套 bake / material / light / shadow contract。

## 白話施工結論

v2 解掉「反射內容固定不跟視角變」這個問題。bake-lit direct parity 讓畫面變亮，但使用者截圖顯示光影仍像平面代理場景，缺少 FIX7 的層次感。

正式路線是業界常見 planar reflection 作法：用鏡射相機即時 render 一張 reflection texture，來源場景必須與主畫面共享可渲染場景語意。這份 repo 目前的缺口是 runtime planar source 由 `sceneBoxes` 重建成另一套代理 Three.js 場景，mapped ShaderMaterial 只吃烤圖與簡化直接光，沒有主 path tracer 的多反彈、遮蔽、MIS、粗金屬反射取樣與材質鏈。

最新施工方向：保留 runtime planar camera，正式來源改為主 path tracer 鏡射相機。代理 source scene 退出正式候選；bake-lit direct parity 已退出正式候選。所有 gate 固定 SPP=1。

2026-06-26 補充：使用者同鏡頭回報 v6 仍比 FIX7 缺少光源距離漸變與黑玻璃層次。後續 v7 把 source pass 的 first-hit bake/runtime uniforms 關掉，這個 ROADMAP 判斷已確認錯誤：FIX7 LIVE reflection 反射出去後，下一個命中的牆、地板、家具仍沿用主場景 bake/material 語意。正式 source pass 必須保留主場景 bake/runtime uniforms。

2026-06-26 第二次補充：v7 live-bounce source 通過 Chrome + Metal SPP=1 gate，但同鏡頭 ROI 顯示鐵門主區仍比 FIX7 亮，且暗部比例偏低。v8 改用 per-pixel stable one-sample rough offset。v9 directional world-position sample 通過 smoke，但肉眼顯示反射被沖亮且黑玻璃感退步，標為 diagnostic failed。v10 回到業界 planar reflection 標準：鏡射相機 source 保留主場景 bake/material/light/shadow，shader 用門面 world position 做 texture matrix 投影，再用 rough prefilter 處理粗糙度。v10 仍偏亮且像乾淨鏡子；v11 將 rough prefilter 半徑改為 texture-height rough cone，但 ROI 幾乎未改善，標為 failed visual gate。v12 修正真正的 source pass 語意：鏡射相機第一下命中的房間表面不能走 primary first-hit bake shortcut，必須當作鐵門反射後的光路。

## 官方依據

| 來源 | 對本案的意義 |
|---|---|
| Unity HDRP Planar Reflection Probe: `https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.0/manual/Planar-Reflection-Probe.html` | Planar reflection probe 捕捉 RenderTexture，支援 real-time update、culling mask、解析度、rough reflection、influence volume。 |
| Unity Lightmaps and Baking: `https://docs.unity3d.com/Manual/Lightmappers.html` | Lightmap 會把表面亮度預先算成 texture，可包含直接光與間接光。 |
| Unreal Planar Reflections: `https://dev.epicgames.com/documentation/en-us/unreal-engine/planar-reflections-in-unreal-engine` | Planar reflection 會把場景再 render 一次；可搭配預先計算的 lighting / shadowing。 |
| three.js Reflector: `https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Reflector.js` | 官方 addon 使用鏡射相機、`WebGLRenderTarget`、texture matrix projection、clip plane。 |
| three.js MeshStandardMaterial: `https://github.com/mrdoob/three.js/blob/dev/src/materials/MeshStandardMaterial.js` | `lightMap` 是 pre-baked illuminance data，需要第二套 UV。 |

## 現況證據

| Evidence | Result |
|---|---|
| FIX7 authority | `http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7` |
| v2 regression baseline | `http://localhost:9002/Home_Studio.html?atlasMaster=raw&ironDoorReview=runtimePlanar&ironDoorCamera=front&cb=r7310-iron-door-runtime-planar-v2-restore` |
| bake-lit direct parity diagnostic | `http://localhost:9002/Home_Studio.html?atlasMaster=raw&ironDoorReview=runtimePlanar&ironDoorCamera=front&ironDoorRuntimePlanarLighting=bake-lit&cb=r7310-iron-door-runtime-planar-source-contract-v1` |
| same-scene shader v5 diagnostic | `http://localhost:9002/Home_Studio.html?atlasMaster=raw&ironDoorReview=runtimePlanar&ironDoorCamera=front&cb=r7310-iron-door-runtime-planar-same-scene-shader-v5` |
| main path tracer v12 reflection-bounce candidate | rejected visual gate: fixed planar lookup stayed too bright and too flat versus FIX7 |
| main path tracer v13 direction-cone candidate | `http://localhost:9002/Home_Studio.html?atlasMaster=raw&ironDoorReview=runtimePlanar&ironDoorCamera=front&cb=r7310-iron-door-runtime-planar-main-shader-v13-direction-cone` |
| source mode | `ironDoorRuntimePlanarReflectionLightingMode=same-scene` |
| source renderer | `ironDoorRuntimePlanarReflectionSourceRenderer=main-path-tracer` |
| source bounce mode | `ironDoorRuntimePlanarReflectionSourceBounceMode=main-path-tracer-same-scene-reflection-bounce-source` |
| direct parity | `ironDoorRuntimePlanarReflectionDirectLightMode=main-path-tracer-same-scene` |
| indirect parity | `ironDoorRuntimePlanarReflectionIndirectLightMode=main-path-tracer-bounce-parity` |
| lamp emission | `ironDoorRuntimePlanarReflectionCeilingLampEmissionMode=path-tracer-emission-uniform` |
| source scene kind | `main_path_tracer_mirrored_runtime_planar_source` |
| visual parity status | `same_scene_source_pending_fix7_visual_gate` |
| unmapped fallback | `ironDoorRuntimePlanarReflectionUnmappedFallbackMode=same-scene-pbr-shadow` |
| gate | Chrome + Metal, SPP=1, no context lost, no shader validation error, no 404, diagnosticEventCount=0 |
| same-scene bake source | `bakeLitReady=true`, `fullRoomBakeReady=true`, `sameSceneBakeSourceReady=true` |

## 硬邊界

| Item | Decision |
|---|---|
| Authority | FIX7：metalness=1、roughness=0.3、光 BAKE、reflection LIVE。 |
| Runtime candidate | Runtime planar camera + same-scene render parity。 |
| Regression baseline | v2 restore 只用來確認 projection 沒退步。 |
| SPP | gate 與 smoke 固定 SPP=1。 |
| GPU | 只跑 Chrome + Metal。 |
| Stop condition | WebGL context lost、shader validation error、404、validation fail 時停止。 |
| Bake work | 這階段不產生新高 SPP probe，也不跑 full-room bake。 |
| Iron door material | metalness=1、roughness=0.3。 |
| LIVE fallback | FIX7 LIVE 只作對照；runtime planar 候選不能 fallback。 |

## 施工任務

### Task 1: 鎖住 runtime planar camera

- [x] 鏡射相機跟著玩家位置與視線方向更新。
- [x] render target 使用受控解析度，現在為高度 1024，依 aspect 算寬。
- [x] shader 使用 texture matrix 投影，不使用 captured static planar。
- [x] runtime planar branch 優先於 captured planar / captured probe 診斷。

### Task 2: 記錄 rejected proxy source

- [x] mapped ShaderMaterial 取得 full-room bake / XATLAS bake。
- [x] visible unmapped box 使用 `MeshLambertMaterial`，避免純 base-color 素胚。
- [x] source scene 保留簡化 scene lights，供 unmapped fallback 使用。
- [x] ceiling lamp mesh 使用 path tracer 的 `uLightEmission`，保留 HDR 發光面。
- [x] mapped bake surface 補 path tracer 同源的 ceiling direct-light parity。
- [x] west / threshold 這類已含 direct 的 rect 由 helper 跳過 direct。
- [x] 使用者肉眼回報：亮度提高，但光影單調，FIX7 層次仍未達標。
- [x] 結論：proxy bake-lit source failed FIX7 visual gate。

### Task 3: 重建 same-scene source contract

- [x] 盤點主畫面 shader 中 FIX7 LIVE reflection 依賴的光照成分：direct NEE、indirect bounce、rough metal sampling、baked first-hit surfaces、material albedo。
- [x] 設計 runtime planar source，使鏡射相機拍到的內容與主畫面使用同一套 bake/material/light/shadow 語意。
- [x] `same-scene` 正式來源改為主 path tracer 鏡射相機 1 SPP offscreen pass。
- [x] source scene 報告必須明列 `same_scene_render_parity` 或具體缺口，避免再用 proxy 當正式候選。
- [x] 正式預設 source mode 改為 `same-scene`，manual / bake-lit 保留為 diagnostic。
- [x] proxy source 保留為 `bake-lit` / `manual-light-debug` diagnostic，不再作正式候選。
- [x] runtime planar path-traced source pass render 完成後還原主相機、主累積、texture uniform 與 renderer target。
- [x] same-scene gate 必須看到 `main_path_tracer_mirrored_runtime_planar_source` 與 `SourceRenderer=main-path-tracer`。
- [x] v7 source pass 期間暫停 first-hit bake/runtime uniforms 的 ROADMAP 判斷標為錯誤。
- [x] v10 source pass 保留主場景 bake/runtime uniforms，讓鏡射相機來源沿用 FIX7 場景語意。
- [x] same-scene gate 必須看到 `source_bounce_mode_main_path_tracer_same_scene_reflection_bounce_source`。
- [ ] 只有 same-scene source 通過 FIX7 同鏡頭肉眼 gate，才進入正式候選。

### Task 4: 驗證工具

- [x] smoke tool 可固定使用者回報 camera state。
- [x] smoke tool 固定 SPP=1。
- [x] smoke JSON 回報 lighting mode、unmapped fallback、direct-light mode、indirect-light mode、source renderer、lamp emission mode。
- [x] smoke source mode 判斷改為讀 URL / CLI 預期值；`bake-lit` 不能再被 `manual-light-debug` 硬判斷卡住。
- [x] smoke JSON 回報 source scene kind 與 visual parity status。
- [x] smoke JSON 回報 source bounce mode，並要求 `main-path-tracer-same-scene-reflection-bounce-source`。
- [x] smoke 預設預期值改成 `same-scene`。
- [x] smoke 在 same-scene gate 前等待 `loadR7310C1XatlasMasterAll('raw')`，並驗證 `sameSceneBakeSourceReady=true`。
- [x] smoke 的 same-scene ready 條件改成主 path tracer source，不接受 `scene_boxes` proxy source。
- [ ] 加鐵門主平面 ROI metric，避免整張圖平均值掩蓋局部錯誤。

### Task 5: FIX7 視覺 gate

- [x] 同鏡頭跑 FIX7 1 SPP 截圖。
- [x] 同鏡頭跑 runtime planar bake-lit direct parity 1 SPP 截圖。
- [x] 肉眼檢查結果：內容位置已會跟視角變動；光影層次未達 FIX7。
- [x] bake-lit direct parity 標為 failed visual gate。
- [x] same-scene source candidate 通過 Chrome + Metal SPP=1 smoke gate。
- [ ] same-scene source candidate 同鏡頭肉眼對照 FIX7。

## 驗證指令

```bash
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs
node docs/tests/r7-3-10-iron-door-runtime-planar-camera.test.js
node docs/tests/r7-3-10-cache-bust-contract.test.js
node docs/tests/r7-3-10-xatlas-shader-compile-smoke-spp-cap.test.js
```

Chrome + Metal SPP=1 candidate gate:

```text
http://localhost:9002/Home_Studio.html?atlasMaster=raw&ironDoorReview=runtimePlanar&ironDoorCamera=front&cb=r7310-iron-door-runtime-planar-main-shader-v13-direction-cone
```

Expected smoke fields:

```text
sampleCounter=1
mode=runtime_planar_reflection_camera
ironDoorRuntimePlanarReflectionLightingMode=same-scene
ironDoorRuntimePlanarReflectionSourceRenderer=main-path-tracer
ironDoorRuntimePlanarReflectionSourceSceneKind=main_path_tracer_mirrored_runtime_planar_source
ironDoorRuntimePlanarReflectionSourceBounceMode=main-path-tracer-same-scene-reflection-bounce-source
ironDoorRuntimePlanarReflectionDirectLightMode=main-path-tracer-same-scene
ironDoorRuntimePlanarReflectionIndirectLightMode=main-path-tracer-bounce-parity
ironDoorRuntimePlanarReflectionVisualParityStatus=same_scene_source_pending_fix7_visual_gate
ironDoorRuntimePlanarReflectionSameSceneBakeSourceReady=true
shaderErrorCount=0
programInvalidCount=0
pageLoaded=true
diagnosticEventCount=0
```

## 下一動

下一步是同鏡頭跑 `runtime_planar_main_shader_v10_same_scene_bake` 的 Chrome + Metal SPP=1 gate，再與 FIX7 權威網址並排看主燈亮斑、黑玻璃感、房間暗部、木門/床/吸音板位置。若仍有光影落差，優先查 offscreen source 的 texture color space、sampleCounter normalization 與 rough prefilter。Chrome + Metal gate 固定 SPP=1。
