# Step F1 — A1 資料工廠先紅驗收記錄（SOP §14.8）

> 本檔只宣告「資料工廠對 A1 先紅成功」。**未宣告黑線修好**；修法與綠燈屬第 15 節（另案），本輪未動 shader／bake／runtime。
> 由執行 source.md 第 14 章 SOP 產生。canonical Step A run = `stage-a/stagea-final4`（latest.json 指向）。

## 六項通過定義（§14.8）

```
1. Step A 五行 probe + overlay 齊、涵蓋紅框、五行 alignment 全過
   ✓ stagea-final4：fiveRows=true、allRowsAligned=true（五行 level32 worldPosition 全在 x≈-1.75、z=-1.874＝西樑↔北牆交界）。
     overlay-vs-user-reference.png：偵測線 x=595（lineFracX 0.465）落在 user-a1-redbox-reference.png 紅框 x[0.42,0.52] 內，
     縱向五點涵蓋紅框 y[0.31,0.76]；紅框由使用者提供、收緊偵測排除瀏覽器 chrome（count 28279）。
2. Step B contact-edge-source.json + shaderGates 抽查全符
   ✓ boxes 88（更正自誤記 89）、surfaces 23、islands 8、北牆 z=-1.874、西樑 x=-1.75、
     northWallBeamGap.west={-1.908,-1.752,2.525,2.905}、shaderGates.westRect==JS 逐位元、wiringPresent=true。
3. Step C 接觸帶兩法（Python／Blender）一致
   ✓ A1 帶 x[-1.91,-1.75] y[2.525,2.905] z=-1.874；Python 矩形交集與 Blender 布林 diffs 全 0（<0.001m）。
4. Step D registry 9 欄齊、owner 欄可回溯
   ✓ ownerPolicy=PENDING；contactCandidates＝幾何兩側（北牆 idx15 +Z／西樑 idx28 -Z）；
     observedOwnerEvidence＝Step A 五行原始讀值（每筆標 level）；seamTransitionSweep＝x-sweep 實測；9 欄齊。
5. Step E 三來源 contract harness 全綠
   ✓ node docs/tests/r7-3-10-seam-contracts-all.mjs：4/4 PASS（含新 A1 三來源 test：gate JS↔shader↔registry、
     metadata island/atlasEdgePolicy、bake worldBounds/package、共用 surfaceId）。
6. S1/S6/S7/S8 先紅證據齊
   S1 全室烘焙全開 ✓（Step A 開全 surface + 非方格 atlas）
   S6 使用者相機 ✓（pos(-1.708748,2.826862,-1.820144) fwd(-0.495699,0.416871,-0.761906) fov55）
   S7 自動 probe ✓（五行 level 31/32/33/34/35/36/37/38/49 + 22-26）
   S8 失敗截圖 ✓（west-beam-north-contact-failing.png；見下「spp 誠實註記」）
```

## A1 先紅實測根因（由資料產出，非預設）

```
x-sweep（y=400、acceptance 相機、d800-north-denoise-c、nonSquareReady=true）跨接縫實測：
  x_screen 560–584：西樑 owner 1015（route west_beam_inner_shadow_hybrid）、baked luma ~0.097–0.105（z≈-1.87，樑面在前）
  x_screen 592–680：北牆面（z=-1.874）route="none"、ownerCount=0、luma=0（純黑）
  交界 ~x_screen 588。
⇒ A1 黑線實測＝西樑 baked 面緊鄰一條「route=none／ownerCount=0」的北牆帶（無 baked 擁有者＝全黑）。
⇒ 此與舊根因規格「owner 1002 atlas 邊緣 dip」**不同**。正因如此，ownerPolicy 維持 PENDING、
   A1 缺陷分類（落第 3.2 節哪一種）由本資料 + 後續對帳建立，不在此預設。資料工廠的價值正是揭露此差異。
```

## spp 誠實註記

```
stagea-final4 accumulatedSamples=14（headless swiftshader CPU ≈0.37 spp/s，500 spp 需 ~22 分鐘且屢遭 session 重啟孤兒化）。
A1 兩側皆烘焙面（讀靜態 atlas，無 path-tracing 雜訊），低 spp 截圖即無雜訊（diag 35 spp 截圖證實）。
客觀證據為 spp 無關的 level32 worldPosition + level31/37 route/owner（決定性逐像素 gate）。
嚴格 ≥500 spp 乾淨截圖屬第 15 節 GPU 綠燈；使用者紅框參考圖本身即真實 GPU 擷取。
```

## 結論

```
資料工廠先紅成功：六步（匯出→掃描→registry→對帳→contract）跑通，A1 失敗狀態已被定位、量測、登記、鎖死，
且實測根因由資料產出（route=none 無人認領帶），ownerPolicy 維持 PENDING。
可據第 13.8 節擴張到 28 條。黑線修法與綠燈走第 15 節（本輪未動）。
```
