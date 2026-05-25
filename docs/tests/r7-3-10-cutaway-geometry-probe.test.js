const assert = require('node:assert/strict');
const fs = require('node:fs');

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');

assert.match(runner, /--r7310-cutaway-geometry-probe/);
assert.match(runner, /probeLevels\s*=\s*\[42,\s*43,\s*44,\s*45,\s*46,\s*47,\s*48,\s*37,\s*38\]/);
assert.match(runner, /south_cutaway_m_right_leg_visible_controls/);
assert.match(runner, /south_cutaway_window_top_extension_restored/);
assert.match(runner, /expectedVisibleBoxIdxs:\s*\[19,\s*29,\s*31,\s*52,\s*53\]/);
assert.match(runner, /expectedVisibleBoxIdxs:\s*\[32\]/);
assert.match(runner, /expectedCeilingBox10MaxZ:\s*3\.056/);
assert.match(runner, /missing-visible-box/);
assert.match(runner, /ceiling-box10-max-z-drift/);
assert.match(runner, /expectedFailures/);
assert.match(runner, /finiteSamples && expectedFailures\.length === 0 \? 'pass' : 'fail'/);

assert.match(homeStudio, /if \(boxIdx <= 32\) return \{ roughness: 0\.9, metalness: 0\.0 \}/);
assert.match(shader, /if \(boxIdx <= 32\) hitColor \*= uWallAlbedo/);
assert.match(shader, /hitObjectID = float\(objectCount \+ \(boxIdx <= 32 \? 1 : boxIdx \+ 1\)\)/);

console.log('R7-3.10 cutaway geometry probe assertion contract passed');
