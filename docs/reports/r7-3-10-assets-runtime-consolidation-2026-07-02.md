# R7-3.10 Assets Runtime Consolidation - 2026-07-02

## Summary

Current room runtime packages were moved out of `.omc` and into `assets`.

New current runtime root:

```text
assets/runtime/r7-3-10/current-room
```

The old `.omc/current-room-runtime` pointer path was replaced in the current R7-3.10 runtime package JSON files.

## Current Runtime Packages

These package groups now live under `assets/runtime/r7-3-10/current-room`:

```text
ceiling
depth-h2
east
floor
iron-door-body
iron-door-hybrid-reflection
iron-door-planar-reflection
iron-door-reflection-probe
north
south
west
west-threshold-front
west-threshold-top
```

## Updated Pointer Files

These files now point to `assets/runtime/r7-3-10/current-room/...`:

```text
docs/data/r7-3-10-c1-iron-door-body-runtime-package.json
docs/data/r7-3-10-c1-iron-door-hybrid-reflection-runtime-package.json
docs/data/r7-3-10-c1-iron-door-planar-reflection-runtime-package.json
docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json
docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-floor-runtime-package.json
docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-south-wall-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-west-threshold-front-1000spp-runtime-package.json
docs/data/r7-3-10-xatlas-west-threshold-top-1000spp-runtime-package.json
```

## Assets Inventory Result

`assets/bakes/r7-3-10/c1-static-diffuse` still contains 40 package directories.

Inventory result:

```text
40 package dirs exist.
40 package dirs are still referenced by docs/data.
34 package dirs are still reached by js/InitCommon.js package URL constants.
6 package dirs are docs/data-only historical variants.
0 package dirs are fully unreferenced.
```

Because those legacy packages are still referenced, this pass did not delete any `assets/bakes/r7-3-10/c1-static-diffuse` package directory.

## Why Legacy Assets Remain

The project still has older C1 static diffuse runtime loaders and diagnostic pointers. Some are not the current XATLAS formal route, but they are still wired into docs/tests or runtime package constants.

Deleting them now would save disk space, but would also create broken pointer files and likely break old regression tests or fallback UI paths.

## Follow-Up To Fully Retire Legacy Assets

The correct cleanup path is:

```text
1. Add a contract for atlasMaster=raw current formal mode:
   current formal mode must only load assets/runtime/r7-3-10/current-room packages.

2. Remove or quarantine old C1 static diffuse runtime loaders:
   assets/bakes/r7-3-10/c1-static-diffuse should become diagnostic/reference only.

3. Move historical pointer JSON files into an explicit archive namespace, or delete them with their tests.

4. Delete legacy package dirs only after the current formal route and tests no longer reference them.
```

## Verification Targets

After this move, these URLs should be reachable through the local dev server:

```text
Home_Studio.html
assets/runtime/r7-3-10/current-room/floor/package/atlas-patch-000-rgba-f32.bin
assets/runtime/r7-3-10/current-room/north/package/atlas-patch-000-rgba-f32.bin
assets/runtime/r7-3-10/current-room/east/package/atlas-patch-000-rgba-f32.bin
assets/runtime/r7-3-10/current-room/south/package/atlas-patch-000-rgba-f32.bin
assets/runtime/r7-3-10/current-room/ceiling/package/atlas-patch-000-rgba-f32.bin
```
