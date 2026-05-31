import assert from 'node:assert/strict';
import fs from 'node:fs';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

function extractFunction(source, name)
{
	const signature = `function ${name}`;
	const start = source.indexOf(signature);
	assert.ok(start >= 0, `Missing ${signature}`);
	const braceStart = source.indexOf('{', start);
	assert.ok(braceStart > start, `Missing body for ${signature}`);
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1)
	{
		const ch = source[i];
		if (ch === '{') depth += 1;
		if (ch === '}') depth -= 1;
		if (depth === 0)
			return source.slice(start, i + 1);
	}
	throw new Error(`Unclosed ${signature}`);
}

function normalizeR738PositiveInt(value, fallback, min, max)
{
	const parsed = Math.floor(Number(value));
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(min, Math.min(max, parsed));
}

const factory = new Function(
	'normalizeR738PositiveInt',
	'R738_BAKE_SAFE_FULL_FRAME_TEXELS',
	`${extractFunction(initCommon, 'shouldRequireR738TiledBakeCapture')}
${extractFunction(initCommon, 'validateR738BakeTilingSafety')}
return { shouldRequireR738TiledBakeCapture, validateR738BakeTilingSafety };`
);

const { shouldRequireR738TiledBakeCapture, validateR738BakeTilingSafety } = factory(
	normalizeR738PositiveInt,
	1024 * 1024
);

assert.equal(
	shouldRequireR738TiledBakeCapture(1024, 1024, { targetAtlasResolution: 1024 }),
	false,
	'1024 square capture may keep the legacy full-frame path'
);

assert.doesNotThrow(() => validateR738BakeTilingSafety(
	{ tileColumns: 1, tileRows: 1, submissionBoundaryMode: 'none' },
	1024,
	1024,
	{ targetAtlasResolution: 1024 }
));

assert.equal(
	shouldRequireR738TiledBakeCapture(1024, 705, { targetAtlasResolution: 1024 }),
	true,
	'rectangular captures require tiling'
);
assert.throws(
	() => validateR738BakeTilingSafety(
		{ tileColumns: 1, tileRows: 1, submissionBoundaryMode: 'none' },
		1024,
		705,
		{ targetAtlasResolution: 1024 }
	),
	/tileWidth\/tileHeight and fence boundary/
);

assert.equal(
	shouldRequireR738TiledBakeCapture(1536, 1058, { targetAtlasResolution: 1536 }),
	true,
	'captures larger than 1024 square require tiling'
);
assert.throws(
	() => validateR738BakeTilingSafety(
		{ tileColumns: 3, tileRows: 3, submissionBoundaryMode: 'none' },
		1536,
		1058,
		{ targetAtlasResolution: 1536 }
	),
	/tileWidth\/tileHeight and fence boundary/
);

assert.doesNotThrow(() => validateR738BakeTilingSafety(
	{ tileColumns: 2, tileRows: 2, submissionBoundaryMode: 'fence' },
	1024,
	705,
	{ targetAtlasResolution: 1024 }
));

console.log('R7-3.10 bake tiling safety contract passed');
