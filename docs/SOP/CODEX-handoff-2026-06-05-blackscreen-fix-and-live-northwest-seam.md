# CODEX 交接：R7-3.10 黑畫面修復（已完成）＋ LIVE 北牆西側破圖（待修）

> 交接人：OPUS（2026-06-05）。本文件自含，CODEX 不需先前對話即可接手。
> 全程只用 Google Chrome（獨立 user-data-dir），絕不碰 Brave。

---

## 0. TL;DR

```
1. 黑畫面（整個 3D canvas 全黑）＝已修好、已驗證。根因是 fragment shader sampler 超過 16。
2. LIVE 北牆西側破圖（關北牆烘焙時）＝未修，是你（CODEX）要接手的主題。
   根因＝西樑北端帽面與北牆共面重疊（z=-1.874）＋所有權閘放掉該帶 → live 兩面打架。
   這是 R7-3.10 接縫核心區的幾何/所有權問題，不是黑畫面修復造成的。
3. 新工具：docs/tools/r7-3-10-c2c-blackscreen-probe.mjs（CDP 抓 console＋截圖＋canvas/WebGL/xatlas 狀態，
   支援 CAMERA / SETUP_JS）。
```

---

## 1. 已完成：黑畫面崩潰修復（已驗證）

### 1.1 根因
fragment shader 靜態使用的 sampler 數量 > MAX_TEXTURE_IMAGE_UNITS(16)。
CDP 抓到的真實 link log：
```
THREE.WebGLProgram: Shader Error - VALIDATE_STATUS false
Program Info Log: FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)
```
program link 失敗 → useProgram 無效 → drawArrays 全丟 → 全黑。
console 的「Feedback loop formed between Framebuffer and active Texture」是 program 無效後的**次要雜訊，不是根因**。
壓爆上限那一個＝C2C runtime 新增的 `tR7310C1XatlasRuntimeAtlasTexture`（第 17 個）。
與載入哪個 package 無關（只開 xatlas 不開 nonSquare 仍全黑）；16 是 WebGL2/Metal 下限，使用者真機同黑。
違反 C2 設計（xatlas-bake-spike/xatlas-bake-c2-redfirst.md §37「xatlas mode 重用既有 sampler slot」）
與契約 docs/tests/r7-3-10-metal-bake-shader-contract.test.js:74（MAX_TEXTURE_IMAGE_UNITS<=16）。

### 1.2 修法（讓 runtime xatlas 重用既有 tR738C1BakeAtlasTexture slot；bake 路徑 PathTracingCommon.js:3313 本就這樣重用）
```
shaders/Home_Studio_Fragment.glsl
  :52    刪掉 `uniform sampler2D tR7310C1XatlasRuntimeAtlasTexture;`（改成註解）
  :1172  r7310C1XatlasRuntimeSampleTexel：texelFetch(tR7310C1XatlasRuntimeAtlasTexture,…)
         → texelFetch(tR738C1BakeAtlasTexture, pixel, 0)
js/InitCommon.js
  updateR738C1BakePastePreviewUniforms（~2479）：把無條件的 tR738C1BakeAtlasTexture 綁定
         gate 在 `applied`（只有貼上預覽 applied 時才佔用該 slot）
  updateR7310C1FullRoomDiffuseRuntimeUniforms（~2742-2743）：xatlasApplied 時
         把 xatlas DataTexture 綁到 tR738C1BakeAtlasTexture
```
**互斥安全**：runtime-xatlas / bake(captureMode==2) / floor 貼上預覽三者本就互斥——
`xatlasApplied`（2637-2640）與貼上預覽 `applied`（2468-2472）同掛
`r7310C1FullRoomDiffuseRuntimeConfigAllowed()` 但方向相反；bake 走 captureMode==2。

### 1.3 驗證（皆通過）
```
docs/tools/r7-3-10-c2c-blackscreen-probe.mjs（Metal）：修前 shader/GL 錯誤 287 則含 MAX_TEXTURE 超限
  → 修後 0 則、program valid、canvas 算出完整場景、sampleCounter 累積。
正常視圖（不開 xatlas）回歸：0 錯誤、未破壞。
node --check js/InitCommon.js / js/Home_Studio.js → OK
契約全過：r7-3-10-metal-bake-shader-contract / xatlas-bake-mode / xatlas-c2c-alpha /
  non-square-data-path / seam-contracts-all（4/4）。
```
根因/修法已寫入 docs/SOP/Debug_Log.md（章名「R7-3.10 C2C xatlas runtime 全黑」）。

### 1.4 快取鍵注意
Home_Studio.html 的 JS `?v=` 在本 session 一度被我 bump 成 `r7310-c2c-sampler-fix-v1`，
之後檔案又被改動過（CSS 鍵顯示 `r7310-ui-glow-restore-original-v1`）。
**CODEX 請先讀 Home_Studio.html 確認當前 `?v=`**，並 bump 一版，確保使用者瀏覽器載到修好的 shader/JS
（shader 改過，未硬重載會看到舊快取的全黑、誤判修復失敗）。

---

## 2. 待修（CODEX 主題）：LIVE 北牆西側破圖

### 2.1 症狀（使用者實測，權威）
在 `?nonSquarePackage=d800-north-denoise-c&xatlasPackage=a1-c2c-smoke`、**按「北牆烘焙：關」**（北牆走 live）時，
北牆西側（靠近天花板那條）出現破圖。使用者已多次截圖確認，**請直接接受此症狀、不要再去驗證它存不存在**。

### 2.2 根因（OPUS 讀 shader＋幾何後的判斷）
```
該帶 x≈[-1.91,-1.75]、y≈[2.525,2.905]、z=-1.874 是「西樑北端帽面」與「北牆」的共面重疊：
  西樑盒 z 由 -1.874 起、北牆盒 z 至 -1.874 止 → 兩個面都在 z=-1.874（見
  docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates/west-beam-north-contact-probe.json
  的 boxMin/boxMax；亦見記憶 project_r7310_seam_desync_pattern）。
shader 閘 r7310C1NorthWallHiddenByBeamGap(x,y)（Home_Studio_Fragment.glsl ~635）
  故意把 westBeamGap x[-1.908,-1.752] y[2.525,2.905] 從北牆所有權「放掉」（避免烤出黑線）。
→ 關北牆烘焙走 live 時，這條帶沒有乾淨的單一擁有者，兩個共面的面（樑帽面＋北牆面）
  在同一位置打架 → 破圖。烘焙開時貼圖蓋住一個值看不到；關烘焙走 live raw 幾何就現形。
```
這是 R7-3.10 接縫核心區（幾何/所有權層）。**與本次貼圖讀取修復無關**（texture read 不動幾何）；
A/B（xatlas 開 vs 關、同相機同樣本）整張圖平均僅差 ~1%。
注意誠實面：此 A/B 是整張圖平均、未逐像素隔離 A1 局部；若 CODEX 要 100% 排除 xatlas，
可用 §3 探針的 route/owner/luma 逐像素讀該帶（建議用使用者信任的
west-beam-north-contact-probe 那套硬數據，而非眼睛判截圖）。

### 2.3 修法方向（幾何/所有權層，要小心）
```
(a) 把西樑北端端面從 z=-1.874 退開（別跟北牆同平面），消掉共面打架；或
(b) 讓該帶在 live 時由單一面確定性勝出（intersection/ownership 決定性化）。
護欄（沿用 R7-3.10 規矩）：三邊（runtime gate + bake-point + metadata）要同步；
  不得只改一邊；改完用 docs/tests/r7-3-10-seam-contracts-all.mjs 鎖。
```

---

## 3. 新工具：docs/tools/r7-3-10-c2c-blackscreen-probe.mjs（READ-ONLY 診斷）
強制 Chrome、raw CDP；抓 console/log/exception＋Page 截圖＋canvas/WebGL/xatlas DOM 狀態。
```
env：ANGLE=metal|swiftshader  CDP_PORT  WAIT_MS  CAMERA_SETTLE_MS  OUT  SETUP_JS  CAMERA
範例（套相機 + 關北牆烘焙、累積樣本後截圖）：
  SETUP_JS='window.setR7310C1NorthWallDiffuseRuntimeEnabled(false)' \
  CAMERA='{"position":{"x":-0.523304,"y":2.304276,"z":0.796504},"forward":{"x":-0.393875,"y":-0.234787,"z":-0.888672},"fov":55}' \
  ANGLE=metal CDP_PORT=9330 WAIT_MS=22000 CAMERA_SETTLE_MS=16000 OUT=/tmp/probe \
  node docs/tools/r7-3-10-c2c-blackscreen-probe.mjs "http://127.0.0.1:9019/Home_Studio.html?nonSquarePackage=d800-north-denoise-c&xatlasPackage=a1-c2c-smoke"
注意：用 127.0.0.1（伺服器 bind 127.0.0.1，localhost 偶發走 IPv6 連不上）。
```

---

## 4. 其他待辦 / 狀態

```
directive #6（正式驗收網址）未做：
  - 不要用 smoke 包當驗收入口；要具名候選包 a1-c2c-runtime-candidate（需把 .omc smoke 包升為穩定候選 + 加 resolver 別名，
    別名解析在 js/InitCommon.js:1517-1542）。
  - 交網址前代理自驗 6 點（可開/非黑/cameraState可套/可累積/瑕疵在框/非smoke包）。
C2C「補洞」未接 runtime：C2C bake 已把 hiddenContact 標 alpha=0（見 source.md §19），
  但「alpha=0 的洞用 alpha-aware dilation 補 / 走 live」尚未接到 runtime，所以接觸面仍黑。
A1 驗收相機（已驗證可用，正對西樑北端↔北牆黑線）：
  position (-1.708748, 2.826862, -1.820144)  forward (-0.495699, 0.416871, -0.761906)  fov 55
使用者破圖相機：
  position (-0.523304, 2.304276, 0.796504)  forward (-0.393875, -0.234787, -0.888672)  fov 55
伺服器：9019 一度卡死、OPUS 已重啟：
  python3 -m http.server 9019 --bind 127.0.0.1 --directory "<專案根>"
```

---

## 5. 標準規矩（務必遵守）
```
- 絕不碰 Brave；一律強制 Google Chrome + 獨立 user-data-dir。
- 烘焙好的面 1 SPP 就該乾淨；不可拿「樣本不夠」解釋烘焙面的黑（OPUS 本 session 犯過、被使用者糾正）。
- 信任使用者開關實測勝過讀碼；矛盾時預設是讀錯。
- 全黑＝渲染鏈真的壞了（如 sampler 超限），不是 Samples 太低。
- 回覆使用者一律繁體中文、白話、縮寫寫「英文（中文）」。
```
