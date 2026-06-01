# R7-3.10 北牆 Phase 1 分離試點實作計畫

> 角色：OPUS 在 codex/r7-3-10-north-wall-resolution-test 分支寫此計畫。下一棒交 CODEX 審查 + 實作。
> 基線：HEAD = 9b78b49（北牆 non-square × 西樑暗縫已收乾）。
> 來源依據：`.omc/plans/R7-3.10-B-per-surface-texel-density-v5.md`（ralplan 5 輪共識 APPROVE）。
> 紀律：函式名定位、行號僅作讀碼提示；技術縮寫沿用 v5 對照表，不再重列。

---

## 0. 任務本質與語義校正（CODEX 動工前先核）

使用者口頭命題：「北牆密度提升的實作」。

OPUS 校正：v5 已把 R7-3.10 B 方案從「拉 D」改為「分離烘焙」。v5 §0 鐵字：

```
v4 對糊的解：拉高 atlas 密度 D 讓「混烤值」更細
v5 對糊的解：分離（烤 irradiance + runtime × albedo），紋理細節改由原生貼圖負責；
            光照圖只解析平滑光 + 光影邊 → D 大概率「降低」（< 590），由試點實測決定
```

因此本份計畫把「北牆密度提升」翻譯為「北牆 Phase 1 分離試點」。如果 CODEX 認為使用者要的是 v4 純拉 D 路線，請在審查回填區寫 push back，由 OPUS 再裁示。

---

## 1. OPUS 裁示（走 v5 Phase 1 分離試點）

走 v5 Phase 1。理由：

```
 1. v5 已 ralplan 5 輪共識 APPROVE，v4 已被 supersede（v5 §0 / .omc/plans/R7-3.10-B-per-surface-texel-density-v5.md）。
 2. v4 純拉 D 對「貼圖物件」量級爆炸：floor 4.93×6.3m @ 2000 texel/m ≈ 2 GB「單面」、
    全室數十 GB、單邊遠超 8192 → 終極全烘焙範圍（含 GIK / 喇叭 / 木門 / 鐵門 / 窗）不可行。
 3. v4 對單色面是浪費：單色面混烤＝光乘常數 uWallAlbedo，分離後期望值恆等、密度需求不變
    （甚至可降）。
 4. v5 Phase 1 北牆＝單色結構面，有「收斂後區塊均值零變化」可量化驗收尺
    （≥2000 SPP 逐區塊 mean(分離)/mean(混烤) ∈ [0.98,1.02]，v5 差異 5 / R3）。
 5. 「密度提升」字面誤導：v5 預期 D 往下走（候選帶 D=300 / 420 / 512 / 590），590 改為「上限參考值」。
```

若使用者明確要求只做 v4 純拉 D（接受 v4 範圍限制 + 放棄 v5 已釐清的根因），本份失效、須另寫 v4 重啟計畫。

---

## 2. 範圍（Phase 1 北牆專屬，嚴守）

```
 做
   1. 北牆 bake pointer 純新增 multiplyAlbedoAfterBakeLookup 旗標（不動 bakedRadianceKind）。
   2. 北牆 bake capture first-hit albedo=1 forcing（中和全 albedo 三層；§3 Commit 3）。
   3. 北牆 runtime 兩條取樣路徑都新加 × uWallAlbedo（hybrid radiance return + short-circuit；§3 Commit 4）。
   4. 候選帶（D=300 / 420 / 512 / 590）各重烤一版，並存不覆蓋。
   5. 選「能解析北牆光影細節（門洞交界 + beam gap + reveal 邊）的最低 D」作全室 D 初值。
   6. 過 5 GATE（GATE-PIXEL / GATE-BLEED / GATE-CLAMP / GATE-D / GATE-METAL）。

 不做
   1. 不動其他 22 面 hybrid radiance（Phase 2 才批次）。
   2. 不改其他 short-circuit bakedRadiance 賦值（Phase 2）。
   3. 不納入貼圖物件（Phase 3，且須先 GIK 可分離性 spike，v5 R7）。
   4. 不加白漆貼圖（Phase 4，選配真實感升級）。
   5. 不退役舊正方 atlas（Phase 4 前置）。
   6. 不動全域邊界防呆 baseline（北牆 seam 已修 9b78b49，boundary registry 仍在垂直切片階段、
      與本案正交）。
```

---

## 3. 動作清單（按 commit 邊界分組）

### Commit 1：Phase 0 工具與測試骨架（純工具/文件，不動 runtime）

沿用 v5 §Phase 0。重點：

```
 1. 擴 docs/tools/r7310-texel-density.cjs 至 23 面，補 slots 7-22；
    structural slot6 標 'composite; deferred'；貼圖物件（GIK / 喇叭 / 門 / 窗）標 'textured; phase3-separated'。
 2. D 掃描：--density 掃 候選帶（300 / 420 / 512 / 590），各出
    (wW,hH) / mm-texel / max-min 比 / 單面最大邊 / 總 VRAM / 真排版器單邊。★不選定 D。
 3. active-sampler ≤16 靜態檢查：解析 shader（bake define）sampler 宣告 + 使用，斷言 active ≤ 16；
    涵蓋「白漆貼圖上線前後」情境（Phase 4 用，本期僅驗 active=16 維持）。
 4. 新建 4 個契約測試檔（v5 R9，工作區現 36 個 .test.js 無一匹配，須新建）：
      docs/tests/r7-3-10-separated-composite-no-double-albedo.test.js（防重複乘 albedo）
      docs/tests/r7-3-10-active-sampler-ceiling.test.js（active ≤ 16）
      docs/tests/r7-3-10-irradiance-no-clamp.test.js（純光無切頂）
      docs/tests/r7-3-10-density-uniformity-audit.test.js（密度審計）
 5. 量 GATE-PIXEL 比帶雜訊 floor（v5 OQ-T）：同版本同相機兩個不同 RNG seed ≥2000 SPP 量
    同面區塊均值雜訊分佈，據此定 ±2% 比帶是否足夠（若雜訊 > 2% 則放寬比帶或提高 SPP）。
```

硬門檻：分離合成公式 JS 鏡像通過單元測試（單色面期望值恆等 + 防重複乘 + bleed 保留 + indirect bounce mask 不殘留本面 albedo）；密度工具 23 面覆蓋；active-sampler 鎖綠。

settle 死鎖風險：不適用（不改 runtime）。

### Commit 2：北牆 bake pointer 純新增 multiplyAlbedoAfterBakeLookup（v5 R4）

```
 定位（函式名）：js/InitCommon.js 北牆那筆 pointer（11 處 pointer 之一；
   全 11 處的 bakedRadianceKind='indirect_diffuse_radiance' 同步段，v5 錨點 I）。
 改點
   1. 該 pointer 純新增一行：multiplyAlbedoAfterBakeLookup: true。
   2. 既有 bakedRadianceKind / directLightAlreadyIncluded / addDirectLightAfterBakeLookup 全部保留、不動。
   3. loader 加 1 條新斷言驗 multiplyAlbedoAfterBakeLookup；既有 InitCommon.js:3066 / 3431 兩條斷言
      （驗 bakedRadianceKind / directLightAlreadyIncluded / addDirectLightAfterBakeLookup）不動。
 紀律
   - 不動語義鍵：bakedRadianceKind 維持 'indirect_diffuse_radiance'（語義仍精確、避免動 30+ 處）。
   - per-pointer 加旗標 = 天然支援漸進 + per-surface fallback：未加旗標的面仍走舊混烤路徑。
```

### Commit 3：北牆 bake capture first-hit forcing（§v5 §1.3 / R5 / F1）

```
 前置（強制）：先解 v5 OQ-R（缺口 7）。
   要回答：bake capture 模式（uR738C1BakeCaptureMode==2）下 first-hit 實際走哪條路徑？
   親證已關閉：short-circuit 在 glsl:2989 `if(uR738C1BakeCaptureMode!=0) return false`、
              hybrid 在 glsl:1648 `uR738C1BakeCaptureMode==0`。
   結論假設（待 CODEX 親自逐行確認）：bake 模式 first-hit 走「普通 NEE 路徑 glsl:6454 那條」。
   OQ-R 未收前不動 shader。

 forcing 改法（v5 §1.3 定稿、F1 修正）
   條件
     uR738C1BakeCaptureMode==2 且 first-hit 命中北牆
     （first-hit 判定函式：r7310C1NorthWallIndirectBakeFirstHit，glsl:1661，呼叫點 5660）。
   動作
     在 hitColor 三層全部定值之後（4154 boxColor / 4155-4156 L-union dynamic / 4159 *= uWallAlbedo
     全部之後）、glsl:6454 mask *= hitColor 之前，令 hitColor = vec3(1.0)。
   覆蓋層
     一次中和 boxColor（層1）+ L-union dynamic south wall color（層2，僅 L-union 接合面）
     + uWallAlbedo（層3）三層。
   後續 bounce
     維持真實 hitColor（保 bleed 色彩）── 嚴禁把後續 bounce 也設白。

 注入點順序鐵律
   若注入點早於 4155-4156 的 L-union 覆寫，覆寫會抵銷 forcing → v5 pre-mortem 情境 2（抽錯 bleed）。
   一定要「三層後、6454 前」。

 安全性
   F1 forcing 對「boxColor 純白 / 非純白」兩種情況皆安全（v5 OQ-U）：
     - 純白：boxColor=vec3(1.0)，hitColor=vec3(1.0) 等價於三層真實結果。
     - 非純白：hitColor=vec3(1.0) 強制覆蓋，保證下游 mask 不殘留本面 albedo。
```

### Commit 4：北牆 runtime 兩條路徑都乘 uWallAlbedo（§v5 §1.2 / R1）

```
 路徑 (A) hybrid radiance（function return）
   函式：r7310C1NorthWallHybridRadiance（glsl:1659 附近）
   現況：return SamplePatchValidLinear(...)（直接回 atlas sample，混烤值）
   改後：return uWallAlbedo × SamplePatchValidLinear(...)
   dispatch：glsl:6263-6304 `accumCol += mask * HybridRadiance(...)`

 路徑 (B) short-circuit bakedRadiance（賦值）
   位置：r7310C1FullRoomDiffuseShortCircuit 北牆賦值（glsl:3010）
   現況：bakedRadiance = r7310NorthWallBakedRadiance（直接賦值，混烤值）
   改後：乘 uWallAlbedo（或在 accumCol 套乘前的 glsl:6447 之前統一乘）
   dispatch：glsl:6361（進入條件 `!(任一 hybrid first-hit) && shortCircuit(...)`）→ glsl:6447 `accumCol += mask * r7310BakedRadiance`
   ★兩條互斥但同面：hybrid first-hit 旗標在 glsl:5660 一帶算；北牆走 hybrid 時走 (A)、不走 hybrid 時 short-circuit 兜底走 (B)。

 兩條 albedo 來源一致鐵律（v5 測試 3c）
   同一面在 (A) 與 (B) 下乘的 albedo 來源必須一致。漏改 (B) → 同面忽乘忽不乘 → GATE-PIXEL 必 fail
   且歸因困難（v5 初稿的系統性破洞）。

 防重複乘鐵律（§v5 §1.2 / R2，CODEX 不可動）
   結構面直接光 NEE 路徑（glsl:6454 mask *= hitColor、hitColor 含 4159 uWallAlbedo；+ glsl:6724 mask *= weight * uLegacyGain）
   ★全部保留、不動。直接光那項已含 albedo，runtime 不可再乘。本 Commit 只對「烤好的間接光（路徑 A+B）」新加 × albedo。

 單一真相源（v5 F4）
   shader 兩條路徑的 × albedo 由「該面 diffuse mode uniform」閘控
   （uR7310C1NorthWallDiffuseMode 與 JS 端 pointer 旗標 multiplyAlbedoAfterBakeLookup 同源）。
   ★禁止在 GLSL 硬寫「哪些面已分離」的面清單，避免雙真相源漂移。
```

### Commit 5：北牆候選帶重烤（並存不覆蓋）

```
 工具：docs/tools/r7-3-8-c1-bake-capture-runner.mjs
 旗標：--angle=metal --browser=chrome
 鐵律：絕不用 Brave（runner findBrowser 預設抓 Brave，那是使用者日常瀏覽器，會打斷他的工作）。

 候選帶順序建議（請 CODEX 在審查回填區裁示是否採用）
   首發：D=512 + D=420 兩版（中段往下找最低 D）。
   分支
     若兩版都解析光影細節 → 加烤 D=300 探更低底。
     若 D=512 解析不足 → 加烤 D=590（v4 上限參考）對照。
   一律並存不覆蓋舊混烤 .bin（per-surface 可獨立 fallback 回混烤路徑）。

 大檔處理
   北牆 non-square 已走 atlasChunks（part0 / part1，各約 76 MB，9b78b49 已上 main）。
   若候選帶某個 D 烤出超過 100 MB 單檔，沿用同 chunk 方案。

 烤時長預期
   sample-bound：1000 SPP 約 < 2 分鐘（feedback memory bake_runner_duration）。
   候選帶 4 版 × Cam1/2/3 各 1 版 ≈ 12 次烤，預估總時長以實烤為準，--timeout-ms 只當 hang ceiling。
```

### Commit 6：北牆 5 GATE 驗收

```
 GATE-PIXEL（最關鍵，v5 R3）
   設置  北牆分離版（albedo=1 烤 + runtime × uWallAlbedo，兩條路徑）vs 舊混烤版
   相機  Cam1 / Cam2 / Cam3
   SPP   ≥2000 SPP
   指標  逐區塊 mean(分離) / mean(混烤) ∈ [0.98, 1.02]（採區塊均值；逐像素 pixel-exact 因 stochastic RNG 路徑差異不可達）
   失敗歸因
     跌出比帶偏暗 → v5 情境 1（重複乘 albedo），量級約 1 − albedo（如 albedo=0.7 偏暗約 30%，遠超 2000 SPP 收斂雜訊 < 2%）
     色偏          → v5 情境 2（抽錯 bleed，forcing 注入點順序錯或漏層）

 GATE-BLEED 溢染保留
   設置  北牆旁有彩色面（如鐵門紅、木門木紋）時，分離烤值仍可見溢染色
   失敗  烤值無色（被抽掉）→ first-hit forcing 把後續 bounce 也設白了，違反 §3 Commit 3 後續 bounce 鐵律

 GATE-CLAMP 純光無切頂
   設置  北牆烤 irradiance min / max / p99 審計
   稽查點
     (a) bake capture 路徑：對「純光 > 1.0」的合成輸入，atlas 寫入值未被 [0,1] clamp 切頂（v5 OQ-N）
     (b) runtime borrow 注入（glsl:6788 `borrowedAvg = min(borrowedAvg, vec3(1.0))`）：審計撞 1.0 頂的機率
   失敗  亮部失真 / 暗角 bleed 被切（v5 R6）

 GATE-D 實測 D 落定
   設置  從候選帶選「能解析北牆光影細節（門洞交界 + beam gap + reveal 邊）的最低 D」
   上限  D ≤ 590（v5 B2 上限參考；超過代表分離沒移走材質職責，須查 bug）
   產出  D 寫入 .omc/plans/R7-3.10-B-per-surface-texel-density-v5.md §4 作為 Phase 2 全室套用基準

 GATE-METAL Metal 烤對
   設置  北牆在實測 D Metal 烤出
   稽查  非全黑 / nonFiniteTexels=0 / capture 後 gl.getError 空 / 純光無 clamp 切頂
   工具  --angle=metal --browser=chrome 一律走 chrome（feedback memory never_touch_brave）
```

5 GATE 全綠後：

```
 1. 北牆 fallback 旗標（diffuse mode uniform）切到「以分離為預設」。
 2. 跑全 23 面 settle → 放人，確認 A+C'-1 載入抽搐無回歸。
 3. GATE-PIXEL 連跑 3 輪不同 RNG seed 都綠，才解除 fallback。
 4. D 寫入 v5 §4 表，作 Phase 2 全室套用基準。
```

---

## 4. settle 死鎖風險核（C1 / v3 重啟簡報 §C1）

v3 重啟簡報列「44 個 combined diffuse atlas resolution mismatch throw」是 v4 拉 D 的死鎖根源（不同面 targetAtlasResolution 不一致時 throw → catch 跳過 markStepComplete → A+C'-1 settle gate 永久卡死）。

Phase 1 北牆試點與此風險的關係：

```
 1. 北牆重烤不改 atlas 解析度（同一張 atlas，改的是「內容語義」從混烤值變 irradiance）。
 2. 不增 surfaceKey、不改 settle 模型（v5 錨點 E：23 個 surfaceKey + nonSquareAtlas key 已就位，catch 已 markStepComplete）。
 3. 候選帶各 D 並存於不同 .bin 檔，runtime 同時只載一版（per-surface fallback 機制）。
 4. → Phase 1 不觸發 44 個 resolution mismatch throw。
```

Phase 2 結構面批次才開始切實測 D，屆時須對齊真正 refresh 入口（v3 §C2，疑為 refreshR7310C1CombinedDiffuseRuntimeTexture）+ catch 路徑保 markStepComplete。本案範圍不涉。

---

## 5. sampler 帳（DD2，當前 active=16 零餘裕）

```
 Phase 1 +0 sampler
   光照圖     共用現有 atlas（tR7310C1FullRoomDiffuseAtlasTexture / ...NonSquare）
   albedo     uniform uWallAlbedo（非 sampler）
   → active 維持 16，不破 Metal 16 上限。

 全 Phase 1 完成後 sampler 帳預期
   bake 變體：active=16（不變）
   runtime 變體：active=16（不變）
```

---

## 6. 給 CODEX 的審查問題

```
 Q1（前置最關鍵，OQ-R 缺口 7）
   bake capture 模式（uR738C1BakeCaptureMode==2）下 first-hit 實際走哪條路徑？
   親證：short-circuit 在 glsl:2989 關閉、hybrid 在 glsl:1648 關閉。
   假設：應走普通 NEE 路徑 glsl:6454 那條。
   CODEX 任務：逐行追 bake 模式 first-hit 命中北牆時的真實路徑，確認 hitColor=vec3(1.0) 的注入點
              （三層後、6454 前）正確、無被其他分支覆寫。

 Q2（OQ-N 純光值域切頂）
   bake capture path（captureR738C1DirectSurfaceTexelPatch 等 3 個 render 點 + atlas 寫入 + runtime borrow glsl:6788）
   是否有 [0,1] clamp 會切純光（irradiance 值域 > 混烤）？
   atlas 格式應為 RGBA32F 無 clamp，但 capture / blit / borrow 路徑須逐點查。

 Q3（OQ-U 北牆 boxColor 實值）
   親自開檔報出北牆 boxColor 實值。
   若非純白：F1 forcing 必須一次中和 boxColor + L-union dynamic + uWallAlbedo 三層（已在 §3 Commit 3 寫死）。
   若純白：F1 簡化但 §3 Commit 3 寫法仍安全（覆蓋等價於三層真實結果）。
   →  不阻擋 Phase 1，僅供 GATE-PIXEL 失敗時歸因。

 Q4（OQ-T GATE-PIXEL 比帶容差）
   ±2% 區塊均值比是否足夠？
   Phase 0 須用同版本同相機兩個不同 RNG seed ≥2000 SPP 量同面區塊均值雜訊分佈，據此定容差。
   若雜訊 > 2% → 放寬比帶到雜訊 floor 的 1.5×，或提高 SPP 到雜訊 < 2%。

 Q5（路徑 B 乘 albedo 的位置選擇）
   §3 Commit 4 給兩個選項：
     (a) 在 r7310C1FullRoomDiffuseShortCircuit 內 bakedRadiance 賦值處乘 uWallAlbedo（glsl:3010 那行改）
     (b) 在 accumCol 套乘前的 glsl:6447 之前統一乘
   CODEX 裁示：哪個更乾淨、回滾風險更小、與 Phase 2 泛型化銜接最順？

 Q6（commit 邊界粒度）
   §3 Commit 2 / 3 / 4 是否要再拆細？
   §3 Commit 5 重烤產物大檔（候選帶 4 版 × Cam 3 個 ≈ 12 檔）是否要走 chunk 方案（沿用 9b78b49 atlasChunks）？

 Q7（候選帶順序）
   §3 Commit 5 建議「先烤 D=512 + D=420 兩端往下夾找最低 D」。
   CODEX 裁示：是否最省？要不要改「D=590（v4 上限）+ D=420 兩端往中間夾」或其他順序？
   依據：北牆光影細節「最細特徵尺寸」估算 vs 候選帶 mm/texel 比對。

 Q8（垂直切片紀律）
   本案是 v5 Phase 1 純北牆。CODEX 是否同意「Phase 1 GATE-PIXEL 過硬閘前不批次放大、不碰其他面、不碰貼圖物件、不退役舊 atlas」？
   若有同步推進需求，請明列並寫理由。
```

---

## 7. CODEX 自我約束

```
 1. 動工前先解 Q1 / Q2 / Q3 / Q4（OQ-R / OQ-N / OQ-U / OQ-T）。未收前不動 shader。
 2. Commit 邊界嚴守（§3），逐 commit 可獨立 revert。
    特別：Commit 3（bake forcing）與 Commit 4（runtime 乘 albedo）必須是兩個 commit，不可合併。
    （理由：GATE-PIXEL 失敗時，二分基準清晰：偏暗 → 看 Commit 4 漏改路徑；色偏 → 看 Commit 3 forcing 注入點。）
 3. 重烤一律 --browser=chrome --angle=metal。絕不用 Brave、絕不 pkill Brave。
 4. 5 GATE 全綠才宣告 Phase 1 通過。GATE-PIXEL 為核心。
 5. 任一 GATE 失敗，先回報「fail 哪一 GATE / 哪個歸因 / 建議回退到哪個 commit」，
    待 OPUS 裁示後才動手。不自行重做。
 6. 北牆 fallback 旗標保留至 GATE-PIXEL 連跑 3 輪不同 RNG seed 都綠。
 7. 回報格式：Data gate / Runtime gate / Boundary gate / Visual gate 分開列；
    已跑哪些 gate、沒跑哪些 gate、哪些只屬 throwaway 預覽。
 8. 產出物（5 GATE 全綠後）：D 實測值寫入 v5 §4 表 + Debug_Log.md 加一條「Phase 1 北牆分離試點通過」紀錄。
```

---

## 8. 暫停事項（Phase 1 完成前不碰）

```
 1. Phase 2 結構面批次（其餘 21 面 runtime + bake forcing 泛型化）。
 2. Phase 3 貼圖物件分離（GIK 可分離性 spike）。
 3. Phase 4 牆面白漆貼圖（先退役舊正方 atlas）。
 4. 全域邊界防呆 baseline 擴成全 registry（north seam 已收，剩餘 fixture 是 Phase 2 起的事）。
 5. 東牆正式非方格烘焙（v5 未涉、屬橫向擴張，須等北牆密度曲線實測）。
 6. 全室 promotion（同上）。
 7. 任何「拉高 D 到 ~2000 治貼圖物件」（v4 路線，已被 v5 supersede，量級爆炸）。
```

原因：Phase 1 試點是 v5 整段架構的可行性閘門；過閘前任何放大或橫向擴張都會把「定位失敗根因」變難。

---

## 9. 給 OPUS 的回流口

CODEX 審查完本份後，請在「審查回填區」填：

```
 1. Q1~Q8 的逐點回答（Q1 / Q4 為前置 blocker，Q2 / Q3 / Q5 / Q6 / Q7 / Q8 為計畫調整輸入）。
 2. 計畫採用 / 修訂 / 推翻三選一裁示，含理由。
 3. 若採用，列「CODEX 起手 commit」對應的 §3 Commit 編號。
 4. 若修訂，列具體修訂點 + 新版 §3 commit 順序。
 5. 若推翻，列推翻理由 + 建議替代方案（如「使用者要的就是 v4 純拉 D」）。
```

OPUS 在 CODEX 回填完成後寫 §10 裁示，與 seam-boundary-plan 同 round 2 邏輯（v5 已有完整審查記錄可參考體例）。

---

## 10. OPUS 審查裁示（待 CODEX 回填後 OPUS 寫）

```
（待 CODEX 完成 §9 回填後，OPUS 在此段寫裁示。）
```

---

## 11. CODEX 審查回填區（2026-06-01）

### 11.1 Verdict

ITERATE。

方向可採用：北牆先做 separated pilot、只碰北牆、先補契約與 gate，再談 D 與全室推廣。這個方向符合目前共識。

但此計畫目前有一個實作前必修：它描述的是「從零開始做 separated」，而目前分支已經存在一部分 separated 與 Metal tiled bake 基礎設施。直接照本稿動工，會有重做、誤改已驗收契約、或把舊工作當成新工作的風險。

動工前先把本計畫拆成兩張表：

```text
1. 已存在，只需驗證
   - pointer / loader 對 multiplyAlbedoAfterBakeLookup 的檢查與回報。
   - 北牆 separated runtime flag。
   - Metal tiled/fence capture 的安全 guard。
   - non-square preview 相關接線與北牆 seam 修復。

2. 尚未完成，才可新增
   - bake capture first-hit 「目標面自己的 albedo = 1」的精確注入點。
   - runtime 兩條路徑的最終等價驗收。
   - 可重跑的 GATE-PIXEL / GATE-BLEED / GATE-CLAMP。
   - 候選 D 的正式 bake 與比較。
```

### 11.2 已核對到的現況落差

以下是目前分支已經存在的相關機制，計畫內仍寫成待辦。這些項目不可再用「新增功能」心態處理，應改成「驗證與補缺」。

```text
1. pointer / loader 已有 separated 欄位處理
   InitCommon.js 已檢查:
     bakedRadianceKind
     directLightAlreadyIncluded
     addDirectLightAfterBakeLookup
     multiplyAlbedoAfterBakeLookup

   並已有:
     r7310C1NorthWallSeparatedDiffuseRuntime
     report 內的 separated/mixed flags

2. Metal tiled/fence 安全機制已存在
   captureR738C1DirectSurfaceTexelPatch 已有 tile loop、fence boundary 與大圖 guard。
   這是已驗證過的 P0/P1/P2/P3/P4 線，不應在本計畫內重新設計。

3. 北東非方格與 seam 修復已存在於當前工作線
   Phase 1 square separated pilot 不能覆蓋目前 non-square preview package、chunk 或 seam 修正成果。
```

### 11.3 Q1：first-hit albedo forcing 需要先證明路由

計畫的方向正確：烤目標面時，目標面自己的 albedo 要設成 1；其他面維持真實顏色，保留 color bleed。

但目前不能直接依文字描述去改 `mask *= hitColor`。原因是 shader 內有多個相似位置，且行號已漂移。動工前需先做一個小型 route probe，回答三件事：

```text
1. 北牆 capture mode=2、patchId=1002 時，真正走到哪一段 first-hit shading。
2. 哪一個位置乘上目標面的 hitColor / uWallAlbedo。
3. 這個修改是否只影響 first-hit 目標面，不會把後續 bounce 的其他面 albedo 也變白。
```

可接受的修法應滿足：

```text
1. 只在「目標面 first-hit bake」時把 x 自己的 albedo 視為 1。
2. 其他面反彈來的顏色維持真實值。
3. runtime 直接光路徑不被重乘 albedo。
4. 修改點有測試或 probe 鎖住，避免之後又把 color bleed 抽掉。
```

### 11.4 Q2：Float32 容量可行，但 clamp audit 必須先做

RGBA32F 形式上可存超過 1 的純光值，這點可行。

但目前 shader 內有會把值壓到 1 的路徑，例如 borrow 相關路徑出現 `min(..., vec3(1.0))`。這不代表北牆 separated 一定會被 clamp；它代表本計畫要先做 route-specific audit。

GATE-CLAMP 建議分成兩層：

```text
1. atlas 值域
   檢查 separated bake 的 raw atlas 是否出現 >1 值，且沒有被寫入前截斷。

2. runtime composed 值域
   檢查 albedo × baked_indirect + direct_live 後的畫面沒有被錯誤壓扁。
```

若 borrow 路徑與北牆 separated 無關，就在報告中寫明「不適用」；若有關，需補 route guard 或測試。

### 11.5 Q3：uWallAlbedo / boxColor 需要以實際值核定

計畫說「單色面分離理論上會與 mixed 相同」，這個推論成立的條件是：

```text
mixed_bake ≈ irradiance_bake × visible_albedo
```

目前仍需在程式中讀出北牆實際 visible albedo 的組成：

```text
visible_albedo = boxColor × uWallAlbedo
```

請先列出北牆 boxColor 與 uWallAlbedo 的實際值，再決定 GATE-PIXEL 的期望比值。不要只用概念值。

### 11.6 Q4：GATE-PIXEL 要先建立 noise floor

`[0.98, 1.02]` 可作為初始門檻，但目前需要先用可重跑方法量出同一路徑不同 random seed 的自然波動。這是避免把 Monte Carlo 雜訊誤判成 separated 錯誤。

建議順序：

```text
1. 同一相機、同一解析度、同一模式，跑兩次 mixed 或 separated。
2. 計算 block mean ratio 的 median / p90 / max。
3. 以這份自然波動決定正式容差。
4. 再跑 separated × albedo vs mixed。
```

GATE-PIXEL 也要寫死：

```text
1. cameraState
2. sample count
3. block grid 尺寸
4. 排除邊界、invalid、直接高亮區的方法
5. 輸出欄位名稱
```

### 11.7 Q5：runtime 兩條路徑的乘法位置需局部化

Hybrid path 可在北牆 radiance helper 內處理：

```text
sample = atlas sample
if separated:
  return sample × visibleAlbedo
else:
  return sample
```

Short-circuit path 建議在北牆 slot 的分支局部處理，不要在大範圍 `accumCol` 區段補乘法。

理由：

```text
1. 可讀性高。
2. 不容易重乘直接光。
3. 比較容易寫測試鎖住「只乘一次」。
4. 與目前 north hybrid 的 separated 寫法保持一致。
```

### 11.8 Q6：commit 邊界可用，但 Commit 1 前需加 inventory

建議 commit 順序調整如下：

```text
0. Current-state inventory
   只列已存在 / 待補 / 不可覆蓋項目。
   這個 commit 可是文件與測試，不改行為。

1. Tools + contracts
   density tool、noise floor runner、separated contract test。

2. Pointer / loader verification
   若現有機制已足夠，只補測試與文件。
   若缺欄位再改 pointer。

3. Bake first-hit albedo forcing
   先 route probe，後最小修改。

4. Runtime composite
   hybrid + short-circuit 各自局部乘 albedo。

5. One candidate bake
   先烤一個候選 D。

6. Additional D candidates
   第一個候選通過 GATE 後再展開。
```

### 11.9 Q7：D 候選不宜一開始全烤

本計畫目前列出 300 / 420 / 512 / 590 多個候選。方向可接受，但不宜在核心路由尚未驗證前全部烤。

建議第一輪只選一個候選，且用來回答「separated pipeline 是否穩定」：

```text
候選建議：D=420 或 D=512

理由：
  D=420 能測降密度後是否仍可用。
  D=512 接近常見 power-of-two 尺寸與工程直覺，方便觀察。
```

若第一個候選在 GATE-PIXEL / GATE-BLEED / GATE-CLAMP 都過，再跑第二個候選比較畫質與成本。

### 11.10 Q8：垂直切片策略正確

北牆單面垂直切片是正確策略。暫停項目應維持：

```text
1. 東牆非方格正式 bake
2. 全室 D 決策
3. 白漆貼圖 sampler 帳
4. 全室物件 bake
5. promotion 到正式 package
```

### 11.11 補充 gate：不得破壞既有 north non-square / seam 成果

目前北牆已經有 non-square preview 與 west beam seam 修復線。Phase 1 square separated pilot 若改到同一批 runtime 路徑，需補一條回歸：

```text
1. 北東非方格開關仍能切換。
2. 北牆 non-square package ready 狀態不被 square separated pilot 覆蓋。
3. north_nonsquare__west_beam_north_edge seam gate 維持綠。
4. 大圖仍使用 tiled/fence guard，不可回到單張未分塊 capture。
```

### 11.12 最終建議

可用此計畫作為 Phase 1 北牆 separated pilot 的主線，但實作前先做一次 current-state inventory，並先關閉 Q1 / Q4 兩個風險。

```text
可立即做：
  1. 補 current-state inventory。
  2. 補 route probe，找出 first-hit albedo forcing 的精確位置。
  3. 補 noise floor runner，決定 GATE-PIXEL 容差。

暫緩：
  1. 多個 D 候選批次烤圖。
  2. 全室推廣。
  3. promotion。
```

---

## 附錄 A：與 v5 計畫的對應關係

本份 = v5 §Phase 1 的「執行層細化」，所有設計依據在 v5。對應索引：

```
 本份 §0 任務本質校正        ↔ v5 §0 一句話 / 差異 4 / 議題 B
 本份 §1 OPUS 裁示           ↔ v5 議題 A 失效理由 / ADR / R7
 本份 §2 範圍                ↔ v5 §Phase 1 不做清單 / R7（Phase 3/4 待 spike）
 本份 §3 Commit 1            ↔ v5 §Phase 0
 本份 §3 Commit 2            ↔ v5 §錨點 I / 測試 4 / R4
 本份 §3 Commit 3            ↔ v5 §1.3 / R5 / F1 / OQ-O / OQ-R
 本份 §3 Commit 4            ↔ v5 §1.2 / 錨點 B / R1 / R2 / F4
 本份 §3 Commit 5            ↔ v5 §4 候選帶 / 錨點 G / feedback memory bake runner
 本份 §3 Commit 6            ↔ v5 §Phase 1 5 GATE / R3 / R6
 本份 §4 settle 死鎖核        ↔ v3 重啟簡報 §C1 / v5 錨點 E
 本份 §5 sampler 帳           ↔ v5 §3 事實 1 / DD2
 本份 §6 Q1~Q8               ↔ v5 OQ-R / OQ-N / OQ-U / OQ-T / 議題 A cons(c)(d)
 本份 §7 CODEX 自我約束       ↔ v5 §Phase 1 commit 邊界 / 鐵律 4
 本份 §8 暫停事項             ↔ v5 鐵律 1 / 不做清單
```

## 附錄 B：本份外的 R7-3.10 相關文件入口

```
 v5 主計畫       .omc/plans/R7-3.10-B-per-surface-texel-density-v5.md（757 行，全長 ralplan 共識結論）
 v3 重啟簡報     .omc/plans/R7-3.10-B-revision-brief.md（4 CRITICAL 修訂要求）
 全域邊界防呆    docs/html-review/2026-06-01-r7-3-10-north-nonsquare-seam-boundary-plan/source.md（已 round 2 APPROVE）
 R0 全景地圖     docs/SOP/R0：全景地圖.md（R7-3.10 狀態）
 北牆 seam 修復  commit 9b78b49（HEAD，北牆 non-square × 西樑暗縫已收乾）
 工具 runner    docs/tools/r7-3-8-c1-bake-capture-runner.mjs（已正式化 Metal + chrome）
 密度工具       docs/tools/r7310-texel-density.cjs（Phase 0 待擴 23 面 + D 掃描）
 OPUS / CODEX 分工  feedback memory opus_codex_review_split（OPUS 寫 source.md、CODEX 重生 index.html）
```
