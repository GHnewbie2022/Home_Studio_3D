const assert = require('node:assert/strict');
const fs = require('node:fs');

const js = fs.readFileSync('js/Home_Studio.js', 'utf8');
const html = fs.readFileSync('Home_Studio.html', 'utf8');

assert.ok(js.includes('const C2_PANEL_CONFIG2_E3_IDX = 5;'));
assert.ok(js.includes('const C2_PANEL_CONFIG2_W3_IDX = 8;'));
assert.ok(js.includes('const C2_SOUTH_GIK_THICKNESS_STANDARD = 0.118;'));
assert.ok(js.includes('const C2_SOUTH_GIK_THICKNESS_SPOT = 0.0508;'));
assert.ok(js.includes("let c2SouthGikThicknessMode = 'spot';"));
assert.ok(js.includes('function isC234PanelConfig(config) {'));
assert.ok(js.includes("if (!isC234PanelConfig(config) || c2SouthGikThicknessMode !== 'spot') return spec;"));
assert.ok(js.includes('spec.min[0] = 1.91 - C2_SOUTH_GIK_THICKNESS_SPOT;'));
assert.ok(js.includes('spec.max[0] = -1.91 + C2_SOUTH_GIK_THICKNESS_SPOT;'));
assert.ok(js.includes('resolvePanelConfig2Spec(config, panelIndex, p);'));
assert.ok(js.includes('window.setC2SouthGikThicknessMode = setC2SouthGikThicknessMode;'));
assert.ok(js.includes('window.reportC2SouthGikThicknessMode = reportC2SouthGikThicknessMode;'));

assert.ok(html.includes('id="c2-south-gik-thickness-controls"'));
assert.ok(html.includes('id="btnC2SouthGikStandard"'));
assert.ok(html.includes('id="btnC2SouthGikSpot"'));
assert.ok(html.includes('r7310-default-bed-south-spot-v1'));

const eastStandard = { minX: 1.792, maxX: 1.91 };
const westStandard = { minX: -1.91, maxX: -1.792 };
const eastSpot = { minX: 1.91 - 0.0508, maxX: 1.91 };
const westSpot = { minX: -1.91, maxX: -1.91 + 0.0508 };

assert.equal(Number((eastStandard.maxX - eastStandard.minX).toFixed(4)), 0.118);
assert.equal(Number((westStandard.maxX - westStandard.minX).toFixed(4)), 0.118);
assert.equal(Number((eastSpot.maxX - eastSpot.minX).toFixed(4)), 0.0508);
assert.equal(Number((westSpot.maxX - westSpot.minX).toFixed(4)), 0.0508);
assert.deepEqual(eastSpot, { minX: 1.8592, maxX: 1.91 });
assert.deepEqual(westSpot, { minX: -1.91, maxX: -1.8592 });

console.log('R7-3.10 C2 south GIK thickness toggle passed');
