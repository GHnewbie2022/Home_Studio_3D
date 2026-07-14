const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..');
const northPackageTool = fs.readFileSync(path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-package.mjs'), 'utf8');
const initCommon = fs.readFileSync(path.join(repo, 'js/InitCommon.js'), 'utf8');
const homeStudio = fs.readFileSync(path.join(repo, 'js/Home_Studio.js'), 'utf8');
const shader = fs.readFileSync(path.join(repo, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const northRawPointer = JSON.parse(fs.readFileSync(path.join(repo, 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json'), 'utf8'));
const northOidnPointer = JSON.parse(fs.readFileSync(path.join(repo, 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-oidn-rtlightmap-runtime-package.json'), 'utf8'));

assert.match(
	northPackageTool,
	/const bakedRadianceKind = manifest\.bakedRadianceKind === 'full_diffuse_radiance'[\s\S]{0,160}\? 'full_diffuse_radiance'[\s\S]{0,80}: 'indirect_diffuse_radiance';/,
	'north package helper must derive bakedRadianceKind from the bake manifest'
);
assert.match(
	northPackageTool,
	/const directLightAlreadyIncluded = bakedRadianceKind === 'full_diffuse_radiance';/,
	'north package helper must derive directLightAlreadyIncluded from bakedRadianceKind'
);
assert.match(
	northPackageTool,
	/const addDirectLightAfterBakeLookup = !directLightAlreadyIncluded;/,
	'north package helper must derive addDirectLightAfterBakeLookup from directLightAlreadyIncluded'
);
assert.doesNotMatch(
	northPackageTool,
	/bakedRadianceKind:\s*'indirect_diffuse_radiance'[\s\S]{0,160}directLightAlreadyIncluded:\s*false[\s\S]{0,160}addDirectLightAfterBakeLookup:\s*true/,
	'north package helper must not hardcode indirect bake flags'
);

assert.equal(northRawPointer.bakedRadianceKind, 'full_diffuse_radiance', 'raw north pointer must reference the accepted full-radiance package');
assert.equal(northRawPointer.directLightAlreadyIncluded, true, 'raw north pointer must mark direct light as already included');
assert.equal(northRawPointer.addDirectLightAfterBakeLookup, false, 'raw north pointer must disable post-bake live direct-light continuation');
assert.equal(northRawPointer.multiplyAlbedoAfterBakeLookup, true, 'raw north pointer must keep runtime albedo multiply enabled');
assert.equal(northRawPointer.bakeAlbedoFree, true, 'raw north pointer must declare the xatlas bake as albedo-free');
assert.equal(northRawPointer.validation.status, 'pass', 'raw north pointer must pass the FULL BAKE package gate');
assert.equal(northRawPointer.validation.contextLostCount, 0, 'raw north full-radiance bake must not have context loss');
assert.equal(northRawPointer.validation.minCompletedSamples, 1000, 'raw north full-radiance bake must complete 1000 samples on every tile');

assert.equal(northOidnPointer.bakedRadianceKind, 'indirect_diffuse_radiance', 'oidn north pointer remains pending until an OIDN full-radiance package exists');
assert.equal(northOidnPointer.directLightAlreadyIncluded, false, 'oidn north pointer must not claim direct light before an OIDN full-radiance package exists');
assert.equal(northOidnPointer.addDirectLightAfterBakeLookup, true, 'oidn north pointer must keep live direct-light continuation while indirect');
assert.notEqual(northOidnPointer.validation.status, 'pass', 'oidn north pointer must not pass the FULL BAKE package gate yet');

const rejectedIndirectNorthPackage = '.omc/r7-3-10-xatlas-bake-spike/20260613-100834';

assert.throws(
	() => execFileSync('node', [
		path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-package.mjs'),
		`--raw-dir=${path.join(repo, rejectedIndirectNorthPackage)}`,
		`--prepare-dir=${path.join(repo, rejectedIndirectNorthPackage)}`,
		`--write-raw-pointer=${path.join(os.tmpdir(), 'r7310-rejected-indirect-north-should-not-promote.json')}`,
	], { stdio: 'pipe' }),
	/north full-bake admission failed.*not_full_diffuse_radiance.*validation_not_pass/is,
	'legacy north indirect/failing package must not be writable as a north FULL BAKE pointer'
);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r7310-north-full-gate-'));
try {
	const makePackage = (packageDir, overrides = {}) => {
		fs.mkdirSync(packageDir, { recursive: true });
		fs.writeFileSync(path.join(packageDir, 'atlas-patch-000-rgba-f32.bin'), Buffer.alloc(16));
		fs.writeFileSync(path.join(packageDir, 'texel-metadata-patch-000-f32.bin'), Buffer.alloc(16));
		fs.writeFileSync(path.join(packageDir, 'validation-report.json'), `${JSON.stringify({
			status: 'pass',
			browserValidationStatus: 'pass',
			runnerStatus: 'pass',
			runnerChecks: { synthetic: true },
			runnerFailedChecks: [],
			bakeDiagnosticsSummary: {
				completedTiles: 1,
				minCompletedSamples: 1000,
				contextLostCount: 0,
			},
		}, null, 2)}\n`);
		fs.writeFileSync(path.join(packageDir, 'xatlas-c2c-alpha-report.json'), `${JSON.stringify({
			maskPath: 'xatlas-c2c-validity-mask.png',
			policy: { decisionSource: 'synthetic-full-radiance-gate' },
			counts: {
				alphaOneTexels: 1,
				alphaZeroTexels: 0,
				alphaOneExactBlackTexels: 0,
			},
			dilation: {
				sourceBlackAlphaOneUsed: 0,
				maxDistanceTexels: 0,
				maxDistanceLimitTexels: 0,
			},
		}, null, 2)}\n`);
		fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify({
			packageDir,
			targetAtlasWidth: 2325,
			targetAtlasHeight: 3377,
			requestedSamples: 1000,
			diffuseOnly: true,
			upscaled: false,
			bakedRadianceKind: 'full_diffuse_radiance',
			...overrides,
			artifacts: {
				validationReport: 'validation-report.json',
				xatlasC2CAlphaReport: 'xatlas-c2c-alpha-report.json',
				atlasPatch0: 'atlas-patch-000-rgba-f32.bin',
				texelMetadataPatch0: 'texel-metadata-patch-000-f32.bin',
				...(overrides.artifacts || {}),
			},
		}, null, 2)}\n`);
	};
	const packageDir = path.join(tmpRoot, 'synthetic-full-north');
	makePackage(packageDir);
	const outPointer = path.join(tmpRoot, 'synthetic-full-pointer.json');
	execFileSync('node', [
		path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-package.mjs'),
		`--raw-dir=${packageDir}`,
		`--prepare-dir=${packageDir}`,
		`--write-raw-pointer=${outPointer}`,
	], { stdio: 'pipe' });
	const syntheticPointer = JSON.parse(fs.readFileSync(outPointer, 'utf8'));
	assert.equal(syntheticPointer.bakedRadianceKind, 'full_diffuse_radiance', 'synthetic full-radiance package must stay full in pointer output');
	assert.equal(syntheticPointer.directLightAlreadyIncluded, true, 'synthetic full-radiance package must enable direct-included output');
	assert.equal(syntheticPointer.addDirectLightAfterBakeLookup, false, 'synthetic full-radiance package must disable post-bake live direct-light continuation');
	assert.equal(syntheticPointer.multiplyAlbedoAfterBakeLookup, true, 'synthetic full-radiance package must keep runtime albedo multiply enabled');
	assert.equal(syntheticPointer.bakeAlbedoFree, true, 'synthetic full-radiance package must declare albedo-free output');
	assert.equal(syntheticPointer.phase2.northFullRadianceBake, true, 'synthetic full-radiance package must mark the north full-radiance phase flag');

	const westSizedPackageDir = path.join(tmpRoot, 'synthetic-full-west-sized');
	makePackage(westSizedPackageDir, { targetAtlasHeight: 3945 });
	assert.throws(
		() => execFileSync('node', [
			path.join(repo, 'docs/tools/r7-3-10-full-north-wall-xatlas-package.mjs'),
			`--raw-dir=${westSizedPackageDir}`,
			`--prepare-dir=${westSizedPackageDir}`,
			`--write-raw-pointer=${path.join(tmpRoot, 'west-sized-pointer.json')}`,
		], { stdio: 'pipe' }),
		/error.*north identity atlas size mismatch/is,
		'north package helper must reject a west-sized full-radiance package'
	);
} finally {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
}

assert.doesNotMatch(
	initCommon,
	/r7310C1XatlasRuntimeFullNorthWallDirectIncluded\s*=\s*true/,
	'current north runtime must not hardcode a direct-included flag'
);
assert.match(
	initCommon,
	/let r7310C1XatlasRuntimeFullNorthWallDirectIncluded\s*=\s*false;/,
	'north runtime needs a direct-included state flag gated by package metadata'
);
assert.match(
	initCommon,
	/let r7310C1XatlasRuntimeFullNorthWallRawDirectIncluded\s*=\s*false;/,
	'north raw variant needs its own package-derived direct-included flag'
);
assert.match(
	initCommon,
	/let r7310C1XatlasRuntimeFullNorthWallOidnDirectIncluded\s*=\s*false;/,
	'north oidn variant needs its own package-derived direct-included flag'
);
assert.match(
	initCommon,
	/r7310C1XatlasRuntimeFullNorthWall(?:Raw|Oidn)DirectIncluded\s*=\s*pointer\.directLightAlreadyIncluded\s*===\s*true/,
	'north direct-included variant state must come from pointer.directLightAlreadyIncluded'
);
assert.match(
	initCommon,
	/r7310C1XatlasRuntimeFullNorthWallDirectIncluded\s*=[\s\S]{0,180}r7310C1XatlasNorthDirectIncludedForVariant/,
	'north direct-included runtime state must be selected from the active variant'
);
assert.match(
	homeStudio,
	/uR7310C1XatlasRuntimeFullNorthWallDirectIncluded\s*=\s*\{\s*value:\s*0\.0\s*\}/,
	'Home_Studio must publish a north direct-included uniform'
);
assert.match(
	initCommon,
	/uR7310C1XatlasRuntimeFullNorthWallDirectIncluded\.value\s*=[\s\S]{0,180}r7310C1XatlasRuntimeFullNorthWallActive\s*&&\s*r7310C1XatlasRuntimeFullNorthWallDirectIncluded\s*\?\s*1\.0\s*:\s*0\.0/,
	'north direct-included uniform must stay disabled until both north is active and the package flag is true'
);
assert.match(
	shader,
	/uniform float uR7310C1XatlasRuntimeFullNorthWallDirectIncluded;/,
	'shader must declare the north direct-included uniform'
);
assert.match(
	shader,
	/uR7310C1XatlasRuntimeFullNorthWallDirectIncluded\s*>\s*0\.5[\s\S]{0,220}r7310XatlasRuntimeNorthFirstHit[\s\S]{0,220}\bbreak\s*;/,
	'north full-radiance package must short-circuit after a valid xatlas first-hit'
);
assert.match(
	shader,
	/bool r7310XatlasRuntimeNorthFirstHit\s*=\s*r7310XatlasRuntimeFirstHit\s*&&\s*r7310XatlasRuntimeNorthMapped\s*;/,
	'north direct-included short-circuit must be scoped to the north mapped route'
);
const finalHybridAddStart = shader.indexOf('if (r7310FloorHybridFirstHit && !r7310XatlasRuntimeMapped)');
assert.notEqual(finalHybridAddStart, -1, 'final hybrid add block must start with the xatlas-mapped floor guard');
const finalHybridAddEnd = shader.indexOf('if (r7310SeColumnNorthHybridFirstHit)', finalHybridAddStart);
assert.ok(finalHybridAddEnd > finalHybridAddStart, 'final hybrid add block must include north/east before SE-column additions');
const finalHybridAddBlock = shader.slice(finalHybridAddStart, finalHybridAddEnd);
assert.match(
	finalHybridAddBlock,
	/if\s*\(\s*r7310NorthWallHybridFirstHit\s*&&\s*!r7310XatlasRuntimeMapped\s*\)[\s\S]{0,120}r7310C1NorthWallHybridRadiance/,
	'north full-bake/xatlas-mapped hit must prevent the old north hybrid radiance add'
);
assert.match(
	finalHybridAddBlock,
	/if\s*\(\s*r7310EastWallHybridFirstHit\s*&&\s*!r7310XatlasRuntimeMapped\s*\)[\s\S]{0,120}r7310C1EastWallHybridRadiance/,
	'east hybrid add must keep yielding when the shared xatlas route already mapped the hit'
);
assert.match(
	shader,
	/uR7310C1XatlasRuntimeFullWestWallDirectIncluded\s*>\s*0\.5\s*&&\s*r7310XatlasRuntimeWestFirstHit[\s\S]{0,220}\bbreak\s*;/,
	'west wall remains the reference full-bake short-circuit route'
);

console.log('R7-3.10 north full-bake package gate contract passed');
