#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const WIDTH = 2325;
const HEIGHT = 3377;
const BED = {
	xMin: -0.027,
	xMax: 1.91,
	yMin: 0.0,
	yMax: 0.28,
	zMin: -1.874,
	zMax: -0.314
};
const WALL_Z = -1.874;
const PREP_DIR = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/xatlas-bake-full-north-wall';
const RAW_DIR = '.omc/r7-3-10-xatlas-bake-spike/20260612-060012';
const OIDN_DIR = '.omc/r7-3-10-xatlas-bake-spike/20260612-060012-oidn-rt-high-beta';
const OUT_DIR = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/bedtop-overdarkening-audit';

function argValue(name, fallback) {
	const prefix = `--${name}=`;
	const hit = process.argv.find((arg) => arg.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : fallback;
}

function readF32(file, expectedFloats) {
	const buffer = fs.readFileSync(file);
	if (buffer.byteLength !== expectedFloats * 4) {
		throw new Error(`${file} byte size mismatch: got ${buffer.byteLength}, expected ${expectedFloats * 4}`);
	}
	return new Float32Array(buffer.buffer, buffer.byteOffset, expectedFloats);
}

function luma(r, g, b) {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

function uvFromWorld(x, y) {
	const y01 = Math.max(0, Math.min(1, y / 2.905));
	const x01 = Math.max(0, Math.min(1, (x + 2.11) / 4.22));
	return {
		u: (0.9997849464 * (1 - y01)) + (0.0002150538 * y01),
		v: (0.0001480604 * (1 - x01)) + (0.9998519421 * x01),
		local01: { x: x01, y: y01 }
	};
}

function pixelFromUv(uv) {
	return {
		x: Math.max(0, Math.min(WIDTH - 1, Math.floor(uv.u * WIDTH))),
		y: Math.max(0, Math.min(HEIGHT - 1, Math.floor(uv.v * HEIGHT)))
	};
}

function texel(arr, x, y) {
	const px = Math.max(0, Math.min(WIDTH - 1, Math.trunc(x)));
	const py = Math.max(0, Math.min(HEIGHT - 1, Math.trunc(y)));
	const i = (py * WIDTH + px) * 4;
	return {
		r: arr[i],
		g: arr[i + 1],
		b: arr[i + 2],
		a: arr[i + 3],
		luma: luma(arr[i], arr[i + 1], arr[i + 2])
	};
}

function worldTexel(arr, x, y) {
	const t = texel(arr, x, HEIGHT - 1 - y);
	return { x: t.r, y: t.g, z: t.b, valid: t.a };
}

function percentile(values, p) {
	if (!values.length) return null;
	const sorted = values.slice().sort((a, b) => a - b);
	const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)));
	return sorted[idx];
}

function summarize(samples) {
	const valid = samples.filter((s) => s.alpha > 0.5 && Number.isFinite(s.rawLuma));
	const lumas = valid.map((s) => s.rawLuma);
	const oidnLumas = valid.map((s) => s.oidnLuma).filter(Number.isFinite);
	const alphas = samples.map((s) => s.alpha);
	return {
		count: samples.length,
		validCount: valid.length,
		alphaOneCount: samples.filter((s) => s.alpha > 0.5).length,
		alphaMin: Math.min(...alphas),
		alphaMax: Math.max(...alphas),
		raw: {
			min: lumas.length ? Math.min(...lumas) : null,
			p10: percentile(lumas, 0.10),
			median: percentile(lumas, 0.50),
			p90: percentile(lumas, 0.90),
			max: lumas.length ? Math.max(...lumas) : null,
			mean: lumas.length ? lumas.reduce((a, b) => a + b, 0) / lumas.length : null
		},
		oidn: {
			min: oidnLumas.length ? Math.min(...oidnLumas) : null,
			p10: percentile(oidnLumas, 0.10),
			median: percentile(oidnLumas, 0.50),
			p90: percentile(oidnLumas, 0.90),
			max: oidnLumas.length ? Math.max(...oidnLumas) : null,
			mean: oidnLumas.length ? oidnLumas.reduce((a, b) => a + b, 0) / oidnLumas.length : null
		}
	};
}

function lineSamples({ name, x0, x1, y0, y1, steps, raw, oidn, world }) {
	const out = [];
	for (let i = 0; i < steps; i += 1) {
		const t = steps === 1 ? 0 : i / (steps - 1);
		const wx = x0 + (x1 - x0) * t;
		const wy = y0 + (y1 - y0) * t;
		const uv = uvFromWorld(wx, wy);
		const p = pixelFromUv(uv);
		const rawTexel = texel(raw, p.x, p.y);
		const oidnTexel = texel(oidn, p.x, p.y);
		const worldPos = worldTexel(world, p.x, p.y);
		out.push({
			name,
			i,
			worldX: wx,
			worldY: wy,
			worldZ: WALL_Z,
			pixelX: p.x,
			pixelY: p.y,
			uvU: uv.u,
			uvV: uv.v,
			alpha: rawTexel.a,
			rawLuma: rawTexel.luma,
			oidnLuma: oidnTexel.luma,
			worldSampleX: worldPos.x,
			worldSampleY: worldPos.y,
			worldSampleZ: worldPos.z,
			worldValid: worldPos.valid,
			worldDeltaMeters: Math.hypot(worldPos.x - wx, worldPos.y - wy, worldPos.z - WALL_Z)
		});
	}
	return out;
}

function bandWidth(samples, threshold) {
	const dark = samples.filter((s) => s.rawLuma <= threshold && s.alpha > 0.5);
	if (!dark.length) return { count: 0, xMin: null, xMax: null, widthMeters: 0 };
	const xMin = Math.min(...dark.map((s) => s.worldX));
	const xMax = Math.max(...dark.map((s) => s.worldX));
	return { count: dark.length, xMin, xMax, widthMeters: xMax - xMin };
}

function csvRows(samples) {
	const header = [
		'name', 'i', 'worldX', 'worldY', 'pixelX', 'pixelY',
		'alpha', 'rawLuma', 'oidnLuma', 'worldSampleX', 'worldSampleY',
		'worldSampleZ', 'worldValid', 'worldDeltaMeters'
	];
	const rows = [header.join(',')];
	for (const s of samples) {
		rows.push(header.map((key) => s[key]).join(','));
	}
	return rows.join('\n') + '\n';
}

const prepDir = argValue('prepare-dir', PREP_DIR);
const rawDir = argValue('raw-dir', RAW_DIR);
const oidnDir = argValue('oidn-dir', OIDN_DIR);
const outDir = argValue('out-dir', OUT_DIR);

const floats = WIDTH * HEIGHT * 4;
const raw = readF32(path.join(rawDir, 'atlas-patch-000-rgba-f32.bin'), floats);
const oidn = readF32(path.join(oidnDir, 'atlas-patch-000-rgba-f32.bin'), floats);
const world = readF32(path.join(prepDir, 'xatlas-bake-worldpos-rgba32f.bin'), floats);

const lines = [
	{ name: 'bed_top_y_0.280', x0: BED.xMin, x1: BED.xMax, y0: BED.yMax, y1: BED.yMax, steps: 257 },
	{ name: 'above_bed_top_y_0.300', x0: BED.xMin, x1: BED.xMax, y0: BED.yMax + 0.020, y1: BED.yMax + 0.020, steps: 257 },
	{ name: 'above_bed_top_y_0.340', x0: BED.xMin, x1: BED.xMax, y0: BED.yMax + 0.060, y1: BED.yMax + 0.060, steps: 257 },
	{ name: 'below_bed_top_y_0.240', x0: BED.xMin, x1: BED.xMax, y0: BED.yMax - 0.040, y1: BED.yMax - 0.040, steps: 257 },
	{ name: 'bed_west_vertical_x_-0.027', x0: BED.xMin, x1: BED.xMin, y0: 0.04, y1: BED.yMax, steps: 121 },
	{ name: 'bed_mid_vertical_x_0.020', x0: 0.020104, x1: 0.020104, y0: 0.04, y1: BED.yMax, steps: 121 },
	{ name: 'control_open_wall_y_0.520', x0: BED.xMin, x1: BED.xMax, y0: 0.520, y1: 0.520, steps: 257 }
];

const allSamples = [];
const lineReports = [];
for (const line of lines) {
	const samples = lineSamples({ ...line, raw, oidn, world });
	allSamples.push(...samples);
	const summary = summarize(samples);
	lineReports.push({
		name: line.name,
		worldRange: { x0: line.x0, x1: line.x1, y0: line.y0, y1: line.y1 },
		pixelRange: {
			xMin: Math.min(...samples.map((s) => s.pixelX)),
			xMax: Math.max(...samples.map((s) => s.pixelX)),
			yMin: Math.min(...samples.map((s) => s.pixelY)),
			yMax: Math.max(...samples.map((s) => s.pixelY))
		},
		summary,
		first: samples[0],
		mid: samples[Math.floor(samples.length / 2)],
		last: samples[samples.length - 1]
	});
}

const control = lineReports.find((line) => line.name === 'control_open_wall_y_0.520');
const bedTop = lineReports.find((line) => line.name === 'bed_top_y_0.280');
const above300 = lineReports.find((line) => line.name === 'above_bed_top_y_0.300');
const above340 = lineReports.find((line) => line.name === 'above_bed_top_y_0.340');
const below240 = lineReports.find((line) => line.name === 'below_bed_top_y_0.240');
const bedTopSamples = allSamples.filter((s) => s.name === 'bed_top_y_0.280');
const controlMedian = control.summary.raw.median;
const threshold85 = controlMedian == null ? null : controlMedian * 0.85;

const report = {
	schema: 'r7-3-10-full-north-wall-xatlas-bedtop-audit-v1',
	createdAt: new Date().toISOString(),
	inputs: { prepDir, rawDir, oidnDir, width: WIDTH, height: HEIGHT },
	bed: BED,
	orientation: {
		runtimeAtlas: 'package rgba read with runtime uv pixel',
		metadataWorldpos: 'prepare worldpos file uses opposite row order, sampled with y flip'
	},
	bakeSceneEvidence: {
		runnerDefaultNortheastFurnitureMode: 'bed',
		prepareR738C1BakeCaptureCallsSetC2NortheastFurnitureMode: true,
		manifestNortheastFurnitureModeWasNullBecauseReportDroppedPrepField: true
	},
	lines: lineReports,
	comparisons: {
		bedTopVsControlRawMedianRatio: bedTop.summary.raw.median / control.summary.raw.median,
		bedTopVsAbove300RawMedianRatio: bedTop.summary.raw.median / above300.summary.raw.median,
		bedTopVsAbove340RawMedianRatio: bedTop.summary.raw.median / above340.summary.raw.median,
		below240VsControlRawMedianRatio: below240.summary.raw.median / control.summary.raw.median,
		darkBandBelow85PctOfControl: threshold85 == null ? null : bandWidth(bedTopSamples, threshold85)
	},
	interpretation: {
		bedTopLineHasBakedDarkening: bedTop.summary.raw.median < control.summary.raw.median * 0.9,
		alphaFailureOnBedTop: bedTop.summary.alphaOneCount !== bedTop.summary.count,
		metadataMaxWorldDeltaMeters: Math.max(...allSamples.map((s) => s.worldDeltaMeters))
	}
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bedtop-overdarkening-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'bedtop-overdarkening-samples.csv'), csvRows(allSamples));
console.log(JSON.stringify({
	result: 'PASS',
	out: path.join(outDir, 'bedtop-overdarkening-audit.json'),
	bedTopMedian: bedTop.summary.raw.median,
	controlMedian: control.summary.raw.median,
	bedTopVsControlRawMedianRatio: report.comparisons.bedTopVsControlRawMedianRatio,
	darkBandBelow85PctOfControl: report.comparisons.darkBandBelow85PctOfControl,
	alphaFailureOnBedTop: report.interpretation.alphaFailureOnBedTop,
	metadataMaxWorldDeltaMeters: report.interpretation.metadataMaxWorldDeltaMeters
}, null, 2));
