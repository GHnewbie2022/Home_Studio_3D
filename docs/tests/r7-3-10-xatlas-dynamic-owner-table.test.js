#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const init = fs.readFileSync('js/InitCommon.js', 'utf8');
const home = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const generated = JSON.parse(fs.readFileSync('docs/generated/r7-3-10-xatlas-param-table.generated.json', 'utf8'));

test('generated owner table has one exact 7-texel record per registry surface', () => {
	assert.equal(generated.floatsPerEntry, 28);
	assert.equal(generated.entries.length, generated.count);
	assert.equal(generated.flatFloats.length, generated.count * generated.floatsPerEntry);
});

test('dynamic row packing preserves every generated owner float exactly', () => {
	const width = 512;
	const texelBase = 512;
	const ownerTexels = generated.count * 7;
	const height = 1 + Math.ceil(ownerTexels / width);
	const packed = new Float32Array(width * height * 4);
	packed.set(new Float32Array(generated.flatFloats), texelBase * 4);
	for (let i = 0; i < generated.flatFloats.length; i += 1) {
		assert.equal(packed[texelBase * 4 + i], Math.fround(generated.flatFloats[i]), `owner float ${i} changed during packing`);
	}
});

test('dynamic row packing grows past the retired 72-owner limit', () => {
	const width = 512;
	const texelBase = 512;
	const syntheticOwnerCount = 144;
	const syntheticFloats = new Float32Array(syntheticOwnerCount * 28);
	for (let i = 0; i < syntheticFloats.length; i += 1) syntheticFloats[i] = i + 0.25;
	const height = 1 + Math.ceil((syntheticOwnerCount * 7) / width);
	const packed = new Float32Array(width * height * 4);
	packed.set(syntheticFloats, texelBase * 4);
	assert.equal(height, 3);
	assert.equal(packed[texelBase * 4 + 72 * 28], Math.fround(72 * 28 + 0.25));
	assert.equal(packed[texelBase * 4 + syntheticFloats.length - 1], Math.fround(syntheticFloats.length - 1 + 0.25));
});

test('runtime owner storage grows from generated count instead of a handwritten capacity', () => {
	assert.doesNotMatch(init, /R7310_C1_XATLAS_PARAM_SURFACE_CAPACITY/);
	assert.doesNotMatch(init, /R7310_C1_XATLAS_PARAM_VEC4_CAPACITY/);
	assert.doesNotMatch(shader, /uR7310C1XatlasParamSurfaceTable\s*\[/);
	assert.match(init, /r7310C1InstallXatlasParamTableInBoxDataTexture/);
	assert.match(init, /Math\.ceil\(ownerTexelCount\s*\/\s*boxTextureWidth\)/);
	assert.match(init, /surfaceCount\s*\*\s*28\s*!==\s*ff\.length/);
	assert.match(home, /r7310C1InstallXatlasParamTableInBoxDataTexture\(\)/);
});

test('owner records share the box data sampler without changing box row zero', () => {
	assert.match(shader, /uniform\s+int\s+uR7310C1XatlasParamSurfaceTexelBase\s*;/);
	assert.match(shader, /uniform\s+int\s+uR7310C1XatlasParamDataTextureWidth\s*;/);
	assert.match(shader, /vec4\s+r7310C1XatlasParamSurfaceTexel\s*\(/);
	assert.match(shader, /texelFetch\(tBoxDataTexture,\s*ivec2\(texelX,\s*texelY\),\s*0\)/);
	assert.match(shader, /r7310C1XatlasParamSurfaceTexel\(sid,\s*0\)/);
	assert.match(shader, /r7310C1XatlasParamSurfaceTexel\(sid,\s*6\)/);
	assert.match(home, /new THREE\.DataTexture\(boxArr,\s*BVH_TEX_W,\s*1,\s*THREE\.RGBAFormat,\s*THREE\.FloatType\)/);
	assert.match(init, /packedData\.set\(sourceImage\.data\.subarray\(0,\s*Math\.min\(sourceImage\.data\.length,\s*boxRowFloatCount\)\),\s*0\)/);
	assert.match(init, /packedData\.set\(r7310C1XatlasParamSurfaceFlatData,\s*R7310_C1_XATLAS_PARAM_TEXEL_BASE\s*\*\s*4\)/);
});

test('runtime owner toggles update the packed float data and upload texture', () => {
	assert.match(init, /r7310C1XatlasParamSurfaceFlatData\[surfaceFloatBase\s*\+\s*7\]/);
	assert.match(init, /r7310C1XatlasParamSurfaceFlatData\[surfaceFloatBase\s*\+\s*24\]/);
	assert.match(init, /r7310C1XatlasParamSurfaceDataTexture\.needsUpdate\s*=\s*true/);
});
