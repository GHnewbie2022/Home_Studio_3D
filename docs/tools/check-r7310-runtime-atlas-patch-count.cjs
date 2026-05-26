#!/usr/bin/env node
// R7-3.10 runtime atlas patchCount single-source lock (CODEX Phase 3 constraint).
// Adding the iron-door reveal (atlas slot 22) bumped the combined-atlas patchCount 22 -> 23.
// patchCount feeds THREE consumers that MUST agree:
//   (1) shader, via uniform uR7310C1RuntimeAtlasPatchCount  -> derives rows = ceil(patchCount/columns)
//   (2) JS compositor buildR7310C1CombinedDiffuseRuntimeTexture (var patchCount)
//   (3) status report (runtimeAtlasPatchCount + runtimeAtlasGridRows)
// Failure modes if a site desyncs (NOT "every face shifts" for the 22->23 bump — rows stay ceil(.../6)=4):
//   - shader patchCount stuck at 22 -> slot 22 clamps to slot 21 (iron-door reveal samples the WRONG cell).
//   - compositor patchCount stuck at 22 -> slot 22 never written into the atlas (iron-door cell stays black).
//   - rows desync (whole-atlas geometry shift, all faces move) only bites when a FUTURE patchCount crosses a row boundary.
// Lock: (a) const = 23 (never back to 22); (b) all 4 sync sites reference the const, not a literal;
//       (c) no stray hardcoded patchCount 22 remains. Run in CI / pre-commit. exit 0 = ok, exit 1 = drift.
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '../..');
const txt = fs.readFileSync(path.join(REPO, 'js/InitCommon.js'), 'utf8');
const homeStudio = fs.readFileSync(path.join(REPO, 'js/Home_Studio.js'), 'utf8');

let ok = true;
function check(label, cond, detail) {
  console.log((cond ? 'OK  ' : 'FAIL') + ' ' + label + (detail ? ': ' + detail : ''));
  if (!cond) ok = false;
}

// (a) const definition + value
const defM = txt.match(/const\s+R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*(\d+)/);
const patchCount = defM ? Number(defM[1]) : null;
check('const defined', defM !== null, defM ? String(patchCount) : 'MISSING');
check('const >= 23 (not reverted to 22)', patchCount !== null && patchCount >= 23, String(patchCount));

// (b) all 4 sync sites reference the const, not a literal
check('uniform site uses const',
  /uR7310C1RuntimeAtlasPatchCount\.value\s*=\s*R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\b/.test(txt));
check('compositor patchCount uses const',
  /var\s+patchCount\s*=\s*R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\b/.test(txt));
check('status runtimeAtlasPatchCount uses const',
  /runtimeAtlasPatchCount:\s*R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\b/.test(txt));
check('status runtimeAtlasGridRows uses const',
  /runtimeAtlasGridRows:\s*Math\.ceil\(\s*R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*\//.test(txt));
check('Home_Studio initial patchCount = 23.0',
  /uR7310C1RuntimeAtlasPatchCount\s*=\s*\{\s*value:\s*23\.0\s*\}/.test(homeStudio));

// (c) no stray hardcoded patchCount = 22 regression
check('no literal compositor patchCount = 22', !/var\s+patchCount\s*=\s*22\b/.test(txt));
check('no literal uniform patchCount = 22', !/uR7310C1RuntimeAtlasPatchCount\.value\s*=\s*22(\.0)?[^0-9]/.test(txt));
check('no literal status patchCount: 22', !/runtimeAtlasPatchCount:\s*22\b/.test(txt));

// reference count: 1 definition + 4 uses
const occ = (txt.match(/R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/g) || []).length;
check('const referenced at >= 5 sites (1 def + 4 uses)', occ >= 5, String(occ));

if (!ok) {
  console.error('MISMATCH: runtime atlas patchCount sources diverged. Fix before any bake — shader/compositor desync makes slot 22 sample the wrong cell or stay black.');
  process.exit(1);
}
console.log('runtime atlas patchCount single-source lock OK (value=' + patchCount + ', refs=' + occ + ').');
