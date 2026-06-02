# Stage 0 spike：aux 策略決定 + RT vs RTLightmap 結論（plan §S0.7 / §S0.4）

OPUS 動工、CODEX 審查。本檔為 Stage 0 spike 交審主文件。

## 執行摘要

```text
input atlas：D800 北牆 c1_north_wall 3379×2327 1000 SPP（.omc/.../20260602-015822、76.77% valid）
normal aux：.omc/.../20260602-232046（1 SPP geometry-only、separated non-square）
真 OIDN：Metal device、version 2.4.1、RSS 全程 < 1.5 GB、contextLost 全程 0
四組完整 §16.1 metrics + metrics-schema-validate：全 4 組 PASS
row order：flipRows=false（CODEX 判讀核准）
```

## 量化結果（reference = raw 1000 SPP input、metricsVsA = denoised vs raw、§S0.4.1）

```text
full atlas（3379×2327、core 5,812,635 texel、距 boundary > 16）：
  變體                       meanL1Luma   SSIM      p99L1Luma   oidn     RSS
  (a) β color-only           9.284e-3     0.6772    3.51e-2     849ms    234MB   ← 最佳
  (b) α constant-white       9.390e-3     0.6702    3.53e-2     1149ms   323MB
  (c) γ prefiltered-normal   9.405e-3     0.6687    3.54e-2     1629ms   437MB

1024² crop（右側窗光區、core 984,064 texel、公平比 filter）：
  (a-crop) RT                1.161e-2     0.5816    3.78e-2     231ms    70MB
  (d) RTLightmap             1.187e-2     0.5633    3.87e-2     328ms    69MB
```

## 第一節：aux 策略決定 → β color-only（場景 2）

```text
(b) α vs (a) β：meanL1 差 (9.390-9.284)/9.284 = 1.14% < 5% → 「相當」
  → M3「constant-white albedo 會劣化」假設未明顯成立。
(c) γ vs (a) β：meanL1 差 (9.405-9.284)/9.284 = 1.3% < 5% → 「相當」
  → 且 (c) γ 三項指標皆略差於 (a) β（meanL1 略高、SSIM 略低）、常數 normal aux 略微干擾。

判定矩陣（§S0.4）：對應場景 2
  (a) 通過 + (b) 相當 + (c) 與 (a) 相當 + (d) 不勝過 (a)
  → Stage 1 採 (a) β color-only（normal aux 無增益、albedo aux 無增益、走最便宜）。

北牆平面 normal 常數（CODEX 裁示 2、幾何事實、非 bug）：
  step 4 sanity check 證據：normal atlas valid 6,036,683 texel 全 = (0,0,1)、padding = (0,0,0)。
  北牆主面是單一平面（z=-1.874、normal 朝 +Z 進房間）→ 所有 texel normal 必然相同。
  故 normal aux 對北牆「無 spatial 資訊」（normal 不變）、(c) γ 必然 ≈ (a) β。
  本實測即為「平面 normal aux 無增益」的證據。
  其他面（家具 / 曲面 / 窗框 reveal）normal 變化大、normal aux 才可能有用（follow-up F3）。
```

## 第二節：RT vs RTLightmap 結論 → RT（場景 7）

```text
同一 1024² crop、color-only、只差 filter：
  (a-crop) RT     meanL1 1.161e-2  SSIM 0.5816
  (d) RTLightmap  meanL1 1.187e-2  SSIM 0.5633
  meanL1 差 (1.187-1.161)/1.161 = 2.2% < 5% → 「相當」、RTLightmap 三項略差。
視覺佐證：窗光漸層區 RT 與 RTLightmap 幾乎無差異（raw-crop / a-crop-rt / d-rtlightmap 三張對照）。

判定矩陣（§S0.4）：對應場景 7
  (d) 與 (a) 相當 → RTLightmap 對本案無增益、淘汰、走 RT。
  → spike-aux-decision.md 寫「RTLightmap 試過、無增益、後續面不再評估」。
```

## 工具驗證記錄（CODEX 裁示 3、normal aux bake runner status fail）

```text
normal aux bake（20260602-232046）runner status = fail，root cause：
  runner full-room-diffuse-bake 的 node 端「radiance 專屬驗證」誤套到 normal aux：
    - reprojection 把 atlas 當 indirect radiance 重投影比對 → normal 非 radiance → 0 comparisons → fail
    - rawSamples / atlasSamples 期望 radiance 多 SPP 累積 → normal early-out 1 SPP → fail
  但 browserValidationStatus = pass、atlas 內容正確（step 4 sanity check 確認結構/row/padding 對齊）。
  → 判定：工具驗證誤用、非 normal atlas 問題、本輪記錄不擋 Stage 0。
  → normal-aux-bake / runner status 驗證修正放後續（CODEX 裁示 5、不擋本輪 Stage 0）。
```

## Stage 0 OIDN 適用性門檻判讀（需 CODEX 裁示）

```text
§S0.4.1 暫定門檻「通過：mean L1 改善 > 30%（vs raw input）」的判讀困難：
  Stage 0 不跑 10000 SPP A（§S0.1）、無 ground truth、「改善」無法嚴格計算。
  實測降噪 meanL1（denoised vs raw）≈ 9.3e-3 luma、佔 raw 平均 luma 0.256 約 3.5%。
  原因：1000 SPP atlas 已相當乾淨（√1000 ≈ 31.6× SNR）、OIDN 降噪幅度本就小。
  視覺：raw vs (a) 確實移除細微顆粒、結構/漸層/家具陰影完整保留（無過平滑、無 ring、無偏色）。

OPUS 提請 CODEX 裁示：
  Q-A. Stage 0 OIDN 適用性是否 PASS？（視覺有改善、量化幅度小因 raw 已乾淨、無 ground truth 難套 30% 門檻）
  Q-B. 若 PASS：Stage 1 aux=β color-only、filter=RT（本檔結論）。
  Q-C. §S0.4.1 的「mean L1 改善 > 30%」門檻是否需重新定義（需 ground truth、或改視覺 + 不劣化準則）？

CODEX 裁示結果（2026-06-02、核准）：
  Q-A：OIDN 適用性通過。raw vs (a) 視覺明確去顆粒、邊界/家具遮擋/漸層/陰影保住、無 ring/偏色/過平滑；
       4 組 full metrics strict schema 全通過、device=metal、contextLost=0、RSS 在門檻內。
  Q-B：Stage 1 採 β color-only + RT。(b)α 與 (c)γ 與 (a) 差 1% 級且數字略差；
       北牆 normal 常數 (0,0,1) 平面幾何事實、γ 本面無額外資訊；RTLightmap 與 RT 相當且略差、場景 7 淘汰。
  Q-C：§S0.4.1 門檻重定義為 Stage 0 適用性準則（取代「mean L1 改善 > 30%」）：
       OIDN 適用性 = 視覺去顆粒 + 無結構劣化 + schema/runtime 全通過；
       aux/filter 選擇 = 同 reference 相對比較、5% 內視為相當、視覺作最後確認；
       真正量產品質判定留 Stage 1（A/C 或 A/B/C 同視角、同 ROI、同 metrics 決策）。
  normal aux status fail：同意工具驗證誤用、不擋本輪、後續再修 normal-aux-bake / runner status 判定。
  下一步：commit Stage 0 材料；推進走 Stage 0.5 校準再進 Stage 1。
```

## 對齊版本

```text
plan.md：v4 CODEX 四審核准（8+1 工具完成）
完整 §16.1 metrics：stage0/spike_{a,b,c,d}-full-metrics.json（schema-validate 全 PASS）
視覺：stage0/{raw-input, spike-a-color-only, spike-c-prefiltered-normal,
      raw-crop-1024, spike-a-crop-rt, spike-d-rtlightmap-crop, normal-aux-sanity}.png
Git branch：codex/r7-3-10-north-wall-denoise-oidn
```
