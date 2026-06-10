# 方向指引：xatlas A1 C2C 北牆破圖 — 有效性標記修法（OPUS×CODEX 共識版 v2）

- 日期：2026-06-07
- 作者：OPUS（唯讀調查＋業界查證）／已整合 CODEX 2026-06-07 收斂意見
- 對象：CODEX
- 版本說明：本共識版取代 direction 初版。核心收斂——亮度門檻定位為「當前 A1 package 的壞資料診斷指紋」，長期有效性綁 sample validity；真正修法在 package 階段完成，runtime 亮度檢查只作第二道防線。

---

## 一、雙邊確認的根因

```
xatlas 的「有效性標記」目前只認幾何、不認烤圖結果：
  - alpha 由 frontFraction（rawNormal 半球 + 88-box backface 比例）決定
        docs/tools/r7-3-10-c2c-validity-mask.py 230-235
  - RGB  由 path tracer bake 另算
  - 兩者解耦 → 產生 alpha=1 但 RGB≈0 的黑洞
  - runtime 只看 alpha 加權，回 true 就採用該 RGB（即使是 0），並跳過乾淨的 D800
        shaders/Home_Studio_Fragment.glsl
        r7310C1XatlasRuntimeSampleValidLinear 1176-1204；消費點 3179-3202、6596-6601
實測佐證（CODEX 獨立重算 20260607-023242）：
  tri10 alpha=1 近黑 5824 格、tri11 3690 格、tri21 31 格
  probe mode 56 紅點坐實。
```

---

## 二、有效性(validity)的正確定義（核心收斂）

短期（本包診斷依據）：

```
alpha=1 且 RGB exact-zero（luma < 1e-5）= 壞資料指紋。
理由：本案 bake 是 indirect_diffuse_radiance（diffuseOnly，runtime 之後才補直接光），
      path tracer 正常不吐 exact 0；exact-zero 代表這格未被有效烤到。
用途：當作 A1 / C2C 的硬停與診斷判據（見第四節第一步）。
```

長期（全域有效性定義，採 CODEX 2.1）：

```
alpha 要綁 sample validity，判據為：
  1. 這格是否真的完成烤圖取樣
  2. 是否無 NaN / Inf
  3. alpha 是否與 sample validity 對齊
  4. 無效格是否已由有效鄰居補值
亮度高低本身不作長期有效性判據（光照圖可能有真實的暗處，避免誤殺真暗）。
```

措辭基準（採 CODEX 4.2）：valid 必須代表這格有可信的烤圖結果；烤圖結果缺失或未初始化的格，不得標 alpha=1。

---

## 三、業界三共識（Unity、The Witness、GPU lightmapper）

1. validity 與 radiance 來自同一次取樣：判定有效性的 ray 同時帶回光照，valid 才有可信的烤圖值。
2. invalid texel 在 bake／package 階段就 dilation 填值。
   - Unity："When a texel is invalid, Unity clones valid values from surrounding texels to prevent artifacts."
   - GPU lightmapper："For every empty background pixel, it looks at 8 neighbours and copies the first non-empty value it finds."
3. runtime 取樣端通常不帶有效性旗標，直接取已填滿的值。

---

## 四、立即修法五步（採 CODEX，全域，不寫死 A1、不寫死三角形編號）

```
第一步｜C2C package 新增 hard stop
  alpha=1 且 RGB exact-zero（luma<1e-5）的 texel 數量必須為 0。
  現況非 0，故 20260607-023242 這包判定不通過。

第二步｜把這些 exact-zero texel 改成 alpha=0，進入無效集合
  記錄原因碼：zeroRadianceInvalid。

第三步｜alpha-aware dilation 真的把這些洞填起來
  來源只取 alpha=1 且 RGB 有效的鄰居。
  範圍 same-triangle、capped 距離（A1 先 ≤4 texel）。
  排除來源：hiddenContact、alpha=0、exact-zero（含 zeroRadianceInvalid 自身，避免以黑填黑）。
  capped 距離填不到的殘餘：維持 alpha=0 走 fallback，並在報告記錄殘餘數（不可無聲截斷）。

第四步｜重跑 runtime 驗收
  黑線消失，且木門西側矩形不再髒，才算 C2C 通過。

第五步｜runtime 亮度 guard 只作第二道防線
  r7310C1XatlasRuntimeSampleValidLinear 回 true 前多一條 weighted-luma>eps 檢查；
  不過則回 false 走 fallback。主修法仍是第一到第三步。
```

C2C 契約（CODEX 已起手，方向正確）：新增硬規則 `alphaOneExactBlackTexels == 0`，未來 package 留 alpha=1 黑格即 FAIL。

---

## 五、判據與護欄

1. 判據統一：所有亮度檢查鎖 `luma < 1e-5`（對齊 probe mode 56 紅色判據），定位為短期壞資料指紋。
2. 雙邊同判據：runtime guard 與 C2C 契約用同一 `luma < 1e-5`，避免灰色地帶。
3. dilation 現況指認（讓第三步直接可動手）：
   - alpha report 的 `fillMode = same-triangle-fillable-capped-dilation`、`maxDistanceLimitTexels = 4`，設計方向已符合第三步要求。
   - `dilatedTexels = 0` 的真因是 fillable 集合為空（`sourceTriangleCounts = {}`）。
   - 第二步把 zeroRadianceInvalid 納入 fillable 後，dilation 才有來源與目標。
4. 覆蓋率：做了第三步 dilation 填值後，alpha=0 露黑的風險自然消失；填不到的殘餘才退 fallback，並記錄殘餘數。

---

## 六、validity 與 radiance 同源的最乾淨落法（遠程根本修法）

```
目標：把第二節長期定義落成具體 channel，使 alpha 直接綁 sample validity，
      去掉對亮度門檻的長期依賴（呼應 CODEX 2.1 第 3 點）。
作法：bake 階段輸出一個 sample-validity 通道，C2C 的 alpha 綁它。
本案天然來源：shader 已有 r7310C1XatlasBakeTexelValid（PathTracingCommon.js 3306 / 3322），
      目前只當 indirectBake 的 gate（5890-5894），未輸出到 package。
需擴充：現有 texelValid 只反映「bake ray 有沒有設定成功」。
      要再加「ray 是否命中預期表面（hit 落在預期 wall 面附近）」與「結果非 NaN/Inf」，
      才能涵蓋 H-a（gate 通過、但 ray 打到錯幾何而得 0）這類黑洞。
定位：此為遠程根本修法，與第四節五步的近程處置同向，可分階段實作。
```

---

## 七、明確排除的修法路徑

1. 不改 `rayDirection = -normal` 或改半球取樣。
   xatlas bake 與乾淨的 D800 per-surface bake 用同一條公式（PathTracingCommon.js 3319-3320 對 3340-3341），北牆 bakeNormal=[0,0,1] 正確。改它會同時破壞 D800 與全 23 面共用路徑，且不對應根因。
2. 不逐三角形修補 tri10／tri11。probe mode 55 證實三角形切割正常，這是模型資料。
3. 不把問題歸因於 SPP。C1 是乾淨參考，exact-zero 屬結構性、與取樣數無關。

---

## 八、推進策略（採 CODEX 4.3）

先用 A1 驗證 package-level validity 契約 + dilation 規則跑通，再擴到全房。

---

## 九、內部成因（次要，留作日後判斷）

probe mode 56 的「矩形帶狀」分佈比較像 chart／bake tile（512×512）邊界，指向 H-c（UV 跨 chart）或 bake 結構。現階段先以 package-level 有效性契約處理；若日後要讓 xatlas 升格為主力（取代 D800、不只補洞），這批 exact-zero 為何產生要收斂，否則覆蓋率上不去。順手記錄紅點落點即可。

---

## 十、原文出處與延伸閱讀

業界原文：
- Unity — Lightmap Parameters Asset：https://docs.unity3d.com/Manual/class-LightmapParameters.html
- Unity — Progressive Lightmapper：https://docs.unity3d.com/2017.2/Documentation/Manual/ProgressiveLightmapper.html
- The Witness — Graphics Tech: Texture Parameterization：http://the-witness.net/news/2010/03/graphics-tech-texture-parameterization/
- Ignacio Castaño — Lightmap Parameterization：https://www.ludicon.com/castano/blog/articles/lightmap-parameterization/
- Mr F — Baking artifact-free lightmaps on the GPU：https://ndotl.wordpress.com/2018/08/29/baking-artifact-free-lightmaps/

根因完整調查與證據行號索引：`docs/SOP/OPUS-investigation-2026-06-07-r7-3-10-xatlas-a1-c2c-dirty-rootcause.md`
（該份若有「valid 必然有光」「全域止血」等較滿措辭，一律以本共識版第二節定義為準。）
```