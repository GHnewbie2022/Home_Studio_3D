import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const northSeparatedPointer = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json', 'utf8'));

function bodyOf(source, signature, nextSignature)
{
	const start = source.indexOf(signature);
	assert.ok(start >= 0, `Missing ${signature}`);
	const end = source.indexOf(nextSignature, start + signature.length);
	assert.ok(end > start, `Missing end anchor ${nextSignature}`);
	return source.slice(start, end);
}

function finalDiffuse(albedo, bakedIrradiance, directLightLive)
{
	return albedo * bakedIrradiance + directLightLive;
}

function nearlyEqual(actual, expected, epsilon = 1e-9)
{
	assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

assert.equal(finalDiffuse(0.7, 0.5, 0.2), 0.55);
assert.equal(finalDiffuse(0.4, 0.5, 0.2), 0.4);
nearlyEqual(finalDiffuse(0.7, 0.5, 0.2) - finalDiffuse(0.4, 0.5, 0.2), 0.15);

assert.equal(northSeparatedPointer.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(northSeparatedPointer.multiplyAlbedoAfterBakeLookup, true);
assert.equal(northSeparatedPointer.directLightAlreadyIncluded, false);
assert.equal(northSeparatedPointer.addDirectLightAfterBakeLookup, true);
assert.equal(Object.hasOwn(northSeparatedPointer, 'targetSurfaceAlbedoRemoved'), false);

const northReport = bodyOf(
	initCommon,
	'window.reportR7310C1NorthWallDiffuseBakeAfterSamples',
	'window.reportR7310C1EastWallDiffuseBakeAfterSamples'
);
assert.match(northReport, /bakedRadianceKind:\s*'indirect_diffuse_radiance'/);
assert.match(northReport, /multiplyAlbedoAfterBakeLookup:\s*options\.separatedIrradianceBake\s*===\s*true/);
assert.doesNotMatch(northReport, /indirect_diffuse_irradiance/);
assert.doesNotMatch(northReport, /targetSurfaceAlbedoRemoved/);

const runnerNorthPointer = bodyOf(
	runner,
	"if (report.surfaceName === 'c1_north_wall')",
	"if (report.surfaceName === 'c1_east_wall')"
);
assert.match(runnerNorthPointer, /pointer\.bakedRadianceKind\s*=\s*report\.bakedRadianceKind\s*\|\|\s*'indirect_diffuse_radiance'/);
assert.match(runnerNorthPointer, /pointer\.multiplyAlbedoAfterBakeLookup\s*=\s*report\.multiplyAlbedoAfterBakeLookup\s*===\s*true/);
assert.doesNotMatch(runnerNorthPointer, /targetSurfaceAlbedoRemoved/);

const northLoader = bodyOf(
	initCommon,
	'async function loadR7310C1NorthWallDiffuseRuntimePackage',
	'async function loadR7310C1EastWallDiffuseRuntimePackage'
);
assert.match(northLoader, /pointer\.bakedRadianceKind\s*!==\s*'indirect_diffuse_radiance'/);
assert.match(northLoader, /pointer\.multiplyAlbedoAfterBakeLookup\s*===\s*true/);
assert.match(northLoader, /r7310C1NorthWallSeparatedDiffuseRuntime\s*=\s*pointer\.multiplyAlbedoAfterBakeLookup\s*===\s*true/);
assert.doesNotMatch(northLoader, /indirect_diffuse_irradiance/);
assert.doesNotMatch(northLoader, /targetSurfaceAlbedoRemoved/);

const hybridRadiance = bodyOf(
	shader,
	'vec3 r7310C1NorthWallHybridRadiance',
	'bool r7310C1NorthWallIndirectBakeFirstHit'
);
assert.match(hybridRadiance, /r7310NorthWallPreAlbedoRadiance/);
assert.match(hybridRadiance, /uR7310C1NorthWallSeparatedDiffuseMode\s*>\s*0\.5[\s\S]*return\s+r7310NorthWallPreAlbedoRadiance\s*\*\s*visibleAlbedo/);
assert.equal((hybridRadiance.match(/\*\s*visibleAlbedo/g) || []).length, 1);

const shortCircuit = bodyOf(
	shader,
	'bool r7310C1FullRoomDiffuseShortCircuit',
	'bool r739C1AccurateReflectionReplacesTarget'
);
assert.match(shortCircuit, /r7310C1FullRoomDiffuseShortCircuit\([^)]*vec3 visibleAlbedo[^)]*out vec3 bakedRadiance/);
assert.match(shortCircuit, /uR7310C1NorthWallSeparatedDiffuseMode\s*>\s*0\.5[\s\S]*bakedRadiance\s*=\s*r7310NorthWallBakedRadiance\s*\*\s*visibleAlbedo/);
assert.match(shader, /r7310C1FullRoomDiffuseShortCircuit\(hitType,\s*hitObjectID,\s*nl,\s*x,\s*hitIsRayExiting,\s*hitColor,\s*r7310BakedRadiance\)/);

console.log('R7-3.10 separated composite contract passed');
