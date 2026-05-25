const assert = require('node:assert/strict');
const fs = require('node:fs');

const js = fs.readFileSync('js/Home_Studio.js', 'utf8');
const html = fs.readFileSync('Home_Studio.html', 'utf8');
const css = fs.readFileSync('css/default.css', 'utf8');

function extractBox(layoutName, boxName) {
    const pattern = new RegExp(`${layoutName}: \\{[\\s\\S]*?${boxName}: \\{ min: \\[([^\\]]+)\\], max: \\[([^\\]]+)\\]`);
    const match = js.match(pattern);
    assert.ok(match, `${layoutName}.${boxName} geometry missing`);
    return {
        min: match[1].split(',').map((value) => Number(value.trim())),
        max: match[2].split(',').map((value) => Number(value.trim()))
    };
}

function near(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: ${actual} !== ${expected}`);
}

const wardrobe = extractBox('wardrobe', 'main');
const bed = extractBox('bed', 'main');

assert.deepEqual(wardrobe.min, [1.35, 0.0, -1.874]);
assert.deepEqual(wardrobe.max, [1.91, 1.955, -0.703]);
assert.deepEqual(bed.min, [-0.027, 0.0, -1.874]);
assert.deepEqual(bed.max, [1.91, 0.28, -0.314]);
assert.ok(js.includes('const C_BEDSHEET_SAGE = [0.58, 0.66, 0.54];'));
assert.ok(js.includes('color: C_BEDSHEET_SAGE'));
assert.ok(js.includes('roughness: 0.92'));

near(bed.max[0] - bed.min[0], 1.937, 'bed east-west width');
near(bed.max[2] - bed.min[2], 1.56, 'bed north-south length');
near(bed.max[1] - bed.min[1], 0.28, 'mattress-only height');
near(bed.max[0], 1.91, 'mattress east edge touches east wall');

assert.equal(js.includes('headboard:'), false, 'mattress-only mode must not create a headboard');
assert.equal(js.includes('sidePlatform:'), false, 'mattress-only mode must not create a side platform');

assert.ok(js.includes("let c2NortheastFurnitureMode = 'bed';"));
assert.ok(js.includes("var useBed = (c2NortheastFurnitureMode === 'bed');"));
assert.ok(js.includes("window.setC2NortheastFurnitureMode = setC2NortheastFurnitureMode;"));
assert.ok(js.includes("window.reportC2NortheastFurnitureLayout = reportC2NortheastFurnitureLayout;"));
assert.equal(js.includes("addC2NortheastBedHeadboardIfNeeded(config);"), false);
assert.ok(html.includes('id="btnC2NeWardrobe"'));
assert.ok(html.includes('id="btnC2NeBed"'));
assert.ok(html.includes('r7310-floor-ceiling-cutaway-right-leg-v3'));
assert.ok(css.includes('.config-furniture-controls'));
assert.ok(css.includes('.config-furniture-actions'));

console.log('R7-3.10 C2 northeast furniture toggle passed');
