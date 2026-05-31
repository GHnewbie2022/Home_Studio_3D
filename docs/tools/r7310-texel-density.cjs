#!/usr/bin/env node

const fs = require('node:fs');

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

function parseArgs(argv) {
	const args = {
		density: 590,
		json: false
	};
	for (const arg of argv) {
		if (arg === '--json') {
			args.json = true;
			continue;
		}
		if (arg.startsWith('--density=')) {
			args.density = Number(arg.slice('--density='.length));
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	if (!Number.isFinite(args.density) || args.density <= 0) {
		throw new Error('--density must be a positive number');
	}
	return args;
}

function parseFreezeObject(name) {
	const pattern = new RegExp(`const ${name} = Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\}\\);`);
	const match = initCommon.match(pattern);
	if (!match) throw new Error(`Missing Object.freeze constant: ${name}`);
	const values = {};
	for (const entry of match[1].matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
		values[entry[1]] = Number(entry[2]);
	}
	return values;
}

function parseNumberConst(name) {
	const pattern = new RegExp(`const ${name} = (\\d+)`);
	const match = initCommon.match(pattern);
	if (!match) throw new Error(`Missing numeric constant: ${name}`);
	return Number(match[1]);
}

function align4(value) {
	return Math.max(4, Math.ceil(value / 4) * 4);
}

function bytesToMiB(bytes) {
	return bytes / 1024 / 1024;
}

function fixed(value, digits = 2) {
	return Number(value).toFixed(digits);
}

function rectangularSurface(surface, density) {
	const bounds = parseFreezeObject(surface.boundsConst);
	const widthM = Math.abs(bounds[surface.uMax] - bounds[surface.uMin]);
	const heightM = Math.abs(bounds[surface.vMax] - bounds[surface.vMin]);
	const atlasWidth = align4(widthM * density);
	const atlasHeight = align4(heightM * density);
	const bytes = atlasWidth * atlasHeight * 4 * 4;
	return {
		key: surface.key,
		slot: surface.slot,
		constant: surface.boundsConst,
		axes: `${surface.uAxis}/${surface.vAxis}`,
		widthM,
		heightM,
		atlasWidth,
		atlasHeight,
		mmPerTexelU: widthM * 1000 / atlasWidth,
		mmPerTexelV: heightM * 1000 / atlasHeight,
		texels: atlasWidth * atlasHeight,
		bytes,
		mib: bytesToMiB(bytes),
		status: 'rectangular'
	};
}

const args = parseArgs(process.argv.slice(2));
const currentPatchCount = parseNumberConst('R7310_C1_RUNTIME_ATLAS_PATCH_COUNT');
const oldPatchResolution = 1024;
const oldCombinedBytes = currentPatchCount * oldPatchResolution * oldPatchResolution * 4 * 4;

const surfaces = [
	{ key: 'floor', slot: 0, boundsConst: 'R7310_C1_FLOOR_WORLD_BOUNDS', uAxis: 'x', uMin: 'xMin', uMax: 'xMax', vAxis: 'z', vMin: 'zMin', vMax: 'zMax' },
	{ key: 'northWall', slot: 1, boundsConst: 'R7310_C1_NORTH_WALL_WORLD_BOUNDS', uAxis: 'x', uMin: 'xMin', uMax: 'xMax', vAxis: 'y', vMin: 'yMin', vMax: 'yMax' },
	{ key: 'eastWall', slot: 2, boundsConst: 'R7310_C1_EAST_WALL_WORLD_BOUNDS', uAxis: 'z', uMin: 'zMin', uMax: 'zMax', vAxis: 'y', vMin: 'yMin', vMax: 'yMax' },
	{ key: 'westWall', slot: 3, boundsConst: 'R7310_C1_WEST_WALL_WORLD_BOUNDS', uAxis: 'z', uMin: 'zMin', uMax: 'zMax', vAxis: 'y', vMin: 'yMin', vMax: 'yMax' },
	{ key: 'southWall', slot: 4, boundsConst: 'R7310_C1_SOUTH_WALL_WORLD_BOUNDS', uAxis: 'x', uMin: 'xMin', uMax: 'xMax', vAxis: 'y', vMin: 'yMin', vMax: 'yMax' },
	{ key: 'ceiling', slot: 5, boundsConst: 'R7310_C1_CEILING_WORLD_BOUNDS', uAxis: 'x', uMin: 'xMin', uMax: 'xMax', vAxis: 'z', vMin: 'zMin', vMax: 'zMax' }
];

const rectangular = surfaces.map((surface) => rectangularSurface(surface, args.density));
const structuralHoldBytes = oldPatchResolution * oldPatchResolution * 4 * 4;
const largeSurfaceBytes = rectangular.reduce((sum, surface) => sum + surface.bytes, 0);
const proposedSecondTextureBytes = largeSurfaceBytes + structuralHoldBytes;

const report = {
	densityTexelsPerMeter: args.density,
	alignment: 'ceil to multiple of 4 pixels per axis',
	currentRuntimeAtlas: {
		patchCount: currentPatchCount,
		patchResolution: oldPatchResolution,
		bytes: oldCombinedBytes,
		mib: bytesToMiB(oldCombinedBytes)
	},
	proposedSlots0To6Texture: {
		rectangularSlots0To5Bytes: largeSurfaceBytes,
		structuralSlot6HoldBytes: structuralHoldBytes,
		totalBytes: proposedSecondTextureBytes,
		totalMiB: bytesToMiB(proposedSecondTextureBytes)
	},
	estimatedCombinedResidentBytes: oldCombinedBytes + proposedSecondTextureBytes,
	estimatedCombinedResidentMiB: bytesToMiB(oldCombinedBytes + proposedSecondTextureBytes),
	surfaces: [
		...rectangular,
		{
			key: 'structural',
			slot: 6,
			atlasWidth: oldPatchResolution,
			atlasHeight: oldPatchResolution,
			bytes: structuralHoldBytes,
			mib: bytesToMiB(structuralHoldBytes),
			status: 'irregular composite; keep 1024x1024 until it gets its own split plan'
		}
	]
};

if (args.json) {
	console.log(JSON.stringify(report, null, 2));
	process.exit(0);
}

console.log(`R7-3.10 per-surface texel density estimate`);
console.log(`density: ${args.density} texels/meter`);
console.log(`old combined atlas: ${currentPatchCount} x ${oldPatchResolution}^2 RGBA32F = ${fixed(report.currentRuntimeAtlas.mib)} MiB`);
console.log('');
console.log(`slot  surface     size(px)       mm/texel      MiB`);
for (const surface of report.surfaces) {
	const mm =
		surface.status === 'rectangular'
			? `${fixed(surface.mmPerTexelU)} x ${fixed(surface.mmPerTexelV)}`
			: 'manual';
	console.log(
		`${String(surface.slot).padStart(4)}  ${surface.key.padEnd(10)}  ` +
		`${String(surface.atlasWidth).padStart(5)}x${String(surface.atlasHeight).padEnd(5)}  ` +
		`${mm.padEnd(13)}  ${fixed(surface.mib).padStart(7)}`
	);
}
console.log('');
console.log(`proposed slots 0-6 texture: ${fixed(report.proposedSlots0To6Texture.totalMiB)} MiB`);
console.log(`estimated old + new resident memory: ${fixed(report.estimatedCombinedResidentMiB)} MiB`);
