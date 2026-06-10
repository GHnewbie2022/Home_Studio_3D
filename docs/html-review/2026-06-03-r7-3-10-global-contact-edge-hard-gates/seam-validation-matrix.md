# 接觸邊驗收矩陣 seam-validation-matrix

> 交付物 3／3（OPUS 2026-06-03）。定義每條接觸邊「怎麼驗、用哪個相機、看哪個數字、通過標準」。
> 本檔修正凌晨驗證的三個錯：(1) 沒用使用者相機 (2) seam metric 寫死座標 (3) line-scan 只抓純黑。
> **不改 shader。**

---

## 0. 偵測方法改版：局部亮度落差（取代純黑門檻）

凌晨工具用「luma < 0.06 純黑」判定，使用者實際看到的是**局部暗縫**（量到 line luma≈0.05~0.07、鄰側≈0.16，
落差約 0.09，但都不是純黑）→ 工具漏判。新偵測：

```
對接觸邊在「驗收相機」下的螢幕投影縱列帶（涵蓋該邊的 y 範圍）：
  localDelta(x) = median(luma 於 x±[6..12] 的鄰列) − luma(x)
  暗縫 FAIL：存在某 x，使 localDelta(x) ≥ 0.04 且該暗值在邊高度方向連續 ≥ 20 列
  亮邊 FAIL：存在某 x，使 localDelta(x) ≤ −0.04（比鄰列更亮）同上連續條件
  縫隙 FAIL：localDelta 跨邊出現雙峰（暗-亮-暗）或不連續斷裂
通過：整條邊的 |localDelta| 峰值 < 0.04（無持續暗/亮窄列）。
```

### 0.1 關鍵修正：偵測要用 linear render target，不能用 tonemapped 截圖（本案 debug 教訓）

```
本案實測：同一條黑線——
  tonemapped 8-bit 截圖：x=596 luma 0.242 vs 鄰 0.255，delta 僅 ~0.015（凌晨 line-scan 與 executor
    偵測器都用截圖、門檻 0.04/純黑 → 全部漏判 PASS，但肉眼明顯有線）。
  linear render target（probe 讀的原始 float）：線點 baked luma ≈ 0（atlas valid-but-black texel
    facePx 287, x≈-1.7516）vs 控制點 ≈ 0.16，delta ≈ 0.16（巨大）。
結論：tonemap + 8-bit 量化把 sharp thin 暗縫的對比壓掉了，用截圖亮度判 delta 會系統性漏判。
正確做法（取代 §0 用截圖的部分）：
  A. 主判：用 window.reportR7310C1FullRoomDiffuseRuntimeProbe 在線點與控制點讀 linear radiance
     （level 36 / 49），FAIL 標準 line_luma < control_luma − 0.04（linear 空間）。
  B. 輔判（找線位置）：截圖只用來「定位」sharp 暗縫（局部極小 + 銳利邊），不用其 delta 絕對值判通過。
門檻 0.04 套在 linear radiance（非截圖）。
```


## 1. 八狀態驗收矩陣（每條接觸邊都要過）

| 狀態 | 操作 | 看什麼 | 通過標準 |
|------|------|--------|---------|
| S1 烘焙全開 | 全 surface bake on + 非方格 on | 局部亮度落差掃描 | 無暗/亮窄列（peak<0.04） |
| S2 目標面關閉 | 關該邊 owner 面 bake（如北牆 off） | 同上 | 暗縫消失即坐實 owner 是該面 |
| S3 全部烘焙關閉 | 全 bake off（純 live path tracing） | 同上 | 仍有縫＝幾何問題；無縫＝純 bake 問題 |
| S4 raw package | 換 raw（未 denoise）package | 同上 + probe level 49 baked luma | 判斷縫是否 denoise 引入 |
| S5 denoise package | d800-north-denoise-c 等 | 同上 | 與 raw 對比定位 denoise 責任 |
| S6 使用者實際相機 | 用使用者驗收 cameraState | 同上 | 不可只用工具自選角度 |
| S7 自動 probe | reportR7310...Probe 在縫像素 | route/ownerCount/baked vs control | 見 §2 single-owner 標準 |
| S8 人眼截圖 | 該相機 CDP 截圖存檔 | 肉眼 | 使用者或審查可複看 |

缺任一狀態證據 → 該邊只能標「未達全域標準」。

## 2. probe single-owner 驗收（中央 owner 規則的執行檢查）

每條接觸邊的縫像素，用 `window.reportR7310C1FullRoomDiffuseRuntimeProbe` 讀：

```
level 37 hybridOwnerCountBitmask → ownerCount 必須 == 1（baked 單一擁有者）或 == 0（該點走 live）。
   ownerCount >= 2 → 多重 owner、判定衝突 → FAIL（這是「各面自己寫 gate」會發生的漏）。
   encodingValid 必須 true。
level 31/35 northBeam route／coverage → routeName 單一且與 ownerCount 一致。
level 36 northBeamRadiance（最終 baked）與 level 49 nonSquareNorthPreAlbedoRadiance：
   縫點 baked luma 不可顯著低於「控制點（鄰側亮牆）」baked luma。
   本案標準：line_luma >= control_luma − 0.04，否則＝baked 有效但黑 → FAIL。
level 32 worldPosition：必須落在該接觸邊宣告的世界座標範圍內（對位自我校驗，防止量錯像素）。
level 42-44 geometryBox min/max + 34 hitObject：確認命中的是宣告的那個 box（防 owner 認錯幾何）。
```

single-owner 通過：ownerCount∈{0,1}、route 單一、baked 縫點不黑、worldPosition 對位正確、hitObject 為宣告幾何。

### 2.1 關鍵補強：面內邊緣連續性（per-pixel ownerCount=1 不等於邊有修好）

A1 probe（west-beam-north-contact-probe.json）揭露的陷阱：**每個像素 ownerCount=1、encodingValid=true，逐點 single-owner 全過，但仍有黑線**。
逐點檢查是「必要非充分」，要再加面內邊緣連續性：

```
邊級 FAIL 條件（任一成立即未過）：
  (b) 烘焙不連續（A1 命中此項）：某 owner 的 atlas 邊緣 column baked luma 比『同一 owner 的內部』低
      （凹陷/階梯）。A1 實測：北牆 owner 1002 邊緣 column 0.08 vs 北牆內部 0.098（dip 0.018），
      縱向連續、單一面、與西樑無關（西樑烘焙開關對此縫無影響）。
  (a) 歸屬不連續（A1 不屬此項，列為對照）：須沿『同一物理面』掃描，route/owner 在面內某 x 翻轉成
      另一 owner，才算歸屬被切。A1 在 x=592 的翻轉是西樑面 vs 北牆面的『螢幕輪廓』（本就不同面），
      非同一面被切，故非歸屬缺陷。
  (live 島) 任何 ownerCount=0 的臨時 live 補洞。
邊級 PASS：每個 owner 的 atlas 邊緣與其內部連續（無凹陷/階梯）、無 live 島。
```

亦即 §2 逐點檢查 +「§2.1 面內邊緣連續性」才是「無縫連續交界烘焙」的完整判準。

## 3. 套用到清單各邊（對應 contact-edge-inventory.md）

| 邊 | 驗收相機 | 主看數字 | 目前狀態 |
|----|---------|---------|---------|
| **A1 北牆↔西樑北端（縫在北牆側）** | 使用者相機 pos(-1.7087,2.8269,-1.8201) fwd(-0.4957,0.4169,-0.7619) fov55 | 七欄位 probe 31/34/46/45/43/44/37/38/36/49 + §2.1 面內邊緣連續性 | **probe 完成（七欄位齊全）；診斷＝北牆 owner 1002 自身 atlas 邊緣 column 0.08 vs 內部 0.098（§2.1 (b) 面內邊緣不連續，dip 0.018）；x=592 owner 翻轉僅西樑/北牆螢幕輪廓非成因；西樑無關；待修法（先紅）** |
| A2 北牆↔東樑北端 | NE 上角（待拍，鏡像 A1） | 同 A1 | 待 probe |
| A3/A4 北牆↔側牆背 | 牆角正面（待拍） | localDelta | 待驗 |
| A5 北牆↔木門洞 | 門洞正面（待拍） | localDelta + reveal route | 待驗 |
| B1 東牆↔東樑 | 室內往東上看（待拍） | localDelta + probe 27/28(eastJoin) | 待驗 |
| B2 東牆↔東南柱 | 往東南掠角（待拍） | 同上 | 待驗 |
| C1 西牆↔西樑（雙值） | 往西上看（待拍） | localDelta + probe 22-26(westJoin) | 待驗（注意 2.7179/2.846 雙值） |
| C2 西牆↔西南柱 | 往西南掠角（待拍） | 同上 | 待驗 |
| C3 鐵門 reveal | 貼近鐵門（broad-sweep 乾淨） | localDelta 重驗 | 需以新門檻重驗 |
| D1/D2 南牆↔側柱背 | 南牆掠角（broad-sweep 乾淨） | localDelta + S2(南牆off) | 需以新門檻重驗 |
| D3 南牆窗洞 reveal×4 | 貼近窗洞逐切面（待拍） | localDelta + reveal route | 待驗 |
| D4 南牆 AC 側柱背 | 同 D1/D2（需開 AC shadow） | localDelta + probe | 待驗（潛在炸彈） |
| E1/E2/E3 天花板↔樑柱頂 | 上看樑牆（broad-sweep 乾淨） | localDelta 重驗 | 需以新門檻重驗 |
| F1 地板↔牆腳 | 低角度牆腳（NW 乾淨） | localDelta | 部分待驗 |
| F2 地板↔家具 | 低角度家具腳（待拍） | localDelta | 待驗 |
| G1-G8 樑柱專用陰影面 | 對應內側/底/北面（待拍） | localDelta + probe island id | 部分舊紀錄乾淨、需重驗 |

## 4. 全域通過定義（CODEX 核准門檻）

```
「全域防呆完成」必須同時：
  1. contact-edge-inventory.md 列全（本批 28 條）
  2. 每條邊有 S1..S8 八狀態證據（截圖 + probe JSON）
  3. A1 failing case 先存在、修法後轉 pass（先紅後綠）
  4. 每條邊 probe single-owner 通過（ownerCount∈{0,1}、baked 不黑、對位正確）
  5. 使用者相機人眼截圖留檔
缺任一 → CODEX 回「未達全域標準」。OPUS 直接交 shader patch 不算全域修法。
```

## 5. 目前缺口（誠實）

```
- A1 的 probe 證據已**完成**：七欄位（route/hitObject/normal/worldPosition/boxMin/boxMax/ownerMask+ownerTargets）齊全，failingCase + §2.1 邊級連續性雙 FAIL 坐實（west-beam-north-contact-probe.json）。S2/S3/S4/S5/S8 的逐狀態截圖仍待補。
- 其餘 27 條的驗收相機尚未逐條拍定、probe 尚未跑 → 全部標「待驗」。
- 在這些證據補齊前，全房間仍不可宣稱「全域防呆完成」。
- 下一步（待使用者／CODEX 核准方法後）：逐條補 probe + 八狀態，A1 先修先驗（先紅後綠）。
```
