// R7-3.10 atlas seam audit.
//
// Reads the formal runtime package pointers and classifies seam risks without
// launching the browser or changing runtime behavior.
//
// Usage:
//   node docs/tools/r7-3-10-atlas-seam-audit.mjs
//   node docs/tools/r7-3-10-atlas-seam-audit.mjs --json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const META_STRIDE = 12;
const LUMA_EPSILON = 1e-6;
const LARGE_JUMP_THRESHOLD = 0.18;
const EDGE_SAMPLE_LIMIT = 12;
const SHADER_PATH = 'shaders/Home_Studio_Fragment.glsl';

const POINTERS = [
	{
		key: 'floor',
		label: 'floor',
		path: 'docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json'
	},
	{
		key: 'north',
		label: 'north wall',
		path: 'docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json'
	},
	{
		key: 'east',
		label: 'east wall',
		path: 'docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json'
	},
	{
		key: 'west',
		label: 'west wall',
		path: 'docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json'
	},
	{
		key: 'south',
		label: 'south wall',
		path: 'docs/data/r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json'
	},
	{
		key: 'ceiling',
		label: 'ceiling',
		path: 'docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json'
	},
	{
		key: 'structural',
		label: 'structural beams and columns',
		path: 'docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json'
	}
];

function readJson(relativePath)
{
	return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readF32(filePath)
{
	const buffer = fs.readFileSync(filePath);
	return new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function loadPackage(pointerDef)
{
	const pointer = readJson(pointerDef.path);
	const packageDir = path.join(repoRoot, pointer.packageDir);
	const atlasPath = path.join(packageDir, pointer.artifacts?.atlasPatch0 || 'atlas-patch-000-rgba-f32.bin');
	const metadataPath = path.join(packageDir, pointer.artifacts?.texelMetadataPatch0 || 'texel-metadata-patch-000-f32.bin');
	const atlas = readF32(atlasPath);
	const metadata = readF32(metadataPath);
	const atlasTexels = Math.floor(atlas.length / 4);
	const metadataTexels = Math.floor(metadata.length / META_STRIDE);
	const resolution = Math.sqrt(atlasTexels);
	if (!Number.isInteger(resolution) || resolution <= 0)
		throw new Error(`Invalid atlas size for ${pointerDef.path}: ${atlas.length}`);
	if (metadataTexels !== atlasTexels)
		throw new Error(`Metadata texel count mismatch for ${pointerDef.path}: atlas=${atlasTexels}, metadata=${metadataTexels}`);
	return {
		...pointerDef,
		pointer,
		packageDir,
		atlasPath,
		metadataPath,
		atlas,
		metadata,
		resolution,
		texels: atlasTexels
	};
}

function isFloorLike(pkg)
{
	return pkg.pointer.surfaceName === 'c1_floor_full_room';
}

function metaOffset(index)
{
	return index * META_STRIDE;
}

function pixelIndex(pkg, x, y)
{
	if (x < 0 || x >= pkg.resolution || y < 0 || y >= pkg.resolution) return -1;
	return y * pkg.resolution + x;
}

function isValidTexel(pkg, index)
{
	if (index < 0 || index >= pkg.texels) return false;
	if (isFloorLike(pkg)) return true;
	return pkg.metadata[metaOffset(index) + 7] > 0.5;
}

function islandIdAt(pkg, index)
{
	if (index < 0 || index >= pkg.texels) return 0;
	return Math.round(pkg.metadata[metaOffset(index) + 8] || 0);
}

function lumaAt(pkg, index)
{
	const offset = index * 4;
	const r = pkg.atlas[offset];
	const g = pkg.atlas[offset + 1];
	const b = pkg.atlas[offset + 2];
	if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return 0;
	return (r + g + b) / 3.0;
}

function rgbAt(pkg, index)
{
	const offset = index * 4;
	return [
		pkg.atlas[offset],
		pkg.atlas[offset + 1],
		pkg.atlas[offset + 2],
		pkg.atlas[offset + 3]
	];
}

function metaAt(pkg, index)
{
	const offset = metaOffset(index);
	return Array.from(pkg.metadata.subarray(offset, offset + META_STRIDE));
}

function worldAt(pkg, index)
{
	const m = metaAt(pkg, index);
	return { x: m[0], y: m[1], z: m[2], nx: m[3], ny: m[4], nz: m[5], valid: isValidTexel(pkg, index), islandId: Math.round(m[8] || 0), u: m[10], v: m[11] };
}

function uvToIndex(pkg, u, v)
{
	const x = Math.max(0, Math.min(pkg.resolution - 1, Math.round(u * pkg.resolution - 0.5)));
	const y = Math.max(0, Math.min(pkg.resolution - 1, Math.round(v * pkg.resolution - 0.5)));
	return pixelIndex(pkg, x, y);
}

function worldToUv(pkg, point)
{
	const b = pkg.pointer.worldBounds;
	if (!b) return null;
	if (pkg.pointer.surfaceName === 'c1_east_wall' || pkg.pointer.surfaceName === 'c1_west_wall') {
		return {
			u: (point.z - b.zMin) / (b.zMax - b.zMin),
			v: (point.y - b.yMin) / (b.yMax - b.yMin)
		};
	}
	if (pkg.pointer.surfaceName === 'c1_south_wall' || pkg.pointer.surfaceName === 'c1_north_wall') {
		return {
			u: (point.x - b.xMin) / (b.xMax - b.xMin),
			v: (point.y - b.yMin) / (b.yMax - b.yMin)
		};
	}
	if (pkg.pointer.surfaceName === 'c1_floor_full_room' || pkg.pointer.surfaceName === 'c1_ceiling') {
		return {
			u: (point.x - b.xMin) / (b.xMax - b.xMin),
			v: (point.z - b.zMin) / (b.zMax - b.zMin)
		};
	}
	return null;
}

function sampleWorld(pkg, point)
{
	const uv = worldToUv(pkg, point);
	if (!uv) return null;
	const index = uvToIndex(pkg, uv.u, uv.v);
	const x = index % pkg.resolution;
	const y = Math.floor(index / pkg.resolution);
	return {
		name: point.name,
		world: point,
		uv,
		pixel: { x, y },
		luma: lumaAt(pkg, index),
		rgb: rgbAt(pkg, index),
		valid: isValidTexel(pkg, index),
		meta: worldAt(pkg, index)
	};
}

function round(value, digits = 6)
{
	if (!Number.isFinite(value)) return value;
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function roundObject(value, digits = 6)
{
	if (Array.isArray(value)) return value.map((item) => roundObject(item, digits));
	if (value && typeof value === 'object') {
		const result = {};
		for (const [key, child] of Object.entries(value))
			result[key] = roundObject(child, digits);
		return result;
	}
	if (typeof value === 'number') return round(value, digits);
	return value;
}

function addTopSample(samples, sample, limit = EDGE_SAMPLE_LIMIT)
{
	samples.push(sample);
	samples.sort((a, b) => Math.abs(b.luma ?? b.jump ?? 0) - Math.abs(a.luma ?? a.jump ?? 0));
	if (samples.length > limit) samples.length = limit;
}

function summarizePackage(pkg)
{
	let validTexels = 0;
	let invalidTexels = 0;
	let invalidBlackTexels = 0;
	let invalidNonzeroTexels = 0;
	let validAdjacentInvalidBlack = 0;
	let validAdjacentInvalidNonzero = 0;
	let validAdjacentInvalid = 0;
	let largeValidInvalidJumps = 0;
	let maxValidInvalidJump = 0;
	let validLumaSum = 0;
	let validNonzero = 0;
	const invalidNonzeroExamples = [];
	const validInvalidJumpExamples = [];
	const dirs = [
		{ dx: 1, dy: 0 },
		{ dx: -1, dy: 0 },
		{ dx: 0, dy: 1 },
		{ dx: 0, dy: -1 }
	];

	for (let index = 0; index < pkg.texels; index += 1) {
		const valid = isValidTexel(pkg, index);
		const luma = lumaAt(pkg, index);
		if (valid) {
			validTexels += 1;
			validLumaSum += luma;
			if (luma > LUMA_EPSILON) validNonzero += 1;
		}
		else {
			invalidTexels += 1;
			if (luma > LUMA_EPSILON) {
				invalidNonzeroTexels += 1;
				addTopSample(invalidNonzeroExamples, {
					luma,
					pixel: { x: index % pkg.resolution, y: Math.floor(index / pkg.resolution) },
					world: worldAt(pkg, index),
					rgb: rgbAt(pkg, index)
				});
			}
			else {
				invalidBlackTexels += 1;
			}
		}
	}

	for (let y = 0; y < pkg.resolution; y += 1) {
		for (let x = 0; x < pkg.resolution; x += 1) {
			const index = pixelIndex(pkg, x, y);
			if (!isValidTexel(pkg, index)) continue;
			let hasInvalid = false;
			let hasInvalidBlack = false;
			let hasInvalidNonzero = false;
			for (const dir of dirs) {
				const neighborIndex = pixelIndex(pkg, x + dir.dx, y + dir.dy);
				if (neighborIndex < 0 || isValidTexel(pkg, neighborIndex)) continue;
				hasInvalid = true;
				const neighborLuma = lumaAt(pkg, neighborIndex);
				const jump = Math.abs(lumaAt(pkg, index) - neighborLuma);
				if (neighborLuma <= LUMA_EPSILON) hasInvalidBlack = true;
				else hasInvalidNonzero = true;
				if (jump > LARGE_JUMP_THRESHOLD) largeValidInvalidJumps += 1;
				if (jump > maxValidInvalidJump) maxValidInvalidJump = jump;
				if (jump > LARGE_JUMP_THRESHOLD) {
					addTopSample(validInvalidJumpExamples, {
						jump,
						validPixel: { x, y },
						invalidPixel: { x: x + dir.dx, y: y + dir.dy },
						validLuma: lumaAt(pkg, index),
						invalidLuma: neighborLuma,
						validWorld: worldAt(pkg, index),
						invalidWorld: worldAt(pkg, neighborIndex)
					});
				}
			}
			if (hasInvalid) validAdjacentInvalid += 1;
			if (hasInvalidBlack) validAdjacentInvalidBlack += 1;
			if (hasInvalidNonzero) validAdjacentInvalidNonzero += 1;
		}
	}

	return {
		key: pkg.key,
		surfaceName: pkg.pointer.surfaceName,
		packageDir: path.relative(repoRoot, pkg.packageDir),
		resolution: pkg.resolution,
		texels: pkg.texels,
		validTexels,
		invalidTexels,
		invalidBlackTexels,
		invalidNonzeroTexels,
		validNonzeroTexels: validNonzero,
		validMeanLuma: validTexels ? validLumaSum / validTexels : 0,
		validAdjacentInvalid,
		validAdjacentInvalidBlack,
		validAdjacentInvalidNonzero,
		largeValidInvalidJumps,
		maxValidInvalidJump,
		invalidNonzeroExamples,
		validInvalidJumpExamples
	};
}

function analyzeStructuralGutters(pkg)
{
	const islands = pkg.pointer.islands || pkg.pointer.geometryGateReport?.finalIslandRegistry || [];
	const result = [];
	const radius = 2;
	for (let islandIndex = 0; islandIndex < islands.length; islandIndex += 1) {
		const island = islands[islandIndex];
		const rect = island.atlasRect;
		const xMin = Math.max(0, Math.floor(rect.uMin * pkg.resolution));
		const xMax = Math.min(pkg.resolution - 1, Math.ceil(rect.uMax * pkg.resolution) - 1);
		const yMin = Math.max(0, Math.floor(rect.vMin * pkg.resolution));
		const yMax = Math.min(pkg.resolution - 1, Math.ceil(rect.vMax * pkg.resolution) - 1);
		let borderValidTexels = 0;
		let borderAdjacentInvalidBlack = 0;
		let borderAdjacentInvalidNonzero = 0;
		let outsideRingTexels = 0;
		let outsideRingBlack = 0;
		let outsideRingNonzero = 0;
		let outsideRingOwned = 0;
		let outsideRingInvalidBlack = 0;
		let outsideRingInvalidNonzero = 0;
		const outsideExamples = [];
		for (let y = yMin - radius; y <= yMax + radius; y += 1) {
			for (let x = xMin - radius; x <= xMax + radius; x += 1) {
				if (x < 0 || x >= pkg.resolution || y < 0 || y >= pkg.resolution) continue;
				const inside = x >= xMin && x <= xMax && y >= yMin && y <= yMax;
				const index = pixelIndex(pkg, x, y);
				const valid = isValidTexel(pkg, index);
				const id = islandIdAt(pkg, index);
				if (!inside) {
					outsideRingTexels += 1;
					if (valid || id > 0) outsideRingOwned += 1;
					if (lumaAt(pkg, index) > LUMA_EPSILON) {
						outsideRingNonzero += 1;
						if (!valid && id <= 0) outsideRingInvalidNonzero += 1;
						addTopSample(outsideExamples, {
							luma: lumaAt(pkg, index),
							pixel: { x, y },
							world: worldAt(pkg, index),
							rgb: rgbAt(pkg, index)
						}, 6);
					}
					else {
						outsideRingBlack += 1;
						if (!valid && id <= 0) outsideRingInvalidBlack += 1;
					}
					continue;
				}
				const atBorder = x === xMin || x === xMax || y === yMin || y === yMax;
				if (!atBorder || !valid) continue;
				borderValidTexels += 1;
				const neighbors = [
					pixelIndex(pkg, x + 1, y),
					pixelIndex(pkg, x - 1, y),
					pixelIndex(pkg, x, y + 1),
					pixelIndex(pkg, x, y - 1)
				].filter((neighbor) => neighbor >= 0);
				for (const neighbor of neighbors) {
					if (isValidTexel(pkg, neighbor)) continue;
					if (lumaAt(pkg, neighbor) > LUMA_EPSILON) borderAdjacentInvalidNonzero += 1;
					else borderAdjacentInvalidBlack += 1;
				}
			}
		}
		result.push({
			name: island.name,
			atlasRect: rect,
			pixelRect: { xMin, xMax, yMin, yMax },
			borderValidTexels,
			borderAdjacentInvalidBlack,
			borderAdjacentInvalidNonzero,
			outsideRingTexels,
			outsideRingBlack,
			outsideRingNonzero,
			outsideRingOwned,
			outsideRingInvalidBlack,
			outsideRingInvalidNonzero,
			outsideExamples
		});
	}
	return result;
}

function lineMetrics(samples)
{
	let maxStep = 0;
	let maxStepAt = null;
	let sumStep = 0;
	let steps = 0;
	let zeroRunStart = null;
	let largeSteps = 0;
	for (let i = 1; i < samples.length; i += 1) {
		const prev = samples[i - 1];
		const current = samples[i];
		const step = Math.abs(current.luma - prev.luma);
		sumStep += step;
		steps += 1;
		if (step > maxStep) {
			maxStep = step;
			maxStepAt = { from: prev.name, to: current.name, yFrom: prev.world.y, yTo: current.world.y, step };
		}
		if (step > LARGE_JUMP_THRESHOLD) largeSteps += 1;
		if (zeroRunStart === null && current.luma <= LUMA_EPSILON)
			zeroRunStart = current.world.y;
	}
	const lumas = samples.map((sample) => sample.luma);
	const min = Math.min(...lumas);
	const max = Math.max(...lumas);
	return {
		count: samples.length,
		minLuma: min,
		maxLuma: max,
		range: max - min,
		meanAdjacentStep: steps ? sumStep / steps : 0,
		maxAdjacentStep: maxStep,
		largeAdjacentSteps: largeSteps,
		zeroRunStartY: zeroRunStart,
		maxStepAt
	};
}

function sampleWallBand(pkg, name, z, yValues)
{
	const samples = yValues.map((y) => sampleWorld(pkg, { name: `y${y.toFixed(3)}`, z, y }));
	return {
		name,
		fixedZ: z,
		samples,
		metrics: lineMetrics(samples)
	};
}

function sampleWallFineLine(pkg, name, z, yStart, yEnd, step)
{
	const samples = [];
	for (let y = yStart; y <= yEnd + 1e-9; y += step)
		samples.push(sampleWorld(pkg, { name: `y${y.toFixed(3)}`, z, y }));
	return {
		name,
		fixedZ: z,
		yStart,
		yEnd,
		step,
		metrics: lineMetrics(samples)
	};
}

function analyzeNamedProbes(packagesByKey)
{
	const east = packagesByKey.east;
	const west = packagesByKey.west;
	const south = packagesByKey.south;
	const ceiling = packagesByKey.ceiling;
	const structural = packagesByKey.structural;
	const namedY = [2.20, 2.35, 2.50, 2.515, 2.53, 2.65, 2.80];
	const southRevealPoints = [
		{ name: 'bottom_reveal_right_inside', x: 0.39, y: 1.185 },
		{ name: 'gap_bottom_to_right_mid', x: 0.425, y: 1.185 },
		{ name: 'right_reveal_lower_inside', x: 0.46, y: 1.185 },
		{ name: 'bottom_reveal_left_inside', x: -1.45, y: 1.185 },
		{ name: 'gap_bottom_to_left_mid', x: -1.485, y: 1.185 },
		{ name: 'left_reveal_lower_inside', x: -1.52, y: 1.185 },
		{ name: 'top_reveal_right_gap_mid', x: 0.425, y: 2.760 },
		{ name: 'top_reveal_left_gap_mid', x: -1.485, y: 2.760 }
	].map((point) => sampleWorld(south, point));

	const ceilingWestBeamTop = [
		{ name: 'west_beam_ceiling_before_contact', x: -1.83, z: 2.80 },
		{ name: 'west_beam_ceiling_contact_z_2_848', x: -1.83, z: 2.848 },
		{ name: 'west_beam_ceiling_above_column', x: -1.83, z: 2.95 },
		{ name: 'west_beam_ceiling_inside_room_reference', x: -1.65, z: 2.80 }
	].map((point) => sampleWorld(ceiling, point));

	const structuralIslands = structural.pointer.islands || [];
	const topFaceOwners = structuralIslands.filter((island) => island.worldFace?.axis === 'y' && Math.abs((island.worldFace?.value ?? 0) - 2.905) < 1e-6);
	const plusYOwners = structuralIslands.filter((island) => island.normal === '+Y');
	const westTopExcluded = (structural.pointer.excludedContactFaces || []).filter((item) => /top|2\.905|ceiling|west/i.test(item));

	return {
		eastBeamShadowNamed: sampleWallBand(east, 'east_wall_z_2_49_reported_band', 2.49, namedY),
		westBeamShadowNamed: sampleWallBand(west, 'west_wall_z_2_848_reported_band', 2.848, namedY),
		eastBeamShadowFine: sampleWallFineLine(east, 'east_wall_z_2_49_fine_gradient', 2.49, 2.10, 2.85, 0.015),
		westBeamShadowFine: sampleWallFineLine(west, 'west_wall_z_2_848_fine_gradient', 2.848, 2.10, 2.85, 0.015),
		southRevealLowerCorner: {
			name: 'south_reveal_lower_corner_gap_probe',
			samples: southRevealPoints,
			rightGapJump: Math.abs((southRevealPoints[1]?.luma || 0) - (southRevealPoints[0]?.luma || 0)) + Math.abs((southRevealPoints[2]?.luma || 0) - (southRevealPoints[1]?.luma || 0)),
			leftGapJump: Math.abs((southRevealPoints[4]?.luma || 0) - (southRevealPoints[3]?.luma || 0)) + Math.abs((southRevealPoints[5]?.luma || 0) - (southRevealPoints[4]?.luma || 0))
		},
		westBeamTopOwnership: {
			name: 'west_beam_top_ownership_probe',
			structuralTopFaceOwnerCount: topFaceOwners.length,
			structuralPlusYOwnerCount: plusYOwners.length,
			structuralTopFaceOwners: topFaceOwners.map((island) => island.name),
			structuralPlusYOwners: plusYOwners.map((island) => island.name),
			contractExcludedHints: westTopExcluded,
			ceilingSamples: ceilingWestBeamTop,
			classification: topFaceOwners.length === 0 && plusYOwners.length === 0 ? 'suspected_geometry_ownership_or_hidden_contact_edge' : 'owned_structural_top_face_present'
		}
	};
}

function analyzeSouthWindowFrontEdgeGuard(packagesByKey, shaderText)
{
	const south = packagesByKey.south;
	const frontEdgeSamples = [
		{ name: 'bottom_hole_gap_center', x: 0.0, y: 1.075 },
		{ name: 'bottom_hole_gap_near_edge', x: 0.0, y: 1.095 },
		{ name: 'bottom_reveal_room_edge_center', x: 0.0, y: 1.10 },
		{ name: 'bottom_left_corner_exact', x: -1.52, y: 1.10 },
		{ name: 'bottom_right_corner_exact', x: 0.46, y: 1.10 },
		{ name: 'right_hole_gap_mid', x: 0.455, y: 1.90 },
		{ name: 'right_reveal_front_edge_mid', x: 0.465, y: 1.90 }
	].map((point) => sampleWorld(south, point));
	const blackGapSamples = frontEdgeSamples.filter((sample) => sample.valid === false && sample.luma <= LUMA_EPSILON);
	const zeroValidCornerSamples = frontEdgeSamples.filter((sample) => sample.valid === true && sample.luma <= LUMA_EPSILON);
	const guardPresent =
		/r7310C1SouthWallWindowFrontEdgeDiffuseUv/.test(shaderText) &&
		/r7310C1SouthWallFrontHoleEdgeBand/.test(shaderText) &&
		/r7310C1SouthWallClampPackedX/.test(shaderText) &&
		/r7310C1SouthWallClampPackedY/.test(shaderText);
	return {
		name: 'south_window_front_edge_guard_probe',
		guardPresent,
		blackGapSamples,
		zeroValidCornerSamples,
		samples: frontEdgeSamples,
		classification: guardPresent
			? 'runtime_front_edge_guard_present'
			: (blackGapSamples.length > 0 || zeroValidCornerSamples.length > 0
				? 'front_hole_edge_black_gap_unprotected'
				: 'no_front_edge_black_gap_detected')
	};
}

function analyzeSouthRevealCornerClamp(packagesByKey, shaderText)
{
	const south = packagesByKey.south;
	const samples = [
		{ name: 'right_side_reveal_bottom_row_front', x: 0.46, y: 1.10 },
		{ name: 'right_side_reveal_bottom_row_mid', x: 0.545, y: 1.10 },
		{ name: 'right_side_reveal_interior_mid', x: 0.545, y: 1.185 },
		{ name: 'left_side_reveal_bottom_row_front', x: -1.69, y: 1.10 },
		{ name: 'left_side_reveal_bottom_row_mid', x: -1.60, y: 1.10 },
		{ name: 'left_side_reveal_interior_mid', x: -1.60, y: 1.185 },
		{ name: 'bottom_reveal_right_corner_edge', x: 0.46, y: 1.10 },
		{ name: 'bottom_reveal_right_inner', x: 0.44, y: 1.10 },
		{ name: 'bottom_reveal_left_corner_edge', x: -1.52, y: 1.10 },
		{ name: 'bottom_reveal_left_inner', x: -1.50, y: 1.10 }
	].map((point) => sampleWorld(south, point));
	const blackEdgeSamples = samples.filter((sample) => sample.luma <= LUMA_EPSILON);
	const clampPresent =
		/r7310C1SouthWallClampPackedX\(mix\(-1\.69, -1\.52, revealT\), -1\.69, -1\.52\)/.test(shaderText) &&
		/r7310C1SouthWallClampPackedY\(mix\(1\.10, 2\.845, \(visiblePosition\.y - 1\.04\) \/ \(2\.905 - 1\.04\)\), 1\.10, 2\.845\)/.test(shaderText) &&
		/r7310C1SouthWallClampPackedX\(mix\(0\.46, 0\.63, revealT\), 0\.46, 0\.63\)/.test(shaderText) &&
		/r7310C1SouthWallClampPackedX\(mix\(-1\.52, 0\.46, \(visiblePosition\.x \+ 1\.75\) \/ \(0\.69 \+ 1\.75\)\), -1\.52, 0\.46\)/.test(shaderText) &&
		/r7310C1SouthWallClampPackedY\(mix\(1\.10, 1\.27, revealT\), 1\.10, 1\.27\)/.test(shaderText);
	return {
		name: 'south_reveal_lower_90_degree_corner_clamp_probe',
		clampPresent,
		blackEdgeSamples,
		samples,
		classification: clampPresent
			? 'runtime_reveal_corner_clamp_present'
			: (blackEdgeSamples.length > 0 ? 'reveal_corner_black_edge_unprotected' : 'no_reveal_corner_black_edge_detected')
	};
}

function classifyFindings(packageSummaries, structuralGutters, namedProbes, southWindowFrontEdgeGuard, southRevealCornerClamp)
{
	const invalidNonzero = packageSummaries
		.filter((summary) => summary.invalidNonzeroTexels > 0)
		.map((summary) => ({ surfaceName: summary.surfaceName, invalidNonzeroTexels: summary.invalidNonzeroTexels, examples: summary.invalidNonzeroExamples.slice(0, 3) }));
	const validNextToBlack = packageSummaries
		.filter((summary) => summary.validAdjacentInvalidBlack > 0)
		.map((summary) => ({ surfaceName: summary.surfaceName, validAdjacentInvalidBlack: summary.validAdjacentInvalidBlack, maxValidInvalidJump: summary.maxValidInvalidJump }));
	const missingGutters = structuralGutters
		.filter((item) => item.borderAdjacentInvalidBlack > 0 || item.borderAdjacentInvalidNonzero > 0 || item.outsideRingInvalidBlack > 0 || item.outsideRingInvalidNonzero > 0)
		.map((item) => ({
			name: item.name,
			borderAdjacentInvalidBlack: item.borderAdjacentInvalidBlack,
			borderAdjacentInvalidNonzero: item.borderAdjacentInvalidNonzero,
			outsideRingBlack: item.outsideRingBlack,
			outsideRingNonzero: item.outsideRingNonzero,
			outsideRingInvalidBlack: item.outsideRingInvalidBlack,
			outsideRingInvalidNonzero: item.outsideRingInvalidNonzero
		}));
	const softGradient = [
		namedProbes.eastBeamShadowFine,
		namedProbes.westBeamShadowFine
	].map((probe) => ({
		name: probe.name,
		maxAdjacentStep: probe.metrics.maxAdjacentStep,
		largeAdjacentSteps: probe.metrics.largeAdjacentSteps,
		zeroRunStartY: probe.metrics.zeroRunStartY,
		classification: probe.metrics.largeAdjacentSteps > 0 ? 'large_step_present' : 'no_large_step_above_threshold'
	}));
	const southGap = namedProbes.southRevealLowerCorner;
	return {
		validTexelsAdjacentToInvalidBlack: validNextToBlack,
		invalidTexelsWithNonzeroRgb: invalidNonzero,
		structuralPackedIslandMissingGutter: missingGutters,
		softGradientStairStepMetrics: softGradient,
		southRevealLowerCornerGap: {
			rightGapJump: southGap.rightGapJump,
			leftGapJump: southGap.leftGapJump,
			classification: (southGap.rightGapJump > LARGE_JUMP_THRESHOLD || southGap.leftGapJump > LARGE_JUMP_THRESHOLD) ? 'gap_or_strong_luma_jump_present' : 'no_large_gap_jump_at_probe_points'
		},
		southWindowFrontEdgeGuard: {
			classification: southWindowFrontEdgeGuard.classification,
			guardPresent: southWindowFrontEdgeGuard.guardPresent,
			blackGapSampleCount: southWindowFrontEdgeGuard.blackGapSamples.length,
			zeroValidCornerSampleCount: southWindowFrontEdgeGuard.zeroValidCornerSamples.length
		},
		southRevealCornerClamp: {
			classification: southRevealCornerClamp.classification,
			clampPresent: southRevealCornerClamp.clampPresent,
			blackEdgeSampleCount: southRevealCornerClamp.blackEdgeSamples.length
		},
		westBeamTopOwnership: {
			classification: namedProbes.westBeamTopOwnership.classification,
			structuralTopFaceOwnerCount: namedProbes.westBeamTopOwnership.structuralTopFaceOwnerCount,
			structuralPlusYOwnerCount: namedProbes.westBeamTopOwnership.structuralPlusYOwnerCount
		}
	};
}

function printHumanSummary(report, options = {})
{
	console.log('R7-3.10 atlas seam audit');
	console.log(`status: ${report.status}`);
	console.log(`packages: ${report.packageSummaries.length}`);
	console.log('');
	console.log('Bucket summary:');
	console.log(`  valid texels adjacent to invalid black: ${report.findings.validTexelsAdjacentToInvalidBlack.length} surfaces`);
	console.log(`  invalid texels with nonzero RGB: ${report.findings.invalidTexelsWithNonzeroRgb.length} surfaces`);
	console.log(`  structural packed island missing gutter: ${report.findings.structuralPackedIslandMissingGutter.length} islands`);
	console.log(`  south reveal lower corner: ${report.findings.southRevealLowerCornerGap.classification}`);
	console.log(`  south window front edge guard: ${report.findings.southWindowFrontEdgeGuard.classification}`);
	console.log(`  south reveal 90-degree corner clamp: ${report.findings.southRevealCornerClamp.classification}`);
	console.log(`  west beam top ownership: ${report.findings.westBeamTopOwnership.classification}`);
	console.log('');
	console.log('Soft-gradient probes:');
	for (const item of report.findings.softGradientStairStepMetrics) {
		console.log(`  ${item.name}: maxStep=${round(item.maxAdjacentStep, 6)}, largeSteps=${item.largeAdjacentSteps}, zeroRunStartY=${item.zeroRunStartY === null ? 'null' : round(item.zeroRunStartY, 6)}`);
	}
	console.log('');
	console.log('Named probe highlights:');
	const eastNamed = report.namedProbes.eastBeamShadowNamed.samples.map((sample) => `${sample.name}:${round(sample.luma, 4)}`).join(', ');
	const westNamed = report.namedProbes.westBeamShadowNamed.samples.map((sample) => `${sample.name}:${round(sample.luma, 4)}`).join(', ');
	const southNamed = report.namedProbes.southRevealLowerCorner.samples.map((sample) => `${sample.name}:${round(sample.luma, 4)}${sample.valid ? '' : '/invalid'}`).join(', ');
	const southFrontEdgeNamed = report.southWindowFrontEdgeGuard.samples.map((sample) => `${sample.name}:${round(sample.luma, 4)}${sample.valid ? '' : '/invalid'}`).join(', ');
	const southCornerNamed = report.southRevealCornerClamp.samples.map((sample) => `${sample.name}:${round(sample.luma, 4)}${sample.valid ? '' : '/invalid'}`).join(', ');
	console.log(`  east wall z=2.49: ${eastNamed}`);
	console.log(`  west wall z=2.848: ${westNamed}`);
	console.log(`  south reveal lower: ${southNamed}`);
	console.log(`  south window front edge: ${southFrontEdgeNamed}`);
	console.log(`  south reveal 90-degree corner: ${southCornerNamed}`);
	console.log('');
	console.log('Top package findings:');
	for (const item of report.packageSummaries) {
		if (item.invalidNonzeroTexels === 0 && item.validAdjacentInvalidBlack === 0) continue;
		console.log(`  ${item.surfaceName}: invalidNonzero=${item.invalidNonzeroTexels}, validNextToInvalidBlack=${item.validAdjacentInvalidBlack}, maxJump=${round(item.maxValidInvalidJump, 6)}`);
	}
	console.log('');
	console.log('Run with --json for the full machine-readable report.');
	if (options.json) {
		console.log('');
		console.log('JSON report:');
		console.log(JSON.stringify(roundObject(report), null, 2));
	}
}

function main()
{
	const packages = POINTERS.map(loadPackage);
	const packagesByKey = Object.fromEntries(packages.map((pkg) => [pkg.key, pkg]));
	const shaderText = fs.readFileSync(path.join(repoRoot, SHADER_PATH), 'utf8');
	const packageSummaries = packages.map(summarizePackage);
	const structuralGutters = analyzeStructuralGutters(packagesByKey.structural);
	const namedProbes = analyzeNamedProbes(packagesByKey);
	const southWindowFrontEdgeGuard = analyzeSouthWindowFrontEdgeGuard(packagesByKey, shaderText);
	const southRevealCornerClamp = analyzeSouthRevealCornerClamp(packagesByKey, shaderText);
	const findings = classifyFindings(packageSummaries, structuralGutters, namedProbes, southWindowFrontEdgeGuard, southRevealCornerClamp);
	const report = {
		version: 'r7-3-10-atlas-seam-audit-v3',
		status: 'pass',
		method: {
			metadataStride: META_STRIDE,
			validFlag: 'metadata[7] > 0.5, except floor package treated as valid by current R7-3.10 convention',
			luma: '(r + g + b) / 3',
			largeJumpThreshold: LARGE_JUMP_THRESHOLD,
			lumaEpsilon: LUMA_EPSILON
		},
		packageSummaries,
		structuralGutters,
		namedProbes,
		southWindowFrontEdgeGuard,
		southRevealCornerClamp,
		findings
	};
	printHumanSummary(report, { json: process.argv.includes('--json') });
}

main();
