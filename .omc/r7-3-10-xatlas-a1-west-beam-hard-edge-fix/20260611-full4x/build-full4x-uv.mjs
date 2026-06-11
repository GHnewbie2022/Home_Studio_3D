import fs from 'node:fs';

const inputPath = 'docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-spike/xatlas-spike-output-uv.json';
const outputPath = '.omc/r7-3-10-xatlas-a1-west-beam-hard-edge-fix/20260611-full4x/xatlas-spike-output-uv-full4x.json';
const uv = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

uv.atlas.width = 946 * 4;
uv.atlas.height = 516 * 4;
uv.atlas.float32RgbaMiB = uv.atlas.width * uv.atlas.height * 4 * 4 / (1024 * 1024);
uv.meta = uv.meta || {};
uv.meta.codexVariant = {
  id: 'r7310-xatlas-a1-full4x-d800-equivalent-density',
  base: inputPath,
  reason: 'D800-equivalent world texel density in both A1 north-wall directions',
  oldAtlasSize: [946, 516],
  newAtlasSize: [uv.atlas.width, uv.atlas.height],
  targetWorldPitchM: 0.00125
};

fs.writeFileSync(outputPath, JSON.stringify(uv, null, 2) + '\n');
console.log(`[wrote] ${outputPath} atlas=${uv.atlas.width}x${uv.atlas.height} rgbaMiB=${uv.atlas.float32RgbaMiB.toFixed(3)}`);
