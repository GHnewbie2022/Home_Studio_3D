# R7-3.10 東牆真非方格 XATLAS（RAW + OIDN）＋ 雙牆 RAW/OIDN 開關 — 交 CODEX 審查報告

撰寫：OPUS　日期：2026-06-15　分支：`codex/r7-3-10-arch-cure-blender-cycles-migration`
狀態：實作完成、使用者肉眼驗收通過（北 OIDN／東 RAW／東 OIDN 皆過）、CODEX 已審 ACCEPT、**尚未 commit / 尚未 push**。

---

## 0. CODEX 審查結論（2026-06-15）

§9 八點全核，主路線 **ACCEPT**。commit 前已套用兩處文件更正：

- **A（§6／§9[2] 改正）**：原「東段裁掉的邊緣落在 atlas padding」說法不成立。CODEX 讀 east RAW/OIDN atlas，source row 0..3 的 alpha count=1797 且有有效亮度，故現行做法是犧牲東牆 zMin 端約 4 列**可見**邊緣（使用者肉眼已驗收接受）。若要零裁切，需另開 stacked segment gap／clamp sampling 設計。下文 §6、§9[2] 已照此改寫。
- **B（§9[8] 改寫）**：移除地區式網域字樣，改為「無 .cn 網域、無簡體、無不合專案語言規範用詞」。

CODEX 已跑並通過：`node --check` ×3（`js/InitCommon.js`、`js/Home_Studio.js`、`docs/tools/r7-3-10-full-east-wall-xatlas-package.mjs`）、`python3 -m py_compile`（東牆 phase2-prepare／c2c tools）、`git diff --check`。未跑：Chrome WebGL 實機 smoke。未改檔、未 commit、未 push。

ACCEPT 已核要點：sampler=15 守 16-TIU；V 內縮 north row ~0.50–3373.48／east row ~3381.51–7320.99／gap ~8.03 列避開 3377 交界；wrapper 非互斥無偷 UV；hybrid guard 對稱皆有 `!xatlasFirstHit`；east bed-top cure escape=(0,+1,0)；albedo/direct policy 與北牆一致；OIDN aux 結構與北牆一致、East OIDN 指向 RAW source、alphaPreserved/passDecision=pass。

---

## 一句話總結

把「真非方格 xatlas（每公尺 800 texel 均勻密度）」從北牆擴張到東牆，東牆同樣產出 RAW 與 OIDN 兩版烤圖；把北、東兩張烤圖以「案 B：上下堆疊成同一張合成貼圖」共用既有的 bake-atlas sampler slot（守住 16-TIU 上限）；在烘焙鈕旁加兩顆「關閉 → RAW → OIDN → 關閉」三段循環開關，北、東可同時顯示同一種版本以公平對照。期間修掉三個根因：東牆 bed-top 接觸邊硬梯度陰影、東牆 hybrid 重複累加、東牆 OIDN 近北角的兩條綠色垂直光斑。

---

## 1. 本批改動範圍（`git diff --stat HEAD`）

```
Home_Studio.html                  |   6 +-
js/Home_Studio.js                 |  28 +++++++-
js/InitCommon.js                  | 131 ++++++++++++++++++++++++++++++++++++--
shaders/Home_Studio_Fragment.glsl | 128 ++++++++++++++++++++++++++++++-------
4 files changed, 262 insertions(+), 31 deletions(-)
```

新增烤製產物（未列入上方 diff，屬 `docs/data/` 與 `.omc/`）：

```
docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json        （東 RAW pointer）
docs/data/r7-3-10-xatlas-full-east-wall-1000spp-oidn-runtime-package.json   （東 OIDN pointer）
docs/tools/r7-3-10-full-east-wall-xatlas-phase2-prepare.py                  （東 prepare：北版 x↔z 鏡像）
docs/tools/r7-3-10-full-east-wall-xatlas-c2c-mask.py                        （東 c2c validity mask）
docs/tools/r7-3-10-full-east-wall-xatlas-package.mjs                        （東 package.mjs）
.omc/r7-3-10-full-east-wall-xatlas-phase2/20260615-012410/...               （prepare 中繼）
.omc/r7-3-10-xatlas-bake-spike/20260615-022106/...                          （東 RAW 烤製，bed-top cure 後）
.omc/r7-3-10-xatlas-bake-spike/20260615-022106-oidn-rt-high-beta/...        （東 OIDN）
```

---

## 2. 架構決策（案 B：堆疊單貼圖）

- 16-TIU 紅線：fragment shader 目前 **15 個** `uniform sampler2D`（已核：見 `shaders/Home_Studio_Fragment.glsl:8-51`），`MAX_TEXTURE_IMAGE_UNITS = 16`。任何新增 sampler 都會撞線變全黑。
- 因此 xatlas runtime **不開新 sampler**，沿用 R7-3.8 的 bake-atlas slot：
  - GLSL `r7310C1XatlasRuntimeSampleTexel`（`Home_Studio_Fragment.glsl:1229-1233`）以 `texelFetch(tR738C1BakeAtlasTexture, …)` 取樣。
  - JS 在 `xatlasApplied` 時把 `tR738C1BakeAtlasTexture.value` 指向 `r7310C1XatlasRuntimeDataTexture`（`js/InitCommon.js:3344-3345`）。runtime-xatlas／bake／paste-preview 三者互斥共用此 slot。
- 北（2325×3377）與東（2325×3945）堆疊成單張 **2325×7322** DataTexture：北段佔列 `[0,3377)`、東段佔列 `[3377,7322)`。常數見 `js/InitCommon.js:2629-2632`（`STACK_W=2325 / HN=3377 / HE=3945 / H=7322`）。
- 北、東各自的 worldPos→atlasUv 再依 `uR7310C1XatlasRuntimeStackedMode` 把 V 軸 remap 進自己那一段（細節見 §6 綠斑修正）。

---

## 3. 烤製產物與規格

### 東牆 RAW pointer：`docs/data/r7-3-10-xatlas-full-east-wall-1000spp-runtime-package.json`

```
runtimeScope            : c1_xatlas_full_east_wall_runtime
runtimeArchitecture     : single_xatlas_full_east_wall_phase2
packageDir              : .omc/r7-3-10-xatlas-bake-spike/20260615-022106
targetAtlasWidth/Height : 2325 × 3945
requestedSamples        : 1000（minCompletedSamples 1000、completedTiles 40、contextLostCount 0）
bakedRadianceKind       : indirect_diffuse_radiance（directLightAlreadyIncluded=false）
addDirectLightAfterBakeLookup : true
multiplyAlbedoAfterBakeLookup : true（albedo 烤後再乘，與北牆同架構）
uploadRowFlip           : false
alphaAudit              : alphaOne 6,331,424 / alphaZero 2,840,701 / alphaOneExactBlack 0 / maxDistance 4（上限 4）
```

### 東牆 OIDN pointer：`docs/data/r7-3-10-xatlas-full-east-wall-1000spp-oidn-runtime-package.json`

```
packageDir   : .omc/r7-3-10-xatlas-bake-spike/20260615-022106-oidn-rt-high-beta
sourcePackageDir : .omc/r7-3-10-xatlas-bake-spike/20260615-022106（＝上面 RAW）
denoise      : tool r7-3-10-oidn-bridge / filter RT / quality high / auxStrategy color_only_beta
               deviceUsed metal / version 2.4.1 / alphaPreserved true / passDecision pass
其餘欄位（dims/radianceKind/albedo 政策）與 RAW 相同。
```

> 註：兩個 pointer 的 `validation.status` 皆為 `fail`，但唯一未過項是 `gpu-submission-ms-over-250`（GPU 單次提交逾 250 ms 的效能門檻），`contentChecksPass=true`、`browserValidationStatus=pass`。此與北牆同型，屬 runner 效能告警，與烤圖內容正確性無關。`redLines` 全 false（未動正式 radiance bake、未改預設 pointer、未升 D800、未建 commit）。

### prepare／mask 工具（北版 x↔z 鏡像）

- `docs/tools/r7-3-10-full-east-wall-xatlas-phase2-prepare.py`：`WORLD_BOUNDS {x:1.91, yMin:0, yMax:2.905, zMin:-1.874, zMax:3.056}`、faceAxis x、faceSign −1、法線 −X、`EXPECTED_ATLAS {2325, 3945}`、800 texel/m 均勻密度。輸出的 rowFlippedRuntime UV 常數：`vAtZMin 0.0001267195 / vAtZMax 0.9998732573`（即 GLSL 東牆 V 用的 `mix(0.0001267195, 0.9998732573, z01)`）。
- `docs/tools/r7-3-10-full-east-wall-xatlas-c2c-mask.py`：per-texel 背面比例 validity（純幾何）；owner 排除 `z>=2.49 || y>=2.515`（衣櫃／樑遮蔽區）。owner 排除在 runtime 另做，mask 本身只負責幾何 validity。

---

## 4. GLSL 改動（`shaders/Home_Studio_Fragment.glsl`）

### 4.1 新 uniform（`:130-132`）

```glsl
uniform float uR7310C1XatlasRuntimeFullNorthWallMode;
uniform float uR7310C1XatlasRuntimeFullEastWallMode;   // 新增
uniform float uR7310C1XatlasRuntimeStackedMode;        // 新增
```

### 4.2 東牆 UV：`r7310C1XatlasFullEastWallUv`（`:1356-1396`）

與北牆 `FullNorthWallUv` 對稱。固定 `x=1.91`、自由軸 z/y、法線 −X。

```glsl
// guard：只依 uR7310C1XatlasRuntimeMode / Ready / FullEastWallMode（已移除對 EastWallDiffuseMode 的依賴）
// 命中判定：r7310C1RuntimeSurfaceIsEastWall(...)
// 範圍：y∈[-0.002,2.907]、z∈[-1.876,3.058]、abs(x-1.91)<=0.006
// 遮蔽：r7310C1EastWallHiddenByBeamOrSeColumn(z,y)
float y01 = clamp(visiblePosition.y / 2.905, 0.0, 1.0);
float z01 = clamp((visiblePosition.z + 1.874) / 4.93, 0.0, 1.0);
float stackedE = (uR7310C1XatlasRuntimeStackedMode > 0.5) ? 1.0 : 0.0;
float vScaleE = mix(1.0, 0.53817, stackedE);   // 堆疊時東段 V 比例（含 inset，見 §6）
float vOffE   = mix(0.0, 0.46176, stackedE);   // 堆疊時東段 V 起點（含 inset）
atlasUv = vec2(
    mix(0.9997849464, 0.0002150538, y01),                       // U＝worldY
    vOffE + mix(0.0001267195, 0.9998732573, z01) * vScaleE      // V＝worldZ remap 進東段
);
```

### 4.3 北牆 UV：`r7310C1XatlasFullNorthWallUv`（`:1319-1355`）

- 移除對 `NorthWallDiffuseMode` 的 guard 依賴（修正1：讓開關獨立於該牆烘焙鈕）。
- 堆疊時 V 比例改 `vScaleN`：

```glsl
float vScaleN = (uR7310C1XatlasRuntimeStackedMode > 0.5) ? 0.4608 : 1.0;  // 含 inset，見 §6
atlasUv = vec2(
    mix(0.9997849464, 0.0002150538, y01),
    mix(0.0001480604, 0.9998519421, x01) * vScaleN
);
```

### 4.4 wrapper 改非互斥（`:1411-1421`）

```glsl
bool r7310C1XatlasNorthWallUv(...) {
    // 北東可同時開：依命中面回各自 UV（兩面法線幾何互斥，順序試即天然並存）
    if (uR7310C1XatlasRuntimeFullEastWallMode > 0.5 && r7310C1XatlasFullEastWallUv(...)) return true;
    if (uR7310C1XatlasRuntimeFullNorthWallMode > 0.5 && r7310C1XatlasFullNorthWallUv(...)) return true;
    return r7310C1XatlasA1NorthWallUv(...);   // 兩者皆關時的舊 A1 路徑
}
```

### 4.5 東牆 bed-top 接觸邊 A-narrow cure（`:677, :691-695, :1747-1895`）

沿用既有 A-narrow cure 框架，新增第 4 條已確認接觸邊：

```glsl
const int   R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BED_TOP = 4;          // :677
const float ..._EAST_BED_TOP_PLANE_X = 1.910;   // 床東面與東牆共面     // :692-695
const float ..._EAST_BED_TOP_PLANE_Y = 0.280;   // 床頂高
const float ..._EAST_BED_TOP_Z_MIN   = -1.874;  // 床深度 z 範圍
const float ..._EAST_BED_TOP_Z_MAX   = -0.314;
```

- `r7310C1XatlasBakeCoplanarConfirmedLineId`（`:1747`）加東牆閘：`abs(y-0.28)<=PLANE_RADIUS && z∈[-1.874,-0.314]` → 回傳 LINE_EAST_BED_TOP。
- seam AABB（`:1821-1824`）= 東牆面上的接觸線；neighbor AABB（`:1851-1855`）= 床的 AABB。
- escape 方向由既有 `r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb`（`:1862`）依 seam＋neighbor 幾何自動推導，東 bed-top 得 `(0,+1,0)`（往床頂上方抬離），**escape 函式本身不動**。
- LIFT `0.000125`、PLANE_RADIUS `0.000625`（`:670-671`，沿用北牆值）。bake-only：只在烘焙 spawn point 生效，runtime 顯示零負擔。

### 4.6 東牆 hybrid 重複累加修正（`:6227, :6282, :6745-6746`）

東牆 hybrid first-hit 原先缺 `!xatlasFirstHit` 守衛（北牆 `:6217/6277` 本來就有），導致 east 同時被 xatlas 與 hybrid 各加一次。已對齊北牆守衛邏輯（`r7310EastWallHybridGuard = !r7310EastWallHybridFirstHit`），東 hybrid 與 xatlas 互斥。

---

## 5. JS／HTML 改動

### 5.1 `js/InitCommon.js`

```
:1524-1527  北 RAW/OIDN + 東 RAW/OIDN 四個 PACKAGE_URL const
:1561-1567  resolve()：?xatlasPackage=full-east-wall-raw / full-east-wall-oidn 路由
:2629-2638  堆疊常數（W/HN/HE/H）+ 狀態（StackedMode、North/EastVariant='off'、ReadyNorth/East、Buffer）
:3249-3263  uniform push：FullNorth/EastWallMode 各依 Active 旗標（可同時為 1）；
            StackedMode；AtlasSize 堆疊時 (2325,7322)，否則沿用 package dims
:3344-3345  xatlasApplied 時 tR738C1BakeAtlasTexture.value ← r7310C1XatlasRuntimeDataTexture（slot 重用）
:4469-4519  loadR7310C1XatlasStackedSegment(face, variant)：依 face×variant 選 URL、驗尺寸、
            首次配置 2325*7322*4 Float32Array、北段寫 off 0／東段寫 off 2325*3377*4、
            createR7310C1XatlasRuntimeTexture(buffer,2325,7322)、設 Ready/Active/variant
:4521-4549  r7310C1CycleXatlasStacked(face)：關閉→RAW→OIDN→關閉；關到雙牆皆空才退 StackedMode
:4550-4554  window.cycleR7310C1XatlasStackedNorth / East
:11197-11198, 12577-12578  report 兩處加 xatlasStackedNorthVariant / EastVariant
```

關鍵紀律：runtime 上傳一律 **不再 flip**（`:4497`，與既有 4416-4423 一致；row flip 已在 prepare 端的 rowFlippedRuntime 常數處理）。

### 5.2 `js/Home_Studio.js`

```
:5610-5611  pathTracingUniforms.uR7310C1XatlasRuntimeFullEastWallMode / StackedMode = {value:0.0}
:5331       demoFragmentShaderFileName = 'Home_Studio_Fragment.glsl?v=r7310-stacked-vboundary-inset-v6'
:6108-6199  refreshR7310SurfaceDiffuseButtons：兩顆鈕標籤「北/東牆真非方格：」+（oidn?'OIDN':raw?'RAW':'關閉'），非 off 時發光
:6214-6253  bind：自訂 click handler 呼叫 window.cycleR7310C1XatlasStackedNorth/East() 後 refresh
```

### 5.3 `Home_Studio.html`

```
:61  btn-r7310-non-square-atlas（既有）
:62  btn-r7310-xatlas-north-oidn「北牆真非方格：關閉」（新增，緊鄰烘焙鈕）
:63  btn-r7310-xatlas-east-oidn「東牆真非方格：關閉」（新增）
:340 InitCommon.js?v=r7310-per-wall-xatlas-rawoidn-v5
:342 Home_Studio.js?v=r7310-stacked-vboundary-inset-v6
```

開關語意（使用者拍板）：**關＝不顯示｜RAW＝真非方格未降噪（看得到髒斑質地，用來判別真非方格 vs 誤用方格 D800）｜OIDN＝真非方格已降噪**。全部確認正確後才會只保留 OIDN。

---

## 6. 三個根因修正（逐一）

### 修正① 東牆 bed-top 接觸邊硬梯度陰影
- 症狀：東北床頂（y=0.28 水平線）與東牆交界，東牆側有邊界硬梯度陰影；關閉東牆烘焙即消失（與北牆舊問題同型）。
- 修法：§4.5 的 A-narrow cure（bake-time spawn-point 抬離，escape 幾何自動推導）。
- 驗證：CPU diff 對照——cure 後接觸帶 +18% 亮度、控制區 byte-identical；重烤 RAW＋OIDN（即現行 `20260615-022106` 系列）。使用者肉眼：「黑線都消失了沒問題」。

### 修正② 東牆 hybrid 重複累加
- 症狀：eastMode=1 與 eastMode=0 視覺幾乎相同（東 xatlas 與 hybrid 同時累加，互相抵銷了開關效果）。
- 根因：east hybrid first-hit 缺 `!xatlasFirstHit` 守衛（北有東無）。
- 修法：§4.6 對齊北牆守衛。

### 修正③ 東牆 OIDN 近北角兩條綠色垂直光斑
- 症狀：東牆靠北牆那條邊出現兩條淡綠垂直光斑；RAW 無、OIDN 有；LIVE 無。
- 調查（CPU＋幾何）：牆上「固定 worldZ、跨 worldY 的垂直斑」對應 atlas 的「某一列」。東牆 z=−1.874（NE 角）的 native V≈0.000127，堆疊後 V≈0.46128，落在合成貼圖列 ≈3377.1——恰為北段 `[0,3377)`／東段 `[3377,7322)` 的交界列。`r7310C1XatlasRuntimeSampleValidLinear`（`:1234`）的雙線性取樣會取 p0=3376（北段末列）、p1=3377（東段首列），把北段內容混進東牆 NE 邊。CPU 掃東牆 OIDN atlas z 邊緣列 0–60 無綠色主導 texel → 綠來自交界混色（非烤圖本身）。RAW 因雜訊蓋住、OIDN 太乾淨才顯現；LIVE 不走合成貼圖故無此問題。
- 修法（內縮，僅改 3 常數）：北段 `vScaleN 0.4612127834→0.4608`；東段 `vOffE 0.4612127834→0.46176`、`vScaleE 0.5387872166→0.53817`。
- 內縮後映射核對（合成貼圖高 7322）：
  ```
  北段 V*7322 ∈ [~1.1, ~3373.4]    （native_v max 0.99985 × 0.4608）
  東段 V*7322 ∈ [~3381.3, ~7320.9] （0.46176 + native_v × 0.53817）
  交界列 3377 落在 3373.4 ~ 3381.3 的 ~8 列空檔中，雙線性兩個取樣點永不跨段。
  ```
  代價：北、東各內縮約 4 列邊緣。**CODEX 複查更正：東段 source row 0..3 仍有有效內容（alpha count=1797、有有效亮度），並非 padding；現行做法是犧牲東牆 zMin 端約 4 列可見邊緣，使用者肉眼驗收接受。** 若要零裁切，需另開 stacked segment gap／clamp sampling 設計。本修正零重烤、不動取樣鏈／JS／烤製／package。

---

## 7. 驗證紀錄

```
probe（mode 56）   ：北、東皆綠（xatlas 取樣命中），確認兩段都被取到。
CPU 幾何核實        ：東 worldX=1.91、法線 −X、atlas 2325×3945；bed-top cure diff +18%／控制區 identical；
                     東 OIDN atlas z 邊緣列無綠主導 texel。
sampler 計數        ：15（< 16 上限），堆疊未新增 slot。
肉眼（preview Chrome）：北 OIDN＋東 OIDN，NE 角放大→兩條綠斑消失、角落乾淨；shader 編譯無誤。
使用者驗收          ：黑線消失 ✓／UI 正常、RAW 質感正常 ✓／東 OIDN 綠斑修正後通過（本批送審觸發語：「東牆OIDN正常了」）。
```

烘焙面驗收紀律：本案屬 hybrid bake 面，與 LIVE 對照約 10 SPP 即可判讀，A–E 類 BUG 與 SPP 無關（未套 path tracing 的每相機 500 SPP 紀律）。

---

## 8. 尚未做／紅線狀態（請 CODEX 留意）

```
commit / push        ：未動（等使用者拍板；目前 4 檔 + docs/data + .omc 皆 working tree 未提交）。
預設 runtime pointer ：未改（東牆烤圖僅經 ?xatlasPackage 顯式查詢參數載入，defaultRuntimePointerChanged=false）。
D800 升級            ：未動。
其餘三面             ：西／南／天花板仍為方格 D800，尚未做真非方格（路線圖下一步）。
分支基底             ：本批疊在 codex/r7-3-10-arch-cure-blender-cycles-migration（arch-cure 系列）之上。
```

---

## 9. 請 CODEX 重點核實清單

```
[1] sampler 計數：確認新增堆疊路徑後 fragment shader 仍為 15 個 uniform sampler2D（未碰 16 上限）。
[2] V 內縮數學：核對 §6 三常數（0.4608 / 0.46176 / 0.53817）讓交界列 3377 落在兩段取樣空檔、雙線性 p0/p1 不跨段。
    【CODEX 已核：north row ~0.50–3373.48、east row ~3381.51–7320.99、gap ~8.03 列，成立。代價＝東牆 zMin 端
     約 4 列可見邊緣被裁（非 padding），肉眼驗收接受；零裁切另需 stacked segment gap／clamp sampling 設計。】
[3] 非互斥 wrapper：確認 r7310C1XatlasNorthWallUv 先試東、再試北、最後 A1，兩面同時開時不會互搶 UV。
[4] hybrid 守衛對稱：確認東 hybrid（:6227/6282/6745）的 !xatlasFirstHit 守衛與北（:6217/6277）等價，
    eastMode 開關時無重複累加、亦無漏算。
[5] bed-top cure 邊界：確認 east bed-top 的 z 範圍 [-1.874,-0.314]、PLANE_Y 0.28、escape 自動得 (0,+1,0)，
    且 bake-only（runtime 顯示路徑零負擔）。
[6] albedo 政策一致：東 RAW/OIDN package 的 multiplyAlbedoAfterBakeLookup=true、
    addDirectLightAfterBakeLookup=true、uploadRowFlip=false 與北牆同架構（避免再現 albedo 方向誤判）。
[7] OIDN aux 來源：確認東 OIDN dir 的輔助檔（texel-metadata / validation-report / c2c-alpha-report 等）
    皆自對應 RAW dir 複製、與北牆 OIDN dir 結構一致，finalize 無 ENOENT。
[8] 文件衛生：本報告與相關文件無 .cn 網域、無簡體、無不合專案語言規範用詞。【CODEX 已核】
```
