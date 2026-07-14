import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

const inventory = [
  { key: 'c1FloorBatch', constName: 'FLOOR', loaderName: 'FullRoomDiffuse', captureName: 'FloorDiffuse', reportName: 'FloorDiffuse', surfaceName: 'c1_floor_full_room', cliName: 'floor', targetId: 1001, slot: 0, pointer: 'docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json' },
  { key: 'c1NorthWallBatch', constName: 'NORTH_WALL', loaderName: 'NorthWallDiffuse', captureName: 'NorthWallDiffuse', reportName: 'NorthWallDiffuse', surfaceName: 'c1_north_wall', cliName: 'north-wall', targetId: 1002, slot: 1, pointer: 'docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json' },
  { key: 'c1EastWallBatch', constName: 'EAST_WALL', loaderName: 'EastWallDiffuse', captureName: 'EastWallDiffuse', reportName: 'EastWallDiffuse', surfaceName: 'c1_east_wall', cliName: 'east-wall', targetId: 1003, slot: 2, pointer: 'docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json' },
  { key: 'c1WestWallBatch', constName: 'WEST_WALL', loaderName: 'WestWallDiffuse', captureName: 'WestWallDiffuse', reportName: 'WestWallDiffuse', surfaceName: 'c1_west_wall', cliName: 'west-wall', targetId: 1004, slot: 3, pointer: 'docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json' },
  { key: 'c1SouthWallBatch', constName: 'SOUTH_WALL', loaderName: 'SouthWallDiffuse', captureName: 'SouthWallDiffuse', reportName: 'SouthWallDiffuse', surfaceName: 'c1_south_wall', cliName: 'south-wall', targetId: 1005, slot: 4, pointer: 'docs/data/r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json' },
  { key: 'c1CeilingBatch', constName: 'CEILING', loaderName: 'CeilingDiffuse', captureName: 'CeilingDiffuse', reportName: 'CeilingDiffuse', surfaceName: 'c1_ceiling', cliName: 'ceiling', targetId: 1006, slot: 5, pointer: 'docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json' },
  { key: 'c1StructuralBeamColumnBatch', constName: 'STRUCTURAL', loaderName: 'StructuralDiffuse', captureName: 'StructuralDiffuse', reportName: 'StructuralDiffuse', surfaceName: 'c1_structural_beams_columns', cliName: 'structural-beams-columns', targetId: 1007, slot: 6, pointer: 'docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json' },
  { key: 'c1SeColumnNorthShadowBatch', constName: 'SE_COLUMN_NORTH_SHADOW', loaderName: 'SeColumnNorthShadow', captureName: 'SeColumnNorthShadow', reportName: 'SeColumnNorthShadow', surfaceName: 'c1_se_column_north_shadow', cliName: 'se-column-north-shadow', targetId: 1008, slot: 7, pointer: 'docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json' },
  { key: 'c1SeColumnWestShadowBatch', constName: 'SE_COLUMN_WEST_SHADOW', loaderName: 'SeColumnWestShadow', captureName: 'SeColumnWestShadow', reportName: 'SeColumnWestShadow', surfaceName: 'c1_se_column_west_shadow', cliName: 'se-column-west-shadow', targetId: 1009, slot: 8, pointer: 'docs/data/r7-3-10-c1-se-column-west-shadow-runtime-package.json' },
  { key: 'c1SouthWallAcShadowBatch', constName: 'SOUTH_WALL_AC_SHADOW', loaderName: 'SouthWallAcShadow', captureName: 'SouthWallAcShadow', reportName: 'SouthWallAcShadow', surfaceName: 'c1_south_wall_ac_shadow', cliName: 'south-wall-ac-shadow', targetId: 1010, slot: 9, pointer: 'docs/data/r7-3-10-c1-south-wall-ac-shadow-runtime-package.json' },
  { key: 'c1EastWallBeamShadowBatch', constName: 'EAST_WALL_BEAM_SHADOW', loaderName: 'EastWallBeamShadow', captureName: 'EastWallBeamShadow', reportName: 'EastWallBeamShadow', surfaceName: 'c1_east_wall_beam_shadow', cliName: 'east-wall-beam-shadow', targetId: 1011, slot: 10, pointer: 'docs/data/r7-3-10-c1-east-wall-beam-shadow-runtime-package.json' },
  { key: 'c1SwColumnNorthShadowBatch', constName: 'SW_COLUMN_NORTH_SHADOW', loaderName: 'SwColumnNorthShadow', captureName: 'SwColumnNorthShadow', reportName: 'SwColumnNorthShadow', surfaceName: 'c1_sw_column_north_shadow', cliName: 'sw-column-north-shadow', targetId: 1012, slot: 11, pointer: 'docs/data/r7-3-10-c1-sw-column-north-shadow-runtime-package.json' },
  { key: 'c1WestWallBeamShadowBatch', constName: 'WEST_WALL_BEAM_SHADOW', loaderName: 'WestWallBeamShadow', captureName: 'WestWallBeamShadow', reportName: 'WestWallBeamShadow', surfaceName: 'c1_west_wall_beam_shadow', cliName: 'west-wall-beam-shadow', targetId: 1013, slot: 12, pointer: 'docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json' },
  { key: 'c1SwColumnInnerShadowBatch', constName: 'SW_COLUMN_INNER_SHADOW', loaderName: 'SwColumnInnerShadow', captureName: 'SwColumnInnerShadow', reportName: 'SwColumnInnerShadow', surfaceName: 'c1_sw_column_inner_shadow', cliName: 'sw-column-inner-shadow', targetId: 1014, slot: 13, pointer: 'docs/data/r7-3-10-c1-sw-column-inner-shadow-runtime-package.json' },
  { key: 'c1WestBeamInnerShadowBatch', constName: 'WEST_BEAM_INNER_SHADOW', loaderName: 'WestBeamInnerShadow', captureName: 'WestBeamInnerShadow', reportName: 'WestBeamInnerShadow', surfaceName: 'c1_west_beam_inner_shadow', cliName: 'west-beam-inner-shadow', targetId: 1015, slot: 14, pointer: 'docs/data/r7-3-10-c1-west-beam-inner-shadow-runtime-package.json' },
  { key: 'c1WestBeamUnderShadowBatch', constName: 'WEST_BEAM_UNDER_SHADOW', loaderName: 'WestBeamUnderShadow', captureName: 'WestBeamUnderShadow', reportName: 'WestBeamUnderShadow', surfaceName: 'c1_west_beam_under_shadow', cliName: 'west-beam-under-shadow', targetId: 1016, slot: 15, pointer: 'docs/data/r7-3-10-c1-west-beam-under-shadow-runtime-package.json' },
  { key: 'c1EastBeamInnerShadowBatch', constName: 'EAST_BEAM_INNER_SHADOW', loaderName: 'EastBeamInnerShadow', captureName: 'EastBeamInnerShadow', reportName: 'EastBeamInnerShadow', surfaceName: 'c1_east_beam_inner_shadow', cliName: 'east-beam-inner-shadow', targetId: 1017, slot: 16, pointer: 'docs/data/r7-3-10-c1-east-beam-inner-shadow-runtime-package.json' },
  { key: 'c1EastBeamUnderShadowBatch', constName: 'EAST_BEAM_UNDER_SHADOW', loaderName: 'EastBeamUnderShadow', captureName: 'EastBeamUnderShadow', reportName: 'EastBeamUnderShadow', surfaceName: 'c1_east_beam_under_shadow', cliName: 'east-beam-under-shadow', targetId: 1018, slot: 17, pointer: 'docs/data/r7-3-10-c1-east-beam-under-shadow-runtime-package.json' },
  { key: 'c1SouthWindowLeftRevealShadowBatch', constName: 'SOUTH_WINDOW_LEFT_REVEAL_SHADOW', loaderName: 'SouthWindowLeftRevealShadow', captureName: 'SouthWindowLeftRevealShadow', reportName: 'SouthWindowLeftRevealShadow', surfaceName: 'c1_south_window_left_reveal_shadow', cliName: 'south-window-left-reveal-shadow', targetId: 1019, slot: 18, pointer: 'docs/data/r7-3-10-c1-south-window-left-reveal-shadow-runtime-package.json' },
  { key: 'c1SouthWindowRightRevealShadowBatch', constName: 'SOUTH_WINDOW_RIGHT_REVEAL_SHADOW', loaderName: 'SouthWindowRightRevealShadow', captureName: 'SouthWindowRightRevealShadow', reportName: 'SouthWindowRightRevealShadow', surfaceName: 'c1_south_window_right_reveal_shadow', cliName: 'south-window-right-reveal-shadow', targetId: 1020, slot: 19, pointer: 'docs/data/r7-3-10-c1-south-window-right-reveal-shadow-runtime-package.json' },
  { key: 'c1SouthWindowBottomRevealShadowBatch', constName: 'SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW', loaderName: 'SouthWindowBottomRevealShadow', captureName: 'SouthWindowBottomRevealShadow', reportName: 'SouthWindowBottomRevealShadow', surfaceName: 'c1_south_window_bottom_reveal_shadow', cliName: 'south-window-bottom-reveal-shadow', targetId: 1021, slot: 20, pointer: 'docs/data/r7-3-10-c1-south-window-bottom-reveal-shadow-runtime-package.json' },
  { key: 'c1SouthWindowTopRevealShadowBatch', constName: 'SOUTH_WINDOW_TOP_REVEAL_SHADOW', loaderName: 'SouthWindowTopRevealShadow', captureName: 'SouthWindowTopRevealShadow', reportName: 'SouthWindowTopRevealShadow', surfaceName: 'c1_south_window_top_reveal_shadow', cliName: 'south-window-top-reveal-shadow', targetId: 1022, slot: 21, pointer: 'docs/data/r7-3-10-c1-south-window-top-reveal-shadow-runtime-package.json' },
  { key: 'c1IronDoorRevealBatch', constName: 'IRON_DOOR_REVEAL', loaderName: 'IronDoorReveal', captureName: 'IronDoorReveal', reportName: 'IronDoorReveal', surfaceName: 'c1_iron_door_reveal', cliName: 'iron-door-reveal', targetId: 1023, slot: 22, pointer: 'docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json' },
  { key: null, pointerInRunner: false, constName: 'IRON_DOOR_BODY', loaderName: 'IronDoorBody', captureName: 'IronDoorBody', reportName: 'IronDoorBody', surfaceName: 'c1_iron_door_body_diffuse_light_live_specular_probe', cliName: 'iron-door-body', targetId: 230001, slot: 23, pointer: 'docs/data/r7-3-10-c1-iron-door-body-runtime-package.json' },
  { key: null, pointerInRunner: false, constName: 'IRON_DOOR_REFLECTION_PROBE', loaderName: 'IronDoorReflectionProbe', captureName: null, reportName: null, surfaceName: 'c1_iron_door_body_captured_local_reflection_probe', cliName: null, targetId: 230002, slots: [24, 25, 26, 27, 28, 29], pointer: 'docs/data/r7-3-10-c1-iron-door-reflection-probe-runtime-package.json', optionalPointer: true }
];

assert.equal(inventory.length, 25);
assert.equal(new Set(inventory.map((surface) => surface.targetId)).size, inventory.length);
assert.equal(new Set(inventory.map((surface) => surface.surfaceName)).size, inventory.length);
const runtimeSlots = inventory.flatMap((surface) => Array.isArray(surface.slots) ? surface.slots : [surface.slot]);
assert.deepEqual([...new Set(runtimeSlots)].sort((a, b) => a - b), Array.from({ length: 30 }, (_, index) => index));

const combinedSlotBlock = initCommon.match(/function buildR7310C1CombinedDiffuseRuntimeTexture[\s\S]*?var patchCount = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT;/)?.[0] || '';
assert.match(combinedSlotBlock, /var slots = \[[\s\S]*floorPixels[\s\S]*northWallPixels[\s\S]*eastWallPixels[\s\S]*westWallPixels[\s\S]*southWallPixels[\s\S]*ceilingPixels[\s\S]*structuralPixels[\s\S]*seColumnNorthShadowPixels[\s\S]*seColumnWestShadowPixels[\s\S]*southWallAcShadowPixels[\s\S]*eastWallBeamShadowPixels[\s\S]*swColumnNorthShadowPixels[\s\S]*westWallBeamShadowPixels[\s\S]*swColumnInnerShadowPixels[\s\S]*westBeamInnerShadowPixels[\s\S]*westBeamUnderShadowPixels[\s\S]*eastBeamInnerShadowPixels[\s\S]*eastBeamUnderShadowPixels[\s\S]*southWindowLeftRevealShadowPixels[\s\S]*southWindowRightRevealShadowPixels[\s\S]*southWindowBottomRevealShadowPixels[\s\S]*southWindowTopRevealShadowPixels[\s\S]*ironDoorRevealPixels[\s\S]*ironDoorBodyPixels[\s\S]*ironDoorReflectionProbePosX[\s\S]*ironDoorReflectionProbeNegX[\s\S]*ironDoorReflectionProbePosY[\s\S]*ironDoorReflectionProbeNegY[\s\S]*ironDoorReflectionProbePosZ[\s\S]*ironDoorReflectionProbeNegZ[\s\S]*\]/);

for (const surface of inventory) {
  if (surface.key) {
    const batch = contract[surface.key];
    assert.ok(batch, `${surface.key} missing from R7-3.10 contract`);
    assert.equal(batch.targetId, surface.targetId, `${surface.key} targetId drifted`);
    assert.equal(batch.surfaceName, surface.surfaceName, `${surface.key} surfaceName drifted`);
    if ('runtimeAtlasSlot' in batch)
      assert.equal(batch.runtimeAtlasSlot, surface.slot, `${surface.key} runtimeAtlasSlot drifted`);
  }

  assert.match(initCommon, new RegExp(`R7310_C1_${surface.constName}_TARGET_ID\\s*=\\s*${surface.targetId}`));
  assert.match(initCommon, new RegExp(`R7310_C1_${surface.constName}_SURFACE_NAME\\s*=\\s*'${surface.surfaceName}'`));
  assert.match(initCommon, new RegExp(`loadR7310C1${surface.loaderName}RuntimePackage`));
  if (surface.captureName)
    assert.match(initCommon, new RegExp(`captureR7310C1${surface.captureName}Atlas`));
  if (surface.cliName)
  {
    assert.match(runner, new RegExp(`'${surface.cliName}'`), `${surface.cliName} missing from runner allow-list`);
    assert.match(runner, new RegExp(`${surface.cliName}: 'reportR7310C1${surface.reportName}BakeAfterSamples'|'${surface.cliName}': 'reportR7310C1${surface.reportName}BakeAfterSamples'`));
    assert.match(runner, new RegExp(surface.surfaceName));
  }
  if (surface.pointerInRunner !== false)
    assert.match(runner, new RegExp(surface.pointer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  if (surface.pointer)
    assert.equal(fs.existsSync(surface.pointer), true, `${surface.pointer} missing`);
}

assert.match(homeStudio, /uR7310C1RuntimeAtlasPatchCount = \{ value: 30\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_PATCH_COUNT\s*=\s*30/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);
assert.match(initCommon, /runtimeAtlasPatchCount: R7310_C1_RUNTIME_ATLAS_PATCH_COUNT/);
assert.match(homeStudio, /uR7310C1RuntimeAtlasGridColumns = \{ value: 6\.0 \}/);
assert.match(initCommon, /R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS\s*=\s*6/);
assert.match(initCommon, /runtimeAtlasGridRows: Math\.ceil\(R7310_C1_RUNTIME_ATLAS_PATCH_COUNT \/ R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS\)/);
assert.match(shader, /ceil\s*\(\s*patchCount\s*\/\s*columns\s*\)/);

console.log('R7-3.10 bake gap debug-map inventory contract passed');
