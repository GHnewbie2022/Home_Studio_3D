#!/usr/bin/env node
// R7-3.10 Phase 2B I4：UV↔bake 往返／軸向一致性離線檢查（稽核獨立）。
// 標準答案＝docs/tools/r7-3-10-surface-axis-spec.json（來源：房間幾何與世界座標，非 GLSL）。
// 被檢查對象＝GLSL runtime UV 常數、JS InitCommon 常數、package targetAtlasWidth/Height。
// CODEX 2B-0c 裁示：不得以 GLSL 常數當標準答案；spec 由幾何獨立產生 expected，再比對各方。
// 用法：node docs/tools/r7-3-10-uv-bake-roundtrip-check.mjs   （PASS→exit 0；任一 FAIL→exit 1；PENDING 不算 FAIL）
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = JSON.parse(readFileSync(join(ROOT, 'docs/tools/r7-3-10-surface-axis-spec.json'), 'utf8'));
const GLSL = readFileSync(join(ROOT, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const INIT = readFileSync(join(ROOT, 'js/InitCommon.js'), 'utf8');
const TEX = SPEC._doc.texelPerM;
const DENSITY_TOL = 3;       // |atlasDim/worldLen - 800| 容差
const ASPECT_REL_TOL = 0.015; // atlas aspect vs world aspect 相對容差
const INSET_ABS_TOL = 2e-5;  // half-texel inset 絕對容差

function fnBody(src, fnName) {
  const i = src.indexOf(fnName + '(');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(open, k + 1); }
  }
  return src.slice(open);
}
// 去除 // 行註解（避免 regex 誤抓註解內描述烤點的 mix(...)，如 H2 註解 mix(-1.75,0.69,...)）
function stripLineComments(src) {
  return src ? src.replace(/\/\/[^\n]*/g, '') : src;
}
// 取函式 localUv01 區塊內前兩個 mix(a,b,...) → [[au,bu],[av,bv]]
function glslMixPairs(body) {
  if (!body) return null;
  body = stripLineComments(body);
  const re = /mix\(\s*([0-9.eE+-]+)\s*,\s*([0-9.eE+-]+)\s*,/g;
  const out = []; let m;
  while ((m = re.exec(body)) && out.length < 2) out.push([parseFloat(m[1]), parseFloat(m[2])]);
  return out.length === 2 ? out : null;
}
// JS r7310C1XatlasFullNorthWallUvFromWorldPosition：u:(A*(1-y01))+(B*y01)、v:(C*(1-x01))+(D*x01) → [[A,B],[C,D]]
function jsMixPairs(body) {
  if (!body) return null;
  const re = /\(\s*([0-9.eE+-]+)\s*\*\s*\(1\s*-\s*\w+\)\)\s*\+\s*\(\s*([0-9.eE+-]+)\s*\*\s*\w+\)/g;
  const out = []; let m;
  while ((m = re.exec(body)) && out.length < 2) out.push([parseFloat(m[1]), parseFloat(m[2])]);
  return out.length === 2 ? out : null;
}
function insetOf(pair, dim) {
  // pair=[a,b]；flipped=a>b。回 {flip, inset, expectInset}
  const flip = pair[0] > pair[1];
  const lo = Math.min(pair[0], pair[1]);
  return { flip, inset: lo, expectInset: 0.5 / dim };
}

let anyFail = false;
const lines = [];
for (const s of SPEC.surfaces) {
  const tag = s.surfaceName + ' (' + s.masterRectKey + ')';
  const uLen = Math.abs(s.u.max - s.u.min), vLen = Math.abs(s.v.max - s.v.min);
  const probs = [], notes = [];

  // (1) 每軸密度（獨立：atlasDim ÷ worldLen ≈ 800；轉置即不成立）
  const du = s.atlasW / uLen, dv = s.atlasH / vLen;
  if (Math.abs(du - TEX) > DENSITY_TOL) probs.push(`u 密度 ${du.toFixed(2)} 偏離 ${TEX}（atlasW ${s.atlasW} ÷ ${s.u.axis}Len ${uLen}）`);
  if (Math.abs(dv - TEX) > DENSITY_TOL) probs.push(`v 密度 ${dv.toFixed(2)} 偏離 ${TEX}（atlasH ${s.atlasH} ÷ ${s.v.axis}Len ${vLen}）`);

  // (2) aspect（獨立：atlas 長寬比 vs 世界長寬比；抓軸轉置）
  const atlasAspect = s.atlasW / s.atlasH, worldAspect = uLen / vLen;
  if (Math.abs(atlasAspect - worldAspect) / worldAspect > ASPECT_REL_TOL)
    probs.push(`aspect atlas ${atlasAspect.toFixed(4)} vs world ${worldAspect.toFixed(4)} 超容差（軸可能轉置）`);

  // (3) package targetAtlasWidth/Height == spec atlasW/H
  if (s.packageRaw) {
    const pp = join(ROOT, s.packageRaw);
    if (!existsSync(pp)) probs.push(`package 不存在 ${s.packageRaw}`);
    else {
      const pj = JSON.parse(readFileSync(pp, 'utf8'));
      if (Math.trunc(pj.targetAtlasWidth) !== s.atlasW || Math.trunc(pj.targetAtlasHeight) !== s.atlasH)
        probs.push(`package 尺寸 ${pj.targetAtlasWidth}x${pj.targetAtlasHeight} != spec ${s.atlasW}x${s.atlasH}`);
    }
  }

  // west（runtime UV 未接）→ PENDING expected-missing，非 FAIL
  if (!s.runtimeUvPresent) {
    const body = fnBody(GLSL, s.glslUvFn);
    lines.push(`PENDING ${tag}：runtime UV 未接（expected-missing）；glslUvFn ${s.glslUvFn} ${body ? '已存在' : '尚未建立'}；待 2B-2 接 west 後須轉 PASS` + (probs.length ? `；幾何預檢問題：${probs.join('；')}` : '；幾何預檢 OK'));
    continue;
  }

  // (4) GLSL inset + flip（hasInset 面）vs spec.flip 與 0.5/dim
  if (s.hasInset) {
    const pairs = glslMixPairs(fnBody(GLSL, s.glslUvFn));
    if (!pairs) probs.push(`無法解析 GLSL ${s.glslUvFn} 的 mix 常數`);
    else {
      const iu = insetOf(pairs[0], s.atlasW), iv = insetOf(pairs[1], s.atlasH);
      if (Math.abs(iu.inset - iu.expectInset) > INSET_ABS_TOL) probs.push(`u inset ${iu.inset} != 0.5/${s.atlasW}=${iu.expectInset.toFixed(8)}`);
      if (Math.abs(iv.inset - iv.expectInset) > INSET_ABS_TOL) probs.push(`v inset ${iv.inset} != 0.5/${s.atlasH}=${iv.expectInset.toFixed(8)}`);
      if (s.u.flip !== 'pending' && iu.flip !== s.u.flip) probs.push(`u flip GLSL=${iu.flip} != spec=${s.u.flip}`);
      if (s.v.flip !== 'pending' && iv.flip !== s.v.flip) probs.push(`v flip GLSL=${iv.flip} != spec=${s.v.flip}`);
      notes.push(`GLSL inset u=${iu.inset.toExponential(3)} v=${iv.inset.toExponential(3)} flip(u,v)=(${iu.flip},${iv.flip})`);

      // (5) JS InitCommon 雙抄一致（目前僅北牆有 JS 複本）
      if (s.jsUvFn) {
        const jp = jsMixPairs(fnBody(INIT, s.jsUvFn));
        if (!jp) probs.push(`無法解析 JS ${s.jsUvFn} 的常數`);
        else {
          for (let k = 0; k < 2; k++)
            for (let e = 0; e < 2; e++)
              if (Math.abs(jp[k][e] - pairs[k][e]) > 1e-12)
                probs.push(`JS/GLSL ${k === 0 ? 'u' : 'v'} 常數[${e}] 不一致 JS=${jp[k][e]} GLSL=${pairs[k][e]}`);
          if (probs.every(p => !p.startsWith('JS/GLSL'))) notes.push('JS↔GLSL 北牆常數逐位元一致');
        }
      }
    }
  } else {
    // floor/H2：原生 planar、不應帶 inset。確認 GLSL 該函式 localUv01 為 raw（無 mix inset）
    const pairs = glslMixPairs(fnBody(GLSL, s.glslUvFn));
    if (pairs) notes.push(`提示：${s.glslUvFn} 出現 mix 常數，請確認非 inset（direct planar 面預期無 inset）`);
    else notes.push('direct planar（無 inset），符合預期');
  }

  if (probs.length) { anyFail = true; lines.push(`FAIL ${tag}：${probs.join('；')}`); }
  else lines.push(`PASS ${tag}：密度 u=${du.toFixed(2)} v=${dv.toFixed(2)}；aspect atlas=${atlasAspect.toFixed(4)} world=${worldAspect.toFixed(4)}` + (notes.length ? `；${notes.join('；')}` : ''));
}

console.log('R7-3.10 I4 UV↔bake 往返／軸向一致性檢查（標準答案＝獨立 axis spec）');
console.log('--------------------------------------------------------------');
for (const l of lines) console.log(l);
console.log('--------------------------------------------------------------');
var pendingCount = lines.filter(l => l.startsWith('PENDING')).length;
console.log(anyFail ? 'RESULT: FAIL（見上）' : ('RESULT: PASS' + (pendingCount ? '（含 ' + pendingCount + ' 個 PENDING：runtime UV 未接面）' : '（六面含 west 全 PASS；west runtime UV 已接、flip 方向待 2C/RAW 肉眼定案）')));
process.exit(anyFail ? 1 : 0);
