#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_OUT = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-231459/full-north-wall-westbeam-dark-source-diagnostic.json';
const DEFAULT_EDGE_JSON = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-231459/a1-d800-live-seam-comparison.json';
const FULL_POINTER = 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json';
const META_STRIDE = 12;
const WALL_Z = -1.874;

function argValue(name, fallback)
{
	const prefix = `--${name}=`;
	const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : fallback;
}

function readJson(file)
{
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readF32(file, expectedFloats)
{
	const buffer = fs.readFileSync(file);
	if (expectedFloats != null && buffer.byteLength !== expectedFloats * 4)
		throw new Error(`${file} byte size mismatch: got ${buffer.byteLength}, expected ${expectedFloats * 4}`);
	return new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function round(value, digits = 9)
{
	if (!Number.isFinite(value)) return value;
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function luma(rgb)
{
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function loadFullPackage()
{
	const pointer = readJson(FULL_POINTER);
	const width = Math.trunc(Number(pointer.targetAtlasWidth) || 0);
	const height = Math.trunc(Number(pointer.targetAtlasHeight) || 0);
	const atlasPath = path.join(pointer.packageDir, pointer.artifacts.atlasPatch0);
	const metadataPath = path.join(pointer.packageDir, pointer.artifacts.texelMetadataPatch0);
	return {
		pointerPath: FULL_POINTER,
		pointer,
		width,
		height,
		atlasPath,
		metadataPath,
		atlas: readF32(atlasPath, width * height * 4),
		metadata: readF32(metadataPath, width * height * META_STRIDE)
	};
}

function fullWallUv(world)
{
	const y01 = Math.max(0, Math.min(1, world.y / 2.905));
	const x01 = Math.max(0, Math.min(1, (world.x + 2.11) / 4.22));
	return {
		u: (0.9997849464 * (1 - y01)) + (0.0002150538 * y01),
		v: (0.0001480604 * (1 - x01)) + (0.9998519421 * x01),
		local01: { x: x01, y: y01 },
		world
	};
}

function texel(pkg, x, y)
{
	const px = Math.max(0, Math.min(pkg.width - 1, Math.floor(Number(x) + 0.5)));
	const py = Math.max(0, Math.min(pkg.height - 1, Math.floor(Number(y) + 0.5)));
	const i = (py * pkg.width + px) * 4;
	const rgb = {
		r: pkg.atlas[i] || 0,
		g: pkg.atlas[i + 1] || 0,
		b: pkg.atlas[i + 2] || 0
	};
	return {
		pixel: { x: px, y: py },
		r: rgb.r,
		g: rgb.g,
		b: rgb.b,
		a: pkg.atlas[i + 3] || 0,
		luma: luma(rgb)
	};
}

function metadataTexel(pkg, x, y)
{
	const px = Math.max(0, Math.min(pkg.width - 1, Math.floor(Number(x) + 0.5)));
	const py = Math.max(0, Math.min(pkg.height - 1, Math.floor(Number(y) + 0.5)));
	const offset = (py * pkg.width + px) * META_STRIDE;
	const normal = {
		x: pkg.metadata[offset + 3],
		y: pkg.metadata[offset + 4],
		z: pkg.metadata[offset + 5]
	};
	const world = {
		x: pkg.metadata[offset],
		y: pkg.metadata[offset + 1],
		z: pkg.metadata[offset + 2]
	};
	return {
		pixel: { x: px, y: py },
		world,
		normal,
		normalLen: Math.hypot(normal.x, normal.y, normal.z),
		tri0: pkg.metadata[offset + 6],
		valid: pkg.metadata[offset + 7],
		tri1: pkg.metadata[offset + 8],
		tri2: pkg.metadata[offset + 9],
		uv: {
			u: pkg.metadata[offset + 10],
			v: pkg.metadata[offset + 11]
		}
	};
}

function sampleValidLinear(pkg, uv)
{
	const px = Math.max(0, Math.min(pkg.width - 1, Number(uv.u) * pkg.width - 0.5));
	const py = Math.max(0, Math.min(pkg.height - 1, Number(uv.v) * pkg.height - 0.5));
	const p0x = Math.floor(px);
	const p0y = Math.floor(py);
	const p1x = Math.min(p0x + 1, pkg.width - 1);
	const p1y = Math.min(p0y + 1, pkg.height - 1);
	const tx = px - p0x;
	const ty = py - p0y;
	const c00 = texel(pkg, p0x, p0y);
	const c10 = texel(pkg, p1x, p0y);
	const c01 = texel(pkg, p0x, p1y);
	const c11 = texel(pkg, p1x, p1y);
	const w00 = (1 - tx) * (1 - ty) * c00.a;
	const w10 = tx * (1 - ty) * c10.a;
	const w01 = (1 - tx) * ty * c01.a;
	const w11 = tx * ty * c11.a;
	const weightSum = w00 + w10 + w01 + w11;
	let radiance = { r: 0, g: 0, b: 0, luma: 0 };
	let validLinear = false;
	if (weightSum > 0.000001) {
		radiance = {
			r: Math.max(0, (c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11) / weightSum),
			g: Math.max(0, (c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11) / weightSum),
			b: Math.max(0, (c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11) / weightSum)
		};
		radiance.luma = luma(radiance);
		validLinear = true;
	}
	const nearest = texel(pkg, Math.floor(px + 0.5), Math.floor(py + 0.5));
	if (!validLinear && nearest.a > 0.5) {
		radiance = { r: Math.max(0, nearest.r), g: Math.max(0, nearest.g), b: Math.max(0, nearest.b) };
		radiance.luma = luma(radiance);
		validLinear = true;
	}
	const meta = metadataTexel(pkg, Math.floor(px + 0.5), Math.floor(py + 0.5));
	return {
		validLinear,
		pixelFloat: { x: round(px, 6), y: round(py, 6) },
		p0: { x: p0x, y: p0y },
		p1: { x: p1x, y: p1y },
		tx: round(tx, 9),
		ty: round(ty, 9),
		weightSum: round(weightSum, 9),
		cornerAlpha: { c00: c00.a, c10: c10.a, c01: c01.a, c11: c11.a },
		cornerLuma: {
			c00: round(c00.luma, 9),
			c10: round(c10.luma, 9),
			c01: round(c01.luma, 9),
			c11: round(c11.luma, 9)
		},
		nearest,
		radiance: {
			r: round(radiance.r, 9),
			g: round(radiance.g, 9),
			b: round(radiance.b, 9),
			luma: round(radiance.luma, 9)
		},
		metadata: summarizeMetadata(meta, uv.world)
	};
}

function summarizeMetadata(meta, world)
{
	return {
		valid: meta.valid,
		tri0: meta.tri0,
		tri1: meta.tri1,
		tri2: meta.tri2,
		normalLen: round(meta.normalLen, 9),
		normal: {
			x: round(meta.normal.x, 9),
			y: round(meta.normal.y, 9),
			z: round(meta.normal.z, 9)
		},
		world: {
			x: round(meta.world.x, 9),
			y: round(meta.world.y, 9),
			z: round(meta.world.z, 9)
		},
		worldDeltaMeters: round(Math.hypot(meta.world.x - world.x, meta.world.y - world.y, meta.world.z - world.z), 9)
	};
}

function neighborhoodStats(pkg, centerX, centerY, radius)
{
	let alphaOne = 0;
	let alphaZero = 0;
	const lumas = [];
	for (let y = centerY - radius; y <= centerY + radius; y += 1) {
		for (let x = centerX - radius; x <= centerX + radius; x += 1) {
			const t = texel(pkg, x, y);
			if (t.a > 0.5) {
				alphaOne += 1;
				lumas.push(t.luma);
			} else {
				alphaZero += 1;
			}
		}
	}
	lumas.sort((a, b) => a - b);
	const mean = lumas.length ? lumas.reduce((sum, value) => sum + value, 0) / lumas.length : 0;
	return {
		radius,
		alphaOne,
		alphaZero,
		alphaZeroFraction: round(alphaZero / Math.max(1, alphaOne + alphaZero), 9),
		lumaAlphaOne: lumas.length ? {
			min: round(lumas[0], 9),
			p25: round(lumas[Math.floor((lumas.length - 1) * 0.25)], 9),
			median: round(lumas[Math.floor((lumas.length - 1) * 0.5)], 9),
			p75: round(lumas[Math.floor((lumas.length - 1) * 0.75)], 9),
			max: round(lumas[lumas.length - 1], 9),
			mean: round(mean, 9)
		} : null
	};
}

function nearestAlphaZero(pkg, centerX, centerY, maxRadius)
{
	let best = null;
	for (let radius = 1; radius <= maxRadius; radius += 1) {
		for (let y = centerY - radius; y <= centerY + radius; y += 1) {
			for (let x = centerX - radius; x <= centerX + radius; x += 1) {
				if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) !== radius) continue;
				const t = texel(pkg, x, y);
				if (t.a > 0.5) continue;
				const dx = x - centerX;
				const dy = y - centerY;
				const distance = Math.hypot(dx, dy);
				if (!best || distance < best.distancePx)
					best = { pixel: t.pixel, dx, dy, distancePx: distance };
			}
		}
		if (best) break;
	}
	return best ? {
		pixel: best.pixel,
		dx: best.dx,
		dy: best.dy,
		distancePx: round(best.distancePx, 6),
		approxDistanceMeters: round(best.distancePx * 0.00125, 9)
	} : null;
}

function scanAlongWorldX(pkg, world)
{
	const offsets = [-0.006, -0.004, -0.0025, -0.0015, -0.001, -0.0005, 0, 0.0005, 0.001, 0.0015, 0.0025, 0.004, 0.006, 0.010];
	return offsets.map((dx) => {
		const sampleWorld = { x: world.x + dx, y: world.y, z: world.z };
		const sample = sampleValidLinear(pkg, fullWallUv(sampleWorld));
		return {
			dxMeters: round(dx, 6),
			worldX: round(sampleWorld.x, 9),
			ownerSide: sampleWorld.x < -1.752 ? 'west_gap_excluded_side' : 'north_wall_side',
			validLinear: sample.validLinear,
			alphaNearest: sample.nearest.a,
			luma: sample.radiance.luma,
			pixelFloat: sample.pixelFloat
		};
	});
}

function deriveEdgePoints(edgeJson)
{
	return edgeJson.edgeScan.selected
		.filter((entry) => entry.found && entry.route && entry.route.routeName === 'north_wall_hybrid')
		.map((entry) => ({
			baseName: entry.baseName,
			world: {
				x: entry.worldPosition.x,
				y: entry.worldPosition.y,
				z: entry.worldPosition.z
			},
			d800FinalLuma: entry.d800Final.mean3x3.luma,
			liveFinalLuma: entry.liveFinal.mean3x3.luma,
			d800OverLiveLuma: entry.compare.d800OverLiveLuma,
			d800PreAlbedoLuma: entry.selectedProbe.level49.decoded.luma,
			d800HybridLuma: entry.selectedProbe.level36.decoded.luma,
			rtPixel: entry.rtPixel,
			dx: entry.dx
		}));
}

function samplePoint(pkg, point)
{
	const uv = fullWallUv(point.world);
	const sample = sampleValidLinear(pkg, uv);
	const cx = Math.floor(sample.pixelFloat.x + 0.5);
	const cy = Math.floor(sample.pixelFloat.y + 0.5);
	const meta = sample.metadata;
	const splitDistance = Math.abs(uv.local01.y - uv.local01.x);
	return {
		baseName: point.baseName,
		world: {
			x: round(point.world.x, 9),
			y: round(point.world.y, 9),
			z: round(point.world.z, 9)
		},
		fullWallUv: {
			u: round(uv.u, 9),
			v: round(uv.v, 9),
			local01: { x: round(uv.local01.x, 9), y: round(uv.local01.y, 9) },
			diagonalTriSplitDistance01: round(splitDistance, 9),
			triangleByFormula: uv.local01.y <= uv.local01.x ? 0 : 1
		},
		fullXatlasRaw: sample,
		fullVsD800PreAlbedo: {
			fullLuma: sample.radiance.luma,
			d800PreAlbedoLuma: round(point.d800PreAlbedoLuma, 9),
			ratio: point.d800PreAlbedoLuma > 0.000001 ? round(sample.radiance.luma / point.d800PreAlbedoLuma, 9) : null,
			delta: round(sample.radiance.luma - point.d800PreAlbedoLuma, 9)
		},
		fullVsRuntime: {
			d800FinalLuma: round(point.d800FinalLuma, 9),
			liveFinalLuma: round(point.liveFinalLuma, 9),
			d800OverLiveLuma: round(point.d800OverLiveLuma, 9)
		},
		metadataFlags: {
			normalOk: meta.normalLen >= 0.99 && meta.normalLen <= 1.01,
			worldDeltaOk: meta.worldDeltaMeters <= 0.002,
			valid: meta.valid
		},
		nearestAlphaZero: nearestAlphaZero(pkg, cx, cy, 64),
		neighborhood: [1, 2, 4, 8, 16].map((radius) => neighborhoodStats(pkg, cx, cy, radius)),
		worldXScan: scanAlongWorldX(pkg, point.world)
	};
}

function summarize(points)
{
	const ratios = points.map((point) => point.fullVsD800PreAlbedo.ratio).filter(Number.isFinite);
	const deltas = points.map((point) => point.fullVsD800PreAlbedo.delta).filter(Number.isFinite);
	const nearestDistances = points.map((point) => point.nearestAlphaZero ? point.nearestAlphaZero.distancePx : null).filter(Number.isFinite);
	const metadataOk = points.every((point) => point.metadataFlags.normalOk && point.metadataFlags.worldDeltaOk);
	return {
		pointCount: points.length,
		meanFullOverD800PreAlbedo: round(ratios.reduce((sum, value) => sum + value, 0) / Math.max(1, ratios.length), 9),
		meanFullMinusD800PreAlbedo: round(deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length), 9),
		minNearestAlphaZeroDistancePx: nearestDistances.length ? round(Math.min(...nearestDistances), 6) : null,
		maxNearestAlphaZeroDistancePx: nearestDistances.length ? round(Math.max(...nearestDistances), 6) : null,
		metadataAllNormalAndAligned: metadataOk,
		allFullSamplesValid: points.every((point) => point.fullXatlasRaw.validLinear),
		allNearestAlphaOne: points.every((point) => point.fullXatlasRaw.nearest.a > 0.5)
	};
}

function main()
{
	const outPath = argValue('out', DEFAULT_OUT);
	const edgePath = argValue('edge-json', DEFAULT_EDGE_JSON);
	const fullPkg = loadFullPackage();
	const edgeJson = readJson(edgePath);
	const edgePoints = deriveEdgePoints(edgeJson);
	const points = edgePoints.map((point) => samplePoint(fullPkg, point));
	const report = {
		schema: 'r7-3-10-full-north-wall-westbeam-dark-source-diagnostic-v1',
		createdAt: new Date().toISOString(),
		inputs: {
			edgeJson: edgePath,
			fullPointer: FULL_POINTER,
			note: 'CPU atlas/metadata diagnostic only; no product runtime changes and no bake.'
		},
		packages: {
			fullWallRaw: {
				packageDir: fullPkg.pointer.packageDir,
				size: [fullPkg.width, fullPkg.height],
				runtimeScope: fullPkg.pointer.runtimeScope,
				alphaAudit: fullPkg.pointer.alphaAudit || null
			}
		},
		summary: summarize(points),
		points
	};
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
	console.log(JSON.stringify({
		result: 'PASS',
		out: outPath,
		summary: report.summary,
		points: points.map((point) => ({
			baseName: point.baseName,
			fullLuma: point.fullVsD800PreAlbedo.fullLuma,
			d800PreAlbedoLuma: point.fullVsD800PreAlbedo.d800PreAlbedoLuma,
			ratio: point.fullVsD800PreAlbedo.ratio,
			nearestAlphaZero: point.nearestAlphaZero,
			normalLen: point.fullXatlasRaw.metadata.normalLen,
			worldDeltaMeters: point.fullXatlasRaw.metadata.worldDeltaMeters
		}))
	}, null, 2));
}

main();
