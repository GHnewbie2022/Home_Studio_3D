#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WIDTH = 2325;
const HEIGHT = 3377;
const WALL_Z = -1.874;
const PREP_DIR = '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/xatlas-bake-full-north-wall';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORT = { width: 96, height: 96, deviceScaleFactor: 1, mobile: false };
const WESTBEAM_SEAM_LIFT_PROBE = process.argv.includes('--westbeam-seam-lift-probe');
const WESTBEAM_VISIBLE_RANGE_LIFT_PROBE = process.argv.includes('--westbeam-visible-range-lift-probe');
const PHASE0_SCAN = process.argv.includes('--phase0-scan') || WESTBEAM_SEAM_LIFT_PROBE || WESTBEAM_VISIBLE_RANGE_LIFT_PROBE;
const PHASE0_LIFT_METERS = 0.000125;
const PHASE0_RADIUS_METERS = 0.000625;
const PHASE0_NEE_WORST_OF_DIRECTIONS = 8;
const TEXEL_SIZE_METERS = 0.00125;
const BED_AABB = {
	min: { x: -0.027, y: 0.0, z: -1.874 },
	max: { x: 1.91, y: 0.28, z: -0.314 }
};
const WALL_NORMAL = { x: 0, y: 0, z: 1 };
const BEDTOP_TARGETS = [
	{ name: 'bed_top_below_27875', world: { x: 0.0, y: 0.27875, z: WALL_Z }, role: 'vertical_radius_sweep_below_contact' },
	{ name: 'bed_top_contact', world: { x: 0.0, y: 0.280, z: WALL_Z }, role: 'horizontal_bed_top_contact' },
	{ name: 'bed_top_above_28125', world: { x: 0.0, y: 0.28125, z: WALL_Z }, role: 'vertical_radius_sweep_above_contact' },
	{ name: 'bed_top_above_28250', world: { x: 0.0, y: 0.28250, z: WALL_Z }, role: 'vertical_radius_sweep_above_contact' },
	{ name: 'bed_top_above_029', world: { x: 0.0, y: 0.290, z: WALL_Z }, role: 'above_contact_control' },
	{ name: 'bed_top_above_030', world: { x: 0.0, y: 0.300, z: WALL_Z }, role: 'above_contact_control' },
	{ name: 'bed_top_above_032', world: { x: 0.0, y: 0.320, z: WALL_Z }, role: 'above_contact_control' },
	{ name: 'bed_top_control_052', world: { x: 0.0, y: 0.520, z: WALL_Z }, role: 'far_wall_control' },
	{ name: 'bed_west_edge', world: { x: -0.027, y: 0.140, z: WALL_Z }, role: 'vertical_bed_west_edge_check' }
];
const PHASE0_CONTACT_TARGETS = [
	{
		name: 'phase0_bed_top_mid',
		contactLine: 'bed_top_y_0p280',
			world: { x: 0.020104, y: 0.280, z: WALL_Z },
			role: 'phase0_bed_top_horizontal_contact',
			furnitureMode: 'bed',
			lift: { x: 0, y: 1, z: 0 },
			contactPlane: { axis: 'y', value: 0.280 },
			source: 'Home_Studio.js:C2_NE_FURNITURE_LAYOUTS.bed.main',
			classificationOverride: 'confirmed_bed_top_bake_bug'
		},
	{
		name: 'phase0_bed_top_east',
		contactLine: 'bed_top_y_0p280',
		world: { x: 1.35, y: 0.280, z: WALL_Z },
		role: 'phase0_bed_top_east_contact',
			furnitureMode: 'bed',
			lift: { x: 0, y: 1, z: 0 },
			contactPlane: { axis: 'y', value: 0.280 },
			source: 'Home_Studio.js:C2_NE_FURNITURE_LAYOUTS.bed.main',
			classificationOverride: 'confirmed_bed_top_bake_bug'
		},
	{
		name: 'phase0_wardrobe_top_mid',
		contactLine: 'wardrobe_top_y_1p955',
		world: { x: 1.60, y: 1.955, z: WALL_Z },
		role: 'phase0_wardrobe_top_horizontal_contact',
			furnitureMode: 'wardrobe',
			lift: { x: 0, y: 1, z: 0 },
			contactPlane: { axis: 'y', value: 1.955 },
			source: 'Home_Studio.js:C2_NE_FURNITURE_LAYOUTS.wardrobe.main',
			classificationOverride: 'de_scoped_scene_stale_diagnostic'
		},
	{
		name: 'phase0_west_side_wall_back_mid',
		contactLine: 'west_side_wall_back_x_-1p908',
		world: { x: -1.908, y: 1.45, z: WALL_Z },
		role: 'phase0_side_wall_back_vertical_contact',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.908 },
		source: 'R7310_C1_NORTH_WALL_SIDE_WALL_BACKS.west'
	},
	{
		name: 'phase0_east_side_wall_back_mid',
		contactLine: 'east_side_wall_back_x_1p908',
		world: { x: 1.908, y: 1.45, z: WALL_Z },
		role: 'phase0_side_wall_back_vertical_contact',
		furnitureMode: 'bed',
		lift: { x: -1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: 1.908 },
		source: 'R7310_C1_NORTH_WALL_SIDE_WALL_BACKS.east'
	},
	{
		name: 'phase0_west_beam_under_north',
		contactLine: 'west_beam_under_y_2p525',
		world: { x: -1.83, y: 2.525, z: WALL_Z },
		role: 'phase0_beam_under_horizontal_contact',
		furnitureMode: 'bed',
		lift: { x: 0, y: -1, z: 0 },
		contactPlane: { axis: 'y', value: 2.525 },
		source: 'Home_Studio.js:addBox index 12'
	},
	{
		name: 'phase0_east_beam_under_north',
		contactLine: 'east_beam_under_y_2p515',
		world: { x: 1.88, y: 2.515, z: WALL_Z },
		role: 'phase0_beam_under_horizontal_contact',
		furnitureMode: 'bed',
		lift: { x: 0, y: -1, z: 0 },
		contactPlane: { axis: 'y', value: 2.515 },
		source: 'Home_Studio.js:addBox index 13'
	},
	{
		name: 'phase0_west_beam_gap_mid',
		contactLine: 'west_beam_gap_sliver',
		world: { x: -1.83, y: 2.70, z: WALL_Z },
		role: 'phase0_beam_gap_sliver_contact',
			furnitureMode: 'bed',
			lift: { x: 0, y: -1, z: 0 },
			contactPlane: { axis: 'y', value: 2.525 },
			source: 'R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS.west',
			classificationOverride: 'not_applicable_invalid_region'
		},
		{
			name: 'phase0_east_beam_gap_mid',
		contactLine: 'east_beam_gap_sliver',
		world: { x: 1.88, y: 2.70, z: WALL_Z },
		role: 'phase0_beam_gap_sliver_contact',
			furnitureMode: 'bed',
			lift: { x: 0, y: -1, z: 0 },
			contactPlane: { axis: 'y', value: 2.515 },
			source: 'R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS.east',
			classificationOverride: 'not_applicable_invalid_region'
		},
		{
			name: 'phase0_west_beam_gap_valid_edge',
			contactLine: 'west_beam_gap_valid_edge_y_2p525',
			world: { x: -1.751, y: 2.525, z: WALL_Z },
			role: 'phase0_beam_gap_valid_edge_contact',
			furnitureMode: 'bed',
			lift: { x: 0, y: -1, z: 0 },
			contactPlane: { axis: 'y', value: 2.525 },
			source: 'R7310_C1_NORTH_WALL_BEAM_GAP_VALID_EDGE.west'
		},
		{
			name: 'phase0_east_beam_gap_valid_edge',
			contactLine: 'east_beam_gap_valid_edge_y_2p515',
			world: { x: 1.849, y: 2.515, z: WALL_Z },
			role: 'phase0_beam_gap_valid_edge_contact',
			furnitureMode: 'bed',
			lift: { x: 0, y: -1, z: 0 },
			contactPlane: { axis: 'y', value: 2.515 },
			source: 'R7310_C1_NORTH_WALL_BEAM_GAP_VALID_EDGE.east'
		}
	];
const WESTBEAM_SEAM_LIFT_TARGETS = [
	{
		name: 'westbeam_seam_y2p538',
		contactLine: 'west_beam_vertical_seam_x_-1p750',
		world: { x: -1.749793014, y: 2.538232231, z: WALL_Z },
		role: 'westbeam_vertical_seam_dark_texel',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §52 seam_y2.532431 north-wall-side point'
	},
	{
		name: 'westbeam_seam_y2p550',
		contactLine: 'west_beam_vertical_seam_x_-1p750',
		world: { x: -1.749980170, y: 2.549798965, z: WALL_Z },
		role: 'westbeam_vertical_seam_dark_texel',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §52 seam_y2.550000 north-wall-side point'
	},
	{
		name: 'westbeam_seam_y2p577',
		contactLine: 'west_beam_vertical_seam_x_-1p750',
		world: { x: -1.749926996, y: 2.577392006, z: WALL_Z },
		role: 'westbeam_vertical_seam_dark_texel',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §52 seam_y2.577808 north-wall-side point'
	},
	{
		name: 'westbeam_seam_y2p669',
		contactLine: 'west_beam_vertical_seam_x_-1p750',
		world: { x: -1.749917948, y: 2.668758011, z: WALL_Z },
		role: 'westbeam_vertical_seam_dark_texel',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §52 seam_y2.700000 north-wall-side point'
	},
	{
		name: 'westbeam_control_y2p538_x_plus_2p5mm',
		contactLine: 'west_beam_vertical_seam_control_x_plus_2p5mm',
		world: { x: -1.747293014, y: 2.538232231, z: WALL_Z },
		role: 'westbeam_interior_bright_control',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §53 control: +2.5mm from seam_y2.532431'
	},
	{
		name: 'westbeam_control_y2p550_x_plus_2p5mm',
		contactLine: 'west_beam_vertical_seam_control_x_plus_2p5mm',
		world: { x: -1.747480170, y: 2.549798965, z: WALL_Z },
		role: 'westbeam_interior_bright_control',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §53 control: +2.5mm from seam_y2.550000'
	},
	{
		name: 'westbeam_control_y2p577_x_plus_2p5mm',
		contactLine: 'west_beam_vertical_seam_control_x_plus_2p5mm',
		world: { x: -1.747426996, y: 2.577392006, z: WALL_Z },
		role: 'westbeam_interior_bright_control',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §53 control: +2.5mm from seam_y2.577808'
	},
	{
		name: 'westbeam_control_y2p669_x_plus_2p5mm',
		contactLine: 'west_beam_vertical_seam_control_x_plus_2p5mm',
		world: { x: -1.747417948, y: 2.668758011, z: WALL_Z },
		role: 'westbeam_interior_bright_control',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §53 control: +2.5mm from seam_y2.700000'
	}
];
const WESTBEAM_VISIBLE_RANGE_Y_VALUES = [
	2.526,
	2.532,
	2.538232,
	2.545,
	2.549799,
	2.5575,
	2.577392,
	2.625,
	2.668758,
	2.700,
	2.735,
	2.780,
	2.840,
	2.895
];
function listArg(name) {
	const prefix = `--${name}=`;
	const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : null;
}
function westbeamVisibleRangeYValues() {
	const raw = listArg('westbeam-visible-y-list');
	if (!raw) return WESTBEAM_VISIBLE_RANGE_Y_VALUES;
	const values = raw.split(',').map((value) => Number(value.trim())).filter(Number.isFinite);
	if (!values.length) throw new Error('--westbeam-visible-y-list did not include finite y values');
	return values;
}
function westbeamVisibleRangeName(y) {
	return y.toFixed(6).replace(/0+$/, '').replace(/\.$/, '').replace('.', 'p');
}
function makeWestbeamVisibleRangeTargets() {
	const seamX = -1.7499;
	const controlDx = 0.0025;
	const yValues = westbeamVisibleRangeYValues();
	const seamTargets = yValues.map((y) => ({
		name: `westbeam_visible_seam_y${westbeamVisibleRangeName(y)}`,
		contactLine: 'west_beam_visible_range_x_-1p750',
		world: { x: seamX, y, z: WALL_Z },
		role: 'westbeam_visible_range_seam',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §57 visible black-line y-range sweep'
	}));
	const controlTargets = yValues.map((y) => ({
		name: `westbeam_visible_control_y${westbeamVisibleRangeName(y)}_x_plus_2p5mm`,
		contactLine: 'west_beam_visible_range_control_x_plus_2p5mm',
		world: { x: seamX + controlDx, y, z: WALL_Z },
		role: 'westbeam_visible_range_control',
		furnitureMode: 'bed',
		lift: { x: 1, y: 0, z: 0 },
		contactPlane: { axis: 'x', value: -1.750 },
		source: 'source.md §57 visible black-line control sweep'
	}));
	return [...seamTargets, ...controlTargets];
}
const WESTBEAM_VISIBLE_RANGE_LIFT_TARGETS = makeWestbeamVisibleRangeTargets();
const TARGETS = WESTBEAM_VISIBLE_RANGE_LIFT_PROBE
	? WESTBEAM_VISIBLE_RANGE_LIFT_TARGETS
	: (WESTBEAM_SEAM_LIFT_PROBE ? WESTBEAM_SEAM_LIFT_TARGETS : (PHASE0_SCAN ? PHASE0_CONTACT_TARGETS : BEDTOP_TARGETS));
const SECONDARY_LIFT_CANDIDATES = [0.000125, 0.00025, 0.0005, 0.001, 0.002, 0.005];
const SECONDARY_RADIUS_CANDIDATES = [0.000625, 0.00125, 0.001875, 0.0025];

function arg(name, fallback) {
	const prefix = `--${name}=`;
	const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
	return hit ? hit.slice(prefix.length) : fallback;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function readF32(file, expectedFloats) {
	const buffer = fs.readFileSync(file);
	if (buffer.byteLength !== expectedFloats * 4) {
		throw new Error(`${file} byte size mismatch: got ${buffer.byteLength}, expected ${expectedFloats * 4}`);
	}
	return new Float32Array(buffer.buffer, buffer.byteOffset, expectedFloats);
}

function luma(rgb) {
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function uvFromWorld(x, y) {
	const y01 = Math.max(0, Math.min(1, y / 2.905));
	const x01 = Math.max(0, Math.min(1, (x + 2.11) / 4.22));
	return {
		u: 0.9997849464 * (1 - y01) + 0.0002150538 * y01,
		v: 0.0001480604 * (1 - x01) + 0.9998519421 * x01,
		local01: { x: x01, y: y01 }
	};
}

function atlasPixelFromWorld(world) {
	const uv = uvFromWorld(world.x, world.y);
	const px = Math.max(0, Math.min(WIDTH - 1, uv.u * WIDTH - 0.5));
	const py = Math.max(0, Math.min(HEIGHT - 1, uv.v * HEIGHT - 0.5));
	return {
		uv,
		continuous: { x: px, y: py },
		nearest: {
			x: Math.max(0, Math.min(WIDTH - 1, Math.floor(px + 0.5))),
			y: Math.max(0, Math.min(HEIGHT - 1, Math.floor(py + 0.5)))
		}
	};
}

function texel(arr, px, py) {
	const x = Math.max(0, Math.min(WIDTH - 1, Math.floor(Number(px) + 0.5)));
	const y = Math.max(0, Math.min(HEIGHT - 1, Math.floor(Number(py) + 0.5)));
	const i = (y * WIDTH + x) * 4;
	return { r: arr[i], g: arr[i + 1], b: arr[i + 2], a: arr[i + 3], x, y };
}

function worldTexel(rawWorld, px, py) {
	const t = texel(rawWorld, px, HEIGHT - 1 - py);
	return { x: t.r, y: t.g, z: t.b, valid: t.a };
}

function normalTexel(rawNormal, px, py) {
	const t = texel(rawNormal, px, HEIGHT - 1 - py);
	const len = Math.hypot(t.r, t.g, t.b);
	return { x: t.r, y: t.g, z: t.b, valid: t.a, len };
}

function add3(a, b) {
	return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function mul3(a, s) {
	return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function insideAabb(point, box, tolerance = 1e-5) {
	return (
		point.x >= box.min.x - tolerance && point.x <= box.max.x + tolerance &&
		point.y >= box.min.y - tolerance && point.y <= box.max.y + tolerance &&
		point.z >= box.min.z - tolerance && point.z <= box.max.z + tolerance
	);
}

function firstOriginFor(point, eps, worldOffset) {
	const shifted = {
		x: point.x + (worldOffset.x || 0),
		y: point.y + (worldOffset.y || 0),
		z: point.z + (worldOffset.z || 0)
	};
	return add3(shifted, mul3(WALL_NORMAL, eps * 8.0));
}

function isBraveBrowserPath(browserPath) {
	return /Brave Browser|brave/i.test(browserPath || '');
}

async function waitForCdp(port, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (response.ok) return await response.json();
		} catch {
			await sleep(250);
		}
	}
	throw new Error(`CDP did not open on port ${port}`);
}

async function openCdpTarget(port, url) {
	const newUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
	let response = await fetch(newUrl, { method: 'PUT' });
	if (!response.ok) response = await fetch(newUrl);
	if (response.ok) {
		const target = await response.json();
		if (target.webSocketDebuggerUrl) return target;
	}
	const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
	const targets = await listResponse.json();
	const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
	if (!page) throw new Error('CDP page target missing');
	return page;
}

class CdpWebSocket {
	constructor(wsUrl) {
		const parsed = new URL(wsUrl);
		this.host = parsed.hostname;
		this.port = Number(parsed.port || 80);
		this.path = `${parsed.pathname}${parsed.search}`;
		this.socket = null;
		this.buffer = Buffer.alloc(0);
		this.nextId = 1;
		this.pending = new Map();
		this.fragments = [];
	}

	async connect() {
		this.socket = net.connect(this.port, this.host);
		await new Promise((resolve, reject) => {
			this.socket.once('connect', resolve);
			this.socket.once('error', reject);
		});
		const key = crypto.randomBytes(16).toString('base64');
		this.socket.write([
			`GET ${this.path} HTTP/1.1`,
			`Host: ${this.host}:${this.port}`,
			'Upgrade: websocket',
			'Connection: Upgrade',
			`Sec-WebSocket-Key: ${key}`,
			'Sec-WebSocket-Version: 13',
			'\r\n'
		].join('\r\n'));
		await this.readHandshake();
		this.socket.on('data', (chunk) => this.handleData(chunk));
		this.socket.on('error', (error) => this.rejectAll(error));
		this.socket.on('close', () => this.rejectAll(new Error('CDP socket closed')));
		if (this.buffer.length > 0) this.handleData(Buffer.alloc(0));
	}

	readHandshake() {
		return new Promise((resolve, reject) => {
			let header = Buffer.alloc(0);
			const onData = (chunk) => {
				header = Buffer.concat([header, chunk]);
				const end = header.indexOf('\r\n\r\n');
				if (end < 0) return;
				this.socket.off('data', onData);
				const text = header.slice(0, end).toString('utf8');
				if (!text.includes('101')) {
					reject(new Error(`WebSocket handshake failed: ${text}`));
					return;
				}
				const rest = header.slice(end + 4);
				if (rest.length) this.buffer = Buffer.concat([this.buffer, rest]);
				resolve();
			};
			this.socket.on('data', onData);
			this.socket.once('error', reject);
		});
	}

	handleData(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		for (;;) {
			const frame = this.readFrame();
			if (!frame) break;
			if (frame.opcode === 0x8) {
				this.close();
				break;
			}
			if (frame.opcode === 0x9) {
				this.writeFrame(frame.payload, 0xA);
				continue;
			}
			if (frame.opcode === 0x1 && !frame.fin) {
				this.fragments = [frame.payload];
				continue;
			}
			let payload = frame.payload;
			if (frame.opcode === 0x0) {
				if (!this.fragments.length) continue;
				this.fragments.push(frame.payload);
				if (!frame.fin) continue;
				payload = Buffer.concat(this.fragments);
				this.fragments = [];
			} else if (frame.opcode !== 0x1) {
				continue;
			}
			const message = JSON.parse(payload.toString('utf8'));
			if (message.id && this.pending.has(message.id)) {
				const pending = this.pending.get(message.id);
				this.pending.delete(message.id);
				if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
				else pending.resolve(message.result);
			}
		}
	}

	readFrame() {
		if (this.buffer.length < 2) return null;
		const first = this.buffer[0];
		const second = this.buffer[1];
		const fin = (first & 0x80) !== 0;
		const opcode = first & 0x0f;
		let length = second & 0x7f;
		let offset = 2;
		if (length === 126) {
			if (this.buffer.length < offset + 2) return null;
			length = this.buffer.readUInt16BE(offset);
			offset += 2;
		} else if (length === 127) {
			if (this.buffer.length < offset + 8) return null;
			const hi = this.buffer.readUInt32BE(offset);
			const lo = this.buffer.readUInt32BE(offset + 4);
			length = hi * 2 ** 32 + lo;
			offset += 8;
		}
		const masked = (second & 0x80) !== 0;
		let mask = null;
		if (masked) {
			if (this.buffer.length < offset + 4) return null;
			mask = this.buffer.slice(offset, offset + 4);
			offset += 4;
		}
		if (this.buffer.length < offset + length) return null;
		let payload = this.buffer.slice(offset, offset + length);
		this.buffer = this.buffer.slice(offset + length);
		if (masked) {
			const unmasked = Buffer.alloc(payload.length);
			for (let i = 0; i < payload.length; i += 1) unmasked[i] = payload[i] ^ mask[i % 4];
			payload = unmasked;
		}
		return { fin, opcode, payload };
	}

	writeFrame(payload, opcode = 0x1) {
		const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
		let headerLength = 2;
		if (data.length >= 126 && data.length < 65536) headerLength += 2;
		else if (data.length >= 65536) headerLength += 8;
		const header = Buffer.alloc(headerLength + 4);
		header[0] = 0x80 | opcode;
		let offset = 2;
		if (data.length < 126) header[1] = 0x80 | data.length;
		else if (data.length < 65536) {
			header[1] = 0x80 | 126;
			header.writeUInt16BE(data.length, offset);
			offset += 2;
		} else {
			header[1] = 0x80 | 127;
			header.writeUInt32BE(0, offset);
			header.writeUInt32BE(data.length, offset + 4);
			offset += 8;
		}
		const mask = crypto.randomBytes(4);
		mask.copy(header, offset);
		const masked = Buffer.alloc(data.length);
		for (let i = 0; i < data.length; i += 1) masked[i] = data[i] ^ mask[i % 4];
		this.socket.write(Buffer.concat([header, masked]));
	}

	send(method, params = {}, timeoutMs = 120000) {
		const id = this.nextId;
		this.nextId += 1;
		this.writeFrame(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`CDP timeout: ${method}`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				}
			});
		});
	}

	rejectAll(error) {
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}

	close() {
		try {
			if (this.socket) this.socket.destroy();
		} catch {
			// noop
		}
	}
}

async function evaluate(cdp, expression, options = {}) {
	const result = await cdp.send('Runtime.evaluate', {
		expression,
		awaitPromise: options.awaitPromise === true,
		returnByValue: true,
		userGesture: true
	}, options.timeoutMs || 180000);
	if (result.exceptionDetails) {
		throw new Error(`eval exception: ${JSON.stringify(result.exceptionDetails.exception || result.exceptionDetails)}`);
	}
	return result.result ? result.result.value : undefined;
}

async function waitForExpr(cdp, expression, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			if (await evaluate(cdp, expression)) return true;
		} catch {
			// retry
		}
		await sleep(300);
	}
	throw new Error(`wait timeout: ${expression}`);
}

function buildCpuReport() {
	const rawWorld = readF32(path.join(PREP_DIR, 'xatlas-bake-worldpos-rgba32f.bin'), WIDTH * HEIGHT * 4);
	const rawNormal = readF32(path.join(PREP_DIR, 'xatlas-bake-normal-rgba32f.bin'), WIDTH * HEIGHT * 4);
	return TARGETS.map((target) => {
		const atlas = atlasPixelFromWorld(target.world);
		const world = worldTexel(rawWorld, atlas.nearest.x, atlas.nearest.y);
		const normal = normalTexel(rawNormal, atlas.nearest.x, atlas.nearest.y);
		const variants = [
			{ name: 'baseline_eps_0p01', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 } },
			{ name: 'offset_y_plus_0p001', eps: 0.01, worldOffset: { x: 0, y: 0.001, z: 0 } },
			{ name: 'offset_y_plus_0p005', eps: 0.01, worldOffset: { x: 0, y: 0.005, z: 0 } },
			{ name: 'offset_y_plus_0p010', eps: 0.01, worldOffset: { x: 0, y: 0.010, z: 0 } },
			{ name: 'eps_0p005', eps: 0.005, worldOffset: { x: 0, y: 0, z: 0 } },
			{ name: 'eps_0p002', eps: 0.002, worldOffset: { x: 0, y: 0, z: 0 } },
			{ name: 'eps_0p001', eps: 0.001, worldOffset: { x: 0, y: 0, z: 0 } },
			{ name: 'eps_0p0005', eps: 0.0005, worldOffset: { x: 0, y: 0, z: 0 } },
			{ name: 'eps_0p0001', eps: 0.0001, worldOffset: { x: 0, y: 0, z: 0 } }
		].map((variant) => {
			const origin = firstOriginFor(world, variant.eps, variant.worldOffset);
			return {
				...variant,
				firstRayOrigin: origin,
				firstRayOriginInsideBedAabbInclusive: insideAabb(origin, BED_AABB)
			};
		});
		return {
			...target,
			atlas,
			preparedWorldTexel: world,
			preparedNormalTexel: normal,
			worldDeltaMeters: Math.hypot(world.x - target.world.x, world.y - target.world.y, world.z - target.world.z),
			cpuVariants: variants
		};
	});
}

function buildBrowserScript(cpuTargets, targetSpp, timeoutMs) {
	return `(() => {
		return (async () => {
			const width = ${WIDTH};
			const height = ${HEIGHT};
			const prepDir = ${JSON.stringify(PREP_DIR)};
			const cpuTargets = ${JSON.stringify(cpuTargets)};
			const targetSpp = ${Number(targetSpp)};
			const timeoutMs = ${Number(timeoutMs)};
			const secondaryLiftCandidates = ${JSON.stringify(SECONDARY_LIFT_CANDIDATES)};
			const secondaryRadiusCandidates = ${JSON.stringify(SECONDARY_RADIUS_CANDIDATES)};
			const phase0Scan = ${PHASE0_SCAN ? 'true' : 'false'};
			const phase0LiftMeters = ${PHASE0_LIFT_METERS.toFixed(9)};
			const phase0RadiusMeters = ${PHASE0_RADIUS_METERS.toFixed(9)};
			const PHASE0_NEE_WORST_OF_DIRECTIONS = ${PHASE0_NEE_WORST_OF_DIRECTIONS};
			function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
			function rgbLuma(rgb) { return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b; }
			function liftLabel(value) {
				return Number(value).toFixed(6).replace('0.', '0p').replace(/0+$/, '').replace(/p$/, 'p0');
			}
			function getTarget(name) {
				const hit = cpuTargets.find((target) => target.name === name);
				if (!hit) throw new Error('target missing: ' + name);
				return hit;
			}
			function decodeProbe(probeMode, sample) {
				if (probeMode === 151) return { kind: 'secondaryRayOrigin', x: sample.r * 3.9 - 1.95, y: sample.g * 3.0, z: sample.b * 5.2 - 2.1 };
				if (probeMode === 152) return { kind: 'secondaryRayDirection', x: sample.r * 2 - 1, y: sample.g * 2 - 1, z: sample.b * 2 - 1 };
				if (probeMode === 153) return { kind: 'secondHitWorldPos', x: sample.r * 3.9 - 1.95, y: sample.g * 3.0, z: sample.b * 5.2 - 2.1 };
				if (probeMode === 154) return { kind: 'secondHitNormal', x: sample.r * 2 - 1, y: sample.g * 2 - 1, z: sample.b * 2 - 1 };
				if (probeMode === 155) return { kind: 'secondHitTypeObjectId', hitTypeApprox: sample.r * 256, objectIdApprox: sample.g * 256 };
				if (probeMode === 156) return { kind: 'secondHitNee', secondHitY: sample.r * 3.0, bounceRayDirY: sample.g * 2.0 - 1.0, neeGeom: sample.b };
				if (probeMode === 161) return { kind: 'firstHitWorldPos', x: sample.r * 3.9 - 1.95, y: sample.g * 3.0, z: sample.b * 5.2 - 2.1 };
				if (probeMode === 162) return { kind: 'firstHitNormal', x: sample.r * 2 - 1, y: sample.g * 2 - 1, z: sample.b * 2 - 1 };
				if (probeMode === 163) return { kind: 'primaryRayOrigin', x: sample.r * 3.9 - 1.95, y: sample.g * 3.0, z: sample.b * 5.2 - 2.1 };
				if (probeMode === 164) return { kind: 'primaryRayDirection', x: sample.r * 2 - 1, y: sample.g * 2 - 1, z: sample.b * 2 - 1 };
				if (probeMode === 165) return { kind: 'firstHitTypeObjectId', hitTypeApprox: sample.r * 256, objectIdApprox: sample.g * 256 };
				if (probeMode === 166) return { kind: 'firstHitEpsNormal', eps: sample.r / 100.0, normalY: sample.g * 2 - 1, normalZ: sample.b * 2 - 1 };
				if (probeMode === 167) return { kind: 'neeShadowSourcePosition', x: sample.r * 3.9 - 1.95, y: sample.g * 3.0, z: sample.b * 5.2 - 2.1 };
				if (probeMode === 168) return { kind: 'neeShadowSourceDelta', sourceDeltaY: sample.r * 0.02 - 0.01, neeDirY: sample.g * 2.0 - 1.0, sourceLifted: sample.b > 0.5 };
				if (probeMode === 57) return { kind: 'secondHitNee', secondHitY: sample.r * 3.0, bounceRayDirY: sample.g * 2.0 - 1.0, neeGeom: sample.b };
				if (probeMode === 61) return { kind: 'fixedSecondHit', rgb: sample };
				if (probeMode === 62) return { kind: 'fixed', rgb: sample };
				if (probeMode === 63) return { kind: 'firstHitNormal', x: sample.r * 2 - 1, y: sample.g * 2 - 1, z: sample.b * 2 - 1 };
				if (probeMode === 64) return { kind: 'rayDirection', x: sample.r * 2 - 1, y: sample.g * 2 - 1, z: sample.b * 2 - 1 };
				if (probeMode === 65) return { kind: 'hitTypeObjectId', hitTypeApprox: sample.r * 256, objectIdApprox: sample.g * 256 };
				if (probeMode === 66) return { kind: 'firstHitWorldPos', x: sample.r * 3.9 - 1.95, y: sample.g * 3.0, z: sample.b * 5.2 - 2.1 };
				return null;
			}
			function makeVariants() {
				if (phase0Scan) {
					const variants = [];
					for (const target of cpuTargets) {
						variants.push({
							name: target.name + '_baseline_eps_0p01',
							targetName: target.name,
							eps: 0.01,
							worldOffset: { x: 0, y: 0, z: 0 },
							samples: targetSpp,
							phase0Scan: true
						});
						variants.push({
							name: target.name + '_secondary_lift_' + liftLabel(phase0LiftMeters),
							targetName: target.name,
							eps: 0.01,
							worldOffset: { x: 0, y: 0, z: 0 },
							secondaryLiftY: phase0LiftMeters,
							secondaryLiftMeters: phase0LiftMeters,
							secondaryRadiusY: phase0RadiusMeters,
							samples: targetSpp,
							phase0Scan: true
						});
					}
					return variants;
				}
				const variants = [
					{ name: 'contact_baseline_eps_0p01', targetName: 'bed_top_contact', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'contact_offset_y_plus_0p001', targetName: 'bed_top_contact', eps: 0.01, worldOffset: { x: 0, y: 0.001, z: 0 }, samples: targetSpp },
					{ name: 'contact_offset_y_plus_0p005', targetName: 'bed_top_contact', eps: 0.01, worldOffset: { x: 0, y: 0.005, z: 0 }, samples: targetSpp },
					{ name: 'contact_offset_y_plus_0p010', targetName: 'bed_top_contact', eps: 0.01, worldOffset: { x: 0, y: 0.010, z: 0 }, samples: targetSpp },
					{ name: 'contact_eps_0p005', targetName: 'bed_top_contact', eps: 0.005, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'contact_eps_0p002', targetName: 'bed_top_contact', eps: 0.002, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'contact_eps_0p001', targetName: 'bed_top_contact', eps: 0.001, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'contact_eps_0p0005', targetName: 'bed_top_contact', eps: 0.0005, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'contact_eps_0p0001', targetName: 'bed_top_contact', eps: 0.0001, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'contact_offset_y_plus_0p005_eps_0p001', targetName: 'bed_top_contact', eps: 0.001, worldOffset: { x: 0, y: 0.005, z: 0 }, samples: targetSpp },
					{ name: 'below_27875_baseline_eps_0p01', targetName: 'bed_top_below_27875', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'above_28125_baseline_eps_0p01', targetName: 'bed_top_above_28125', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'above_28250_baseline_eps_0p01', targetName: 'bed_top_above_28250', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'above_029_baseline_eps_0p01', targetName: 'bed_top_above_029', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'above_030_baseline_eps_0p01', targetName: 'bed_top_above_030', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'above_032_baseline_eps_0p01', targetName: 'bed_top_above_032', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'control_052_baseline_eps_0p01', targetName: 'bed_top_control_052', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'west_edge_baseline_eps_0p01', targetName: 'bed_west_edge', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: targetSpp },
					{ name: 'west_edge_offset_x_minus_0p005', targetName: 'bed_west_edge', eps: 0.01, worldOffset: { x: -0.005, y: 0, z: 0 }, samples: targetSpp }
				];
				for (const liftY of secondaryLiftCandidates) {
					const suffix = liftLabel(liftY);
					variants.push({
						name: 'contact_secondary_lift_y_' + suffix,
						targetName: 'bed_top_contact',
						eps: 0.01,
						worldOffset: { x: 0, y: 0, z: 0 },
						secondaryLiftY: liftY,
						samples: targetSpp
					});
					for (const targetName of [
						'bed_top_below_27875',
						'bed_top_above_28125',
						'bed_top_above_28250',
						'bed_top_above_029',
						'bed_top_above_030',
						'bed_top_above_032',
						'bed_top_control_052',
						'bed_west_edge'
					]) {
						const prefix = targetName
							.replace('bed_top_', '')
							.replace('bed_', '');
						variants.push({
							name: prefix + '_secondary_lift_y_' + suffix,
							targetName,
							eps: 0.01,
							worldOffset: { x: 0, y: 0, z: 0 },
							secondaryLiftY: liftY,
							samples: targetSpp
						});
					}
				}
				for (const radiusY of secondaryRadiusCandidates) {
					const radiusSuffix = liftLabel(radiusY);
					for (const targetName of [
						'bed_top_below_27875',
						'bed_top_contact',
						'bed_top_above_28125',
						'bed_top_above_28250',
						'bed_top_above_029',
						'bed_top_control_052'
					]) {
						const prefix = targetName
							.replace('bed_top_', '')
							.replace('bed_', '');
						variants.push({
							name: prefix + '_secondary_lift_y_0p000125_radius_y_' + radiusSuffix,
							targetName,
							eps: 0.01,
							worldOffset: { x: 0, y: 0, z: 0 },
							secondaryLiftY: 0.000125,
							secondaryRadiusY: radiusY,
							samples: targetSpp
						});
					}
				}
				return variants;
			}
			function ensureState() {
				if (!renderer || !THREE || !pathTracingUniforms || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !screenCopyUniforms)
					throw new Error('renderer state missing');
				if (typeof createR738FloatRenderTarget !== 'function') throw new Error('createR738FloatRenderTarget missing');
				if (typeof readR738RenderTargetFloatPixels !== 'function') throw new Error('readR738RenderTargetFloatPixels missing');
				if (typeof createR7310BakeOnlyNoBorrowMaterial !== 'function') throw new Error('createR7310BakeOnlyNoBorrowMaterial missing');
				if (typeof window.prepareR7310C1XatlasBakeTextures !== 'function') throw new Error('prepareR7310C1XatlasBakeTextures missing');
				if (typeof window.prepareR738C1BakeCapture !== 'function') throw new Error('prepareR738C1BakeCapture missing');
			}
			function createR7310BedtopPinpointMaterial(secondaryLiftY = 0, secondaryRadiusY = 0.000625) {
				const liftY = Math.max(0, Number(secondaryLiftY) || 0);
				const radiusY = Math.max(0.000001, Number(secondaryRadiusY) || 0.000625);
				const liftKey = (phase0Scan ? 'phase0_' : '') + liftY.toFixed(9) + '_r' + radiusY.toFixed(9);
				if (!window.__r7310BedtopPinpointMaterials) window.__r7310BedtopPinpointMaterials = {};
				if (window.__r7310BedtopPinpointMaterials[liftKey]) return window.__r7310BedtopPinpointMaterials[liftKey];
				if (typeof pathTracingFragmentShader !== 'string') throw new Error('pathTracingFragmentShader missing');
				if (typeof createCommonVertexShaderMaterial !== 'function') throw new Error('createCommonVertexShaderMaterial missing');
				const marker = 'float r7310C1RuntimeProbeMode = uR7310C1RuntimeProbeMode;';
				const injection = [
					marker,
					'if (bounces == 0 && uR7310C1XatlasBakeMode > 0.5 && r7310C1RuntimeProbeMode > 166.5 && r7310C1RuntimeProbeMode < 168.5)',
					'{',
					'  vec3 r7310PinNeeDir; vec3 r7310PinNeeT; float r7310PinNeePdf;',
					'  int r7310PinNeeIdx; int r7310PinNeeZero; int r7310PinNeeTheta; vec3 r7310PinNeeFacing;',
					'  r7310PinNeeDir = sampleStochasticLightDynamic(x, nl, light, r7310PinNeeT, r7310PinNeePdf, r7310PinNeeIdx, r7310PinNeeZero, r7310PinNeeTheta, r7310PinNeeFacing);',
					'  vec3 r7310PinNeeSource = r7310C1XatlasBakeNeeShadowRayOrigin(hitType, hitObjectID, nl, x, r7310PinNeeDir);',
					'  if (r7310C1RuntimeProbeMode < 167.5) {',
					'    accumCol = vec3(clamp((r7310PinNeeSource.x + 1.95) / 3.9, 0.0, 1.0), clamp(r7310PinNeeSource.y / 3.0, 0.0, 1.0), clamp((r7310PinNeeSource.z + 2.1) / 5.2, 0.0, 1.0));',
					'  } else {',
					'    accumCol = vec3(clamp((r7310PinNeeSource.y - x.y + 0.01) / 0.02, 0.0, 1.0), clamp(r7310PinNeeDir.y * 0.5 + 0.5, 0.0, 1.0), length(r7310PinNeeSource - x) > 0.0000001 ? 1.0 : 0.0);',
					'  }',
					'  break;',
					'}',
					'if (bounces == 0 && uR7310C1XatlasBakeMode < 0.5 && r7310C1RuntimeProbeMode > 150.5 && r7310C1RuntimeProbeMode < 156.5)',
					'{',
					'  rayOrigin = x + nl * uEPS_intersect;',
					'  rayDirection = randomCosWeightedDirectionInHemisphere(nl);',
					'  sampleLight = FALSE;',
					'  diffuseCount++;',
					'  continue;',
					'}',
					'if (bounces == 1 && r7310C1RuntimeProbeMode > 150.5 && r7310C1RuntimeProbeMode < 156.5)',
					'{',
					'  if (r7310C1RuntimeProbeMode < 151.5) {',
					'    accumCol = vec3(clamp((rayOrigin.x + 1.95) / 3.9, 0.0, 1.0), clamp(rayOrigin.y / 3.0, 0.0, 1.0), clamp((rayOrigin.z + 2.1) / 5.2, 0.0, 1.0));',
					'  } else if (r7310C1RuntimeProbeMode < 152.5) {',
					'    accumCol = rayDirection * 0.5 + 0.5;',
					'  } else if (r7310C1RuntimeProbeMode < 153.5) {',
					'    accumCol = vec3(clamp((x.x + 1.95) / 3.9, 0.0, 1.0), clamp(x.y / 3.0, 0.0, 1.0), clamp((x.z + 2.1) / 5.2, 0.0, 1.0));',
					'  } else if (r7310C1RuntimeProbeMode < 154.5) {',
					'    accumCol = nl * 0.5 + 0.5;',
					'  } else if (r7310C1RuntimeProbeMode < 155.5) {',
					'    accumCol = vec3(clamp(float(hitType) / 256.0, 0.0, 1.0), clamp(hitObjectID / 256.0, 0.0, 1.0), 0.0);',
					'  } else {',
					'    vec3 r7310PinNeeDir; vec3 r7310PinNeeT; float r7310PinNeePdf;',
					'    int r7310PinNeeIdx; int r7310PinNeeZero; int r7310PinNeeTheta; vec3 r7310PinNeeFacing;',
					'    r7310PinNeeDir = sampleStochasticLightDynamic(x, nl, light, r7310PinNeeT, r7310PinNeePdf, r7310PinNeeIdx, r7310PinNeeZero, r7310PinNeeTheta, r7310PinNeeFacing);',
					'    accumCol = vec3(clamp(x.y / 3.0, 0.0, 1.0), clamp(rayDirection.y * 0.5 + 0.5, 0.0, 1.0), max(0.0, dot(nl, r7310PinNeeDir)));',
					'  }',
					'  break;',
					'}',
					'if (bounces == 0 && r7310C1RuntimeProbeMode > 160.5 && r7310C1RuntimeProbeMode < 166.5)',
					'{',
					'  if (r7310C1RuntimeProbeMode < 161.5) {',
					'    accumCol = vec3(clamp((x.x + 1.95) / 3.9, 0.0, 1.0), clamp(x.y / 3.0, 0.0, 1.0), clamp((x.z + 2.1) / 5.2, 0.0, 1.0));',
					'  } else if (r7310C1RuntimeProbeMode < 162.5) {',
					'    accumCol = nl * 0.5 + 0.5;',
					'  } else if (r7310C1RuntimeProbeMode < 163.5) {',
					'    accumCol = vec3(clamp((rayOrigin.x + 1.95) / 3.9, 0.0, 1.0), clamp(rayOrigin.y / 3.0, 0.0, 1.0), clamp((rayOrigin.z + 2.1) / 5.2, 0.0, 1.0));',
					'  } else if (r7310C1RuntimeProbeMode < 164.5) {',
					'    accumCol = rayDirection * 0.5 + 0.5;',
					'  } else if (r7310C1RuntimeProbeMode < 165.5) {',
					'    accumCol = vec3(clamp(float(hitType) / 256.0, 0.0, 1.0), clamp(hitObjectID / 256.0, 0.0, 1.0), 0.0);',
					'  } else {',
					'    accumCol = vec3(clamp(uEPS_intersect * 100.0, 0.0, 1.0), nl.y * 0.5 + 0.5, nl.z * 0.5 + 0.5);',
					'  }',
					'  break;',
					'}'
				].join('\\n');
				let fragmentShader = pathTracingFragmentShader.replace(marker, injection);
				if (fragmentShader === pathTracingFragmentShader) throw new Error('pinpoint injection marker not found');
				if (phase0Scan) {
					const randomInclude = '#include <pathtracing_random_functions>';
					const probeDirectionHelper = [
						randomInclude,
						'vec3 r7310Phase0ProbeCosineDirection(vec3 normal)',
						'{',
						'  vec3 n = normalize(normal);',
						'  vec2 xi = fract(uRandomVec2 + vec2(0.173205081, 0.618033989));',
						'  float sinTheta = sqrt(clamp(xi.x, 0.0, 0.999999));',
						'  float cosTheta = sqrt(max(0.0, 1.0 - xi.x));',
						'  float phi = 6.28318530718 * xi.y;',
						'  vec3 up = abs(n.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);',
						'  vec3 tangent = normalize(cross(up, n));',
						'  vec3 bitangent = cross(n, tangent);',
						'  return normalize(tangent * (cos(phi) * sinTheta) + bitangent * (sin(phi) * sinTheta) + n * cosTheta);',
						'}'
					].join('\\n');
					fragmentShader = fragmentShader.replace(randomInclude, probeDirectionHelper);
					if (!fragmentShader.includes('r7310Phase0ProbeCosineDirection')) throw new Error('phase0 probe direction helper injection failed');
				}
				if (phase0Scan || liftY > 0.0) {
					const diffuseAnchor = fragmentShader.indexOf('bool r7310AlbedoFreeBakeFirstHit =');
					const bounceStart = fragmentShader.indexOf('diffuseBounceMask = mask;', diffuseAnchor);
					const bounceEnd = fragmentShader.indexOf('if (r7310FloorIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)', bounceStart);
					if (diffuseAnchor < 0 || bounceStart < 0 || bounceEnd < 0) throw new Error('secondary lift replacement marker not found');
					const phase0LiftLines = [];
					if (phase0Scan && liftY > 0.0) {
						for (const target of cpuTargets) {
							const lift = target.lift || { x: 0, y: 1, z: 0 };
							const len = Math.hypot(lift.x || 0, lift.y || 0, lift.z || 0) || 1.0;
							const lx = (lift.x || 0) / len;
							const ly = (lift.y || 0) / len;
							const lz = (lift.z || 0) / len;
							const wx = Number(target.world.x).toFixed(9);
							const wy = Number(target.world.y).toFixed(9);
							const rx = Number(target.radiusX || phase0RadiusMeters).toFixed(9);
							const ry = Number(target.radiusY || phase0RadiusMeters).toFixed(9);
							phase0LiftLines.push(
								'if (r7310XatlasIndirectBakeFirstHit &&',
								'    r7310C1RuntimeSurfaceIsNorthWall(hitType, hitObjectID, nl, x) &&',
								'    abs(x.x - ' + wx + ') <= ' + rx + ' &&',
								'    abs(x.y - ' + wy + ') <= ' + ry + ' &&',
								'    dot(diffuseBounceRayDirection, vec3(' + lx.toFixed(9) + ', ' + ly.toFixed(9) + ', ' + lz.toFixed(9) + ')) < -0.000001)',
								'{',
								'  diffuseBounceRayOrigin += vec3(' +
									(lx * liftY).toFixed(9) + ', ' +
									(ly * liftY).toFixed(9) + ', ' +
									(lz * liftY).toFixed(9) + ');',
								'}'
							);
						}
					}
					const phase0BounceDirectionLine = phase0Scan
						? 'diffuseBounceRayDirection = r7310Phase0ProbeCosineDirection(nl);'
						: 'diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);';
					const liftLines = phase0Scan
						? phase0LiftLines
						: [
							'if (r7310XatlasIndirectBakeFirstHit &&',
							'    r7310C1RuntimeSurfaceIsNorthWall(hitType, hitObjectID, nl, x) &&',
							'    x.x >= -0.027 &&',
							'    x.x <= 1.91 &&',
							'    abs(x.y - 0.280) <= ' + radiusY.toFixed(9) + ' &&',
							'    diffuseBounceRayDirection.y < -0.000001)',
							'{',
							'  diffuseBounceRayOrigin.y += ' + liftY.toFixed(9) + ';',
							'}'
						];
					const bounceReplacement = [
						'diffuseBounceMask = mask;',
						phase0BounceDirectionLine,
						'diffuseBounceRayOrigin = rayOrigin;',
						...liftLines,
						'misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit',
						'willNeedDiffuseBounceRay = TRUE;',
						'}'
					].join('\\n');
					fragmentShader = fragmentShader.slice(0, bounceStart) + bounceReplacement + '\\n' + fragmentShader.slice(bounceEnd);
				}
				window.__r7310BedtopPinpointMaterials[liftKey] = createCommonVertexShaderMaterial({
					uniforms: pathTracingUniforms,
					uniformsGroups: pathTracingUniformsGroups,
					defines: Object.assign({}, pathTracingDefines || {}, { R7310_BAKE_ONLY_NO_BORROW: 1 }),
					fragmentShader,
					depthTest: false,
					depthWrite: false
				});
				return window.__r7310BedtopPinpointMaterials[liftKey];
			}
			function cameraForWorldPoint(point) {
				const position = { x: point.x, y: point.y + 0.012, z: point.z + 0.012 };
				const dx = point.x - position.x;
				const dy = point.y - position.y;
				const dz = point.z - position.z;
				const len = Math.hypot(dx, dy, dz) || 1;
				return {
					name: 'r7310_pinpoint_live_' + point.y.toFixed(3),
					position,
					forward: { x: dx / len, y: dy / len, z: dz / len },
					fov: 12
				};
			}
			function patchWorldPos(prepared, target, worldOffset) {
				const px = target.atlas.nearest.x;
				const py = target.atlas.nearest.y;
				const index = (py * prepared.width + px) * 4;
				const original = [
					prepared.worldPosDataForUpload[index],
					prepared.worldPosDataForUpload[index + 1],
					prepared.worldPosDataForUpload[index + 2],
					prepared.worldPosDataForUpload[index + 3]
				];
				prepared.worldPosDataForUpload[index] = original[0] + (worldOffset.x || 0);
				prepared.worldPosDataForUpload[index + 1] = original[1] + (worldOffset.y || 0);
				prepared.worldPosDataForUpload[index + 2] = original[2] + (worldOffset.z || 0);
				prepared.worldPosDataForUpload[index + 3] = original[3];
				prepared.textures.worldPos.needsUpdate = true;
				return function restore() {
					prepared.worldPosDataForUpload[index] = original[0];
					prepared.worldPosDataForUpload[index + 1] = original[1];
					prepared.worldPosDataForUpload[index + 2] = original[2];
					prepared.worldPosDataForUpload[index + 3] = original[3];
					prepared.textures.worldPos.needsUpdate = true;
				};
			}
			async function renderVariant(prepared, variant, probeMode) {
				const targetInfo = getTarget(variant.targetName);
				const px = targetInfo.atlas.nearest.x;
				const py = targetInfo.atlas.nearest.y;
				const tileSize = 512;
				const tileX = Math.floor(px / tileSize) * tileSize;
				const tileY = Math.floor(py / tileSize) * tileSize;
				const tileWidth = Math.min(tileSize, width - tileX);
				const tileHeight = Math.min(tileSize, height - tileY);
				const localX = px - tileX;
				const localY = py - tileY;
				const samples = probeMode > 0 ? 1 : Math.max(1, Math.trunc(variant.samples || targetSpp));
				const target = createR738FloatRenderTarget(tileWidth, tileHeight);
				const previous = createR738FloatRenderTarget(tileWidth, tileHeight);
				const state = captureR738BakeState();
				const savedEps = pathTracingUniforms.uEPS_intersect ? pathTracingUniforms.uEPS_intersect.value : null;
				const savedRuntimeProbe = pathTracingUniforms.uR7310C1RuntimeProbeMode ? pathTracingUniforms.uR7310C1RuntimeProbeMode.value : null;
				const savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
				const savedMaterial = pathTracingMesh ? pathTracingMesh.material : null;
				const savedScissorTest = renderer.getScissorTest ? renderer.getScissorTest() : false;
				const savedScissor = renderer.getScissor ? renderer.getScissor(new THREE.Vector4()) : null;
				const savedViewport = renderer.getViewport ? renderer.getViewport(new THREE.Vector4()) : null;
				const restoreWorld = patchWorldPos(prepared, targetInfo, variant.worldOffset || {});
				let sample = null;
				try {
					const secondaryLiftY = Number(variant.secondaryLiftY || 0);
					const secondaryRadiusY = Number(variant.secondaryRadiusY || 0.000625);
					const usePinpointMaterial = phase0Scan || (probeMode >= 151 && probeMode <= 168) || secondaryLiftY > 0.0;
					if (pathTracingMesh) pathTracingMesh.material = usePinpointMaterial
						? createR7310BedtopPinpointMaterial(secondaryLiftY, secondaryRadiusY)
						: createR7310BakeOnlyNoBorrowMaterial();
					if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
					const furnitureMode = targetInfo.furnitureMode === 'wardrobe' ? 'wardrobe' : 'bed';
					if (typeof window.setC2NortheastFurnitureMode === 'function') window.setC2NortheastFurnitureMode(furnitureMode);
					if (typeof window.setR7310C1NortheastFurnitureRuntimeMode === 'function') window.setR7310C1NortheastFurnitureRuntimeMode(furnitureMode);
					if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
					samplingPaused = true;
					cameraIsMoving = false;
					cameraRecentlyMoving = false;
					pathTracingUniforms.uResolution.value.set(tileWidth, tileHeight);
					pathTracingUniforms.uR738C1BakeCaptureMode.value = 2;
					pathTracingUniforms.uR738C1BakePatchId.value = 200000;
					pathTracingUniforms.uR738C1BakePatchResolution.value = Math.max(width, height);
					if (pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 1.0;
					if (pathTracingUniforms.uR7310C1XatlasBakeMode) pathTracingUniforms.uR7310C1XatlasBakeMode.value = 1.0;
					if (pathTracingUniforms.uR7310C1SeparatedBakeMode) pathTracingUniforms.uR7310C1SeparatedBakeMode.value = 0.0;
					if (pathTracingUniforms.uR738C1BakeTileOriginPx) pathTracingUniforms.uR738C1BakeTileOriginPx.value.set(tileX, tileY);
					if (pathTracingUniforms.uR738C1BakeFullAtlasResolution) pathTracingUniforms.uR738C1BakeFullAtlasResolution.value.set(width, height);
					if (pathTracingUniforms.uR7310C1XatlasBakeAtlasSize) pathTracingUniforms.uR7310C1XatlasBakeAtlasSize.value.set(width, height);
					if (pathTracingUniforms.uEPS_intersect) pathTracingUniforms.uEPS_intersect.value = Number(variant.eps);
					if (pathTracingUniforms.uR7310C1RuntimeProbeMode) pathTracingUniforms.uR7310C1RuntimeProbeMode.value = probeMode || 0;
					if (pathTracingUniforms.uXrayEnabled) pathTracingUniforms.uXrayEnabled.value = 0.0;
					if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function') updateR7310C1FullRoomDiffuseRuntimeUniforms();
					refreshR7310C1XatlasBakeTextureUniforms(prepared);
					pathTracingUniforms.tPreviousTexture.value = previous.texture;
					screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
					renderer.setRenderTarget(target);
					renderer.clear();
					renderer.setRenderTarget(previous);
					renderer.clear();
					renderer.setViewport(0, 0, tileWidth, tileHeight);
					renderer.setScissor(localX, localY, 1, 1);
					renderer.setScissorTest(true);
					for (let sampleIndex = 1; sampleIndex <= samples; sampleIndex += 1) {
							const directionIndex = Number(variant.neeDirectionIndex || 0);
							const jitter = typeof r739DeterministicRandomPair === 'function'
								? r739DeterministicRandomPair(sampleIndex + directionIndex * 997, directionIndex)
								: { x: Math.random(), y: Math.random() };
						sampleCounter = sampleIndex;
						frameCounter = sampleIndex + 1.0;
						pathTracingUniforms.uSampleCounter.value = sampleCounter;
						pathTracingUniforms.uFrameCounter.value = frameCounter;
						pathTracingUniforms.uPreviousSampleCount.value = 1.0;
						pathTracingUniforms.uCameraIsMoving.value = false;
						pathTracingUniforms.uRandomVec2.value.set(jitter.x, jitter.y);
						pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
						if (screenOutputUniforms) {
							if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
							if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
							if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
						}
						if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
						refreshR7310C1XatlasBakeTextureUniforms(prepared);
						renderer.setRenderTarget(target);
						renderer.render(pathTracingScene, worldCamera);
						renderer.setRenderTarget(previous);
						renderer.render(screenCopyScene, orthoCamera);
						if (sampleIndex % 32 === 0) await wait(0);
					}
					const readback = await readR738RenderTargetFloatPixels(target);
					const readbackIndex = (localY * tileWidth + localX) * 4;
					const divisor = Math.max(1, samples);
					const rgb = {
						r: readback.pixels[readbackIndex] / divisor,
						g: readback.pixels[readbackIndex + 1] / divisor,
						b: readback.pixels[readbackIndex + 2] / divisor,
						a: readback.pixels[readbackIndex + 3] / divisor
					};
					sample = {
						r: rgb.r,
						g: rgb.g,
						b: rgb.b,
						a: rgb.a,
						luma: rgbLuma(rgb),
						samples
					};
					return {
						variant,
						probeMode: probeMode || 0,
						targetPixel: { x: px, y: py },
						tile: { x: tileX, y: tileY, width: tileWidth, height: tileHeight, localX, localY },
						sample,
						decodedProbe: probeMode > 0 ? decodeProbe(probeMode, sample) : null
					};
				} finally {
					restoreWorld();
					if (pathTracingMesh) pathTracingMesh.material = savedMaterial;
					if (pathTracingUniforms.uEPS_intersect && savedEps !== null) pathTracingUniforms.uEPS_intersect.value = savedEps;
					if (pathTracingUniforms.uR7310C1RuntimeProbeMode && savedRuntimeProbe !== null) pathTracingUniforms.uR7310C1RuntimeProbeMode.value = savedRuntimeProbe;
					restoreR738BakeState(state);
					if (savedViewport) renderer.setViewport(savedViewport);
					if (savedScissor) renderer.setScissor(savedScissor);
					renderer.setScissorTest(savedScissorTest);
					renderer.setRenderTarget(savedRenderTarget);
					target.dispose();
					previous.dispose();
				}
			}
			async function renderLivePinpoint(targetInfo, probeMode) {
				const target = createR738FloatRenderTarget(1, 1);
				const previous = createR738FloatRenderTarget(1, 1);
				const state = captureR738BakeState();
				const savedEps = pathTracingUniforms.uEPS_intersect ? pathTracingUniforms.uEPS_intersect.value : null;
				const savedRuntimeProbe = pathTracingUniforms.uR7310C1RuntimeProbeMode ? pathTracingUniforms.uR7310C1RuntimeProbeMode.value : null;
				const savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
				const savedMaterial = pathTracingMesh ? pathTracingMesh.material : null;
				const savedScissorTest = renderer.getScissorTest ? renderer.getScissorTest() : false;
				const savedScissor = renderer.getScissor ? renderer.getScissor(new THREE.Vector4()) : null;
				const savedViewport = renderer.getViewport ? renderer.getViewport(new THREE.Vector4()) : null;
				try {
					if (pathTracingMesh) pathTracingMesh.material = createR7310BedtopPinpointMaterial();
					if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
					if (typeof window.setC2NortheastFurnitureMode === 'function') window.setC2NortheastFurnitureMode('bed');
					if (typeof window.setR7310C1NortheastFurnitureRuntimeMode === 'function') window.setR7310C1NortheastFurnitureRuntimeMode('bed');
					if (typeof window.setR739Config1ValidationCameraState === 'function') window.setR739Config1ValidationCameraState(cameraForWorldPoint(targetInfo.world));
					if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
					const surfaceSetters = [
						'setR7310C1FloorDiffuseRuntimeEnabled',
						'setR7310C1NorthWallDiffuseRuntimeEnabled',
						'setR7310C1EastWallDiffuseRuntimeEnabled',
						'setR7310C1WestWallDiffuseRuntimeEnabled',
						'setR7310C1SouthWallDiffuseRuntimeEnabled',
						'setR7310C1CeilingDiffuseRuntimeEnabled',
						'setR7310C1StructuralDiffuseRuntimeEnabled',
						'setR7310C1SeColumnNorthShadowRuntimeEnabled',
						'setR7310C1SeColumnWestShadowRuntimeEnabled',
						'setR7310C1SouthWallAcShadowRuntimeEnabled',
						'setR7310C1EastWallBeamShadowRuntimeEnabled',
						'setR7310C1SwColumnNorthShadowRuntimeEnabled',
						'setR7310C1WestWallBeamShadowRuntimeEnabled',
						'setR7310C1SwColumnInnerShadowRuntimeEnabled',
						'setR7310C1WestBeamInnerShadowRuntimeEnabled',
						'setR7310C1WestBeamUnderShadowRuntimeEnabled',
						'setR7310C1EastBeamInnerShadowRuntimeEnabled',
						'setR7310C1EastBeamUnderShadowRuntimeEnabled'
					];
					for (const setterName of surfaceSetters) {
						if (typeof window[setterName] === 'function') window[setterName](false);
					}
					if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function') updateR7310C1FullRoomDiffuseRuntimeUniforms();
					if (typeof updateR738C1BakePastePreviewUniforms === 'function') updateR738C1BakePastePreviewUniforms();
					samplingPaused = true;
					cameraIsMoving = false;
					cameraRecentlyMoving = false;
					pathTracingUniforms.uResolution.value.set(1, 1);
					pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
					if (pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 0.0;
					if (pathTracingUniforms.uR7310C1XatlasBakeMode) pathTracingUniforms.uR7310C1XatlasBakeMode.value = 0.0;
					if (pathTracingUniforms.uR7310C1SeparatedBakeMode) pathTracingUniforms.uR7310C1SeparatedBakeMode.value = 0.0;
					if (pathTracingUniforms.uEPS_intersect) pathTracingUniforms.uEPS_intersect.value = 0.001;
					if (pathTracingUniforms.uR7310C1RuntimeProbeMode) pathTracingUniforms.uR7310C1RuntimeProbeMode.value = probeMode || 0;
					if (pathTracingUniforms.uXrayEnabled) pathTracingUniforms.uXrayEnabled.value = 0.0;
					pathTracingUniforms.tPreviousTexture.value = previous.texture;
					screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
					renderer.setRenderTarget(target);
					renderer.clear();
					renderer.setRenderTarget(previous);
					renderer.clear();
					renderer.setViewport(0, 0, 1, 1);
					renderer.setScissorTest(false);
					const jitter = { x: 0.5, y: 0.5 };
					sampleCounter = 1.0;
					frameCounter = 2.0;
					pathTracingUniforms.uSampleCounter.value = sampleCounter;
					pathTracingUniforms.uFrameCounter.value = frameCounter;
					pathTracingUniforms.uPreviousSampleCount.value = 1.0;
					pathTracingUniforms.uCameraIsMoving.value = false;
					pathTracingUniforms.uRandomVec2.value.set(jitter.x, jitter.y);
					pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
					if (screenOutputUniforms) {
						if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
						if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
						if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
					}
					renderer.setRenderTarget(target);
					renderer.render(pathTracingScene, worldCamera);
					renderer.setRenderTarget(previous);
					renderer.render(screenCopyScene, orthoCamera);
					const readback = await readR738RenderTargetFloatPixels(target);
					const index = 0;
					const sample = {
						r: readback.pixels[index],
						g: readback.pixels[index + 1],
						b: readback.pixels[index + 2],
						a: readback.pixels[index + 3],
						luma: rgbLuma({ r: readback.pixels[index], g: readback.pixels[index + 1], b: readback.pixels[index + 2] }),
						samples: 1
					};
					return {
						mode: 'live_trace_runtime_off',
						probeMode,
						targetName: targetInfo.name,
						cameraState: cameraForWorldPoint(targetInfo.world),
						sample,
						decodedProbe: decodeProbe(probeMode, sample)
					};
				} finally {
					if (pathTracingMesh) pathTracingMesh.material = savedMaterial;
					if (pathTracingUniforms.uEPS_intersect && savedEps !== null) pathTracingUniforms.uEPS_intersect.value = savedEps;
					if (pathTracingUniforms.uR7310C1RuntimeProbeMode && savedRuntimeProbe !== null) pathTracingUniforms.uR7310C1RuntimeProbeMode.value = savedRuntimeProbe;
					restoreR738BakeState(state);
					if (savedViewport) renderer.setViewport(savedViewport);
					if (savedScissor) renderer.setScissor(savedScissor);
					renderer.setScissorTest(savedScissorTest);
					renderer.setRenderTarget(savedRenderTarget);
					target.dispose();
					previous.dispose();
				}
			}
			ensureState();
			await window.prepareR738C1BakeCapture({
				targetAtlasResolution: Math.max(width, height),
				targetAtlasWidth: width,
				targetAtlasHeight: height,
				northeastFurnitureMode: 'bed'
			});
			const preparedSummary = await window.prepareR7310C1XatlasBakeTextures({ texelmapDir: prepDir });
			const prepared = window.__r7310C1XatlasBakePrepared;
			if (!prepared || prepared.width !== width || prepared.height !== height) throw new Error('prepared xatlas size mismatch');
			const variants = makeVariants();
			const radianceResults = [];
			for (const variant of variants) {
				radianceResults.push(await renderVariant(prepared, variant, 0));
			}
			const probeVariants = phase0Scan
				? variants
				: variants.filter((variant) => [
					'contact_baseline_eps_0p01',
					'contact_offset_y_plus_0p005',
					'contact_eps_0p005',
					'contact_eps_0p002',
					'contact_eps_0p0001',
					'above_029_baseline_eps_0p01',
					'west_edge_baseline_eps_0p01',
					'west_edge_offset_x_minus_0p005'
				].includes(variant.name));
			const firstHitResults = [];
			if (!phase0Scan) {
				for (const variant of probeVariants) {
					const probes = [];
					for (const probeMode of [57, 61, 62, 63, 64, 65, 66]) {
						probes.push(await renderVariant(prepared, variant, probeMode));
					}
					firstHitResults.push({ variant, probes });
				}
			}
			const secondaryLiftProbeVariants = phase0Scan
				? probeVariants
				: variants.filter((variant) =>
					variant.name === 'contact_baseline_eps_0p01' ||
					variant.name.startsWith('contact_secondary_lift_y_')
				);
				const secondaryLiftProbeResults = [];
				for (const variant of secondaryLiftProbeVariants) {
					const probes = [];
					for (const probeMode of [151, 152, 153, 154, 155]) {
						probes.push(await renderVariant(prepared, variant, probeMode));
					}
					if (phase0Scan) {
						const directionResults = [];
						for (let directionIndex = 0; directionIndex < PHASE0_NEE_WORST_OF_DIRECTIONS; directionIndex++) {
							const neeVariant = {
								...variant,
								name: variant.name + '_nee_dir_' + directionIndex,
								neeDirectionIndex: directionIndex
							};
							directionResults.push(await renderVariant(prepared, neeVariant, 156));
						}
						const worstNee = directionResults.reduce((worst, entry) => {
							if (!worst) return entry;
							const a = entry.decodedProbe && Number.isFinite(entry.decodedProbe.neeGeom) ? entry.decodedProbe.neeGeom : Infinity;
							const b = worst.decodedProbe && Number.isFinite(worst.decodedProbe.neeGeom) ? worst.decodedProbe.neeGeom : Infinity;
							return a < b ? entry : worst;
						}, null);
						probes.push({
							...(worstNee || directionResults[0]),
							probeMode: 156,
							multiDirectionNeeWorstOf: true,
							directionCount: PHASE0_NEE_WORST_OF_DIRECTIONS,
							worstNee: worstNee ? worstNee.decodedProbe : null,
							directionResults
						});
					} else {
						probes.push(await renderVariant(prepared, variant, 156));
					}
					secondaryLiftProbeResults.push({ variant, probes });
				}
			let pinpoint = null;
			if (!phase0Scan) {
				const pinpointTarget = getTarget('bed_top_contact');
				const pinpointProbeModes = [161, 162, 163, 164, 165, 166, 167, 168, 151, 152, 153, 154, 155, 156];
				const pinpointBakeVariant = { name: 'pinpoint_bake_contact_eps_0p01', targetName: 'bed_top_contact', eps: 0.01, worldOffset: { x: 0, y: 0, z: 0 }, samples: 1 };
				const pinpointBake = [];
				for (const probeMode of pinpointProbeModes) {
					pinpointBake.push(await renderVariant(prepared, pinpointBakeVariant, probeMode));
				}
				const pinpointLive = [];
				for (const probeMode of pinpointProbeModes) {
					pinpointLive.push(await renderLivePinpoint(pinpointTarget, probeMode));
				}
				pinpoint = {
					targetName: pinpointTarget.name,
					targetWorld: pinpointTarget.world,
					probeModes: pinpointProbeModes,
					bakeVariant: pinpointBakeVariant,
					bake: pinpointBake,
					live: pinpointLive
				};
			}
			restoreR7310C1XatlasBakeTextureBindings(prepared);
			return {
				version: 'r7-3-10-full-north-wall-xatlas-bedtop-origin-offset-probe-v1',
				phase0Scan,
				preparedSummary,
				cpuTargets,
				targetSpp,
				variants,
				radianceResults,
				firstHitResults,
				secondaryLiftProbeResults,
				pinpoint,
				layout: typeof window.reportC2NortheastFurnitureLayout === 'function' ? window.reportC2NortheastFurnitureLayout() : null
			};
		})();
	})()`;
}

function normalizeByControl(radianceResults) {
	const control = radianceResults.find((entry) => entry.variant.name === 'control_052_baseline_eps_0p01');
	const controlLuma = control && control.sample ? control.sample.luma : null;
	for (const entry of radianceResults) {
		entry.normalizedByControl052 = Number.isFinite(controlLuma) && controlLuma > 0.000001
			? entry.sample.luma / controlLuma
			: null;
	}
}

function summarizePinpoint(entries) {
	return (entries || []).map((entry) => ({
		mode: entry.probeMode,
		sample: entry.sample,
		decoded: entry.decodedProbe
	}));
}

function decodedProbe(probeSet, mode) {
	const hit = (probeSet || []).find((entry) => entry.probeMode === mode);
	return hit ? hit.decodedProbe : null;
}

function axisValue(point, axis) {
	if (!point || !axis) return null;
	return Number(point[axis]);
}

function dot3(a, b) {
	if (!a || !b) return null;
	return (Number(a.x) || 0) * (Number(b.x) || 0) +
		(Number(a.y) || 0) * (Number(b.y) || 0) +
		(Number(a.z) || 0) * (Number(b.z) || 0);
}

function summarizePhase0Scan(browserReport) {
	const targetByName = new Map((browserReport.cpuTargets || []).map((target) => [target.name, target]));
	const probeByVariant = new Map((browserReport.secondaryLiftProbeResults || []).map((entry) => [entry.variant.name, entry]));
	const radianceByVariant = new Map((browserReport.radianceResults || []).map((entry) => [entry.variant.name, entry]));
	const lines = [];
	for (const target of browserReport.cpuTargets || []) {
		const baselineName = `${target.name}_baseline_eps_0p01`;
		const liftedName = `${target.name}_secondary_lift_${String(PHASE0_LIFT_METERS.toFixed(6)).replace('0.', '0p').replace(/0+$/, '').replace(/p$/, 'p0')}`;
		const baseline = radianceByVariant.get(baselineName);
		const lifted = radianceByVariant.get(liftedName);
		const baselineProbes = probeByVariant.get(baselineName);
		const liftedProbes = probeByVariant.get(liftedName);
		const baseOrigin = decodedProbe(baselineProbes && baselineProbes.probes, 151);
		const baseDir = decodedProbe(baselineProbes && baselineProbes.probes, 152);
		const baseSecond = decodedProbe(baselineProbes && baselineProbes.probes, 153);
		const baseSecondNormal = decodedProbe(baselineProbes && baselineProbes.probes, 154);
		const baseObject = decodedProbe(baselineProbes && baselineProbes.probes, 155);
		const baseNee = decodedProbe(baselineProbes && baselineProbes.probes, 156);
		const liftOrigin = decodedProbe(liftedProbes && liftedProbes.probes, 151);
		const liftSecond = decodedProbe(liftedProbes && liftedProbes.probes, 153);
		const liftObject = decodedProbe(liftedProbes && liftedProbes.probes, 155);
		const liftNee = decodedProbe(liftedProbes && liftedProbes.probes, 156);
		const lift = target.lift || { x: 0, y: 1, z: 0 };
		const contactAxis = target.contactPlane ? target.contactPlane.axis : null;
		const contactValue = target.contactPlane ? Number(target.contactPlane.value) : null;
		const baseOriginPlaneDistance = Number.isFinite(contactValue)
			? Math.abs(axisValue(baseOrigin, contactAxis) - contactValue)
			: null;
		const baseSecondPlaneDistance = Number.isFinite(contactValue)
			? Math.abs(axisValue(baseSecond, contactAxis) - contactValue)
			: null;
		const baseSecondMinusOrigin = baseSecond && baseOrigin
			? { x: baseSecond.x - baseOrigin.x, y: baseSecond.y - baseOrigin.y, z: baseSecond.z - baseOrigin.z }
			: null;
		const liftedSecondMinusOrigin = liftSecond && liftOrigin
			? { x: liftSecond.x - liftOrigin.x, y: liftSecond.y - liftOrigin.y, z: liftSecond.z - liftOrigin.z }
			: null;
		const lumaDelta = baseline && lifted && baseline.sample && lifted.sample
			? lifted.sample.luma - baseline.sample.luma
			: null;
		const lumaGain = baseline && lifted && baseline.sample && lifted.sample && baseline.sample.luma > 0.000001
			? lifted.sample.luma / baseline.sample.luma
			: null;
		const neeGeomDelta = baseNee && liftNee
			? liftNee.neeGeom - baseNee.neeGeom
			: null;
		const originOnContactPlane = Number.isFinite(baseOriginPlaneDistance) && baseOriginPlaneDistance <= TEXEL_SIZE_METERS;
		const strongLiftDelta = Number.isFinite(lumaDelta) && Number.isFinite(lumaGain) && lumaDelta >= 0.02 && lumaGain >= 1.25;
		const neeRecovered = baseNee && liftNee &&
			Number.isFinite(baseNee.neeGeom) &&
			Number.isFinite(liftNee.neeGeom) &&
			baseNee.neeGeom <= 0.20 &&
			liftNee.neeGeom >= 0.40 &&
			neeGeomDelta >= 0.20;
		const validPreparedTexel = target.preparedWorldTexel && target.preparedWorldTexel.valid > 0.5 &&
			target.preparedNormalTexel && target.preparedNormalTexel.len > 0.5;
			const highConfidence = !!(validPreparedTexel && originOnContactPlane && strongLiftDelta && neeRecovered);
			const liftDeltaCandidate = !!(validPreparedTexel && originOnContactPlane && strongLiftDelta);
			const classificationOverride = target.classificationOverride || null;
			const classification = classificationOverride || (highConfidence
				? 'suspected_coplanar_secondary_origin_degeneracy'
				: (liftDeltaCandidate
					? 'lift_delta_candidate_needs_nee_resample'
					: 'not_flagged_by_phase0_threshold'));
			lines.push({
			targetName: target.name,
			contactLine: target.contactLine || target.name,
			role: target.role,
			source: target.source,
			furnitureMode: target.furnitureMode || 'bed',
			world: target.world,
			atlas: target.atlas,
			prepared: {
				worldTexel: target.preparedWorldTexel,
				normalTexel: target.preparedNormalTexel,
				worldDeltaMeters: target.worldDeltaMeters
			},
			lift,
			contactPlane: target.contactPlane,
			radiance: {
				baselineLuma: baseline && baseline.sample ? baseline.sample.luma : null,
				liftedLuma: lifted && lifted.sample ? lifted.sample.luma : null,
				lumaDelta,
				lumaGain,
				samples: baseline && baseline.sample ? baseline.sample.samples : null
			},
			probes: {
				baseline: {
					secondaryOrigin: baseOrigin,
					secondaryDirection: baseDir,
					secondHitWorldPos: baseSecond,
					secondHitNormal: baseSecondNormal,
					secondHitTypeObjectId: baseObject,
					nee: baseNee
				},
				lifted: {
					secondaryOrigin: liftOrigin,
					secondHitWorldPos: liftSecond,
					secondHitTypeObjectId: liftObject,
					nee: liftNee
				}
			},
			fingerprints: {
				validPreparedTexel,
				originOnContactPlane,
				baseOriginPlaneDistance,
				baseSecondPlaneDistance,
				baseSecondAlongLift: dot3(baseSecondMinusOrigin, lift),
				liftedSecondAlongLift: dot3(liftedSecondMinusOrigin, lift),
				strongLiftDelta,
					neeRecovered,
					neeGeomDelta
				},
				classificationOverride,
				classification
			});
	}
	return {
		version: 'r7-3-10-phase0-coplanar-contact-scan-v1',
		thresholds: {
			liftMeters: PHASE0_LIFT_METERS,
			radiusMeters: PHASE0_RADIUS_METERS,
				texelSizeMeters: TEXEL_SIZE_METERS,
				neeWorstOfDirections: PHASE0_NEE_WORST_OF_DIRECTIONS,
				minLumaDelta: 0.02,
			minLumaGain: 1.25,
			maxBaselineNeeGeom: 0.20,
			minLiftedNeeGeom: 0.40,
			minNeeGeomDelta: 0.20
		},
			lines,
			flagged: lines.filter((line) =>
				line.classification === 'confirmed_bed_top_bake_bug' ||
				line.classification === 'suspected_coplanar_secondary_origin_degeneracy' ||
				line.classification === 'lift_delta_candidate_needs_nee_resample'
			),
			notFlagged: lines.filter((line) =>
				line.classification !== 'confirmed_bed_top_bake_bug' &&
				line.classification !== 'suspected_coplanar_secondary_origin_degeneracy' &&
				line.classification !== 'lift_delta_candidate_needs_nee_resample'
			)
	};
}

async function main() {
	const http = arg('http', '127.0.0.1:9003');
	const cdpPort = Number(arg('cdp-port', '9341'));
	const targetSpp = Number(arg('target-spp', '256'));
	const timeoutMs = Number(arg('timeout-ms', '300000'));
	const outDir = arg('out-dir', '.omc/r7-3-10-full-north-wall-xatlas-phase2/20260612-054400/bedtop-origin-offset-probe');
	const angle = arg('angle', 'metal');
	if (isBraveBrowserPath(CHROME_PATH)) throw new Error('Brave is forbidden');
	if (!fs.existsSync(CHROME_PATH)) throw new Error('Google Chrome not found');
	const cpuTargets = buildCpuReport();
	fs.mkdirSync(outDir, { recursive: true });
	const userDataDir = path.join(os.tmpdir(), `r7310-bedtop-origin-offset-${process.pid}`);
	const browserArgs = [
		'--headless=new',
		'--enable-webgl',
		'--ignore-gpu-blocklist',
		'--use-gl=angle',
		`--use-angle=${angle}`,
		'--enable-unsafe-swiftshader',
		`--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
		`--remote-debugging-port=${cdpPort}`,
		`--user-data-dir=${userDataDir}`,
		'--no-first-run',
		'--no-default-browser-check',
		'about:blank'
	];
	const browser = spawn(CHROME_PATH, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
	let stderr = '';
	browser.stderr.on('data', (chunk) => {
		stderr += chunk.toString('utf8');
		if (stderr.length > 12000) stderr = stderr.slice(-12000);
	});
	let cdp = null;
	try {
		await waitForCdp(cdpPort, 30000);
		const pageUrl = `http://${http}/Home_Studio.html?xatlasPackage=full-north-wall-raw&bedtopOriginOffsetProbe=${Date.now()}`;
		console.error(`[origin-offset-probe] opening ${pageUrl}`);
		const target = await openCdpTarget(cdpPort, pageUrl);
		cdp = new CdpWebSocket(target.webSocketDebuggerUrl);
		await cdp.connect();
		await cdp.send('Runtime.enable');
		await cdp.send('Page.enable');
		await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
		await waitForExpr(cdp, `document.readyState === 'complete' && typeof window.prepareR7310C1XatlasBakeTextures === 'function' && typeof createR738FloatRenderTarget === 'function'`, 90000);
		console.error('[origin-offset-probe] helpers ready');
		const browserReport = await evaluate(cdp, buildBrowserScript(cpuTargets, targetSpp, timeoutMs), {
			awaitPromise: true,
			timeoutMs: timeoutMs + 240000
		});
		normalizeByControl(browserReport.radianceResults);
		const contactBaseline = browserReport.radianceResults.find((entry) => entry.variant.name === 'contact_baseline_eps_0p01');
		const contactOffset005 = browserReport.radianceResults.find((entry) => entry.variant.name === 'contact_offset_y_plus_0p005');
		const contactEps0001 = browserReport.radianceResults.find((entry) => entry.variant.name === 'contact_eps_0p0001');
		const above029 = browserReport.radianceResults.find((entry) => entry.variant.name === 'above_029_baseline_eps_0p01');
		const secondaryLiftRadiance = browserReport.radianceResults
			.filter((entry) => Number.isFinite(entry.variant.secondaryLiftY))
			.map((entry) => ({
				name: entry.variant.name,
				targetName: entry.variant.targetName,
				secondaryLiftY: entry.variant.secondaryLiftY,
				secondaryRadiusY: entry.variant.secondaryRadiusY || 0.000625,
				luma: entry.sample ? entry.sample.luma : null,
				normalizedByControl052: entry.normalizedByControl052,
				samples: entry.sample ? entry.sample.samples : null
			}));
		const secondaryLiftContact = secondaryLiftRadiance.filter((entry) => entry.targetName === 'bed_top_contact');
		const secondaryLiftProbes = (browserReport.secondaryLiftProbeResults || []).map((entry) => ({
			name: entry.variant.name,
			secondaryLiftY: entry.variant.secondaryLiftY || 0,
			secondaryRadiusY: entry.variant.secondaryRadiusY || 0.000625,
			probes: entry.probes.map((probe) => ({
				mode: probe.probeMode,
				decoded: probe.decodedProbe,
				luma: probe.sample ? probe.sample.luma : null
				}))
			}));
		const gateATargetNames = [
			'bed_top_below_27875',
			'bed_top_contact',
			'bed_top_above_28125',
			'bed_top_above_28250',
			'bed_top_above_029',
			'bed_top_above_030',
			'bed_top_above_032',
			'bed_top_control_052'
		];
		const gateABaseline = gateATargetNames.map((targetName) => {
			const target = browserReport.cpuTargets
				? browserReport.cpuTargets.find((entry) => entry.name === targetName)
				: null;
			const entry = browserReport.radianceResults.find((item) =>
				item.variant.targetName === targetName &&
				!Number.isFinite(item.variant.secondaryLiftY) &&
				item.variant.name.includes('baseline_eps_0p01')
			);
			return {
				targetName,
				worldY: target && target.world ? target.world.y : null,
				pixel: target && target.atlas ? target.atlas.nearest : null,
				luma: entry && entry.sample ? entry.sample.luma : null,
				normalizedByControl052: entry ? entry.normalizedByControl052 : null,
				samples: entry && entry.sample ? entry.sample.samples : null
			};
		});
		const gateASelectedLiftY = 0.000125;
		const gateALifted = gateATargetNames.map((targetName) => {
			const entry = secondaryLiftRadiance.find((item) =>
				item.targetName === targetName &&
				Math.abs(item.secondaryLiftY - gateASelectedLiftY) < 1e-12 &&
				Math.abs((item.secondaryRadiusY || 0.000625) - 0.000625) < 1e-12
			);
			const baseline = gateABaseline.find((item) => item.targetName === targetName);
			return {
				targetName,
				worldY: baseline ? baseline.worldY : null,
				pixel: baseline ? baseline.pixel : null,
				secondaryLiftY: gateASelectedLiftY,
				luma: entry ? entry.luma : null,
				normalizedByControl052: entry ? entry.normalizedByControl052 : null,
				deltaFromBaseline: entry && baseline && Number.isFinite(baseline.luma)
					? entry.luma - baseline.luma
					: null,
				samples: entry ? entry.samples : null
			};
		});
		const gateARadiusSweep = secondaryLiftRadiance
			.filter((item) =>
				Math.abs(item.secondaryLiftY - gateASelectedLiftY) < 1e-12 &&
				[
					'bed_top_below_27875',
					'bed_top_contact',
					'bed_top_above_28125',
					'bed_top_above_28250',
					'bed_top_above_029',
					'bed_top_control_052'
				].includes(item.targetName) &&
				item.name.includes('_radius_y_')
			)
			.map((item) => {
				const baseline = gateABaseline.find((entry) => entry.targetName === item.targetName);
				return {
					targetName: item.targetName,
					worldY: baseline ? baseline.worldY : null,
					pixel: baseline ? baseline.pixel : null,
					secondaryLiftY: item.secondaryLiftY,
					secondaryRadiusY: item.secondaryRadiusY,
					luma: item.luma,
					normalizedByControl052: item.normalizedByControl052,
					deltaFromBaseline: baseline && Number.isFinite(baseline.luma)
						? item.luma - baseline.luma
						: null,
					samples: item.samples
				};
			});
		const phase0Summary = PHASE0_SCAN ? summarizePhase0Scan(browserReport) : null;
		const report = {
			version: PHASE0_SCAN
				? 'r7-3-10-phase0-coplanar-contact-scan-v1'
				: 'r7-3-10-full-north-wall-xatlas-bedtop-origin-offset-probe-v1',
			createdAt: new Date().toISOString(),
			redLines: {
				formalRadianceBake: false,
				runtimePointerChanged: false,
				productCodeChangedByProbe: false,
				commitCreated: false,
				browser: 'Google Chrome headless'
			},
			inputs: { http, pageUrl, cdpPort, targetSpp, timeoutMs, prepDir: PREP_DIR, width: WIDTH, height: HEIGHT },
			cpu: { bedAabb: BED_AABB, wallNormal: WALL_NORMAL, targets: cpuTargets },
			browser: browserReport,
			decisionAid: {
				phase0: phase0Summary,
				contactBaselineLuma: contactBaseline ? contactBaseline.sample.luma : null,
				contactOffsetY005Luma: contactOffset005 ? contactOffset005.sample.luma : null,
				contactEps0001Luma: contactEps0001 ? contactEps0001.sample.luma : null,
				above029Luma: above029 ? above029.sample.luma : null,
				yOffset005GainOverBaseline: contactBaseline && contactOffset005 && contactBaseline.sample.luma > 0.000001
					? contactOffset005.sample.luma / contactBaseline.sample.luma
					: null,
				eps0001GainOverBaseline: contactBaseline && contactEps0001 && contactBaseline.sample.luma > 0.000001
					? contactEps0001.sample.luma / contactBaseline.sample.luma
					: null,
				secondaryLiftContact,
				secondaryLiftRadiance,
				secondaryLiftProbes,
				gateA: {
					description: 'vertical sweep around bed-top contact, used to lock Y radius before rebake',
					selectedLiftY: gateASelectedLiftY,
					proposedRadiusY: 0.000625,
					baseline: gateABaseline,
					lifted: gateALifted,
					radiusSweep: gateARadiusSweep
				},
				yOffsetSupportsOriginSelfIntersection: contactBaseline && contactOffset005 && above029
					? contactOffset005.sample.luma > contactBaseline.sample.luma * 1.25 &&
						Math.abs(contactOffset005.sample.luma - above029.sample.luma) <= Math.max(0.025, above029.sample.luma * 0.25)
					: false
			}
		};
		const outPath = path.join(outDir, PHASE0_SCAN ? 'phase0-coplanar-contact-scan.json' : 'bedtop-origin-offset-probe.json');
		fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
		console.log(JSON.stringify({
			result: 'PASS',
			outPath,
			phase0: phase0Summary ? {
				flaggedCount: phase0Summary.flagged.length,
				notFlaggedCount: phase0Summary.notFlagged.length,
				flagged: phase0Summary.flagged.map((line) => ({
					targetName: line.targetName,
					contactLine: line.contactLine,
					furnitureMode: line.furnitureMode,
					baselineLuma: line.radiance.baselineLuma,
					liftedLuma: line.radiance.liftedLuma,
					lumaDelta: line.radiance.lumaDelta,
					baselineNeeGeom: line.probes.baseline.nee ? line.probes.baseline.nee.neeGeom : null,
					liftedNeeGeom: line.probes.lifted.nee ? line.probes.lifted.nee.neeGeom : null,
					classification: line.classification
				}))
			} : null,
			radiance: browserReport.radianceResults.map((entry) => ({
				name: entry.variant.name,
				luma: entry.sample.luma,
				normalizedByControl052: entry.normalizedByControl052,
				samples: entry.sample.samples
			})),
			firstHit: browserReport.firstHitResults.map((entry) => ({
				name: entry.variant.name,
				probes: entry.probes.map((probe) => ({
					mode: probe.probeMode,
					sample: probe.sample,
					decoded: probe.decodedProbe
				}))
			})),
			secondaryLift: {
				radiance: secondaryLiftRadiance,
				probes: secondaryLiftProbes
			},
			gateA: report.decisionAid.gateA,
			pinpoint: browserReport.pinpoint ? {
				targetName: browserReport.pinpoint.targetName,
				targetWorld: browserReport.pinpoint.targetWorld,
				bake: summarizePinpoint(browserReport.pinpoint.bake),
				live: summarizePinpoint(browserReport.pinpoint.live)
			} : null,
			decisionAid: report.decisionAid
		}, null, 2));
	} catch (error) {
		console.error(error && error.stack ? error.stack : String(error));
		console.error('--- chrome stderr tail ---');
		console.error(stderr.slice(-4000));
		process.exitCode = 1;
	} finally {
		if (cdp) cdp.close();
		try { browser.kill('SIGTERM'); } catch { /* noop */ }
		try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* noop */ }
	}
}

main();
