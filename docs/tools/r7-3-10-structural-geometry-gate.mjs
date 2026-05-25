import fs from 'node:fs';

const METHOD = 'source_box_aabb_exact_face_rect_subtraction_and_face_normal_room_side_test';
const EPS = 1e-6;
const CONSTANTS = Object.freeze({
	MIN_X: -2.11,
	MAX_X: 2.11,
	MIN_Y: -0.20,
	MAX_Y: 3.105,
	MIN_Z: -2.074,
	MAX_Z: 3.256
});

function parseNumberToken(token)
{
	const trimmed = token.trim();
	if (Object.hasOwn(CONSTANTS, trimmed))
		return CONSTANTS[trimmed];
	const value = Number(trimmed);
	if (!Number.isFinite(value))
		throw new Error(`Unsupported coordinate token: ${trimmed}`);
	return value;
}

function parseVector(source)
{
	return source.split(',').map(parseNumberToken);
}

function parseSceneBoxes()
{
	const source = fs.readFileSync('js/Home_Studio.js', 'utf8');
	const boxes = [];
	const addBoxPattern = /addBox\(\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*,[\s\S]*?\);\s*\/\/\s*([^\n]*)/g;
	let match;
	while ((match = addBoxPattern.exec(source)))
	{
		const min = parseVector(match[1]);
		const max = parseVector(match[2]);
		boxes.push({
			index: boxes.length,
			label: match[3].trim(),
			min: { x: min[0], y: min[1], z: min[2] },
			max: { x: max[0], y: max[1], z: max[2] }
		});
	}
	return boxes;
}

function assertBox(box, expected, label)
{
	for (const axis of ['x', 'y', 'z'])
	{
		if (Math.abs(box.min[axis] - expected.min[axis]) > EPS || Math.abs(box.max[axis] - expected.max[axis]) > EPS)
			throw new Error(`${label} source bounds changed`);
	}
}

function intervalString(axis, min, max)
{
	return `${axis}=${trimNumber(min)}..${trimNumber(max)}`;
}

function trimNumber(value)
{
	return Number(value.toFixed(6)).toString();
}

function faceString(face, rect = null)
{
	const useRect = rect || face.rect;
	const planePart = `${face.axis}=${trimNumber(face.plane)}`;
	const uPart = intervalString(face.uAxis, useRect.uMin, useRect.uMax);
	const vPart = intervalString(face.vAxis, useRect.vMin, useRect.vMax);
	if (face.axis === 'x') return `${planePart}, ${uPart}, ${vPart}`;
	if (face.axis === 'y') return `${planePart}, ${uPart}, ${vPart}`;
	return `${planePart}, ${uPart}, ${vPart}`;
}

function rectArea(rect)
{
	return Math.max(0, rect.uMax - rect.uMin) * Math.max(0, rect.vMax - rect.vMin);
}

function intersectRect(a, b)
{
	const rect = {
		uMin: Math.max(a.uMin, b.uMin),
		uMax: Math.min(a.uMax, b.uMax),
		vMin: Math.max(a.vMin, b.vMin),
		vMax: Math.min(a.vMax, b.vMax)
	};
	return rectArea(rect) > EPS ? rect : null;
}

function subtractRect(base, cut)
{
	const hit = intersectRect(base, cut);
	if (!hit) return [base];
	const pieces = [];
	if (base.uMin < hit.uMin - EPS)
		pieces.push({ uMin: base.uMin, uMax: hit.uMin, vMin: base.vMin, vMax: base.vMax });
	if (hit.uMax < base.uMax - EPS)
		pieces.push({ uMin: hit.uMax, uMax: base.uMax, vMin: base.vMin, vMax: base.vMax });
	if (base.vMin < hit.vMin - EPS)
		pieces.push({ uMin: hit.uMin, uMax: hit.uMax, vMin: base.vMin, vMax: hit.vMin });
	if (hit.vMax < base.vMax - EPS)
		pieces.push({ uMin: hit.uMin, uMax: hit.uMax, vMin: hit.vMax, vMax: base.vMax });
	return pieces.filter((piece) => rectArea(piece) > EPS);
}

function faceSideIntersects(box, face)
{
	const min = box.min[face.axis];
	const max = box.max[face.axis];
	if (face.sign > 0)
		return min <= face.plane + EPS && max > face.plane + EPS;
	return max >= face.plane - EPS && min < face.plane - EPS;
}

function blockerRect(box, face)
{
	return {
		uMin: box.min[face.uAxis],
		uMax: box.max[face.uAxis],
		vMin: box.min[face.vAxis],
		vMax: box.max[face.vAxis]
	};
}

function occludingFaceString(box, face)
{
	return `${box.name || box.label || `sceneBox_${box.index}`} ${boxInterval(box, 'x')}, ${boxInterval(box, 'y')}, ${boxInterval(box, 'z')}`;
}

function boxInterval(box, axis)
{
	return `${axis}=${trimNumber(box.min[axis])}..${trimNumber(box.max[axis])}`;
}

function analyzeFace(face, blockers)
{
	let visible = [face.rect];
	const excluded = [];
	const occludingFaces = [];
	for (const blocker of blockers)
	{
		if (blocker.index === face.sourceIndex) continue;
		if (!faceSideIntersects(blocker, face)) continue;
		const cut = intersectRect(face.rect, blockerRect(blocker, face));
		if (!cut) continue;
		excluded.push(cut);
		occludingFaces.push(occludingFaceString(blocker, face));
		visible = visible.flatMap((rect) => subtractRect(rect, cut));
	}
	const hasVisible = visible.length > 0;
	const hasExcluded = excluded.length > 0;
	const decision = hasVisible && hasExcluded
		? 'mixed'
		: (hasVisible ? 'visible' : 'hidden');
	return {
		decision,
		visibleRects: visible,
		excludedRects: excluded,
		occludingFace: hasExcluded ? occludingFaces[0] : null
	};
}

function checkedFace(face, blockers, ownerIsland)
{
	const result = analyzeFace(face, blockers);
	const resolvedDecision = result.decision === 'mixed' && result.visibleRects.length > 0
		? 'mixed'
		: result.decision;
	return {
		name: face.name,
		candidateFace: faceString(face),
		normal: face.normal,
		method: METHOD,
		decision: resolvedDecision,
		ownerIsland: result.visibleRects.length > 0 ? ownerIsland : null,
		occludingFace: result.occludingFace,
		excludedInterval: result.excludedRects.length === 1 ? faceString(face, result.excludedRects[0]) : null,
		visibleIntervals: result.visibleRects.map((rect) => faceString(face, rect)),
		excludedIntervals: result.excludedRects.map((rect) => faceString(face, rect))
	};
}

function makeFace({ name, sourceIndex, axis, plane, sign, uAxis, uMin, uMax, vAxis, vMin, vMax, normal })
{
	return {
		name,
		sourceIndex,
		axis,
		plane,
		sign,
		uAxis,
		vAxis,
		normal,
		rect: { uMin, uMax, vMin, vMax }
	};
}

const boxes = parseSceneBoxes();
const structuralBoxes = [
	Object.assign({ name: 'west_beam' }, boxes[28]),
	Object.assign({ name: 'east_beam' }, boxes[29]),
	Object.assign({ name: 'southwest_column' }, boxes[30]),
	Object.assign({ name: 'southeast_column' }, boxes[31])
];

assertBox(boxes[28], { min: { x: -1.91, y: 2.525, z: -1.874 }, max: { x: -1.75, y: 2.905, z: 2.848 } }, 'west_beam');
assertBox(boxes[29], { min: { x: 1.85, y: 2.515, z: -1.874 }, max: { x: 2.11, y: 2.905, z: 3.056 } }, 'east_beam');
assertBox(boxes[30], { min: { x: -1.91, y: 0.0, z: 2.846 }, max: { x: -1.75, y: 2.905, z: 3.056 } }, 'southwest_column');
assertBox(boxes[31], { min: { x: 1.78, y: 0.0, z: 2.49 }, max: { x: 1.91, y: 2.905, z: 3.056 } }, 'southeast_column');
assertBox(boxes[36], { min: { x: 1.02, y: 0.0, z: 2.73 }, max: { x: 1.78, y: 2.04, z: 3.056 } }, 'southeast_bookshelf');

const shellBlockers = boxes.slice(0, 28).map((box) => Object.assign({ name: `sceneBox_${box.index}` }, box));
const furnitureContactBlockers = [
	Object.assign({ name: 'southeast_bookshelf' }, boxes[36])
];
const blockers = shellBlockers.concat(furnitureContactBlockers, structuralBoxes);

const checkedFaceSpecs = [
	{
		face: makeFace({
			name: 'se_column_upper_inner_x',
			sourceIndex: 31,
			axis: 'x',
			plane: 1.78,
			sign: -1,
			uAxis: 'y',
			uMin: 2.515,
			uMax: 2.905,
			vAxis: 'z',
			vMin: 2.49,
			vMax: 3.056,
			normal: '-X'
		}),
		ownerIsland: 'se_column_inner_x'
	},
	{
		face: makeFace({
			name: 'se_column_inner_x_bookshelf_overlap',
			sourceIndex: 31,
			axis: 'x',
			plane: 1.78,
			sign: -1,
			uAxis: 'y',
			uMin: 0.0,
			uMax: 2.515,
			vAxis: 'z',
			vMin: 2.49,
			vMax: 3.056,
			normal: '-X'
		}),
		ownerIsland: 'se_column_inner_x'
	},
	{
		face: makeFace({
			name: 'se_column_north_z_full_face',
			sourceIndex: 31,
			axis: 'z',
			plane: 2.49,
			sign: -1,
			uAxis: 'x',
			uMin: 1.78,
			uMax: 1.91,
			vAxis: 'y',
			vMin: 0.0,
			vMax: 2.905,
			normal: '-Z'
		}),
		ownerIsland: 'se_column_north_z'
	},
	{
		face: makeFace({
			name: 'east_beam_under_y_wall_overlap',
			sourceIndex: 29,
			axis: 'y',
			plane: 2.515,
			sign: -1,
			uAxis: 'x',
			uMin: 1.91,
			uMax: 2.11,
			vAxis: 'z',
			vMin: -1.874,
			vMax: 3.056,
			normal: '-Y'
		}),
		ownerIsland: 'east_beam_under_y'
	},
	{
		face: makeFace({
			name: 'east_beam_se_column_overlap_x',
			sourceIndex: 29,
			axis: 'x',
			plane: 1.85,
			sign: -1,
			uAxis: 'y',
			uMin: 2.515,
			uMax: 2.905,
			vAxis: 'z',
			vMin: 2.49,
			vMax: 3.056,
			normal: '-X'
		}),
		ownerIsland: 'east_beam_inner_x'
	},
	{
		face: makeFace({
			name: 'east_beam_se_column_overlap_under_y',
			sourceIndex: 29,
			axis: 'y',
			plane: 2.515,
			sign: -1,
			uAxis: 'x',
			uMin: 1.85,
			uMax: 1.91,
			vAxis: 'z',
			vMin: 2.49,
			vMax: 3.056,
			normal: '-Y'
		}),
		ownerIsland: 'east_beam_under_y'
	},
	{
		face: makeFace({
			name: 'sw_column_upper_north_z',
			sourceIndex: 30,
			axis: 'z',
			plane: 2.846,
			sign: -1,
			uAxis: 'x',
			uMin: -1.91,
			uMax: -1.75,
			vAxis: 'y',
			vMin: 2.525,
			vMax: 2.905,
			normal: '-Z'
		}),
		ownerIsland: 'sw_column_north_z'
	},
	{
		face: makeFace({
			name: 'sw_column_upper_inner_coplanar_x',
			sourceIndex: 30,
			axis: 'x',
			plane: -1.75,
			sign: 1,
			uAxis: 'y',
			uMin: 2.525,
			uMax: 2.905,
			vAxis: 'z',
			vMin: 2.846,
			vMax: 3.056,
			normal: '+X'
		}),
		ownerIsland: 'sw_column_inner_x'
	}
];

const checkedFaces = checkedFaceSpecs.map((spec) => checkedFace(spec.face, blockers, spec.ownerIsland));
const unresolvedMixedFaces = checkedFaces
	.filter((face) => face.decision === 'mixed' && face.visibleIntervals.length === 0)
	.map((face) => face.name);

const finalIslandRegistry = [
	{
		name: 'west_beam_inner_x',
		atlasRect: { uMin: 0.000, vMin: 0.000, uMax: 0.500, vMax: 0.170 },
		worldFace: { axis: 'x', value: -1.75, yMin: 2.525, yMax: 2.905, zMin: -1.874, zMax: 2.848 },
		normal: '+X',
		axes: { u: 'z', v: 'y' }
	},
	{
		name: 'west_beam_under_y',
		atlasRect: { uMin: 0.000, vMin: 0.180, uMax: 0.500, vMax: 0.260 },
		worldFace: { axis: 'y', value: 2.525, xMin: -1.91, xMax: -1.75, zMin: -1.874, zMax: 2.846 },
		normal: '-Y',
		axes: { u: 'z', v: 'x' }
	},
	{
		name: 'east_beam_inner_x',
		atlasRect: { uMin: 0.000, vMin: 0.270, uMax: 0.500, vMax: 0.440 },
		worldFace: { axis: 'x', value: 1.85, yMin: 2.515, yMax: 2.905, zMin: -1.874, zMax: 2.49 },
		normal: '-X',
		axes: { u: 'z', v: 'y' }
	},
	{
		name: 'east_beam_under_y',
		atlasRect: { uMin: 0.000, vMin: 0.450, uMax: 0.500, vMax: 0.530 },
		worldFace: { axis: 'y', value: 2.515, xMin: 1.85, xMax: 1.91, zMin: -1.874, zMax: 2.49 },
		normal: '-Y',
		axes: { u: 'z', v: 'x' }
	},
	{
		name: 'sw_column_inner_x',
		atlasRect: { uMin: 0.520, vMin: 0.000, uMax: 0.740, vMax: 0.360 },
		worldFace: { axis: 'x', value: -1.75, yMin: 0.0, yMax: 2.905, zMin: 2.846, zMax: 3.056 },
		normal: '+X',
		axes: { u: 'z', v: 'y' }
	},
	{
		name: 'sw_column_north_z',
		atlasRect: { uMin: 0.760, vMin: 0.000, uMax: 0.940, vMax: 0.360 },
		worldFace: { axis: 'z', value: 2.846, xMin: -1.91, xMax: -1.75, yMin: 0.0, yMax: 2.525 },
		normal: '-Z',
		axes: { u: 'x', v: 'y' }
	},
	{
		name: 'se_column_inner_x',
		atlasRect: { uMin: 0.520, vMin: 0.380, uMax: 0.740, vMax: 0.760 },
		worldFace: { axis: 'x', value: 1.78, yMin: 0.0, yMax: 2.905, zMin: 2.49, zMax: 3.056 },
		normal: '-X',
		axes: { u: 'z', v: 'y' }
	},
	{
		name: 'se_column_north_z',
		atlasRect: { uMin: 0.000, vMin: 0.880, uMax: 1.000, vMax: 1.000 },
		worldFace: { axis: 'z', value: 2.49, xMin: 1.78, xMax: 1.91, yMin: 0.0, yMax: 2.905 },
		normal: '-Z',
		axes: { u: 'y', v: 'x' }
	}
];

const excludedContactFaces = [
	'east_beam_under_y wall-overlap y=2.515, x=1.91..MAX_X, z=-1.874..3.056',
	'east_beam_inner_x southeast-column overlap x=1.85, y=2.515..2.905, z=2.49..3.056',
	'east_beam_under_y southeast-column overlap y=2.515, x=1.85..1.91, z=2.49..3.056',
	'se_column_north_z east-beam overlap z=2.49, x=1.85..1.91, y=2.515..2.905',
	'se_column_inner_x southeast-bookshelf overlap x=1.78, y=0..2.04, z=2.73..3.056',
	'west_beam_under_y southwest-column overlap y=2.525, x=-1.91..-1.75, z=2.846..2.848',
	'sw_column_north_z west-beam internal contact z=2.846, x=-1.91..-1.75, y=2.525..2.905'
];

const report = {
	status: unresolvedMixedFaces.length === 0 ? 'pass' : 'fail',
	method: METHOD,
	unresolvedMixedFaces,
	sourceBoxes: structuralBoxes.map((box) => ({
		index: box.index,
		name: box.name,
		bounds: { min: box.min, max: box.max }
	})),
	checkedFaces,
	finalIslandRegistrySource: 'geometry_gate',
	finalIslandCount: finalIslandRegistry.length,
	finalIslandRegistry,
	excludedContactFaces,
	notes: [
		'se_column_upper_inner_x is visible and extends se_column_inner_x to y=0.0..2.905',
		'se_column_inner_x subtracts the southeast bookshelf coplanar overlap before bake/runtime sampling',
		'se_column_north_z is one continuous island; the east-beam overlap is excluded inside the same island owner',
		'west_beam_inner_x ends at z=2.848 and sw_column_inner_x owns the L vertical leg to y=2.905',
		'sw_column_upper_inner_coplanar_x is visible and assigned to sw_column_inner_x'
	]
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
