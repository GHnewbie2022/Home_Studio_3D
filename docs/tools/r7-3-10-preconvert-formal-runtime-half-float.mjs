#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WRITE = process.argv.includes('--write');
const CHUNK_BYTES = 8 * 1024 * 1024;
const RUNTIME_ARTIFACT = 'atlas-patch-000-rgba-f16.bin';

const FORMAL_POINTERS = Object.freeze([
	['north', 'docs/data/r7-3-10-xatlas-full-north-wall-1000spp-runtime-package.json'],
	['east', 'docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json'],
	['south', 'docs/data/r7-3-10-xatlas-full-south-wall-1000spp-runtime-package.json'],
	['west', 'docs/data/r7-3-10-xatlas-full-west-wall-1000spp-runtime-package.json'],
	['west_threshold_top', 'docs/data/r7-3-10-xatlas-west-threshold-top-1000spp-runtime-package.json'],
	['west_threshold_front', 'docs/data/r7-3-10-xatlas-west-threshold-front-1000spp-runtime-package.json'],
	['ceiling', 'docs/data/r7-3-10-xatlas-full-ceiling-1000spp-runtime-package.json'],
	['depth_h2', 'docs/data/r7-3-10-xatlas-full-depth-h2-1000spp-runtime-package.json'],
	['floor', 'docs/data/r7-3-10-xatlas-full-floor-runtime-package.json'],
	['central_desk', 'docs/data/r7-3-10-xatlas-central-desk-runtime-package.json'],
	['northeast_bed', 'docs/data/r7-3-10-xatlas-northeast-bed-runtime-package.json'],
	['south_fixed_furniture', 'docs/data/r7-3-10-xatlas-south-fixed-furniture-runtime-package.json'],
	['structural', 'docs/data/r7-3-10-xatlas-structural-runtime-package.json'],
	['south_window_reveals', 'docs/data/r7-3-10-xatlas-south-window-reveals-runtime-package.json'],
	['west_wall_switch', 'docs/data/r7-3-10-xatlas-west-wall-switch-runtime-package.json']
]);

function readJson(relativePath)
{
	return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function assertFormalPointer(surface, pointer)
{
	if (pointer.packageStatus !== 'accepted')
		throw new Error(`${surface}: packageStatus must be accepted`);
	if (pointer.bakedRadianceKind !== 'full_diffuse_radiance' ||
		pointer.directLightAlreadyIncluded !== true ||
		pointer.addDirectLightAfterBakeLookup !== false)
		throw new Error(`${surface}: FULL BAKE contract mismatch`);
	if (!pointer.validation || pointer.validation.status !== 'pass')
		throw new Error(`${surface}: pointer validation must pass`);
	if (!pointer.packageDir || !pointer.artifacts || !pointer.artifacts.atlasPatch0 || !pointer.artifacts.validationReport)
		throw new Error(`${surface}: package artifact metadata is incomplete`);

	const packageValidation = readJson(path.join(pointer.packageDir, pointer.artifacts.validationReport));
	if (packageValidation.status !== 'pass')
		throw new Error(`${surface}: package validation report must pass`);
}

function float32BitsToFloat16(bits)
{
	const sign = (bits >>> 16) & 0x8000;
	const exponent = (bits >>> 23) & 0xff;
	const mantissa = bits & 0x007fffff;

	if (exponent === 0xff)
		return sign | 0x7c00 | (mantissa ? 0x0200 : 0);

	let halfExponent = exponent - 127 + 15;
	if (halfExponent >= 31)
		return sign | 0x7c00;
	if (halfExponent <= 0)
	{
		if (halfExponent < -10)
			return sign;
		const normalized = mantissa | 0x00800000;
		const shift = 14 - halfExponent;
		let halfMantissa = normalized >>> shift;
		const remainderMask = (1 << shift) - 1;
		const remainder = normalized & remainderMask;
		const halfway = 1 << (shift - 1);
		if (remainder > halfway || (remainder === halfway && (halfMantissa & 1)))
			halfMantissa += 1;
		return sign | halfMantissa;
	}

	let halfMantissa = mantissa >>> 13;
	const remainder = mantissa & 0x1fff;
	if (remainder > 0x1000 || (remainder === 0x1000 && (halfMantissa & 1)))
	{
		halfMantissa += 1;
		if (halfMantissa === 0x0400)
		{
			halfMantissa = 0;
			halfExponent += 1;
			if (halfExponent >= 31)
				return sign | 0x7c00;
		}
	}
	return sign | (halfExponent << 10) | halfMantissa;
}

async function convertAtlas(surface, sourcePath, runtimePath, expectedSourceBytes, expectedRuntimeBytes, itemIndex)
{
	const sourceStat = fs.statSync(sourcePath);
	if (sourceStat.size !== expectedSourceBytes)
		throw new Error(`${surface}: source byte length ${sourceStat.size} != ${expectedSourceBytes}`);

	const tempPath = `${runtimePath}.tmp-${process.pid}`;
	const sourceHandle = await fs.promises.open(sourcePath, 'r');
	const targetHandle = await fs.promises.open(tempPath, 'w');
	const hash = crypto.createHash('sha256');
	const inputBuffer = new ArrayBuffer(CHUNK_BYTES);
	const inputBytes = new Uint8Array(inputBuffer);
	const inputBits = new Uint32Array(inputBuffer);
	const outputBuffer = new ArrayBuffer(CHUNK_BYTES / 2);
	const outputHalf = new Uint16Array(outputBuffer);
	let sourceOffset = 0;

	try
	{
		while (sourceOffset < expectedSourceBytes)
		{
			const bytesToRead = Math.min(CHUNK_BYTES, expectedSourceBytes - sourceOffset);
			const { bytesRead } = await sourceHandle.read(inputBytes, 0, bytesToRead, sourceOffset);
			if (bytesRead !== bytesToRead || bytesRead % 4 !== 0)
				throw new Error(`${surface}: incomplete Float32 read at byte ${sourceOffset}`);
			const valueCount = bytesRead / 4;
			for (let i = 0; i < valueCount; i += 1)
				outputHalf[i] = float32BitsToFloat16(inputBits[i]);
			const outputBytes = Buffer.from(outputBuffer, 0, valueCount * 2);
			await targetHandle.write(outputBytes);
			hash.update(outputBytes);
			sourceOffset += bytesRead;
			const percent = Math.floor(sourceOffset * 100 / expectedSourceBytes);
			process.stdout.write(`\r[${itemIndex}/${FORMAL_POINTERS.length}] ${surface} ${String(percent).padStart(3)}%`);
		}
	}
	catch (error)
	{
		await sourceHandle.close();
		await targetHandle.close();
		fs.rmSync(tempPath, { force: true });
		throw error;
	}

	await sourceHandle.close();
	await targetHandle.close();
	if (fs.statSync(tempPath).size !== expectedRuntimeBytes)
	{
		fs.rmSync(tempPath, { force: true });
		throw new Error(`${surface}: generated HalfFloat byte length mismatch`);
	}
	fs.renameSync(tempPath, runtimePath);
	process.stdout.write('\n');
	return hash.digest('hex');
}

function updatePointer(pointerPath, pointer, runtimeHash, runtimeBytes)
{
	pointer.sourceAtlasFormat = 'rgba-f32';
	pointer.runtimeAtlasFormat = 'rgba-f16';
	pointer.runtimeAtlasByteLength = runtimeBytes;
	pointer.artifacts.runtimeAtlasPatch0 = RUNTIME_ARTIFACT;
	pointer.artifactHashes = pointer.artifactHashes || {};
	pointer.artifactHashes.runtimeAtlasPatch0Sha256 = runtimeHash;
	fs.writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
}

async function main()
{
	const endianProbe = new Uint8Array(new Uint16Array([0x1234]).buffer);
	if (endianProbe[0] !== 0x34)
		throw new Error('This converter requires a little-endian host');

	let sourceBytesTotal = 0;
	let runtimeBytesTotal = 0;
	for (let index = 0; index < FORMAL_POINTERS.length; index += 1)
	{
		const [surface, pointerRelativePath] = FORMAL_POINTERS[index];
		const pointerPath = path.join(ROOT, pointerRelativePath);
		const pointer = readJson(pointerRelativePath);
		assertFormalPointer(surface, pointer);
		const valueCount = pointer.targetAtlasWidth * pointer.targetAtlasHeight * 4;
		const expectedSourceBytes = valueCount * 4;
		const expectedRuntimeBytes = valueCount * 2;
		const sourcePath = path.join(ROOT, pointer.packageDir, pointer.artifacts.atlasPatch0);
		const runtimePath = path.join(ROOT, pointer.packageDir, RUNTIME_ARTIFACT);
		sourceBytesTotal += expectedSourceBytes;
		runtimeBytesTotal += expectedRuntimeBytes;

		if (!WRITE)
		{
			const state = fs.existsSync(runtimePath) && fs.statSync(runtimePath).size === expectedRuntimeBytes ? 'ready' : 'needs-conversion';
			console.log(`[${index + 1}/${FORMAL_POINTERS.length}] ${surface}: ${state}`);
			continue;
		}

		const runtimeHash = await convertAtlas(
			surface,
			sourcePath,
			runtimePath,
			expectedSourceBytes,
			expectedRuntimeBytes,
			index + 1
		);
		updatePointer(pointerPath, pointer, runtimeHash, expectedRuntimeBytes);
	}

	console.log(`formalPointers=${FORMAL_POINTERS.length}`);
	console.log(`sourceBytes=${sourceBytesTotal}`);
	console.log(`runtimeBytes=${runtimeBytesTotal}`);
	console.log(`mode=${WRITE ? 'write' : 'check'}`);
}

main().catch((error) =>
{
	console.error(error && error.stack ? error.stack : error);
	process.exitCode = 1;
});
