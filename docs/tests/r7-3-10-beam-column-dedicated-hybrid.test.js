import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));

const surfaces = [
  {
    key: 'c1SwColumnInnerShadowBatch',
    constName: 'SW_COLUMN_INNER_SHADOW',
    camel: 'SwColumnInnerShadow',
    lower: 'swColumnInnerShadow',
    surfaceName: 'c1_sw_column_inner_shadow',
    cliName: 'sw-column-inner-shadow',
    packageName: 'sw-column-inner-shadow-1024px-1000spp',
    targetId: 1014,
    slot: 13,
    bakeRegex: /if\s*\(\s*patchId\s*==\s*1014\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*-1\.75\s*,\s*y\s*,\s*z\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*1\.0\s*,\s*0\.0\s*,\s*0\.0\s*\)/,
    runtimeRegex: /bool r7310C1RuntimeSurfaceIsSwColumnInnerShadow/,
    uvRegex: /bool r7310C1SwColumnInnerShadowDiffuseUv/,
  },
  {
    key: 'c1WestBeamInnerShadowBatch',
    constName: 'WEST_BEAM_INNER_SHADOW',
    camel: 'WestBeamInnerShadow',
    lower: 'westBeamInnerShadow',
    surfaceName: 'c1_west_beam_inner_shadow',
    cliName: 'west-beam-inner-shadow',
    packageName: 'west-beam-inner-shadow-1024px-1000spp',
    targetId: 1015,
    slot: 14,
    bakeRegex: /if\s*\(\s*patchId\s*==\s*1015\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*-1\.75\s*,\s*y\s*,\s*z\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*1\.0\s*,\s*0\.0\s*,\s*0\.0\s*\)/,
    runtimeRegex: /bool r7310C1RuntimeSurfaceIsWestBeamInnerShadow/,
    uvRegex: /bool r7310C1WestBeamInnerShadowDiffuseUv/,
  },
  {
    key: 'c1WestBeamUnderShadowBatch',
    constName: 'WEST_BEAM_UNDER_SHADOW',
    camel: 'WestBeamUnderShadow',
    lower: 'westBeamUnderShadow',
    surfaceName: 'c1_west_beam_under_shadow',
    cliName: 'west-beam-under-shadow',
    packageName: 'west-beam-under-shadow-1024px-1000spp',
    targetId: 1016,
    slot: 15,
    bakeRegex: /if\s*\(\s*patchId\s*==\s*1016\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*x\s*,\s*2\.525\s*,\s*z\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*0\.0\s*,\s*-1\.0\s*,\s*0\.0\s*\)/,
    runtimeRegex: /bool r7310C1RuntimeSurfaceIsWestBeamUnderShadow/,
    uvRegex: /bool r7310C1WestBeamUnderShadowDiffuseUv/,
  },
  {
    key: 'c1EastBeamInnerShadowBatch',
    constName: 'EAST_BEAM_INNER_SHADOW',
    camel: 'EastBeamInnerShadow',
    lower: 'eastBeamInnerShadow',
    surfaceName: 'c1_east_beam_inner_shadow',
    cliName: 'east-beam-inner-shadow',
    packageName: 'east-beam-inner-shadow-1024px-1000spp',
    targetId: 1017,
    slot: 16,
    bakeRegex: /if\s*\(\s*patchId\s*==\s*1017\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*1\.85\s*,\s*y\s*,\s*z\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*-1\.0\s*,\s*0\.0\s*,\s*0\.0\s*\)/,
    runtimeRegex: /bool r7310C1RuntimeSurfaceIsEastBeamInnerShadow/,
    uvRegex: /bool r7310C1EastBeamInnerShadowDiffuseUv/,
  },
  {
    key: 'c1EastBeamUnderShadowBatch',
    constName: 'EAST_BEAM_UNDER_SHADOW',
    camel: 'EastBeamUnderShadow',
    lower: 'eastBeamUnderShadow',
    surfaceName: 'c1_east_beam_under_shadow',
    cliName: 'east-beam-under-shadow',
    packageName: 'east-beam-under-shadow-1024px-1000spp',
    targetId: 1018,
    slot: 17,
    bakeRegex: /if\s*\(\s*patchId\s*==\s*1018\s*\)[\s\S]*position\s*=\s*vec3\s*\(\s*x\s*,\s*2\.515\s*,\s*z\s*\)[\s\S]*normal\s*=\s*vec3\s*\(\s*0\.0\s*,\s*-1\.0\s*,\s*0\.0\s*\)/,
    runtimeRegex: /bool r7310C1RuntimeSurfaceIsEastBeamUnderShadow/,
    uvRegex: /bool r7310C1EastBeamUnderShadowDiffuseUv/,
  },
];

const bakeSurfacePointStart = shader.indexOf('bool r7310C1BakeSurfacePoint');
assert.notEqual(bakeSurfacePointStart, -1, 'bake surface point helper missing');
const bakeSurfacePointEnd = shader.indexOf('bool r738C1BakePastePreviewUv', bakeSurfacePointStart);
assert.ok(bakeSurfacePointEnd > bakeSurfacePointStart, 'bake surface point helper end marker missing');
const bakeSurfacePointBody = shader.slice(bakeSurfacePointStart, bakeSurfacePointEnd);

for (const surface of surfaces) {
  assert.match(initCommon, new RegExp(`R7310_C1_${surface.constName}_TARGET_ID\\s*=\\s*${surface.targetId}`));
  assert.match(initCommon, new RegExp(`R7310_C1_${surface.constName}_SURFACE_NAME\\s*=\\s*'${surface.surfaceName}'`));
  assert.match(initCommon, new RegExp(`R7310_C1_${surface.constName}_RUNTIME_PACKAGE_URL`));
  assert.match(initCommon, new RegExp(`loadR7310C1${surface.camel}RuntimePackage`));
  assert.match(shader, new RegExp(`uniform sampler2D tR7310C1${surface.camel}Texture`));
  assert.match(shader, new RegExp(`uniform float uR7310C1${surface.camel}Mode`));
  assert.match(shader, new RegExp(`uniform float uR7310C1${surface.camel}Ready`));
  assert.match(shader, new RegExp(`uniform float uR7310C1${surface.camel}Resolution`));
  assert.match(shader, surface.runtimeRegex);
  assert.match(shader, surface.uvRegex);
  assert.match(shader, new RegExp(`r7310C1${surface.camel}SampleValidLinear`));
  assert.match(shader, new RegExp(`bool r7310C1${surface.camel}HybridActive`));
  assert.match(shader, new RegExp(`vec3 r7310C1${surface.camel}HybridRadiance`));
  assert.match(shader, new RegExp(`bool r7310C1${surface.camel}IndirectBakeFirstHit`));
  assert.match(bakeSurfacePointBody, surface.bakeRegex, `${surface.surfaceName} bake-time world mapping missing`);
  assert.match(shader, new RegExp(`r7310${surface.camel}HybridFirstHit`));
  assert.match(shader, new RegExp(`!r7310${surface.camel}HybridFirstHit`));
  assert.match(shader, new RegExp(`r7310C1${surface.camel}IndirectBakeFirstHit\\(bounces, diffuseCount\\)`));
  assert.match(homeStudio, new RegExp(`tR7310C1${surface.camel}Texture`));
  assert.match(runner, new RegExp(surface.cliName));
  assert.match(runner, new RegExp(surface.surfaceName));
  assert.match(runner, new RegExp(surface.packageName));
  assert.match(initCommon, new RegExp(`r7310${surface.camel}Mode: pathTracingUniforms && pathTracingUniforms\\.uR7310C1${surface.camel}Mode`));
  assert.match(initCommon, new RegExp(`uR7310C1${surface.camel}Mode: pathTracingUniforms\\.uR7310C1${surface.camel}Mode`));

  const batch = contract[surface.key];
  assert.ok(batch, `${surface.key} missing from contract`);
  assert.equal(batch.targetId, surface.targetId);
  assert.equal(batch.surfaceName, surface.surfaceName);
  assert.equal(batch.referenceForAcceptance, 'live_path_tracing_same_camera');
  assert.equal(batch.bakedRadianceKind, 'indirect_diffuse_radiance');
  assert.equal(batch.directLightAlreadyIncluded, false);
  assert.equal(batch.addDirectLightAfterBakeLookup, true);
  assert.equal(batch.runtimeTexture, 'tR7310C1FullRoomDiffuseAtlasTexture');
  assert.equal(batch.runtimeAtlasSlot, surface.slot);
  assert.equal(batch.uniformContractAlias, `tR7310C1${surface.camel}Texture`);
}

assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 23\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*23/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasGridColumns = \{ value: 6\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS\s*=\s*6/);
assert.match(shader, /uniform float uR7310C1RuntimeAtlasGridColumns/);
assert.match(shader, /ceil\s*\(\s*patchCount\s*\/\s*columns\s*\)/);
assert.doesNotMatch(
  initCommon,
  /new THREE\.DataTexture\([\s\S]*?resolution \* patchCount,\s*resolution,\s*THREE\.RGBAFormat/,
  '18 x 1024 horizontal atlas exceeds common WebGL texture width limits'
);
assert.match(
  initCommon,
  /new THREE\.DataTexture\([\s\S]*?resolution \* R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS,\s*resolution \* Math\.ceil\(patchCount \/ R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS\),\s*THREE\.RGBAFormat/,
  'runtime atlas must be packed as a 2D grid instead of one horizontal strip'
);

console.log('R7-3.10 beam-column dedicated hybrid contract passed');
