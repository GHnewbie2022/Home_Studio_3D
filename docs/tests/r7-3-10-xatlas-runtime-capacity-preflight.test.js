#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '../..');
const TOOL_URL = pathToFileURL(path.join(ROOT, 'docs/tools/r7-3-10-xatlas-runtime-capacity-preflight.mjs')).href;
const CONTRACT_PATH = path.join(ROOT, 'docs/data/r7-3-10-xatlas-runtime-capacity-contract.json');

async function loadTool()
{
	return import(TOOL_URL);
}

test('current formal pages and exact deployed allocation pass capacity preflight', async () => {
	const { buildCapacityReport } = await loadTool();
	const report = buildCapacityReport();
	assert.equal(report.status, 'pass');
	assert.equal(report.formalPages.length, 15);
	assert.ok(report.formalPages.every((page) => page.status === 'pass'));
	assert.equal(report.deployed.width, 6623);
	assert.equal(report.deployed.height, 15252);
	assert.equal(report.deployed.gpuResidentBytes, 923274080);
	assert.equal(report.shader.status, 'pass');
	assert.ok(report.shader.samplerCount <= report.shader.maxFragmentSamplers);
});

test('forecast exposes the point where typical furniture growth exceeds the resident budget', async () => {
	const { buildCapacityReport } = await loadTool();
	const report = buildCapacityReport();
	const plus4 = report.scenarios.find((scenario) => scenario.id === 'plus_4_typical_furniture_pages');
	const plus8 = report.scenarios.find((scenario) => scenario.id === 'plus_8_typical_furniture_pages');
	assert.equal(plus4.status, 'pass');
	assert.equal(plus8.status, 'fail');
	assert.match(plus8.violations.join('\n'), /GPU resident/);
});

test('oversized page, sampler overflow and logical page overflow each raise a red light', async () => {
	const { evaluateCapacity } = await loadTool();
	const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
	const oversized = [{ surface: 'oversized', width: 16385, height: 1, bytes: 16385 * 8 }];
	const packing = { width: 16385, height: 1, gpuResidentBytes: 16385 * 8 };
	const oversizedResult = evaluateCapacity({ pages: oversized, packing, samplerCount: 1, contract });
	assert.equal(oversizedResult.status, 'fail');
	assert.match(oversizedResult.violations.join('\n'), /dimensions/);

	const samplerResult = evaluateCapacity({ pages: oversized.map((page) => ({ ...page, width: 1 })), packing: { width: 1, height: 1, gpuResidentBytes: 8 }, samplerCount: 17, contract });
	assert.match(samplerResult.violations.join('\n'), /sampler count 17/);

	const manyPages = Array.from({ length: 33 }, (_, index) => ({ surface: `page_${index}`, width: 1, height: 1, bytes: 8 }));
	const pageCountResult = evaluateCapacity({ pages: manyPages, packing: { width: 33, height: 1, gpuResidentBytes: 264 }, samplerCount: 1, contract });
	assert.match(pageCountResult.violations.join('\n'), /logical page count 33/);
});

test('capacity contract records hardware limits separately from project budgets', () => {
	const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
	assert.equal(contract.hardwareLimits.maxTextureDimension, 16384);
	assert.equal(contract.hardwareLimits.maxFragmentSamplers, 16);
	assert.equal(contract.hardwareLimits.bytesPerTexel, 8);
	assert.equal(contract.projectBudgets.maxGpuResidentBytes, 1073741824);
	assert.equal(contract.runtimeArchitecture.futurePageSamplerPolicy, 'pack_into_shared_atlas');
	assert.deepEqual(contract.runtimeArchitecture.separateSurfaces, ['floor']);
});
