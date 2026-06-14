#!/usr/bin/env node
/*
 * R7-3.10 Phase 2 full east-wall XATLAS package helper.
 *
 * 東牆版（複製自 north 版，只改 runtimeScope / runtimeArchitecture / version 三字串）。
 * Finalizes the OIDN package manifest and writes explicit runtime pointers.
 * It does not switch any default runtime pointer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '..', '..');

function parseArgs(argv) {
	const out = {
		rawDir: null,
		oidnDir: null,
		prepareDir: null,
		finalizeOidn: false,
		writeRawPointer: null,
		writeOidnPointer: null,
		outSummary: null,
	};
	for (const arg of argv) {
		if (arg.startsWith('--raw-dir=')) out.rawDir = arg.slice('--raw-dir='.length);
		else if (arg.startsWith('--oidn-dir=')) out.oidnDir = arg.slice('--oidn-dir='.length);
		else if (arg.startsWith('--prepare-dir=')) out.prepareDir = arg.slice('--prepare-dir='.length);
		else if (arg === '--finalize-oidn') out.finalizeOidn = true;
		else if (arg.startsWith('--write-raw-pointer=')) out.writeRawPointer = arg.slice('--write-raw-pointer='.length);
		else if (arg.startsWith('--write-oidn-pointer=')) out.writeOidnPointer = arg.slice('--write-oidn-pointer='.length);
		else if (arg.startsWith('--out-summary=')) out.outSummary = arg.slice('--out-summary='.length);
	}
	if (!out.rawDir) throw new Error('missing --raw-dir');
	if (!out.prepareDir) throw new Error('missing --prepare-dir');
	return out;
}

function abs(p) {
	if (!p) return null;
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
	const target = abs(p);
	if (!fs.existsSync(target)) throw new Error(`missing file: ${p}`);
	return target;
}

function packageRecord(dir) {
	const manifest = readJson(path.join(dir, 'manifest.json'));
	const validation = readJson(path.join(dir, manifest.artifacts.validationReport || 'validation-report.json'));
	const alphaReport = readJson(path.join(dir, manifest.artifacts.xatlasC2CAlphaReport || 'xatlas-c2c-alpha-report.json'));
	requireFile(path.join(dir, manifest.artifacts.atlasPatch0 || 'atlas-patch-000-rgba-f32.bin'));
	requireFile(path.join(dir, manifest.artifacts.texelMetadataPatch0 || 'texel-metadata-patch-000-f32.bin'));
	return { manifest, validation, alphaReport };
}

function denoiseRecord(oidnDir) {
	const metricsPath = path.join(oidnDir, 'atlas-patch-000-rgba-f32.bin.metrics.json');
	const metrics = readJson(metricsPath);
	return {
		tool: 'r7-3-10-oidn-bridge',
		filter: 'RT',
		quality: 'high',
		auxStrategy: metrics.auxStrategy || 'color_only_beta',
		inputSamples: 1000,
		deviceUsed: metrics.oidn_device_used || metrics.oidnRuntime?.deviceUsed || 'unknown',
		version: metrics.oidnRuntime?.version || 'unknown',
		alphaPreserved: true,
		passDecision: metrics.passDecision,
	};
}

function finalizeOidnManifest(rawDir, oidnDir) {
	const rawManifest = readJson(path.join(rawDir, 'manifest.json'));
	const denoise = denoiseRecord(oidnDir);
	const manifest = {
		...rawManifest,
		version: 'r7-3-10-xatlas-bake-c2-oidn-rt-high-beta-full-east-wall',
		packageDir: rel(oidnDir),
		artifacts: {
			...rawManifest.artifacts,
			oidnMetrics: 'atlas-patch-000-rgba-f32.bin.metrics.json',
		},
		sourcePackageDir: rawManifest.packageDir,
		denoise,
	};
	writeJson(path.join(oidnDir, 'manifest.json'), manifest);
	return manifest;
}

function runtimePointer(dir, kind, prepareDir) {
	const { manifest, validation, alphaReport } = packageRecord(dir);
	const pointer = {
		packageStatus: 'architecture_probe',
		runtimeScope: 'c1_xatlas_full_east_wall_runtime',
		runtimeTexture: 'tR7310C1XatlasRuntimeAtlasTexture',
		runtimeArchitecture: 'single_xatlas_full_east_wall_phase2',
		packageDir: manifest.packageDir,
		targetAtlasWidth: manifest.targetAtlasWidth,
		targetAtlasHeight: manifest.targetAtlasHeight,
		requestedSamples: manifest.requestedSamples,
		diffuseOnly: manifest.diffuseOnly === true,
		upscaled: manifest.upscaled === true,
		bakedRadianceKind: 'indirect_diffuse_radiance',
		directLightAlreadyIncluded: false,
		addDirectLightAfterBakeLookup: true,
		multiplyAlbedoAfterBakeLookup: true,
		uploadRowFlip: false,
		phase2: {
			kind,
			prepareDir: rel(prepareDir),
			normalLenAudit: 'xatlas-normal-len-audit.json',
			fullWallValidityMaskReport: 'xatlas-bake-c2c-full-wall-validity-mask-report.json',
			defaultRuntimePointerChanged: false,
			runtimePackageSelection: 'explicit xatlasPackage query param only',
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
		xatlasC2CAlphaPolicy: {
			enabled: true,
			maskPath: alphaReport.maskPath,
			decisionSource: alphaReport.policy?.decisionSource || 'unknown',
			invalidOrHiddenAlpha: 0,
			validVisibleAlpha: 1,
		},
		alphaAudit: {
			alphaOneTexels: alphaReport.counts?.alphaOneTexels ?? null,
			alphaZeroTexels: alphaReport.counts?.alphaZeroTexels ?? null,
			alphaOneExactBlackTexels: alphaReport.counts?.alphaOneExactBlackTexels ?? null,
			sourceBlackAlphaOneUsed: alphaReport.dilation?.sourceBlackAlphaOneUsed ?? null,
			maxDistanceTexels: alphaReport.dilation?.maxDistanceTexels ?? null,
			maxDistanceLimitTexels: alphaReport.dilation?.maxDistanceLimitTexels ?? null,
		},
		redLines: {
			formalRadianceBake: false,
			defaultRuntimePointerChanged: false,
			d800PromotionChanged: false,
			commitCreated: false,
		},
		artifacts: {
			atlasPatch0: manifest.artifacts.atlasPatch0,
			texelMetadataPatch0: manifest.artifacts.texelMetadataPatch0,
			validationReport: manifest.artifacts.validationReport,
			xatlasC2CAlphaReport: manifest.artifacts.xatlasC2CAlphaReport,
		},
	};
	if (kind === 'oidn') {
		pointer.sourcePackageDir = manifest.sourcePackageDir;
		pointer.denoise = manifest.denoise;
		pointer.artifacts.oidnMetrics = manifest.artifacts.oidnMetrics;
	}
	return pointer;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.finalizeOidn) {
		if (!args.oidnDir) throw new Error('--finalize-oidn requires --oidn-dir');
		finalizeOidnManifest(args.rawDir, args.oidnDir);
	}
	const summary = {
		tool: 'r7-3-10-full-east-wall-xatlas-package',
		rawDir: rel(args.rawDir),
		oidnDir: args.oidnDir ? rel(args.oidnDir) : null,
		prepareDir: rel(args.prepareDir),
		wrote: {},
	};
	if (args.writeRawPointer) {
		const pointer = runtimePointer(args.rawDir, 'raw', args.prepareDir);
		writeJson(args.writeRawPointer, pointer);
		summary.wrote.rawPointer = rel(args.writeRawPointer);
	}
	if (args.writeOidnPointer) {
		if (!args.oidnDir) throw new Error('--write-oidn-pointer requires --oidn-dir');
		const pointer = runtimePointer(args.oidnDir, 'oidn', args.prepareDir);
		writeJson(args.writeOidnPointer, pointer);
		summary.wrote.oidnPointer = rel(args.writeOidnPointer);
	}
	if (args.outSummary) {
		writeJson(args.outSummary, summary);
		summary.wrote.summary = rel(args.outSummary);
	}
	console.log(JSON.stringify(summary, null, 2));
}

main();
