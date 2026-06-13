#!/usr/bin/env node
/*
 * R7-3.10 northeast furniture contact alpha package audit.
 *
 * Locks the frozen 1b diagnostic bedContact test package. The formal bed
 * package stays unchanged; this package is selected only by a local URL param.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

function sha256(filePath) {
	return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseJsObjectConst(source, objectName, key) {
	const re = new RegExp(`const\\s+${objectName}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`);
	const match = source.match(re);
	assert.ok(match, `${objectName} must exist`);
	const keyRe = new RegExp(`${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`);
	const keyMatch = match[1].match(keyRe);
	assert.ok(keyMatch, `${objectName}.${key} must exist`);
	return Number(keyMatch[1]);
}

function contactFromInitCommon(source, objectName) {
	return {
		xMin: parseJsObjectConst(source, objectName, 'xMin'),
		xMax: parseJsObjectConst(source, objectName, 'xMax'),
		yMin: parseJsObjectConst(source, objectName, 'yMin'),
		yMax: parseJsObjectConst(source, objectName, 'yMax')
	};
}

function insideRect(x, y, rect) {
	return x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
}

const sourcePointerPath = 'docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json';
const testPointerPath = 'docs/data/r7-3-10-c1-north-wall-separated-bed-contact-b-alpha-test-runtime-package.json';
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const tool = fs.readFileSync('docs/tools/r7-3-10-north-wall-contact-alpha-package.mjs', 'utf8');
const sourcePointer = readJson(sourcePointerPath);
const testPointer = readJson(testPointerPath);
const expectedBedContact = contactFromInitCommon(initCommon, 'R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE');

assert.match(tool, /R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE/);
assert.match(tool, /R7310_C1_NORTH_WALL_WARDROBE_CONTACT_CANDIDATE/);
assert.doesNotMatch(tool, /const\s+CONTACTS\s*=\s*\{/);

assert.equal(sourcePointer.packageDir, 'assets/bakes/r7-3-10/c1-static-diffuse/north-wall-separated-1024px-1000spp');
assert.equal(testPointer.packageDir, 'assets/bakes/r7-3-10/c1-static-diffuse/north-wall-separated-1024px-1000spp-bed-contact-b-alpha-test');
assert.equal(testPointer.northeastFurnitureMode, 'bed');
assert.equal(testPointer.modeAwareMetadataAlpha.mode, 'bed');
assert.deepEqual(testPointer.invalidTexelRegions.bedContact, {
	id: 'bedContact',
	...expectedBedContact,
	activeWhen: { northeastFurnitureMode: 'bed' },
	executionLayer: 'packageMetadata',
	status: 'diagnostic-frozen-superseded-by-full-north-wall-xatlas'
});

const sourceAtlasPath = `${sourcePointer.packageDir}/${sourcePointer.artifacts.atlasPatch0}`;
const sourceMetadataPath = `${sourcePointer.packageDir}/texel-metadata-patch-000-f32.bin`;
assert.equal(sha256(sourceAtlasPath), sourcePointer.artifactHashes.atlasPatch0Sha256);
assert.equal(sha256(sourceMetadataPath), sourcePointer.artifactHashes.texelMetadataPatch0Sha256);

const testAtlasPath = `${testPointer.packageDir}/${testPointer.artifacts.atlasPatch0}`;
const testMetadataPath = `${testPointer.packageDir}/texel-metadata-patch-000-f32.bin`;
assert.equal(sha256(testAtlasPath), testPointer.artifactHashes.atlasPatch0Sha256);
assert.equal(sha256(testMetadataPath), testPointer.artifactHashes.texelMetadataPatch0Sha256);

const atlasBytes = fs.readFileSync(testAtlasPath);
const metadataBytes = fs.readFileSync(testMetadataPath);
const atlas = new Float32Array(atlasBytes.buffer, atlasBytes.byteOffset, atlasBytes.byteLength / 4);
const metadata = new Float32Array(metadataBytes.buffer, metadataBytes.byteOffset, metadataBytes.byteLength / 4);
const texelCount = Math.min(atlas.length / 4, metadata.length / 12);
const contact = testPointer.invalidTexelRegions.bedContact;

let contactTexels = 0;
let contactValidTexels = 0;
let contactAlphaOneTexels = 0;
let contactNonzeroTexels = 0;
for (let i = 0; i < texelCount; i += 1) {
	const m = i * 12;
	if (!insideRect(metadata[m], metadata[m + 1], contact)) continue;
	contactTexels += 1;
	if (metadata[m + 7] > 0.5) contactValidTexels += 1;
	const p = i * 4;
	if (atlas[p + 3] > 0.5) contactAlphaOneTexels += 1;
	if (atlas[p] !== 0 || atlas[p + 1] !== 0 || atlas[p + 2] !== 0) contactNonzeroTexels += 1;
}

assert.equal(contactTexels, 48042);
assert.equal(contactTexels, testPointer.modeAwareMetadataAlpha.contactTexels);
assert.equal(contactValidTexels, 0);
assert.equal(contactAlphaOneTexels, 0);
assert.equal(contactNonzeroTexels, 0);
assert.equal(testPointer.modeAwareMetadataAlpha.invalidAtlasAlphaOneAfter, 0);
assert.equal(testPointer.modeAwareMetadataAlpha.invalidBrightTexelsAfter, 0);

console.log('R7-3.10 northeast furniture contact alpha package audit passed');
