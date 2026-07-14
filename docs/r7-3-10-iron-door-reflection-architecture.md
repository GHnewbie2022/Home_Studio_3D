# R7-3.10 Iron Door Reflection Architecture

Date: 2026-06-24

## Current Reference

FIX7 remains the trusted visual reference:

`http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-body-fix7`

Reference meaning:

```text
1. Iron door diffuse lighting is baked.
2. Iron door reflection is still resolved by the live path tracer.
3. Metalness remains 1.0.
4. Roughness remains 0.3.
```

## Official Rendering Pattern Notes

Official references:

```text
1. Unity Reflection Probes
   https://docs.unity3d.com/Manual/ReflectionProbes.html

2. Unity advanced reflection probe box projection
   https://docs.unity3d.com/Manual/AdvancedRefProbe.html

3. Unity Probe Blending
   https://docs.unity3d.com/Manual/AdvancedRefProbe.html

4. Unreal Reflection Captures
   https://dev.epicgames.com/documentation/en-us/unreal-engine/reflections-captures-in-unreal-engine

5. Unreal Planar Reflections
   https://dev.epicgames.com/documentation/en-us/unreal-engine/planar-reflections-in-unreal-engine
```

Official Source Check:

```text
Checked on 2026-06-25.

1. Unity Manual Reflection Probes
   Source role:
     A reflection probe captures scene surroundings into a cubemap from a probe position.
   Applicable route:
     Corrected local cubemap probe.
   Iron-door condition:
     Accept only when all six faces come from scene capture, face order is proven, and self-capture is excluded.

2. Unity Manual Advanced Reflection Probe Features
   Source role:
     Box projection and probe blending are local reflection probe features.
   Applicable route:
     Corrected local cubemap probe and far-field supplement.
   Iron-door condition:
     Accept box projection only when the receiver is inside the projection volume.
     Use blending only between valid captures; it does not repair wrong placement, wrong face choice, or self-capture.

3. Unreal Engine Reflections Captures
   Source role:
     Reflection captures provide placed probe data and lightmap mixing for rough materials.
   Applicable route:
     Low-frequency captured reflection plus baked diffuse lighting.
   Iron-door condition:
     Use captured room radiance as support only after near-field plate reflection is proven against FIX7.

4. Unreal Engine Planar Reflections
   Source role:
     Planar reflection renders a mirrored view for flat reflective surfaces.
   Applicable route:
     Planar reflection capture and hybrid resolve.
   Iron-door condition:
     Accept only when mirrored-camera capture, receiver-plane projection, self-capture exclusion, and roughness 0.3 prefilter all pass.
```

## Official Source Evidence

Unity official excerpt:

```text
"captures a spherical view of its surroundings in all directions"
"stored as a Cubemap"
```

Chinese reading:

```text
Unity 的 Reflection Probe 是在一個定點擷取周圍六向環境，再存成 cubemap 給反射材質使用。
因此 R7-3.10 的正式 local cubemap package 必須真的來自場景 capture，
並且要保留 face order、orientation、capture point、projection volume 與 self-capture exclusion 證據。
程式色塊、單張假圖、或沒有六面 capture 證據的 package，直接標 failed_candidate。
```

Room-size probe volume:

```text
Unity official excerpt:
"set the size to match the dimensions of the room"

Chinese reading:
室內 box projection 的有效範圍要對齊房間尺寸。
鐵門 receiver 若在 projection volume 外側，該 cubemap 不能當正式候選。
Captured local cubemap can only be accepted when receiver volume、face selection 與 box projection diagnostic 全部通過。
```

Probe blending:

```text
Probe blending is transition evidence only.
It can smooth movement between probe captures, but it does not fix a receiver outside the projection volume,
self-capture, wrong face orientation, or a near-field flat metal surface split across cubemap faces.
For the iron door main plate, blending can only be a far-field or low-frequency supplement after planar or LIVE parity is proven.
```

Epic official excerpt:

```text
"placed reflection probes to capture and project reflections"
"mirror-like reflections"
```

Chinese reading:

```text
Unreal 的 reflection capture 是放置 probe 擷取並投射反射。
Unreal 的 planar reflection 文件把平面反射用在 mirror-like reflective surface。
鐵門主板是近距離、平面、metalness=1、roughness=0.3 的反射 receiver，
所以 Planar or hybrid resolve is the primary formal route.
```

Smooth flat receiver:

```text
Smooth flat metal surfaces expose projection mismatch quickly.
For this iron door, any face seam, warped split, self-capture, or receiver-outside-volume evidence blocks acceptance.
```

Roughness 0.3 implication:

```text
Roughness 0.3 still needs reflection detail, but should receive prefiltered or mixed reflection energy.
The formal candidate may blur or mix reflection according to roughness, but it cannot use manual brightness compensation.
```

Lightmap mixing role:

```text
The baked diffuse light is the stable low-frequency lighting anchor for the iron-door body.
The reflection replacement still has to carry near-field reflected detail through planar capture or LIVE fallback.
manual brightness compensation remains forbidden.
```

Roughness mip role:

```text
Roughness 0.3 requires a prefiltered or blurred reflection level before runtime acceptance.
The roughness mip can soften reflection noise and sharpness, but it cannot correct wrong projection, missing reflected objects, or wrong capture energy.
```

Project interpretation:

```text
1. Local cubemap probe
   Good for low-frequency room reflection and rough surfaces.
   Risky for near-field flat metal because one receiver can cross multiple cubemap faces.

2. Probe blending
   Useful as a transition between valid probes.
   Not a primary route for the iron-door flat plate because the current failure is receiver/projection geometry, not just probe switching.

3. Box projection
   Improves local cubemap parallax inside an influence box.
   It does not make a near-field flat mirror physically exact.
   It also fails when the receiver sits outside the projection volume.

4. Roughness prefilter
   Required for roughness 0.3 so the reflection is not unnaturally sharp.
   It cannot fix wrong capture position, wrong projection, or self-capture.

5. Planar reflection
   Best fit for the large flat iron-door plate.
   It must use a mirrored camera, clip capture rays at the receiver plane, exclude the receiver from capture, and resolve through the same receiver plane.

6. Hybrid resolve
   Best fit for this room now.
   Diffuse lighting comes from bake.
   The full flat iron-door photo plane reflection comes from planar resolve.
   Baked diffuse light provides stable low-frequency energy; planar reflection keeps near-field reflected detail.
```

Accepted industry-standard route for this iron door:

```text
hybrid_planar_reflection_resolve fixed-camera captured planar candidate is failed_candidate.

FIX7 live reflection remains the accepted runtime reference.

A cubemap-only result can pass only as a low-frequency supplement after probe placement,
face orientation, self-capture exclusion, receiver volume, and roughness prefilter all pass.

A captured planar result can pass only when fixed-camera 1 SPP A/B and free-navigation
view-dependent reflection review both pass against FIX7.

A hybrid result can pass only when the formal staged gate and free-navigation gate pass:
  noise_gate_1_spp

The package status remains candidate until the 1 SPP staged gate passes.
The package status remains failed_candidate when reflected content stays fixed to the acceptance-camera composition during navigation.
The package status remains failed_candidate when any fatal console, shader, WebGL, or visual A/B gate fails.
```

## Candidate Route Comparison

```text
A. Corrected local cubemap probe
   Industry pattern:
     Unity / Unreal reflection probes capture cubemaps from placed points and reproject them through an influence volume.
   Fit for this iron door:
     Useful only as low-frequency far-room fallback.
     Not enough for the near-field flat metal plate because one receiver can expose projection and face seams.
     Probe blending can only smooth transitions between valid probes; it cannot promote this failed cubemap.
   Required gates:
     Correct probe placement.
     Receiver inside influence volume.
     Face-order orientation proof.
     Self-capture exclusion.
     Roughness mip / prefilter.
   Stop condition:
     Any face seam, receiver-outside-volume sample, or self-capture marks failed_candidate.

B. Planar reflection capture
   Industry pattern:
     Planar reflection renders the scene from a mirrored camera for a flat reflective plane.
   Fit for this iron door:
     Best fit for the large flat door plate if the capture is tied to the current view or fixed acceptance view.
   Required gates:
     Mirror camera computed from the acceptance camera and receiver plane.
     Capture clip plane enabled.
     Door self-capture excluded.
     Projective lookup uses the same receiver plane and camera matrices.
     Roughness 0.3 prefilter.
   Stop condition:
     Reflection content image mismatch, projection mismatch, or auxiliary visual diff metric failure marks failed_candidate.

C. Hybrid resolve
   Industry pattern:
     Unreal combines reflection captures, lightmaps, and screen/planar methods depending on roughness and visible artifacts.
   Fit for this iron door:
     Current best next candidate.
     Keep baked diffuse lighting.
     Use planar reflection for the full flat iron-door photo plane.
     Use numeric A/B to prove parity for that full photo plane.
   Required gates:
     UI can switch FIX7 reference and hybrid candidate.
     Receiver mask proves the single photo plane replacement.
     1 SPP noise is not worse than FIX7.
     1 SPP reflected content image matches FIX7 on the full photo plane.
     Luma and RGB diff metrics remain auxiliary numeric signals.
   Stop condition:
     Any visible mismatch on the full flat photo plane marks failed_candidate.
```

## Current Candidate Status

### Captured Local Cubemap

Status: `failed_candidate`

Evidence:

```text
1. Receiver is outside the declared projection volume.
2. One visible iron-door surface maps into multiple cubemap faces.
3. Self-capture was included.
4. User observed cut-up reflection and non-physical spatial split.
```

Pointer:

`docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json`

Failure reason:

`iron_door_box_projected_cubemap_multi_face_split`

### Scene Planar Probe v1

Status: `failed_candidate`

Evidence:

```text
1. User observed a reflection position mismatch against FIX7.
2. User observed brightness and color mismatch against FIX7.
3. The candidate looked like non-physical split space from the acceptance camera.
4. It did load, so this is a visual and projection failure, not a 404/package failure.
5. The capture excluded the door body but did not clip mirrored-camera rays at the receiver plane before scene trace.
```

Pointer:

`docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json`

Failure reason:

`planar_scene_probe_visual_mismatch_against_fix7`

Blocked Runtime URLs:

```text
1. http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-iron-door-scene-probe-v1
```

These URLs are historical failed-candidate entry points. They remain useful as evidence, but the preflight publish gate must not expose them as acceptance URLs.

### Scene Planar Clip Candidate

Status: `failed_candidate`

Evidence:

```text
1. It uses the same mirrored-camera planar capture path.
2. It adds captureClipPlane.enabled=true.
3. Capture rays are clipped at the iron-door receiver plane before scene trace.
4. User-observed failure is severe reflection content image mismatch against FIX7.
5. ROI mean luma ratio was 0.558; this remains an auxiliary numeric signal.
6. Mean absolute RGB difference was 16.688; this remains an auxiliary numeric signal.
7. The candidate missed the FIX7 reflected content and cannot be accepted.
```

Pointer:

`docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json`

Failure reason:

`planar_scene_probe_reflection_content_mismatch_against_fix7`

## Data Flow Root Cause

```text
1. corrected_local_cubemap_probe
   Data flow:
     scene_cubemap_capture -> projection_volume -> receiver_sample ->
     box_projected_direction -> face_selection -> atlas_sample

   Failing boundaries:
     receiver_volume_gate
     box_projection_face_selection
     self_capture_exclusion

   Root cause:
     receiver_outside_volume_multi_face_split_self_capture

2. planar_reflection_capture
   Data flow:
     fix7_live_reference -> mirrored_camera_scene_capture -> capture_clip_plane ->
     planar_atlas_slot -> receiver_plane_projection -> fixed_camera_visual_ab

   Failing boundaries:
     reflected_content_parity_gate
     projective_uv_or_reflection_content_mapping_gate
     fix7_visual_ab_metric_auxiliary_gate

   Root cause:
     capture_loaded_but_reflection_content_does_not_match_fix7

3. hybrid_planar_reflection_resolve
   Data flow:
     full_bake_diffuse_light -> full_flat_door_photo_plane_planar_resolve ->
     roughness_0_3_prefilter ->
     fixed_camera_visual_ab -> free_navigation_visual_review

   Failing boundary:
     free_navigation_view_dependent_reflection_gate

   Root cause:
     single_receiver_plane_projective_texture_uses_visible_position_not_current_view_ray_direction

   Next required evidence:
     fresh_scene_capture_package
     fixed_camera_1_spp_same_exposure
     full_flat_door_photo_plane_planar_resolve
     free_navigation_view_dependent_reflection_gate
     external_visual_tool_bridge_v1
     openimageio_diff_report
     webgl_float32_readback_contract
     console_shader_webgl_error_report
     numeric_fix7_visual_ab_report
     human_visual_review
```

## Success Criteria Matrix

The readiness audit exposes this matrix through:

`node docs/tools/r7-3-10-iron-door-reflection-diagnostic.mjs --readiness-audit`

Current matrix:

```text
1. console_no_404
   status: pending_chrome_metal_smoke
   evidence: fresh Chrome/Metal visual A/B gate has not run

2. shader_validation_clean
   status: pending_chrome_metal_smoke
   evidence: fresh Chrome/Metal visual A/B gate has not run

3. webgl_context_stable
   status: pending_chrome_metal_smoke
   evidence: fresh Chrome/Metal visual A/B gate has not run

4. ui_switch_fix7_vs_candidate
   status: contract_present_pending_runtime_smoke
   evidence: hybrid visual A/B runner and report contract are present

5. one_spp_noise_near_or_below_live
   status: pending_visual_ab_capture
   evidence: requires same-camera 1 SPP visual comparison against FIX7

6. one_spp_visual_parity_against_fix7
   status: pending_visual_ab_capture
   evidence: requires fixed-camera 1 SPP visual parity against FIX7

7. free_navigation_view_dependent_reflection
   status: failed_candidate
   evidence: captured planar reflection stays fixed to the acceptance-camera composition during navigation

8. no_face_seam_or_spatial_split
   status: blocked_by_failed_cubemap_and_previous_planar
   evidence: cubemap still maps the door across multiple faces; previous planar package failed visual A/B

9. no_self_capture_or_reflection_misregistration
   status: blocked_by_failed_cubemap_pending_hybrid_capture
   evidence: old cubemap has self-capture; hybrid requires fresh capture evidence

10. acceptance_url_available
   status: blocked_until_candidate_pending_human_visual_review
   evidence: runtimeCandidateUrl is null until fresh capture and human review pass

11. failed_candidate_blocking
    status: pass
    evidence: failed routes have mountBlockers and no runtimeCandidateUrl
```

## Staged Acceptance Gates

The preflight report exposes these gates through:

`node docs/tools/r7-3-10-iron-door-reflection-preflight.mjs`

1 SPP is the only formal acceptance gate for this iron-door reflection path.
It must create fresh FIX7 A/B evidence before an acceptance URL can be exposed.

```text
1. noise_gate_1_spp
   status: next_requires_user_approval
   targetSamples: 1
   purpose: fixed-camera 1 SPP FIX7 A/B gate for the iron door main plate
```

The gate requires Chrome/Metal approval, forbids Brave, and forbids full-room bake.
The publish gate requires the staged gate before a reusable acceptance URL can be exposed.

External visual validation bridge:

```text
1. The formal 1 SPP report must include externalValidation.version=external_visual_tool_bridge_v1.
2. OpenImageIO oiiotool --diff is required for candidate acceptance.
3. The WebGL readback contract must state normalizedBySamples=false for the stored float32 frame.
4. Playwright screenshots and Spector.js frame captures are optional diagnostic aids.
5. Missing or failing external validation blocks candidate_pending_human_visual_review.
```

### Promotion Gate

Status: `active_contract`

Purpose:

```text
1. A visual A/B helper must write the visual report and update the runtime pointer in the same run.
2. failed_candidate pointer and package artifact must stay in sync.
3. A candidate that fails numeric A/B remains blocked from runtime ready state.
4. A candidate that passes numeric A/B may only move to candidate_pending_human_visual_review.
5. Human visual review is still required before any accepted status.
6. The visual report must carry externalValidation with OpenImageIO and WebGL readback status.
```

Current planar v1 scope:

```json
{
  "receiverMask": {
    "kind": "main_flat_door_plate_only",
    "debugMode": "hybrid-mask",
    "shaderFunction": "r7310C1IronDoorMainFlatPlateMask"
  },
  "replacementScope": {
    "planarCandidateRegions": ["full_flat_door_photo_plane"],
    "liveFallbackRegions": [],
    "farFieldProbeRole": "optional_low_frequency_only"
  }
}
```

Runtime behavior:

```text
1. Runtime report exposes receiverMask, replacementScope, acceptanceGates, failureReason, freeNavigationCounterexample, and recommendedNextCandidate.
2. Runtime pointer validation checks receiverMask and acceptanceGates before any package can become ready.
3. failed_candidate is reported for diagnosis and blocked from shader activation.
```

## Architecture Decision

The fixed-camera captured planar candidate is:

`hybrid_planar_reflection_resolve`

Status:

`failed_candidate`

Required next candidate shape:

`view_dependent_planar_reflection_or_fix7_live_reflection`

Required shape:

```text
1. Keep FIX7 as A reference.
2. Keep iron-door light bake as diffuse lighting source.
3. Use a view-dependent reflection path for the full flat iron-door photo plane.
4. Keep the photo texture, metalness=1, and roughness=0.3 contract unchanged.
5. Validate with fixed user camera and free-navigation camera states.
```

Why this is the correct next step:

```text
1. The iron door is a near-field metal plane.
2. Cubemap probe is already proven to split across faces for this receiver.
3. The first planar candidate proved that loading and atlas plumbing work.
4. The clip-plane candidate proved that clipping alone does not solve visual parity.
5. The next candidate must prove parity across the full flat iron-door photo plane.
6. The next candidate must expose numeric diff metrics as auxiliary evidence before visual review.
```

## Stop Conditions

Any new candidate must stop and mark `failed_candidate` when one of these happens:

```text
1. Console 404.
2. Shader validation error.
3. WebGL context lost.
4. Self-capture of the iron-door receiver.
5. Projection UV out of range on the fixed acceptance camera.
6. Reflection position mismatch against FIX7.
7. Reflection content image mismatch against FIX7.
8. Visual diff metric fails against FIX7.
9. 1 SPP noise clearly worse than FIX7.
10. 1 SPP visual parity fails against FIX7.
```

When the Chrome/Metal A/B runner writes a `failed_candidate` report, it must keep the report artifacts and return exit code `1`.
This keeps failure evidence inspectable while preventing automation from treating the gate as passed.

Every route audit must also expose `mountBlockers`.
This is the runtime URL gate, not just a note for humans:

```json
{
  "correctedLocalCubemap": {
    "mountBlockers": [
      "validation_status_failed_candidate",
      "receiver_outside_projection_volume",
      "self_capture_not_excluded",
      "box_projected_cubemap_multi_face_split"
    ]
  },
  "planarReflection": {
    "mountBlockers": [
      "validation_status_failed_candidate",
      "reflection_content_image_mismatch_against_fix7",
      "visual_diff_metric_failed_against_fix7",
      "roi_luma_ratio_aux_metric_outside_gate",
      "mean_abs_rgb_diff_aux_metric_above_gate"
    ]
  },
  "hybridResolve": {
    "mountBlockers": [
      "candidate_pending_implementation",
      "missing_package_dir",
      "chrome_metal_visual_ab_not_run",
      "not_candidate_pending_human_visual_review"
    ]
  }
}
```

## Required Runtime Report Contract

Every candidate report must include:

```json
{
  "ironDoorReflectionFormalReport": {
    "currentMode": "live_reference | captured_probe | planar_reflection_candidate | hybrid_planar_reflection_candidate",
    "packageDir": "string | null",
    "captureKind": "string | null",
    "projectionKind": "string | null",
    "selfCaptureExcluded": true,
    "captureClipPlaneEnabled": true,
    "prefilterKind": "string | null",
    "validationStatus": "candidate_pending_capture | candidate_pending_human_visual_review | failed_candidate | accepted",
    "source": "hybrid_reflection_contract"
  },
  "currentMode": "live_reference | captured_probe | planar_reflection_candidate | hybrid_planar_reflection_candidate",
  "packageDir": "string | null",
  "captureKind": "string | null",
  "projectionKind": "string | null",
  "selfCaptureExcluded": true,
  "captureClipPlaneEnabled": true,
  "prefilterKind": "string | null",
  "validationStatus": "candidate_pending_capture | candidate_pending_human_visual_review | failed_candidate | accepted",
  "failureReason": "string | null"
}
```

## Next Implementation Candidate

Minimum useful version:

```text
1. Add a hybrid planar mode name:
   hybrid_planar_reflection_candidate

2. Add a receiver-plane mask:
   Full flat iron-door photo plane.

3. Add deterministic A/B runner output:
   A = FIX7 live reference.
   B = hybrid planar candidate.
   C = receiver-plane diagnostic.

   Runner flag:
   --r7310-iron-door-hybrid-reflection-visual-ab-test
   --confirm-r7310-iron-door-chrome-metal-capture

4. Add numeric diagnostics:
   projected UV bounds.
   receiver-plane hit ratio.
   self-capture flag.
   mean luma ratio against FIX7 door ROI.

5. Gate acceptance:
   The package cannot move from candidate to accepted until visual A/B passes.
```

Formal contract pointer:

`docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json`

Status:

`failed_candidate`

Scope:

```text
1. Candidate mode
   hybrid_planar_reflection_candidate

2. Planar replacement region
   full_flat_door_photo_plane

3. Planar replacement exceptions:
   none

4. Far-field probe role
   optional_low_frequency_only

5. Free-navigation requirement
   reflected content must change with viewer position and current view ray direction
```

Acceptance numeric gates:

```text
1. Same FIX7 reference camera, exposure, canvas, and SPP.
2. roiMeanLumaRatio 0.75..1.25.
3. meanAbsRgbDiff <= 12.
4. Console 404 count = 0.
5. Shader validation error count = 0.
6. WebGL context lost count = 0.
7. Free-navigation view-dependent reflection gate = pass.
```

Implementation boundary:

```text
1. The hybrid contract is not an accepted runtime output.
2. It only authorizes the next candidate shape.
3. Runtime may report this contract before shader work exists.
4. UI must not present it as accepted until the A/B gate passes.
```

Persistent URL boundary:

```text
1. Hybrid visual A/B may create a fresh planar capture package for evidence.
2. That fresh package may update the reusable runtime pointer only when numeric A/B reaches candidate_pending_human_visual_review.
3. Rejected candidates keep report images and package evidence, but candidateUrl stays null.
4. A reusable URL means the runtime pointer and the visual report point at the same candidate package.
```
