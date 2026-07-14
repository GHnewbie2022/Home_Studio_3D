const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });

const DEFAULTS = Object.freeze({
  nearBandMaxM: 0.005,
  interiorBandMinM: 0.015,
  interiorBandMaxM: 0.035,
  endpointInsetM: 0.004,
  blackLumaThreshold: 1.0e-5,
  minNearSamples: 8,
  minInteriorSamples: 16,
  minMedianRatio: 0.2,
  minP10Ratio: 0.05,
  minAbsoluteDrop: 0.02
});

function float32View(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('expected a Buffer');
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0)
    throw new Error(`float artifact byte length is not aligned: ${buffer.byteLength}`);
  if (buffer.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0)
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / Float32Array.BYTES_PER_ELEMENT);
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

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function luma(r, g, b) {
  return Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function sideAccumulator(edge, surfaceId) {
  return {
    edgeId: edge.edgeId,
    pairKey: edge.pairKey,
    surfaceId,
    line: edge.line,
    near: [],
    interior: [],
    nearExactBlackTexels: 0,
    nearAlphaZeroTexels: 0
  };
}

function distanceToLine(position, constants) {
  let squared = 0;
  for (const [axis, value] of Object.entries(constants)) {
    const delta = position[AXIS_INDEX[axis]] - Number(value);
    squared += delta * delta;
  }
  return Math.sqrt(squared);
}

function sampleBelongsToLineInterval(position, line, endpointInsetM) {
  const axis = AXIS_INDEX[line.axis];
  const min = Number(line.min);
  const max = Number(line.max);
  const length = max - min;
  const inset = length > endpointInsetM * 2 ? endpointInsetM : 0;
  return position[axis] >= min + inset && position[axis] <= max - inset;
}

function finalizeSide(accumulator, policy) {
  const nearMedian = quantile(accumulator.near, 0.5);
  const nearP10 = quantile(accumulator.near, 0.1);
  const interiorMedian = quantile(accumulator.interior, 0.5);
  const interiorP10 = quantile(accumulator.interior, 0.1);
  const medianRatio = safeRatio(nearMedian, interiorMedian);
  const p10Ratio = safeRatio(nearP10, interiorP10);
  const medianDrop = interiorMedian === null || nearMedian === null ? null : interiorMedian - nearMedian;
  const p10Drop = interiorP10 === null || nearP10 === null ? null : interiorP10 - nearP10;
  const failures = [];
  if (accumulator.near.length < policy.minNearSamples) failures.push('insufficient-near-samples');
  if (accumulator.interior.length < policy.minInteriorSamples) failures.push('insufficient-interior-samples');
  if (accumulator.nearExactBlackTexels > 0) failures.push('exact-black-near-seam');
  if (
    medianRatio !== null &&
    medianRatio < policy.minMedianRatio &&
    medianDrop !== null &&
    medianDrop > policy.minAbsoluteDrop
  ) failures.push('narrow-seam-median-radiance-collapse');
  if (
    p10Ratio !== null &&
    p10Ratio < policy.minP10Ratio &&
    p10Drop !== null &&
    p10Drop > policy.minAbsoluteDrop
  ) failures.push('narrow-seam-low-tail-radiance-collapse');
  return {
    edgeId: accumulator.edgeId,
    pairKey: accumulator.pairKey,
    surfaceId: accumulator.surfaceId,
    line: accumulator.line,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    counts: {
      nearTexels: accumulator.near.length,
      interiorTexels: accumulator.interior.length,
      nearExactBlackTexels: accumulator.nearExactBlackTexels,
      nearAlphaZeroTexels: accumulator.nearAlphaZeroTexels
    },
    radiance: {
      nearMedian: round(nearMedian),
      nearP10: round(nearP10),
      interiorMedian: round(interiorMedian),
      interiorP10: round(interiorP10),
      medianRatio: round(medianRatio),
      p10Ratio: round(p10Ratio),
      medianDrop: round(medianDrop),
      p10Drop: round(p10Drop)
    }
  };
}

export function evaluateBakedSeamRadianceGate({
  atlasBuffer,
  metadataBuffer,
  width,
  height,
  mesh,
  edgeReport,
  packageAtlasGroup,
  policy: policyOverrides = {}
}) {
  const policy = { ...DEFAULTS, ...policyOverrides };
  const pixelCount = Number(width) * Number(height);
  const atlas = float32View(atlasBuffer);
  const metadata = float32View(metadataBuffer);
  if (atlas.length !== pixelCount * 4)
    throw new Error(`atlas float count mismatch: ${atlas.length} != ${pixelCount * 4}`);
  if (metadata.length !== pixelCount * 12)
    throw new Error(`metadata float count mismatch: ${metadata.length} != ${pixelCount * 12}`);

  const triangleSurface = new Map(
    mesh.triangleMetadata.map((entry) => [Number(entry.triangleId), entry.pieceId])
  );
  const packageSurfaces = new Set(triangleSurface.values());
  const accumulators = [];
  const bySurface = new Map();
  for (const edge of edgeReport.edges) {
    for (const surfaceId of edge.surfaces) {
      if (!packageSurfaces.has(surfaceId)) continue;
      const accumulator = sideAccumulator(edge, surfaceId);
      accumulators.push(accumulator);
      const list = bySurface.get(surfaceId) || [];
      list.push(accumulator);
      bySurface.set(surfaceId, list);
    }
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const metadataOffset = pixel * 12;
    if (metadata[metadataOffset + 7] < 0.5) continue;
    const triangleId = Math.round(metadata[metadataOffset + 6]);
    const surfaceId = triangleSurface.get(triangleId);
    const surfaceAccumulators = bySurface.get(surfaceId);
    if (!surfaceAccumulators) continue;
    const position = [
      metadata[metadataOffset],
      metadata[metadataOffset + 1],
      metadata[metadataOffset + 2]
    ];
    const atlasOffset = pixel * 4;
    const alpha = atlas[atlasOffset + 3];
    const value = luma(atlas[atlasOffset], atlas[atlasOffset + 1], atlas[atlasOffset + 2]);
    for (const accumulator of surfaceAccumulators) {
      if (!sampleBelongsToLineInterval(position, accumulator.line, policy.endpointInsetM)) continue;
      const distance = distanceToLine(position, accumulator.line.constants);
      if (distance <= policy.nearBandMaxM) {
        accumulator.near.push(value);
        if (value <= policy.blackLumaThreshold) accumulator.nearExactBlackTexels += 1;
        if (alpha < 0.5) accumulator.nearAlphaZeroTexels += 1;
      } else if (distance >= policy.interiorBandMinM && distance <= policy.interiorBandMaxM) {
        accumulator.interior.push(value);
      }
    }
  }

  const sides = accumulators.map((accumulator) => finalizeSide(accumulator, policy));
  const failedSides = sides.filter((side) => side.status === 'FAIL');
  return {
    schema: 'r7-3-10-baked-seam-radiance-gate-v1',
    status: sides.length > 0 && failedSides.length === 0 ? 'PASS' : 'FAIL',
    method: 'same-surface-near-edge-versus-interior-hdr-radiance',
    packageAtlasGroup,
    policy,
    counts: {
      packageSurfaces: packageSurfaces.size,
      evaluatedEdges: new Set(sides.map((side) => side.edgeId)).size,
      evaluatedSides: sides.length,
      failedSides: failedSides.length,
      nearTexels: sides.reduce((sum, side) => sum + side.counts.nearTexels, 0),
      interiorTexels: sides.reduce((sum, side) => sum + side.counts.interiorTexels, 0),
      nearExactBlackTexels: sides.reduce((sum, side) => sum + side.counts.nearExactBlackTexels, 0)
    },
    failedSideKeys: failedSides.map((side) => `${side.pairKey}:${side.surfaceId}`),
    sides
  };
}
