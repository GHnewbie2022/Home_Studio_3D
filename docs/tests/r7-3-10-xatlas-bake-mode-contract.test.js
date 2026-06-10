#!/usr/bin/env node
/*
 * R7-3.10 C2 xatlas bake mode contract.
 *
 * This test intentionally checks the cross-file wiring instead of shader output.
 * The runtime smoke test is slower; this contract catches accidental partial
 * wiring before Chrome/CDP is involved.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(repo, relative), 'utf8');

const shader = read('shaders/Home_Studio_Fragment.glsl');
const common = read('js/PathTracingCommon.js');
const home = read('js/Home_Studio.js');
const init = read('js/InitCommon.js');
const runner = read('docs/tools/r7-3-8-c1-bake-capture-runner.mjs');

function requireText(name, text, needle) {
	assert.ok(text.includes(needle), `${name} missing ${needle}`);
}

function requireRegex(name, text, regex) {
	assert.match(text, regex, `${name} missing ${regex}`);
}

requireText('shader', shader, 'uniform float uR7310C1XatlasBakeMode;');
assert.ok(!shader.includes('uniform sampler2D tR7310C1XatlasWorldPosTexture;'), 'xatlas bake must reuse existing sampler slots instead of adding worldPos sampler');
assert.ok(!shader.includes('uniform sampler2D tR7310C1XatlasNormalTexture;'), 'xatlas bake must reuse existing sampler slots instead of adding normal sampler');
assert.ok(!shader.includes('uniform sampler2D tR7310C1XatlasTriValidTexture;'), 'xatlas bake must stay within Metal texture unit limit by not uploading tri/valid to shader');
requireText('shader', shader, 'bool r7310C1XatlasBakeTexelValid = true;');
requireText('shader', shader, 'vec3 r7310C1XatlasBakeSurfaceNormal = vec3(0.0, 1.0, 0.0);');
assert.ok(!shader.includes('bool r7310XatlasSurfaceSeeded ='), 'xatlas bake must not pre-seed the second diffuse bounce');
assert.ok(!shader.includes('diffuseCount = 2;'), 'xatlas bake must not skip first-surface material and indirect-bake routing');
requireText('shader', shader, 'bool r7310XatlasIndirectBakeFirstHit =');
requireText('shader', shader, 'bool r7310AlbedoFreeBakeFirstHit =');

requireText('PathTracingCommon', common, 'uR7310C1XatlasBakeMode > 0.5');
requireText('PathTracingCommon', common, 'texelFetch(tR738C1BakeAtlasTexture');
requireText('PathTracingCommon', common, 'texelFetch(tR7310C1FullRoomDiffuseAtlasTexture');
requireText('PathTracingCommon', common, 'r7310C1XatlasBakeSurfaceNormal = r7310XatlasNormal;');
requireText('PathTracingCommon', common, 'rayDirection = -r7310XatlasNormal;');
assert.ok(!common.includes('texelFetch(tR7310C1XatlasTriValidTexture'), 'xatlas bake tri/valid must remain CPU metadata, not a shader sampler');
requireText('PathTracingCommon', common, 'r7310C1XatlasBakeTexelValid = false;');
requireText('PathTracingCommon', common, 'r7310C1XatlasBakeTexelValid = true;');
requireText('shader', shader, 'if (uR7310C1XatlasBakeMode > 0.5 && !r7310C1XatlasBakeTexelValid)');
assert.ok(!common.includes('texture(tR7310C1XatlasWorldPosTexture'), 'xatlas bake must not add world position texture sampler');
assert.ok(!common.includes('texture(tR7310C1XatlasNormalTexture'), 'xatlas bake must not add normal texture sampler');
assert.ok(!common.includes('texture(tR7310C1XatlasTriValidTexture'), 'xatlas bake tri/valid must not be a shader texture');

requireText('Home_Studio', home, 'uR7310C1XatlasBakeMode = { value: 0.0 }');
requireText('Home_Studio', home, 'uR7310C1XatlasBakeAtlasSize = { value: new THREE.Vector2(1.0, 1.0) }');
assert.ok(!home.includes('tR7310C1XatlasWorldPosTexture'), 'Home_Studio must not allocate an extra worldPos sampler');
assert.ok(!home.includes('tR7310C1XatlasNormalTexture'), 'Home_Studio must not allocate an extra normal sampler');
assert.ok(!home.includes('tR7310C1XatlasTriValidTexture'), 'Home_Studio must not allocate a third xatlas sampler');

requireText('InitCommon', init, 'function flipR7310C1XatlasRgba32fRows');
requireText('InitCommon', init, 'function createR7310C1XatlasBakeDataTexture');
requireText('InitCommon', init, 'previousTextureBindings');
requireText('InitCommon', init, 'restoreR7310C1XatlasBakeTextureBindings');
requireText('InitCommon', init, 'function refreshR7310C1XatlasBakeTextureUniforms');
requireText('InitCommon', init, 'window.prepareR7310C1XatlasBakeTextures');
requireText('InitCommon', init, 'window.reportR7310C1XatlasBakeAfterSamples');
requireText('InitCommon', init, "renderer.extensions.has('EXT_color_buffer_float')");
requireText('InitCommon', init, 'uploadRowFlip: true');
requireText('InitCommon', init, 'uR7310C1XatlasBakeMode.value = 1.0');
requireText('InitCommon', init, 'uR7310C1XatlasBakeMode.value = 0.0');
requireText('InitCommon', init, 'tR738C1BakeAtlasTexture.value = worldTexture');
requireText('InitCommon', init, 'tR7310C1FullRoomDiffuseAtlasTexture.value = normalTexture');
requireRegex('InitCommon', init, /function refreshR7310C1XatlasBakeTextureUniforms\(prepared\)[\s\S]*?tR738C1BakeAtlasTexture\.value = prepared\.textures\.worldPos;[\s\S]*?tR7310C1FullRoomDiffuseAtlasTexture\.value = prepared\.textures\.normal;[\s\S]*?uniformsNeedUpdate = true;/);
requireRegex('InitCommon', init, /updateR7310C1FullRoomDiffuseRuntimeUniforms\(\);[\s\S]*?if \(useXatlasBakeMode\)[\s\S]*?refreshR7310C1XatlasBakeTextureUniforms\(xatlasPrepared\);/);
requireRegex('InitCommon', init, /uRandomVec2\.value\.set\(Math\.random\(\), Math\.random\(\)\);[\s\S]*?if \(useXatlasBakeMode\)[\s\S]*?refreshR7310C1XatlasBakeTextureUniforms\(xatlasPrepared\);[\s\S]*?renderer\.render\(pathTracingScene, worldCamera\);/);
assert.ok(!init.includes('tR7310C1XatlasTriValidTexture.value'), 'InitCommon must not bind tri/valid as a shader texture');

requireText('runner', runner, 'xatlasBake: false');
requireText('runner', runner, 'xatlasBakeProbeLevel: null');
requireText('runner', runner, "else if (arg === '--r7310-xatlas-bake') out.xatlasBake = true;");
requireText('runner', runner, "else if (arg.startsWith('--xatlas-texelmap-dir=')) out.xatlasTexelmapDir = arg.slice('--xatlas-texelmap-dir='.length);");
requireText('runner', runner, "else if (arg.startsWith('--xatlas-bake-probe-level=')) out.xatlasBakeProbeLevel = Number(arg.slice('--xatlas-bake-probe-level='.length));");
requireRegex('runner', runner, /args\.xatlasBake[\s\S]*reportR7310C1XatlasBakeAfterSamples/);
requireText('runner', runner, 'pathTracingUniforms.uR7310C1RuntimeProbeMode.value = xatlasBakeProbeLevel;');
requireText('runner', runner, "window.getR738C1BakeCaptureArtifacts().texelMetadata");
requireRegex('runner', runner, /args\.xatlasBake[\s\S]*texel-metadata-patch-000-f32\.bin/);

console.log('r7-3-10 xatlas bake mode contract OK');
