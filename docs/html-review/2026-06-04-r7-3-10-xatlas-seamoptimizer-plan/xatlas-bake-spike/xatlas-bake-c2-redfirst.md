# C2 xatlas bake mode red-first handoff（2026-06-04 修正版）

## 結論

C2 尚未核准進 C3。

CODEX 已完成 xatlas bake mode 的基本接線、WebGL2 float texture 預檢、Chrome Metal smoke、以及 A1 數值抽驗；結果是：

```text
北牆 A1 wall texel：有 GI 值。
西樑 A1 beamEndContact texel：仍為 0。
```

2026-06-04 修正判讀：

```text
西樑 A1 beamEndContact texel 是西樑北端接觸面。
它是西樑北端接觸面，屬建築內部 hiddenContact。
它為黑本身不構成 C2 失敗。
真正要查的是 hiddenContact 黑值有沒有污染可見北牆邊緣。
```

## 已驗證成功的部分

```text
1. C1 起點仍有效：
   - atlas：946 × 516
   - validTexels：356029
   - dilationTexels：47752
   - A1 wall：45978 texel
   - A1 beamEndContact：2464 texel

2. C2 data texture 路徑可用：
   - worldPos：RGBA32F
   - normal：RGBA32F
   - tri/valid：CPU metadata
   - xatlas mode 重用既有 sampler slot，避免 Metal texture unit 超限。

3. shader / JS / runner contract 已過：
   - r7-3-10-xatlas-bake-mode-contract OK
   - Home_Studio.js node --check OK
   - InitCommon.js node --check OK
   - r7-3-8-c1-bake-capture-runner.mjs node --check OK

4. 既有 bake / package contract 已過：
   - r7-3-8-c1-1000spp-bake-capture.test.js PASS
   - r7-3-10-non-square-data-path.test.js PASS
   - r7-3-10-xatlas-bake-texelmap.test.py PASS
```

## C2 smoke 實測

最新 smoke package：

```text
.omc/r7-3-10-xatlas-bake-spike/20260604-224556
```

指令：

```text
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  --r7310-xatlas-bake
  --smoke-test
  --samples=16
  --target-samples=16
  --timeout-ms=420000
  --http-port=9026
  --cdp-port=9335
  --angle=metal
  --browser=chrome
  --throwaway-package
  --r7310-bake-diagnostics
  --r7310-bake-submission-boundary=fence
  --r7310-bake-submission-every-samples=4
  --r7310-bake-tile-width=512
  --r7310-bake-tile-height=512
```

runner 結果：

```text
browserValidationStatus：pass
contextLostCount：0
runnerFailedChecks：gpu-submission-ms-over-250
```

`gpu-submission-ms-over-250` 是效能門檻。本次 C2 的主要發現是：

```text
wall 有值。
beamEndContact 為黑。
舊 PASS 條件把 hiddenContact 也列為必須有 GI，判讀方向需要修正。
```

## A1 數值

以 `xatlas-bake-tri-valid-rgba32f.bin` 對最新 smoke atlas 分組讀取：

```text
all [tri 10,11,20,21]
  count 48442
  nz    24606
  mean  0.19074243074300345
  max   1.2428116740226745
  alpha 38004

wall [tri 10,11]
  count 45978
  nz    24606
  mean  0.20096447931733813
  max   1.2428116740226745
  alpha 36084

beamEndContact [tri 20,21]
  count 2464
  nz    0
  mean  0
  max   0
  alpha 1920
```

上下翻列後重新分組，beamEndContact 仍為 0：

```text
flipTriY=true

wall
  count 45978
  nz    33201
  mean  0.45211849005316523
  max   1.3282715796947477
  alpha 45978

beamEndContact
  count 2464
  nz    0
  mean  0
  max   0
  alpha 2464
```

因此 beamEndContact=0 已排除列方向讀錯。

## CODEX 已試過的三個修法

```text
1. C1 normal 改成 room-boundary inward bake normal：
   - box 28 -Z rawNormal = (0,0,-1)
   - bakeNormal = (0,0,1)
   - 測試 PASS
   - C2 beamEndContact 仍為 0

2. xatlas 增加 per-surface 同型 first-hit diffuse bounce：
   - contract PASS
   - C2 beamEndContact 仍為 0

3. xatlas 改成 surface-seeded GI：
   - 不先依賴場景第一命中
   - 從 worldPos + bakeNormal 直接發出 cosine-weighted ray
   - contract PASS
   - C2 beamEndContact 仍為 0
```

## 目前根因判斷

目前證據指向：

```text
beamEndContact tri 20/21 是 box 28 的 -Z 接觸面。
它在 xatlas coverage 裡有 UV，也有 valid texel。
它屬於建築內部接觸面，缺少可從房間側正常 trace 的外露表面條件。
```

具體說：

```text
box 28 範圍：
  x [-1.91, -1.75]
  y [2.525, 2.905]
  z [-1.874, 2.848]

A1 beamEndContact：
  z = -1.874
  raw normal = -Z
  C1 為了房間側採樣把 bake normal 改成 +Z

但 +Z 方向會進入 box 28 體積內部。
所以 beamEndContact texel 雖然有 UV，真正 trace GI 時仍沒有形成有效的房間側 radiance。
```

這表示第 6 章的 coverage PASS 與第 7 章 C2 的 bake PASS 屬於兩個不同門檻：

```text
coverage PASS：xatlas 能給 beamEndContact chart / UV / texel。
bake 需要新政策：beamEndContact chart 對應的幾何是 hiddenContact，不應列為獨立 GI 必填。
```

## 需要 OPUS 審查的決策點

```text
1. C2 是否接受「A1 beamEndContact 是 hiddenContact，不要求自己有獨立 GI」？

2. 若接受，§7.6.1 的 PASS 定義已改成：
   - wall[10,11] 必須有 baked 值。
   - beamEndContact[20,21] 可標 hiddenContact。
   - hiddenContact 黑值不得污染可見北牆邊緣。

3. 下一版 C2 需要新增分類診斷：
   - visibleEdgeEmpty
   - paddingBleed
   - lookupWrongOwner
   - routeNone

4. C2 現階段不可進 C3。
```

## CODEX 建議

CODEX 建議停在 C2，請 OPUS 審查 `source.md` 第 9 章後裁示。

目前看起來，xatlas coverage spike 把「能不能取得 UV」證明成功；C2 bake spike 揭露了下一個真問題：

```text
chart texel 需要分成可見表面與 hiddenContact。
hiddenContact 需要隔離規則與污染檢查。
```

這個政策要先定義，再繼續 C2。
