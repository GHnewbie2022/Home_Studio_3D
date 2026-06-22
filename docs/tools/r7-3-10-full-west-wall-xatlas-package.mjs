#!/usr/bin/env node
/*
 * R7-3.10 R4-2C full west-wall XATLAS package helper.
 *
 * 西牆版（複製自 east 版，改 runtimeScope / runtimeArchitecture / version 三字串 +
 *  注入 west master identity 區塊 + bakeAlbedoFree，並硬驗 manifest 尺寸＝2325×3945）。
 * east 的 runtimePointer 無 identity 區塊（east 走通用 albedo 契約）；west 必須帶 identity，
 * 否則 loader assertR7310C1WestMasterIdentity / docs/tools/r7-3-10-master-contract-check.mjs
 * 的 westIdentityHardCheck 會拒載（surfaceName/targetId 1004/configId 1/atlasGroup shell/
 * normal +X/worldBounds/尺寸 2325×3945/bakeAlbedoFree/multiplyAlbedo 任一缺即 throw）。
 * Finalizes the OIDN package manifest and writes explicit runtime pointers.
 * It does not switch any default runtime pointer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '..', '..');

// west master identity（單一真值；對齊 CODEX R4-2C 規格 + axis-spec west_wall_open + WEST_ID_CONTRACT）
const WEST_IDENTITY = {
	surfaceName: 'west_wall_open',
	targetId: 1004,
	bakeTargetId: 1004,
	configId: 1,
	atlasGroup: 'shell',
	masterRectKey: 'west',
	normal: [1, 0, 0],
	worldBounds: { x: -1.91, y: [0.0, 2.905], z: [-1.874, 3.056] },
};
const WEST_ATLAS_W = 2325;
const WEST_ATLAS_H = 3945;
const WEST_MAX_ALPHA_DILATION_TEXELS = 4;

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
		filter: metrics.filter || 'RTLightmap',
		quality: metrics.quality || 'high',
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
		version: 'r7-3-10-xatlas-bake-c2-oidn-rt-high-beta-full-west-wall',
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
	const bakedRadianceKind = manifest.bakedRadianceKind === 'full_diffuse_radiance'
		? 'full_diffuse_radiance'
		: 'indirect_diffuse_radiance';
	const directLightAlreadyIncluded = bakedRadianceKind === 'full_diffuse_radiance';
	const addDirectLightAfterBakeLookup = !directLightAlreadyIncluded;
	const dilationLimit = alphaReport.dilation?.maxDistanceLimitTexels;
	const dilationDistance = alphaReport.dilation?.maxDistanceTexels;
	if (dilationLimit !== WEST_MAX_ALPHA_DILATION_TEXELS || dilationDistance > WEST_MAX_ALPHA_DILATION_TEXELS) {
		throw new Error(`west alpha dilation 契約違反：limit=${dilationLimit} distance=${dilationDistance}，必須維持成功面同級 ${WEST_MAX_ALPHA_DILATION_TEXELS}px（拒寫 pointer，避免遠距補色抹平西牆）`);
	}
	// identity 硬驗：manifest 尺寸必須＝west master 規格 2325×3945，否則 pointer 一定過不了 loader assert。
	const mw = Math.trunc(Number(manifest.targetAtlasWidth) || 0);
	const mh = Math.trunc(Number(manifest.targetAtlasHeight) || 0);
	if (mw !== WEST_ATLAS_W || mh !== WEST_ATLAS_H) {
		throw new Error(`west identity 尺寸不符：manifest ${mw}x${mh} != 規格 ${WEST_ATLAS_W}x${WEST_ATLAS_H}（package 拒寫；烤製 atlas 尺寸錯）`);
	}
	const pointer = {
		packageStatus: 'architecture_probe',
		runtimeScope: 'c1_xatlas_full_west_wall_runtime',
		runtimeTexture: 'tR7310C1XatlasRuntimeAtlasTexture',
		runtimeArchitecture: 'single_xatlas_full_west_wall_phase2',
		packageDir: manifest.packageDir,
		// R4-2C：west master identity 區塊（loader assertR7310C1WestMasterIdentity / master-contract-check 硬比對）
		identity: { ...WEST_IDENTITY },
		targetAtlasWidth: manifest.targetAtlasWidth,
		targetAtlasHeight: manifest.targetAtlasHeight,
		requestedSamples: manifest.requestedSamples,
		diffuseOnly: manifest.diffuseOnly === true,
		upscaled: manifest.upscaled === true,
		bakedRadianceKind,
		directLightAlreadyIncluded,
		addDirectLightAfterBakeLookup,
		multiplyAlbedoAfterBakeLookup: true,
		bakeAlbedoFree: true,
		uploadRowFlip: false,
		phase2: {
			kind,
			prepareDir: rel(prepareDir),
			westFullRadianceBake: directLightAlreadyIncluded,
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
		tool: 'r7-3-10-full-west-wall-xatlas-package',
		rawDir: rel(args.rawDir),
		oidnDir: args.oidnDir ? rel(args.oidnDir) : null,
		prepareDir: rel(args.prepareDir),
		identity: WEST_IDENTITY,
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
