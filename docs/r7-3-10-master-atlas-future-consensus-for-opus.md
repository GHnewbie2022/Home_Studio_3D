# R7-3.10 Master Atlas Future Consensus for OPUS

> 狀態：CODEX 與使用者討論稿。OPUS 目前仍在 H2 烤製／驗收線上，本檔先記錄尚未貼給 OPUS 的架構共識。等 H2 使用者肉眼驗收完成後，請 OPUS 先讀本檔，再決定下一面與後續 C1-C4 方案。

## 0. 一句話

全室非方格總貼圖可以承接後續地板、牆、窗楣、家具、喇叭、桌子、樑柱與 C1-C4；前提是每一片進場前都通過 owner、光色契約、尺寸、邊界、配置版本的自動檢查。

## 1. 目前 H2 共識

H2 指的是南牆窗洞上方、房間內看得到的水平朝下面。

```
1. H2 原本造成縫隙的主因
   這片可見面原本沒有正式自己的烤圖。
   Surface Ownership Map 把它標成 pending 後，縫隙改成誠實桃紅。

2. H2 後來破圖的主因
   曾經接入錯烤包。
   那包其實是地板烤圖，metadata 顯示 y 約 0.01、normal 為 +Y。

3. H2 現在剩下的主因
   正確 H2 烤包的幾何身分已經對。
   目前色差來自雙重 albedo 乘法。
   烤時已乘牆色，runtime 又乘一次牆色。

4. 正確修法
   H2 必須重烤成 albedo-free / separated irradiance。
   進 master atlas 後，runtime 只乘一次材質顏色。

5. 驗收目標
   使用者圖二 cameraState 下，RAW / OIDN 的 H2 與大片天花板要平順銜接。
   LIVE 對照是最高參考。
```

## 2. 光色契約

這條是全室 master atlas 的正式規則。

```
1. 所有進入 master atlas 的 sub-rect，
   若 runtime 使用 multiplyAlbedoAfterBakeLookup=true，
   烤圖必須是乾淨光影。

2. 乾淨光影的意思
   烤圖只存間接光亮度與顏色。
   材質顏色在 runtime 乘一次。

3. H2 的錯誤示範
   dedicated bake 時乘過 hitColor。
   master runtime 又依 separated albedo 規則乘 hitColor。
   結果 H2 偏暗、偏黃，與大片天花板分家。

4. 正式修法方向
   採 B 路：
   既有矩形 H2 管線保留。
   烤時把 H2 納入 albedo-free 條件。
   pointer 保持 multiplyAlbedoAfterBakeLookup=true。

5. 自動檢查
   package / pointer / registry / scanner 必須檢查此契約。
   master sub-rect 宣告為 runtime 乘材質時，bake path 必須宣告 albedo-free。
```

## 3. 大總貼圖架構

新的全室 master atlas 可以收不同尺寸的面。

```
1. 可以放入不同尺寸
   北牆、東牆、天花板、H2、地板、家具、喇叭、桌子都可以是不同尺寸。

2. 不回到舊式多個小 slot
   master atlas + manifest 是主線。
   manifest 記錄每片 sub-rect 的位置、尺寸、owner、configId、光色契約。

3. 顯卡尺寸限制
   單張 master 若超過 gl.MAX_TEXTURE_SIZE，
   該 config 可拆成 masterAtlas_0 / masterAtlas_1。
   拆張數仍由 manifest 管理。

4. 邊界安全
   每個 sub-rect 要有 gutter。
   runtime 取樣要 clamp 在自己的 sub-rect 內。
   這可避免雙線性取樣吃到隔壁面。
```

## 4. C1-C4 配置隔離

使用者提出：若一張 master 放得下同一個 config 的全部烤圖，C1-C4 各用一張 master 會最乾淨。CODEX 同意。

```
1. 建議結構
   C1 -> master atlas + manifest_C1
   C2 -> master atlas + manifest_C2
   C3 -> master atlas + manifest_C3
   C4 -> master atlas + manifest_C4

2. 原因
   每個 config 的家具、燈光、遮蔽關係都可能不同。
   config 分開後，C2 的陰影資料不會流進 C4。

3. 切換方式
   runtime 切 config 時，切整包 atlas package + manifest。
   不靠同一張圖內的複雜分區規則判斷 C1-C4。

4. 超尺寸處理
   若 C4 物件太多，C4 可拆成多張 master。
   仍屬同一個 C4 package。
```

## 5. Surface Ownership Map 規則

每一片看得到的面都要有清楚歸屬。

```
1. owner
   看得到且需要烤的面。
   例：大片天花板、地板、牆、H2、家具表面、桌面。

2. pending
   看得到，但目前還沒烤。
   開發模式可顯示桃紅。
   正式驗收要擋下。

3. internal blocker
   幾何上存在，但房間內看不到。
   例：牆體內部交界。
   它可用來阻止其他面越界吃進牆內。

4. conflict
   同一個世界位置被兩片面搶。
   scanner 必須擋下。

5. gap
   看得到的位置沒有人負責。
   scanner 必須擋下。
```

## 6. 後續面與物件進場順序

此順序是目前建議，可依 OPUS 實測調整。

```
1. H2 收尾
   修光色契約，重烤成乾淨光影。
   RAW / OIDN / LIVE 對照通過。

2. 地板
   地板大、形狀直，適合測試 master atlas 容量與 config package 規則。

3. 南牆與西牆
   補齊房間主要大面。
   將 owner map 與 c2c mask 漂移一次收斂。

4. 大型家具
   床、櫃、桌子。
   每個 surface 先進 registry，再烤乾淨光影。

5. 喇叭與器材
   需要特別注意曲面、支架、接觸邊與材質。
   analytic primitive 必須有穩定 surface id。

6. 樑柱
   接觸邊最多，容易牽涉牆、天花板、窗洞與角落。
   適合在大面與家具規則穩定後處理。

7. C1-C4 全套驗收
   每個 config 各跑 RAW / OIDN / LIVE 對照。
   package 不可跨 config 混用。
```

## 7. 自動檢查清單

這些要變成 gate，避免靠人工記憶。

```
1. owner gate
   owner conflict = fail
   visible gap = fail
   formal pending = fail

2. albedo contract gate
   master sub-rect 若 runtime 乘材質，
   bake output 必須宣告 albedo-free。

3. config gate
   package configId 必須與 runtime config 一致。

4. metadata identity gate
   烤包 metadata 的 worldPos / normal / surfaceName / targetId 必須對上 registry。

5. atlas packing gate
   sub-rect 不得重疊。
   gutter 必須足夠。
   master 尺寸不得超過 gl.MAX_TEXTURE_SIZE。

6. sampler gate
   master atlas 不應把 sampler 數推爆。
   若 master 拆成多張，要在 manifest 中明確記錄。

7. visual gate
   使用者指定 cameraState 下做 RAW / OIDN / LIVE 對照。
   肉眼驗收仍是最後裁判。
```

## 8. 給 OPUS 的下一步

```
1. 先完成 H2 光色契約修復。
   使用 separated irradiance 重烤 H2。
   H2 接回 master atlas 後，RAW / OIDN 與 LIVE 銜接要通過使用者肉眼驗收。

2. 驗收通過後，請讀本檔。
   本檔記錄 CODEX 與使用者尚未貼給 OPUS 的未來架構討論。

3. 下一個建議面是地板。
   地板可用來驗證 master atlas 容量、manifest、config package、scanner gate。

4. 實作前先把 package schema 的 configId 第一層隔離補清楚。
   C1-C4 以獨立 package / manifest 管理。

5. 每個新面先登記 owner，再烤，再打包，再跑 scanner。
   不跳過 owner map。
```

## 9. CODEX TO OPUS

```
CODEX TO OPUS

此檔為 CODEX 與使用者在 H2 烤製等待期間整理的活文件：
docs/r7-3-10-master-atlas-future-consensus-for-opus.md

目前共識：
1. H2 縫隙靠 Surface Ownership Map + H2 自有烤圖解掉。
2. H2 色差根因是雙重 albedo 乘法。
3. H2 修法採「矩形 dedicated 管線 + separated irradiance / albedo-free bake」。
4. 全室 master atlas 的正式契約：
   若 runtime 使用 multiplyAlbedoAfterBakeLookup=true，
   該 sub-rect 的 bake output 必須是 albedo-free。
5. 北牆、東牆、大片天花板目前正常面納入契約稽核即可，不需無理由重烤。
6. 未來 C1-C4 建議以 config 為第一層隔離：
   C1 / C2 / C3 / C4 各自 master atlas + manifest；
   若單張超尺寸，該 config 內拆成多張 master。
7. 後續順序建議：
   H2 收尾 -> 地板 -> 南牆/西牆 -> 大型家具 -> 喇叭/器材 -> 樑柱 -> C1-C4 全套驗收。

請 OPUS 在 H2 使用者肉眼驗收通過後讀本檔，並將後續討論持續寫回同一份 MD，避免使用者手上堆積碎片訊息。
```

## 10. H2 RAW 紋理方向新疑點

使用者在 H2 顏色修正後，用近距離 RAW 視角發現：H2 的髒斑紋理呈東西向拉伸；北側大片天花板紋理較均勻。

目前 CODEX 初步核對到的碼證：

```
1. H2 幾何比例
   H2 world 範圍為 x[-1.75, 0.69]、z[3.056, 3.256]。
   寬約 2.44m，深約 0.20m。
   物理比例約 12.2:1。

2. H2 現行烤圖比例
   js/InitCommon.js 目前 depth_h2 = 1024 x 1024。
   shader 註解也寫明「自烤 1024² runner 原生方形圖」。

3. 推論
   H2 已接進 master atlas。
   但 H2 自己的來源 patch 是方形 1024²。
   它尚未用和大片天花板一致的真非方格／等 texel density 長條比例。

4. 畫面症狀
   用方形圖去貼一條 2.44m x 0.20m 的長窄面，
   RAW 雜訊或紋理容易沿長邊看起來被拉開。
   這與使用者紅線標示的東西向拉伸相符。
```

CODEX 初步裁示：

```
1. 這不是光色契約問題。
   H2 顏色契約可修好色差。
   紋理方向問題指向 atlas aspect / texel density。

2. 這也不是 H2 沒放進 master atlas。
   它有放進 master。
   問題在 H2 來源 patch 仍是 1024² 方形。

3. 正式修法應將 H2 source atlas 改成依世界尺寸比例配置。
   以 800 texel/m 粗估：
     x 方向約 2.44m * 800 = 1952 texel
     z 方向約 0.20m * 800 = 160 texel
   實際尺寸需由 OPUS 按現有 packing / gutter / OIDN 條件核定。

4. OPUS 請先驗證：
   近距離 RAW 拉伸是否在 OIDN 中減弱或消失。
   若 RAW/OIDN 都保留方向性拉伸，優先改 H2 source aspect。
   若只 RAW 明顯、OIDN 可接受，仍應記錄為 H2 未完成的 atlas 比例債。
```

## 11. 北牆 OIDN 西側寬帶殘留

使用者補圖指出：北牆西側邊緣有一條 OIDN 後仍殘留的寬帶髒斑。使用者判讀為 RAW 本身正常，OIDN 沒有把該帶降乾淨。

CODEX 只查 OIDN 輸入／輸出與 OIDN 管線，未改 RAW、未改 pointer、未重烤。

目前證據：

```
1. 目前北牆 OIDN package
   docs/data/r7-3-10-xatlas-full-north-wall-1000spp-oidn-rtlightmap-runtime-package.json
   packageDir = .omc/r7-3-10-xatlas-bake-spike/20260613-100834-oidn-rtlightmap-high-beta
   filter = RTLightmap
   auxStrategy = color_only_beta

2. 使用者紅圈對應的北牆西半範圍
   OIDN 後高頻殘留集中在 world X 約 -1.49 到 -0.70。

3. 原 RT OIDN 的降噪不足數字
   X[-1.49,-1.23]：
     raw highpass 0.00919
     RT OIDN highpass 0.00277
     降幅約 69.9%
   X[-1.05,-0.79]：
     raw highpass 0.01111
     RT OIDN highpass 0.00338
     降幅約 69.5%

4. 正常區對照
   X[-0.35,-0.26]：
     RT OIDN 降幅約 96.5%
   X[1.85,1.93]：
     RT OIDN 降幅約 95.8%

5. 臨時 RTLightmap 測試
   CODEX 用同一張北牆 RAW 臨時重跑 OIDN 到 /private/tmp，不改專案檔。
   filter = RTLightmap
   aux = beta

   X[-1.49,-1.23]：
     RT highpass 0.00277
     RTLightmap highpass 0.00140
     比原 RT 少約 49.5%

   X[-1.05,-0.79]：
     RT highpass 0.00338
     RTLightmap highpass 0.00197
     比原 RT 少約 41.9%
```

CODEX 初步裁示：

```
1. 這條寬帶屬 OIDN 濾鏡選擇／降噪策略問題。
   北牆目前仍使用較早的 RT color-only OIDN。
   天花板後來已改用 RTLightmap。

2. 這條寬帶與 H2 縫隙根因不同。
   H2 縫隙來自 owner / pending / H2 自烤。
   北牆寬帶來自 OIDN 對西半高變異區保留過多高頻。

3. 使用者已驗收 RTLightmap 版本，北牆 OIDN 預設改用 RTLightmap。
   RAW 不重烤。
   原 RT runtime 入口與 pointer 不保留。
   以使用者補圖視角做 RAW / 舊 OIDN / 新 OIDN 對照。

4. 驗收重點
   西側寬帶高頻殘留需明顯下降。
   北牆原本已驗收的接觸邊不可退化。
   OIDN 不可改動 RAW package。
```
