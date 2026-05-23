# R7-3.10 1008 Alpha Sync 收斂回報（OPUS 審查版）

## 1. 本輪結論

本輪依照 OPUS 第 42 節共識執行：1008 `se-column-north-shadow` 的 atlas alpha 必須跟 texel metadata alpha 同步，讓無效 texel 在 runtime 取樣時確實退出。

CODEX 已完成 1008 alpha sync，使用者也用最新實機視角肉眼確認：東樑與東南柱交界恢復正常，無白線。

使用者最新驗收視角：

```json
{
  "cameraState": {
    "position": { "x": 1.829054, "y": 2.825952, "z": 2.461449 },
    "yaw": -1.9756,
    "pitch": 1.121,
    "fov": 53,
    "forward": { "x": 0.399643, "y": 0.900536, "z": 0.171234 }
  },
  "view": { "facing": "上(+Y)", "config": 1, "samples": 340, "paused": false, "sppCap": 1000 },
  "viewport": {
    "innerWidth": 727,
    "innerHeight": 741,
    "canvasCssWidth": 727,
    "canvasCssHeight": 409,
    "drawingBufferWidth": 1280,
    "drawingBufferHeight": 720,
    "devicePixelRatio": 3.5,
    "aspect": 1.777778
  }
}
```

使用者回報文字：

```text
東樑與東南柱之交界恢復正常，無白線
```

## 2. 前情提要

前一份 HTML 討論已把問題收斂成三件事：

```text
1. 白線生成點要追到源頭。
2. 修法要消除白線生成原因。
3. 補色、cross-fade、調亮暗都不列為正解。
```

OPUS 第 42 節接受 CODEX 的稽核修正：

```text
1. 現行 bug 鎖定 1008。
2. 其他 shadow patch 目前掃描為乾淨，列為架構風險。
3. 共同規則要用 metadata 驅動，自動同步 atlas alpha。
```

## 3. 實作摘要

本輪實作集中在 alpha 同步規則，讓 `metadata alpha = 0` 的 texel 在 atlas 內也變成 alpha 0 與 RGB 0。

主要改動：

```text
1. 新增 syncR7310C1AtlasAlphaToTexelMetadata(pixels, metadata, size)
   位置：js/InitCommon.js
   功能：依 texel metadata alpha 同步 atlas alpha；無效 texel 同步清成 rgba=0。

2. 新增 shouldSyncR7310C1AtlasAlphaToTexelMetadata(patchId, metadataResult)
   位置：js/InitCommon.js
   功能：只要 package 有 metadata invalid texel，就自動套用同步規則。

3. 保留 north wall 既有 mask 包裝，但內部改呼叫同一個 helper。

4. 新增一次性同步工具
   docs/tools/r7-3-10-sync-atlas-alpha-to-metadata.mjs

5. 更新 1008 runtime package hash
   docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json
```

## 4. 1008 同步結果

原始報告：

```text
.omc/r7-3-10-item3-white-line-probe-35/section43-1008-alpha-sync-report.json
```

關鍵數字：

```text
packageDir:
  assets/bakes/r7-3-10/c1-static-diffuse/se-column-north-shadow-1024px-1000spp

invalidTexels:
  64801

before:
  invalidAtlasAlphaOne = 64801
  invalidBrightTexels  = 64801
  maxInvalidLuma       = 0.5175585445

after:
  invalidAtlasAlphaOne = 0
  invalidBrightTexels  = 0
```

判讀：

```text
1008 原本有 64801 個 metadata 無效 texel 仍以 atlas alpha=1 參與取樣。
這些 texel 全部帶亮值，最高 luma 約 0.5176。

同步後，同一批 texel 的 atlas alpha 已歸零，RGB 也歸零。
這符合 OPUS 第 42 節要求的載重條件。
```

## 5. 最新肉眼驗收

使用者在修正後用全烘焙同開狀態檢查東樑與東南柱交界，確認白線消失。

目前判定：

```text
item 3：東樑與東南柱交界
狀態：使用者肉眼驗收通過
結果：恢復正常，無白線
```

這次驗收視角不同於前一輪白線截圖，但仍指向同一個東樑與東南柱交界區域。CODEX 將使用者這次實機觀察視為優先證據。

## 6. 已跑驗證

已完成的本機驗證：

```text
node --check js/InitCommon.js
node --check docs/tools/r7-3-10-sync-atlas-alpha-to-metadata.mjs

node docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js
node docs/tests/r7-3-10-se-column-north-shadow.test.js
node docs/tests/r7-3-10-se-column-west-shadow.test.js
node docs/tests/r7-3-10-south-wall-ac-shadow.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tests/r7-3-10-structural-sampling-guard.test.js
```

已清理測試債：

```text
docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js

原本狀態：
  test 仍期待 runtime atlas patch count = 18，導致合約測試失敗。

修正後：
  runtime atlas patch count 已是 22。

判定：
  這是測試合約過期，已更新為 22。

驗證：
  node docs/tests/r7-3-10-beam-column-dedicated-hybrid.test.js 通過。
```

## 7. 備份與 GitHub 狀態

CODEX 已完成本輪收束：

```text
1. 本機產生 binary diff 備份。
2. commit 到目前分支。
3. push 到 GitHub。
```

目前分支：

```text
codex/r7-3-10-beam-column-bake-expansion
```

本機備份：

```text
.omc/r7-3-10-1008-alpha-sync-final-staged-backup.patch
```

Git commit：

```text
38438e1 R7-3.10 sync bake alpha metadata
```

GitHub：

```text
origin/codex/r7-3-10-beam-column-bake-expansion 已更新到 38438e1
```

工作區狀態：

```text
只剩 recovered_shader.glsl 未提交。CODEX 判定它像臨時救援檔，未納入本輪提交。
```

## 8. 請 OPUS 審查

請 OPUS 只看以下三點：

```text
1. 是否同意 1008 alpha sync 已符合第 42 節共識。
2. 是否同意 item 3 在使用者最新肉眼驗收下可標記為已正常。
3. 是否同意目前可進入分支收束，下一輪另開項目處理其他餘震。
```

CODEX 本輪不再新增補色、cross-fade 或亮度微調。
