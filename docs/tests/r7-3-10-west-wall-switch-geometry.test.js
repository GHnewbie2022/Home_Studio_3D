const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const prepareSource = fs.readFileSync('docs/tools/r7-3-10-west-wall-switch-xatlas-prepare.py', 'utf8');
const lines = source.split('\n');

function findSwitchLine(label) {
    const line = lines.find((candidate) => candidate.includes(label));
    assert.ok(line, `${label} line missing`);
    return line;
}

function parseWhiteBox(line) {
    const match = line.match(/addBox\(\[([^\]]+)\], \[([^\]]+)\], z3, C_WHITE, (\d+), 0, 1\)/);
    assert.ok(match, `unexpected addBox shape: ${line}`);
    return {
        min: match[1].split(',').map((value) => Number(value.trim())),
        max: match[2].split(',').map((value) => Number(value.trim())),
        type: Number(match[3])
    };
}

function near(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: ${actual} !== ${expected}`);
}

const plate = parseWhiteBox(findSwitchLine('西牆開關面板'));
const button = parseWhiteBox(findSwitchLine('西牆開關按鈕'));

assert.equal(plate.type, 1, 'switch plate must not use OUTLET type');
assert.equal(button.type, 1, 'switch button must not use OUTLET type');
assert.ok(source.includes('const BASE_BOX_COUNT = 86;'), 'switch boxes must stay in base scene geometry');

assert.deepEqual(plate.min, [-1.91, 1.148, -0.089]);
assert.deepEqual(plate.max, [-1.90, 1.218, 0.031]);
assert.deepEqual(button.min, [-1.90, 1.161, -0.076]);
assert.deepEqual(button.max, [-1.898, 1.205, 0.018]);
near(button.min[0], plate.max[0], 'switch button must contact the plate without an air gap');

const plateCenterY = (plate.min[1] + plate.max[1]) * 0.5;
const plateCenterZ = (plate.min[2] + plate.max[2]) * 0.5;
near(plateCenterY, 1.183, 'switch center height');
near(plateCenterZ - (-1.874), 1.845, 'switch distance from north wall');

near(button.min[1] - plate.min[1], 0.013, 'button lower margin');
near(plate.max[1] - button.max[1], 0.013, 'button upper margin');
near(button.min[2] - plate.min[2], 0.013, 'button north margin');
near(plate.max[2] - button.max[2], 0.013, 'button south margin');

for (const surfaceId of [
    'west_wall_switch_plate',
    'west_wall_switch_plate_top',
    'west_wall_switch_plate_bottom',
    'west_wall_switch_plate_north',
    'west_wall_switch_plate_south',
    'west_wall_switch_button',
    'west_wall_switch_button_top',
    'west_wall_switch_button_bottom',
    'west_wall_switch_button_north',
    'west_wall_switch_button_south'
]) {
    assert.ok(
        prepareSource.includes(`\"surfaceId\": \"${surfaceId}\"`),
        `${surfaceId} must be present in the switch fixture XATLAS receiver mesh`
    );
}

assert.match(
    shader,
    /bool\s+r7310C1XatlasParamSurfaceUv\s*\(\s*int\s+sid\s*,\s*float\s+visibleObjectID\s*,\s*vec3\s+n\s*,\s*vec3\s+p\s*,\s*out\s+vec2\s+atlasUv\s*\)/,
    'xatlas param surface UV must receive object id'
);
assert.match(
    shader,
    /bool\s+r7310C1XatlasParamSurfaceAllowsObjectHit\s*\(\s*vec4\s+nf\s*,\s*vec4\s+bmin\s*,\s*vec4\s+bmax\s*\)/,
    'xatlas param surface UV must have an explicit object-hit exception gate'
);
assert.match(
    shader,
    /visibleObjectID\s*>=\s*1\.5\s*&&\s*!\s*r7310C1XatlasParamSurfaceAllowsObjectHit\s*\(\s*nf\s*,\s*bmin\s*,\s*bmax\s*\)/,
    'xatlas param surface UV must reject object ids unless a small param surface opts in'
);
assert.match(
    shader,
    /int\s+r7310XatlasRuntimeOwnerId\s*=\s*r7310SurfaceOwnerId\(x,\s*nl,\s*hitObjectID\);[\s\S]{0,520}r7310XatlasRuntimeOwnerId\s*==\s*R7310_OWNER_WEST_WALL_OPEN/,
    'west wall XATLAS route must be gated by the generated owner registry'
);
assert.match(
    shader,
    /r7310C1XatlasParamSampleAny\s*\(\s*visibleObjectID\s*,\s*visibleNormal\s*,\s*visiblePosition\s*,\s*r7310C1XatlasParamUv\s*\)/,
    'generic xatlas runtime route must pass object id into param surface sampling'
);
assert.match(
    shader,
    /r7310C1XatlasParamSurfaceUv\s*\(\s*int\s*\(\s*uR7310C1XatlasParamWestSurfaceIndex\s*\)\s*,\s*hitObjectID\s*,\s*nl\s*,\s*x\s*,\s*r7310XatlasRuntimeWestAtlasUv\s*\)/,
    'west direct-included classification must pass object id into param surface sampling'
);

console.log('R7-3.10 west wall switch geometry passed');
