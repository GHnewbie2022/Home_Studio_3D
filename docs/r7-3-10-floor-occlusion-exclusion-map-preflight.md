# R7-3.10 地板 Occlusion Exclusion Map Preflight

狀態：給 OPUS 的 bug#2 架構級施工前規格
範圍：C1 地板黑縫，geometry-driven exclusion，實作前必讀
建立日期：2026-06-17

## 0. 核心裁示

目前專案已有 Surface Ownership Map。bug#2 暴露的缺口是 Occlusion Exclusion Map。

```text
Surface Ownership Map 回答：
  這個 world position 歸哪一片 surface？

Occlusion Exclusion Map 回答：
  在已歸屬的 surface 裡，哪些 texel 被實體幾何壓住，不能成為有效 bake texel？
```

對 bug#2 來說，`floor_open` 的 surface owner 判定可以成立。錯誤發生在 `floor_open` 內部：被牆與床壓住的 texel 仍被寫成有效 bake 資料。

## 1. 白話模型

把地板烤圖想成一張地圖。

```text
Surface Ownership Map：
  這一區歸地板。

Occlusion Exclusion Map：
  這一格雖然屬於地板，但被牆、床、櫃子、桌子、喇叭或其他實體物件壓住。
  這一格不能印成可用烤圖。
```

目前失敗鏈：

```text
地板烤圖把整張地板矩形都當成有效。
它包含北牆壓住的區域，也包含床壓住的區域。
這些被壓住的 texel 烤成硬黑。
metadata 仍寫 valid=1。
runtime 看到 alpha=1，就相信那些硬黑 texel 是正式資料。
黑縫因此出現。
```

目標行為：

```text
被實體壓住的地板 texel：
  metadata valid = 0
  atlas alpha = 0

真正露出的地板 texel：
  metadata valid = 1
  atlas alpha = 1
```

## 2. 架構邊界

請把 bug#2 定位為 `floor_open` 缺少 geometry-driven exclusion system。

```text
Surface Ownership Map：
  管 surface identity。
  例：floor_open、ceiling_open、north_wall、east_wall、depth_h2。

Occlusion Exclusion Map：
  管同一片 surface 裡哪些 texel 應該 invalid。
  例：北牆 footprint 壓住的地板、床 footprint 壓住的地板、未來家具 footprint 壓住的地板。
```

這次不能做單點 seam patch。規格要能延伸到 C2/C3/C4 與家具、桌子、喇叭、rack、衣櫃等物件。

## 3. Registry 設計

在 surface-owner registry 裡新增獨立機器可讀區塊。

建議名稱：

```text
floorOcclusionExclusions
```

請讓它與 `surfaces[]` 分開。

```text
surfaces[]：
  驅動 owner predicate 與 GLSL owner 產物。

floorOcclusionExclusions：
  驅動 floor metadata validity 與 atlas alpha。
```

第一版資料形狀可參考：

```json
{
  "id": "north_wall_solid_footprint",
  "surfaceId": "floor_open",
  "configId": 1,
  "sourceObject": "north_wall",
  "bounds": {
    "x": [-2.11, 2.11],
    "z": [-2.074, -1.874]
  },
  "policy": "invalidate_floor_texel",
  "note": "Solid north wall footprint over floor."
}
```

上方 JSON 只表示欄位形狀。實際數值必須從專案程式碼核對後填入。

`north_wall_solid_footprint` 與家具模式無關，不應帶 `furnitureMode`。

家具 footprint 才需要 furniture mode，例如：

```json
{
  "id": "bed_main_footprint",
  "surfaceId": "floor_open",
  "configId": 1,
  "furnitureMode": "bed",
  "sourceObject": "bed.main",
  "bounds": {
    "x": [-0.027, 1.91],
    "z": [-1.874, -0.314]
  },
  "policy": "invalidate_floor_texel",
  "note": "C1 bed mode footprint over floor."
}
```

`atlasGroup` 若出現在 exclusion 記錄中，語意要對齊被作用的 owner surface。對這次來說，owner 是 `floor_open`，所以 atlas group 是 `shell`。床本身是 object，這不改變 floor exclusion 的 atlas group。

## 4. Codegen 規則

本階段不能觸發 GLSL shader source 改動。

硬性要求：

```text
1. 生成的 GLSL owner block 維持 byte-identical。
2. shaders/Home_Studio_Fragment.glsl diff 必須為空。
3. exclusion helper 只生成給 JS / scanner / validation。
4. exclusions 需要自己的 freshness key，例如 EXCLUSION_VERSION。
5. 不能只依賴既有 REGISTRY_VERSION，因為目前 REGISTRY_VERSION 只涵蓋 surfaces[]。
```

原因：

```text
大型 shader source 一旦變動，瀏覽器可能觸發完整重編譯。
本專案已實際遇過重編譯卡死。
bug#2 可由 metadata 與 atlas alpha 解決，因此 shader source 應維持不動。
```

## 5. Metadata 規則

要修 metadata 產生鏈，不能用 runtime 亮度門檻作正式解方。

目標函式：

```text
buildR7310C1FloorTexelMetadataRect
```

正確行為：

```text
每一個 floor texel：
  1. 先算 world position。
  2. 依 config / furniture mode 查 floorOcclusionExclusions。
  3. 若命中 exclusion：
       metadata valid = 0
       valid count 不累加
  4. 若未命中 exclusion：
       metadata valid = 1
       valid count 正常累加
```

亮度資料可作為 audit 證據。正式規則必須由幾何定義。

既有 floor metadata 裡的 west/east contact band 會夾 `worldX`，但不改 validity 欄位。這套 contact band 與新的 exclusion 是兩種不同機制，實作時要保留。

```text
既有 west/east contact band：
  調整 bake world position。
  不改 metadata valid。

新增 floorOcclusionExclusions：
  判斷 texel 是否被實體壓住。
  命中時 metadata valid = 0。
```

## 6. Alpha Sync 規則

floor atlas alpha 必須跟 metadata validity 同步。

目前 floor path 有鎖，會阻止 alpha sync 正確生效。這個鎖可以解除，但範圍必須收窄。

只允許以下身分使用 floor alpha sync：

```text
targetId = 1001
surfaceName = floor_open
configId = 1
atlasGroup = shell
rect floor package
metadata 含 exclusion output
```

不要讓 legacy floor package 或其他舊路徑吃到這條規則。

目前 `shouldSyncR7310C1AtlasAlphaToTexelMetadata` 的入參不足，只看 `patchId` 與 `metadataResult`。實作時要補 context，至少要能判斷：

```text
isRectCapture
surfaceName
configId
atlasGroup
exclusionApplied
```

對 floor 的放行條件要收斂到：

```text
isRectCapture == true
surfaceName == floor_open
configId == 1
atlasGroup == shell
exclusionApplied == true
```

## 7. 第一版 Exclusion Set

第一版至少涵蓋兩個已觀察到的 bug#2 區域。

```text
1. north_wall_solid_footprint
   目的：
     排除被北牆實體 footprint 壓住的地板 texel。

2. bed_main_footprint
   目的：
     排除 C1 bed mode 裡被床實體 footprint 壓住的地板 texel。
```

建議在 schema 中預留但先不啟用：

```text
south_wall_solid_footprint
```

南牆交界也可能有同型問題。第一版可以聚焦使用者已指出的北牆與床，但 schema 不應寫成只能處理這兩者。

北牆額外接觸 margin 要分兩段處理：

```text
Step A：
  先只排除實體 footprint，重烤後 audit。

Step B：
  若仍殘留硬黑接觸帶，再建立具名幾何 margin 常數。
  margin 必須附 audit 證據與 overcut 檢查。
```

不要把 magic brightness cutoff 寫成正式規則。

## 8. Config 與 Furniture Mode

長期方向：

```text
採 per config / per furniture mode exclusion identity。
```

C1 第一版：

```text
可以先修 C1 bed mode。
floor bake package 必須宣告 furnitureMode 或等價狀態 hash。
```

`furnitureMode` 必須從 bake 當下的 C1 東北家具狀態寫進 pointer / package。後續 validation 要比對 package 的 furniture mode 與 runtime config，避免床模式烤圖被衣櫃模式誤載。

bed plus wardrobe union 只能作臨時診斷，不能作長期正式模型。

理由：

```text
床與衣櫃 footprint 不同。
取 union 會挖掉另一個模式中原本可見的地板。
```

## 9. 必須重烤

現有 floor package 的 metadata validity 已經錯誤。

修正 metadata 與 alpha 規則後，必須重烤 `floor_open`。

預期 bake 身分：

```text
targetId = 1001
surfaceName = floor_open
configId = 1
atlasGroup = shell
size = 3376 x 4264
texel density = 800 texel/m
bake contract = albedo-free
```

現有失敗 floor package 不能升為正式 pointer。

## 10. 驗收 Gate

全部 gate 通過後，這刀才算完成。

```text
1. Shader diff gate：
   shaders/Home_Studio_Fragment.glsl 無 diff。

2. Metadata identity gate：
   targetId == 1001
   surfaceName == floor_open
   configId == 1
   atlasGroup == shell

3. Exclusion alpha gate：
   exclusion footprint 內每個 texel alpha == 0。

4. Open floor protection gate：
   exclusion 沒有挖掉真正露出的地板。

5. Hard black gate：
   excluded contact zones 內不得殘留 alpha=1 且 luma=0 的有效硬黑 texel。

6. Valid ratio gate：
   valid ratio 符合 exclusion 後的預期範圍。
   不再要求接近 1.0。
   首版可先用 0.70 到 0.90 作防呆區間，重烤 audit 後再收斂。

7. Runtime gate：
   Floor RAW/OIDN 無北牆硬黑縫，也無床邊硬黑縫。

8. Isolation gate：
   North / east / ceiling / depth_h2 維持原樣。

9. Browser safety gate：
   使用低負載驗收。
   不跑長時間 preview loop。
   不碰 Brave。
```

## 11. 紅線

```text
1. 本修法不改 GLSL。
2. runtime luma threshold 不能當正式解方。
3. 使用者肉眼驗收前不 commit、不 push。
4. bake package gates 通過前不切正式 pointer。
5. 不混入 bug#1 cleanup。
6. bed/wardrobe union 不作長期正式模型。
```

## 12. OPUS 工作順序

Phase A：read-only 設計確認

```text
1. 確認目前 floor metadata 對所有 floor texel 都寫 valid=1。
2. 確認目前 floor alpha sync lock。
3. 確認 codegen 能只產 JS/scanner exclusion helper，且 GLSL 產物不變。
4. 從 source code 核對 north wall 與 bed footprint bounds。
```

Phase B：實作計畫

```text
1. 在 registry 新增 floorOcclusionExclusions。
2. 新增 EXCLUSION_VERSION 與 freshness checks。
3. 由 exclusions 生成 JS/scanner helper。
4. 修 floor metadata validity。
5. 只對 floor_open 窄化解鎖 alpha sync。
6. 新增 validation gates。
```

Phase C：重烤與驗收

```text
1. metadata 改完後重烤 floor_open。
2. 驗 metadata identity。
3. 驗 exclusion alpha。
4. 驗 excluded zones 無 alpha=1+luma=0 硬黑 texel。
5. 驗 open floor 沒被 overcut。
6. 用使用者 cameraState 低負載驗收。
```

## 13. 頁尾回報模板

OPUS 執行完後，把結果追加在本節後方。

```text
## OPUS Execution Report - YYYY-MM-DD HH:mm

Branch:
Commit status:
Shader diff:
Registry change:
Generated files:
Bake package:
Metadata identity:
Exclusion alpha result:
Open floor overcut result:
Hard black audit:
Runtime visual result:
User approval:
Remaining risks:
```

## OPUS Execution Report — 2026-06-17（Phase C 第一輪重烤）

- Branch：codex/r7-3-10-remaining-surfaces-xatlas
- Commit status：未 commit／未 push（依紅線）
- Shader diff：Phase B/C 無新增 GLSL 變更、shader 維持 Phase B 起點版本（byte-identical）
- Registry change：新增 floorOcclusionExclusions（north_wall/bed enabled、south_wall enabled=false）；EXCLUSION_VERSION 8264f92c8b30fc33（獨立於 REGISTRY_VERSION）
- Generated files：docs/generated/r7-3-10-floor-occlusion-table.mjs（新）；js/InitCommon.js 注入獨立 floor-occlusion GENERATED block
- Bake package：.omc/r7-3-10-full-room-diffuse-bake/20260617-102938（1000 SPP、63/63 tiles、無 context lost）
- Metadata identity：PASS — targetId 1001 / surfaceName floor_open / configId 1 / atlasGroup shell / furnitureMode bed；texel-metadata-patch-000-f32.bin 已寫入磁碟、690,972,672 bytes = 3376×4264×12 floats（B1 修法成功）
- Exclusion alpha result：北牆＋床 footprint 內 alpha=0、metadata field7=0（exclusion 機制驗證成功）
- Open floor overcut result：無過切 — room-centre(0,1.0) alpha=1 luma=0.19；純北牆貼邊(x=-1.5)實測 0cm 殘留黑（不需 Step-B margin）
- Hard black audit：FAIL — 東牆／工作桌／超低音／書櫃等所有座地家具壓住的地板仍 alpha=1+luma=0 純黑（未列首版 exclusion）。alphaExclusion gate 抓到 (1.912,-1.094)＝東牆。俯視圖證據：docs/r7-3-10-floor-rebake-audit.png（洋紅＝已排除北牆+床、純黑＝未排除座地家具殘留）
- Runtime visual result：使用者授權臨時切 pointer 至此包做網頁驗收（pointer note 已標 ⚠️臨時、未過 gate、非正式上架）
- User approval：待使用者網頁肉眼驗收 ＋ CODEX 裁示
- Remaining risks：validation 兩條 FAIL（見下）；pointer 臨時指向 fail 包，gate 全過前不得 commit／部署

### 問 CODEX（Phase C 第一輪結果，待裁示）

1. 範圍決策：Hard black audit 揭露黑縫源是「全室座地實體」——工作桌(20)、KH750 超低音(28)、東南書櫃(19)、東牆(5)、西牆(11)、南牆(8)、各角柱等所有 standsOnFloor 的實體壓住的地板都烤成 alpha=1+luma=0 純黑。首版只 exclusion 北牆＋床遠遠不夠。請裁示：甲＝把 exclusion set 擴成「全室座地家具＋牆」（schema 已支援、加 registry 條目即可一次治本；workflow occluder 盤點已備 33 個 footprint 座標）；乙＝維持首版只北牆＋床（但 alphaExclusion gate 會持續 FAIL）。

2. browserValidation：browser 端 validTexelRatio 門檻（InitCommon r7310C1ValidTexelRatioMinimumForSurface）floor 仍走 default 0.99，未同步 runner 的 floor_open 0.70-0.90 → exclusion 後 ratio<1 即 FAIL。建議 browser 端 floor 門檻同步改 0.70（＋上限對齊）。必修、簡單，待點頭。

3. gpu-submission-ms-over-250（runnerFailedChecks 第三條，效能診斷、非正確性）：fence 模式下最終 tile readback 累計 316.9ms，使單次 submission boundary 349.2ms 超過 250ms 警戒線。但本次 63/63 tiles 完成、minCompletedSamples 1000、timedOut=false、contextLostCount=0 → 不影響烤值正確性，屬 GPU 看門狗安全餘裕診斷。請裁示是否要把最終 readback 分段（降單次 boundary 時間）；非阻斷項，可延後。

3. audit 取樣盲區：floorAlphaExclusionCheck 外側 open-floor 取樣，對「貼牆 footprint 邊」會戳到鄰接的未排除遮擋面（床東緣 x=1.91 緊貼東牆 x=1.91）。若採甲，東牆進名單後此盲區自然消失；若採乙，audit 外側取樣需加「該點不屬任何已知座地實體 footprint」過濾。

---

## OPUS Execution Report — 2026-06-17（Phase C2：採甲，全室座地實體 footprint）

CODEX 第二輪裁示（採甲、升級為正式幾何規則、純 geometry 來源不從黑圖倒推）執行進度。

### 第 1 步 擴 registry（完成）
- footprint 來源＝ js/Home_Studio.js box 定義 min/max 的 XZ 投影，判準「min.y ≤ 0.025（直接佔住 floor 平面）」，零黑圖倒推。
- 獨立 critic（Opus）交叉驗證：座標零誤差、L85–215 無漏箱、無過切、configIds/furnitureMode 正確 → ACCEPT-WITH-RESERVATIONS（三項收口已全採納）。
- 定稿 11 條（10 enabled + 1 wardrobe reserved）：
  - 固定（furnitureMode null, configIds[1,2,3,4]）：north / east / west / south（本輪改 enable，牆厚帶 z[3.056,3.256] 不切可見地板、零過切）/ southeast_column / desk / southeast_bookshelf / kh750_subwoofer / southwest_drawer（含西南角柱 L117 union）
  - 家具模式：bed_main（furnitureMode bed, configIds[1], enabled）/ northeast_wardrobe（furnitureMode wardrobe, configIds[1], enabled=false reserved，雙重保險不污染本輪 bed bake）
- 每條附 sourceObject(box 行號)、bounds、margin.meters=0、policy=invalidate_floor_texel。

### 第 2 步 codegen（完成）
- 重生 docs/generated/r7-3-10-floor-occlusion-table.mjs（EXCLUSION_VERSION da6f1044→7c7f6d7cab9d02ce、11 條、isFloorOccluded 三道 gate：enabled→configIds→furnitureMode→bounds）+ InitCommon floor-occlusion block。
- **GLSL byte-identical 確認**：shasum 前後皆 `ebd39f72…`（surfaces[] 未動→glsl owner block 不變→零 Metal 重編譯風險）。

### 第 4 步 靜態 gate（完成）
- node --check js/InitCommon.js：OK
- scanner：`0 BLOCK 0 WARN → PASS`（11 total / 10 enabled、hash 一致無 STALE）
- git diff --check：whitespace clean
- audit 盲區（前頁問 3）：採甲後東牆進名單，runner outside open-floor audit import 更新後 isFloorOccluded（11 條）自動過濾鄰接遮擋，盲區消失。

### 第 3 步 valid ratio 門檻同步【揭露裁示參數需修正，待 CODEX 拍板】
- 用 buildR7310C1FloorTexelMetadataRect 同一 UV→world 公式純 CPU 精算（無需重烤）：
  **全室排除後 validTexelRatio = 0.6281（occluded 37.19%）**。
- per-footprint first-hit texel 占比：bed 13.44% / east 4.38% / west 4.38% / north 3.75% / south 3.75% / desk 2.88% / sw_drawer 2.61% / bookshelf 1.10% / kh750 0.56% / se_column 0.33%。
- **你第 3 點指定的 [0.70, 0.90] 對全室排除不適用**：0.628 < 0.70 下限 → browser + runner 都會 FAIL。
  - 對照：第一輪只排北牆+床=17% → ratio 0.828（落 0.70–0.90，故第一輪 runner PASS）；全室 37% → 0.628。
- OPUS 建議區間 **[0.55, 0.70]**：真值 0.628 居中；下限 0.55 容 Step-B contact margin 再排除；上限 0.70 擋住第一輪不完整包(0.828)與「排除未生效→ratio≈1」壞包。
- 待你拍板門檻值後一次同步兩端：
  - runner：floor_open min 0.70→?、max 0.90→?（docs/tools/r7-3-8-c1-bake-capture-runner.mjs L1221/L1228）
  - browser：InitCommon r7310C1ValidTexelRatioMinimumForSurface 加 floor_open 分支（現走 default 0.99）＋新增 r7310C1ValidTexelRatioMaximumForSurface＋buildR738ValidationReport L8928 加上限檢查。

### 第 5 步 Phase C2 最終重烤指令草案（待門檻定案＋你審＋使用者授權）
與第一輪 CODEX 已批准版相同（環境已更新成 11 條 footprint，runner bake 時 isFloorOccluded 自動套；config 1 / furnitureMode bed / tile 512 / fence / Chrome 強制非 Brave）：
```
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-xatlas-bake --r7310-full-room-diffuse-bake --r7310-separated-irradiance-bake \
  --r7310-bake-diagnostics \
  --atlas-width=3376 --atlas-height=4264 --target-samples=1000 \
  --http-port=9011 --cdp-port=9231
```

### 紅線現況
- 未 commit / 未 push；GLSL byte-identical；pointer 仍臨時指向第一輪 fail 包 20260617-102938。
- 依你第 6 點，臨時 pointer 待退回 20260616-200401 或限 diagnostic override。

### 待 CODEX 裁示（Phase C2）
1. valid ratio 門檻區間：採 OPUS 建議 [0.55, 0.70]？或你給最終 min/max？（精算真值 0.628）
2. 臨時 pointer：現在就退回 20260616-200401，還是等門檻定案＋重烤新包後直接切？
3. 重烤指令草案確認後，使用者授權我才執行重烤。

---

## CODEX Phase C2 裁示落實 — 2026-06-17（重烤前 gate 全過）

CODEX 裁示 7 點全部落實，重烤前 gate 全綠，待使用者授權執行重烤。

### 裁示落實
1. footprint 11 條：ACCEPT（CODEX 獨立重算 validTexelRatio=0.6280718436，與 OPUS 0.6281 一致）。
2. 門檻：採 CODEX 值 min=0.62 / max=0.64（REJECT OPUS 的 [0.55,0.70]，緊貼 expected 0.6281）。兩端同步：
   - runner floor_open min 0.62（L1221）/ max 0.64（L1228）
   - browser InitCommon：r7310C1ValidTexelRatioMinimumForSurface 加 floor_open→0.62；新增 r7310C1ValidTexelRatioMaximumForSurface floor_open→0.64；buildR738ValidationReport 加上限檢查
3. 臨時 pointer：已退回 20260616-200401（⚠️該包 validation 亦 fail＝exclusion 前基準、無排除、有已知黑縫，非 gate-pass；目前無真正 pass 的 floor 安全包，這正是 bug#2 追求的第一個 pass 包）。FAIL 包 20260617-102938 不再當預設。
4. 重烤指令：採 CODEX 修正版 full-floor-xatlas 專用入口（--r7310-surface=full-floor-xatlas / --samples，棄 generic --r7310-xatlas-bake / --target-samples）。
6. GPU submission 診斷：暫不處理（依 CODEX）。

### 重烤前 gate（CODEX 第 5 點，全過）
- runner floor_open min/max = 0.62/0.64 ✓
- browser floor_open min/max = 0.62/0.64 ✓
- pointer 已退回安全基準 200401 ✓
- node --check：InitCommon / runner / pointer JSON 全 OK ✓
- scanner：0 BLOCK 0 WARN PASS（11 total / 10 enabled、hash 一致）✓
- git diff --check：clean ✓
- 本輪無新增 GLSL：hash ebd39f72 byte-identical（codegen ＋ 門檻 Edit 前後一致）✓

### 待執行（使用者授權後）
Phase C2 重烤（CODEX 第 4 點指令）：
```
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=full-floor-xatlas \
  --r7310-full-room-diffuse-bake \
  --r7310-separated-irradiance-bake \
  --r7310-ne-furniture=bed \
  --atlas-width=3376 --atlas-height=4264 \
  --samples=1000 \
  --r7310-bake-tile-width=512 --r7310-bake-tile-height=512 \
  --r7310-bake-submission-boundary=fence \
  --timeout-ms=3600000 \
  --http-port=9011 --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```
預期：validTexelRatio≈0.628 落入 [0.62,0.64] PASS；全室 footprint alpha=0；open floor alpha=1 且 luma 正常；無 alpha=1+luma=0 硬黑有效 texel。重烤後驗第 7 點全項，gate 全過才切正式 pointer（不 commit / push 直到使用者肉眼驗收）。

---

## OPUS Phase C2 重烤結果 — 2026-06-17（runner bug 修復 + status PASS + KH150 殘黑發現）

### 重烤 status PASS（package 20260617-131107）
- 第一次重烤(124208) status fail 根因＝runner floorAlphaExclusionCheck texelAt 把 Node Buffer 當 Float32Array 索引（atlasBuffer[texel*4+3] 讀 byte 而非 float alpha），desk center byte=62 → 誤判 alpha>0.5 → alphaExclusion **假性** FAIL。atlas 本身完全正確（proof：footprint alpha=0.0000、open floor alpha=1.0 luma=0.19）。
- 修法（runner 工具，不碰 shader/atlas）：texelAt 改 readF32LE(i+3)（與檔內 dilation 既有讀法一致）；依 CODEX 第 6 點把 gpu-submission/readback 改非阻斷 diagnostic（真故障 context-lost/timeout 仍阻斷）。
- 重烤 131107 全 gate PASS：status pass、runnerStatus pass、alphaExclusion true、validTexelRatio true(0.6281∈[0.62,0.64])、browserValidation true、runnerFailedChecks []、runnerDiagnostics[gpu-submission-ms-over-250]（非阻斷記錄保留）。
- 獨立驗證（不只信 runner）：抽樣 audit issues 0；GLSL ebd39f72 byte-identical；identity floor_open/1001/config1/bed/3376×4264/1000spp；全 atlas 統計 alpha=0 37.19% / alpha=1 62.81% / valid mean luma 0.2621。

### 全室 footprint 排除成功
11 條 footprint（北/東/西/南牆 + 東南角柱 + 工作桌 + 書櫃 + KH750 超低音 + 西南抽屜 + 床）alpha=0 全生效。北牆/床/全室座地家具牆的黑縫消除。

### 新發現：KH150 懸空主監聽喇叭下方殘黑（非座地 occlusion 範疇）
- 全 atlas 掃描發現 96004 個 alpha=1 + luma<0.001 hard-black valid texel（CODEX 第 7 點要 0）。
- 定位：95999（100%）孤立、非接觸帶（接觸帶僅 5 個）；集中 x[-0.751,1.003] z[0.793,2.743]，兩個左右對稱 toe-in 傾斜塊。
- 根因＝KH150 一對主監聽（js/Home_Studio.js:759/764 uLeft/RightSpeakerInvMatrix；center x±0.568 y1.097 z0.984、half[0.1125,0.1725,0.1365]、rotY±30°）懸空在桌後地板上方約 1m，擋頂光 → 下方地板烤近黑。另有少量南方木桌板（L123 懸空 min.y=0.63）下方。
- 性質：懸空物（min.y≈0.92 >> 0.025）真實陰影，非「座地實體壓住不可見地板」→ 不在 Phase C2 occlusion footprint 判準內。地板那兩塊 runtime 從桌後斜視角可見。
- 待判斷：bake 是否過黑（喇叭距地約 1m、僅 0.27m 寬，LIVE 理應有間接光半影而非純黑）→ 需對照 LIVE。若 bake 漏間接光＝從 bake 端修（worldPos/bake ray/dilation，不退 LIVE）；若 LIVE 也近黑＝視覺正確、CODEX 第 7 點 gate 對懸空物真陰影放寬。
- 證據圖：docs/r7-3-10-floor-c2-hardblack-audit.png（亮綠=hard-black valid、暗洋紅=excluded footprint、灰=正常地板）。

### 待 CODEX 裁示（Phase C2 重烤後）
1. KH150 殘黑方向：甲＝對照 LIVE 確認 bake 是否過黑（過黑則 bake 端修）；乙＝接受懸空物真陰影、gate 對其放寬。
2. Phase C2 座地 occlusion exclusion 主體已 gate PASS，是否認可「座地 footprint 治本完成」（KH150 懸空喇叭另案處理）。
3. 切正式 pointer（指向 131107）：待 KH150 裁示 + 使用者肉眼驗收後。
4. runner 兩處修法（texelAt readF32LE 鐵證 bug、gpu-submission 改非阻斷依第 6 點）請審。

---

## OPUS KH150 殘黑根因確認 — 2026-06-17（4 路並行調查 + 親驗，high confidence）

### 根因（鐵證）
- ＝喇叭監聽架「貼地底座 StandBase」漏列 footprint ＋ bake 烤點埋在底座內部，雙重疊加。
- 喇叭架是 `rotatedObjects`（InvMatrix 旋轉物件，js/Home_Studio.js:757-768），非 addBox → 前次 footprint 盤點（只掃 addBox）漏掉整組腳架。
- 已掃完 rotatedObjects 8 件：每聲道 Speaker(y[0.924,1.269] 懸空) / **StandBase(y[0.0,0.03] 座地)** / StandPillar(y[0.03,0.89] 懸空) / StandTop(y[0.88,0.90] 懸空)。僅左右 2 個 StandBase 座地（min.y=0）。
- StandBase：center[∓0.56825, 0.015, 0.9842] half[0.125, 0.015, 0.15] rotY∓30°，y[0,0.03] 座地壓住地板。
- bake 地板烤點 y=0.01 落在 StandBase 內部。glsl:7504 bounce0 重導 cos 加權向上半球 gather ＋ glsl:7525 sampleLight=FALSE，射線從實體內發出 → 100% 自交底座/立柱/頂板（Monte Carlo 20 萬條、0% 抵天花板）→ radiance 精確 0。

### 性質
座地實體壓住地板（與其他 11 條 footprint、牆底同類），非懸空物柔和半影。漏箱，非新類問題。底座壓住的地板看不到（無 first-hit ray），排除讓位 LIVE 後正確（不憑空亮、不顯黑）。

### 鐵證
- metadata worldPos 正確對應地板（worldY=0.01、normal=(0,1,0)、validity=1、type=1）但 atlas luma 精確 0；非 UV 錯位、非 validity 誤排除、非 RNG firefly。
- 三包（131107/124208/200401）同 texel 全部精確 luma=0.000000 → 穩定結構性。
- hard-black 95999/96004（100%）孤立、x 範圍與 StandBase 旋轉投影吻合（左 px=1233 / 右 px=2142 py=2446 中心 luma=0）。
- 證據圖 docs/r7-3-10-floor-c2-hardblack-audit.png（亮綠＝hard-black、暗洋紅＝excluded footprint、灰＝正常地板）。

### 修法（純 JS、GLSL byte-identical、不憑黑圖倒推）
補左右 StandBase footprint 進 floorOcclusionExclusions。底座 rotY±30° → 斜矩形，外接 AABB 過切約 47% 可見亮地板，故需精確旋轉盒。

### 待 CODEX 裁示（KH150）
1. footprint 形狀：甲＝registry/codegen 加 `rotatedBox(center/halfX/halfZ/rotY)` 精確旋轉盒（零過切，改 codegen 生成 + isFloorOccluded 旋轉盒 inside 測試，全純 JS）；乙＝外接 AABB（省事但過切約 47%）。OPUS 傾向甲。
2. 是否認可「StandBase 為唯一漏箱」（rotatedObjects 8 件已掃，僅 2 座地）。
3. 採行後流程：補 registry → codegen 重生 → 靜態 gate → CPU 預判 hard-black 歸零 → 貼重烤指令（待使用者授權）→ 重烤後渲染 LIVE 最終確認。

---

## OPUS Phase C3 實作完成 — 2026-06-17（StandBase rotatedBox，靜態 gate 全過，待重烤授權）

CODEX KH150 裁示（採甲 rotatedBox、門檻 0.618/0.625、流程 11 步）執行。

### 正式根因定稿（CODEX 第 9 點）
KH150 殘黑根因以「喇叭架貼地底座 StandBase 漏列 footprint」為正式根因。前文「懸空主監聽喇叭陰影」段保留為調查過程記錄，後續判讀以 StandBase 為準。不把懸空 Speaker/StandTop 納入 exclusion。

### 實作（純 JS、GLSL byte-identical）
- registry：補 left/right_kh150_stand_base_footprint，shape=rotatedBox，centerXZ[∓0.56825,0.9842] halfXZ[0.125,0.15] rotY∓0.5235987755982988（∓30°），configIds[1,2,3,4] furnitureMode null margin 0 enabled true。
- codegen：exclusionFields 加 shape/centerXZ/halfXZ/rotY；isFloorOccluded(table) + r7310C1FloorOccluderExcluded(InitCommon block) 加 rotatedBox inside 測試（dx/dz 反旋轉 → abs(localX)≤halfX && abs(localZ)≤halfZ）。EXCLUSION_VERSION 0855219c081d5962（13 條）。
- runner：floorAlphaExclusionCheck 加 rotatedBox 分支（inside/outside 取樣走局部→world 旋轉，outside 過濾用同一 isFloorOccluded）；門檻 floor_open 0.618/0.625。
- browser：InitCommon r7310C1ValidTexelRatioMinimum/MaximumForSurface floor_open 0.618/0.625。
- scanner：exclusionFields map 同步 rotatedBox 欄位（hash 一致）；bounds 檢查加 rotatedBox 分支（驗 centerXZ/halfXZ/rotY）。

### 靜態 gate（CODEX 流程步驟 3-9，全過）
- GLSL byte-identical：ebd39f72（codegen 前後一致）✓
- scanner：0 BLOCK 0 WARN PASS（exclusions hash 0855219c081d5962 = table，13 total / 12 enabled）✓
- node --check：InitCommon / runner / codegen / scanner 全 OK ✓
- git diff --check：clean ✓
- CPU 精算 validTexelRatio：0.6214027058（與 CODEX 獨立精算逐位元一致）✓
- 門檻：runner + browser floor_open 0.618/0.625 ✓
- StandBase 命中：左右底座中心 true、底座間(0,0.984)/外緣(-0.3,0.984) false（零過切）✓

### 待執行（CODEX 流程步驟 10-11：使用者授權後重烤）
Phase C3 重烤指令（CODEX 第 7 點，維持 full-floor-xatlas 專用入口、同 Phase C2）：
```
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-surface=full-floor-xatlas --r7310-full-room-diffuse-bake --r7310-separated-irradiance-bake \
  --r7310-ne-furniture=bed --atlas-width=3376 --atlas-height=4264 --samples=1000 \
  --r7310-bake-tile-width=512 --r7310-bake-tile-height=512 --r7310-bake-submission-boundary=fence \
  --timeout-ms=3600000 --http-port=9011 --cdp-port=9231 \
  --browser-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```
重烤後驗 CODEX 第 8 點 10 項（重點：全 atlas hard-black valid texel = 0、左右 StandBase rotatedBox alpha=0、validTexelRatio∈[0.618,0.625]、GLSL 無本輪新增）。gate 全過 + 使用者肉眼驗收後才切正式 pointer（不 commit / push）。

### Phase C3 重烤結果 — 部分改善，殘留外環待裁示（package 20260617-143939）
- 重烤 status：alphaExclusion fail（其餘全 pass：validTexelRatio 0.6214∈[0.618,0.625]、browserValidation、63/63 tiles、無 context lost、GLSL ebd39f72）。
- hard-black：96004 → 16702（StandBase 排除消除 83%）。
- StandBase 底座投影：100% 排除無漏網（盒內 hard-black=0）。
- 殘留 16696 全在 StandBase 旋轉盒【外】環：超出底座 half p50 1.69cm / p95 5.06cm / p99 5.99cm / max 6.69cm（其他區僅 6 texel）。
- 根因更新：hard-black ≠ 底座垂直投影；= 整個喇叭架（StandBase + Pillar + Speaker y1.27m + Top）向上 cosine gather(glsl:7504) + sampleLight=FALSE(glsl:7525) 的半遮蔽攔截區，比底座大一圈最寬 6.7cm。bake 對「被高處 Speaker 半遮蔽的可見地板」算過黑（主樣本撞非自發光喇叭面回 0）。
- 性質：外環是「可見地板 + bake over-dark」（非底座壓住的不可見地板）；lighting probe 估該 luma≈0.25 半遮蔽。排除讓位 LIVE 可修（LIVE 算對半遮蔽），但屬「可見地板讓位」非「不可見排除」。
- 證據圖 docs/r7-3-10-floor-c3-hardblack-audit.png（底座洋紅=已排除、周圍綠環=殘留）。

### 待 CODEX 裁示（Phase C3 殘留外環）
StandBase rotatedBox 精確涵蓋了底座本身（盒內 100% 排除），但 hard-black 實際是「喇叭架整體半遮蔽攔截」大一圈 6.7cm。修法選項：
1. footprint 形狀升級：圓形/橢圓 footprint（centerXZ + 半徑 ~7cm）涵蓋 Speaker 投影錐，或 rotatedBox halfXZ 放大加 margin。涵蓋外環讓位 LIVE（LIVE 算對半遮蔽）。中間 x[-0.378,0.378] 亮地板不受影響（兩底座 +6cm margin 不連通）。
2. bake 端 alpha-aware dilation（runner alphaAwareR7310C1XatlasDilation L1627）填殘留黑。
3. 對照 LIVE 先確認外環該多亮（該 0.25 半遮蔽 or 真黑），再定形狀/半徑。
OPUS 傾向先走 3（LIVE 對照定外環性質）再 1（圓形 footprint 涵蓋），避免憑黑圖倒推、用 Speaker 幾何半徑定 footprint。

---

## OPUS Floor Bake Integrator Parity Probe 結論 — 2026-06-17（CODEX HOLD 後，read-only，CPU 親驗）

CODEX 第 7 點 read-only 調查完成（4 路 Workflow + OPUS 親驗）。不修。**前述「圓形 footprint」傾向作廢**——CODEX HOLD 正確，調查證實不該加形狀。

### root cause = indirect_sampling_contract（high confidence）

### 地理釐清（OPUS 親驗 isFloorOccluded，推翻 atlas-parity agent 盒內誤判）
- 三探針點 (-0.469,0.87)/(-0.707,1.019)/(-0.741,1.052) 與 16696 hard-black 族群【全在 StandBase 旋轉盒外】：isFloorOccluded=false、signed-dist +1.81/+1.26/+5.85cm、C3 metadata valid=1。
- 是盒外可見地板 over-dark，非底座壓住的不可見地板。StandBase rotatedBox 判定正確、盒內已乾淨、不需重判 OBB。
- atlas-parity agent 誤判「盒內」＝其 footprint 公式 rotY 符號搞反；已用 generated isFloorOccluded（與 C3 bake 同源、validTexelRatio 與 CODEX 逐位元一致）推翻。

### D800 parity 定論（排除 d800_runtime_hides）—— OPUS 親驗
| 點 | C3 luma | D800 luma |
|---|---|---|
| 三 ring 點 | 0 | 0 |
| 底座中心 +x 0/4/8/12cm | 全 0 | 全 0 |
| +16cm | 0.098 | 0.044 |
| open(0,0) | 0.204 | 0.101 |
- D800 同座標【也是 luma=0、黑環同型】（0-12cm 黑、16cm 回光），與 C3 同量級。
- D800 不是正常、它一樣黑，只是當年沒追（D800 validation reprojectionStatus=fail、medianRelativeLumaError=0.628）。
- 結論：這是 floor bake integrator【既有病灶】、非 C3 退步、非 d800 藏掉、非 footprint 判錯。
- 註：open 點 C3 是 D800 ~2x（全域 scale 差，另議題，與黑環無關）。

### 根因鏈（indirect_sampling_contract）
- floor bake first-hit 把朝上 cos gather ray 設 sampleLight=FALSE 後 continue（glsl:7516-7527 D800 / 7742-7753 C3），gather ray 命中點不做 NEE。
- open 點 ~98% 撞天花板/牆漫射面 → 下一 bounce 取燈光 → 非零。
- stand-shadow 點上方 9-12% 命中喇叭架金屬（C_STAND albedo 0.08 / StandPillar metalness 1.0）→ specular + mask*=hitColor 近黑 → 幾乎不做有效 NEE → 吃掉通量；1000 SPP 下有效間接樣本塌成 0。
- 排除 bake_ray_origin：Monte Carlo（N=20萬）這些點 open-sky 88-91%（喇叭架只遮 9-12%），物理該有 ~0.18 luma 柔影；origin 沿 +Y 抬 8×EPS、bounce0 朝下命中地板自身、redirect 後才朝上，非自交。

### 修法困境（需 CODEX 裁示）
- 候選 B 根治 = 改 floor bake first-hit 的 sampleLight=FALSE 契約（讓 cos gather ray 命中喇叭架後補 NEE/indirect bounce）→ 【要改 glsl floor bake integrator → 撞 M4 Metal 全量重編譯卡死鐵則】（記憶 r7310-shader-recompile-freeze）。
- 提高 SPP（不改 glsl）不夠：D800 10000 SPP 黑環仍同型。
- texel y 抬離底座（純 JS）：synth 列為輔助，但自交非主因、緩解有限。

### 待 CODEX 裁示
1. 甲：承擔一次性 glsl 重編譯卡死風險，改 floor bake sampleLight 契約根治（讓 cos gather ray 命中喇叭架/支架後補有效間接光）。
2. 乙：承認 floor bake 對「被高物半遮的可見地板」over-dark 是既有架構限制（D800 也有），16696 薄環先記錄不修；Phase C3 以「StandBase 盒內清乾淨 + 全室 13 footprint 治本」收斂；runner alphaExclusion gate 對「喇叭架半遮薄環（非 C3 引入、D800 同型）」放寬。
3. 丙：其他不改 glsl 的修法。
OPUS 傾向：乙（既有限制、誠實記錄收斂）或甲（若 CODEX 願承擔卡死風險根治）。needsLiveRender：任一修法後須 LIVE 終驗。
全程未重烤／未切 pointer／未 commit／未 push。

---

## OPUS Render-Space Proof 結論 — 2026-06-17（CODEX 第二次 HOLD 後，read-only）

CODEX 第二次 HOLD：使用者提供同視角 LIVE vs RAW 對照圖（桌面 地板LIVE.png / 地板烘焙RAW.png），要 render-space proof 決定 KH150 外圈 hard-black 是否畫面可見瑕疵。完成（read-only，未改任何運行碼）。

### 結論：KH150 外圈 atlas hard-black 在最終畫面【完全不可見】

### 證據（逐像素，全 CPU 親驗）
- 兩圖同視角同尺寸 2784×3054；全圖（含 UI）亮度差 mean 0.57/255。
- 喇叭架旁地板區 LIVE vs RAW（亮度 0-255）：

| 區域 | LIVE 均 | RAW 均 | diff 均 | diff>25 像素 |
|---|---|---|---|---|
| 喇叭架底座旁（hard-black 投影區） | 95.7 | 96.3 | 0.86 | 0.00%（8/27萬） |
| 喇叭架右旁 | 112.3 | 112.0 | 0.61 | 0.00% |
| open floor 對照 | 72.6 | 72.6 | 0.14 | 0.00% |

- hard-black 投影區 diff 0.86/255（<0.4%），RAW 甚至略亮（96.3>95.7），diff>25 像素 0.00%。
- diff 熱圖：喇叭架旁地板全黑（diff≈0），微弱紅只在喇叭架幾何邊緣（SPP noise，LIVE 1000 vs RAW 210 SPP）＋ UI。
- 並排圖：LIVE/RAW 喇叭架旁地板柔和暗影一致、無純黑硬圈、肉眼無法區分。
- 證據圖：熱圖 docs/r7-3-10-floor-live-vs-raw-diff.png；並排 docs/r7-3-10-floor-live-raw-sidebyside.png。

### 為何 atlas hard-black 不形成畫面瑕疵
atlas = indirect-only diffuse radiance（directLightAlreadyIncluded=false）。runtime floor hybrid = atlas indirect lookup ＋ 後續 NEE 直接光 ＋ albedo 乘。喇叭架旁地板 indirect=0（hard-black），但直接光＋albedo 補成亮度 96 的柔和暗影。所以 atlas 的 alpha=1+luma=0 ≠ 畫面黑。

### CODEX 裁判條件成立
render-space 差異肉眼不可見（diff 0.86/255）、數值差異只在喇叭架幾何邊緣（SPP noise）與 UI、不在地板可見區。
→ 依 CODEX 裁判：KH150 外圈 hard-black 記為 **atlas audit warning、不作正式阻斷**；Phase C3 回到「座地 footprint 排除是否通過」主線。

### 待 CODEX 確認下一步
1. 如何落實「audit warning」：runner alphaExclusion 對「喇叭架半遮薄環（indirect-only atlas 特性、畫面不可見、D800 同型）」歸 warning 而非 BLOCK？（需改 runner audit，待你裁示，OPUS 不擅改 gate）
2. Phase C3 收斂判定：座地 footprint（11 AABB + 2 StandBase rotatedBox）排除有效、盒內清乾淨，是否認可治本完成。
3. 全程未改 shader/integrator/footprint/gate、未重烤、未切 pointer、未 commit、未 push。

---

## OPUS CODEX Render-Space ACCEPT 裁示落實 — 2026-06-17（audit 裁判分類）

CODEX render-space proof ACCEPT，裁示 6 點落實。不改 shader/integrator/footprint、不重烤。

### audit 裁判分類（runner floorAlphaExclusionCheck，CODEX 第 1/3/5/6 點）
- 加 warnings[]：rotatedBox（KH150 StandBase）的 outside ring「alpha=1+luma=0」→ 具名 WARN（render-space proof 已證畫面不可見、diff 0.86/255），非 BLOCK。
- 其餘仍 BLOCK（不廣泛放行，CODEX 第 5 點）：座地 footprint inside alpha 未清、open floor overcut（alpha<0.5）、其他 footprint（非 KH150）ring hard-black、room-centre。
- validatePayload：alphaExclusion = result.ok（只看 BLOCK issues）；warnings 記入 validationReport.alphaExclusionWarnings（保留證據，CODEX 第 1 點）。
- 判斷條件：e.id.indexOf('kh150_stand_base')>=0（具名，只放 render-space proof 已證的 KH150 ring）。

### 驗證（修正後 audit 對 143939，CPU 模擬）
- issues(BLOCK): 0（空）→ 座地 footprint 11 AABB + 2 StandBase 盒內清乾淨、無過切。
- warnings(KH150 ring 具名): 4（左右 StandBase 各 2 ring 點：(-0.46,0.92)(-0.68,1.05)(0.68,1.05)(0.46,0.92)）。
- alphaExclusion ok = true → PASS（從 KH150 ring 阻斷釋放）。

### 靜態 gate（全綠）
- node --check：runner / InitCommon / codegen / scanner 全 OK。
- scanner 0 BLOCK 0 WARN PASS（13 total / 12 enabled、hash 0855219c081d5962 一致）。
- git diff --check clean；GLSL ebd39f72 byte-identical。

### Phase C3 收斂狀態
- 座地 footprint 治本方向成立：11 AABB + 2 StandBase rotatedBox，盒內清乾淨。
- KH150 外圈 = indirect-only atlas audit warning（畫面不可見、D800 同型），不再作重烤阻斷。
- 143939 atlas 正確（裁判邏輯已修正、CPU 模擬 alphaExclusion PASS）；官方 validation-report.json 仍為舊 runner 跑出的 fail（依 CODEX 不重烤、runner 無 revalidate-only，未重跑）。
- 紅線：未改 shader/integrator/footprint、未重烤、未切 pointer、未 commit、未 push（pointer 仍安全基準 200401）。

### 待使用者/CODEX 拍板
- 是否重跑 143939 validation（用修正後 runner 產生官方 alphaExclusion PASS report）——需重烤（runner 無 revalidate-only），CODEX 暫禁。
- pointer 切換(143939)／commit／push：等使用者明確拍板。

---

## OPUS Phase C3 官方 PASS 重烤 — 2026-06-17（package 20260617-164025，CODEX 第 5 點達成）

CODEX 授權重烤（5 條件全滿足）執行，產生官方 PASS validation-report。

### 重烤條件（CODEX 第 5 點，全滿足）
- 不改 shader（GLSL ebd39f72 byte-identical）✓／不改 integrator（未碰 glsl bake）✓／不新增 footprint（13 條不變）✓／用已簽收 WARN/BLOCK 分級（修好的 runner audit）✓／烤後 validation-report 自然 PASS + alphaExclusionWarnings 含 KH150 ring ✓

### 官方 validation-report（package 20260617-164025）
- status: pass / runnerStatus: pass / browserValidationStatus: pass
- runnerChecks 全 true：alphaExclusion true、validTexelRatio true、browserValidation true
- runnerFailedChecks: []
- alphaExclusionWarnings: 4（左右 KH150 StandBase ring，各含「render-space proof 畫面不可見→WARN」）
- 1000 SPP、63/63 tiles、無 context lost、無 timeout

### 獨立驗證
- GLSL ebd39f72 byte-identical
- identity：floor_open / targetId 1001 / config 1 / bed / 3376×4264 / 1000 SPP
- 全 atlas：alpha=0 37.86% / alpha=1 62.14% → validTexelRatio 0.6214（∈[0.618,0.625]）/ valid mean luma 0.2623
- hard-black 16702（KH150 ring，與 143939 同型；render-space proof 證畫面不可見、diff 0.86/255）
- audit_verify CPU 模擬：BLOCK 0、KH150 ring 4 WARN、alphaExclusion PASS

### Phase C3 治本完成
- 座地 footprint（11 AABB + 2 StandBase rotatedBox）排除全室座地實體壓住的不可見地板，盒內清乾淨。
- KH150 外圈 = indirect-only atlas audit warning（畫面不可見、D800 同型），具名記錄於 alphaExclusionWarnings。
- 官方 PASS 包：20260617-164025（取代 143939 fail 驗證包、102938 第一輪、200401 exclusion-前基準）。

### 待使用者/CODEX 拍板
- pointer 切換到 164025（官方 PASS 包）：等使用者肉眼最終確認 + 拍板。
- commit / push：等使用者拍板。
- 紅線：未切 pointer（仍安全基準 200401）、未 commit、未 push。

## OIDN 收尾 — 2026-06-17（CODEX GREEN 簽收）

使用者拍板切 pointer 到官方 PASS 包 164025、棄用舊基準後，回報「切到 OIDN，床底又出現黑縫」。OPUS 診斷＝stale pointer，非 regression、非 shader/integrator bug。

### SOP（換 RAW 官方包後必做，CODEX 裁示 B）
地板烤圖有**兩個獨立 runtime 指標檔**，runtime 依 RAW/OIDN 模式（「全室真非方格」三態鈕 關閉→RAW→OIDN）切到不同 package JSON：
- RAW：`docs/data/r7-3-10-xatlas-full-floor-runtime-package.json` → `atlas-patch-000-rgba-f32.bin`
- OIDN：`docs/data/r7-3-10-xatlas-full-floor-oidn-runtime-package.json` → `atlas-patch-000-oidn-rgba-f32.bin`

換新 RAW 官方包時，**必須**：
1. 對新 RAW atlas 跑 OIDN bridge（同 RAW 目錄輸出 OIDN bin）。
2. 同步切 RAW / OIDN 兩個 package JSON，**兩 pointer 必須指向同一 packageDir**。
3. OIDN metrics 必須 `passDecision: pass`；OIDN `nonzeroRatio` 必須對齊 RAW `validTexelRatio`（證實 OIDN 從 alpha 重建 mask、繼承全部 footprint）。

只切 RAW、忘了 OIDN → OIDN 模式載到舊包舊圖（本輪：OIDN 仍指 200401＝C2/C3 footprint 之前、缺 bed_main 床底排除 → 床底黑縫殘留）。

### 根因（檔案層實證）
- OIDN 指標仍指 `20260616-200401`（400 SPP、status fail 舊探針、Phase C2/C3 footprint 之前）。
- 且 164025 資料夾原本無 OIDN bin（只有 RAW）。
- nonzeroTexels：200401=8,962,199 vs 164025=8,928,562（差 33,637＝C2/C3 新增 footprint 含床底）。

### 修法（零重烤、未改 shader、GLSL byte-identical）
```
node docs/tools/r7-3-10-oidn-bridge.mjs \
  --in=164025/atlas-patch-000-rgba-f32.bin \
  --out=164025/atlas-patch-000-oidn-rgba-f32.bin \
  --filter=RTLightmap --quality=high --aux=beta --dilation=128 --width=3376 --height=4264
```
沿用 200401 同參數（Metal、OIDN 2.4.1、~4.3s）。

### OIDN 產物 metrics（164025）
- passDecision pass / deviceUsed metal / OIDN 2.4.1 / nanCount 0 / infCount 0。
- nonzeroRatio 0.6214027057787894 ← 與 RAW validTexelRatio bit 對齊（繼承 13 footprint mask 含 bed_main）。
- bridge 機制：push-pull dilation 預填排除區（鄰近有效色）→ OIDN → post-mask 歸零；OIDN 全程不見硬黑、alpha=0 排除邊界不滲色。alpha=0 處 runtime 退 LIVE 與 RAW 同碼，故 OIDN 床底必與已驗乾淨 RAW 一致。

### 指標檔異動
- OIDN package JSON：packageDir 200401→164025、requestedSamples/denoise.inputSamples 400→1000、note。
- 同目錄輸出 → texel-metadata/validation 與 RAW 共用，不踩 OIDN bridge 旁證檔缺口。

### 驗收
- OPUS 9006 headless 自驗：套使用者 cameraState（floor-level facing 北）、OIDN、Samples 7，接觸柔影無黑縫、無 console error。
- 使用者 9002、OIDN、93 SPP：床底牆地交界柔和、黑縫消除。資料層 / 機制層 / HTTP 指標層 / 肉眼層四者一致。

### CODEX 裁示
- A：OIDN 收尾流程簽收（GREEN）。
- B：本節即「OIDN 收尾」SOP。
- C：commit 前列 staging 清單給 CODEX/使用者；正式收「地板 Phase C 完整功能包」或拆多個清楚 commit，不只偷收 OIDN pointer。
- D：不收 .omc 烤圖 bin/metadata、`docs/r7-3-10-deploy-pathB-no-lfs-for-codex.md`、其他另一條任務改動。
- E：push 等使用者明確說。

### 紅線
- 未 commit、未 push、未改 GLSL、零重烤。
