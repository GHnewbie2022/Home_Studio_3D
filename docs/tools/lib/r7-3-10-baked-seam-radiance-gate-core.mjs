const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });

const DEFAULTS = Object.freeze({
  comparisonMode: 'broad-near-versus-interior',
  firstTexelBandMaxM: 0.0013,
  adjacentTexelBandMinM: 0.0013,
  adjacentTexelBandMaxM: 0.0038,
  nearBandMaxM: 0.005,
  interiorBandMinM: 0.015,
  interiorBandMaxM: 0.035,
  endpointInsetM: 0.004,
  intervalToleranceM: 1.0e-6,
  blackLumaThreshold: 0,
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
    firstTexel: [],
    adjacentTexels: [],
    intervalSamples: 0,
    minDistanceToLineM: Number.POSITIVE_INFINITY,
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

function sampleBelongsToLineInterval(position, line, endpointInsetM, intervalToleranceM) {
  const axis = AXIS_INDEX[line.axis];
  const min = Number(line.min);
  const max = Number(line.max);
  const length = max - min;
  const inset = length > endpointInsetM * 2 ? endpointInsetM : 0;
  return position[axis] >= min + inset - intervalToleranceM &&
    position[axis] <= max - inset + intervalToleranceM;
}

function finalizeSide(accumulator, policy) {
  const toleranceGapLimitM = policy.comparisonMode === 'first-texel-neighbor'
    ? policy.firstTexelBandMaxM
    : policy.nearBandMaxM;
  if (
    accumulator.intervalSamples > 0 &&
    accumulator.minDistanceToLineM > toleranceGapLimitM
  ) {
    return {
      edgeId: accumulator.edgeId,
      pairKey: accumulator.pairKey,
      surfaceId: accumulator.surfaceId,
      line: accumulator.line,
      status: 'SKIP',
      skipReason: policy.comparisonMode === 'first-texel-neighbor'
        ? 'scanner-tolerance-only-gap-first-texel'
        : 'scanner-tolerance-only-gap',
      counts: {
        nearTexels: 0,
        interiorTexels: accumulator.interior.length,
        nearExactBlackTexels: 0,
        nearAlphaZeroTexels: 0,
        intervalSamples: accumulator.intervalSamples,
        minDistanceToLineM: round(accumulator.minDistanceToLineM)
      }
    };
  }
  const nearMedian = quantile(accumulator.near, 0.5);
  const nearP10 = quantile(accumulator.near, 0.1);
  const interiorMedian = quantile(accumulator.interior, 0.5);
  const interiorP10 = quantile(accumulator.interior, 0.1);
  const medianRatio = safeRatio(nearMedian, interiorMedian);
  const p10Ratio = safeRatio(nearP10, interiorP10);
  const medianDrop = interiorMedian === null || nearMedian === null ? null : interiorMedian - nearMedian;
  const p10Drop = interiorP10 === null || nearP10 === null ? null : interiorP10 - nearP10;
  const firstTexelMedian = quantile(accumulator.firstTexel, 0.5);
  const firstTexelP10 = quantile(accumulator.firstTexel, 0.1);
  const adjacentTexelsMedian = quantile(accumulator.adjacentTexels, 0.5);
  const adjacentTexelsP10 = quantile(accumulator.adjacentTexels, 0.1);
  const firstTexelMedianRatio = safeRatio(firstTexelMedian, adjacentTexelsMedian);
  const firstTexelP10Ratio = safeRatio(firstTexelP10, adjacentTexelsP10);
  const firstTexelMedianDrop = adjacentTexelsMedian === null || firstTexelMedian === null
    ? null
    : adjacentTexelsMedian - firstTexelMedian;
  const firstTexelP10Drop = adjacentTexelsP10 === null || firstTexelP10 === null
    ? null
    : adjacentTexelsP10 - firstTexelP10;
  const failures = [];
  if (accumulator.near.length < policy.minNearSamples) failures.push('insufficient-near-samples');
  if (accumulator.interior.length < policy.minInteriorSamples) failures.push('insufficient-interior-samples');
  if (accumulator.nearExactBlackTexels > 0) failures.push('exact-black-near-seam');
  if (policy.comparisonMode === 'first-texel-neighbor') {
    if (accumulator.firstTexel.length < policy.minNearSamples) failures.push('insufficient-first-texel-samples');
    if (accumulator.adjacentTexels.length < policy.minInteriorSamples) failures.push('insufficient-adjacent-texel-samples');
    if (
      firstTexelMedianRatio !== null &&
      firstTexelMedianRatio < policy.minMedianRatio &&
      firstTexelMedianDrop !== null &&
      firstTexelMedianDrop > policy.minAbsoluteDrop
    ) failures.push('first-texel-median-radiance-cliff');
    if (
      firstTexelP10Ratio !== null &&
      firstTexelP10Ratio < policy.minP10Ratio &&
      firstTexelP10Drop !== null &&
      firstTexelP10Drop > policy.minAbsoluteDrop
    ) failures.push('first-texel-low-tail-radiance-cliff');
  } else {
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
  }
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
    firstTexelRadiance: {
      firstTexelMedian: round(firstTexelMedian),
      firstTexelP10: round(firstTexelP10),
      adjacentTexelsMedian: round(adjacentTexelsMedian),
      adjacentTexelsP10: round(adjacentTexelsP10),
      medianRatio: round(firstTexelMedianRatio),
      p10Ratio: round(firstTexelP10Ratio),
      medianDrop: round(firstTexelMedianDrop),
      p10Drop: round(firstTexelP10Drop),
      firstTexelSamples: accumulator.firstTexel.length,
      adjacentTexelSamples: accumulator.adjacentTexels.length
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

  const triangleSurface = new Map(mesh.triangleMetadata.map((entry) => {
    const surfaceId = entry.semanticSurfaceId || entry.pieceId || entry.surfaceHint;
    if (!surfaceId) throw new Error(`triangle ${entry.triangleId} is missing semanticSurfaceId/pieceId/surfaceHint`);
    return [Number(entry.triangleId), surfaceId];
  }));
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
      if (!sampleBelongsToLineInterval(
        position,
        accumulator.line,
        policy.endpointInsetM,
        policy.intervalToleranceM
      )) continue;
      const distance = distanceToLine(position, accumulator.line.constants);
      accumulator.intervalSamples += 1;
      accumulator.minDistanceToLineM = Math.min(accumulator.minDistanceToLineM, distance);
      if (distance <= policy.firstTexelBandMaxM) accumulator.firstTexel.push(value);
      else if (distance >= policy.adjacentTexelBandMinM && distance <= policy.adjacentTexelBandMaxM)
        accumulator.adjacentTexels.push(value);
      if (distance <= policy.nearBandMaxM) {
        accumulator.near.push(value);
        if (value <= policy.blackLumaThreshold) accumulator.nearExactBlackTexels += 1;
        if (alpha < 0.5) accumulator.nearAlphaZeroTexels += 1;
      } else if (distance >= policy.interiorBandMinM && distance <= policy.interiorBandMaxM) {
        accumulator.interior.push(value);
      }
    }
  }

  const allSides = accumulators.map((accumulator) => finalizeSide(accumulator, policy));
  const skippedSides = allSides.filter((side) => side.status === 'SKIP');
  const sides = allSides.filter((side) => side.status !== 'SKIP');
  const failedSides = sides.filter((side) => side.status === 'FAIL');
  return {
    schema: 'r7-3-10-baked-seam-radiance-gate-v1',
    status: failedSides.length === 0 ? 'PASS' : 'FAIL',
    method: policy.comparisonMode === 'first-texel-neighbor'
      ? 'same-surface-first-texel-versus-adjacent-texels-hdr-radiance'
      : 'same-surface-near-edge-versus-interior-hdr-radiance',
    packageAtlasGroup,
    policy,
    counts: {
      packageSurfaces: packageSurfaces.size,
      evaluatedEdges: new Set(sides.map((side) => side.edgeId)).size,
      evaluatedSides: sides.length,
      skippedToleranceGapSides: skippedSides.length,
      failedSides: failedSides.length,
      nearTexels: sides.reduce((sum, side) => sum + side.counts.nearTexels, 0),
      interiorTexels: sides.reduce((sum, side) => sum + side.counts.interiorTexels, 0),
      nearExactBlackTexels: sides.reduce((sum, side) => sum + side.counts.nearExactBlackTexels, 0)
    },
    failedSideKeys: failedSides.map((side) => `${side.pairKey}:${side.surfaceId}`),
    skippedSides,
    sides
  };
}
