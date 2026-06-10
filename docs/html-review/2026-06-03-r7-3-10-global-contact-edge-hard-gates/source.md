# 真正全域邊界防呆：白話版共識

## 1. 文件目的

### 1.1 本文件的角色

這份文件把「全域邊界防呆」定義成可檢查、可驗收、可追責的工程標準。

### 1.2 核准原則

往後任何代理宣稱「全域完成」，都必須提出完整清單、probe 證據、使用者相機截圖、線性亮度數據、硬否決檢查結果。口頭保證與單張截圖都不算完成。

## 2. 目前結論

### 2.1 OIDN 降噪已收完

北牆 OIDN 降噪已完成。D800 1000 SPP raw 經 OIDN RT high color-only 後，使用者已完成 A/B 視覺驗收，效果明顯，這條工作已收完。

### 2.2 邊界問題仍待處理

西樑北端與北牆交界仍有黑線。這個問題與 OIDN 降噪品質無關，與邊界歸屬、atlas 邊緣連續性、接觸邊驗收有關。

### 2.3 A1 目前驗收樣本

目前可用的穩定事實是：使用者相機能看到西樑北端與北牆交界黑線；關閉北牆烘焙或關閉北東非方格時黑線消失。A1 在本文只作驗收樣本，最終 owner、route、luma 結論要由新資料表與重測 probe 建立。

## 3. 問題本質

### 3.1 現有架構的風險

目前 WebGL 架構靠手寫座標、box、gate、owner 來判斷每個 first hit 點屬於哪個 baked surface。這套做法能處理單面取樣，面與面相接時容易出現邊界不連續。

### 3.2 常見缺陷來源

| 編號 | 缺陷來源 |
|---|---|
| 3.2.1 | 幾何沒有真正接住。 |
| 3.2.2 | 接觸邊兩側 owner 規則不同。 |
| 3.2.3 | atlas 邊緣 texel 有效，但亮度比面內部低。 |
| 3.2.4 | runtime gate 把一段 baked 區域切成 live 區域。 |
| 3.2.5 | 驗收工具看錯相機、量錯座標、只抓純黑，漏掉窄暗列。 |

### 3.3 A1 分類

A1 經第 16 章實測，主要證據是西樑 baked 面旁邊有一條北牆位置 `route=none / ownerCount=0` 的未認領帶。舊的「owner 1002 atlas 邊緣 dip」只保留為已淘汰假設，不可再拿來當修法前提。A1 目前先歸入 3.2.4 類型，並持續檢查 3.2.2 與 3.2.3 是否同時存在。

## 4. 已查事實

### 4.1 幾何與環境查證

| 編號 | 查證結論 |
|---|---|
| 4.1.1 | `js/Home_Studio.js` L40 標示 `Scene Box Data (single source of truth)`。 |
| 4.1.2 | `sceneBoxes` 與 `addBox(min, max, ...)` 建立 ray tracing 使用的 box 幾何。 |
| 4.1.3 | 北牆、西牆、東牆、南牆、天花板、地板、樑、柱都由 `addBox()` 手寫座標建立。 |
| 4.1.4 | `js/InitCommon.js` 存放 R7-3.10 烘焙 surface 常數，例如 `R7310_C1_NORTH_WALL_WORLD_BOUNDS`、`R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS`、`R7310_C1_STRUCTURAL_ISLANDS`。 |
| 4.1.5 | repo 內未找到 `.blend`、`.glb`、`.gltf`、`.obj`、`.fbx` 這類源模型檔。 |
| 4.1.6 | 本機有 `/Applications/Blender.app`。 |
| 4.1.7 | Blender 可執行檔已確認存在：`/Applications/Blender.app/Contents/MacOS/Blender`。 |
| 4.1.8 | 後續腳本固定使用 4.1.7 的絕對路徑，不依賴 shell PATH 的 `blender` 短指令。 |

### 4.2 幾何來源結論

目前權威幾何來源是 JS 手寫 box。Blender spike 應由現有 `sceneBoxes` 與 `InitCommon` 常數生成 debug mesh 與 registry。Blender 只擔任幾何檢視、接觸邊掃描、封邊建議工具。

## 5. A1 驗收樣本

### 5.1 A1 定義

A1 是「北牆 ↔ 西樑北端」接觸邊。

### 5.2 使用者驗收條件

| 編號 | 驗收條件 |
|---|---|
| 5.2.1 | 使用者相機：pos(-1.7087, 2.8269, -1.8201)，fwd(-0.4957, 0.4169, -0.7619)，fov 55。 |
| 5.2.2 | package：`d800-north-denoise-c`。 |
| 5.2.3 | 北牆烘焙開啟、北東非方格開啟時，西樑北端與北牆交界可見黑線。 |
| 5.2.4 | 關閉北牆烘焙或關閉北東非方格時，使用者回報黑線消失。 |
| 5.2.5 | 這組條件用來驗收新系統有沒有收掉 A1。 |

## 6. 真正全域的定義

### 6.1 全域方案邊界

真正全域方案必須管理全房間接觸邊。單一 shader gate、單一 x/y/z 範圍、單一截圖、單一 package 切換，都只能算局部嘗試。

### 6.2 全域方案必備資料

| 編號 | 必備資料 |
|---|---|
| 6.2.1 | 全房間接觸邊清單。 |
| 6.2.2 | 每條邊的世界座標範圍。 |
| 6.2.3 | 每條邊的兩側 surface ID。 |
| 6.2.4 | 每條邊的 owner 規則。 |
| 6.2.5 | 每條邊的 baked package。 |
| 6.2.6 | 每條邊的驗收相機。 |
| 6.2.7 | 每條邊的 probe 欄位。 |
| 6.2.8 | 每條邊的通過門檻。 |
| 6.2.9 | 每條邊的硬否決條件。 |

### 6.3 既有清單定位

目前 `contact-edge-inventory.md` 已列 28 條人工候選接觸邊。這 28 條來自 shader gate、InitCommon 常數與舊稽核整理，定位是「預期覆蓋清單」，權威程度低於 Python／Blender 全域自動掃描結果。後續自動抓邊工具要拿它對表：自動有、清單沒有＝清單漏；清單有、自動沒有＝清單可能過時；兩邊座標不同＝常數或掃描規則要查。

## 7. Blender／模型資料方法

### 7.1 方法目標

Blender／模型資料方法的核心目標是建立接觸邊資料系統。

### 7.2 使用者操作需求

短期使用者不用手動開 Blender。AI 可以使用 `/Applications/Blender.app/Contents/MacOS/Blender` 以 headless 模式跑 Python 腳本。腳本從現有 JS box 產生 debug mesh，掃描接觸邊，輸出可檢查資料。

### 7.3 擴張順序

這個方法已先用 A1 驗證資料工廠能跑。A1 成功後，下一步是第 15 章的全房間自動掃描。28 條人工清單只作對表基準，最終接觸邊數量以自動掃描與審查後的 registry 為準。

### 7.4 A1 交付物

| 編號 | 交付物 | 用途 |
|---|---|---|
| 7.4.1 | `a1-mesh-contact-debug.glb` 或 `a1-mesh-contact-debug.obj` | 由現有 JS box 生成，用來檢視北牆、西樑 inner 面、西樑底面、A1 接觸帶與可能封邊位置。 |
| 7.4.2 | `a1-contact-edge-registry.json` | 由現有 JS box 與 R7-3.10 surface 常數生成，列出 A1 兩側 surface、世界座標、probe 對位、owner 證據與 ownerPolicy 狀態。 |
| 7.4.3 | `a1-owner-policy.md` | 明確寫出 A1 目前資料證據、ownerPolicy 是否仍為 PENDING、硬否決、驗收相機、probe 門檻、截圖要求。 |

## 8. A1 第一輪修法方向

### 8.1 資料焦點

A1 第一輪聚焦接觸邊資料表與驗收閉環。先把 A1 的兩側 surface、世界座標、owner 證據、probe 證據寫進 registry，證明資料工廠能抓到失敗。修補與驗收放在第 17 章，且第 17 章必須先吃第 15 章全域 registry。

### 8.2 優先檢查項目

| 編號 | 檢查項目 |
|---|---|
| 8.2.1 | A1 registry 是否列出兩側 surface。 |
| 8.2.2 | A1 registry 是否列出接觸邊世界座標範圍。 |
| 8.2.3 | A1 ownerPolicy 是否保留資料來源與證據，避免幾何相鄰被誤寫成歸屬定案。 |
| 8.2.4 | probe 是否能判斷 baked coverage 有沒有缺口。 |
| 8.2.5 | probe 是否能判斷 route / owner 是否連續。 |
| 8.2.6 | probe 是否能抓出 ownerCount=0 的未認領帶。 |

### 8.3 西樑判定方式

西樑是否參與 A1 修法，由 A1 registry 與使用者相機重測 probe 判定。排除依據由新資料表產生。

## 9. 執行接法

### 9.1 第一輪接法

第一輪採用低風險接法：`registry → 產生 JS / shader 常數 → contract test`。

### 9.2 選用理由

| 編號 | 理由 |
|---|---|
| 9.2.1 | 房間是靜態 box 幾何。 |
| 9.2.2 | 目前已有 JS / shader 常數與 contract test 模式。 |
| 9.2.3 | A1 spike 只需要把資料來源前移到 registry。 |
| 9.2.4 | shader 執行期讀 edge-rule 資料貼圖成本高，暫不列入 A1 第一輪。 |

## 10. 驗收方式

### 10.1 驗收原則

A1 驗收要同時看數據與畫面。

### 10.2 必要證據

| 編號 | 必要證據 |
|---|---|
| 10.2.1 | 使用者相機截圖。 |
| 10.2.2 | linear radiance probe。 |
| 10.2.3 | route / owner / hit object / normal / world position / box min / box max。 |
| 10.2.4 | baked luma 與北牆內部控制點比較。 |
| 10.2.5 | ownerCount 檢查。 |
| 10.2.6 | raw package 與 denoise package 對照。 |
| 10.2.7 | 全部烘焙關閉狀態。 |
| 10.2.8 | 北牆烘焙關閉狀態。 |

### 10.3 銳利窄 column 門檻

A1 的視覺缺陷可能是一條很窄、很銳利、很連續的暗列。單一絕對亮度門檻只能當參考。真正通過標準要包含「無銳利窄暗列、無銳利窄亮列、接觸邊兩側 baked 結果連續」。

## 11. 硬否決

### 11.1 失敗條件

| 編號 | 失敗條件 |
|---|---|
| 11.1.1 | 黑線消失，但旁邊出現未認領 live 區域。 |
| 11.1.2 | baked 交界被切出一塊 live 補洞。 |
| 11.1.3 | 某段接觸邊靠 live path tracing 臨時接上。 |
| 11.1.4 | 交界亮度看似接近，但 owner route 不連續。 |
| 11.1.5 | probe 顯示同一條接觸邊一段走 baked，一段走 live，一段沒有 owner。 |
| 11.1.6 | 修法靠換回舊 package 才無縫。 |
| 11.1.7 | 修法靠關閉北牆某一帶改走 live。 |
| 11.1.8 | 只用 tonemapped 截圖宣告通過。 |
| 11.1.9 | 沒有使用者相機驗收圖。 |

### 11.2 成功定義

成功只能定義成「無縫連續交界烘焙」：整條交界由明確 owner 接住，畫面連續，route 連續，baked coverage 連續，沒有黑線、白線、縫隙、live 島。

## 12. 後續計畫的最低標準

### 12.1 下一份 plan 的前提

下一份 plan 要直接以已查事實為前提。

### 12.2 必填內容

| 編號 | 必填內容 |
|---|---|
| 12.2.1 | 幾何來源：`js/Home_Studio.js` 的 `sceneBoxes`。 |
| 12.2.2 | 烘焙 surface 常數來源：`js/InitCommon.js` 的 R7-3.10 常數。 |
| 12.2.3 | Blender 執行路徑：`/Applications/Blender.app/Contents/MacOS/Blender`。 |
| 12.2.4 | A1 定位：使用者驗收相機中的失敗樣本；最終 owner、route、luma 結論由新資料表與重測 probe 建立。 |
| 12.2.5 | A1 第一輪：由現有 box 生成 debug mesh、registry、owner policy。 |
| 12.2.6 | 修法方向：接觸邊資料表先行，再依資料表決定 atlas edge fill、runtime gate 或幾何封邊。 |
| 12.2.7 | 驗收方式：使用者相機、linear radiance probe、人眼截圖。 |
| 12.2.8 | 硬否決：live 島、換 package 迴避、關北牆局部改 live、截圖假綠。 |

### 12.3 文件退回條件

文件若再次回到「先查幾何來源」或「先猜 owner」，代表它沒有吸收本文件的已查結論。

## 13. Blender 接觸邊資料系統建置規劃（白話完整版）

### 13.1 一句話定位

這套系統是一台「接觸邊資料工廠」。它吃現有的 JS 手寫房間積木，吐出三樣東西：一張記錄全房間每一條接觸邊所有欄位的登記表（registry，可被程式與測試讀的資料表）、一個可在 Blender 裡用眼睛檢查的 3D 模型、一份每條邊的歸屬規則書。它不創造任何幾何，只把「已經存在的幾何之間的接縫」一條一條找出來、記清楚、能自動複查。

### 13.2 名詞先講白話（本節術語對照）

| 術語 | 白話 |
|---|---|
| box（盒子／積木） | 房間每一塊牆、樑、柱、地板，都是用一個長方體座標寫出來的，叫一個 box。 |
| 接觸邊（contact edge） | 兩塊 box 互相貼住的那一條（或一帶）接縫。 |
| 烘焙（bake） | 把光照預先算好存成圖片，畫面執行時直接讀圖，不用即時重算。 |
| atlas（圖集） | 把很多面的烘焙結果拼進同一張大圖，每面佔其中一塊。 |
| texel（貼圖像素） | 烘焙圖上的一個點。 |
| owner（歸屬） | 接縫上某一點的光照，由哪一個面負責畫。 |
| gate（閘門判斷） | shader 裡一段 if 條件，決定某點要不要交給某個烘焙面。 |
| probe（探針） | 在指定像素讀出該點真實數據（亮度、歸屬、命中哪個 box）的工具。 |
| registry（登記表） | 一張把每條接觸邊所有欄位列齊的資料表（JSON 純文字格式）。 |
| headless（無視窗背景執行） | 不開圖形介面、純背景跑腳本的模式。 |
| mesh（網格模型） | 3D 軟體用多邊形拼出的物體表面。 |
| contract test（契約測試） | 自動比對「登記表的數字」和「程式碼真正的數字」有沒有偷偷跑掉的測試。 |
| desync（不同步） | 三份資料對同一條邊講法不一致。 |

### 13.3 為什麼要這台工廠（A1 教訓）

接觸邊缺陷（見第 3.2 節五種來源）裡，有三份資料各自決定一條接縫的歸屬：gate 一套（shader 把誰排除）、烘焙一套（atlas 實際畫到哪、亮度多少）、metadata 一套（island／edge policy 宣告誰擁有）。三邊只要有一處對不上（對應 3.2.2／3.2.4），或三邊一致但某面 atlas 邊緣 column 自己比內部暗（對應 3.2.3），就會出現接縫。目前這三份資料分散在三個檔案、靠人手動對照，極易漏看。

這台工廠的價值是把「三邊對帳」變成一張自動產生、可被測試鎖住的登記表，讓不同步一出現就被抓到，使用者不必再靠肉眼在某個相機角度才撞見。A1 屬於哪一種缺陷來源、owner 歸於哪一面、亮度數據多少，本章一律不預設；這些結論由本系統的 registry 與重測 probe 在使用者驗收相機下產出（見第 2.3／5／8.3／12.2.4 節）。

### 13.4 不可動搖的原則

```
原則 1：js/Home_Studio.js 的 sceneBoxes 是唯一真實幾何來源。
        Blender 不准自己畫房間、不准自己改座標。
原則 2：接觸邊的數學（盒子貼盒子的重疊計算）用 Python 算（座標軸對齊的長方體，
        用矩形交集即可，不需要 Blender 的幾何引擎）。
原則 3：Blender 只做三件事──
        (看) 把算出來的接觸帶塗成顯眼顏色，輸出可用眼睛檢查的 3D 模型；
        (複查) 用 Blender 自己的幾何布林運算算第二次，和 Python 的答案對拍，兩邊一致才算數；
        (拍) 從使用者驗收相機把接觸帶 render 出來，供肉眼與審查複看。
原則 4：匯出的數字必須等於 App 執行時真正用的數字（見 13.6 Step 1），
        匯出器本身不可引入新的 desync。
```

### 13.5 資料流（五步）

```
js/Home_Studio.js (sceneBoxes 88 box) + js/InitCommon.js (23 烘焙面 + island + gate)
   │
   │ Step 1 匯出橋（headless Chrome 讀 App 已載入的全域值 → 中性 JSON）
   ▼
contact-edge-source.json  （box 幾何 + 烘焙面 WORLD_BOUNDS + island + gate 區域）
   │
   ├─ Step 2 Blender 讀 JSON → 建 debug mesh（牆/樑/柱 + 接觸帶上色）
   │
   ├─ Step 3 接觸邊掃描（Python 矩形交集找出每條接觸帶；Blender 布林複查）
   ▼
   │ Step 4 registry 生成（每條邊 9 欄位，對齊第 6.2 節）
   ▼
a1-contact-edge-registry.json  +  a1-owner-policy.md  +  a1-mesh-contact-debug.glb
   │
   │ Step 5 三邊對帳（gate vs bake vs metadata）+ contract test 鎖死
   ▼
每條邊標出 AGREE / DESYNC / EDGE-DIP，並由測試防止登記表與程式碼再度走偏
```

### 13.6 五步逐項（輸入 → 工具 → 輸出 → 怎麼驗）

```
Step 1　匯出橋（JS → 中性 JSON）
  輸入：Home_Studio.html 載入後的瀏覽器全域變數 sceneBoxes、R7310_C1_* 系列常數。
  工具：Node + headless Chrome（強制 Chrome，絕不碰 Brave），用既有 probe 同一條
        eval 管道，對已載入的 App 直接 JSON.stringify 出 box 與所有烘焙面常數。
  為何用 headless Chrome：sceneBoxes 由 addBox() 在執行時計算、且依賴 MIN_X/MAX_X 等
        其他全域常數；讀 App「執行後的真值」能保證匯出數字 = App 真正用的數字，
        匯出器不自行重算、不引入落差。
  輸出：contact-edge-source.json（box 陣列 + 23 面 WORLD_BOUNDS + 8 island
        + gate 排除區 + atlas edge policy）。
  驗收：抽查北牆 1002 z=-1.874、西樑內側 1015 x=-1.75、beam-gap west x[-1.908,-1.752]
        y[2.525,2.905] 等已知值與原始碼逐位元相等。

Step 2　Blender 建 debug mesh
  輸入：contact-edge-source.json。
  工具：/Applications/Blender.app/Contents/MacOS/Blender 以 headless 跑 Python 腳本。
  做法：每個 box 建一個長方體 mesh；結構組（index 0–32）與家具分層；
        接觸帶（Step 3 算出）另建一塊半透明上色 mesh 疊上去。
  輸出：a1-mesh-contact-debug.glb（交付物 7.4.1）。
  驗收：在 Blender GUI 開啟，肉眼可見北牆、西樑內側面、西樑底面、A1 接觸帶位置正確。

Step 3　接觸邊掃描（找出互相接觸的面）
  輸入：contact-edge-source.json。
  主算（Python＋numpy）：每個 box 有 6 個座標軸對齊的面，每面是「某軸固定值＋另兩軸一塊矩形」。
        兩面接觸 ⇔ 同軸、固定值相等（誤差 < 1mm）、兩矩形在該平面上有正面積重疊。
        重疊矩形 = 接觸帶，記其世界座標。
        另一類：把烘焙面平面（WORLD_BOUNDS）與會擋住它的 box footprint 取交集，
        得到「該烘焙面上被別的 box 貼住」的子矩形（A1 即北牆平面被西樑 footprint 貼住的那塊）。
  複查（Blender 布林）：把同兩個 box 建 mesh、做交集/共面偵測，確認與 Python 算的同一帶。
        兩法不一致 = 有 bug，先停。
  輸出：每條接觸帶的世界座標範圍 + 兩側 box index + 兩側面法線。
  驗收：A1 算出的帶須落在 x[-1.908,-1.752] y[2.525,2.905] z=-1.874 量級，與清單 A1 一致。

Step 4　registry 生成（每條邊 9 欄位，嚴格對齊第 6.2 節）
  每條邊一筆，欄位：
    (1) 接觸邊名稱　(2) 世界座標範圍　(3) 兩側 surface ID（如北牆 1002 / 西樑內側 1015）
    (4) owner 規則　(5) baked package（如 d800-north-denoise-c）
    (6) 驗收相機　(7) probe 欄位（route/ownerCount/baked vs control 等）
    (8) 通過門檻　(9) 硬否決條件
  輸出：a1-contact-edge-registry.json（交付物 7.4.2）+ a1-owner-policy.md（交付物 7.4.3）。
  驗收：A1 registry 必須列出兩側 surface、座標範圍、owner 與允許修法類型（對應第 8.2.1–8.2.3）。

Step 5　三邊對帳 + owner policy + contract test
  對每條邊比對三個來源是否對同一個 owner：
    gate 來源　：shader r7310C1*Hidden* 函式 + InitCommon 排除區/dead zone。
    bake 來源　：實際 atlas 覆蓋該世界座標的面 + 角落 column 對內部的亮度落差（用既有 probe）。
    metadata 來源：structural island 的 atlasRect/worldFace + atlas edge policy。
  每條邊輸出標記（對應第 3.2 節缺陷來源，由實際資料判定，不預先指派給任何一條邊）：
    AGREE　　 三邊一致且 atlas 邊緣與內部連續。
    DESYNC　 三邊對 owner 講法不一致（歸屬被切、live 島；對應 3.2.2／3.2.4）。
    EDGE-DIP 三邊一致，但某 owner atlas 邊緣 column 比內部暗（對應 3.2.3）。
  contract test：把 Step 1 重新匯出的真值與 registry 逐欄比對，數字一不符即 FAIL，
        擴入既有 docs/tests/r7-3-10-seam-contracts-all.mjs。防止日後改 InitCommon 卻忘了同步登記表。
  驗收：A1 的標記由 registry 與重測 probe 的實際數據產出（先紅）；資料齊全後才據以分類，
        本步驟不預設 A1 屬於哪一類、不預設 owner 歸屬。
```

### 13.7 A1 pilot（只做一條，先證明資料工廠能跑）

依第 7.3 節，先只做 A1。理由：A1 是唯一已確認黑線存在、且已有使用者驗收相機與既有 probe 樣本的邊，最適合驗證整條 pipeline（匯出 → 掃描 → registry → 對帳 → 測試）是否正確。A1 跑通只代表這台資料工廠的方法論可信，下一步固定進第 15 章全域擴張，不直接進 A1 單點修法。

A1 走「先紅」：先讓 registry 與重測 probe 在使用者驗收相機下，產出可驗證的數據（兩側 surface、世界座標、gate／bake／metadata 三邊比對、邊緣 column 對內部的亮度落差、ownerCount）。A1 的 root cause 分類（落在第 3.2 節哪一種）、owner 歸於哪一面、西樑是否參與，一律等資料出來才定（第 8.3 節：西樑是否參與由 registry 與重測 probe 判定）。本系統在資料產出前不替 A1 預設結論。分類確定後，也只能把結果帶去第 15 章全域 registry；修法方向待全域資料完成後再依第 8.2.4–8.2.6 與第 11.2 節決定。

### 13.8 A1 過了後下一步固定為全房間自動掃描

A1 的 registry schema、掃描器、對帳器、contract test 一旦驗證可信，就用同一套程式做第 15 章全房間自動掃描，批次產出 full-room-contact-edge-registry.json。`contact-edge-inventory.md` 的 28 條只作人工候選清單，必須和自動掃描結果對表；自動掃描找出的條數可以高於或低於 28，差異要寫進 reconciliation。每條邊自動帶上 AGREE / DESYNC / EDGE-DIP / OWNERLESS / NEEDS_PROBE 標記與 probe 欄位，再逐條補第 10 節八狀態證據與驗收相機。非方格 atlas 只支援北牆/東牆，故 A2、B1 為 A1 之後的首要次序。本文件硬規則：A1 pilot 通過後，下一步只能做第 15 章全域擴張；任何直接進 A1 修補的提案一律退回。

### 13.9 交付物對應（回扣第 7.4 節）

```
7.4.1 a1-mesh-contact-debug.glb　　　← Step 2 產出
7.4.2 a1-contact-edge-registry.json　← Step 4 產出
7.4.3 a1-owner-policy.md　　　　　　 ← Step 4 產出（規則書）
額外：contact-edge-source.json（Step 1 中性匯出，全體共用）
額外：contract test 併入 r7-3-10-seam-contracts-all.mjs（Step 5）
```

### 13.10 Blender 不做什麼（誠實邊界）

```
Blender 不負責：產生幾何、決定 owner、改 shader、改 bake、把牆角拉亮。
Blender 只負責：看（debug mesh）、算的第二意見（布林複查）、拍（驗收相機 render）。
接觸帶的數學在 Python；判 owner 在三邊對帳；鎖死在 contract test；修法在重烤（另案）。
若有人主張「讓 Blender 重新生成房間幾何」，違反原則 1，直接退回。
```

### 13.11 與既有驗收／硬否決綁定

本資料系統的輸出，最終仍要過第 10 節八狀態與第 11 節硬否決。registry 標 AGREE 只代表「三邊資料對得上」，不代表黑線已修；真正通過要再走「先紅後綠」。下列為候選門檻，正式數值待全域 registry 與重測 probe 產出後定：共邊 post-albedo 跨交接無階梯（候選 差 < 0.005）、ownerCount 全程 ∈ {0,1}、五個高度行 peak localDelta（候選 < 0.04，於 linear 線性亮度空間量測，不採 tonemapped 截圖）、使用者相機 CDP 截圖肉眼無線。資料系統負責「把缺陷說清楚、可複查、防回歸」。第 15 章負責全域資料表實作；修法與最終綠燈延後到第 17 章。

## 14. A1 先行詳細 SOP（可照做版，展開自第 13.7 節）

### 14.0 本 SOP 怎麼用（先讀）

這份 SOP 把第 13.7 節「A1 pilot」拆成可逐步照做的操作手冊。目標只有一個：把第 13 章那條生產線（先紅擷取 → 匯出 → 掃描 → registry → 對帳 → contract test）在 A1 這一條邊上實際跑通，並對 A1 產出可驗證資料。本 SOP 全程不替 A1 預設結論：A1 屬於第 3.2 節哪一種缺陷、owner 歸於哪一面、西樑是否參與，都由 Step A／C／E 的實測資料與幾何在 Step F1 才據以分類，作為資料工廠的 pilot 輸出；通過後只准進第 15 章全域擴張。

```
角色：執行者照本 SOP 一步步做；CODEX 依第 14.11 節逐步勾核。
紀律：第 14.1 節的固定參數全程引用，不可自行更換。
      每一步都有「STOP 條件」；條件成立就停下、回報，不可自行繞過或補腦。
      本 SOP 不動 shader、不動 bake、不拉亮牆角（修法是另案，見第 8／11 節）。
新名詞（沿用第 13.2 節，並補充）：
  CDP（Chrome DevTools Protocol，瀏覽器除錯協定）：讓腳本遠端控制無視窗 Chrome 的通道。
  spp（samples per pixel，每像素取樣數）：path tracing 累積的樣本數，越高畫面越乾淨。
  GLB：一種可在 Blender 開啟檢視的 3D 模型檔格式。
  boolean（布林運算）：3D 軟體把兩個模型做交集／聯集／相減的運算。
  EPS（epsilon，容許誤差）：比對兩個浮點數時允許的最小差距。
  bare 名稱：在頁面全域範圍裡，直接用變數名稱（如 sceneBoxes）就能取值，免加 window. 前綴。
```

### 14.1 固定參數（全程不可改，違反即第 14.10 節 STOP）

| 項目 | 固定值 | 來源／理由 |
|---|---|---|
| 專案根目錄 | `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D` | CLAUDE.md |
| Chrome 路徑 | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | probe runner 第 28 行；強制 Chrome，嚴禁 Brave |
| 本機 server | `python3 -m http.server 9004 --directory "<專案根目錄>"` | probe runner 把頁面 URL 寫死在 9004 |
| 頁面 URL | `http://127.0.0.1:9004/Home_Studio.html?nonSquarePackage=d800-north-denoise-c` | probe runner 第 34–39 行 |
| 驗收相機 | position{x:-1.708748, y:2.826862, z:-1.820144}、forward{x:-0.495699, y:0.416871, z:-0.761906}、fov 55 | probe runner 第 42–47 行（＝第 5.2.1 節） |
| package | `d800-north-denoise-c` | 第 5.2.2 節 |
| Blender 路徑 | `/Applications/Blender.app/Contents/MacOS/Blender` | 第 4.1.7 節 |
| 幾何來源 | `js/Home_Studio.js` 的 `sceneBoxes`（88 個 box，index 0–32 為結構組） | 第 4.1／12.2.1 節（Step B 實測 88 筆） |
| 烘焙面常數 | `js/InitCommon.js` 的 `R7310_C1_*`（23 面 ID 1001–1023、8 island、gate 排除區、atlas edge policy） | 第 4.1.4／12.2.2 節（已核實） |
| 既有可重用工具 | probe 執行器 `docs/tools/r7-3-10-west-beam-north-contact-probe.mjs`；任意視角截圖 `docs/tools/r7-3-10-seam-view-capture.mjs`；黑白線掃描 `docs/tools/r7-3-10-seam-line-scan.py`；contract 骨架 `docs/tests/r7-3-10-seam-contracts-all.mjs`；contract 範本 `docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js` | 已存在於 repo |
| 使用者紅框驗收圖 | `user-a1-redbox-reference.png`（先複製進本 review 目錄；A1 黑線由使用者在此圖圈出，是 overlay 涵蓋判定的唯一基準，執行者不可自截自判） | 使用者提供的 A1 圈選圖 |

### 14.2 前置檢查（六步開始前必過）

```
P1. server：curl -I http://127.0.0.1:9004/Home_Studio.html 回 200 OK 才算 server 已可用；未回 200 OK 時，照 14.1 起 server。
P2. 頁面就緒函式存在：頁面載入後，reportR7310C1FullRoomDiffuseRuntimeProbe、
    setR739Config1ValidationCameraState、setR7310C1UseNonSquareAtlas、各 setR7310C1*DiffuseRuntimeEnabled
    皆為 function（probe runner 第 344–353 行已在等這些）。
P3. 既有 contract 全綠：node docs/tests/r7-3-10-seam-contracts-all.mjs 印「All ... passed」。
P4. git：在 codex/r7-3-10-global-seam-hardening 分支、工作區乾淨（新檔只進 docs/tools、docs/tests、本 review 目錄）。
P5. 使用者紅框參考圖：14.1 的 user-a1-redbox-reference.png 已在本 review 目錄。此圖是使用者對 A1 黑線的圈選標註、由使用者提供；缺檔即停、向使用者索取。執行者不可自繪，也不可用新截圖自判涵蓋。
任一不過 → 停，先修環境，不可往下。
```

### 14.3 Step A — 先紅基線（擷取 A1 失敗資料，記錄事實、不下人工結論）

```
輸入：14.1 固定參數。
工具：擴充自既有 docs/tools/r7-3-10-west-beam-north-contact-probe.mjs。可改 docs/tools 下的量測工具；不可改 shader、bake pipeline、runtime 產品邏輯。
  擴充三項：(a) 沿暗線高度方向取「五個 y 高度行」，每行一組 line/control；(b) 輸出 overlay 標記圖；
  (c) 輸出寫進 run-id 目錄，不覆寫歷史。
做法：
  1) 開全室烘焙 + 非方格 atlas、設驗收相機，記錄實得 spp 並截圖；嚴格 ≥ 500 spp 視覺截圖留到第 17 章 GPU 綠燈。
  2) 用局部亮度落差自動定位暗縱列 x_line，沿線高度方向取五個 y 高度（涵蓋線的整段 yRange）。
  3) 每個 y 高度一組 (line=x_line, control=x_line+8px)，對 levels 31/32/33/34/35/36/37/38/49 + 22–26 讀 decoded。
  4) 畫 overlay：在 ≥500 spp 截圖上標出 x_line、control、五個取樣點，並與 14.1 的 user-a1-redbox-reference.png 並排輸出比對。
輸出（run-id 目錄，每次跑都新建，不覆寫）：
  stage-a/<run-id>/west-beam-north-contact-probe.json   （五行 × 各 level 的 decoded）
  stage-a/<run-id>/west-beam-north-contact-failing.png  （≥500 spp 失敗截圖）
  stage-a/<run-id>/west-beam-north-contact-overlay.png  （標 x_line／control／五個取樣點）
  stage-a/<run-id>/overlay-vs-user-reference.png        （overlay 與 14.1 的 user-a1-redbox-reference.png 並排）
  stage-a/latest.json                                   （指向最新 run-id；歷史樣本不混用）
須記錄（事實，照抄 probe 數值）：五行各自 route(31/35)、ownerCount+owners+encodingValid(37)、
  baked line vs control(36/49)、worldPosition(32)、hitObject(34)、normal(33)。
資料摘要說明：工具自動產生的事實摘要（routeName、ownerCount、luma、detector PASS/FAIL、generatedNote）允許保留，
  這些是量測事實。禁止的是替 A1 加任何人工 root cause／owner／西樑參與「定案」（見 14.10 S-1）。
取樣數說明：route／owner／atlas 讀值（31/35/37/49/36）來自靜態 package 與逐像素 gate，屬決定性、與 spp 無關，這是 A1 的客觀錨。
  ≥500 spp 原意是讓失敗截圖不被雜訊誤判成假線。headless swiftshader CPU 約 0.37 spp/秒，500 spp 需約 22 分鐘；而 A1 兩側（北牆 1002／西樑）皆為烘焙面（讀靜態 atlas、無 path-tracing 雜訊），實測 35 spp 截圖即已無雜訊（見 stage-a/diag 截圖）。故 headless Step A 以實得 spp 截圖並記錄實際值，客觀判讀靠 linear per-row probe；嚴格 ≥500 spp 的乾淨截圖歸第 17 章 GPU 綠燈（使用者紅框參考圖本身即真實 GPU 擷取）。
驗收（本步只驗「失敗線被完整擷取且對位正確」）：
  (1) 五個高度行都有 line/control pair（單一點不足）。
  (2) overlay-vs-user-reference.png 顯示 overlay 涵蓋 14.1 固定 reference（user-a1-redbox-reference.png）圈出的整條紅框區（整段覆蓋，單一點不算；基準是該固定 reference，禁用新截圖自判）。
  (3) 每行 level 32 worldPosition 落在交界帶容差內（alignmentOk）。
STOP：任一高度行 alignment 失敗、或 overlay 未覆蓋紅框區 → 停、人工複核 pixelMapping，不可拿部分線資料往下。
```

### 14.4 Step B — 匯出橋（產生 contact-edge-source.json，含 JS 常數與 shader gate 摘要）

```
輸入：頁面已載入的 bare 名稱 sceneBoxes 與 R7310_C1_* 常數；以及 shader 檔 shaders/Home_Studio_Fragment.glsl。
工具（新建）：docs/tools/r7-3-10-contact-edge-export.mjs
  重用 probe 執行器的 Chrome／CDP 連線骨架（launchChrome / openCdpTarget / evaluate，第 67–204 行同款），
  等頁面就緒後，用一次 Runtime.evaluate 對頁面全域跑 JSON.stringify，bare 名稱直接取值。
必須匯出的鍵（缺一即 STOP）：
  boxes：sceneBoxes 全 88 筆（每筆 min[3]、max[3]、type、index）。
  surfaces：23 面，每面 { targetId, surfaceName, worldBounds }（取各 R7310_C1_<面>_WORLD_BOUNDS）。
  northWallBeamGap：R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS（west / east 兩矩形；此為 JS 真值）。
  structuralIslands：R7310_C1_STRUCTURAL_ISLANDS（8 筆，含 atlasRect / worldFace / normal）。
  excludedContactFaces：R7310_C1_STRUCTURAL_EXCLUDED_CONTACT_FACES（7 筆）。
  atlasEdgePolicies：R7310_C1_NON_SQUARE_ATLAS_EDGE_POLICIES。
  shaderGates（P1#3，shader 真值，以讀檔解析取得，不從頁面全域取）：讀 shaders/Home_Studio_Fragment.glsl，
    擷取 r7310C1NorthWallHiddenByBeamGap 定義與其 westBeamGap / eastBeamGap 座標比較行
    （解析法見範本 docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js 第 54–67 行），
    輸出 { gateName, westRect{xMin,xMax,yMin,yMax}, eastRect{...}, wiringPresent:bool, sourceHash }。
輸出（固定檔名）：
  docs/html-review/2026-06-03-r7-3-10-global-contact-edge-hard-gates/contact-edge-source.json
驗收（逐位元抽查；JS 真值與 shader 真值都要對）：
  北牆面 worldBounds.z === -1.874；西樑內側面 worldBounds.x === -1.75；
  northWallBeamGap.west === { xMin:-1.908, xMax:-1.752, yMin:2.525, yMax:2.905 }（JS 真值）；
  shaderGates.westRect 與 northWallBeamGap.west 逐位元相等（shader↔JS，EPS 1e-6）；shaderGates.wiringPresent === true；
  boxes.length === 88（先前文件誤記 89＝把 `function addBox` 定義行也數進去；runtime 真值 88、無缺）；surfaces.length === 23；structuralIslands.length === 8。
STOP：任一抽查值不符，或 shader 與 JS 的 beam-gap 區間對不上 → 停（這正是 desync 根因，往下做的一切不可信）。
```

### 14.5 Step C — 接觸邊掃描（算出 A1 接觸帶座標）

```
輸入：contact-edge-source.json。
主算工具（新建，Python + numpy）：docs/tools/r7-3-10-contact-edge-scan.py
  方法（座標軸對齊長方體）：每個 box 6 個面＝「某軸固定值 + 另兩軸一塊矩形」。
  兩面接觸 ⇔ 同軸、固定值相等（誤差 < 0.001 m）、兩矩形在該平面上有正面積重疊；重疊矩形即接觸帶。
  A1 取法：以北牆面（z=-1.874）為平面，與「貼住北牆面的結構 box」footprint 取交集；
  掃描器從 sceneBoxes 自動辨識這些結構 box，不靠人手指定 box index。
複查工具（新建，Blender）：docs/tools/r7-3-10-contact-edge-blender.py
  指令：/Applications/Blender.app/Contents/MacOS/Blender --background \
        --python docs/tools/r7-3-10-contact-edge-blender.py -- \
        --source <contact-edge-source.json> --emit-band a1
  用 box 建 mesh、做 boolean 交集／共面偵測，輸出它算出的 A1 接觸帶座標。
輸出：A1 接觸帶世界座標範圍 + 兩側 box index + 兩側面法線（寫入 Step D 的 registry）。
驗收（兩道）：
  (1) Python 算出的帶落在 x[-1.908, -1.752] y[2.525, 2.905] z=-1.874 量級（＝第 5 節 / beam-gap west）。
  (2) Python 與 Blender 兩法算出的帶一致（各邊界差 < 0.001 m）。
STOP：兩法不一致，或帶未落在上述量級 → 停（掃描有誤，不可往下）。
```

### 14.6 Step D — registry 骨架與 owner policy（填 9 欄，ownerPolicy 留 PENDING 待 Step E）

```
輸入：Step A 的 probe JSON、Step C 的接觸帶幾何、contact-edge-source.json。
工具（新建）：docs/tools/r7-3-10-contact-edge-registry-build.mjs
輸出（固定檔名，＝第 7.4 節交付物）：
  a1-contact-edge-registry.json（交付物 7.4.2）
  a1-owner-policy.md（交付物 7.4.3）
  a1-mesh-contact-debug.glb（交付物 7.4.1，由 Step C 的 Blender 腳本一併輸出）
registry 9 欄（嚴格對齊第 6.2 節，每欄都要可回溯來源）：
  (1) 接觸邊名稱：A1 北牆 ↔ 西樑北端。
  (2) 世界座標範圍：Step C 的接觸帶。
  (3) 兩側 surface ID：北牆 1002 與西樑側面（兩側標示，本欄不指定誰是 owner）。
  (4) ownerPolicy（owner 規則）：Step D 一律填 PENDING，禁止在此填定案；ownerPolicy 由 Step E 三來源對帳後產出。
      Step D 只放兩塊原始輸入供 Step E 用（拆開，避免把幾何相鄰誤當歸屬）：
        contactCandidates：Step C 幾何提供的兩側 surface（幾何只說「哪兩面接觸」，不代表 runtime 歸屬）。
        observedOwnerEvidence：Step A probe 原始讀值（ownerCount / owners / encodingValid / route / line vs control luma），每筆標 probe level。
  (5) baked package：d800-north-denoise-c。
  (6) 驗收相機：14.1 固定相機。
  (7) probe 欄位：route / ownerCount / baked line vs control / worldPosition / hitObject / normal（＝ Step A 七欄位）。
  (8) 通過門檻：引第 13.11 節候選門檻（標「候選」，正式值待第 17 章綠燈以實測定）。
  (9) 硬否決條件：引第 11.1 節九條。
驗收：9 欄齊全；第 (4) 欄 ownerPolicy === PENDING；contactCandidates 指回 Step C 幾何、observedOwnerEvidence 指回 Step A probe level（對應第 8.2.1–8.2.3）。
STOP：Step D 的 ownerPolicy 非 PENDING（被幾何或人工提前填定案），或把「幾何相鄰」寫成「歸屬已定」 → 停（這就是預設結論，違反共識）。
```

### 14.7 Step E — 三來源對帳與 contract test（gate／bake／metadata 全鎖，防回歸）

```
輸入：contact-edge-source.json（含 JS 真值 + shaderGates）、a1-contact-edge-registry.json、Step A probe JSON。
對帳（三來源，由資料判，不預設）：
  gate 來源：InitCommon r7310C1NorthWallHiddenByBeamGap（JS 真值）＋ shader 同名函式（shaderGates，shader 真值）。
  bake 來源：probe level 49 / 36 的 line vs control 亮度，必要時加 atlas 直讀補強。
  metadata 來源：structuralIslands 的 atlasRect / worldFace + atlasEdgePolicies。
  產出 A1 標記（AGREE／DESYNC／EDGE-DIP 三選一）與 ownerPolicy，由上述三來源的實際數據判定，寫回 registry 第 (4) 欄（取代 Step D 的 PENDING）；ownerPolicy 須附 gate／bake／metadata 三來源證據。本步不預先指定。
contract test（新建，仿範本 docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js 的
  「讀 shader + InitCommon、regex 解析、approxEqual、驗 wiring」）：
  檔名：docs/tests/r7-3-10-a1-contact-edge-registry-contract.test.js
  斷言（gate／bake／metadata 三來源全鎖，approxEqual EPS 1e-6；任一方對不上即 FAIL）：
        gate：registry ↔ JS InitCommon r7310C1NorthWallHiddenByBeamGap 真值；registry ↔ shader shaderGates 真值；並驗 shader 已 wiring 該 gate（只有定義不算數）。
        bake：registry ↔ source 的 baked package、北牆非方格 atlas UV rect、surface worldBounds。
        metadata：registry ↔ source.structuralIslands（atlasRect／worldFace／normal）；registry ↔ source.atlasEdgePolicies。
        共用：registry 兩側 surface ID ↔ source。
  接線：把此檔加進 docs/tests/r7-3-10-seam-contracts-all.mjs 的 tests 陣列。
驗收：node docs/tests/r7-3-10-seam-contracts-all.mjs 全綠（含新 A1 三來源 test）；A1 標記與 ownerPolicy 在 registry 裡能指回 gate／bake／metadata 三來源數據。
STOP：contract harness 任一 FAIL → 停，修到 registry 與 gate／bake／metadata 三來源對齊為止。
```

### 14.8 Step F1 — 資料工廠先紅驗收（只證明工廠跑通，不修黑線）

```
輸入：前五步全部輸出。
本步只證明一件事：資料工廠能對 A1「先紅」成功。黑線修好與否屬第 17 章（另案），本步不碰。
做法：對 A1 收第 10 節八狀態中的「先紅證據」面向──
  S1（全室烘焙全開）、S6（使用者相機）、S7（自動 probe＝Step A 五行）、
  S8（≥ 500 spp 失敗截圖，證明線「存在且＝使用者圈出的紅框」，屬先紅證據）。
A1 分類（此步依資料初判，且是「輸出」）：
  依 Step A 五行七欄位 + Step E 三邊對帳的實際數據，初判 A1 落第 3.2 節哪一種、owner 歸哪一面、西樑是否參與
  （第 8.3 節：西樑是否參與由 registry 與重測 probe 判定）。此分類由實測決定，SOP 不預設此值。
資料工廠先紅通過定義（六項全齊才算 A1 先行成功）：
  1. Step A 五行 probe + overlay 齊、涵蓋紅框、五行 alignment 全過。
  2. Step B contact-edge-source.json + shaderGates 抽查全符。
  3. Step C 接觸帶兩法（Python／Blender）一致。
  4. Step D registry 9 欄齊、owner 欄每筆可回溯。
  5. Step E 三方 contract harness 全綠。
  6. S1/S6/S7/S8 先紅證據齊。
本步明確不做：不判第 13.11 節候選門檻是否達標、不要求「無線」截圖、不動 shader／bake／牆角。
  （候選門檻與「使用者相機無線」綠燈屬第 17 章。）
STOP：六項任一缺、或分類缺實測支撐 → 停，補齊再宣告。
通過即代表「資料工廠方法論可信」，可據第 13.8 節擴張到全房間自動掃描；下一步固定走第 15 章全域 registry，不走 A1 單點修補。
```

### 14.9 交付物與固定檔名（不可改名）

```
新工具：
  docs/tools/r7-3-10-contact-edge-export.mjs        （Step B 匯出橋）
  docs/tools/r7-3-10-contact-edge-scan.py           （Step C 主算）
  docs/tools/r7-3-10-contact-edge-blender.py        （Step C Blender 複查 + Step D mesh）
  docs/tools/r7-3-10-contact-edge-registry-build.mjs（Step D registry / policy 產生）
  docs/tests/r7-3-10-a1-contact-edge-registry-contract.test.js（Step E 三方 contract）
  docs/tools/r7-3-10-contact-edge-stage-a.mjs（Step A：自既有 r7-3-10-west-beam-north-contact-probe.mjs 的 Chrome/CDP/probe 骨架衍生，五行 + overlay + run-id 目錄）
資料輸出（本 review 目錄）：
  contact-edge-source.json（含 shaderGates）、a1-contact-edge-registry.json、a1-owner-policy.md、a1-mesh-contact-debug.glb
  stage-a/<run-id>/{west-beam-north-contact-probe.json, ...-failing.png, ...-overlay.png}、stage-a/latest.json（Step A 每跑新建、不覆寫）
```

### 14.10 全域 STOP／硬否決（任一成立即停、回報，不可補腦）

```
S-1 在 Step A/C/E 資料產出前替 A1 寫死結論（owner 是某面／分類為某類／斷言西樑有無參與）——違反共識。
S-2 用 tonemapped 截圖判「通過」，或在第 17 章綠燈以 < 500 spp 截圖宣告肉眼無線。
S-3 動 shader、動 bake、拉亮牆角、runtime blend／x-y 排除／換 package 迴避（全屬第 11 節硬否決）。
S-4 改用 Brave、改用非 9004 server、改驗收相機數值、改 package。
S-5 Step B 抽查值不符、Step C 兩法不一致或對位失敗、Step E contract FAIL。
S-6 Step E 前 registry 的 ownerPolicy 非 PENDING（被提前填定案），或 ownerPolicy 缺 gate／bake／metadata 證據；或把幾何相鄰當歸屬。
任一成立：停止本步、回報命中哪一條，等指示，不可自行繞道。
```

### 14.11 CODEX 逐步勾核表

| 步驟 | 必交證據檔 | 通過條件 | 結論紀律檢查 |
|---|---|---|---|
| Step A | stage-a/<run-id>/{probe.json, failing.png, overlay.png, overlay-vs-user-reference.png}、latest.json | 五行 line/control 齊、overlay 涵蓋 user-a1-redbox-reference.png 整條紅框、五行 alignment 全過 | 不得 root cause／owner／西樑參與定案（允許 routeName／ownerCount／luma 等資料摘要） |
| Step B | contact-edge-source.json | 抽查 6 值全符 + shaderGates.westRect===JS 真值 + wiringPresent===true | 純資料匯出，無判語 |
| Step C | 掃描輸出 + Blender 帶座標 | 落 beam-gap west 量級、兩法差 < 0.001 m | 幾何結果，無 owner 結論 |
| Step D | a1-contact-edge-registry.json、a1-owner-policy.md、a1-mesh-contact-debug.glb | 9 欄齊、ownerPolicy===PENDING、contactCandidates＋observedOwnerEvidence 齊 | ownerPolicy 不得在 Step D 填定案；幾何相鄰≠歸屬 |
| Step E | a1-…-registry-contract.test.js、seam-contracts-all.mjs | harness 全綠（鎖 gate／bake／metadata 三來源） | ownerPolicy 由三來源證據產出，非 Step D 預填 |
| Step F1 | S1/S6/S7/S8 先紅證據 + probe | 資料工廠先紅六項齊（不含候選門檻／無線） | 分類有實測支撐、標為輸出 |

註：第 13.11 節候選門檻達標與「使用者相機無線」屬第 17 章綠燈，不在本 SOP（資料工廠）勾核。

CODEX 任一格不過，回「未達 SOP 標準」，退回該步。OPUS 直接交 shader patch，或在資料產出前寫死 A1 結論，一律不算通過。

## 15. 全域 Blender／Python 接觸邊 registry 實作（A1 pilot 後的唯一下一步）

### 15.1 本章目的

第 14 章只證明「資料工廠能對 A1 pilot 先紅成功」。第 15 章把同一套資料工廠擴張到全房間接觸邊。目標是產出 full-room-contact-edge-registry.json，讓自動偵測出的每一條接觸邊都有世界座標、兩側 surface、Python/Blender 雙重掃描、gate／bake／metadata 三來源對帳、owner/route/luma probe 欄位、硬否決狀態。

本章不修黑線、不改 shader、不改 bake、不改 runtime 產品邏輯。A1 已經證明工具能抓到單點失敗；第 15 章要證明這套工具可以管理全域，服務範圍必須超過一條西樑北牆黑線。

### 15.2 固定輸入

```
1. 第 14 章已驗證的工具鏈：
   contact-edge-export.mjs
   contact-edge-scan.py
   contact-edge-blender.py
   contact-edge-registry-build.mjs
   seam-contracts-all.mjs

2. 人工候選清單：
   contact-edge-inventory.md 的 28 條接觸邊（A1–G8）。此清單只作預期覆蓋與差異比對，不能當權威接觸邊數量。

3. 幾何真值：
   js/Home_Studio.js 的 sceneBoxes。

4. 烘焙常數真值：
   js/InitCommon.js 的 R7310_C1_* surface / island / edge policy。

5. 使用者驗收相機：
   A1 使用第 14.1 節相機；其他邊先由 registry 標記待補相機。

6. 現有工具狀態：
   r7-3-10-contact-edge-scan.py、r7-3-10-contact-edge-blender.py、r7-3-10-contact-edge-registry-build.mjs 目前都是 A1 專用。第 15 章第一個工程動作是把它們擴成 full-room 模式。只重跑 A1 產物不算進入第 15 章。
```

### 15.2.1 G2 的 owner 與 surface 指派定義（動工前鎖死）

```
1. G2 不讀 runtime probe owner。
   G2 的 owner 判斷只能使用 InitCommon / shaderGates / WORLD_BOUNDS 形成的靜態 ownerHint。
   runtime probe owner 只能在 G5 使用。
   這樣 G2 先產清單、G5 再驗 runtime，順序才成立。

2. rawContact 的兩側 surface 指派分兩層。
   2.1 geometricSurfaceCandidates：
       只做 point-in-WORLD_BOUNDS。
       對 contact 的代表點取樣，找出落入 23 個 surface WORLD_BOUNDS 的候選 surface。
   2.2 gatedSurfaceCandidates：
       在 geometricSurfaceCandidates 上，再套用靜態 gate / excludedContactFaces / shaderGates / atlasEdgePolicies。
       這層用來判斷這條邊是否落在 gate 或 atlas 邊界。

3. contact 代表點取樣規則。
   3.1 coplanarFaceContact：
       取中心點、四個內縮角點、四條邊中點。
   3.2 orthogonalEdgeContact：
       取線段中點、兩端內縮點、25% 點、75% 點。
   3.3 內縮距離：
       預設 0.001m；若線段長度不足以內縮，改取中點並標 shortEdge=true。

4. surface 指派遇到多重候選時不可硬選一個。
   registry 要保留 candidates 陣列。
   若候選需要 runtime probe 才能判斷，狀態標 NEEDS_PROBE。

5. managedContacts 的「兩側 owner 不同」指的是 staticOwnerHint 不同。
   它與 G5 的 runtime owner 分屬不同欄位。
   欄位名稱固定用 staticOwnerHint，避免和 runtime owner 混淆。
```

### 15.2.2 full-room 執行紀律（禁背景長跑）

```
1. G1 匯出、G3 Blender、G5 probe 都要拆成離散短任務。
2. 禁用 background 長跑。
3. Chrome / CDP 使用單一 port；每次任務跑完必須關 Chrome。
4. 每個工具必須寫 run-id 與 log。
5. 發現殘留 Chrome、殘留 Blender、殘留 CDP port 時先停，清完再跑。
```

### 15.3 執行步驟

```
Step G1　全域匯出
  用 Step B 匯出橋重跑一次 contact-edge-source.json。
  驗收：boxes=88、surfaces=23、structuralIslands=8、atlasEdgePolicies 存在、shaderGates 有解析。

Step G2　全域接觸邊掃描
  用 Python 掃 sceneBoxes 所有可接觸面，輸出 full-room-contact-edge-scan.json。
  現有 A1 專屬啟發式禁止沿用到 full-room。第 15 章必須改成通用接觸偵測演算法，並同時抓兩類接觸：
    類型 1：共面面接觸（coplanarFaceContact）。A1 屬於這一類。
    類型 2：垂直 L 角線接觸（orthogonalEdgeContact）。地板↔牆腳、天花板↔樑側、牆↔柱角屬於這一類。
  類型 1：共面面接觸演算法：
    對所有 box pair、每個 box 的 6 個座標軸對齊面逐一比對。
    兩面成立 contact 的條件：
      同軸；
      固定軸座標相等（差 < 0.001m）；
      另兩軸矩形在該平面有正面積重疊。
    重疊矩形即一條 rawContact。
  類型 2：垂直 L 角線接觸演算法：
    對所有 box pair、每個 box 的 6 個面逐一比對。
    兩面成立 L 角 contact 的條件：
      兩面固定軸不同；
      面 A 的固定軸座標落在面 B 的矩形範圍內（含 0.001m 容差）；
      面 B 的固定軸座標落在面 A 的矩形範圍內（含 0.001m 容差）；
      第三個共同延伸軸的兩段 interval 有正長度重疊。
    共同延伸軸上的重疊線段即一條 rawContact，contactType 記為 orthogonalEdgeContact。
  每條 rawContact 必須記 contactType、兩側 face axis、固定軸座標、世界座標範圍。
  容差分兩種：
    contactEps = 0.001m：真正幾何接觸。
    nearMissEps = 0.003m：疑似應接觸但有 1–3mm 小間隙或內縮，輸出 rawNearMissContacts，狀態標 NEAR_MISS。
    近接觸不可直接當已接住；它是風險候選，進 reconciliation 給 CODEX 審。
  去重合併規則：
    對 contactType、兩側 box、兩側 face axis、量化座標（0.001m 格）建立 canonicalKey。
    同一物理邊由多個 box-pair 重複產出時，合併成一條 mergedRawContact，保留 sourcePairs 陣列。
    合併後必須保留原始 rawContact 數量與 sourcePairs，不能把來源丟掉。
  full-room-contact-edge-scan.json 至少輸出兩層：
    rawContacts：完整幾何接觸事實，不先丟資料。
    rawNearMissContacts：1–3mm 近接觸風險，不當成已接住。
    managedContacts：進 registry 的受管邊。
  managedContacts 納入規則：
    兩側分屬不同 baked surface；
    或兩側 owner 不同；
    或接觸帶落在 atlas 邊界；
    或接觸帶落在 runtime gate 邊界；
    或該邊已有使用者回報／舊 probe 風險。
    同面同 owner 的內部相接可留在 rawContacts，不進 managedContacts，但 reconciliation 要能說明原因。
  每條 managedContact 須含 edgeId、世界座標、兩側 box、兩側 surface 候選、納入理由。
  驗收：輸出完整 rawContacts、rawNearMissContacts、managedContacts；A1 必須由共面面接觸演算法抓到，座標與第 16 章一致；人工清單中的地板牆腳、天花板樑側等 L 角邊必須由垂直 L 角線接觸演算法抓到；再和 contact-edge-inventory.md 的 28 條人工候選清單做差異表。

Step G3　Blender 全域複查
  用 Blender headless 重建 debug mesh，對 G2 的接觸帶做第二意見。
  輸出 full-room-contact-edge-debug.glb 與 full-room-contact-edge-blender.json。
  Blender 複查分兩種方法：
    coplanarFaceContact：可沿用 A1 的面重疊／薄體積交集法，輸出重疊面範圍。
    orthogonalEdgeContact：不可用 boolean 體積交集。Blender 腳本必須用兩個 face mesh 的世界座標頂點重建面平面，
      求兩平面交線，再把交線裁切到兩個 face 矩形範圍，輸出線段端點。
      若無法取得有效交線或裁切結果，該 edge 寫 blockingIssue，不可默默跳過。
    debug GLB 要把 coplanar 面帶與 orthogonal 線段用不同顏色標示。
  驗收：Python 與 Blender 的每條共面面接觸帶、每條垂直 L 角線段差 < 0.001 m；差異超標列入 blockingIssues。

Step G4　全域 registry
  產出 full-room-contact-edge-registry.json。
  每條自動偵測邊至少 9 欄：名稱、世界座標、兩側 surface、ownerPolicy、baked package、驗收相機、probe 欄位、候選門檻、硬否決。
  ownerPolicy 初始可為 PENDING；不可人工猜 owner。

Step G5　全域三來源對帳
  對每條邊比對 gate / bake / metadata。
  輸出 full-room-contact-edge-reconciliation.md。
  每條邊標 AGREE、DESYNC、EDGE-DIP、OWNERLESS、NEEDS_PROBE 之一。
  reconciliation 必須另列人工 28 條與自動清單的差異：autoOnly、manualOnly、coordinateMismatch。
  coordinateMismatch 門檻：
    差 ≤ 0.01m：記 minorDelta，不算 mismatch。
    差 > 0.01m：記 coordinateMismatch，必須列原因或 blockingIssue。
  manualOnly 規則：
    每一條 manualOnly 必須分類為 scannerGap、staleManual、needsRule 三者之一，並附證據。
    未分類 manualOnly 數量 > 0 → 第 15 章不能通過。
  A1 須保留第 16 章實測結果：owner 1015 baked 緊鄰 route=none / ownerCount=0 帶。
  probe 規模化策略：
    全域階段只讀決定性欄位：route 31/35、worldPosition 32、ownerCount 37、atlas 49。
    這些欄位來自靜態 package 與逐像素 gate，低 spp 即可用於資料表判定。
    不對每條邊累積 ≥500 spp；高 spp 視覺截圖留給第 17 章綠燈。
    只有已有使用者驗收相機的邊才做視覺截圖；其餘邊標 NEEDS_PROBE。
    NEEDS_PROBE 仍可做靜態對帳：gate-vs-metadata、WORLD_BOUNDS、atlasEdgePolicies 可以判 AGREE/DESYNC/EDGE-DIP 的靜態部分。
    OWNERLESS、route 類 runtime 結論必須等相機 probe，不可用靜態資料硬判。
    CDP 必須前景短跑、單一 port、跑完關 Chrome，避免殘留背景程序。

Step G6　contract test 擴張
  把 A1 三來源 test 擴成全域 test。
  輸出 docs/tests/r7-3-10-full-room-contact-edge-registry-contract.test.js。
  seam-contracts-all.mjs 必須納入此 test。
  contract 斷言範圍：
    registry 每條 managedContact 的 worldBounds / surfaceCandidates / staticOwnerHint 必須能回指 contact-edge-source.json。
    registry 引用的 InitCommon WORLD_BOUNDS、structuralIslands、atlasEdgePolicies 必須和 source.json 逐欄一致。
    registry 引用的 shaderGates 必須和 shader 檔解析結果一致，且 wiringPresent=true。
    reconciliation 的 autoOnly/manualOnly/coordinateMismatch 計數必須和 registry / scan / inventory 三方資料一致。
    full-room test 不要求 runtime probe owner 全部已知；NEEDS_PROBE 邊只能鎖靜態欄位。
```

### 15.4 全域 registry 成功定義

```
1. full-room-contact-edge-registry.json 產出。
2. Python／Blender 自動偵測出的每條接觸邊都有 registry 條目。
3. 每條自動偵測邊都有 Python 與 Blender 雙重掃描結果。
4. A1 的實測根因與第 16 章一致。
5. 每條邊都有狀態標記，不可空白。
6. contract test 能防止 JS / shader / metadata 與 registry 脫節。
7. 未動 shader、bake、runtime 產品邏輯。
8. 人工 28 條清單已完成差異對表，manualOnly / autoOnly / coordinateMismatch 都有說明。
9. rawContacts、rawNearMissContacts、managedContacts 都已輸出；rawContacts 同時包含 coplanarFaceContact 與 orthogonalEdgeContact；managedContacts 每條都有納入理由。
10. 人工清單中的垂直 L 角邊已由 orthogonalEdgeContact 自動偵測，沒有靠 manualOnly 人工補回。
11. manualOnly 全部已分類，未分類 manualOnly 數量為 0。
12. 多數邊狀態為 NEEDS_PROBE 屬正常；第 15 章成功只代表資料表、差異表、雙掃與 contract 完成，不代表全房間逐條視覺驗收已通過。
```

### 15.5 全域硬停

```
1. 任何工具只輸出 A1，沒有輸出 full-room 自動清單 → 停。
2. 工具輸出固定 28 條，卻沒有自動掃描差異對表 → 停。
3. G2 沿用 A1 專屬啟發式，沒有改成通用面相鄰演算法 → 停。
4. full-room-contact-edge-scan.json 缺 rawContacts、rawNearMissContacts、managedContacts 任一層 → 停。
5. rawContacts 只抓共面面接觸，缺垂直 L 角線接觸 → 停。
6. managedContacts 缺納入理由 → 停。
7. A1 沒有被共面面接觸演算法抓到，或座標與第 16 章不一致 → 停。
8. 人工清單中的垂直 L 角邊落入 manualOnly，且沒有列 blockingIssues → 停。
9. manualOnly 存在未分類項目 → 停。
10. coordinateMismatch 門檻未使用 >0.01m → 停。
11. Python 與 Blender 的接觸帶或 L 角線段差異超過 0.001 m 且未列 blockingIssues → 停。
12. Blender 對 orthogonalEdgeContact 仍使用體積 boolean 當第二意見 → 停。
13. registry 缺 ownerPolicy / contactCandidates / observedOwnerEvidence 任一欄 → 停。
14. A1 被拿去直接修補，且未先完成 full-room registry → 停。
15. 用截圖平滑替代 owner / route / coverage 證據 → 停。
16. 對每條邊強跑 ≥500 spp 截圖，導致 CDP 背景程序殘留或工作不可收斂 → 停。
17. contract test 未納入全域 registry → 停。
```

### 15.6 與第 17 章的關係

第 15 章只產出全域資料表與測試，不修。第 17 章才根據 full-room-contact-edge-registry.json 設計修法與綠燈驗收。第 17 章若要先修 A1，必須說明該修法對全域自動偵測清單的影響，並重跑第 15 章全域 contract。

## 16. A1 先行 SOP 執行結果（供 CODEX 審查）

> 本節記錄第 14 章 A1 pilot SOP 的實際執行結果（OPUS 執行，2026-06-03）。canonical Step A run＝`stage-a/stagea-final4`（`stage-a/latest.json` 指向）。
> 本輪只跑「資料工廠先紅」，未動 shader／bake／runtime，未進第 15 章全域擴張，也未進第 17 章修法。

### 16.1 六步逐項結果

| 步驟 | 結果 | 關鍵證據 |
|---|---|---|
| 14.2 前置檢查 | PASS | P1 server 9004 回 200；P2 probe driver／相機 setter 皆為 function；P3 既有 contract 3/3 綠；P4 分支 codex/r7-3-10-global-seam-hardening、新檔限定 docs/tools・docs/tests・本 review 目錄；P5 user-a1-redbox-reference.png 就位 |
| 14.3 Step A 先紅基線 | PASS | stagea-final4：fiveRows=true、allRowsAligned=true；五行 level32 worldPosition 全落 x≈-1.75、z=-1.874（西樑↔北牆交界）；overlay 線 x=595 落紅框 x[0.42,0.52] 內、縱向五點涵蓋紅框主體 |
| 14.4 Step B 匯出橋 | PASS | contact-edge-source.json：boxes 88、surfaces 23、islands 8；北牆 z=-1.874、西樑 x=-1.75；northWallBeamGap.west={-1.908,-1.752,2.525,2.905}；shaderGates.westRect==JS 逐位元、wiringPresent=true |
| 14.5 Step C 掃描 | PASS | A1 帶 x[-1.91,-1.75] y[2.525,2.905] z=-1.874；Python 矩形交集與 Blender 布林兩法 diffs 全 0（<0.001m）；a1-mesh-contact-debug.glb 產出 |
| 14.6 Step D registry | PASS | ownerPolicy=PENDING；contactCandidates＝幾何兩側（北牆 idx15 +Z／西樑 idx28 -Z）；observedOwnerEvidence＝五行原始讀值；seamTransitionSweep＝x-sweep 實測；9 欄齊 |
| 14.7 Step E contract | PASS | `node docs/tests/r7-3-10-seam-contracts-all.mjs` → 4/4 PASS（含新 A1 三來源 test） |
| 14.8 Step F1 先紅驗收 | PASS | 六項全齊；只宣告「資料工廠先紅成功」，未宣告黑線修好（見 a1-stage-f1-acceptance.md） |

### 16.2 A1 先紅實測根因（由資料產出，未預設）

```
x-sweep（y=400、acceptance 相機、d800-north-denoise-c、nonSquareReady=true）跨接縫實測：
  x_screen 560–584：西樑 owner 1015（route west_beam_inner_shadow_hybrid）baked luma ~0.097–0.105
  交界 ~x_screen 588
  x_screen 592–680：北牆面（z=-1.874）route="none"、ownerCount=0、luma=0（純黑）
實測結論：A1 黑線＝西樑 baked 面緊鄰一條「route=none／ownerCount=0」的北牆帶（無 baked 擁有者＝全黑）。
```

此實測與舊根因規格「owner 1002 atlas 邊緣 dip」不同。因此 ownerPolicy 維持 PENDING，A1 缺陷分類（落第 3.2 節哪一種）由本資料與後續對帳建立，本輪不預設。資料工廠的價值正是揭露這個差異（呼應第 2.3／12.2.4 節）。

### 16.3 交付物（皆在本 review 目錄／docs）

```
新工具：contact-edge-export.mjs、contact-edge-scan.py、contact-edge-blender.py、
       contact-edge-registry-build.mjs、contact-edge-stage-a.mjs（皆 docs/tools/）；
       docs/tests/r7-3-10-a1-contact-edge-registry-contract.test.js（已併入 seam-contracts-all.mjs）
資料：contact-edge-source.json、a1-contact-edge-registry.json、a1-owner-policy.md、
     a1-mesh-contact-debug.glb、a1-seam-transition-sweep.json、a1-stage-f1-acceptance.md、
     stage-a/latest.json、stage-a/stagea-final4/{west-beam-north-contact-probe.json,
     ...-failing.png, ...-overlay.png, overlay-vs-user-reference.png}
```

### 16.4 執行中的修正（誠實記錄）

```
1. box 數 89→88：先前用 grep 連 `function addBox` 定義行一起數＝off-by-one；runtime 真值 88、無缺。
   已更正 SOP（13.5／14.1／14.4）與工具 expect 字串。
2. Step A worldPosition 一度回 null：probe driver 回傳的 samplePoints 不帶 role/name 欄位，
   舊程式用 p.role 取點＝undefined。改用回傳的 x 座標配對 line/control 後修復（五行 alignmentOk 全 true）。
3. Step A 偵測 y 範圍：tonemapped 暗列對這條淡線不可靠（drop ~0.005），改用 probe worldPosition
   客觀定位北牆面接縫的 y 範圍（z≈-1.874、x≈-1.75），再均分五行。
4. 紅框偵測：收緊門檻（R>180,G<70,B<70）並排除頂部瀏覽器 chrome，從誤抓全畫面改為正確抓到置中紅橢圓。
```

### 16.5 誠實限制（供審查判斷）

```
A. spp：stagea-final4 accumulatedSamples=14。headless swiftshader CPU ≈0.37 spp/秒、500 spp 需 ~22 分鐘，
   且背景跑屢遭 session 重啟孤兒化。A1 兩側皆烘焙面（讀靜態 atlas、無 path-tracing 雜訊），低 spp 截圖
   即無雜訊（diag 35 spp 截圖證實）。客觀錨為 spp 無關的 level32 worldPosition 與 level31/37 route/owner。
   嚴格 ≥500 spp 乾淨截圖屬第 17 章 GPU 綠燈（使用者紅框參考圖本身即真實 GPU 擷取）。
B. overlay 涵蓋：五點涵蓋「可解析到北牆面的接縫段」（螢幕 y 250–610）；使用者紅橢圓畫得略高，頂端約多 ~27px，
   該段是接縫轉到樑/天花板、worldPosition 不再落北牆面之處。線的水平位置與縱向主體與圈選一致，
   且 worldPosition 客觀證實這條取樣線即西樑↔北牆交界。
C. 跨影像比較：lineFracX（我的 1280×720 viewport）與紅框 frac（使用者整窗截圖含 chrome）屬不同座標系，
   為近似對照；嚴謹錨在 worldPosition 與並排合成圖人眼複核。
```

### 16.6 硬停合規（第 14.10 節）

```
未動 shader／bake／runtime 產品邏輯：git 中 Home_Studio_Fragment.glsl／Home_Studio.js／Home_Studio.html
  的改動為本 session 開始前既有（R7-3.10 進行中），執行者全程未 Edit/Write 這些檔；新檔僅落
  docs/tools、docs/tests、本 review 目錄。
未在資料產出前預設 A1 結論：ownerPolicy 全程 PENDING；實測根因（route=none 帶）由資料產出。
未跳第 17 章修法；未用新截圖取代使用者紅框圖（基準＝user-a1-redbox-reference.png）。
```

### 16.7 結論

資料工廠對 A1 pilot 先紅成功：六步跑通，A1 失敗狀態已定位、量測、登記、三來源鎖死，實測根因由資料產出（route=none 未認領帶），ownerPolicy 維持 PENDING。依第 13.8 節，下一步固定進第 15 章，把同一套方法擴張到全房間自動偵測接觸邊，再和 28 條人工候選清單對表。黑線修法與綠燈延後到第 17 章。

## 17. 修法與綠燈驗收（等第 15 章全域 registry 完成後）

第 17 章暫不展開實作。它的輸入必須是第 15 章的 full-room-contact-edge-registry.json 與 full-room-contact-edge-reconciliation.md。修法不得只看 A1；必須知道全房間每條接觸邊的狀態，才可決定要改 atlas edge fill、runtime gate、metadata，或幾何封邊。

```
第 17 章開始條件：
1. 第 15 章全域 registry 完成。
2. 全域自動偵測清單都有狀態標記，且已和人工 28 條候選清單完成差異對表。
3. A1 的 route=none / ownerCount=0 帶仍在 registry 裡被追蹤。
4. contract test 已鎖住全域 registry。
5. 要修的目標邊必須已有驗收相機與 probe。A1 已符合；contact-edge-inventory 的高風險邊（A2 北牆↔東樑、B1 東牆↔東樑、C1 西牆↔西樑、D4 南牆 AC 側柱背）若要同輪修，須先補相機與決定性 probe。
6. 其餘 NEEDS_PROBE 邊可保留待驗狀態，但不得被拿來宣稱已修好。

第 17 章成功定義：
1. 修法後沒有黑線、白線、縫隙。
2. 沒有新增 live 補洞。
3. 沒有 ownerCount=0 的未認領區。
4. 接觸邊兩側 route / owner / baked coverage 連續。
5. 目標修法邊的使用者相機與 probe 都通過。
6. full-room registry 重跑後，沒有新增 autoOnly、未分類 manualOnly、未分類 coordinateMismatch。
7. 非目標 NEEDS_PROBE 邊維持待驗狀態，不能寫成已通過。
```

## 18. 清理政策（第 15 章動工前可做，需使用者確認）

本章只定義清理規則，不直接刪檔。

```
18.1 stage-a 舊 run-id
  canonical run 是 stage-a/stagea-final4，latest.json 指向此 run。
  其他 diag / probe / stagea-final2 / stagea-final3 / stagea-final5 只可在使用者確認後移到 archive。

18.2 工具 dev 殘留
  contact-edge-stage-a.mjs 的 env-gated DIAG 區塊可保留，但 debug log 若會污染正式輸出，清掉。
  docs/tools/__pycache__ 屬 Python 副產物，可清。

18.3 孤兒工具
  west-beam-north-contact-probe.mjs / west-beam-north-probe2.mjs 若只作歷史參考，標成 legacy。
  若第 15 章 full-room 工具已覆蓋其功能，再由使用者確認後移到 archive。

18.4 第 14.3 spp 文字
  第 14 章已改成記錄實得 spp。
  嚴格 ≥500 spp 視覺截圖歸第 17 章 GPU 綠燈。
```
