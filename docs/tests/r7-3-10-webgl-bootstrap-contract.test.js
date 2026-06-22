#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

function sliceFunction(source, name) {
	const start = source.indexOf('function ' + name + '(');
	assert.notEqual(start, -1, `${name} must exist`);
	const rest = source.slice(start + 1);
	const nextMatch = rest.match(/\n(?:async\s+)?function\s+/);
	const next = nextMatch ? start + 1 + nextMatch.index : -1;
	return source.slice(start, next === -1 ? source.length : next);
}

test('bootstrap reports WebGL2 creation failure before constructing the renderer', () => {
	assert.match(initCommon, /function handleHomeStudioWebGLUnavailable\(/);
	const initThree = sliceFunction(initCommon, 'initTHREEjs');
	assert.match(initThree, /var\s+webgl2Context\s*=/);
	assert.match(initThree, /webgl2Context\s*=\s*canvas\.getContext\('webgl2'\)/);
	assert.match(initThree, /if\s*\(\s*!webgl2Context\s*\)[\s\S]{0,120}handleHomeStudioWebGLUnavailable/);
	assert.match(initThree, /if\s*\(\s*!webgl2Context\s*\)[\s\S]{0,160}return/);
	assert.match(initThree, /new THREE\.WebGLRenderer\(\{\s*canvas:\s*canvas,\s*context:\s*webgl2Context\s*\}\)/);
});

test('bootstrap failure leaves a readable state report and stops resize cascades', () => {
	const handler = sliceFunction(initCommon, 'handleHomeStudioWebGLUnavailable');
	assert.match(handler, /r7310HomeStudioWebGLUnavailable\s*=\s*true/);
	assert.match(handler, /window\.reportHomeStudioWebGLBootstrapState/);
	assert.match(handler, /setHomeStudioWebGLBootstrapMessage\(/);
	const resize = sliceFunction(initCommon, 'onWindowResize');
	assert.match(resize, /if\s*\(\s*!renderer\s*\|\|\s*!context\s*\|\|\s*!pathTracingUniforms[\s\S]{0,80}return/);
});

test('WebGL2 context unavailable schedules bootstrap retry before final failure', () => {
	assert.match(initCommon, /function scheduleHomeStudioWebGLBootstrapRetry\(/);
	assert.match(initCommon, /window\.retryHomeStudioWebGLBootstrap/);
	assert.match(initCommon, /R7310_HOME_STUDIO_WEBGL_BOOTSTRAP_MAX_RETRIES/);
	const initThree = sliceFunction(initCommon, 'initTHREEjs');
	assert.match(initThree, /scheduleHomeStudioWebGLBootstrapRetry\('webgl2_context_unavailable'/);
	assert.match(initThree, /handleHomeStudioWebGLUnavailable\('webgl2_context_unavailable'/);
	const handler = sliceFunction(initCommon, 'handleHomeStudioWebGLUnavailable');
	assert.match(handler, /probeHomeStudioWebGLAvailability\(\)/);
	assert.match(handler, /retryCount:\s*r7310HomeStudioWebGLBootstrapRetryCount/);
});

test('animation loop stays idle while WebGL bootstrap is unavailable', () => {
	const schedule = sliceFunction(initCommon, 'scheduleHomeStudioAnimationFrame');
	assert.match(schedule, /r7310HomeStudioWebGLUnavailable/);
	assert.match(schedule, /!renderer/);
	assert.match(schedule, /!context/);
	assert.match(schedule, /!clockTimer/);
	const animate = sliceFunction(initCommon, 'animate');
	assert.match(animate, /r7310HomeStudioWebGLUnavailable/);
	assert.match(animate, /!renderer\s*\|\|\s*!context\s*\|\|\s*!clockTimer/);
});

test('restored WebGL context reloads once instead of resuming with stale GPU resources', () => {
	const restoreStart = initCommon.indexOf("glCanvas.addEventListener('webglcontextrestored'");
	assert.notEqual(restoreStart, -1, 'context restored handler must exist');
	const restoreHandler = initCommon.slice(restoreStart, restoreStart + 1800);
	assert.match(restoreHandler, /r7310HomeStudioContextRestoredCount\s*\+=\s*1/);
	assert.match(restoreHandler, /alreadyReloadedAfterRestore/);
	assert.match(restoreHandler, /if\s*\(\s*r7310HomeStudioContextRestoredCount\s*===\s*1\s*&&\s*!alreadyReloadedAfterRestore\s*\)/);
	assert.match(restoreHandler, /R7310_HOME_STUDIO_CONTEXT_RESTORE_RELOAD_KEY/);
	assert.match(restoreHandler, /sessionStorage\.setItem/);
	assert.match(restoreHandler, /location\.reload\(\)/);
	assert.doesNotMatch(restoreHandler, /scheduleHomeStudioAnimationFrame\(\)/);
	assert.doesNotMatch(restoreHandler, /r7310HomeStudioContextLostOverlayEl\.style\.display\s*=\s*'none'/);
});
