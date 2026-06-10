# 全房間接觸邊人工候選清單 contact-edge-inventory

> 交付物 1／3（OPUS 2026-06-03）。本檔先列出人工候選接觸邊，**不改 shader**。
> 來源：shaders/Home_Studio_Fragment.glsl 的 `r7310C1RuntimeSurfaceIs*` / `*DiffuseUv` gates、
> js/InitCommon.js 的 `R7310_C1_*_WORLD_BOUNDS` / 各 `*_RUNTIME_PACKAGE_URL` / 排除常數、以及前次全域稽核。
> 重要定位：本檔是人工候選清單，供第 15 章 full-room Python／Blender 自動掃描對表使用。
> 自動掃描結果可新增、刪除或修正本檔條目；最終 registry 以自動掃描 + CODEX 審查後的結果為準。
> 「驗收相機」欄：已坐實者填實際相機，其餘填建議方向並標「待定」（誠實標示，尚未逐條拍過）。
> 風險等級：高＝已見或極可能黑線；中＝潛在／僅特定 package 或視角；低＝稽核已確認 owner 一致。

座標慣例：x 左右、y 上下(0=地板,2.905=天花板)、z 北(-1.874)→南(3.056)。單位公尺。

---

## A. 北牆 z=-1.874（plane x[-2.11,2.11] y[0,2.905]，slot1，first-hit hybrid）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| A1 | 北牆 ↔ 西樑北端 (west beam gap) | x[-1.908,-1.752] y[2.525,2.905] z=-1.874 | 北牆 first-hit hybrid／西樑結構 island 1,2／west-beam-inner/under-shadow | d800-north-denoise-c（非方格）｜square combined slot1 | **使用者驗收相機**（見 west-beam-north-contact-probe.json）pos(-1.7087,2.8269,-1.8201) | **高（已坐實黑線）** |
| A2 | 北牆 ↔ 東樑北端 (east beam gap) | x[1.850,1.908] y[2.516,2.905] z=-1.874 | 北牆 hybrid／東樑結構 island 3,4／east-beam-inner/under-shadow | 同 A1 | NE 上角貼北牆往上看（待定，鏡像 A1） | 高（鏡像，疑同缺陷） |
| A3 | 北牆 ↔ 西側牆背 | x≤-1.91（westXMax）y[0,2.905] | 西側牆 | square slot1（被 side-wall gate 排除→side wall） | NW 牆角正面（待定） | 中 |
| A4 | 北牆 ↔ 東側牆背 | x≥1.91（eastXMin） | 東側牆 | 同 A3 | NE 牆角正面（待定） | 中 |
| A5 | 北牆 ↔ 木門洞 reveal | x[-1.52,-0.73] y[0,2.03] | 北牆 gate 排除門洞→木門 reveal／live | 木門 reveal | 門洞正面（待定） | 中 |

> **A1 最新實測（以 source.md 第 16 章為準）**：
> 舊版「owner 1002 atlas 邊緣 dip」判讀已淘汰。第 16 章 x-sweep 實測顯示：
> 西樑 baked 面（owner 1015，route west_beam_inner_shadow_hybrid，luma 約 0.097–0.105）
> 緊鄰一條北牆位置的 `route=none / ownerCount=0 / luma=0` 未認領帶。
> A1 目前狀態＝黑線已坐實；根因以「未認領帶」為最新事實；ownerPolicy 仍待第 15 章全域 registry 與三來源對帳後定案。

## B. 東牆 x=1.91（plane z[-1.874,3.056] y[0,2.905]，slot2，hybrid＋非方格）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| B1 | 東牆 ↔ 東樑 (beam handoff y≥2.515) | z[-1.874,2.49] y[2.515,2.905] x=1.91 | 東牆 hybrid／east-wall-beam-shadow(1011)／東樑 island 3,4 | east-wall-beam-shadow｜d800 east 非方格 | 室內往東上看（待定） | 中 |
| B2 | 東牆 ↔ 東南柱 (SE col handoff z≥2.49) | z[2.49,3.056] y[0,2.905] x=1.91 | 東牆 hybrid／se-column-north-shadow(1008)／se-column-west-shadow(1009) | se-column-* shadow | 室內往東南掠角（待定） | 中 |

## C. 西牆 x≈-1.91（plane z[-1.874,3.056] y[0,2.905]，slot3）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| C1 | 西牆 ↔ 西樑 (beam handoff y≥2.515；gate z≥2.7179／bake dead-zone z≥2.846 雙值) | z[-1.874,2.846] y[2.515,2.905] x=-1.91 | 西牆 hybrid／west-wall-beam-shadow(1013)／西樑 island 1,2 | west-wall-beam-shadow｜west-wall slot3 | 室內往西上看（待定） | 中（雙值隱患） |
| C2 | 西牆 ↔ 西南柱 (SW col handoff z≥2.7179) | z[2.7179,3.056] y[0,2.905] x=-1.91 | 西牆 hybrid／sw-column-north-shadow(1012)／sw-column-inner-shadow(1014) | sw-column-* shadow | 室內往西南掠角（待定） | 中 |
| C3 | 西牆／鐵門洞 reveal ↔ 牆面 | x[-1.96,-1.91] y[0.09,2.04] z[-1.874,-0.984] | iron-door-reveal(slot22)／live | iron-door-reveal | 貼近鐵門 reveal（已掃，乾淨） | 低-中 |

## D. 南牆 z=3.056（plane x[-2.11,2.11] y[0,2.905]，slot4，short-circuit plain sampler）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| D1 | 南牆 ↔ 西南柱背 | x[-1.91,-1.75] y[0,2.905] z=3.056 | 南牆 short-circuit／sw-column／live（柱遮擋） | south-wall slot4 | 南牆 SW 掠角（已掃，柱遮多屬潛在） | 中 |
| D2 | 南牆 ↔ 東南柱背 | x[1.78,1.91] y[0,2.905] z=3.056 | 南牆／se-column／live | south-wall slot4 | 南牆 SE 掠角（已掃） | 中 |
| D3 | 南牆 ↔ 窗洞 reveal（左/右/上/下 4 切面） | 窗洞 x[-1.75,0.69] y[1.04,2.905]；reveal 帶見 shader SouthWallWindowReveal | south-window-left/right/bottom/top-reveal-shadow(1019-1022) | 對應 4 個 reveal package | 貼近窗洞 reveal（待定逐切面） | 中 |
| D4 | 南牆 AC 陰影面 ↔ 側柱背 | 同 D1/D2（SW x[-1.91,-1.75]、SE x[1.78,1.91] y[0,2.905]） | south-wall-ac-shadow(slot9/1010) | south-wall-ac-shadow | 同 D1/D2（僅 AC shadow 啟用時） | 中（潛在炸彈） |

## E. 天花板 y=2.905（plane x[-2.11,2.11] z[-2.074,3.256]，slot5）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| E1 | 天花板 ↔ 西樑頂 (occluder footprint) | x≤-1.75 z[-1.874,3.056] y=2.905 | 天花板 gate 排除 footprint→西樑 island／live | ceiling slot5／structural | 上看西樑牆（已掃，乾淨） | 低 |
| E2 | 天花板 ↔ 東樑頂 | x≥1.85 z<2.49 y=2.905 | 天花板排除→東樑／live | ceiling／structural | 上看東樑牆（已掃，乾淨） | 低 |
| E3 | 天花板 ↔ 東南柱頂 | x≥1.78 z≥2.49 y=2.905 | 天花板排除→SE 柱／live | ceiling／structural | 上看 SE 柱（待定） | 低 |

## F. 地板 y=0.01（plane x[-2.11,2.11] z[-2.074,3.256]，slot0）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| F1 | 地板 ↔ 北/東/南/西牆腳 | 四牆 x=±1.91／z=-1.874,3.056 與 y=0 交線 | 地板 slot0／各牆 | floor slot0 | 低角度各牆腳（NW 已掃乾淨，其餘待定） | 低 |
| F2 | 地板 ↔ 家具 footprint（東北床/衣櫃、南櫃、木門/鐵門腳） | 各家具底面（家具目前為 LIVE，非 baked） | 地板 slot0／live 家具 | floor slot0（家具不烤） | 低角度家具腳（待定） | 低-中 |

## G. 結構樑柱專用陰影面（本身即接觸邊 bake，slot6 + 1008-1018）

| # | 接觸邊名稱 | 世界座標範圍 | 可能 owner | 可能 baked package | 驗收相機 | 風險 |
|---|-----------|-------------|-----------|-------------------|---------|------|
| G1 | 西樑 inner +X 面（island 1） | x[-1.760,-1.740] y[2.525,2.905] z[-1.874,2.848] | structural slot6 island 1／west-beam-inner-shadow(1015) | structural｜west-beam-inner-shadow | 室內往西樑內側（待定） | 中 |
| G2 | 西樑底 -Y 面（island 2）／under shadow | y[2.515,2.535] x[-1.91,-1.75] z[-1.874,2.846] | island 2／west-beam-under-shadow(1016) | west-beam-under-shadow | 上看西樑底（待定） | 中 |
| G3 | 東樑 inner -X 面（island 3）／inner shadow | x[1.840,1.860] y[2.515,2.905] z[-1.874,2.49] | island 3／east-beam-inner-shadow(1017) | east-beam-inner-shadow | 室內往東樑內側（待定） | 中 |
| G4 | 東樑底 -Y 面（island 4）／under shadow | y[2.505,2.525] x[1.85,1.91] z[-1.874,2.49] | island 4／east-beam-under-shadow(1018) | east-beam-under-shadow | 上看東樑底（待定） | 中 |
| G5 | 西南柱 north 面 shadow | z[2.838,2.858] x[-1.91,-1.75] y[0,2.525] | sw-column-north-shadow(1012)／island 6 | sw-column-north-shadow | 室內往西南柱北面（已部分驗，舊紀錄乾淨） | 中 |
| G6 | 西南柱 inner +X 面／west 樑柱 L 交界 | island 5 x[-1.760,-1.740] y[0,2.905] z[2.846,3.056] | sw-column-inner-shadow(1014)／island 5 | sw-column-inner-shadow | 西樑↔西南柱 L 交界（舊紀錄已修） | 中 |
| G7 | 東南柱 north 面 shadow | z[2.480,2.500] x[1.78,1.91] y[0,2.905] | se-column-north-shadow(1008)／island 8 | se-column-north-shadow | 室內往東南柱北面（待定） | 中 |
| G8 | 東南柱 inner -X 面 shadow | x[1.770,1.790] y[0,2.905] z[2.49,3.056] | se-column-west-shadow(1009)／island 7 | se-column-west-shadow | 室內往東南柱內面（待定） | 中 |

---

## 統計與重點

```
人工候選接觸邊總數：本清單 28 條（A5 + B2 + C3 + D4 + E3 + F2 + G8）。
最終接觸邊總數：待第 15 章 Python／Blender full-room 自動掃描後決定；可能高於或低於 28。
非方格 atlas 只支援 slot1(北牆)、slot2(東牆)（shader r7310C1NonSquareAtlasSlotSupported）→
  非方格相關風險集中在北牆/東牆，A1/A2/B1 為首要。
高風險：A1（第 16 章已坐實未認領帶）、A2（鏡像疑同）。
潛在炸彈：D4（AC 陰影面側柱背，平時可能隱形）。
雙值隱患：C1（西牆 2.7179 gate / 2.846 bake）。
舊掃描曾通過（broad-sweep，仍需用「局部亮度落差」重驗，非純黑）：E1、E2、C3、F1(NW)、G5、G6。
```

## 缺口（誠實標示，後續要補）

```
1. 「驗收相機」多數為「待定」——除 A1 用使用者相機外，其餘尚未逐條拍過固定相機，須在 seam-validation-matrix 補。
2. 家具 footprint（F2）家具為 LIVE、未烤；接觸定義較鬆，須確認是否需專面。
3. owner 欄列「可能 owner」，真正 single-owner 判定要靠 probe（見交付物 2）逐點坐實，不能只靠本清單推測。
4. 本清單尚未由 full-room Python／Blender 自動掃描驗證。第 15 章必須產出 autoOnly、manualOnly、coordinateMismatch 三類差異表。
```
