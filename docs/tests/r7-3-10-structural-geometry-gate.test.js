import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const stdout = execFileSync('node', ['docs/tools/r7-3-10-structural-geometry-gate.mjs'], {
	encoding: 'utf8',
	stdio: ['ignore', 'pipe', 'pipe']
});

const report = JSON.parse(stdout);

assert.equal(report.status, 'pass');
assert.equal(report.method, 'source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test');
assert.deepEqual(report.unresolvedMixedFaces, []);
assert.equal(report.finalIslandRegistrySource, 'geometry_gate');
assert.equal(report.finalIslandCount, 8);

const expectedIslandNames = [
	'west_beam_inner_x',
	'west_beam_under_y',
	'east_beam_inner_x',
	'east_beam_under_y',
	'sw_column_inner_x',
	'sw_column_north_z',
	'se_column_inner_x',
	'se_column_north_z'
];

assert.deepEqual(
	report.finalIslandRegistry.map((island) => island.name),
	expectedIslandNames
);

const checkedByName = new Map(report.checkedFaces.map((face) => [face.name, face]));
for (const name of [
	'se_column_upper_inner_x',
	'se_column_inner_x_bookshelf_overlap',
	'east_beam_under_y_wall_overlap',
	'east_beam_se_column_overlap_x',
	'east_beam_se_column_overlap_under_y',
	'west_beam_sw_column_overlap_under_y',
	'sw_column_upper_north_z',
	'sw_column_upper_inner_coplanar_x',
	'se_column_north_z_full_face'
])
{
	assert.equal(checkedByName.has(name), true, `${name} missing from checkedFaces`);
	const face = checkedByName.get(name);
	assert.equal(typeof face.candidateFace, 'string');
	assert.equal(typeof face.normal, 'string');
	assert.equal(face.method, report.method);
	assert.equal(typeof face.decision, 'string');
	assert.equal(Array.isArray(face.visibleIntervals), true);
	assert.equal(Array.isArray(face.excludedIntervals), true);
}

assert.equal(checkedByName.get('se_column_upper_inner_x').decision, 'visible');
assert.equal(checkedByName.get('se_column_upper_inner_x').ownerIsland, 'se_column_inner_x');
assert.equal(checkedByName.get('se_column_inner_x_bookshelf_overlap').decision, 'mixed');
assert.equal(checkedByName.get('se_column_inner_x_bookshelf_overlap').ownerIsland, 'se_column_inner_x');
assert.deepEqual(
	checkedByName.get('se_column_inner_x_bookshelf_overlap').excludedIntervals,
	['x=1.78, y=0..2.04, z=2.73..3.056']
);
assert.equal(checkedByName.get('east_beam_under_y_wall_overlap').decision, 'hidden');
assert.equal(checkedByName.get('east_beam_se_column_overlap_x').decision, 'hidden');
assert.equal(checkedByName.get('east_beam_se_column_overlap_under_y').decision, 'hidden');
assert.equal(checkedByName.get('west_beam_sw_column_overlap_under_y').decision, 'hidden');
assert.equal(checkedByName.get('sw_column_upper_north_z').decision, 'hidden');
assert.equal(checkedByName.get('sw_column_upper_inner_coplanar_x').decision, 'visible');
assert.equal(checkedByName.get('sw_column_upper_inner_coplanar_x').ownerIsland, 'west_beam_inner_x');
assert.equal(checkedByName.get('se_column_north_z_full_face').decision, 'mixed');
assert.equal(checkedByName.get('se_column_north_z_full_face').ownerIsland, 'se_column_north_z');
assert.deepEqual(
	checkedByName.get('se_column_north_z_full_face').visibleIntervals,
	[
		'z=2.49, x=1.78..1.85, y=0..2.905',
		'z=2.49, x=1.85..1.91, y=0..2.515'
	]
);
assert.deepEqual(
	checkedByName.get('se_column_north_z_full_face').excludedIntervals,
	['z=2.49, x=1.85..1.91, y=2.515..2.905']
);

const seColumnNorth = report.finalIslandRegistry.find((island) => island.name === 'se_column_north_z');
assert.ok(seColumnNorth);
assert.deepEqual(seColumnNorth.worldFace, { axis: 'z', value: 2.49, xMin: 1.78, xMax: 1.91, yMin: 0.0, yMax: 2.905 });
assert.deepEqual(seColumnNorth.atlasRect, { uMin: 0.0, vMin: 0.88, uMax: 1.0, vMax: 1.0 });

assert.equal(report.excludedContactFaces.length >= 5, true);
assert.equal(
	report.excludedContactFaces.some((face) => face.includes('east_beam_under_y wall-overlap')),
	true
);
assert.equal(
	report.excludedContactFaces.some((face) => face.includes('west_beam_under_y southwest-column overlap')),
	true
);

console.log('R7-3.10 structural geometry gate passed');
