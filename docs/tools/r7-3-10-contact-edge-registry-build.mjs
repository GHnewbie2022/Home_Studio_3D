#!/usr/bin/env node
// R7-3.10 Step D — registry 骨架與 owner policy（SOP source.md §14.6）。
//
// 讀 Step B（contact-edge-source.json）、Step C（a1-contact-scan.json + a1-contact-blender.json）、
// Step A（stage-a/latest.json → probe.json），產出：
//   a1-contact-edge-registry.json（9 欄；ownerPolicy 一律 PENDING；contactCandidates＝幾何兩側；
//       observedOwnerEvidence＝Step A probe 原始讀值，每筆標 level）
//   a1-owner-policy.md（規則書）
// a1-mesh-contact-debug.glb 由 Step C blender 已輸出。
//
// 硬規則：ownerPolicy 禁止在此填定案（幾何相鄰≠歸屬），由 Step E 三來源對帳後才產出。
// 不改 shader/bake/runtime。
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = '/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D';
const DIR = path.join(PROJECT_ROOT, 'docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates');
const SRC = path.join(DIR, 'contact-edge-source.json');
const SCAN = path.join(DIR, 'a1-contact-scan.json');
const BLENDER = path.join(DIR, 'a1-contact-blender.json');
const LATEST = path.join(DIR, 'stage-a', 'latest.json');
const SWEEP = path.join(DIR, 'a1-seam-transition-sweep.json');
const OUT_REGISTRY = path.join(DIR, 'a1-contact-edge-registry.json');
const OUT_POLICY = path.join(DIR, 'a1-owner-policy.md');

const PACKAGE = 'd800-north-denoise-c';
const CAMERA = { position: { x: -1.708748, y: 2.826862, z: -1.820144 }, forward: { x: -0.495699, y: 0.416871, z: -0.761906 }, fov: 55 };

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error('STOP(Step D):', msg); process.exit(2); }

function main() {
	for (const [name, p] of [['source', SRC], ['scan', SCAN], ['blender', BLENDER], ['stage-a latest', LATEST]]) {
		if (!fs.existsSync(p)) fail(`缺前置輸出 ${name}: ${p}`);
	}
	const src = readJson(SRC);
	const scan = readJson(SCAN);
	const blender = readJson(BLENDER);
	const latest = readJson(LATEST);
	const probe = readJson(path.join(PROJECT_ROOT, latest.probe));
	const sweep = fs.existsSync(SWEEP) ? readJson(SWEEP) : null;

	// 兩側 surface（幾何兩側，非 owner）：北牆 1002、西樑內側 1015。
	const nw = src.surfaces.find((s) => s.targetId === 1002);
	const wb = src.surfaces.find((s) => s.targetId === 1015);
	const island = (src.structuralIslands || []).find((i) => i.name === 'west_beam_inner_x');
	const edgePolicy = (src.atlasEdgePolicies || []).find((p) => p.surface === 'northWall');

	// observedOwnerEvidence：Step A 五行 probe 原始讀值（每筆標 level；事實，不下定案）。
	const observedOwnerEvidence = (probe.rows || []).map((r) => ({
		y: r.y,
		alignmentOk: r.alignmentOk,
		'level31_route': r.route ? r.route.l31 : null,
		'level35_coverage': r.route ? r.route.l35 : null,
		'level37_ownerCountBitmask': r.owner,
		'level36_northBeamRadiance_line_vs_control': r.bakedLine_vs_control ? r.bakedLine_vs_control.l36 : null,
		'level49_nonSquarePreAlbedo_line_vs_control': r.bakedLine_vs_control ? r.bakedLine_vs_control.l49 : null,
		'level32_worldPosition': r.worldPosition,
		'level34_hitObject': r.hitObject,
		'level33_normal': r.normal,
	}));

	const registry = {
		generatedNote: 'R7-3.10 Step D registry 骨架（SOP §14.6）。ownerPolicy 一律 PENDING，由 Step E 三來源對帳後產出；contactCandidates 為 Step C 幾何兩側（不代表歸屬），observedOwnerEvidence 為 Step A probe 原始讀值。未改 shader/bake/runtime。',
		edges: [
			{
				// (1) 接觸邊名稱
				edgeName: 'A1 北牆 ↔ 西樑北端',
				edgeId: 'a1',
				// (2) 世界座標範圍（Step C 接觸帶；Python 與 Blender 一致）
				worldBounds: scan.contactBand,
				worldBoundsCrossCheck: { python: scan.contactBand, blender: blender.contactBand, agree: blender.vsPythonScan ? blender.vsPythonScan.agree : null },
				// (3) 兩側 surface ID（兩側標示，不指定 owner）
				sideSurfaceIds: [
					{ targetId: 1002, surfaceName: nw ? nw.surfaceName : 'c1_north_wall', role: 'north_wall', faceNormal: '+Z' },
					{ targetId: 1015, surfaceName: wb ? wb.surfaceName : 'c1_west_beam_inner_shadow', role: 'west_beam_inner', faceNormal: '-Z(north cap)/+X(inner)' },
				],
				// (4) ownerPolicy：PENDING（Step E 才填）+ 兩塊原始輸入
				ownerPolicy: 'PENDING',
				ownerPolicyNote: '禁止在 Step D 填定案；幾何相鄰≠runtime 歸屬。由 Step E gate/bake/metadata 三來源對帳後產出，取代此 PENDING。',
				contactCandidates: {
					source: 'Step C 幾何（aabb rect-intersect + blender boolean）',
					sides: scan.sides,
					note: '幾何只說「哪兩面接觸」，不代表 runtime 歸屬。',
				},
				observedOwnerEvidence: {
					source: 'Step A probe（' + (latest.runId || '?') + '）原始讀值，每筆標 level；屬量測事實。',
					rows: observedOwnerEvidence,
				},
				// 跨接縫 x-sweep 實測（Step A 輔助）：A1 黑線的真實 owner/route 狀態。屬量測事實，不下定案。
				seamTransitionSweep: sweep ? {
					file: 'a1-seam-transition-sweep.json',
					beamSide: sweep.beamSide,
					noneSide: sweep.noneSide,
					boundaryXScreen: sweep.boundaryXScreen,
					measuredFinding: '西樑 owner 1015 baked（luma ~0.10）緊鄰一條北牆 route=none / ownerCount=0（luma 0）帶＝黑線本體。實測與舊「owner 1002 atlas dip」假設不同，故 ownerPolicy 維持 PENDING、分類待對帳。',
				} : null,
				// (5) baked package
				bakedPackage: PACKAGE,
				// (6) 驗收相機
				acceptanceCamera: CAMERA,
				// (7) probe 欄位（＝Step A 七欄位）
				probeFields: ['level31/35 route', 'level37 ownerCount/owners/encodingValid', 'level36/49 baked line vs control', 'level32 worldPosition', 'level34 hitObject', 'level33 normal'],
				// (8) 通過門檻（候選，正式值待第 15 節綠燈）
				passThreshold: {
					status: 'candidate',
					note: '候選門檻；正式值待第 15 節綠燈以實測定。',
					seamPostAlbedoStepCandidate: 0.005,
					localDeltaPeakCandidate: 0.04,
					space: 'linear',
					ownerCountMustBeIn: [0, 1],
				},
				// (9) 硬否決條件（第 11.1 節九條）
				hardVeto: [
					'黑線消失但旁邊出現無人認領 live 區域',
					'baked 交界被切出一塊 live 補洞',
					'某段接觸邊靠 live path tracing 臨時接上',
					'交界亮度看似接近但 owner route 不連續',
					'probe 顯示同一條接觸邊一段 baked、一段 live、一段沒有 owner',
					'修法靠換回舊 package 才無縫',
					'修法靠關閉北牆某一帶改走 live',
					'只用 tonemapped 截圖宣告通過',
					'沒有使用者相機驗收圖',
				],
			},
		],
		// Step E 三來源 contract 要鎖的靜態常數（registry 端的真值副本，供 contract 與 JS/shader 三方比對）。
		lockedConstants: {
			gateWest: src.northWallBeamGap ? src.northWallBeamGap.west : null,
			shaderGateWest: src.shaderGates ? src.shaderGates.westRect : null,
			shaderWiringPresent: src.shaderGates ? src.shaderGates.wiringPresent : null,
			northWallWorldBounds_1002: nw ? nw.worldBounds : null,
			westBeamInnerWorldBounds_1015: wb ? wb.worldBounds : null,
			westBeamInnerIsland: island ? { name: island.name, atlasRect: island.atlasRect, worldFace: island.worldFace, normal: island.normal } : null,
			northAtlasEdgePolicy: edgePolicy || null,
			nonSquareNorthWallUvRect: src.nonSquareNorthWallUvRect || null,
			bakedPackage: PACKAGE,
		},
	};

	fs.writeFileSync(OUT_REGISTRY, JSON.stringify(registry, null, 2));

	const e = registry.edges[0];
	const policyMd = `# A1 owner policy（Step D 規則書，SOP §14.6 交付物 7.4.3）

> 由 docs/tools/r7-3-10-contact-edge-registry-build.mjs 產生。ownerPolicy 此刻為 PENDING；
> 最終 owner 由 Step E 三來源（gate / bake / metadata）對帳後產出，不在 Step D 由幾何填定案。

## 1. 接觸邊
- 名稱：${e.edgeName}（edgeId ${e.edgeId}）
- 世界座標範圍：z=${e.worldBounds.z}，x[${e.worldBounds.xMin}, ${e.worldBounds.xMax}]，y[${e.worldBounds.yMin}, ${e.worldBounds.yMax}]
- 兩側 surface：1002 北牆（+Z）、1015 西樑內側（北端 -Z / 內側 +X）

## 2. owner 規則
- 現況：**PENDING**。幾何相鄰只證明「哪兩面接觸」，不能定 runtime 歸屬。
- 產出時機：Step E 對帳 gate（InitCommon r7310C1NorthWallHiddenByBeamGap + shader）、bake（probe level 49/36 + atlas UV / worldBounds / package）、metadata（structuralIslands + atlasEdgePolicies）三來源後，寫回 registry 第 (4) 欄。
- 允許修法類型：待分類確定後，依第 8.2.4–8.2.6 與第 11.2 節決定（atlas edge fill / runtime gate / 幾何封邊），本資料系統內不動 shader/bake。

## 3. 驗收相機
- position(${CAMERA.position.x}, ${CAMERA.position.y}, ${CAMERA.position.z})、forward(${CAMERA.forward.x}, ${CAMERA.forward.y}, ${CAMERA.forward.z})、fov ${CAMERA.fov}
- package：${PACKAGE}
- 使用者紅框基準：user-a1-redbox-reference.png（唯一基準，禁自截自判）

## 4. probe 門檻（候選）
- 候選：共邊 post-albedo 跨交接無階梯（差 < 0.005）、ownerCount ∈ {0,1}、五行 peak localDelta < 0.04（linear，不採 tonemapped 截圖）。
- 正式值待第 15 節綠燈以實測定。

## 5. 硬否決（第 11.1 節九條）
${e.hardVeto.map((v, i) => `- (${i + 1}) ${v}`).join('\n')}

## 6. 截圖要求
- ≥ 500 spp 失敗截圖（先紅，證明線存在且＝使用者紅框）；overlay 與 user-a1-redbox-reference.png 並排。
- 綠燈無線截圖屬第 15 節。
`;
	fs.writeFileSync(OUT_POLICY, policyMd);

	console.log('WROTE', OUT_REGISTRY);
	console.log('WROTE', OUT_POLICY);
	console.log('CHECK ownerPolicy =', e.ownerPolicy, '(expect PENDING)');
	console.log('CHECK contactCandidates.sides =', JSON.stringify(e.contactCandidates.sides));
	console.log('CHECK observedOwnerEvidence.rows =', e.observedOwnerEvidence.rows.length, '(expect 5)');
	console.log('CHECK 9 fields present =', ['edgeName', 'worldBounds', 'sideSurfaceIds', 'ownerPolicy', 'bakedPackage', 'acceptanceCamera', 'probeFields', 'passThreshold', 'hardVeto'].every((k) => k in e));
	console.log('CHECK lockedConstants.gateWest =', JSON.stringify(registry.lockedConstants.gateWest));
	if (e.ownerPolicy !== 'PENDING') fail('ownerPolicy 非 PENDING');
}
main();
