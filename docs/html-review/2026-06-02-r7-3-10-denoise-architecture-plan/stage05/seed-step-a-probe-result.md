# Stage 0.5 Seed → Shader RNG Step A Probe Result

日期：2026-06-03  
執行者：CODEX（OPUS 額度用盡後接手）  
分支：codex/r7-3-10-north-wall-denoise-oidn

## 結論

```text
Step A：PASS

判定：
  1. 改前基準、改後不帶 seed query、改後 seed=0x0 三者 SHA 完全相同。
  2. 同一非零 seed=0x12345678 兩跑 SHA 完全相同。
  3. 不同非零 seed=0xCAFEBABE 與 seed=0x12345678 SHA 不同。

結論：
  seed=0 中性成立。
  同一非零 seed 具備 bit-exact 重現性。
  不同非零 seed 已改變 shader RNG 序列。
  可進 Step B：5×10000 SPP raw atlas 夜烤。
```

## Probe 設定

```text
surface：north-wall
atlas：64×64
samples：16
targetSamples：16
ANGLE：Metal
browser：Google Chrome
tile / fence：
  --r7310-bake-submission-boundary=fence
  --r7310-bake-submission-every-samples=4
  --r7310-bake-tile-width=64
  --r7310-bake-tile-height=64

說明：
  runner status=fail 是因為 16 samples 低於正式驗證門檻 rawSamples / atlasSamples / patchSamples。
  本探針只採 atlas-patch-000-rgba-f32.bin SHA-256 判斷 RNG 接線。
  每輪 bakeDiagnostics contextLostCount=0、completedTiles=1、minCompletedSamples=16。
```

## SHA 對照

```text
1. 改前基準（commit d667ec8，/private/tmp/home-studio-seed-baseline）
   package：
     /private/tmp/home-studio-seed-baseline/.omc/r7-3-10-full-room-diffuse-bake/20260603-005411
   SHA：
     fee662b80ccca82737454c716edefdcfec590fb1424b56be4afaf0d893dd883b

2. 改後，不帶 seed query
   package：
     .omc/r7-3-10-full-room-diffuse-bake/20260603-005440
   SHA：
     fee662b80ccca82737454c716edefdcfec590fb1424b56be4afaf0d893dd883b

3. 改後，seed=0x0
   package：
     .omc/r7-3-10-full-room-diffuse-bake/20260603-005459
   SHA：
     fee662b80ccca82737454c716edefdcfec590fb1424b56be4afaf0d893dd883b

4. 改後，seed=0x12345678 第一跑
   package：
     .omc/r7-3-10-full-room-diffuse-bake/20260603-005529
   SHA：
     b4b87e8e443ccf8aa9dcc437ff2ac4682a14a86b27bbbb3a7874c9a36f796ca5

5. 改後，seed=0x12345678 第二跑
   package：
     .omc/r7-3-10-full-room-diffuse-bake/20260603-005547
   SHA：
     b4b87e8e443ccf8aa9dcc437ff2ac4682a14a86b27bbbb3a7874c9a36f796ca5

6. 改後，seed=0xCAFEBABE
   package：
     .omc/r7-3-10-full-room-diffuse-bake/20260603-005606
   SHA：
     36f4c31682e6657f71a296aa6203848bbefc01a82830d673e8bb0352f6fd9b30
```

## 驗證命令摘要

```text
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check js/Home_Studio.js
node --check js/PathTracingCommon.js

shasum -a 256 \
  /private/tmp/home-studio-seed-baseline/.omc/r7-3-10-full-room-diffuse-bake/20260603-005411/atlas-patch-000-rgba-f32.bin \
  .omc/r7-3-10-full-room-diffuse-bake/20260603-005440/atlas-patch-000-rgba-f32.bin \
  .omc/r7-3-10-full-room-diffuse-bake/20260603-005459/atlas-patch-000-rgba-f32.bin \
  .omc/r7-3-10-full-room-diffuse-bake/20260603-005529/atlas-patch-000-rgba-f32.bin \
  .omc/r7-3-10-full-room-diffuse-bake/20260603-005547/atlas-patch-000-rgba-f32.bin \
  .omc/r7-3-10-full-room-diffuse-bake/20260603-005606/atlas-patch-000-rgba-f32.bin
```

## Step B 前提

```text
Step B seed 清單：
  0x0
  0xCAFEBABE
  0x12345678
  0x87654321
  0xFEEDFACE

SPP：
  10000

注意：
  seed_0=0x0 也需重烤。
  20260602-015822 是 Stage 0 raw 1000 SPP input，不作為 Stage 0.5 raw 10000 SPP 樣本。
```
