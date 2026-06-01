import assert from 'node:assert/strict';

import {
	computeRenderSpaceSeamMetrics,
	makeRgbaImageFromLuma,
} from '../tools/lib/r7-3-10-render-space-seam-gate-core.mjs';

function imageFrom(width, height, fill)
{
	const luma = new Float32Array(width * height);
	for (let y = 0; y < height; y += 1)
	{
		for (let x = 0; x < width; x += 1)
		{
			luma[y * width + x] = fill(x, y);
		}
	}
	return makeRgbaImageFromLuma(width, height, luma);
}

function measure(image)
{
	return computeRenderSpaceSeamMetrics({
		image,
		seam: { x0: 50, y0: 8, x1: 50, y1: 71 },
		sampleCount: 64,
		crossOffsetPx: 2,
		interiorOffsetPx: 14,
		failRatio: 2.5,
		failJump: 0.04,
	});
}

{
	const image = imageFrom(100, 80, (x) => {
		if (x >= 49 && x <= 50) return 0.12;
		return 0.52;
	});
	const metrics = measure(image);
	assert.equal(metrics.status, 'fail');
	assert.ok(metrics.seamJump > 0.25, `expected strong seam jump, got ${metrics.seamJump}`);
	assert.ok(metrics.ratio > 2.5, `expected seam ratio > 2.5, got ${metrics.ratio}`);
	assert.equal(metrics.samples, 64);
}

{
	const image = imageFrom(100, 80, (x, y) => {
		if (x === 49 && y === 39) return 0.0;
		if (x === 51 && y === 39) return 1.0;
		return 0.52;
	});
	const metrics = measure(image);
	assert.equal(metrics.status, 'pass');
	assert.ok(metrics.seamJump < 0.04, `single noisy point should not dominate averaged seamJump: ${metrics.seamJump}`);
}

{
	const image = imageFrom(100, 80, (x) => 0.2 + x * 0.005);
	const metrics = measure(image);
	assert.equal(metrics.status, 'pass');
	assert.ok(metrics.ratio < 1.4, `smooth gradient should look like interior variation: ${metrics.ratio}`);
}
