#!/usr/bin/env node
// R7-3.10 global seam hardening — run every JS<->shader seam contract test in one shot.
//
// These static contract tests are the institutional guard against the recurring root cause:
// an ownership-exclusion constant or wiring drifting between the shader and InitCommon.js
// (the "metadata knows invalid, runtime still reads" class). Run this in CI / before any
// edit to a *DiffuseUv gate or a *_COLUMN_BACK / beam-gap / handoff constant.
import { spawnSync } from 'node:child_process';

const tests = [
	'docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js',
	'docs/tests/r7-3-10-south-wall-side-column-contract.test.js',
	'docs/tests/r7-3-10-seam-shared-constant-contract.test.js',
	'docs/tests/r7-3-10-a1-contact-edge-registry-contract.test.js',
];

let failed = 0;
for (const t of tests) {
	const r = spawnSync('node', [t], { encoding: 'utf8' });
	const ok = r.status === 0;
	if (!ok) failed += 1;
	process.stdout.write(`[${ok ? 'PASS' : 'FAIL'}] ${t}\n`);
	if (!ok) process.stdout.write((r.stdout || '') + (r.stderr || '') + '\n');
}
if (failed) {
	console.error(`\n${failed}/${tests.length} seam contract test(s) FAILED`);
	process.exit(1);
}
console.log(`\nAll ${tests.length} seam contract tests passed`);
