const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..');
const tool = path.join(repo, 'docs/tools/r7-3-10-north-full-bake-readiness-audit.mjs');

assert.ok(fs.existsSync(tool), 'north full-bake readiness audit tool must exist');

const report = JSON.parse(execFileSync('node', [tool], {
	cwd: repo,
	encoding: 'utf8',
}));

assert.equal(report.tool, 'r7-3-10-north-full-bake-readiness-audit');
assert.deepEqual(report.requiredNorthAtlas, { width: 2325, height: 3377 });
assert.equal(report.browserLaunched, false, 'readiness audit must stay file-only');
assert.equal(report.gpuSmokeLaunched, false, 'readiness audit must not run browser or GPU smoke');
assert.ok(['ready', 'raw_ready_oidn_pending', 'not_ready'].includes(report.status), 'readiness audit must return a deterministic status');
assert.equal(report.northOnlyFullBakeAdmission?.scope, 'north_wall_only');
assert.equal(report.northOnlyFullBakeAdmission?.prepareTool, 'docs/tools/r7-3-10-full-north-wall-xatlas-phase2-prepare.py');
assert.equal(report.northOnlyFullBakeAdmission?.packageTool, 'docs/tools/r7-3-10-full-north-wall-xatlas-package.mjs');
assert.ok(
	report.northOnlyFullBakeAdmission?.requiredRunnerFlags?.includes('--r7310-xatlas-bake'),
	'north admission plan must require xatlas bake mode'
);
assert.ok(
	report.northOnlyFullBakeAdmission?.requiredRunnerFlags?.includes('--r7310-xatlas-full-radiance-bake'),
	'north admission plan must require full-radiance bake mode'
);
assert.deepEqual(report.northOnlyFullBakeAdmission?.forbiddenScopes, ['full_room_rebake']);
assert.ok(Array.isArray(report.northSizedPackageInventory), 'readiness audit must report north-sized package inventory');
assert.ok(
	report.northSizedPackageInventory.some((pkg) =>
		pkg.packageDir === '.omc/r7-3-10-xatlas-bake-spike/20260613-100834' &&
		pkg.acceptedAsFullBake === false &&
		Array.isArray(pkg.rejectionReasons) &&
		pkg.rejectionReasons.includes('not_full_diffuse_radiance') &&
		pkg.rejectionReasons.includes('validation_not_pass')
	),
	'readiness audit must explain why the current north-sized package is rejected'
);

for (const pointer of report.officialPointers) {
	assert.equal(pointer.targetAtlasWidth, 2325, `${pointer.kind} north pointer width must match north spec`);
	assert.equal(pointer.targetAtlasHeight, 3377, `${pointer.kind} north pointer height must match north spec`);
}

const rawPointer = report.officialPointers.find((pointer) => pointer.kind === 'raw');
const oidnPointer = report.officialPointers.find((pointer) => pointer.kind === 'oidn');

if (report.rawReady) {
	assert.equal(report.ready, true);
	assert.equal(report.blockers.length, 0);
	assert.equal(rawPointer.bakedRadianceKind, 'full_diffuse_radiance');
	assert.equal(rawPointer.directLightAlreadyIncluded, true);
	assert.equal(rawPointer.addDirectLightAfterBakeLookup, false);
	assert.equal(rawPointer.validationStatus, 'pass');
	assert.ok(
		report.fullNorthCandidatePackages.some((pkg) => pkg.packageDir === rawPointer.packageDir),
		'raw pointer must be backed by an accepted full north package'
	);
	if (report.oidnReady) {
		assert.equal(report.status, 'ready');
		assert.equal(report.oidnBlockers.length, 0);
		assert.equal(oidnPointer.bakedRadianceKind, 'full_diffuse_radiance');
		assert.equal(oidnPointer.directLightAlreadyIncluded, true);
		assert.equal(oidnPointer.addDirectLightAfterBakeLookup, false);
		assert.equal(oidnPointer.validationStatus, 'pass');
	} else {
		assert.equal(report.status, 'raw_ready_oidn_pending');
		assert.match(report.oidnBlockers.join('\n'), /oidn:official_north_pointer_not_full_radiance/);
		assert.equal(oidnPointer.directLightAlreadyIncluded, false);
	}
} else {
	assert.equal(report.ready, false);
	assert.match(report.blockers.join('\n'), /official_north_pointer_not_full_radiance/);
	assert.match(report.blockers.join('\n'), /north_full_radiance_package_missing/);
	assert.ok(report.fullNorthCandidatePackages.length === 0, 'repo must not silently contain an unused north full-radiance package');
	assert.equal(rawPointer.bakedRadianceKind, 'indirect_diffuse_radiance');
	assert.equal(rawPointer.directLightAlreadyIncluded, false);
	assert.equal(rawPointer.addDirectLightAfterBakeLookup, true);
}

console.log('R7-3.10 north full-bake readiness audit contract passed');
