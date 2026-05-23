import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

const rectForPointStart = shader.indexOf('vec4 r7310C1StructuralBeamColumnAtlasRectForPoint');
assert.notEqual(rectForPointStart, -1, 'structural atlas rect helper missing');

const rectForPointEnd = shader.indexOf('bool r7310C1NorthWallDiffuseUv', rectForPointStart);
assert.notEqual(rectForPointEnd, -1, 'structural atlas rect helper end marker missing');

const rectForPointSource = shader.slice(rectForPointStart, rectForPointEnd);

assert.doesNotMatch(
	rectForPointSource,
	/uSplit|vSplit|rect\.z\s*=\s*min|rect\.w\s*=\s*min/,
	'se_column_north_z runtime sampling must use padded atlas texels instead of clipping away the hidden quadrant'
);

assert.match(
	shader,
	/if \(islandId < 8\.5\) return vec4\(0\.000,\s*0\.880,\s*1\.000,\s*1\.000\);/,
	'se_column_north_z must use the full-width high-resolution atlas strip'
);

assert.match(
	shader,
	/mix\(0\.000,\s*1\.000,\s*visiblePosition\.y\s*\/\s*2\.905\)[\s\S]*mix\(0\.880,\s*1\.000,\s*\(visiblePosition\.x\s*-\s*1\.780\)\s*\/\s*0\.130\)/,
	'se_column_north_z runtime UV must rotate y onto u and x onto v'
);

assert.match(
	shader,
	/r7310C1FullRoomDiffuseSampleRectLinear\(atlasUv,\s*6\.0,\s*r7310C1StructuralBeamColumnAtlasRectForPoint\(structuralIslandId,\s*visiblePosition\)\)/,
	'structural runtime must use local linear sampling after atlas guard texels remove invalid black bleed'
);

assert.match(
	initCommon,
	/fillR7310C1StructuralSeColumnNorthEastBeamGuardTexels/,
	'se_column_north_z hidden east-beam overlap must be padded from adjacent valid texels during bake export'
);

assert.match(
	initCommon,
	/fillR7310C1StructuralSeColumnNorthEastBeamGuardTexels\(averaged\.pixels,\s*size\)/,
	'structural bake export must apply the se_column_north_z east-beam guard before writing the atlas'
);

console.log('R7-3.10 structural sampling guard passed');
