import fs from 'node:fs';

const meshPath = 'docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-spike/xatlas-spike-input-mesh.json';
const bakeDir = '.omc/r7-3-10-xatlas-a1-west-beam-hard-edge-fix/20260611-full4x/xatlas-bake-full4x';
const texelmapPath = `${bakeDir}/xatlas-bake-texelmap.bin`;
const reportPath = `${bakeDir}/xatlas-bake-texelmap.json`;
const outPath = `${bakeDir}/xatlas-bake-rawnormal-rgba32f.bin`;

const mesh = JSON.parse(fs.readFileSync(meshPath, 'utf8'));
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const width = report.atlas.width;
const height = report.atlas.height;
const total = width * height;
const texelmapBuffer = fs.readFileSync(texelmapPath);
const texelmap = new Float32Array(texelmapBuffer.buffer, texelmapBuffer.byteOffset, Math.floor(texelmapBuffer.byteLength / 4));
const out = new Float32Array(total * 4);
const axisIndex = { x: 0, y: 1, z: 2 };
const rawByTri = mesh.triangleMetadata.map((meta) => {
  const normal = [0, 0, 0];
  if (Object.hasOwn(axisIndex, meta.faceAxis) && (meta.faceSign === -1 || meta.faceSign === 1)) {
    normal[axisIndex[meta.faceAxis]] = meta.faceSign;
  }
  return normal;
});
const seen = new Map([[10, new Set()], [11, new Set()], [20, new Set()], [21, new Set()]]);
let validCount = 0;
for (let idx = 0; idx < total; idx += 1) {
  const base8 = idx * 8;
  const triId = Math.round(texelmap[base8 + 6]);
  const valid = texelmap[base8 + 7] > 0.5;
  const base4 = idx * 4;
  if (valid && triId >= 0 && triId < rawByTri.length) {
    const n = rawByTri[triId];
    out[base4 + 0] = n[0];
    out[base4 + 1] = n[1];
    out[base4 + 2] = n[2];
    out[base4 + 3] = 1;
    validCount += 1;
    if (seen.has(triId)) seen.get(triId).add(`${n[0]},${n[1]},${n[2]}`);
  }
}
fs.writeFileSync(outPath, Buffer.from(out.buffer));
for (const [triId, values] of seen.entries()) {
  console.log(`tri${triId}: ${[...values].join(' | ')}`);
}
console.log(`[wrote] ${outPath} atlas=${width}x${height} valid=${validCount}`);
