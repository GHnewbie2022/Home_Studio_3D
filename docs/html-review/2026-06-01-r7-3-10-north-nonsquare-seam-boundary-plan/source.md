# R7-3.10 全域邊界防呆補強計畫

## 目標

建立一套全域邊界防呆，讓未來任何牆、樑、柱、地板、天花板、門洞、窗洞、reveal、shadow/reveal、非方格、分離烘焙、正式 package 或 throwaway package 都要通過同一套邊界驗證，才可以交給使用者肉眼驗收。

這次「北牆非方格 × 西樑北端」暗縫只是第一個失敗案例。修補方向要從這個案例往外擴成可重複的邊界系統，避免後續每換一張烤圖、每新增一條 route，就再出現新的縫隙或光影污染。

這份文件是審查計畫，給 OPUS 與使用者確認方向。確認前不進行正式修碼與重新烘焙。

## 使用者回饋

使用者指出原版計畫仍像只修眼前一條縫：

```text
你這看起來只是補那條縫隙而已。
我希望不要再打地鼠。
補救的方法不應該只是頭痛醫頭腳痛醫腳。
我強烈要求要想一套方法，讓未來任何邊界都能夠正常無縫隙、光影污染。
```

採納這個方向。新版計畫改成「全域邊界防呆」，把目前暗縫納入第一個 fixture。

## 目前失敗案例

使用者在 P5d 北牆非方格預覽中觀察到：

```text
cameraState={"position":{"x":-1.549935,"y":2.400085,"z":-1.657816},"yaw":0.8516,"pitch":0.664,"fov":55}

現象：
  北牆非方格 ON 時，西樑北端與北牆交界出現暗縫。
  關閉北牆烘焙後正常。
  關閉北東非方格後正常。

初步定位：
  問題集中在北牆非方格資料、北牆非方格取樣路徑、或北牆與西樑的 ownership handoff。
  LIVE 幾何與舊方格北牆路徑目前可視為對照正常。
```

這條 seam 會作為全域邊界防呆的第一個必測案例：

```text
fixture id:
  north_nonsquare__west_beam_north_edge

必測狀態：
  1. 北牆烘焙 ON + 北東非方格 OFF
  2. 北牆烘焙 ON + 北東非方格 ON
  3. 北牆烘焙 OFF
```

## 原本 gate 的缺口

P5 / P5d 已經驗過：

```text
1. Metal tile/fence 烘焙安全。
2. 2492×1716 北牆非方格可完整烤完。
3. runtime ready=true。
4. hybrid 讀得到 non-square atlas。
5. A/B 開關能切換方格與非方格。
```

這些 gate 已證明「資料能產出、能載入、能被讀到」。下一層缺口是「所有幾何邊界都要被掃到、被量到、被凍結成回歸」。

必須補上的安全層是：

```text
1. route ownership：
   每條可見邊界的左右兩側由誰認領。

2. atlas / metadata edge：
   取樣到的 texel 是否有效、是否取到 rect 外、是否吃到黑邊或 padding 外資料。

3. render-space seam signal：
   最終畫面上的 seam 線是否出現新增黑線、亮線、重複乘色、重複烘焙、或漏烘焙。

4. mode regression：
   方格、非方格、分離、混烤、bake ON/OFF 各狀態切換後，只要邊界新增壞像素就判紅。
```

## 全域邊界防呆架構

### Phase 0：建立 surface registry

建立一份可機器讀取的 surface registry。所有會參與烘焙與 runtime 取樣的面都要列入，包含結構面與窄面。

每個 surface 至少記錄：

```text
1. surface id / route name。
2. slot / targetId / runtimeScope。
3. 幾何 world bounds。
4. normal / 朝向。
5. ownership predicate。
6. 對應 package path。
7. atlas mode：
   square / non-square / separated / mixed。
8. atlas rect：
   uvRect / faceSizePx / atlasSize。
9. edge policy：
   edge padding / dilation / valid-border rule。
10. 相鄰 surface 清單。
```

目的：任何新 package 或新路徑接上 runtime 之前，必須先在 registry 中有完整身份。缺少身份時 Gate 直接紅，流程停在資料修正。

### Phase 1：自動產生 seam candidate

由 surface registry 自動產生 seam candidate。人工 fixture 只作為補充，registry 才是主要來源。

候選來源：

```text
1. 幾何共邊：
   兩個 surface 的 world bounds 在同一平面相接。

2. 幾何近鄰：
   兩個 surface 距離小於 epsilon，肉眼可能看到接縫。

3. route handoff：
   shader 中有互斥優先權、shadow/reveal 覆蓋、hybrid first-hit 排除條件。

4. atlas 邊界：
   surface 的 first / last texel row / column。

5. valid / invalid 交界：
   metadata 中 valid 區域與 invalid 區域相鄰。

6. atlas mode / 解析度變更：
   同一面從方格改非方格、從混烤改分離、從 1024 改高解析度，該面所有邊界都要重驗。

7. 使用者回報 fixture：
   曾經出現縫隙、黑邊、亮邊、漏烘焙、重複烘焙的位置。
```

這次的 `north_nonsquare__west_beam_north_edge` 會先手動加入，之後應由 registry 產生。

### Phase 1b：建立種子 fixture 清單

先把 Debug_Log 與 R7-3.10 期間已修過的接縫加入初始清單。這些位置是最容易在新 package、新尺寸、新 route 中回歸的地方。

初始 fixture 至少包含：

```text
1. north_nonsquare__west_beam_north_edge：
   北牆非方格 × 西樑北端。

2. west_beam_bottom__sw_column_north：
   西樑底面 × 西南柱北面。

3. west_wall__west_beam：
   西牆 × 西樑。

4. south_window_reveals：
   南窗四個 reveal / 切面。

5. east_wall_beam_shadow_guard：
   東牆東樑陰影 seam guard，z < 2.475。

6. floor_side_seams：
   地板四側與牆面 / 樑柱交界。
```

fixture 清單可以先用手動結構化資料起步。幾何全自動偵測列為後續強化，不阻擋第一條 seam 的修復。

### Phase 2：每條 seam 都跑 ownership probe

每條 seam 取多個 sample 點，覆蓋 seam 線兩側與 seam 線本身。

每個 sample 點至少記錄：

```text
1. screen pixel。
2. world position。
3. route / surface id。
4. slot / targetId。
5. 是否走 non-square path。
6. 是否走 separated path。
7. atlas UV。
8. texel coordinate。
9. valid / alpha。
10. luma / RGB。
11. package hash。
12. metadata hash。
```

同一條 seam 必須比較 seam 兩側：

```text
左側或第一面：
  route / slot / uv / texel / valid / luma

右側或第二面：
  route / slot / uv / texel / valid / luma

handoff：
  是否剛好一邊接一邊。
  是否有空白帶。
  是否有雙重認領。
```

### Phase 3：每條 seam 都跑 render-space Boundary gate

Boundary gate 的偵測權威是 render-space，也就是最後畫面。原因是這次暗縫來自 valid / invalid 邊界帶；atlas-space audit 會跳過 invalid texel，會漏掉這類問題。

每條 seam 必須用 per-seam 驗收相機，在近距離最終畫面上取樣：

```text
1. seam 線本身。
2. seam 左右兩側各一條內部對照線。
3. seam 附近多個高度或多個位置。
4. 同一相機、同一 sample 條件下的 A/B 狀態。
```

判定方式用空間相干，而非單點亮度：

```text
1. seamJump：
   沿 seam 軸向逐點取跨縫 |Δluma|，再取平均值。
   也就是沿著整條 seam 線算平均跳變，不用單一 pixel 當結論。

2. interiorJump：
   seam 左右內部對照線同樣逐點取 |Δluma|，再取平均值。
   它代表同一區域的自然髒斑與噪點基準。

3. 判紅：
   averaged seamJump 明顯高於 averaged interiorJump，且只在新模式或新 package 出現。
```

每條 seam 的 render-space probe 要記錄：

```text
1. cameraState / viewport / sample 條件。
2. seam 取樣線與內部對照線。
3. route / slot / targetId。
4. 是否走 non-square path。
5. 是否走 separated path。
6. sampler 是否落到 invalid 並 fallback / 回黑。
7. texel-per-pixel footprint。
8. averaged seamJump / averaged interiorJump / ratio。
9. package hash / metadata hash。
```

這個 gate 先用在 `north_nonsquare__west_beam_north_edge`，跑通「偵測 → 定位 → 修復 → 永久回歸」後再擴成全 registry。

### Phase 4：每條 seam 都跑 edge atlas 定位 audit

edge atlas audit 用於定位根因。它需要覆蓋舊方格正式 package、非方格 package、分離 package、throwaway package 與未來新增 package。

必要能力：

```text
1. 指定 package path。
2. 指定 package hash。
3. 指定 metadata hash。
4. 指定 surface / slot。
5. 指定 atlas mode。
6. 指定 seam candidate。
7. 掃描該 seam 對應的 texel 帶。
```

檢查項目：

```text
1. 可見 seam 的取樣維持在 valid texel 內。
2. 可見 seam 的 black texel 新增數量為零。
3. 可見 seam 的高亮污染新增數量為零。
4. bilinear 鄰格維持在該 surface 的合法 valid 區。
5. non-square rect 邊界維持在 rect 內。
6. edge padding / dilation 後的可見 seam 顏色維持在 baseline 容差內。
```

atlas-space 的結果用來回答「是哪個 texel / rect / valid mask 出錯」，render-space 的結果用來決定 gate pass 或 fail。

### Phase 5：建立 boundary baseline

baseline 凍結「肉眼已驗收狀態」，作為後續新路徑、新 package、新尺寸與新烘焙方式的比較基準。

每條 seam 的 baseline 要記：

```text
1. seam id。
2. surface pair。
3. package hash。
4. metadata hash。
5. atlas mode。
6. allowed residual pixels。
7. ownership pattern。
8. last accepted camera / probe config。
```

判紅規則：

```text
current bad pixels - baseline allowed bad pixels ≠ empty
```

黑點消失或瑕疵變少屬於改善，記錄為 pass。hash 不符時測試直接紅，等待人工 gate 重新驗收。

### Phase 6：新 package 的進場規則

任何新烘焙 package 要進肉眼驗收前，先過下列四關：

```text
1. Data gate：
   package 存在、hash 可讀、尺寸符合、byteLength 正確、metadata 可讀。

2. Runtime gate：
   loader ready=true，shader 真的走到該 package。

3. Boundary gate：
   由 registry 產生的 seam candidate 全部通過 render-space 檢查；atlas-space audit 作為定位附件。

4. Visual gate：
   使用者肉眼看 A/B，並確認新增縫隙、黑邊、亮邊、污染的數量為零。
```

Boundary gate 未 pass 時，流程停在資料修正，不進肉眼驗收。

## 目前這條暗縫的處理順序

### Step 1：把目前暗縫納入 registry fixture

新增 fixture：

```text
seam id:
  north_nonsquare__west_beam_north_edge

surface pair:
  north wall slot 1 non-square
  west beam / west structural north edge

source:
  使用者 2026-06-01 回報
```

### Step 2：用三狀態重現 render-space seam signal

同一相機下比較：

```text
1. 北牆烘焙 ON + 北東非方格 OFF
2. 北牆烘焙 ON + 北東非方格 ON
3. 北牆烘焙 OFF
```

目標是把「非方格 ON 才新增暗縫」變成可重跑資料，並產出 averaged seamJump / averaged interiorJump / ratio。截圖保留為輔助證據。

### Step 3：probe 暗縫像素與 sampler 行為

記錄 seam 線附近多個 pixel 的：

```text
route / slot / targetId / world position / uv / texel / valid / fallback / luma / package hash
```

用資料判斷屬於：

```text
1. valid 邊界錯。
2. UV rect 錯。
3. atlas padding 錯。
4. ownership handoff 錯。
5. west beam 端資料錯。
6. valid-aware sampler fallback 錯。
```

### Step 4：依證據修

不預設修法。可能路徑：

```text
1. 修 north non-square uvRect / faceSizePx。
2. 修 north non-square metadata edge。
3. 修 edge padding / dilation。
4. 修 north wall × west beam ownership。
5. 修 west beam 對北牆交界的豁免或遮蔽 footprint。
```

### Step 5：把此 seam 加入永久回歸

修完後，把這條 seam 永久加入 boundary regression。之後任何北牆重烤、非方格改尺寸、分離改路徑，都要先過這條 seam。

## 暫停事項

在全域邊界防呆與這條 seam pass 前，暫停：

```text
1. 北牆髒斑解析度討論。
2. 提高 D。
3. 提高 SPP。
4. 東牆正式非方格烘焙。
5. 全室 promotion。
```

原因：接縫錯誤會干擾所有畫質判斷。

## 給 OPUS 的審查問題

請 OPUS 審查：

```text
1. 全域 surface registry + seam candidate 自動產生，是否能取代目前靠人工列 seam 的模式？

2. seam candidate 的來源是否足夠：
   幾何共邊 / 幾何近鄰 / route handoff / atlas 邊界 / valid-invalid 交界 / atlas mode 或解析度變更 / 使用者 fixture。

3. render-space Boundary gate 的 averaged seamJump / averaged interiorJump / ratio 是否足夠作為偵測權威。

4. atlas-space audit 降為定位工具後，欄位是否足夠定位 ownership、UV、valid、fallback、luma、package drift。

5. boundary baseline 的「只判新增壞點」規則是否沿用 §15 / §22 共識。

6. 這次暗縫是否應先做成第一個 fixture，再逐步擴成全室 seam registry。

7. 初始 fixture 清單是否還要補其他曾經出事的 seam。
```

## CODEX 自我約束

```text
1. GPU safety gate 與 Boundary gate 分開回報。
2. ready=true / 可切換只代表 runtime 接線成立。
3. 所有新 package 交肉眼前，必須過 Boundary gate。
4. 所有使用者回報的 seam，都要變成永久 fixture。
5. 回報時要明講：
   已跑哪些 gate、沒跑哪些 gate、哪些只屬 throwaway 預覽。
```

## OPUS 審查裁示（2026-06-01）

**總評：方向成立。正確對準「whack-a-mole」的結構根因——從各面手工補縫，升級為 registry 驅動的 seam 偵測 + baseline 回歸 + gate 分離。方向 APPROVE，但有一個會決定成敗的重點與數項補強，落地前須納入。**

### 重點（必改）：Boundary gate 的「偵測」必須在 render-space，不可沿用現有 atlas-space audit

本次北牆暗縫根因（OPUS 已讀碼確認）：

```text
1. 方格與非方格用「同一個」metadata builder：
   buildR7310C1NorthWallTexelMetadata(size) 直接呼叫 Rect 版（InitCommon.js:5110-5113）。
   差別純粹是解析度。
2. valid 區把「被樑/側牆擋住」標 invalid（HiddenByBeamGap / HiddenBySideWall，5088-5090）。
   方格粗 → 大格子蓋過邊界那條細 invalid 帶；非方格細 → 如實畫出 → 暗縫。
3. 北牆烘焙無任何 edge guard fill（地板/天花/樑柱有 fillR7310C1...Guard，北牆沒有）。
```

關鍵：現有 fidelity-audit 的 seam 檢查會「跳過 invalid 像素（alpha≤0.5）」，且只查 atlas 內部 512px tile 邊界——它結構上看不到「valid→invalid 邊界帶」這種缺陷。Phase 3 若沿用這個 atlas-space audit 當偵測 gate，會重演同一盲點、抓不到這條縫。

→ Boundary gate 的「偵測權威」必須是 render-space：在驗收近距相機下沿 seam 線取樣「最終畫面」（含 valid-aware sampler 行為），用「seam 線亮度跳變 vs 鄰近內部跳變」的空間相干指標判定（把 candidate-only seam 邏輯搬到 render-space），對雜訊穩健。Phase 3 的 atlas-space 掃描降為「定位根因」用，不當偵測 gate。

### 補強

```text
1. 種子 fixture：把 Debug_Log 既往修過的縫一次列為初始 fixture（它們是下一個最可能 regress 的點）：
   西樑底面×西南柱北面、西牆×西樑、西南柱、南窗四切面 reveal、
   東牆東樑陰影 seam guard(z<2.475)、floor side seams。
2. seam candidate 來源加一條：「atlas mode / 解析度變更」本身要 re-trigger 該面所有邊界重驗
   —— 本次根因正是「解析度變了，把舊邊界揭出來」。
3. 垂直切片優先：先在這條 north 縫把「偵測 → 修 → 永久回歸」整條 loop 跑通、證明機制，
   再橫向擴成全 registry。不要先把整份 registry 建完才動手（避免過度工程與卡關）。
   registry 可先用「結構化手動清單」起步，幾何自動偵測列為後續強化。
4. probe/baseline 相機必須近到能解析最細的 seam（per-seam 驗收相機），並記 texel-per-pixel footprint，
   才能把「seam」與「雜訊」分開。
5. 修法層次對準 valid-aware sampler 的邊界行為（dilation / valid-border / sampler fallback / mask 幾何擇一）；
   probe 欄位加記「該點 sampler 是否落到 invalid 而 fallback/回黑」。
```

### 回答計畫當時的 6 個審查問題

新版計畫另補第 7 題「初始 fixture 清單是否還要補其他曾經出事的 seam」，由上方補強 1 的種子 fixture 清單處理。

```text
1. registry + 自動 seam 產生取代手工？方向 yes；幾何自動偵測非平凡，先以「結構化手動 registry」起步、
   由它產候選，幾何全自動列後續強化。
2. candidate 來源足夠？6 條足夠且已涵蓋本根因（valid/invalid 交界）；再加補強 2（mode/解析度變更 re-trigger）。
3. probe 欄位足夠？足夠；加記「sampler fallback/回黑」與「相機 texel footprint」兩欄。
4. 「只判新增壞點」沿用 §15/§22？精神一致（只罰回歸、改善算 pass）；但「壞點」須用空間相干 seam 指標
   （見重點），不可用裸亮度門檻，否則被雜訊誤判。
5. 先做第一個 fixture 再擴？強烈同意，垂直切片優先（補強 3）。
6. 其他該列入的 seam？見補強 1 種子清單。
```

**裁示：方向 APPROVE。落地前把「重點（render-space 偵測）」＋補強 1/2/3 納入即可進 Step 1。index.html 由 CODEX 依本 source.md 重生（勿只改 index.html）。**

## OPUS 複審 round 2（2026-06-01）

CODEX 已把 round 1 的「重點 + 補強 1~5」全數正確納入並驗：

```text
- Phase 3「render-space Boundary gate」＝偵測權威；Phase 4 atlas audit 降為定位（§273 分工正確）。
- Phase 1b 種子 fixture 六條到位；Phase 1 #6「atlas mode / 解析度變更」re-trigger 到位。
- 垂直切片優先（§166、§244）；近距 per-seam 相機 + texel-per-pixel footprint（§208、§239）；
  probe 記 sampler fallback/回黑（§238、§355、Step 3 #6）。
- Phase 6 進場順序：Data → Runtime → Boundary(render-space 為 gate、atlas 為附件) → Visual，正確。
```

**一個落地細節（必納，否則 gate 會在高雜訊下漏抓細縫）：**

```text
render-space 的 seamJump 必須「沿 seam 軸向平均」，不可用單點。
  原因：髒斑（issue 1 的放大雜訊）在近距是粗顆粒，單點 jump 會被雜訊頂高 → 細縫被遮（false negative）。
  做法：沿 seam 線逐點取「跨縫 |Δluma|」再平均（等同 candidate-only seam 的逐欄/列平均邏輯搬到 render-space）。
        相干的縫沿軸一致 → 平均後存活；不相干雜訊 → 平均後趨近 interiorJump 基線、被抵銷。
  判紅：averaged seamJump 明顯高於 averaged interiorJump，且只在新模式/新 package 出現。
```

**複審裁示：APPROVE。補上「seamJump 沿 seam 軸向平均」這一點即可進 Step 1。其餘照新版 source.md，index.html 由 CODEX 重生。**
