PLAN_TITLE: R7-3.10 北牆降噪（OIDN）三路實驗架構計畫 v4
PLAN_PATH: docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/plan.md
DELIBERATE: true

---

## §0 文件定位

本文件是 R7-3.10 北牆烤圖降噪實驗的「架構計畫 v4 修訂版」。
v4 處理 CODEX §16 五點 ITERATE 與 OPUS §17 / §17.2 對應裁示、
全面對齊 source.md §17 OPUS 裁示與本輪審查路徑變更：
  - v3 → v4 主要改動：--quality HQ → high、OIDN ≥ 2.3.0、§10.2 矩陣 marginal 不機械量產、
    Stage 0 加 (d) RTLightmap、§5.1 OIDN API RGBA 描述精準化、§24 Stage 1 單一路線
  - 本輪審查路徑：直接審 plan.md、不再走 source.md → index.html 雙線
    source.md 凍結於 §17 OPUS 裁示存底、index.html 不重生
    （§14.2 / §14.3 紀律屬跨 R-stage 規範、本輪 v4 豁免、後續 R 階段恢復）
v3 全部段落保留，受影響章節整段改寫；歷史變更摘要見文末。

本計畫只決定「實驗怎麼跑、怎麼判讀、怎麼決策」。

【本輪 v4 五審後角色互換、CODEX 八審 P1 對齊】
  本輪 v4 五審後 OPUS 動工授權 §13.3 P0 / P1：
    OPUS 負責寫 plan.md（本檔）與各階段 stage decision md、實作程式碼、執行 bake 與 OIDN、產出 metrics
    CODEX 改任「審查者」角色：審 plan.md / stage decision md 變更、審工具程式碼、審 metrics.json
                                  + 視覺截圖、回 APPROVE / ITERATE、不執行任何 bake / OIDN / tool 工作
  原 v3 規範（§21）：OPUS 寫 / CODEX 動工、後續其他 R 階段恢復
  原因：CODEX 流量使用率 over、本輪走低頻審查模式
  v3 原文「實作與執行交給 CODEX」與本輪 §26 動工授權衝突、v4 八審 CODEX P1 已對齊

【本輪 v4 審查路徑變更】
  v3 規範：OPUS 寫 source.md、CODEX 從 source.md 重生 index.html（html-review 機制）。
  本輪 v4 改：直接對話窗審 plan.md、source.md 凍結於 §17 OPUS 裁示存底、index.html 不重生。
  原因：source.md / index.html 雙線同步成本過高、章節編號混淆已踩坑。
  MEMORY feedback_html_review_source_of_truth + feedback_opus_codex_review_split 本輪豁免、
  後續其他 R 階段恢復雙線。
  各 stage 產出寫進 stage0/ stage05/ stage1/ 目錄與 stage-decision.md（見 §12 / §21）。

本文件的「實驗第一階段」是 Stage 0 OIDN 適用性 spike，第二階段是 Stage 0.5 噪聲下限校準，第三階段才是 Stage 1 A/B/C 變體量產驗證。Stage 0 / 0.5 不通過則整輪 OIDN 路線中止，升 R7-3.11 評估 BM3D / SVGF。

本文件全程使用：

```text
OIDN：Open Image Denoise（Intel 開源烤圖／路徑追蹤降噪函式庫）
SPP：samples per pixel（每像素樣本數）
atlas：lightmap atlas（光照圖集，把多個面塞進一張紋理）
texel：texture pixel（紋理像素，atlas 上的一格）
ROI：region of interest（指定觀察區域）
SSIM：structural similarity index（結構相似性指標）
AO：ambient occlusion（環境光遮蔽，凹角變暗的效果）
RGBA32F：每通道 32-bit float、4 通道（紅綠藍 + alpha）的影像格式
PFM：Portable Float Map（OIDN CLI 接受的 32-bit float 影像格式，僅支援 3 通道）
EXR：OpenEXR（工業標準的高動態範圍影像格式，支援多通道含 alpha）
NEE：next event estimation（路徑追蹤的「直接照向光源」採樣技巧）
MIS：multiple importance sampling（多重重要性採樣）
```

---

## §1 目前共識（v1 全部正確、v2 不重新討論）

### §1.1 D 值定案：D = D800

D 是北牆 lightmap atlas 的單面解析度（face 的長邊邊長，texel 數）。D800 對應的 face 大小為 3379 × 2327 texel，已由前一輪 D-ramp 實驗（`docs/html-review/2026-06-01-r7-3-10-north-wall-d-ramp-plan/source.md`、`docs/html-review/2026-06-01-r7-3-10-d/`）定案。

D = D800 是定案前提，v2 不重新討論。Critic r1 提出的「D 鎖定 D1000」是事實錯誤已拒絕：

```text
- D800 vs D1000：D1000 已被「邊際遞減 20%」否決並退場。
- CODEX 工具測過 D-ramp 邊際遞減：D800 → D1000 的 mean L1 改善 <5%，
  但 atlas binary 體積與 GPU 提交時間漲 ~56%。
- d1000-north-preview package 仍存在僅作歷史對照，不再用於後續實驗。
- v2 任何變體都鎖在 D = D800（face 3379 × 2327 texel）。
```

### §1.2 三變體保留（A=10000 SPP / B=5000 SPP+DN / C=1000 SPP+DN）

v1 提出的三變體方向保留，但 B 變體必須給結構性辯護（Architect M4 + Critic 同步要求）。v2 §4 會處理 B 的辯護或刪除。

### §1.3 OIDN 為主要降噪工具

OIDN 是業界標準（Cycles 內建、V-Ray 整合、Arnold 整合），使用者指定 OIDN 為本輪首選。但 ADR 必須真實評估 BM3D / SVGF 等替代，Critic C5 已糾正 v1 的「無工業案例」「無 temporal」誤判，v2 §13 改正。

### §1.4 atlas 是 albedo-free 純間接光輻射

```text
bakedRadianceKind = "indirect_diffuse_radiance"
multiplyAlbedoAfterBakeLookup = true   // runtime 時才乘 albedo
```

這條決定 OIDN aux（auxiliary channel，輔助通道：albedo / normal）策略的特殊性：

```text
- 一般 path tracer 降噪：noisy color * albedo 後降噪 → 把 albedo 從輸入剝離
  讓 OIDN 看 albedo-free 訊號。
- 我們的場景：atlas 本身就已經是 albedo-free（multiplyAlbedoAfterBakeLookup
  在 runtime 才乘），所以 OIDN 的 input 已經是它想要的「分離後訊號」。
- 因此 OIDN albedo aux 餵「常數白 1.0」在訊號層面是正確的（網路認為
  輸入已被 albedo normalize），但語意層面會誤導網路（見 §4 M3）。
- normal aux 不受 albedo 分離影響，可獨立評估。
```

這條會在 §5 OIDN pipeline 規格的 aux 策略段落硬約束。

---

## §2 為什麼用 OIDN（含 P1 vs P5 衝突解決）

### §2.1 P1（保留可解析高頻細節）vs P5（atlas 是 albedo-free 純間接光輻射）的衝突

```text
P1 原則：降噪不可破壞 lightmap atlas 上可解析的高頻細節
  （beam shadow 邊、AO ridge、cone leak 殘影、踢腳線陰影邊、窗框內影）。
P5 原則：atlas 是 albedo-free 純間接光（indirect_diffuse_radiance）。
  間接光本身就是低頻、空間平滑的訊號，OIDN 訓練先驗（prior）也
  假設「path traced indirect 應該平滑」。
```

P1 與 P5 衝突點：

```text
- P5 說「訊號應平滑」 → OIDN 會更積極平滑 → 把 AO 邊吃掉（違反 P1）。
- P1 說「邊要留」 → 需要餵 prefiltered normal aux 把幾何邊還回去。
- 結論：irradiance bake 情境下 P5 trumps P1。但 P1 的執行手段
  是 prefiltered normal aux + 限制平滑強度。
```

### §2.2 ADR 一條（P1 vs P5）

v2 在 §13 ADR 加一條：

```text
[ADR-P1-P5]
Context: irradiance bake 的 OIDN 降噪。
Decision: 衝突時 P5 優先，但用 prefiltered normal aux 保住 P1 要求的幾何邊。
Drivers: OIDN 訓練先驗預期 indirect 平滑（P5）；AO ridge 是幾何相關，
        normal aux 可重建邊（P1）。
Alternatives considered:
  - 只用 color-only：拋棄 P1，最快但 AO 邊風險高。
  - 用常數白 albedo aux：見 M3，劣化。
  - 用 prefiltered normal aux：理論上兼顧 P1 / P5，但需驗證。
Why chosen: 留在 Stage 0 spike 用實驗判定（β / γ 兩組對照），不靠先驗下結論。
Consequences: spike 失敗則 OIDN 路線整體中止，退 BM3D / SVGF 評估。
Follow-ups: 見 §13 F1–F8。
```

### §2.3 為什麼不直接用 BM3D / SVGF

```text
- BM3D：block-matching 3D 降噪，傳統演算法，無神經網路偏差。
  本輪不選的真實理由：實作週期不對、不在本輪時間預算內。
  Cycles / V-Ray / ImageJ / OpenCV 都有實作（不是「無工業案例」，
  v1 的這個排除理由是錯的）。
- SVGF：spatiotemporal variance-guided filter，realtime path tracer 主流。
  本輪不選的真實理由：需從 GLSL 翻譯成獨立 CLI 工具，不在本輪時間預算內。
  空間部分可單獨跑（不是「無 temporal」，v1 的這個排除理由也是錯的）。
- BM3D / SVGF 若 OIDN 全失敗（Stage 0 abort）會升 R7-3.11 評估。
```

---

## §3 本輪範圍

### §3.1 In scope（本輪要做的事）

```text
1. Stage 0：OIDN 適用性 spike（2 小時 wall time 預算）。
   用現有 D800 1000 SPP 北牆 atlas（已 throwaway）跑四組對照（v4 含 §17 P2-1 新增 (d) RTLightmap）：
   - 對照 (a) color-only β
   - 對照 (b) color + constant-white albedo（驗證 M3 劣化）
   - 對照 (c) color + prefiltered normal γ
   判定 aux 策略並驗證 OIDN 適用。

2. Stage 0.5：噪聲下限校準。
   同 D（D800）+ 同 SPP（10000）跑 N = 3-5 次不同 RNG seed，
   算配對 mean L1 / p99 / SSIM / AO ROI delta 的標準差 σ，
   取 3σ 上界當作通過門檻。

3. Stage 1：A/B/C 三變體量產驗證（或 6 變體，見 §4 M4）。
   - A：10000 SPP raw（reference，無降噪）
   - B：5000 SPP + OIDN（中段路線）
   - C：1000 SPP + OIDN（最快路線）
   全部鎖在 D800、北牆、albedo-free indirect radiance。

4. 量化指標：mean L1（RGB + luma）、p95/p99/max L1（luma）、
   SSIM（luma, 11×11, BT.709, dynamic range L = 實測 max luma）、
   AO ROI delta、seam jump ratio、FFT 高頻保留率。
   全部明寫色空間、通道、視窗、排除範圍。

5. 視覺驗收：sweep-spot 對照截圖（沿用 §22.5 機制，URL key 白名單擴充）。

6. 決策：基於 metrics.json + 視覺，選 A / B / C 之一作為北牆量產路線。
```

### §3.2 烤圖框架的兩層 scope（v3 重寫，回應 MF1）

v2 籠統寫「不動烤圖框架本身」與後續 §15 RNG seed 契約、§S0.5 normal aux 需求互相矛盾。v3 把 scope 切成「鐵律不破」與「框架可擴充」兩層：

```text
不動烤圖框架本身的「保穩定執行的鐵律」（缺一則 bake 結果不可信）：
  - tile 512 × 512
  - fence 提交
  - every-samples = 4
  - Google Chrome（never Brave）
  - submission boundary = fence

本輪必須擴充的框架部分（in-scope，但不破鐵律）：
  - bake runner 加 --seed=<32bit hex>、--dump-at-samples=N,M,...、
    --output-mode=indirect_radiance|normal 三個 CLI 旋鈕
    （新 ADR：ADR-Bake-Runner-Extensions，詳 §13）
  - bake shader 加 outputMode uniform branch，切換 indirect_radiance 與
    world_space_normal 輸出
    （新 ADR：ADR-Normal-Aux-Shader，詳 §13）
  - InitCommon.js resolver 擴 12 個新 URL key（if-else 分支）
    （新 ADR：ADR-InitCommon-URL-Keys，詳 §13）

其他不動的事（與 v2 相同）：
  - 不動 D（D800 鎖定）。
  - 不動 atlas binary 格式（仍 RGBA32F 4 通道，alpha = valid mask）。
  - 不動 runtime（multiplyAlbedoAfterBakeLookup 仍 true）。
  - 不做其他牆面（西牆 / 東牆 / 天花板 / 地板）的降噪——本輪只北牆。
  - 不做 promotion（throwaway only）。
  - 不刪 D800-accepted package（歷史對照保留）。
  - 不在本輪實作 BM3D / SVGF（升 R7-3.11）。
  - 不評估 SVGF 的 temporal 路徑（單張 atlas、無 temporal 訊號）。
  - 不改 InitCommon.js URL query 參數名（仍是 nonSquarePackage、v2 寫錯為 v）。
  - 不改 resolver function signature、不改成 lookup table。
```

---

## §S0 Stage 0：OIDN 適用性 Spike（2 小時 wall time 預算）

### §S0.1 預算與目標（v3 重切分，回應 NH1）

```text
Wall time 預算：2 小時。
  - OIDN 安裝與環境配置（含 Metal backend 驗證）：30 分鐘
  - 四組對照（a / b / c 整張 + d crop）執行：≈ 3 × 3 分鐘 + 30 秒 = ~10.5 分鐘
    (a) (b) (c) 每組 ~3 分鐘明細：
      atlas binary → PFM 轉換：~5 sec
      mask-aware dilation（push-pull pyramid R=128）：~10 sec
      OIDN run（high + aux）：~30 sec
      PFM → atlas binary + post-mask：~5 sec
      metrics 計算：~30 sec
      其他 IO / 等待：~30 sec
    (d) RTLightmap crop（v4 加、§17 P2-1）：
      512² 或 1024² valid crop（不必整張 D800）
      crop + PFM 轉換：~5 sec
      OIDN run（RTLightmap、color-only、無 aux）：~10 sec
      crop metrics：~15 sec
      合計：~30 sec
  - 肉眼判讀 + OPUS 偏差熱點 map 截圖標註：~70 分鐘
  - spike-aux-decision.md 撰寫：~10 分鐘
總計：2 小時

目標：在 D800 1000 SPP 北牆 atlas 上判定：
  (1) OIDN 是否對本場景訊號有效；
  (2) aux 策略選擇（β color-only / γ prefiltered normal）；
  (3) α 常數白 albedo aux 是否真的劣化（M3 驗證）。
不做：不跑 5000 SPP / 10000 SPP；不做 Stage 1 量產驗證。
```

### §S0.2 四組對照規格（v3 三組、§17 P2-1 補 (d) 改四組）

```text
共用輸入：D800 1000 SPP 北牆 raw atlas（現有 throwaway package）。
  Path（待 CODEX 確認實際 binary 檔名）：
    .omc/r7-3-10-full-room-diffuse-bake/<latest-d800-north>/atlas.bin
  Format：RGBA32F，face 3379 × 2327 texel，alpha = valid mask（>0.5 = valid）。

對照 (a) β color-only：
  OIDN input：color（RGB，PFM 3 通道）
  OIDN aux：無
  OIDN filter type：RT（path-traced）
  OIDN quality：high（high quality, U-Net）
  OIDN hdr：true（input 是 linear HDR）
  OIDN cleanAux：N/A（無 aux）

對照 (b) α constant-white albedo：
  OIDN input：color（RGB）
  OIDN aux：albedo（全 1.0 常數，PFM 3 通道）
  OIDN filter type：RT
  OIDN quality：high
  OIDN hdr：true
  OIDN cleanAux：true（常數白可視為 clean）
  M3 假設：此組會比 (a) 差或相當（網路把 spatial variance 全認雜訊）。

對照 (c) γ prefiltered normal（v4 CODEX 二審修正：OIDN normal-only 不支援）：
  OIDN input：color（RGB）
  OIDN aux：constant-white albedo + normal（per-texel world-space normal，PFM 3 通道）
    ※ OIDN 2.4.1 實測：normal-only（--nrm 無 --alb）報
      "Error: unsupported combination of input features"。
      OIDN RT filter 的 normal aux 必須伴隨 albedo aux、不能單獨使用。
      故 γ = 常數白 albedo（全 1.0、無 spatial detail）+ normal aux。
      常數白 albedo 不提供額外空間資訊、(c) 仍主測 normal aux 增益、與原意圖一致。
      實作見 docs/tools/r7-3-10-oidn-bridge.mjs --aux=gamma（自動補常數白 albedo）。
  OIDN filter type：RT
  OIDN quality：high
  OIDN hdr：true
  OIDN cleanAux：true（normal 1 SPP 即收斂無噪聲、常數白 albedo 亦無噪聲）
  normal aux 來源：見 §S0.5（OQ1 答覆）。
  其他引用處（L308 / L364「RT + normal aux」）以本主定義為準：實際是 RT + 常數白 albedo + normal aux。

對照 (d) RTLightmap-color-only（§17 P2-1 + CODEX §16 P2-1 加入）：
  OIDN input：color（RGB，PFM 3 通道）
  OIDN aux：無（RTLightmap filter 不支援 albedo / normal aux buffer）
  OIDN filter type：RTLightmap（RT 變體、官方為 HDR lightmap 最佳化）
  OIDN quality：high
  OIDN hdr：true
  OIDN cleanAux：N/A（無 aux）
  小樣本：512 × 512 或 1024 × 1024 valid crop 即可、不必整張 D800。
  理由：本案 atlas 是 indirect radiance lightmap、official RTLightmap 設計目標就是這類訊號。
        必須與 RT (a) / (b) / (c) 對照一次、才能在 ADR-OIDN-Filter-Selection（§13）寫定 RT vs RTLightmap 結論。
  限制：
    若 (c) γ 顯著勝過 (d)、Stage 1 仍走 γ（RT + normal aux），(d) 寫入 spike-aux-decision.md 淘汰。
    若 (d) 勝過 (a) (b) (c)、需評估 RTLightmap 在後續 Stage 1 替代 RT 的可行性
      （注意 RTLightmap 無 normal aux 擴展性）。
```

#### §S0.2.1 Stage 0 raw atlas 重跑 bit-exact 驗證（v3 新增，回應 SF7）

```text
若 spike 過程中需重跑 raw atlas（例：(b) NaN 後懷疑 raw 也有問題）：
  - 必須先驗「runner 在無 seed 注入下、同硬體、同程式碼 commit 跑出的
    atlas 與 throwaway bit-exact」
  - 如何驗：用 ADR-Bake-Runner-Extensions 完成的 --seed=<seed_unknown_extracted>
    重跑（seed_unknown 從 throwaway metadata 反推；若 throwaway 沒紀錄 seed
    → 視為「未鎖」）
  - 若 bit-exact → 重跑沒意義、直接 abort spike、分析 (b) NaN 原因
  - 若不 bit-exact → runner 取樣 nondeterministic、整輪 OIDN 路線需先修 runner
    （升 ADR-Bake-Runner-Extensions 強制完成）

注意：throwaway package 是 D-ramp 階段跑的（seed 當時未注入），所以 throwaway
     的 seed 是「當時 runner 預設行為產生的序列」、無法精確復現。
     若需重跑 spike raw atlas → 必須改用 seed_0 = 0xDEADBEEF 重跑、
     並承認新 raw 與 throwaway 不 bit-exact。
```

### §S0.3 abort 條件（v2 必補）

```text
abort A：任一組 OIDN 產 NaN / Inf
  → 整輪 OIDN 路線中止
  → 退回 A 路線（10000 SPP 不降噪）或評估 BM3D / SVGF
  → 寫 R7-3.11 ralplan
abort B（v4 四組、CODEX §16 三審 P1 修正）：
  abort B.1：(a) / (b) / (c) 三組 full-atlas mean L1 改善全部 < 30%（vs noisy input）
    → 整輪 OIDN 路線中止（RT filter 對本場景不適用）
    → 退回 A 路線
  abort B.2：(d) RTLightmap crop mean L1 改善 < 30%（vs crop noisy input）
    → 不獨立 abort、僅在 spike-aux-decision.md 寫「RTLightmap 不適用、淘汰」
    → 若 (a/b/c) 任一通過、整輪走 RT；若 (a/b/c) 全失敗才進 abort B.1
  注意：(d) 是 crop 指標、與 (a/b/c) full atlas 指標分開比、不可混算平均
abort C：(c) γ normal aux 自身 SSIM < 0.95
  → 改用 (a) β color-only，不可用 (c)
abort D：(b) α 比 (a) β mean L1 差 > 5%
  → 確認 M3 劣化，α 路線剔除（與 Stage 1 變體名單一致）
abort E：OIDN 子程式 max RSS > 1.5 GB
  → 視為 OIDN 在本機（M4 Pro 48 GB unified memory）失控
  → spike 中止重評估
abort F：OIDN 單張 atlas 處理時間 > 60 s
  → 視為 Metal backend stall
  → spike 中止（v4 六審 CODEX P1：不退 CPU、使用者裁示有 GPU 必走 GPU、CPU 備援路徑全刪）
  → 排查 Metal device 狀態、確認非 thermal throttle / GPU memory pressure 後重跑
```

### §S0.4 四組對照的判定矩陣（v4 加入 RTLightmap (d)、§17 P2-1 + CODEX §16 P2-1）

```text
場景 1：(a) 通過 + (b) 劣化 + (c) 顯著好 + (d) 不勝過 (c)
  → Stage 1 採 (c) γ prefiltered normal aux（RT filter + normal aux）。
  → ADR：M3 驗證成立、aux 策略 = γ、filter 鎖 RT。
  → spike-aux-decision.md 寫「RTLightmap 不勝出、淘汰、RT + normal 為量產 filter」。

場景 2：(a) 通過 + (b) 劣化 + (c) 與 (a) 相當 + (d) 不勝過 (a)
  → Stage 1 採 (a) β color-only（normal aux 無增益、RTLightmap 無增益、走最便宜）。
  → ADR：M3 驗證成立、aux 策略 = β、filter 鎖 RT。

場景 3：(a) 通過 + (b) 相當 + (c) 顯著好
  → Stage 1 採 (c) γ，但 ADR 必須記錄 M3 假設未完全成立。
  → 留 follow-up F? 進一步分析 albedo aux 為何沒劣化。

場景 4：(a) 失敗（mean L1 改善 < 30%）
  → 進入 abort B、整輪 OIDN 路線中止。

場景 5：(c) NaN / Inf
  → normal aux 來源有 bug（多半 padding 區 normal 全零）、
    修 normal aux 來源、重跑 (c)。修兩次仍 NaN 則 abort A。

場景 6（v4 新增）：(d) RTLightmap 顯著勝過 (c)
  → ADR-OIDN-Filter-Selection（§13）改寫：Stage 1 評估 RT vs RTLightmap 替換可行性。
  → 注意：RTLightmap 不支援 normal aux，若 Stage 1 需要 aux 擴展性
    （未來推到其他面、normal 變化大），RTLightmap 仍可能不適用。
  → spike-aux-decision.md 寫成「RTLightmap 勝出、Stage 1 走 RTLightmap、
    aux 策略保留 β（無 aux）」或「RTLightmap 勝出但限本案北牆、其他面仍 RT」。

場景 7（v4 新增）：(d) 與 (c) 相當、(d) 與 (a) 相當
  → RTLightmap 對本案無增益、淘汰。Stage 1 走 (c) γ 或 (a) β。
  → spike-aux-decision.md 寫「RTLightmap 試過、無增益、後續面不再評估」。
```

#### §S0.4.1 Stage 0 spike 暫定門檻（v3 新增，回應 SF8）

```text
Stage 0 spike 暫定門檻（後續 Stage 0.5 校準後重審）：
  通過：mean L1 改善 > 30%（vs raw input）
  顯著好：(c) 比 (a) 的 mean L1 再改善 > 15%
  劣化：(b) 比 (a) mean L1 差 > 5%
  相當：差 < 5%

注意事項：
  - 這些門檻是 spike 暫用、用於 Stage 0 階段裁示
  - Stage 1 必須換成 Stage 0.5 校準後的 3σ 門檻
  - 若 spike 用暫定門檻得 PASS、但 Stage 0.5 校準後得 FAIL
    → 升 ralplan 重新評估
```

### §S0.5 normal aux 來源（OQ1 答覆）

```text
問題：bake 階段不會自然產出 per-texel normal，normal aux 從哪來？

答覆：normal aux 用獨立的 geometry-only bake pass 產生：
  - SPP = 1（normal 是幾何屬性，無 Monte Carlo 變異，1 SPP 即收斂）
  - 改 shader pipeline 在 atlas write 階段輸出 world-space normal 而非
    indirect radiance；保留同樣的 valid-mask alpha。
  - 不需要 NEE / BSDF 採樣，只是把 geometry stage 的 worldNormal 寫進 atlas。
  - Output：normal_atlas.bin（RGBA32F，alpha = 同一個 valid mask）。
  - 估時：1 SPP × D800 北牆 ~30 秒（單一 GPU pass，無採樣循環）。

OQ3 答覆：normal aux 1 SPP 是「對的選擇」、不要烤 256 SPP：
  - 法線無噪聲，多 SPP 等同浪費 GPU 時間。
  - 1 SPP 等同 deterministic raster pass，
    與 256 SPP 結果 bit-identical。
```

### §S0.6 PFM ↔ RGBA 轉換（與 §5 M1 整合）

```text
spike 階段也必須處理 §5 M1 的 4 通道 alpha 破口：
  - atlas binary 是 RGBA32F 4 通道
  - PFM 標準格式只支援 3 通道 RGB
  - 解法：見 §5 M1 完整規格
spike 工具：用 §5 §5.4 列的 oidn-bridge.mjs 同一支工具
（不寫第二支，避免 spike 工具與 Stage 1 工具發散）。
```

### §S0.7 spike 產出物清單

```text
docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/stage0/
  spike-a-color-only.bin           # OIDN output binary（RGBA32F）
  spike-a-color-only.png           # tonemapped 截圖
  spike-b-constant-white.bin
  spike-b-constant-white.png
  spike-c-prefiltered-normal.bin
  spike-c-prefiltered-normal.png
  spike-d-rtlightmap-crop.bin      # (d) RTLightmap crop output（v4 加、§17 P2-1）
  spike-d-rtlightmap-crop.png      # crop tonemapped 視覺
  normal_atlas.bin                 # 共用的 1 SPP normal aux
  spike-metrics.json               # v4 含兩段：
                                   #   abc_full_atlas_metrics（a/b/c full atlas mean L1 / SSIM / AO ROI delta）
                                   #   d_rtlightmap_crop_metrics（d crop mean L1 / SSIM）
  spike-aux-decision.md            # v4 含兩節：
                                   #   aux 策略決定（β 或 γ）
                                   #   RT vs RTLightmap 結論（場景 1-7 之一）
  spike-oidn-version.txt           # OIDN 版本紀錄（stdout version=X.Y.Z）
```

### §S0.8 spike URL key（與 §C10 整合）

```text
URL key 白名單新增（不改 InitCommon.js 結構）：
  - d800-north-spike-color-only
  - d800-north-spike-constant-white-albedo
  - d800-north-spike-prefiltered-normal
  - d800-north-raw-1000spp（spike 用同一張 raw input）
```

---

## §S05 Stage 0.5：噪聲下限校準

### §S05.1 為什麼這層不能省

```text
Critic 強調：沒這層，§9 的通過門檻數字就是憑感覺，
  CODEX 機械裁示時無法判斷「mean L1 0.004 vs 0.005 到底有沒有差」，
  造成「機械裁示破口」（裁示結果隨 RNG seed 變動）。
v2 必加：把通過門檻錨在實測 noise floor 上，
  確保門檻不會比 noise floor 還嚴（無法達成）也不會比 noise floor 鬆 10×（無意義）。
```

### §S05.2 校準 SOP

```text
1. 鎖定條件：D = D800、北牆、SPP = 10000、aux 策略 = Stage 0 決定的 β 或 γ。
   不跑降噪（純 raw 10000 SPP）。
2. 跑 N = 3-5 次不同 RNG seed（建議 N = 5，3 太少、6+ 不划算）。
   每次同樣 setup、只換 base seed。
3. 對所有 C(N, 2) = 10 個（N=5 時）配對算：
   - mean L1（RGB + luma）
   - p99 L1（luma）
   - SSIM（luma, 11×11, BT.709）
   - AO ROI delta（§9 §9.4 五個 ROI）
4. 對每個指標取所有配對的標準差 σ。
5. 通過門檻 = 3σ 上界（覆蓋 99.7% noise floor）。
6. 比對 v1 先驗門檻：
   - 若 3σ ≤ v1 先驗門檻 → 用 v1 先驗門檻（嚴格）。
   - 若 3σ > v1 先驗門檻 → 放寬到 3σ 或承認該門檻無法達成、
     升 R7-3.11 評估更嚴格的降噪策略。
```

### §S05.3 校準預算（v3 統一 wall time，回應 SF5）

```text
Wall time 樂觀估：7.5 小時（5 seeds × 90 min/seed）
Wall time 含 thermal throttling buffer：9-10 小時（5 seeds × 90-120 min/seed）
本機只一張 GPU，無法平行、必須循序跑、再加 10 配對指標計算 ~10 分鐘。

abort 條件：任一 seed > 120 min → 改 N = 3
N = 3 時 wall time：5.5-6 小時

排日：Day 1 晚 ~22:00 開始跑、Day 2 上午 ~08:00 收集
（含 buffer 全部夜間 wall time、不擋日間其他工作）
```

### §S05.4 校準產出物

```text
docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/stage05/
  seed-{0..4}-raw.bin               # 5 個 seed 的 raw atlas
  seed-{0..4}-tonemap.png           # 視覺對照
  noise-floor-metrics.json          # 10 配對的指標
  noise-floor-3sigma-thresholds.md  # 最終門檻數字
```

---

## §4 變體規格（A/B/C；含 B 結構性辯護或刪除）

### §4.1 三變體基本規格

```text
變體 A（reference，無降噪）：
  D = D800（face 3379 × 2327 texel）
  SPP = 10000
  aux 策略：N/A（不降噪）
  atlas binary：~120 MB raw（RGBA32F）
  估時：~90 分鐘 wall time（tile 512 × 512、fence、every-samples=4、Chrome）
  用途：絕對 reference，所有指標的 baseline。

變體 B（中段路線，5000 SPP + OIDN）：
  D = D800
  SPP = 5000
  aux 策略：Stage 0 決定（β 或 γ）
  atlas binary：~120 MB raw + ~120 MB denoised
  估時：~45-50 分鐘 raw + ~30 秒 OIDN + ~10 秒 metrics = ~46 分鐘 wall time
  用途：見 §4.2 結構性辯護。

變體 C（最快路線，1000 SPP + OIDN）：
  D = D800
  SPP = 1000
  aux 策略：Stage 0 決定（β 或 γ）
  atlas binary：~120 MB raw + ~120 MB denoised
  估時：~9-10 分鐘 raw + ~30 秒 OIDN + ~10 秒 metrics = ~10 分鐘 wall time
  用途：終極時間優勢路線、最大效能 / 品質 trade-off 點。
```

### §4.2 B 的結構性辯護（M4 必修）

v2 採選項 1：保留 B 並給結構性辯護。理由：

```text
辯護核心：B 對 C 的結構性優勢來自「raw SNR floor」。
  - C（1000 SPP）的 raw atlas mean SNR ≈ √1000 ≈ 31.6 倍 single-sample。
  - B（5000 SPP）的 raw atlas mean SNR ≈ √5000 ≈ 70.7 倍 single-sample。
  - B 的 raw SNR 是 C 的 ~2.24 倍。
  - OIDN 訓練資料假設 input SNR > 某下限（Intel 沒公開精確值，
    但 Cycles 社群實測 1024 SPP 是「OIDN 對 indoor irradiance
    可預測」的軟下限）。
  - 若 C 的 1000 SPP 落在 OIDN 訓練先驗「分布外」（out of distribution），
    B 的 5000 SPP 可能仍在分布內。
  - 此時 B vs C 的差異不是「OIDN 平滑得更乾淨」而是
    「OIDN 對 B 的 input 做出可預測重建、對 C 的 input 做出
    隨機重建」（風險：OIDN hallucination）。

B 的結構性必要性：
  - 若 Stage 1 跑出來「B 過門檻、C 不過門檻」，B 就是落點。
  - 若 Stage 1 跑出來「B 與 C 都過門檻」，選 C（wall time 短）。
  - 若 Stage 1 跑出來「B 與 C 都不過門檻」，回 A 路線。
  - B 不是冗餘變體，是「OIDN 對 C SNR 不足時的緩衝」。

文獻 / 實測支撐：
  - Cycles 社群基準：interior indirect lighting OIDN 建議 SPP > 512-1024。
    本場景是 indirect_diffuse_radiance（已 albedo-free），條件比一般
    Cycles 場景更友善（無 albedo high-frequency），但 SPP 軟下限仍存。
  - Intel OIDN 官方範例（demo scenes）多用 SPP > 1024。
  - 本機 spike（Stage 0）會在 1000 SPP 上直接測 OIDN 適用性，
    若 1000 SPP 已過 → C 直接可用、B 變保險路線。
    若 1000 SPP 不過 → B 是唯一可能過的中段。
```

v2 不採選項 2（刪 B）的理由：Stage 0 結果未知前，無法斷言 B 冗餘。

v2 不採選項 3（改 6 變體單一變因）的理由：本機 GPU 單張、6 變體 wall time ≈ 6 × ~30-90 min ≈ 4-9 小時，且其中 (5000 SPP no-DN) (1000 SPP no-DN) 對北牆量產決策無用（這兩個本身就比 A 差，不可能成為量產路線）。

ADR 一條（Stage 1 變體妥協）：

```text
[ADR-Stage1-Variants]
Context: Stage 1 三變體 A / B / C 不是嚴格 P2「單一變因」設計。
Decision: 三變體是工程現實妥協（GPU 單張、wall time 受限）、
        非嚴格 P2 對照設計。
Drivers: P2 嚴格對照需 6+ 變體，本機 wall time 不足。
Alternatives considered: 6 變體（A / A' / B / B' / C / C'），含「+DN/不+DN」對照。
Why chosen: 三變體覆蓋「無降噪 reference」「中段降噪」「快速降噪」
          三個量產候選；單一變因對照交給 Stage 0 spike（β vs γ）。
Consequences: A 與 B 的 SPP 差別同時改 SPP 與 +DN 兩個變因；
            若 B 過 / A 不過，無法直接歸因「是 SPP 5000 夠用 or +DN 救了」。
            但兩種解讀都導向同一決策（量產用 B），所以不影響 Stage 1 結論。
Follow-ups: F7（若量產後北牆失敗，回頭跑 6 變體單變因對照）。
```

### §4.3 三變體共用條件（鎖死、不可動）

```text
- D：D800（face 3379 × 2327 texel）
- 牆面：北牆（north wall，含窗框 / 門框內側陰影）
- 烤圖工具：Google Chrome（never Brave，見 §14 §14.1）
- tile：512 × 512
- fence：每 tile 提交 fence、缺了 GPU 提交無 safety gate
- every-samples：4（每 4 個 sample 回傳 progress）
- submission boundary：fence
- atlas binary format：RGBA32F 4 通道，alpha = valid mask（>0.5 = valid）
- bakedRadianceKind：indirect_diffuse_radiance（albedo-free）
- runtime multiplyAlbedoAfterBakeLookup：true（不改）
- RNG seed：A / B / C 共用同一 deterministic base seed（見 §15）
```

---

## §5 OIDN pipeline 規格（M1 完整解法）

### §5.1 OIDN 版本與環境要求

```text
OIDN version：≥ 2.3.0（建議目前官方 arm64 macOS 2.4.1）
  - v2.2.0 才加入 Apple Silicon GPU Metal device（需 macOS Ventura+）
  - v2.3.0 改善 RT filter high quality mode 對 HDR + cleanAux 品質
  - 本案需要 RT high quality + cleanAux + normal aux 組合 → 鎖 ≥ 2.3.0
  - v2 文件原寫「≥ 2.1」是錯的、§17 P1-2 + CODEX §16 P1-2 已修正
本機：M4 Pro 48 GB unified memory，macOS Darwin 24.6.0
input format：本案 atlas 原生為 RGBA32F binary，但 OIDN filter 處理時只用 RGB。
  - OIDN RT / RTLightmap filter 的 color / output buffer 接受 1-3 通道。
  - 不存在「OIDN API alpha-aware RGBA」既有能力（v2 文件原寫
    「OIDN API 本身接受 RGBA Float32」是誤導、§17 P2-2 + CODEX §16 P2-2 已修正）。
  - 解法：見 §5.2 M1。RGBA32F atlas 的 alpha 通道是專案 valid mask、
    由 oidn-bridge.mjs 在 PFM 寫出前拆出、OIDN 跑完 RGB 後 post-mask 回填。
    OIDN 不處理 alpha-aware 邏輯，全程由 bridge 工具負責。
filter type：RT（path-traced raytracing denoiser）
  - Stage 0 必須與 RTLightmap 對照一次（見 §S0.2 (d)、§17 P2-1）。
  - RTLightmap 是 RT 變體、官方明寫為 HDR lightmap 最佳化、本案 atlas 屬於此類。
  - RTLightmap 不支援 albedo / normal aux buffer，若 (c) normal aux 顯著勝出仍走 RT γ。
quality：high（CLI 官方值；對應 U-Net 高品質模式，比 balanced 慢但保 detail 更好）
  - 注意：oidnDenoise CLI --quality 只接受 default / h / high / b / balanced / f / fast。
  - HQ 不是有效值，照抄會直接失敗。
  - v2 文件原寫「HQ」是錯的、§17 P1-1 + CODEX §16 P1-1 已修正。
  - 工具內部若用 HQ 作別名，呼叫 oidnDenoise 前必須轉成 high。
hdr：true
inputScale：1.0（不縮放）
cleanAux：true（aux 通道 1 SPP，可視為 clean）

安裝路徑（v4 六審 CODEX P1 + 七審 CODEX P1：本輪單一路徑、官方 release + Metal、無備援）：
  唯一路徑：/opt/oidn-official/bin/oidnDenoise（官方 GitHub release tar.gz、含 Metal device backend）
            對應 dylib：/opt/oidn-official/lib/libOpenImageDenoise.dylib
  禁用：/opt/homebrew/bin/oidnDenoise（Homebrew bottled 版實測只列 CPU device、本案不採用）
        /usr/local/bin/oidnDenoise（vcpkg / 自編譯路徑、本輪不啟用、後續 ADR revision 才可加備援）

  v4 七審 CODEX P1 修訂：v4 六審原寫「備援：/usr/local/bin/oidnDenoise」與 §5.1.2 驗證
                          「resolvedPath 必須以 /opt/oidn-official/ 開頭」自相矛盾、
                          本輪鎖單一路徑、若日後需開放其他來源、走 ADR revision 流程。

§5.1.1 前置裝置與版本檢查（§17 P1-2 + CODEX §16 二/三/六審 P1 修正、Stage 0 啟動前必跑）：
  ============================================================
  注意：oidnDenoise CLI 官方 parser 沒有 --version flag。
        25 個有效 flag 為：-d/--device、-f/--filter、--hdr、--ldr、--srgb、--dir、
        --alb/--albedo、--nrm/--normal、-o/--output、-r/--reference、--is/--input_scale、
        --clean_aux、-t/--type、-q/--quality、-w/--weights、-n、--threads、--affinity、
        --maxmem、--inplace、--buffer、--maxerror、-v/--verbose、--ld/--list_devices、-h/--help。
        v3 寫「oidnDenoise --version」會直接卡住（CODEX 二審 P1 修正）。
  ============================================================

  安裝步驟（v4 六審 CODEX P1 補 + 七審 CODEX P1：brew uninstall 寫進正式流程）：
    Step 0：移除 Homebrew bottled 版（必跑、避免 PATH 殘留誤導 §5.1.2 探測）：
      brew uninstall open-image-denoise
      （brew uses --installed open-image-denoise 已驗無反向依賴、
        uninstall 不影響 FFmpeg / Blender 等其他工具）

    Step 1：建立官方 release 安裝目錄（需 sudo、本輪鎖 /opt/oidn-official 不開放使用者自管路徑）：
      sudo mkdir -p /opt/oidn-official

    Step 2：下載 + 解壓官方 release tar.gz（走 --strip-components=1）：
      curl -L https://github.com/RenderKit/oidn/releases/download/v2.4.1/oidn-2.4.1.arm64.macos.tar.gz \
        | sudo tar -xz --strip-components=1 -C /opt/oidn-official
      # --strip-components=1 把 tar 內頂層 oidn-2.4.1.arm64.macos/ 剝掉、
      # 讓 bin/oidnDenoise 直接落在 /opt/oidn-official/bin/oidnDenoise

    路徑變更注意：本輪鎖 /opt/oidn-official、若改用使用者自管路徑（如 ~/oidn-official）
                  必須同步改 §5.1.2 的 /opt/oidn-official 前綴驗證、走 ADR revision。

  Homebrew 版警語（v4 六審 CODEX P1 補）：
    brew install open-image-denoise 安裝的 bottled 版（/opt/homebrew/bin/oidnDenoise）
    實測 --list_devices 只列 Device 0 Type: CPU、無 Metal device。
    本案 plan §5.1 鎖 Metal backend、Homebrew bottled 版不採用、必須 brew uninstall。
    （brew uses --installed open-image-denoise 已驗無反向依賴、uninstall 不影響其他工具）

  Step A：裝置檢查（用絕對路徑、避免 PATH 誤抓舊路徑）：
    /opt/oidn-official/bin/oidnDenoise --list_devices
    → 必須輸出包含「Type: Metal」的 device（Apple Silicon GPU Metal backend）
    → 若只列 CPU device：Stage 0 不啟動、停在環境安裝階段
                          metrics.json 不產生 backend="cpu" 的正式 spike 結果
                          （v4 六審 CODEX P1：使用者裁示有 GPU 必走 GPU、CPU 備援路徑全刪）
    → 若 --list_devices 失敗或無 Metal：abort、回到安裝步驟確認來源為官方 release

  Step B：版本檢查（v4 改走啟動 stdout 解析、不用 --version；CODEX §16 三審 P1 修正 grep 字串）：
    方法 A（首選、跑 1×1 tiny PFM 解析 stdout、絕對路徑）：
      printf 'PF\n1 1\n-1.0\n\x00\x00\x80\x3f\x00\x00\x80\x3f\x00\x00\x80\x3f' > /tmp/oidn-probe.pfm
      /opt/oidn-official/bin/oidnDenoise --hdr /tmp/oidn-probe.pfm --output /tmp/_o.pfm 2>&1 \
        | grep -m1 -oE 'version=[0-9]+\.[0-9]+\.[0-9]+'
      → 必須印出 version=2.3.x 或 version=2.4.x
      （oidnDenoise.cpp 實際格式：device=<type>, version=<x.y.z>, msec=...）

    方法 B（備援、若官方 release tar.gz 路徑可解析）：
      檢查 /opt/oidn-official/ 內版本目錄或 LICENSE / README 取版本字串

    方法 C（備援、vcpkg / 自編譯）：
      pkg-config --modversion OpenImageDenoise（若 pkg-config 可用）

    若三種方法都拿不到、或版本 < 2.3.0：
    - 整輪 abort、從官方 https://github.com/RenderKit/oidn/releases 重抓 ≥ 2.3.0

§5.1.2 工具腳本 OIDN 路徑解析策略（v4 六審 CODEX P1 必修 3）：

  ============================================================
  問題：8 個工具腳本（§13.3 P0 第 4 條列表）若單靠 PATH、
        可能誤抓殘留的 /opt/homebrew/bin/oidnDenoise 舊路徑。
        Homebrew 版只有 CPU device、與本案 Metal 鎖定衝突。
  ============================================================

  路徑解析優先序（所有 8 個工具腳本必須一致）：
    1. CLI flag --oidn <path>（最高優先、明示路徑）
    2. 環境變數 OIDN_DENOISE（次高、CI / shell session 設定）
    3. 預設 /opt/oidn-official/bin/oidnDenoise（v4 六審鎖定的官方 release 路徑）
    4. PATH 自動探測（fallback、會印警語提示路徑探測風險）

  解析後驗證（每次 OIDN 呼叫前必跑、不可省）：
    A. 路徑存在性：fs.existsSync(resolvedPath) 必須 true
    B. 來源驗證：resolvedPath 必須以 /opt/oidn-official/ 開頭
                  否則 abort、log 印「非官方 release 路徑、本案禁用」
    C. Metal device 驗證：resolvedPath --list_devices 必須含 Metal device
                          否則 abort、log 印「無 Metal device、本案禁用」

  覆蓋範圍（v4 八審 CODEX P1 補總則）：
    本節（§5.1.2）覆蓋 §13.3 P0 第 4 條列表的全部 8 個工具：
      r7-3-10-oidn-bridge.mjs
      r7-3-10-denoise-prebake-check.mjs
      r7-3-10-denoise-metrics.mjs
      r7-3-10-denoise-ao-roi.mjs
      r7-3-10-noise-floor-calibration.mjs
      r7-3-10-rng-bit-exact-check.mjs
      r7-3-10-metrics-schema-validate.mjs
      r7-3-10-normal-aux-bake.mjs
    任何工具只要直接或間接呼叫 oidnDenoise、OIDN 路徑解析與驗證一律遵守本節。
    純指標或純結構檢查工具（如 metrics / ao-roi / schema-validate / rng-bit-exact-check / normal-aux-bake）
    若不直接呼叫 oidnDenoise、仍需保留 oidn_resolved_path 等欄位的 schema 驗證規則
    （驗 metrics.json 內 oidn_resolved_path 是否以 /opt/oidn-official/ 開頭、否則 passDecision = "invalid"）。

  Stage 0 / 1 log 必填欄位（spike-oidn-version.txt + metrics.json 共用）：
    oidn_resolved_path：實際解析到的絕對路徑
    oidn_resolution_source：cli_flag | env_var | default | path_autodetect
    oidn_version：stdout 解析的 version=X.Y.Z
    oidn_device_list：--list_devices 完整輸出
    oidn_device_used：實際 device（必須 Metal）
```

### §5.2 M1 完整解法：PFM ↔ RGBA32F 4 通道轉換

#### §5.2.1 問題重述

```text
- atlas binary 是 RGBA32F 4 通道，alpha = valid mask（>0.5 = valid）
- runner（docs/tools/r7-3-8-c1-bake-capture-runner.mjs，line ~2798-2850）
  用 texel.a > 0.5 判 valid
- PFM 格式只支援 3 通道 RGB（標準 spec）
- oidnDenoise CLI 不接受 4 通道輸入
- 直接丟 alpha → padding 區（alpha = 0）的 RGB 變成「未定義 / 雜訊」
  → OIDN 把這些 padding RGB 當訊號平滑 → 邊界污染回 valid 區
```

#### §5.2.2 解法選擇：PFM + mask-aware dilation + post-mask

v2 選擇方案 A（PFM + 完整 mask pipeline），不選方案 B（EXR）。權衡：

```text
方案 A：PFM + mask-aware dilation
  優點：OIDN CLI 原生支援 PFM，無需額外 OpenEXR 依賴
  缺點：alpha 必須額外存一份、轉換流程多兩步
  
方案 B：EXR + 4 通道
  優點：alpha 與 RGB 同檔案、無分離風險
  缺點：oidnDenoise CLI 不接受 EXR 4 通道（仍需轉 3 通道）
       OIDN 處理時 alpha 仍會被忽略
       需要 tinyexr 或 OpenEXR 依賴（增加複雜度）

結論：方案 A 簡單性勝出，方案 B 沒解到根本問題（OIDN 仍只看 RGB）。
     v2 採方案 A。
```

#### §5.2.3 方案 A 完整 pipeline（六步）

```text
Step 1：讀 RGBA32F atlas binary
  Input：atlas.bin（RGBA32F, face W × H）
  Output：rgb-float32 + alpha-mask-uint8（兩個獨立 buffer）
  rgb-float32[i] = atlas[i].rgb
  alpha-mask-uint8[i] = atlas[i].a > 0.5 ? 1 : 0

Step 2：mask-aware dilation（pre-fill padding 區的 RGB）
  目的：把 valid 區的 RGB「拓展」到 padding 區，避免 OIDN 把
       padding 區的零值 / 未定義值認雜訊。
  半徑：≥ 128 texel（v1 寫的 32 texel 不夠，OIDN HQ U-Net
       receptive field 最深層可達 256+ texel，128 是安全下界）。
  演算法選擇（三選一，spike 階段 hard-pick 一個）：
    (i) 最近非零複製（nearest non-zero copy）
        - 對每個 padding texel，找最近的 valid texel 直接複製 RGB
        - 簡單、O(W × H × R)、R = 128
        - 缺點：複製邊界可能產生方向性偽影
    (ii) push-pull pyramid（建議預設）
        - mipmap 風格，先降採樣補零再升採樣填充
        - O(W × H × log R)、更快
        - 結果平滑、無方向性偽影
        - 標準工業做法（Bethesda、Naughty Dog 都用）
    (iii) 泊松填補（Poisson fill）
        - 迭代解 Laplace 方程
        - 結果最平滑但最慢、O(W × H × iter)、iter ≈ 100+
        - 對本場景過度複雜
  v2 決定：採 (ii) push-pull pyramid 為預設，
          若視覺上 padding 邊界仍有 ring 殘影，
          fallback 到 (iii) 泊松。

Step 3：寫 PFM
  Output：atlas-rgb.pfm（PFM 3 通道，包含 dilation 結果）
  PFM header：
    PF\n              (magic, 大寫 = little-endian)
    {W} {H}\n         (width, height)
    -1.0\n            (scale, 負 = little-endian)
  資料：W × H × 3 × Float32 raw bytes（row order = top-to-bottom）
  注意：OIDN 預期 row order = top-to-bottom，
       若 atlas binary 是 bottom-to-top（OpenGL 慣例），
       需要在 Step 3 翻轉 row。

Step 3.5（v3 新增、v4 七審 CODEX P1：本輪角色互換、CODEX 改 OPUS 動工）：row order 確認流程（probe）
  Step A：OPUS dump 第一張 PFM 之前、生 row order probe atlas：
    - 把 atlas 的 row 0 染紅 (1, 0, 0, 1)
    - 把 atlas 的 row (H-1) 染綠 (0, 1, 0, 1)
    - 其他 row 填零
    - 輸出 probe.pfm（沿用 Step 3 寫 PFM 流程）
  Step B：跑 OIDN（用絕對路徑、v4 七審 CODEX P1：避免 PATH 誤抓舊版）：
    /opt/oidn-official/bin/oidnDenoise --hdr probe.pfm --output probe-denoised.pfm --quality high
    或由 oidn-bridge.mjs 執行、傳 --oidn /opt/oidn-official/bin/oidnDenoise
  Step C：OPUS 讀 probe-denoised.pfm + 轉 PNG（tonemap 後）
    → probe-denoised.png
  Step D：OPUS 把 probe-denoised.png 寫進 plan.md §15.2 或 stage0/spike-aux-decision.md
    與 oidn-bridge.mjs commit message
  Step E：CODEX 審 probe-denoised.png：
    - 若紅在頂、綠在底 → atlas 是 top-to-bottom、OIDN row order 對齊、不需翻轉
    - 若紅在底、綠在頂 → atlas 是 bottom-to-top（OpenGL 慣例）、Step 3 必須翻轉 row
    - 回 APPROVE / ITERATE 給 OPUS
  Step F：OPUS 在 plan.md §15.2 或 stage1-decision.md 寫
    「row order: top-to-bottom（不翻轉）」或
    「row order: bottom-to-top（翻轉）」
    （v4 四審改、原 v3 寫 source.md、本輪 v4 source.md 凍結、CODEX §16 四審 P1 修正）

  注意：CODEX 不需要判讀 atlas binary 本身（看不出），
       只需判 probe-denoised.png 視覺。
       v3 原寫 CODEX 動工 OPUS 判讀、v4 角色互換 + 七審 P1 已對齊：OPUS 動工、CODEX 審查。

Step 4：跑 oidnDenoise（v4 七審 CODEX P1：絕對路徑；v4 三審 CODEX P1：推薦 oidn-bridge 包、避免裸指令漂移）
  推薦走 oidn-bridge.mjs（自動套 §5.1.2 路徑解析 + aux 組合 + 主 color/normal dilation + post-mask + metrics）：
    node docs/tools/r7-3-10-oidn-bridge.mjs --in=atlas.bin --out=atlas-denoised.bin \
      --aux=beta|gamma|alpha --filter=RT --quality=high --dilation=128 [--normal=normal.bin]

  aux 策略 → OIDN 參數對映（OIDN 2.4.1 實測限制：normal 必須伴 albedo、normal-only 報錯）：
    β color-only：        --hdr only（無 aux、不加 --clean_aux）
    α constant white：    --hdr --alb albedo.pfm --clean_aux（常數白 albedo）
    γ prefiltered normal：--hdr --alb albedo.pfm --nrm normal.pfm --clean_aux
                          （常數白 albedo + normal；normal-only 不被 OIDN 接受、見 §S0.2 (c)）

  等效裸指令（γ 為例、僅供理解、實務走 oidn-bridge）：
    /opt/oidn-official/bin/oidnDenoise \
      --hdr atlas-rgb.pfm --alb albedo.pfm --nrm normal.pfm \
      --output atlas-denoised.pfm --filter RT --quality high --device default --clean_aux

  其中：
    --hdr：input 是 linear HDR（不是 sRGB tonemapped）
    --alb：albedo aux 通道（α 與 γ 都用、常數白；β / RTLightmap 不用）
    --nrm：normal aux 通道（γ 用、必須伴 --alb；oidn-bridge 已對 normal 做 mask-aware dilation）
    --clean_aux：aux 組（α / γ）一律加（plan §S0.2 (b)(c) cleanAux=true）；β / RTLightmap 不加
    --output：降噪後輸出
    --filter RT：path-traced denoiser（RTLightmap 是另一對照組 (d)、見 §S0.2）
    --quality high：高品質 U-Net
    --device default：本案實質鎖 Metal（v4 六審 CODEX P1：使用者裁示有 GPU 必走 GPU）
                       若 OIDN 自選成 CPU、§5.1.1 Step A 已 abort、不會跑到此步

Step 5：讀 PFM denoised
  Input：atlas-denoised.pfm
  Output：rgb-denoised-float32

Step 6：post-mask（把 padding 區重新歸零）
  目的：OIDN 在 dilation 區做的「合成訊號」會污染 valid mask 邊界，
       必須用原始 alpha mask 把 padding 區重新歸零。
  Logic：
    for each texel i:
      if alpha-mask-uint8[i] == 1:
        output[i].rgb = rgb-denoised-float32[i]
        output[i].a = 1.0
      else:
        output[i].rgb = 0  // padding 區強制歸零
        output[i].a = 0
  Output：atlas-denoised-final.bin（RGBA32F，與輸入同格式）
```

#### §5.2.4 padding 區的 RGB 怎麼填（M1 (b) 答覆）

`§5.2.3 Step 2 + Step 6` 完整答覆 M1 (b)：dilation 階段填入「最近 valid texel 的 RGB」（透過 push-pull pyramid），OIDN 跑完後 post-mask 階段強制歸零。整個流程不影響 valid 區、不污染 runtime 取樣。

#### §5.2.5 mask-aware dilation 半徑為何 ≥ 128 像素（M1 (c) 答覆）

```text
v1 寫的 32 像素不夠，根據：
  - OIDN HQ U-Net 架構（Intel paper, 2018+ updates）
    最深層 receptive field ≈ 16 levels × 2 stride ≈ 256+ texel
  - 實務上，OIDN 處理時邊界 ringing 可達 receptive field 一半
  - 安全下界 = 256 / 2 = 128 texel
  - v2 設定：dilation 半徑 = 128 texel（即 push-pull pyramid 跑 log₂(128) = 7 levels）
  - 若視覺驗收發現 ring 殘影 → 升 256 texel 重跑
```

#### §5.2.6 替代方案：EXR 評估（M1 (f) 答覆）

```text
評估過 EXR 4 通道方案（OpenEXR 原生支援 alpha）：
  - OpenEXR 可存 RGBA32F 含 alpha，與 atlas binary 格式對應
  - 但 oidnDenoise CLI 不接受 EXR 4 通道輸入
  - 即使用 OIDN API 直接跑（不走 CLI），OIDN 仍只處理 RGB，
    alpha 通道會被忽略
  - 因此 EXR 路線仍需「拆 RGB + 拆 alpha + 跑 dilation + post-mask」
  - 等於 PFM 路線 + 多一份 OpenEXR 依賴
結論：EXR 無實質好處，v2 採 PFM 路線。
注記：若未來 OIDN ≥ 3.x 支援 4 通道（含 alpha aware），
     可考慮 EXR 路線、減少 dilation 工作量。
     列入 follow-up F8。
```

### §5.3 三變體的 OIDN 指令（每變體一行可貼上）

```text
變體 A：不跑 OIDN，跳過此節。

變體 B（5000 SPP + DN）/ 變體 C（1000 SPP + DN）（v4 三審 CODEX P1：推薦 oidn-bridge 包、γ = alb+nrm+clean_aux）：
  推薦走 oidn-bridge.mjs（自動套 §5.1.2 路徑解析 + aux 組合 + 主 color/normal dilation + post-mask + metrics）：
    node docs/tools/r7-3-10-oidn-bridge.mjs \
      --in=atlas.bin --out=atlas-denoised.bin \
      --aux=<Stage 0 決定的 beta|gamma> --filter=RT --quality=high --dilation=128 \
      [--normal=normal.bin]   # aux=gamma 時必帶（normal-aux-bake 產、見 §S0.5）

  aux 策略對映（與 §5.2.3 Step 4 一致、OIDN normal 必須伴 albedo）：
    β color-only：oidn-bridge --aux=beta（無 aux、不加 --clean_aux）
    γ normal：   oidn-bridge --aux=gamma --normal=normal.bin
                 （= 常數白 albedo + normal + --clean_aux；normal 也做 mask-aware dilation）

  等效裸指令（γ、僅供理解、實務走 oidn-bridge）：
    /opt/oidn-official/bin/oidnDenoise --hdr atlas-rgb.pfm \
      --alb albedo.pfm --nrm normal.pfm \
      --output atlas-denoised.pfm --filter RT --quality high --device default --clean_aux
  # β（color-only）刪 --alb / --nrm / --clean_aux 三行
```

### §5.4 oidn-bridge.mjs 工具規格（CODEX 實作）

```text
Path：docs/tools/r7-3-10-oidn-bridge.mjs（新增、CODEX 寫）
Input：
  --in <atlas.bin>          # RGBA32F atlas binary
  --normal <normal.bin>     # optional, 1 SPP normal atlas
  --albedo <albedo.bin>     # optional, 常數白 albedo（α=對照b 與 γ=對照c 都用；省略時 α/γ 自動產生全 1.0 常數白）
  --out <out.bin>           # 降噪後 RGBA32F binary
  --dilation 128            # dilation 半徑（預設 128）
  --oidn <path>             # CLI 路徑（v4 六審 CODEX P1：預設 /opt/oidn-official/bin/oidnDenoise）
                            # 解析優先序：--oidn flag > OIDN_DENOISE env > default > PATH autodetect
                            # 驗證：存在性 + 必須 /opt/oidn-official/ 開頭 + --list_devices 含 Metal
  --quality high              # OIDN quality
  --filter RT               # OIDN filter type
  --aux beta|gamma|alpha    # aux 策略
Output：
  <out.bin>                 # 降噪後 RGBA32F（與輸入同格式）
  <out>.metrics.json        # PFM↔RGBA 轉換 + OIDN wall time + max RSS
責任：
  - 處理 §5.2.3 完整 6 步 pipeline
  - 自動量 OIDN 子程式 max RSS（用 /usr/bin/time -l 或 ps）
  - 自動驗 NaN / Inf（讀 output binary 掃一遍）
  - 若任一驗證失敗 → exit code != 0，metrics.json 寫 invalid
```

---

## §6 atlas valid-mask 處理（dilation 演算法選擇、pre-fill / post-mask 完整流程）

### §6.1 完整 flow chart

```text
[atlas.bin RGBA32F]
       │
       ├─→ [valid-mask-uint8.bin]（alpha > 0.5）
       │
       ↓
   [rgb-float32]
       │
       ↓
   Step 2：mask-aware dilation（push-pull pyramid, R=128）
       │
       ↓
   [rgb-dilated.pfm]
       │
       ↓
   Step 4：oidnDenoise --hdr [+ --alb + --nrm + --clean_aux if γ／+ --alb + --clean_aux if α]
       │
       ↓
   [rgb-denoised.pfm]
       │
       ↓
   Step 5：讀回 rgb-denoised-float32
       │
       ↓
   Step 6：post-mask（valid-mask-uint8 重新套用）
       │
       ↓
   [atlas-denoised-final.bin RGBA32F]（與輸入同格式）
```

### §6.2 push-pull pyramid 完整偽程式碼

```text
function pushPullDilate(rgb, mask, W, H, levels = 7):
  # levels = 7 對應 dilation 半徑 ~128 texel（2^7 = 128）
  # Step A：建 mipmap pyramid（push）
  pyramid_rgb = [rgb]
  pyramid_w = [mask.asFloat()]  # weight = mask
  for L in 0..levels-1:
    wL = pyramid_w[L]
    rL = pyramid_rgb[L]
    # 降採樣 2x2 → 1
    wL1 = downsample(wL, sum_op)
    rL1 = downsample(rL * wL, sum_op) / max(wL1, ε)
    pyramid_rgb.append(rL1)
    pyramid_w.append(wL1)
  # Step B：升採樣回原解析度（pull）
  result = pyramid_rgb[-1]
  for L in levels-1..0:
    result_up = upsample(result, bilinear)
    wL = pyramid_w[L]
    rL = pyramid_rgb[L]
    # mix：原 valid 區用原值、padding 區用 upsample 結果
    result = where(wL > ε, rL, result_up)
  return result  # 此時 padding 區已被「拓展」的 valid 區填滿
```

### §6.3 post-mask 後的訊號完整性驗證

```text
驗證 1：valid 區 RGB 與 raw atlas 的差異
  - post-mask 應只覆寫 padding 區
  - valid 區的 RGB 應與 OIDN 輸出 bit-identical
  - 驗證：random sample 1000 個 valid texel，比對 raw OIDN output
驗證 2：padding 區歸零
  - alpha < 0.5 的 texel 的 RGB 應 == (0, 0, 0)
  - 驗證：random sample 1000 個 padding texel，全部應為零
驗證 3：邊界鄰居完整性
  - 對 valid mask 邊界 texel，鄰居（4-connected）若是 padding，
    padding 鄰居 RGB 必須是 0（不可有殘留 OIDN ring）
  - 驗證：掃所有 boundary texel
```

### §6.4 dilation 半徑可調的觸發條件

```text
預設：R = 128 texel
升 256：若視覺驗收（沿用 §22.5 同 camera 截圖）發現 valid 區邊界
        出現 ring 殘影（OIDN edge halo 滲入 valid 區），
        升 R = 256（log₂(256) = 8 levels）
降 64：若 dilation wall time 過長（> 10 秒 / 張）且視覺上 R = 64 已夠，
       才考慮降。本場景估時 R = 128 < 2 秒，無動機降。
```

---

## §7 驗收閘門（G1–G7 + Stop 條件補 OIDN-specific）

### §7.1 七道閘門（G1–G7）

```text
G1：bake 完整性
  - atlas binary 非空、size = 預期（D800 face × 4 通道 × Float32）
  - nonzero ratio > 0.10（北牆 valid 區面積 >10% atlas）
  - 無 NaN / Inf（atlas 完成後掃一遍）
  
G2：OIDN 完整性（B / C 變體）
  - oidn-bridge.mjs 退出 code = 0
  - OIDN 子程式 max RSS < 1.5 GB
  - OIDN wall time < 60 s（單張 atlas）
  - 降噪後 binary 無 NaN / Inf
  
G3：dilation pre-fill 正確性
  - random sample 1000 padding texel，dilation 後 RGB 非零
  - random sample 1000 valid texel，dilation 不改變其 RGB
  
G4：post-mask 正確性
  - random sample 1000 padding texel，post-mask 後 RGB == 0
  - random sample 1000 valid texel，post-mask 後 RGB == OIDN output
  
G5：量化指標（Stage 1 三變體間，v3 移除 FFT 主指標，回應 SF6）
  - mean L1 luma vs A < 3σ（§S05 校準值）
  - p99 L1 luma vs A < 3σ
  - SSIM luma 11×11 > 1 - 3σ
  - AO ROI delta（§9.4 五個 ROI）每個 < 3σ
  - seam jump ratio < 1.5×（北牆與西牆 / 天花板接縫）
  - （v2 列的 FFT 高頻保留率 > 0.7 已降為 sanity 指標、不入 G5；
     見 §9.2 與 §10.1）
  
G6：視覺驗收（§22.5 機制）
  - sweep-spot 對照截圖（A / B / C 同 camera）
  - 五個 AO ROI 截圖（全 camera 拉近）
  - 使用者肉眼判讀（OPUS 不自我裁示）
  
G7：紀律對齊（§14）
  - 烤圖用 Chrome（never Brave）
  - tile 512 × 512、fence、every-samples=4
  - throwaway only、不 promotion
  - html-review source.md 為單一真實源【本輪 v4 豁免、改走對話窗審 plan.md、後續 R 階段恢復】
```

### §7.2 Stop 條件（OIDN-specific 補完）

v1 §11 Stop 條件僅列 GPU / Metal 相關，v2 補：

```text
Stop S1：OIDN 輸出含 NaN / Inf
  - 立即停止該變體
  - 不寫進 metrics.json 量產候選
  - 投入 abort 流程（§S0.3）
  
Stop S2：OIDN 把 valid 區邊緣信號平滑到 SSIM < 0.90
  - 此變體淘汰
  - 升 dilation R = 256 重跑一次（單機會）
  - 若仍 < 0.90 → 該 aux 策略不可用、檢查 normal aux 來源
  
Stop S3：normal aux 自身 SSIM < 0.95（cleanAux = true 前提）
  - normal aux bake 有 bug，停止 γ 路線
  - 修 normal aux 來源（§S0.5）後重跑
  
Stop S4：aux 通道全零
  - normal aux bake 失敗未抓到
  - 停止 γ 路線、退 β
  
Stop S5：OIDN 處理時間 > 60 s（單 atlas）
  - 疑似 Metal backend stall
  - 改試 --device cpu
  - CPU 仍 > 60 s → OIDN 路線 abort
  
Stop S6：OIDN max RSS > 1.5 GB（單一子程式）
  - 疑似 OIDN 記憶體洩漏
  - 立即 SIGKILL OIDN 子程式
  - 整輪 OIDN 路線 abort、升 R7-3.11
  
Stop S7：bake runner GPU context lost
  - WebGPU context restored 次數 > 1 → 該變體無效
  - 重跑單變體，仍 context lost → 整輪 abort
  
Stop S8：bake max submission elapsed > 8 s
  - GPU 進入 throttling 風險
  - 停止當前 submission、等 30 秒、重試
  - 重試仍 > 8 s → 該變體 wall time 不可信
  
Stop S9：bake max tile readback > 4 s
  - GPU readback stall
  - 同 S8 處理
  
Stop S10：bake atlas nonzero ratio < 0.10
  - 北牆 valid 區未覆蓋預期面積
  - 該變體 invalid，檢查 bake runner camera 設定
```

---

## §8 烤前防呆（含紀律對齊條目）

### §8.1 烤前 checklist（必跑、寫成腳本）

```text
Check 1：browser
  - 必須 Google Chrome（version 確認 ≥ 120）
  - 嚴禁 Brave（見 §14.1）
  - 嚴禁 Safari / Firefox / Edge
  
Check 2：tile 設定
  - tile-width = 512
  - tile-height = 512
  - 若 != 512 → safety gate 擋、不允許起跑
  
Check 3：fence
  - submission boundary = fence
  - 若 != fence → safety gate 擋（缺了 GPU 提交全黑）
  
Check 4：every-samples
  - every-samples = 4
  - 若 != 4 → safety gate 擋（過密 progress 影響穩定性）
  
Check 5：D 值
  - D = D800（face 3379 × 2327）
  - 若 != D800 → safety gate 擋
  
Check 6：local server
  - seam gate 與 bake runner 必須使用「自開 http server」
  - 嚴禁 kill 使用者 9002 dev server
  - 自開埠位建議 9003 / 9004，避開 9001（專案 dev）與 9002（使用者用）
  
Check 7：throwaway flag
  - bake metadata 必須有 "throwaway": true
  - 嚴禁 promotion（不可改成 false 後 commit）
  
Check 8：disk space
  - 預估 disk 使用：A ~120 MB + B ~240 MB + C ~240 MB + Stage 0 ~360 MB
    + Stage 0.5 ~600 MB ≈ 1.6 GB
  - 烤前確認 free disk > 5 GB
```

### §8.2 防呆腳本（CODEX 實作）

```text
Path：docs/tools/r7-3-10-denoise-prebake-check.mjs（新增、CODEX 寫）
Output：JSON pass / fail report
若任一檢查 fail → exit code != 0，bake 不啟動
OIDN 路徑解析與驗證一律遵守 §5.1.2（v4 七審 CODEX P1）
  此工具直接呼叫 oidnDenoise --list_devices 確認 Metal device、
  必須走 §5.1.2 路徑解析優先序與驗證 A/B/C。
```

---

## §9 量化指標公式（色空間 / 通道 / 視窗 / 排除範圍全明寫）

### §9.1 色空間

```text
所有指標在 linear RGB 上計算（不做 sRGB tonemap）。
理由：
  - atlas 是 linear HDR indirect_diffuse_radiance
  - tonemap 是 runtime 渲染後才做（exposure + sRGB encoding）
  - 在 linear 上算指標才能反映「真實訊號差距」
  - tonemap 後算指標會被 highlight clipping 與 gamma 壓縮污染
唯一例外：視覺截圖（§22.5 截圖）才 tonemap，但截圖不入機械指標。
```

### §9.2 通道

```text
mean L1：RGB 三通道分開 + luma 加權後
  - L1_rgb = mean(|A.rgb - X.rgb|)，三通道平均
  - L1_luma = mean(|luma(A) - luma(X)|)
  - luma = 0.2126 * R + 0.7152 * G + 0.0722 * B（BT.709）
percentile L1：只算 luma
  - p95 / p99 / max：sort luma diff 後取對應 percentile
SSIM：只算 luma
  - 11×11 視窗
  - dynamic range L = max(luma(A), luma(X))（實測 max，不假設 1.0）
  - K1 = 0.01、K2 = 0.03（標準 SSIM 參數）
FFT 高頻保留率：只算 luma（v3 改成 sanity 指標，回應 SF6）
  - 2D FFT → 取 high-frequency band（> 0.25 Nyquist）
  - 保留率 = energy(X 高頻) / energy(A 高頻)
  - 先驗 sanity 指標、閾值 > 0.7（建議）
  - 注意：本指標未經 Stage 0.5 σ 校準，僅作 sanity 提醒
  - 決策時：不入 §10.1 主指標表、不入 §16.3 passDecision 機械決策
  - CODEX 在 metrics.json 仍記錄 fftHighFreqRetention 供後續分析
```

### §9.3 計算範圍（非常重要）

```text
範圍 R1：nonzero mask only
  - 只算 atlas alpha > 0.5 的 texel（valid 區）
  - padding 區（alpha = 0）不入指標計算
  - 理由：padding 區 OIDN 處理後可能有 ring，post-mask 已歸零
範圍 R2：排除 OIDN edge halo
  - 從 valid mask 邊界往內 16 texel 排除
  - 理由：OIDN U-Net 在 valid / padding 邊界本身有 halo
  - 排除後的「core valid 區」才是真實可比較的訊號
範圍 R3：dilation halo 不入主指標
  - dilation 區（原 padding 但被 push-pull 拓展）不入主指標
  - 但 dilation 區的「OIDN 處理結果」會在 §6.3 驗證 1 / 3 抽查
最終指標範圍 = R1 ∩ R2 = (valid mask) AND (距 boundary > 16 texel)
```

### §9.4 AO ROI 座標（C1 必修）

v1 把 AO 偏差寫成「指定 ROI 內 view-space luma mean delta」，但沒給 ROI 座標。v2 補：

```text
ROI 全部在 render-space（screen-space，camera 渲染後的 viewport 像素座標）。
本場景：sweep-spot camera，1920 × 1080 視窗（§22.5 標準解析度）。

ROI 1：北牆 / 西牆夾角
  座標：(x_min, y_min, x_max, y_max) = (140, 320, 280, 720)
  描述：左上夾角的垂直陰影帶，含 AO ridge
  
ROI 2：北牆 / 天花板夾角
  座標：(380, 80, 1540, 260)
  描述：天花板與北牆交界的水平 AO 帶
  
ROI 3：北牆踢腳線上緣
  座標：(380, 880, 1540, 1000)
  描述：踢腳線上緣的水平陰影帶
  
ROI 4：窗框內側陰影
  座標：(680, 360, 920, 700)
  描述：窗框內凹的 AO 陰影
  
ROI 5：門框內側陰影
  座標：(1200, 320, 1480, 800)
  描述：門框內凹的 AO 陰影

AO ROI delta 計算：
  delta_i = |mean(luma(A in ROI_i)) - mean(luma(X in ROI_i))| / mean(luma(A in ROI_i))
  輸出：delta_1..5 五個獨立值（不平均，要看哪個 ROI 失敗）
  通過：每個 delta_i < 3σ（§S05 校準的 AO ROI σ）
```

座標的最終確認由 OPUS 動工：OPUS 在 §22.5 同 camera 截圖完成後拍 overlay、看實際截圖微調、寫進 plan.md §9.4 與 stage1-decision.md。CODEX 審 overlay 截圖與座標結論（v4 八審 CODEX P1：角色互換、CODEX 不再動工拍圖、本輪 v4 改走對話窗審 plan.md、不再寫 source.md）。

#### §9.4.1 ROI 座標 7 步微調流程（v3 新增、v4 改寫對話窗審 plan.md、v4 八審 CODEX P1 角色互換）

```text
v3 規範：所有 ROI 座標流程走 source.md + CODEX 拍圖。
v4 四審改：所有 ROI 座標流程改走 plan.md §9.4 + stage1-decision.md
       （本輪 v4 source.md 凍結、不再寫入）
v4 八審改：所有「CODEX 拍圖 / 畫框 / 貼圖」執行步驟改 OPUS 動工、
            CODEX 改任「審 overlay 與座標結論」審查者角色

Step 1：OPUS 用 §22.5 sweep-spot camera 對 d800-north-raw-10000spp 拍
        1920 × 1080 截圖（v3 寫 CODEX、v4 八審改 OPUS）
Step 2：OPUS 用 v3 §9.4 五組座標（ROI 1-5）畫 overlay rectangle 標出 5 個 ROI
        （v3 寫 CODEX、v4 八審改 OPUS）
Step 3：OPUS 把 overlay 截圖貼進 stage1-decision.md
        （v3 是 source.md + CODEX、本輪 v4 改 plan.md / stage1-decision.md + OPUS）
Step 4：CODEX 審 overlay 截圖與座標：
        （v4 八審 P1：v3 原寫 OPUS 判讀、改成 CODEX 審、OPUS 拍完丟給 CODEX）
  - 若任一 ROI 偏離預期（AO 帶不在 box 內 / box 含太多牆面非 AO）
    → CODEX 回「修正後再審」到對話窗、附明確新座標 (x_min, y_min, x_max, y_max)
  - 若全 5 個 ROI OK
    → CODEX 回「核准」、跳 Step 6
Step 5：OPUS 依 CODEX 給的新座標重畫 overlay、重貼到 stage1-decision.md、回 Step 4
        （v3 寫 CODEX 重畫、v4 八審改 OPUS 重畫）
Step 6：OPUS 寫「ROI 座標已鎖定（含 ADR ref）」到 plan.md §9.4 文件頭
        + stage1-decision.md 文件頭
Step 7：此後所有 metrics 計算都用 plan.md §9.4 鎖定的座標、不可再改

鎖死條件：OPUS 在 plan.md §9.4 寫「ROI 已鎖定」之後：
  - OPUS 不可再改座標（本輪角色互換、原條目寫 CODEX 不可、v4 八審對齊改 OPUS）
  - 如真有 ROI 必須改 → 開 ADR revision、並回退所有依賴此座標的 metrics.json
```

### §9.5 seam jump ratio

```text
場景：北牆與相鄰面（西牆、天花板）的接縫
做法：
  - 找接縫線（north_wall ∩ west_wall 與 north_wall ∩ ceiling）
  - 沿接縫線採樣 100 個點對（一點在北牆邊、一點在鄰面邊，
    在世界座標上是相鄰但不同 atlas tile）
  - 計算 jump = |luma(north_edge) - luma(neighbor_edge)|
  - 與 A 變體（不降噪）的 jump 比：ratio = jump_X / jump_A
  - 通過：ratio < 1.5（OIDN 不放大接縫）
```

---

## §10 判斷標準 + 量產決策樹（含 tie-breaker / 中間態 / NaN-Inf）

### §10.1 變體間比較指標總表（v3 移除 FFT 主指標、回應 SF6）

```text
指標                          通過條件                          來源
mean L1 luma vs A             < σ_meanL1_3sigma                §S05
p99 L1 luma vs A              < σ_p99L1_3sigma                 §S05
SSIM luma 11×11 vs A          > 1 - σ_SSIM_3sigma              §S05
AO ROI delta 1..5             各別 < σ_aoROI_3sigma            §S05
seam jump ratio               < 1.5×                            §9.5
GPU context lost              == 0                              §7.2 S7
NaN / Inf count               == 0                              §7.2 S1
OIDN max RSS                  < 1.5 GB                          §7.2 S6
OIDN wall time                < 60 s                            §7.2 S5

備註：FFT 高頻保留率 > 0.7 是 sanity 指標（見 §9.2）、不入主表、
     不入 §16.3 passDecision；CODEX 仍在 metrics.json 記錄 fftHighFreqRetention
     供後續分析。
```

### §10.2 量產決策樹（v3 改寫成 passDecision 4×4 矩陣，回應 MF4）

v2 的 Branch 1-6 是自然語言、非機械可裁示。v3 改寫為依 §16.3 passDecision enum（pass / fail / marginal / invalid）的 4×4 矩陣。

```text
Stage 1 跑完 A / B / C，每個變體 metrics.json 寫完。

優先順序（從上到下，第一個觸發即執行，不再進矩陣）：

  Priority 1：任一變體 passDecision = "invalid"
    → 進 Branch invalid 處理（見下方矩陣外動作）
  Priority 2：A passDecision != "pass"
    → 進 Branch ref-fail 處理（A 是 reference，A 不過則整輪不可信）
  Priority 3：B + C 雙變體狀態查 4×4 矩陣（A 已過、B/C 對照表）

  ┌────────────────┬─────────────┬─────────────┬─────────────┬──────────────┐
  │ B \ C          │ pass        │ marginal    │ fail        │ invalid      │
  ├────────────────┼─────────────┼─────────────┼─────────────┼──────────────┤
  │ pass           │ Branch 1a   │ Branch 1b   │ Branch 1c   │ Branch inv-c │
  │                │ 選 C        │ 選 B        │ 選 B        │ 重跑 C       │
  │                │             │ (C follow-up)│            │              │
  ├────────────────┼─────────────┼─────────────┼─────────────┼──────────────┤
  │ marginal       │ Branch 1d   │ Branch 4    │ Branch 1e   │ Branch inv-c │
  │                │ 使用者裁示  │ 使用者裁示  │ 退 A        │ 重跑 C       │
  ├────────────────┼─────────────┼─────────────┼─────────────┼──────────────┤
  │ fail           │ Branch 1f   │ Branch 1g   │ Branch 6    │ Branch inv-c │
  │                │ 選 C        │ 使用者裁示  │ 退 A + R3.11│ 重跑 C       │
  │                │             │ 或退 A      │             │              │
  ├────────────────┼─────────────┼─────────────┼─────────────┼──────────────┤
  │ invalid        │ Branch inv-b│ Branch inv-b│ Branch inv-b│ Branch 5     │
  │                │ 重跑 B      │ 重跑 B      │ 重跑 B      │ 重跑 B+C     │
  └────────────────┴─────────────┴─────────────┴─────────────┴──────────────┘

每個 Branch 動作（v4 已對齊 §17 P1-3 + CODEX §16 P1-3 的「marginal 不可機械量產」原則）：
  Branch 1a：B pass + C pass → 選 C（wall time 短、~10 min vs ~46 min）
  Branch 1b：B pass + C marginal → 選 B（C 留 follow-up；marginal 不可機械量產）
  Branch 1c：B pass + C fail → 選 B
  Branch 1d：B marginal + C pass → 使用者裁示
              （B 是 marginal、C 雖 pass 但會單獨選 C 也行；視 metrics.json + 截圖判定）
  Branch 1e：B marginal + C fail → 退 A
  Branch 1f：B fail + C pass → 選 C
  Branch 1g：B fail + C marginal → 使用者裁示 或 退 A（無 pass 變體可選、必須人工裁示）
  Branch 4：B marginal + C marginal → 使用者裁示
              （metrics.json + 截圖、人工裁示寫進 production-decision.md）
  Branch 5：B + C 都 invalid → 重跑兩變體（單機會）、仍 invalid 視同 fail
  Branch 6：B + C 都 fail → 退 A 路線、開 R7-3.11 ralplan 評估 BM3D / SVGF
  Branch invalid（inv-b / inv-c）：重跑該變體（單機會）、仍 invalid 視同 fail
  Branch ref-fail（A invalid 或 fail）：
    整輪 abort、必須 root cause（多半 OIDN bridge bug 或 bake runner GPU context lost）

§10.2.1 量產原則（v4 新增、§17 P1-3 + CODEX §16 P1-3 寫死）：
  1. 量產變體 metrics.json passDecision 必須是 "pass"。
     marginal 不可機械量產、必須走「使用者肉眼裁示」並寫進 production-decision.md
     （文字寫成「人工裁示通過」、不可寫成「CODEX 機械通過」）。
  2. 矩陣中所有「使用者裁示」格不可由 CODEX 自動選定變體。
     CODEX 必須產出 metrics.json + 並排截圖、停在「等使用者回覆」狀態。
  3. v3 矩陣有 4 格自動選 C（Branch 1b / 1d / 1f / 1g）但 C 是 marginal、
     與「量產必須 pass」自相矛盾（CODEX §16 P1-3 指認）、v4 已修正。

tie-breaker（v2 §10.2 Branch 3，v3 已被矩陣覆蓋）：
  若 mean L1 差 < noise floor σ AND SSIM 差 < 0.005
  → 此情境下 B + C 都應 passDecision = "pass"（因為都通過 3σ）
  → 自動進 Branch 1a 選 C（wall time 短）

「全 fail」（v2 Branch 6 自然語言）改成矩陣 Branch 6 + ref-fail，自動處理。
```

### §10.3 ADR 一條（量產路線選擇）

```text
[ADR-Production-Variant]
Context: Stage 1 跑完 A / B / C，需選一個作為北牆量產路線。
Decision: 依 §10.2 決策樹選擇，所有指標通過後採時間短者。
Drivers: G1-G7 閘門全過 + §9 量化指標通過門檻。
Alternatives considered: A（保守、無風險）、B（中段、保險）、C（最快、風險）。
Why chosen: 由實測 metrics + 視覺驗收 + 使用者裁示三道決定，
          不靠先驗。
Consequences: 若選 C 後上線發現 hallucination → 回 ADR-Production-Variant-Rev2
            退到 B 或 A。
Follow-ups: F4（量產上線後監測 90 天）。
```

---

## §11 Stop 條件（OIDN-specific 補完，已合進 §7.2）

詳見 §7.2 Stop S1–S10。本節僅作參照。

---

## §12 產出物清單（含 Stage 0 / 0.5 產出）

### §12.1 Stage 0 spike 產出

```text
docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/stage0/
  spike-a-color-only.bin              # (a) RT + color-only output（β）
  spike-a-color-only.png              # tonemapped 視覺
  spike-b-constant-white.bin          # (b) RT + 常數白 albedo output（α）
  spike-b-constant-white.png
  spike-c-prefiltered-normal.bin      # (c) RT + prefiltered normal output（γ）
  spike-c-prefiltered-normal.png
  spike-d-rtlightmap-crop.bin         # (d) RTLightmap + color-only crop output（v4 加、§17 P2-1）
  spike-d-rtlightmap-crop.png
  normal_atlas.bin                    # 共用 normal aux（1 SPP）
  spike-metrics.json                  # v4 含兩段：
                                      #   abc_full_atlas_metrics
                                      #   d_rtlightmap_crop_metrics
  spike-aux-decision.md               # v4 含兩節：aux 策略（β/γ）+ RT vs RTLightmap 結論
  spike-oidn-version.txt              # OIDN 版本（stdout version=X.Y.Z 解析結果）
  spike-oidn-cli-log.txt              # oidnDenoise 完整 stdout/stderr（含 version banner）
```

### §12.2 Stage 0.5 校準產出

```text
docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/stage05/
  seed-{0..4}-raw.bin                 # 5 個 seed 的 raw 10000 SPP atlas
  seed-{0..4}-tonemap.png             # 視覺對照
  noise-floor-metrics.json            # 10 配對指標
  noise-floor-3sigma-thresholds.md    # 最終 3σ 門檻
  noise-floor-rng-seeds.txt           # 5 個 seed 的明確值（決定性紀錄）
```

### §12.3 Stage 1 量產驗證產出

```text
docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/stage1/
  variant-a-raw-10000spp.bin
  variant-a-tonemap.png
  variant-a-metrics.json
  variant-b-raw-5000spp.bin
  variant-b-denoised.bin
  variant-b-tonemap.png
  variant-b-metrics.json
  variant-c-raw-1000spp.bin
  variant-c-denoised.bin
  variant-c-tonemap.png
  variant-c-metrics.json
  combined-comparison.png             # A / B / C 三欄並排視覺
  ao-roi-comparison-{1..5}.png        # 每個 ROI 三變體並排
  seam-jump-analysis.md               # 接縫分析
  production-decision.md              # 最終量產路線決定（含 ADR ref）
```

### §12.4 工具產出

```text
docs/tools/r7-3-10-oidn-bridge.mjs               # PFM↔RGBA pipeline + OIDN
docs/tools/r7-3-10-denoise-prebake-check.mjs     # 烤前防呆
docs/tools/r7-3-10-denoise-metrics.mjs           # 量化指標
docs/tools/r7-3-10-denoise-ao-roi.mjs            # ROI 截取與量化
docs/tools/r7-3-10-noise-floor-calibration.mjs   # Stage 0.5 校準
```

### §12.5 文件產出

```text
本計畫：docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/plan.md
        docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/source.md
        docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/index.html
        （v3 規範：source.md 為單一真實源、index.html 由 CODEX 重生）
        【本輪 v4 豁免、改走對話窗審 plan.md、index.html 不重生；
         source.md 凍結於 §17 OPUS 裁示存底】
Open Questions：.omc/plans/open-questions.md（OQ1-3 答覆寫進）
Handover：.omc/plans/R7-3.10-denoise.handover-next-opus.md（量產決定後）
SOP 更新：docs/SOP/R0：全景地圖.md（R7-3.10 北牆降噪節點）
Debug Log：docs/SOP/Debug_Log.md（若有 bug，依鐵律寫 symptom / root cause / fix）
```

---

## §13 ADR（排除理由改正、P1 vs P5 衝突明文化、Follow-up F1–F8 三欄）

### §13.1 ADR 主決定

```text
[ADR-R7-3.10-Denoise]

Decision:
  R7-3.10 北牆量產路線採「Stage 0 → 0.5 → 1」三階段實驗確定，
  最終由 §10 決策樹選擇 A / B / C 之一。

Drivers:
  - D = D800 已定案（前一輪 D-ramp）
  - atlas 為 albedo-free indirect_diffuse_radiance（P5）
  - OIDN 業界標準、本機 Apple Silicon GPU 透過 OIDN ≥ 2.3.0 Metal device 支援
    （v3 寫「≥ 2.1 Metal backend」是錯的、§17 P1-2 + CODEX §16 P1-2 修正）
  - 北牆是 R7-3.10 hybrid edge bake 的最後一面、決定 R7-3 是否收尾
  - GPU 單張、wall time 預算 ~3-5 天（含 spike + 校準 + 量產 + 視覺驗收）

Alternatives considered:
  - 不降噪、純烤 10000+ SPP（變體 A 路線單跑）
    優點：無 OIDN 風險、語意純粹
    缺點：wall time 不可預測、若 SPP 還不夠仍要再 ramp
  - BM3D 取代 OIDN
    優點：無神經網路偏差、傳統演算法可審查
    缺點：實作週期不對、Cycles / V-Ray / ImageJ / OpenCV 雖有實作
         但需自寫 CLI bridge、本輪時間預算不合算
    （v1 排除理由「無工業案例」是錯的、v2 改正）
  - SVGF 取代 OIDN
    優點：空間部分可單獨跑、無 OIDN 訓練偏差
    缺點：需從 GLSL shader 翻譯成獨立 CLI 工具、本輪時間預算不合算
    （v1 排除理由「無 temporal」是錯的、空間部分可單跑、v2 改正）

Why chosen:
  OIDN 業界標準 + 本機 Metal 支援 + 使用者指定首選；
  Stage 0 spike 會驗證「OIDN 是否適用本場景」、若不適用則 abort 升 R7-3.11
  評估 BM3D / SVGF；不在無數據下排除 BM3D / SVGF。

Consequences:
  + Stage 0 spike 通過 → 走完三階段，預計 ~3-5 天 wall time
  + Stage 0 spike 失敗 → 升 R7-3.11 評估 BM3D / SVGF（+ 2-4 週）
  - 若選 C（1000 SPP + DN）後上線發現 hallucination → 退 B 或 A
  - OIDN HQ U-Net 在 padding 邊界有 ringing 風險 → mask-aware dilation R=128 緩解
  - OIDN 對 indoor indirect 的訓練先驗可能讓 AO 過度平滑 → prefiltered normal aux 保

Follow-ups:
  詳 §13.2 F1-F8。

[ADR-P1-P5]：詳 §2.2

[ADR-Stage1-Variants]：詳 §4.2

[ADR-Production-Variant]：詳 §10.3

[ADR-Normal-Aux-Shader]（v3 新增，回應 MF3）
  Context: γ 路線（OIDN with prefiltered normal aux）需要 per-texel world-space
    normal aux atlas，現行 bake shader 只輸出 indirect_diffuse_radiance，
    沒有 normal output mode。
  Decision (v4 + CODEX 三審落版): shader 加 uniform float uR7310C1NormalAuxOutputMode、切換：
    outputMode = 0 (uniform = 0.0)：indirect_diffuse_radiance（現行行為，default）
    outputMode = 1 (uniform > 0.5)：raw world-space firstVisibleNormal（新增、primary hit/miss early-out）
    用 uniform branch（不用 #ifdef），不重寫整個 pipeline。
  值域規格（CODEX 二審指定）：
    直接輸出 firstVisibleNormal ∈ [-1, +1]^3、無 pack、無 clamp、單位向量
    對齊 OIDN RT filter normal aux 規格（world-space normal、[-1, +1] raw）
    來源：Open Image Denoise documentation
    https://www.openimagedenoise.org/documentation.html
    PFM RGBA32F 支援負值浮點、由 oidn-bridge 直接寫入 normal.pfm、OIDN --nrm 通道直吃
  落點位置（CODEX 二審指定 primary hit/miss early-out）：
    shader L4598: primary hit early-out（v4 + CODEX 四審後實測行號、原 L4596 因註解 +2 行偏移）
      在 bounces == 0 區塊內、firstVisibleNormal = nl 與 firstVisibleIsRayExiting 賦值後
      if (uR7310C1NormalAuxOutputMode > 0.5) return firstVisibleNormal;
    shader L4541: primary miss early-out（v4 + CODEX 四審後實測行號、原 L4539 因註解 +2 行偏移）
      在 if (t == INFINITY) 區塊內最前
      if (bounces == 0 && uR7310C1NormalAuxOutputMode > 0.5) return vec3(0.0);
      與 OIDN 「無 geometry」慣例對齊
  Geometry-only 1 SPP 優勢：bypass 整個 PT loop、SPP=1 即拿到 deterministic normal、無雜訊
  Drivers:
    - γ 路線需 normal aux
    - 不影響現行 indirect bake 路徑（outputMode = 0 為 default）
    - 與現有 runner 共用 fence / tile / every-samples / Chrome 鐵律
  Alternatives considered:
    - 寫獨立 shader：duplication 高、維護成本
    - 寫獨立 runner：和 main runner 不同 → 鐵律難共享
    - 用 raster pass 不走 path tracer：geometry stage 已有 worldNormal，
      可直接 raster 寫 atlas → 部分採用此設計概念：仍走 path tracer 主 shader 入口、
      但在 CalculateRadiance() 內 primary hit / primary miss 早期 early-out
      （不跑 PT bounces loop、不查 light、不做 MIS），達到 1 SPP geometry-only
      效果、同時保留與現有 runner 共用 Chrome / tile / fence / every-samples 鐵律的優勢
      v2 落版實況：直接 return firstVisibleNormal raw [-1, +1]、無 raster shader rewrite
  Why chosen: uniform branch 改動最小、與現有 runner 共用鐵律、normal 是
    deterministic geometry 屬性無需 Monte Carlo 積分。
  Consequences:
    - shader 改動影響 R7-3.10 SOP、必須在 R7-3.10 DONE 寫進 Debug Log
    - bake runner 需加 --output-mode=normal 參數（合入 ADR-Bake-Runner-Extensions）
    - F8 normal aux 合入主 bake runner 可省略獨立工具（呼應既有 follow-up）
  Follow-ups: F8 在 v3 後續可改寫成「ADR-Normal-Aux-Shader 已合入、無需獨立工具」

[ADR-Bake-Runner-Extensions]（v3 新增，回應 MF1 + MF3）
  Context: §15 RNG seed 契約與 §S0.5 normal aux 需 runner 擴 3 個參數，
    現行 docs/tools/r7-3-8-c1-bake-capture-runner.mjs（L88-L120 args 區）
    無此能力（無 --seed / --baseSeed / --rngSeed 旋鈕、salt 沒對外介面、
    snapshot-* 全是 UI 截圖）。
  Decision: 擴 runner 接受：
    --seed=<32bit hex>（預設 0xDEADBEEF）
    --dump-at-samples=N,M,...（預設空、不 dump；本輪不啟用，改走 N5 退路 2）
    --output-mode=indirect_radiance|normal（預設 indirect_radiance）
  Drivers: §15 + §S0.5 需求；不破壞現行調用方式（新參數 optional）
  Alternatives considered:
    - 不改 runner、寫 wrapper script：salt 仍無法注入、退路 2 仍需 runner 支援 --seed
    - 改 runner 但用 env var：難 grep、可讀性差
  Why chosen: CLI 參數明確、易 grep、向後相容
  Consequences:
    - 需改 runner（屬框架擴充、不破鐵律）
    - --dump-at-samples 在本輪不啟用（N5 退路 2 不需要），但保留參數位
  Follow-ups: F9 dump-at-samples 在後續階段啟用後驗 runner 中途 dump 能力

[ADR-InitCommon-URL-Keys]（v3 新增，回應 MF2）
  Context: §22.5 需擴 12 個新 URL key，現行 resolver
    （js/InitCommon.js:1516-1574）是 if-else 字串比對，每加一 key 需改一個 else-if；
    URL query 參數名是 nonSquarePackage（L1524），不是 v（v 是 cache-buster 慣例）。
  Decision: 擴 12 個 if-else（不重構成 lookup table、不改 query 參數名）
  Drivers: 鐵律「不動烤圖框架本身」不含 resolver；最小擴充原則
  Alternatives considered:
    - 重構成 lookup table：改動範圍過大、引入回歸風險
    - 讀外部 JSON config：增加額外依賴
  Why chosen: 12 個 else-if 雖醜但安全、回歸風險最低
  Consequences:
    - resolver 從 5 key 變 17 key（5 舊 + 12 新）
    - 每加 key 需同步 git commit
  Follow-ups: F10 若後續 R 階段 key 數量 > 50，再評估重構成 lookup table

[ADR-OIDN-Filter-Selection]（v4 新增，回應 §17 P2-1 + CODEX §16 P2-1）
  Context: v3 文件硬鎖 --filter RT、未對照 RTLightmap。
    官方 OIDN documentation 寫 RTLightmap 是 RT 變體、
    針對 HDR + normalized directional lightmap 最佳化、
    本案 atlas（indirect radiance lightmap）正屬此類訊號。
    必須在 Stage 0 對照一次 RT vs RTLightmap、才能在 ADR 寫定 filter 選擇。
    CODEX §16 P2-1 已正式指認此缺口。
  Decision:
    Stage 0 spike 從三組對照（RT a/b/c）擴成四組、新加 (d) RTLightmap + color-only。
    (d) 用 512² 或 1024² valid crop 跑、不必整張 D800。
    依 §S0.4 v4 場景表決定 Stage 1 採 RT 或 RTLightmap：
      場景 1-3：走 RT（a/b/c 結果決定 aux 策略 β / γ）
      場景 6：走 RTLightmap（注意無 normal aux 擴展性、限本案北牆）
      場景 7：RTLightmap 無增益淘汰、走 RT
    spike-aux-decision.md 必須寫「RT vs RTLightmap 結論」欄位。
  Drivers:
    - RTLightmap 是官方明寫的 HDR lightmap 最佳化 filter
    - 本案 atlas 屬 HDR lightmap、不對照等於略過 official 推薦路徑
    - 「最好的演算法、不變模糊」要求 filter selection 有對照數據
  Alternatives considered:
    - 不評估 RTLightmap、硬鎖 RT
      優點：少跑一組對照、Stage 0 簡單
      缺點：可能漏掉官方為本場景設計的 filter、被 CODEX 指認
    - Stage 1 才補 RTLightmap
      優點：Stage 0 不擴
      缺點：Stage 1 已是量產驗證、filter 決策不該在這時改
  Why chosen: 一次小樣本對照成本低、確保 filter selection 有依據。
  Consequences:
    - Stage 0 spike 增 (d) RTLightmap crop，新增成本約 30 秒；四組總執行約 10.5 分鐘
      （對齊 §S0.1 L238：a/b/c 整張 ≈ 3 × 3 分鐘 + (d) crop 30 秒）。環境配置 30 分鐘另計。
    - spike-aux-decision.md 需新欄位
    - 若 RTLightmap 勝出、Stage 1 走 RTLightmap、aux 策略限 β
  Follow-ups: F11 若 RTLightmap 在本案勝出但無 normal aux 擴展性、評估其他面是否仍走 RT
              （後續推到其他七面時、normal aux 可能仍是必要）
```

### §13.2 Follow-up F1–F8（含 Owner / Trigger / Done criteria / Status，Critic C7 必修）

```text
F1：量產上線後 90 天 hallucination 監測
  Owner: OPUS（每週審視覺截圖）
  Trigger: 北牆量產上線（merge r3-light → main）
  Done criteria: 90 天無使用者回報「北牆陰影怪、AO 不對、ring 殘影」
  Status: pending（待 Stage 1 完成、量產上線）

F2：若 hallucination 發生，退 B 或 A
  Owner: OPUS（裁示）+ CODEX（執行）
  Trigger: F1 期間發現 hallucination
  Done criteria: 退到上一級變體、plan.md §13 ADR 加 revision 紀錄
                 （v4 四審改、原 v3 寫 source.md、本輪 v4 source.md 凍結）
  Status: pending（等 F1 結果）

F3：normal aux 重用於其他牆面
  Owner: CODEX
  Trigger: Stage 0 (c) γ 採用 + Stage 1 通過
  Done criteria: 西牆 / 東牆 / 天花板 / 地板各跑一次 normal aux + DN，
              寫進 R7-3.10 全室收尾文件
  Status: pending

F4：90 天監測完成後寫 R7-3.10 final ADR
  Owner: OPUS
  Trigger: F1 完成
  Done criteria: plan.md §13 加 final ADR、SOP R0 全景地圖標 R7-3.10 ✅
                 （v4 四審改、原 v3 寫 source.md；F4 屬 90 天後 follow-up、
                  若屆時 source.md 恢復雙線可同步寫入；本輪 v4 source.md 凍結為準）
  Status: pending

F5：若 Stage 0 abort，開 R7-3.11 評估 BM3D / SVGF
  Owner: OPUS（寫 R7-3.11 ralplan）
  Trigger: Stage 0 abort A / B / C / D / E / F 任一
  Done criteria: R7-3.11 ralplan 完成（含 Architect / Critic 共識）
  Status: pending（等 Stage 0 結果）

F6：OIDN ≥ 3.x 4 通道支援後評估 EXR 路線
  Owner: CODEX
  Trigger: Intel OIDN 3.x 釋出且支援 4 通道
  Done criteria: 評估文件加進 plan.md §13 或單獨 R7-3.x 文件
                 （v4 四審改、原 v3 寫 source.md；本輪 v4 source.md 凍結；
                  若屆時 R7-3.x 開新 plan 則寫入新 plan）
  Status: blocked（等 OIDN upstream）

F7：若量產失敗，回頭跑 6 變體單變因對照
  Owner: OPUS + CODEX
  Trigger: F1 期間量產失敗 + F2 退到 A 仍不滿意
  Done criteria: 6 變體（A / A' / B / B' / C / C'）對照完成、ADR 更新
  Status: pending（不期望觸發）

F8：normal aux pipeline 可否合入主 bake runner（單 pass 雙輸出）
  Owner: CODEX
  Trigger: F3 確認 normal aux 對其他牆面有效
  Done criteria: bake runner 增 normal aux output、不需獨立 pass
  Status: pending（等 F3）
```

---

## §14 紀律對齊（Brave / html-review / OPUS-CODEX / throwaway / Metal-tile）

### §14.1 Brave 不可碰

```text
觸發點：bake runner findBrowser() 預設會選 Brave（如果安裝），
       OIDN spike 任何瀏覽器自動化都可能誤觸 Brave。
硬約束：
  - 強制指定 Chrome：bake runner --browser /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
  - 嚴禁 pkill Brave / killall Brave（使用者日常瀏覽器、有 live tabs）
  - 嚴禁 chrome-launcher 自動偵測（會挑到 Brave）
違反後回退：
  - 若 Brave 被誤啟，立即 SIGTERM Brave 並通報使用者
  - 不嘗試 SIGKILL（保留 tab 恢復可能）
MEMORY ref：feedback_never_touch_brave
```

### §14.2 html-review source.md 為單一真實源【本輪 v4 豁免】

```text
觸發點：本計畫的 plan.md / source.md / index.html。
硬約束：
  - source.md 是唯一可手動編輯的檔案
  - index.html 永遠由 CODEX 重生（CODEX 看 source.md 重新產 index.html）
  - 嚴禁直接編輯 index.html
違反後回退：
  - 若意外編輯 index.html，立即 git diff 找出差異
  - 把差異補回 source.md
  - 重生 index.html（CODEX）
  - 確認 source.md 與 index.html 一致
MEMORY ref：feedback_html_review_source_of_truth
```

### §14.3 OPUS 寫 source.md / CODEX 重生 index.html【本輪 v4 豁免】

```text
觸發點：審查走 html-review 機制。
硬約束：
  - OPUS：只寫 source.md、核實數值、寫裁示
  - CODEX：讀 source.md 重生 index.html、不寫裁示、不改 source.md
違反後回退：
  - OPUS 若手滑改 index.html → 跑 §14.2 回退
  - CODEX 若改 source.md → revert CODEX 的 commit
MEMORY ref：feedback_opus_codex_review_split
```

### §14.4 不 promotion / throwaway only / 不刪 D800-accepted package

```text
觸發點：bake 完成後、commit 前。
硬約束：
  - 所有 bake metadata 必須 "throwaway": true
  - 嚴禁 promotion（不可改成 false 後 commit）
  - D800-accepted package（前一輪 D-ramp 定案）不可刪
  - d1000-north-preview package（歷史對照）不可刪
違反後回退：
  - 若誤 commit promotion → revert commit
  - 若誤刪 accepted package → git reflog 找回
```

### §14.5 烤圖鐵律

```text
觸發點：bake runner 啟動。
硬約束（每條缺了 bake 結果不可用）：
  - tile 512 × 512（缺了 safety gate 擋）
  - fence（缺了全黑）
  - every-samples = 4（缺了 progress 不穩）
  - Google Chrome（never Brave）
  - submission boundary = fence
違反後回退：
  - 烤前 prebake-check.mjs 攔截（§8.2）
  - 若烤完才發現違反 → 整變體作廢、重跑
MEMORY ref：見 CLAUDE.md「R-stage × OMC tool mapping」+ feedback_bake_runner_duration
```

### §14.6 seam gate 自開 http server（v3 改 port=0，回應 NH2）

```text
觸發點：seam gate 工具啟動。
硬約束：
  - 自開 http server 用 port = 0（kernel 自動分配空閒埠）
    - 避免硬編碼 9003 / 9004 撞既有 dev tool
    - server 啟動後讀實際 port、寫進 metrics.json
  - 嚴禁 kill 使用者 9002 dev server
違反後回退：
  - 若誤 kill 9002 → 立即通報 + 不自動重啟（使用者要看自己改的狀態）
MEMORY ref：feedback_never_touch_brave + 使用者交接「9002 dev server 不穩、不要 kill」
```

### §14.7 bake runner duration 是 sample-bound

```text
觸發點：估時、abort 判定。
硬約束：
  - --timeout-ms 是 hang ceiling、不是預期工作時間
  - C1（1000 SPP）正常 < 2 分鐘
  - B（5000 SPP）正常 ~45-50 分鐘
  - A（10000 SPP）正常 ~90 分鐘
  - 估時錯誤導致誤判 hang → bake 中斷、變體作廢
違反後回退：
  - 設 --timeout-ms = 3 × 正常估時（給 hang ceiling 緩衝）
  - 真正 hang → 寫進 §7.2 Stop S5-S9
MEMORY ref：feedback_bake_runner_duration
```

---

## §15 RNG seed 契約（A / B / C 同 base seed、bit-exact sanity check）

### §15.1 契約核心

```text
- A / B / C 三變體共用同一 deterministic base seed
- base seed 在 §S05 校準時固定（建議：bake-runner 預設 seed = 0xDEADBEEF）
- 變體間的差異只來自 SPP（不應來自 RNG）
- A 變體跑前 1000 SPP 的 raw atlas，應與 C 變體（1000 SPP）的 raw atlas
  bit-exact identical（pre-OIDN）
- 同樣 A 跑前 5000 SPP，應與 B 變體（5000 SPP）的 raw atlas bit-exact identical
```

### §15.2 sanity check：bit-exact diff（v3 改寫，回應 MF1 + SF1）

v2 寫的「中途於 SPP = 1000 / 5000 dump 一份 atlas」依賴 runner 中途 dump 能力，但現行 `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`（L88-L120 args 區）沒有 `--dump-at-samples` 旋鈕、`deterministicRandomPair(sample, salt)` 的 salt 沒對外介面；snapshot-* 全是 UI 截圖、不是 atlas binary 中途 dump。

ADR-Bake-Runner-Extensions（詳 §13）會把 `--dump-at-samples` 參數位加進去，但本輪 v3 不啟用中途 dump（時間預算考量），改走「三條獨立 bake 用同 seed」退路 2。

```text
驗證 1：bake runner 取樣決定性（不依賴中途 dump）
  前置：ADR-Bake-Runner-Extensions 完成、runner 接受 --seed=<32bit hex>

  跑：
    A_full（10000 SPP，seed_0 = 0xDEADBEEF）
    A_1000_replay（1000 SPP，seed_0）
    A_5000_replay（5000 SPP，seed_0）
    B（5000 SPP，seed_0）
    C（1000 SPP，seed_0）

  比對 SHA-256：
    A_1000_replay vs A_full（前 1000 SPP 累積）
      → 若 A_full 不支援中途 dump（本輪 --dump-at-samples 未啟用），
        這條改成 A_1000_replay vs C raw（皆 1000 SPP，同 seed）→ 應 bit-exact
    A_5000_replay vs A_full（前 5000 SPP 累積）
      → 同上，改成 A_5000_replay vs B raw（皆 5000 SPP，同 seed）→ 應 bit-exact
    A_1000_replay vs C raw → 應 bit-exact
    A_5000_replay vs B raw → 應 bit-exact

  額外 wall time：A_1000_replay ~10 分鐘 + A_5000_replay ~46 分鐘 = ~56 分鐘
  併入 §19 總 wall time：13-15 hr → 14-16 hr，仍 fit Day 1-5 估算。

  若任一對不 bit-exact → bake runner 取樣非決定性、整輪 OIDN 路線需先修
  runner（升 ADR-Bake-Runner-Extensions 強制完成 --dump-at-samples 並重作驗證 1）。

驗證 2：同變體跑兩次 bit-exact（GPU 決定性）
  - 同 seed_0、同硬體（M4 Pro）、同程式碼 commit
  - 跑 B 兩次、bit-exact 比對 SHA-256
  - 若不 bit-exact → 多 GPU thread 順序問題、或 WebGPU 實作差異
  - 退路：整輪 OIDN 路線需先修 runner 才能評估、升 R7-3.11
```

### §15.3 工具實作

```text
docs/tools/r7-3-10-rng-bit-exact-check.mjs（新增、CODEX 寫）
Logic：
  - 讀 A.bin / B.bin / C.bin
  - 算 SHA-256
  - 對應比對（A@1000 / C、A@5000 / B）
  - 若任一不 bit-exact → exit code != 0，警告整輪數據
OIDN 路徑解析與驗證一律遵守 §5.1.2（v4 七審 CODEX P1）
  此工具不直接呼叫 oidnDenoise（純 SHA-256 比對）、§5.1.2 不適用、保留引用作參照。
```

### §15.4 RNG seed 紀錄

```text
docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/stage05/noise-floor-rng-seeds.txt
內容：
  seed_0 = 0xDEADBEEF
  seed_1 = 0xCAFEBABE
  seed_2 = 0x12345678
  seed_3 = 0x87654321
  seed_4 = 0xFEEDFACE
（CODEX 確認 bake runner 接受 32-bit seed 後寫入，
 若 runner 用 64-bit seed 需要升 64-bit 值）
```

---

## §16 metrics.json schema 鎖定（Critic C8 必修）

### §16.1 完整 schema

```text
{
  "variant": "A | B | C | spike_a | spike_b | spike_c | noise_seed_0..4",
  "stage": "0 | 0.5 | 1",
  "D": 800,
  "SPP": 10000 | 5000 | 1000,
  "auxStrategy": "none | color_only_beta | constant_white_albedo_alpha | prefiltered_normal_gamma",
  "wallTimeMs": {
    "bake": 0,
    "auxBake": 0,
    "oidn": 0,
    "preFill": 0,
    "postMask": 0,
    "metrics": 0,
    "total": 0
  },
  "gpu": {
    "contextLost": 0,
    "contextRestored": 0,
    "maxSubmissionElapsedMs": 0,
    "maxTileReadbackMs": 0
  },
  "atlasIntegrity": {
    "nonzeroTexels": 0,
    "nonzeroRatio": 0,
    "nanCount": 0,
    "infCount": 0
  },
  "oidnRuntime": {
    "maxRssMb": 0,
    "deviceUsed": "metal | cpu",
    "version": "2.x.x"
  },
  "metricsVsA": {
    "meanL1Rgb": 0,
    "meanL1Luma": 0,
    "p95L1Luma": 0,
    "p99L1Luma": 0,
    "maxL1Luma": 0,
    "ssimLuma11x11": 0,
    "fftHighFreqRetention": 0,
    "aoRoiDeltaPct": [0, 0, 0, 0, 0],
    "seamJumpRatio": 0
  },
  "passDecision": "pass | fail | marginal | invalid"
}
```

### §16.2 schema 驗證腳本

```text
docs/tools/r7-3-10-metrics-schema-validate.mjs（新增、CODEX 寫）
- 讀任一 metrics.json
- 驗 schema 完整性（所有 key 存在、型別正確）
- 驗值的合理性（nonzero ratio ∈ [0, 1]、maxRssMb > 0 等）
- 若有 NaN / Inf in metricsVsA → passDecision = "invalid"
- 若有 GPU contextLost > 0 → passDecision = "invalid"
- exit code != 0 → metrics.json 不可信
OIDN 路徑解析與驗證一律遵守 §5.1.2（v4 七審 CODEX P1）
  此工具不直接呼叫 oidnDenoise（純 JSON schema 驗證）、§5.1.2 不適用、保留引用作參照。
  但必須驗 metrics.json 內 oidn_resolved_path 欄位以 /opt/oidn-official/ 開頭、
  否則 passDecision = "invalid"（§5.1.2 驗證 B 的下游檢查）。
```

### §16.3 passDecision 邏輯

```text
若 (atlasIntegrity.nanCount > 0 OR atlasIntegrity.infCount > 0)
  → passDecision = "invalid"
elif (gpu.contextLost > 0)
  → passDecision = "invalid"
elif (oidnRuntime.maxRssMb > 1500)
  → passDecision = "invalid"
elif (wallTimeMs.oidn > 60000)
  → passDecision = "invalid"
elif (all metricsVsA 通過 §10.1 門檻)
  → passDecision = "pass"
elif (任一指標在 [3σ, 4σ] 內)
  → passDecision = "marginal"
else
  → passDecision = "fail"
```

---

## §17 風險登記 R1–R10（補充內容到 Critic 可審層級）

### R1：OIDN 訓練先驗對 indoor indirect 有偏差（OQ2）

```text
描述：OIDN 訓練資料以 Cycles / Arnold 等 path tracer 的 outdoor 與一般室內為主，
     1000 SPP 的 indoor irradiance（特別是窗框 / 門框內凹陰影、踢腳線）
     可能在分布外、OIDN 重建偏差大。
觸發點：Stage 0 spike + Stage 1 變體 C。
緩解：
  - Stage 0 spike 四組對照即驗證（v4 含 (d) RTLightmap）
  - 增加 Stage 0 子步驟「OIDN 偏差熱點 map」（OQ2 答覆）：
    手選 5-10 個 hard case ROI（含 §9.4 五個 AO ROI + 額外 5 個窗框
    細節、門框細節、踢腳線轉角），spike 後肉眼掃描每組
  - 若偏差熱點集中在某類 ROI（例：窗框內凹）→ 該 ROI 加強檢查
回退：Stage 0 abort C / Stage 1 變體 C 不過 → 退 B 或 A。
```

### R2：OIDN max RSS 超 1.5 GB（M4 Pro 48 GB 但子程式 1.5 GB 是 sanity）

```text
描述：D800 atlas ~120 MB raw + OIDN HQ 工作緩衝（典型 3-4× input）
     ≈ 500-700 MB。本機 M4 Pro 48 GB unified memory 理論充裕，
     但 OIDN 若有 leak 或 Metal 殘留可能超 1.5 GB。
觸發點：Stage 0 spike + Stage 1 變體 B / C。
緩解：
  - Stage 0 spike 同時量峰值 VRAM / RSS
  - 設 abort 上限 = 1.5 GB OIDN 子程式
  - 每次跑前重啟 OIDN（不 reuse process）
回退：超 1.5 GB → §7.2 Stop S6 → 整輪 abort 升 R7-3.11。
```

### R3：PFM 3 通道 / RGBA32F 4 通道 alpha 破口

```text
描述：見 §5.2.1。若 pipeline 任一階段沒處理好，padding 區會污染 valid 區。
觸發點：每變體 OIDN 處理時。
緩解：§5.2.3 六步 pipeline + §6.3 三道驗證 + §15.2 sanity check。
回退：驗證失敗 → 該變體 invalid 重跑、重跑仍失敗 → pipeline bug。
```

### R4：dilation 半徑不足產生 ring 殘影

```text
描述：v1 寫的 32 texel 不夠，v2 提到 ≥ 128。但若 OIDN 邊界 halo
     仍滲入 valid 區 → ring。
觸發點：§22.5 視覺驗收。
緩解：
  - 預設 R = 128
  - 視覺發現 ring → 升 R = 256 重跑
  - 仍 ring → 改 push-pull pyramid → 泊松填補
回退：所有 dilation 策略仍 ring → 該 aux 策略不可用、退 β。
```

### R5：normal aux bake 失敗或全零

```text
描述：normal aux 是獨立 pass，bake runner 寫成 RGBA32F；
     若 shader 輸出 worldNormal 計算錯誤 → 全零或 NaN。
觸發點：Stage 0 對照 (c) γ 或 Stage 1 變體 B / C（若 aux = γ）。
緩解：
  - bake 完即 sanity check：normal aux SSIM 自比 > 0.95
  - 隨機 sample 1000 texel，normalize 後長度應 ≈ 1
  - 全零 → §7.2 Stop S4 → 退 β
回退：γ 路線整體淘汰、強制 β。
```

### R6：Stage 0 spike 預算超時

```text
描述：2 小時 wall time 預算可能不夠（OIDN 安裝 / Metal 環境變數 /
     CLI 版本不對等問題）。
觸發點：Stage 0 開跑後。
緩解（v4 六審 CODEX P1：fallback CPU 已全刪）：
  - 預留 30 分鐘安裝（v2 已寫進 §S0.1）
  - 預跑「OIDN hello world」（單張小 PFM）確認 CLI 可跑、含 Metal device
  - 若 30 分鐘還沒過環境配置 → 改換官方 release tar.gz 重抓、或重編譯加 Metal flag
    （CPU fallback 本案不採用、使用者裁示有 GPU 必走 GPU）
回退：環境配置超 1 小時 → 升 R7-3.11 評估替代降噪器。
```

### R7：Stage 0.5 校準預算超時（v3 統一 wall time，回應 SF5）

```text
描述：Stage 0.5 校準預算超時——詳細 wall time 表見 §S05.3；
     abort 條件：任一 seed > 120 min → 改 N = 3 → 5.5-6 hr
觸發點：Stage 0.5 開跑後。
緩解：
  - abort 條件：任一 seed > 120 分鐘 → 整輪改 N = 3
  - 開機後第一輪 GPU 較涼、wall time 較準
  - 後續 seed 跑前等 10 分鐘冷卻
回退：N = 3 仍超時 → 直接用 v1 先驗門檻並承認校準失敗。
```

### R8：Stage 1 三變體 wall time 累積超 ~3 天

```text
描述：A ~90 min + B ~46 min + C ~10 min ≈ 2.5 小時 / 一輪。
     若需重跑 + 視覺驗收 + ROI 微調 + Open Questions 處理，
     wall time 可能累積到 ~3-5 天。
觸發點：Stage 1 進行中。
緩解：
  - 每次 bake 完即跑指標、不等 batch
  - 視覺驗收一日內完成（v3 規範：OPUS 寫 source.md + CODEX 重生 index.html；
                          本輪 v4 改：OPUS 寫進 plan.md 與 stage1-decision.md）
  - 使用者裁示時間不算入 wall time
回退：超 5 天 → 寫 ralplan 升 R7-3.10 stretch goal。
```

### R9：Stage 1 結果 inconclusive（B / C 都 marginal）

```text
描述：B 與 C 都落在 [3σ, 4σ] 邊界，無法機械裁示。
觸發點：Stage 1 完成、進決策樹 Branch 4。
緩解：
  - 輸出兩變體完整截圖 + metrics.json
  - 使用者裁示
  - ADR 加 revision 記錄裁示理由
回退：使用者選 A（最保守）並開 R7-3.11 評估替代降噪器。
```

### R10：OIDN 版本不可用（M4 Pro Metal backend）

```text
描述（v4 對齊官方 release notes、§17 P1-2 + CODEX §16 P1-2 已修正）：
  v2.2.0 才加入 Apple Silicon GPU Metal device（需 macOS Ventura+）。
  v2.3.0 才改善 RT filter high quality mode 對 HDR + cleanAux 品質。
  本案需要 RT high quality + cleanAux + normal aux → 鎖最低 ≥ 2.3.0。
  建議用目前官方 arm64 macOS 2.4.1。
  v3 文件原寫「OIDN 2.0 有 bug、2.1 才修」是錯誤敘述、v4 已刪除。

觸發點：Stage 0 spike OIDN 安裝後、與每次 OIDN CLI 呼叫前。

前置檢查（必跑、§5.1.1 已寫入完整指令、v4 修正版本檢查方式、v4 七審 CODEX P1 絕對路徑）：
  /opt/oidn-official/bin/oidnDenoise --list_devices       → 必須包含 metal device（官方有此 flag）
  版本解析（v4 用 stdout 解析、不用 --version 因官方無此 flag；
            CODEX §16 二審 P1 + 三審 P1 grep 字串修正）：
    跑 1×1 tiny PFM、grep stdout 「version=X.Y.Z」
    （實際 stdout 格式：device=<type>, version=<x.y.z>, msec=...）
    或 brew info / pkg-config --modversion / install path 解析（§5.1.1 三方法）

緩解（v4 六審 CODEX P1：CPU 備援路徑全刪、使用者裁示有 GPU 必走 GPU）：
  - 若版本解析 < 2.3.0
    → 從官方 https://github.com/RenderKit/oidn/releases 下載 ≥ 2.3.0（建議 2.4.1）
    → 升級完成前不可進 Stage 0
  - 若 --list_devices 無 metal device
    可能原因：Homebrew bottled 版（已實測 CPU only）、macOS < Ventura、安裝檔不含 Metal
    處理：
      1. 若用 Homebrew 版 → brew uninstall + 換官方 release tar.gz
      2. 若用官方 release 仍無 Metal → 確認 macOS ≥ Ventura、確認硬體支援 Apple Silicon GPU
      3. 上述都對仍無 Metal → 整輪 OIDN 路線 abort、升 R7-3.11
    禁止：fallback CPU device、本案不接受 backend="cpu" 的正式 spike 結果

回退：Metal device 跑出 NaN / Inf / 超 60s wall time → 整輪 OIDN 路線 abort、升 R7-3.11
       （不退 CPU 重試、§S0.3 abort F 已對齊）
```

---

## §18 Open Questions 處理（OQ1–3 答覆）

### OQ1：normal aux 來源？bake 不會自然產出 per-texel normal

答覆：見 §S0.5。獨立 geometry-only bake pass、1 SPP、改 shader output worldNormal。Path：`docs/tools/r7-3-10-normal-aux-bake.mjs`（新增、CODEX 寫）。

### OQ2：1000 SPP + OIDN 對 indoor irradiance 是否有 OIDN 訓練先驗偏差

答覆：見 §17 R1。Stage 0 spike 加「OIDN 偏差熱點 map」步驟：

```text
spike 完四組對照後（v4 含 (d) RTLightmap、§17 P2-1），OPUS 手選 5-10 個 hard case ROI 含：
  - §9.4 五個 AO ROI（窗框、門框、踢腳線、北 / 西 牆角、北 / 天花板角）
  - 額外 5 個 hard case：
    - 窗框上緣陰影（hard reflection）
    - 窗框下緣（與 sill 交界）
    - 門框上緣（與牆交界）
    - 踢腳線轉角（北 / 西 交點）
    - 牆面細節（牆紙 / 漆面均勻區）
肉眼掃描每組（a / b / c）的這些 ROI，記錄：
  - 哪個 ROI 在哪組看起來「不對」
  - 不對的類型（過平滑 / ring / 偏色 / AO 消失）
寫進 spike-aux-decision.md。
```

### OQ3：normal aux 1 SPP（vs v1 寫的 256 SPP）取捨

答覆：明寫「normal 屬幾何屬性、1 SPP 即收斂、不要烤 256 SPP 浪費」（已寫入 §S0.5）。

v1 寫 256 SPP 是 v1 作者誤把 normal aux 當「需要 Monte Carlo 積分的訊號」處理，但 normal 是 deterministic geometry stage 輸出，與 SPP 無關。1 SPP normal 與 256 SPP normal 應 bit-exact identical（除非 shader 在 normal write 階段做了採樣，這也是 bug 不是 feature）。

---

## §19 Stage 0 → 0.5 → 1 完整 wall time 估算（v3 統一，回應 SF5）

```text
Stage 0 spike：                          ~2 小時（含環境配置）
Stage 0.5 校準：                         9-10 小時（N=5、含 thermal throttling buffer；
                                                  abort N=3 退到 5.5-6 hr）
Stage 1 變體 A：                         ~90 分鐘（必跑）
Stage 1 變體 C：                         ~10 分鐘（必跑、先跑）
Stage 1 變體 B：                         ~46 分鐘（C marginal/fail 或使用者要保險才跑、§24 v4 單一路線）
Stage 1 指標計算 + 視覺：                ~30 分鐘（依跑了幾個變體調整）

Stage 1 wall time 兩種模式（§17 P2-3 + CODEX §16 P2-3 對齊 §24 v4）：
  最快模式：A + C + 不跑 B            = 90 + 10 + metrics + 視覺 ≈ 100 分鐘 + 30 分鐘
  保險模式：A + B + C                  = 90 + 46 + 10 + metrics + 視覺 ≈ 146 分鐘 + 30 分鐘
ROI 微調（OPUS 看截圖、改座標）：        ~30 分鐘
§15.2 退路 2 sanity check：              ~56 分鐘（A_1000_replay 10 min + A_5000_replay 46 min）
使用者裁示等待：                         非 wall time（使用者異步看）
合計（不含使用者裁示）：                 ~14-16 小時

分日建議（v4 對齊 §24 單一路線、§17 P2-3 + CODEX §16 P2-3）：
  Day 1：Stage 0 spike 四組對照（含 (d) RTLightmap）+ 結果判讀
         + Stage 0.5 開跑（晚上 ~22:00 跑通宵）
  Day 2 上午 ~08:00：Stage 0.5 完成 + 校準門檻寫定
  Day 2 下午：Stage 1 變體 C 先跑（~10 min）+ 變體 A 必跑（~90 min）+ 指標
              （v4 改：C 先跑、A 必跑）
  Day 2 晚：依 C metrics.json passDecision：
              C = pass → 出 C vs A 並排截圖、交使用者肉眼裁示是否量產 C
                         （省 B 不跑、總 Stage 1 ~100 分鐘）
              C != pass 或使用者要保險組 → 跑變體 B（~46 min）+ 完整 4×4 矩陣
                                            （總 Stage 1 ~146 分鐘）
  Day 3：§15.2 退路 2 sanity check（~56 min）+ 視覺驗收 + ROI 微調
         + stage1-decision.md 寫定（本輪 v4 不寫 source.md）
  Day 4-5：使用者裁示 + 量產決定 + handover
```

---

## §20 與其他 R 階段的接縫

### §20.1 與 R7-3.10 D-ramp 的接縫

```text
- 用 D800 face 大小（3379 × 2327 texel）
- 用前一輪 throwaway package 作 Stage 0 spike input
- 不刪 D800-accepted package、不刪 d1000-north-preview
- ADR 引用 docs/html-review/2026-06-01-r7-3-10-north-wall-d-ramp-plan/source.md
```

### §20.2 與 R7-3.10 全室 hybrid 的接縫

```text
- 本輪只北牆
- 西牆 / 東牆 / 天花板 / 地板 / texture 物件分離降噪交 F3 / F8
- 若本輪 OIDN 通過、normal aux pipeline 可重用 → F3 推進
- 若本輪 OIDN 失敗、升 R7-3.11 評估 BM3D / SVGF
```

### §20.3 與 R7-3.11 的接縫（未開）

```text
觸發條件：
  - Stage 0 abort A / B / C / D / E / F 任一
  - Stage 1 三變體全 fail（B / C，A pass 仍 fail 視為 fail）
  - F1 量產上線後出現嚴重 hallucination
R7-3.11 內容（暫定）：
  - BM3D CLI bridge 評估
  - SVGF 空間部分翻譯成獨立 CLI
  - Cycles / V-Ray denoiser 評估
  - 升 ralplan 取 Planner + Architect + Critic 共識
```

---

## §21 文件交付清單（OPUS / CODEX 分工）

### §21.1 OPUS 任務（v4 對齊本輪審查路徑變更、CODEX §16 三審 P1 修正）

```text
1. 寫本 plan.md（已升 v4 二審修正版 + 三審修正版）。
1.5. 進 Stage 0 之前跑 Placeholder 填實機制（見 §21.1.5、v4 改 plan.md 為主檔）。
2. 【本輪 v4 豁免】v3 規範：寫 source.md（基於本 plan.md、合進 html-review 機制）。
    v4 改：source.md 凍結於 §17、本輪不再更新；後續 R 階段恢復。
3. 核實 Stage 0 / 0.5 / 1 每階段的 metrics.json 是否符合 §10.1 門檻。
4. 寫 stage0/spike-aux-decision.md（Stage 0 結果判讀、含 RT vs RTLightmap 結論）。
5. 寫 stage05/noise-floor-3sigma-thresholds.md（Stage 0.5 校準結果）。
6. 寫 stage1/production-decision.md（Stage 1 量產路線決定）。
7. 寫 ADR 條目（§13）並維護 follow-up F1-F11 狀態（§13.2）。
8. 維護 .omc/plans/open-questions.md。
9. 寫 handover：R7-3.10-denoise.handover-next-opus.md（量產上線後）。
10. R7-3.10 DONE 四步：SOP / R0 全景地圖 / handover memory / git commit & push。
```

### §21.1.5 Placeholder 填實機制（v3 新增、v4 四審改 plan.md / stage decision md 路徑、CODEX §16 四審 P1 修正）

```text
v3 規範：全段在 source.md 操作（grep / 替換 / 鎖定）。
v4 四審改：全段改在 plan.md 與各 stage decision md 操作。
          理由：本輪 v4 source.md 凍結於 §17、不再寫入；
                CODEX 若照 v3 §21.1.5 動工會回到已豁免的 source.md 路徑。

Step 1：OPUS 進 Stage 0 之前，跑：
        grep -E '<[a-z][a-z0-9-]+>' plan.md
        （v4 四審：plan.md 取代 source.md 作 placeholder 來源）
        若 stage decision md 已開始寫、同時跑：
          grep -E '<[a-z][a-z0-9-]+>' stage0/spike-aux-decision.md \
                                       stage05/noise-floor-3sigma-thresholds.md \
                                       stage1/production-decision.md 2>/dev/null
        列出所有 placeholder（包含 <latest-d800-north> / <run-id> /
        <commit-sha> 等）

Step 2：每個 placeholder 對應一個「填實依賴」、寫進對應檔案：
  - 屬「跨階段」共用值（如 <latest-d800-north>、<commit-sha>）
    → 依賴寫進 plan.md 對應段落（§S0.2 共用輸入、§13 ADR 等）
  - 屬「單階段」值（如 spike <run-id>）
    → 依賴寫進該階段的 stage decision md：
      Stage 0：stage0/spike-aux-decision.md
      Stage 0.5：stage05/noise-floor-3sigma-thresholds.md
      Stage 1：stage1/production-decision.md
  - 範例：
    <latest-d800-north> 依賴：D-ramp 最終 throwaway package 名
      （grep .omc/r7-3-10-full-room-diffuse-bake/、寫進 plan.md §S0.2）
    <run-id> 依賴：bake runner 跑完當下生成的 timestamp
      （寫進對應 stage decision md）
    <commit-sha> 依賴：當前 HEAD commit
      （寫進 plan.md §13 ADR Drivers）

Step 3：CODEX 回覆每個 placeholder 的實際值（在對話窗或 stage decision md）

Step 4：OPUS 在 plan.md 或對應 stage decision md 替換、
        並在該檔文件頭寫：
        「Placeholders 已鎖定（時間 / commit / 對應檔名）」

Step 5：鎖定後 CODEX 不可改、OPUS 不可改（除非開 ADR revision）

例外：「動態值」placeholder（每次 bake 都會變的，例如 <run-id>）
  - 不鎖在 plan.md，也不鎖在 stage decision md，鎖在 metrics.json 內
  - plan.md / stage decision md 只寫
    「<run-id> 由 CODEX 在 bake 開始時自動生成、寫入 metrics.json」

【本輪 v4 豁免】v3 source.md 路徑全段已遷移至 plan.md / stage decision md、
                source.md 凍結於 §17、不再參與 placeholder 流程。
```

### §21.2 CODEX 任務（v4 移除「重生 index.html」、CODEX §16 三審 P1 修正）

```text
1. 【本輪 v4 豁免】v3 規範：重生 index.html（基於 source.md）。
    v4 改：本輪不重生 index.html；source.md 凍結於 §17、index.html 不更新；後續 R 階段恢復。
2. 實作 docs/tools/ 下的工具腳本（§5.4 oidn-bridge / §15.3 rng-bit-exact-check
   / §16.2 schema-validate / §S0.5 normal-aux-bake / §8.2 prebake-check
   / §9 metrics 計算 / §9.4 ROI 截取）。
3. 跑 Stage 0 / 0.5 / 1 所有 bake。
4. 跑 OIDN（透過 oidn-bridge.mjs）。
5. 跑指標計算與輸出 metrics.json。
6. 跑 §22.5 同 camera 截圖。
7. 把所有產出物放到 §12 列出的 path（含 stage0 / stage05 / stage1 子目錄）。
8. 不寫 ADR、不寫裁示、不改 plan.md（本輪 v4：source.md 也凍結、不可改）。
```

---

## §22 視覺驗收（沿用 §22.5 機制）

### §22.5 sweep-spot 對照截圖 URL key 白名單（v3 全面改寫，回應 MF2）

v2 寫「不改 InitCommon.js 結構」字面錯誤、且範例 URL 用 `?v=`（cache-buster 慣例）而非實際 query 參數名 `nonSquarePackage`（resolver `js/InitCommon.js:1524` 讀的就是這個）。v3 修正並把實際 key 數量從 v2 的 8 個改成 12 個。

```text
沿用前一輪 D-ramp 的 resolver + key-mapping + same-camera screenshot 機制
（docs/html-review/2026-06-01-r7-3-10-north-wall-d-ramp-plan/source.md §22.5）。

URL key 白名單擴充策略：
  - URL query 參數名鎖死「nonSquarePackage」
    （resolver L1524 讀的就是這個、不可改）
  - resolver 內部 if-else 分支必須擴 12 個
    （無法避免、視為 in-scope 框架擴充，對應 ADR-InitCommon-URL-Keys，詳 §13）
  - 不改 query 參數名、不改 resolver function signature、不改成 lookup table

12 個新 key 的 (key, package-pointer-path) 對映表：

  d800-north-raw-10000spp
    → docs/data/r7-3-10-c1-north-east-non-square-d800-raw-10000spp-preview-runtime-package.json
  d800-north-denoise-b
    → docs/data/r7-3-10-c1-north-east-non-square-d800-denoise-b-preview-runtime-package.json
  d800-north-denoise-c
    → docs/data/r7-3-10-c1-north-east-non-square-d800-denoise-c-preview-runtime-package.json
  d800-north-spike-color-only
    → docs/data/r7-3-10-c1-north-east-non-square-d800-spike-color-only-preview-runtime-package.json
  d800-north-spike-constant-white-albedo
    → docs/data/r7-3-10-c1-north-east-non-square-d800-spike-constant-white-albedo-preview-runtime-package.json
  d800-north-spike-prefiltered-normal
    → docs/data/r7-3-10-c1-north-east-non-square-d800-spike-prefiltered-normal-preview-runtime-package.json
  d800-north-raw-1000spp
    → docs/data/r7-3-10-c1-north-east-non-square-d800-raw-1000spp-preview-runtime-package.json
  d800-north-noise-seed-{0..4}（5 個 key）
    → docs/data/r7-3-10-c1-north-east-non-square-d800-noise-seed-{N}-preview-runtime-package.json

（注意：實際是 12 個 key，v2 寫 8 個錯了；v3 修正）

URL 範例（全部用正確參數名 nonSquarePackage）：
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-denoise-c
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-raw-10000spp
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-spike-color-only
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-spike-constant-white-albedo
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-spike-prefiltered-normal
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-raw-1000spp
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-noise-seed-0
  ...（其餘類推）

每個 URL 可額外加 cache-buster ?v=<commit-sha>：
  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-denoise-c&v=<commit-sha>

resolver 改動位置與形式：
  - js/InitCommon.js:1547-1567 之間插入 12 個新 else-if 分支
  - 保持 if-else 風格、不改 resolver function signature
  - 不改 query 參數名 nonSquarePackage
  - resolver 從 5 個 key（舊）變 17 個 key（5 舊 + 12 新）

每張截圖的 camera：
  - sweep-spot camera（與 D-ramp 同一台）
  - 1920 × 1080 視窗
  - same-camera screenshot 工具確保三變體截在同一視角
```

---

## §23 健康檢查與 K-method 提醒

### §23.1 K-method（Karpathy）原則對照本計畫

```text
1. 假設：OIDN 對本場景（indoor indirect, albedo-free）有效。
   verifiable：Stage 0 spike 四組對照即驗（v4 含 (d) RTLightmap）。
2. 「框架缺 vs 內容空」？
   - 烤圖框架完整（D-ramp 已通過）→ 不重做框架
   - 降噪內容空（沒跑過 OIDN）→ 填內容（Stage 0 spike）
3. 最小代碼：本計畫不寫程式碼、不改 runtime、不改 shader（除 normal aux pass）；
   工具腳本獨立、不污染現有 bake runner。
```

### §23.2 驗證紀律

```text
- 變體完成 = 完整變體 metrics.json + 視覺截圖 + 至少一輪指標通過
- 變體未驗收前不可作為決策依據
- 視覺驗收 cam 1 / cam 2 / cam 3 不適用（本輪是 atlas 量化、單 camera 截圖）
  改成：sweep-spot camera 標準截圖 + 五個 AO ROI 拉近截圖 + 接縫拉近截圖
- 任何「肉眼看起來像通過」不算通過、必須 metrics.json passDecision = "pass"
```

---

## §24 變體執行順序建議（v4 對齊 §17 P2-3 + CODEX §16 P2-3 單一路線）

```text
單一路線（v3 兩種說法「先跑 C 視結果決定 B」vs「跑完三變體查 4×4 表」並列
          已被 CODEX §16 P2-3 指認衝突、v4 統一）：

  1. 先跑 C（1000 SPP + DN、~10 min、最快、最早看 OIDN 表現）
  2. A（10000 SPP）必跑（reference、所有指標 baseline、不可省）
  3. C metrics.json passDecision 出來：
       - passDecision = "pass"
         → 出 C vs A 的 metrics + 並排截圖
         → 交使用者肉眼裁示是否量產 C
         → 不必跑 B（B 是 C 失敗的中段保險）
       - passDecision = "marginal" / "fail" / "invalid"
         → 跑 B（5000 SPP + DN、~46 min）
         → 再跑完整 §10.2 4×4 矩陣
       - 使用者要求「保險組」
         → 跑 B、進完整 4×4 矩陣
  4. 進 §10.2 矩陣 = 三變體 metrics.json 全到位（A + B + C 都跑完）。
     B 未跑時 §10.2 不可查、只能做 C vs A 的初步裁示。

wall time 估算（§17 P2-3 寫死）：
  最快路線：C pass + 不跑 B
    = A (90 min) + C (10 min) + metrics + 視覺
    ≈ 100 分鐘 + 視覺 30 分鐘
  保險路線：跑完三變體
    = A (90 min) + B (46 min) + C (10 min) + metrics + 視覺
    ≈ 146 分鐘 + 視覺 30 分鐘

關鍵：A 必須跑、不可省（沒 reference 就沒指標）。
       B 跑與不跑取決於 C 結果與使用者意願、不再「視 C 結果決定」與「查 4×4 表」並列。
```

---

## §25 收尾條件（本輪 R7-3.10 北牆降噪 DONE 的定義）

```text
DONE 條件全部滿足才可宣告：
  1. Stage 0 spike 四組對照完成（含 (d) RTLightmap）、spike-aux-decision.md 寫定（含「RT vs RTLightmap 結論」欄位）
  2. Stage 0.5 校準完成、noise-floor-3sigma-thresholds.md 寫定
  3. Stage 1 變體 A 完成（reference 必須有）
  4. Stage 1 變體 B 或 C（依 §10 決策樹選擇）完成
  5. 選定變體 metrics.json passDecision = "pass"
  6. §22.5 視覺截圖（全部 URL key）拍完並貼進 stage1-decision.md（本輪 v4 改）
  7. 使用者裁示通過（OPUS 不自我裁示）
  8. ADR-Production-Variant 寫定
  9. plan.md v4 APPROVE + 各 stage decision md 完整
     stage0/spike-aux-decision.md（含 RT vs RTLightmap 結論）
     stage05/noise-floor-3sigma-thresholds.md
     stage1/production-decision.md
     【本輪 v4 豁免】source.md / index.html 保留存底、本輪不更新
  10. .omc/plans/open-questions.md 答覆完成
  11. R7-3.10 DONE 四步：SOP R0 + handover memory + git commit & push

DONE 後續：
  - F3 normal aux 推到其他牆面（若本輪 γ 採用）
  - F1 90 天監測啟動
  - 若失敗 → R7-3.11 ralplan 評估替代降噪器
```

---

## §26 OPUS v4 APPROVE 裁示

```text
裁示：APPROVE。

整體歷程：
  v1 → v2 → v3：三輪 ralplan 共識（Planner / Architect / Critic）、v3 雙 APPROVE
  source.md §17 OPUS 裁示：對 CODEX §16 六點 ITERATE 全部接受、source.md 凍結於 §17 存底
  v3 → v4 二審：plan.md 對齊 source.md §17 六點修正（P1-1 / P1-2 / P1-3 / P2-1 / P2-2 / P2-3）
  v4 二審 → 三審：CODEX 五點 ITERATE 全部接受
    P1 --quality HQ → high 全文 0 殘留
    P1 OIDN ≥ 2.3.0 + --list_devices 前置
    P1 Stage 0 三組 → 四組（含 (d) RTLightmap）
    P2 §19 Day 2 順序改為先 C 再 A、視 C 結果跑 B
    P2 v3 字面（標題 / HQ + aux / OIDN < 2.1）全改 v4
  v4 三審 → 四審：CODEX 四點 ITERATE 全部接受
    P1 grep 字串改 version=X.Y.Z（對齊官方 stdout）
    P1 abort B 拆 B.1 / B.2（a/b/c full atlas + d crop 分開比）
    P1 §0 / §9.4.1 / §21 / §25 改 plan.md 路徑、source.md / index.html 本輪 v4 豁免
    P2 歷史段加「歷史摘要、非 v4 執行規格」標籤
  v4 四審 → 五審：CODEX P1 §21.1.5 Placeholder 機制全段改 plan.md / stage decision md 路徑
    邊際修正：§15.2 Step F / F2 / F4 / F6 / SF3 / SF4 全對齊 plan.md 路徑
  v4 五審：CODEX APPROVE。

v4 四審累積修正字面驗證：
  --quality HQ                       0 殘留（執行指令）
  ≥ 2.1（Apple Silicon Metal）       0 殘留（執行規範）
  「OIDN 2.0 Metal bug」誤述         0 殘留
  oidnDenoise --version              0 殘留（執行指令；剩 4 處皆「沒有此 flag」教育負面說明）
  Intel OpenImageDenoise X.Y.Z grep  0 殘留（執行指令；剩 1 處歷史說明）
  source.md 執行性操作指令           0 殘留（§14.2 / §14.3 條文存底 + §13 路徑引用 + §20 上一輪檔案引用）
  index.html 重生執行指令            0 殘留（§14.2 / §14.3 條文存底有【本輪 v4 豁免】副標）
  三組對照（執行段）                 0 殘留（剩處皆「v3 三組 / v4 已擴成四組」對照說明）
  中國用語掃描                        0 殘留

審查路徑變更（本輪 v4 一次性）：
  v3 規範：OPUS 寫 source.md、CODEX 從 source.md 重生 index.html（html-review 機制）
  v4 改：直接審 plan.md、source.md 凍結於 §17 OPUS 裁示存底、index.html 不重生
  MEMORY feedback_html_review_source_of_truth + feedback_opus_codex_review_split 本輪豁免
  後續其他 R 階段恢復雙線（§14.2 / §14.3 條文存底、標題加【本輪 v4 豁免】副標）

動工授權（本輪 v4 五審後角色互換、使用者裁示）：

  ============================================================
  本輪角色互換說明：
    原 v3 規範（§21）：OPUS 寫 plan.md / 裁示、CODEX 動工 / 不寫裁示
    本輪 v4 五審後改：OPUS 動工 §13.3 P0 / P1、CODEX 改任「審查者」角色
    原因：CODEX 流量使用率 over、改走低頻審查模式
    使用者裁示時間：v4 五審 APPROVE 後
    後續其他 R 階段：恢復原 v3 規範（OPUS 寫 / CODEX 動工）
  ============================================================

  OPUS 動工 §13.3 P0 五項：
    1. 讀 plan.md（§3.2 / §13 四個新 ADR / §22.5 / §10.2 矩陣 / §16 schema / §5.1.1 前置檢查）
    2. （v4 豁免）原 v3 規範：重生 index.html
    3. 動工 4 個 ADR：
       ADR-Bake-Runner-Extensions（runner 加 3 個 CLI 旋鈕）
       ADR-Normal-Aux-Shader（shader 加 outputMode uniform）
       ADR-InitCommon-URL-Keys（resolver 擴 12 個 else-if）
       ADR-OIDN-Filter-Selection（RT vs RTLightmap 對照、v4 新增）
    4. 寫 8 個工具腳本（§13.3 P0 第 4 條列表）
    5. 跑 Stage 0 spike 四組（a/b/c full atlas + d RTLightmap crop）
       前置：oidnDenoise --list_devices 必須含 metal device
              版本檢查跑 1×1 tiny PFM、grep stdout 'version=[0-9]+\.[0-9]+\.[0-9]+' >= 2.3.0
       產出 stage0/spike-aux-decision.md（含「aux 策略 β/γ」+「RT vs RTLightmap 結論」兩節）
       交 CODEX 審 + 使用者判讀

  OPUS 在 Stage 0 PASS 後動工 §13.3 P1：
    6. Stage 0.5 噪聲下限校準（N=5、整夜）
    7. Stage 1 變體 C → A → 視 C 結果決定 B（§24 單一路線）
    8. 拍 sweep-spot camera 截圖 + 5 個 AO ROI 拉近截圖
    9. 產出 stage1/production-decision.md（含 §10.2 矩陣裁示）交 CODEX 審 + 使用者裁示

  CODEX 本輪任務（審查者角色、不動工）：
    - 審 OPUS 動工後的 plan.md / stage decision md 修改
    - 審 OPUS 寫的 8 個工具腳本（程式碼層面）
    - 審 OPUS 跑 Stage 0 spike 的 metrics.json + 視覺
    - 審 spike-aux-decision.md / noise-floor-3sigma-thresholds.md / production-decision.md
    - 回 APPROVE / ITERATE 必修點
    - 不執行任何 bake / OIDN / tool 工作

  動工執行者（本輪 OPUS）不可做：
    - 在無 CODEX 審的情況下變更 plan.md 規格性段落（§S0 / §10.2 / §13 / §16 / §17）
      可改：typo、行號補正、ADR 行號誤差等可讀性修改
      不可改：abort 條件、量化指標門檻、決策矩陣、Schema 欄位、規格性 ADR
    - 寫 source.md（本輪 v4 source.md 凍結於 §17）
    - 重生 index.html（本輪 v4 豁免）
    - 自我裁示量產組合（marginal 不可機械、必須 OPUS 寫進 production-decision.md
                       + CODEX 審 + 使用者裁示三道把關）
    - 動 Brave（用 Chrome）
    - 改 query 參數名（鎖 nonSquarePackage）
    - 改 tile / fence / every-samples 鐵律
    - kill 使用者 9002 dev server
    - promotion / 刪 throwaway / 刪 accepted package

  審查者（本輪 CODEX）不可做：
    - 動手改 plan.md / stage decision md / 工具腳本（審查回 ITERATE 必修點即可、OPUS 改）
    - 跑 bake / OIDN / 任何工具腳本（OPUS 動手）
    - 替 OPUS 自我裁示量產組合（裁示權在使用者）

後續監測（F1-F11 follow-up、§13.2）：
  F1 量產上線後 90 天 hallucination 監測
  F2 hallucination 發生時退 B 或 A
  F3 normal aux 推到其他牆面
  F4 90 天監測完成寫 final ADR
  F5-F10 各情境 follow-up
  F11 RTLightmap 在本案勝出但 normal aux 擴展性受限時、評估其他面是否仍走 RT（v4 新增）

裁示時間戳：
  v4 五審 APPROVE：plan.md 2761 行
  v4 五審 APPROVE + 角色互換修訂：plan.md 升至 2877 行（含本 §26 動工授權段重寫）
  後續若有 v5 修正、本 §26 不重寫、改開 §27 v5 APPROVE 裁示。
```

---

## 歷史變更摘要：v1 → v2

以下列出 v1 → v2 的所有重大變更，按 §章節編號排序。

```text
§0 文件定位（新）
  - 新增：明寫 OPUS / CODEX 分工、html-review 機制、Stage 0/0.5/1 三階段定位
  - 理由：對齊 MEMORY: feedback_opus_codex_review_split + feedback_html_review_source_of_truth

§1 目前共識（修正 + 重申）
  - v1：D 值定案論點不清
  - v2：明寫 D = D800（3379 × 2327）為 D-ramp 定案、邊際遞減 20% 否決 D1000
  - 拒絕 Critic r1 的 C1「D 鎖定 D1000」事實錯誤
  - 新增 P5「atlas 是 albedo-free 純間接光輻射」並影響 OIDN aux 策略

§2 為什麼用 OIDN（補 P1 vs P5 衝突解決，Architect S1）
  - 新增 P5 trumps P1 in irradiance bake context（ADR-P1-P5）
  - 修正 BM3D / SVGF 排除理由（Critic C5）：BM3D 不是「無工業案例」、SVGF 不是「無 temporal」

§3 本輪範圍（重申、補 out-of-scope）
  - 新增明寫 out-of-scope：不動 D / 不動框架 / 不動 atlas 格式 / 不做其他牆面

§S0 Stage 0：OIDN 適用性 Spike（新增、Architect Synthesis）
  【歷史摘要、非 v4 執行規格；v4 已改四組、參見 §S0.2 / §S0.4 當前版本】
  - 全新章節：2 小時 wall time 預算、v3 三組對照 (a) β / (b) α / (c) γ
    （v4 已擴成四組、加 (d) RTLightmap、CODEX §16 P2-1）
  - abort 條件 A-F 完整明寫（Critic C9）
  - 包含 OQ1 normal aux 來源答覆、OQ3 1 SPP normal 答覆
  - v3 三組對照判定矩陣 5 種場景（v4 已擴成四組對照 7 種場景）

§S05 Stage 0.5：噪聲下限校準（新增、Architect M2 + Critic 加強）
  - 全新章節：N=3-5 個 RNG seed、3σ 上界當通過門檻
  - 校準預算 ~7.5-9 小時 wall time + abort 條件

§4 變體規格（M4 修補、ADR-Stage1-Variants）
  - v1：B 變體理由薄弱
  - v2：給 B 完整結構性辯護（raw SNR floor 推論 + Cycles 社群基準）
  - 明寫不採選項 2（刪 B）與選項 3（6 變體）的理由
  - 新增 ADR-Stage1-Variants 承認三變體不是嚴格 P2 對照、是工程現實妥協

§5 OIDN pipeline 規格（M1 完整解法）
  - v1：未處理 PFM ↔ RGBA 4 通道 alpha 破口
  - v2：完整六步 pipeline（讀 / dilation / 寫 PFM / OIDN / 讀 PFM / post-mask）
  - dilation 半徑改 ≥ 128 texel（v1 寫 32 texel 不夠、U-Net receptive field 256+）
  - push-pull pyramid 為預設、泊松填補 fallback、最近非零複製不採用
  - 評估 EXR 替代並結論「無實質好處」
  - OIDN ≥ 2.3.0（建議 2.4.1、Apple Silicon GPU Metal device 需 macOS Ventura+；v4 對齊 §17 P1-2）

§6 atlas valid-mask 處理（dilation flow + post-mask）
  - 全新章節：完整 flow chart + push-pull pyramid 偽程式碼 + 三道訊號完整性驗證

§7 驗收閘門（G1-G7 + Stop 條件補完 Architect S2 + Critic C9）
  - v1 §11 Stop 條件僅列 GPU/Metal
  - v2 補完 OIDN-specific Stop S1-S6（NaN/Inf、SSIM<0.90、normal aux SSIM<0.95、
    aux 全零、處理時間>60s、max RSS>1.5 GB）+ bake Stop S7-S10

§8 烤前防呆（含紀律對齊條目）
  - 新增烤前 checklist 8 條（browser / tile / fence / every-samples / D / server / throwaway / disk）
  - 與 §14 紀律對齊章節呼應

§9 量化指標公式（C1 必修）
  - v1：通過門檻 4 條中 3 條無法機械跑
  - v2：明寫色空間（linear）、通道（RGB + luma）、SSIM 參數（11×11、BT.709、L=實測 max）、
    計算範圍（valid mask ∩ 排除 16 texel halo）
  - AO ROI 改為 5 個 render-space 座標（v1 沒給座標）
  - 新增 seam jump ratio 與 FFT 高頻保留率

§10 判斷標準 + 量產決策樹（C4 必修）
  - v1：4 個分支
  - v2：補 tie-breaker（B vs C 平手選 wall time 短者 = C）+ 中間態（mean L1 過但 AO 超標）
    + NaN/Inf invalid + 全 fail 退 A 升 R7-3.11

§11 Stop 條件（合進 §7.2，留參照）

§12 產出物清單（含 Stage 0 / 0.5 / 1 完整 path）

§13 ADR（C5 排除理由改正 + C7 Follow-up 三欄）
  - 修正 BM3D / SVGF 排除理由
  - Follow-up F1-F8 補 Owner / Trigger / Done criteria / Status 四欄

§14 紀律對齊（C3 新增）
  - 全新章節：Brave / html-review / OPUS-CODEX / throwaway / 烤圖鐵律 / 9002 server / sample-bound duration

§15 RNG seed 契約（C6 必修）
  - 全新章節：A/B/C 同 base seed、bit-exact diff（A@1000=C raw, A@5000=B raw）作 sanity check

§16 metrics.json schema 鎖定（C8 必修）
  - 全新章節：完整 schema + 驗證腳本 + passDecision 邏輯

§17 風險登記 R1-R10（補到 Critic 可審層級）
  - R1：OIDN 訓練先驗偏差（含 OQ2 偏差熱點 map 步驟）
  - R2：OIDN max RSS（S4 + C11）
  - R3：PFM/RGBA alpha 破口（M1）
  - R4：dilation 不足 ring
  - R5：normal aux 全零
  - R6：Stage 0 預算超時
  - R7：Stage 0.5 預算超時
  - R8：Stage 1 wall time
  - R9：inconclusive
  - R10：OIDN 版本不可用（v4 修為 < 2.3.0 Metal device 不可用；v3 寫 < 2.1 Metal bug 是錯的、CODEX §16 P1-2 修正）

§18 Open Questions 處理（OQ1-3 答覆）
  - OQ1：normal aux 來源 = 獨立 1 SPP geometry-only bake pass
  - OQ2：1000 SPP indoor irradiance OIDN 偏差 → Stage 0 偏差熱點 map
  - OQ3：1 SPP normal（vs v1 寫的 256 SPP）正確、不要烤 256 SPP

§19 完整 wall time 估算（新）
  - Stage 0 ~2h + Stage 0.5 ~7.5-9h + Stage 1 ~2.5h + 視覺 ~1h = ~13-15h，分日建議

§20 與其他 R 階段接縫（新）

§21 文件交付清單（新）
  - OPUS / CODEX 分工明寫

§22.5 視覺驗收（C10）
  - URL key 白名單新增 8 個 key（不改 InitCommon.js）

§23 K-method 與驗證紀律（新）

§24 變體執行順序建議（新）
  - 推薦先跑 C（最快、若過可省 B）、A 必跑、B 視 C 結果

§25 收尾條件（新）
  - DONE 11 條件 + DONE 後續

整體：
  - v1 → v2 字數從 ~12k 升至 ~22k（含完整 schema / 偽程式碼 / 指令範例）
  - v1 → v2 所有 CRITICAL（M1 / M3 / M4 / C1）與 MAJOR（C3 / C4 / C5 / C6 / C7 / C8 / C9 / C10 / S1 / S2 / S4 / C11）全部處理
  - v1 → v2 新增章節：§0 / §S0 / §S05 / §6 / §14 / §15 / §16 / §17 / §18 / §19 / §20 / §21 / §23 / §24 / §25
```

---

## v3 變更摘要（vs v2）

以下列出 v2 → v3 的修訂。v3 不重寫整篇，只動受影響章節。修訂依 Architect r2 與 Critic r2 的 ITERATE 共識，分 P0 MUST FIX（4 條）+ P1 SHOULD FIX（8 條）+ P2 NICE TO HAVE（2 條 RESOLVED、2 條 DEFER）。

### P0 MUST FIX（v3 全部 RESOLVED）

```text
MF1：bake runner 無 seed / 無中途 dump、§15 與 §3.2 矛盾
  狀態：RESOLVED
  位置：§3.2 / §15.2 / §13 新 ADR
  修法：
    - §3.2 改寫成「鐵律不破」+「框架可擴充」兩層 scope
    - §15.2 改寫成「三條獨立 bake 用同 seed」退路 2
      （A_1000_replay vs C raw、A_5000_replay vs B raw）
    - §13 新增 ADR-Bake-Runner-Extensions（--seed / --dump-at-samples /
      --output-mode 三個 CLI 旋鈕）
    - §19 wall time + 56 min（A_1000_replay 10 min + A_5000_replay 46 min）

MF2：§22.5「不改 InitCommon.js 結構」字面錯誤 + 範例 URL 參數名錯
  狀態：RESOLVED
  位置：§22.5 / §13 新 ADR / §3.2
  修法：
    - §22.5 全面改寫：URL key 白名單擴充策略、實際 12 個 key（v2 寫 8 個錯了）
    - URL query 參數名鎖死 nonSquarePackage（不是 v；v 是 cache-buster 慣例）
    - resolver 從 5 key 變 17 key（5 舊 + 12 新 else-if 分支）
    - §13 新增 ADR-InitCommon-URL-Keys
    - §3.2 把 resolver 改動列為 in-scope 框架擴充

MF3：§S0.5 改 shader 缺對應 ADR
  狀態：RESOLVED
  位置：§13 新 ADR
  修法：
    - §13 新增 ADR-Normal-Aux-Shader（outputMode uniform branch、
      indirect_radiance vs world_space_normal）
    - F8 在 v3 後續可改寫成「ADR-Normal-Aux-Shader 已合入、無需獨立工具」

MF4：§10.2 決策樹用 passDecision matrix（非自然語言）
  狀態：RESOLVED
  位置：§10.2
  修法：
    - §10.2 改寫成 4×4 矩陣（pass / marginal / fail / invalid）
    - Priority 1-3 順序：invalid > A!=pass > B/C 雙變體查表
    - 11 個 Branch（1a-1g + 4 + 5 + 6 + inv-b / inv-c + ref-fail）
    - tie-breaker 被矩陣覆蓋、不再獨立章節
```

### P1 SHOULD FIX（v3 全部 RESOLVED）

```text
SF1：N5 中途 dump 退路
  狀態：RESOLVED（合入 MF1）

SF2：§9.4 ROI 座標 7 步微調流程
  狀態：RESOLVED【歷史摘要、非 v4 執行規格；v4 八審角色互換已改 OPUS 動工 + CODEX 審、見 §9.4.1 當前版本】
  位置：§9.4.1 新增
  修法：CODEX 拍 → 畫 overlay → OPUS 判讀 → 鎖定 → 後續不可改、
       除非開 ADR revision
       （v3 寫 CODEX 動工、v4 八審改 OPUS 動工 / CODEX 審 overlay）

SF3：placeholder 填實流程
  狀態：RESOLVED【歷史摘要、非 v4 執行規格；v4 四審已將 source.md 路徑遷移至 plan.md / stage decision md、見 §21.1.5 當前版本】
  位置：§21.1.5 新增 + §21.1 任務 1.5
  修法：grep placeholder → 對應依賴 → CODEX 填值 → OPUS 鎖定；
       動態值（<run-id>）鎖在 metrics.json
       （v3 寫「不在 source.md」、v4 四審改：不在 plan.md 也不在 stage decision md、只鎖 metrics.json）

SF4：§5.2.3 Step 3 row order probe 流程
  狀態：RESOLVED【歷史摘要、非 v4 執行規格；v4 四審已將 source.md 路徑遷移至 plan.md §15.2 / stage1-decision.md、見 §15.2 Step F 當前版本】
  位置：§5.2.3 Step 3.5 新增
  修法：染色 probe atlas（row 0 紅、row H-1 綠）→ OIDN → 判讀 →
       OPUS 寫 row order 結論到 plan.md §15.2 或 stage1-decision.md
       （v3 寫 source.md、v4 四審改）

SF5：§S05.3 / §19 / §R7 wall time 統一
  狀態：RESOLVED
  位置：§S05.3 / §19 / §17 R7
  修法：三處統一改成「9-10 小時（N=5、含 thermal throttling buffer）；
       abort N=3 → 5.5-6 hr」；§19 總 wall time 14-16 hr（含 §15.2 退路 2 的 56 min）

SF6：§9.2 FFT 0.7 門檻沒校準
  狀態：RESOLVED（採路徑 B）
  位置：§9.2 / §7.1 G5 / §10.1
  修法：FFT 高頻保留率降為 sanity 指標、不入 G5、不入 §10.1 主表、
       不入 §16.3 passDecision；CODEX 仍記錄 fftHighFreqRetention 供後續分析

SF7：Stage 0 raw atlas 是否 bit-exact 可重跑
  狀態：RESOLVED
  位置：§S0.2.1 新增
  修法：說明 throwaway 的 seed 是當時 runner 預設行為產生、無法精確復現；
       若需重跑必須用 seed_0 = 0xDEADBEEF 並承認新 raw 與 throwaway 不 bit-exact

SF8：§S0.4 通過 / 劣化 / 顯著好暫定門檻
  狀態：RESOLVED
  位置：§S0.4.1 新增
  修法：通過 > 30%、顯著好 > 15%、劣化 > 5%、相當 < 5%；Stage 1 必須換成 3σ
```

### P2 NICE TO HAVE（2 條 RESOLVED、2 條 DEFER）

```text
NH1：§S0.1 預算分配內部矛盾
  狀態：RESOLVED
  位置：§S0.1 重切分
  修法【歷史摘要、非 v4 執行規格；v4 已擴成四組 ~10.5 分鐘、見 §S0.1 當前版本】：
       v3 三組對照 ~10 分鐘（v2 說 60 分鐘錯了）、肉眼判讀 + 偏差熱點 map 70 分鐘、
       spike-aux-decision.md 10 分鐘；總計 2 小時

NH2：§14.6 自開埠位改 port=0
  狀態：RESOLVED
  位置：§14.6
  修法：port=0 kernel 自動分配、server 啟動後讀實際 port 寫 metrics.json

NH3：§X Pre-Mortem 章節（abort A-F + Stop S1-S10 + R1-R10 → 7 個情境表）
  狀態：DEFER → v4
  理由：非阻塞、合成表是好但 v3 已塞 12 個必修條目；現有 §S0.3 / §7.2 / §17
       已涵蓋每個情境細節、只是分散在 3 個章節。v4 可以重整、本輪不阻塞
       CODEX 進 Stage 0。

NH4：§21 工具 ↔ 測試層 ↔ pass 條件三欄表
  狀態：DEFER → v4
  理由：非阻塞、§12.4 工具清單 + §7 G1-G7 + §10.1 通過條件已分散涵蓋；
       三欄合成表是好但屬可讀性優化、不影響執行。v4 可以重整。
```

### v3 章節改動清單

```text
標題行：v2 → v3
§0：文件定位—改「v2 修訂版」為「v3 修訂版」、說明本輪只動受影響章節
§3.2：Out of scope → 兩層 scope（鐵律不破 + 框架可擴充）
§5.2.3 Step 3.5：row order probe 流程（新增）
§S0.1：預算重切分（10 min 對照 + 70 min 判讀 + 10 min 寫文件）
§S0.2.1：Stage 0 raw atlas 重跑 bit-exact 驗證（新增）
§S0.4.1：Stage 0 spike 暫定門檻（新增）
§S05.3：校準預算統一（9-10 hr / abort N=3 → 5.5-6 hr）
§7.1 G5：移除 FFT 主指標、改 sanity 提示
§9.2：FFT 改 sanity 指標、不入主指標表
§9.4.1：ROI 座標 7 步微調流程（新增）
§10.1：移除 FFT 行、加備註指向 sanity 指標
§10.2：改寫成 passDecision 4×4 矩陣（11 個 Branch）
§13：新增 3 個 ADR（Normal-Aux-Shader / Bake-Runner-Extensions / InitCommon-URL-Keys）
§14.6：seam gate http server 改 port=0
§15.2：改寫成「三條獨立 bake 用同 seed」退路 2
§17 R7：wall time 改成指向 §S05.3 + abort 條件
§19：總 wall time 14-16 hr（含 §15.2 退路 2 的 56 min）
§21.1：任務 1.5 插入 placeholder 填實機制 + F1-F8 改 F1-F10
§21.1.5：Placeholder 填實機制（新增）
§22.5：全面改寫（URL key 12 個、參數名 nonSquarePackage、resolver if-else 擴充）
末尾：v2 變更摘要改名為「歷史變更摘要：v1 → v2」、新增「v3 變更摘要（vs v2）」
```

### 整體

```text
- v2 → v3 行數從 2064 行升至 ~2300+ 行（新增 11 個小節 + 3 個 ADR + v3 摘要）
- v2 → v3 全部 P0 MUST FIX（MF1-MF4）與 P1 SHOULD FIX（SF1-SF8）已 RESOLVED
- v2 → v3 P2 NICE TO HAVE：NH1 / NH2 RESOLVED、NH3 / NH4 DEFER 到 v4
- v3 全篇用繁體中文台灣用語
- v3 不重寫 v2、只動受影響章節
- v3 寫入同一檔案：docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/plan.md
```
