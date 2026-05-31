#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;
const BLOCK_RATIO_MIN = 0.98;
const BLOCK_RATIO_MAX = 1.02;
const SEAM_DELTA_ABSOLUTE_LIMIT = 0.02;
const SEAM_DELTA_RELATIVE_LIMIT = 1.25;
const SEAM_DELTA_RELATIVE_BIAS = 0.005;

function parseArgs(argv)
{
	const args = {};
	for (let i = 0; i < argv.length; i += 1)
	{
		const arg = argv[i];
		if (arg === '--json')
		{
			args.json = true;
			continue;
		}
		if (arg === '--no-reference-seam')
		{
			args.noReferenceSeam = true;
			continue;
		}
		if (!arg.startsWith('--'))
			throw new Error(`Unexpected argument: ${arg}`);
		const key = arg.slice(2);
		const value = argv[i + 1];
		if (value === undefined || value.startsWith('--'))
			throw new Error(`Missing value for --${key}`);
		args[key] = value;
		i += 1;
	}
	return args;
}

function requiredString(args, key)
{
	const value = args[key];
	if (!value)
		throw new Error(`Missing --${key}`);
	return value;
}

function requiredPositiveInt(args, key)
{
	const value = Math.floor(Number(args[key]));
	if (!Number.isFinite(value) || value <= 0)
		throw new Error(`Invalid --${key}`);
	return value;
}

function optionalPositiveInt(args, key)
{
	if (args[key] === undefined)
		return null;
	const value = Math.floor(Number(args[key]));
	if (!Number.isFinite(value) || value <= 0)
		throw new Error(`Invalid --${key}`);
	return value;
}

function readAtlas(dir, width, height)
{
	const atlasPath = path.join(dir, 'atlas-patch-000-rgba-f32.bin');
	const buffer = fs.readFileSync(atlasPath);
	const expectedBytes = width * height * 4 * 4;
	if (buffer.byteLength !== expectedBytes)
		throw new Error(`${atlasPath} byteLength ${buffer.byteLength} !== ${expectedBytes}`);
	return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function texelLuma(atlas, width, x, y)
{
	const index = (y * width + x) * 4;
	const r = atlas[index + 0];
	const g = atlas[index + 1];
	const b = atlas[index + 2];
	const a = atlas[index + 3];
	if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a) || a <= 0.5)
		return null;
	return r * LUMA_R + g * LUMA_G + b * LUMA_B;
}

function summarizeBlocks(reference, candidate, width, height, blockSize)
{
	const failures = [];
	let min = Infinity;
	let max = -Infinity;
	let count = 0;
	let skipped = 0;
	for (let y0 = 0; y0 < height; y0 += blockSize)
	{
		for (let x0 = 0; x0 < width; x0 += blockSize)
		{
			const x1 = Math.min(width, x0 + blockSize);
			const y1 = Math.min(height, y0 + blockSize);
			let refSum = 0;
			let candSum = 0;
			let samples = 0;
			for (let y = y0; y < y1; y += 1)
			{
				for (let x = x0; x < x1; x += 1)
				{
					const refLuma = texelLuma(reference, width, x, y);
					const candLuma = texelLuma(candidate, width, x, y);
					if (refLuma === null || candLuma === null)
						continue;
					refSum += refLuma;
					candSum += candLuma;
					samples += 1;
				}
			}
			if (samples === 0)
			{
				skipped += 1;
				continue;
			}
			const refMean = refSum / samples;
			const candMean = candSum / samples;
			if (Math.abs(refMean) < 1e-8)
			{
				if (Math.abs(candMean - refMean) > 0.002)
					failures.push({ x: x0, y: y0, ratio: null, refMean, candMean, samples });
				continue;
			}
			const ratio = candMean / refMean;
			min = Math.min(min, ratio);
			max = Math.max(max, ratio);
			count += 1;
			if (ratio < BLOCK_RATIO_MIN || ratio > BLOCK_RATIO_MAX)
				failures.push({ x: x0, y: y0, ratio, refMean, candMean, samples });
		}
	}
	return {
		min: count > 0 ? min : null,
		max: count > 0 ? max : null,
		count,
		skipped,
		failures
	};
}

function seamDeltaForVertical(atlas, width, height, seamX)
{
	let sum = 0;
	let count = 0;
	for (let y = 0; y < height; y += 1)
	{
		const a = texelLuma(atlas, width, seamX - 1, y);
		const b = texelLuma(atlas, width, seamX, y);
		if (a === null || b === null)
			continue;
		sum += Math.abs(b - a);
		count += 1;
	}
	return count > 0 ? sum / count : null;
}

function seamDeltaForHorizontal(atlas, width, seamY)
{
	let sum = 0;
	let count = 0;
	for (let x = 0; x < width; x += 1)
	{
		const a = texelLuma(atlas, width, x, seamY - 1);
		const b = texelLuma(atlas, width, x, seamY);
		if (a === null || b === null)
			continue;
		sum += Math.abs(b - a);
		count += 1;
	}
	return count > 0 ? sum / count : null;
}

function localDeltaForVertical(atlas, width, height, seamX)
{
	const deltas = [];
	if (seamX >= 2)
		deltas.push(seamDeltaForVertical(atlas, width, height, seamX - 1));
	if (seamX + 1 < width)
		deltas.push(seamDeltaForVertical(atlas, width, height, seamX + 1));
	const valid = deltas.filter((value) => value !== null);
	if (valid.length === 0)
		return null;
	return Math.max(...valid);
}

function localDeltaForHorizontal(atlas, width, height, seamY)
{
	const deltas = [];
	if (seamY >= 2)
		deltas.push(seamDeltaForHorizontal(atlas, width, seamY - 1));
	if (seamY + 1 < height)
		deltas.push(seamDeltaForHorizontal(atlas, width, seamY + 1));
	const valid = deltas.filter((value) => value !== null);
	if (valid.length === 0)
		return null;
	return Math.max(...valid);
}

function summarizeSeams(reference, candidate, width, height, tileWidth, tileHeight)
{
	const failures = [];
	let maxReferenceDelta = 0;
	let maxCandidateDelta = 0;
	let maxIncrease = 0;
	let count = 0;
	const inspect = (axis, position, refDelta, candDelta) => {
		if (refDelta === null || candDelta === null)
			return;
		const increase = candDelta - refDelta;
		maxReferenceDelta = Math.max(maxReferenceDelta, refDelta);
		maxCandidateDelta = Math.max(maxCandidateDelta, candDelta);
		maxIncrease = Math.max(maxIncrease, increase);
		count += 1;
		if (
			increase > SEAM_DELTA_ABSOLUTE_LIMIT &&
			candDelta > refDelta * SEAM_DELTA_RELATIVE_LIMIT + SEAM_DELTA_RELATIVE_BIAS
		)
			failures.push({ axis, position, refDelta, candDelta, increase });
	};
	for (let x = tileWidth; x < width; x += tileWidth)
		inspect('x', x, seamDeltaForVertical(reference, width, height, x), seamDeltaForVertical(candidate, width, height, x));
	for (let y = tileHeight; y < height; y += tileHeight)
		inspect('y', y, seamDeltaForHorizontal(reference, width, y), seamDeltaForHorizontal(candidate, width, y));
	return {
		maxReferenceDelta,
		maxCandidateDelta,
		maxIncrease,
		count,
		failures
	};
}

function summarizeCandidateOnlySeams(candidate, width, height, tileWidth, tileHeight)
{
	const failures = [];
	let maxSeamDelta = 0;
	let maxLocalDelta = 0;
	let maxIncrease = 0;
	let count = 0;
	const inspect = (axis, position, seamDelta, localDelta) => {
		if (seamDelta === null || localDelta === null)
			return;
		const increase = seamDelta - localDelta;
		maxSeamDelta = Math.max(maxSeamDelta, seamDelta);
		maxLocalDelta = Math.max(maxLocalDelta, localDelta);
		maxIncrease = Math.max(maxIncrease, increase);
		count += 1;
		if (
			increase > SEAM_DELTA_ABSOLUTE_LIMIT &&
			seamDelta > localDelta * SEAM_DELTA_RELATIVE_LIMIT + SEAM_DELTA_RELATIVE_BIAS
		)
			failures.push({ axis, position, seamDelta, localDelta, increase });
	};
	for (let x = tileWidth; x < width; x += tileWidth)
		inspect('x', x, seamDeltaForVertical(candidate, width, height, x), localDeltaForVertical(candidate, width, height, x));
	for (let y = tileHeight; y < height; y += tileHeight)
		inspect('y', y, seamDeltaForHorizontal(candidate, width, y), localDeltaForHorizontal(candidate, width, height, y));
	return {
		maxSeamDelta,
		maxLocalDelta,
		maxIncrease,
		count,
		failures
	};
}

function main()
{
	const args = parseArgs(process.argv.slice(2));
	const seamMode = args.noReferenceSeam ? 'candidate-only' : (args['seam-mode'] || 'reference');
	if (seamMode !== 'reference' && seamMode !== 'candidate-only')
		throw new Error(`Invalid --seam-mode ${seamMode}`);
	const referenceDir = args['reference-dir'] || null;
	const candidateDir = requiredString(args, 'candidate-dir');
	const width = requiredPositiveInt(args, 'width');
	const height = requiredPositiveInt(args, 'height');
	const blockSize = optionalPositiveInt(args, 'block-size');
	const tileWidth = requiredPositiveInt(args, 'tile-width');
	const tileHeight = requiredPositiveInt(args, 'tile-height');
	if (seamMode === 'reference' && !referenceDir)
		throw new Error('Missing --reference-dir for reference seam mode');
	const reference = referenceDir ? readAtlas(referenceDir, width, height) : null;
	const candidate = readAtlas(candidateDir, width, height);
	const blockRatio = reference && blockSize ? summarizeBlocks(reference, candidate, width, height, blockSize) : null;
	const seams = seamMode === 'reference'
		? summarizeSeams(reference, candidate, width, height, tileWidth, tileHeight)
		: summarizeCandidateOnlySeams(candidate, width, height, tileWidth, tileHeight);
	const failedChecks = [];
	if (blockRatio && blockRatio.failures.length > 0)
		failedChecks.push('block-ratio-out-of-range');
	if (seams.failures.length > 0)
		failedChecks.push(seamMode === 'reference' ? 'tile-seam-delta-out-of-range' : 'candidate-tile-seam-delta-out-of-range');
	const report = {
		status: failedChecks.length === 0 ? 'pass' : 'fail',
		failedChecks,
		inputs: {
			referenceDir,
			candidateDir
		},
		width,
		height,
		blockSize,
		tileWidth,
		tileHeight,
		seamMode,
		blockRatio: blockRatio ? {
			min: blockRatio.min,
			max: blockRatio.max,
			count: blockRatio.count,
			skipped: blockRatio.skipped,
			failureCount: blockRatio.failures.length
		} : null,
		seams: seamMode === 'reference' ? {
			maxReferenceDelta: seams.maxReferenceDelta,
			maxCandidateDelta: seams.maxCandidateDelta,
			maxIncrease: seams.maxIncrease,
			count: seams.count,
			failureCount: seams.failures.length
		} : {
			maxSeamDelta: seams.maxSeamDelta,
			maxLocalDelta: seams.maxLocalDelta,
			maxIncrease: seams.maxIncrease,
			count: seams.count,
			failureCount: seams.failures.length
		}
	};
	if (args.output)
		fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
	if (args.json)
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	else
		console.log(report.status === 'pass' ? 'Bake fidelity audit passed' : `Bake fidelity audit failed: ${failedChecks.join(', ')}`);
	if (report.status !== 'pass')
		process.exitCode = 1;
}

try
{
	main();
}
catch (error)
{
	const report = {
		status: 'fail',
		failedChecks: ['audit-error'],
		error: error && error.message ? error.message : String(error)
	};
	if (process.argv.includes('--json'))
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	else
		console.error(report.error);
	process.exitCode = 1;
}
