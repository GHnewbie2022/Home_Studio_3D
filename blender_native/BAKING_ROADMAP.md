# Home Studio Blender Native — C2 即時光照與烘焙 Roadmap

更新日期：2026-08-02

官方指引與業界流程複審：2026-08-02 完成

## 文件角色

本文件是 `Home_Studio_Master.blend` 的 canonical 光照整合與烘焙 Roadmap，記錄正式來源、專案決策、官方原生路徑、自訂 Lightmap 候選路徑、驗證 Gate、產物與中斷續跑規則。

每次開始相關工作前，Codex 應先讀取本文件並即時稽核主檔。主檔內容與本文件衝突時，停止昂貴運算並回報差異。

## 唯一正式來源

```text
blender_native/Home_Studio_Master.blend
```

日常建模、材質、燈光、相機、Compositor、光照探針、烘焙與 EEVEE 整合，都以主檔實際內容為準。

`01_architecture_reconstruction/` 與 `02_furniture_reconstruction/` 已封存為歷史重建工具。它們不得覆寫正式主檔，也不參與烘焙。

## 正式配置

```text
正式配置：C2_PRIMARY
舊 C1 配置：2026-08-02 完成依賴稽核後移除
未來配置：C3、C4 先依幾何、燈光與材質差異判斷資料是否可共用
```

C1 移除前的稽核結果：

```text
Collection：C1_REFERENCE
子 Collection：GIK_C1
物件：GIK_C1_East、GIK_C1_West、GIK_C1_North
外部 Collection membership：0
Collection instance：0
外部 Parent：0
外部 Constraint：0
外部 Modifier：0
相機依賴：0
```

## 視覺基準

三張 C2 Cycles 成果圖是目前光影與材質的肉眼基準：

```text
reference/C2_Cycles_Cam1_20260730.png
reference/C2_Cycles_Cam2_20260730.png
reference/C2_Cycles_Cam3_20260730.png
```

任何 EEVEE 或自訂 Lightmap 結果，都要使用相同相機、解析度、曝光與顯示轉換比較。自由走動另檢查固定相機無法揭露的漏光、接縫與反射失真。

## 目前已驗收的 Cycles 參考狀態

```text
Blender：5.2.0 LTS
Engine：Cycles
Device：GPU Compute / Metal
F12：5120 × 2880，100%
Render Samples：2048
Viewport Samples：128
Adaptive Sampling：關閉
Denoise：關閉
Total Bounces：14
Diffuse Bounces：4
Glossy Bounces：4
Transmission Bounces：12
Transparent Bounces：8
Indirect Clamp：10
Color Management：AgX / Medium High Contrast
Pixel Filter：Blackman–Harris Width 1.75
Compositor：Diamond Sharpen 0.25
```

這些數值是本專案已驗收的參考設定，並非 Blender 對所有場景的固定推薦值。

Cycles Bake 會讀取 Samples、Light Paths、燈光、World、材質與可見幾何。F12 輸出尺寸、相機構圖、Blackman–Harris Width、Compositor 銳化與顯示用 AgX 不會直接寫入 UV 空間的 raw lightmap。

Adaptive Sampling 是否影響 Blender 5.2 的特定 Bake 工作，不先假設；由低成本試烘焙的實際採樣紀錄確認。

## 2026-08-01 主檔稽核

```text
Mesh 物件：98
完全沒有 UV 的 Mesh：23
只有一組 UVMap 的 Mesh：75
已有第二組 LightmapUV 的 Mesh：0
未套用縮放：0
負縮放：0
共用 Mesh Data：0
有效 Bake Target：0
```

Light Probe Volume 原生路徑不要求每個接收物件建立第二組 UV。只有進入自訂貼圖 Lightmap 路徑時，正式接收表面才建立 `LightmapUV`。門窗、插座、冷氣開口等 Boolean cutter 不建立 LightmapUV。

## 路徑決策：官方原生優先

Blender EEVEE 的官方原生靜態間接光方案是 Light Probe Volume；視角相關反射由 Ray Tracing、Light Probe Sphere 與必要時的 Light Probe Plane 補足。

正式流程先建立最小 EEVEE 原生基準，經 Gate 後再決定是否需要自訂 Cycles 貼圖 Lightmap。

```text
路徑 A — EEVEE 原生探針
直接光與陰影：EEVEE 即時燈光
間接漫射光：Light Probe Volume 手動 Bake
一般反射：Ray Tracing + Light Probe Sphere
平面高品質反射：僅在證據顯示必要時加入 Light Probe Plane

路徑 B — 自訂 Cycles 貼圖 Lightmap
啟動條件：路徑 A 在相同鏡頭下仍有無法接受的漏光、細節遺失、接觸區失真或光影差異
用途：將 Cycles 的靜態 RGB 漫射光照寫入第二組 UV 與 EXR 圖集

混合路徑
啟動條件：原生探針能處理大部分房間，只有少量關鍵表面需要貼圖 Lightmap
用途：降低圖集、材質與記憶體成本
```

Light Probe Volume Bake 有自己的 Resolution、Surfel 與 Bake Samples，不能直接沿用 Cycles 的 2048 SPP 語意。原生路徑與 Cycles 參考圖要以結果和效能比較。

## 固定外觀決策

以下 `FULL BAKE` 是 Home Studio 專案術語，並非 Blender 官方 Bake Type：

```text
KH150：靜態漫射外觀，無 EEVEE 即時反射
KH750：靜態漫射外觀，無 EEVEE 即時反射
ISOPACK：靜態漫射外觀
GIK：固定灰色，靜態漫射外觀
吸頂燈：固定亮度與色溫，靜態外觀
喇叭支架：靜態漫射光 + EEVEE 視角相關反射
地板：靜態漫射光 + EEVEE 視角相關反射
鐵門：靜態漫射光 + EEVEE 視角相關反射
南方景觀圖：Emission 1.0，相機可見，排除 diffuse / glossy / shadow ray 貢獻
```

路徑 A 會先保留原始材質並由 EEVEE 處理直接光；上列專案決策主要約束路徑 B 或混合路徑的材質組裝。

## 路徑 A：EEVEE 原生探針規格

```text
1. 在工作備份中建立包覆房間的 Light Probe Volume。
2. 先用可快速完成的 Resolution、Surfel Density 與 Bake Samples 建立基準。
3. 檢查所有要參與捕捉的物件 Render Visibility。
4. 記錄 Light Probes Volume Memory Pool、GPU 統一記憶體與 Bake 時間。
5. 加入最少數量的 Light Probe Sphere，涵蓋主要反射區域。
6. 地板或鐵門若仍需更精準平面反射，再個別測試 Light Probe Plane。
7. 使用 Cam1～Cam3 與自由走動比較 Cycles 基準。
8. 先用 C4 的物件量與預估探針解析度做容量 Gate。
```

探針解析度、Surfel Resolution 與 Bake Samples 由漏光、細節、記憶體和時間共同決定。每次只改一組參數並保存比較結果。

## 路徑 B：自訂 Cycles 貼圖 Lightmap 規格

### Bake 通道

```text
Bake Type：Diffuse
Direct：開啟
Indirect：開啟
Color：關閉
Target：Image Textures
Selected to Active：關閉
Cage：關閉
輸出：OpenEXR Half Float
Denoise：關閉，屬本專案決策
```

Blender 5.2.0 LTS 控制測試已確認：Diffuse 的 `Color` 關閉時，Bake 保留 RGB 光源顏色並排除表面 albedo；表面原始色需在材質中另行相乘。此行為與 Render Passes 的 Direct／Indirect／Color 分工一致。

目前官方 Bake 頁仍有 `Color` 關閉會得到灰階貢獻的文字，與 Blender 5.2 實測及 Render Passes 說明互相衝突。因此 `Color` 關閉保留為版本限定的實測決策；正式工作先用彩色光源、綠色表面與白色表面做最小測試，保存 RGB 像素值後才通過通道 Gate。

### UV 與圖集

```text
1. 保留原始 UVMap 承載木紋、GIK 布紋、喇叭面板與其他高頻材質。
2. 第二組 LightmapUV 只承載低頻 RGB 光照。
3. 同一圖集的所有物件要在共享 0～1 空間一起 Pack，重疊為零。
4. 牆面、地板、天花板與長直構件優先保留連續 UV island，減少接縫。
5. 深凹槽、背光面與容易漏光的面可有意拆 island。
6. Lightmap Pack 只用於適合逐面分離的物件，不作全場景固定方法。
7. texel density 以鏡頭距離、表面重要度與預期 mip 層級決定；允許關鍵近景有較高密度。
```

### 尺寸、邊界與收斂

```text
圖集尺寸候選：2048、4096
Margin 候選：16 px、32 px，依實際圖集尺寸與 mip 安全距離調整
Margin Type：Extend 與 Adjacent Faces 各做局部測試
低成本 Samples：16～64
中等 Samples：256
正式 Samples：由 256、512、1024、2048 的 scene-linear 差異與時間決定
```

4K、32 px 與 2048 SPP 都是候選值。正式值要用 texel 密度、UV 使用率、接縫、收斂差異、GPU 記憶體和 C4 容量實測選定。

### Bake Target 與共享圖集

Blender Bake 要求每個 Mesh 有 UV，且每個材質槽都有正確的 active Image Texture target。

同一張圖集供多物件使用時：

```text
方案 1：所有共享圖集物件一起選取，確認每個材質槽的 active target 相同，再一次 Bake。
方案 2：先 Clear 一次，後續逐物件 Bake 時關閉 Clear，避免清除前一物件結果。
```

每張 Image 完成後立即存成外部 EXR，並重新載入驗證像素、色彩與 checksum。只留在 Blender 記憶體中的 Bake 不算完成。

### 色彩管理

Lightmap 是 RGB scene-linear 光照資料。OpenEXR 使用目前 Blender／OCIO 設定的 scene-linear role；工作開始時先記錄實際色彩空間名稱並做 EXR 存檔、重載、像素數值 round-trip 測試。

Raw EXR 不套用 AgX、Blackman–Harris 或 Compositor 銳化。PNG 檢查圖可套用與 Cycles 基準相同的 AgX 顯示轉換，並在 manifest 記錄。

### EEVEE 材質組裝

靜態漫射的基礎組合：

```text
原始 Base Color／Texture × scene-linear RGB Lightmap
```

完全靜態外觀可把此結果送入 Emission，以避免 EEVEE 再加一次漫射光。此為專案自訂材質架構，需個別確認可接受失去視角相關高光。

需要即時反射的表面採能量守恆組合：

```text
介電材質：以 Fresnel 權重混合靜態漫射與微表面反射
金屬材質：使用金屬反射的有色 F0／Principled 路徑，不套用介電材質公式
```

禁止直接把完整亮度的 Emission 與完整亮度的 Glossy 相加。地板、鐵門與支架要各自比對 Cycles 基準，檢查重複能量、反射粗糙度與反射色。

## 圖集候選分組

```text
LM_C2_Floor
LM_C2_WallsStructure
LM_C2_Ceiling
LM_C2_FixedFurniture
LM_C2_AudioGIK
LM_C2_DoorsFixtures
```

這是管理候選，並非固定要建立 6 張 4K。分組要依共享 UV 空間、材質用途、更新頻率、圖集占用率、記憶體和 C3／C4 差異調整。

C3／C4 只有在幾何、燈光或材質差異會改變光照結果時，才建立各自的探針資料或 Lightmap；完全相同的接收集合可共用經驗證的資料。

## 執行邊界

```text
1. 同時間只使用一個 Blender 與一個 Metal GPU 工作。
2. 禁止執行封存建構器重建正式場景。
3. 禁止在低成本 Gate 通過前啟動完整高採樣工作。
4. 禁止改動已驗收的房間尺寸、家具位置、光源、World 與主要材質。
5. 禁止把歷史 validation、舊 package 或暫存輸出加入正式資料。
6. 禁止只把生成圖片留在 Blender 記憶體；每張完成後立即保存。
7. 禁止使用 OIDN 或其他降噪器改寫正式 Lightmap；這是使用者決策。
8. 遇到 NaN、Inf、漏光、黑塊、UV 重疊、存檔失敗或 Metal 異常時，停止後續工作。
9. 場景顯示 GPU Compute／Metal 只代表設定完成；試烘焙要從 Blender 狀態、Console 或時間對照驗證實際執行裝置。
10. 所有自動化先通過程式碼審查與 dry-run，只能操作 UV、探針、Bake target、輸出和 manifest。
```

## MCP、自動化與 Blender 的分工

```text
Codex／MCP：即時稽核主檔、設定探針或 Lightmap 工作、啟動運算、驗證與保存。
Blender：執行 EEVEE 探針 Bake 或 Cycles Bake。
窄範圍工作腳本：管理單一工作、存檔、manifest、checksum 與中斷續跑。
```

工作腳本不得重建幾何，也不得成為新的場景正式來源。腳本存於 `blender_native/tools/`，執行前列出所有預計修改與輸出；只有 `Home_Studio_Master.blend` 保存正式場景狀態。

## 分階段 Roadmap

```text
Phase 0 — 視覺凍結
狀態：完成
依據：Cam1、Cam2、Cam3 三張成果圖

Phase 1 — 唯讀 Preflight
狀態：下一動
工作：備份主檔、checksum、分類 receiver／occluder／cutter、材質與光源稽核、記憶體基準
產物：只讀報表與工作提案

Phase 2A — EEVEE 原生探針低成本基準
工作：Light Probe Volume + 最少量 Sphere；低解析度、低 Samples
驗證：Cam1～Cam3、自由走動、漏光、反射、FPS、統一記憶體

Phase 2B — C4 容量 Gate
工作：以 C4 物件量與預估探針解析度驗證 Light Probes Volume Memory Pool 與 GPU 統一記憶體

Decision Gate — 路徑選擇
A 通過：沿用官方原生探針並逐步提高品質
A 局部不足：採混合路徑，只對問題表面建立 LightmapUV
A 全面不足：啟動完整自訂 Cycles 貼圖 Lightmap

Phase 3 — 自訂 Lightmap Preflight（只有 Gate 授權才執行）
工作：建立工作備份、LightmapUV、共享 Pack、Bake target、UV 稽核報表

Phase 4 — 自訂 Lightmap 低成本試烘焙
尺寸：512 或 1024
Samples：16～64
區域：地板、牆／樑交界、木門、東牆 GIK、喇叭接觸處、插座凹槽

Phase 5 — 材質與品質驗證
尺寸：2048 或 4096 候選
Samples：256 起
工作：scene-linear round-trip、EEVEE 材質組裝、反射與接縫比較

Phase 6 — C4 自訂 Lightmap 容量 Gate
工作：圖集數量、占用率、材質切換、統一記憶體、EEVEE FPS

Phase 7 — 正式候選
尺寸與 Samples：依前述量測決定
條件：所有品質與容量 Gate 通過

Phase 8 — 整合驗收
工作：三個固定相機、自由走動、反射、接觸陰影、漏光、色彩、效能
```

## 驗證 Gate

```text
Geometry Gate
法線正確、Boolean 為最終可見結果、無共面閃爍、無穿插與漏光。

Native Probe Gate
Volume 覆蓋正確、漏光可接受、直接光未重複、反射探針數量最小、C4 記憶體可承受。

UV Gate（路徑 B）
LightmapUV 位於 0～1、共享圖集跨物件重疊為零、無鏡像共用、texel density 與 margin 合格。

Raw Bake Gate（路徑 B）
EXR 存檔重載數值一致，無未寫入像素、NaN、Inf、黑塊、接縫與異常色塊。

Material Assembly Gate（路徑 B）
scene-linear 色彩正確、原始材質乘上 Lightmap、反射能量守恆、無重複漫射光。

Render-space Gate
固定相機與自由走動外觀一致；GIK 無摩爾紋；地板、鐵門、支架反射正常。

Performance Gate
記錄 EEVEE FPS、統一記憶體、探針／圖集數量與材質數量；C4 預估通過。
```

## 故障分類

```text
A：原生探針資料已有漏光、記憶體或捕捉錯誤。
B：Raw Lightmap 已有錯色、黑塊、接縫或漏光。
C：Raw 資料正確，材質接線、UV、OCIO role 或能量組合錯誤。
D：Bake 與材質正確，EEVEE 反射、Ray Tracing、mipmap 或即時燈光造成差異。
```

## 產物與續跑規則

正式輸出候選位置：

```text
blender_native/bakes/C2/native_probes/
blender_native/bakes/C2/lightmaps/
```

每個工作完成後立即保存：

```text
探針設定與 Bake 狀態，或 EXR 圖集
PNG 檢查圖
manifest.json
UV 稽核報表（路徑 B）
主檔 checksum
輸出 checksum
Blender 版本與實際運算裝置證據
Samples／Light Paths／Margin／時間／物件清單
固定相機比較結果
```

工作中斷後，先驗證已完成檔案 checksum，再從第一個未完成工作繼續。已通過 checksum 的產物不得重算。

## 完成定義

```text
1. 已用證據選定原生探針、混合或完整自訂 Lightmap 路徑。
2. Cam1～Cam3 的 EEVEE 結果與 Cycles 基準在使用者接受範圍內一致。
3. 自由走動無明顯漏光、接縫、重複照明與反射錯誤。
4. C4 容量與效能 Gate 通過。
5. 所有正式產物可由 manifest、設定與 checksum 追溯。
6. Home_Studio_Master.blend、正式產物與回復檔完整。
```

## 官方與業界參考

```text
Blender Manual — Cycles Render Baking
https://docs.blender.org/manual/en/5.0/render/cycles/baking.html

Blender Manual — Render Passes
https://docs.blender.org/manual/en/5.0/render/layers/passes.html

Blender Manual — UV Layout Workflow / Lightmap Pack
https://docs.blender.org/manual/en/dev/modeling/meshes/uv/workflows/layout.html
https://docs.blender.org/manual/en/5.0/modeling/meshes/editing/uv.html

Blender Manual — Color Management
https://docs.blender.org/manual/en/latest/render/color_management.html

Blender Manual — EEVEE Light Probes
https://docs.blender.org/manual/en/5.0/render/eevee/light_probes/index.html
https://docs.blender.org/manual/en/5.0/render/eevee/light_probes/volume.html
https://docs.blender.org/manual/en/5.0/render/eevee/light_probes/sphere.html
https://docs.blender.org/manual/en/5.0/render/eevee/light_probes/plane.html
https://docs.blender.org/manual/en/5.0/render/eevee/limitations/limitations.html

Blender Manual — Cycles GPU Rendering / Film
https://docs.blender.org/manual/en/5.0/render/cycles/gpu_rendering.html
https://docs.blender.org/manual/en/latest/render/cycles/render_settings/film.html

Epic Games — Understanding Lightmapping / Generating Lightmap UVs
https://dev.epicgames.com/documentation/en-us/unreal-engine/understanding-lightmapping-in-unreal-engine
https://dev.epicgames.com/documentation/en-us/unreal-engine/generating-lightmap-uvs-in-unreal-engine
```
