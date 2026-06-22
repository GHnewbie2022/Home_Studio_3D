# R7-3.10 West Wall XATLAS Debug Handoff - 2026-06-22

## 0. Current User Verdict

User-provided comparison on 2026-06-22:

```text
Left  = LIVE authority, 1000 SPP.
Right = current XATLAS RAW after latest pointer change.

User verdict:
  The right side is still visibly brighter than LIVE.
  The fix is not accepted.
  Do not use brightness scaling or visual tuning.
  Continue from architecture / contract / bake-route root cause.
```

Latest user screenshot path:

```text
/var/folders/7p/hcmrsx8515s9v7h3g545ynn80000gn/T/codex-clipboard-01a4bc24-3970-4b87-bcac-2d47b83d77be.png
```

Authority screenshot pair supplied earlier by user:

```text
LIVE:
  /Users/eajrockmacmini/Desktop/截圖 2026-06-21 上午10.42.01 西牆LIVE.png

XATLAS RAW old failing reference:
  /Users/eajrockmacmini/Desktop/截圖 2026-06-21 上午10.42.22 西牆XATLAS 烘焙RAW.png
```

Acceptance target:

```text
West XATLAS RAW/OIDN must visually match LIVE authority for the same camera and UI state.
Any visible west-wall color / light-shape mismatch remains a defect.
No fallback-to-LIVE masking.
No brightness scalar.
No color grading.
No "RAW noise" explanation for structural mismatch.
```

## 1. Repo / Branch / Current Worktree

Workspace:

```text
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D
```

Known pushed commits before this handoff:

```text
07f226b  R7-3.10 split runtime bake debug shader variants
dfadec1  R7-3.10 R4-2A-2 success-path parameterization
```

Current worktree is intentionally dirty. Do not restore globally. There are many uncommitted R4-2C west files.

Tracked modified files observed at 2026-06-22 04:20:

```text
Home_Studio.html
docs/data/r7-3-10-surface-owner-registry.json
docs/generated/r7-3-10-surface-owner-table.mjs
docs/generated/r7-3-10-surface-owner.glsl.frag
docs/generated/r7-3-10-surface-owner.py
docs/generated/r7-3-10-xatlas-param-table.generated.json
docs/tools/r7-3-10-oidn-bridge.mjs
docs/tools/r7-3-10-surface-owner-scanner.mjs
docs/tools/r7-3-10-xatlas-param-checker.mjs
docs/tools/r7-3-10-xatlas-param-codegen.mjs
docs/tools/r7-3-8-c1-bake-capture-runner.mjs
js/Home_Studio.js
js/InitCommon.js
shaders/Home_Studio_Fragment.glsl
```

Important untracked files that are part of R4-2C work and must not be ignored in a final commit:

```text
docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-west-wall-1000spp-oidn-runtime-package.json
docs/tools/r7-3-10-full-west-wall-xatlas-c2c-mask.py
docs/tools/r7-3-10-full-west-wall-xatlas-package.mjs
docs/tools/r7-3-10-full-west-wall-xatlas-phase2-prepare.py
docs/tools/r7-3-10-master-contract-check.mjs
docs/tools/r7-3-10-surface-axis-spec.json
```

## 2. Current Pointer State

As of the last attempted fix, the RAW pointer has been switched from indirect-only to the existing full-radiance package.

RAW pointer:

```text
docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json

packageDir:
  .omc/r7-3-10-xatlas-bake-spike/20260621-175308

bakedRadianceKind:
  full_diffuse_radiance

directLightAlreadyIncluded:
  true

addDirectLightAfterBakeLookup:
  false

bakeAlbedoFree:
  true

multiplyAlbedoAfterBakeLookup:
  true

phase2.westFullRadianceBake:
  true
```

OIDN pointer:

```text
docs/data/r7-3-10-xatlas-full-west-wall-1000spp-oidn-runtime-package.json

packageDir:
  .omc/r7-3-10-xatlas-bake-spike/20260621-175308-oidn-rtlightmap-high-beta

bakedRadianceKind:
  full_diffuse_radiance

directLightAlreadyIncluded:
  true

addDirectLightAfterBakeLookup:
  false

bakeAlbedoFree:
  true

multiplyAlbedoAfterBakeLookup:
  true
```

User verdict after this pointer change:

```text
Still not accepted.
Right/XATLAS still appears brighter than LIVE.
```

## 3. High-Level Debug Timeline

### 3.1 Shader Capacity Work Before West Bake

```text
T0:
  Minimal DCE-proof marker recompile.
  Result: NO LOSS.

T1:
  West-size neutral payload.
  Result: NO LOSS.

T2a:
  West uniform declarations only.
  Result: NO LOSS.

T2b:
  Owner const / pending / if-chain.
  Result: NO LOSS.

T2c:
  West UV function present but not reachable.
  Result: NO LOSS.

T2d / U-subtests:
  West UV success path reachable.
  Result: context loss until shader split / cleanup / parameterization.
```

Resolution:

```text
R4-2A:
  Runtime / bake / debug shader variants.
  Runtime variant can hold complete west success path.

R4-2A-2:
  Success-path parameterization with uniform array and dynamic while loop.
  P0 loop-unroll test:
    N=1 / N=17 / N=26 all firstFrame around 27.1s.
  Conclusion:
    Param loop did not expand per face; compile-stall solved.
```

### 3.2 West Carrier Chain / Runtime Setup

```text
R4-2C carrier chain:
  Added west owner / pending / baked policy through registry and owner codegen.
  Added west param table entry.
  Added west package helper.
  Added west prepare and c2c mask tools.
  Added master contract checks.
  Added scanner vertical-wall sampling.

P6 headless regression:
  Five existing faces loaded.
  West missing pointer produced expected pending behavior.
  runtimeError = null.
  Scanner DEV warned; FORMAL blocked until west baked.
```

### 3.3 First Major Runtime Failure: Master Texture Too Large

Symptom:

```text
West XATLAS appeared as LIVE / not lightmap.
```

Evidence:

```text
CPU master buffer had west alpha/RGB.
GPU sample of giant master texture returned incomplete texture signature.
8923 x 7645 Float32 RGBA was about 1.09 GB.
M4 Metal / ANGLE could not upload it reliably.
```

Fix:

```text
js/InitCommon.js
createR7310C1XatlasRuntimeTexture:
  Float32 texture -> HalfFloat texture.
  Added Float32 RGBA to half-float conversion.

Result:
  Full master texture uploads and samples.
```

Status:

```text
Accepted as necessary infrastructure fix.
This did not solve final west brightness/color mismatch.
```

### 3.4 Bake Bug: Dead White From Albedo Skip

Symptom:

```text
West bake was too bright / dead white.
```

Root cause:

```text
r7310C1XatlasSeparatedBakeSkipsSurfaceAlbedo() was missing a first-hit-only guard.
It was inserted at many bounce points.
Bake skipped albedo attenuation for every bounce.
Indirect light became too bright.
```

Fix:

```text
Removed that function and restored mask *= hitColor at affected bounce points.
Runtime behavior should remain unchanged.
```

Result:

```text
New west RAW meanLum dropped from about 0.619 to about 0.340 / 0.302 depending package.
Dead-white failure improved.
```

Status:

```text
Necessary fix.
Final visual mismatch remains.
```

### 3.5 Full Coverage / Exclusion Mask Removal

Old issue:

```text
West had branch red / LIVE fallback holes.
Root was human-authored exclude mask:
  door hole
  beam
  column
```

User clarified:

```text
West must have full coverage.
No intentional excluded region.
Any LIVE fallback or hole is a defect.
```

Fix:

```text
Prepare valid coverage became chart-bounds based.
c2c-mask became full coverage except gutter.
axis-spec west ironDoorHole removed.
param specialExclusionId and rectHole removed for west.
checker hardened.
registry note updated.
```

Result:

```text
Grid branch probe green 100%.
No LIVE fallback holes.
```

Status:

```text
Necessary fix.
Final visual mismatch remains.
```

### 3.6 Door Threshold Black Patch

Symptom:

```text
Iron door threshold / wall-foot area was black after full-coverage bake.
```

Root cause:

```text
Two west threshold bake early-break branches made threshold texels alpha=1 but RGB near zero.
```

Fix:

```text
Removed:
  r7310XatlasWestThresholdFirstHitBake
  r7310XatlasWestThresholdIndirectBounce

Then rebaked RAW and OIDN.
```

Result:

```text
User confirmed threshold black issue was fixed.
```

Status:

```text
Accepted by user.
Final brightness/color mismatch remains.
```

### 3.7 Last Attempt: Switch RAW Pointer To Full Radiance

Observation:

```text
Indirect-only RAW looked flat / lacking LIVE directionality.
Old D800 behavior appeared closer to full diffuse radiance.
Existing west full-radiance package was available:
  .omc/r7-3-10-xatlas-bake-spike/20260621-175308
```

Action taken:

```text
Regenerated RAW pointer from the full-radiance package using:

node docs/tools/r7-3-10-full-west-wall-xatlas-package.mjs \
  --raw-dir=.omc/r7-3-10-xatlas-bake-spike/20260621-175308 \
  --prepare-dir=.omc/r7-3-10-full-west-wall-xatlas-phase2/20260621-101747-fullcov/xatlas-bake-full-west-wall \
  --write-raw-pointer=docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json \
  --out-summary=/private/tmp/r7310-west-full-radiance-raw-pointer-summary.json
```

Measurement from headless Chrome, same camera, 1000 SPP:

```text
Screens:
  /private/tmp/r7310-west-raw-full-1000/live_path.png
  /private/tmp/r7310-west-raw-full-1000/xatlas_raw.png
  /private/tmp/r7310-west-raw-full-1000/live_vs_xatlas_full_side_by_side.png
  /private/tmp/r7310-west-raw-full-1000/live_vs_xatlas_full_diff4x.png

ROI luma:
  west_upper        live 148.543  xatlas 140.599  ratio 0.9465
  west_left         live 134.753  xatlas 132.478  ratio 0.9831
  west_right        live 181.329  xatlas 180.330  ratio 0.9945
  gik_shadow_band   live 179.749  xatlas 185.420  ratio 1.0315
  door_side         live 152.150  xatlas 151.952  ratio 0.9987
  west_big_no_ui    live 158.861  xatlas 157.041  ratio 0.9885
  whole_canvas      live 126.314  xatlas 124.119  ratio 0.9826
```

User verdict after manual comparison:

```text
Still not fixed.
XATLAS still visibly brighter / different.
Do not stop here.
```

Important caveat:

```text
The helper changed pointer state, but CDP report still showed:
  fullWestWallDirectIncluded false

This may indicate stale JS reporting, load order, or that shader does not consume direct-included state.
The visual improved, but report-state mismatch must be investigated.
```

## 4. Known Exclusions / Ruled-Out Causes

```text
1. Browser cache as the main cause
   Fresh headless profiles reproduced key failures.
   The user also hard reloaded multiple times.

2. GPU uniform array upload failure
   Direct GPU uniform probes showed west param modeId/index/rect/normal correctly uploaded.

3. UV / flip / rect major bug
   CPU projection checks mapped west points to valid atlas pixels.
   Flip-U / Flip-V tests did not produce a correct match.

4. Alpha coverage / LIVE fallback holes
   Branch grid probe reached green 100% after full coverage changes.

5. OIDN as root cause
   RAW already shows mismatch.
   OIDN only smooths; user explicitly rejected OIDN explanation.

6. Door threshold black issue
   Fixed and user accepted.

7. Master texture giant Float32 upload
   Fixed with HalfFloat.

8. Albedo skip all-bounce dead-white bug
   Fixed by removing bad skip function.
```

## 4.1 Additional Evidence From 2026-06-22 Follow-Up

User direction for this pass:

```text
Do not stare at west wall alone.
Compare west against north / east / ceiling / floor because they should share the same structural bake model.
West being visibly different means one contract or route is diverging.
```

Cross-wall package contract:

```text
Accepted RAW pointers:
  north   indirect_diffuse_radiance, directLightAlreadyIncluded=false, addDirectLightAfterBakeLookup=true
  east    indirect_diffuse_radiance, directLightAlreadyIncluded=false, addDirectLightAfterBakeLookup=true
  ceiling indirect_diffuse_radiance, directLightAlreadyIncluded=false, addDirectLightAfterBakeLookup=true
  floor   indirect_diffuse_radiance, directLightAlreadyIncluded=false, addDirectLightAfterBakeLookup=true

Current west RAW pointer:
  west    full_diffuse_radiance, directLightAlreadyIncluded=true, addDirectLightAfterBakeLookup=false
```

This is the strongest structural divergence from the accepted walls.

Pointer / JS / uniform propagation was verified:

```text
xatlas_raw:
  fullWestWallActive=true
  fullWestWallDirectIncluded=true
  paramWestModeId=1
  westDirectIncluded=1

live_path:
  fullWestWallActive=false
  fullWestWallDirectIncluded=false
  paramWestModeId=0
  westDirectIncluded=0
```

Current conclusion:

```text
The fullWestWallDirectIncluded flag reaches runtime.
The main defect is not stale pointer or missing uniform upload.
```

Fresh full-radiance 1000 SPP bake:

```text
New package:
  .omc/r7-3-10-xatlas-bake-spike/20260622-045028

Result:
  Texture stats matched the older full-radiance package.
  64/1000 SPP ROI ratios stayed effectively unchanged.

Conclusion:
  Package staleness / old pointer freshness is ruled out.
```

Runtime contribution split:

```text
Current full package + normal runtime NEE:
  west_big_no_ui ratio about 0.99
  visible shape still rejected by user.

Full package only, with NEE skipped after XATLAS add:
  west_big_no_ui ratio about 0.90
  too dark.

Runtime NEE only, with XATLAS texture add disabled:
  west_big_no_ui ratio about 0.75
  significant runtime contribution exists.

Interpretation:
  The current image is a combination of an underpowered full texture plus runtime NEE.
  That combination makes average ROI numbers look close while preserving visible spatial mismatch.
```

Failed / low-value trials added in this pass:

```text
1. direct-included break immediately after baked add
   Result: too dark, west_big_no_ui ratio about 0.90.

2. direct-included skip-NEE after local hybrid terms
   Result: same too-dark profile, west_big_no_ui ratio about 0.90.

3. west dedicated hybrid guard / west beam shadow re-enable
   Result: no meaningful ROI movement.

4. temporary west param handoff exclusion
   Numeric version ran correctly.
   Result: almost unchanged from baseline.

5. xatlas direct-only with uMaxBounces=1
   Result: invalid as direct evidence because uMaxBounces=1 can also cut off NEE hit completion.
   Superseded by the runtime NEE-only test above.

6. diffuseOnly disabled for a 64 SPP full-path diagnostic bake
   Result: no meaningful texture-stat improvement.

7. full west-only hybrid guard experiment
   Temporarily added !r7310XatlasRuntimeFirstHit to:
     west wall, west wall beam, SW column inner, west beam inner, west beam under, iron door reveal hybrid additions.
   256 SPP result matched baseline:
     west_big_no_ui ratio 0.9886
     gik_shadow_band ratio 1.0315
   Conclusion: west-only hybrid double-add is not the current main driver.

8. direct-included skip runtime NEE plus allow diffuse continuation
   Temporary shader test:
     let full-west directIncluded XATLAS first-hit skip runtime NEE
     allow that first-hit to continue with diffuse bounce
   256 SPP result:
     west_upper       ratio 1.0261
     west_left        ratio 1.0318
     west_right       ratio 1.0353
     gik_shadow_band  ratio 1.0306
     door_side        ratio 1.0310
     west_big_no_ui   ratio 1.0312
     whole_no_ui      ratio 1.0283
   RGB result:
     west_big_no_ui ratio RGB [1.0232, 1.0324, 1.0473]
     gik_shadow_band ratio RGB [1.0233, 1.0317, 1.0434]
   Conclusion:
     This made the image brighter and kept blue strongest.
     It rules out "skip runtime NEE and continue diffuse" as a fix.
     The temporary shader patch was reverted after recording this result.
```

Important live-authority note:

```text
The current two-case probe live_path only disables the west wall runtime path.
It still loads and uses other accepted XATLAS/master faces.

An earlier pure-live check using JS setters produced a brighter reference.
That result is now considered a setter-side-effect diagnostic, not the authority.

Direct uniform-zeroing live calibration supersedes it:
  256 SPP mixed live_path and true_live matched within noise.
  west_big_no_ui:
    mixed_live 158.855
    true_live  158.848

Meaning:
  For the current camera, the existing live_path is an acceptable LIVE authority.
  Do not chase the earlier brighter pure-live setter result as the root cause.
```

Additional contract / texture probes:

```text
No-runtime-albedo test:
  uR7310C1XatlasRuntimeSeparatedAlbedo forced to 0.0.
  west_big_no_ui ratio stayed about 0.989.
  Conclusion: runtime albedo multiplication is not the current mismatch driver.

Same fullcov west metadata, indirect contract candidate:
  Pointer temporarily switched to .omc/r7-3-10-xatlas-bake-spike/20260622-001131.
  It uses indirect_diffuse_radiance, directLightAlreadyIncluded=false, addDirectLightAfterBakeLookup=true.
  256 SPP result:
    west_upper       ratio 0.8791
    west_left        ratio 0.9109
    west_right       ratio 0.8952
    gik_shadow_band  ratio 0.9321
    door_side        ratio 0.9238
    west_big_no_ui   ratio 0.9038
    whole_no_ui      ratio 0.9155
  Conclusion: simply returning west to the same indirect contract as north/east/ceiling/floor is too dark.

Atlas numeric split:
  west_full_old/fresh mean 0.619291, p50 0.713539, p95 1.018248.
  west_indirect mean 0.302258, p50 0.343127, p95 0.452669.
  east_indirect mean 0.381735, p50 0.378654, p95 0.480604.
  max(west_full - west_indirect, 0) mean 0.316648, p50 0.343274, p95 0.661752.
  Conclusion: west texture distribution is genuinely different from east and from its own full/indirect split.

RGB split from the latest continuation:
  Current full texture + runtime NEE baseline:
    west_big_no_ui live [168.28,157.96,139.85], xatlas [165.02,156.15,142.28], ratio [0.9806,0.9886,1.0174]
    gik_shadow_band live [186.96,179.08,164.84], xatlas [189.52,184.97,177.43], ratio [1.0137,1.0329,1.0764]
  Full-only:
    gik_shadow_band ratio [0.9280,0.9181,0.9194]
  Runtime NEE-only:
    gik_shadow_band ratio [0.8061,0.7851,0.7820]
  Conclusion:
    Full-only and NEE-only are both too dark by themselves.
    The visible cold/blue result appears after their runtime composition.
    Next debug should compare pre-tonemap contribution, not only final ROI luma.
```

Runtime route difference against east:

```text
east:
  dedicated r7310C1XatlasFullEastWallUv()
  has r7310C1EastWallHiddenByBeamOrSeColumn()

west:
  generic r7310C1XatlasParamSurfaceUv()
  no dedicated west UV helper in the accepted-wall style
  param path owns the west surface through table modeId

Temporary numeric handoff exclusion in param path did not fix current ROI.
Keep this as a structural difference to review, not the proven root.
```

Cross-wall atlas statistics from 2026-06-22 continuation:

```text
Same dimensions:
  west 2325x3945
  east 2325x3945

Alpha coverage:
  west alpha=1 texels 7,242,563
  east alpha=1 texels 6,331,424
  west accepts about 911k more texels.

Clean-wall indirect mean luma:
  west_indirect main clean wall 0.378655
  east_indirect main clean wall 0.391799

Interpretation:
  West indirect texture is not globally underpowered relative to east.
  The too-dark west indirect runtime result is more likely in runtime composition / direct contribution / continuation behavior than in the atlas texture alone.
```

West full-vs-indirect regional split:

```text
main_clean_wall:
  full 0.796704
  indirect 0.376613
  full/indirect 2.1154

upper_wall_clean:
  full 0.632505
  indirect 0.313373
  full/indirect 2.0184

threshold_band:
  full 0.532875
  indirect 0.330741
  full/indirect 1.6112

door_hole_rect:
  full 0.064396
  indirect 0.064381
  full/indirect 1.0002

Conclusion:
  The main full/indirect divergence exists across clean wall regions, not only the door/beam/column special regions.
  Door hole content is dark and nearly identical in full vs indirect; it is not the current brightness root by itself.
```

Diagnostic tool fix made in this continuation:

```text
js/InitCommon.js:
  reportR7310C1FullRoomDiffuseRuntimeProbe clamp changed from max 53 to max 56.
  reportR7310C1XatlasRuntimeDiagnostic now maps world positions through a runtime dispatcher.
  The dispatcher handles west full-wall world->UV first, then falls back to north.
  Full north diagnostic mapping now applies the master rect transform instead of returning local UV.

Reason:
  r7310C1RuntimeProbeDecodeModeForLevel already defines levels 54, 55, 56.
  reportR7310C1XatlasRuntimeDiagnostic requests level 54 by default.
  The old clamp silently forced 54 to 53, so finalRuntimeSource never ran.
  The old diagnostic also hard-mapped every world position through r7310C1XatlasNorthWallUvFromWorldPosition, which invalidated west-wall samples.

Verification:
  node --check js/InitCommon.js passed.
  node docs/tools/r7-3-10-xatlas-param-checker.mjs passed.
  node docs/tools/r7-3-10-master-contract-check.mjs passed.
  git diff --check -- js/InitCommon.js docs/r7-3-10-west-wall-xatlas-debug-handoff-20260622.md shaders/Home_Studio_Fragment.glsl passed.
  node --test docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js passed.

Known test issue:
  node --test docs/tests/r7-3-10-metal-bake-shader-contract.test.js failed.
  Failure expects createR7310BakeOnlyNoBorrowMaterial() inside captureR738C1DirectSurfaceTexelPatch.
  Current code uses createR7310BakeCaptureMaterial(useBakeOnlyNoBorrowShader).
  This appears to be a stale test expectation relative to current code, not caused by the diagnostic mapper change.
```

Automation note:

```text
Attempted to run a Chrome/CDP west route probe for levels 22/23/24/25/26/38/39/40/45/46.
The sandbox escalation reviewer rejected local Chrome/CDP launch.
No browser probe result was produced in this continuation.
```

Prepare / owner-gate difference against accepted walls:

```text
west fullcov prepare:
  decisionSource = full west-wall chart coverage
  ownerGateSplit accepts:
    door_hole_center
    sw_column_region
    beam_region

east prepare:
  decisionSource = full east-wall single-plane atlas validity; runtime owner gate handles exclusions
  ownerGateSplit rejects:
    se_column_region
    beam_region

north prepare:
  ownerGateSplit rejects:
    door_hole_center
    west_beam_gap
    east_beam_gap

Conclusion:
  West fullcov intentionally diverges from accepted-wall owner gating.
  Prior runtime handoff-exclusion tests did not move the current ROI enough, so this is a confirmed structural difference but not yet the visual root.
```

## 5. Current Strong Leads

### Lead 1: Radiance Contract Still Not Fully Aligned

Facts:

```text
RAW pointer is now full_diffuse_radiance.
However:
  shader declares uR7310C1XatlasRuntimeFullWestWallDirectIncluded
  JS sets pathTracingUniforms.uR7310C1XatlasRuntimeFullWestWallDirectIncluded
  shader does not use this uniform in the runtime display path.

In the last CDP report:
  pointer file says directLightAlreadyIncluded true
  follow-up xatlas_raw report shows fullWestWallDirectIncluded true and shader uniform westDirectIncluded=1
```

Interpretation:

```text
Pointer contract and JS/uniform propagation are now proven for xatlas_raw.
Shader consumption remains suspicious because the runtime display path declares the direct-included uniform but does not use it to change the NEE path.
However, direct-included skip-NEE tests made the full package too dark, so this is not a complete fix by itself.
```

Suggested next debug:

```text
Add a temporary color/debug mode or report probe that proves, for west pixels:
  pointer.directLightAlreadyIncluded value
  JS r7310C1XatlasRuntimeFullWestWallDirectIncluded
  uniform uR7310C1XatlasRuntimeFullWestWallDirectIncluded
  actual shader branch behavior

Then decide whether full-radiance first-hit should break, skip NEE, or continue.
Follow the no-break contract for indirect packages.
```

### Lead 2: Full-Radiance Package May Be Older Than Latest Threshold / Full-Coverage Fixes

Facts:

```text
Full-radiance package used by current RAW pointer:
  .omc/r7-3-10-xatlas-bake-spike/20260621-175308

Latest threshold-fixed indirect package:
  .omc/r7-3-10-xatlas-bake-spike/20260622-002119
```

Risk:

```text
The full-radiance package may not include every later bake-path correction.
Point probes showed threshold samples are non-black in 175308, but full package freshness still deserves audit.
```

Suggested next debug:

```text
Before another full rebake:
  compare manifest timestamps
  compare shader cache buster / branch code used during each bake
  inspect validation metadata for 175308 and 002119
  verify if 175308 was produced before or after threshold early-break removal
```

### Lead 3: LIVE Comparison Is Whole-Renderer, XATLAS First-Hit Lightmap Is A Cached Approximation

Facts:

```text
Full-radiance RAW reduced the global luma difference to about 1%.
Remaining visible mismatch is spatial:
  upper band
  GIK shadow band
  perceived wall material balance
```

Possible cause:

```text
Full-radiance bake may still use a different first-hit path than regular LIVE for:
  sampleLight / NEE
  west-specific hybrid terms
  beam/reveal/shadow terms
  material albedo order
  sample count distribution
```

Suggested next debug:

```text
Use single-texel / render-space contribution probes at points user visually cares about:
  upper wall band
  GIK shadow band
  door side
  central clean wall

For each point, compare:
  LIVE first-hit accumulated contribution
  XATLAS baked texel
  XATLAS runtime displayed contribution
  direct-only
  indirect-only
  albedo-applied result
```

## 6. Commands / Tools Already Used

Two-case CDP comparison:

```text
PORT=9362 \
OUT_DIR=/private/tmp/r7310-west-raw-full-1000 \
SAMPLES=1000 \
URL='http://localhost:9002/Home_Studio.html?atlasMaster=raw' \
MASTER_VARIANT=raw \
WALL_MS=420000 \
node /private/tmp/r7310-west-two-case-probe.mjs
```

ROI luma:

```text
python3 /private/tmp/r7310-roi-luma.py \
  /private/tmp/r7310-west-raw-full-1000/live_path.png \
  /private/tmp/r7310-west-raw-full-1000/xatlas_raw.png \
  live xatlas_raw_full
```

Static gates that passed after pointer switch:

```text
node --check js/InitCommon.js
node --check docs/tools/r7-3-10-full-west-wall-xatlas-package.mjs
node docs/tools/r7-3-10-xatlas-param-checker.mjs
node docs/tools/r7-3-10-master-contract-check.mjs
node docs/tools/r7-3-10-surface-owner-scanner.mjs --formal
git diff --check
```

## 7. Next Session Instructions

```text
1. Start by reading this file.

2. Treat the latest user verdict as authoritative:
   Current XATLAS RAW remains too bright / visually different from LIVE.
   The last pointer switch improved numbers but did not pass.

3. Do not use a brightness scalar or color correction.

4. Do not use LIVE fallback as a fix.

5. First verify contract propagation:
   pointer directLightAlreadyIncluded
   JS r7310C1XatlasRuntimeFullWestWallDirectIncluded
   shader uniform
   shader branch behavior

6. Then investigate remaining spatial mismatch with contribution probes:
   upper band
   GIK shadow band
   central wall
   door side

7. Keep LIVE at the same camera and 1000 SPP as authority.

8. Use Google Chrome for automated probes. Do not touch Brave.

9. Do not commit or push until user explicitly approves.
```

## 8. Short Handoff Message For New Session

```text
任務：繼續 debug R7-3.10 西牆 XATLAS RAW/OIDN。使用者權威判定：左 LIVE 1000 SPP、右 XATLAS RAW；目前右邊仍明顯比 LIVE 亮／不同，最後一次 full-radiance pointer 改善了數據但使用者不接受。禁止亮度係數、禁止調色、禁止退回 LIVE 蒙混。

先讀：
  docs/r7-3-10-west-wall-xatlas-debug-handoff-20260622.md

已修過：
  master texture Float32->HalfFloat，解決巨張貼圖 incomplete。
  移除 albedo skip all-bounce，解決死白。
  移除 west exclusion mask，解決 LIVE fallback holes。
  移除 west threshold bake early break，解決門檻純黑。
  RAW pointer 已從 indirect-only 切到 full-radiance package .omc/r7-3-10-xatlas-bake-spike/20260621-175308。

仍未過：
  使用者最新截圖顯示 XATLAS RAW 還是比 LIVE 亮／不同。

最高優先查：
  pointer directLightAlreadyIncluded=true 是否真的一路進 JS 狀態、shader uniform、shader branch。
  目前 shader 宣告 uR7310C1XatlasRuntimeFullWestWallDirectIncluded，但 rg 顯示 shader runtime path 沒使用它。
  上一輪 CDP report 中 pointer 已 full-radiance，但 fullWestWallDirectIncluded 報 false；這個狀態矛盾要先釐清。

下一步建議：
  用同一視角做 contribution probe，不重烤、不調色，先證明 LIVE first-hit、baked texel、runtime displayed value 在 upper band / GIK shadow band / central wall / door side 哪一層分歧。
```

## 9. 2026-06-22 cross-wall continuation

User correction / debug direction:

```text
Do not keep looking only at west wall in isolation.
Compare west against the accepted faces:
  north wall
  east wall
  ceiling
  floor

These faces use the same structural XATLAS direction and should have normal brightness.
Therefore the useful question is:
  where does west diverge from the accepted-face contract?
```

Cross-wall pointer contract comparison:

```text
north:
  docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json
  indirect_diffuse_radiance
  directLightAlreadyIncluded=false
  addDirectLightAfterBakeLookup=true

east:
  docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json
  indirect_diffuse_radiance
  directLightAlreadyIncluded=false
  addDirectLightAfterBakeLookup=true

ceiling:
  docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json
  indirect_diffuse_radiance
  directLightAlreadyIncluded=false
  addDirectLightAfterBakeLookup=true

floor:
  docs/data/r7-3-10-xatlas-full-floor-runtime-package.json
  indirect_diffuse_radiance
  directLightAlreadyIncluded=false
  addDirectLightAfterBakeLookup=true

west:
  docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json
  full_diffuse_radiance
  directLightAlreadyIncluded=true
  addDirectLightAfterBakeLookup=false

Meaning:
  west is currently the only accepted-face peer using full/direct-included contract.
```

Shader contract propagation evidence:

```text
rg result:
  shaders/Home_Studio_Fragment.glsl declares:
    uniform float uR7310C1XatlasRuntimeFullWestWallDirectIncluded;

  js/InitCommon.js uploads the uniform:
    uR7310C1XatlasRuntimeFullWestWallDirectIncluded.value =
      xatlasApplied && r7310C1XatlasRuntimeFullWestWallActive &&
      r7310C1XatlasRuntimeFullWestWallDirectIncluded ? 1.0 : 0.0;

  shader runtime branches do not read that uniform anywhere else.

Conclusion:
  pointer -> JS state -> shader uniform exists.
  shader uniform -> shader branch is missing.
  Therefore the direct-included contract is not currently enforced by shader behavior.
```

Bake-mode contract evidence:

```text
Runtime path:
  XATLAS first-hit always adds r7310XatlasRuntimeRadiance.
  Then the shader continues to the shared NEE dispatch.
  No direct-included branch prevents the NEE dispatch.

Bake path:
  r7310XatlasIndirectBakeFirstHit normally creates a diffuse bounce continuation.
  The continuation is gated by:
    uR7310C1XatlasBakeFullRadianceMode < 0.5

  In full-radiance bake mode, the XATLAS first-hit does not take that indirect continuation.
  It proceeds to NEE dispatch.

Interpretation:
  The west full_diffuse_radiance package is semantically suspicious.
  It may be closer to a first-hit direct/NEE package than a complete direct+indirect diffuse package.
  Combining it with runtime NEE can produce average ROI numbers near LIVE while keeping the visible spatial mismatch.
```

Param UV comparison against east:

```text
docs/generated/r7-3-10-xatlas-param-table.generated.json:

east_wall:
  normal [-1,0,0]
  bbox x [1.9,1.92], y [0,2.905], z [-1.874,3.056]
  uAxis=y, uScale=0.344234, uMixLo=0.999785, uMixHi=0.000215
  vAxis=z, vScale=0.20284, vMixLo=0.000127, vMixHi=0.999873

west_wall_open:
  normal [1,0,0]
  bbox x [-1.92,-1.9], y [0,2.905], z [-1.874,3.056]
  uAxis=y, uScale=0.344234, uMixLo=0.999785, uMixHi=0.000215
  vAxis=z, vScale=0.20284, vMixLo=0.000127, vMixHi=0.999873

Conclusion:
  Param UV values are mirror-consistent with east.
  This reduces the probability that west brightness is caused by a simple UV axis/flip difference.
```

Data-quality notes from this continuation:

```text
raw-hdr-summary.json is the literal text "undefined" for westFull, westIndirect, and east.
Therefore raw-hdr-summary absence is not west-specific evidence.

bake-diagnostics submission logs appear truncated or log-limited:
  westIndirect and east both show completedTiles=40 and minCompletedSamples=1000,
  while submissionTileCount from logged submissions is only 33.
Because the same pattern exists on accepted east, do not treat this as west root cause without a better diagnostic.
```

Verification run in this continuation:

```text
node --check docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  pass

node docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  status=investigate
  findings:
    west pointer contract differs from accepted wall peers
    west direct-included uniform is declared but not used by shader branches

node --test docs/tests/r7-3-10-west-wall-single-hybrid.test.js
  pass

node --test docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  pass

node docs/tools/r7-3-10-master-contract-check.mjs
  pass

Playwright / Google Chrome smoke:
  Tried via Codex node_repl, not via shell CDP command.
  Playwright package was available.
  Google Chrome launch failed before page load:
    browserType.launch: Target page, context or browser has been closed
    launched pid exited with SIGABRT
    cleanup reported kill EPERM
  No runtime config or contribution probe was produced from this attempt.

Corrected false lead in the next continuation:
  Earlier audit text said xatlas full-radiance bake mode skips the normal indirect continuation gate.
  Re-read shader light-hit branches.
  Finding:
    full-radiance mode skips the immediate xatlas indirect continuation before NEE,
    but willNeedDiffuseBounceRay is preserved and consumed after NEE/light-hit branches.
  Meaning:
    This is not a standalone root cause.
    Keep focus on:
      west pointer contract differs from accepted peers
      direct-included uniform reaches shader but is not used by runtime branch behavior

Diagnostic improvement made:
  JS runtime world-position -> XATLAS UV dispatcher now supports:
    west
    east
    north
    ceiling
    floor
  Test added to docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js.
  Verification:
    node --test docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js
      pass
```

Current root-cause hypothesis:

```text
The first strong divergence from accepted faces is contract-level:
  accepted peers use indirect texture + runtime direct light
  west currently uses a full/direct-included pointer

The direct-included state reaches JS/uniform but does not affect shader behavior.
The bake full-radiance mode also appears to skip the normal indirect continuation.

This can explain the observed failure pattern:
  full package only is too dark
  runtime NEE only is too dark
  combined result has near-LIVE ROI averages but visible brightness/color/spatial mismatch

Next evidence to gather:
  a browser/runtime contribution probe that reads, at the same west pixels:
    owner / param hit
    XATLAS texture radiance
    first-hit NEE contribution
    final displayed pre-tonemap contribution
  Then compare those values against east/north accepted pixels under the same contract.
```

## 10. Next continuation: cross-wall shader add-stack root cause candidate

User direction received:

```text
Do not keep staring at west wall in isolation.
Compare west against the other accepted walls, because north/east/ceiling/floor are produced by the same structure.
West being brighter means some contract or shader path differs.
```

Cross-wall shader comparison found a stronger west-only divergence:

```text
Runtime XATLAS first-hit add stack in shaders/Home_Studio_Fragment.glsl:

XATLAS first hit:
  accumCol += XATLAS radiance

Accepted peers then guard old hybrid radiance:
  floor    if (r7310FloorHybridFirstHit && !r7310XatlasRuntimeFirstHit)
  ceiling  if (r7310CeilingHybridFirstHit && !r7310XatlasRuntimeFirstHit)
  north    if (r7310NorthWallHybridFirstHit && !r7310XatlasRuntimeFirstHit)
  east     if (r7310EastWallHybridFirstHit && !r7310XatlasRuntimeFirstHit)

West previously did this:
  if (r7310WestWallHybridFirstHit)
    accumCol += r7310C1WestWallHybridRadiance(...)

Meaning:
  west XATLAS first-hit could add both:
    XATLAS master radiance
    legacy west hybrid radiance

This is a concrete west-only brightness path and matches the user's cross-wall diagnosis direction.
```

Fix applied:

```text
shaders/Home_Studio_Fragment.glsl:

  if (r7310WestWallHybridFirstHit && !r7310XatlasRuntimeFirstHit)
    accumCol += mask * r7310C1WestWallHybridRadiance(...)

This aligns west with floor/ceiling/north/east XATLAS first-hit behavior.
```

Regression guard added:

```text
docs/tests/r7-3-10-west-wall-single-hybrid.test.js
  now requires west hybrid radiance to be guarded by !r7310XatlasRuntimeFirstHit.

docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  now reports shader.westHybridXatlasGuarded.
  It adds a finding if west XATLAS first-hit can also add legacy west hybrid radiance.
```

TDD evidence:

```text
Before shader fix:
  node --test docs/tests/r7-3-10-west-wall-single-hybrid.test.js
  failed on missing:
    if (r7310WestWallHybridFirstHit && !r7310XatlasRuntimeFirstHit)

After shader fix:
  node --test docs/tests/r7-3-10-west-wall-single-hybrid.test.js
  passed
```

Verification run:

```text
node --test docs/tests/r7-3-10-west-wall-single-hybrid.test.js
  pass

node --test docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js
  pass

node docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  status=investigate
  shader.westHybridXatlasGuarded=true
  remaining findings:
    west pointer contract differs from accepted wall peers
    west direct-included uniform is declared but not used by shader branches

node docs/tools/r7-3-10-master-contract-check.mjs
  pass
```

Browser/runtime verification status:

```text
Chrome shader compile smoke failed before page load:
  Error: CDP port did not open: 9351

Brave headless CDP did open once, but follow-up CDP probe creation was blocked by environment policy after escalation was rejected.
The process was stopped cleanly.

Therefore this continuation has static/runtime-contract evidence and unit-test evidence, but no new visual PASS.
The next allowed verification should open:
  http://localhost:9002/Home_Studio.html?atlasMaster=raw

Required human/Chrome check:
  compare LIVE 1000 SPP west-off against XATLAS RAW west-on at the user's latest west-wall camera.
```

Current interpretation after section 10:

```text
The most concrete root-cause candidate is no longer just direct-included uniform propagation.
The new primary candidate is west-only double add:
  XATLAS first-hit radiance
  plus legacy west hybrid radiance

Remaining contract concerns still matter:
  west pointer remains full/direct-included while accepted peers are indirect + runtime direct
  direct-included uniform is uploaded but not consumed by shader branch behavior

Visual acceptance is still pending.
```

## 11. Next continuation: west wall beam-shadow overlap with full-west XATLAS

Cross-wall follow-up after section 10:

```text
The section 10 guard on r7310WestWallHybridFirstHit is useful as a regression guard,
but the old full-wall west hybrid already has:
  !r7310C1XatlasParamWestSurfaceActive()

Therefore the stronger remaining same-surface overlap is:
  r7310WestWallBeamHybridFirstHit
```

Why this differs from the accepted peer walls:

```text
East XATLAS path:
  r7310C1XatlasFullEastWallUv(...)
  explicitly rejects:
    r7310C1EastWallHiddenByBeamOrSeColumn(z, y)

West XATLAS param path:
  west_wall_open is full chart coverage.
  Registry note says no ironDoorHole / west beam / SW column exclusion.

Old west wall beam-shadow hybrid:
  r7310C1RuntimeSurfaceIsWestWallBeamShadow(...)
  uses the same west wall plane x=-1.91.
  It can cover a large part of the west wall:
    z <= max(uR7310C1WestWallBeamShadowZMaxOverride, 2.846)
    y <= 2.905

Before this continuation:
  full-west XATLAS could own the west wall,
  and west_wall_beam_shadow hybrid could still add radiance on the same west wall surface.

This is a more concrete same-surface double-add candidate than section 10's legacy west hybrid.
```

TDD evidence:

```text
Test added:
  docs/tests/r7-3-10-west-beam-shadow-mirror.test.js

New assertion:
  r7310C1WestWallBeamShadowHybridActive must contain:
    !r7310C1XatlasParamWestSurfaceActive()

RED:
  node --test docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
  failed with:
    west wall beam shadow hybrid must yield to full-west XATLAS param ownership to avoid double-adding the west wall

GREEN:
  shaders/Home_Studio_Fragment.glsl
  r7310C1WestWallBeamShadowHybridActive now requires:
    !r7310C1XatlasParamWestSurfaceActive()
```

Audit update:

```text
docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  now reports:
    shader.westBeamShadowXatlasYield

Latest result:
  westHybridXatlasGuarded=true
  westBeamShadowXatlasYield=true

Remaining findings:
  west pointer contract differs from accepted wall peers
  west direct-included uniform is declared but not used by shader branches
```

Verification:

```text
node --test docs/tests/r7-3-10-west-beam-shadow-mirror.test.js
  pass

node --test docs/tests/r7-3-10-west-wall-single-hybrid.test.js
  pass

node --test docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js
  pass

node --check docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  pass

node docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  status=investigate
  westBeamShadowXatlasYield=true

node docs/tools/r7-3-10-master-contract-check.mjs
  pass

node docs/tools/r7-3-10-xatlas-param-checker.mjs
  pass
```

Interpretation after section 11:

```text
Two same-surface duplicate-add risks are now closed:
  old west full-wall hybrid
  west wall beam-shadow hybrid

This is aligned with the user's instruction to compare west against the other accepted faces:
  accepted faces avoid old same-surface hybrid add once XATLAS owns first-hit.
  west now does the same for the two same-plane west wall paths.

Visual acceptance is still pending because browser/CDP runtime capture was blocked by environment policy.
```

## 12. Cross-wall direct-light contract difference handled

User direction for this continuation:

```text
Do not keep inspecting west wall alone.
Compare west against north, east, ceiling, and floor because they use the same structural bake family and already have normal brightness.
```

Cross-wall finding:

```text
Accepted peers:
  north/east/ceiling/floor pointers use:
    bakedRadianceKind=indirect_diffuse_radiance
    directLightAlreadyIncluded=false
    addDirectLightAfterBakeLookup=true

West pointer uses:
  bakedRadianceKind=full_diffuse_radiance
  directLightAlreadyIncluded=true
  addDirectLightAfterBakeLookup=false

Before this continuation:
  JS loaded the west directLightAlreadyIncluded flag into state/uniform.
  Shader declared uR7310C1XatlasRuntimeFullWestWallDirectIncluded.
  Shader did not use that uniform in the branch that continues into shared NEE.

Likely effect:
  west RAW could add full baked radiance and then still add shared direct light,
  while accepted peers add indirect baked radiance and intentionally continue to shared direct light.
```

TDD evidence:

```text
Test updated:
  docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js

RED:
  node --test docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js
  failed with:
    west full-radiance runtime must consume its direct-included uniform and skip the shared direct-light continuation

GREEN:
  shaders/Home_Studio_Fragment.glsl
  r7310XatlasRuntimeFirstHit now:
    adds XATLAS radiance
    if uR7310C1XatlasRuntimeFullWestWallDirectIncluded > 0.5:
      break
    otherwise indirect XATLAS packages continue to the shared direct-light path
```

Audit update:

```text
docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  now distinguishes:
    westPointerDirectDiff=true
    westDirectIncludedHandled=true

Latest result:
  status=pass
  findings=[]
```

Verification:

```text
node --test docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js docs/tests/r7-3-10-west-beam-shadow-mirror.test.js docs/tests/r7-3-10-west-wall-single-hybrid.test.js docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js
  pass

node --check docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  pass

node docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  status=pass
  findings=[]
```

Important boundary:

```text
This resolves the strongest current architecture-level difference between west and the accepted peer surfaces.
Visual acceptance is still pending.
The user must verify RAW against LIVE1000 in browser, or approve another browser/CDP capture path.
Do not mark the task complete until RAW visually matches LIVE1000.
```

## 13. Correction: direct-included break must be west-scoped

Follow-up root-cause check after section 12:

```text
Section 12 consumed the west directLightAlreadyIncluded contract in shader.
But the first implementation used only the global uniform:
  uR7310C1XatlasRuntimeFullWestWallDirectIncluded

Risk:
  atlasMaster=raw can load north/east/ceiling/floor/west together.
  r7310XatlasRuntimeFirstHit is true for any active XATLAS surface.
  A global direct-included break would skip shared direct light for accepted peer faces too.

Likely visual effect:
  west keeps direct light because its package is full-radiance.
  north/east/ceiling/floor can lose shared direct light when west is active.
  west then appears brighter relative to the other accepted faces.
```

TDD evidence:

```text
Test tightened:
  docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js

RED:
  node --test docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js
  failed with:
    west full-radiance runtime must consume its direct-included uniform only for west first-hit and skip the shared direct-light continuation

GREEN:
  shaders/Home_Studio_Fragment.glsl now computes:
    r7310XatlasRuntimeWestFirstHit
  using:
    r7310C1XatlasParamSurfaceUv(int(uR7310C1XatlasParamWestSurfaceIndex), nl, x, ...)

  direct-included break now requires:
    uR7310C1XatlasRuntimeFullWestWallDirectIncluded > 0.5
    &&
    r7310XatlasRuntimeWestFirstHit

  Result:
    west full-radiance skips shared direct light.
    north/east/ceiling/floor indirect packages keep shared direct light.
```

Audit update:

```text
docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  now requires:
    westDirectIncludedScopedToWest=true

Latest result:
  status=pass
  findings=[]
```

Package luminance comparison gathered during this continuation:

```text
west RAW full-radiance:
  meanLum=0.61929
  lumOver0p5Pct=72.147

east RAW indirect:
  meanLum=0.38174
  lumOver0p5Pct=1.978

north RAW indirect:
  meanLum=0.32002
  lumOver0p5Pct=1.846

ceiling RAW indirect:
  meanLum=0.51593
  lumOver0p5Pct=61.671

floor RAW indirect:
  meanLum=0.26187
  lumOver0p5Pct=0
```

Runtime verification boundary:

```text
Attempted:
  node docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs --url='http://localhost:9002/Home_Studio.html?atlasMaster=raw'

Result:
  fail before page evidence:
    CDP port did not open

Attempted escalated rerun:
  rejected by environment policy

Therefore:
  current evidence proves shader/package contract alignment.
  current evidence does not prove visual RAW == LIVE1000.
  Do not mark the goal complete until the browser view is verified.
```

Verification:

```text
node --test docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js docs/tests/r7-3-10-west-beam-shadow-mirror.test.js docs/tests/r7-3-10-west-wall-single-hybrid.test.js docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js
  pass

node docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  status=pass
  findings=[]

node docs/tools/r7-3-10-master-contract-check.mjs
  pass

node docs/tools/r7-3-10-xatlas-param-checker.mjs
  pass

node --check docs/tools/r7-3-10-west-crosswall-contract-audit.mjs
  pass

git diff --check -- shaders/Home_Studio_Fragment.glsl docs/tests/r7-3-10-full-north-wall-xatlas-phase2-contract.test.js docs/tests/r7-3-10-west-beam-shadow-mirror.test.js docs/tests/r7-3-10-west-wall-single-hybrid.test.js docs/tests/r7-3-10-xatlas-runtime-uv-contract.test.js docs/tools/r7-3-10-west-crosswall-contract-audit.mjs docs/r7-3-10-west-wall-xatlas-debug-handoff-20260622.md js/InitCommon.js
  pass
```

## 14. User screenshot follow-up: brightness fixed, sampling architecture still differs

User observation:

```text
Screenshot 1:
  atlasMaster=raw
  west-facing view
  samples=1
  west wall RAW looks unusually clean.

Screenshot 2:
  atlasMaster=raw
  north/east view
  samples=1
  north/east show evenly extended one-sample noise.

User question:
  Did we only fix color/brightness?
  Is the west bake architecture actually the same as the other walls?
```

Current-state answer:

```text
No, west is not using the same radiance contract as the accepted peer faces.

Accepted peers:
  north/east/ceiling/floor:
    bakedRadianceKind=indirect_diffuse_radiance
    directLightAlreadyIncluded=false
    addDirectLightAfterBakeLookup=true
    runtime still samples shared direct light

Current west:
  docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json
    packageDir=.omc/r7-3-10-xatlas-bake-spike/20260621-175308
    bakedRadianceKind=full_diffuse_radiance
    directLightAlreadyIncluded=true
    addDirectLightAfterBakeLookup=false
    westFullRadianceBake=true
```

Interpretation:

```text
The recent fix is real for the brightness bug:
  full-radiance west now stops the west first-hit from adding shared direct light again.

But it is not architectural convergence:
  west direct light is mostly pre-baked into the atlas.
  north/east/ceiling/floor direct light is still sampled at runtime.

Therefore a 1-sample RAW screenshot can show:
  west wall: cleaner, because it is reading a 1000-spp full-radiance atlas and skipping runtime direct light.
  north/east: noisier, because indirect atlas is combined with 1-sample runtime direct light.
```

Conclusion:

```text
Brightness/color matching is currently closer because the direct-included contract is now respected.
The west bake architecture still differs from the peer walls.
This is not a final architectural fix.

Next investigation should compare one of these two directions:
  A. make west converge back to peer architecture:
     indirect_diffuse_radiance + runtime direct light
  B. move peer walls to a full-radiance/no-runtime-direct contract if that is the desired final architecture

Do not call the goal complete until the chosen architecture is explicit and RAW/LIVE visual parity is verified.
```
