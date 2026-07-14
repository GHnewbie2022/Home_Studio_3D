import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const homeStudioHtml = fs.readFileSync('Home_Studio.html', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const smokeTool = fs.readFileSync('docs/tools/r7-3-10-xatlas-shader-compile-smoke.mjs', 'utf8');

function functionBody(source, functionName)
{
	let start = source.indexOf(`function ${functionName}(`);
	if (start < 0)
		start = source.indexOf(functionName);
	assert.ok(start >= 0, `Missing ${functionName}`);
	const brace = source.indexOf('{', start);
	assert.ok(brace > start, `Missing body for ${functionName}`);
	let depth = 0;
	for (let i = brace; i < source.length; i += 1)
	{
		if (source[i] === '{') depth += 1;
		else if (source[i] === '}')
		{
			depth -= 1;
			if (depth === 0) return source.slice(brace + 1, i);
		}
	}
	throw new Error(`Unclosed body for ${functionName}`);
}

assert.match(homeStudio, /if \(type === 8\) return \{ roughness: 0\.3,\s*metalness: 1\.0 \};/);
assert.match(homeStudio, /pathTracingUniforms\.uIronDoorRoughnessScale\s*=\s*\{\s*value:\s*0\.25\s*\}/);
assert.match(homeStudio, /pathTracingUniforms\.uIronDoorMetalnessScale\s*=\s*\{\s*value:\s*0\.85\s*\}/);
assert.match(homeStudio, /demoFragmentShaderFileName\s*=\s*'Home_Studio_Fragment\.glsl\?v=r7310-iron-door-fix7-scale-restore-v1'/);

assert.match(initCommon, /const R7310_C1_IRON_DOOR_RUNTIME_PLANAR_RETIREMENT_REASON\s*=\s*'retired_baking_mainline_keep_fix7_live'/);
assert.match(initCommon, /let r7310C1IronDoorRuntimePlanarReflectionMode\s*=\s*0/);
assert.match(initCommon, /let r7310C1IronDoorRuntimePlanarReflectionReady\s*=\s*false/);

const availableBody = functionBody(initCommon, 'r7310C1IronDoorRuntimePlanarReflectionAvailable');
assert.match(availableBody, /return false/);

const modeLabelBody = functionBody(initCommon, 'r7310C1IronDoorRuntimePlanarReflectionModeLabel');
assert.match(modeLabelBody, /R7310_C1_IRON_DOOR_RUNTIME_PLANAR_RETIREMENT_REASON/);

const setModeBody = functionBody(initCommon, 'window.setR7310C1IronDoorRuntimePlanarReflectionMode');
assert.match(setModeBody, /R7310_C1_IRON_DOOR_RUNTIME_PLANAR_RETIREMENT_REASON/);
assert.match(setModeBody, /r7310C1IronDoorRuntimePlanarReflectionMode\s*=\s*0/);
assert.match(setModeBody, /r7310C1IronDoorRuntimePlanarReflectionReady\s*=\s*false/);
assert.doesNotMatch(setModeBody, /ensureR7310C1IronDoorRuntimePlanarReflectionRenderer\(\)/);
assert.doesNotMatch(setModeBody, /renderR7310C1IronDoorRuntimePlanarReflectionTexture\(\)/);

const cycleBody = functionBody(initCommon, 'window.cycleR7310C1IronDoorReflectionRuntimeMode');
assert.match(cycleBody, /setR7310C1IronDoorRuntimePlanarReflectionMode\(0\)/);
assert.doesNotMatch(cycleBody, /r7310C1IronDoorRuntimePlanarReflectionMode \+ 1/);

const sourceDisplayBody = functionBody(initCommon, 'window.renderR7310C1IronDoorRuntimePlanarReflectionSourceToScreen');
assert.match(sourceDisplayBody, /R7310_C1_IRON_DOOR_RUNTIME_PLANAR_RETIREMENT_REASON/);
assert.match(sourceDisplayBody, /return false/);
assert.doesNotMatch(sourceDisplayBody, /renderR7310C1IronDoorRuntimePlanarReflectionTexture\(\)/);
assert.doesNotMatch(sourceDisplayBody, /renderR7310C1IronDoorRuntimePlanarReflectionTextureToScreen\(\)/);

const reviewDeepLinkBody = functionBody(initCommon, 'scheduleR7310C1IronDoorReflectionReviewDeepLink');
assert.match(reviewDeepLinkBody, /retiredRuntimePlanarLinkRequested/);
assert.match(reviewDeepLinkBody, /reviewMode = 'live'/);
assert.doesNotMatch(reviewDeepLinkBody, /reviewMode = 'runtime-planar'/);
assert.doesNotMatch(reviewDeepLinkBody, /window\.setR7310C1IronDoorRuntimePlanarReflectionMode\('runtime-planar'\)/);

assert.match(initCommon, /ironDoorRuntimePlanarReflectionRetirementReason:\s*R7310_C1_IRON_DOOR_RUNTIME_PLANAR_RETIREMENT_REASON/);
assert.match(initCommon, /ironDoorRuntimePlanarReflectionSourceUpdatePolicy:\s*'retired_formal_route_keeps_fix7_live'/);
assert.match(initCommon, /ironDoorReflectionCurrentMode:[\s\S]*'live_reference'/);

assert.doesNotMatch(homeStudioHtml, /btn-r7310-iron-door-reflection-mode/);
assert.doesNotMatch(homeStudio, /btn-r7310-iron-door-reflection-mode/);
assert.doesNotMatch(homeStudio, /光BAKE\+LIVE反射/);
assert.doesNotMatch(homeStudio, /RUNTIME PLANAR反射/);
assert.match(homeStudioHtml, /js\/PathTracingCommon\.js\?v=r7310-r42a-2-param-p2/);
assert.match(homeStudioHtml, /js\/InitCommon\.js\?v=r7310-iron-door-fix7-scale-restore-v1/);
assert.match(homeStudioHtml, /js\/Home_Studio\.js\?v=r7310-iron-door-fix7-scale-restore-v1/);
assert.doesNotMatch(homeStudioHtml, /r7310-iron-door-runtime-planar-ucampos-v1/);
assert.doesNotMatch(homeStudioHtml, /r7310-iron-door-canonical-raster-v3/);

const calculateRadianceBody = functionBody(shader, 'CalculateRadiance');
assert.doesNotMatch(calculateRadianceBody, /r7310C1IronDoorRuntimePlanarReflectionClipSeed/);
assert.doesNotMatch(calculateRadianceBody, /r7310RuntimePlanarReflectionSeededFirstVisible/);

const ironDoorBranch = shader.slice(shader.indexOf('if (hitType == IRON_DOOR)'));
assert.ok(ironDoorBranch.length > 0, 'Missing iron door branch');
assert.doesNotMatch(ironDoorBranch, /r7310C1IronDoorRuntimePlanarReflectionMaterialRoughness\(hitRoughness,\s*ironR\)/);

assert.match(smokeTool, /retired_baking_mainline_keep_fix7_live/);
assert.match(smokeTool, /throw new Error\('iron door runtime planar smoke retired/);
assert.doesNotMatch(smokeTool, /ironDoorRuntimePlanarSourceModeReady/);
assert.doesNotMatch(smokeTool, /renderR7310C1IronDoorRuntimePlanarReflectionSourceToScreen/);

assert.match(shader, /uR7310C1IronDoorRuntimePlanarReflectionMode/);
assert.match(shader, /uR7310C1IronDoorRuntimePlanarReflectionReady/);

console.log('R7-3.10 iron door runtime planar retired contract passed');
