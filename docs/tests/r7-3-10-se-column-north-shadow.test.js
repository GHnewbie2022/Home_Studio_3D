import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID\s*=\s*1008/);
assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME\s*=\s*'c1_se_column_north_shadow'/);
assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1SeColumnNorthShadowRuntimePackage/);
assert.doesNotMatch(initCommon, /pathTracingUniforms\.tR7310C1SeColumnNorthShadowTexture/);
assert.match(initCommon, /se_column_north_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection/);

assert.doesNotMatch(shader, /uniform sampler2D tR7310C1SeColumnNorthShadowTexture/);
assert.match(shader, /uniform float uR7310C1SeColumnNorthShadowMode/);
assert.match(shader, /uniform float uR7310C1SeColumnNorthShadowResolution/);
assert.match(shader, /bool r7310C1SeColumnNorthShadowDiffuseUv/);
assert.match(shader, /r7310C1SeColumnNorthShadowSampleValidLinear/);
assert.match(shader, /bool r7310C1SeColumnNorthShadowHybridActive/);
assert.match(shader, /bool r7310C1SeColumnNorthShadowIndirectBakeFirstHit/);
assert.match(shader, /bool r7310C1SeColumnNorthShadowHiddenByEastBeam/);
assert.match(
  shader,
  /if\s*\(\s*r7310C1SeColumnNorthShadowHiddenByEastBeam\(x,\s*y\)\s*\)\s*return false;/,
  'southeast column north shadow bake must invalidate the east-beam-covered texels'
);
const runtimeUvStart = shader.indexOf('bool r7310C1SeColumnNorthShadowDiffuseUv');
assert.notEqual(runtimeUvStart, -1, 'southeast column north runtime UV helper missing');
const runtimeUvEnd = shader.indexOf('\nvec4 r7310C1SeColumnNorthShadowTexel', runtimeUvStart);
assert.ok(runtimeUvEnd > runtimeUvStart, 'southeast column north runtime UV helper end marker missing');
const runtimeUvBody = shader.slice(runtimeUvStart, runtimeUvEnd);
assert.match(
  runtimeUvBody,
  /r7310C1SeColumnNorthShadowHiddenByEastBeam\(visiblePosition\.x,\s*visiblePosition\.y\)[\s\S]*return false;/,
  'southeast column north runtime lookup must ignore the east-beam-hidden span'
);

const shortCircuitStart = shader.indexOf('bool r7310C1FullRoomDiffuseShortCircuit');
assert.notEqual(shortCircuitStart, -1, 'full-room short-circuit helper missing');
const shortCircuitEnd = shader.indexOf('int r739C1ReflectionTargetId', shortCircuitStart);
assert.ok(shortCircuitEnd > shortCircuitStart, 'full-room short-circuit helper end marker missing');
const shortCircuitBody = shader.slice(shortCircuitStart, shortCircuitEnd);
assert.doesNotMatch(shortCircuitBody, /uR7310C1SeColumnNorthShadowMode/, 'southeast column north face must not short-circuit full diffuse');
assert.match(shader, /r7310C1SeColumnNorthShadowHybridActive\(hitType, hitObjectID, nl, x\)/);
assert.match(shader, /!r7310SeColumnNorthHybridFirstHit/);
assert.match(shader, /r7310C1SeColumnNorthShadowIndirectBakeFirstHit\(bounces, diffuseCount\)/);
const fullRoomFallbackIndex = shader.indexOf('r7310C1FullRoomDiffuseShortCircuit(hitType, hitObjectID, nl, x');
assert.ok(fullRoomFallbackIndex > 0, 'full-room fallback call missing');
const fullRoomFallbackGuard = shader.slice(Math.max(0, fullRoomFallbackIndex - 900), fullRoomFallbackIndex + 180);
assert.match(fullRoomFallbackGuard, /!\(r7310FloorHybridFirstHit[\s\S]*r7310CeilingHybridFirstHit[\s\S]*r7310NorthWallHybridFirstHit[\s\S]*r7310SeColumnNorthHybridFirstHit[\s\S]*r7310SouthWindowTopRevealShadowHybridFirstHit[\s\S]*r7310IronDoorRevealHybridFirstHit\)/);
assert.match(fullRoomFallbackGuard, /bounces\s*==\s*0/);
assert.match(fullRoomFallbackGuard, /r7310C1FullRoomDiffuseShortCircuit/);
const structuralLookup = shader.indexOf('uR7310C1StructuralDiffuseMode', shortCircuitStart);
assert.ok(structuralLookup > shortCircuitStart, 'structural lookup missing from short-circuit');

assert.match(runner, /--r7310-se-column-north-shadow-visual-test/);
assert.match(runner, /live-reference\.png/);
assert.match(runner, /se-column-north-shadow-bake\.png/);
assert.doesNotMatch(runner, /old-structural-bake-reference\.png/);

assert.equal(contract.c1SeColumnNorthShadowBatch.targetId, 1008);
assert.equal(contract.c1SeColumnNorthShadowBatch.surfaceName, 'c1_se_column_north_shadow');
assert.equal(contract.c1SeColumnNorthShadowBatch.referenceForAcceptance, 'live_path_tracing_same_camera');
assert.equal(contract.c1SeColumnNorthShadowBatch.bakedRadianceKind, 'indirect_diffuse_radiance');
assert.equal(contract.c1SeColumnNorthShadowBatch.directLightAlreadyIncluded, false);
assert.equal(contract.c1SeColumnNorthShadowBatch.addDirectLightAfterBakeLookup, true);
assert.match(initCommon, /bakedRadianceKind: 'indirect_diffuse_radiance'/);
assert.match(runner, /pointer\.bakedRadianceKind = 'indirect_diffuse_radiance'/);
assert.equal(contract.c1SeColumnNorthShadowBatch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
assert.equal(contract.c1SeColumnNorthShadowBatch.runtimeAtlasSlot, 7);
assert.equal(contract.c1SeColumnNorthShadowBatch.uniformContractAlias, 'tR7310C1SeColumnNorthShadowTexture');
assert.deepEqual(contract.c1SeColumnNorthShadowBatch.invalidTexelRegions.eastBeamBack, {
  xMin: 1.85,
  xMax: 1.91,
  yMin: 2.515,
  yMax: 2.905
});
assert.match(initCommon, /R7310_C1_SE_COLUMN_NORTH_SHADOW_EAST_BEAM_BACK/);
assert.match(
  initCommon,
  /var\s+isEastBeamBack\s*=\s*worldX\s*>=\s*eastBeamBack\.xMin[\s\S]*metadata\[offset \+ 7\]\s*=\s*isEastBeamBack\s*\?\s*0\.0\s*:\s*1\.0;/,
  'metadata alpha must match the shader invalidation gate'
);
assert.match(initCommon, /function syncR7310C1AtlasAlphaToTexelMetadata/);
assert.match(initCommon, /function shouldSyncR7310C1AtlasAlphaToTexelMetadata/);
assert.match(
  initCommon,
  /shouldSyncR7310C1AtlasAlphaToTexelMetadata\(patchId,\s*metadataResult\)[\s\S]*syncR7310C1AtlasAlphaToTexelMetadata\(averaged\.pixels,\s*metadataResult\.metadata,\s*size\)/,
  'atlas alpha must be synchronized from metadata without relying on a manual target-id allowlist'
);

const seColumnNorthBakeDir = 'assets/bakes/r7-3-10/c1-static-diffuse/se-column-north-shadow-1024px-1000spp';
assert.equal(fs.existsSync(`${seColumnNorthBakeDir}/atlas-patch-000-rgba-f32.bin`), true);
assert.equal(fs.existsSync(`${seColumnNorthBakeDir}/texel-metadata-patch-000-f32.bin`), true);
const atlas = new Float32Array(fs.readFileSync(`${seColumnNorthBakeDir}/atlas-patch-000-rgba-f32.bin`).buffer);
const metadata = new Float32Array(fs.readFileSync(`${seColumnNorthBakeDir}/texel-metadata-patch-000-f32.bin`).buffer);
let invalidTexels = 0;
let invalidAtlasAlphaOne = 0;
let invalidBrightTexels = 0;
const texelCount = Math.min(Math.floor(atlas.length / 4), Math.floor(metadata.length / 12));
for (let i = 0; i < texelCount; i += 1)
{
  const metadataAlpha = metadata[i * 12 + 7];
  if (metadataAlpha > 0.5) continue;
  invalidTexels += 1;
  const atlasOffset = i * 4;
  const atlasAlpha = atlas[atlasOffset + 3];
  const luma = 0.2126 * atlas[atlasOffset] + 0.7152 * atlas[atlasOffset + 1] + 0.0722 * atlas[atlasOffset + 2];
  if (atlasAlpha > 0.5) invalidAtlasAlphaOne += 1;
  if (luma > 0.000001) invalidBrightTexels += 1;
}
assert.equal(invalidTexels, 64801);
assert.equal(invalidAtlasAlphaOne, 0, '1008 metadata-invalid texels must not remain sampleable by atlas alpha');
assert.equal(invalidBrightTexels, 0, '1008 metadata-invalid texels must not keep bright RGB data');

console.log('R7-3.10 southeast column north shadow contract passed');
