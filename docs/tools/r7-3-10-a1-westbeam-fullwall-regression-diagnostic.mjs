#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_OUT = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-231459/a1-westbeam-fullwall-regression-diagnostic.json';
const A1_POINTER = 'docs/data/r7-3-10-xatlas-a1-westbeam-full4x-1000spp-runtime-package.json';
const FULL_POINTER = 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json';
const META_STRIDE = 12;
const WALL_Z = -1.874;
const USER_CAMERA = {
	position: { x: -1.689919, y: 2.532431, z: -1.817399 },
	forward: { x: -0.551372, y: 0.521834, z: -0.650905 },
	yaw: 0.7028,
	pitch: 0.549,
	fov: 55
};

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

function luma(rgb)
{
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function round(value, digits = 6)
{
	if (!Number.isFinite(value)) return value;
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function loadPackage(pointerPath)
{
	const pointer = readJson(pointerPath);
	const width = Math.trunc(Number(pointer.targetAtlasWidth) || 0);
	const height = Math.trunc(Number(pointer.targetAtlasHeight) || 0);
	const packageDir = pointer.packageDir;
	const atlasPath = path.join(packageDir, pointer.artifacts.atlasPatch0);
	const metadataPath = path.join(packageDir, pointer.artifacts.texelMetadataPatch0);
	return {
		pointerPath,
		pointer,
		width,
		height,
		packageDir,
		atlasPath,
		metadataPath,
		atlas: readF32(atlasPath, width * height * 4),
		metadata: readF32(metadataPath, width * height * META_STRIDE)
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
	return {
		pixel: { x: px, y: py },
		world: {
			x: pkg.metadata[offset],
			y: pkg.metadata[offset + 1],
			z: pkg.metadata[offset + 2]
		},
		normal: {
			x: pkg.metadata[offset + 3],
			y: pkg.metadata[offset + 4],
			z: pkg.metadata[offset + 5]
		},
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
		weightSum: round(weightSum, 9),
		nearest,
		cornerAlpha: {
			c00: c00.a,
			c10: c10.a,
			c01: c01.a,
			c11: c11.a
		},
		radiance: {
			r: round(radiance.r, 9),
			g: round(radiance.g, 9),
			b: round(radiance.b, 9),
			luma: round(radiance.luma, 9)
		},
		metadata: {
			valid: meta.valid,
			tri0: meta.tri0,
			tri1: meta.tri1,
			tri2: meta.tri2,
			world: {
				x: round(meta.world.x, 9),
				y: round(meta.world.y, 9),
				z: round(meta.world.z, 9)
			},
			worldDeltaMeters: round(Math.hypot(meta.world.x - uv.world.x, meta.world.y - uv.world.y, meta.world.z - uv.world.z), 9)
		}
	};
}

function a1Uv(world)
{
	const y01 = Math.max(0, Math.min(1, world.y / 2.905));
	const x01 = Math.max(0, Math.min(1, (world.x + 1.91) / 0.39));
	return {
		u: (0.6146934628 * (1 - y01)) + (0.0005285412 * y01),
		v: (0.3594961166 * (1 - x01)) + (0.5106589198 * x01),
		local01: { x: x01, y: y01 },
		world
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

function insideRectXY(x, y, rect)
{
	return x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
}

function ownerExcluded(x, y)
{
	const sideWall = x <= -1.91 || x >= 1.91;
	const doorHole = insideRectXY(x, y, { xMin: -1.51, xMax: -0.69, yMin: 0.0, yMax: 2.04 });
	const westBeamGap = insideRectXY(x, y, { xMin: -1.908, xMax: -1.752, yMin: 2.525, yMax: 2.905 });
	const eastBeamGap = insideRectXY(x, y, { xMin: 1.85, xMax: 1.908, yMin: 2.516, yMax: 2.905 });
	return { excluded: sideWall || doorHole || westBeamGap || eastBeamGap, sideWall, doorHole, westBeamGap, eastBeamGap };
}

function inBounds(world, bounds)
{
	return world.x >= bounds.xMin && world.x <= bounds.xMax &&
		world.y >= bounds.yMin && world.y <= bounds.yMax &&
		Math.abs(world.z - bounds.z) <= bounds.zTolerance;
}

function route(world)
{
	const excluded = ownerExcluded(world.x, world.y);
	const d800InBounds = inBounds(world, { xMin: -2.11, xMax: 2.11, yMin: -0.002, yMax: 2.907, z: WALL_Z, zTolerance: 0.006 });
	const fullInBounds = d800InBounds;
	const a1InBounds = inBounds(world, { xMin: -1.912, xMax: -1.518, yMin: -0.002, yMax: 2.907, z: WALL_Z, zTolerance: 0.006 });
	const activeOwners = [];
	if (d800InBounds && !excluded.excluded)
		activeOwners.push({ id: 'r7310-c1-d800-north-wall', precedence: 100 });
	if (a1InBounds && !excluded.excluded)
		activeOwners.push({ id: 'r7310-c1-xatlas-a1-north-wall', precedence: 200 });
	activeOwners.sort((a, b) => b.precedence - a.precedence);
	return {
		ownerExcluded: excluded,
		d800InBounds,
		fullXatlasInBounds: fullInBounds,
		fullXatlasPolicy: {
			id: 'r7310-c1-xatlas-full-north-wall',
			precedence: 150,
			status: 'provisional',
			supersedes: ['r7310-c1-xatlas-a1-north-wall']
		},
		a1InBounds,
		activeOwners,
		routeHelperWinner: activeOwners.length ? activeOwners[0].id : 'none',
		shaderRouteWhenA1Package: a1InBounds && !excluded.excluded ? 'a1-uv' : 'live-or-other',
		shaderRouteWhenFullWallPackage: fullInBounds && !excluded.excluded ? 'full-wall-uv' : 'live-or-other'
	};
}

function cameraWallHit()
{
	const t = (WALL_Z - USER_CAMERA.position.z) / USER_CAMERA.forward.z;
	return {
		x: USER_CAMERA.position.x + USER_CAMERA.forward.x * t,
		y: USER_CAMERA.position.y + USER_CAMERA.forward.y * t,
		z: WALL_Z,
		t
	};
}

function makeTargets()
{
	const hit = cameraWallHit();
	const boundaryX = -1.752;
	const ys = [2.526, 2.532431, 2.55, round(hit.y, 6), 2.7];
	const targets = [
		{ name: 'user_camera_center_wall_hit', x: hit.x, y: hit.y, z: WALL_Z },
		{ name: 'below_gap_control_visible', x: -1.7515, y: 2.52, z: WALL_Z }
	];
	for (const y of ys) {
		targets.push({ name: `west_gap_left_live_x${boundaryX - 0.0005}_y${y}`, x: boundaryX - 0.0005, y, z: WALL_Z });
		targets.push({ name: `west_gap_right_atlas_x${boundaryX + 0.0005}_y${y}`, x: boundaryX + 0.0005, y, z: WALL_Z });
		targets.push({ name: `west_gap_right_5mm_x${boundaryX + 0.005}_y${y}`, x: boundaryX + 0.005, y, z: WALL_Z });
		targets.push({ name: `west_gap_user_xline_y${y}`, x: hit.x, y, z: WALL_Z });
	}
	return targets;
}

function sampleTarget(target, a1Pkg, fullPkg)
{
	const world = { x: target.x, y: target.y, z: target.z };
	const r = route(world);
	const a1 = sampleValidLinear(a1Pkg, a1Uv(world));
	const full = sampleValidLinear(fullPkg, fullWallUv(world));
	return {
		name: target.name,
		world: {
			x: round(world.x, 9),
			y: round(world.y, 9),
			z: round(world.z, 9)
		},
		route: r,
		a1KnownGoodRaw: a1,
		fullWallRaw: full,
		compare: {
			fullMinusA1Luma: round(full.radiance.luma - a1.radiance.luma, 9),
			fullOverA1Luma: a1.radiance.luma > 0.000001 ? round(full.radiance.luma / a1.radiance.luma, 9) : null,
			fullAlphaMinusA1Alpha: round(full.nearest.a - a1.nearest.a, 9),
			routeWinnerDiffersFromFullWallShaderRoute: r.routeHelperWinner === 'r7310-c1-xatlas-a1-north-wall' &&
				r.shaderRouteWhenFullWallPackage === 'full-wall-uv'
		}
	};
}

function summarize(samples)
{
	const visible = samples.filter((s) => !s.route.ownerExcluded.excluded && s.route.a1InBounds);
	const desync = visible.filter((s) => s.compare.routeWinnerDiffersFromFullWallShaderRoute);
	const leftRight = [];
	for (let i = 0; i < samples.length; i += 1) {
		const left = samples[i];
		if (!left.name.includes('west_gap_left_live')) continue;
		const rightName = left.name.replace('west_gap_left_live_x-1.7525', 'west_gap_right_atlas_x-1.7515');
		const right = samples.find((s) => s.name === rightName);
		if (!right) continue;
		leftRight.push({
			y: left.world.y,
			leftOwnerExcluded: left.route.ownerExcluded.excluded,
			rightOwnerExcluded: right.route.ownerExcluded.excluded,
			fullRightLuma: right.fullWallRaw.radiance.luma,
			a1RightLuma: right.a1KnownGoodRaw.radiance.luma,
			fullOverA1RightLuma: right.compare.fullOverA1Luma,
			fullRightAlpha: right.fullWallRaw.nearest.a,
			a1RightAlpha: right.a1KnownGoodRaw.nearest.a
		});
	}
	return {
		userCameraWallHit: {
			x: round(cameraWallHit().x, 9),
			y: round(cameraWallHit().y, 9),
			z: WALL_Z,
			t: round(cameraWallHit().t, 9)
		},
		visibleA1OverlapSamples: visible.length,
		routeWinnerDesyncSamples: desync.length,
		routeWinnerDesyncNames: desync.map((s) => s.name),
		leftRightBoundaryPairs: leftRight
	};
}

function main()
{
	const outPath = argValue('out', DEFAULT_OUT);
	const a1Pkg = loadPackage(A1_POINTER);
	const fullPkg = loadPackage(FULL_POINTER);
	const samples = makeTargets().map((target) => sampleTarget(target, a1Pkg, fullPkg));
	const report = {
		schema: 'r7-3-10-a1-westbeam-fullwall-regression-diagnostic-v1',
		createdAt: new Date().toISOString(),
		inputs: {
			userCamera: USER_CAMERA,
			a1Pointer: A1_POINTER,
			fullPointer: FULL_POINTER
		},
		packages: {
			a1KnownGoodRaw: {
				packageDir: a1Pkg.packageDir,
				runtimeScope: a1Pkg.pointer.runtimeScope,
				size: [a1Pkg.width, a1Pkg.height]
			},
			fullWallRaw: {
				packageDir: fullPkg.packageDir,
				runtimeScope: fullPkg.pointer.runtimeScope,
				size: [fullPkg.width, fullPkg.height]
			}
		},
		ownerPolicyObservation: {
			a1Precedence: 200,
			fullWallPrecedence: 150,
			fullWallSupersedesA1: true,
			currentRouteHelperAddsFullWallToWinner: false,
			shaderActualRouteSwitch: 'uR7310C1XatlasRuntimeFullNorthWallMode > 0.5 selects full-wall UV globally'
		},
		summary: summarize(samples),
		samples
	};
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
	console.log(JSON.stringify({
		result: 'PASS',
		out: outPath,
		userCameraWallHit: report.summary.userCameraWallHit,
		visibleA1OverlapSamples: report.summary.visibleA1OverlapSamples,
		routeWinnerDesyncSamples: report.summary.routeWinnerDesyncSamples,
		leftRightBoundaryPairs: report.summary.leftRightBoundaryPairs.map((entry) => ({
			y: entry.y,
			leftOwnerExcluded: entry.leftOwnerExcluded,
			rightOwnerExcluded: entry.rightOwnerExcluded,
			fullOverA1RightLuma: entry.fullOverA1RightLuma,
			fullRightAlpha: entry.fullRightAlpha,
			a1RightAlpha: entry.a1RightAlpha
		}))
	}, null, 2));
}

main();
