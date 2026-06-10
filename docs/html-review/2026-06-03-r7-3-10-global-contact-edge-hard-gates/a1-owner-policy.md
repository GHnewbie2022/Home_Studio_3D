# A1 owner policy（Step D 規則書，SOP §14.6 交付物 7.4.3）

> 由 docs/tools/r7-3-10-contact-edge-registry-build.mjs 產生。ownerPolicy 此刻為 PENDING；
> 最終 owner 由 Step E 三來源（gate / bake / metadata）對帳後產出，不在 Step D 由幾何填定案。

## 1. 接觸邊
- 名稱：A1 北牆 ↔ 西樑北端（edgeId a1）
- 世界座標範圍：z=-1.874，x[-1.91, -1.75]，y[2.525, 2.905]
- 兩側 surface：1002 北牆（+Z）、1015 西樑內側（北端 -Z / 內側 +X）

## 2. owner 規則
- 現況：**PENDING**。幾何相鄰只證明「哪兩面接觸」，不能定 runtime 歸屬。
- 產出時機：Step E 對帳 gate（InitCommon r7310C1NorthWallHiddenByBeamGap + shader）、bake（probe level 49/36 + atlas UV / worldBounds / package）、metadata（structuralIslands + atlasEdgePolicies）三來源後，寫回 registry 第 (4) 欄。
- 允許修法類型：待分類確定後，依第 8.2.4–8.2.6 與第 11.2 節決定（atlas edge fill / runtime gate / 幾何封邊），本資料系統內不動 shader/bake。

## 3. 驗收相機
- position(-1.708748, 2.826862, -1.820144)、forward(-0.495699, 0.416871, -0.761906)、fov 55
- package：d800-north-denoise-c
- 使用者紅框基準：user-a1-redbox-reference.png（唯一基準，禁自截自判）

## 4. probe 門檻（候選）
- 候選：共邊 post-albedo 跨交接無階梯（差 < 0.005）、ownerCount ∈ {0,1}、五行 peak localDelta < 0.04（linear，不採 tonemapped 截圖）。
- 正式值待第 15 節綠燈以實測定。

## 5. 硬否決（第 11.1 節九條）
- (1) 黑線消失但旁邊出現無人認領 live 區域
- (2) baked 交界被切出一塊 live 補洞
- (3) 某段接觸邊靠 live path tracing 臨時接上
- (4) 交界亮度看似接近但 owner route 不連續
- (5) probe 顯示同一條接觸邊一段 baked、一段 live、一段沒有 owner
- (6) 修法靠換回舊 package 才無縫
- (7) 修法靠關閉北牆某一帶改走 live
- (8) 只用 tonemapped 截圖宣告通過
- (9) 沒有使用者相機驗收圖

## 6. 截圖要求
- ≥ 500 spp 失敗截圖（先紅，證明線存在且＝使用者紅框）；overlay 與 user-a1-redbox-reference.png 並排。
- 綠燈無線截圖屬第 15 節。
