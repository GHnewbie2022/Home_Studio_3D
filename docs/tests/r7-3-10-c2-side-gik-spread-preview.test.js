const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/Home_Studio.js', 'utf8');

function findPanel(label) {
    const line = source.split('\n').find((candidate) => candidate.includes(label));
    assert.ok(line, `${label} line missing`);
    const match = line.match(/\{ min: \[([^\]]+)\], max: \[([^\]]+)\]/);
    assert.ok(match, `cannot parse ${label}`);
    return {
        min: match[1].split(',').map((value) => Number(value.trim())),
        max: match[2].split(',').map((value) => Number(value.trim()))
    };
}

function near(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: ${actual} !== ${expected}`);
}

const panels = {
    e1: findPanel('E1 東牆'),
    e2: findPanel('E2 東牆'),
    e3: findPanel('E3 東牆'),
    w1: findPanel('W1 西牆'),
    w2: findPanel('W2 西牆'),
    w3: findPanel('W3 西牆')
};

assert.deepEqual(panels.e1.min, [1.792, 0.795, -0.689]);
assert.deepEqual(panels.e1.max, [1.91, 1.995, -0.089]);
assert.deepEqual(panels.w1.min, [-1.91, 0.795, -0.689]);
assert.deepEqual(panels.w1.max, [-1.792, 1.995, -0.089]);

assert.deepEqual(panels.e2.min, [1.792, 0.655, 0.198]);
assert.deepEqual(panels.e2.max, [1.91, 1.855, 0.798]);
assert.deepEqual(panels.w2.min, [-1.91, 0.655, 0.198]);
assert.deepEqual(panels.w2.max, [-1.792, 1.855, 0.798]);

assert.deepEqual(panels.e3.min, [1.792, 0.795, 1.085]);
assert.deepEqual(panels.e3.max, [1.91, 1.995, 1.685]);
assert.deepEqual(panels.w3.min, [-1.91, 0.795, 1.085]);
assert.deepEqual(panels.w3.max, [-1.792, 1.995, 1.685]);

near(panels.w2.min[2] - panels.w1.max[2], 0.287, 'north to center gap');
near(panels.w3.min[2] - panels.w2.max[2], 0.287, 'center to south gap');
near(panels.e2.min[2] - panels.e1.max[2], 0.287, 'east north to center gap');
near(panels.e3.min[2] - panels.e2.max[2], 0.287, 'east center to south gap');

console.log('R7-3.10 C2 side GIK spread preview passed');
