# R7-3.10 OMC Current Room Runtime Cleanup - 2026-07-02

## Summary

This cleanup consolidated the `.omc` data currently needed by the room runtime into:

`.omc/current-room-runtime/`

The previous scattered runtime package directories were moved into one folder, and the matching `docs/data/*.json` pointer files were updated to the new locations.

## Kept Runtime Packages

- `north`
- `east`
- `south`
- `west`
- `west-threshold-top`
- `west-threshold-front`
- `ceiling`
- `depth-h2`
- `floor`
- `iron-door-body`
- `iron-door-reflection-probe`
- `iron-door-planar-reflection`
- `iron-door-hybrid-reflection`

## Cleanup Result

- Before first cleanup: `.omc` was about `28G`.
- After conservative cleanup: `.omc` was about `21G`.
- After current-room consolidation: `.omc` is about `4.0G`.

Only `.omc/current-room-runtime/` remains under `.omc`.

## Verification

The following checks passed after the move:

```sh
node docs/tests/r7-3-10-lightmap-pages-contract.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node --check js/InitCommon.js
node --check js/Home_Studio.js
```

The pointer existence probe also passed: all consolidated `packageDir` paths exist, and every referenced `atlasPatch0` file exists.

## Notes

The retained set is based on the current room runtime package paths, not old bake preparation folders, old reports, old probes, old screenshots, or old virtual environments.

Some historical `prepareDir` / mask paths in pointer metadata may refer to old bake-time locations. The runtime room load path fetches `packageDir` plus its atlas artifact.
