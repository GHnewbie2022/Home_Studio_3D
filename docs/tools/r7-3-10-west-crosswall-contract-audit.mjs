#!/usr/bin/env node
/*
 * R7-3.10 west cross-wall contract audit.
 *
 * Reads static contracts only. This does not render, bake, or mutate pointers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(__filename), '..', '..');

const POINTERS = {
	north: 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json',
	east: 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json',
	ceiling: 'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json',
	floor: 'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json',
	west: 'docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json',
};

function readText(relPath) {
	return fs.readFileSync(path.join(repo, relPath), 'utf8');
}

function readJson(relPath) {
	return JSON.parse(readText(relPath));
}

function pointerSummary(face, relPath) {
	const pointer = readJson(relPath);
	return {
		face,
		path: relPath,
		packageDir: pointer.packageDir,
		bakedRadianceKind: pointer.bakedRadianceKind ?? null,
		directLightAlreadyIncluded: pointer.directLightAlreadyIncluded === true,
		addDirectLightAfterBakeLookup: pointer.addDirectLightAfterBakeLookup === true,
		multiplyAlbedoAfterBakeLookup: pointer.multiplyAlbedoAfterBakeLookup !== false,
		bakeAlbedoFree: pointer.bakeAlbedoFree === true,
		targetAtlasWidth: pointer.targetAtlasWidth ?? null,
		targetAtlasHeight: pointer.targetAtlasHeight ?? null,
	};
}

function countOccurrences(text, needle) {
	if (!needle) return 0;
	let count = 0;
	let index = text.indexOf(needle);
	while (index >= 0) {
		count += 1;
		index = text.indexOf(needle, index + needle.length);
	}
	return count;
}

function main() {
	const pointers = Object.fromEntries(
		Object.entries(POINTERS).map(([face, relPath]) => [face, pointerSummary(face, relPath)])
	);
	const acceptedFaces = ['north', 'east', 'ceiling', 'floor'];
	const acceptedContracts = acceptedFaces.map((face) => ({
		face,
		bakedRadianceKind: pointers[face].bakedRadianceKind,
		directLightAlreadyIncluded: pointers[face].directLightAlreadyIncluded,
		addDirectLightAfterBakeLookup: pointers[face].addDirectLightAfterBakeLookup,
	}));
	const shader = readText('shaders/Home_Studio_Fragment.glsl');
	const directUniform = 'uR7310C1XatlasRuntimeFullWestWallDirectIncluded';
	const directUniformOccurrences = countOccurrences(shader, directUniform);
	const directUniformBranchUses = Math.max(0, directUniformOccurrences - 1);
	const westHybridXatlasGuarded = /if\s*\(\s*r7310WestWallHybridFirstHit\s*&&\s*!\s*r7310XatlasRuntimeMapped\s*\)[\s\S]{0,180}r7310C1WestWallHybridRadiance/.test(shader);
	const westBeamShadowStart = shader.indexOf('bool r7310C1WestWallBeamShadowHybridActive');
	const westBeamShadowEnd = shader.indexOf('vec3 r7310C1WestWallBeamShadowHybridRadiance', westBeamShadowStart);
	const westBeamShadowBody = westBeamShadowStart >= 0 && westBeamShadowEnd > westBeamShadowStart
		? shader.slice(westBeamShadowStart, westBeamShadowEnd)
		: '';
	const westBeamShadowXatlasYield = westBeamShadowBody.includes('!r7310C1XatlasParamWestSurfaceActive()');
	const westPointerDirectDiff =
		pointers.west.bakedRadianceKind !== pointers.east.bakedRadianceKind ||
		pointers.west.directLightAlreadyIncluded !== pointers.east.directLightAlreadyIncluded ||
		pointers.west.addDirectLightAfterBakeLookup !== pointers.east.addDirectLightAfterBakeLookup;
	const westDirectIncludedHandled = directUniformBranchUses > 0 &&
		/uR7310C1XatlasRuntimeFullWestWallDirectIncluded\s*>\s*0\.5\s*&&\s*r7310XatlasRuntimeWestFirstHit[\s\S]{0,220}\bbreak\s*;/.test(shader);
	const westDirectIncludedScopedToWest = /bool\s+r7310XatlasRuntimeWestMapped\b[\s\S]{0,260}r7310C1XatlasParamSurfaceUv\s*\(\s*int\s*\(\s*uR7310C1XatlasParamWestSurfaceIndex\s*\)[\s\S]{0,260}bool\s+r7310XatlasRuntimeWestFirstHit\b\s*=\s*r7310XatlasRuntimeFirstHit\s*&&\s*r7310XatlasRuntimeWestMapped\s*;/.test(shader);
	const hasFullRadianceBounceGate = shader.includes('r7310XatlasIndirectBakeFirstHit') &&
		shader.includes('uR7310C1XatlasBakeFullRadianceMode < 0.5') &&
		shader.includes('willNeedDiffuseBounceRay == TRUE');
	const hasDeferredBounceContinuation = shader.includes('if (willNeedDiffuseBounceRay == TRUE)') &&
		shader.includes('rayOrigin = diffuseBounceRayOrigin;') &&
		shader.includes('sampleLight = FALSE;') &&
		shader.includes('diffuseCount++;') &&
		shader.includes('continue;');
	const paramTable = readJson('docs/generated/r7-3-10-xatlas-param-table.generated.json');
	const entries = Array.isArray(paramTable.entries) ? paramTable.entries : [];
	const westParam = entries.find((entry) => entry.surfaceId === 'west_wall_open') || null;
	const eastParam = entries.find((entry) => entry.surfaceId === 'east_wall') || null;
	const comparableKeys = ['uAxis', 'uOrigin', 'uScale', 'uMixLo', 'uMixHi', 'vAxis', 'vOrigin', 'vScale', 'vMixLo', 'vMixHi'];
	const westEastParamMatch = !!(westParam && eastParam && comparableKeys.every((key) => Object.is(westParam[key], eastParam[key])));
	const findings = [];
	if (westPointerDirectDiff && !westDirectIncludedHandled) {
		findings.push('west pointer direct-light contract differs from accepted wall peers without shader handling');
	}
	if (directUniformBranchUses === 0) {
		findings.push('west direct-included uniform is declared but not used by shader branches');
	}
	if (westPointerDirectDiff && !westDirectIncludedScopedToWest) {
		findings.push('west direct-included branch is not scoped to west xatlas first-hit');
	}
	if (!westHybridXatlasGuarded) {
		findings.push('west xatlas first-hit also adds legacy west hybrid radiance');
	}
	if (!westBeamShadowXatlasYield) {
		findings.push('west wall beam-shadow hybrid can overlap full-west xatlas param ownership');
	}
	if (hasFullRadianceBounceGate && !hasDeferredBounceContinuation) {
		findings.push('xatlas full-radiance bake mode skips immediate continuation without deferred diffuse continuation evidence');
	}
	if (!westEastParamMatch) {
		findings.push('west/east param UV mapping differs beyond mirror normal/bounds');
	}
	const report = {
		tool: 'r7-3-10-west-crosswall-contract-audit',
		status: findings.length ? 'investigate' : 'pass',
		pointers,
		acceptedContracts,
		shader: {
			directUniform,
			directUniformOccurrences,
			directUniformBranchUses,
			westHybridXatlasGuarded,
			westBeamShadowXatlasYield,
			westPointerDirectDiff,
			westDirectIncludedHandled,
			westDirectIncludedScopedToWest,
			hasFullRadianceBounceGate,
			hasDeferredBounceContinuation,
		},
		paramUv: {
			westEastParamMatch,
			comparedKeys: comparableKeys,
			west: westParam,
			east: eastParam,
		},
		findings,
	};
	console.log(JSON.stringify(report, null, 2));
}

main();
