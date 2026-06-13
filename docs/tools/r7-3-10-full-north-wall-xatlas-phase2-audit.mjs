#!/usr/bin/env node
/*
 * R7-3.10 Phase 2 full north-wall XATLAS blocker audit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '..', '..');

function parseArgs(argv) {
	const out = {
		prepareDir: null,
		rawPointer: 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json',
		oidnPointer: 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-oidn-runtime-package.json',
		out: null,
	};
	for (const arg of argv) {
		if (arg.startsWith('--prepare-dir=')) out.prepareDir = arg.slice('--prepare-dir='.length);
		else if (arg.startsWith('--raw-pointer=')) out.rawPointer = arg.slice('--raw-pointer='.length);
		else if (arg.startsWith('--oidn-pointer=')) out.oidnPointer = arg.slice('--oidn-pointer='.length);
		else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
	}
	if (!out.prepareDir) throw new Error('missing --prepare-dir');
	return out;
}

function abs(p) {
	return path.isAbsolute(p) ? p : path.join(repo, p);
}

function rel(p) {
	return path.relative(repo, abs(p)).replaceAll(path.sep, '/');
}

function readJson(p) {
	return JSON.parse(fs.readFileSync(abs(p), 'utf8'));
}

function writeJson(p, data) {
	const target = abs(p);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
}

function fileSize(p) {
	return fs.statSync(abs(p)).size;
}

function readF32(buffer, index) {
	return buffer.readFloatLE(index * 4);
}

function ownerExcluded(x, y) {
	if (x <= -1.91 || x >= 1.91) return true;
	if (x >= -1.52 && x <= -0.73 && y >= 0.0 && y <= 2.03) return true;
	if (x >= -1.908 && x <= -1.752 && y >= 2.525 && y <= 2.905) return true;
	if (x >= 1.850 && x <= 1.908 && y >= 2.516 && y <= 2.905) return true;
	return false;
}

function runtimeUv(prep, x, y) {
	const f = prep.uvFormula;
	const x01 = (x + 2.11) / 4.22;
	const y01 = y / 2.905;
	const u = f.uAtYMin * (1 - y01) + f.uAtYMax * y01;
	const rawV = f.vAtXMin * (1 - x01) + f.vAtXMax * x01;
	return { u, v: 1 - rawV, x01, y01 };
}

function samplePackage(pkg, prep, sample) {
	const width = Number(pkg.pointer.targetAtlasWidth);
	const height = Number(pkg.pointer.targetAtlasHeight);
	const uv = runtimeUv(prep, sample.x, sample.y);
	const px = Math.max(0, Math.min(width - 1, Math.floor(uv.u * width)));
	const py = Math.max(0, Math.min(height - 1, Math.floor(uv.v * height)));
	const idx = py * width + px;
	const rgba = [
		readF32(pkg.atlas, idx * 4 + 0),
		readF32(pkg.atlas, idx * 4 + 1),
		readF32(pkg.atlas, idx * 4 + 2),
		readF32(pkg.atlas, idx * 4 + 3),
	];
	const luma = 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2];
	return {
		name: sample.name,
		role: sample.role,
		world: { x: sample.x, y: sample.y, z: -1.874 },
		pixel: { x: px, y: py },
		atlasUv: uv,
		rgba,
		luma,
		alphaOne: rgba[3] > 0.5,
		ownerExcluded: ownerExcluded(sample.x, sample.y),
		expected: sample.expected,
		occluder: sample.occluder || null,
	};
}

function loadPackage(pointerPath) {
	const pointer = readJson(pointerPath);
	const atlasPath = path.join(pointer.packageDir, pointer.artifacts.atlasPatch0);
	const metadataPath = path.join(pointer.packageDir, pointer.artifacts.texelMetadataPatch0);
	const alphaReportPath = path.join(pointer.packageDir, pointer.artifacts.xatlasC2CAlphaReport);
	const validationPath = path.join(pointer.packageDir, pointer.artifacts.validationReport);
	return {
		pointerPath,
		pointer,
		atlas: fs.readFileSync(abs(atlasPath)),
		metadataBytes: fileSize(metadataPath),
		alphaReport: readJson(alphaReportPath),
		validation: readJson(validationPath),
		oidnMetrics: pointer.artifacts.oidnMetrics ? readJson(path.join(pointer.packageDir, pointer.artifacts.oidnMetrics)) : null,
	};
}

function assertCheck(checks, name, pass, detail) {
	checks.push({ name, pass: !!pass, detail });
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const prep = readJson(path.join(args.prepareDir, 'xatlas-bake-texelmap.json'));
	const normal = readJson(path.join(args.prepareDir, 'xatlas-normal-len-audit.json'));
	const mask = readJson(path.join(args.prepareDir, 'xatlas-bake-c2c-full-wall-validity-mask-report.json'));
	const raw = loadPackage(args.rawPointer);
	const oidn = loadPackage(args.oidnPointer);
	const shader = fs.readFileSync(abs('shaders/Home_Studio_Fragment.glsl'), 'utf8');
	const initCommon = fs.readFileSync(abs('js/InitCommon.js'), 'utf8');
	const checks = [];

	assertCheck(checks, 'unwrap_single_island', prep.unwrap?.singleIsland === true && prep.unwrap?.chartCount === 1, prep.unwrap);
	assertCheck(checks, 'atlas_size_budget', prep.atlas?.width === 2325 && prep.atlas?.height === 3377 && prep.atlas?.width < 4096 && prep.atlas?.height < 4096, prep.atlas);
	assertCheck(checks, 'normal_len_blocker', normal.status === 'PASS' && normal.zeroCount === 0 && normal.tileFailures?.length === 0, { zeroCount: normal.zeroCount, tileFailures: normal.tileFailures?.length });
	assertCheck(checks, 'density', prep.density?.maxMetersPerTexel <= 0.00125 && prep.density?.a1Roi?.reachesFull4x === true, prep.density);
	assertCheck(checks, 'duplicate_texel_claims', prep.counts?.overlapTexelsSkipped === 0, { overlapTexelsSkipped: prep.counts?.overlapTexelsSkipped });
	assertCheck(checks, 'out_of_bounds_claims', prep.worldBounds?.min?.[0] >= -2.111 && prep.worldBounds?.max?.[0] <= 2.111 && prep.worldBounds?.min?.[1] >= -0.001 && prep.worldBounds?.max?.[1] <= 2.906, prep.worldBounds);
	assertCheck(checks, 'gap_atlas_data_runtime_gate_split', mask.result === 'PASS' && mask.ownerGateSplit?.status === 'PASS', mask.ownerGateSplit);
	assertCheck(checks, 'raw_content_checks', raw.pointer.validation?.contentChecksPass === true && raw.pointer.validation?.minCompletedSamples === 1000 && raw.pointer.validation?.contextLostCount === 0, raw.pointer.validation);
	assertCheck(checks, 'raw_allowed_runner_warning', JSON.stringify(raw.pointer.validation?.runnerFailedChecks || []) === JSON.stringify(['gpu-submission-ms-over-250']), raw.pointer.validation?.runnerFailedChecks || []);
	assertCheck(checks, 'oidn_metrics', oidn.pointer.denoise?.passDecision === 'pass' && oidn.oidnMetrics?.passDecision === 'pass' && oidn.oidnMetrics?.atlasIntegrity?.nanCount === 0 && oidn.oidnMetrics?.atlasIntegrity?.infCount === 0, oidn.pointer.denoise);
	for (const [label, pkg] of [['raw', raw], ['oidn', oidn]]) {
		const width = Number(pkg.pointer.targetAtlasWidth);
		const height = Number(pkg.pointer.targetAtlasHeight);
		assertCheck(checks, `${label}_atlas_bytes`, pkg.atlas.length === width * height * 4 * 4, { bytes: pkg.atlas.length });
		assertCheck(checks, `${label}_metadata_bytes`, pkg.metadataBytes === width * height * 12 * 4, { bytes: pkg.metadataBytes });
		assertCheck(checks, `${label}_alpha_policy`, pkg.pointer.alphaAudit?.alphaOneExactBlackTexels === 0 && pkg.pointer.alphaAudit?.sourceBlackAlphaOneUsed === 0 && pkg.pointer.alphaAudit?.maxDistanceTexels <= 4, pkg.pointer.alphaAudit);
	}

	const samples = [
		{ name: 'a1_west_beam_roi', role: 'visible', x: -1.70, y: 1.45, expected: 'alpha1_luma' },
		{ name: 'northeast_bedside', role: 'visible', x: 1.55, y: 1.00, expected: 'alpha1_luma' },
		{ name: 'door_west_visible_edge', role: 'bright_overcut_edge', x: -1.525, y: 1.00, expected: 'alpha1_luma' },
		{ name: 'door_east_visible_edge', role: 'bright_overcut_edge', x: -0.725, y: 1.00, expected: 'alpha1_luma' },
		{ name: 'door_top_visible_edge', role: 'bright_overcut_edge', x: -1.10, y: 2.035, expected: 'alpha1_luma' },
		{ name: 'west_beam_lower_visible_edge', role: 'bright_overcut_edge', x: -1.83, y: 2.520, expected: 'alpha1_luma' },
		{ name: 'east_beam_lower_visible_edge', role: 'bright_overcut_edge', x: 1.88, y: 2.510, expected: 'alpha1_luma' },
		{ name: 'center_furniture_occluded', role: 'geometry_occluded', x: 0.00, y: 1.40, expected: 'alpha0_allowed', occluder: { boxIndex: 87, bounds: { xMin: -0.27, xMax: 0.33, yMin: 0.655, yMax: 1.855, zMin: -1.874, zMax: -1.756 } } },
	];
	const sampleAudit = { raw: [], oidn: [] };
	for (const [label, pkg] of [['raw', raw], ['oidn', oidn]]) {
		for (const sample of samples) {
			const row = samplePackage(pkg, prep, sample);
			sampleAudit[label].push(row);
		}
		const failures = sampleAudit[label].filter((row) => {
			if (row.expected === 'alpha1_luma') return !(row.alphaOne && row.luma > 1.0e-6);
			if (row.expected === 'alpha0_allowed') return row.alphaOne;
			return true;
		});
		assertCheck(checks, `${label}_bright_overcut_and_hidden_samples`, failures.length === 0, failures);
	}

	const samplerNames = [...shader.matchAll(/^\s*uniform\s+sampler2D\s+([A-Za-z0-9_]+)\s*;/gm)].map((m) => m[1]);
	const northSourceProbe = shader.indexOf('r7310FinalRuntimeSourceId = 2.0');
	const xatlasRuntimeApply = shader.indexOf('if (r7310XatlasRuntimeFirstHit)', northSourceProbe + 1);
	const xatlasRuntimeApplyEnd = shader.indexOf('if (r7310FloorHybridFirstHit)', xatlasRuntimeApply + 1);
	const applyBody = shader.slice(xatlasRuntimeApply, xatlasRuntimeApplyEnd);
	assertCheck(checks, 'sampler_budget', samplerNames.length === 15 && samplerNames.includes('tR738C1BakeAtlasTexture'), samplerNames);
	assertCheck(checks, 'source_route_first_hit', shader.includes('r7310C1XatlasNorthWallUv') && !/\bbreak\s*;/.test(applyBody), { firstHitApplyFound: xatlasRuntimeApply >= 0 });
	assertCheck(checks, 'runtime_package_route', initCommon.includes('full-north-wall-raw') && initCommon.includes('full-north-wall-oidn') && initCommon.includes('c1_xatlas_full_north_wall_runtime'), true);

	const result = checks.every((check) => check.pass) ? 'PASS' : 'FAIL';
	const report = {
		schema: 'r7-3-10-full-north-wall-xatlas-phase2-audit-v1',
		result,
		checks,
		prepareDir: rel(args.prepareDir),
		rawPointer: rel(args.rawPointer),
		oidnPointer: rel(args.oidnPointer),
		sampleAudit,
		redLines: {
			noFormalRadianceBake: true,
			defaultRuntimePointerChanged: false,
			noD800Promotion: true,
			noCommit: true,
		},
	};
	if (args.out) writeJson(args.out, report);
	console.log(JSON.stringify({ result, failed: checks.filter((check) => !check.pass).map((check) => check.name), out: args.out ? rel(args.out) : null }, null, 2));
	process.exitCode = result === 'PASS' ? 0 : 1;
}

main();
