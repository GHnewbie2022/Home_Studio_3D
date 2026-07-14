#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '..', '..');

const REQUIRED_NORTH_ATLAS = Object.freeze({ width: 2325, height: 3377 });
const POINTERS = Object.freeze([
	{
		kind: 'raw',
		path: 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json',
	},
	{
		kind: 'oidn',
		path: 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-oidn-rtlightmap-runtime-package.json',
	},
]);
const NORTH_ONLY_FULL_BAKE_ADMISSION = Object.freeze({
	scope: 'north_wall_only',
	prepareTool: 'docs/tools/r7-3-10-full-north-wall-xatlas-phase2-prepare.py',
	c2cMaskTool: 'docs/tools/r7-3-10-full-north-wall-xatlas-c2c-mask.py',
	runnerTool: 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs',
	packageTool: 'docs/tools/r7-3-10-full-north-wall-xatlas-package.mjs',
	requiredRunnerFlags: [
		'--r7310-xatlas-bake',
		'--r7310-xatlas-full-radiance-bake',
		'--r7310-surface=north-wall',
	],
	requiredPackageContract: {
		targetAtlasWidth: REQUIRED_NORTH_ATLAS.width,
		targetAtlasHeight: REQUIRED_NORTH_ATLAS.height,
		bakedRadianceKind: 'full_diffuse_radiance',
		directLightAlreadyIncluded: true,
		addDirectLightAfterBakeLookup: false,
		validationStatus: 'pass',
	},
	forbiddenScopes: ['full_room_rebake'],
	pointerWrites: POINTERS.map((entry) => entry.path),
});

function abs(p) {
	return path.isAbsolute(p) ? p : path.join(repo, p);
}

function rel(p) {
	return path.relative(repo, abs(p)).replaceAll(path.sep, '/');
}

function readJsonIfExists(p) {
	const target = abs(p);
	if (!fs.existsSync(target)) return null;
	return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function pointerSummary(entry) {
	const pointer = readJsonIfExists(entry.path);
	if (!pointer) {
		return {
			kind: entry.kind,
			path: entry.path,
			exists: false,
		};
	}
	return {
		kind: entry.kind,
		path: entry.path,
		exists: true,
		packageDir: pointer.packageDir || null,
		targetAtlasWidth: Math.trunc(Number(pointer.targetAtlasWidth) || 0),
		targetAtlasHeight: Math.trunc(Number(pointer.targetAtlasHeight) || 0),
		bakedRadianceKind: pointer.bakedRadianceKind || null,
		directLightAlreadyIncluded: pointer.directLightAlreadyIncluded === true,
		addDirectLightAfterBakeLookup: pointer.addDirectLightAfterBakeLookup === true,
		validationStatus: pointer.validation?.status || null,
		runtimeScope: pointer.runtimeScope || null,
		runtimeArchitecture: pointer.runtimeArchitecture || null,
	};
}

function walkManifestFiles(root) {
	const out = [];
	function walk(dir) {
		let entries = [];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const p = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name === 'manifest.json') out.push(p);
		}
	}
	walk(abs(root));
	return out;
}

function packageValidationStatus(manifestPath, manifest) {
	const dir = path.dirname(manifestPath);
	const validationRel = manifest.artifacts?.validationReport || 'validation-report.json';
	const validation = readJsonIfExists(path.join(dir, validationRel));
	return validation?.status || null;
}

function northSizedPackageInventory() {
	const manifests = walkManifestFiles('.omc');
	const inventory = [];
	for (const manifestPath of manifests) {
		let manifest = null;
		try {
			manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
		} catch {
			continue;
		}
		const w = Math.trunc(Number(manifest.targetAtlasWidth) || 0);
		const h = Math.trunc(Number(manifest.targetAtlasHeight) || 0);
		if (w !== REQUIRED_NORTH_ATLAS.width || h !== REQUIRED_NORTH_ATLAS.height)
			continue;
		const validationStatus = packageValidationStatus(manifestPath, manifest);
		const rejectionReasons = [];
		if (manifest.bakedRadianceKind !== 'full_diffuse_radiance')
			rejectionReasons.push('not_full_diffuse_radiance');
		if (validationStatus !== 'pass')
			rejectionReasons.push('validation_not_pass');
		inventory.push({
			manifest: rel(manifestPath),
			packageDir: manifest.packageDir || rel(path.dirname(manifestPath)),
			targetAtlasWidth: w,
			targetAtlasHeight: h,
			bakedRadianceKind: manifest.bakedRadianceKind || null,
			diffuseOnly: manifest.diffuseOnly === true,
			requestedSamples: manifest.requestedSamples ?? null,
			validationStatus,
			acceptedAsFullBake: rejectionReasons.length === 0,
			rejectionReasons,
		});
	}
	return inventory.sort((a, b) => a.manifest.localeCompare(b.manifest));
}

function findFullNorthCandidatePackages(inventory) {
	return inventory
		.filter((entry) => entry.acceptedAsFullBake)
		.map((entry) => ({
			manifest: entry.manifest,
			packageDir: entry.packageDir,
			targetAtlasWidth: entry.targetAtlasWidth,
			targetAtlasHeight: entry.targetAtlasHeight,
			bakedRadianceKind: entry.bakedRadianceKind,
			diffuseOnly: entry.diffuseOnly,
			requestedSamples: entry.requestedSamples,
			validationStatus: entry.validationStatus,
		}));
}

function isReadyPointer(pointer) {
	return pointer.exists === true &&
		pointer.targetAtlasWidth === REQUIRED_NORTH_ATLAS.width &&
		pointer.targetAtlasHeight === REQUIRED_NORTH_ATLAS.height &&
		pointer.bakedRadianceKind === 'full_diffuse_radiance' &&
		pointer.directLightAlreadyIncluded === true &&
		pointer.addDirectLightAfterBakeLookup === false &&
		pointer.validationStatus === 'pass';
}

function pointerBlockers(pointer) {
	const blockers = [];
	if (!pointer.exists) {
		blockers.push(`${pointer.kind}:official_north_pointer_missing`);
		return blockers;
	}
	if (pointer.targetAtlasWidth !== REQUIRED_NORTH_ATLAS.width ||
		pointer.targetAtlasHeight !== REQUIRED_NORTH_ATLAS.height)
		blockers.push(`${pointer.kind}:official_north_pointer_size_mismatch`);
	if (pointer.bakedRadianceKind !== 'full_diffuse_radiance' ||
		pointer.directLightAlreadyIncluded !== true ||
		pointer.addDirectLightAfterBakeLookup !== false)
		blockers.push(`${pointer.kind}:official_north_pointer_not_full_radiance`);
	if (pointer.validationStatus !== 'pass')
		blockers.push(`${pointer.kind}:official_north_pointer_not_validated`);
	return blockers;
}

function buildReport() {
	const officialPointers = POINTERS.map(pointerSummary);
	const northSizedPackages = northSizedPackageInventory();
	const fullNorthCandidatePackages = findFullNorthCandidatePackages(northSizedPackages);
	const rawPointer = officialPointers.find((pointer) => pointer.kind === 'raw');
	const oidnPointer = officialPointers.find((pointer) => pointer.kind === 'oidn');
	const blockers = pointerBlockers(rawPointer);
	const oidnBlockers = pointerBlockers(oidnPointer);
	const rawCandidateExists = rawPointer &&
		fullNorthCandidatePackages.some((entry) => entry.packageDir === rawPointer.packageDir);

	if (!rawCandidateExists)
		blockers.push('north_full_radiance_package_missing');

	const rawReady = isReadyPointer(rawPointer) &&
		rawCandidateExists &&
		blockers.length === 0;
	const oidnReady = isReadyPointer(oidnPointer) && oidnBlockers.length === 0;
	const status = rawReady ? (oidnReady ? 'ready' : 'raw_ready_oidn_pending') : 'not_ready';

	return {
		tool: 'r7-3-10-north-full-bake-readiness-audit',
		status,
		ready: rawReady,
		rawReady,
		oidnReady,
		browserLaunched: false,
		gpuSmokeLaunched: false,
		requiredNorthAtlas: { ...REQUIRED_NORTH_ATLAS },
		requiredPointerContract: {
			bakedRadianceKind: 'full_diffuse_radiance',
			directLightAlreadyIncluded: true,
			addDirectLightAfterBakeLookup: false,
			validationStatus: 'pass',
		},
		northOnlyFullBakeAdmission: NORTH_ONLY_FULL_BAKE_ADMISSION,
		officialPointers,
		northSizedPackageInventory: northSizedPackages,
		fullNorthCandidatePackages,
		blockers,
		oidnBlockers,
	};
}

console.log(JSON.stringify(buildReport(), null, 2));
