# R7-3.10 R4-2A 第一桌 — runtime 變體 patch plan（PLAN ONLY，未套 patch、未開 Chrome、未跑 GPU）

狀態：plan 交付。本文件只讀碼產出計畫；未套任何 patch、未開 Chrome、未跑 GPU、未接 west、未進 Phase 2C、未烤面、未回放 stash、未 commit/push。
目標：站起「單一 GLSL source + defines 變體」管線，先讓 **runtime 變體**排除已驗證 probe（家族 A）+ 可乾淨包裹的 bake-capture 區塊；debug / bake 變體保留同一份 code，靠 define 編出。
基準：HEAD `Home_Studio_Fragment.glsl` 7963 行、`js/PathTracingCommon.js`、`js/InitCommon.js`（行號為 HEAD 當前值，已對 clean-all 驗證集核對）。

---

## 1. 會改哪些檔案（四檔；BLOCKER 2 已修正）

```
A. shaders/Home_Studio_Fragment.glsl
   插入 #if defined(...) / #endif 包裹（不刪任何行；live 路徑零變動）
   + 兩個 compile-only controlled token（驗證預處理器排除生效，§6 BLOCKER 1）
B. js/PathTracingCommon.js
   插入 #if defined(R7310_INCLUDE_BAKE_CAPTURE) / #endif 包裹 main() 的 bake 射線區塊
C. js/InitCommon.js
   (1) bake material（:277-285）defines 加 R7310_INCLUDE_BAKE_CAPTURE
   (2) 新增 debug material lazy getter（mirror bake getter，帶 DEBUG_PROBES + BAKE_CAPTURE）
   (3) runtime material（:14690）維持 defines: pathTracingDefines（不含兩個新 define）
   (4) 選材守門：bake-mode 且需 RuntimeProbeMode 時改選 debug material（§4.4，MAJOR 1）
   (5) controlled token 兩個見證 uniform 註冊（值 0、runtime 無作用）
D. Home_Studio.html
   cache-buster 更新（glsl 變動需破快取，否則瀏覽器載舊 source 假陰性）
```

restore / diff / commit 一律以「四檔」為範圍（A+B+C+D）。
不改：registry / pointer / codegen / uniform 上架邏輯 / 任何 live radiance / hybrid / NEE / atlas 取樣 fanout。

---

## 2. 兩個 define 的語意（正向 include，採 CODEX 命名）

| define | 語意 | 預設值（不帶＝排除） |
|---|---|---|
| `R7310_INCLUDE_DEBUG_PROBES` | 帶＝編入所有 probe / 診斷區塊（家族 A atlas probe + bake-mode 診斷 probe + ShortCircuit probe 鏈）。不帶＝預處理階段移除、不進編譯 | runtime 不帶；debug 帶 |
| `R7310_INCLUDE_BAKE_CAPTURE` | 帶＝編入 bake 擷取生產路徑（bake 射線設定 + bake 表面點函式 + bake NEE shadow-ray 覆寫）。不帶＝移除 | runtime 不帶；bake 帶；debug 帶 |

每變體 define 矩陣：

```
runtime variant（正式播放）：    無新 define              → 排除 probe + bake-capture（最小、最大餘量）
bake variant（runner/capture）： R7310_INCLUDE_BAKE_CAPTURE → 含 bake-capture、無 probe
debug variant（probe/診斷）：    DEBUG_PROBES + BAKE_CAPTURE → 全含（等同今天的完整 shader）
```

備註：GLSL ES 3.00 預處理器支援 `#if defined(...)`；three.js ShaderMaterial 會把 `material.defines` 以 `#define NAME 1` 前置注入，被 `#if defined` 排除的區塊在編譯前移除（與 Unity shader variant 同機制）。V2/V3 compile smoke 驗證此機制在本專案 GL 環境成立。

---

## 3. 每個 material variant 的建立位置

```
runtime  = pathTracingMaterial               InitCommon.js:14690（createCommonVertexShaderMaterial, defines: pathTracingDefines）
           掛在 pathTracingMesh:14699，頁面載入即編譯（＝餘量受益的那一顆）
bake     = r7310BakeOnlyNoBorrowMaterial      InitCommon.js:277-285（lazy getter，defines Object.assign + R7310_BAKE_ONLY_NO_BORROW）
           本 patch 在此 defines 物件再加 R7310_INCLUDE_BAKE_CAPTURE
           選材已存在：shouldUseR7310BakeOnlyNoBorrowShader()→ pathTracingMesh.material 切換（:6762/6850/8287），
           且 useXatlasBakeMode 會強制切（:8260）→ lazy 編譯、不在載入時 eager
debug    = 【新增】getR7310DebugProbeMaterial()  lazy getter，mirror bake getter：
           defines: Object.assign({}, pathTracingDefines||{}, { R7310_INCLUDE_DEBUG_PROBES:1, R7310_INCLUDE_BAKE_CAPTURE:1 })
           只在 debug 工具要求時呼叫建立（lazy），不在頁面載入時編譯
```

確認：`pathTracingDefines`（:14671）目前只有 `R7310_RUNTIME_NO_BORROW_TEXTURE`（條件式），不含兩個新 define → 無撞名；runtime material 直接用 pathTracingDefines，故只要不把新 define 加進 pathTracingDefines，runtime 變體自然排除。

---

## 4. 哪些 GLSL 區塊包在哪個 define（精確行號，HEAD）

### 4.1 `R7310_INCLUDE_DEBUG_PROBES`（＝ clean-all 已驗證 R1 PASS_FULL 的 probe 集）

家族 A — atlas probe（各為獨立 `if(...){...break;}`，逐塊 `#if/#endif` 包裹）：
```
6600-6656、6657-6730、6731-6771、6772-6858、6859-6954、6955-7058、
7059-7119、7120-7198、7199-7206、7207-7242、7243-7271、7324-7372
```
家族 A — bake-mode 診斷 probe（gate 含 uR7310C1XatlasBakeMode>0.5 ＋ RuntimeProbeMode，屬「烤圖時診斷」，逐塊包裹）：
```
5183-5204、5271-5289、5343-5362、6512-6565（含 alias 6512 + 三塊連續 bake-mode probe 6513-6565）
```
ShortCircuit probe 鏈（塌縮式包裹）：
```
在 7377 之前插 #if defined(R7310_INCLUDE_DEBUG_PROBES)
在 7460（else 關鍵字那行）之後插 #endif
保留 7461 的 { accumCol += mask * r7310BakedRadiance; } 區塊原樣
→ runtime：該區塊變成無條件 braced block（合法 GLSL，與 clean-all 刪除後等效）
→ debug：完整 if/else-if/else 鏈
（clean-all 已證 7461 不引用 7377 的 probe 變數、7377-7460 純 probe）
```
alias 6512（`float r7310C1RuntimeProbeMode = uR7310C1RuntimeProbeMode;`）：**改為包入** DEBUG_PROBES（併進 6512-6565 區）。原 plan 寫「不包、靠 DCE」；改包的理由＝讓 uR7310C1RuntimeProbeMode 在 runtime 變體「零未受守的引用」，使它成為乾淨的 DEBUG_PROBES 編譯見證 uniform（§6 BLOCKER 1 active-uniform 反射）。已核：uR7310C1RuntimeProbeMode 的所有引用（113 宣告除外）皆在 5183-7460 的 probe 區塊內 + 6512 alias，全部落入 DEBUG_PROBES #if → runtime 變體零引用 → getUniformLocation 應回 null。

### 4.2 `R7310_INCLUDE_BAKE_CAPTURE`（bake 擷取生產路徑，皆單一呼叫點、邊界乾淨）

```
PathTracingCommon.js  3310-3352   main() 內 if (uR738C1BakeCaptureMode == 2) {...} 整塊（乾淨 if-block；
                                  其後 SetupScene()/相機路徑不受影響；相機 rayOrigin/rayDirection 已於 3304-3308 設妥）
glsl  471-<brace-match>           bool r738C1BakeSurfacePoint(...) 函式定義（唯一呼叫點 PTC:3345，在上面包裹塊內）
glsl  773-<brace-match>           bool r7310C1BakeSurfacePoint(...) 函式定義（唯一呼叫點 PTC:3344，在包裹塊內）
glsl  2109-<brace-match>          vec3 r7310C1XatlasBakeNeeShadowRayOrigin(...) 函式定義（唯一呼叫點 glsl:7762，在下面包裹塊內）
glsl  7760-7774                   if (uR7310C1XatlasBakeMode > 0.5) {... bake NEE shadow-ray 覆寫 ...} 整塊（乾淨 if-block）
```
（`<brace-match>` ＝由函式定義起始行做大括號配對找到的結束行；套用步驟以 brace-match 取得，避免硬編行號。）

### 4.3 明確「不可包、不可動」清單（誠實標註，避免 6490-6500 命名陷阱）

```
6490-6500   名為 ...IndirectBakeFirstHit 的 bool，實為 LIVE hybrid 述詞（餵 hybrid 延遲路徑）→ 不可包
6501-6505   r7310XatlasIndirectBakeFirstHit：bake-mode 值，但被 LIVE 程式於 7470 / 7505 / 7742 引用 → 不可包（留所有變體）
6506-6511   LIVE runtime atlas first-hit（正式顯示路徑）→ 不可包
7272-7281   FirstHit atlas 注入（mask * radiance，含 SeparatedAlbedo）→ 不可包
7282-7288   hybrid deferral → 不可包
7461        ShortCircuit 正式注入 accumCol += mask * r7310BakedRadiance → 保留
PTC 3263/3271  bake-aware fragCoord/seed 三元式 → 不包（runtime 取相機分支 byte-identical，trivial）
glsl 165-166   bake 全域變數初值 → 不包（runtime 未用，DCE）
所有 bake/probe uniform 宣告 → 不包（未用者 DCE；包裹宣告會造成 dangling reference 風險）
正式 NEE：sampleStochasticLightDynamic / pdfNeeForLight / sampleActiveLightSlot → 不可動
家族 B 雲朵燈 probe（uCloudMisWeightProbeMode/…）→ 本桌不碰，留 R4-2A-2
```

### 4.4 bake / debug 選材規則（MAJOR 1）

`DEBUG_PROBES`（含 RuntimeProbeMode 全套 probe，含 bake-mode 診斷 probe 5183/6513…）只在 debug 變體；bake 變體只帶 BAKE_CAPTURE、**不含任何 RuntimeProbeMode probe**。故選材規則必須明確：

```
production bake（無 probe）        → bake variant（BAKE_CAPTURE）
bake 時要跑 RuntimeProbeMode 診斷  → debug variant（DEBUG_PROBES + BAKE_CAPTURE；即「bake-debug」用途）
純 runtime 顯示                    → runtime variant（無 define）
```

選材守門（InitCommon.js，§1-C(4)）：現行 `useBakeOnlyNoBorrowShader = useXatlasBakeMode || shouldUse…`（:8260）會在烤圖模式選 bake material。R4-2A 後 bake material 已無 probe，故加守門：
```
if (烤圖模式 && uR7310C1RuntimeProbeMode > 0)  → 選 debug material（有 BAKE_CAPTURE + DEBUG_PROBES）
else if (烤圖模式)                              → 選 bake material（僅 BAKE_CAPTURE）
```
此守門確保「bake + probe 診斷」拿到含 probe 的程式，不會因為切到 bake material 而 probe 靜默消失（誤判 raw zero）。

### 4.5 compile-only controlled token（BLOCKER 1 預處理排除證據）

不以 getShaderSource / pathTracingFragmentShader 字串是否含 token 當證據（`#if` 包住的程式碼仍可能留在原始 source 字串）。改用「編譯期 active-uniform 反射」＋「受控見證 uniform」：

```
見證 1（DEBUG_PROBES）：uR7310C1RuntimeProbeMode（既有 uniform，6512 已併入 #if → runtime 零未守引用）
見證 2（BAKE_CAPTURE）：新增 compile-only 見證 uniform uR7310R42aBakeWitness（float），
                         僅在一個 BAKE_CAPTURE #if 區塊內引用一次（例：r7310C1XatlasBakeNeeShadowRayOrigin 內或 7760 區塊內）
                         JS 註冊為值 0、runtime 無作用；V1-V3 驗畢可隨清理 patch 移除（或保留作永久變體 regression 守門）

getUniformLocation 反射矩陣（編譯期證據，非字串）：
  runtime variant：getUniformLocation('uR7310C1RuntimeProbeMode')===null  且 getUniformLocation('uR7310R42aBakeWitness')===null
  bake variant   ：RuntimeProbeMode===null（probe 排除）              且 BakeWitness!==null（bake-capture 編入）
  debug variant  ：RuntimeProbeMode!==null                            且 BakeWitness!==null（兩者皆編入）
（WebGL getUniformLocation 對未編入/被預處理排除/DCE 的 uniform 回 null，非 -1；此為編譯結果反射，可靠證明預處理排除生效。）
```

---

## 5. 哪些 live 路徑保證不動（逐項）

```
· atlas 取樣 fanout：dispatcher r7310C1XatlasNorthWallUv → 各面 UV → SampleValidLinear → SampleTexel → texelFetch
· FirstHit 注入 7272-7281、ShortCircuit 7461、hybrid deferral 7282-7288、6490-6500 hybrid 述詞、6501-6511
· 正式 NEE 全鏈、積分器主迴圈、SceneIntersect / BVH / 交集原語、CalculateMovementPreview、SetupScene
· main() 相機射線（PTC 3290-3308）、SetupScene()/CalculateRadiance 呼叫（3354/3364）
全部以「只插 #if/#endif、不刪不改行內容」方式達成；live 行的位元組內容零變動。
```

---

## 6. V1–V5 驗證矩陣（命令 + 預期；本 plan 不執行，待簽核後跑）

CDP harness 配方（沿用 [[project_r7310_agent_harness_cdp_chrome_works]]）：專用 /tmp profile、獨立 port、真實 Chrome、零使用者 Console；測完只殺該 instance（不碰 Brave）。

```
V1 runtime variant baseline（核心驗收；BLOCKER 1 已改口徑）
  套：#if/#endif patch（§4）+ 兩個見證 uniform，不接 west；runtime material（無新 define）
  驗收門檻（四項，全過才算 PASS）：
    (a) 靜態包裹檢查：Node parser 確認 §4.1/§4.2 每個目標區塊都被 #if defined(...) / #endif 正確包住、配對無誤
        （這是「字串層」唯一允許的檢查——驗「有沒有正確包」，不是驗「字串看不看得到」）
    (b) define 矩陣：runtime material defines 不含 DEBUG_PROBES / BAKE_CAPTURE；debug/bake 含對應 define
    (c) 編譯期反射（取代 source token=0）：runtime program
          getUniformLocation('uR7310C1RuntimeProbeMode')===null
          getUniformLocation('uR7310R42aBakeWitness')===null
        ＝預處理器確實把兩區塊排除在編譯之外（active-uniform 反射，非字串）
    (d) CDP：PASS_FULL、samples 收斂 1000、contextLost=false、lostCount=0、overlayShown=false、
          shaderErr=false（getShaderInfoLog/getProgramInfoLog 無錯）、screenshot 非黑、場景肉眼正常
          現有 RAW/OIDN 面與 LIVE 對照約 10 SPP 不錯位（烘焙面判讀，禁套 500 SPP 累積）
  明確禁止：不以 getShaderSource() / pathTracingFragmentShader 字串「不含 probe/bake token」當排除證據。

V2 debug variant compile smoke
  套：建立 debug material（DEBUG_PROBES + BAKE_CAPTURE）
  預期：compile + link 成功（LINK_STATUS=true、無 shader/program infoLog 錯）；
        反射：getUniformLocation('uR7310C1RuntimeProbeMode')!==null（probe 確編入）
        過重可只驗 compile/link，不要求完整跑圖

V3 bake variant compile smoke（MAJOR 2：驗 symbol 不缺，不只 material 建立成功）
  套：強制 useXatlasBakeMode 或 window.__r7310BakeOnlyNoBorrow，建立 bake material（BAKE_CAPTURE）
  驗收門檻：
    (a) compile + link 成功：LINK_STATUS=true、getShaderInfoLog/getProgramInfoLog 無錯
        ＝「呼叫存在但函式未定義」會在 link 階段報 missing symbol；link 成功即證下列被呼叫函式都同時存在：
          · main() bake ray block（PathTracingCommon.js）的 r738C1BakeSurfacePoint / r7310C1BakeSurfacePoint 呼叫與定義
          · glsl:7760 區塊的 r7310C1XatlasBakeNeeShadowRayOrigin 呼叫與定義
    (b) 反射：getUniformLocation('uR7310R42aBakeWitness')!==null（bake-capture 確編入）
            getUniformLocation('uR7310C1RuntimeProbeMode')===null（bake variant 不含 probe，符合 §4.4）
    (c) 不要求正式烤面，只驗 compile/link/symbol/uniform。

V4 runtime variant + west-U1（餘量量尺）
  套：§4 patch + west-U1（apply-subtest，west 錨點全 <5183，與包裹區不衝突）
  預期：NO LOSS（≥ clean-all R2；clean-all 僅去 probe 即 U1 NO LOSS，本桌另去 bake-capture 餘量更大）

V5 runtime variant + west-S5（完整 west）
  前置：僅 V4 NO LOSS 才跑
  套：§4 patch + west-S5
  量：clean-all R3（僅去 probe）為 LOSS；本桌另去 bake 表面點函式等 bake-only 重量，west-S5 是否轉 NO LOSS＝關鍵新數據
```

---

## 7. 還原方式

```
patch 期間（未 commit）：
  git restore shaders/Home_Studio_Fragment.glsl js/PathTracingCommon.js js/InitCommon.js Home_Studio.html
  → 回到 byte-identical HEAD
west 測試（V4/V5）：west 僅以 apply-subtest 暫套於工作區，測後 git restore；west 絕不 commit
驗證暫存：/tmp/r7310-harness-r42a-V*.json、/tmp/r7310-shot-r42a-V*.png
Chrome：pkill -f "<該 instance 專用 user-data-dir 唯一字串>"（絕不碰 Brave、不 broad pkill）
全程不 commit/push，待 V1-V5 結果交 CODEX 簽核後再決定。
```

---

## 8. 風險清單

```
R1 命名陷阱：6490-6505 名含 BakeFirstHit 但屬 LIVE/被 live 引用 → 已列「不可包」清單，套用步驟須逐行核對 gate 與引用點
R2 ShortCircuit 塌縮：#if 須包到 7460 的 else 關鍵字、保留 7461 block，否則 dangling else / 重複注入 → 已驗 clean-all 等效
R3 brace-match：三個 bake 函式結束行以大括號配對求得，套用前須驗證配對正確（避免少包/多包）
R4 預處理器：GLSL3 #if defined 支援與 three.js defines 注入須由 V2/V3 compile smoke 證實
R5 eager 編譯：bake/debug material 必須 lazy（已存在 lazy getter；debug getter 比照）→ 避免載入時編多顆大 program 反觸發 LOSS
R6 首次重編譯：任何 glsl 編輯 → M4 Metal 全量重編譯凍結（fail-safe a496054 覆蓋），一次性開發成本，不可避免
R7 餘量未達：V5 west-S5 仍可能 LOSS（probe+bake 仍不足）→ 停損規則導向 R4-2A-2 家族 B
R8 cache-buster：glsl 變動務必同步更新 Home_Studio.html cache-buster，否則瀏覽器載舊 source 假陰性
R9 getShaderSource 誤用（BLOCKER 1，已修）：#if 排除＝預處理器編譯期排除，原始 source 字串仍可能含被 #if 包住的程式碼；
   不可用 getShaderSource/pathTracingFragmentShader 不含 token 證明排除 → 改用 §4.5 active-uniform 反射 + 見證 uniform
R10 見證 uniform 收尾：uR7310R42aBakeWitness 為 compile-only scaffolding；V1-V3 過後以清理 patch 移除，或明確保留作永久變體 regression 守門（擇一、需記錄）
R11 bake-debug 選材（MAJOR 1）：bake variant 無 probe；任何依賴 RuntimeProbeMode 的 bake 診斷必須走 debug variant，否則 probe 靜默消失誤判 raw zero（§4.4 守門）
```

---

## 9. 停損規則（依 CODEX 裁示）

```
V1 runtime baseline fail：    停，不測 west（runtime 分流本身壞）
V2 / V3 compile fail：        停，先修 variant 管線（define 注入 / 包裹邊界）
V4 west-U1 loss：             停，進 R4-2A-2 家族 B preflight
V5 west-S5 loss：             回報「第一桌 runtime 分流仍不足」，下一步列家族 B（雲朵燈 probe）逐點包裹清單
V1 PASS + V4 NO LOSS + V5 NO LOSS： 第一桌成功且 runtime 變體已足以承載完整 west → 交 CODEX 簽核是否進 west 正式接線
```
