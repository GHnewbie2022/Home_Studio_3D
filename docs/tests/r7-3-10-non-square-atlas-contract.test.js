import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const home = fs.readFileSync('js/Home_Studio.js', 'utf8');
const html = fs.readFileSync('Home_Studio.html', 'utf8');

function bodyOf(source, signature, nextSignature)
{
	const start = source.indexOf(signature);
	assert.ok(start >= 0, `Missing ${signature}`);
	const end = source.indexOf(nextSignature, start + signature.length);
	assert.ok(end > start, `Missing end anchor ${nextSignature}`);
	return source.slice(start, end);
}

assert.match(shader, /uniform sampler2D tR7310C1FullRoomDiffuseAtlasTextureNonSquare;/);
assert.match(shader, /uniform float uR7310C1UseNonSquareAtlas;/);
assert.match(shader, /uniform float uR7310C1NonSquareAtlasReady;/);
assert.match(shader, /uniform vec4 uR7310C1NonSquareNorthWallUvRect;/);
assert.match(shader, /uniform vec4 uR7310C1NonSquareEastWallUvRect;/);
assert.match(shader, /uniform vec2 uR7310C1NonSquareNorthWallFaceSizePx;/);
assert.match(shader, /uniform vec2 uR7310C1NonSquareEastWallFaceSizePx;/);
assert.match(shader, /uniform vec2 uR7310C1NonSquareAtlasSizePx;/);

const originalTexel = bodyOf(
	shader,
	'vec4 r7310C1FullRoomDiffuseSamplePatchTexel',
	'vec3 r7310C1FullRoomDiffuseSamplePatchValidLinear'
);
assert.match(originalTexel, /texture\(tR7310C1FullRoomDiffuseAtlasTexture,/);
assert.doesNotMatch(originalTexel, /NonSquare/);

const nonSquareTexel = bodyOf(
	shader,
	'vec4 r7310C1FullRoomDiffuseSamplePatchTexelNonSquare',
	'vec3 r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare'
);
assert.match(nonSquareTexel, /texture\(tR7310C1FullRoomDiffuseAtlasTextureNonSquare,/);

const nonSquareUvRect = bodyOf(
	shader,
	'vec4 r7310C1NonSquareAtlasUvRect',
	'vec2 r7310C1NonSquareAtlasFaceSizePx'
);
assert.match(nonSquareUvRect, /slot\s*==\s*1\.0[\s\S]*uR7310C1NonSquareNorthWallUvRect/);
assert.match(nonSquareUvRect, /slot\s*==\s*2\.0[\s\S]*uR7310C1NonSquareEastWallUvRect/);

const nonSquareFaceSize = bodyOf(
	shader,
	'vec2 r7310C1NonSquareAtlasFaceSizePx',
	'vec4 r7310C1FullRoomDiffuseSamplePatchTexelNonSquare'
);
assert.match(nonSquareFaceSize, /slot\s*==\s*1\.0[\s\S]*uR7310C1NonSquareNorthWallFaceSizePx/);
assert.match(nonSquareFaceSize, /slot\s*==\s*2\.0[\s\S]*uR7310C1NonSquareEastWallFaceSizePx/);

const nonSquareGate = bodyOf(
	shader,
	'bool r7310C1ShouldUseNonSquareAtlas',
	'vec4 r7310C1NonSquareAtlasUvRect'
);
assert.match(nonSquareGate, /uR7310C1UseNonSquareAtlas\s*>\s*0\.5/);
assert.match(nonSquareGate, /uR7310C1NonSquareAtlasReady\s*>\s*0\.5/);
assert.match(nonSquareGate, /r7310C1NonSquareAtlasSlotSupported\(patchSlot\)/);

for (const fn of [
	'r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare',
	'r7310C1FullRoomDiffuseSamplePatchPixelNonSquare',
	'r7310C1PatchCoverageProbeNonSquare',
	'r7310C1FullRoomDiffuseSampleRectLinearNonSquare',
	'r7310C1FullRoomDiffuseSampleRectTent3NonSquare',
	'r7310C1FullRoomDiffuseSampleRectTent5NonSquare',
])
{
	assert.ok(shader.includes(fn), `Missing ${fn}`);
}

const shortCircuit = bodyOf(
	shader,
	'bool r7310C1FullRoomDiffuseShortCircuit',
	'bool r739C1AccurateReflectionReplacesTarget'
);
assert.doesNotMatch(shortCircuit, /uR7310C1UseNonSquareAtlas\s*>\s*0\.5/);
assert.match(shortCircuit, /r7310C1ShouldUseNonSquareAtlas\(1\.0\)/);
assert.match(shortCircuit, /r7310C1ShouldUseNonSquareAtlas\(2\.0\)/);
assert.match(shortCircuit, /r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare\(atlasUv,\s*1\.0\)/);
assert.match(shortCircuit, /r7310C1FullRoomDiffuseSampleRectTent3NonSquare\(atlasUv,\s*2\.0,\s*r7310C1EastWallAtlasRect\(\)\)/);
assert.match(shortCircuit, /r7310C1FullRoomDiffuseSample\(r7310C1CombinedAtlasUv\(atlasUv,\s*3\.0\)\)/);

const northHybridPreAlbedo = bodyOf(
	shader,
	'vec3 r7310C1NorthWallHybridPreAlbedoRadiance',
	'vec3 r7310C1NorthWallHybridRadiance'
);
assert.match(northHybridPreAlbedo, /r7310C1ShouldUseNonSquareAtlas\(1\.0\)/);
assert.match(northHybridPreAlbedo, /r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare\(atlasUv,\s*1\.0\)/);
assert.match(northHybridPreAlbedo, /r7310C1FullRoomDiffuseSamplePatchValidLinear\(atlasUv,\s*1\.0\)/);

const northHybrid = bodyOf(
	shader,
	'vec3 r7310C1NorthWallHybridRadiance',
	'bool r7310C1NorthWallIndirectBakeFirstHit'
);
assert.match(northHybrid, /r7310C1NorthWallHybridPreAlbedoRadiance/);
assert.match(northHybrid, /r7310NorthWallPreAlbedoRadiance/);
assert.match(northHybrid, /r7310NorthWallPreAlbedoRadiance\s*\*\s*visibleAlbedo/);

const eastHybridPreAlbedo = bodyOf(
	shader,
	'vec3 r7310C1EastWallHybridPreAlbedoRadiance',
	'vec3 r7310C1EastWallHybridRadiance'
);
assert.match(eastHybridPreAlbedo, /r7310C1ShouldUseNonSquareAtlas\(2\.0\)/);
assert.match(eastHybridPreAlbedo, /r7310C1FullRoomDiffuseSampleRectTent3NonSquare\(atlasUv,\s*2\.0,\s*r7310C1EastWallAtlasRect\(\)\)/);
assert.match(eastHybridPreAlbedo, /r7310C1FullRoomDiffuseSampleRectTent3\(atlasUv,\s*2\.0,\s*r7310C1EastWallAtlasRect\(\)\)/);

const eastHybrid = bodyOf(
	shader,
	'vec3 r7310C1EastWallHybridRadiance',
	'bool r7310C1EastWallIndirectBakeFirstHit'
);
assert.match(eastHybrid, /r7310C1EastWallHybridPreAlbedoRadiance/);

assert.match(shader, /r7310C1RuntimeProbeMode\s*>\s*48\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode\s*<\s*53\.5/);
assert.match(shader, /r7310C1NorthWallHybridPreAlbedoRadiance\(hitType,\s*hitObjectID,\s*nl,\s*x\)/);
assert.match(shader, /r7310C1EastWallHybridPreAlbedoRadiance\(hitType,\s*hitObjectID,\s*nl,\s*x\)/);
assert.match(shader, /r7310C1ShouldUseNonSquareAtlas\(2\.0\)\s*\?\s*1\.0\s*:\s*0\.0/);
assert.match(shader, /r7310C1FullRoomDiffuseSamplePatchTexelNonSquare\(vec2\(10\.0,\s*10\.0\),\s*2\.0\)/);
assert.match(shader, /r7310C1FullRoomDiffuseSampleRectTent3NonSquare\(r7310ProbeEastUv,\s*2\.0,\s*r7310C1EastWallAtlasRect\(\)\)/);

for (const slot of ['7.0', '8.0', '9.0', '10.0', '11.0', '12.0', '13.0', '14.0', '15.0', '16.0', '17.0', '21.0', '22.0'])
{
	const re = new RegExp(`r7310C1FullRoomDiffuseSamplePatchTexel\\([\\s\\S]*?,\\s*${slot.replace('.', '\\.')}\\)`);
	assert.match(shader, re, `slot ${slot} must keep using the original combined-atlas texel sampler`);
}

assert.match(html, /id="btn-r7310-non-square-atlas"/);
assert.match(home, /pathTracingUniforms\.tR7310C1FullRoomDiffuseAtlasTextureNonSquare\s*=/);
assert.match(home, /pathTracingUniforms\.uR7310C1UseNonSquareAtlas\s*=/);
assert.match(home, /pathTracingUniforms\.uR7310C1NonSquareAtlasReady\s*=/);
assert.match(home, /pathTracingUniforms\.uR7310C1NonSquareNorthWallUvRect\s*=/);
assert.match(home, /pathTracingUniforms\.uR7310C1NonSquareEastWallUvRect\s*=/);
assert.match(home, /setR7310C1UseNonSquareAtlas/);
assert.match(home, /btn-r7310-non-square-atlas/);

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
assert.match(initCommon, /let r7310C1UseNonSquareAtlas\s*=\s*false;/);
assert.match(initCommon, /window\.setR7310C1UseNonSquareAtlas\s*=/);
assert.match(initCommon, /nonSquareAtlasEnabled:\s*r7310C1UseNonSquareAtlas/);
assert.match(initCommon, /uR7310C1UseNonSquareAtlas\.value\s*=\s*r7310C1UseNonSquareAtlas\s*\?\s*1\.0\s*:\s*0\.0/);
assert.match(initCommon, /uR7310C1NonSquareAtlasReady\.value\s*=\s*r7310C1NonSquareAtlasRuntimeReady\s*\?\s*1\.0\s*:\s*0\.0/);
assert.match(initCommon, /if \(probeLevel === 49\) return 'nonSquareNorthPreAlbedoRadiance'/);
assert.match(initCommon, /if \(probeLevel === 50\) return 'nonSquareEastPreAlbedoRadiance'/);
assert.match(initCommon, /if \(probeLevel === 51\) return 'nonSquareEastGateState'/);
assert.match(initCommon, /if \(probeLevel === 52\) return 'nonSquareEastDirectTexel'/);
assert.match(initCommon, /if \(probeLevel === 53\) return 'nonSquareEastForcedRect'/);
assert.match(initCommon, /Math\.min\(53,\s*Math\.round\(requestedProbeLevel\)\)/);
assert.match(initCommon, /forceNonSquareAtlas/);
assert.match(initCommon, /nonSquarePreAlbedoProbeSummary/);

console.log('R7-3.10 non-square atlas contract passed');
