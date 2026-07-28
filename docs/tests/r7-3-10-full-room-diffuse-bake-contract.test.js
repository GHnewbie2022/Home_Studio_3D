#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT_PATH = 'docs/data/r7-3-10-full-room-diffuse-bake-contract.json';

function readJson(relativePath)
{
	return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

const contract = readJson(CONTRACT_PATH);
const requirements = contract.requirements;

assert.equal(contract.phase, 'formal_xatlas_full_bake_current_room');
assert.equal(contract.runtimeMode, 'atlasMaster=raw');
assert.equal(contract.formalPointers.length, 15, 'current room must list all 15 formal XATLAS pages');
assert.equal(contract.acceptedHybridPointers.length, 1, 'iron door body must be the only accepted hybrid pointer');

for (const entry of contract.formalPointers)
{
	const pointer = readJson(entry.path);
	assert.equal(pointer.packageStatus, requirements.packageStatus, `${entry.surface} must be accepted`);
	assert.equal(pointer.bakedRadianceKind, requirements.bakedRadianceKind, `${entry.surface} must be FULL BAKE`);
	assert.equal(pointer.directLightAlreadyIncluded, requirements.directLightAlreadyIncluded, `${entry.surface} must include direct light`);
	assert.equal(pointer.addDirectLightAfterBakeLookup, requirements.addDirectLightAfterBakeLookup, `${entry.surface} must not add direct light twice`);
	assert.equal(pointer.validation && pointer.validation.status, requirements.validationStatus, `${entry.surface} pointer validation must pass`);
	assert.equal(pointer.runtimeAtlasFormat, requirements.runtimeAtlasFormat, `${entry.surface} must use preconverted HalfFloat runtime data`);

	const packageDir = path.join(ROOT, pointer.packageDir);
	assert.ok(fs.statSync(packageDir).isDirectory(), `${entry.surface} package directory must exist`);
	const validation = readJson(path.join(pointer.packageDir, pointer.artifacts.validationReport));
	assert.equal(validation.status, 'pass', `${entry.surface} package validation report must pass`);
	assert.ok(fs.statSync(path.join(packageDir, pointer.artifacts.runtimeAtlasPatch0)).isFile(), `${entry.surface} HalfFloat page must exist`);
}

const ironEntry = contract.acceptedHybridPointers[0];
const ironPointer = readJson(ironEntry.path);
assert.equal(ironPointer.packageStatus, 'accepted');
assert.equal(ironPointer.deliveryRole, ironEntry.deliveryRole);
assert.equal(ironPointer.directLightAlreadyIncluded, true);
assert.equal(ironPointer.addDirectLightAfterBakeLookup, false);
assert.equal(ironPointer.liveSpecularReflection, true);
assert.equal(ironPointer.validation && ironPointer.validation.status, 'pass');
assert.ok(fs.statSync(path.join(ROOT, ironPointer.packageDir)).isDirectory(), 'iron door accepted package must exist');

console.log('R7-3.10 formal current-room FULL BAKE contract passed');
