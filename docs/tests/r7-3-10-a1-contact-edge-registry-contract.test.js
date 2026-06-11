import assert from 'node:assert/strict';
import fs from 'node:fs';

// R7-3.10 Step E — A1 接觸邊 registry 三來源 contract（SOP source.md §14.7）。
//
// 鎖 gate / bake / metadata 三來源，任一方對不上即 FAIL（approxEqual EPS 1e-6）：
//   gate     ：registry ↔ JS InitCommon r7310C1NorthWallHiddenByBeamGap 真值 ↔ shader shaderGates 真值；驗 wiring。
//   bake     ：registry ↔ baked package、北牆非方格 atlas UV rect、surface worldBounds。
//   metadata ：registry ↔ structuralIslands(west_beam_inner_x worldFace) ↔ atlasEdgePolicies(north)。
//   共用     ：registry 兩側 surface ID ↔ InitCommon worldBounds 存在。
// 仿範本 docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js 的「讀 shader + InitCommon、regex、approxEqual、驗 wiring」。

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const REG_PATH = 'docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates/a1-contact-edge-registry.json';
const registry = JSON.parse(fs.readFileSync(REG_PATH, 'utf8'));

const EPS = 1e-6;
const approx = (a, b) => Math.abs(a - b) <= EPS;
function eqRect(label, r, j) {
	for (const k of ['xMin', 'xMax', 'yMin', 'yMax']) {
		assert.ok(r && j && approx(r[k], j[k]), `${label}.${k} desync: registry/?=${r ? r[k] : 'NA'} truth=${j ? j[k] : 'NA'}`);
	}
}

// ---- JS 真值：beam-gap west（同範本解析法）----
const jsBlockMatch = initCommon.match(/R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
assert.ok(jsBlockMatch, 'InitCommon: beam-gap regions block not found');
function parseSideRect(block, side) {
	const m = block.match(new RegExp(side + '\\s*:\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)'));
	assert.ok(m, `InitCommon: ${side} rect not found`);
	const grab = (key) => { const mm = m[1].match(new RegExp(key + '\\s*:\\s*(-?[0-9.]+)')); assert.ok(mm, `${side}.${key}`); return parseFloat(mm[1]); };
	return { xMin: grab('xMin'), xMax: grab('xMax'), yMin: grab('yMin'), yMax: grab('yMax') };
}
const jsWest = parseSideRect(jsBlockMatch[1], 'west');

// ---- shader 真值：west beam-gap named constants ----
function parseShaderConst(name) {
	const m = shader.match(new RegExp('const\\s+float\\s+' + name + '\\s*=\\s*(-?[0-9.]+)\\s*;'));
	assert.ok(m, `shader: ${name} not found`);
	return parseFloat(m[1]);
}
function parseShaderRect(prefix) {
	return {
		xMin: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_X_MIN`),
		xMax: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_X_MAX`),
		yMin: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_Y_MIN`),
		yMax: parseShaderConst(`R7310_C1_NORTH_WALL_BEAM_GAP_${prefix}_Y_MAX`)
	};
}
const shaderWest = parseShaderRect('WEST');

// ---- InitCommon: north/west-beam worldBounds、island worldFace、atlas UV rect ----
function parseConstScalar(constName, key) {
	const m = initCommon.match(new RegExp(constName + '\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);'));
	assert.ok(m, `InitCommon: ${constName} block not found`);
	const mm = m[1].match(new RegExp('(?:^|[^A-Za-z])' + key + '\\s*:\\s*(-?[0-9.]+)'));
	assert.ok(mm, `InitCommon: ${constName}.${key} not found`);
	return parseFloat(mm[1]);
}
const jsNorthWallZ = parseConstScalar('R7310_C1_NORTH_WALL_WORLD_BOUNDS', 'z');
const jsWestBeamX = parseConstScalar('R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS', 'x');

// island west_beam_inner_x 的 worldFace.value（x=-1.75）
const islMatch = initCommon.match(/name:\s*'west_beam_inner_x'[\s\S]*?worldFace:\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
assert.ok(islMatch, 'InitCommon: west_beam_inner_x island worldFace not found');
const islValM = islMatch[1].match(/value:\s*(-?[0-9.]+)/);
assert.ok(islValM, 'InitCommon: island worldFace.value not found');
const jsIslandValue = parseFloat(islValM[1]);

// atlas UV rect（北牆非方格）：uMin/vMin/uMax/vMax 可能是運算式，取其數值近似（registry 端存的是已算值）。
// 這裡僅驗 registry 有存且為 0..1 範圍合理值（UV rect 的逐位元鎖由 export 對 InitCommon 已做；此處驗 registry 有帶）。
const uv = registry.lockedConstants.nonSquareNorthWallUvRect;

// ===== gate：三方比對 + wiring =====
const regGateWest = registry.lockedConstants.gateWest;
const regShaderGateWest = registry.lockedConstants.shaderGateWest;
eqRect('gate registry↔JS', regGateWest, jsWest);
eqRect('gate registry↔shader', regShaderGateWest, shaderWest);
eqRect('gate JS↔shader', jsWest, shaderWest);
assert.equal(registry.lockedConstants.shaderWiringPresent, true, 'gate: registry.shaderWiringPresent must be true');
// shader 真的 wiring 了總 owner gate（定義存在不算）
assert.match(shader, /r7310C1NorthWallOwnerExcluded\(\s*visiblePosition\.x\s*,\s*visiblePosition\.y\s*\)/, 'shader: runtime gate must wire r7310C1NorthWallOwnerExcluded');
assert.match(shader, /r7310C1NorthWallOwnerExcluded\(\s*x\s*,\s*y\s*\)/, 'shader: bake-surface-point must wire r7310C1NorthWallOwnerExcluded');
assert.match(shader, /r7310C1NorthWallHiddenByBeamGap\(\s*x\s*,\s*y\s*\)/, 'shader: owner-excluded helper must include r7310C1NorthWallHiddenByBeamGap');

// ===== metadata：island worldFace + atlasEdgePolicy =====
const regIsland = registry.lockedConstants.westBeamInnerIsland;
assert.ok(regIsland && regIsland.worldFace, 'metadata: registry westBeamInnerIsland missing');
assert.ok(approx(regIsland.worldFace.value, jsIslandValue), `metadata island worldFace.value desync: registry=${regIsland.worldFace.value} JS=${jsIslandValue}`);
const regPolicy = registry.lockedConstants.northAtlasEdgePolicy;
assert.ok(regPolicy && regPolicy.invalidRegion, 'metadata: registry northAtlasEdgePolicy missing');
eqRect('metadata atlasEdgePolicy.invalidRegion↔JS gate west', regPolicy.invalidRegion, jsWest);

// ===== bake：surface worldBounds + package + UV rect 存在 =====
assert.ok(approx(registry.lockedConstants.northWallWorldBounds_1002.z, jsNorthWallZ), `bake north wall z desync: registry=${registry.lockedConstants.northWallWorldBounds_1002.z} JS=${jsNorthWallZ}`);
assert.ok(approx(registry.lockedConstants.westBeamInnerWorldBounds_1015.x, jsWestBeamX), `bake west beam x desync: registry=${registry.lockedConstants.westBeamInnerWorldBounds_1015.x} JS=${jsWestBeamX}`);
assert.equal(registry.lockedConstants.bakedPackage, 'd800-north-denoise-c', 'bake: package mismatch');
assert.ok(uv && uv.uMax > 0 && uv.uMax <= 1 && uv.vMax > 0 && uv.vMax <= 1, 'bake: nonSquareNorthWallUvRect missing/invalid');

// ===== 共用：兩側 surface ID =====
const ids = (registry.edges[0].sideSurfaceIds || []).map((s) => s.targetId);
assert.ok(ids.includes(1002) && ids.includes(1015), 'shared: sideSurfaceIds must include 1002 & 1015');

// ===== ownerPolicy 仍須 PENDING（Step E 的 contract 不負責產出 owner，只鎖三來源常數）=====
assert.equal(registry.edges[0].ownerPolicy, 'PENDING', 'ownerPolicy must remain PENDING until reconciliation step fills it');

console.log('R7-3.10 A1 contact-edge registry three-source contract passed');
console.log(`  gate   JS/shader/registry west: xMin=${jsWest.xMin} xMax=${jsWest.xMax} yMin=${jsWest.yMin} yMax=${jsWest.yMax}`);
console.log(`  meta   island worldFace.value=${jsIslandValue}  atlasEdgePolicy.invalidRegion==gate west`);
console.log(`  bake   northWall.z=${jsNorthWallZ}  westBeamInner.x=${jsWestBeamX}  package=d800-north-denoise-c`);
console.log(`  shared sideSurfaceIds=[${ids.join(',')}]  ownerPolicy=${registry.edges[0].ownerPolicy}`);
