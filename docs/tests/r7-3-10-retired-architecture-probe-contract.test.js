const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'docs/data');
const IRON_DOOR_POINTER = 'r7-3-10-c1-iron-door-body-runtime-package.json';
const SELF_PATH = path.resolve(__filename);
const ACTIVE_CODE_ROOTS = [
	path.join(ROOT, 'js'),
	path.join(ROOT, 'docs/tests'),
	path.join(ROOT, 'docs/tools')
];
const ACTIVE_CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.py']);

const RETIRED_POINTERS = [
	'r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-east-beam-inner-shadow-runtime-package.json',
	'r7-3-10-c1-east-beam-under-shadow-runtime-package.json',
	'r7-3-10-c1-east-wall-beam-shadow-runtime-package.json',
	'r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-package.json',
	'r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-east-wall-wardrobe-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-floor-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-iron-door-reveal-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-d800-bed-contact-b-alpha-oidn-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-d800-bed-contact-b-alpha-raw-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-oidn-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-raw-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-d800-bed-contact-y279-alpha-oidn-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-d800-bed-contact-y279-alpha-raw-runtime-package.json',
	'r7-3-10-c1-north-east-non-square-runtime-package.json',
	'r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-north-wall-separated-bed-contact-b-alpha-test-runtime-package.json',
	'r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json',
	'r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-se-column-north-shadow-runtime-package.json',
	'r7-3-10-c1-se-column-west-shadow-runtime-package.json',
	'r7-3-10-c1-south-wall-ac-shadow-runtime-package.json',
	'r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-south-window-bottom-reveal-shadow-runtime-package.json',
	'r7-3-10-c1-south-window-left-reveal-shadow-runtime-package.json',
	'r7-3-10-c1-south-window-right-reveal-shadow-runtime-package.json',
	'r7-3-10-c1-south-window-top-reveal-shadow-runtime-package.json',
	'r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json',
	'r7-3-10-c1-sw-column-inner-shadow-runtime-package.json',
	'r7-3-10-c1-sw-column-north-shadow-runtime-package.json',
	'r7-3-10-c1-west-beam-inner-shadow-runtime-package.json',
	'r7-3-10-c1-west-beam-under-shadow-runtime-package.json',
	'r7-3-10-c1-west-wall-beam-shadow-runtime-package.json',
	'r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json',
	'r7-3-10-xatlas-a1-c2c-smoke-runtime-package.json',
	'r7-3-10-xatlas-a1-westbeam-full4x-1000spp-oidn-runtime-package.json',
	'r7-3-10-xatlas-a1-westbeam-full4x-1000spp-runtime-package.json',
	'r7-3-10-xatlas-full-ceiling-1000spp-oidn-runtime-package.json',
	'r7-3-10-xatlas-full-depth-h2-1000spp-oidn-runtime-package.json',
	'r7-3-10-xatlas-full-east-wall-1000spp-oidn-runtime-package.json',
	'r7-3-10-xatlas-full-floor-oidn-runtime-package.json',
	'r7-3-10-xatlas-full-north-wall-1000spp-oidn-rtlightmap-runtime-package.json',
	'r7-3-10-xatlas-full-west-wall-1000spp-oidn-runtime-package.json'
];

assert.strictEqual(RETIRED_POINTERS.length, 44, 'retirement inventory must stay at the approved 44 pointers');

for (const pointerName of RETIRED_POINTERS)
	assert.strictEqual(fs.existsSync(path.join(DATA_DIR, pointerName)), false, `retired pointer still exists: ${pointerName}`);

const runtimePointers = fs.readdirSync(DATA_DIR).filter((name) => name.endsWith('-runtime-package.json'));
for (const pointerName of runtimePointers)
{
	const pointer = JSON.parse(fs.readFileSync(path.join(DATA_DIR, pointerName), 'utf8'));
	assert.notStrictEqual(pointer.packageStatus, 'architecture_probe', `formal data still exposes architecture_probe: ${pointerName}`);
}

const ironDoorPointer = JSON.parse(fs.readFileSync(path.join(DATA_DIR, IRON_DOOR_POINTER), 'utf8'));
assert.strictEqual(ironDoorPointer.packageStatus, 'accepted', 'iron door body must be promoted to accepted');
assert.strictEqual(
	ironDoorPointer.deliveryRole,
	'accepted_hybrid_baked_diffuse_live_specular',
	'iron door body must declare its accepted hybrid role'
);
assert.strictEqual(ironDoorPointer.runtimeEnabledDefault, true, 'iron door body must remain enabled');
assert.strictEqual(ironDoorPointer.liveSpecularReflection, true, 'iron door body must keep LIVE specular reflection');

function collectActiveCodeFiles(root) {
	const files = [];
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		const entryPath = path.join(root, entry.name);
		if (entry.isDirectory()) files.push(...collectActiveCodeFiles(entryPath));
		else if (ACTIVE_CODE_EXTENSIONS.has(path.extname(entry.name))) files.push(entryPath);
	}
	return files;
}

const activeCodeFiles = ACTIVE_CODE_ROOTS.flatMap(collectActiveCodeFiles).filter((filePath) => path.resolve(filePath) !== SELF_PATH);
for (const filePath of activeCodeFiles) {
	const source = fs.readFileSync(filePath, 'utf8');
	for (const pointerName of RETIRED_POINTERS) {
		assert.strictEqual(
			source.includes(pointerName),
			false,
			`retired pointer reference remains in active code: ${path.relative(ROOT, filePath)} -> ${pointerName}`
		);
	}
}

const retiredPackageRoot = path.join(ROOT, 'assets/bakes/r7-3-10/c1-static-diffuse');
const remainingRetiredPackageEntries = fs.existsSync(retiredPackageRoot)
	? fs.readdirSync(retiredPackageRoot).filter((name) => name !== 'README.md')
	: [];
assert.deepStrictEqual(remainingRetiredPackageEntries, [], 'retired c1-static-diffuse packages must stay removed');

console.log('R7-3.10 retired architecture-probe contract passed');
