# R7-3.10 北牆降噪 — 正式候選產出（Stage 1 候選 C）【APPROVE】

OPUS 動工、CODEX 審查。本檔記錄第一個正式候選的產出、量化、與 A/B 驗收。
最終裁示見 §6（使用者 + CODEX 於 2026-06-03 APPROVE）。

## 1. 候選定義（場景 2：β color-only + RT，Stage 0 已定案）

```text
候選 C：D800 1000 SPP raw → OIDN RT high color-only（β、無 aux）
  surface：north-wall（北牆）   facing：北(-Z)
  aux 策略：color_only_beta（無 albedo、無 normal）
  filter：RT（非 RTLightmap）   quality：high   dilation：128（push-pull pyramid、levels=7）
  row order：flipRows=false（Stage 0 row probe 鎖定）
  OIDN：/opt/oidn-official/bin/oidnDenoise v2.4.1、device=Metal（Apple M4 Pro）
```

reference 框架（本輪主線變更）：metricsVsA 的 reference = raw 1000 SPP 自身（非 10000 SPP A）。
5×10000 SPP 多 seed 校準與 10000 SPP A 參考已從本輪主線移除（會把任務帶回超高 SPP、違背導入 OIDN 目的）。
故 metricsVsA = denoised vs raw = OIDN 對 1000 SPP raw 的「降噪變化量」。

## 2. 產物

```text
輸入 raw atlas：.omc/r7-3-10-full-room-diffuse-bake/20260602-015822/atlas-patch-000-rgba-f32.bin
  3379×2327 RGBA32F、valid 6,036,683 texel（76.77%）、SHA-256 420bb88d…af92
降噪 atlas（候選 C）：stage1/c1-north-d800-1000spp-oidn-rt-high-beta.bin
  SHA-256 79c50d53…358a、nanCount=0、infCount=0
§16.1 metrics：stage1/c1-north-d800-1000spp-candidate-metrics.json（schema-validate --strict = VALID）

atlas 空間 A/B（無渲染雜訊、同 exposure=1.966 tonemap）：
  stage1/raw-1000spp-atlas.png / denoised-1000spp-atlas-beta.png（全圖）
  stage1/ab-crop-bright-gradient-512-raw-LEFT-denoised-RIGHT.png（窗光漸層區 512²）
  stage1/ab-crop-center-overview-raw-LEFT-denoised-RIGHT.png（valid 中心 1400×1000）
  stage1/ab-crop-grain-closeup-2x-raw-LEFT-denoised-RIGHT.png（顆粒 2x 近拍）

runtime 北牆（北(-Z)）同視角 A/B（CDP / 真實 Chrome headless=new、Metal GPU、1000 SPP）：
  stage1/stage1-a-raw-north-wall-1000spp.png                     （A：nonSquarePackage=d800-north-preview）
  stage1/stage1-b-oidn-rt-high-color-only-north-wall-1000spp.png （B：nonSquarePackage=d800-north-denoise-c）
  stage1/stage1-ab-north-wall-raw-vs-oidn.png                    （左 raw｜右 denoised 並排 2570×720）
  stage1/stage1-ab-capture-report.json                          （每張 forward/facing/samples/viewport）

runtime A/B 套件（北東非方格 paste preview，north 區與來源逐位元一致）：
  A（raw）     ：nonSquarePackage=d800-north-preview     → north 區 SHA-256 == raw 輸入（已驗）
  B（denoised）：nonSquarePackage=d800-north-denoise-c   → north 區 SHA-256 == 降噪 atlas（已驗）
  兩套件東牆區塊與版面完全相同 → A/B 只差 north 的 raw vs denoised。

工具（本輪新增）：
  docs/tools/r7-3-10-atlas-ab-crop.mjs       （atlas 空間並排裁切）
  docs/tools/r7-3-10-north-ab-capture.mjs    （CDP 北牆 A/B 擷取器、強制 Chrome、SOP forward.z<-0.5 守門）
  docs/tools/r7-3-10-png-side-by-side.mjs    （PNG 並排）
```

## 3. 量化結果（denoised vs raw 1000 SPP、core 5,812,635 texel、距 boundary > 16）

```text
meanL1Rgb 8.971e-3 ; meanL1Luma 9.284e-3（佔 raw 平均 luma 0.256 約 3.5%）
p95L1Luma 2.588e-2 ; p99L1Luma 3.514e-2 ; maxL1Luma 3.360e-1
ssimLuma11x11 0.6772（與 raw 結構差異主要來自移除高頻顆粒，屬預期）
fftHighFreqRetention 0.377（sanity、不入主決策）; seamJumpRatio 0（未提供 seam-pairs）
oidn 814 ms、maxRSS 232 MB、device=metal、contextLost=0、passDecision pass（完整性層級）
```

與 Stage 0 spike_a（同一條 β color-only 全圖）逐位元吻合 → 降噪可重現、正確。
旁證：denoised runtime PNG 170 KB < raw 373 KB（高頻顆粒變少、壓縮更小）。
passDecision=pass 屬「完整性 + 降噪變化量」層級，非 Stage 0.5 之 3σ 正式門檻（本輪已移除 0.5）。
量產品質判定依 Stage 0 §Q-C：視覺去顆粒 + 無結構劣化 + schema/runtime 全通過 + 使用者肉眼 A/B。

## 4. A/B 視覺驗收

### 4.1 atlas 空間 A/B（已產出、嚴謹、無渲染雜訊）
直接比對烤圖本身，回答 §11 全部準則。OPUS 初判（待 CODEX + 使用者複核）：
denoised 略平滑於 raw；因 1000 SPP raw 已相當乾淨（meanL1 ~3.5%）差異細微；窗光漸層保住、無斷階；
無 ring、無明顯偏色、無過度平滑。

### 4.2 runtime 北牆（北(-Z)）同視角 A/B — 已產出（CDP / 真實 Chrome、1000 SPP）

使用者指定北牆 cameraState（CDP 擷取器 NORTH_CAMERA、已逐張驗證）：
```text
position = { x: 1.712181, y: 2.360559, z: -1.778225 }
yaw = -0.4276  pitch = 0.461  fov = 55
forward = { x: 0.371398, y: 0.444844, z: -0.814971 }   facing = 北(-Z)   forward.z = -0.815 < -0.5 ✓
viewport = 1280×720（aspect 1.7778）   sppCap = 1000
```
擷取結果（stage1-ab-capture-report.json）：
```text
A d800-north-preview   ：facing 北(-Z)、forward.z -0.815、samples 1000、aspect 1.7778、未見南窗
B d800-north-denoise-c ：facing 北(-Z)、forward.z -0.815、samples 1000、aspect 1.7778、未見南窗
兩張同 cameraState、同 viewport、同 sppCap，全程 facing=北(-Z)（CODEX 硬性規則達標）
```
路徑說明：headless Preview 的背景分頁 rAF 被節流至 FPS:0（無 console 錯誤、非崩潰），無法實渲新幀（截到過期南向幀）。
依 CODEX SOP 錯誤B 改走 CDP / 真實 Chrome（headless=new、--use-angle=metal）→ rAF 正常、~30 SPP/秒、約 30 秒收斂 1000 SPP。
重現：在能正常渲染的瀏覽器開 A/B URL → 開北東非方格 → 套上方 cameraState → 收斂 1000 SPP → 各截一張。

## 5. 禁止事項符合性
```text
未跑 5×10000 SPP / 未重測 normal aux / 未重測 RTLightmap / 未動 Homebrew OIDN
未改 source.md / 未重生 index.html / 未 promotion / 未覆蓋 accepted package
未用 Cam3（南牆）；runtime A/B 全程 forward.z<-0.5 北牆守門
throwaway .bin/.pfm 未入 git（stage1/ 大檔比照 stage0 .gitignore）
```

## 6. 最終裁示（2026-06-03、使用者 + CODEX APPROVE）

```text
decision   = APPROVE
selected   = D800 1000 SPP + OIDN RT high color-only（north-wall / 北(-Z)）
strength   = OIDN native output、無 amount / denoise strength 控制
mix        = not used（無 raw-denoised mix slider）
normal aux = permanently rejected for north-wall D800 production
RTLightmap = permanently rejected for north-wall D800 production
multi-seed noise floor = not a production prerequisite
```

使用者：看過 stage1-ab-north-wall-raw-vs-oidn.png，認定降噪效果很好——顆粒變乾淨，漸層、邊緣、接縫接受；
維持 100% OIDN RT high color-only 作為正式候選。
CODEX APPROVE 依據：A/B 走真實 Google Chrome + CDP、facing 北(-Z)、forward.z -0.815、
A/B 同 cameraState / viewport 1280×720 / sppCap 1000、未見南窗、schema-validate --strict VALID、
device metal、NaN/Inf 0、與 Stage 0 spike_a 逐位元吻合。

收尾：本決策文件 + PNG/JSON/MD + 3 支工具入版控；大檔 .bin/.pfm/atlas package/meta 維持 gitignore；
不 promotion、不覆蓋 accepted package。commit 前貼 git status + staged list 供 CODEX / 使用者確認。
