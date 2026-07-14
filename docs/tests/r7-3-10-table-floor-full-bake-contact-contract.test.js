#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const registry = JSON.parse(fs.readFileSync('docs/data/r7-3-10-surface-owner-registry.json', 'utf8'));

function surface(id) {
	return registry.surfaces.find((entry) => entry.surfaceId === id);
}

function exclusion(id) {
	return registry.floorOcclusionExclusions.find((entry) => entry.id === id);
}

test('central desk has formal xatlas full-bake receiver surfaces before floor contact is accepted', () => {
	const expected = [
		'central_desk_top',
		'central_desk_front',
		'central_desk_back',
		'central_desk_left',
		'central_desk_right'
	];
	const missing = expected.filter((id) => !surface(id));
	assert.deepEqual(
		missing,
		[],
		`central desk full-bake surfaces missing from registry: ${missing.join(', ')}`
	);

	for (const id of expected) {
		const entry = surface(id);
		assert.equal(entry.ownerClass, 'furniture_static', `${id} must be a static furniture receiver`);
		assert.equal(entry.atlasGroup, 'furniture', `${id} must live on the furniture lightmap page group`);
		assert.equal(entry.pendingPolicy, 'baked', `${id} must be a formal baked route`);
		assert.equal(entry.bakePackageStatus, 'accepted', `${id} full-bake package must be accepted`);
		assert.equal(entry.bakedRadianceKind, 'full_diffuse_radiance', `${id} must store full diffuse radiance`);
		assert.equal(entry.directLightAlreadyIncluded, true, `${id} must include direct light in the bake`);
		assert.equal(entry.addDirectLightAfterBakeLookup, false, `${id} must not add direct light after lookup`);
		assert.match(entry.runnerSurfaceKey || '', /^central-desk-.*xatlas$/, `${id} must use a central desk xatlas runner key`);
		assert.ok(entry.masterRectKey, `${id} must declare a runtime master/page key`);
	}
});

test('floor desk footprint preserves a visible full-bake contact band instead of hard LIVE fallback', () => {
	const desk = exclusion('desk_footprint');
	assert.ok(desk, 'desk_footprint exclusion must exist');
	assert.equal(desk.surfaceId, 'floor_open');
	assert.equal(desk.enabled, true);

	assert.equal(
		desk.contactContinuity?.mode,
		'preserve_visible_full_bake_band',
		'desk_footprint must preserve a visible full-bake contact band'
	);
	assert.equal(
		desk.contactContinuity?.pairedSurfaceGroup,
		'central_desk',
		'desk_footprint must pair with the central desk full-bake receiver'
	);
	assert.equal(
		desk.contactContinuity?.runtimeFallbackAtVisibleEdge,
		false,
		'desk_footprint visible edge must not fall back to LIVE'
	);
	assert.ok(
		Number(desk.contactContinuity?.bandMeters) > 0,
		'desk_footprint must declare a positive contact band width in meters'
	);
	assert.ok(
		Number(desk.contactContinuity?.maxLumaDelta) > 0,
		'desk_footprint must declare a luma continuity gate'
	);
});

test('generated floor occlusion keeps desk contact band visible while protecting the hidden center', async () => {
	const { isFloorOccluded } = await import('../generated/r7-3-10-floor-occlusion-table.mjs');

	assert.equal(
		isFloorOccluded(0, 0.675, 1, 'bed'),
		true,
		'desk footprint center must stay invalid because the desk solid covers that floor'
	);
	assert.equal(
		isFloorOccluded(0, 0.415, 1, 'bed'),
		false,
		'north contact band must stay visible for floor/table full-bake continuity'
	);
	assert.equal(
		isFloorOccluded(0, 0.935, 1, 'bed'),
		false,
		'south contact band must stay visible for floor/table full-bake continuity'
	);
	assert.equal(
		isFloorOccluded(-0.59, 0.675, 1, 'bed'),
		false,
		'west contact band must stay visible for floor/table full-bake continuity'
	);
	assert.equal(
		isFloorOccluded(0.59, 0.675, 1, 'bed'),
		false,
		'east contact band must stay visible for floor/table full-bake continuity'
	);
});
