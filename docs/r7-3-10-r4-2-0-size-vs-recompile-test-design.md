# R7-3.10 R4-2-0：size-vs-recompile 受控測試設計（只設計，不執行 GPU 測試）

> 本文件只「設計怎麼測」，不改 shader、不回放 stash@{0}、不烤西牆、不開 Phase 2C。
> 任何「實跑 GPU」的步驟都標明需要使用者明確授權；未授權前一律是紙上設計。
>
> 名詞約定（本檔為內部技術設計，首次出現給白話、其後沿用英文）：
> - 重編譯（recompile）＝把著色器原始碼重新編譯+連結成顯示卡能執行的程式。M4 Metal 上對這顆 356KB 著色器，任一行改動都會觸發全量重編譯。
> - context loss（繪圖連線中斷）＝WebGL context 遺失，畫面變黑、render loop 該停。
> - fail-safe＝a496054 已上線的 app 級保險絲（偵測 context loss → 停機 → 覆蓋層 → 回報）。

---

## 0. 前提狀態與紅線

```
HEAD          ：a496054（穩定可用基準 = a1826c0 + fail-safe v1）
stash@{0}     ：p0-webgl-contextlost-phase2b-browser-facing（Phase 2B browser-facing diff，未回放）
stash 基準    ：a1826c0（stash@{0}^）
HOLD          ：west GLSL / Phase 2C / west bake / R4-2 shader 實作
不做          ：回放 stash / 烤 west / 改 shader / 多分頁 / 碰 Brave
```

本設計的唯一讀取動作是 `git stash show`（唯讀，不套用 stash），已完成；以下數字皆由此而來。

---

## 1. HEAD vs stash@{0} browser-facing diff 分解（交付物 #1）

### 1.1 全 stash 檔案級增量（raw numstat，vs a1826c0）

```
 +19  -0   docs/data/r7-3-10-surface-owner-registry.json        ← 資料（west owner 條目）
 +31  -3   docs/generated/r7-3-10-surface-owner-table.mjs       ← 產生物（codegen 鏡像）
 +5   -2   docs/generated/r7-3-10-surface-owner.glsl.frag       ← 產生物（codegen 鏡像）
 +31  -3   docs/generated/r7-3-10-surface-owner.py              ← 產生物（codegen 鏡像）
 +14  -0   docs/tools/r7-3-10-surface-owner-scanner.mjs         ← 工具（離線掃描）
 +2   -0   js/Home_Studio.js                                    ← JS（west uniform 註冊）
 +178 -35  js/InitCommon.js                                     ← JS（packed rect/albedo gate/self-test/west loader/identity gate/uniform push）
 +69  -2   shaders/Home_Studio_Fragment.glsl                    ← ★唯一會觸發重編譯的檔
```

關鍵分類：

```
會觸發 GPU 重編譯者：只有 shaders/Home_Studio_Fragment.glsl（+69/-2）。
不觸發重編譯者      ：js/InitCommon.js、js/Home_Studio.js（JS 只改 uniform 上傳與載入流程，不重編譯 shader）。
非執行路徑者        ：docs/generated/*（codegen 產生的鏡像檔，runtime 不單獨編譯；runtime shader 的 owner 區塊已內嵌在那 +69 行內）、docs/tools/*（離線）。
```

→ 探究 context loss 時，**自變數收斂到一個檔：Home_Studio_Fragment.glsl 的 +69/-2**。JS 與產生物可先排除為重編譯主因（但 JS 推的 2 個 uniform 仍列入「uniform 壓力」假設 D 的觀察點）。

### 1.2 GLSL +69/-2 的精確細分

```
體積        ：356,280 → 359,660 bytes ＝ 淨 +3,380 bytes（+0.95%）；淨 +67 行
（以下行號為 stash@{0} 內 shaders/Home_Studio_Fragment.glsl 的「原始碼行號」，已逐項對檔確認）
新 uniform  ：2 個，皆非取樣器
              · uniform float uR7310C1XatlasRuntimeFullWestWallMode;   （glsl ~133）
              · uniform vec4  uR7310C1XatlasRectWest;                  （glsl ~146）
新 sampler2D：0 個 ← west 不新增任何貼圖取樣器
新函式本體  ：1 個 r7310C1XatlasFullWestWallUv(...)（glsl 1439-1495，57 行，鏡像 FullEastWallUv）
新前置宣告  ：1 個 r7310C1RuntimeSurfaceIsWestWall(...) 前置宣告（glsl ~1279）；其函式本體早已在 HEAD（glsl ~2135-2144），本次只補宣告
owner 區塊  ：const R7310_OWNER_WEST_WALL_OPEN = 7;（glsl ~1505）
              r7310SurfaceOwnerIsPending：return false; → return ownerId == 7;（glsl ~1506）
              owner if-chain 新增 west_wall_open 一條述詞（glsl ~1525）
wrapper 接線：r7310C1XatlasNorthWallUv 派發器加 3 行（glsl ~1645-1651）：
              if (FullWestWallMode>0.5 && FullWestWallUv(...)) return true;
```

### 1.3 對「執行路徑」的關鍵觀察（決定假設權重）

```
· FullWestWallMode 在 pending 期間恆推 0（glsl ~133 註解＋InitCommon uniform push）。
  → r7310C1XatlasFullWestWallUv（G3）整段、以及 wrapper 的 if(FullWestWallMode>0.5)（G4）在預設視圖永不被取用。
· owner-pending 桃紅路徑（HEAD glsl ~6566-6577）要 bounces==0 && MasterMode/FullCeilingMode>0.5 && IsPending(...) 同時成立才走。
  預設 hybrid 視圖 master 模式關 → 桃紅路徑也不被取用。
· 結論：預設視圖下，west 新增的 GLSL「幾乎全段不執行」，僅「存在於被編譯的程式裡」。
  既然 P0 當時是一放回 west 就 context loss，而 west 程式碼根本沒跑，
  矛頭就偏向「編譯期/程式體積/重編譯事件本身」（假設 A/E），而非「執行期邏輯」（B/C/D 的執行面）。
  這個推論正是測試矩陣要去證實或推翻的。
· ★語意澄清（別把「不執行」誤當「會被最佳化掉」）：uniform/程式碼是否成為 active，取決於「靜態使用」
  （是否出現在會被連結的程式碼路徑），與 runtime 是否實際走到該分支無關。west 的 2 個 uniform 雖在恆 false
  分支內，仍屬靜態使用 → 多半會被 linker 計入 active。故假設 D 的 west 對照基準應以「靜態使用 = active」估，
  不可因「幾乎不執行」就把這 2 個當成會被剝除而低估。
```

---

## 2. 競爭假設 A–E（對齊使用者裁示所列）

```
A. 體積觸頂      ：shader 變大（多 3,380 bytes / 67 行）就逼近 M4 Metal 某資源上限 → 編譯/連結後不穩。
B. west owner    ：owner 區塊（OWNER 7 + IsPending==7 + if-chain）是肇因（牽動桃紅路徑啟用）。
C. west UV 函式  ：r7310C1XatlasFullWestWallUv 那 57 行（含 mix/clamp/master 分支）是肇因。
D. uniform/sampler 壓力：新 uniform 推過某 fragment uniform 預算上限。
   ★前置事實：west 新增 sampler = 0；sampler 壓力假設「就 west 而言」已先被 diff 推翻。
   ★量測單位修正：GLSL ES / WebGL2 的硬上限是 MAX_FRAGMENT_UNIFORM_VECTORS（以 vec4 計）/ 對應
     component 預算，非「uniform 變數個數」。所以 D 的懸崖要以「component/vector 用量 vs
     gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)」量測，不可用「204→206 個變數」這種變數計數描述
     （那只是粗略指標）。west 僅 +1 float +1 vec4 ＝ 約 +2 個 vector 預算，a-priori 機率低，但仍以 vector 預算對照。
E. 首次重編譯    ：與 west 內容無關——這顆 356KB shader 任何一次首次重編譯（連改註解）都會卡/掉 context；
   之後若程式字串不變、走 GL program cache 命中就穩（已有記憶 r7310-shader-recompile-freeze 佐證）。
```

A–E 不互斥：可能 E 為底（任何重編譯都危險），A 為加成（越大越容易在重編譯當下翻車）。測試要能分離主因與加成。

---

## 3. size-vs-recompile 測試矩陣（每輪只改一個變因）

設計原則：每一輪都是「一個新的程式字串 → 一次首次重編譯」。用「最小、最中性」的變更先把 E 與 A 釘住，再逐段疊 west 區分 B/C/D。每輪都在 fail-safe 保護下、獨立 Chrome profile、單分頁、測完關分頁。

### 3.0 每輪共通前置：source freshness gate（BLOCKER 1 修補，每輪必過，否則該輪作廢）

問題：瀏覽器 HTTP cache、ES module cache、three.js material cache、GL program cache 任一層都可能讓「以為改了檔，實際頁面仍吃舊 source」。若 T0 沒爆但其實根本沒載到新 source，會誤判成「重編譯安全」。所以每一輪 shader 測試，在判讀 loss/no-loss **之前**，都必須先通過下列 freshness 三證；任一證不過，該輪結果作廢、不得判讀。

```
[證 1] 唯一 test id（必須「留得到 token」的 inert marker，不只改註解、也不要用純 #define）
  ⚠ 關鍵修正：純 `#define R7310_..._4F1A 1` 若不被任何 #if/#ifdef 取用，前處理展開後不留任何 token 於
    送進 driver 編譯器的最終 source；driver/ANGLE 對「正規化後 source」可能與前一輪相同 → 命中底層 program
    binary cache → 這次根本沒真的重編譯 → T0「no loss」恐是「沒重編譯」的假陰性，無法排除假設 E。
  故每輪改用「保證進入最終 token 流、且語意≈0」的唯一 marker，二擇一：
    a.（首選）inert const + keep 機制餵入輸出：
         const float R7310_R42_TEST_ID_T0_20260619_4F1A = 4070619.41;   // 唯一數值
         finalColor += vec3(R7310_R42_TEST_ID_T0_20260619_4F1A * uR7310R42KeepEpsilon);  // 視覺≈0、但必入 program
    b. 在某必經運算上加 `+ 0.0 * float(<唯一常數>)` 之類 runtime 可量測痕跡。
  （日期 + 4 碼亂碼；每輪換一組，永不重複。）#define 仍可一併放，但只當「改 three.js cacheKey + 檔案字串」用，
  不可當「driver 真重編譯」的證據——後者靠 [證 3]。

[證 2] source 內含證明（頁面/材質/GPU program 三層各自說清楚）
    a.（材質層）讀 three.js：印 pathTracingFragmentShader.includes('<唯一 id>') === true（InitCommon.js 第 11 行宣告、~14686 行賦值，全域可讀）。
    b.（檔案層）對該輪 fragment .glsl 用唯一 cache-buster 重新 fetch，grep id 存在。
    c.（GPU program 層，最貼真相）link 後對 fragment shader 物件呼叫 gl.getShaderSource(fragShaderObj) 取回「實際附加到該 program」的 source 並 grep id。
  併記 fail-safe 的 window.reportHomeStudioWebGLContextState() 當基線。a 是材質層、b 是檔案層、c 才證「GPU program 由這份 source 連結」。

[證 3] 獨立載入、強制不吃 cache、且證明「確有底層重編譯」
  · 該輪 .glsl 用唯一 cache-buster（?v=r42-T0-20260619-4F1A）或 DevTools「Disable cache」載入。
  · 唯一 source 字串 → three.js program cacheKey 改變（cacheKey=hash(vert+frag)+baseMaterialCacheKey）→ 不命中 three.js program cache；
    且唯一 marker 進入最終 token 流 → ANGLE program binary cache key 亦改變 → 保證 binary cache miss。
  · 正面證據（取代易受雜訊的「牆鐘耗時>0」）：以 KHR_parallel_shader_compile 的 COMPLETION_STATUS_KHR 觀察到一段「非立即完成」的編譯窗，
    作為「這次確有底層 driver 編譯」的硬證；併看 ACTIVE_UNIFORMS 在 link 後重新枚舉。
  · T0 子驗證（釘死 E 的前提）：對「inert marker 版」與「byte-identical HEAD 版」分別量 COMPLETION_STATUS 編譯窗——
    marker 版必須觀察到編譯窗、HEAD 版命中 cache 無編譯窗，才證明 T0 真的逼出一次重編譯；否則 T0 的 no-loss 不足以排除 E。
```

→ 只有三證齊全（且 [證 3] 確認「確有底層重編譯」），該輪 loss/no-loss 才可採信。故 T0 的變因升級為「插入會留 token 的唯一 inert marker ＋三證（含 COMPLETION_STATUS 真重編譯窗）」，取代原稿的單純改註解。

實作前置（marker 注入位置 / 時機，執行前先定）：
```
· 本專案 fragment shader 走 fileLoader.load('shaders/Home_Studio_Fragment.glsl', cb)（InitCommon.js ~14683）載入字串後建 ShaderMaterial。
· marker 注入有三個可行點，擇一並在該輪記錄用哪個：
  (1) 直接改源檔 .glsl 再 fileLoader.load（最直觀，但屬「改 shader」、需逐輪解 HOLD + 測後還原）；
  (2) 在 load callback 拿到 fragment 字串後、建材質前，於字串注入 marker（不動源檔，較易還原）；
  (3) three.js #define / onBeforeCompile 注入（注意 onBeforeCompile 改寫會讓 material.fragmentShader 與 GPU source 不一致，須改用 [證2c] getShaderSource 驗證）。
· 不論採哪點，[證2] 要對「真正送進 GPU 的 source」驗 id（優先 [證2c]），避免材質層字串與 GPU program 不一致的誤判。
```

```
輪次  變因（相對 HEAD shader）                         主測假設   預期讀數與判讀
────────────────────────────────────────────────────────────────────────────────────────────
T0    插入 1 行 inert #define 唯一 test id（語意/體積≈0、純逼   E        先過 §3.0 freshness 三證；通過後判讀：
      一次重編譯）＋ §3.0 freshness 三證                                 loss → 任何重編譯都危險，與 west 無關；cure 走「更安全投放」(見 §8)。
                                                                  no loss（三證通過）→ 重編譯本身可存活，問題在 west 加了什麼（轉 T1+）。
                                                                  no loss（三證沒過）→ 結果作廢、重跑，不得判定「重編譯安全」。

T1    加入約 +67 行「中性死碼」(註解 + 一個永不呼叫的函式)，   A        loss → 體積/複雜度觸頂；+0.95% 即翻車＝margin 極薄，任何未來新增都危險。
      位元數量級 ≈ west（~3.4KB），但與 west 語意無關             no loss → 不是「純體積」；轉逐段疊 west（T2*）找特定段。

T2a   只疊 west 的 G1（2 個 uniform 宣告，不接線、不加函式）   D(宣告) loss → uniform 宣告層面即觸頂（極罕見）。 no loss → 續 T2b。
T2b   T2a + G2（owner const/IsPending/if-chain）              B        loss → owner 區塊是肇因（含 IsPending 啟用桃紅路徑的副作用）。 no loss → 續 T2c。
T2c   T2b + G3（r7310C1XatlasFullWestWallUv 57 行函式本體）    C        loss → UV 函式是肇因。 no loss → 續 T2d。
T2d   T2c + G4（前置宣告 + wrapper 3 行接線）＝完整 west GLSL  接線     loss → 接線/完整組合才觸發（最接近 P0 現場）。 no loss → P0 無法重現，需回查 JS/uniform 上傳時序。

T3a   HEAD + 只「宣告」N 個獨立純量 dummy uniform（不被任何     D(文字) 測「source 文字變大 + 宣告層級」。⚠ 只宣告者常被 compiler/linker 最佳化掉、
      運算引用；N 階梯 +8/+16/+32…；不可用陣列，見下方註）            不計入 active uniform；故 T3a 不能當 active uniform 壓力測試（見 §6 證明）。
T3b   HEAD + 宣告 N 個獨立純量 dummy uniform「並以可控方式引用」 D(active) 才是真正的 active uniform 壓力測試：每加一階先用 ACTIVE_UNIFORMS 證明
      使 linker 計入 active（引用法見下方註）；N 同階梯              active 數真的 +N（沒被最佳化掉），再看是否觸頂；對照 west 僅 +2 是否在安全邊際內。

T4    取「能重現 loss 的最小變更」+ 走非同步編譯（KHR_parallel_     E 緩解  loss 消失/變不卡 → 主因為「同步重編譯阻塞主執行緒」，cure＝非同步編譯+預熱(見 §8)。
      shader_compile，以 COMPLETION_STATUS_KHR 輪詢、不阻塞 main          仍 loss → 屬編譯後/連結後的資源問題（非同步化解不了）。整合前提見下方註。
      thread）
```

T3b 引用法（防最佳化，務必照做，否則退化成 T3a）＋ T4 整合前提註：

```
[T3b 引用法] 讓 dummy uniform 真的成為 active（防 dead-code elimination）：
  關鍵：引用必須「依賴一個 runtime 才知值的 uniform」、且把結果餵進輸出，compiler 才無法常數摺疊掉。
  範式（示意，非最終碼）：
    uniform float uDummy0; ... uniform float uDummyN;   // 待測 dummy：N 個「獨立純量」
    uniform float uR7310R42KeepEpsilon;                 // 真 uniform（runtime 設一個小值）
    float keep = 0.0; keep += uDummy0 + ... + uDummyN;
    finalColor += vec3(keep * uR7310R42KeepEpsilon);    // 視覺上≈0、但 linker 必須保留 uDummy*
  ⚠ 防摺疊的真正關鍵是「值來自 uniform（編譯期未知）」，與數值大小無關；runtime 是否真的設值也不影響
    linker 計入 active（未設值預設 0.0，編譯器仍視為 runtime 未知）。把它寫成「1e-20」只是視覺≈0，
    別誤解成「值要夠小才不被摺疊」。
  ⚠ 不可用 keep*0.0 或 keep*常數：會被摺疊成 0、dummy 仍被剝除 → 退回 T3a。
  ⚠ 必須是 N 個「獨立純量」uniform。若用陣列 uniform float uDummy[N]，依規範整個陣列只計為 1 個
    active uniform（名稱 uDummy[0]）→ ACTIVE_UNIFORMS 不會 +N，判準失效。
  ⚠ 防 dead-store 剝除：keep 的貢獻要寫進「確定會被輸出、且不被後續覆蓋」的最終 finalColor
    （放在所有寫 finalColor 的分支「之後」）。
  自我驗證（必跑）：
    · gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) 須較 HEAD 增加 N。沒驗到 +N＝引用被摺疊／被當陣列／dead-store → 該輪作廢重做。
    · 同時確認 uR7310R42KeepEpsilon 本身也在 active 清單內（否則整條防摺疊鏈失效）。
    · 旁證：gl.getUniformLocation(prog,'uDummyK') !== null（WebGL 對 active 回不透明 WebGLUniformLocation 物件、對被剝除者回 null；WebGL 沒有 -1，-1 是 GL ES C-API 慣例）。
  fallback（若上式在某 driver 仍被剝）：把 keep 寫進 gl_FragColor / 多個輸出附件，或讓 keep 參與一個依賴
    varying 或 texture lookup 的條件分支（runtime 相依、更難摺疊）；換寫法後仍以 ACTIVE_UNIFORMS +N 為過關判準。

[T4 整合前提] 本專案 build = js/three.module.min.js（importmap 載入），grep 已確認其中含
  compileAsync（1 處）與 KHR_parallel_shader_compile（2 處）字串 → 引擎層整合點存在。
  但本專案目前「未實作」renderer.compileAsync() 預編譯：path tracer 的全螢幕 ShaderMaterial 在首次
  renderer.render()（InitCommon.js animate() ~15499 行）時才觸發「同步」編譯。故 T4 執行前須先讀本專案
  render 初始化流程，確認能把該材質改走 compileAsync 預熱路徑（否則 KHR extension 開了也不會自動非同步）。
```

矩陣讀法：

```
T0 loss              → E 為主因，west 無辜，§8 走「投放安全化」。
T0 no loss + T1 loss → A 為主因（純體積），§8 走「最小瘦身」且不碰 west。
T1 no loss + T2x loss→ 在第 x 段坐實 B 或 C（或接線）；§8 回頭只拆 west 對應段。
T3a vs T3b 分歧      → 若 T3a 無事而 T3b 才觸頂，證明壓力來自 active uniform、非 source 文字；west +2 對照之。
                       若 T3a 即觸頂，多半是 source 文字/體積（與 A 同類），非 active uniform 數。
T4 區分「同步阻塞」與「資源不足」兩種 E/A 的修法方向。
```

每輪結束無論結果，先「關分頁、讓 GPU 回復」再進下一輪；T 系列彼此獨立、不連續硬撞（見 §4、§7）。

---

## 4. 每輪測試的安全條件（交付物 #3；不滿足就不准跑）

```
[1] fail-safe 必須在線：每輪頁面都跑含 a496054 fail-safe 的版本；先 window.reportHomeStudioWebGLContextState() 確認已載入。
[2] 獨立 Chrome profile：用全新/專用 profile（例：chrome --user-data-dir=/tmp/r420-test-profile），與日常 profile 隔離。
[3] 不碰 Brave：Brave 是使用者日常瀏覽器、有活分頁，全程不啟動、不 pkill。
[4] 單分頁：同時間只開一個 9002 分頁、一個 GPU process；不開第二分頁、不並排比較。
[5] 測完關分頁：每輪做完關掉該分頁，留時間讓 GPU process 回收，再開下一輪。
[6] 一輪一變因：每輪只改一個自變數（對照 §3）；不一次疊兩段。
[7] 出現 context loss 立即停該輪（見 §7 停損）。
[8] 每輪可逆：測試用的 shader 變更都是臨時、測完即還原成 byte-identical 的 HEAD 版本（回 GL cache 命中、不再卡）。
[9] 不用劣化過的預覽 Chromium：先前 P0 撞壞的預覽 GPU 不可作為測試載體。
```

---

## 5. 哪些測試需要使用者授權才能跑（交付物 #4）

```
不需授權（純文字、零 GPU、零 shader 編輯）：
  · 本設計文件本身、diff 分解、矩陣規劃、量測腳本撰寫（不執行）。

需要使用者明確授權（每一輪各自授權，逐輪同意）：
  · T0、T1、T2a–T2d、T3a、T3b、T4 全部 —— 因為每輪都要
      (a) 臨時修改 shaders/Home_Studio_Fragment.glsl（目前 HOLD），
      (b) 在真實 GPU 上觸發一次重編譯（有 context loss / 卡死風險）。
  · T3a 與 T3b 是「兩輪」、各需一次授權（不可合併成一次）。
  · 授權顆粒度：一次授權只跑「一輪」；該輪做完回報、再請示下一輪。
  · 不可「一次授權跑整個矩陣」——違反 §4[6][7] 與 §7 停損精神。
```

> 註：因每輪都需臨時改 shader，而「改 shader」目前在 HOLD 清單，故**執行任一輪都同時需要解除該輪的 shader-edit HOLD**（由使用者/CODEX 逐輪解鎖、測後立即還原）。本文件階段一律不改 shader。
>
> 授權臨界點（消歧義）：「同意本輪」＝同意「改 shader 注入 marker + 載入 + 觸發一次編譯/render」這整段；在拿到該輪同意「之前」不得改 shader、不得載入到 GPU。每輪回報固定含：用哪個注入點、freshness 三證原始輸出、編譯窗、fail-safe report、loss/no-loss 與結論；CODEX/使用者據此決定是否放行下一輪。

---

## 6. 量測與證據收集（每輪固定收集，使結果可判讀）

```
source freshness 層（BLOCKER 1，每輪必收、見 §3.0；採 §3.0 [證2] 哪條都要留原始輸出）：
  · test id（材質層 a）：印 pathTracingFragmentShader.includes('<本輪唯一 id>') === true。
  · test id（檔案層 b，若採此路）：附 fetch URL（含 cache-buster）與 grep 命中行。
  · test id（GPU program 層 c，最貼真相）：link 後 gl.getShaderSource(fragShaderObj) grep 唯一 id。
  · cache：該輪用唯一 cache-buster 載入；以「唯一 source → cacheKey/binary-cache 必 miss」＋ COMPLETION_STATUS 編譯窗，證明確有底層重編譯（見 §3.0 [證3]）。
  · 三證未齊（含「確有底層重編譯」）→ 該輪結果作廢、不判讀。
編譯/連結層：
  · 監看 console 的 THREE.WebGLProgram shader error（連結失敗會印）。
  · 取得 program 物件：three.js 端可由 renderer.properties.get(material).currentProgram（或 currentProgram.program 取底層 WebGLProgram），再餵進下列 gl 查詢。
  · 讀 gl.getProgramParameter(prog, LINK_STATUS) 與 getProgramInfoLog。
  · GPU 身分：WEBGL_debug_renderer_info（UNMASKED_RENDERER_WEBGL）記錄是哪顆 GPU/驅動。
uniform 計數證明（BLOCKER 2，T3a/T3b 必收）：
  · active uniform 數：gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)（prog 取得法見上）。
  · T3a（只宣告）：預期 active 數「不」隨 N 等量上升（被最佳化掉）→ 證明只宣告無法測 active 壓力。
  · T3b（引用法，見 §3 表後註）：active 數必須 +N；若沒 +N＝引用被摺疊/被當陣列/dead-store，該輪退化成 T3a、作廢重做。
  · 旁證：gl.getUniformLocation(prog,'uDummyK') !== null（active 回 WebGLUniformLocation 物件、被剝除回 null；WebGL 無 -1）。
  · D 的硬上限對照：gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) 對照目前 component/vector 用量（非變數個數）。
時序層：
  · 記首幀渲染前後時間戳；若主執行緒凍結，記錄凍結時長（對應 T4 同步 vs 非同步判讀）。
context 層：
  · fail-safe 的 window.reportHomeStudioWebGLContextState()：contextLost / lostCount / animationFrameId。
  · console 是否出現 [R7-3.10 WebGL FAILSAFE] CONTEXT_LOST。
非同步編譯探測（T4 專用）：
  · 偵測 KHR_parallel_shader_compile 擴充是否存在，以 COMPLETION_STATUS_KHR 輪詢編譯完成、不阻塞 main thread。
每輪輸出一份：變因、GPU 身分、時序、console、fail-safe report、結論（坐實/排除哪個假設）。
```

擴充與 API 參考（國際版網域）：

```
KHR_parallel_shader_compile：https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
MDN KHR_parallel_shader_compile：https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile
WebGL 上下文遺失處理（preventDefault 才會觸發 restored）：https://www.khronos.org/webgl/wiki/HandlingContextLost
```

---

## 7. 停損條件（交付物；對齊使用者第 4 點）

```
任一輪一旦出現 context lost：
  1. 立刻停止「該輪」，不在同一分頁重試。
  2. 記錄 console 全文。
  3. 記錄 fail-safe report（contextLost/lostCount/animationFrameId）。
  4. 不連續硬重載（Cmd+Shift+R 連按會反覆撞同一個重編譯）。
  5. 不追加第二個測試硬撞（不可「既然掉了乾脆把下一輪也跑了」）。
  6. 關分頁、讓 GPU 回收，把該輪結論寫下，等使用者裁示是否進下一輪。
此外：單一 session 內若連續 2 輪都觸發 loss，整批暫停，回報 CODEX/使用者重新評估，不續跑。
```

---

## 8. 設計完成後的路線分支（對齊使用者第 5 點）

```
若 T0 坐實 E（任何重編譯都危險）：
  → 不是 west 的錯，瘦身也未必解。主修向「投放安全化」：
    KHR_parallel_shader_compile 非同步編譯 + 載入期預熱（先把新程式編好再切換），避免主執行緒同步卡死。
若 T1 坐實 A（純體積觸頂）：
  → R4-2 先做「最小瘦身候選」（優先 A1 北牆死碼 ~33 行、再評 probe/bake-only #ifdef 剝離），全程不碰 west。
若 T2b/T2c 坐實 B/C（west 特定段）：
  → 回頭只拆 west GLSL 對應段（owner 或 UV 函式），找該段觸頂的具體結構再改寫。
若 T2d 才 loss（完整組合/接線）：
  → 最接近 P0 現場；檢查 wrapper 派發順序與 uniform 上傳時序的交互。
若 T3b（active uniform）顯示懸崖遠在 +2 之外：
  → 正式排除 D，集中火力在 A/E。（T3a 只測文字、不足以排除 D，必須看 T3b。）
共同前提：任何「動 shader」的後續，都要再開一次獨立決策、逐輪授權、測後還原。
```

---

## 9. 本文件未做 / 不做（紅線回證）

```
· 未改任何 shader（無 .glsl 變更）。
· 未回放 stash@{0}（只 git stash show 唯讀讀取）。
· 未烤 west、未開 Phase 2C。
· 未實跑任何 GPU 測試（T0–T4 全為紙上設計，待逐輪授權）。
· 未碰 Brave、未開多分頁。
交付物對應：#1→§1、#2→§3、#3→§4、#4→§5、#5/#6/#7/#8 紅線→§0/§9 全程遵守。
BLOCKER 修補對應：BLOCKER 1（source freshness gate）→§3.0 + T0 改「會留 token 的 inert marker」+ §6 freshness 層；
                 BLOCKER 2（textual vs active uniform）→T3 拆 T3a/T3b + §3 表後 T3b 引用法註 + §6 ACTIVE_UNIFORMS 證明。
對抗驗證回折（3 視角唯讀稽核後修）：
  · §1.2 行號改為 stash@{0} 確認的 GLSL 原始碼行號（原為 patch 檔行號、誤植）。
  · §3.0 [證1] 改「保證留 token 的 inert marker」（純 #define 前處理後可能不留 token → binary cache 命中 → T0 假陰性）；
    [證3] 補「唯一 source → cacheKey/binary-cache 必 miss」＋ COMPLETION_STATUS 真重編譯窗 ＋ T0 子驗證。
  · [證2] 分材質/檔案/GPU-program 三層，新增 getShaderSource(c) 為最貼 GPU 真相之證。
  · T3b 引用法：防摺疊關鍵改述為「值來自 uniform、與大小無關」；補 KeepEpsilon 自身須 active、防 dead-store、
    必用 N 個獨立純量（陣列只計 1 個 active）、getUniformLocation 用 !==null（WebGL 無 -1）、fallback 寫法。
  · 假設 D 量測單位改為 MAX_FRAGMENT_UNIFORM_VECTORS / component 預算（非變數個數）。
  · §1.3 補「active 取決於靜態使用、非 runtime 執行」澄清，避免低估 west 2 uniform 的 D 對照基準。
  · T4 措辭改「目前未實作 compileAsync、首次 render(~15499) 同步編譯」；§5 授權清單 T3→T3a/T3b（各一輪）＋授權臨界點定義；補 marker 注入位置實作前置註。
```
