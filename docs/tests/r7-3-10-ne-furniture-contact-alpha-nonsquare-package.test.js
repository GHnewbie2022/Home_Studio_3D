#!/usr/bin/env node
/*
 * R7-3.10 northeast furniture high-resolution contact alpha package audit.
 *
 * Locks the frozen 1b non-square raw/OIDN diagnostic packages. These packages
 * are for Chrome visual acceptance only; formal runtime pointers stay unchanged.
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

function audit(pointerPath, expectedKind, options = {}) {
	const expectedContact = options.expectedContact || expectedBedContact;
	const expectedStatus = options.expectedStatus || 'diagnostic-frozen-superseded-by-full-north-wall-xatlas';
	const pointer = readJson(pointerPath);
	const contact = pointer.invalidTexelRegions.bedContact;
	assert.equal(pointer.packageStatus, 'architecture_probe');
	assert.equal(pointer.runtimeScope, 'c1_north_east_non_square_first_hit_hybrid');
	assert.equal(pointer.targetAtlasWidth, 3379);
	assert.equal(pointer.targetAtlasHeight, 4043);
	assert.equal(pointer.faceSizePx.northWall.width, 3379);
	assert.equal(pointer.faceSizePx.northWall.height, 2327);
	assert.equal(pointer.modeAwareNonSquareAlpha.kind, expectedKind);
	assert.deepEqual(contact, {
		id: 'bedContact',
		...expectedContact,
		activeWhen: { northeastFurnitureMode: 'bed' },
		executionLayer: 'nonSquareAtlasAlpha',
		status: expectedStatus
	});
	assert.deepEqual(pointer.modeAwareNonSquareAlpha.contact, {
		id: 'bedContact',
		...expectedContact
	});
	assert.equal(pointer.modeAwareNonSquareAlpha.contactTexels > 300000, true);
	assert.equal(pointer.modeAwareNonSquareAlpha.contactAlphaOneAfter, 0);
	assert.equal(pointer.modeAwareNonSquareAlpha.contactBrightTexelsAfter, 0);
	if (Number.isFinite(options.maxBrightBefore)) {
		assert.ok(
			pointer.modeAwareNonSquareAlpha.contactBrightTexelsBefore <= options.maxBrightBefore,
			`${pointerPath} should not clear a bright-wall band`
		);
	}

	const atlasPath = `${pointer.packageDir}/${pointer.artifacts.atlasPatch0}`;
	assert.equal(sha256(atlasPath), pointer.artifactHashes.atlasPatch0Sha256);
	const atlasBytes = fs.readFileSync(atlasPath);
	const atlas = new Float32Array(atlasBytes.buffer, atlasBytes.byteOffset, atlasBytes.byteLength / 4);
	const bounds = pointer.worldBounds.northWall;
	const face = pointer.faceSizePx.northWall;
	let contactTexels = 0;
	let contactAlphaOne = 0;
	let contactNonzero = 0;
	for (let row = 0; row < face.height; row += 1) {
		const y = bounds.yMin + ((row + 0.5) / face.height) * (bounds.yMax - bounds.yMin);
		if (y < contact.yMin || y > contact.yMax) continue;
		for (let col = 0; col < face.width; col += 1) {
			const x = bounds.xMin + ((col + 0.5) / face.width) * (bounds.xMax - bounds.xMin);
			if (!insideRect(x, y, contact)) continue;
			contactTexels += 1;
			const p = (row * pointer.targetAtlasWidth + col) * 4;
			if (atlas[p + 3] > 0.5) contactAlphaOne += 1;
			if (atlas[p] !== 0 || atlas[p + 1] !== 0 || atlas[p + 2] !== 0) contactNonzero += 1;
		}
	}
	assert.equal(contactTexels, pointer.modeAwareNonSquareAlpha.contactTexels);
	assert.equal(contactAlphaOne, 0);
	assert.equal(contactNonzero, 0);
}

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const expectedBedContact = contactFromInitCommon(initCommon, 'R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE');
const expectedBedContactY279 = {
	...expectedBedContact,
	yMax: 0.279
};
const expectedBedContactX027Y279 = {
	...expectedBedContact,
	xMin: -0.027,
	yMax: 0.279
};

audit(
	'docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-b-alpha-raw-runtime-package.json',
	'raw'
);
audit(
	'docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-b-alpha-oidn-runtime-package.json',
	'oidn'
);
audit(
	'docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-y279-alpha-raw-runtime-package.json',
	'raw',
	{
		expectedContact: expectedBedContactY279,
		expectedStatus: 'diagnostic-ymax-probe',
		maxBrightBefore: 5000
	}
);
audit(
	'docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-y279-alpha-oidn-runtime-package.json',
	'oidn',
	{
		expectedContact: expectedBedContactY279,
		expectedStatus: 'diagnostic-ymax-probe',
		maxBrightBefore: 5000
	}
);
audit(
	'docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-raw-runtime-package.json',
	'raw',
	{
		expectedContact: expectedBedContactX027Y279,
		expectedStatus: 'diagnostic-xmin-ymax-probe',
		maxBrightBefore: 1000
	}
);
audit(
	'docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-oidn-runtime-package.json',
	'oidn',
	{
		expectedContact: expectedBedContactX027Y279,
		expectedStatus: 'diagnostic-xmin-ymax-probe',
		maxBrightBefore: 3000
	}
);

console.log('R7-3.10 northeast furniture high-resolution contact alpha package audit passed');
