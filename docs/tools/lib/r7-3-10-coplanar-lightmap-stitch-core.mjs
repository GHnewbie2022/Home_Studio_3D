const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });

const DEFAULT_POLICY = Object.freeze({
  minSamples: 1024,
  maxMedianRatioError: 0.005,
  maxP95RelativeDifference: 0.01,
  sourceAlphaThreshold: 0.5,
  lumaEpsilon: 1.0e-8
});

function float32View(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('expected a Buffer');
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0)
    throw new Error(`float artifact byte length is not aligned: ${buffer.byteLength}`);
  if (buffer.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0)
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function round(value) {
  return value === null || !Number.isFinite(value) ? value : Number(value.toFixed(8));
}

function luma(r, g, b) {
  return Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function normalizedAxis(position, axisSpec) {
  const axis = AXIS_INDEX[axisSpec.axis];
  if (axis === undefined) throw new Error(`unknown world axis: ${axisSpec.axis}`);
  const span = Number(axisSpec.max) - Number(axisSpec.min);
  if (!(span > 0)) throw new Error(`invalid ${axisSpec.axis} span`);
  let value = (position[axis] - Number(axisSpec.min)) / span;
  if (axisSpec.flip) value = 1 - value;
  return value;
}

function sourceUv(position, spec) {
  const rawU = normalizedAxis(position, spec.u);
  const rawV = normalizedAxis(position, spec.v);
  const outOfBounds = rawU < -1.0e-5 || rawU > 1.00001 || rawV < -1.0e-5 || rawV > 1.00001;
  let u = Math.min(1, Math.max(0, rawU));
  let v = Math.min(1, Math.max(0, rawV));
  if (spec.hasInset) {
    const insetU = 0.5 / Number(spec.atlasW);
    const insetV = 0.5 / Number(spec.atlasH);
    u = insetU + u * (1 - insetU * 2);
    v = insetV + v * (1 - insetV * 2);
  }
  return { u, v, outOfBounds };
}

function normalizeEdgeExtensions(edgeExtensions) {
  return edgeExtensions.map((extension, index) => {
    const axisIndex = AXIS_INDEX[extension.axis];
    const value = Number(extension.value);
    const inwardDirection = Number(extension.inwardDirection);
    const radiusM = Number(extension.radiusM);
    if (axisIndex === undefined) throw new Error(`edge extension ${index} has an unknown axis`);
    if (!Number.isFinite(value)) throw new Error(`edge extension ${index} has an invalid value`);
    if (inwardDirection !== -1 && inwardDirection !== 1)
      throw new Error(`edge extension ${index} inwardDirection must be -1 or 1`);
    if (!(radiusM > 0)) throw new Error(`edge extension ${index} radiusM must be positive`);
    return {
      pairKey: extension.pairKey || null,
      axis: extension.axis,
      axisIndex,
      value,
      inwardDirection,
      radiusM
    };
  });
}

function extendSourceSamplePosition(position, edgeExtensions) {
  const adjusted = [...position];
  for (const extension of edgeExtensions) {
    const coordinate = adjusted[extension.axisIndex];
    const interiorLimit = extension.value + extension.inwardDirection * extension.radiusM;
    if (extension.inwardDirection > 0) {
      if (coordinate >= extension.value - 1.0e-5 && coordinate < interiorLimit)
        adjusted[extension.axisIndex] = interiorLimit;
    } else if (coordinate <= extension.value + 1.0e-5 && coordinate > interiorLimit) {
      adjusted[extension.axisIndex] = interiorLimit;
    }
  }
  return adjusted;
}

function bilinearRgba(atlas, width, height, u, v) {
  const x = Math.min(width - 1, Math.max(0, u * width - 0.5));
  const y = Math.min(height - 1, Math.max(0, v * height - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const result = [0, 0, 0, 0];
  for (let channel = 0; channel < 4; channel += 1) {
    const a = atlas[(y0 * width + x0) * 4 + channel];
    const b = atlas[(y0 * width + x1) * 4 + channel];
    const c = atlas[(y1 * width + x0) * 4 + channel];
    const d = atlas[(y1 * width + x1) * 4 + channel];
    result[channel] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  return result;
}

function summarize({ ratios, relativeDifferences, counts, policy }) {
  const medianRatio = quantile(ratios, 0.5);
  const p95RelativeDifference = quantile(relativeDifferences, 0.95);
  const failures = [];
  if (counts.comparedSamples < policy.minSamples) failures.push('insufficient-matched-samples');
  if (counts.outOfBoundsSamples > 0) failures.push('target-position-outside-source-chart');
  if (counts.invalidSourceSamples > 0) failures.push('invalid-source-coverage');
  if (medianRatio !== null && Math.abs(medianRatio - 1) > policy.maxMedianRatioError)
    failures.push('median-radiance-ratio-drift');
  if (p95RelativeDifference !== null && p95RelativeDifference > policy.maxP95RelativeDifference)
    failures.push('p95-radiance-difference');
  return {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    counts: { ...counts },
    radiance: {
      medianRatio: round(medianRatio),
      p95RelativeDifference: round(p95RelativeDifference)
    }
  };
}

export function stitchCoplanarLightmap({
  sourceAtlasBuffer,
  sourceWidth,
  sourceHeight,
  sourceSpec,
  targetAtlasBuffer,
  targetMetadataBuffer,
  targetWidth,
  targetHeight,
  sourceEdgeExtensions = [],
  policy: policyOverrides = {}
}) {
  const policy = { ...DEFAULT_POLICY, ...policyOverrides };
  const normalizedEdgeExtensions = normalizeEdgeExtensions(sourceEdgeExtensions);
  const sourceAtlas = float32View(sourceAtlasBuffer);
  const targetAtlas = float32View(targetAtlasBuffer);
  const targetMetadata = float32View(targetMetadataBuffer);
  const sourcePixels = Number(sourceWidth) * Number(sourceHeight);
  const targetPixels = Number(targetWidth) * Number(targetHeight);
  if (sourceAtlas.length !== sourcePixels * 4) throw new Error('source atlas float count mismatch');
  if (targetAtlas.length !== targetPixels * 4) throw new Error('target atlas float count mismatch');
  if (targetMetadata.length !== targetPixels * 12) throw new Error('target metadata float count mismatch');
  if (Number(sourceSpec.atlasW) !== Number(sourceWidth) || Number(sourceSpec.atlasH) !== Number(sourceHeight))
    throw new Error('source axis spec dimensions do not match source atlas');

  const stitched = new Float32Array(targetAtlas);
  const beforeRatios = [];
  const beforeDifferences = [];
  const afterRatios = [];
  const afterDifferences = [];
  const counts = {
    validTargetSamples: 0,
    comparedSamples: 0,
    outOfBoundsSamples: 0,
    invalidSourceSamples: 0
  };

  for (let pixel = 0; pixel < targetPixels; pixel += 1) {
    const metadataOffset = pixel * 12;
    if (targetMetadata[metadataOffset + 7] < 0.5) continue;
    counts.validTargetSamples += 1;
    const position = [
      targetMetadata[metadataOffset],
      targetMetadata[metadataOffset + 1],
      targetMetadata[metadataOffset + 2]
    ];
    const sourcePosition = extendSourceSamplePosition(position, normalizedEdgeExtensions);
    const uv = sourceUv(sourcePosition, sourceSpec);
    if (uv.outOfBounds) {
      counts.outOfBoundsSamples += 1;
      continue;
    }
    const sample = bilinearRgba(sourceAtlas, sourceWidth, sourceHeight, uv.u, uv.v);
    if (sample[3] < policy.sourceAlphaThreshold) {
      counts.invalidSourceSamples += 1;
      continue;
    }
    const atlasOffset = pixel * 4;
    const sourceLuma = luma(sample[0], sample[1], sample[2]);
    const targetLuma = luma(targetAtlas[atlasOffset], targetAtlas[atlasOffset + 1], targetAtlas[atlasOffset + 2]);
    if (sourceLuma > policy.lumaEpsilon) {
      beforeRatios.push(targetLuma / sourceLuma);
      beforeDifferences.push(Math.abs(targetLuma - sourceLuma) / sourceLuma);
      afterRatios.push(1);
      afterDifferences.push(0);
      counts.comparedSamples += 1;
    }
    stitched[atlasOffset] = sample[0];
    stitched[atlasOffset + 1] = sample[1];
    stitched[atlasOffset + 2] = sample[2];
  }

  const before = summarize({ ratios: beforeRatios, relativeDifferences: beforeDifferences, counts, policy });
  const after = summarize({ ratios: afterRatios, relativeDifferences: afterDifferences, counts, policy });
  return {
    atlasBuffer: Buffer.from(stitched.buffer, stitched.byteOffset, stitched.byteLength),
    report: {
      schema: 'r7-3-10-coplanar-lightmap-continuity-v1',
      status: after.status,
      method: 'world-space-coplanar-lightmap-stitch',
      edgeExtensionPolicy: {
        enabled: normalizedEdgeExtensions.length > 0,
        method: 'world-space-nearest-valid-interior-texel-extension',
        extensions: normalizedEdgeExtensions.map(({ axisIndex, ...extension }) => extension)
      },
      policy,
      before,
      after
    }
  };
}
