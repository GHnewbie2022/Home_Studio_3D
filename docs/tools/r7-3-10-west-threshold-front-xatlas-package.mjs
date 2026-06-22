#!/usr/bin/env node
/*
 * Runtime pointer helper for the west_threshold_front XATLAS bake.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '..', '..');

const IDENTITY = {
	surfaceName: 'west_threshold_front',
	targetId: 1024,
	bakeTargetId: 1024,
	configId: 1,
	atlasGroup: 'shell',
	masterRectKey: 'west_threshold_front',
	normal: [1, 0, 0],
	worldBounds: { x: -1.91, y: [0, 0.09], z: [-1.874, -0.984] },
};
const ATLAS_W = 72;
const ATLAS_H = 712;

function parseArgs(argv) {
	const out = { rawDir: null, oidnDir: null, prepareDir: null, writeRawPointer: null, writeOidnPointer: null, outSummary: null };
	for (const arg of argv) {
		if (arg.startsWith('--raw-dir=')) out.rawDir = arg.slice('--raw-dir='.length);
		else if (arg.startsWith('--oidn-dir=')) out.oidnDir = arg.slice('--oidn-dir='.length);
		else if (arg.startsWith('--prepare-dir=')) out.prepareDir = arg.slice('--prepare-dir='.length);
		else if (arg.startsWith('--write-raw-pointer=')) out.writeRawPointer = arg.slice('--write-raw-pointer='.length);
		else if (arg.startsWith('--write-oidn-pointer=')) out.writeOidnPointer = arg.slice('--write-oidn-pointer='.length);
		else if (arg.startsWith('--out-summary=')) out.outSummary = arg.slice('--out-summary='.length);
	}
	if (!out.rawDir) throw new Error('missing --raw-dir');
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

function requireFile(p) {
	if (!fs.existsSync(abs(p))) throw new Error(`missing file: ${p}`);
}

function pointerFor(dir, kind, prepareDir) {
	const manifest = readJson(path.join(dir, 'manifest.json'));
	const validation = readJson(path.join(dir, manifest.artifacts.validationReport || 'validation-report.json'));
	requireFile(path.join(dir, manifest.artifacts.atlasPatch0 || 'atlas-patch-000-rgba-f32.bin'));
	requireFile(path.join(dir, manifest.artifacts.texelMetadataPatch0 || 'texel-metadata-patch-000-f32.bin'));
	const w = Math.trunc(Number(manifest.targetAtlasWidth) || 0);
	const h = Math.trunc(Number(manifest.targetAtlasHeight) || 0);
	if (w !== ATLAS_W || h !== ATLAS_H) throw new Error(`west_threshold_front atlas size ${w}x${h} != ${ATLAS_W}x${ATLAS_H}`);
	const bakedRadianceKind = manifest.bakedRadianceKind === 'full_diffuse_radiance'
		? 'full_diffuse_radiance'
		: 'indirect_diffuse_radiance';
	const directLightAlreadyIncluded = bakedRadianceKind === 'full_diffuse_radiance';
	return {
		packageStatus: 'architecture_probe',
		runtimeScope: 'c1_xatlas_west_threshold_front_runtime',
		runtimeTexture: 'tR7310C1XatlasRuntimeAtlasTexture',
		runtimeArchitecture: 'master_subrect_west_threshold_front',
		packageDir: manifest.packageDir,
		identity: { ...IDENTITY },
		targetAtlasWidth: w,
		targetAtlasHeight: h,
		requestedSamples: manifest.requestedSamples,
		diffuseOnly: manifest.diffuseOnly === true,
		upscaled: manifest.upscaled === true,
		bakedRadianceKind,
		directLightAlreadyIncluded,
		addDirectLightAfterBakeLookup: !directLightAlreadyIncluded,
		multiplyAlbedoAfterBakeLookup: true,
		bakeAlbedoFree: true,
		uploadRowFlip: false,
		phase2: {
			kind,
			prepareDir: rel(prepareDir),
			westThresholdFrontFullRadianceBake: directLightAlreadyIncluded,
			defaultRuntimePointerChanged: false,
			runtimePackageSelection: 'explicit master sub-rect',
		},
		validation: {
			status: validation.status,
			browserValidationStatus: validation.browserValidationStatus,
			runnerStatus: validation.runnerStatus,
			runnerFailedChecks: validation.runnerFailedChecks || [],
			contentChecksPass: Object.values(validation.runnerChecks || {}).every(Boolean),
			completedTiles: validation.bakeDiagnosticsSummary?.completedTiles ?? null,
			minCompletedSamples: validation.bakeDiagnosticsSummary?.minCompletedSamples ?? null,
			contextLostCount: validation.bakeDiagnosticsSummary?.contextLostCount ?? null,
		},
		artifacts: {
			atlasPatch0: manifest.artifacts.atlasPatch0,
			texelMetadataPatch0: manifest.artifacts.texelMetadataPatch0,
			validationReport: manifest.artifacts.validationReport,
		},
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const summary = { tool: 'r7-3-10-west-threshold-front-xatlas-package', rawDir: rel(args.rawDir), prepareDir: rel(args.prepareDir), writes: [] };
	if (args.writeRawPointer) {
		const pointer = pointerFor(args.rawDir, 'raw', args.prepareDir);
		writeJson(args.writeRawPointer, pointer);
		summary.writes.push({ kind: 'raw', path: rel(args.writeRawPointer), packageDir: pointer.packageDir, directLightAlreadyIncluded: pointer.directLightAlreadyIncluded });
	}
	if (args.oidnDir && args.writeOidnPointer) {
		const pointer = pointerFor(args.oidnDir, 'oidn', args.prepareDir);
		pointer.sourcePackageDir = rel(args.rawDir);
		writeJson(args.writeOidnPointer, pointer);
		summary.writes.push({ kind: 'oidn', path: rel(args.writeOidnPointer), packageDir: pointer.packageDir, directLightAlreadyIncluded: pointer.directLightAlreadyIncluded });
	}
	if (args.outSummary) writeJson(args.outSummary, summary);
	console.log(JSON.stringify(summary, null, 2));
}

main();
