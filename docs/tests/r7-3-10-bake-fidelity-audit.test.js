import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r7310-bake-fidelity-'));
const refDir = path.join(tmpRoot, 'ref');
const candidateDir = path.join(tmpRoot, 'candidate');
fs.mkdirSync(refDir, { recursive: true });
fs.mkdirSync(candidateDir, { recursive: true });

function writeAtlas(dir, width, height, mutate)
{
	const pixels = new Float32Array(width * height * 4);
	for (let y = 0; y < height; y += 1)
	{
		for (let x = 0; x < width; x += 1)
		{
			const index = (y * width + x) * 4;
			const base = 0.2 + x * 0.01 + y * 0.02;
			pixels[index + 0] = base;
			pixels[index + 1] = base * 0.9;
			pixels[index + 2] = base * 0.8;
			pixels[index + 3] = 1.0;
		}
	}
	if (mutate)
		mutate(pixels, width, height);
	fs.writeFileSync(path.join(dir, 'atlas-patch-000-rgba-f32.bin'), Buffer.from(pixels.buffer));
}

writeAtlas(refDir, 8, 8);
writeAtlas(candidateDir, 8, 8, (pixels) => {
	for (let i = 0; i < pixels.length; i += 4)
	{
		pixels[i + 0] *= 1.005;
		pixels[i + 1] *= 1.005;
		pixels[i + 2] *= 1.005;
	}
});

const pass = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-bake-fidelity-audit.mjs',
	'--reference-dir', refDir,
	'--candidate-dir', candidateDir,
	'--width', '8',
	'--height', '8',
	'--block-size', '4',
	'--tile-width', '4',
	'--tile-height', '4',
	'--json'
], { encoding: 'utf8' });
assert.equal(pass.status, 0, pass.stderr || pass.stdout);
const passReport = JSON.parse(pass.stdout);
assert.equal(passReport.status, 'pass');
assert.equal(passReport.inputs.referenceDir, refDir);
assert.equal(passReport.inputs.candidateDir, candidateDir);
assert.equal(passReport.seamMode, 'reference');
assert.ok(passReport.blockRatio.min >= 0.98);
assert.ok(passReport.blockRatio.max <= 1.02);

writeAtlas(candidateDir, 8, 8, (pixels, width, height) => {
	for (let y = 0; y < height; y += 1)
	{
		for (let x = 4; x < width; x += 1)
		{
			const index = (y * width + x) * 4;
			pixels[index + 0] *= 0.5;
			pixels[index + 1] *= 0.5;
			pixels[index + 2] *= 0.5;
		}
	}
});

const fail = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-bake-fidelity-audit.mjs',
	'--reference-dir', refDir,
	'--candidate-dir', candidateDir,
	'--width', '8',
	'--height', '8',
	'--block-size', '4',
	'--tile-width', '4',
	'--tile-height', '4',
	'--json'
], { encoding: 'utf8' });
assert.notEqual(fail.status, 0);
const failReport = JSON.parse(fail.stdout);
assert.equal(failReport.status, 'fail');
assert.ok(failReport.failedChecks.includes('block-ratio-out-of-range'));

writeAtlas(candidateDir, 8, 8, (pixels) => {
	for (let i = 0; i < pixels.length; i += 4)
	{
		pixels[i + 0] *= 1.005;
		pixels[i + 1] *= 1.005;
		pixels[i + 2] *= 1.005;
	}
});

const outputPath = path.join(tmpRoot, 'candidate-only-seam.json');
const noReferencePass = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-bake-fidelity-audit.mjs',
	'--candidate-dir', candidateDir,
	'--width', '8',
	'--height', '8',
	'--tile-width', '4',
	'--tile-height', '4',
	'--no-reference-seam',
	'--json',
	'--output', outputPath
], { encoding: 'utf8' });
assert.equal(noReferencePass.status, 0, noReferencePass.stderr || noReferencePass.stdout);
const noReferencePassReport = JSON.parse(noReferencePass.stdout);
assert.equal(noReferencePassReport.status, 'pass');
assert.equal(noReferencePassReport.seamMode, 'candidate-only');
assert.equal(noReferencePassReport.blockRatio, null);
assert.equal(JSON.parse(fs.readFileSync(outputPath, 'utf8')).status, 'pass');

writeAtlas(candidateDir, 8, 8, (pixels, width, height) => {
	for (let y = 0; y < height; y += 1)
	{
		for (let x = 4; x < width; x += 1)
		{
			const index = (y * width + x) * 4;
			pixels[index + 0] *= 0.5;
			pixels[index + 1] *= 0.5;
			pixels[index + 2] *= 0.5;
		}
	}
});

const noReferenceFail = spawnSync(process.execPath, [
	'docs/tools/r7-3-10-bake-fidelity-audit.mjs',
	'--candidate-dir', candidateDir,
	'--width', '8',
	'--height', '8',
	'--tile-width', '4',
	'--tile-height', '4',
	'--no-reference-seam',
	'--json'
], { encoding: 'utf8' });
assert.notEqual(noReferenceFail.status, 0);
const noReferenceFailReport = JSON.parse(noReferenceFail.stdout);
assert.equal(noReferenceFailReport.status, 'fail');
assert.ok(noReferenceFailReport.failedChecks.includes('candidate-tile-seam-delta-out-of-range'));

console.log('R7-3.10 bake fidelity audit test passed');
