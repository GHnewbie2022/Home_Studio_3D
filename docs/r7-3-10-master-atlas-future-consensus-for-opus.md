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

## 12. Texel density audit（OPUS read-only 實證；撤回先前「北/東約 590、天花板混合」誤判）

CODEX 質疑 OPUS 先前的密度判讀，從 atlas 尺寸反推現有面應已是 800 texel/m。OPUS 做 5 面 read-only 逐面 audit（世界邊界＋master sub-rect 尺寸＋UV 函式軸向＋package pointer 四方交叉驗證），結論：CODEX 正確。現有 master surfaces 均為 800 texel/m。

OPUS 先前「590」的誤判來源已查明：讀到「舊 non-square 預覽 atlas」（R7310_C1_NON_SQUARE_ATLAS_SIZE_PX 2912×3432、north face 2492×1716＝590 texel/m），那是另一套舊系統，與 master xatlas 無關。本 audit 已明確排除該預覽系統。「北/東約 590、天花板混合」判讀撤回。

```
逐面結果（atlas 兩軸密度，皆 ~800 texel/m、各向同性）
  北牆   2325×3377   atlas寬2325↔worldY高2.905m=800.3 ；atlas高3377↔worldX寬4.22m=800.2   ✅800
  東牆   2325×3945   atlas寬2325↔worldY高2.905m=800.3 ；atlas高3945↔worldZ深4.93m=800.2   ✅800
  天花板 4265×3377   atlas寬4265↔worldZ深5.33m=800.2 ；atlas高3377↔worldX寬4.22m=800.2     ✅800
  H2     1952×160    atlas寬1952↔worldX 2.44m=800.0 ；atlas高160↔worldZ 0.20m=800.0         ✅800（texelMm[1.25,1.25]）
  各面 package pointer 的 targetAtlasWidth/Height 與 master rect 逐位元一致。
  各面 UV 軸向不同（牆寬軸=worldY、天花板寬軸=worldZ、H2寬軸=worldX），但兩軸密度一致 800 → 「等價軸向、均 800」。
```

裁示落實：

```
1. 北／東／天花板不重烤（讀碼確認已 800）。
2. 共識稿先前「北/東約590、天花板混合」撤回，改記「現有 master surfaces 均已按 800 texel/m（等價軸向）建立」。
3. 地板跟同一標準做 800 texel/m：world 4.22m(X)×5.33m(Z) → 非方格 3376×4264 px（atlas寬↔worldX、atlas高↔worldZ）。
   現有地板是 1024² 方形烤＝242.6(X)／192.1(Z) texel/m，遠低於 800 且各向異性 1.263——正是要改的拉伸。
4. §10（H2 紋理東西向拉伸）已解：H2 已重烤為非方格 1952×160＝800 texel/m（commit 80314cd）。
5. §11（北牆 OIDN 西側寬帶）已解：改 RTLightmap（commit 1ab211e、已 push）。
```

## 13. 地板 preflight 定稿（C1A shell 第一版；read-only，待裁示後實作）

架構定位（CODEX 2026-06-16 裁示，取代「全室單一 master」說法）：每 config 兩張 active atlas — C1A=shell（建築外殼）、C1B=objects（物件）。同一時間只綁 active config 的 A/B。地板＝C1A shell 的一片。

sampler 實機審查（OPUS read-only）：MAX_TEXTURE_IMAGE_UNITS=16、path-tracer active sampler=16/16（零空位；tBorrowTexture 已因 TIU≤16 停用，代表已擠到上限）。故 C1B object atlas 不可在退舊 FullRoomDiffuse 兩 slot 前上線。

```
3-phase 上線順序（硬紅線：跨階段不可搶跑）
  Phase 1：只做 C1A shell。地板＋ceiling/north/east/H2 收進 C1A（沿用 tR738C1BakeAtlasTexture，零新 sampler）。
  Phase 2：C1A shell 面（含 floor）驗收後，退舊 FullRoomDiffuse 兩 slot
           （tR7310C1FullRoomDiffuseAtlasTexture ＋ …NonSquare），釋放 2 sampler。
  Phase 3：才開 C1B object atlas（用 1 個釋放出的 slot、另 1 留 headroom）。落點 4＋9＋2＝15/16。
  地板任務只在 Phase 1；C1B（家具/喇叭/桌子）等 Phase 3。
```

```
1. floor owner registry 草案
   {
     "surfaceId": "floor_open",
     "ownerClass": "floor",
     "atlasGroup": "shell",          // 新欄位（決策A）
     "configId": 1,                  // 新欄位（決策A）
     "normalGate": { "axis":"y", "sign":1, "threshold":0.5 },
     "objectIdGate": { "lt":1.5 },
     "x": [-2.11, 2.11], "y": [-0.0005, 0.025], "z": [-2.074, 3.256],
     "precedence": 10,
     "pendingPolicy": "pending",     // 先 pending（桃紅），D-verify 後改 baked
     "bakeTargetId": null,           // pending 可為 null；baked 階段必須填 1001（沿用既有地板、不新增 targetId）
     "bakeTargetRole": "master_subrect", "masterRectKey": "floor",
     "runnerSurfaceKey": "full-floor-xatlas"
   }
   身分釘死（避免「targetId 到底是誰」歧義）：floor_open ＝ 同一塊地板（既有 targetId 1001）的 master 化版本。
     targetId / bakeTargetId 沿用 1001、不新增；改變的只有 atlasGroup(shell)、configId(1)、surfaceName(floor_open)、masterRect(floor)、烤法(非方格 albedo-free)。
   schema 同步：_doc.fields 增 configId、atlasGroup；codegen/scanner 讀這兩欄。
```

```
2. floor pending 階段（讓桃紅安全網真的會亮）
   登 pending → 重跑 codegen → r7310SurfaceOwnerIsPending(floor) 回 true（目前全 false 是死碼）。
   master 模式 floor 命中 → 桃紅 vec3(1,0,1) break；未烤前不退 LIVE 漫射、不取舊 1024 烤。
   衝突修：舊 FloorHybrid（glsl 6358-6360，apply 7248 未被 !XatlasRuntimeFirstHit 擋）會在 master 模式照貼舊 1024 烤、蓋掉桃紅
     → pending 階段在 master 模式關掉 FloorHybrid（或桃紅 gate 排它前）。
   scanner 取樣區從南側深度條擴到 floor 腳印（x[-2.11,2.11] z[-2.074,3.256]）。
```

```
3. metadata identity gate（新 load-time gate；目前缺、地板最高優先）
   loader 現只驗 width/height/byteLength。新增逐欄比對烤包 metadata vs registry：
     surfaceName==floor_open、targetId==1001（沿用既有地板、不新增）、baked 時 bakeTargetId==1001、configId==runtime config（不符拒載）、atlasGroup==shell、
     worldPos⊂bounds、normal≈[0,+1,0]、width×height==3376×4264、texel≈800、bakeAlbedoFree==true。
   理由：registry 已記 3 次 VOID 地板誤烤（缺 --r7310-full-room-diffuse-bake 旗標→靜默退回 floor fallback），此 gate 是唯一常設防線。
```

```
4. C1A shell packing 第一版（非盲 append；重排把 max 維壓進 8192）
   左欄  ceiling {0,    0,    4265, 3377}
         floor   {0,    3381, 3376, 4264}
   右欄  north   {4269, 0,    2325, 3377}
         east    {4269, 3381, 2325, 3945}
         depth_h2{4269, 7330, 1952, 160 }
   C1A_W = 4265+4+2325 = 6594；C1A_H = max(3377+4+4264, 3377+4+3945+4+160) = 7645。
   兩維 < 8192 → 含低階 GPU 部署安全；面積效率 ~91%。
   只動 rect offset/uniform＋重 blit，既有面不重烤。附帶修 InitCommon 4615/4635 行過時 MASTER_H 註解（7326/8354→實算 7490→C1A 新值）。
   gate：sub-rect 不重疊（上表已驗）、每面 4px gutter（上表已留）、C1A_W/H ≤ MAX_TEXTURE_SIZE 斷言。
   split 延後：之後 south/west/beams/columns 加入若超 MAX_TEXTURE_SIZE，才進 masterAtlas_0/_1 split（尺寸問題、非 sampler；本版先不做）。
```

```
5. sampler discipline
   floor 沿用 tR738C1BakeAtlasTexture（shell），零新 sampler。
   硬紅線：退舊 FullRoomDiffuse 兩 slot（Phase 2）前，不准新增任何 object/C1B atlas sampler（先加=17/16=可能全黑）。
   新增斷言：master path-tracer active sampler ≤ 16。
```

```
6. albedo 契約
   floor master 烤包：bakeAlbedoFree=true、multiplyAlbedoAfterBakeLookup=true（只存乾淨間接光、runtime 乘一次材質色）。
   ⚠ 現有 1024 floor 包是 indirect-only＋runtime 加直接光、非 albedo-free 分離 → 必須重烤成非方格 albedo-free，
     否則 loader 契約 throw／雙重 albedo 重演（VOID 過的第一版 H2 同陷阱）。
   烤指令釘 runner key + --r7310-full-room-diffuse-bake companion 旗標（避免靜默退回 floor fallback）。
```

```
7. 舊 floor path 退場（分兩段；先不刪）
   7a（Phase 1 內、過渡）：master 模式關 FloorHybrid，讓桃紅／C1A floor 生效；實體檔保留到驗收後才刪。
   7b（Phase 2）：floor＋C1A shell 面全驗收後，退場 uR7310C1FloorDiffuseMode、tR7310C1FullRoomDiffuseAtlasTexture(+NonSquare)、targetId 1001、r7310C1FloorHybridActive，釋放 2 sampler 給 Phase 3 的 C1B。
   退場條件（全滿足才退）：D-verify 過 ＋ 使用者同視角 RAW/OIDN/LIVE 肉眼過 ＋ 16-TIU 不黑 ＋ 接觸邊不退化。
```
