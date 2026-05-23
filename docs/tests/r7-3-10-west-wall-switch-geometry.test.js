const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/Home_Studio.js', 'utf8');
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
assert.ok(source.includes('const BASE_BOX_COUNT = 85;'), 'switch boxes must stay in base scene geometry');

assert.deepEqual(plate.min, [-1.91, 1.148, -0.089]);
assert.deepEqual(plate.max, [-1.90, 1.218, 0.031]);
assert.deepEqual(button.min, [-1.899, 1.161, -0.076]);
assert.deepEqual(button.max, [-1.898, 1.205, 0.018]);

const plateCenterY = (plate.min[1] + plate.max[1]) * 0.5;
const plateCenterZ = (plate.min[2] + plate.max[2]) * 0.5;
near(plateCenterY, 1.183, 'switch center height');
near(plateCenterZ - (-1.874), 1.845, 'switch distance from north wall');

near(button.min[1] - plate.min[1], 0.013, 'button lower margin');
near(plate.max[1] - button.max[1], 0.013, 'button upper margin');
near(button.min[2] - plate.min[2], 0.013, 'button north margin');
near(plate.max[2] - button.max[2], 0.013, 'button south margin');

console.log('R7-3.10 west wall switch geometry passed');
