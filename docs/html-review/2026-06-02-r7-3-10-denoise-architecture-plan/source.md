# R7-3.10 北牆降噪實驗計畫（白話文版）

## §0 給接手者的 30 秒摘要

```text
這份文件是給使用者睡前看的白話文摘要。完整技術計畫在：
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/plan.md
（2512 行、約 25000 中文字）

主旨：
  R7-3.10 北牆的烤圖（bake，先離線算好光照、之後 runtime 直接讀）
  在 D = D800（前一輪定案的解析度）這個前提下，
  試 3 種降噪策略，挑出「最快、視覺最接近真實答案」的那一個當量產用。

三輪 ralplan 共識結果：APPROVE
  Round 1：Planner 起草 → Architect 罵 4 條 MUST FIX → Critic 罵 4 條 MUST FIX → ITERATE
  Round 2：Planner 修 → Architect 罵 4 條 → Critic 罵 4 條（含事實錯誤）→ ITERATE
  Round 3：Planner 修 → Architect APPROVE → Critic APPROVE

實驗分三階段（Stage = 階段）：
  Stage 0  OIDN 降噪器到底適不適合本場景？2 小時試做
  Stage 0.5 噪聲下限校準（先量自然 RNG 波動再定容差）9-10 小時
  Stage 1  三個變體 A / B / C 跑完比較，挑量產組合，2.5-3 小時

使用者要做的事：
  1. 醒來把這份 source.md 連同 plan.md 路徑轉交 CODEX
  2. 請 CODEX 從 source.md 重生 index.html 並把 12 個必修 ADR 動工實作
  3. Stage 0 spike 結果出來、再請使用者肉眼判讀（會通知）
```

---

## §1 這份文件是什麼

這份是白話文版的摘要報告，目的是讓使用者睡前 10 分鐘讀完、醒來就知道下一步要做什麼。

技術細節全部在同資料夾的 `plan.md`（2512 行、12 個必修條目全部 RESOLVED）。本 `source.md` 不重述細節、只給「怎麼想、為什麼這樣做」的白話脈絡。

`index.html`（給瀏覽器看的版本）會由 CODEX 從本 `source.md` 重生（依專案 MEMORY `feedback_html_review_source_of_truth` 與 `feedback_opus_codex_review_split` 的 OPUS / CODEX 分工慣例）。

---

## §2 三輪共識結論

```text
Round 1：
  Planner 寫初稿 → 8000+ 字
  Architect 罵 4 條 MUST FIX：
    M1 PFM 格式只支援 3 通道、atlas 是 4 通道有 alpha 通道（用作有效像素遮罩），怎麼處理？
    M2 通過門檻（mean L1 < 0.005 等）沒做噪聲下限校準，是憑感覺寫的
    M3 「常數白 albedo（反射率）輔助通道」在 OIDN 內部等於告訴網路「材質完全均勻」
       → 把所有空間變化都認雜訊，比 color-only 更糟，不是「升級路徑」
    M4 變體 B（5000 SPP+降噪）對 C（1000 SPP+降噪）沒結構性優勢，
       對 A（10000 SPP 不降噪）只有時間優勢無品質保證
  Critic 罵 4 條 MUST FIX：
    C1（事實錯誤）：宣稱「D 已鎖定 D1000」── 已拒絕，使用者交接文與請求都明寫 D = D800
    C2 通過門檻不可機械測試（沒寫色空間、通道、視窗、SSIM 類型）
    C3 沒紀律對齊節（Brave / html-review / OPUS-CODEX / throwaway / 烤圖鐵律）
    C4 量產決策樹缺 tie-breaker（平手怎麼選）、中間態、NaN/Inf 處理
  Verdict：ITERATE

Round 2：
  Planner v2 修訂、寫到 22000 字
  Architect v2：所有 r1 必修 RESOLVED；但新發現「runner 中途 dump 不存在」假設破口
  Critic v2 用 grep 驗證程式碼，發現 4 條事實錯誤：
    MF1 bake runner 沒有 --seed 旋鈕（grep 確認）
    MF2 §22.5「不改 InitCommon.js 結構」字面錯誤；URL 參數名範例 ?v= 寫錯（實際是 ?nonSquarePackage=）
    MF3 §S0.5 改 shader 缺對應 ADR（架構決策紀錄）
    MF4 §10.2 決策樹「marginal」沒對應到 §16.3 passDecision 邏輯
  Verdict：ITERATE

Round 3：
  Planner v3 加入 3 個新 ADR：
    ADR-Bake-Runner-Extensions（runner 擴 3 個 CLI 旋鈕）
    ADR-Normal-Aux-Shader（shader 加 outputMode uniform 切換 normal aux）
    ADR-InitCommon-URL-Keys（resolver 擴 12 個 else-if 分支）
  §3.2 改成兩層 scope：鐵律不破 + 框架可擴充
  §10.2 改成 4×4 passDecision 矩陣（B × C 各 4 種狀態 = 16 格）
  §15.2 改走「三條獨立 bake 用同 seed」退路 2（不依賴中途 dump）
  §22.5 全面改寫含 12 個新 URL key 對映表
  Architect v3：APPROVE
  Critic v3：APPROVE（含 grep 驗證 runner / resolver 描述與實際程式碼吻合）
  共識達成
```

---

## §3 為什麼要做這件事

```text
背景：
  R7-3.10 北牆烤圖原本走「直接拉高 SPP（每像素樣本數）」路線，
  10000 SPP 的雜訊已經很乾淨、但烤一張要 90 分鐘。
  整個房間還有 7 個面要烤（西牆 / 東牆 / 天花板 / 地板 / 南牆 / 兩面窄面），
  全套要 8 × 90 = 720 分鐘 = 12 小時。

問題：
  使用者要做的不只北牆。後續還有：
    - 含紋理物件升級（南方櫃子 / 東北床 / 木門鐵門，目前還是 LIVE 純路徑追蹤）
    - 高品質 bake 生產線（趨近真實模式）
    - 架構候選評估（WebGPU / Metal / Blender）
  時間總成本壓力極大。

機會：
  業界標準降噪器 OIDN（Open Image Denoise，Intel 開源降噪函式庫）
  在 Blender Cycles / V-Ray / Arnold 都是預設或主要選項。
  M4 Pro 原生支援（≥ 2.1 的版本）。
  「albedo-free 純間接光輻射」（baked atlas 本身就不含牆面紋理）
  對 OIDN 是友善訊號 → 降噪不會破壞紋理。

關鍵問題：
  能不能用「中等 SPP + 降噪」換到「高 SPP 純烤」等級的視覺，但時間大省？
  例如 1000 SPP + 降噪（10 分鐘）能不能逼近 10000 SPP 純烤（90 分鐘）？
  這就是 R7-3.10 北牆降噪實驗要回答的問題。

為什麼是「實驗」不是「直接上線」：
  OIDN 是 AI 降噪器（神經網路），對「albedo-free 純間接光輻射」這種訊號的
  訓練先驗不完整、可能在 AO（環境光遮蔽，凹角變暗的效果）區過糊或殘留 ring。
  必須先做小規模試做（spike），不能直接信先驗。
```

---

## §4 三階段實驗

```text
Stage 0：OIDN 適用性試做（2 小時）
  用既有的 D800 1000 SPP 北牆 atlas（前一輪 D-ramp 留下的 throwaway 包）跑四組對照：
    (a) RT filter + color-only（不給輔助通道）
    (b) RT filter + 「常數白」albedo（反射率）輔助通道 ← 驗證 M3 假設
    (c) RT filter + prefiltered normal（法線）輔助通道
    (d) RTLightmap filter + color-only（§17 P2-1 加入）
        理由：RTLightmap 是 RT 變體、官方明寫為 HDR lightmap 最佳化、
        本案 atlas 就是 indirect radiance lightmap、必須對照一次才能說 RT 是最佳選擇。
        注意：RTLightmap 不支援 albedo / normal aux、若 (c) 勝過 (d) 仍走 γ。
        小樣本即可：512² 或 1024² valid crop 快跑、不必整張 D800。
  輔助通道（aux）= OIDN 用來「分辨什麼是真細節、什麼是雜訊」的額外資訊。
  Stage 0 結束時要回答：
    OIDN 對本場景到底有沒有效（mean L1 改善 > 30%）？
    要不要給 normal 輔助通道？
    RT vs RTLightmap 哪個 filter 對本案 atlas 表現好？

Stage 0.5：噪聲下限校準（9-10 小時，可整夜跑）
  跑 5 次 D800 10000 SPP（換不同 RNG seed）
  量「同樣設定下、自然 RNG 波動造成的 mean L1 / SSIM / AO 偏差」的標準差 σ
  把通過門檻錨在「3σ 上界」（覆蓋 99.7% 自然波動）
  ▲ 這層不能省，省了門檻數字就是憑感覺、CODEX 機械裁示破口
  ▲ 同一輪 Critic r1 就是因為 v1 缺這層才罵 M2

Stage 1：三變體 A / B / C 量產驗證（2-3 小時、§17 P2-3 已統一為單一路線）
  A：D800 + 10000 SPP（不降噪）            ~90 分鐘 / 視覺真實答案
  B：D800 + 5000 SPP + OIDN 降噪          ~46 分鐘 / 中段路線（保險）
  C：D800 + 1000 SPP + OIDN 降噪          ~10 分鐘 / 最快路線

  單一路線執行順序（不再「視 C 結果決定」與「跑完查 4×4 表」並列）：
    1. 先跑 C（最快、最早看 OIDN 表現）
    2. A 必跑（reference 必須有）
    3. C pass → 先出 C vs A metrics + 截圖、交使用者肉眼
    4. C 未 pass 或使用者要看保險 → 才跑 B
    5. 要查完整 4×4 矩陣 → B 必須已跑完、否則只能做 C vs A 初步裁示
```

---

## §5 三個變體 A / B / C 比較

```text
變體 A（reference 參考底，不降噪）：
  D = D800（面 3379 × 2327 像素）
  SPP = 10000
  降噪：無
  輸出：atlas binary ~120 MB（RGBA 4 通道、每通道 32-bit float）
  估時：~90 分鐘 wall time
  角色：絕對 reference，所有指標的 baseline，不可省

變體 B（中段路線、保險）：
  D = D800
  SPP = 5000
  降噪：OIDN 高品質模式 + 輔助通道（由 Stage 0 結果決定 β 或 γ）
  估時：~46 分鐘（含 OIDN 30 秒）
  結構性辯護（v3 加）：
    1000 SPP 的 raw SNR ≈ 31.6 倍 single-sample
    5000 SPP 的 raw SNR ≈ 70.7 倍 single-sample
    B 的 raw SNR 是 C 的 ~2.24 倍
    Cycles 社群基準：interior indirect lighting OIDN 建議 SPP > 512-1024
    若 C 的 1000 SPP 在 OIDN 訓練先驗「分布外」、B 可能仍在分布內
  量產用法：C 失敗時的中段嘗試（不是冗餘變體）

變體 C（最快路線）：
  D = D800
  SPP = 1000
  降噪：OIDN 高品質模式 + 輔助通道（同 B）
  估時：~10 分鐘 wall time
  角色：終極時間優勢、若通過所有指標就是量產路線
  風險：1000 SPP 可能落在 OIDN 訓練先驗分布外（hallucination 風險）
```

---

## §6 用什麼降噪（OIDN 是什麼）

```text
OIDN（Open Image Denoise，Intel 開源降噪函式庫）：
  - 業界標準：Blender Cycles / V-Ray / Arnold 預設或主要選項
  - 開源 Apache License 2.0、Intel 官方維護
  - Apple Silicon Metal device：v2.2.0 加入（需 macOS Ventura+）、
    v2.3.0 改善 RT high quality + cleanAux 品質
    本案最低要求 OIDN >= 2.3.0、建議用目前官方 arm64 macOS 2.4.1
    Stage 0 前置：oidnDenoise --list_devices 須看到 metal device
    若只有 CPU device → 可跑、但 metrics 標 backend=cpu
    （v1 寫「2.1+ 原生支援」是錯的，§17 P1-2 已修正）
  - high（high quality）模式：定位為 final-frame rendering（本案符合）
  - 用 U-Net（深度學習網路）作為降噪核心

本案用 CLI（命令列工具）路徑：
  oidnDenoise --hdr atlas-rgb.pfm --nrm normal.pfm \
              --output atlas-denoised.pfm \
              --filter RT --quality high --device default

  注：oidnDenoise CLI --quality 只接受 default / h / high / b / balanced / f / fast，
  HQ 不是有效值，照抄會直接失敗（v1 寫 HQ 是錯的，§17 P1-1 已修正）。

關鍵細節（plan.md §5 詳述）：
  1. atlas binary 是 RGBA 4 通道、PFM 只支援 3 通道
     → 解法：拆出 alpha 作 valid-mask、RGB 寫 PFM、跑完 OIDN 再 post-mask
  2. atlas padding 區（face 之間的空白）alpha = 0、RGB 未定義
     → 解法：mask-aware dilation（半徑 ≥ 128 像素，OIDN U-Net 接受域要求）
       用 push-pull pyramid 演算法（Bethesda / Naughty Dog 工業標準）
  3. OIDN 輸出後重新套 valid mask、padding 區強制歸零
     → 避免 OIDN 在 padding 區的「合成訊號」污染 runtime 取樣

為什麼不用其他降噪器（plan.md §13 ADR 詳列）：
  NVIDIA OptiX Denoiser：CUDA only，本機沒 NVIDIA GPU
  AMD RIFL：本機沒 AMD GPU
  自造 BM3D / NL-Means：實作週期不對、本輪預算不合算
    （v1 寫「無工業案例」是錯的，Cycles / V-Ray / ImageJ / OpenCV 都有實作，v2 改正）
  Cycles SVGF：需從 GLSL 翻譯成獨立 CLI 工具、本輪預算不合算
    （v1 寫「無 temporal」是錯的，空間部分可單跑，v2 改正）
  若 OIDN 全失敗 → R7-3.11 評估 BM3D / SVGF 替代
```

---

## §7 怎麼判定哪個變體要量產

```text
決策矩陣（plan.md §10.2 4×4 表、§17 P1-3 已修正 marginal 不可機械量產）：

  B 狀態 \ C 狀態        pass        marginal       fail         invalid
  pass                   選 C        選 B          選 B         重跑 C
                                     (C 留 follow-up)
  marginal               使用者裁示  使用者裁示     退 A         重跑 C
  fail                   選 C        使用者裁示    退 A 升 R3.11 重跑 C
                                     或退 A
  invalid                重跑 B      重跑 B         重跑 B       重跑 B+C

  原則（v1 矩陣破口、v2 修）：
    1. 量產變體 metrics.json passDecision 必須是 pass，不可是 marginal
    2. C=marginal 時不可自動量產：B=pass 改選 B、其餘進使用者裁示
    3. 使用者肉眼接受 marginal 必須在 production-decision.md 寫成「人工裁示」、
       不可寫成 CODEX 機械通過

  Priority 順序（從上到下）：
    1. 任一變體 invalid（含 NaN / Inf / context lost / max RSS 超 1.5 GB / OIDN 時間 > 60 秒）
       → 進 invalid 處理（重跑單機會）
    2. A 變體不 pass（reference 都壞 → 整輪 abort、不可信）
    3. B + C 雙變體查表

  量化指標（plan.md §9 詳述、§S05 校準後鎖定）：
    mean L1 luma（差距，越小越像 A）        < 3σ
    p99 L1 luma                              < 3σ
    SSIM luma 11×11（結構相似度）           > 1 - 3σ
    AO ROI delta（5 個指定凹角，每個算）    各別 < 3σ
    seam jump ratio（接縫亮度跳變）         < 1.5×
    （FFT 高頻保留率改 sanity、不入主表）

  量產組合預期（v2 對齊 §17 P1-3）：
    若 C 過所有指標 → 量產用 C，9-12 分鐘 / 面
    若 C marginal 但 B 全過 → 量產用 B，46-50 分鐘 / 面、C 留 follow-up
    若 C 全過所有指標但 B fail → 仍量產用 C（B fail 不影響 C 結論）
    若 B + C 都 fail → 量產退 A，90 分鐘 / 面、並開 R7-3.11
    若任一變體 marginal × marginal → 進使用者肉眼裁示、不機械通過
```

---

## §8 安全閘門

```text
G1：bake 完整性
    atlas binary 非空、size = 預期、nonzero ratio > 0.10、無 NaN / Inf
G2：OIDN 完整性
    退出 code = 0、max RSS < 1.5 GB、wall time < 60 秒、無 NaN / Inf
G3：dilation pre-fill 正確
    random sample 1000 padding 像素 dilation 後 RGB 非零
G4：post-mask 正確
    random sample 1000 padding 像素 post-mask 後 RGB == 0
G5：量化指標
    對齊 §S05 校準的 3σ 上界
G6：視覺驗收
    sweep-spot camera 同視角截圖 A / B / C 並排
    5 個 AO ROI 拉近截圖
    使用者肉眼判讀（OPUS 不自我裁示）
G7：紀律對齊
    Chrome only / tile 512×512 / fence / every-samples=4 / throwaway only

Stop 條件（plan.md §7.2 S1-S10 詳列）：
  S1：OIDN 輸出 NaN / Inf → 立即停
  S2：valid 區邊緣 SSIM < 0.90 → 升 dilation 半徑 256 重跑
  S3：normal 輔助通道 SSIM < 0.95 → 修 normal aux 來源
  S4：輔助通道全零 → 強制退 β（無輔助通道）
  S5：OIDN 處理時間 > 60 秒 → 改 CPU backend；仍超則 abort
  S6：OIDN max RSS > 1.5 GB → SIGKILL OIDN 子程式、整輪 abort
  S7-S10：bake runner 端 GPU 異常 / 提交時間異常 / readback 異常 / nonzero 比例異常
```

---

## §9 紀律對齊（plan.md §14 七小節）

```text
14.1 Brave 絕對不可碰
     bake runner findBrowser() 預設會選 Brave（如果安裝）
     強制 --browser Chrome、嚴禁 pkill Brave / killall Brave
     依專案 MEMORY：feedback_never_touch_brave

14.2 html-review source.md 為單一真實源
     OPUS 寫 source.md、CODEX 重生 index.html
     嚴禁直接編輯 index.html
     依專案 MEMORY：feedback_html_review_source_of_truth

14.3 OPUS / CODEX 分工
     OPUS：只寫 source.md、核實數值、寫裁示
     CODEX：讀 source.md 重生 index.html、不寫裁示、不改 source.md
     依專案 MEMORY：feedback_opus_codex_review_split

14.4 不 promotion / throwaway only
     所有 bake metadata 必須 "throwaway": true
     嚴禁 promotion、嚴禁刪 D800-accepted package、嚴禁刪 d1000-north-preview

14.5 烤圖鐵律
     tile 512 × 512、fence、every-samples = 4、Google Chrome（never Brave）
     submission boundary = fence
     每條缺了 bake 結果不可用

14.6 seam gate 自開埠位
     spawn http server 用 port = 0（kernel 自動分配空閒埠）
     嚴禁 kill 使用者 9002 dev server

14.7 bake runner duration 是 sample-bound
     --timeout-ms 是 hang ceiling、不是預期工作時間
     C1（1000 SPP）正常 < 2 分鐘
     依專案 MEMORY：feedback_bake_runner_duration
```

---

## §10 風險與對策（plan.md §17 R1-R10）

```text
R1 OIDN 訓練先驗對 indoor indirect 有偏差
   緩解：Stage 0 spike 三組對照驗、加偏差熱點 map
   退回：Stage 0 abort → 退 B 或 A

R2 OIDN max RSS 超 1.5 GB
   緩解：Stage 0 spike 量峰值、abort 上限 = 1.5 GB
   退回：超 1.5 GB → Stop S6 → abort 升 R7-3.11

R3 PFM 3 通道 / RGBA 4 通道 alpha 破口
   緩解：plan.md §5.2.3 六步 pipeline + §6.3 三道驗證
   退回：驗證失敗 → 該變體 invalid 重跑

R4 dilation 半徑不足產生 ring 殘影
   緩解：預設 R = 128；視覺發現 ring → 升 R = 256 重跑

R5 normal aux bake 失敗或全零
   緩解：bake 完即 sanity check（normal SSIM 自比 > 0.95、normalize 長度 ≈ 1）
   退回：γ 路線淘汰、強制 β

R6-R10 Stage 0 / 0.5 / Stage 1 預算超時、變體 inconclusive、OIDN 版本不可用
   各有具體緩解與退回（詳 plan.md §17）
```

---

## §11 估時與排日

```text
階段時間累積：
  Stage 0 spike：                    ~2 小時（含 OIDN 安裝 30 分鐘）
  Stage 0.5 校準（N=5）：             9-10 小時（含 thermal throttling buffer）
                                     abort N=3 退到 5.5-6 小時
  Stage 1 變體 A（10000 SPP）：       ~90 分鐘
  Stage 1 變體 B（5000 SPP+DN）：     ~46 分鐘
  Stage 1 變體 C（1000 SPP+DN）：     ~10 分鐘
  RNG 退路 2 驗證（A_1000_replay + A_5000_replay）：~56 分鐘
  指標計算 + 視覺：                  ~30 分鐘
  ROI 微調：                         ~30 分鐘
  使用者裁示等待：                   非 wall time
  合計（不含使用者裁示）：           ~14-16 小時

分日建議：
  Day 1：Stage 0 spike + 結果判讀（若 PASS 才開 Stage 0.5）
  Day 1 晚：Stage 0.5 跑整夜（22:00 起、Day 2 08:00 收）
  Day 2 上午：Stage 0.5 校準門檻寫定
  Day 2 下午：變體 A 跑（~90 min）
  Day 2 晚：變體 B 跑（~46 min）+ 變體 C 跑（~10 min）+ 指標
  Day 3：視覺驗收 + ROI 微調 + source.md 寫定
  Day 4-5：使用者裁示 + 量產決定 + handover

注意：每次 bake 都是 throwaway，不覆寫正式 package、不 promotion
```

---

## §12 開放問題（要使用者裁示的點）

```text
Q1：是否同意 Stage 0 spike 後再進 Stage 0.5？
    （建議：同意。Stage 0 若 abort 就不需 Stage 0.5 整夜 7.5-10 小時）

Q2：是否同意 Day 1 晚 22:00 開 Stage 0.5 整夜跑？
    （建議：同意。本機 M4 Pro 48 GB unified memory 足夠、過夜不阻擋使用者用電腦）

Q3：Stage 0 spike 結果出來後，由 OPUS 寫 spike-aux-decision.md
    （依 b / c 表現決定走 β 或 γ）
    是否同意 OPUS 寫完直接進 Stage 0.5、不再多開 ralplan？
    （建議：同意。spike 結果若不明確會升 R7-3.11、不會強推 Stage 1）

Q4：若 C 變體通過所有指標、是否需要也跑 B 變體做保險對照？
    （建議：不需要。C 過 → 量產用 C、B 留作 follow-up 路線；
     但若使用者堅持要看 B 對照、加 46 分鐘 wall time 即可）

Q5：5 個 AO ROI 座標（plan.md §9.4）是 Planner 給的草圖座標
    CODEX 拍完 sweep-spot camera 截圖後微調、需 OPUS 核實一次
    （依 §9.4.1 7 步流程鎖死）
    是否同意此流程？
    （建議：同意。此為機械裁示的最後一公里）
```

---

## §13 完整 plan.md 路徑與 CODEX 接手清單

### §13.1 計畫主檔路徑（絕對路徑、複製貼上即可）

```text
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/plan.md
```

行數：2512 行
字數：約 25000 中文字
狀態：v3，Architect APPROVE + Critic APPROVE
DELIBERATE：true

### §13.2 同資料夾其他檔案（CODEX 重生 index.html 後會多）

```text
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/
  plan.md           ← 技術計畫（本輪 OPUS 寫，CODEX 不可改）
  source.md         ← 本文件（白話文摘要，CODEX 重生 index.html 的依據）
  index.html        ← CODEX 重生（依 MEMORY feedback_html_review_source_of_truth）
  stage0/           ← Stage 0 spike 產出（CODEX 跑完後生）
  stage05/          ← Stage 0.5 校準產出
  stage1/           ← Stage 1 三變體產出
```

### §13.3 CODEX 接手清單（按優先順序）

```text
P0 CODEX 必做（在進 Stage 0 之前）：

1. 讀 plan.md（特別是 §3.2 / §13 三個新 ADR / §22.5 / §10.2 矩陣 / §16 schema）

2. 重生 index.html
   依本 source.md（不可只改 index.html）
   工具：CODEX 自行決定，需符合既有 html-review 機制（看前一輪
        docs/html-review/2026-06-01-r7-3-10-north-wall-d-ramp-plan/ 範例）

3. 動工 3 個新 ADR：
   ADR-Bake-Runner-Extensions：擴 docs/tools/r7-3-8-c1-bake-capture-runner.mjs
     加 --seed=<32bit hex>（預設 0xDEADBEEF）
     加 --dump-at-samples=N,M,...（本輪不啟用、留參數位）
     加 --output-mode=indirect_radiance|normal（預設 indirect_radiance）

   ADR-Normal-Aux-Shader：擴 bake shader
     加 outputMode uniform（0 = indirect_radiance、1 = world_space_normal）
     用 uniform branch（不用 #ifdef）
     1 SPP geometry-only 即可（normal 無 Monte Carlo 變異）

   ADR-InitCommon-URL-Keys：擴 js/InitCommon.js:1516-1574 resolver
     現有 4 個有效 key + default → 加 12 個新 key（共 17 key）
     在 L1547-L1567 之間插入 else-if 分支（plan.md §22.5 對映表完整列出）
     不改 query 參數名 nonSquarePackage

4. 寫 8 個新工具腳本：
   docs/tools/r7-3-10-oidn-bridge.mjs（PFM↔RGBA pipeline + OIDN CLI）
   docs/tools/r7-3-10-denoise-prebake-check.mjs（烤前防呆 8 條 checklist）
   docs/tools/r7-3-10-denoise-metrics.mjs（mean L1 / SSIM / FFT）
   docs/tools/r7-3-10-denoise-ao-roi.mjs（AO 5 個 ROI 量化）
   docs/tools/r7-3-10-noise-floor-calibration.mjs（Stage 0.5 配對 σ）
   docs/tools/r7-3-10-rng-bit-exact-check.mjs（SHA-256 配對）
   docs/tools/r7-3-10-metrics-schema-validate.mjs（schema 驗證）
   docs/tools/r7-3-10-normal-aux-bake.mjs（normal aux 1 SPP pass）

5. 跑 Stage 0 spike：
   2 小時 wall time
   三組對照（β color-only / α constant-white-albedo / γ prefiltered-normal）
   abort 條件 A-F 任一觸發即停（plan.md §S0.3）
   產出 spike-aux-decision.md 交 OPUS 判讀

P1 CODEX 在 Stage 0 PASS 後做：

6. 跑 Stage 0.5 噪聲下限校準（整夜，N=5）
7. 跑 Stage 1 變體 C → A → B（依 §24 順序、視 C 結果決定要不要跑 B）
8. 拍 sweep-spot camera 截圖 + 5 個 AO ROI 拉近截圖
9. 產出 metrics.json + 視覺截圖 + production-decision.md 交 OPUS 裁示

P2 量產上線後：

10. F1 90 天 hallucination 監測
11. F3 normal aux 推到其他牆面（若 γ 路線採用）

CODEX 不可做的事（plan.md §14 紀律）：
  - 改 source.md（OPUS 才能改）
  - 自我裁示量產組合（必須 OPUS / 使用者裁示）
  - 動 Brave（用 Chrome）
  - 改 query 參數名（鎖 nonSquarePackage）
  - 改 tile / fence / every-samples 鐵律
  - kill 使用者 9002 dev server
  - promotion / 刪 throwaway / 刪 accepted package
```

---

## §14 給使用者的「醒來看這個就好」摘要

```text
=== 給使用者的快速摘要 ===

你睡前丟給 OPUS 的 /ralplan 任務跑了 3 輪共識，達成 APPROVE。

完整計畫在：
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/plan.md

本文件（白話文摘要）在：
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/html-review/2026-06-02-r7-3-10-denoise-architecture-plan/source.md

醒來要做的事（建議順序）：
  1. 讀本文件 §13.3 CODEX 接手清單，跟 CODEX 確認他懂計畫
  2. 把 plan.md 路徑與本 source.md 路徑轉交 CODEX
     請 CODEX：
       (a) 從 source.md 重生 index.html
       (b) 動工 3 個新 ADR（runner 加 3 個 CLI 旋鈕 / shader 加 outputMode / resolver 擴 12 個 else-if）
       (c) 寫 8 個工具腳本
       (d) 跑 Stage 0 spike（2 小時，會通知你判讀結果）
  3. Stage 0 spike 結果出來後，OPUS 會寫 spike-aux-decision.md
     你看 OPUS 的判讀後決定是否進 Stage 0.5 整夜跑
  4. Stage 0.5 校準門檻定下後，跑 Stage 1 單一路線（§17 P2-3）：
     先 C → 必跑 A → C pass 則出 C vs A 給你看 → 未 pass 或要保險才跑 B
  5. 三變體結果出來，照 §10.2 4×4 矩陣（§17 P1-3 已修正 marginal 不機械通過）選量產
     若進使用者裁示格 → 你裁示
     若選定變體 passDecision != pass → 不可機械量產、必須人工裁示寫進 production-decision.md

預期時程：
  Day 1：Stage 0 spike + 判讀（~2-3 小時）
  Day 1 晚 → Day 2 上午：Stage 0.5 校準整夜跑
  Day 2 下午 → 晚：Stage 1 三變體
  Day 3：視覺驗收 + 你裁示
  Day 4-5：量產決定 + handover

最壞情況：
  Stage 0 abort → 整輪 OIDN 路線不採用 → 升 R7-3.11 評估 BM3D / SVGF 替代
  總白燒時間 ≤ 2.5 小時（spike + 安裝 + 判讀）

最理想：
  Stage 0 PASS + C 變體量產通過 → 北牆量產 10 分鐘 / 面
  推到其他 7 個面 → 8 × 10 = 80 分鐘
  相較純 A 路線 720 分鐘 → 省 ~10.7 小時

紀律提醒（CODEX 容易踩線的點）：
  - Chrome only，never Brave（你的日常瀏覽器有 live tabs）
  - source.md 由 OPUS 寫、index.html 由 CODEX 重生（CODEX 不可直接編輯 index.html）
  - throwaway only、不 promotion
  - tile 512×512 + fence + every-samples=4 鐵律不可破
  - 不 kill 你的 9002 dev server（CODEX 自開 http server 用 port=0 讓 kernel 自動分配）

晚安。醒來見。
```

---

## §15 OPUS 裁示

**裁示：APPROVE。**

本 v3 計畫已涵蓋 Round 1-3 共 16 條 MUST FIX + 16 條 SHOULD FIX 全部 RESOLVED。

對 runner（`docs/tools/r7-3-8-c1-bake-capture-runner.mjs` L88-L120 args、L3017 deterministicRandomPair）、resolver（`js/InitCommon.js:1516-1574`、L1524 nonSquarePackage 參數讀取）、shader（outputMode uniform branch 切換）三處程式碼現況的描述，Critic v3 已 grep 驗證屬實。

新增 3 個 ADR（Bake-Runner-Extensions / Normal-Aux-Shader / InitCommon-URL-Keys）把所有框架擴充明文化、§10.2 的 4×4 passDecision 矩陣讓 CODEX 機械裁示有明確查表規則。

剩餘 6 條 NICE TO HAVE（ADR 行號誤差、ADR 措辭微調、§10.2 補述位置、NH3 / NH4 DEFER、placeholder 命名慣例、§15.2 隱性序列）屬可讀性 / 行號誤差層級，不阻擋 CODEX 動工，可在 v4 或 Stage 1 前回收。

**CODEX 接手指南：依 §13.3 P0 五項先做、Stage 0 spike 完成後通知 OPUS / 使用者判讀。index.html 由 CODEX 依本 source.md 重生（勿只改 index.html）。**

---

## §16 CODEX 審查補充（未完全同意與建議修正）

```text
CODEX 審查結論：
  條件式同意本計畫大方向。
  D800、Stage 0 先做 spike、valid mask 分離、Chrome only、throwaway、噪聲下限校準，
  這些方向可以採用。

  但以下 6 點需要修正後，才建議進 Stage 0 實作。

P1-1：OIDN CLI quality 參數寫法需要修正
  位置：
    source.md §6
    plan.md §5.2.3 / §5.3 / §5.4

  問題：
    文件多處寫：
      --quality HQ

    官方 oidnDenoise 原始碼接受：
      default / h / high / b / balanced / f / fast

    HQ 不是 oidnDenoise CLI 的有效參數值，照抄會讓 OIDN 指令直接失敗。

  建議修正：
    將所有 CLI 與工具參數改成：
      --quality high

    或在工具內部接受 HQ 作為專案別名，但呼叫 oidnDenoise 前轉成 high。
    文件仍應寫官方值 high，避免下一位代理照抄失敗。

P1-2：Apple Silicon / Metal 版本門檻需要修正
  位置：
    source.md §6
    plan.md §5.1 / §17 R10

  問題：
    文件寫 OIDN 2.1+ 原生支援 Apple Silicon Metal backend。
    官方版本紀錄顯示 Apple silicon GPU 的 Metal device 在 v2.2.0 加入；
    v2.3.0 又改善 high quality + cleanAux 的 RT filter 品質。

  建議修正：
    本案最低要求改成：
      OIDN >= 2.3.0，建議用目前官方 arm64 macOS 2.4.1。

    Stage 0 前置檢查加入：
      oidnDenoise --list_devices

    需要看到 metal device 可用；若只有 CPU device，Stage 0 可以跑，但 metrics 需標記 backend=cpu。

P1-3：量產決策矩陣與「選定變體必須 pass」互相衝突
  位置：
    source.md §7
    plan.md §10.2 / §16.3 / §24

  問題：
    §10.2 矩陣有幾格會自動選 C：
      B=pass, C=marginal → 選 C
      B=fail, C=marginal → 選 C

    但 §24 又要求：
      選定變體 metrics.json passDecision 必須是 pass

    這會讓 CODEX 後續無法一致執行。

  建議修正：
    量產變體必須 pass。

    C=marginal 時不能自動成為量產變體，應改成：
      B=pass, C=marginal → 選 B，並保留 C 作 follow-up
      B=marginal, C=marginal → 使用者裁示
      B=fail, C=marginal → 使用者裁示或退 A

    若使用者肉眼接受 C=marginal，也要在 production-decision.md 寫成人工裁示，
    不可寫成 CODEX 機械通過。

P2-1：RTLightmap 至少需要納入 Stage 0 小樣本比較
  位置：
    source.md §6
    plan.md §5.2.3 / §5.3 / §13 ADR-OIDN-Tool-Selection

  問題：
    文件目前硬鎖 --filter RT。
    官方文件寫 RTLightmap 是針對 HDR lightmap 降噪最佳化的 filter。

    本案 atlas 是 indirect radiance lightmap。即使最後仍選 RT，也應有一次
    RTLightmap 小樣本比較，才符合使用者要求的「最好的演算法、不變模糊」。

  建議修正：
    Stage 0 增加一個小樣本對照：
      (d) color-only + RTLightmap

    建議先用 512×512 或 1024×1024 valid crop 快速跑。
    若 RTLightmap 不支援 normal aux、輸出偏色、或 AO 表現差，再寫入 spike-aux-decision.md 淘汰。

P2-2：OIDN API RGBA 描述需要改精準
  位置：
    plan.md §5.1 / §5.2.6

  問題：
    plan.md 寫「OIDN API 本身接受 RGBA Float32」。
    官方 RT / RTLightmap filter 的 color 與 output 是 1-3 通道；alpha-aware RGBA 不能當作既有能力。

    source.md 的 pipeline 方向正確：
      RGBA atlas 拆 alpha mask
      RGB 寫 PFM
      OIDN 後 post-mask

    但 plan.md 的 RGBA API 描述會誤導實作。

  建議修正：
    改成：
      OIDN filter 接受 1-3 通道 color/output。
      本案 RGBA32F atlas 的 alpha 是專案 valid mask，需由 oidn-bridge.mjs 自行保存與回填。

P2-3：Stage 1 跑法需要統一
  位置：
    source.md §4 / §14
    plan.md §10.2 / §24

  問題：
    文件同時寫：
      Stage 1 跑完 A / B / C 後查矩陣
      B 視 C 結果決定是否執行

    兩種說法會影響估時與驗收節奏。

  建議修正：
    寫成單一路線：
      1. 先跑 C，因為最快。
      2. A 必跑，因為它是 reference。
      3. 若 C pass，先產出 C vs A metrics 與截圖，交使用者肉眼看。
      4. 若 C 未 pass，或使用者想看保險組，才跑 B。
      5. 若要查完整 4×4 矩陣，B 必須已經跑完；否則只能做 C vs A 的初步裁示。

官方查證來源：
  OIDN overview：
    https://www.openimagedenoise.org/
    重點：OIDN 支援 color-only，也可用 albedo / normal aux；支援 Apple silicon GPUs。

  oidnDenoise.cpp：
    https://raw.githubusercontent.com/RenderKit/oidn/master/apps/oidnDenoise.cpp
    重點：--quality 參數接受 default / h / high / b / balanced / f / fast。

  OIDN documentation：
    https://www.openimagedenoise.org/documentation.html
    重點：OIDN device type 包含 Metal；RTLightmap 是針對 HDR lightmap 最佳化的 filter。

  OIDN releases：
    https://github.com/RenderKit/oidn/releases
    重點：v2.2.0 加入 Apple silicon GPU Metal device；v2.3.0 改善 RT high quality + cleanAux 品質。

CODEX 建議下一步：
  先由 OPUS 或使用者裁示是否接受上述 6 點。
  若接受，先更新 plan.md 相關段落，再由 CODEX 重生 index.html。
  修正完成前，CODEX 不建議直接進 Stage 0 實作。
```

---

## §17 OPUS 對 §16 CODEX 6 點的裁示

**整體裁示：6 點全部接受。** §15 的 v3 APPROVE 改為 **v3-conditional**，本 §17 之 source.md 修正 + plan.md 後續修正完成後升 v4 APPROVE，才可進 Stage 0。

### §17.1 官方來源核實摘要

```text
OPUS 用 WebFetch 抓 CODEX 給的 4 個官方 URL 逐一核對。

1. oidnDenoise.cpp（master）原始碼：
   --quality 解析只接受：
     default / h / high / b / balanced / f / fast
   → HQ 不在清單、CODEX P1-1 成立。

2. github.com/RenderKit/oidn/releases：
   v2.2.0（Feb 2024 釋出）：「Added Metal device for Apple silicon GPUs
                            (requires macOS Ventura or newer)」
   v2.3.0：「Significantly improved image quality of the RT filter in
            high quality mode for HDR denoising with prefiltering」
            並支援 HDR color + albedo + normal + cleanAux 組合
   → v2.1 沒有 Apple Silicon GPU Metal、CODEX P1-2 成立。

3. openimagedenoise.org/documentation.html：
   RTLightmap：「a variant of the RT filter optimized for denoising
                HDR and normalized directional lightmaps」
                不支援 albedo / normal aux buffer
   RT filter：color / output 接受 1-3 通道、不接受 4 通道
              extra channels 可用 pixel stride 跳過、OIDN 不處理 alpha
   → 本案 atlas 就是 HDR lightmap、CODEX P2-1 加 (d) 對照成立。
   → plan.md 寫「OIDN API 接受 RGBA Float32」誤導、CODEX P2-2 成立。

4. openimagedenoise.org overview：
   OIDN device type 列 CPU / SYCL / CUDA / HIP / Metal、與上述一致。

OPUS 自審 §7 矩陣與 §4 / §14 條件式描述：
  §7 矩陣有 4 格寫「選 C」但 C 是 marginal、與「量產必須 pass」衝突 → P1-3 成立。
  §4 L149 寫「B 視 C 結果」、§7 矩陣假設「B/C 都跑完才能查表」、§14 L530 沿用「B 視 C」
  → 三處表述衝突、P2-3 成立。
```

### §17.2 逐條裁示

```text
注意：以下「§X.Y」未冠檔名時、預設指 source.md 自己的章節（本檔現有 §0~§17）。
      凡指 plan.md（2512 行、§0~§25）章節時全部標明「plan.md §X.Y」。

P1-1 (--quality HQ → high)              接受
  source.md §6 已就地修正：
    L201-L203：CLI 範例改 --quality high
    L204-L205：加註「HQ 不是有效值、v1 寫錯、§17 P1-1 已修正」
  plan.md 待修：
    plan.md §5.2.3 / plan.md §5.3 / plan.md §5.4
      所有 --quality HQ 改 --quality high
    或在工具內部接受 HQ 作別名、呼叫前轉成 high
    文件對外仍寫官方值 high，避免下一位代理照抄失敗

P1-2 (Apple Silicon Metal 版本門檻)     接受
  source.md §6 已就地修正：
    L194-L201：最低改 OIDN >= 2.3.0、建議 2.4.1 arm64 macOS
                Stage 0 前置加 oidnDenoise --list_devices
                只有 CPU device → 可跑、metrics 標 backend=cpu
  plan.md 待修：
    plan.md §5.1   OIDN 最低版本 2.1 改 2.3.0、建議 2.4.1
    plan.md §17 R10「OIDN 版本不可用」風險改寫
    plan.md §S0.0 前置 checklist 加 --list_devices 步驟

P1-3 (量產矩陣與 passDecision 衝突)     接受
  source.md §7 已就地修正：
    L247：矩陣標題加「§17 P1-3 已修正 marginal 不可機械量產」
    L248-L258：4×4 矩陣 4 格改寫
      B=pass × C=marginal     → 選 B（C 留 follow-up）
      B=marginal × C=marginal → 使用者裁示
      B=fail × C=marginal     → 使用者裁示或退 A
      B=pass × C=fail         → 選 B（原本就是）
    L259-L264：加 3 條原則（量產必須 pass、marginal 不機械、人工裁示寫死）
    L277-L283：§7.量產組合預期 5 條重寫
  plan.md 待修：
    plan.md §10.2  4×4 矩陣同步改 4 格
    plan.md §16.3  passDecision 邏輯加 marginal 排除句
    plan.md §24    「選定變體 passDecision 必須是 pass」保留、與本矩陣對齊
                   （plan.md §24 = 「變體執行順序建議」，是 plan.md 第 24 個一級章節，
                    對應本 source.md §4 與 §7 的執行順序與決策表）

P2-1 (RTLightmap 納入 Stage 0)         接受
  source.md §4 已就地修正：
    L127-L141：Stage 0 從三組對照改四組
      (a) RT + color-only
      (b) RT + 常數白 albedo
      (c) RT + prefiltered normal
      (d) RTLightmap + color-only（§17 P2-1 加入、512² 或 1024² valid crop）
    註明 RTLightmap 不支援 normal aux、若 (c) 勝過 (d) 仍走 γ
  plan.md 待修：
    plan.md §5.2.3 加 (d) RTLightmap 對照流程
    plan.md §5.3   ADR-OIDN-Filter 加 RT vs RTLightmap 評估
    plan.md §13    ADR-OIDN-Tool-Selection 加 RTLightmap 限制描述
    spike-aux-decision.md template 加「RT vs RTLightmap 結論」欄位

P2-2 (OIDN API RGBA 描述精準化)        接受
  source.md 不必改：
    §6 L210-L215 拆 alpha → PFM → post-mask 的方向本來就對、
    沒寫過「OIDN API 接受 RGBA」。
  plan.md 必修：
    plan.md §5.1 / plan.md §5.2.6
      把「OIDN API 接受 RGBA Float32」改寫為：
        OIDN RT / RTLightmap filter 接受 1-3 通道 color / output。
        本案 RGBA32F atlas 的 alpha 通道是專案 valid mask、
        由 oidn-bridge.mjs 在 PFM 寫出前拆出、OIDN 處理 RGB 完成後 post-mask 回填。
        OIDN 不處理 alpha-aware 邏輯，全程由 bridge 工具負責。

P2-3 (Stage 1 跑法統一單一路線)        接受
  source.md §4 / §14 已就地修正：
    §4  L150-L161：Stage 1 改寫成 5 步單一路線
    §14 L559-L562：醒來摘要對齊單一路線、不再說「視 C 結果」與「查 4×4 表」並列
  plan.md 待修：
    plan.md §10.2 / plan.md §24
      統一描述：先 C → 必跑 A → 視 C 結果決定 B
    plan.md §11 估時加註「若 C pass 則 B 不必跑、總時間 ~100 分鐘；
                          若 C 未 pass 才補 B、總時間 ~146 分鐘」
```

### §17.3 OPUS 後續動作

```text
OPUS 必做（在 CODEX 重生 index.html 前）：
  1. 修 plan.md 對應段落（§17.2 列出的 11 處）
  2. plan.md 加 §17 章節對映 source.md §17 裁示
  3. 把 §15 OPUS 裁示行尾標記改成 v3-conditional → v4 APPROVE
  4. v4 APPROVE 後通知使用者：source.md + plan.md 已對齊 CODEX 6 點

OPUS 不在本輪做：
  - 不重生 index.html（CODEX 工作）
  - 不動 Stage 0 spike（必須 v4 APPROVE 後 CODEX 才能進）
```

### §17.4 CODEX 後續動作

```text
CODEX 接到本 v3-conditional 文件後（待 OPUS 改完 plan.md 升 v4）：
  1. 從 source.md（v4）重生 index.html
  2. 重生時要確認 §17 章節有完整呈現（裁示記錄不可漏）
  3. 動工 §13.3 P0 五項時，所有 --quality 改用 high、不寫 HQ
  4. oidn-bridge.mjs 加 RT vs RTLightmap 對照分支
  5. denoise-prebake-check.mjs 加 oidnDenoise --list_devices 檢查
  6. 量產決策邏輯遵守「marginal 不機械通過」原則

CODEX 不要做：
  - 不要在 v4 APPROVE 前進 Stage 0 spike
  - 不要照抄 v3 文件中 --quality HQ（已知錯誤）
  - 不要以「OIDN API 接受 RGBA」實作 alpha 處理（要走 bridge 拆 alpha）
```

### §17.5 給使用者的提示

```text
使用者醒來看到本 §17 時可以做的事：
  A. 接受本裁示（建議）→ 通知 OPUS 修 plan.md 對應 11 處、升 v4 APPROVE
  B. 不接受某幾點 → 指出哪幾條、OPUS 重審
  C. 直接讓 CODEX 重生 index.html（即使 plan.md 還沒對齊）
     → 不建議：CODEX 動工會踩 P1-1 的 HQ 失敗、P1-2 的版本門檻誤差

風險：
  本 §17 修了 source.md 共 6 處段落（§4 / §6 / §7 / §14），但 plan.md 還沒對齊。
  若直接讓 CODEX 跑、會以舊 plan.md 為準、踩 CODEX 自己警告的 6 點。
  建議走 A：OPUS 先修 plan.md、再交 CODEX。
```
