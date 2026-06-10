# 西樑北端↔北牆黑線：atlas 坐實的根因與無縫修法規格

> OPUS 2026-06-03。本檔以 runtime probe（使用者相機）+ 非方格 atlas 直讀坐實根因，並給「無縫連續交界烘焙」的修法規格。
> 證據：`west-beam-north-contact-probe.json`（七欄位）、`.omc/r7-3-10-global-seam/read-nonsquare-north-edge.cjs`（atlas 直讀）。
> **本檔不改 shader、不改 bake；是給實作階段（CODEX／ralplan）的規格。**

## 1. 根因（證據鏈，已坐實）

```
交接點：worldX = -1.75（canvas x=592 @ 使用者相機），route／owner mask／hit box／normal 四者同步翻轉
  x ≤ -1.75  owner 1015 西樑內側面  normal(1,0,0)+X
  x >  -1.75 owner 1002 北牆        normal(0,0,1)+Z   box z=-1.874（北牆平面）

北牆 owner 1002（非方格 d800）實際取到的 atlas radiance（probe level 49, pre-albedo）：
  角落 0.109 → 內部 0.133  平滑單調爬升（pre/post 比值固定 ~0.74，albedo 一致）
  = 西樑投在北牆上的「真實烘焙接觸陰影」，物理正確、且平滑（非銳利單點）

非方格 atlas 角落 column（col 288）直讀：2327 個北牆 row 的 alpha 全 = 1
  → 不是無效/部分覆蓋 texel、不是 valid-but-black、不是 denoise 假影（raw d800-preview 同樣有）

西樑 owner 1015 在共邊（post-albedo）：~0.10 平，未帶對應的角落變暗

淨效果（post-albedo，seam 行）：
  樑面 0.10  →(交接)  牆角 0.08  →(爬升)  牆內 0.098
  ＝ owner 交接的「向下階梯」，兩側獨立烘焙在共邊不接 → 視覺薄黑線
```

## 2. 為何先前各種講法都不對（防止再走錯）

```
✗ valid-but-black texel：encodingValid=true、值是真實 0.08，非黑。
✗ 無效/部分覆蓋邊緣 texel：角落 column 全 row alpha=1。
✗ denoise 假影：raw d800-preview 也有；牆的接觸陰影本就真實。
✗ 「把牆角拉亮 / dilation / 抓鄰側亮 texel」：牆角 0.08 是物理正確的接觸陰影，拉亮＝毀掉真實 AO（使用者已明令否決）。
✗ runtime x/y 排除 / 換 package：使用者已明令否決；且值是真實烘焙，非 runtime 誤算。
✓ 只有非方格出事的原因：高解析非方格把牆上接觸陰影解析得夠銳，square 模糊掉就看不到階梯。
```

## 3. 無縫修法規格（連續交界烘焙）

```
目標：共邊 worldX=-1.75 上，西樑 owner 1015 與北牆 owner 1002 必須以「相等、且符合凹角接觸 AO」的值相接，
      形成柔和的角落陰影谷，而非向下階梯。

方向（擇一，留待 ralplan 取共識；皆屬 bake/atlas 連續層，非 runtime patch）：
  A. 共邊連續 co-bake：讓西樑內側面烘焙在其貼牆邊（z→-1.874）帶上與北牆角落相符的相互角落變暗，
     兩面在共邊收斂到同一值（約 0.08 量級），各自往內側平滑回升。
  B. 共邊單一 owner 連續：把共邊一小條交單一 owner，由該 owner atlas 連續涵蓋，消除跨烘焙跳變。

硬否決（修後必須全數成立）：
  - 不得把牆角拉亮（保留真實接觸陰影）
  - 不得 runtime blend / x-y 排除 / 換 package
  - 不得出現 ownerCount=0 的無人認領 live 島
  - 共邊兩側 pre-albedo 與 post-albedo 皆連續（無 > 0.005 階梯）

驗收（先紅後綠，d800-north-denoise-c + 使用者相機）：
  1. 重跑 west-beam-north probe：seam 行 post-albedo 跨交接無階梯（樑面↔牆角差 < 0.005）
  2. ownerCount 全程 ∈ {0,1}（無 live 島）
  3. 五個高度行皆無暗 column（peak localDelta < 0.04，linear）
  4. 使用者相機 CDP 截圖肉眼無線
```

## 4. 建議實作路徑

```
本工作屬「演算法敏感、bake 連續性」類（CLAUDE.md R-stage 對照表 R3-5b/R3-6 級）：
  → /ralplan 取 Planner+Architect+Critic 對 A/B 方向與 bake 參數共識
  → /ultrawork 執行重烤＋共邊連續處理
  → 用本檔 §3 驗收（先紅後綠）
重烤成本：C1 1000 SPP < 2 分鐘（sample-bound），但方向錯＝白烤＋汙染記憶，故先取共識。
```
