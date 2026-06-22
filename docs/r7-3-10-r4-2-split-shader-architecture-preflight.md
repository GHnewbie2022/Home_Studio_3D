# R7-3.10 R4-2 分桌 shader 架構 — Preflight（READ-ONLY，不改 source、不開 Chrome、不跑 GPU）

狀態：preflight / 唯讀分析。本文件只讀碼、產出分析，未改任何 source、未接 west、未進 Phase 2C、未烤任何面、未回放 stash、未 commit / push。
證據基準：HEAD `Home_Studio_Fragment.glsl` 7963 行 / 356KB、`js/PathTracingCommon.js` 116KB、`js/InitCommon.js` 718KB（行號為 HEAD 當前值）。

---

## 0. 一句話與關鍵發現

- **目標重定義**：把「萬用單顆 giant shader」轉成「正式播放 / 烘焙 / 除錯」三種**編譯變體（variant）**，讓 C1/C2 完整烘焙與顯示有編譯餘量，後續物件也有空間。
- **關鍵發現 1（基礎設施已存在）**：JS 端「第二顆材質 + defines 切變體」的框架**已經存在**，不是缺框架，是內容未分。
  - `r7310BakeOnlyNoBorrowMaterial`（`InitCommon.js:277-285`）已是一顆獨立材質，且帶 `defines: { R7310_BAKE_ONLY_NO_BORROW: 1 }`（`:280`），lazy getter（`:273` 先查再建）。
  - three.js `ShaderMaterial.defines` 會在編譯前以 `#define` 注入 GLSL，等同 Unity 的 shader keyword / variant：被 `#ifndef` 排除的區塊在**預處理階段就被移除、不進編譯**，直接減少該 program 的編譯體積。
- **關鍵發現 2（分桌方式應為「單源 + #ifdef 變體」而非「三份 source」）**：維護三份各自的 `.glsl` 會踩 CLAUDE.md 明列的「reuse-by-appearance / 契約漂移」地雷（取樣器與 atlas 契約必須跨變體一致）。正解是**一份正則 source，用 `#ifdef` 標記 probe / bake 區塊，由 material 的 defines 選變體**，與既有 `defines` 基礎設施對齊。
- **關鍵發現 3（debug 面其實是兩個家族，且其一深度交織）**：
  - 家族 A — R7-3.10 atlas probe（`uR7310C1RuntimeProbeMode`）：23 塊，多為獨立 `if{...break;}`，**可乾淨抽離**（即 clean-all 已驗證的集合，R1 PASS_FULL）。
  - 家族 B — R3 雲朵燈 NEE/MIS probe（`uCloudMisWeightProbeMode` / `uCloudContributionProbeMode` / `uCloudVisibilityProbeMode`）：helper 在 `374-455`、`3849-3910`、`4145-4321`，且注入點**交織在正式 NEE 積分器內**（`5177-6317` 散布大量 `if (uCloudMisWeightProbeMode > 0) { break; }` 與 contribution 改寫）→ **無法當作獨立區塊整塊搬走，需逐點 `#ifdef` 包裹**，風險高於家族 A。
- **餘量現實**：clean-all（約 42KB＝家族 A + bake-capture 閘區）讓 west-U1 過、west-S5（完整）仍 LOSS。故第一個變體（≈ clean-all 移除集）預期讓 U1 過、完整 west 仍可能 LOSS；**家族 B 的 `#ifdef` 剝離是下一個主要餘量槓桿**；若連家族 B 都剝完仍 LOSS → 觸發第 9 節升級評估。

---

## 1. 現在 `Home_Studio_Fragment.glsl` 的責任區（cross-cut，非線性分段）

責任不是按行段切齊的，是**橫切**的；同一個函式區可能同時含正式與 debug。下表按「責任歸屬」分類，行號為證據錨點。

| 區塊 | 行號（HEAD） | 責任歸屬 | 備註 |
|---|---|---|---|
| precision / struct / uniform 宣告 | 1–260 | 共用 | 未用到的 bake/probe uniform 由 DCE 處理；宣告本身成本低 |
| cloud MIS/contribution/visibility probe helpers | 374–455 | **debug 家族 B**（混入正式 NEE 述詞） | `cloudMisWeightProbe*`/`cloudVisibilityProbe*`=debug；`cloudDirectNeeSourceIs*`/`cloudVisibleSurfaceIs*`=正式與 probe 共用 |
| cloud probe match / darkfill / forcedBsdfHit | 3849–3910 | **debug 家族 B**（含部分正式 darkfill） | `cloudSameSurfaceDarkFillContribution` 等需確認是否正式路徑也呼叫 |
| pdfNeeForLight / sampleActiveLightSlot / activeLightPickPdf | 3912–3964 | **runtime 必留**（正式 NEE 基礎） | |
| cloud 燈幾何（out/long/cross/arc/theta importance） | 3966–4144 | **runtime 必留**（雲朵燈是真實燈具） | 幾何屬正式；其中 `cloudThetaImportance*` 為 NEE 重要度抽樣，正式需要 |
| cloud visibility probe 顏色/分類 helpers | 4145–4321 | **debug 家族 B** | `cloudVisibilityProbe*Color`/`Matches`/`BlockerClass` |
| sampleStochasticLightDynamic | 4332–4483 | **runtime 必留**（正式 NEE 核心） | 但其 5xxx 呼叫點被 probe break/contribution 包夾 |
| 交集原語（Cylinder/Stadium/CylinderSegment/CloudArc） | 4154–4658 | **runtime 必留**（正式幾何） | |
| BVH fetch / cull（fetchBVHNode/fetchBoxData/isBoxCulled） | 4660–4828 | **runtime 必留** | |
| SceneIntersect | 4829–5134 | **runtime 必留** | |
| CalculateMovementPreview | 5135–5169 | **runtime 必留**（移動預覽算圖） | |
| CalculateRadiance（積分器主體） | 5170–7940 | **混合**（見 §1.1） | 909 行內同時含正式積分、家族 A probe、家族 B probe、bake-capture |
| SetupScene | 7941–7963 | **runtime 必留** | |

### 1.1 CalculateRadiance 內部再細分

| 子區 | 行號（HEAD 錨點） | 歸屬 |
|---|---|---|
| 正式積分器 + NEE 主迴圈 | 5170–7940 骨幹 | runtime 必留 |
| R3 雲朵 probe 注入（交織） | 5177、5181、5296–5301、5401–5435、5594–5634、6201–6317 等 | **debug 家族 B（交織，逐點 #ifdef）** |
| bake-capture 區塊 | 5183、5205、5271–5301、5343–5362、6502、6514、6535、6546、7760 | **bake-only** |
| R7-3.10 atlas runtime probe（clean-all 23 塊） | 6512、6536、6547、6601、6658、6732、6773、6860、6956、7060、7121、7200、7208、7244、7325、7378–7460 | **debug 家族 A（可乾淨抽離）** |
| atlas runtime 取樣 fanout（正式上架顯示） | dispatcher + SampleValidLinear + SampleTexel + FirstHit inject + ShortCircuit `accumCol += mask * r7310BakedRadiance`(7461) + hybrid deferral | **runtime 必留** |
| sprout paste probe | 7877–7898 | **debug 家族 C（雜項）** |

家族 C 雜項 probe：`uR73GikWallProbeMode`（`5401`）、`uR738C1SproutPasteProbeMode`（`7877`）、`uR3ProbeSentinel`、`uCloudVisibilityProbeRod/Class/ThetaBin`。

---

## 2. 哪些屬 runtime 必留（正式播放 shader）

正式播放只需要「把已上架 package 畫出來」的最小集合：

```
· precision / struct / 場景 uniform
· BVH fetch/cull + SceneIntersect + 交集原語（Cylinder/Stadium/CylinderSegment/CloudArc）
· 正式 NEE：sampleStochasticLightDynamic + pdfNeeForLight + sampleActiveLightSlot + activeLightPickPdf
· cloud 燈幾何 + theta importance（雲朵燈是真實燈具，顯示需要；只去掉其 probe 顏色/分類）
· CalculateRadiance 正式積分器路徑
· atlas runtime 取樣 fanout：
    uR7310C1XatlasRuntimeMode/Ready/AtlasSize + RectCeiling/North/East/DepthH2/Floor(+未來各面)
    dispatcher r7310C1XatlasNorthWallUv → 各面 UV 函式 → SampleValidLinear → SampleTexel → texelFetch(tR738C1BakeAtlasTexture)
    FirstHit 注入（mask * radiance，含 SeparatedAlbedo 分支）+ ShortCircuit(7461) + hybrid deferral
· CalculateMovementPreview、SetupScene
· main()/ray-gen（PathTracingCommon.js，相機分支）
· context-loss fail-safe 所需最小支援（純 JS，不在 glsl）
```

---

## 3. 哪些屬 bake-only（可搬到 bake 變體）

bake 變體 = runtime 必留核心 + 下列 bake 專屬；**bake 變體可以肥**，因為它只在 bake runner 內被實例化、編譯一次、不在使用者頁面常駐。

```
GLSL（Home_Studio_Fragment.glsl）：
  · CalculateRadiance 內 bake-capture 區塊（5183/5205/5271/5343/6502/6514/6535/6546/7760）
  · bake 表面點函式 r7310C1BakeSurfacePoint / r738C1BakeSurfacePoint（main 呼叫）
  · bake uniform：uR7310C1XatlasBakeMode、uR7310C1XatlasBakeAtlasSize、uR7310C1SeparatedBakeMode、
                  uR738C1BakeCaptureMode/PatchId/PatchResolution/TileOriginPx/FullAtlasResolution/PatchWorldBounds、
                  uR7310C1BakeFloorWorldBounds、tR738C1BakeAtlasTexture

GLSL（PathTracingCommon.js main()）：
  · bake-aware fragCoord / seed（3263、3271，分塊去相關，已修 RNG 種子退化）
  · bake 射線設定分支 if (uR738C1BakeCaptureMode == 2) { ... }（3310–3349）：
      由 bake atlas 表面點決定 rayOrigin/rayDirection；非 bake 走相機射線
```

註：`main()` 內 bake 分支體積小且已 gate，留在共用 ray-gen 亦可；大宗 bake 成本在 CalculateRadiance 的 capture 區塊與 bake 表面點函式。

---

## 4. 哪些屬 debug/probe（可搬到 debug 變體）

**建議：不維護獨立 debug source 檔，改成「正則 source 內 `#ifdef DEBUG_PROBES` 包裹，runtime 變體 `#ifndef` 排除」。** debug 變體 = 今天的完整 shader（一切保留）。理由：避免雙重維護與契約漂移；debug 只在需要查錯時載入（接受一次重編譯）。

| 家族 | uniform | 位置 | 抽離難度 |
|---|---|---|---|
| A（atlas probe） | `uR7310C1RuntimeProbeMode` | clean-all 23 塊 | 低：多為獨立 `if{break;}`，已驗證 R1 PASS_FULL；含 Batch B 塌縮（保留 7461 正式注入） |
| B（雲朵燈 probe） | `uCloudMisWeightProbeMode` / `uCloudContributionProbeMode` / `uCloudVisibilityProbeMode` | 374–455、3849–3910、4145–4321、5177–6317 交織 | 高：注入點散在正式 NEE 迴圈內，需逐點 `#ifdef`；helper 與正式述詞混居，需區分共用 vs 純 debug |
| C（雜項） | `uR73GikWallProbeMode` / `uR738C1SproutPasteProbeMode` / `uR3ProbeSentinel` | 5401、7877–7898 | 中：點數少但分散 |

剝離順序建議：先 A（已驗證安全、最高 CP 值）→ 量餘量 → 再 B（最大餘量槓桿、但需逐點包裹與驗證）→ C 收尾。

---

## 5. C1/C2 surface bake runner 需要哪些 shader input

bake runner 跑「bake 變體」，逐面餵：

```
· uR738C1BakeCaptureMode = 2（進 bake 射線分支）
· uR738C1BakePatchId（目標面 id；>=1000 走 r7310C1BakeSurfacePoint，否則 r738C1BakeSurfacePoint）
· uR738C1BakePatchResolution / BakeFullAtlasResolution / BakeTileOriginPx（分塊原點，去相關）
· tR738C1BakeAtlasTexture（worldPos/normal 預烘 atlas，bake 射線由此取表面點）
· uR7310C1XatlasBakeMode + uR7310C1XatlasBakeAtlasSize（master atlas 模式）
· uR7310C1SeparatedBakeMode（光/albedo 分離烘焙）
· 完整場景核心（geometry / material / NEE / 積分器）— bake 與 runtime 共用同一份正式核心
· C2：同上，換 C2 的 PatchWorldBounds / config package；per-surface UV 與 owner 由各面登記擴充
```

要點：bake 變體 = 正式核心 + bake 專屬，probe 全 `#ifndef` 排除。

---

## 6. Runtime 顯示 C1/C2 package 需要哪些最小 GLSL

```
· atlas runtime 取樣 fanout（§2 列）— 這是顯示 C1/C2 烤圖的最小集合
· per-surface UV 函式（每面一個 r7310C1XatlasFull<Surface>WallUv）— 此處是「隨面數成長」的編譯壓力來源
· dispatcher r7310C1XatlasNorthWallUv 內每面一條 if 分支
· C2 = 同 fanout + C2 的 Rect uniform 群 + C2 pointer + C2 各面 UV 函式
```

**餘量警訊（連到第 9 節）**：probe/bake 剝乾淨後，runtime 變體仍要承載**全部 C1 面（west/south/beams/columns/…）+ 全部 C2 面**的 per-surface UV 函式與 dispatcher 分支。每多一面，編譯體積往上加。故「剝 probe/bake」買到的餘量，會被「逐面 UV 函式增長」逐步吃掉 → 需在第一個變體成形後**實測完整 C1 是否仍有餘量**。

---

## 7. 第一個正式 patch 應該只做哪一桌

**R4-2A：站起「單源 + #ifdef 變體」管線，先產出 runtime-display 變體，剝離家族 A（atlas probe 23 塊）+ bake-capture。**

```
做：
  1. 在 glsl 把家族 A（clean-all 23 塊）與 bake-capture 區塊用 #ifdef 包裹
     （runtime: #ifndef 排除；bake: 保留 bake-capture；debug: 全保留）
  2. JS 端用既有 defines 機制（仿 R7310_BAKE_ONLY_NO_BORROW）為 pathTracingMaterial 指定 runtime defines
  3. 確保 bake/debug 變體 lazy 編譯（只在進 bake runner / debug 時建材質，不在頁面載入時 eager 編譯兩顆大 program）
不做（留後續 patch）：
  · 家族 B（雲朵燈 probe）剝離 — 交織高風險，獨立成 R4-2A-2，先量 A+bake 剝完的餘量再決定
  · 接 west、進 Phase 2C、烤新面
驗收門檻（見 §8 runtime 列）+ 附帶實測：對 runtime 變體重跑 west-U1 / west-S5，量新餘量（預期 U1 過；S5 是否過＝是否需要再剝家族 B 的判據）
```

選 A 不選 B 當第一桌的理由：A 已被 clean-all R1 PASS_FULL 證實對 runtime 無破壞，是已知安全、最高 CP 值的起點；B 交織進積分器，應在管線站穩、餘量量過之後再逐點包裹。

---

## 8. 每一桌的 CDP / runner 驗證方式

```
runtime-display 變體（CDP harness，零使用者 Console）：
  · PASS_FULL、1000 SPP 收斂、contextLost=false、lostCount=0、無 shaderErr/console 關鍵字
  · 現有 RAW/OIDN 面不錯位：與 LIVE 對照約 10 SPP 判讀（烘焙面 BUG 與 SPP 無關，禁套 500 SPP 累積紀律）
  · screenshot 非黑、場景肉眼正常（geometry/燈/喇叭/門/螢幕/桌面）
  · 附帶：west-U1 / west-S5 重測，記錄是否 LOSS（餘量量尺）

bake 變體（bake runner）：
  · runner 能烤單面 → 產 RAW package
  · metadata identity pass、nonzeroRatio bit 對齊、OIDN bridge（RTLightmap/high/beta/dilation）pass
  · 不影響 runtime 變體（runtime 編譯/收斂不變）

debug 變體（debug harness）：
  · 能驅動原本 probe（抽驗數個 RuntimeProbeMode + 雲朵 probe mode 畫出預期診斷色）
  · runtime 變體 source 經 #ifndef 後實際不含 probe 區塊（getShaderSource 驗證）
```

---

## 9. 若 runtime shader 仍 context loss，何時切到 WebGPU / Blender 評估

```
可繼續（GREEN）：
  · probe(A) + bake-capture 剝離後，runtime 變體編入完整 C1 west-S5 = NO LOSS，且每多一面仍 NO LOSS 有餘裕
警訊（YELLOW，先剝家族 B 再評估）：
  · 剝 A+bake 後 west-S5 仍 LOSS（如本 preflight 預期）→ 進 R4-2A-2 剝家族 B（雲朵 probe），這是最大未動用餘量
  · 每新增一面都要單獨做 context-loss 診斷
升級評估（RED）：
  · 連家族 A+B+bake 全部剝離、runtime 變體只剩正式核心 + atlas fanout，
    完整 C1（全面）或 C1+C2 仍在 M4 Metal 編譯期 LOSS
  · → 代表正式渲染核心本身已逼近 M4 Metal 單顆 fragment program 的編譯上限，逐面擴充不可持續
  · → 評估：
       (a) WebGPU：較大編譯預算 / compute-based pipeline，承載完整 C1/C2 烘焙顯示主線
       (b) Blender/Cycles：離線完整烘焙主線
       (c) WebGL runtime 保留做展示 + 紀念截圖
量化基準：clean-all（≈A+bake，42KB）讓 west-U1 過、west-S5 LOSS。故 RED 的判定點落在「家族 B 也剝完後完整 C1 是否仍 LOSS」。
```

---

## 10. 工程風險與紅線（誠實標註）

```
· 任何 glsl 編輯（含加 #ifdef）→ M4 Metal 全量重編譯，開發/驗收時會撞 recompile freeze（fail-safe a496054 覆蓋）；這是任何分桌方案都躲不掉的一次性開發成本
· debug 變體 = 另一顆 program；切到 debug 會觸發一次重編譯 → debug 應為獨立 build/URL 或明確的 lazy 載入，不應做成「使用者頁面即時切 uniform」（今天 probe 是 uniform 即時切＝永久編入，分桌後改為變體載入）
· bake/debug 變體必須 lazy 編譯，避免頁面載入時 eager 編譯多顆大 program 反而觸發 LOSS
· #ifdef 包裹家族 B 時：須區分「正式與 probe 共用的述詞」與「純 probe helper」，只包後者；共用述詞留在正式路徑
· 取樣器 / atlas 契約跨變體必須一致（單源 #ifdef 正是為避免三檔漂移）
· 全程：不接 west、不進 Phase 2C、不烤新面、不回放 stash、不 commit/push（除非逐項授權）
```
