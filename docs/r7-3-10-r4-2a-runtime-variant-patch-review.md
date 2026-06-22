# R7-3.10 R4-2A 第一桌 — 正式 patch review 包（V1–V5 全綠；未 commit，待 CODEX / 使用者簽）

分支：codex/r7-3-10-remaining-surfaces-xatlas
最終分支結論：**R4-2A 成功，可 review**。五項驗證全綠，且 runtime 變體已足以承載完整 west（V5 NO LOSS）。
紅線：未 commit / push、未正式接 west（west 僅 V4/V5 暫測、測後已還原）、未進 Phase 2C、未烤面、未改 registry / pointer、stash 保留。

---

## 1. 四檔 diff 摘要

```
git diff --stat HEAD：
 Home_Studio.html                  |  6 +++---   （cache-buster ×3：PathTracingCommon.js 新增、InitCommon.js、Home_Studio.js）
 js/InitCommon.js                  | 36 +++++--   （debug material 變數 + bake define + debug getter + 守門 helper + 3 處選材接線）
 js/PathTracingCommon.js           |  2 ++       （main() bake ray block 包 #if BAKE_CAPTURE）
 shaders/Home_Studio_Fragment.glsl | 24 ++++++   （DEBUG wraps〔相鄰 Batch A 已合併〕+ 4 BAKE wraps + 見證 uniform 宣告 + keep-alive；空 no-op pair 已清，見 §11）
 4 files changed, 61 insertions(+), 7 deletions(-)
```

逐檔內容：
```
A. Home_Studio_Fragment.glsl（只插 #if/#endif，不刪不改 live 行）
   · 17 個 #if defined(R7310_INCLUDE_DEBUG_PROBES) 包裹（家族 A probe + bake-mode 診斷 probe + ShortCircuit 鏈）
     範圍：5183-5204 / 5271-5289 / 5343-5362 / 6512-6565 / 6600-6656 / 6657-6730 / 6731-6771 /
           6772-6858 / 6859-6954 / 6955-7058 / 7059-7119 / 7120-7198 / 7199-7206 / 7207-7242 /
           7243-7271 / 7324-7372 / 7377-7460（ShortCircuit 鏈，保留 7461 live 注入）
   · 4 個 #if defined(R7310_INCLUDE_BAKE_CAPTURE) 包裹：
     r738C1BakeSurfacePoint(471-489)、r7310C1BakeSurfacePoint(773-1152)、
     r7310C1XatlasBakeNeeShadowRayOrigin(2109-2123)、bake NEE shadow-ray 區塊(7760-7774)
   · 見證 uniform：uniform float uR7310R42aBakeWitness;（宣告，runtime 無作用）
     + keep-alive：if (uR7310R42aBakeWitness < -0.5){ rayOrigin += vec3(1.0); }（在 7760 BAKE 區塊內）
B. PathTracingCommon.js
   · main() 的 if (uR738C1BakeCaptureMode == 2){...}（3310-3352）包 #if defined(R7310_INCLUDE_BAKE_CAPTURE)
C. InitCommon.js
   · let r7310DebugProbeMaterial = null;
   · bake material defines += R7310_INCLUDE_BAKE_CAPTURE
   · 新增 createR7310DebugProbeMaterial()（lazy，DEBUG_PROBES + BAKE_CAPTURE）
   · 新增 createR7310BakeCaptureMaterial(useBakeOnlyNoBorrowShader)（MAJOR 1 守門）
   · 3 處選材接線：useBakeOnlyNoBorrowShader ? createR7310BakeOnlyNoBorrowMaterial() : null
                  → createR7310BakeCaptureMaterial(useBakeOnlyNoBorrowShader)
D. Home_Studio.html
   · PathTracingCommon.js 新增 cache-buster；InitCommon.js / Home_Studio.js cache-buster → ?v=r7310-r42a-split-variant-v2
```
驗證工具（不入 git）：/tmp/r7310-apply-r42a.mjs（套用，HEAD 斷言 44 全過）、/tmp/r7310-wrapcheck-r42a.mjs（靜態包裹檢查 PASS）。

---

## 2. 每個 define 語意

```
R7310_INCLUDE_DEBUG_PROBES：帶＝編入所有 probe/診斷（家族 A atlas probe + bake-mode 診斷 probe + ShortCircuit probe 鏈）。不帶＝預處理器移除、不進編譯。
R7310_INCLUDE_BAKE_CAPTURE：帶＝編入 bake 擷取生產路徑（main bake ray + 三個 bake 函式 + bake NEE shadow-ray）。不帶＝移除。
正向 include：runtime 兩者皆不帶（最小、最大餘量）。
```

## 3. runtime / bake / debug material 選材規則

```
runtime variant  = pathTracingMaterial（無新 define）           ＝頁面載入即用、正式播放
bake variant     = r7310BakeOnlyNoBorrowMaterial（+BAKE_CAPTURE）＝production bake，無 probe
debug variant    = createR7310DebugProbeMaterial()（DEBUG_PROBES + BAKE_CAPTURE，lazy）＝probe/診斷
守門 createR7310BakeCaptureMaterial()：bake 模式下 uR7310C1RuntimeProbeMode>0 → 改 debug variant（含 probe），否則 bake variant。
```

## 4. V1–V5 驗證表（headless `--headless=new --use-angle=metal`，真 M4 Pro Metal、零使用者 Console）

```
輪次  內容                      結果        samples            contextLost  shaderErr  screenshot  備註
V1    runtime baseline          PASS_FULL   [1,434,1000,1000]  false        false      650980      靜態包裹 PASS；runtime 無 probe/bake-capture
V2    debug variant compile     PASS        n/a(compile)       —            link=true  —           probeLoc=true、witnessLoc=true、218 uniforms
V3    bake variant compile      PASS        n/a(compile)       —            link=true  —           probeLoc=false、witnessLoc=true、217 uniforms；link 成功＝bake 函式 symbol 不缺
V4    runtime + west-U1         PASS_FULL   [1,110,1000,1000]  false        false      651784      west success path 編入 runtime、NO LOSS
V5    runtime + west-S5（完整） PASS_FULL   [128,590,1000,1000] false       false      677260      完整 west（含 RectWest 投影）編入 runtime、NO LOSS（★突破）
```
註：V5 第一次因使用者手動關閉視窗中斷（samples 已爬到 963、contextLost=false 才被關），改 headless 重跑乾淨收斂 1000。

## 5. active uniform 反射表（編譯期證據，取代 getShaderSource）

```
變體      uR7310C1RuntimeProbeMode  uR7310R42aBakeWitness  FullWestWallMode  RectWest   activeUniformCount
runtime   null                      null                   (V4/V5)true       (V5)true   214（V4 215 / V5 216）
bake      null                      非 null                —                 —          217
debug     非 null                   非 null                —                 —          218
```
解讀：runtime 對 probe/bake 見證 uniform 皆 getUniformLocation===null ＝預處理器確實把 DEBUG_PROBES / BAKE_CAPTURE 排除在「編譯」之外（非字串層）；debug 兩者皆 active；bake 僅 bake 見證 active、probe null（符合 §3）。

## 6. context loss 結果

```
五輪全程 contextLost=false、reportLostCount=0、無 webglcontextlost 事件、無 FAILSAFE/CONTEXT_LOST/Shader Error console、targetCrashed=false。
debug variant（最重，等同 R4-2A 前完整 shader）compile 亦無 loss → 無 debug 變體過重風險。
```

## 7. cache-buster 更新

```
Home_Studio.html：
  js/PathTracingCommon.js → ?v=r7310-r42a-split-variant-v2（新增）
  js/InitCommon.js        → ?v=r7310-r42a-split-variant-v2（原 r7310-2b-webgl-failsafe）
  js/Home_Studio.js       → ?v=r7310-r42a-split-variant-v2（原 r7310-2b-webgl-failsafe）
```

## 8. 邊界回證

```
· 未正式接 west：west 僅 V4/V5 暫測，測後以備份還原，現工作樹 west 計數=0。
· 未進 Phase 2C、未烤任何面、未改 registry / pointer / codegen / atlas 上架邏輯。
· live 路徑零變動：FirstHit 注入(7272-7281)、ShortCircuit(7461)、hybrid deferral、6490-6511、正式 NEE 皆未被包、位元組未變。
· 家族 B 雲朵燈 probe 本桌未碰（仍在 runtime/所有變體，留 R4-2A-2）。
```

## 9. 是否建議 commit

```
建議：是。理由：五項全綠；編譯期反射證明分桌生效；runtime 變體已足以承載完整 west（V5 NO LOSS，clean-all 當時 S5 為 LOSS）；live 路徑零變動、JS 兩檔 node --check 通過、靜態包裹平衡。
但依紅線「禁止自動 commit」：不自動 commit，等 CODEX / 使用者簽。
```

## 10. commit 建議訊息

```
R7-3.10 R4-2A：runtime/bake/debug shader 分桌變體（單一 GLSL source + #ifdef + ShaderMaterial.defines）

· runtime variant（無 define）排除 probe（家族 A）+ bake-capture（main bake ray + 3 個 bake 函式）；
  bake variant 帶 R7310_INCLUDE_BAKE_CAPTURE；debug variant 帶 DEBUG_PROBES + BAKE_CAPTURE（lazy）。
· MAJOR 1 守門：bake 模式 + RuntimeProbeMode>0 → 改選 debug material，避免 probe 靜默消失。
· 驗證（headless 真 M4 Metal、CDP active-uniform 反射，非 getShaderSource）：
  V1 runtime PASS_FULL、V2 debug compile PASS、V3 bake compile PASS（link 成功＝bake symbol 不缺）、
  V4 runtime+west-U1 NO LOSS、V5 runtime+west-S5 完整 NO LOSS（clean-all 當時 S5 為 LOSS）。
· 見證 uniform uR7310R42aBakeWitness（compile-only）：可保留作變體 regression 守門，或後續清理移除。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 下一步（待 CODEX 裁示）
```
· R4-2A 已成功且 runtime 足以承載完整 west → 後續可走「west 正式接線實作」（另案、本桌不做）。
· 家族 B（雲朵燈 probe）剝離仍是「進一步抬高餘量」的選項，但 V5 已證完整 west 不需要它 → 可延後或視後續物件需求再評估。
· 見證 uniform uR7310R42aBakeWitness 去留待裁示（保留＝永久變體守門；移除＝另開清理 patch）。
```

---

## 11. commit 前 cleanup（CODEX 要求；已執行 + 重驗）

成因：套用工具對「6600-7271 連續 11 個 Batch A 區塊」的相鄰邊界，兩個插入點落在同一行號、splice 順序把後一塊的 `#if` 推到前一塊的 `#endif` 前，每個邊界生成一個空 `#if defined(R7310_INCLUDE_DEBUG_PROBES)` / `#endif` no-op pair（共 10 個）。外層仍正確包住整段、功能無礙（V1–V5 已過），但會誤導讀 diff 者判斷包裹範圍。

cleanup 動作（純 no-op + 縮排，未動正式渲染語意、未移動實際包裹邊界）：
```
1. 移除 10 個空 DEBUG no-op pair（相鄰 Batch A 自然合併為單一外層 wrap；wrapped 內容不變）。
   glsl diff 44 → 24 insertions（移除 20 行空標記）。
2. 對齊 uR7310R42aBakeWitness keep-alive 行縮排：1 tab → 5 tab（對齊 7760 BAKE 區塊體）。
```

cleanup 後驗證（全過）：
```
· node --check js/InitCommon.js / js/PathTracingCommon.js：OK
· wrapcheck：balanced=true、PASS=true（13 #if / 13 #endif；probe 全在 DEBUG、live 全在外）
· grep 空 no-op pair：DEBUG=0、BAKE=0
· git diff --check：clean（無尾空白／空白錯）
```

瀏覽器重驗（headless 真 M4 Metal；因動到 #if 結構，依保守原則重跑 V1 + V5）：
```
RV1 runtime baseline（cleaned）：PASS_FULL、samples [127,593,1000,1000]、contextLost=false、shaderErr=false、
                                 screenshot 674796、probe/bake 見證 uniform getUniformLocation 皆 null。
RV5 runtime + west-S5（cleaned）：PASS_FULL、samples [82,396,1000,1000]、contextLost=false、reportLostCount=0、
                                 shaderErr=false、events 空、console 0、screenshot 676452、
                                 FullWestWallMode + RectWest 反射 true、probe/bake 見證 null。
結論：cleanup 為可證的預處理 no-op，RV1/RV5 與原 V1/V5 行為一致。
```

最終 diff scope（commit 範圍）：
```
shaders/Home_Studio_Fragment.glsl  +24
js/PathTracingCommon.js            +2
js/InitCommon.js                   +36 / -4
Home_Studio.html                   +3 / -3（cache-buster）
4 files changed, 61 insertions(+), 7 deletions(-)
```

review doc 是否納入 commit（CODEX 問項 6 回覆）：
```
建議：本 review doc 與 code patch 同一 commit（單一 coherent 提交，含驗證證據與選材規則，利後續維護回溯）。
決定權在使用者：
  · 若「code + review doc 同 commit」→ git add 4 檔 code + docs/r7-3-10-r4-2a-runtime-variant-patch-review.md。
  · 若「只收 code」→ review doc（與 preflight、patch-plan）留 untracked，明講不入此 commit。
preflight（r7-3-10-r4-2-split-shader-architecture-preflight.md）與 patch-plan（r7-3-10-r4-2a-runtime-variant-patch-plan.md）
是決策軌跡，可同 commit 或另開 docs commit，由使用者定。
```

---

## 12. no-borrow blocker（CODEX 第二輪；已修 + 補驗）

問題：`createR7310DebugProbeMaterial`（bake-debug，唯一呼叫點＝`createR7310BakeCaptureMaterial` 的 bake+probe 路徑）原 defines 未帶 `R7310_BAKE_ONLY_NO_BORROW`，只繼承 pathTracingDefines。當 runtime 設定為 full-borrow（pathTracingDefines 未帶 `R7310_RUNTIME_NO_BORROW_TEXTURE`）時，bake 診斷會把 borrow sampler / borrow path 編回來，與 bake variant 的 no-borrow 契約不一致。V1/V5 runtime 測試看不到（未跑 bake+probe 選材路徑）。

修法（CODEX 建議 a，最小）：`createR7310DebugProbeMaterial` defines 補 `R7310_BAKE_ONLY_NO_BORROW: 1` → bake-debug 恆 no-borrow、與 runtime 設定無關（唯一呼叫點即 bake-debug，故 debug material ＝ bake-debug 語境）。
（未來若需 runtime-debug full-borrow 版本，再依 CODEX 建議 b 拆 `r7310BakeDebugProbeMaterial` 雙 cache。）

no-borrow 見證：`tBorrowTexture`（glsl:36）宣告在 `#if !defined(R7310_BAKE_ONLY_NO_BORROW) && !defined(R7310_RUNTIME_NO_BORROW_TEXTURE)` 內 → 帶 no-borrow 時不宣告 → getUniformLocation=null。

補驗（headless 真 M4 Metal、變體探針）：
```
V2 bake-debug：compiled+link=true、probeLoc=true、bakeWitnessLoc=true、borrowTexLoc=false（no-borrow 正確）、218 uniforms
V3 bake      ：compiled+link=true、probeLoc=false、bakeWitnessLoc=true、borrowTexLoc=false、217 uniforms
runtime      ：borrowTexLoc=false（本 config pathTracingDefines 帶 RUNTIME_NO_BORROW_TEXTURE）
node --check OK、git diff --check clean、wrapcheck balanced+PASS、空 no-op pair DEBUG/BAKE 皆 0
```
依 CODEX rule：僅動 debug material define + cache-buster（v1→v2），未動 runtime material / shader 包裹 / 正式播放路徑，故未重跑 V1/V5；只重跑受影響的 V2/V3。

最終 commit 範圍（不變）：4 檔 code，61 insertions / 7 deletions（cache-buster 由 v1 改為 v2）。
