import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

const largeFacePackages = [
	['floor', 'docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json', 'loadR7310C1FullRoomDiffuseRuntimePackage', 'loadR7310C1NorthWallDiffuseRuntimePackage'],
	['north wall', 'docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json', 'loadR7310C1NorthWallDiffuseRuntimePackage', 'loadR7310C1EastWallDiffuseRuntimePackage'],
	['east wall', 'docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json', 'loadR7310C1EastWallDiffuseRuntimePackage', 'loadR7310C1NorthWallWardrobeDiffuseRuntimePackage'],
	['west wall', 'docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json', 'loadR7310C1WestWallDiffuseRuntimePackage', 'loadR7310C1SouthWallDiffuseRuntimePackage'],
	['south wall', 'docs/data/r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json', 'loadR7310C1SouthWallDiffuseRuntimePackage', 'loadR7310C1CeilingDiffuseRuntimePackage'],
	['ceiling', 'docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json', 'loadR7310C1CeilingDiffuseRuntimePackage', 'loadR7310C1StructuralDiffuseRuntimePackage']
];

function loaderBlock(functionName, nextFunctionName)
{
	const start = initCommon.indexOf(`async function ${functionName}`);
	const end = initCommon.indexOf(`async function ${nextFunctionName}`);
	assert.ok(start >= 0, `${functionName} must exist`);
	assert.ok(end > start, `${functionName} must end before ${nextFunctionName}`);
	return initCommon.slice(start, end);
}

for (const [label, pointerPath, functionName, nextFunctionName] of largeFacePackages)
{
	const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
	assert.ok(pointer.requestedSamples >= 1000, `${label} requestedSamples must be at least 1000`);
	const block = loaderBlock(functionName, nextFunctionName);
	assert.doesNotMatch(block, /requestedSamples\s*!==\s*1000/, `${functionName} must accept 10000spp packages`);
	assert.match(block, /requestedSamples\s*<\s*1000/, `${functionName} must keep a minimum 1000spp guard`);
}

console.log('R7-3.10 large-face runtime samples contract passed');
