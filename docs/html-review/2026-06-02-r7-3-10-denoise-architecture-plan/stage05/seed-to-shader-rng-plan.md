# Seed → Shader RNG 接線小型 plan（Stage 0.5 前置、交 CODEX 審）

OPUS 動工提案、CODEX 審查；2026-06-03 OPUS 額度用盡後由 CODEX 接手修訂。**本 plan 核准前不改 PathTracingCommon.js**（CODEX 裁示）。

## §0 背景與範圍

```text
Stage 0.5 noise floor 校準（plan §S05）需 N=5 個「不同 RNG seed」的 10000 SPP raw atlas
（CODEX 裁示：SPP 採 §S05.2 = 10000、前述 1000 為口誤）。
現況：shader RNG 無外部 seed 入口、5 個 seed 會烤出 bit-exact 相同 atlas、校準無意義。
本 plan 設計 seed → shader RNG 接線、限定影響面、定中性 seed 規則。
```

## §1 現有 RNG 入口清單（研究結果、read-only 確認）

```text
全部在 js/PathTracingCommon.js（erichlof 框架共用 RNG chunk、#include <pathtracing_random_functions>）：

rand()（L3078、Jacco Bikker）：
  randNumber += (blueNoise + mod(uFrameCounter,32)*0.618); return fract(randNumber)
  種子源 = blueNoise（L3258 texelFetch tBlueNoiseTexture, gl_FragCoord%128）+ uFrameCounter

rng()（L3089、iq PCG-like、BSDF 採樣主路徑）：
  seed += uvec2(1); 1103515245U hash
  種子源 = 全域 uvec2 seed（L3260 = uvec2(uFrameCounter, uFrameCounter+1) × uvec2(gl_FragCoord)）
  rng() 被 randomCosWeightedDirectionInHemisphere / randomSphereDirection / 等 BSDF 採樣呼叫

r71BlueNoiseSeedJitter()（L3097、僅 uR71BlueNoiseSamplingMode 啟用時）：
  uSampleCounter + uFrameCounter + fragCoord + blueNoise

初始化在 main()（L3248）內、每 pixel 每 frame 一次：
  L3258 blueNoise 初始化、L3260 seed 初始化

runner 現有 --seed（ADR 1）：
  --seed → URL ?seed=（L1604）；但頁面未讀（ADR 3 只接 outputMode）
  deterministicRandomPair（L3036）→ 只 set uRandomVec2（L3088）→ 只用於 L3275 pixelOffset
  → 現有 seed 只管「相機 pixel jitter tent filter」、完全不碰 rng()/rand() 的 BSDF 隨機
```

## §2 接線設計（最小、限定影響面）

```text
新增 uniform（必修 4：Three.js 規格、無 GLSL uint/uvec 先例）：
  研究確認：專案 shader uniform 全 float/int/vec/sampler、無 uint/uvec 先例（Uint32Array 僅 JS 端 L490）。
  → 用 vec2 float 傳（vec2 有先例 uRandomVec2）、避開無先例的 uint uniform Three.js 相容風險。
  Three.js 宣告（js/Home_Studio.js）：
    pathTracingUniforms.uR7310C1RngSeed = { value: new THREE.Vector2(0, 0) };  // 預設 (0,0) = 中性
  seed 32-bit 拆 hi16 / lo16（各 0..65535、32-bit float 可精確表示 < 2^24 整數、無精度損失）：
    value.x = (seed >>> 16) & 0xFFFF;  value.y = seed & 0xFFFF;
  shader 宣告（PathTracingCommon.js）：uniform vec2 uR7310C1RngSeed;   // 預設 (0,0)
  shader 重組 32-bit uint：
    uint rngSeed32 = (uint(uR7310C1RngSeed.x) << 16U) | uint(uR7310C1RngSeed.y);

runner URL seed 規則（必修 1：守住「不傳 seed 完全不變」、採 CODEX B 方案）：
  現況問題：runner args.seed 預設 0xDEADBEEF（L87）、URL L1605 無條件寫 seed=${args.seed}；
    shader 一旦接 ?seed=、既有 bake（未傳 --seed）也變非零 seed、結果改變。
  修正：
    runner args.seed 預設改 null（非 0xDEADBEEF）、parseArgs 區分「使用者明確傳 --seed」。
    URL adrExtensionsQuery 只在 args.seed !== null 時才寫 seed=；未傳 → URL 無 ?seed= → 頁面維持 (0,0)。
    seed 驗證（L194）改為「若有傳才驗 0x hex」。
    Stage 0.5 / Stage 1 需要時再明確 --seed=0x...。

URL → uniform（js/Home_Studio.js 讀 ?seed=、補 ADR 3 漏接）：
  有 ?seed=0x... → 解析 32-bit → 拆 hi16/lo16 → uR7310C1RngSeed.value.set(hi, lo)
  無 ?seed= 或解析失敗 → 維持 (0,0)（中性、見 §3）

seed 混入點（PathTracingCommon.js main() 內、L3260 之後）：
  rng() 路徑（BSDF 主隨機）：
    seed = (uvec2(uFrameCounter, uFrameCounter+1.0) * uvec2(gl_FragCoord)) ^ uvec2(rngSeed32, rngSeed32 * 2654435761U);
  rand() 路徑：
    randNumber 初值混入 rngSeed32：
      randMix = (rngSeed32 ^ (rngSeed32 >> 16U)) & 65535U
      randNumber = float(randMix) / 65536.0
    ★ 所有候選方案都必須滿足 rngSeed32 == 0 → 完全中性（^0 / +0、序列與現有 bit-exact 相同、見 §3）。
```

## §3 中性 seed 規則（CODEX 點 3 關鍵風險）

```text
uR7310C1RngSeed = vec2(0,0) → rngSeed32 = 0 → 所有混入運算還原現有：
  rng(): seed ^ uvec2(0) = seed（不變）
  rand(): randNumber 初值 +0（不變）
→ seed=0 嚴格等價「無 seed 接線」的現有行為。

驗證（§5）：改前小尺寸 probe 基準 SHA、改後不帶 seed query、改後 seed=0 三者 SHA 必須一致。
```

## §4 預設值策略

```text
runtime 渲染：頁面不帶 ?seed= → uniform 預設 vec2(0,0) → 零影響（現有渲染不變）。
既有 bake（floor / east / west / ceiling / structural / 各 shadow）：
  bake 指令不傳 --seed 或傳 seed=0 → 現有結果不變、無需重烤。
Stage 0.5：明確傳 5 個 seed（見下方 seed 清單裁示點）。

seed 清單裁示（CODEX 二審後定為 A'）：
  seed ∈ {0x0, 0xCAFEBABE, 0x12345678, 0x87654321, 0xFEEDFACE}
  seed_0=0x0 的角色是「中性基準」與「既有行為連續性」。
  20260602-015822 是 Stage 0 raw 1000 SPP input，不是 Stage 0.5 raw 10000 SPP。
  因此 Stage 0.5 仍需 5 張 raw 10000 SPP，seed_0=0x0 也要重烤。
  本輪不採 plan §15.4 原 seed_0=0xDEADBEEF，因為它會破壞中性基準。
```

## §5 bit-exact 驗證方法（工具已備）

```text
Step A probe 驗證（接線前後小尺寸、避免直接花夜烤）：
1. 改 PathTracingCommon.js 前，先跑小尺寸 / 單 tile probe，記 baseline SHA-256。
2. 改完後，同 setup 不帶 seed query → SHA 必須等於 baseline。
3. 改完後，同 setup seed=0x0 → SHA 必須等於 baseline。
4. 改完後，同一個非零 seed 兩跑 → SHA 必須一致。
5. 改完後，不同非零 seed → SHA 必須不同。

Stage 0.5 校準驗證：
1. rng-bit-exact-check.mjs：同 seed 配對一致、不同 seed 配對 fail。
2. noise-floor-calibration seed 檔 bit-exact 防呆：避免相同檔案誤當不同 seed。
3. noise-floor-calibration C(5,2)=10 配對 σ + 3σ 門檻。
```

## §6 影響範圍（CODEX 點 6）

```text
runtime 渲染：seed 預設 0、不傳 → 零影響。
既有 bake：不傳 seed → 零影響、無需重烤。
PathTracingCommon.js 共用 chunk：改 rng()/rand() 種子初始化、技術上影響整個 path tracer、
  但 seed=0 中性保證「不傳 seed 時行為完全不變」、影響僅在「明確傳非零 seed」時發生。
藍噪聲模式（uR71BlueNoiseSamplingMode、r71BlueNoiseSeedJitter）：
  Stage 0.5 bake 用標準路徑（runner --r71-blue-noise 預設 false、20260602 bake 未啟用）。
  本 plan seed 只混入 rng()/rand() 主路徑，不驗 uR71BlueNoiseSamplingMode 路徑。
  非零 seed 對藍噪聲模式的影響列 follow-up；本輪不作為 Stage 0.5 前置條件。
```

## §7 拆兩步降風險（CODEX 點 3 拆步）

```text
Step A：seed 接線最小 probe（小尺寸、快速、先驗接線正確）
  - 北牆 64×64 或單 tile、samples 少（如 16）
  - 改前先跑 baseline SHA；改後跑四條：
      (a) 不帶 seed query SHA = 改前 baseline SHA
      (b) seed=0x0 SHA = 改前 baseline SHA
      (c) 同一個非零 seed 兩跑 SHA-256 一致
      (d) 不同非零 seed SHA-256 不同
  - 四條全過 → 接線正確、中性成立、可進 Step B
  - 任一不過 → 修接線、不進 Step B

Step B：5 × 10000 SPP 夜間 bake（probe 通過後、§S05.3 排日 Day1 晚 → Day2 上午）
  - 5 個 seed（§4 A' 裁示清單）× 10000 SPP raw（不降噪）
  - seed_0=0x0 也要重烤，不使用 20260602-015822 1000 SPP input 充當校準樣本
  - noise-floor-calibration C(5,2) σ + 3σ 門檻
```

## §8 風險與緩解

```text
風險 R1：改 PathTracingCommon.js 共用 chunk、影響整個 path tracer。
  緩解：seed=0 中性（不傳 seed 行為完全不變）+ Step A probe 先驗 seed=0 與現有一致。
風險 R2：rand() 種子混入方式（randNumber 初值 vs blueNoise phase）對中性 / 不同 seed 效果待實測。
  緩解：Step A probe 實測候選混入、選「seed=0 完全中性 + 不同 seed 真不同」者。
風險 R3：uvec2 seed × gl_FragCoord 已是大數、^ uR7310C1RngSeed 可能與某 fragCoord 碰撞。
  緩解：probe (c) 驗證不同 seed SHA 不同（碰撞會被抓出）。
風險 R4：runner 預設 seed=0xDEADBEEF 會讓既有 bake 在接線後變成非零 seed。
  緩解：runner seed 預設改 null；URL 只在使用者明確傳 --seed 時帶 seed query。
```

## §9 動工順序（2026-06-03 起 CODEX 接手）

```text
1. runner seed 預設改 null；只有明確 --seed 才寫 URL seed query。
2. 加 uniform uR7310C1RngSeed（Home_Studio.js 宣告預設 new THREE.Vector2(0,0)）+ ?seed= URL 接線（補 ADR 3）。
3. PathTracingCommon.js main() 混入 seed（L3260 rng + rand 路徑、附中性註解）。
4. Step A 最小 probe 驗證四條（CODEX 接手動工，結果回對話窗給使用者確認）。
5. probe 通過 → Step B 5×10000 SPP 夜烤（排程）。
每步完成後先回報再進下一步。
```

## §10 CODEX 裁示點

```text
Q1. CODEX 裁示：選 A'，seed_0=0x0 作中性基準，其餘四個非零 seed；5 張 10000 SPP 全重烤。
Q2. CODEX 裁示：rand() 採用 16-bit fold 混入 randNumber 初值；Step A probe 必須驗 seed=0 完全中性。
Q3. CODEX 裁示：Stage 0.5 不使用藍噪聲模式，本輪不驗該路徑；列 follow-up。
Q4. CODEX 裁示：本 plan 修正後可進 §9 動工順序，但先完成 Step A probe，不直接開 5×10000 SPP。
```

## §11 CODEX 接手進度（2026-06-03）

```text
已完成 Step 1-3：
  - runner seed 預設改 null；未明確 --seed 時不寫 URL seed query。
  - Home_Studio.js 新增 ?seed=0x... → THREE.Vector2(hi16, lo16) 接線；無 query / 格式錯維持 (0,0)。
  - PathTracingCommon.js 新增 uniform vec2 uR7310C1RngSeed，混入 rand()/rng() 初始化。

已驗證：
  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  node --check js/Home_Studio.js
  node --check js/PathTracingCommon.js
  Chrome headless + Metal ANGLE page smoke：Home_Studio.html?seed=0x12345678 可載入、無 shader compile 錯誤
  Step A 64×64 / 16 samples SHA probe：PASS（見 stage05/seed-step-a-probe-result.md）

Step A 結果：
  改前基準 SHA：
    fee662b80ccca82737454c716edefdcfec590fb1424b56be4afaf0d893dd883b
  改後不帶 seed query SHA：
    fee662b80ccca82737454c716edefdcfec590fb1424b56be4afaf0d893dd883b
  改後 seed=0x0 SHA：
    fee662b80ccca82737454c716edefdcfec590fb1424b56be4afaf0d893dd883b
  改後 seed=0x12345678 兩跑 SHA：
    b4b87e8e443ccf8aa9dcc437ff2ac4682a14a86b27bbbb3a7874c9a36f796ca5
    b4b87e8e443ccf8aa9dcc437ff2ac4682a14a86b27bbbb3a7874c9a36f796ca5
  改後 seed=0xCAFEBABE SHA：
    36f4c31682e6657f71a296aa6203848bbefc01a82830d673e8bb0352f6fd9b30
  判定：
    PASS。seed=0 中性成立；同一非零 seed bit-exact；不同非零 seed 產生不同 atlas。

未完成：
  5×10000 SPP Stage 0.5 夜烤尚未執行。
```

## 對齊版本

```text
plan.md：v4 CODEX 四審核准
Stage 0：commit d667ec8（aux=β / filter=RT、OIDN 適用性核准）
Git branch：codex/r7-3-10-north-wall-denoise-oidn
RNG 入口研究：js/PathTracingCommon.js L3074-3110（rand/rng/r71）、L3248-3260（main 初始化）
```
