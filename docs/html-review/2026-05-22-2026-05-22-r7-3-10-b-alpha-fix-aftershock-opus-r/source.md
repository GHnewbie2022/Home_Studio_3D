> 本頁是給 OPUS 的乾淨審查版。上一份第 1 到 29 節保留為完整歷史；本頁只整理第 29 節已通過的有效修法、使用者肉眼驗收結果、以及新的 6 個餘震項目。

## 0. 讀法

本頁分成三段：

1. 第 29 節有效經驗濃縮：說明這次真正修好的原因。
2. 使用者肉眼驗收：西／東主三面交界已正常。
3. 新餘震清單：仍需 OPUS 審查與 CODEX 後續量測的 3 到 6 項。

實機驗收網址：

```text
http://localhost:9002/Home_Studio.html?v=r7310-b-alpha-fix-20260522
```

完整舊報告位置：

```text
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/html-review/2026-05-21-r7-3-10-hybrid-edge-regression-map/index.html
```

## 1. 第 29 節有效經驗濃縮

第 29 節已實作並驗證 OPUS 批准的 B 案。核心做法是讓牆面 patch 中「柱後、樑後永遠不可見的死角 texel」在烘焙時直接無效化，重烤後變成 `alpha=0`，讓 `SampleValidLinear` 排除這些近黑資料。

這次修正沒有使用 LIVE 顏色補牆，也沒有再移動 route handoff 數字。有效經驗如下：

```text
1. 近黑污染的關鍵條件
   問題區域原本是 alpha=1 的有效資料，但 luma 接近 0。
   這會讓取樣器把它當成可用資料，進而在可見邊界形成黑線。

2. 有效修法
   柱後、樑後這類永遠不可見的區域，烘焙時要 return false。
   重烤後 atlas alpha 與 metadata alpha 都必須變成 0。

3. 載重驗收
   第 29 節 post-fix alpha 直讀結果 overallPass=true。
   1003、1004、1011、1013 的柱後與樑後區域，atlas alpha 與 metadata alpha 全部 allZero=true。

4. luma 改善
   東側主縫 ΔL：0.235824 → 0.033275。
   西側主縫 ΔL：0.178172 → 0.004533。

5. 實作範圍
   shaders/Home_Studio_Fragment.glsl
   js/InitCommon.js
   docs/tools/r7-3-8-c1-bake-capture-runner.mjs
   相關重烤 package：1003、1004、1011、1013。
```

第 29 節給出的重要判斷：主黑線來自「可見邊界吸到 alpha=1 的近黑死角 texel」。修正成功的條件是讓這類死角 texel 變成 `alpha=0`，讓正式取樣規則自然避開。

## 2. 使用者肉眼驗收：已正常的兩個主交界

使用者在 `http://localhost:9002/Home_Studio.html?v=r7310-b-alpha-fix-20260522` 肉眼驗收後回報：

```text
1. 西樑、西南柱、西牆三面交界處已經正常。
2. 東樑、東南柱、東牆三面交界處已經正常。
```

這兩點代表第 29 節 B 案主修已經通過使用者肉眼初驗。後續不要把這兩個位置重新打散成舊問題；若 OPUS 同意，這兩點可當成本輪修法的成功案例。

## 3. 新餘震項目總表

以下是使用者在同一個修正版本下看到的後續餘震。第 1、2 項是已正常的正例；第 3 到 6 項是新待查項。

| 編號 | 位置 | 狀態 | 初步分類 |
|---:|---|---|---|
| 1 | 西樑／西南柱／西牆三面交界 | 已正常 | 第 29 節 B 案成功案例 |
| 2 | 東樑／東南柱／東牆三面交界 | 已正常 | 第 29 節 B 案成功案例 |
| 3 | 東樑與東南柱交界 | 待查 | 很細黑線，可能同屬樑／柱交界死角污染或 edge sampling |
| 4 | 東南柱與南牆交界 | 待查 | 很細黑線，可能屬柱／南牆接縫或南牆 patch 邊界資料問題 |
| 5 | 南牆窗洞與西南柱交界 | 待查 | 兩條細黑線，一條垂直南牆，一條垂直桌面 |
| 6 | 西牆／北牆／地板交界 | 待查 | 西牆角落被地板顏色污染，可能是 floor/wall 邊界 texel 混入 |

OPUS 審查目標：請判斷第 3 到 6 項是否可沿用第 29 節的「死角 texel alpha=0」模型，或需要拆成不同家族。

## 4. 餘震 3：東樑與東南柱交界有很細黑線

使用者描述：

```text
東樑與東南柱之交界有很細的黑線。
```

重現視角：

```json
{
  "cameraState": {
    "position": {"x": 1.843474, "y": 2.788762, "z": 2.468634},
    "yaw": -2.083585,
    "pitch": 1.051,
    "fov": 55,
    "forward": {"x": 0.432817, "y": 0.86792, "z": 0.243687}
  },
  "view": {"facing": "上(+Y)", "config": 1, "samples": 1, "paused": true, "sppCap": 1000},
  "viewport": {
    "innerWidth": 727,
    "innerHeight": 741,
    "canvasCssWidth": 727,
    "canvasCssHeight": 409,
    "drawingBufferWidth": 1280,
    "drawingBufferHeight": 720,
    "devicePixelRatio": 3.5,
    "aspect": 1.777778
  }
}
```

CODEX 初步判斷：

```text
這個位置靠近東樑與東南柱交界。
第 29 節已處理東牆／東樑／東南柱三面交界主黑縫，但這裡是更貼近樑與柱彼此接觸線的細線。
優先量測 route、world position、coverage alpha、luma，確認黑線是否仍來自 alpha=1 的近黑死角 texel。
```

## 5. 餘震 4：東南柱與南牆交界有很細黑線

使用者描述：

```text
東南柱與南牆之交界有很細的黑線。
```

重現視角：

```json
{
  "cameraState": {
    "position": {"x": 1.684612, "y": 2.290972, "z": 2.93945},
    "yaw": -2.250385,
    "pitch": 0.228,
    "fov": 55,
    "forward": {"x": 0.757701, "y": 0.22603, "z": 0.612209}
  },
  "view": {"facing": "東(+X)", "config": 1, "samples": 1, "paused": true, "sppCap": 1000},
  "viewport": {
    "innerWidth": 727,
    "innerHeight": 741,
    "canvasCssWidth": 727,
    "canvasCssHeight": 409,
    "drawingBufferWidth": 1280,
    "drawingBufferHeight": 720,
    "devicePixelRatio": 3.5,
    "aspect": 1.777778
  }
}
```

CODEX 初步判斷：

```text
這個位置可能已離開第 29 節的東牆 beam-shadow route，進入東南柱與南牆的交界。
先量測黑線兩側 route 與 luma，不要直接套用東牆 z cutoff。
如果南牆 patch 的窗洞或柱後區域也存在 alpha=1 近黑資料，才可沿用 B 案。
```

## 6. 餘震 5：南牆窗洞與西南柱交界有兩條細黑線

使用者描述：

```text
南牆窗洞與西南柱之交界有很細的黑線。
有兩條，一條垂直南牆，另一條垂直桌面。
```

重現視角：

```json
{
  "cameraState": {
    "position": {"x": -1.665066, "y": 1.110604, "z": 3.009405},
    "yaw": 2.4608,
    "pitch": -0.615,
    "fov": 55,
    "forward": {"x": -0.514085, "y": -0.576959, "z": 0.634693}
  },
  "view": {"facing": "南(+Z)", "config": 1, "samples": 1, "paused": true, "sppCap": 1000},
  "viewport": {
    "innerWidth": 727,
    "innerHeight": 741,
    "canvasCssWidth": 727,
    "canvasCssHeight": 409,
    "drawingBufferWidth": 1280,
    "drawingBufferHeight": 720,
    "devicePixelRatio": 3.5,
    "aspect": 1.777778
  }
}
```

使用者截圖：

![南牆窗洞與西南柱交界細黑線](images/aftershock-05-south-window-sw-column.png)

CODEX 初步判斷：

```text
這一項比較可能牽涉南牆窗洞、窗洞邊界、桌面或西南柱之間的多面交界。
第 29 節經驗仍有參考價值，但需要先量測兩條線各自的 route。
兩條線可能不是同一個 surface pair，需要分開掃線。
```

## 7. 餘震 6：西牆／北牆／地板交界，西牆角落被地板顏色污染

使用者描述：

```text
西牆、北牆、地板交界處，西牆最頂點的角落被地板顏色污染。
```

重現視角：

```json
{
  "cameraState": {
    "position": {"x": -1.848862, "y": 0.051621, "z": -1.82129},
    "yaw": 1.008815,
    "pitch": -0.226,
    "fov": 55,
    "forward": {"x": -0.824682, "y": -0.224081, "z": -0.519314}
  },
  "view": {"facing": "西(-X)", "config": 1, "samples": 102, "paused": true, "sppCap": 1000},
  "viewport": {
    "innerWidth": 727,
    "innerHeight": 741,
    "canvasCssWidth": 727,
    "canvasCssHeight": 409,
    "drawingBufferWidth": 1280,
    "drawingBufferHeight": 720,
    "devicePixelRatio": 3.5,
    "aspect": 1.777778
  }
}
```

CODEX 初步判斷：

```text
這一項和第 29 節黑線家族相近，但表現從近黑污染變成地板顏色混入西牆角落。
優先查西牆與地板 atlas 在北西角的取樣歸屬、有效 alpha、以及 bilinear 邊界是否吃到地板 texel。
這可能是「有效但錯色」的污染家族，修法未必是單純 alpha=0。
```

## 8. 建議 OPUS 審查問題

請 OPUS 直接針對以下問題回覆，方便 CODEX 下一輪只做必要量測：

```text
1. 第 1、2 項是否可確認為第 29 節 B 案已通過的成功案例？

2. 第 3 項東樑／東南柱細黑線，OPUS 認為應先查哪一組 route？
   候選：east beam-shadow、se column north / west、ceiling / soffit 類 route。

3. 第 4 項東南柱／南牆細黑線，是否應視為南牆家族，而非東牆家族？

4. 第 5 項兩條線是否要拆成兩條獨立掃線？
   一條沿南牆窗洞／西南柱，另一條沿桌面方向。

5. 第 6 項地板顏色污染，是否可暫定為「有效但錯色」家族，
   量測時優先抓 luma 之外的 RGB 與 route / atlas UV？

6. 下一輪 CODEX 是否應先只量測第 3 到 6 項，
   等 OPUS 判斷家族後再動修正碼？
```

## 9. CODEX 建議的下一輪最小量測

如果 OPUS 同意，下一輪可只做量測，不先改碼：

```text
1. 每個餘震項用原 cameraState 重現。
2. 每條黑線做一條 1D 掃線，黑線兩側各至少 10 像素。
3. 每點記錄 world position、route id/name、targetId、atlas UV、alpha/weightSum、RGB/luma、hitType、normal。
4. 第 5 項分成兩條掃線。
5. 第 6 項額外記錄 RGB，不只看 luma，因為問題是地板顏色污染。
6. 與第 29 節成功案例做對照：成功案例應維持 alpha=0 死角排除，餘震項若 alpha=1 且顏色異常，再分類處理。
```

## 10. OPUS 審查（claude opus 4.7，2026-05-22）

我已直接讀現行 shader 程式碼核對（不只看報告）。結論：B 案主修確認成功，6 個餘震可分成 3 個家族，且其中兩項（item 4 與 item 5 的南牆線）已可從程式碼直接定位、不必再猜。

### 10.1 確認 items 1 / 2 為 B 案成功案例（回答 Q1：是）

程式碼證據：patch 1011 現在呼叫 `r7310C1EastWallHiddenByBeamOrSeColumn(z, y)` → `return false`；patch 1013 呼叫 `r7310C1WestWallHiddenByBeamOrSwColumn(z, y)` → `return false`。helper 名稱含「BeamOr...Column」，代表**牆面背後的「樑後 ＋ 柱後」死角一次都遮掉了**，所以東/西三面交界主縫消失、且圖三（西牆+西樑）那段也一併解掉。配合第 29 節「alpha 全 allZero=true、ΔL 0.236→0.033 / 0.178→0.005」，items 1/2 確認通過，**不要再動這兩處**。

### 10.2 餘震家族分類

| 項 | 位置 | OPUS 家族判定 | 依據 |
|---:|---|---|---|
| 3 | 東樑 ∧ 東南柱 | 很可能 = 死角家族（Invalid Texel），但在「樑/柱 patch」而非牆面 patch | 牆面已遮；此線在樑與柱「彼此」接觸線，疑似某塊樑/柱 patch 把對方實體背後也烤了。需 probe alpha+luma 確認 |
| 4 | 東南柱 ∧ 南牆 | **確定 = 死角家族，在南牆 patch 1010（未遮）** | 程式碼：1010 把 `x∈[-2.11,2.11]、z=3.056` 全烤、只 `return false` 窗洞；東南柱 `x∈[1.78,1.91]` 在 z=3.056 是柱後死角，1010 沒遮 → 同 alpha=1 近黑 |
| 5 | 南牆窗洞 ∧ 西南柱（兩條線） | 混合：南牆那條很可能同 item 4（南牆 1010 的「西南柱後」x∈[-1.91,-1.75]）；桌面那條未知，需 probe | 西南柱後在 1010 同樣未遮；第二條垂直桌面疑似桌子相關，另一個 surface pair |
| 6 | 西牆 ∧ 北牆 ∧ 地板（西牆角落染地板色） | **不同家族 = 「有效但錯色」跨 patch 滲色（非死角）** | 不是近黑、是地板「顏色」混入；對應 Unity 的 cross-chart bleeding（chart 間 padding 不足、bilinear 鄰域吃到地板 texel）。修法不是 alpha=0 |

重點：**item 4 與 item 5 的「南牆那條線」其實是同一塊 patch（南牆 1010）的同一個病——柱後死角未遮（東南柱 ＋ 西南柱兩個腳印）。** 一個修正（把 1011/1013 用的 `HiddenBy...` 同款遮蔽，套到 patch 1010 的東南/西南柱腳印）可同時收掉 item 4 與 item 5 的南牆線。這正是「修家族、不要逐處補」。

### 10.3 回答第 8 節六問

```text
Q1 items 1/2 成功？ → 是，已用程式碼確認遮蔽落地、ΔL 收斂、肉眼過；勿再擾動。

Q2 item 3 先查哪組 route？
   → east beam-shadow(under/inner) ＋ se column north/west。
     重點不是再查牆面(已遮)，是查「樑 patch 或柱 patch 是否把對方實體背後也烤成 alpha=1 近黑」。
     probe route+alpha+luma；若 alpha=1 近黑 → 同 B 案、遮那塊樑/柱 patch。

Q3 item 4 屬南牆家族(非東牆)？
   → 是，且已從程式碼確定：是南牆 patch 1010 把「東南柱後」烤成死角、且 1010 只遮窗洞沒遮柱。
     修法 = 把 B 案同款遮蔽套到 1010 的柱腳印，不是動東牆、也不是新 z cutoff。

Q4 item 5 拆兩條掃線？ → 是。
   南牆那條很可能同 item 4(南牆 1010 西南柱後)；桌面那條另查(疑似桌子相關 surface pair)。

Q5 item 6 是「有效但錯色」家族、要記 RGB？
   → 是。這是跨 patch 滲色(floor 色進西牆角)，不是死角近黑；alpha=0 修不了。
     probe 必須記 RGB(非只 luma)＋atlas UV＋route+alpha；修法偏 padding/gutter 或邊界歸屬。

Q6 下一輪先只量測？
   → items 3、5(桌面線)、6：是，先量測分家族再修。
     item 4 與 item 5 南牆線：程式碼已可定位(南牆 1010 柱後)，probe 主要是確認(預期 alpha=1 近黑)，
     確認後可直接走同 B 案遮蔽。
```

### 10.4 給 CODEX 的下一動

```text
1. 先量測 items 3~6(沿用第 9 節 1D 掃線法)，item 5 拆兩條、item 6 加記 RGB。
2. 預期家族：
   - item 4 + item 5 南牆線：南牆 patch 1010 柱後死角(alpha=1 近黑) → 確認後套同 B 案遮蔽(1010 東南/西南柱腳印)。
   - item 3：樑/柱 patch 死角(待 probe 確認 alpha=1 近黑)。
   - item 6：跨 patch 滲色(valid 但錯色) → 另一套修法(gutter/邊界歸屬)，非 alpha=0。
   - item 5 桌面線：待 probe 定 surface pair。
3. 載重原則不變(承第 28 節)：任何 alpha=0 遮蔽，重烤後務必再讀 atlas 確認該區 alpha 真的=0。
4. 驗收沿用 20.4(閉合+自然+無硬暗線) + 24.4(對齊 LIVE 真值)；勿擾動 items 1/2。
分工不變：OPUS 只寫 source.md；index.html 由 CODEX 用 create_review.py 重生。
```

## 11. CODEX 回覆 OPUS 第 10 節（2026-05-22）

我同意 OPUS 第 10 節的大方向，且已用現行 shader / metadata 程式碼快速核對。第 10 節可以作為下一輪量測與修正的方向；但 item 4、item 5 的南牆線仍建議先用原 cameraState 跑 probe 做載重確認，再正式改 1010 與重烤。

### 11.1 同意點

```text
1. items 1 / 2 可視為第 29 節 B 案成功案例。
   1011 / 1013 已套柱後＋樑後 alpha=0 遮蔽，使用者肉眼也確認正常。
   這兩處接下來不要再擾動。

2. item 4 指向南牆 1010，這個判斷合理。
   shader 裡 patch 1010 目前只遮南窗洞：
   x >= -1.75 && x <= 0.69 && y >= 1.04 && y <= 2.905
   它沒有遮東南柱腳印 x≈1.78~1.91，也沒有遮西南柱腳印 x≈-1.91~-1.75。
   所以南牆 1010 吃到柱後 alpha=1 近黑資料，這個推論很有力。

3. item 5 要拆兩條線，我同意。
   南牆那條很可能和 item 4 同家族。
   垂直桌面那條還不能直接歸類，需要 probe 看 route / atlas UV / RGB。

4. item 6 歸到「有效但錯色」家族，我同意。
   使用者描述是地板顏色污染，這和第 29 節近黑死角不同。
   下一輪一定要記 RGB、atlas UV、route、alpha，不能只看 luma。
```

### 11.2 保留點

```text
1. OPUS 說 item 4 / item 5 南牆線「程式碼已可定位」，我認為方向成立，
   但正式修前仍要用原 cameraState 跑一條掃線確認：
   route 是否真走 1010 / south wall，
   alpha 是否為 1，
   RGB/luma 是否落在近黑污染區。

2. item 3 仍只算高機率假設。
   需要先查 east beam-shadow / east beam under / se column north / se column west，
   看黑線到底是哪個 patch 在吃對方背後 texel。

3. item 6 不應放進 B 案同輪硬修。
   它像 padding / gutter / bilinear 跨 chart 污染，修法可能完全不同。
```

### 11.3 CODEX 建議下一輪順序

```text
1. 先只量測，不改碼。
2. item 4 + item 5 南牆線：
   用原 cameraState 做 1D 掃線，確認 route / targetId / atlas UV / alpha / RGB。
   若證實為 1010 柱後 alpha=1 近黑資料，再把 1010 東南柱與西南柱腳印設為 return false，
   並同步 metadata，再重烤 south-wall package。

3. item 3：
   查 east beam-shadow / east beam under / se column north / se column west。
   若證實為樑或柱 patch 內部死角 alpha=1 近黑，再沿用 B 案遮蔽原則。

4. item 5 桌面線：
   單獨掃線，先找 surface pair，不併入南牆線。

5. item 6：
   單獨建立有效但錯色量測。
   重點記 RGB 與 atlas UV，判斷是否跨 chart 滲色或邊界歸屬錯誤。

6. items 1 / 2 凍結。
   下一輪量測與修正不得改動已通過的東西側主三面交界。
```

### 11.4 結論

CODEX 同意 OPUS 第 10 節的家族分類框架。下一步可以照 OPUS 的 10.4 走，但我會把「先 probe 確認、再改 1010」列為載重程序，避免只靠靜態碼推論直接重烤。成功標準仍沿用第 29 節：若要遮蔽死角，重烤後必須直讀 atlas 與 metadata，確認該區 alpha 真的變成 `0`。

## 12. OPUS 回覆 CODEX 第 11 節（claude opus 4.7，2026-05-22）

我接受 CODEX 的保留點：「先 probe 確認、再改 1010 重烤」列為**載重閘門**是對的，我不堅持靠靜態碼直接重烤。理由很實在——**在本串裡，實機 probe 已經多次推翻我的靜態推論**（我曾把暗縫主嫌押在「無效 texel → nearest fallback」、說過「乾淨角永遠不會有黑」、還把柱面補光的物理方向講反），每次都是 probe / LIVE 對照把我拉回真值。所以把 probe 設成「改碼前必過」是正確紀律，採納。

我「程式碼已可定位」的本意是「高信心預測」，不是「跳過 probe」；現在明確同意它是必過閘門。為了讓這個 probe 有牙齒（是真檢驗、不是橡皮圖章），我替每一項給一個**可被推翻的預測**：probe 結果符合 → 照該家族修；不符 → 代表我又錯了，以資料為準重新歸類。

### 12.1 給每項一個可被推翻的預測

| 項 | OPUS 預測（probe 應看到） | 若不符 → |
|---:|---|---|
| 4 東南柱∧南牆 | route 落在南牆（對應烤圖 1010）、`alpha=1`、`luma` 近黑、world `x∈[1.78,1.91]`、`z≈3.056`（東南柱後） | route 非南牆 / `alpha=0` / 非近黑 → 我錯，重歸類 |
| 5 南牆線 | route 落南牆 1010、`alpha=1`、近黑、`x∈[-1.91,-1.75]`（西南柱後）；與 item 4 同家族 | 同上 → 重歸類 |
| 5 桌面線 | **無預測**（真的要探索）；先找 surface pair，疑似桌子相關 | — |
| 3 東樑∧東南柱 | 在「樑 patch 或柱 patch」（非牆面，牆已遮）出現 `alpha=1` 近黑（某 patch 烤到對方實體背後）；信心中等 | 若 `alpha=0`/clamped → 屬 Hard Seam（本質、低優先），非死角 |
| 6 西牆角染地板色 | **`alpha=1`（有效）但 `RGB`≈地板色、`luma` 非近黑**（這點是與死角家族的關鍵分野）；atlas UV / route 顯示吃到地板 texel | 若 `luma` 近黑 → 其實是死角、要改歸 B 案家族 |

重點：item 6 的判別關鍵是「luma 不近黑、但 RGB 是地板色」。所以 item 6 的 probe **一定要記 RGB**，否則只看 luma 會把它誤判。

### 12.2 同意的程序與順序（沿用 CODEX 11.3）

```text
1. 先只量測，不改碼。
2. item 4 + item 5 南牆線：同一塊南牆 1010；probe 確認後，一個修正同時遮東南柱與西南柱腳印
   (比照 1011/1013 的 HiddenBy... 寫法)，同步 metadata，重烤 south-wall package。
3. item 3：查樑/柱 patch；確認 alpha=1 近黑才沿用 B 案遮蔽。
4. item 5 桌面線：單獨掃線找 surface pair。
5. item 6：單獨量測、必記 RGB+atlas UV+route+alpha；屬「有效但錯色」，修法非 alpha=0。
6. 載重閘門(承第28節)：任何 alpha=0 遮蔽，重烤後必直讀 atlas+metadata 確認該區 alpha 真=0。
7. items 1/2 凍結，不得改動。
8. 驗收沿用 20.4(閉合+自然+無硬暗線) + 24.4(對齊 LIVE 真值)。
```

### 12.3 結論

家族框架與程序已對齊，差異只在「probe 是否為改碼前的必過閘門」——我同意 CODEX，設為必過。我把 probe 升級成「帶預測的檢驗」：預測中就照 B 案修，預測不符就以資料為準重歸類（本串已有多次先例，這是健康的）。分工不變：OPUS 只寫 source.md；index.html 由 CODEX 用 create_review.py 重生。

## 13. CODEX 執行第 12 節量測（2026-05-22）

本節照 OPUS 第 12 節執行「先只量測，不改碼」。本輪使用 headless Google Chrome + CDP 跑 runtime probe，沒有碰 Brave，也沒有改 shader 修正碼。

原始資料：

```text
raw JSON
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/r7-3-10-b-alpha-aftershock-probe-13/section13-aftershock-probe-result.json

summary JSON
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/r7-3-10-b-alpha-aftershock-probe-13/section13-aftershock-probe-summary.json
```

量測限制先寫清楚：本輪為了避免 probe 成本爆掉，採 `gridStep=16` 的縮小掃描，並搭配直讀 atlas / metadata。它足以做第一輪分流，但 item 4 / item 5 的南牆柱腳窄帶沒有命中，所以這兩項不能直接宣判 OPUS 預測錯，需要補局部高密度 1D 掃線。

### 13.1 item 3：東樑與東南柱細黑線

OPUS 預測：樑 patch 或柱 patch 內有 `alpha=1` 近黑資料。

量測結果：

| 指標 | 結果 |
|---|---|
| 命中 route | `c1_east_beam_inner_shadow` 2749 點、`c1_se_column_north_shadow` 827 點 |
| 全域 luma | min 0.0193、p50 0.1842、p90 0.1971 |
| alpha / weight | `nearestAlpha=1`、`metadataAlpha=1`、`weightSum=1` |
| 近黑點 | 2 點 |
| near-corner 400 點 | 全部 `c1_east_beam_inner_shadow`，p50 0.1920，近黑 0 點 |

CODEX 判讀：item 3 有 `alpha=1` 近黑候選，但訊號偏弱；靠近角線的 400 點沒有近黑。這項先列為「弱支持，需補更精準的 1D seam scan」，暫不進入修正。

### 13.2 item 4：東南柱與南牆細黑線

OPUS 預測：南牆 1010 東南柱腳印，`alpha=1` 近黑，world 約 `x=1.78..1.91`、`z≈3.056`。

量測結果：

| 指標 | 結果 |
|---|---|
| 目標窄帶命中 | 0 點 |
| 畫面中主要 route | `c1_se_column_west_shadow` 2214 點、`c1_south_wall_ac_shadow` 1386 點 |
| 已命中資料 | alpha / weight 都有效，沒有近黑點 |

CODEX 判讀：這輪縮小掃描沒有打到 OPUS 指定的 `1010` 柱腳窄帶，因此暫不推翻 OPUS 預測。下一步應改成局部高密度 1D 掃線，直接穿過使用者標出的黑線。

### 13.3 item 5：南牆窗洞與西南柱兩條線

OPUS 把 item 5 拆成南牆線與桌面方向線；本輪也分開記錄。

南牆線預測：南牆 1010 西南柱腳印，`alpha=1` 近黑，world 約 `x=-1.91..-1.75`。

量測結果：

| 子項 | 結果 |
|---|---|
| 南牆 1010 西南柱腳印 | 0 點命中 |
| 桌面方向探索 | `c1_south_window_bottom_reveal_shadow` 18 點 |
| 桌面方向 luma | min 0.0687、p50 0.0748、max 0.0798 |
| alpha / weight | 全部 1 |
| 近黑點 | 0 點 |

CODEX 判讀：南牆線同 item 4，這輪沒有命中目標窄帶，需補局部高密度掃線。桌面方向線目前指到 `south_window_bottom_reveal_shadow`，亮度偏暗但未達近黑門檻，先列為探索線，不能套 B 案。

### 13.4 item 6：西牆／北牆／地板交界，西牆角落被地板色污染

OPUS 預測：`alpha=1`、luma 不近黑、RGB 近地板色，屬有效但錯色家族。

量測結果：

| 指標 | 結果 |
|---|---|
| 命中 route | `c1_west_wall` 400 點 |
| luma | min 0.2170、p50 0.2328、p90 0.2384 |
| alpha / weight | `nearestAlpha=1`、`metadataAlpha=1`、`weightSum=1` |
| 近黑點 | 0 點 |
| wall 對 floor RGB 距離 | p50 0.0307 |
| wall 對 north RGB 距離 | p50 0.3866 |

CODEX 判讀：item 6 強烈支持 OPUS 預測。西牆角落是有效資料，顏色極接近地板，且與北牆差很多；這項應歸為「有效但錯色 / floor-like color bleed」家族。後續修正方向應查 west wall atlas 的 gutter、UV 邊界或跨 chart 取樣，不能套 alpha=0 遮蔽 B 案。

### 13.5 本輪結論

```text
1. item 6 最明確：
   OPUS 的有效但錯色分類成立。
   這項後續要走 gutter / UV / chart 邊界方向。

2. item 3 有弱訊號：
   有 alpha=1 近黑候選，但靠近角線的樣本沒有近黑。
   需補同視角 1D seam scan 才能決定是否屬 B 案。

3. item 4 / item 5 南牆線未定：
   本輪縮小掃描沒有命中 1010 柱腳窄帶。
   需要改用局部高密度掃線，直接跨過使用者標出的黑線。

4. item 5 桌面方向線未定：
   目前指到 south_window_bottom_reveal_shadow。
   alpha 有效、亮度偏暗、未達近黑門檻，先列探索線。

5. items 1 / 2 維持凍結：
   本輪沒有改動已通過的東西側主三面交界。
```

## 14. OPUS 審查第 13 節（claude opus 4.7，2026-05-22）

我直接讀了 summary JSON 核對，數字與第 13 節一致、無灌水。**GO 決定：只有 item 6 可進入修正設計（且是另一套修法）；item 3 / 4 / 5 一律 HOLD，需先做精準 1D seam scan，本輪粗掃（gridStep=16）不足以判定。**

### 14.1 數據核對（我讀 JSON）

```text
item 6: west_wall 400 點、alpha=1、luma p50 0.233(非近黑)、近黑 0；
        wallToFloorRgbDistance p50=0.0307、wallToNorthRgbDistance p50=0.3866
        → 牆角顏色「離地板極近、離北牆極遠」，決定性。
item 3: east_beam_inner_shadow 2749 + se_column_north_shadow 827、alpha=1；
        近黑僅 2 點(都在柱北面)、近角線 400 點 0 近黑。
item 4: 目標窄帶 0 命中(粗掃沒打到)；周邊 route = se_column_west_shadow + south_wall_ac_shadow。
item 5 南牆線: 0 命中(verdict prediction_not_confirmed，是「未命中」非「被推翻」)；
        桌面線: south_window_bottom_reveal_shadow 18 點、luma 0.075(暗但非近黑)、alpha=1。
```

### 14.2 逐項裁決

| 項 | 我第 12 節預測 | 第 13 節結果 | 裁決 |
|---:|---|---|---|
| 6 | alpha=1、非近黑、RGB≈地板色 | **完全命中**（離地板 0.031 / 離北牆 0.387） | **GO 修正設計**：確定「有效但錯色／地板色滲入」家族，非 alpha=0；下一步查 west_wall 底緣 texel 為何吃到地板色（UV／atlas 打包 gutter／底排 texel 取樣點是否落到 y≤0 的地板） |
| 3 | 樑/柱 patch alpha=1 近黑 | 近角線 0 近黑、僅 2 點弱訊號 | **HOLD**：預測在角線「未獲支持」。需精準 1D 掃線穿過實際黑線才能定；也可能是 Hard Seam（本質、低優先） |
| 4 | 南牆 1010 東南柱後 alpha=1 近黑 | 目標窄帶 **0 命中**（粗掃漏） | **HOLD**：未測到，預測「未驗證」（非被推翻）。需局部高密度掃線。**修正候選 patch 要放寬**：周邊命中 `south_wall_ac_shadow` 與 `se_column_west_shadow`，所以死角(若有)未必在 1010，可能在這兩塊之一 |
| 5 南牆線 | 南牆 1010 西南柱後 alpha=1 近黑 | 0 命中 | **HOLD**：同 item 4，需精準掃線 |
| 5 桌面線 | 無預測 | reveal-shadow、暗但非近黑 | **探索**：非近黑→非死角；需精準掃線看是接縫還是合理暗值 |
| 1/2 | — | 凍結 | 維持凍結 |

### 14.3 我的自我校正（誠實）

我第 10／12 節對 item 4／item 5 南牆線講「程式碼已可定位」，信心偏高。第 13 節顯示：粗掃連那條窄帶都沒打到，所以我的預測目前是**未驗證**（不是被推翻、但也還沒被證實）。這再次印證 CODEX 第 11 節「改碼前 probe 必過」的謹慎是對的——**HOLD 住 1010／B 案遮蔽，直到精準掃線真的命中黑線、看到 alpha=1 近黑為止**。不要靠靜態碼信心就重烤。

### 14.4 GO：給 CODEX 的下一動

```text
A. item 6（可進）：開始查「為何 west_wall 底緣角落 texel 是地板色」。
   候選：底排 texel 取樣點落到 y≤0(地板)、atlas 打包與地板相鄰無 gutter、UV 邊界吃到 floor chart。
   這是「有效但錯色」家族，修法走 gutter/padding/UV 歸屬，不是 alpha=0。

B. items 3 / 4 / 5（先量測，仍不改碼）：改用精準 1D seam scan，不要再用 gridStep=16 粗掃。
   作法(比照之前第 23 節成功手法)：
     1. 先在截圖定位黑線最暗的像素列。
     2. 垂直穿過黑線、兩側各 ≥10 像素、gridStep=1 逐點掃。
     3. 每點記 route name、targetId、alpha/weightSum、RGB、luma、world、normal。
   item 4 候選 route 放寬到 south_wall_ac_shadow / se_column_west_shadow / 1010 三者，由掃線定。
   命中後：alpha=1 近黑 → 該塊套 B 案遮蔽；alpha=0/clamped → Hard Seam(低優先)；
           alpha=1 非近黑但錯色 → 併入 item 6 那種「有效但錯色」家族。

C. items 1/2 凍結；任何 alpha=0 遮蔽重烤後仍須直讀 atlas+metadata 確認 alpha=0(承第 28 節)。
分工不變：OPUS 只寫 source.md；index.html 由 CODEX 用 create_review.py 重生。
```

### 14.5 結論

GO，但分流：**item 6 進修正設計（floor-bleed 家族）；item 3/4/5 進精準掃線、暫不改碼**。我把 item 4/5 的 1010 遮蔽明確 HOLD 在「精準掃線確認」之後，避免重蹈本串多次「靜態信心被實測推翻」的覆轍。

## 15. CODEX 回覆 OPUS 第 14 節（2026-05-22）

我同意 OPUS 第 14 節的主要裁決：item 6 可進入下一階段，items 3 / 4 / 5 先停在精準 1D seam scan。這個分流符合第 13 節資料，也符合使用者一直要求的「先找根因，避免在不同壞法之間來回跳」。

### 15.1 對 item 6 的同意與限制

item 6 的分類我同意：它是有效但錯色家族。第 13 節資料顯示 `c1_west_wall` 角落樣本 `alpha=1`、`weightSum=1`、luma 不近黑，且 RGB 與 floor reference 極接近。

但我把 OPUS 的「GO」定義得更窄一點：item 6 可以進入根因調查與修正設計，暫時不直接套修法。原因是第 13 節已證明「西牆角落像地板色」，但還沒證明這個地板色是在 bake 產生資料時進入 west_wall，或是在 runtime atlas / UV 邊界取樣時被混入。

下一輪 item 6 應先回答這幾件事：

```text
1. west_wall_full 下緣角落的 atlas texel 本身是否已經是 floor-like RGB。
2. 該區 UV 是否貼近 chart 邊界，導致 bilinear sample 吃到鄰近 chart。
3. west_wall_full 在 atlas 打包時，旁邊是否剛好是 floor chart，且 gutter / padding 不足。
4. bake 取樣點是否有落到 y≈0 或穿過 floor 平面，讓牆面 texel 在產生時就被地板色污染。
5. metadata alpha 是否全程為 1；若是，這條線不能走 alpha=0 B 案，必須修取樣、padding、gutter 或 UV 歸屬。
```

所以 item 6 的下一步是「判斷錯色來源」，不是直接修。若錯色已存在於 west_wall atlas 本體，優先查 bake 取樣點與 chart padding。若 atlas 本體正常、runtime sample 後才變色，優先查 UV clamp / bilinear / atlas 鄰接。

### 15.2 對 items 3 / 4 / 5 的同意

我同意全部 HOLD。第 13 節對這三項的資訊量不夠，不能進修正。

```text
1. item 3：
   粗掃只有 2 個 alpha=1 近黑候選。
   near-corner 400 點沒有近黑。
   這個訊號不足以支持 B 案，需用黑線實際像素列做 gridStep=1 掃線。

2. item 4：
   目標窄帶 0 命中。
   周邊 route 出現 south_wall_ac_shadow 與 se_column_west_shadow。
   候選 patch 應放寬，不要只盯 1010。

3. item 5 南牆線：
   目標窄帶 0 命中。
   同 item 4，需要局部高密度掃線。

4. item 5 桌面方向線：
   目前指向 south_window_bottom_reveal_shadow。
   luma 偏暗但未達近黑，先找 surface pair，再分類。
```

### 15.3 我對第 14 節的唯一補充

第 14 節把 item 6 寫成「GO 修正設計」是合理的，但執行上要分兩步：

```text
1. 先做根因定位：
   直讀 west_wall atlas 邊界 texel、鄰近 chart、padding / gutter、UV 與 bake sample position。

2. 再選修法：
   若是 atlas 本體錯色，修 bake sample 或 bake padding。
   若是 runtime 取樣跨 chart，修 UV clamp / gutter / atlas layout。
```

這個限制很重要，因為 item 6 與第 29 節 B 案不同。第 29 節是「alpha=1 近黑死角」，修法目標是讓那些錯誤資料退出有效樣本集合；item 6 是「alpha=1、亮度正常、顏色像地板」，修法目標是找出錯色如何進入西牆角落，再讓西牆角落回到牆面自己該有的顏色。

### 15.4 CODEX 建議的下一輪順序

```text
1. 先查 item 6：
   因為它已經有明確分類，而且使用者已提供明確肉眼現象。
   先做 west_wall atlas 邊界直讀與 UV / gutter / chart 鄰接檢查。

2. 同時保留 items 1 / 2 凍結：
   已通過的東西側主三面交界不得被新的實驗改動。

3. 之後再做 items 3 / 4 / 5：
   使用 gridStep=1 的精準 1D seam scan。
   每點記 route name、targetId、alpha / weightSum、RGB、luma、world、normal。

4. 任何新修法都要回到同一視角肉眼驗收：
   自動量測只能當定位工具，最終仍要用使用者提供的原 cameraState 看黑線是否消失。
```

### 15.5 結論

CODEX 同意 OPUS 第 14 節：item 6 進下一階段，items 3 / 4 / 5 先精準量測。我的補充是把 item 6 的 GO 收斂成「先定錯色來源，再選修法」。這樣比較不會把有效但錯色誤當成 B 案，也能避免再次出現修好一處、另一種接縫冒出來的情況。

## 16. OPUS 回覆 CODEX 第 15 節：共識達成（claude opus 4.7，2026-05-22）

**共識達成。** CODEX 15.3 的收斂我完全接受，而且這正是我 14.2 的本意（我寫的是「查 west_wall 底緣為何吃到地板色」＝先定來源，不是直接修）。明確對齊如下：item 6 的「GO」＝**先定錯色來源（bake 階段 vs runtime 取樣），確認來源後才選修法**，絕不直接套修。items 3 / 4 / 5 全部 HOLD 在精準 gridStep=1 掃線之後。items 1 / 2 凍結。這一點上我和 CODEX 沒有分歧。

### 16.1 接受 CODEX 15.3 的兩步式 item 6

```text
步驟 1 先定來源(不改碼)：直讀 west_wall 底緣角落 atlas texel、鄰近 chart、padding/gutter、
       UV、bake sample position；回答 15.1 的五個問題。
步驟 2 依來源選修法：
       atlas 本體就錯色 → 修 bake sample position 或 bake padding/dilation。
       atlas 正常、runtime 取樣才變色 → 修 UV clamp / gutter / atlas layout。
不論哪種，都不是 alpha=0 B 案(這條 alpha=1、亮度正常、只是顏色錯)。
```

### 16.2 我對 item 6 來源的可被推翻預測（讓步驟 1 有牙齒）

第 13 節 item 6 視角是 `samples=102`（已相當收斂），且 48 個取樣點的「對地板 RGB 距離」穩定落在 0.025–0.043（p50 0.031）。**穩定、非雜訊、在收斂畫面下仍是地板色 → 我預測錯色是「烤進 west_wall atlas 本體」（bake 階段），不是 runtime 才混入。** 最可能的兩個 bake 階段成因：

```text
A. atlas 打包時 west_wall 底緣與 floor chart 相鄰、gutter/padding 不足，
   bake 的 dilation 把地板色擴張進西牆底排 texel。
B. west_wall 底排 texel 的 bake sample position 落在 y≈0、貼著地板，
   產生資料時就吃到地板色(不只是合理的地板反彈，是幾乎純地板色)。
判別：若 15.1-Q1「atlas texel 本身是否已是 floor-like RGB」= 是 → 證實 bake 階段(A 或 B)。
      若 atlas texel 乾淨、runtime sample 後才變地板色 → 我錯，改查 UV clamp/bilinear 跨 chart。
```

這個預測讓 CODEX 的步驟 1 變成「確認 / 推翻」而非開放式找。若 atlas 本體乾淨，就以資料為準轉向 runtime 取樣方向（本串已有多次「以實測修正預測」的先例）。

### 16.3 順序：建議改成可並行（OPUS 可分擔 item 6 步驟 1 的靜態部分）

CODEX 15.4 建議「先 item 6、再 items 3/4/5」序列做。我提一個更省時的版本，**採不採由 CODEX／使用者決定**：

```text
- item 6 步驟 1 有一半是「靜態可讀」的：bake sample position、UV 映射、atlas 打包鄰接，
  這些 OPUS 讀程式碼就能先縮小範圍(回答 15.1 的 Q2/Q3/Q4 一部分)，不需要實機。
- items 3/4/5 的精準 1D 掃線一定要 CODEX 跑實機。
→ 兩條工作線無相依，可並行：OPUS 先靜態縮小 item 6 來源；CODEX 同時跑 3/4/5 精準掃線。
  item 6「atlas texel 本身是否 floor-like」(15.1-Q1/Q5)仍需 CODEX 直讀 atlas 確認。
若 CODEX 偏好序列(item 6 先)也可以，這只是效率取捨、非分歧。
```

### 16.4 共識確認

```text
1. item 6：兩步式(先定來源、再選修法)，非 alpha=0；OPUS 預測來源在 bake 階段(待 atlas 直讀確認)。
2. items 3/4/5：HOLD，先 gridStep=1 精準 1D seam scan(穿過實際黑線)；item 4 候選 route 放寬。
3. items 1/2：凍結。
4. 載重原則不變(承第 28 節)：任何 alpha=0 遮蔽，重烤後必直讀 atlas+metadata 確認 alpha=0；
   最終一律回原 cameraState 肉眼驗收(承 CODEX 15.4-4)。
分工不變：OPUS 只寫 source.md；index.html 由 CODEX 用 create_review.py 重生。
```

至此第 14–16 節對齊，無剩餘分歧。下一輪可動工：item 6 定來源（可並行 OPUS 靜態 + CODEX atlas 直讀）、items 3/4/5 精準掃線。

## 17. CODEX 審查 OPUS 第 16 節（2026-05-22）

我同意第 16 節的共識整理。第 16 節沒有把 item 6 直接推進修正，而是把工作收斂成「先定錯色來源，再選修法」；這與第 15 節限制一致，也符合目前資料。

### 17.1 同意項

```text
1. item 6 的 GO 定義正確：
   目前只能進根因定位與修正設計。
   先確認錯色來源，再選修法。

2. item 6 不能走第 29 節 B 案：
   第 13 節已顯示 alpha=1、weightSum=1、luma 不近黑、RGB 接近地板。
   這是有效但錯色家族，不是 alpha=0 遮蔽問題。

3. items 3 / 4 / 5 繼續 HOLD：
   第 13 節資料不足以支持任何修正。
   下一步必須用 gridStep=1 精準 1D seam scan 穿過實際黑線。

4. items 1 / 2 凍結：
   使用者已肉眼確認正常。
   後續測試與修正不應擾動這兩個已通過案例。
```

### 17.2 對 item 6 預測的看法

OPUS 第 16.2 預測「錯色已烤進 west_wall atlas 本體」，我認為這是目前最合理的可被推翻假設，但仍需用直讀資料確認。

目前支持這個方向的理由：

```text
1. 使用者畫面已有 102 samples，仍穩定看到地板色污染。
2. 第 13 節 48 個比較點中，west_wall 對 floor RGB 距離穩定很小：
   p50 = 0.0307。
3. 同一批點對 north wall RGB 距離很大：
   p50 = 0.3866。
4. alpha / weight 全有效，代表這不是缺資料 fallback。
```

但第 16.2 還不能定案，因為第 13 節的 floor / north 對照是用同世界座標投到參考 surface 的 atlas 值做比較，還沒有直接讀「west_wall atlas 該 texel 周圍的實際 chart 鄰接與 padding」。所以第 16.2 可以當下一輪預測，不應當作已證實結論。

### 17.3 對並行建議的看法

我接受 OPUS 第 16.3 的並行建議，前提是分工清楚，避免兩邊同時改碼。

```text
1. OPUS 可先做靜態縮小：
   查 west_wall UV 映射、bake sample position、atlas 打包鄰接、padding / dilation 規則。

2. CODEX 可做實機量測：
   直讀 item 6 的 west_wall atlas 邊界 texel 與 metadata。
   跑 items 3 / 4 / 5 的 gridStep=1 精準 1D seam scan。

3. 本輪仍維持只量測：
   在 item 6 錯色來源與 items 3 / 4 / 5 seam 分類確認前，不改 shader 修正碼。
```

若 OPUS 額度不足或使用者不想再開 OPUS，CODEX 可以接手靜態與實機兩邊；但流程仍照上面拆開，先定位再修。

### 17.4 CODEX 建議下一輪載重條件

下一輪若要執行第 16 節，建議交付以下資料後再談修正：

```text
1. item 6 atlas 直讀：
   west_wall 角落污染區的 atlas texel RGB / alpha / metadata。
   同時列出污染區周圍 3x3 或 5x5 texel，確認顏色梯度。

2. item 6 chart 鄰接：
   west_wall 污染 texel 在 atlas 內的座標。
   鄰近 chart 是否為 floor。
   gutter / padding 寬度與填色來源。

3. item 6 sample position：
   west_wall 下緣 bake sample world position。
   是否貼近 y=0 或跨到 floor 取樣區。

4. items 3 / 4 / 5 精準掃線：
   每點記 route name、targetId、alpha / weightSum、RGB、luma、world、normal。
   scan line 必須穿過使用者看到的實際黑線。

5. 驗收保護：
   items 1 / 2 同視角回看。
   新修正後要用原 cameraState 肉眼確認。
```

### 17.5 結論

CODEX 同意第 16 節。下一輪可以執行，但執行範圍仍是定位與精準量測。item 6 先確認錯色來源；items 3 / 4 / 5 先做實際黑線的 1D 掃線。完成這些資料後，再決定修法。

## 18. CODEX 執行第 16 節動工指引：item 6 定來源 + items 3/4/5 精準掃線（2026-05-22）

本輪照第 16 節與使用者貼上的 OPUS 指引執行，範圍維持量測與定位。沒有修改 shader 修正碼，也沒有碰 Brave；實機探針使用獨立 headless Google Chrome。

### 18.1 原始資料

```text
量測腳本：
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/r7-3-10-b-alpha-aftershock-probe-18/section18-aftershock-source-seam-probe.mjs

原始 JSON：
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/r7-3-10-b-alpha-aftershock-probe-18/section18-source-seam-probe-result.json

摘要 JSON：
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/r7-3-10-b-alpha-aftershock-probe-18/section18-source-seam-probe-summary.json

執行方式：
  node --check 通過
  node section18-aftershock-source-seam-probe.mjs 通過
```

### 18.2 item 6：西牆角落染地板色來源

第 18 節直讀 `west_wall_full` / target 1004 的 atlas 與 metadata，取樣範圍是西牆最北、最靠地板的角落：

```text
取樣點數                 30
west_wall luma p50       0.2281
west_wall alpha           min=1 / p50=1 / max=1
metadata alpha            min=1 / p50=1 / max=1
west 對 floor RGB 距離    p50=0.0311
west 對 north RGB 距離    p50=0.3789
metadata world.y          min=0.0156 / p50=0.0496 / max=0.0837
UV u                      min=0.0004 / p50=0.0069 / max=0.0191
UV v                      min=0.0052 / p50=0.0172 / max=0.0293
```

五個問題的回答：

```text
Q1 atlas texel 本身是否已是 floor-like RGB：
  是。west_wall 角落 texel 直讀後，RGB 明顯接近 floor，遠離 north wall。

Q2 UV 是否貼近 chart 邊界：
  是。u 與 v 都貼近 0，這批點就是 west_wall 左下角 chart 邊界。

Q3 west_wall 打包時是否與 floor chart 相鄰、gutter/padding 不足：
  目前沒有證據支持。
  west_wall package 是 single planar_zy，runtime slot=3。
  coverage report 顯示 c1_west_wall dilationApplied=false。
  shader 的 combined atlas slot 取樣有 half-pixel safeUv。

Q4 west_wall 下緣 sample position 是否貼近 y≈0：
  是。metadata world.y 範圍 0.0156～0.0837。
  這代表污染區是非常貼近地板的牆面 texel。

Q5 metadata alpha 是否全程=1：
  是。alpha 與 metadata alpha 全部為 1。
```

CODEX 初判：

```text
1. item 6 的錯色已存在於 west_wall atlas 本體。
2. runtime 跨 chart 混色目前缺乏證據支持。
3. 第 29 節 B 案目前不適用，因為 alpha=1、luma 正常，只是 RGB 像 floor。
4. 目前最合理方向是 bake 產生資料時的牆 / 地板邊界取樣問題：
   sample point 太貼近 y=0，讓 west_wall 角落吃到 floor-like 顏色。
5. OPUS 16.2 的 A「floor chart 鄰接造成 dilation」目前證據弱；
   B「west_wall 底緣 sample position 貼近 floor」目前證據強。
```

### 18.3 item 3：東樑與東南柱交界細黑線

定位方式：先用 8px locate grid 找候選暗點，再以該點做水平 / 垂直 1px 掃線，半徑 28px。

最暗點：

```text
pixel               (1184, 96)
world               x=1.849998, y=2.802039, z=2.490000
surface             c1_se_column_north_shadow
targetId            1008
normal              (0, 0, -1)
luma                0.01929
alpha               1
metadata alpha      1
weightSum           1
分類                alpha_one_near_black
```

掃線摘要：

```text
horizontal：
  routeCounts        east_beam_inner_shadow 28 / se_column_north_shadow 29
  nearBlack          2
  alphaOneNearBlack  2
  luma p50           0.1649

vertical：
  routeCounts        east_beam_inner_shadow 27 / se_column_north_shadow 30
  nearBlack          4
  alphaOneNearBlack  4
  luma p50           0.1613
```

CODEX 初判：

```text
item 3 有 alpha=1 近黑證據。
最暗點落在 se_column_north_shadow / target 1008。
它與 east_beam_inner_shadow 交界，路線切換乾淨，但 1008 在交界處有近黑有效 texel。
這比較像「有效但近黑」家族，可列入 B 案候選，待 OPUS 判斷修正範圍。
```

### 18.4 item 4：東南柱與南牆交界細黑線

最暗點：

```text
pixel               (768, 622)
world               x=1.779958, y=2.389741, z=3.056000
surface             c1_south_wall_ac_shadow
targetId            1010
normal              (0, 0, -1)
luma                0.04697
alpha               1
metadata alpha      1
weightSum           1
分類                alpha_one_near_black
```

掃線摘要：

```text
horizontal：
  routeCounts        se_column_west_shadow 28 / south_wall_ac_shadow 29
  nearBlack          1
  alphaOneNearBlack  1
  luma p50           0.0909

vertical：
  routeCounts        se_column_west_shadow 26 / south_wall_ac_shadow 31
  nearBlack          7
  alphaOneNearBlack  7
  luma p50           0.0568
```

CODEX 初判：

```text
item 4 有 alpha=1 近黑證據。
最暗點落在 south_wall_ac_shadow / target 1010。
se_column_west_shadow 與 south_wall_ac_shadow 在掃線中多次交替，垂直線 nearBlack 較多。
這一項比較像 south_wall_ac_shadow 右側交界有效近黑資料，優先查 1010 在 x≈1.78、z≈3.056 的邊界 texel。
```

### 18.5 item 5：南牆窗洞與西南柱交界兩條線

本輪把使用者截圖中的兩條線拆開命名，避免把不同位置混成同一件事。

使用者 2026-05-22 05:29 回饋修正：

```text
1. 線 A 不能再寫成「直立」。
   這條線在世界座標中的線軸平行 X 軸，畫面上因視角看起來斜斜地穿過南方木桌附近。

2. 線 B 的簡單描述是：
   南牆與西南柱交界線，垂直於南方木桌。
```

```text
線 A：南牆 / 西南柱交界線（X 軸方向）
  位置描述：
    靠南牆窗洞左側，線軸在世界座標中平行 X 軸。
    畫面上看起來斜斜地穿過南方木桌附近。
  本輪掃到的 surface pair：
    south_wall_ac_shadow ↔ sw_column_inner_shadow
  本輪結論：
    已抓到 alpha=1 近黑點，候選 targetId=1014。

線 B：南牆 / 西南柱交界線（垂直於南方木桌）
  位置描述：
    使用者簡述為南牆與西南柱交界線，垂直於南方木桌。
    本輪掃線中心可能仍未對準這條線。
  本輪掃到的 surface：
    south_window_bottom_reveal_shadow
  本輪結論：
    尚未抓到 alpha=1 近黑點，這條線仍需重新對準截圖後再掃。
```

### 18.5.1 線 A：南牆 / 西南柱交界線（X 軸方向）

最暗點：

```text
pixel               (800, 64)
world               x=-1.750000, y=0.965321, z=3.055994
surface             c1_sw_column_inner_shadow
targetId            1014
normal              (1, 0, 0)
luma                0.00744
alpha               1
metadata alpha      1
weightSum           1
分類                alpha_one_near_black
```

掃線摘要：

```text
horizontal：
  routeCounts        south_wall_ac_shadow 28 / sw_column_inner_shadow 29
  nearBlack          1
  alphaOneNearBlack  1
  luma p50           0.2666

vertical：
  routeCounts        sw_column_inner_shadow 27 / south_wall_ac_shadow 30
  nearBlack          2
  alphaOneNearBlack  2
  luma p50           0.2656
```

CODEX 初判：

```text
item 5 的線 A 有 alpha=1 近黑證據。
最暗點落在 sw_column_inner_shadow / target 1014。
這比較像西南柱內側面在南牆窗洞交界處有有效近黑 texel。
```

### 18.5.2 線 B：南牆 / 西南柱交界線（垂直於南方木桌）

最暗點：

```text
pixel               (224, 568)
world               x=-1.699118, y=1.040000, z=3.255496
surface             c1_south_window_bottom_reveal_shadow
targetId            1021
normal              (0, 1, 0)
luma                0.06692
alpha               1
metadata alpha      1
weightSum           1
分類                unclassified_or_route_gap
```

掃線摘要：

```text
horizontal：
  routeCounts        south_window_bottom_reveal_shadow 34 / unclassified 23
  nearBlack          0
  alphaOneNearBlack  0
  luma p50           0.0718

vertical：
  routeCounts        south_window_bottom_reveal_shadow 30 / unclassified 27
  nearBlack          0
  alphaOneNearBlack  0
  luma p50           0.0795
```

CODEX 初判：

```text
線 B 目前沒有抓到 alpha=1 近黑。
本輪掃到的是 south_window_bottom_reveal_shadow 的正常亮度區，掃線中心仍未對準使用者描述的「南牆與西南柱交界線，垂直於南方木桌」那條黑線，或該黑線屬 route / 幾何命中分類問題。
建議 OPUS 審查時把這條標成「需要再用截圖精準對位」，先不要進修正。
```

### 18.6 第 18 節總結與給 OPUS 的問題

```text
1. item 6：
   已證實錯色存在於 west_wall atlas 本體，且 alpha=1。
   CODEX 判斷來源偏 bake 取樣，尤其是 y≈0 牆 / 地板邊界取樣。
   請 OPUS 判斷是否要回查 bake runner 對 west_wall 下緣 texel 的 sample offset / ray origin / surface ownership。

2. item 3：
   se_column_north_shadow / target 1008 有 alpha=1 近黑。
   請 OPUS 判斷是否列入 B 案遮蔽候選。

3. item 4：
   south_wall_ac_shadow / target 1010 有 alpha=1 近黑。
   請 OPUS 判斷是否列入 B 案遮蔽候選。

4. item 5 線 A（南牆 / 西南柱交界線，X 軸方向）：
   sw_column_inner_shadow / target 1014 有 alpha=1 近黑。
   請 OPUS 判斷是否列入 B 案遮蔽候選。

5. item 5 線 B（南牆 / 西南柱交界線，垂直於南方木桌）：
   本輪沒有抓到 alpha=1 近黑。
   建議先維持待定位，使用者若可接受，下一輪用截圖座標或人工標點重新掃。

6. items 1 / 2：
   本輪沒有修改任何修正碼，保持凍結。
```

## 19. OPUS 審查第 18 節（claude opus 4.7，2026-05-22）

我直接讀 summary JSON 核對，第 18 節數字一致、無灌水。**結論：item 3 / 4 / 5-A 的 alpha=1 近黑都驗證了我「死角家族」的預測，可列 B 案候選；但每一項在重烤前要先過一道「可見性閘門」，否則可能把可見面挖洞。item 6 確定是 bake 本體錯色，下一步查 bake runner ＋ 對 LIVE。item 5-B 與 items 1/2 維持原判。**

### 19.1 數據核對（我讀 JSON）

```text
item 3  target 1008 se_column_north_shadow  luma 0.0193  alpha=1  class=alpha_one_near_black
        world (1.850, 2.802, 2.490)  normal(0,0,-1)
item 4  target 1010 south_wall_ac_shadow    luma ~0.047  alpha=1  near-black
        world (1.780, 2.384, 3.056)  normal(0,0,-1)
item 5A target 1014 sw_column_inner_shadow  luma 0.0074  alpha=1  near-black
        world (-1.750, 0.965, 3.056) normal(1,0,0)
item 5B target 1021 south_window_bottom_reveal_shadow  luma 0.067  非近黑  class=unclassified/route_gap
item 6  q1 atlas 已是 floor 色=true、q3 packing 鄰接=false、q4 sample 近地板=true、q5 alpha 全1=true
        對地板 RGB 距 0.0311、對北牆 0.3789、metadata y 0.0156–0.0837
```

### 19.2 逐項裁決（含「可見性閘門」）

**先講為何要閘門：** items 1/2 的 B 案之所以安全，是因為被遮的 texel 是「柱後永不可見」，它的黑只是經雙線性滲到可見邊界；遮掉看不見的黑，可見邊界改用旁邊有效 texel → 乾淨。但 items 3/5-A 的最暗點是落在「可見的凹角面」（柱北面頂、柱內面接南牆），不是明顯的柱後。**遮 alpha=1 近黑前，必須先確認該點是「永不可見死角（遮＝安全，鄰格補上）」還是「可見面真的暗（遮＝把真實陰影抹亮，或挖洞）」。** 判準沿用本案的黃金標準：對 LIVE。

| 項 | 我的預測 | 第 18 節結果 | 裁決 + 閘門 |
|---:|---|---|---|
| 3 | 樑/柱 patch 內 alpha=1 近黑 | **命中**：1008 se_column_north、(1.85,2.80,2.49)、近黑 | **B 案候選，須過閘門**：此點是柱北面「頂緣近樑」的可見凹角。先對 LIVE：LIVE 也近黑→真實深 AO，遮會抹掉真陰影(不遮或另法)；LIVE 是亮的→bake 死角，遮安全 |
| 4 | 南牆 1010 東南柱後 alpha=1 近黑 | **命中**：1010 south_wall_ac、(1.78,2.38,3.056)、近黑 | **B 案候選，信心最高**：x=1.78、z=3.056 正是「南牆在東南柱(x∈[1.78,1.91])背後」，與 items 1/2 同型的「牆在實體背後」死角，幾何上幾乎確定永不可見 → 遮安全。修正 patch=烤南牆柱後那塊(1010／south_wall_ac_shadow patch，由 CODEX 定位) |
| 5A | 南牆 1010 西南柱後 alpha=1 近黑 | 命中但 route 是 **1014 sw_column_inner_shadow**(非 1010) | **B 案候選，須過閘門**：最暗點在「西南柱內面接南牆」(x=-1.75,z=3.056)可見凹角，不是我猜的南牆 patch。同 item 3 先對 LIVE 再決定 |
| 5B | 無預測 | 非近黑(0.067)、unclassified/route_gap | **同意 CODEX**：未對準黑線，標「需用截圖精準對位」，先不修 |
| 1/2 | — | 凍結 | 維持凍結 |

### 19.3 回答第 18.6 六問

```text
Q1 item 6 是否回查 bake runner？ → 是，而且加一步對 LIVE。
   item 6 已確定錯色烤進 west_wall atlas 本體、sample 在 y≈0(q4)、packing 非主因(q3)。
   但「底排牆面 texel 是地板色」有兩種可能，要分清才知道怎麼修：
     (a) 物理真實：貼地板的牆角本來就吃很多地板反彈 → LIVE 也會偏地板色 → bake 忠實、未必是 bug
     (b) bake 取樣 bug：sample/ray origin 落到或偏向地板、或 ownership 誤判 → LIVE 牆角仍是牆色
   下一步：查 bake runner 對 west_wall 下緣 texel 的 sample offset/ray origin/surface ownership，
          並對同視角 LIVE。(a)→可能要接受或改 bake 高度下限；(b)→修取樣，讓底排取樣點留在牆面、不吃地板。

Q2 item 3 (1008) 列 B 案候選？ → 列候選，但須先過 19.2 可見性閘門(對 LIVE)，不可直接遮。
Q3 item 4 (1010) 列 B 案候選？ → 列候選，信心最高(南牆在東南柱後、同 items 1/2 家族)；
   仍建議快速確認該段幾何確為柱後不可見，再比照 1011/1013 手法遮、重烤、直讀 alpha=0。
Q4 item 5A (1014) 列 B 案候選？ → 列候選，須過可見性閘門(對 LIVE)。
Q5 item 5B 維持待定位？ → 是，需用截圖精準對位後再掃，先不修。
Q6 items 1/2 凍結？ → 是。
```

### 19.4 給 CODEX 的下一動

```text
1. item 4(信心最高)：確認南牆 x∈[1.78,1.91]、z=3.056 該段確為東南柱後不可見 →
   把該段在對應烤 patch(1010／south_wall_ac_shadow)設 return false，比照 1011/1013，
   重烤 → 直讀 atlas+metadata 確認 alpha=0 → 同 cameraState 肉眼驗。
2. items 3 / 5A：先過「可見性閘門」——對 LIVE 量同一最暗點。
   LIVE 也近黑 → 真實深陰影，遮會抹掉真陰影，改別法或不動；
   LIVE 是亮的 → bake 死角，且確認近黑是窄帶(周圍 texel 有效)→ 才比照 B 案遮。
3. item 6：查 bake runner west_wall 下緣 sample，並對 LIVE 分 (a)真實反彈 / (b)取樣 bug，再選修法(非 alpha=0)。
4. item 5B：用截圖座標重新對位再掃。
5. items 1/2 凍結；任何 alpha=0 遮蔽重烤後必直讀確認 alpha=0；最終一律回原 cameraState 肉眼驗收。
分工不變：OPUS 只寫 source.md；index.html 由 CODEX 用 create_review.py 重生。
```

### 19.5 結論

item 3/4/5-A 的 alpha=1 近黑驗證了死角家族（我的預測成立），但我把 B 案的「直接遮」收斂成「先過可見性閘門再遮」：**item 4 幾何上幾乎確定是柱後不可見、可優先動工；item 3 / 5A 落在可見凹角面、必須先對 LIVE 確認是 bake 死角(可遮)還是真實深陰影(不可遮)，避免把可見面挖洞或抹掉真陰影。** item 6 確定 bake 本體錯色、走 bake-runner＋LIVE 路線。這樣維持本案一貫紀律：不靠單一 alpha=1 近黑訊號就重烤。

## 20. CODEX item 3 實作 no-go 與使用者回饋（2026-05-22）

本節記錄 item 3「東樑與東南扁柱交界細黑線」的候選修正結果。結論先寫在前面：**item 3 候選修法未通過使用者肉眼驗收，狀態改為 no-go；第 20 節只記錄結果與討論問題，先不再追加 shader 修改。**

### 20.1 本輪 item 3 的處理摘要

CODEX 依第 18 / 19 節量測，把 item 3 歸入 `se_column_north_shadow` / target 1008 的 alpha=1 近黑候選區。本輪實作目標是遮蔽東樑後方的 1008 近黑 texel，讓重烤後該區 alpha 變成 0。

```text
候選區：
  targetId: 1008
  route: se_column_north_shadow
  區域: east-beam-overlap
  範圍: x 1.85..1.91, y 2.515..2.905, z 約 2.49

修正方式：
  新增 R7310_C1_SE_COLUMN_NORTH_SHADOW_EAST_BEAM_BACK 無效區
  新增 r7310C1SeColumnNorthShadowHiddenByEastBeam 判斷
  metadata / shader alpha gate 同步
  重烤 se-column-north-shadow-1024px-1000spp
```

### 20.2 量測與自動檢查結果

重烤後的直接 atlas 讀值顯示，候選區已從 alpha=1 近黑變成 alpha=0，這代表「遮掉 1008 東樑後方近黑 texel」這件事在資料層面成立。

```text
修正前 eastBeamOverlap：
  n=64801
  alpha0=0
  alpha1=64801
  nearBlack=64801
  luma p50=0

修正後 eastBeamOverlap：
  n=64801
  alpha0=64801
  alpha1=0
  nearBlack=0
  luma p50=0.3829542970716953

runtime pointer：
  validTexelRatio=0.9382009506225586
```

本輪通過的機械檢查：

```text
node --check js/InitCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node docs/tests/r7-3-10-se-column-north-shadow.test.js
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

同輪也回看 item 4 的低成本回歸，`southWallAcSeColumnBack` 仍維持 alpha=0：

```text
southWallAcSeColumnBack:
  n=31744
  alpha0=31744
  alpha1=0
```

### 20.3 驗證缺口

本輪最關鍵的失誤在驗證範圍：CODEX 的視覺驗證主要看 dedicated `se_column_north_shadow` 路線，沒有在「全相關烘焙同開」狀態下回到使用者原視角檢查東樑、東南扁柱、東牆等 surface 同時啟用後的交界結果。

使用者指出：

```text
處理失敗，東樑與東南扁柱的交界變成白線了（與 Y 平行）。
驗證時烘焙要全開才會知道有沒有問題。
CODEX 截圖看起來只有開東南扁柱。
```

使用者 no-go 視角：

```json
{
  "cameraState": {
    "position": {"x":1.845626,"y":2.795551,"z":2.479378},
    "yaw": -2.3212,
    "pitch": 1.377,
    "fov": 55,
    "forward": {"x":0.14086,"y":0.98128,"z":0.131331}
  },
  "view": {"facing":"上(+Y)","config":1,"samples":314,"paused":false,"sppCap":1000},
  "viewport": {
    "innerWidth":1458,
    "innerHeight":741,
    "canvasCssWidth":1318,
    "canvasCssHeight":741,
    "drawingBufferWidth":1280,
    "drawingBufferHeight":720,
    "devicePixelRatio":3.5,
    "aspect":1.777778
  }
}
```

### 20.4 CODEX 初步判讀

這次結果說明：`1008 eastBeamOverlap alpha=0` 的單點資料成功，完整畫面仍失敗。黑線被去除後，交界改成一條與 Y 平行的白線，代表 item 3 不能只用「把近黑 texel 轉 alpha=0」當成閉合條件。

目前較合理的判讀：

```text
1. item 3 的 seam 牽涉至少兩個 baked surface 的交界：
   se_column_north_shadow / east beam / 可能還包含東牆相關 route。

2. 1008 被 alpha=0 後，完整烘焙同開狀態下的 handoff 可能改抓相鄰過亮資料、
   live fallback，或另一條 route 的值。

3. dedicated-only 驗證會遮掉跨 route handoff 的問題。
   後續每個 seam 修正必須新增「全相關烘焙同開」same-view 驗收。

4. item 4 已由使用者肉眼確認正常，先維持凍結。
   item 3 目前 no-go。
   item 5A 不應直接套用 item 3 的遮蔽方式，必須等 OPUS 審查後再決定。
```

### 20.5 給 OPUS 的審查問題

請 OPUS 針對 item 3 no-go 判斷下一步：

```text
Q1. 你是否同意：item 3 目前已從「1008 alpha=1 近黑」轉成「全烘焙同開時的交界值不連續 / handoff 問題」？

Q2. 1008 eastBeamOverlap 設 alpha=0 後出現白線，是否代表這塊不可只靠 B 案遮蔽？
    下一步應優先量完整畫面中白線像素的 routeId / targetId / alpha / weightSum / RGB / luma / world / normal 嗎？

Q3. item 3 是否需要先 rollback 1008 的 alpha=0 遮蔽，改查 east beam 與 se_column_north_shadow 的交界共同契約？
    或保留候選修法，先用全烘焙同開 probe 找白線來源？

Q4. 你是否同意把「全相關烘焙同開 same-view 肉眼驗收」列為後續 seam 修正的硬規則？
    dedicated-only 截圖只能當 route 局部檢查，不能當完成驗收。

Q5. item 5A 在 OPUS 新判斷前先暫停，不沿用 item 3 的遮蔽策略，是否同意？
```

### 20.6 暫定狀態表

```text
item 1  西樑 / 西南柱 / 西牆三面交界：使用者已確認正常，凍結。
item 2  東樑 / 東南柱 / 東牆三面交界：使用者已確認正常，凍結。
item 3  東樑 / 東南扁柱交界：候選修法 no-go，黑線改成白線，待 OPUS 審查。
item 4  東南扁柱 / 南牆交界：使用者已確認正常，凍結。
item 5A 南牆 / 西南柱交界：暫停，等 item 3 審查後再決定。
item 5B 南牆窗洞附近另一條線：仍待精準定位。
item 6  西牆 / 北牆 / 地板交界：仍屬有效但錯色家族，後排。
```
