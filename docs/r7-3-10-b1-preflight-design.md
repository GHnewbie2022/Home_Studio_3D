# R7-3.10 B1 前評：bake-only Blender Guard 設計收斂

撰寫：OPUS（CODEX 流量用盡，由 OPUS 代執行），2026-06-14

用途：依共識稿 V6 §11 與 §10 的待拍板項，產出 B1 前評。本檔為 read-only 設計收斂：未動 shader / JS、未重烤、未 commit、未 push、未碰 Brave。本檔只決定「B1 該怎麼設計、該驗什麼、不成立時怎麼退守」，不執行任何施工。

白話：這份是「真正動手做自動防護之前，先在紙上把設計、把握度、退路想清楚」的盤算單。重點是誠實面對一個硬事實——量測顯示標準 Blender 三把刀單獨開都追不上手工補丁，所以 B1 必須講清楚「合起來＋還沒試過的那一招」到底有沒有機會，沒機會時退去哪。

---

## 0. 一句話結論

```text
B0 量測顯示：標準 Blender 三把刀（ray_offset / t_min / self-skip）逐一單獨開，
都追不上手工補丁 oracle。結構分析指出原因一致——它們治的是「自己咬自己」與「太近」，
而北牆黑線的壞命中是「打到緊貼的『不同盒』鄰體」，需要的是側向繞開。
唯一還沒被測過、且可能對症的設定是「跳過接觸邊鄰體的第一次命中」（非 self-skip）。
B1 的價值＝把這一招做出來並驗證；若它仍追不平 oracle，則據此歸因、退守保留手工補丁。
此結論為「設計假設」，最終由 B1 施工實測裁定，本檔不預判成敗。
```

---

## 1. B0 量測納入（設計輸入，不得用來降門檻）

逐線 mean（atlas 10 SPP；bed_top oracle = LEGACY 0.412）：

```text
模式               bed_top   west_beam  east_beam
LEGACY(oracle)     0.412     0.164      0.173
OFF(黑線重現)      0.273     0.160      0.159
TMIN_ONLY 0.001    0.272     0.149      0.157
RAY_OFFSET_ONLY    0.273     0.158      0.164
BOX_SKIP_ONLY      0.347     0.085      0.106
TMIN_ONLY 0.008    0.189     0.140      0.142
```

來源：`.omc/r7-3-10-b1-spike-atlas-line-analysis-10spp-base.json`。

判讀（bed_top 為最乾淨判別線；樑線 mean 被大量 alpha=0 / 近零 texel 稀釋，判別力弱，僅作輔助）：

```text
1. 黑線缺口：oracle 0.412 vs OFF 0.273，需補 +0.139（約 +51%）。
2. RAY_OFFSET_ONLY 0.273 ≈ OFF：形同零作用。
3. TMIN_ONLY 0.001 0.272 ≈ OFF：形同零作用；放大到 0.008 變 0.189，比黑線更暗（過切）。
4. BOX_SKIP_ONLY bed_top 0.347：只補到一半，仍短於 oracle；
   且把 west/east 樑線從 ~0.16 打到 0.085 / 0.106＝傷害（鄰體排除誤刪合法遮蔽）。
```

---

## 2. 失效機制分析（為何單刀追不平）

```text
壞命中本質（共識稿 §2.2、reference §1）：
  bake 射線從牆面接觸線出發，第一跳就打到緊貼的『不同 boxIdx』鄰體（床 / 樑），
  幾何項塌陷 → 算出的 radiance 本身偏暗。

ray_offset（沿幾何法線 +Z 推開起點）：
  鄰體在『平面內』（床在下方、樑在側向），把起點往牆法線推不改變射線仍朝鄰體。
  → 量測零作用（0.273=OFF），與 reference §4.2 預警「法線 offset 與側向 escape 不共線」一致。

t_min（忽略太近命中）：
  鄰體命中距離多半大於小 t_min → 不被忽略（0.272=OFF）；
  放大 t_min 連『合法近接觸 AO』一起忽略 → 過切變暗（0.189）。卡在「無作用」與「過切」之間。

self-skip（跳過起點盒）：
  spike 的 BOX_SKIP 跳的是『起點自身盒』（spike change-plan 記為 r7310B1RaySelfBoxIdx=當前 hitBoxIndex）。
  但壞命中在『不同盒的鄰體』，不是起點盒 → 跳自身治不到 adjacent 命中；
  bed_top 0.347 的部分回亮來自接觸的『同盒近面』那一截，adjacent 那截仍黑，故只到一半；
  套到純 adjacent 的樑線則誤刪合法遮蔽 → 把樑打暗。

手工補丁（oracle）為何能到 0.412：
  它做『側向繞開』——把起點沿牆面移到旁邊乾淨牆，採到乾淨 radiance。
  三把刀沒有任何一把做側向繞開，這是追不平的根本。
```

---

## 3. 關鍵缺口：唯一還沒測過、可能對症的設定

```text
spike 測過：自身盒 self-skip。
spike 沒測過：跳過『接觸邊鄰體』的第一次命中（contact-edge-neighbor first-hit skip）。
術語校正（2026-06-14 實證後）：鄰體（床頂面 / 樑側面）與被烤牆面『互相垂直、相接於接觸邊』，並非共面;
  真正共面的那個鄰體背面反而打不到、不是兇手。故偵測準則是『命中距離極近的立即自咬』，不是『共面』。

機制：
  bake 射線出發時帶『起點 boxIdx』與『起點是否落在接觸邊 / seam』資訊；
  SceneIntersect（bake-only gated）對第一次命中判斷：
    若命中盒為『不同 boxIdx』且命中距離極近（t ≤ ε，即起點落在接觸邊上的立即自咬）
    → 跳過此命中、射線穿過續打真實環境。
  bounce 與 NEE shadow ray 兩端皆套（光源端 N/A：emitter 命中＝成功收光，見權威表）。
  ray_offset / t_min 留作『同盒自咬』那一截的便宜保險，非主刀。

核心難點（scoping，B1 go/no-go）：
  『不同盒 + 極近 + 第一次命中』同時也描述『合法的近接觸遮蔽』（樑本來就該擋住牆的部分半球）。
  全跳＝BOX_SKIP 那種把樑打暗的回歸。要區分『接觸邊上的壞自咬』與『合法近遮蔽』，
  關鍵在『起點是否正落在接觸邊 / seam 上』——這正是現行 registry / 手動 helper 已編碼的 WHERE。
  這個區分能否切準，就是 B1 能否成立的關鍵。

與 Blender 對應：
  概念近 Cycles intersection_skip_self_shadow（兩端 skip），
  從「跳自身 primitive」一般化到「跳接觸邊鄰體 primitive」。屬補課方向、非自創;
  但『接觸邊鄰體』這層 Blender 不出貨，是本專案的延伸。
```

---

## 4. 注入點（B1 施工時，bake-only gated，供日後實作）

```text
1. bounce 二次起點：
   r7310C1XatlasBakeSecondaryRayOrigin（glsl:1829），呼叫處 glsl:7224。
2. NEE shadow 起點：
   r7310C1XatlasBakeNeeShadowRayOrigin（glsl:1844），呼叫處 glsl:7480；
   NEE dispatch glsl:7477-7491，已被 uR7310C1XatlasBakeMode>0.5 gate。
3. 命中判斷與 boxIdx 來源：
   SceneIntersect（glsl:4504）leaf 段、boxIdx 取自 glsl:4546。
4. 載體（carrier）需求：
   spawn boxIdx + spawn 表面平面（法線+位置）寫進 bake ray；
   key 一律用 runtime sceneBoxes 的 boxIdx（B0 鐵律），禁用 hitObjectID。
5. gate：
   全部掛 uR738C1BakeCaptureMode==2 / uR7310C1XatlasBakeMode>0.5；LIVE 走 no-op、位元不變。
```

---

## 5. 中心風險（誠實、不預判）

```text
1. 主風險：接觸邊極近自咬判定的 ε 與「只跳第一次命中」的範圍，能否切得夠準——
   只繞開壞命中、不誤刪合法近接觸遮蔽（即避免 BOX_SKIP 那種把樑打暗的回歸）。
   切得準 → 有機會追平 oracle；切不準 → 重演樑線傷害。這一點只有 B1 施工實測能定。

2. 量級風險：手工補丁靠側向繞開到乾淨牆；contact-edge-neighbor skip 靠『穿過鄰體續打環境』。
   兩者幾何不同，結果未必同值。B1 必須以 LIVE 母帶為準裁定誰才是對的，
   而非假設「追平手工補丁」就等於正確。

3. 成本風險：本招要把『起點平面 + 起點 boxIdx』帶進 SceneIntersect 並逐命中判斷，
   屬動命中核心、回歸面較大（共識稿與 reference 已標）。施工須 LIVE no-op 鐵證護住。
```

---

## 6. 驗收對應（共識稿 §6 PASS 條件）

```text
B1 FULL_GUARD PASS（helper 關、guard 獨撐）必過：
  #1 與 LIVE 母帶對照通過（最高標準）。
  #2 與 MANUAL_HELPER oracle 逐像素對拍（次級）。
  #3 LIVE no-op 兩檢查點對拍。
  #4 B0 單刀短於 oracle 已納入設計（本檔 §1-§3）。
  #6 manualHelperPixels = 0。
  #7 HiddenJoinFace / 舊幾何規則未偷救場。
  #8 漏光 gate。
  #9 ray_offset / t_min 量級報告。

B0 已完成、可直接引用（見 b0-final-evidence-package）：
  權威對照表（§1）、凸性 audit（11 PASS / 0 ROUTE / 0 BLOCK）、
  id uniqueness、11 個 NEE 燈狀態、analytic 家族 identity。
  → §6 的 #10-#13 盤點面 B0 已達成，B1 不必重做，只需引用。
```

---

## 7. 退守觸發（證據閘控，非預設）

```text
若 B1 施工實測證明 contact-edge-neighbor first-hit skip（含 ray_offset/t_min 保險）
仍無法在不傷害樑線的前提下追平 LIVE 母帶 / oracle：
  1. 須提出成因歸因（量測 + 機制，非「看起來不行」）。
  2. 退守＝保留手工補丁（A-narrow）為北牆 confirmed seam 正式機制，
     Blender guard 降為「只接新面 safety net」。
  3. 此退守須寫回 canonical 共識稿，並經使用者拍板，才生效。
禁止在 B1 施工前、或無歸因下，直接採用退守。
```

---

## 8. 下一動與紅線

```text
下一動：
  1. 本 B1 前評交使用者複核設計方向與風險。
  2. 使用者拍板是否啟動 B1 施工（建 contact-edge-neighbor first-hit skip + 兩端 + 保險，bake-only gated）。
  3. B1 施工為動 shader 的關卡，須使用者當次拍板。

紅線：
  A-wide 不動、B3 不啟動。
  未經使用者當次拍板，不動 shader / JS、不重烤、不 commit、不 push、不碰 Brave。
  B1 施工須先過 LIVE no-op 鐵證；任何改 LIVE 的方案直接退回（B2 鐵律）。
```
