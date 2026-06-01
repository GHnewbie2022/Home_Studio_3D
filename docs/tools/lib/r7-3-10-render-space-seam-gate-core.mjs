function clamp(value, min, max)
{
	return Math.max(min, Math.min(max, value));
}

function assertImage(image)
{
	if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || !image.data)
	{
		throw new Error('image must provide width, height, and data');
	}
	if (image.width <= 1 || image.height <= 1)
	{
		throw new Error(`image dimensions are too small: ${image.width}x${image.height}`);
	}
}

export function makeRgbaImageFromLuma(width, height, luma)
{
	if (luma.length !== width * height)
	{
		throw new Error(`luma length mismatch: expected ${width * height}, got ${luma.length}`);
	}
	const data = new Float32Array(width * height * 4);
	for (let i = 0; i < luma.length; i += 1)
	{
		const v = luma[i];
		const offset = i * 4;
		data[offset] = v;
		data[offset + 1] = v;
		data[offset + 2] = v;
		data[offset + 3] = 1;
	}
	return { width, height, data };
}

export function sampleRenderSpaceLuma(image, x, y)
{
	assertImage(image);
	const px = clamp(x, 0, image.width - 1);
	const py = clamp(y, 0, image.height - 1);
	const x0 = Math.floor(px);
	const y0 = Math.floor(py);
	const x1 = Math.min(image.width - 1, x0 + 1);
	const y1 = Math.min(image.height - 1, y0 + 1);
	const tx = px - x0;
	const ty = py - y0;
	const l00 = pixelLuma(image, x0, y0);
	const l10 = pixelLuma(image, x1, y0);
	const l01 = pixelLuma(image, x0, y1);
	const l11 = pixelLuma(image, x1, y1);
	const a = l00 * (1 - tx) + l10 * tx;
	const b = l01 * (1 - tx) + l11 * tx;
	return a * (1 - ty) + b * ty;
}

function pixelLuma(image, x, y)
{
	const offset = (y * image.width + x) * 4;
	const r = image.data[offset];
	const g = image.data[offset + 1];
	const b = image.data[offset + 2];
	const scale = r > 1 || g > 1 || b > 1 ? 255 : 1;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / scale;
}

function average(values)
{
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, q)
{
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
	return sorted[index];
}

export function computeRenderSpaceSeamMetrics(options)
{
	const {
		image,
		seam,
		sampleCount = 96,
		crossOffsetPx = 2,
		interiorOffsetPx = 16,
		failRatio = 2.5,
		failJump = 0.04,
	} = options || {};
	assertImage(image);
	if (!seam) throw new Error('seam is required');
	const dx = seam.x1 - seam.x0;
	const dy = seam.y1 - seam.y0;
	const length = Math.hypot(dx, dy);
	if (!Number.isFinite(length) || length <= 0)
	{
		throw new Error('seam length must be positive');
	}
	const tangentX = dx / length;
	const tangentY = dy / length;
	const normalX = -tangentY;
	const normalY = tangentX;
	const seamJumps = [];
	const interiorJumps = [];
	for (let i = 0; i < sampleCount; i += 1)
	{
		const t = (i + 0.5) / sampleCount;
		const x = seam.x0 + dx * t;
		const y = seam.y0 + dy * t;
		const center = sampleRenderSpaceLuma(image, x, y);
		const left = sampleRenderSpaceLuma(image, x - normalX * crossOffsetPx, y - normalY * crossOffsetPx);
		const right = sampleRenderSpaceLuma(image, x + normalX * crossOffsetPx, y + normalY * crossOffsetPx);
		const sideMean = (left + right) * 0.5;
		seamJumps.push(Math.max(Math.abs(center - sideMean), Math.abs(left - right)));

		for (const side of [-1, 1])
		{
			const cx = x + normalX * interiorOffsetPx * side;
			const cy = y + normalY * interiorOffsetPx * side;
			const ic = sampleRenderSpaceLuma(image, cx, cy);
			const ia = sampleRenderSpaceLuma(image, cx - normalX * crossOffsetPx * side, cy - normalY * crossOffsetPx * side);
			const ib = sampleRenderSpaceLuma(image, cx + normalX * crossOffsetPx * side, cy + normalY * crossOffsetPx * side);
			const im = (ia + ib) * 0.5;
			interiorJumps.push(Math.max(Math.abs(ic - im), Math.abs(ia - ib)));
		}
	}
	const seamJump = average(seamJumps);
	const interiorJump = average(interiorJumps);
	const ratio = seamJump / Math.max(interiorJump, 1e-5);
	const fail = seamJump >= failJump && ratio >= failRatio;
	return {
		status: fail ? 'fail' : 'pass',
		samples: sampleCount,
		seamJump,
		interiorJump,
		ratio,
		seamP90: percentile(seamJumps, 0.9),
		interiorP90: percentile(interiorJumps, 0.9),
	};
}
