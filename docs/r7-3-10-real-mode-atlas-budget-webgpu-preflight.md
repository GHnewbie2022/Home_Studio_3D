# R7-3.10 趨近真實模式 Atlas 預算 + WebGPU 架構試算 Preflight

本文性質：read-only 架構試算，不是動工。資料來源＝ultracode workflow（5 recon + 1 calc + 2 adversarial verify）＋ 實機 gl limits 量測。每個數值附 file:line 或量測來源；不確定處標 UNKNOWN，不臆造。

紅線（本輪全守）：不重烤、不改 shader、不改 JS runtime、不改 pointer、不 commit、不 push、不碰 Brave。僅讀碼、實機查 gl 參數（建臨時 canvas，未碰主 renderer）、試算、寫本報告。

CODEX 初步推論（append 4650×11758、packed 6594×7645）僅作對照；本文一律以程式碼實際常數與實機量測重算。

---

## 0. 實機平台基準（M4 Pro，本輪量測）

透過 localhost:9006 preview 建臨時 webgl2 context 查得（renderer 字串 ANGLE Apple M4 Pro）：

```
MAX_TEXTURE_SIZE             16384    貼圖單邊上限（決定 atlas 版面是否爆掉）
MAX_TEXTURE_IMAGE_UNITS      16       fragment sampler 硬限（path tracer 瓶頸）
MAX_COMBINED_TEXTURE_IMAGE_UNITS  32  vertex+fragment 合計；path tracer 全在 fragment，無助益
MAX_ARRAY_TEXTURE_LAYERS     2048     ★WebGL2 貼圖陣列層數上限（每層須同寬同高同格式）
MAX_3D_TEXTURE_SIZE          2048
MAX_RENDERBUFFER_SIZE        16384
navigator.gpu (WebGPU)       true     瀏覽器支援 WebGPU（本專案仍用 WebGLRenderer）
UNMASKED_RENDERER            ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)
```

信心：confirm（實機直接量測）。`MAX_TEXTURE_SIZE=16384` 同時被程式碼 `renderer.capabilities.maxTextureSize`（js/InitCommon.js:4767-4774）在 runtime 查詢比對，非寫死常數，故本值是「此機實測」而非規格假設。

---

## 1. 現況基準

### 1.1 master atlas 版面（append，js/InitCommon.js:4650-4654）

目前 5 個 sub-rect 垂直往下接（append），4px gutter，定義於 `R7310_C1_XATLAS_MASTER_RECT`（js/InitCommon.js:4656-4662），runtime uniform 設於 js/InitCommon.js:3289-3327，shader 宣告於 shaders/Home_Studio_Fragment.glsl:125-134。

```
master 總尺寸（800）= 4650 × 11758 px
  W = max(4265, 2325+2325) = 4650
  H = 3377 +4+ 3945 +4+ 160 +4+ 4264 = 11758
```

### 1.2 五面 sub-rect 實測（皆約 800 texel/m 等向）

★ 更正（CODEX 初審 BLOCKER 1）：本表前一版把像素軸與世界軸配反，誤寫成 ceiling/north/east「非 800/壓縮」。經 shader UV 函式核實（每面像素橫/縱各對哪個世界分量），五面其實都是約 800 texel/m 等向。各面 atlas 軸向不同（xatlas 依 chart 轉向），故須照正確軸向除世界長度，不可用 worldWidth/worldHeight 直接配像素寬/高。

```
面        px(800版)     橫軸→world     縱軸→world     texel/m      shader 軸向來源
ceiling   4265×3377     worldZ 5.33    worldX 4.22    800/800      glsl:1474,1495-1500
north     2325×3377     worldY 2.905   worldX 4.22    800/800      glsl:1358-1364
east      2325×3945     worldY 2.905   worldZ 4.93    800/800      glsl:1410-1417
H2        1952×160      worldX 2.44    worldZ 0.20    800/800      glsl:1534-1535
floor     3376×4264     worldX 4.22    worldZ 5.33    800/800      glsl:1573-1574
```

驗算：4265/5.33=800.2、3377/4.22=800.2、2325/2.905=800.3、3945/4.93=800.2、1952/2.44=800.0、160/0.20=800.0、3376/4.22=800.0、4264/5.33=800.0。五面等向 800，無壓縮面。「趨近真實＝目前的 2× 線性」對五面一致成立。信心：confirm（shader glsl:1358-1500 直接核實）。

### 1.3 格式與 metadata（recon format-meta，verify confirm）

```
RAW atlas      RGBA32F，16 bytes/texel
metadata       12 floats/texel = 48 bytes/texel
               來源：runner expectedMetadataBytes = W×H×12×4
                    (docs/tools/r7-3-8-c1-bake-capture-runner.mjs:1240,1749)
壓縮格式        codebase 零使用（grep RGBA16F/RGBE/KTX2/BC/ASTC/ETC 無命中，排除 three.js min）
floor 校準      3376×4264 → RGBA32F 219.65 MB、metadata 658.96 MB
               對齊 .omc validation-report 實檔 219.7M / 659M（verify confirm）
```

---

## 2. C1A shell 容量試算（800 vs 1600）

公式錨點：`RGBA32F bytes = W×H×16`、`metadata bytes = W×H×48`；1600 = 800 的線性 2 倍 → 每維像素 ×2、總像素 ×4、記憶體 ×4。MB 用 1 MiB=1024²、GB 用 1024 MiB。

### 2.1 五面尺寸/記憶體（800 → 1600）

```
面        800 px        1600 px        RGBA32F 800→1600   metadata 800→1600
ceiling   4265×3377     8530×6754      219.8 → 879.1 MB    659.3 → 2637.3 MB
north     2325×3377     4650×6754      119.8 → 479.2 MB    359.4 → 1437.7 MB
east      2325×3945     4650×7890      140.0 → 559.8 MB    419.9 → 1679.5 MB
H2        1952×160      3904×320         4.8 →  19.1 MB     14.3 →   57.2 MB
floor     3376×4264     6752×8528      219.7 → 878.6 MB    659.0 → 2635.9 MB
```

### 2.2 master 版面在 1600 是否爆 16384

```
append  800: 4650×11758  → 1600: 9300×23516   ❌ 高 23516 > 16384 → 1600 不可行
packed  800: 6594×7645   → 1600: 13188×15290  ✓ 兩維 < 16384 → 1600 可行
```

`packed 6594×7645` 為 deploy-safe 兩欄重排，註記於 js/InitCommon.js:4646-4648。信心：confirm（verify size-math 逐項核對，2× 線性與 16384 比較皆正確）。

結論：趨近真實（1600）必須走 packed 兩欄版面，append 單張在 1600 直接撞破貼圖上限。

### 2.3 VRAM

```
單張 packed 1600 master（RGBA32F）= 13188×15290×16 ≈ 3.08 GB
```

信心：confirm。對照 CODEX「packed 約 3GB」＝此單張 master 數字（非全室總和；兩者語意不同，見 §3.3）。

---

## 3. surfaces 盤點：已完成 vs 待補（CODEX 初審 MAJOR 修正：拆兩類避免重複計算）

★ 前一版把 north/east 的 addBox 細片混進「剩餘要烤的面」，易被讀成 39 面待補、且與已完成的整面 atlas 重複計算。實際 ceiling/north/east/H2/floor 已由 C1A 五面整面 atlas 完成；north/east 的組成 box（北牆西段/東段/門洞補丁、東牆全段）已被各自整面 atlas 涵蓋，改列為 §3.scenario、不計入待補。

### 3.A 已完成（C1A 五面）

ceiling / north / east / H2 / floor，皆 800 等向（§1.2）。floor 官方包 164025 上架；ceiling/north/east/H2 併入 master。1600 尺寸/記憶體見 §2.1。

### 3.B 待補 / 可能重切 surfaces（world 尺寸 confirm，js/Home_Studio.js；像素＝均勻 800 假設，1600=×2）

實際若沿用整面 planar 或經 page planner 重切，像素與記憶體可能與此均勻假設不同。shell 類（south/west/beams/columns/doors，11 面）：

```
類別      面                  world(m)       1600 px       RGBA32F(1600)
south     南牆西段(窗西)       1.91×2.905     3056×4648     216.7 MB
south     南牆東段(窗東)       2.42×2.905     3872×4648     274.6 MB
south     南牆中段窗台下       1.44×1.04      2304×1664      58.5 MB
west      西牆北段鐵門上方     1.91×0.865     3056×1384      64.5 MB
west      西牆北段鐵門門坎     1.91×0.09      3056×144        6.7 MB
west      西牆南段主體         1.91×2.905     3056×4648     216.7 MB
beams     西牆頂部橫樑         0.16×0.38       256×608        2.4 MB
beams     東牆頂部橫樑(北半)   0.20×0.39       320×624        3.0 MB
columns   西南角垂直柱         0.16×2.905      256×4648      18.2 MB
columns   東南角垂直柱         0.18×2.905      288×4648      20.4 MB
doors     北牆木門 depth shell 0.79×2.03      1264×3248      62.6 MB
doors     西牆鐵門 depth shell 0.89×1.95      1424×3120      67.8 MB
```

注意：beams/columns 是否已被相鄰整面 atlas（east/west 主面）部分涵蓋，待 page planner 核；此處先全列、寧多估。south/west 主面是真待補（C1A 未含）。

### 3.B（續）objects（C1B：家具 / 喇叭，8 面）

```
面              world(m)       1600 px       RGBA32F(1600)
東牆櫃子         0.56×1.955      896×3128      42.8 MB
南方系統木桌     2.93×0.14      4688×224       16.0 MB   ← 極端長寬比
西南角抽屜       0.855×0.61     1368×976       20.4 MB
東南角書櫃       0.76×2.04      1216×3264      60.6 MB
工作桌           1.20×0.757     1920×1212      35.5 MB
KH150 左喇叭     0.225×0.345     360×552        3.0 MB
KH150 右喇叭     0.225×0.345     360×552        3.0 MB
KH750 超低音     0.33×0.383      528×612        4.9 MB
```

### 3.B（續）panels（吸音板 15 片，各 0.6×1.2m，每片 1600 = 960×1920 = 28.1 MB）

天花 GIK Cloud 6 片（js/Home_Studio.js:180-185）+ 西/東牆白色各 3 片 + 北牆灰色 3 片（docs/SOP/R2：所有幾何物件.md:503-519）。小計 15 × 28.1 ≈ 421.9 MB（1600 RGBA32F）。

### 3.scenario（north/east 細片：已被 C1A 整面 atlas 涵蓋，不計入待補）

```
細片                world(m)      已含於     1600 px(若未來 per-box 重切)
北牆西段(門洞以西)   1.91×2.905    C1A north  3056×4648
北牆東段(門洞以東)   2.84×2.905    C1A north  4544×4648
北牆門洞上方補丁     0.79×0.875    C1A north  1264×1400
東牆全段             0.20×2.905    C1A east   320×4648
```

這 4 面屬 north/east 整面 atlas 已涵蓋範圍。僅未來若改 per-box atlas 重切策略才需獨立計列，**不計入 §3.C 容量帳**（避免與已完成整面重複，即 CODEX 點名的重複計算問題）。

### 3.C 容量帳（1600 上界，已排除 north/east 細片重複）

```
已完成 C1A 五面（§2.1 加總）    RGBA32F ≈ 2.75 GB    metadata ≈ 8.25 GB
待補 B(shell+objects+panels)   RGBA32F ≈ 1.58 GB    metadata ≈ 4.74 GB
全室 A+B（非重複上界）          RGBA32F ≈ 4.33 GB    metadata ≈ 12.99 GB
單張 packed 1600 master(VRAM)   ≈ 3.08 GB（同時駐留實況，遠低於上界總和）
```

修正說明：前一版 §3.4 列「44 面 4.91 GB」含 north/east 整面與其 addBox 細片重複計入（約 0.58 GB）。本版改以「已完成五面 + 待補 B」非重複加總。上界＝各面獨立同時駐留；實際打包共用、互斥綁定、單一時刻只綁一張 master，runtime 同時 VRAM 遠低於此。信心：calc 各面 confirm，A+B 重整總量為 OPUS 手算（已標約）。

UNKNOWN：待補面實際烘焙狀態與是否真以均勻 800 烤；beams/columns 是否已被相鄰整面涵蓋；極端長寬比面（木桌 4688×224 等）打包 gutter 浪費未估。

---

## 4. sampler / slot 預算

### 4.1 現況（recon sampler + verify platform）

```
MAX_TEXTURE_IMAGE_UNITS = 16（js/InitCommon.js:14411 runtime 查詢比對）
active = 16/16 零空位（docs/r7-3-10-master-atlas-future-consensus-for-opus.md:405）
  · 14 常駐 fragment sampler（shaders/Home_Studio_Fragment.glsl:8-51）
  · 2 來自 PathTracingCommon.js（tPreviousTexture、tBlueNoiseTexture）
  · tBorrowTexture 已因 TIU≤16 條件停用（再插就破 16）
  · 3 個烤圖 atlas 變體靠執行模式互斥共用 slot
    (tR738C1BakeAtlasTexture / tR7310C1FullRoomDiffuseAtlasTexture / ...NonSquare)
```

renderer = `THREE.WebGLRenderer` + webgl2 context（js/InitCommon.js:14400）。信心：confirm。

### 4.2 多 page 判斷

若 C1A shell 1/2/3 page + C1B object page（4 個新 page）各自要求獨立常駐 sampler slot → 推過 16 → GLSL program invalid → 3D 全黑（已記錄失效模式：超 16 TIU 是根因、feedback-loop 是煙霧）。

`MAX_ARRAY_TEXTURE_LAYERS = 2048`：WebGL2 的 `sampler2DArray` 是「多 page 綁單一 sampler」的**候選解法**——它解的是 sampler「數量」問題（多 page 共用一個 slot），不是萬靈丹。三個硬條件（CODEX 初審 BLOCKER 2，page planner 必須先定）：

```
1. 同尺寸層：array texture 每一層必須同寬、同高、同格式。
   不能把 4265×3377、2325×3945、3376×4264 這些任意尺寸直接塞成不同大小的 layer。
   必須先選固定 page 尺寸（如 4096×4096 或 8192×8192）、把各面打包進去。
2. 不降像素量：sampler2DArray 只省 sampler slot，
   記憶體、載入時間、GPU texture 尺寸照算不變（固定 page × 層數 = 總 VRAM）。
3. 2048 是規格上限、非實務可用層數：
   實際可用層數由 GPU RAM、JS buffer、載入時間、正式壓縮格式決定，遠少於 2048。
```

故結論不是「多 page 問題已解」，而是：sampler 數量瓶頸 WebGL2 有候選解，但 page planner 必須先決定固定 page 尺寸、層數、格式與記憶體預算才能定案。可撐住的前提仍是：新 page 走 sampler2DArray 或併入 master sub-rect、絕不各占新獨立 slot。UNKNOWN：固定 page 尺寸選型、各 page 上線後 runtime 同時綁定數，須實機量測。

---

## 5. runtime 格式策略

```
bake / validation / archive   維持 RGBA32F（HDR 精度、烤製與驗證需要）
正式瀏覽 runtime              建議改壓縮：
  · RGBA16F：精度足夠、記憶體砍半（1600 master 3.08GB → ~1.54GB）
  · KTX2(BasisU / UASTC)：更省、但需確認 HDR/線性與光色契約相容
```

光色契約硬約束（不可破）：烤圖仍必須是 albedo-free indirect radiance，runtime 只乘一次材質 albedo。任何壓縮格式不得破壞此契約（壓 HDR 線性值、非 sRGB 色彩）。UNKNOWN：KTX2 HDR 管線在本 path tracer 的相容性未驗。

---

## 6. metadata 策略

1600 下 metadata 達 14.72 GB 級（48 bytes/texel）。建議 SOP：

```
1. 分塊產生（runner 已支援 tile bake，metadata 跟著分塊輸出）
2. 分塊驗證（逐 tile validation，不需整檔載入）
3. 不常駐 runtime（metadata 僅供 bake/驗證/reprojection；runtime 只需 atlas）
4. 只保存 validation 摘要（status/validTexelRatio/luma/alphaExclusion 等），
   原始 12-float/texel 二進制留 archive、不進正式部署
```

依據：runtime package 的 artifacts 只引 atlas + texel-metadata + validation-report，正式瀏覽 runtime 不需 metadata 常駐。

---

## 7. WebGPU 評估

```
WebGPU 能改善：
  · binding 彈性遠大於 16 sampler（bind group、不受 TIU 限）
  · storage buffer 原生（metadata 放 storage、不佔貼圖 slot）
  · texture array / 大貼圖管理原生
  · compute shader（bake/denoise 可搬上 GPU、不再靠 headless 烤）
  · streaming / page-based atlas runtime 更自然
WebGPU 不能解決（物理量、換 API 也不變）：
  · 像素量 4×、GPU RAM 總量、載入時間、正式資產大小
關鍵（語氣校準，CODEX v2 裁示）：sampler slot 這個首要瓶頸，可先用 WebGL2
  sampler2DArray 原型驗證；若 page planner / binding / streaming / compute 需求
  超出 WebGL2 能力，再開 WebGPU 支線。
  WebGL2 array＝先驗路線；WebGPU＝保留支線——目前不當立即主線，也不提前排除。
WIP 驗收前提：WebGPURenderer + TSL 仍可 localhost / Console / 截圖 / RAW-OIDN-LIVE 切換，
  但 path tracer 的 GLSL 要全改寫 TSL/WGSL（大工程、整機線路重畫）。
參考（國際版）：
  WebGL2 sampler2DArray — https://registry.khronos.org/webgl/specs/latest/2.0/
  WebGPU — https://www.w3.org/TR/webgpu/
  three.js WebGPURenderer/TSL — https://threejs.org/docs/
```

---

## 8. 決策建議（CODEX 初審第 4 點：先 planner + prototype、後續烤）

```
順序硬約束：page planner + sampler2DArray prototype 通過後，才繼續剩餘快速預覽烘焙。
            別在 planner 定案前續烤，否則進 1600 必然重排/重包/改 pointer = 重工。

1. page planner（先行）：定固定 page 尺寸、層數、格式、記憶體預算；
   據此決定 C1A shell / C1B object 各放幾個 array、每 array 幾層。
   密度錨點＝五面皆 800 等向（§1.2 已更正），待補面亦以 800 規劃。
2. sampler2DArray prototype（先行）：WebGL2 下驗「多 page 綁單一 sampler」的
   sampler 壓力 + 同尺寸層 + 記憶體；範圍限壓測，不搬 path tracer。
3. 剩餘快速預覽烘焙（prototype 通過後）：照 packed + page planner 擺法續烤
   south/west/beams/columns/doors/objects/panels，別再往 append 單張堆。
4. 版面：1600 必走 packed（append 1600 高 23516 超 16384）。
5. 格式：bake/archive 維持 RGBA32F；runtime 短期 RGBA16F、KTX2/HDR 另列研究項。
6. metadata：分塊產/驗、不常駐 runtime、只留 validation 摘要。
7. WebGPU：暫不開大支線；待需 GPU-side compute bake/denoise，
   或 binding 需求超出 WebGL2 array 能力，再評估。
```

---

## 9. 待 CODEX 審查項 + UNKNOWN + 紅線

### 9.1 CODEX 初審裁示（已落實本版修正）

```
A. 剩餘面照 packed + page planner 擺法：ACCEPT（page planner 須先修密度與 array 條件，已修）
B. WebGL2 sampler2DArray 多 page 最小原型：ACCEPT（範圍限 sampler/page 壓測、不搬 path tracer）
C. runtime 格式：先走 RGBA16F 作短期候選；KTX2/HDR 另列研究項
D. metadata SOP（分塊產/分塊驗/不常駐/只留摘要）：ACCEPT
E. C1A/C1B page 數：HOLD，等 page planner 修正後再定
```

### 9.2 UNKNOWN（未硬補）

```
· tBlueNoiseTexture 解析度與 VRAM、各 atlas 實際 GPU VRAM 成本
· 待補面（§3.B）實際烘焙狀態與是否真以均勻 800 烤（像素為均勻假設）
· 待補面（§3.B）若未來改非整面或非均勻 800 策略，像素/記憶體會與本均勻假設不同
· 極端長寬比面打包浪費未估
· 各 page 上線後 runtime 同時綁定 sampler 數（須實機量測）
· packed 6594×7645 是否已含待補面（§3.B）（recon 僅證五面 master）
· KTX2 HDR 管線在本 path tracer 的相容性未驗
```

### 9.3 資料品質註記

```
workflow：8 agent（5 recon + 1 calc + 2 verify）；webgpu recon agent 漏呼叫
StructuredOutput 失敗，renderer 資訊由 verify:platform agent 補齊（confirm）。
verify size-math：12 項 confirm（尺寸公式、16384、VRAM 占比皆核實）。
verify platform：MAX_TEXTURE_SIZE 16384 原為 uncertain（碼查 device limit 非寫死），
  經 §0 實機量測 M4 Pro 確認 16384，已升 confirm。
```

### 9.4 CODEX 初審後修正記錄（v2）

```
BLOCKER 1（密度判讀）：前版把像素軸與世界軸配反、誤寫 ceiling/north/east「非 800/壓縮」。
  經 shader UV 函式核實（glsl ceiling:1495-1500、north:1358-1364、east:1410-1417、
  H2:1534-1535、floor:1573-1574），五面皆約 800 等向。§1.2 已撤回非均勻說法、附驗算。
MAJOR（重複計算）：§3 把 north/east 細片混進待補、與整面 atlas 重複計入容量。
  已拆 3.A 已完成 / 3.B 待補 / 3.scenario（north/east 細片）；§3.C 容量帳改非重複
  A+B 加總（4.33 GB，前版 4.91 GB 含約 0.58 GB 重複）。
BLOCKER 2（sampler2DArray 過樂觀）：§4.2 補三硬條件（同尺寸層/不降像素量/2048 非實務可用），
  改寫為「候選解法、page planner 須先定 page 尺寸層數格式記憶體」、不再寫成「問題已解」。
§8 決策：改為「先 page planner + prototype、後續烤」順序硬約束。
```

### 9.5 紅線（本輪）

本輪只讀碼 + 實機查 gl 參數 + 試算 + 寫/修本報告。未重烤、未改 shader/runtime/pointer、未 commit、未 push、未碰 Brave。本報告（含 v2 修正）仍未 commit，等 CODEX 複審後再定歸檔。
