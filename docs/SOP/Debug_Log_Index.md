# Debug Log Index

> 目的：讓接手代理先用本檔路由，再回 `Debug_Log.md` 讀必要章節。`Debug_Log.md` 保留為完整總帳，不建議每次接手全讀。
> 更新日：2026-06-11

---

## 使用方式

```
1.  先讀本檔，判斷目前任務屬於哪條路線。
2.  再讀 `Debug_Log.md` 對應章節。
3.  若任務涉及目前 R 階段，必讀目前 R 階段 MD。
4.  若遇到 bug 或非預期行為，先讀「永久必讀」與對應觸發章節，再進 systematic debugging。
5.  新量測、新結論、新地雷與實驗路徑變更，仍寫回目前 R 階段 MD 與 `Debug_Log.md`。
```

快速定位章節：

```bash
rtk rg -n '^## |^### |R7-3|v3k|effectiveStrength|sampleCounter|S2' docs/SOP/Debug_Log.md
```

---

## 永久必讀

這些章節是跨 R 階段護欄，任務碰到 debug、shader、GUI 或 progressive accumulation 時先讀。

```
1.  `⚠ 必讀：通用 Debug 紀律`
    何時讀：
      - 任何 artifact、黑線、幾何怪象、材質污染。
      - 接手者想改 shader hitType 或複用 material type。
    核心：
      - 先定位 hitType，再讀完整分支。
      - material type 用物件語義。
      - 修復宣告前要有足夠視角與 spp 驗證。

2.  `R2-6｜MAX_SAMPLES 過曝`
    何時讀：
      - sampleCounter、MAX_SAMPLES、render pass 停止、累積 buffer 異常。
    核心：
      - 停止累積要同時停 counter 與 render pass。

3.  `R2-11｜切換 Cam 殘影揮之不去`
    何時讀：
      - Cam 切換、配置切換、幾何或光源狀態變更後殘影。
    核心：
      - progressive renderer 需要清空 accumulation buffer 才能瞬切。

4.  `R4-1｜UI 骨架復刻`
    何時讀：
      - 新增或調整左下、右上、浮動控制列。
    核心：
      - cache-bust 要全覆蓋。
      - 浮動 UI 要處理 pointer-lock guard。
      - slider 初始值要對齊 uniform 初始值。

5.  `R6-3 Phase2｜Cloud visibility probe v4/v5 亮度回歸教訓`
    何時讀：
      - Cloud NEE、normal、PDF、MIS、probe readback。
    核心：
      - probe 診斷 normal 不可污染正常渲染。
      - probe 數字通過不代表正常畫面通過。

6.  `docs/SOP/R7-3.10-xatlas-a1-bake-lessons-2026-06-10.md`
    何時讀：
      - xatlas A1、tile bake、normal sampler、probe 77-80、正式 package 與即時 capture 結果衝突。
    核心：
      - 北牆 A1 破圖來自 tile(1,0) normal sampler per-tile 狀態錯誤。
      - 修復宣告以正式 runner package + CPU 讀檔為準。
      - 新 probe 先做常數校準，shader cache-buster 要同步。

7.  `Debug_Log.md` 的 `R7-3.10 XATLAS A1 鐵門旁亮帶`
    何時讀：
      - xatlas A1 runtime、鐵門旁 jamb 亮帶、owner 重複認領、XATLAS 與 dedicated surface 同時加光。
    核心:
      - 鐵門旁亮帶來自 XATLAS A1 越界認領 iron-door reveal north jamb。
      - r7310C1XatlasA1NorthWallUv 與 JS mirror 必須同步舊北牆 owner gate。
      - xatlas A1 promotion 前要統一北牆 owner 排除、補 XATLAS owner probe、升級架構 contract。
```

---

## 目前優先路線

### R7-3.10 static diffuse bake expansion current line

```
必讀：
  - `docs/superpowers/plans/2026-05-17-r7-3-10-beam-column-bake-expansion-handoff.md`
  - `docs/superpowers/plans/2026-05-18-r7-3-10-se-column-north-live-match-plan.md`
  - `docs/superpowers/plans/2026-05-16-r7-3-10-static-bake-expansion-codex-handoff.md`
  - `docs/superpowers/plans/2026-05-16-r7-3-10-static-diffuse-bake-expansion-investigation-opus.md`
  - `docs/superpowers/plans/2026-05-15-r7-3-10-c1-1024-bake-resolution-plan.md`
  - `docs/SOP/R7：採樣演算法升級.md` 的 `2026-05-16 目前共識：先收 hybrid room，再談架構加速`
  - `Debug_Log.md` 的 `R7-3.10-static-diffuse-bake-expansion-east-wall-1024-runtime`
  - `Debug_Log.md` 的 `R7-3.10-c1-phase2-h5-h3-1024-bake-resolution-closeout`
  - `Debug_Log.md` 的 `R7-3.10-south-wall-reveal-atlas-edge-fix`
  - `Debug_Log.md` 的 `R7-3.10-south-window-lower-reveal-gap-fix`
  - `Debug_Log.md` 的 `R7-3.10-floor-east-west-contact-edge-fix`
  - `Debug_Log.md` 的 `R7-3.10-beam-column-bake-expansion-branch-open`
	  - `Debug_Log.md` 的 `R7-3.10-east-wall-beam-shadow-hybrid-indirect-bake-live-direct`
	  - `Debug_Log.md` 的 `R7-3.10-east-wall-beam-shadow-seam-guard-fix`
	  - `Debug_Log.md` 的 `R7-3.10-north-east-wall-first-hit-hybrid`
	  - `Debug_Log.md` 的 `R7-3.10-west-beam-shadow-mirror-hybrid-indirect-bake`
	  - `Debug_Log.md` 的 `R7-3.10-west-beam-shadow-bake-point-fix`
	  - `Debug_Log.md` 的 `R7-3.10-south-wall-ac-shadow-hybrid-user-accepted`
	  - `Debug_Log.md` 的 `R7-3.10-se-column-north-hybrid-all-bakes-guard`
	  - `Debug_Log.md` 的 `R7-3.10-se-column-north-shadow-live-match-bake`
	  - `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2-south-window-reveal-hybrid`
	  - `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2b-south-window-sw-column-continuity-todo`

目前狀態：
  - `main` 已推到 GitHub：2d79953 fix(R7-3.10): clean south reveal and floor side seams。
  - 目前新分支：`codex/r7-3-10-beam-column-bake-expansion`。
  - floor / north 1024 bake 已驗收，兩條衣櫃黑線看不出來。
  - floor / north / east / west / south / ceiling 正式 bake package 已移到 `assets/bakes/r7-3-10/c1-static-diffuse/`，runtime pointer 不再依賴 `.omc` 實驗資料夾。
  - floor / north / east / west / south / ceiling 六個 runtime slot 目前同為 1024，樑柱 static diffuse bake 接成 slot 6。
  - 北牆與東牆已改為 first-hit HYBRID：`c1_north_wall_first_hit_hybrid` / `c1_east_wall_first_hit_hybrid`，slot 仍是 1 / 2，正式 package 已重烘 1024px / 1000spp，讀間接漫射 bake，直接光與反射維持 live。
	  - 專用混合陰影面已接成 6 個連續面：東南扁柱北面 targetId 1008 / slot 7、東南扁柱西面 targetId 1009 / slot 8、南牆冷氣陰影 targetId 1010 / slot 9、東牆東樑陰影 targetId 1011 / slot 10、西南柱子北面 targetId 1012 / slot 11、西牆西樑陰影 targetId 1013 / slot 12；runtime 合併圖集總數改為 13 slot。
	  - 這 6 個專用面目前路線都是間接漫射讀 bake，直接光與斜陰影走即時路徑追蹤。
	  - 東南扁柱北面專用 package：`assets/bakes/r7-3-10/c1-static-diffuse/se-column-north-shadow-1024px-1000spp/`。
	  - 東南扁柱西面專用 package：`assets/bakes/r7-3-10/c1-static-diffuse/se-column-west-shadow-1024px-1000spp/`。
	  - 南牆冷氣陰影專用 package：`assets/bakes/r7-3-10/c1-static-diffuse/south-wall-ac-shadow-1024px-1000spp/`。
	  - 東牆東樑陰影專用 package：`assets/bakes/r7-3-10/c1-static-diffuse/east-wall-beam-shadow-1024px-1000spp/`。
	  - 西南柱子北面專用 package：`assets/bakes/r7-3-10/c1-static-diffuse/sw-column-north-shadow-1024px-1000spp/`。
	  - 西牆西樑陰影專用 package：`assets/bakes/r7-3-10/c1-static-diffuse/west-wall-beam-shadow-1024px-1000spp/`。
	  - 西側第一次鏡像實作曾漏接 `r7310C1BakeSurfacePoint` 的 patchId 1012 / 1013 分支，導致錯誤畫面被壓進西南柱北面與西牆；目前已補上各自世界座標映射並重烘 1024/1000spp package。
	  - 東牆東樑陰影專用面已加 `z < 2.475` 保護線，西牆西樑陰影專用面已加 `z < 2.833` 保護線，保留牆與角柱交界給原本牆／柱路徑；目前快取版本號是 `r7310-phase2b-west-wall-mosaic-guard-v1`。
  - 同視角驗收圖：`.omc/r7-3-10-se-column-north-shadow-live-match/20260518-134435/live-reference.png` 與 `.omc/r7-3-10-se-column-north-shadow-live-match/20260518-134435/se-column-north-shadow-bake.png`。
  - 東牆東樑陰影同視角圖：`.omc/r7-3-10-east-wall-beam-shadow-live-match/20260518-173350/live-reference.png` 與 `.omc/r7-3-10-east-wall-beam-shadow-live-match/20260518-173350/east-wall-beam-shadow-bake.png`。
  - 東南扁柱陰影驗收目標是同視角「即時路徑追蹤」對「間接烘焙加直接陰影現算」；舊 structural package 與舊 124711 完整漫射專用圖已退出這個驗收路徑。
  - 全開 UI 回歸已修：東南扁柱北面 hybrid first hit 現在會擋掉舊 structural slot 6 的 full-diffuse short-circuit，避免同一片面亮度重複相加與舊小階梯殘留；快取版本號是 `r7310-se-column-hybrid-guard-v1`。
  - 使用者已用超近距離 1SPP 肉眼驗收東南扁柱北面陰影：放大仍是滑順陰影，沒有階梯；1SPP 稍髒可接受。東南扁柱西面與南牆冷氣陰影也已由使用者回報成功。這條成功經驗要沿用為同類問題的主路線：受影響面讀間接漫射 bake，直接陰影與反射維持 live。
  - UI 目前拆成七顆按鈕：`地板烘焙`、`北牆烘焙`、`東牆烘焙`、`西牆烘焙`、`南牆烘焙`、`天花板烘焙`、`樑柱烘焙`，預設全開。
  - C runtime fallback 已移除；不回 fallback，不改鄰格取樣。
  - Option A / Option B bake 防污染保護已保留。
  - partial bake + LIVE 局部偏亮已定性為深度相加的過渡假象。
  - 正式驗收基準是全相關靜態漫射面 bake vs 全 LIVE。
  - 目前主線先在現有 Home Studio 架構收成快速預覽 hybrid room。
  - hybrid room 技術分工：靜態漫射面讀 bake；反射保留 LIVE path tracing。
  - floor / north / east / west / south / ceiling / structural beams-columns 已接成可分開開關的靜態漫射 bake；東樑與東南扁柱接點已改為 `se_column_north_z` 整面連續 island 後重烘，並新增 `c1_se_column_north_shadow`、`c1_se_column_west_shadow`、`c1_south_wall_ac_shadow`、`c1_east_wall_beam_shadow` 四個專用面作為陰影驗收路線；專用面目前採間接漫射烘焙加即時直接陰影。
  - south window reveal atlas edge 已補半格 texel coverage，右側與上側 room-edge 黑線對應的 atlas luma 已由 0 補到 0.21+。
  - south window lower reveal gap 已改為水平 reveal island 接到左右 reveal 入口；audit 由 `gap_or_strong_luma_jump_present` 變成 `no_large_gap_jump_at_probe_points`，兩個下角 gap luma 由 0 補到約 0.239 / 0.259。
  - floor east/west contact edge 已把地板 bake source 往房間內退一格，東西牆貼地黑線對應的 floor atlas luma 已由 0 補到 0.40+。
  - 快速預覽成功後，再開高品質 bake 生產線與 WebGPU / Metal / Blender 加速候選評估。
  - PlayCanvas 只列展示承載候選，等 baked room 穩定後再談。
```

### R7-3.10 C1 H5 / H3' 1024 bake resolution closeout

```
必讀：
  - `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md`
  - `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md`
  - `docs/superpowers/plans/2026-05-15-r7-3-10-c1-1024-bake-resolution-plan.md`
  - `Debug_Log.md` 的 `R7-3.10-c1-phase2-h5-h3-1024-bake-resolution-closeout`
  - `Debug_Log.md` 的 `R7-3.10-c1-phase2-second-knife-bprime-h7`
  - `Debug_Log.md` 的 `R7-3.10-c1-phase2-first-knife-h8-cprime`

目前狀態：
  - H8 runtime gate、C' bake UV、H7 exiting-hit guard、H7' camera-y guard 都已完成且不回退。
  - C runtime fallback 實驗已移除；不得重啟作為正式修法。
  - floor / north 皆已烤 1024，runtime pointer 皆指向 1024 package。
  - floor 1024 package：`assets/bakes/r7-3-10/c1-static-diffuse/floor-full-room-1024px-1000spp/`
  - north 1024 package：`assets/bakes/r7-3-10/c1-static-diffuse/north-wall-door-hole-1024px-1000spp/`
  - 512 pointer 備份：`.omc/r7-3-10-1024-pointer-backups/20260515-212327/`
  - 使用者肉眼確認：東北衣櫃底部南側、頂部北側兩條黑線在 1024 看不出來。
  - 1024 鎖為目前 floor / north 正式候選；2048 本輪不推進，因 north nearest interval 預估會相位退化。
  - partial bake + LIVE 的偏亮現象已定性為深度相加的過渡假象。
  - 驗收基準改為全相關靜態漫射面 bake vs 全 LIVE。
  - bake 防污染 Option A snapshot 已保留；Option B captureMode guard 已加，runtime smoke 數值不變。
  - 後續方向：往全相關靜態漫射面烘焙推進，減少 partial bake 與 LIVE 的交界。
```

### R7-3.10 C1 seam debug Phase 1 closeout

```
必讀：
  - `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md`
  - `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md`
  - `Debug_Log.md` 的 `R7-3.10-c1-seam-debug-phase1-step-f-complete`

目前狀態：
  - Phase 1 A / B / C / D / E / F 已完成。
  - H8 / H7 / H5 / H3' 成立，H1b 泛化 U 軸撤回，H4 由使用者多視角截圖正式排除。
  - 地板 package 回到 `.omc/r7-3-10-full-room-diffuse-bake/20260513-165203/`。
  - 北牆 package 回到 `.omc/r7-3-10-full-room-diffuse-bake/20260513-210338/`。
  - 東牆 package `.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` 先保留為歷史產物，runtime 暫不接入。
  - runtime 合併 atlas 目前只有兩格：地板、北牆。
  - UI 目前拆成兩顆按鈕：`地板烘焙：關 / 開`、`北牆烘焙：關 / 開`。
  - contact invalid region + flood-fill dilation 路線已判定退化，後續不要延續。
  - 失敗證據包：東牆 `20260513-221112`、地板 `20260513-222644`、北牆 `20260513-222958`。
  - Phase 2 設計已進入第一刀，請優先讀上方 Phase 2 first knife。
```

### R7-3 quick preview terminal fixed curve closeout

```
必讀：
  - `docs/SOP/R7：採樣演算法升級.md`
  - `Debug_Log.md` 的 `R7-3-quick-preview-terminal-v3`

目前狀態：
  - R7-3 已收尾。
  - R7-3 terminal fill 是 path shader reachedMaxBounces 補預覽光。
  - v1b / v2 顯示端補洞已 no-go。
  - v3j 拆掉 1~4SPP 可輸入欄位，改為 display-only 固定曲線。
  - v3al 預設 ON，R7-3 terminal fill 套用範圍已回到 C3-only；C4 保留丟可見 1SPP。
  - v3s 已新增 C3/C4 GIK vs wall 低 SPP 量測 helper。
  - v3t 已新增 C4-only GIK dark-only lift。
  - v3q 只恢復最小 ON/OFF 開關，給高 SPP 同場景 A/B 驗證；曲線輸入仍不恢復。
  - 高 SPP 驗收已過：使用者測 1000SPP，R7-3 ON / OFF 完全一樣。
  - 黑色物件保護先列觀察項，不實作；目前使用者沒有覺得深色物體被明顯抬亮。
  - 目前固定曲線：
      1SPP = 3.20
      2SPP = 1.70
      3SPP = 1.50
      4SPP = 1.25
      5SPP 起由 1.25 每次減半靠近 1.00
  - 使用者肉眼回報 C3 目前差不多，曲線暫收。
  - C4 同曲線已量到：mean ratio 只低約 3%~5%，但 GIK p50 明顯偏低、p90 已經很亮。
  - v3t 第二刀用 pre-terminal luma 當 dark gate，lift strength = 1.45。
  - v3t 量測：C4 GIK p50 2SPP 0.208→0.295、4SPP 0.281→0.309、8SPP 0.313→0.329；p90 幾乎不動。
  - v3u 依使用者肉眼回報，把 C4 wall terminal scale 設成 0.88、GIK dark lift strength 設成 2.10。
  - v3u 量測：C4 wall p50 約 0.464→0.456；C4 GIK p50 2SPP 0.295→0.318、4SPP 0.309→0.327、8SPP 0.329→0.337；p90 沒上升。
  - v3v 依使用者肉眼回報，把 C4 wall terminal scale 設成 0.78、GIK dark lift strength 設成 3.20。
  - v3v 量測：C4 wall p50 約 0.456→0.445~0.450；C4 GIK p50 2SPP 0.318→0.351、4SPP 0.327→0.350、8SPP 0.337→0.353；p90 沒明顯上升。
  - v3ah 依使用者修正，改看 C4 2~16SPP 全段，停止只用 2/4/8 代表前段。
  - v3ah 依使用者肉眼回報，拆掉多層 sample-specific gate 與 final front GIK boost，處理 2/3 牆面斷層與 GIK 前段過亮。
  - v3ah 實作：C4 wall terminal scale 0.58、GIK dark lift 3.60、low-luma lift 0.25，final wall 改成 smoothstep(2,8) 的平滑前段 gate。
  - v3ah 量測：2SPP wall/GIK p50 0.360/0.398；3SPP 0.359/0.405；4SPP 0.478/0.340；5SPP 0.373/0.406；6SPP 0.379/0.407。
  - v3ai 依使用者回報改成 C4 wall-only 調參：暫停 C4 GIK 專用 lift，移除 C4 wall post-luma bright gate、final 4SPP 特例、final front gate。
  - v3ai fresh-page 重測後，舊量測的 4SPP 凸點判定為量測流程污染；v3ai 牆面 p50 仍太平，2SPP 0.423、4SPP 0.421、16SPP 0.420。
  - v3aj 實作：C4 wall terminal scale 0.58→1.10，C4 wall terminal fade 改成 `1.0 / (1.0 + 1.60 * max(0.0, uSampleCounter - 2.0))`，先追牆面 2~16SPP 快速衰減曲線。
  - v3aj fresh-page 量測按 actualSamples 看：2SPP 0.482、4SPP 0.453、5SPP 0.448、6SPP 0.445、7SPP 0.442、9SPP 0.438、10SPP 0.436、12SPP 0.433、14SPP 0.431、16SPP 0.429、17SPP 0.428。
  - v3ak 依使用者要求把 C4 回到原本狀態：R7-3 terminal fill 改回 C3-only，shader 移除 C4 wall-only 曲線。
  - v3al 依使用者補充修正：C4 保留第一個可見畫格直接到 2SPP，C4 仍不套 R7-3 terminal fill。
  - v3k 未解的 S2 疑似吃到 S1 已在 v3l 找到根因並修正。
  - 根因是 first-frame recovery 連續 render S1~S4 時，R7-3 terminal uniform 在 path render 後才更新。
  - v3l 改成每個 sample render 前更新 R7-3 uniform。

最新未解：
  - C4 若未來再重試 terminal fill 曲線，需要另開新路線；v3al 目前以 C4 丟 1SPP、無 R7-3 曲線為準。
  - 黑色吸音板、喇叭、腳架的發灰保護。
  - 24SPP 後退場與 1024SPP 正式收斂守門。

下一步：
  - 使用者驗 C4 快速預覽前牆是否暗到位、GIK 是否亮到位，並看亮區是否過亮。
```

---

## 觸發式路由

### Shader / 材質 / hitType

```
讀：
  - `⚠ 必讀：通用 Debug 紀律`
  - `R2-14｜東西投射燈軌道底面黑線`
  - `R2-18｜ISO-PUCK 狀態洩漏`
  - `R2-18｜metalness 硬閾值 → Monte Carlo 機率分支`

適用：
  - 黑線、假孔洞、物件材質被前一個命中污染。
  - 新增 CylinderIntersect 或自訂 intersect。
  - 新增 metalness / roughness / 材質分支。
```

### 幾何 / X-ray / cullable

```
讀：
  - `R2-13｜X-ray 視角下結構體外延至牆外`
  - `R3-6｜Many-Light + MIS 整合收尾補丁` 的 fix05 / fix06
  - `R6-LGG-r30` 的窗外背板 X-ray fix

適用：
  - 透視剝離錯誤。
  - 天花板、地板、牆角、柱子外延或缺口。
  - 背景、窗外貼圖被錯誤剝離。
```

### Progressive accumulation / sampleCounter / 暫停單步

```
讀：
  - `R2-6｜MAX_SAMPLES 過曝`
  - `R2-11｜切換 Cam 殘影揮之不去`
  - `R2-8｜吸音板 Config 切換後殘留舊畫面`
  - `R7-snapshot-step-history-buttons`

適用：
  - sampleCounter 回退或未回退。
  - 暫停、下一個採樣、上一個採樣。
  - 改 UI 後畫面沒重算、或重算太多次。
```

### Camera preset / FOV / 透視比例

```
讀：
  - `R7-3｜滾輪縮放後切視角造成左右拉伸`
  - `R2-11｜切換 Cam 殘影揮之不去`

適用：
  - 滾輪縮放後按視角 1 / 2 / 3。
  - 畫面左右拉伸、水平比例怪、FOV 顯示恢復但畫面比例未恢復。
  - 切視角後相機位置正確，但 ray tracing 投影比例錯。

核心：
  - path tracer 不靠 three.js projection matrix。
  - FOV 改動必須同步更新 `uVLen` 與 `uULen`。
  - `uULen = uVLen * worldCamera.aspect`，少更新就會留下舊水平縮放。
```

### Cloud / C3 / C4 / MIS / PDF

```
讀：
  - `Cloud / GIK 名詞鎖定`
  - `R3-5b｜Cloud 漫射燈條 NEE 補漏四連翻車`
  - `R3-6｜Many-Light + MIS 整合收尾補丁`
  - `R6-3 Phase2｜Cloud visibility probe v4/v5 亮度回歸教訓`
  - `Cloud MIS weight probe`
  - `BSDF-hit terminal isolation v7`
  - `Forced BSDF-hit probe v8b`
  - `Natural BSDF-hit frequency probe v9`
  - `Direct NEE screen-band probe v10`
  - `Direct NEE top-band percentile probe v11`
  - `Direct NEE diffuseCount split probe v12`

適用：
  - Cloud 亮度變暗或變亮。
  - probe readback 怪值。
  - direct NEE / BSDF-hit / reverse MIS / PDF 契約。
  - C3 早期髒點與 direct NEE 亮尾端。

目前穩定結論：
  - Cloud GIK = 吊頂 6 片白色 GIK 吸音板；Cloud 燈條 / Cloud rod = 4 支 CLOUD_LIGHT 光源。
  - `gikPanel` 是 probe 分類，對應 ACOUSTIC_PANEL，可能包含牆面 GIK 與 Cloud GIK。
  - Cloud 抽樣名額正常。
  - direct NEE 權重健康。
  - v7 前 BSDF-hit 讀值受污染，不可再用。
  - 自然 BSDF-hit 在 C3/cam1 目前很稀有。
  - C3 早期髒感後來轉向 direct NEE 亮尾端、bounced-surface 與低 SPP coverage 問題。
```

### 快速預覽 / R6 movement protection / 移動期遮擋

```
讀：
  - `R6-LGG-J3｜借光 buffer 13 輪 debug`
  - `R6-3-Phase2-v19-first-frame-burst`
  - `R6-3-Phase2-v20-movement-protection` 到 `v22c`
  - `R7-2：光源 importance sampling 機率優化`
  - `R7-3-quick-preview-terminal-v3`
  - `R7-3｜C3/C4 快速預覽丟掉可見 1SPP 實驗`
  - C3 丟掉可見 1SPP 已由使用者回報手感可接受；原因是 1SPP 最髒，2SPP / 3SPP 較接近，且目前 FPS 本來就不高。

適用：
  - C3 / C4 快速預覽低 SPP 很髒。
  - 移動時黑幕、卡手、殘影、簡化模型閃爍。
  - 顯示端補洞或 history mix 類候選。
  - 想讓 C3 第一個可見畫格從 2SPP 開始。

重要 no-go：
  - R6 v20g / v20h 顯示端清理仍無法處理 4SPP 大面積樣本圖樣。
  - R6 v21a 拉高移動 samples 到 16 造成卡手與模糊。
  - R6 v22a deterministic preview 出現廉價簡化模型閃爍，預設已關。
  - R7-3 v1b / v2 顯示端補洞無效，已轉 path terminal。
```

### 光度 / 色溫 / 光源角度

```
讀：
  - `R3-4 fix07｜軌道燈 lumens slider 與輸出解耦`
  - `R3-6.5｜廣角燈 tilt 配置錯誤`
  - `R6-LGG-r30` 的 White Balance / Hue 章節

適用：
  - lm slider 無效或過曝。
  - 色溫、白平衡、色相、光源方向。
  - 廣角燈造成假陰影。

核心：
  - 光通量要對齊 radiometric 量綱。
  - 真實燈具數值不要靠對稱直覺猜，要查舊專案實測值。
```

### 貼圖 / 降噪 / edge marker

```
讀：
  - `R2-5 補完｜門貼圖實作 + 框架降噪導致所有貼圖模糊`
  - `R2-6｜喇叭貼圖水平方向被壓窄 + 白色角落`
  - `R2-12 GIK 吸音板側面 LOGO 穿幫`
  - `R2-13｜牆↔牆共邊 raw noise 永存`

適用：
  - 產品圖比例錯、白邊、LOGO 穿幫。
  - 貼圖表面被降噪糊掉。
  - 牆面共邊出現 raw noise。
```

---

## 歷史章節群

這些章節通常不需要接手時先讀，除非任務直接碰到對應區域。

```
R2 幾何與互動：
  - R2-3 牆面 Box 幾何
  - R2-4 攝影機 Preset 切換
  - R2-8 Config 切換殘留
  - R2-11 Cam 殘影、Bloom、samplesPerFrame UI
  - R2-13 牆面色差、共邊 raw noise、X-ray 外延
  - R2-15 / R2-17 燈具與 Cloud 可見幾何

R3 燈光與 MIS：
  - R3-1 uniform 宣告順序
  - R3-4 軌道燈量綱
  - R3-5b Cloud NEE
  - R3-6 / R3-6.5 Many-Light 與廣角燈 tilt
  - R3-7 / R4-3 追加 N-bounce 演進

R6 視覺收斂：
  - R6-LGG 借光、白平衡、per-config state
  - R6-3 Phase2 Cloud probe 全系列
  - R6 movement protection v19 到 v22c

R7 採樣升級：
  - R7-1 blue noise seed mix no-go
  - R7-2 light importance sampling 已驗收，但快速預覽主痛點未解
  - R7-3 quick preview terminal fixed curve 目前接手點
  - R7-Bake-Probe / R7-3.5 已排在 R7-4 ReSTIR、R7-5 path guiding 前；先驗高 SPP 表面光照輸出能否給快速預覽讀取
  - R7-3.8 C1 1000SPP bake capture 已建立 Codex runner、surface spec、512 atlas package；讀 `Debug_Log.md` 的 `R7-3.8-c1-1000spp-bake-capture-package`
  - R7-3.8 C1 floor-center paste preview 已把正式 atlas 貼回 C1 畫面；讀 `Debug_Log.md` 的 `R7-3.8-c1-bake-floor-patch-paste-preview`
  - R7-3.8 C1 diffuse-only paste fix 已移除 floor patch 內的 ceiling-lamp reflection spike，補休眠 framePending=false、keyboard idle、snapshot UI、1000SPP 顯示、floor roughness UI 驗證；後續使用者肉眼確認 350SPP 已難見界線、1000SPP 隱形，diffuse bake 架構通過 floor-center patch 驗收，反射另開處理線；讀 `Debug_Log.md` 的 `R7-3.8-c1-bake-diffuse-paste-fix1`
  - R7-3.8 C1 嫩芽成功版已覆蓋為「diffuse bake + 可用 floor roughness UI」版本；右緣對齊手動存圖，數字欄不壓住滑桿，成功 tag `r7-3-8-c1-diffuse-bake-success-20260511` 代表這個恢復版；讀 `Debug_Log.md` 的 `R7-3.8-c1-diffuse-bake-sprout-ui-recovery`
  - R7-3.10 C1 full-room diffuse bake 已完成 Phase 2 第一刀 H8 / C'、第二刀 H7、第三刀 H7'，並以 1024 bake resolution 收斂 H5 / H3' 兩條衣櫃黑線；現況先讀 `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md`、`docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md` 與 `Debug_Log.md` 的 `R7-3.10-c1-phase2-h5-h3-1024-bake-resolution-closeout`。
  - R7-3.10 static bake expansion 已完成 east wall hotfix：舊 east package 全黑已換成 `assets/bakes/r7-3-10/c1-static-diffuse/east-wall-1024px-1000spp/`，runtime baked diffuse short-circuit 限制為 `bounces == 0`，secondary / LIVE 反彈維持 live path tracing；讀 `Debug_Log.md` 的 `R7-3.10-static-bake-expansion-east-wall-hotfix` 與 `R7-3.10-static-diffuse-bake-asset-migration`。
  - R7-3.10 floor toggle 已接管舊 R7-3.8 嫩芽 paste：三個烘焙都關代表全 LIVE；地板烘焙開只使用 R7-3.10 floor 1024 bake；north / east 開關不會啟用嫩芽 paste。讀 `Debug_Log.md` 的 `R7-3.10-floor-toggle-unifies-sprout`。
  - R7-3.10 west wall static diffuse bake 已加入：`assets/bakes/r7-3-10/c1-static-diffuse/west-wall-iron-door-hole-1024px-1000spp/`，第 4 個 runtime atlas slot，UI 新增 `西牆烘焙`，floor / north / east 回歸通過；讀 `Debug_Log.md` 的 `R7-3.10-west-wall-static-diffuse-bake-expansion`。
  - R7-3.10 south wall window reveal fix 已加入：南牆窗洞 front rim 與四個 reveal 切面都進入正式 south wall 1024/1000spp package，所有 bake toggles 預設為開，烘焙按鈕開啟時維持黑灰底加發光；讀 `Debug_Log.md` 的 `R7-3.10-south-wall-window-rim-and-bake-button-style-fix` 與 `R7-3.10-south-wall-window-reveal-and-default-on`。
  - R7-3.10 ceiling static diffuse bake 已加入：`assets/bakes/r7-3-10/c1-static-diffuse/ceiling-full-room-1024px-1000spp/`，第 6 個 runtime atlas slot，UI 新增 `天花板烘焙` 且預設開；讀 `Debug_Log.md` 的 `R7-3.10-ceiling-static-diffuse-bake-expansion`。
  - R7-3.10 south wall window opening seam debug 已修正：南牆主面窗洞排除改成真實 reveal 開口 `x -1.75..0.69 / y 1.04..2.905`，移除窗洞上方與東側不存在前平面造成的黑線，南牆 1024/1000spp package 已重烘；讀 `Debug_Log.md` 的 `R7-3.10-south-wall-window-opening-seam-debug`。
  - R7-3.10 south wall reveal atlas edge fix 已加入：reveal atlas 邊界改吃進半格 texel 並把烘焙位置推入窗洞深度，右側與上側 room-edge 黑線的正式 south atlas luma 由 0 補到 0.21+；讀 `Debug_Log.md` 的 `R7-3.10-south-wall-reveal-atlas-edge-fix`。
  - R7-3.10 floor east/west contact edge fix 已加入：地板在 `x = ±1.91` 的 side contact 欄位改由一格內側位置烘焙，正式 floor atlas luma 由 0 補到 0.40+；讀 `Debug_Log.md` 的 `R7-3.10-floor-east-west-contact-edge-fix`。
  - R7-3.10 beam / column bake expansion branch 已開：從 GitHub 同步後的 main `2d79953` 開 `codex/r7-3-10-beam-column-bake-expansion`，下一步只處理樑柱，不混入家具或吸音板；讀 `Debug_Log.md` 的 `R7-3.10-beam-column-bake-expansion-branch-open`。
  - R7-3.10 beam / column static diffuse bake 已完成：新增 `assets/bakes/r7-3-10/c1-static-diffuse/structural-beams-columns-1024px-1000spp/`，targetId `1007`，runtime 第 7 slot，UI 新增 `樑柱烘焙` 且預設開；東樑與東南扁柱接點改為 `se_column_north_z` 整面連續 island，反射維持 LIVE；讀 `Debug_Log.md` 的 `R7-3.10-beam-column-static-diffuse-bake`。
  - R7-3.10 beam / column southeast column contact padding fix 已加入：`se_column_north_z` 東樑接觸 texel 由黑值補成同面可見邊烘焙值，structural 1024/1000spp 包已重烘，六面既有包維持原指標；讀 `Debug_Log.md` 的 `R7-3.10-beam-column-se-column-contact-padding-fix`。
  - R7-3.10 east wall southeast column contact edge fix 已加入：東牆 `z=2.49` 接觸欄位由黑值補成東牆同面可見側烘焙值，正式 east-wall 1024/1000spp 包已更新；讀 `Debug_Log.md` 的 `R7-3.10-east-wall-southeast-column-contact-edge-fix`。
  - R7-3.10 southeast column shadow-preserving contact refinement 已加入：前兩個 contact padding 的寬補法會讓東樑陰影變短矩形；新版改成 structural rect-scaled two-texel contact band 與東牆 0.25 texel visible-side source，深處遮蔽 texel 維持 0，正式 structural 與 east-wall 包已重烘；讀 `Debug_Log.md` 的 `R7-3.10-southeast-column-shadow-preserving-contact-refinement`。
  - R7-3.10 keyboard movement frame-time clamp 已加入：W / A / S / D / E / C 不再直接吃 raw frameTime，render frame 偶發延遲時會限制單幀位移；讀 `Debug_Log.md` 的 `R7-3.10-keyboard-movement-frame-time-clamp`。
  - R7-3.10 south window front-edge runtime guard 已加入：前一版 lower reveal atlas gap 只修到 audit 點，使用者刷新後黑線仍在；新版把南窗洞口前緣的 south-wall front-plane hole-edge hit 轉交 reveal bake，並把 UV 夾進一個 texel；讀 `Debug_Log.md` 的 `R7-3.10-south-window-front-edge-runtime-guard-fix`。
  - R7-3.10 south window reveal-corner runtime clamp 已加入：使用者修正目標為南牆窗洞下緣與側邊的 90 度內角；side reveal 下排 valid texel 為黑，runtime reveal UV 已夾進一個 texel，並新增近距離視覺 helper；讀 `Debug_Log.md` 的 `R7-3.10-south-window-reveal-corner-runtime-clamp-fix`。
  - R7-3.10 structural shadow linear reconstruction 已被使用者同視角判定 no-go：runner pass 只代表舊腳本視角，東樑打在東牆的陰影與冷氣打在東南扁柱的陰影仍需同視角重查；讀 `Debug_Log.md` 的 `R7-3.10-structural-shadow-linear-reconstruction`。
  - R7-3.10 camera pose INFO 已加入：畫面會顯示可複製 `cameraState / forward / view`，後續處理東牆與東南扁柱陰影必須先用使用者貼回的 `cameraState` 重現同一視角；讀 `Debug_Log.md` 的 `R7-3.10-camera-pose-info-for-same-view-shadow-debug`。
  - R7-3.10 camera pose replay 已修正：舊 INFO 的 `forward` 可信，但 `cameraState.yaw/pitch` 可能無法回放實際 camera matrix；新版 `cameraState` 內含 `forward`，回放時以 `forward` 反推 yaw/pitch，並新增 viewport 行；讀 `Debug_Log.md` 的 `R7-3.10-camera-pose-replay-forward-fix`。
  - R7-3.10 east wall shadow chart-aware reconstruction 第一版未通過更近同視角；真正近距離問題在東樑底面 `y=2.515` 附近的東牆 atlas 亮度台階，已改成東牆 slot 2 chart-clamped 3x3 tent reconstruction，cache token `r7310-east-wall-tent-reconstruct-v1`；讀 `Debug_Log.md` 的 `R7-3.10-east-wall-beam-shadow-tent-reconstruction`。
  - R7-3.10 east wall same-view guard texel fix 已加入：東牆正式 atlas 在 `z=2.49` / `y=2.515` 旁的 guard texel 由 0 補為相鄰可見東牆值，runtime 改用完整 rect + Tent3；同視角 1000 samples 已輸出 baked ON / OFF 成對截圖；讀 `Debug_Log.md` 的 `R7-3.10-east-wall-same-view-guard-texel-fix`。
  - R7-3.10 east-beam same-view structural bookshelf overlap fix 是舊候選：使用者否決前一版後，四向同視角隔離指出來源在 structural slot 6；`se_column_inner_x` 誤收東南書櫃貼合遮住區，導致 hidden black texel 被近距離重建吃到；已加入 bookshelf overlap exclude、bake/runtime guard、hidden texel guard-fill，並以使用者相機輸出同視角 baked ON / all-bakes-OFF 證據；讀 `Debug_Log.md` 的 `R7-3.10-east-beam-same-view-structural-bookshelf-overlap-fix`。
  - R7-3.10 east-beam same-view structural linear sampling fix 是舊候選：使用者新紅框相機證明前一個東南書櫃判讀不適用；runtime probe 命中 structural island 4 `east_beam_under_y` 與 island 8 `se_column_north_z`，未命中家具；guard-fill + 6px Tent 會洗掉窄陰影，structural slot 6 改回 rect-local linear sampling，並以同相機 1000 samples 裁紅框 ON/OFF 證據自查；讀 `Debug_Log.md` 的 `R7-3.10-east-beam-same-view-structural-linear-sampling-fix`。
  - R7-3.10 se-column north hybrid all-bakes guard 是目前最新修正：使用者用全開 UI 發現亮度爆高與舊小階梯殘留，根因是 slot 7 hybrid first hit 之後又落入 slot 6 structural short-circuit；已加 `!r7310SeColumnNorthHybridFirstHit` guard 並用使用者相機輸出全開 1000 samples 證據；讀 `Debug_Log.md` 的 `R7-3.10-se-column-north-hybrid-all-bakes-guard`。
	  - R7-3.10 se-column west hybrid indirect bake 已比照北面加入並由使用者口頭判定成功：`c1_se_column_west_shadow` 使用 targetId `1009`、runtime slot `8`，只烘 indirect diffuse，direct shadow 與 reflection 留 live path tracing；書櫃遮住區排除，正式 1024/1000spp package 與同視角 helper 已輸出；讀 `Debug_Log.md` 的 `R7-3.10-se-column-west-hybrid-indirect-bake`。
	  - R7-3.10 south wall AC shadow hybrid indirect bake 已加入：`c1_south_wall_ac_shadow` 使用 targetId `1010`、runtime slot `9`，南牆冷氣陰影區只烘 indirect diffuse，direct shadow 與 reflection 留 live path tracing；南窗洞排除，正式 1024/1000spp package 與同視角 helper 已輸出；讀 `Debug_Log.md` 的 `R7-3.10-south-wall-ac-shadow-hybrid-indirect-bake`。
	  - R7-3.10 west beam shadow mirror hybrid indirect bake 已加入：`c1_sw_column_north_shadow` 使用 targetId `1012`、runtime slot `11`，`c1_west_wall_beam_shadow` 使用 targetId `1013`、runtime slot `12`，兩者都只烘 indirect diffuse，direct shadow 與 reflection 留 live path tracing；西牆鐵門洞排除，正式 1024/1000spp package 與同視角 helper 已輸出；第一次西側結果曾因漏接 `r7310C1BakeSurfacePoint` 的 1012 / 1013 分支而烘出錯誤畫面，目前已修正並重烘；讀 `Debug_Log.md` 的 `R7-3.10-west-beam-shadow-mirror-hybrid-indirect-bake` 與 `R7-3.10-west-beam-shadow-bake-point-fix`。
	  - R7-3.10 beam/column dedicated hybrid upgrade 已加入：東西牆維持現況，新增 `c1_sw_column_inner_shadow`、`c1_west_beam_inner_shadow`、`c1_west_beam_under_shadow`、`c1_east_beam_inner_shadow`、`c1_east_beam_under_shadow` 五個 dedicated indirect-diffuse target，targetId `1014..1018`、runtime slot `13..17`，runtime atlas patch count `18.0`；五包正式 1024/1000spp 重烘通過且污染快照 dirtyModes=0。後續全開變黑已修正為 6x3 runtime atlas grid，避免 18 x 1024 橫向貼圖超過常見 WebGL 上限；讀 `Debug_Log.md` 的 `R7-3.10-beam-column-dedicated-hybrid-upgrade` 與 `R7-3.10-beam-column-dedicated-hybrid-runtime-atlas-grid-fix`。
	  - R7-3.10 beam under-shadow Phase 1 probe 已證明 `c1_west_beam_under_shadow` 與 `c1_east_beam_under_shadow` 都打到既有 visible underside hybrid route；不需 corrected target 或重烘，後續若肉眼仍覺得不對，先當視覺匹配/陰影平滑度問題查；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase1-beam-under-shadow-probe`。
	  - R7-3.10 south window reveal dedicated hybrid Phase 2 已加入且使用者確認成功：南窗 left / right / bottom / top reveal 改成 targetId `1019..1022`、runtime slot `18..21`，只烘 indirect diffuse，direct shadow 與 reflection 留 live path tracing；front rim / opening edge 轉交最近 reveal target，runtime atlas 改成 22 槽、6x4 grid，南牆按鈕會同步切換四個新 target；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2-south-window-reveal-hybrid`。
	  - R7-3.10 Phase 2B 南窗西側切面與西南柱東面連續性 v2 亮度改善後仍被使用者指出西樑像矩形戳進西南柱；最新修正把西樑幾何與 west_beam_inner_x ownership 截到 `zMax=2.848`，讓 `sw_column_upper_inner_coplanar_x` 回到 `sw_column_inner_x`，並同步重烘 `west-beam-inner-shadow`、`sw-column-inner-shadow`、`structural-beams-columns`。同視角 probe `continuityMeanDelta=-0.006790035322859128`、`westBeamContinuityMeanDelta=-0.011225053869436202`，驗證網址更新為 `http://localhost:9002/Home_Studio.html?v=r7310-phase2b-l-union-material-v6`；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2b-west-beam-sw-column-l-union-fix`。
	  - R7-3.10 Phase 2B 西樑底面與西南柱北面交界已收斂到 v5：使用者更正 LIVE 乾淨，剩餘問題只在烘焙路徑；最新修正把 `sw-column-north-shadow` 可見烘焙範圍截到 `yMax=2.525`、`west-beam-under-shadow` 截到 `zMax=2.846`，同步 structural island contract 並重烘三包。使用者指定視角最新 baked 截圖已無黑線或縫隙，斜向暗帶由使用者判定為正常陰影，驗證網址更新為 `http://localhost:9002/Home_Studio.html?v=r7310-phase2b-l-gap-closure-v5`；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2b-west-beam-under-sw-column-north-gap-closure`。
	  - R7-3.10 Phase 2B 西牆 / 西樑 / 西南柱近距離矩形馬賽克陰影已修正：根因分別是 `c1_west_wall_beam_shadow` 高 z 隱藏 texel 與完整 `c1_west_wall` 西南角隱藏 texel 被 bilinear 取樣拉進可見陰影。已加 `fillR7310C1WestWallBeamShadowGuardTexels()` 與 `fillR7310C1WestWallSouthwestGuardTexels()`，重烘 `west-wall-beam-shadow`、`west-wall` 1024/1000spp；同視角診斷包 `.omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-004702/`，驗證網址更新為 `http://localhost:9002/Home_Studio.html?v=r7310-phase2b-west-wall-mosaic-guard-v1`；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2b-west-wall-closeup-mosaic-guard`。
	  - R7-3.10 Phase 2B 西牆近距離馬賽克陰影第二次修正：使用者新同視角指出 guard-fill 仍留下直接光烘焙像素；根因是紅框區仍落入舊 `c1_west_wall` full diffuse short-circuit。最新修正讓 `c1_west_wall_beam_shadow` 接管完整 west wall runtime surface，只烘 indirect diffuse，direct light / direct shadow 留 LIVE，並重烘 `west-wall-beam-shadow` 1024/1000spp；同視角診斷包 `.omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-012349/`，驗證網址更新為 `http://localhost:9002/Home_Studio.html?v=r7310-phase2b-west-wall-live-direct-v1`；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2b-west-wall-live-direct-ownership`。
	  - R7-3.10 Phase 2B 西牆近距離黑色矩形已歸因為 half-loaded diagnostic capture：舊 all-on 截圖在 `westWallBeamShadow`、`swColumnInnerShadow`、`westBeamInnerShadow`、`westBeamUnderShadow` 仍 pending 且 uniforms=0 時拍下；最新修正讓 `waitForR7310C1FullRoomDiffuseRuntimeReady()` 必須等 enabled packages 全 ready，並新增 westJoin probe 22..26。嚴格等待後同視角包 `.omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-035138/` 目標 crop 黑像素與 dark 像素皆為 0，另有 `.omc/r7-3-10-west-wall-mosaic-diagnostic/20260520-033811/` 與 `20260520-033819/` 作西南柱與西牆大面積覆核；驗證網址更新為 `http://localhost:9002/Home_Studio.html?v=r7310-phase2b-west-wall-strict-ready-v1`；讀 `Debug_Log.md` 的 `R7-3.10-bake-gap-and-loading-debug-map-phase2b-west-wall-strict-ready-guard`。
	  - R7-3.10 東北家具 bed / wardrobe 牆面烘焙變體已加入：根因是 C2 家具幾何可切換，但北牆 slot 1 與東牆 slot 2 只有單一 HYBRID atlas，導致 bed / wardrobe 互留遮蔽殘影。新增 wardrobe 版北牆與東牆 1024/1000spp package、`--r7310-ne-furniture=bed|wardrobe` runner 參數、runtime atlas variant switch，以及瀏覽器切換驗證 `.omc/r7-3-10-ne-furniture-runtime/20260521-015323/`；讀 `Debug_Log.md` 的 `R7-3.10-ne-furniture-wall-bake-variants`。
	  - R7-3.10 東北家具 east wall beam-shadow 覆蓋圖變體已加入：使用者新同視角證明 bed 狀態仍有衣櫃形殘影，根因是主東牆 slot 2 已可切換，但 `c1_east_wall_beam_shadow` runtime slot 10 仍吃單一舊 atlas。已新增 slot 10 bed / wardrobe 指標與 runtime selection，重烘 `east-wall-beam-shadow` 與 `east-wall-beam-shadow-wardrobe` 1024/1000spp；同視角驗證包 `.omc/r7-3-10-east-wall-beam-shadow-live-match/20260521-023747/`，驗證網址更新為 `http://localhost:9002/Home_Studio.html?v=r7310-ne-furniture-east-overlay-variant-v1`；讀 `Debug_Log.md` 的 `R7-3.10-ne-furniture-east-wall-beam-shadow-variant-fix`。
	  - R7-3.9 C1 reflection bake 已清回純漫射 runtime：`.omc/r7-3-9-c1-accurate-reflection-bake/` 與 preview 產物移除，pointer 狀態為 `none`，runtime 預設不載入 R7-3.9 反射；讀 `Debug_Log.md` 的 `R7-3.9-c1-reflection-bake-reset-to-diffuse-only`
  - R7-3.9 C1 reflection bake 新 SOP 已改成官方依據版本：平面反射需反射視點或等價幾何，SSR 只依當前畫面，ray tracing 可取畫面外資料，CubeCamera 只代表特定 3D 位置；讀 `docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md`
  - R7-3.9 C1 舊 sprout-only package `.omc/r7-3-9-c1-accurate-reflection-bake/20260512-134902/` 已判定為 camera-space reference，不是 runtime 可接受反射包；後續必須改走 surface position + outgoing direction 或 true planar reflection pass。
  - R7-3.9 C1 surrounding floor roughness 0.1 live reflection fix 與 roughness gate fix 都已被 reset 收攏成歷史紀錄；目前畫面基準只保留 R7-3.8 C1 嫩芽純漫射 bake。
  - R7-3.9 C1 large-floor reflection cache double-division fix 只保留為歷史紀錄；`.omc/r7-3-9-c1-accurate-reflection-bake/20260511-235900/` 已不可用，後續不得沿用此路線；讀 `Debug_Log.md` 的 `R7-3.9-c1-floor-reflection-cache-double-division-fix`
  - R7-3.9 Config 1 current-view sprout V2 已被 1SPP A/B 肉眼驗收推翻；A 漫射乾淨，B 原V2 與 C 反射同樣 noisy，D 證明中央只是被固定 roughness 0.1。讀 `Debug_Log.md` 的 `R7-3.9-config1-sprout-v2-ab-invalidated`。
  - R7-3.9 Config 1 current-view sprout reflection route 曾只在 validation helper 內啟用，後續又漏 startup uniform sync；這些只屬於診斷歷史，不能當 V2 成功證據。
  - R7-3.9 Config 1 current-view preview 預設 true 後仍漏了啟動 uniform 同步，手動畫面會保持 `uR739C1CurrentViewReflectionMode = 0`；已在 `initTHREEjs()` 補同步，讀 `Debug_Log.md` 的 `R7-3.9-config1-current-view-sprout-reflection-startup-uniform-sync-fix`。
```

---

## 寫回規則

```
1.  新增量測或使用者回報數字：
    寫進目前 R 階段 MD 與 `Debug_Log.md`。

2.  新 no-go：
    寫進目前 R 階段 MD、`Debug_Log.md`，並在本索引對應路由補一句。

3.  新常見地雷：
    若是跨階段規則，補到本檔「永久必讀」或對應觸發式路由。

4.  單次工具輸出、暫存 PNG、CDP JSON：
    放總帳章節即可，索引只留結論與讀取入口。
```
