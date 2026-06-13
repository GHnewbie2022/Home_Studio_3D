import assert from 'node:assert/strict';
import fs from 'node:fs';

const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');

function parseNamedNumbers(source, pattern) {
	const out = new Map();
	let match;
	while ((match = pattern.exec(source))) {
		out.set(match[1], Number(match[2]));
	}
	return out;
}

const shaderFloatConsts = parseNamedNumbers(
	shader,
	/const\s+float\s+([A-Z0-9_]+)\s*=\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*;/gi
);
const jsConsts = parseNamedNumbers(
	homeStudio,
	/const\s+([A-Z0-9_]+)\s*=\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*;/gi
);

function readNumberToken(token, constants) {
	const trimmed = token.trim();
	if (/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(trimmed)) {
		return Number(trimmed);
	}
	assert.ok(constants.has(trimmed), `unknown numeric token ${trimmed}`);
	return constants.get(trimmed);
}

function parseVec3(text, constants) {
	const parts = text.split(',').map((part) => readNumberToken(part, constants));
	assert.equal(parts.length, 3, `vec3 must have three parts: ${text}`);
	return { x: parts[0], y: parts[1], z: parts[2] };
}

function parseJsVector(text) {
	const parts = text.split(',').map((part) => readNumberToken(part, jsConsts));
	assert.equal(parts.length, 3, `JS vector must have three parts: ${text}`);
	return { x: parts[0], y: parts[1], z: parts[2] };
}

function functionBody(source, name) {
	const start = source.indexOf(name);
	assert.ok(start >= 0, `${name} must exist`);
	const open = source.indexOf('{', start);
	assert.ok(open > start, `${name} must have a function body`);
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(open + 1, i);
		}
	}
	assert.fail(`${name} function body did not close`);
}

function shortLineId(lineId) {
	if (lineId === 'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_BED_TOP') return 'bed_top';
	if (lineId === 'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM') return 'west_beam';
	if (lineId === 'R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM') return 'east_beam';
	assert.fail(`unexpected confirmed line id ${lineId}`);
}

function parseAabbFunction(name, minVar, maxVar) {
	const body = functionBody(shader, name);
	const casesById = new Map();
	const branchPattern =
		/if\s*\(\s*confirmedLineId\s*==\s*(R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_[A-Z_]+)\s*\)\s*\{([\s\S]*?)return\s+true\s*;/g;
	let branch;
	while ((branch = branchPattern.exec(body))) {
		const id = shortLineId(branch[1]);
		const block = branch[2];
		const minMatch = new RegExp(`${minVar}\\s*=\\s*vec3\\(([^)]*)\\)\\s*;`).exec(block);
		const maxMatch = new RegExp(`${maxVar}\\s*=\\s*vec3\\(([^)]*)\\)\\s*;`).exec(block);
		assert.ok(minMatch, `${name} ${id} must assign ${minVar}`);
		assert.ok(maxMatch, `${name} ${id} must assign ${maxVar}`);
		casesById.set(id, {
			min: parseVec3(minMatch[1], shaderFloatConsts),
			max: parseVec3(maxMatch[1], shaderFloatConsts)
		});
	}
	return casesById;
}

function parseShaderCoplanarCases() {
	const seams = parseAabbFunction('r7310C1XatlasBakeCoplanarSeamAabb', 'seamMin', 'seamMax');
	const neighbors = parseAabbFunction('r7310C1XatlasBakeCoplanarNeighborAabb', 'neighborMin', 'neighborMax');
	return [...seams.keys()].map((id) => {
		assert.ok(neighbors.has(id), `${id} must have a neighbor AABB`);
		return {
			id,
			seamMin: seams.get(id).min,
			seamMax: seams.get(id).max,
			neighborMin: neighbors.get(id).min,
			neighborMax: neighbors.get(id).max
		};
	});
}

function parseBedBounds() {
	const match = /bed:\s*\{\s*main:\s*\{\s*min:\s*\[([^\]]+)\]\s*,\s*max:\s*\[([^\]]+)\]/.exec(homeStudio);
	assert.ok(match, 'bed C2 layout bounds must exist');
	return { min: parseJsVector(match[1]), max: parseJsVector(match[2]) };
}

function parseAddBoxBounds(commentIndex) {
	const pattern = new RegExp(
		`^\\s*addBox\\(\\s*\\[([^\\]]+)\\]\\s*,\\s*\\[([^\\]]+)\\][^\\n]*//\\s*${commentIndex}\\b`,
		'm'
	);
	const match = pattern.exec(homeStudio);
	assert.ok(match, `addBox ${commentIndex} bounds must exist`);
	return { min: parseJsVector(match[1]), max: parseJsVector(match[2]) };
}

function assertVecClose(actual, expected, label) {
	for (const axis of ['x', 'y', 'z']) {
		assert.ok(
			Math.abs(actual[axis] - expected[axis]) <= 1e-9,
			`${label}.${axis} expected ${expected[axis]} got ${actual[axis]}`
		);
	}
}

function escapeFromSeamAndNeighbor(seamMin, seamMax, neighborMin, neighborMax) {
	const seamCenter = {
		x: (seamMin.x + seamMax.x) * 0.5,
		y: (seamMin.y + seamMax.y) * 0.5
	};
	const seamExtent = {
		x: Math.abs(seamMax.x - seamMin.x),
		y: Math.abs(seamMax.y - seamMin.y)
	};
	const neighborCenter = {
		x: (neighborMin.x + neighborMax.x) * 0.5,
		y: (neighborMin.y + neighborMax.y) * 0.5
	};
	if (seamExtent.x >= seamExtent.y) {
		return [0, seamCenter.y >= neighborCenter.y ? 1 : -1, 0];
	}
	return [seamCenter.x >= neighborCenter.x ? 1 : -1, 0, 0];
}

const cases = [
	{
		id: 'bed_top',
		expected: [0, 1, 0]
	},
	{
		id: 'west_beam',
		expected: [1, 0, 0]
	},
	{
		id: 'east_beam',
		expected: [-1, 0, 0]
	}
];

const shaderCases = new Map(parseShaderCoplanarCases().map((entry) => [entry.id, entry]));
assert.equal(
	shaderCases.size,
	cases.length,
	'contract test must read the actual shader seam/neighbor AABB cases'
);

for (const entry of cases) {
	const shaderCase = shaderCases.get(entry.id);
	assert.ok(shaderCase, `${entry.id} must be parsed from shader`);
	assert.deepEqual(
		escapeFromSeamAndNeighbor(shaderCase.seamMin, shaderCase.seamMax, shaderCase.neighborMin, shaderCase.neighborMax),
		entry.expected,
		`${entry.id} escape direction must be reproducible from actual shader seam geometry and neighbor AABB`
	);
}

const expectedNeighbors = {
	bed_top: parseBedBounds(),
	west_beam: parseAddBoxBounds(12),
	east_beam: parseAddBoxBounds(13)
};
for (const [id, bounds] of Object.entries(expectedNeighbors)) {
	const shaderCase = shaderCases.get(id);
	assertVecClose(shaderCase.neighborMin, bounds.min, `${id} neighborMin sync`);
	assertVecClose(shaderCase.neighborMax, bounds.max, `${id} neighborMax sync`);
}

assert.match(shader, /r7310C1XatlasBakeCoplanarSeamAabb/);
assert.match(shader, /r7310C1XatlasBakeCoplanarNeighborAabb/);
assert.match(shader, /r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb/);
assert.match(
	shader,
	/r7310C1XatlasBakeCoplanarLiftDirection[\s\S]*r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb/
);
assert.equal(
	/R7310_C1_XATLAS_BAKE_CONFIRMED_[A-Z_]+_ESCAPE_DIR/.test(shader),
 false,
	'A-narrow keeps manual seam registry but removes hardcoded escape vector constants from shader'
);
