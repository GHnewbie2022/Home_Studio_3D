import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/InitCommon.js', 'utf8');

function functionBlock(name, nextName) {
	const startToken = `async function ${name}(`;
	const start = source.indexOf(startToken);
	assert.notEqual(start, -1, `${name} must exist`);
	if (!nextName) return source.slice(start);
	const next = source.indexOf(`async function ${nextName}(`, start + startToken.length);
	assert.notEqual(next, -1, `${nextName} must exist after ${name}`);
	return source.slice(start, next);
}

function catchBlocks(block, label) {
	const matches = Array.from(block.matchAll(/catch \(error\)\s*\{([\s\S]*?)\n\s*\}/g));
	assert.ok(matches.length > 0, `${label} must have a catch block`);
	return matches.map((match) => match[1]);
}

function assertCatchSettles(block, label, stepKey) {
	for (const body of catchBlocks(block, label)) {
		assert.match(
			body,
			new RegExp(`markR7310C1RuntimeLoadingStepComplete\\('${stepKey}'\\)`),
			`${label} catch must settle ${stepKey}`
		);
	}
}

const directLoaders = [
	['loadR7310C1FullRoomDiffuseRuntimePackage', 'loadR7310C1NorthWallDiffuseRuntimePackage', 'floor'],
	['loadR7310C1NorthWallDiffuseRuntimePackage', 'loadR7310C1EastWallDiffuseRuntimePackage', 'northWall'],
	['loadR7310C1EastWallDiffuseRuntimePackage', 'loadR7310C1NorthWallWardrobeDiffuseRuntimePackage', 'eastWall'],
	['loadR7310C1NorthWallWardrobeDiffuseRuntimePackage', 'loadR7310C1EastWallWardrobeDiffuseRuntimePackage', 'northWall'],
	['loadR7310C1EastWallWardrobeDiffuseRuntimePackage', 'loadR7310C1WestWallDiffuseRuntimePackage', 'eastWall'],
	['loadR7310C1WestWallDiffuseRuntimePackage', 'loadR7310C1SouthWallDiffuseRuntimePackage', 'westWall'],
	['loadR7310C1SouthWallDiffuseRuntimePackage', 'loadR7310C1CeilingDiffuseRuntimePackage', 'southWall'],
	['loadR7310C1CeilingDiffuseRuntimePackage', 'loadR7310C1StructuralDiffuseRuntimePackage', 'ceiling'],
	['loadR7310C1StructuralDiffuseRuntimePackage', 'loadR7310C1SeColumnNorthShadowRuntimePackage', 'structural'],
	['loadR7310C1SeColumnNorthShadowRuntimePackage', 'loadR7310C1SeColumnWestShadowRuntimePackage', 'seColumnNorthShadow'],
	['loadR7310C1SeColumnWestShadowRuntimePackage', 'loadR7310C1SouthWallAcShadowRuntimePackage', 'seColumnWestShadow'],
	['loadR7310C1SouthWallAcShadowRuntimePackage', 'loadR7310C1EastWallBeamShadowRuntimePackage', 'southWallAcShadow'],
	['loadR7310C1EastWallBeamShadowRuntimePackage', 'loadR7310C1EastWallBeamShadowWardrobeRuntimePackage', 'eastWallBeamShadow'],
	['loadR7310C1EastWallBeamShadowWardrobeRuntimePackage', 'loadR7310C1SwColumnNorthShadowRuntimePackage', 'eastWallBeamShadow'],
	['loadR7310C1SwColumnNorthShadowRuntimePackage', 'loadR7310C1WestWallBeamShadowRuntimePackage', 'swColumnNorthShadow'],
	['loadR7310C1WestWallBeamShadowRuntimePackage', 'loadR7310C1DedicatedBeamColumnShadowRuntimePackage', 'westWallBeamShadow']
];

for (const [name, nextName, stepKey] of directLoaders) {
	assertCatchSettles(functionBlock(name, nextName), name, stepKey);
}

const genericLoader = functionBlock(
	'loadR7310C1DedicatedBeamColumnShadowRuntimePackage',
	'loadR7310C1SwColumnInnerShadowRuntimePackage'
);

for (const body of catchBlocks(genericLoader, 'loadR7310C1DedicatedBeamColumnShadowRuntimePackage')) {
	assert.match(
		body,
		/markR7310C1RuntimeLoadingStepComplete\(spec\.stepName\)/,
		'generic dedicated loader catch must settle spec.stepName'
	);
}

assert.doesNotMatch(
	source,
	/combined diffuse atlas resolution mismatch/,
	'cross-surface resolution mismatch throws must stay removed; loader settle gate handles failures without deadlock'
);

console.log('R7-3.10 loading settle catch contract passed');
