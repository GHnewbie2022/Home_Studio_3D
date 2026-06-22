# R7-3.10 Multi-Page Lightmap Goal Handoff

Date: 2026-06-23

## 1. Purpose

This handoff is for the next session that will split `atlasMaster=raw` from a single giant master atlas into a multi-page lightmap architecture.

The immediate goal is to fix the loading failure and WebGL context loss caused by the current one-texture full-room atlas path.

This phase is about loading architecture and baked-route contract. West-wall black-line image quality issues are recorded as later risks, not the completion target for this phase.

## 2. Current Problem

`atlasMaster=raw` currently builds a single full-room master texture around `8923 x 7645`.

Estimated resource pressure:

```text
1. Float32 RGBA CPU master: about 1.04 GiB
2. HalfFloat RGBA GPU upload: about 520 MiB
3. During load, additional memory is used by per-surface Float32 bins, half conversion buffers, and Three.js texture objects.
```

Observed user-facing failure:

```text
1. Page stuck at 0%.
2. Page stuck at 5%.
3. WebGL context lost.
4. Context restored message appears, but the page still does not recover cleanly.
```

Conclusion: this is an atlas loading architecture problem. The raw path should no longer require one giant full-room texture.

## 3. User Decisions

```text
1. Change atlasMaster=raw to multi-page lightmaps.
2. Do not build the single 8923 x 7645 full-room master texture for the raw path.
3. West wall, west threshold top, and west threshold front must use baked routes.
4. Baked route miss must be visible: error, test failure, or debug color.
5. Do not fallback to LIVE to hide baked-route failures.
6. Keep north, east, ceiling, and floor working while the west surfaces move first.
7. Do not touch Brave.
8. Use Chrome or non-browser smoke tests for verification.
9. Do not start with a full-room rebake. Fix the route and loading architecture first.
```

## 4. Required Background File

Read this first:

```text
docs/r7-3-10-west-wall-xatlas-debug-handoff-20260622.md
```

Use it as background for west-wall and threshold package state, previous fixes, and radiance contract history.

Do not turn the black-line investigation into this phase's primary task.

## 5. Radiance Contract Background

Current known contract difference:

```text
1. North / East / Ceiling / Floor

   bakedRadianceKind = indirect_diffuse_radiance
   directLightAlreadyIncluded = false
   addDirectLightAfterBakeLookup = true

   Meaning:
   Atlas stores indirect diffuse radiance.
   Runtime adds direct lighting.

2. West Wall

   bakedRadianceKind = full_diffuse_radiance
   directLightAlreadyIncluded = true
   addDirectLightAfterBakeLookup = false

   Meaning:
   Atlas already includes direct lighting.
   Runtime must not add shared direct light for west first-hit.
```

The multi-page registry must make this explicit per page or per surface. Shader behavior should follow the registry contract.

## 6. Target Architecture

Use multi-page lightmaps instead of a single master atlas.

Suggested page model:

```text
1. pageId
2. pageName
3. packageUrl or packagePointer
4. textureUrl
5. width
6. height
7. format
8. radianceKind
9. directLightAlreadyIncluded
10. surfaces[]
```

Suggested surface model:

```text
1. surfaceId
2. ownerId or route key
3. pageId
4. rect
5. uvTransform
6. coverageMask or validityMask if needed
7. bakePackage
8. fallbackPolicy = error_or_debug_color
```

Suggested first page split:

```text
1. page 0: legacy or stable surfaces placeholder
2. page 1: west wall
3. page 2: west threshold top
4. page 3: west threshold front
```

If independent package pointers already exist for west wall or threshold surfaces, prefer using them first.

## 7. Implementation Scope

This session should do:

```text
1. Locate the atlasMaster=raw entry path.
2. Locate the code that builds the 8923 x 7645 master texture.
3. Locate CPU Float32 master composition.
4. Locate GPU HalfFloat upload.
5. Locate west wall, west threshold top, and west threshold front package pointers.
6. Locate current shader route for baked surfaces and direct lighting.
7. Add or refactor a multi-page lightmap registry.
8. Load multiple lightmap page textures from JS.
9. Pass pageId, rect, radianceKind, and directLightAlreadyIncluded to shader state.
10. Route west wall, west threshold top, and west threshold front through baked multi-page sampling.
11. Prevent LIVE fallback for those baked routes.
12. Stop atlasMaster=raw from creating the giant master texture.
13. Add contract tests.
14. Verify load with tests and Chrome or non-browser smoke.
```

This session should not do:

```text
1. Do not use Brave.
2. Do not fallback to LIVE.
3. Do not hide baked-route failures.
4. Do not reset git.
5. Do not delete bake packages still referenced by docs/data.
6. Do not rebake the full room as the first step.
7. Do not make west-wall black-line image cleanup the main completion target.
```

## 8. Required Tests

Run existing syntax checks:

```text
node --check js/InitCommon.js
node --check js/Home_Studio.js
```

Run existing contract tests:

```text
node docs/tests/r7-3-10-west-threshold-front-contract.test.js
node docs/tests/r7-3-10-cache-bust-contract.test.js
```

Add and run a new multi-page contract test, suggested path:

```text
node docs/tests/r7-3-10-lightmap-pages-contract.test.js
```

The new test should check at least:

```text
1. atlasMaster=raw does not require the 8923 x 7645 master atlas.
2. West wall has a pageId and baked route.
3. West threshold top has a pageId and baked route.
4. West threshold front has a pageId and baked route.
5. These routes do not fallback to LIVE.
6. Route miss has an explicit error or debug policy.
```

## 9. Browser Verification Rules

```text
1. Do not use Brave.
2. Chrome is allowed.
3. If Chrome CDP is needed, use an isolated user-data-dir.
4. Do not touch the user's daily browser profile.
```

Verification target:

```text
1. atlasMaster=raw loads.
2. It does not stick at 0% or 5%.
3. It does not trigger WebGL context lost.
4. Canvas has a non-black frame.
5. No shader compile error.
6. West wall and threshold baked routes do not fallback to LIVE.
```

## 10. Reference Viewpoints For Later Smoke

These viewpoints came from the previous west-wall and threshold black-line investigation. They may be used as smoke references after loading works. They are not this phase's completion criteria.

West threshold / iron door top edge:

```json
{
  "position": { "x": -1.883804, "y": 0.10685, "z": -1.03706 },
  "yaw": 2.388801,
  "pitch": -0.355001,
  "fov": 55,
  "forward": { "x": -0.641049, "y": -0.347591, "z": 0.684278 }
}
```

West wall / south desk horizontal seam:

```json
{
  "position": { "x": -1.904012, "y": 0.776956, "z": 2.832227 },
  "yaw": 2.7728,
  "pitch": -0.547,
  "fov": 55,
  "forward": { "x": -0.30789, "y": -0.520128, "z": 0.796662 }
}
```

West / southwest corner:

```json
{
  "position": { "x": -1.891707, "y": 0.776898, "z": 2.831609 },
  "yaw": 2.0624,
  "pitch": -0.140001,
  "fov": 55,
  "forward": { "x": -0.872952, "y": -0.139544, "z": 0.467422 }
}
```

## 11. Current .omc State

`.omc` was cleaned from about `93G` to about `22G`.

Remaining large directories are mostly still referenced by `docs/data` package pointers:

```text
1. r7-3-10-xatlas-bake-spike
2. r7-3-10-full-west-wall-xatlas-phase2
3. r7-3-10-full-ceiling-xatlas-phase2
4. r7-3-10-full-north-wall-xatlas-phase2
5. r7-3-10-full-room-diffuse-bake
6. r7-3-10-xatlas-a1-west-beam-hard-edge-fix
7. r7-3-10-full-east-wall-xatlas-phase2
```

Before any aggressive cleanup, search `docs/data` references.

## 12. Success Criteria

```text
1. atlasMaster=raw no longer builds the 8923 x 7645 single master texture.
2. atlasMaster=raw loads to a visible frame.
3. No WebGL context lost during verification.
4. West wall uses a baked multi-page route.
5. West threshold top uses a baked multi-page route.
6. West threshold front uses a baked multi-page route.
7. West wall and threshold routes do not fallback to LIVE.
8. Baked-route miss fails visibly through test, error, or debug color.
```

## 13. Later Risks Outside This Phase

```text
1. West threshold front lower face previously turned black during one attempted fix.
2. West wall and threshold boundaries previously had black-line artifacts.
3. These should be handled after multi-page loading and route contract are stable.
```

## 14. Final Report Requirements

The next session should report:

```text
1. Root cause summary:
   Where the single master texture was built, how large it was, and why it caused context loss.

2. Architecture change:
   Registry location, registry fields, and pageId assignment.

3. West and threshold route:
   Which pageId and package each of west wall, threshold top, and threshold front uses.

4. Anti-fallback evidence:
   Which test or shader route proves baked route miss does not return to LIVE.

5. Verification:
   Test commands and results.
   If Chrome smoke was run, include URL, nonBlack result, context lost result, and shader error result.

6. Unfinished items:
   If any success criterion is not met, state exactly which one and what evidence remains.
```
