#!/usr/bin/env node
// R7-3.10 北牆 D-ramp throwaway combined package assembler（參數化，D800/D1000 共用）。
// 垂直堆疊：north（D 提高後 raw）在上、east（沿用 p5d preview 區塊）2912x1716 在下。
// north 整塊搬（NORTH_W==COMB_W，stride 對齊）、east 逐列搬（src 2912 != dst COMB_W）。
// 內建 §21.4 gate：byteLength / uvRect-faceSize round-trip / north+east nonzero。
// throwaway，不 promotion、不覆蓋 accepted package。
//
// 用法：
//   node docs/tools/r7-3-10-assemble-d800-combined-package.mjs \
//     --north-raw=.omc/.../atlas-patch-000-rgba-f32.bin --north-w=3379 --north-h=2327 --key=d800-north-preview
import fs from 'node:fs';
import path from 'node:path';

function arg(name, def) {
	const p = '--' + name + '=';
	const m = process.argv.slice(2).find((a) => a.startsWith(p));
	return m ? m.slice(p.length) : def;
}
function fail(msg) { console.error('ASSEMBLER FAIL: ' + msg); process.exit(1); }

const NORTH_RAW = arg('north-raw', '.omc/r7-3-10-full-room-diffuse-bake/20260602-015822/atlas-patch-000-rgba-f32.bin');
const NORTH_W = Number(arg('north-w', '3379'));
const NORTH_H = Number(arg('north-h', '2327'));
const KEY = arg('key', 'd800-north-preview'); // d800-north-preview / d1000-north-preview

const PREVIEW_DIR = 'assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-p5d-runtime-preview';
const EAST_CHUNKS = [
	path.join(PREVIEW_DIR, 'north-east-non-square-p5d-preview-2912x3432-rgba-f32.part0.bin'),
	path.join(PREVIEW_DIR, 'north-east-non-square-p5d-preview-2912x3432-rgba-f32.part1.bin'),
];
const D590_POINTER = 'docs/data/r7-3-10-c1-north-east-non-square-runtime-package.json';

const EAST_W = 2912, EAST_H = 1716;
const PREVIEW_W = 2912, PREVIEW_H = 3432, EAST_SRC_ROW0 = 1716; // east 在 preview 的 row 1716..3431
const BPP = 16; // RGBA Float32

const COMB_W = Math.max(NORTH_W, EAST_W); // north 與 east 取較寬者
const COMB_H = NORTH_H + EAST_H;

const pointerName = KEY.replace('-north-preview', '-preview'); // d800-preview / d1000-preview
const OUT_DIR = `assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-${pointerName}-${COMB_W}x${COMB_H}-1000spp`;
const OUT_ATLAS = 'atlas-patch-000-rgba-f32.bin';
const OUT_POINTER = `docs/data/r7-3-10-c1-north-east-non-square-${pointerName}-runtime-package.json`;

// --- read sources ---
const north = fs.readFileSync(NORTH_RAW);
if (north.length !== NORTH_W * NORTH_H * BPP) fail(`north size ${north.length} != ${NORTH_W * NORTH_H * BPP}`);
const east = Buffer.concat(EAST_CHUNKS.map((f) => fs.readFileSync(f)));
if (east.length !== PREVIEW_W * PREVIEW_H * BPP) fail(`east(preview) size ${east.length} != ${PREVIEW_W * PREVIEW_H * BPP}`);

// --- allocate combined (zero-filled) ---
const comb = Buffer.alloc(COMB_W * COMB_H * BPP);
const combRow = COMB_W * BPP;
const previewRow = PREVIEW_W * BPP;

// north -> (0,0): 整塊 copy 若滿寬，否則逐列（右側留 0）
if (NORTH_W === COMB_W) {
	north.copy(comb, 0, 0, NORTH_W * NORTH_H * BPP);
} else {
	const northRow = NORTH_W * BPP;
	for (let r = 0; r < NORTH_H; r++) {
		north.copy(comb, r * combRow, r * northRow, (r + 1) * northRow);
	}
}

// east: per-row copy (src stride 2912 != dst stride COMB_W) to (0, NORTH_H)
for (let r = 0; r < EAST_H; r++) {
	const srcOff = (EAST_SRC_ROW0 + r) * previewRow;
	const dstOff = (NORTH_H + r) * combRow; // col 0
	east.copy(comb, dstOff, srcOff, srcOff + EAST_W * BPP);
}

// --- gate 1: byteLength ---
if (comb.length !== COMB_W * COMB_H * BPP) fail(`combined byteLength ${comb.length}`);

// --- gate 2: uvRect <-> faceSize round-trip (integer-layout-derived) ---
const uv = {
	northWall: { x: 0, y: 0, z: NORTH_W / COMB_W, w: NORTH_H / COMB_H },
	eastWall: { x: 0, y: NORTH_H / COMB_H, z: EAST_W / COMB_W, w: 1 },
};
const face = { northWall: { width: NORTH_W, height: NORTH_H }, eastWall: { width: EAST_W, height: EAST_H } };
for (const k of ['northWall', 'eastWall']) {
	const w = Math.round((uv[k].z - uv[k].x) * COMB_W);
	const h = Math.round((uv[k].w - uv[k].y) * COMB_H);
	if (w !== face[k].width || h !== face[k].height) fail(`${k} uvRect/faceSize ${w}x${h} != ${face[k].width}x${face[k].height}`);
}

// --- gate 3: north / east region nonzero (sampled) ---
function regionNonzero(x0, y0, w, h) {
	let cnt = 0;
	for (let y = y0; y < y0 + h; y += 37) {
		for (let x = x0; x < x0 + w; x += 37) {
			const o = (y * COMB_W + x) * BPP;
			const lum = comb.readFloatLE(o) * 0.2126 + comb.readFloatLE(o + 4) * 0.7152 + comb.readFloatLE(o + 8) * 0.0722;
			if (lum > 0) cnt++;
		}
	}
	return cnt;
}
const northNZ = regionNonzero(0, 0, NORTH_W, NORTH_H);
const eastNZ = regionNonzero(0, NORTH_H, EAST_W, EAST_H);
if (northNZ <= 0) fail('north region all-zero');
if (eastNZ <= 0) fail('east region all-zero');

// --- write outputs ---
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, OUT_ATLAS), comb);

const tpl = JSON.parse(fs.readFileSync(D590_POINTER, 'utf8'));
const pointer = {
	...tpl,
	note: `D-ramp throwaway A/B (${pointerName}): north ${NORTH_W}x${NORTH_H} separated non-square Metal bake (${NORTH_RAW}) + east block resampled from p5d preview rows 1716..3431. Throwaway, not for promotion.`,
	packageDir: OUT_DIR,
	targetAtlasWidth: COMB_W,
	targetAtlasHeight: COMB_H,
	requestedSamples: 1000,
	actualSamples: 1000,
	diffuseOnly: true,
	upscaled: false,
	uvRects: uv,
	faceSizePx: face,
	sourceBuild: { north: NORTH_RAW, east: PREVIEW_DIR + ' (rows 1716..3431)' },
	artifacts: { atlas: OUT_ATLAS, atlasPatch0: OUT_ATLAS },
};
delete pointer.atlasChunks;
fs.writeFileSync(OUT_POINTER, JSON.stringify(pointer, null, 2));

console.log('ASSEMBLER OK', pointerName);
console.log('combined:', comb.length, 'bytes =', COMB_W + 'x' + COMB_H + 'x16');
console.log('northNZ(sampled):', northNZ, 'eastNZ(sampled):', eastNZ);
console.log('uvRects:', JSON.stringify(uv));
console.log('atlas:', path.join(OUT_DIR, OUT_ATLAS));
console.log('pointer:', OUT_POINTER);
