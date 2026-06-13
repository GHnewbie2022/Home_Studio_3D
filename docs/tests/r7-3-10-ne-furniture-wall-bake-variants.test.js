const assert = require('node:assert/strict');
const fs = require('node:fs');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertPointerContract(filePath, expected) {
    assert.ok(fs.existsSync(filePath), `${filePath} missing`);
    const pointer = readJson(filePath);
    const manifest = readJson(`${pointer.packageDir}/${pointer.artifacts.manifest}`);
    assert.equal(pointer.northeastFurnitureMode, expected.mode, `${filePath} furniture mode`);
    assert.equal(manifest.northeastFurnitureMode, expected.mode, `${pointer.packageDir}/manifest.json furniture mode`);
    assert.equal(pointer.runtimeScope, expected.runtimeScope, `${filePath} runtime scope`);
    assert.equal(pointer.runtimeArchitecture, expected.runtimeArchitecture, `${filePath} runtime architecture`);
    assert.equal(pointer.runtimeAtlasSlot, expected.runtimeAtlasSlot, `${filePath} atlas slot`);
    assert.equal(pointer.targetId, expected.targetId, `${filePath} target id`);
    assert.ok(pointer.requestedSamples >= 1000, `${filePath} samples`);
    assert.equal(pointer.targetAtlasResolution, 1024, `${filePath} atlas resolution`);
    assert.equal(pointer.diffuseOnly, true, `${filePath} diffuse only`);
    assert.equal(pointer.upscaled, false, `${filePath} upscaled`);
    assert.equal(pointer.bakedRadianceKind, 'indirect_diffuse_radiance', `${filePath} radiance kind`);
    assert.equal(pointer.directLightAlreadyIncluded, false, `${filePath} direct-light flag`);
    assert.equal(pointer.addDirectLightAfterBakeLookup, true, `${filePath} live direct-light flag`);
    assert.equal(pointer.validation && pointer.validation.status, 'pass', `${filePath} validation status`);
}

assert.ok(
    homeStudio.includes('window.setR7310C1NortheastFurnitureRuntimeMode(c2NortheastFurnitureMode)'),
    'C2 furniture toggle must notify the wall-bake runtime variant switch'
);

assert.ok(
    initCommon.includes("const R7310_C1_NORTH_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json';"),
    'north wall wardrobe pointer URL missing'
);
assert.ok(
    initCommon.includes("const R7310_C1_EAST_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-wall-wardrobe-full-room-diffuse-runtime-package.json';"),
    'east wall wardrobe pointer URL missing'
);
assert.ok(
    initCommon.includes("const R7310_C1_EAST_WALL_BEAM_SHADOW_WARDROBE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-package.json';"),
    'east wall beam shadow wardrobe pointer URL missing'
);
assert.ok(initCommon.includes("let r7310C1NortheastFurnitureRuntimeMode = 'bed';"));
assert.ok(initCommon.includes('window.setR7310C1NortheastFurnitureRuntimeMode = function(mode)'));
assert.ok(initCommon.includes('r7310C1NorthWallWardrobeDiffuseRuntimeTexture'));
assert.ok(initCommon.includes('r7310C1EastWallWardrobeDiffuseRuntimeTexture'));
assert.ok(initCommon.includes('r7310C1EastWallBeamShadowWardrobeRuntimeTexture'));
assert.ok(initCommon.includes('window.loadR7310C1EastWallBeamShadowWardrobeRuntimePackage'));
assert.ok(initCommon.includes("r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'"));
assert.ok(initCommon.includes('northeastFurnitureRuntimeMode: r7310C1NortheastFurnitureRuntimeMode'));
assert.ok(initCommon.includes('eastWallBeamShadowFurnitureVariant'));
assert.ok(initCommon.includes('function resolveR7310C1NorthWallRuntimePackageUrlForMode(mode)'));
assert.ok(initCommon.includes("new URLSearchParams(location.search).get('northWallPackage')"));
assert.ok(initCommon.includes("search.get('northWallBedPackage')"));
assert.ok(initCommon.includes("search.get('northWallWardrobePackage')"));
assert.ok(initCommon.includes('resolveR7310C1NorthWallRuntimePackageUrlForMode(mode)'));
assert.ok(initCommon.includes("var pointerUrl = resolveR7310C1NorthWallRuntimePackageUrlForMode('bed');"));
assert.ok(initCommon.includes('fetch(resolveR7310C1NorthWallRuntimePackageUrlForMode(\'wardrobe\')'));

assert.ok(runner.includes("r7310NeFurniture: 'bed'"));
assert.ok(runner.includes("neFurnitureRuntimeTest: false"));
assert.ok(runner.includes("--r7310-ne-furniture="));
assert.ok(runner.includes("--r7310-ne-furniture-runtime-test"));
assert.ok(runner.includes("northeastFurnitureMode: '${args.r7310NeFurniture}'"));
assert.ok(runner.includes("version: 'r7-3-10-c1-ne-furniture-runtime'"));
assert.ok(runner.includes("north-wall-wardrobe-door-hole-1024px-1000spp"));
assert.ok(runner.includes("east-wall-wardrobe-1024px-1000spp"));
assert.ok(runner.includes("east-wall-beam-shadow-wardrobe-1024px-1000spp"));
assert.ok(runner.includes('r7310PointerPathForSurface(surfaceName, northeastFurnitureMode'));
assert.ok(runner.includes('r7310FormalPackageDirForSurface(surfaceName, northeastFurnitureMode'));

assertPointerContract('docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json', {
    mode: 'bed',
    runtimeScope: 'c1_north_wall_first_hit_hybrid',
    runtimeArchitecture: 'single_full_north_wall_first_hit_hybrid',
    runtimeAtlasSlot: 1,
    targetId: 1002
});
assertPointerContract('docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json', {
    mode: 'bed',
    runtimeScope: 'c1_east_wall_first_hit_hybrid',
    runtimeArchitecture: 'single_full_east_wall_first_hit_hybrid',
    runtimeAtlasSlot: 2,
    targetId: 1003
});
assertPointerContract('docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json', {
    mode: 'wardrobe',
    runtimeScope: 'c1_north_wall_first_hit_hybrid',
    runtimeArchitecture: 'single_full_north_wall_first_hit_hybrid',
    runtimeAtlasSlot: 1,
    targetId: 1002
});
assertPointerContract('docs/data/r7-3-10-c1-east-wall-wardrobe-full-room-diffuse-runtime-package.json', {
    mode: 'wardrobe',
    runtimeScope: 'c1_east_wall_first_hit_hybrid',
    runtimeArchitecture: 'single_full_east_wall_first_hit_hybrid',
    runtimeAtlasSlot: 2,
    targetId: 1003
});
assertPointerContract('docs/data/r7-3-10-c1-east-wall-beam-shadow-runtime-package.json', {
    mode: 'bed',
    runtimeScope: 'c1_east_wall_beam_shadow_diffuse_short_circuit',
    runtimeArchitecture: 'single_east_wall_beam_shadow_short_circuit',
    runtimeAtlasSlot: 10,
    targetId: 1011
});
assertPointerContract('docs/data/r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-package.json', {
    mode: 'wardrobe',
    runtimeScope: 'c1_east_wall_beam_shadow_diffuse_short_circuit',
    runtimeArchitecture: 'single_east_wall_beam_shadow_short_circuit',
    runtimeAtlasSlot: 10,
    targetId: 1011
});

console.log('R7-3.10 northeast furniture wall bake variants contract passed');
