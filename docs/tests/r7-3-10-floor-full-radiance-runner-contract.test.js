import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const smokeTool = fs.readFileSync('docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const r7310PrepareTools = [
  'docs/tools/r7-3-10-full-east-wall-xatlas-phase2-prepare.py',
  'docs/tools/r7-3-10-full-north-wall-xatlas-phase2-prepare.py',
  'docs/tools/r7-3-10-west-threshold-front-xatlas-prepare.py',
  'docs/tools/r7-3-10-full-ceiling-xatlas-phase2-prepare.py',
  'docs/tools/r7-3-10-full-north-wall-xatlas-dry-run.py',
  'docs/tools/r7-3-10-full-west-wall-xatlas-phase2-prepare.py',
  'docs/tools/r7-3-10-west-threshold-top-xatlas-prepare.py'
];

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const rest = source.slice(start + 1);
  const nextMatch = rest.match(/\n(?:async\s+)?function\s+/);
  const next = nextMatch ? start + 1 + nextMatch.index : -1;
  return source.slice(start, next === -1 ? source.length : next);
}

const floorAlphaExclusionCheck = sliceFunction(runner, 'floorAlphaExclusionCheck');

assert.match(
  runner,
  /function r7310WorkPath\(\.\.\.segments\)\s*\{[\s\S]{0,160}assets[\s\S]{0,160}runtime[\s\S]{0,160}r7-3-10[\s\S]{0,160}work/,
  'runner temporary work output must go through assets/runtime/r7-3-10/work instead of .omc'
);
assert.doesNotMatch(
  runner,
  /path\.join\(repoRoot,\s*['"]\.omc['"]/,
  'runner must not create new .omc output folders'
);
for (const toolPath of r7310PrepareTools) {
  const toolSource = fs.readFileSync(toolPath, 'utf8');
  assert.match(
    toolSource,
    /DEFAULT_OUT_ROOT = REPO \/ "assets\/runtime\/r7-3-10\/work\/r7-3-10-/,
    `${toolPath} must write R7-3.10 generated work under assets/runtime/r7-3-10/work`
  );
  assert.doesNotMatch(
    toolSource,
    /DEFAULT_OUT_ROOT = REPO \/ "\.omc\//,
    `${toolPath} must not create .omc output folders`
  );
}
assert.match(
  runner,
  /fullRadianceBake:\s*false/,
  'runner must keep a dedicated full-radiance default for non-xatlas full-room surfaces'
);
assert.match(
  runner,
  /arg === '--r7310-full-radiance-bake'/,
  'runner must expose --r7310-full-radiance-bake for full-floor-xatlas'
);
assert.match(
  runner,
  /out\.fullRadianceBake && !out\.fullRoomDiffuseBake/,
  '--r7310-full-radiance-bake must stay scoped to --r7310-full-room-diffuse-bake'
);
assert.match(
  runner,
  /fullRadianceBake:\s*\$\{args\.fullRadianceBake \? 'true' : 'false'\}/,
  'runner must pass fullRadianceBake into the browser capture helper'
);
assert.match(
  initCommon,
  /uR7310C1XatlasBakeFullRadianceMode\.value\s*=\s*\(useXatlasFullRadianceBake\s*\|\|\s*useFullRadianceBakeMode\)\s*\?\s*1\.0\s*:\s*0\.0/,
  'full-floor-xatlas fullRadianceBake must enable the shader full-radiance guard so glossy ceiling-light images cannot be baked into the floor'
);
assert.match(
  runner,
  /out\.r7310Surface === 'full-floor-xatlas' && out\.r7310SeparatedIrradianceBake/,
  'full-floor-xatlas must reject the separated irradiance bake flag because the formal floor package is albedo-in'
);
assert.match(
  runner,
  /floorCamera:\s*args\.cameraState \? false : \(args\.r7310Surface === 'floor' \|\| args\.r7310Surface === 'full-floor-xatlas'\)/,
  'runner must give floor bake a deterministic validation camera when no explicit cameraState is supplied'
);
assert.match(
  initCommon,
  /window\.waitForR738BakeSceneRenderable\s*=\s*async function/,
  'bake capture must expose a render-ready wait helper'
);
assert.match(
  runner,
  /await window\.waitForR738BakeSceneRenderable\(\$\{args\.timeoutMs\},\s*\{/,
  'runner must wait for a non-black renderable scene before capture helper starts'
);
assert.match(
  runner,
  /Home_Studio\.html\?atlasMaster=raw&verify=r7-3-8-c1-1000spp-bake-capture/,
  'formal bake runner must open the raw room bootstrap before capture'
);
assert.match(
  shader,
  /if\s*\(\s*uR738C1BakeDiffuseOnlyMode\s*>\s*0\.5\s*&&\s*r7310FloorIndirectBakeFirstHit\s*&&\s*willNeedDiffuseBounceRay\s*==\s*TRUE\s*\)/,
  'full-radiance floor bake must not use the floor indirect-only first-hit path'
);
assert.match(
  shader,
  /bool\s+r7310FloorLiveSpecularActive\s*=[\s\S]{0,220}uR7310C1XatlasBakeFullRadianceMode\s*<\s*0\.5/,
  'full-radiance floor bake must disable the LIVE glossy/specular floor branch during capture'
);
assert.match(
  shader,
  /bool\s+r7310FloorFullRadianceBakeFirstHit\s*=\s*false/,
  'floor full-radiance bake must keep a loop-visible first-hit flag'
);
assert.match(
  shader,
  /r7310FloorFullRadianceBakeFirstHit\s*=[\s\S]{0,420}uR738C1BakePatchId\s*==\s*1001[\s\S]{0,420}uR7310C1XatlasBakeFullRadianceMode\s*>\s*0\.5[\s\S]{0,420}cloudVisibleSurfaceIsFloor\([\s\S]{0,520}if\s*\(\s*r7310FloorFullRadianceBakeFirstHit\s*\)[\s\S]{0,260}bounceIsSpecular\s*=\s*FALSE/,
  'floor full-radiance bake must treat the first floor hit as diffuse so ceiling-lamp images cannot be baked into the floor'
);
assert.match(
  shader,
  /if\s*\(\s*isFloor\s*&&\s*!r7310FloorFullRadianceBakeFirstHit\s*&&\s*r7310FloorLiveSpecularActive\s*&&\s*r7310FloorLiveSpecularAllowed\s*&&\s*!r738DiffuseOnlyActive\s*&&\s*!r739ReferenceDisabled\s*&&\s*r739EffectiveFloorRoughness\s*<\s*0\.999\s*\)/,
  'runtime floor glossy/specular branch must be skipped for floor full-radiance bake first hits'
);
assert.match(
  shader,
  /if\s*\(\s*!r7310FloorFullRadianceBakeFirstHit\s*&&\s*!r739ReferenceDisabled\s*&&\s*rand\(\)\s*<\s*hitMetalness\s*\)/,
  'floor full-radiance bake first hits must skip the generic metal/specular branch and continue into diffuse lighting'
);
assert.match(
  shader,
  /bool\s+r7310FloorLiveSpecularPageValid\s*=[\s\S]{0,520}r7310C1XatlasRuntimeSampleValidLinearFloorPage\([\s\S]{0,320}r7310FloorLiveSpecularAllowed\s*=\s*r7310FloorLiveSpecularPageMapped\s*&&\s*r7310FloorLiveSpecularPageValid/,
  'runtime floor LIVE specular must respect the floor page alpha mask before reflecting the ceiling light'
);
assert.match(
  shader,
  /if\s*\(\s*isFloor\s*&&\s*!r7310FloorFullRadianceBakeFirstHit\s*&&\s*r7310FloorLiveSpecularActive\s*&&\s*r7310FloorLiveSpecularAllowed\s*&&\s*!r738DiffuseOnlyActive\s*&&\s*!r739ReferenceDisabled\s*&&\s*r739EffectiveFloorRoughness\s*<\s*0\.999\s*\)/,
  'runtime floor glossy/specular branch must still be disabled in xatlas floor footprint holes'
);

assert.match(
  initCommon,
  /var fullRadianceProbe = spec\.fullRadianceProbe === true \|\| options\.fullRadianceBake === true;/,
  'dedicated surface reports must treat fullRadianceBake as full-radiance output'
);
assert.match(
  initCommon,
  /fullRadianceBake:\s*options\.fullRadianceBake === true/,
  'dedicated surface atlas capture must receive fullRadianceBake'
);
assert.match(
  initCommon,
  /bakedRadianceKind:\s*fullRadianceProbe \? 'full_diffuse_radiance' : \(spec\.bakedRadianceKind \|\| 'indirect_diffuse_radiance'\)/,
  'dedicated reports must label fullRadianceBake as full_diffuse_radiance'
);
assert.match(
  initCommon,
  /directLightAlreadyIncluded:\s*fullRadianceProbe \|\| spec\.directLightAlreadyIncluded === true/,
  'dedicated reports must mark direct light included for fullRadianceBake'
);
assert.match(
  initCommon,
  /addDirectLightAfterBakeLookup:\s*fullRadianceProbe \? false :/,
  'dedicated reports must stop adding direct light again for fullRadianceBake'
);
assert.match(
  initCommon,
  /var reportMultiplyAlbedoAfterBakeLookup = options\.separatedIrradianceBake === true \|\| spec\.multiplyAlbedoAfterBakeLookup === true;/,
  'dedicated reports must mark separated bake output as albedo-free runtime radiance'
);
assert.match(
  initCommon,
  /bakeAlbedoFree:\s*reportMultiplyAlbedoAfterBakeLookup/,
  'dedicated reports must carry bakeAlbedoFree when runtime will multiply albedo'
);
assert.match(
  initCommon,
  /surfaceName:\s*'floor_open'[\s\S]{0,420}multiplyAlbedoAfterBakeLookup:\s*false[\s\S]{0,220}liveSpecularReflection:\s*true/,
  'floor full-radiance reports must be albedo-in while keeping floor specular reflection on the LIVE path'
);
assert.match(
  runner,
  /bakeAlbedoFree:\s*report\.bakeAlbedoFree === true/,
  'package manifest must preserve bakeAlbedoFree'
);
assert.doesNotMatch(
  floorAlphaExclusionCheck,
  /open-floor neighbour[\s\S]{0,260}luma=0/,
  'floor footprint neighbour validation must check alpha only, because valid open floor can be dark under furniture'
);
assert.match(
  floorAlphaExclusionCheck,
  /room-centre open floor[\s\S]{0,220}luma=0/,
  'floor validation must still keep a room-centre luma guard so a black floor package cannot pass'
);

assert.match(
  smokeTool,
  /floorProbeMode === 'bake-force-albedo'/,
  'floor smoke probe must expose a mode that forces floor albedo multiplication'
);
assert.match(
  smokeTool,
  /r7310C1XatlasRuntimeFullFloorSeparatedAlbedo = true/,
  'floor smoke probe must set the floor-specific separated albedo state when forcing albedo'
);
assert.match(
  smokeTool,
  /uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo\.value = 1\.0/,
  'floor smoke probe must set the floor-specific separated albedo uniform when forcing albedo'
);

console.log('R7-3.10 floor full-radiance runner contract passed');
