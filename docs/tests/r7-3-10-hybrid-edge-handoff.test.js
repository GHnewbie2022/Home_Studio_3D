import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

const shader = fs.readFileSync(path.join(repoRoot, 'shaders', 'Home_Studio_Fragment.glsl'), 'utf8');
const initCommon = fs.readFileSync(path.join(repoRoot, 'js', 'InitCommon.js'), 'utf8');
const homeStudio = fs.readFileSync(path.join(repoRoot, 'js', 'Home_Studio.js'), 'utf8');

assert.match(
  shader,
  /const float R7310_C1_WEST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX = 2\.846;/,
  'west wall beam-shadow hybrid must close the southwest orphan strip'
);
assert.match(
  shader,
  /const float R7310_C1_EAST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX = 2\.49;/,
  'east wall beam-shadow hybrid must close the southeast 15 mm orphan strip'
);
assert.match(
  shader,
  /const float R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN = 2\.7179;/,
  'west wall full bake must keep avoiding masked southwest handoff texels'
);
assert.match(
  shader,
  /const float R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN = 2\.49;/,
  'east wall full bake must meet the southeast column handoff with no orphan strip'
);
assert.match(
  initCommon,
  /const R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN = 2\.7179;/,
  'JS west wall metadata handoff must match shader'
);
assert.match(
  initCommon,
  /const R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN = 2\.49;/,
  'JS east wall metadata handoff must match shader and the southeast column dead zone'
);
assert.match(
  homeStudio,
  /uR7310C1WestWallBeamShadowZMaxOverride = \{ value: 2\.7179 \}/,
  'west wall beam shadow override must remain unchanged'
);

console.log('R7-3.10 hybrid edge handoff constants verified');
