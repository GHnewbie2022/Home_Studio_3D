#!/usr/bin/env node
// R7-3.10 west wall albedo-free separated 契約鎖（仿 check-r7310-iron-door-reveal-consts）。
// 鎖定 capture → report → runner pointer → loader → runtime uniform → shader 播放 六邊一致，
// 並驗證向後相容（舊 1004 未宣告 multiplyAlbedoAfterBakeLookup 仍可載）。
// exit 0 = 一致，exit 1 = 契約diverge。
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '../..');
const read = f => fs.readFileSync(path.join(REPO, f), 'utf8');
const glsl = read('shaders/Home_Studio_Fragment.glsl');
const ic = read('js/InitCommon.js');
const hs = read('js/Home_Studio.js');
const runner = read('docs/tools/r7-3-8-c1-bake-capture-runner.mjs');
let ok = true;
function chk(cond, label) { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + label); if (!cond) ok = false; }

// --- shader 播放端 ---
chk(/uniform float uR7310C1WestWallSeparatedDiffuseMode;/.test(glsl), 'shader 宣告 uR7310C1WestWallSeparatedDiffuseMode');
chk(/r7310C1WestWallHybridPreAlbedoRadiance/.test(glsl), 'shader 有 WestWallHybridPreAlbedoRadiance');
chk(/r7310C1WestWallHybridRadiance\([^)]*vec3 visibleAlbedo\)/.test(glsl), 'shader hybrid radiance 簽名收 visibleAlbedo');
chk((glsl.match(/uR7310C1WestWallSeparatedDiffuseMode > 0\.5/g) || []).length >= 2, 'shader hybrid+shortCircuit 皆判 separated 乘 albedo');
const callNew = (glsl.match(/r7310C1WestWallHybridRadiance\(hitType, hitObjectID, nl, x, hitColor\)/g) || []).length;
const callOld = (glsl.match(/r7310C1WestWallHybridRadiance\(hitType, hitObjectID, nl, x\);/g) || []).length;
chk(callNew === 4, 'shader 4 個呼叫點全部帶 hitColor（得 ' + callNew + '）');
chk(callOld === 0, 'shader 無舊式漏改呼叫點（得 ' + callOld + '）');

// --- Home_Studio uniform 註冊 ---
chk(/pathTracingUniforms\.uR7310C1WestWallSeparatedDiffuseMode = \{ value: 0\.0 \};/.test(hs), 'Home_Studio 註冊 separated uniform');

// --- InitCommon runtime / loader ---
chk(/let r7310C1WestWallSeparatedDiffuseRuntime = false;/.test(ic), 'InitCommon 宣告 separated runtime flag');
chk(/r7310C1WestWallSeparatedDiffuseRuntime = pointer\.multiplyAlbedoAfterBakeLookup === true;/.test(ic), 'InitCommon loader 設 separated flag');
chk(/multiplyAlbedoAfterBakeLookup === true && pointer\.bakeAlbedoFree !== true/.test(ic), 'InitCommon loader 條件式 albedo 防呆');
chk(/uR7310C1WestWallSeparatedDiffuseMode\.value = westWallApplied && r7310C1WestWallSeparatedDiffuseRuntime/.test(ic), 'InitCommon updateUniforms 設 separated mode');
chk(/separatedIrradianceBake: options\.separatedIrradianceBake === true/.test(ic), 'InitCommon capture/呼叫處 傳 separatedIrradianceBake');
chk(/bakeAlbedoFree: options\.separatedIrradianceBake === true/.test(ic), 'InitCommon west report 輸出 bakeAlbedoFree');

// --- runner pointer west 分支 ---
const wIdx = runner.indexOf("report.surfaceName === 'c1_west_wall'");
const wBlock = wIdx >= 0 ? runner.slice(wIdx, wIdx + 700) : '';
chk(/multiplyAlbedoAfterBakeLookup = report\.multiplyAlbedoAfterBakeLookup === true/.test(wBlock), 'runner west pointer 帶 multiplyAlbedoAfterBakeLookup');
chk(/bakeAlbedoFree = report\.bakeAlbedoFree === true/.test(wBlock), 'runner west pointer 帶 bakeAlbedoFree');

// --- 分離新 generation 路徑（不覆蓋 git-tracked 舊 1004）---
chk(/c1_west_wall' && options\.separatedIrradianceBake === true\) return 'docs\/data\/r7-3-10-c1-west-wall-separated-diffuse-runtime-package\.json'/.test(runner), 'runner west separated → 分離 pointer 路徑（不覆蓋舊）');
chk(/c1_west_wall' && options\.separatedIrradianceBake === true\) return path\.join\(root, 'west-wall-separated-albedo-free-1024px-1000spp'\)/.test(runner), 'runner west separated → 分離 packageDir（不覆蓋舊）');
chk(/R7310_C1_WEST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs\/data\/r7-3-10-c1-west-wall-separated-diffuse-runtime-package\.json'/.test(ic), 'loader 預設讀 separated pointer');
chk(/R7310_C1_WEST_WALL_DIFFUSE_RUNTIME_FALLBACK_PACKAGE_URL = 'docs\/data\/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package\.json'/.test(ic), 'loader 保留舊 mixed 為 fallback');
chk(/pointerResponse = await fetch\(R7310_C1_WEST_WALL_DIFFUSE_RUNTIME_FALLBACK_PACKAGE_URL/.test(ic), 'loader 重烤前 separated 404 → fallback 舊 mixed');

// --- 向後相容 / 矛盾包模擬（loader 契約邏輯）---
const contractThrows = p => p.multiplyAlbedoAfterBakeLookup === true && p.bakeAlbedoFree !== true;
chk(!contractThrows({}), '向後相容：舊 1004（無 multiplyAlbedo）不觸發契約 throw');
chk(!contractThrows({ multiplyAlbedoAfterBakeLookup: true, bakeAlbedoFree: true }), '新 albedo-free 包（both true）通過');
chk(contractThrows({ multiplyAlbedoAfterBakeLookup: true }), '矛盾包（multiplyAlbedo=true 但缺 bakeAlbedoFree）被擋');

if (!ok) { console.error('MISMATCH: west wall albedo-free 契約 diverge，重烤前必修。'); process.exit(1); }
console.log('west wall albedo-free 契約一致（capture / report / runner / loader / runtime uniform / shader 六邊對齊 + 向後相容）。');
