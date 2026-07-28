#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_CONTRACT = 'docs/data/r7-3-10-xatlas-runtime-capacity-contract.json';
const DEFAULT_REPORT = 'docs/reports/r7-3-10-xatlas-runtime-capacity-preflight.json';

function readJson(relativePath)
{
	return JSON.parse(fs.readFileSync(path.resolve(ROOT, relativePath), 'utf8'));
}

function bytesToMiB(bytes)
{
	return Number((bytes / (1024 * 1024)).toFixed(3));
}

function evaluateGlslCondition(condition, defines)
{
	return condition
		.split(/\s*&&\s*/)
		.every((part) => {
			const defined = part.match(/^defined\((\w+)\)$/);
			if (defined) return defines.has(defined[1]);
			const notDefined = part.match(/^!defined\((\w+)\)$/);
			if (notDefined) return !defines.has(notDefined[1]);
			throw new Error(`Unsupported GLSL preflight condition: ${condition}`);
		});
}

function preprocessGlsl(source, defines)
{
	const output = [];
	const stack = [];
	let active = true;
	for (const line of source.split('\n')) {
		const ifMatch = line.match(/^\s*#if\s+(.+?)\s*$/);
		if (ifMatch) {
			const parentActive = active;
			const branchActive = parentActive && evaluateGlslCondition(ifMatch[1], defines);
			stack.push({ parentActive, branchActive, anyTrue: branchActive });
			active = branchActive;
			continue;
		}
		if (/^\s*#else\s*$/.test(line)) {
			const current = stack.at(-1);
			if (!current) throw new Error('#else without matching #if');
			current.branchActive = current.parentActive && !current.anyTrue;
			current.anyTrue ||= current.branchActive;
			active = current.branchActive;
			continue;
		}
		if (/^\s*#endif\s*$/.test(line)) {
			if (!stack.pop()) throw new Error('#endif without matching #if');
			active = stack.length ? stack.at(-1).branchActive : true;
			continue;
		}
		if (active) output.push(line);
	}
	if (stack.length) throw new Error('GLSL preflight stack did not close');
	return output.join('\n');
}

function formalRawSamplerNames()
{
	const shader = fs.readFileSync(path.resolve(ROOT, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
	const common = fs.readFileSync(path.resolve(ROOT, 'js/PathTracingCommon.js'), 'utf8');
	const chunkMatch = common.match(/THREE\.ShaderChunk\[\s*['"]pathtracing_uniforms_and_defines['"]\s*\]\s*=\s*`([\s\S]*?)`;/);
	if (!chunkMatch) throw new Error('pathtracing_uniforms_and_defines shader chunk is missing');
	const expanded = shader.replace('#include <pathtracing_uniforms_and_defines>', chunkMatch[1]);
	const preprocessed = preprocessGlsl(expanded, new Set([
		'R7310_RUNTIME_NO_BORROW_TEXTURE',
		'R7310_FORMAL_XATLAS_RAW'
	]));
	return Array.from(preprocessed.matchAll(/\buniform\s+sampler2D\s+(\w+)\s*;/g), (match) => match[1]);
}

function loadFormalPages(contract)
{
	const formal = readJson(contract.formalBakeContract);
	const required = formal.requirements;
	return formal.formalPointers.map(({ surface, path: pointerPath }) => {
		const pointer = readJson(pointerPath);
		const violations = [];
		if (pointer.packageStatus !== required.packageStatus) violations.push(`packageStatus=${pointer.packageStatus}`);
		if (pointer.bakedRadianceKind !== required.bakedRadianceKind) violations.push(`bakedRadianceKind=${pointer.bakedRadianceKind}`);
		if (pointer.directLightAlreadyIncluded !== required.directLightAlreadyIncluded) violations.push(`directLightAlreadyIncluded=${pointer.directLightAlreadyIncluded}`);
		if (pointer.addDirectLightAfterBakeLookup !== required.addDirectLightAfterBakeLookup) violations.push(`addDirectLightAfterBakeLookup=${pointer.addDirectLightAfterBakeLookup}`);
		if (pointer.validation?.status !== required.validationStatus) violations.push(`validation.status=${pointer.validation?.status}`);
		if (pointer.runtimeAtlasFormat !== required.runtimeAtlasFormat) violations.push(`runtimeAtlasFormat=${pointer.runtimeAtlasFormat}`);

		const width = Number(pointer.targetAtlasWidth);
		const height = Number(pointer.targetAtlasHeight);
		const expectedBytes = width * height * contract.hardwareLimits.bytesPerTexel;
		if (pointer.runtimeAtlasByteLength !== expectedBytes) {
			violations.push(`runtimeAtlasByteLength=${pointer.runtimeAtlasByteLength}, expected=${expectedBytes}`);
		}
		const artifactPath = path.resolve(ROOT, pointer.packageDir, pointer.artifacts?.runtimeAtlasPatch0 || '');
		if (!pointer.artifacts?.runtimeAtlasPatch0 || !fs.existsSync(artifactPath)) {
			violations.push(`runtime artifact missing: ${path.relative(ROOT, artifactPath)}`);
		} else {
			const actualBytes = fs.statSync(artifactPath).size;
			if (actualBytes !== expectedBytes) violations.push(`runtime artifact bytes=${actualBytes}, expected=${expectedBytes}`);
		}
		return {
			surface,
			pointerPath,
			width,
			height,
			bytes: expectedBytes,
			mib: bytesToMiB(expectedBytes),
			status: violations.length ? 'fail' : 'pass',
			violations
		};
	});
}

function deployedPacking(pages, contract)
{
	const bySurface = new Map(pages.map((page) => [page.surface, page]));
	const { gutterPx, deployedColumns, separateSurfaces } = contract.runtimeArchitecture;
	const column = (names) => ({
		width: Math.max(...names.map((name) => bySurface.get(name)?.width || 0)),
		height: names.reduce((sum, name, index) => sum + (bySurface.get(name)?.height || 0) + (index ? gutterPx : 0), 0)
	});
	const left = column(deployedColumns.left);
	const right = column(deployedColumns.right);
	const width = left.width + gutterPx + right.width;
	const height = Math.max(left.height, right.height);
	const separatePages = separateSurfaces.map((surface) => bySurface.get(surface)).filter(Boolean);
	const packedBytes = width * height * contract.hardwareLimits.bytesPerTexel;
	const separateBytes = separatePages.reduce((sum, page) => sum + page.bytes, 0);
	return {
		width,
		height,
		left,
		right,
		packedBytes,
		packedMiB: bytesToMiB(packedBytes),
		separateBytes,
		separateMiB: bytesToMiB(separateBytes),
		gpuResidentBytes: packedBytes + separateBytes,
		gpuResidentMiB: bytesToMiB(packedBytes + separateBytes)
	};
}

function intersects(a, b)
{
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function containedBy(a, b)
{
	return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

function splitFreeRect(free, used)
{
	if (!intersects(free, used)) return [free];
	const result = [];
	if (used.x > free.x) result.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
	if (used.x + used.w < free.x + free.w) result.push({ x: used.x + used.w, y: free.y, w: free.x + free.w - used.x - used.w, h: free.h });
	if (used.y > free.y) result.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
	if (used.y + used.h < free.y + free.h) result.push({ x: free.x, y: used.y + used.h, w: free.w, h: free.y + free.h - used.y - used.h });
	return result.filter((rect) => rect.w > 0 && rect.h > 0);
}

function pruneFreeRects(rects)
{
	return rects.filter((rect, index) => !rects.some((other, otherIndex) => index !== otherIndex && containedBy(rect, other)));
}

function packAtWidth(pages, width, maxHeight, gutterPx)
{
	const ordered = pages
		.map((page) => ({ ...page, paddedW: page.width + gutterPx, paddedH: page.height + gutterPx }))
		.sort((a, b) => Math.max(b.paddedW, b.paddedH) - Math.max(a.paddedW, a.paddedH) || b.bytes - a.bytes || a.surface.localeCompare(b.surface));
	let freeRects = [{ x: 0, y: 0, w: width, h: maxHeight }];
	const placements = [];
	for (const page of ordered) {
		let best = null;
		for (const free of freeRects) {
			if (page.paddedW > free.w || page.paddedH > free.h) continue;
			const candidate = {
				x: free.x,
				y: free.y,
				w: page.paddedW,
				h: page.paddedH,
				scoreY: Math.max(...placements.map((item) => item.y + item.h), 0, free.y + page.paddedH),
				waste: free.w * free.h - page.paddedW * page.paddedH
			};
			if (!best || candidate.scoreY < best.scoreY || (candidate.scoreY === best.scoreY && candidate.waste < best.waste)) best = candidate;
		}
		if (!best) return null;
		const placed = { ...best, surface: page.surface, width: page.width, height: page.height };
		placements.push(placed);
		freeRects = pruneFreeRects(freeRects.flatMap((free) => splitFreeRect(free, placed)));
	}
	const usedWidth = Math.max(...placements.map((item) => item.x + item.w), 0) - gutterPx;
	const usedHeight = Math.max(...placements.map((item) => item.y + item.h), 0) - gutterPx;
	return { width: usedWidth, height: usedHeight, placements };
}

function optimizedPacking(pages, contract)
{
	const separate = new Set(contract.runtimeArchitecture.separateSurfaces);
	const packedPages = pages.filter((page) => !separate.has(page.surface));
	const separatePages = pages.filter((page) => separate.has(page.surface));
	const candidates = [];
	for (const width of contract.packingForecast.candidateWidths) {
		if (width > contract.hardwareLimits.maxTextureDimension) continue;
		const packed = packAtWidth(packedPages, width, contract.hardwareLimits.maxTextureDimension, contract.runtimeArchitecture.gutterPx);
		if (!packed || packed.height > contract.hardwareLimits.maxTextureDimension) continue;
		const packedBytes = packed.width * packed.height * contract.hardwareLimits.bytesPerTexel;
		const separateBytes = separatePages.reduce((sum, page) => sum + page.bytes, 0);
		candidates.push({
			...packed,
			packedBytes,
			separateBytes,
			gpuResidentBytes: packedBytes + separateBytes
		});
	}
	return candidates.sort((a, b) => a.gpuResidentBytes - b.gpuResidentBytes || a.height - b.height)[0] || null;
}

function evaluateCapacity({ pages, packing, samplerCount, contract })
{
	const violations = [];
	const { hardwareLimits, projectBudgets } = contract;
	if (!packing) violations.push('No valid packing fits within maxTextureDimension');
	if (packing && (packing.width > hardwareLimits.maxTextureDimension || packing.height > hardwareLimits.maxTextureDimension)) {
		violations.push(`packed dimensions ${packing.width}x${packing.height} exceed ${hardwareLimits.maxTextureDimension}`);
	}
	for (const page of pages) {
		if (page.width > hardwareLimits.maxTextureDimension || page.height > hardwareLimits.maxTextureDimension) {
			violations.push(`${page.surface} dimensions ${page.width}x${page.height} exceed ${hardwareLimits.maxTextureDimension}`);
		}
	}
	if (samplerCount > hardwareLimits.maxFragmentSamplers) violations.push(`sampler count ${samplerCount} exceeds ${hardwareLimits.maxFragmentSamplers}`);
	if (pages.length > projectBudgets.maxLogicalPageCount) violations.push(`logical page count ${pages.length} exceeds project budget ${projectBudgets.maxLogicalPageCount}`);
	if (packing?.gpuResidentBytes > projectBudgets.maxGpuResidentBytes) {
		violations.push(`GPU resident ${packing.gpuResidentBytes} exceeds project budget ${projectBudgets.maxGpuResidentBytes}`);
	}
	const largestPageBytes = Math.max(...pages.map((page) => page.bytes), 0);
	const estimatedPeakBytes = packing ? 2 * packing.gpuResidentBytes + largestPageBytes : null;
	if (estimatedPeakBytes !== null && estimatedPeakBytes > projectBudgets.maxEstimatedPeakBytes) {
		violations.push(`estimated peak ${estimatedPeakBytes} exceeds project budget ${projectBudgets.maxEstimatedPeakBytes}`);
	}
	return {
		status: violations.length ? 'fail' : 'pass',
		violations,
		logicalPageCount: pages.length,
		samplerCount,
		largestPageBytes,
		largestPageMiB: bytesToMiB(largestPageBytes),
		estimatedPeakBytes,
		estimatedPeakMiB: estimatedPeakBytes === null ? null : bytesToMiB(estimatedPeakBytes)
	};
}

function scenarioPages(basePages, count, typicalPage)
{
	const pages = basePages.map((page) => ({ ...page }));
	for (let index = 0; index < count; index += 1) {
		pages.push({
			surface: `forecast_furniture_${String(index + 1).padStart(2, '0')}`,
			width: typicalPage.width,
			height: typicalPage.height,
			bytes: typicalPage.width * typicalPage.height * 8,
			estimated: true
		});
	}
	return pages;
}

function ownerRegistrySummary(contract)
{
	const registry = readJson(contract.surfaceOwnerRegistry);
	return {
		registeredSurfaceCount: Object.keys(registry.surfaces || {}).length,
		forecastCompleteness: 'explicit_scenarios_only',
		note: 'Unregistered future furniture is represented by forecast scenarios; the owner registry is not treated as a complete furniture backlog.'
	};
}

export function buildCapacityReport(contractPath = DEFAULT_CONTRACT)
{
	const contract = readJson(contractPath);
	const pages = loadFormalPages(contract);
	const samplerNames = formalRawSamplerNames();
	const deployed = deployedPacking(pages, contract);
	const deployedEvaluation = evaluateCapacity({ pages, packing: deployed, samplerCount: samplerNames.length, contract });
	const scenarios = contract.packingForecast.scenarios.map((scenario) => {
		const projectedPages = scenarioPages(pages, scenario.additionalPageCount, contract.packingForecast.typicalFurniturePage);
		const packing = optimizedPacking(projectedPages, contract);
		const evaluation = evaluateCapacity({ pages: projectedPages, packing, samplerCount: samplerNames.length, contract });
		return {
			...scenario,
			status: evaluation.status,
			violations: evaluation.violations,
			logicalPageCount: evaluation.logicalPageCount,
			packing: packing ? {
				width: packing.width,
				height: packing.height,
				packedBytes: packing.packedBytes,
				packedMiB: bytesToMiB(packing.packedBytes),
				separateBytes: packing.separateBytes,
				separateMiB: bytesToMiB(packing.separateBytes),
				gpuResidentBytes: packing.gpuResidentBytes,
				gpuResidentMiB: bytesToMiB(packing.gpuResidentBytes)
			} : null,
			estimatedPeakBytes: evaluation.estimatedPeakBytes,
			estimatedPeakMiB: evaluation.estimatedPeakMiB
		};
	});
	return {
		version: contract.version,
		generatedAt: new Date().toISOString(),
		status: pages.every((page) => page.status === 'pass') && deployedEvaluation.status === 'pass' ? 'pass' : 'fail',
		hardwareLimits: contract.hardwareLimits,
		projectBudgets: contract.projectBudgets,
		formalPages: pages,
		formalPayloadBytes: pages.reduce((sum, page) => sum + page.bytes, 0),
		formalPayloadMiB: bytesToMiB(pages.reduce((sum, page) => sum + page.bytes, 0)),
		ownerRegistry: ownerRegistrySummary(contract),
		shader: {
			samplerCount: samplerNames.length,
			maxFragmentSamplers: contract.hardwareLimits.maxFragmentSamplers,
			samplerNames,
			status: samplerNames.length <= contract.hardwareLimits.maxFragmentSamplers ? 'pass' : 'fail'
		},
		deployed: {
			...deployed,
			status: deployedEvaluation.status,
			violations: deployedEvaluation.violations,
			estimatedPeakBytes: deployedEvaluation.estimatedPeakBytes,
			estimatedPeakMiB: deployedEvaluation.estimatedPeakMiB
		},
		scenarios
	};
}

export { deployedPacking, evaluateCapacity, optimizedPacking, scenarioPages };

function parseArgs(argv)
{
	const options = { contractPath: DEFAULT_CONTRACT, reportPath: null, requireScenario: null };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--contract') options.contractPath = argv[++index];
		else if (arg === '--write-report') options.reportPath = argv[index + 1]?.startsWith('--') || !argv[index + 1] ? DEFAULT_REPORT : argv[++index];
		else if (arg === '--require-scenario') options.requireScenario = argv[++index];
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const options = parseArgs(process.argv.slice(2));
	const report = buildCapacityReport(options.contractPath);
	if (options.reportPath) {
		const outputPath = path.resolve(ROOT, options.reportPath);
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
	}
	console.log(JSON.stringify(report, null, 2));
	if (report.status !== 'pass') process.exitCode = 1;
	if (options.requireScenario) {
		const scenario = report.scenarios.find((item) => item.id === options.requireScenario);
		if (!scenario) throw new Error(`Unknown scenario: ${options.requireScenario}`);
		if (scenario.status !== 'pass') process.exitCode = 1;
	}
}
