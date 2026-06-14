# R7-3.10 架構級根治 — 幾何根因調查（OPUS 夜間自主研究）

撰寫：OPUS（CODEX 流量用盡、使用者就寢，授權 OPUS 自主研究），2026-06-14 夜

用途：回答使用者就寢前指定的調查——「把『剛好重合』改成 Blender 那種『重疊穿透』的幾何，能不能根治烘焙黑線?」並依結果路由到三情境之一。供 CODEX 流量重置後跟上、審查、討論。

狀態（紅線遵守）：本檔為 read-only 分析。未動 shader / JS / 幾何、未重烤、未 commit、未 push、未碰 Brave。LIVE 原樣。下方「實證確認測試」屬『指定但未執行』，理由見 §5。

接手必讀順序：本檔 → `docs/r7-3-10-arch-cure-plain-consensus-for-opus.md`（V6 多階段計畫主準，§3 階段地圖、§6 PASS 條件）→ `docs/r7-3-10-b1-preflight-design.md`（B1 前評）。

---

## 0. 結論與三情境路由

```text
調查結論：重疊穿透（interpenetration）預期『治不了』這條黑線。
路由：→ 情境 2（回頭開發「跳過接觸邊鄰體第一次命中」的防護，即 Blender 缺、需自製的那把刀＝B1）。

把握度：本結論為『分析＋既有量測數據』推得，非本輪新烤。但有一條決定性的『實測既成事實』背書（見 §4 第 2 點），
       故信賴度高。仍指定一個最終實證確認測試（§5），待使用者醒後或 CODEX 重置後執行以蓋章。
```

理由一句話：黑線發生在『兩個互相垂直的面相接的那條邊』（牆面 vs 床頂面／樑側面），是「接觸邊退化」；重疊穿透只動鄰體『沿法線方向、藏在牆裡的背面』，動不到那條接觸邊，所以治不了。

---

## 1. 調查問題（使用者就寢前指定）

```text
使用者觀察：Blender 盡量避免「兩個面剛好疊在同一平面」；我們的渲染器卻刻意讓牆面與樑/床面壓在同一平面。
使用者提問：那是不是該改正幾何去對齊 Blender? 重疊穿透能不能根治?
三情境：
  1. 重疊穿透可行 → 規劃實作方法、最小實驗。
  2. 重疊穿透也不行 → 回頭開發「跳過鄰居第一道光」的防護（Blender 缺、需自製的刀）。
  3. 其他 → 自行解決或記錄。
```

---

## 2. 權威依據（業界如何擋漏光、coincident vs overlapping）

```text
A. 擋漏光的業界標準＝把牆做成『有厚度的封閉實體』，非靠面貼面。
   Unity 官方手冊（troubleshooting light leaking）原文：
     "For interior scenes, avoid one-sided wall meshes. Instead, use extruded meshes
      to create proper thickness and effectively block light leaks."
   翻譯：室內場景避免單面牆;改用有擠出厚度的網格做出適當厚度,即可有效擋住漏光。

B. 同手冊另警告：穿插戳穿場景幾何，烘焙時也會自生瑕疵。
   原文："Ensure that objects don't intersect or protrude through scene geometry."
   翻譯：確保物件不要穿插或戳穿場景幾何。
   → 重疊穿透不是保證乾淨的萬靈丹。

C. coincident（剛好重合）vs overlapping（重疊穿透）有別。
   TurboSquid（Coincident Faces）原文：
     "Coincident faces are different from overlapping faces ... legs under a tabletop ...
      the face normals point in opposite directions ... the overlapped area will not be
      visible in renderings. Unlike coincident faces, overlapping faces do not cause rendering issues."
   翻譯：剛好重合（法線同向）會算圖打架;重疊穿透（法線反向、藏在裡面看不到）不會。
   注意：此規則是針對『光柵化算圖的 z-fighting』，不直接等同『路徑追蹤烘焙的射線自交』，見 §3 修正。
```

來源：
- Unity Manual — Troubleshooting light leaking: https://docs.unity3d.com/6000.3/Documentation/Manual/troubleshooting-lightmapping-leaking.html
- TurboSquid — Coincident Faces: https://resources.turbosquid.com/training/modeling/coincident-faces/
- Understanding Lightmapping in Unreal Engine: https://dev.epicgames.com/documentation/unreal-engine/understanding-lightmapping-in-unreal-engine?lang=en-US

---

## 3. 逐縫幾何剖析（核心）

牆面被烘焙的平面：北牆內面 z = -1.874，法線 +Z（朝室內）。runtime 判定 glsl:1763。

```text
[bed_top]  escape +Y，oracle 0.412 / OFF 0.273
  床盒（js/Home_Studio.js:254）：min[-0.027, 0, -1.874]  max[1.91, 0.28, -0.314]。
  關鍵面：床『頂面』y=0.28（法線 +Y）。
  與牆的關係：床頂面（y=0.28 平面）與牆面（z=-1.874 平面）『互相垂直』，相交於一條接觸邊
             （y=0.28, z=-1.874, x∈[-0.027,1.91]）。
  ⇒ 接觸邊退化，非 coincident-face 對。escape +Y＝沿牆面、離開接觸邊。

[west_beam] escape +X，OFF≈0.16（樑線 mean 被近零 texel 稀釋、判別力弱）
  西樑盒（js/Home_Studio.js:115）：min[-1.91, 2.525, -1.874]  max[-1.75, 2.905, 2.848]。
  關鍵面：樑『+X 側面』x=-1.75（法線 +X，朝室內中央）。
  與牆的關係：樑側面（x=-1.75 平面）與牆面（z=-1.874 平面）『互相垂直』，相交於接觸邊
             （x=-1.75, z=-1.874, y∈[2.525,2.905]）。
  ⇒ 接觸邊退化。escape +X＝沿牆面、離開接觸邊。

[east_beam] escape -X，東樑盒（js/Home_Studio.js:116）：min[1.85,2.515,-1.874] max[MAX_X,2.905,3.056]。
  同西樑鏡像。接觸邊（x=1.85, z=-1.874）。⇒ 接觸邊退化。

唯一存在的 coincident 面（鄰體背面 z=-1.874 與牆 z=-1.874）：法線反向（鄰體背面朝 -Z、背向室內）。
  烘焙二次反彈從牆面（+nl*EPS，nl=+Z）射向 +Z 半球，遠離 z=-1.874，『打不到』這個背面。
  ⇒ 這個 coincident 面不是兇手。兇手是上面那條『垂直面相接的接觸邊』。
```

§2C 的修正：TurboSquid 的「coincident 才有問題、overlapping 沒問題」是『光柵化 z-fighting』結論。本案是『路徑追蹤烘焙的射線自交』，問題不在那個 coincident 背面（它打不到），而在『接觸邊』——這是另一類退化，業界的 coincident/overlapping 二分法不直接涵蓋。

---

## 4. 結論：重疊穿透為何治不了

```text
1. 幾何上：三條黑線都是『垂直面相接的接觸邊』退化。
   重疊穿透＝把鄰體沿牆法線方向往牆裡多塞（如床/樑 min.z 由 -1.874 改 -2.0），
   它只移動『鄰體藏在牆裡的背面』，不移動『接觸邊』、也不移動『那片造成自咬的垂直面』
   （床頂 y=0.28、樑側 x=-1.75 原地不動）。動不到病灶 ⇒ 治不了。

2. 決定性實測背書（既成事實，非本輪推測）：
   B0 量測 RAY_OFFSET_ONLY（沿牆法線 +Z 把起點 Wächter-Binder 推開）對 bed_top ＝ 0.273 ＝ OFF ＝『零作用』。
   重疊穿透與 ray_offset 同屬『法線方向』類動作（一個動鄰體背面、一個動起點，都沿 ±Z）。
   ray_offset 法線方向已實測零作用 ⇒ 同方向的重疊穿透預期同樣零作用。

3. 反證：唯一有效的修法（手動 helper / A-narrow）是『沿牆面側向移開起點』（+Y/+X），不是法線方向。
   病灶在『接觸邊』，只有側向離開才治得到;任何只動鄰體深度的幾何改動都不在這個方向上。

附帶：就算 §2B 的 Unity 警告不算，光是第 2 點的實測零作用就足以判定重疊穿透這條路預期不通。
```

---

## 5. 實證確認測試（指定，但本夜未執行；理由在內）

```text
為何未自主執行（三個具體阻塞）：
  1. helper-OFF baseline 不可得：要看「黑線在不在」，需把手動 helper 關掉跑;但 OFF/guard 切換鷹架
     已在 A-narrow 收尾（BLOCKER 2）整批移除，現行 shader 無 OFF 旗標。要重做 A/B 得先重加一段 throwaway 鷹架。
  2. xatlas 烤管線參數多（--xatlas-bake / texelmap-dir / validity-mask / 非預設 angle）本輪未握實值;
     且 Metal headless 有 17 sampler>16 既知風險。
  3. 幾何與 LIVE 共用，改了須確實還原。無人看顧下硬跑，有『改了沒還原、留髒樹給使用者醒來收拾』的風險。
  依使用者一貫偏好（乾淨交接、勿留半成品狀態），改為『指定測試、待醒後或 CODEX 執行』。
  註：上述三阻塞反而強化 §4 結論——真要實測得先重建鷹架，成本不低，而分析（含 ray_offset 零作用實測）已足以路由。

測試設計（給 CODEX / 醒後執行）：
  1. baseline：沿用既有 LEGACY/OFF 量測（.omc/r7-3-10-b1-spike-atlas-line-analysis-10spp-base.json）。
  2. A/B：把床盒 min.z 由 -1.874 改 -2.0（重疊穿透牆），其他不動;
     用 spike 同一套 xatlas 烤 + r7-3-10-b1-spike-atlas-line-analyze.mjs 量 bed_top mean。
  3. 判讀：bed_top mean 跳到 ~0.41 → 重疊穿透有效（翻轉本結論、回情境 1）;
          維持 ~0.27 → 確認無效（蓋章情境 2）。
  4. 強制 Chrome、不碰 Brave;測完 `git checkout js/Home_Studio.js` 還原幾何，確認 git diff 乾淨。
預期：維持 ~0.27（依 §4）。此測試是『蓋章』，非『翻案賭注』。
```

---

## 6. 情境 2 前進設計（路由落點）

```text
落點：B1 ＝「跳過接觸邊鄰體的第一次命中」的 bake-only guard。
術語修正：先前說的「共面鄰體 skip」更精確該叫「接觸邊鄰體 skip」——鄰體與被烤牆面是『垂直相接』，非共面。

機制：
  bake 射線（bounce 與 NEE 兩端）出發時帶『起點 boxIdx』與『起點表面平面』;
  SceneIntersect（bake-only gated）對第一次命中判斷：若命中盒為『不同 boxIdx』且該命中位於
  『起點接觸邊鄰體』範圍、且為第一次命中 → 跳過、續打真實環境。
  注入點見 b1-preflight-design.md §4（secondary origin glsl:1829、NEE origin glsl:1844 呼叫於 7480、SceneIntersect 4504）。

中心風險（不變）：scoping 要切得準——只繞開壞命中、不誤刪合法近接觸遮蔽
  （BOX_SKIP_ONLY 把樑線從 ~0.16 打到 0.085/0.106 的回歸，就是切太鈍的前車之鑑）。
  能否切準＝B1 施工實測的 go/no-go;追不平則退守保留手動 helper（A-narrow），Blender guard 降安全網（須歸因＋寫回＋拍板）。

把握度（誠實）：標準三把刀已證單獨不足;B1 全押『接觸邊鄰體精準 skip』能否切準。可能成、可能不成。
```

---

## 7. 給 CODEX 的接手清單（流量重置後）

```text
跟上：
  1. 讀 V6 共識稿（§3 階段地圖、§6 PASS）、b1-preflight-design.md、本檔。
  2. 現狀：A-narrow 已 commit 7cbb494（helper hardening 旁支，非 B1/B3）。
     B0 量測已完成。B1 未施工。A-wide 封存。
審查點（請挑戰本檔）：
  1. §3 幾何剖析：床頂/樑側與牆是否確為『垂直相接』而非 coincident? 逐條核 box 座標。
  2. §4 第 2 點：ray_offset 法線方向零作用，是否足以類推重疊穿透同樣零作用? 有無反例。
  3. §6：接觸邊鄰體 skip 的 scoping 是否真能避開 BOX_SKIP 的樑線回歸。
待使用者拍板：
  1. 是否先跑 §5 實證確認測試（蓋章重疊穿透無效）再進 B1，或直接信分析進 B1 前評收斂。
  2. 是否啟動 B1 施工（動烘焙核心、回歸面大、須當次拍板）。
```

---

## 8. 紅線與本檔狀態

```text
本檔只新增此 MD。未動 shader / JS / 幾何、未重烤、未 commit、未 push、未碰 Brave。LIVE 原樣。
A-wide 不動、B3 不啟動。
§5 實證測試指定未執行。任何 shader/JS/幾何改動、重烤、commit、push 仍須使用者當次拍板。
```
