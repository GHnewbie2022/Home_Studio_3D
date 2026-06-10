# R7-3.10 xatlas A1 北牆：根因調查現況 + 完整交接（給 CODEX）

> 本檔為 OPUS 撰寫之正本（source.md）。CODEX 請先完整閱讀再動工。
> index.html 由 `create_review.py` 從本檔重生，**勿單獨手改 index.html**（會造成正本／頁面分歧）。

---

## 0. TL;DR（現況，含重大認知修正）

R7-3.10 xatlas A1（北牆木門西側，x≈[-1.91, -1.52]）原本的**「大塊均勻暗」是表層症狀**。本次只做了一件事：**把 runtime 漏掉的直接光補回來**（xatlas first-hit 取完間接光就 `break`、漏採 NEE 直接光）。這一步正確但**不完整**——它**揭露**（並非製造）了底下早已存在的分裂：整塊 A1 被切成外觀互異的 A / B / C / D / E。

**重大修正（2026-06-07，使用者裁定）：B 不是「修好／正常」。** 把 B 當正常＝等於承認「整塊 A1 被切割成不同外觀」是對的，而那是錯的。B 目前看似與周圍同色，極可能是**歪打正著**（補回直接光後該局部間接光值＋直接光剛好疊到接近周圍）。A / B / C / D / E **全部**仍在同一套 xatlas C2C 分裂架構內。

**真正的 BUG（整塊 A1 無法像舊 D800 那樣與其餘北牆無縫同色）尚未解決，DEBUG 未結束。**

```
 圖一（北牆）  A = 斑馬線斜紋   B = 目前看似正常（疑歪打正著，非基準、未證實架構正確）   C = 烘焙髒斑
 圖二（西牆交界）D = 髒帶        E = 亮帶
 A–E 全部同屬待解的分裂架構；瑕疵皆為使用者確認的 BUG，待查的是根因機制，非瑕疵是否存在。
```

---

## 0.5 驗收標準（真正目標，勿降標）

整塊 A1（含 A / B / C / D / E）必須與其餘北牆**無縫同色**，如舊 D800 烘焙當時所達成。任何分區、色差、斜紋、髒斑、亮帶、接縫，都算**未過**。「某一小塊（如 B）剛好看起來對」不構成通過，**不得**作為基準，也**不得**當成已修好。

---

## 1. 硬約束（CODEX 必讀，違反即錯）

```
 1. 沒有使用者當次明確允許，永遠禁止退回 LIVE fallback。目標是全室 hybrid 烘焙。
 2. 永遠禁止提出或採用「補保底光 / borrow light / 保底 fallback 光」這類手段。
 3. 尊重使用者實測為權威。使用者已多次實證：LIVE 一直正常、破圖就是 BUG、
    變暗不是「真實光照」。讀碼結論若與實測矛盾，預設是讀錯。
 4. 破圖一律從 bake / runtime 合成端解（flip / UV / alpha / dilation / bake ray
    / worldPos+重烤），不得用視覺保底掩蓋。
 5. 量測差異要量「破圖那一格」，A1 區同時含多種外觀，平均或量到看似正常處會誤判。
 6. Debug 紀律：未確認根因前禁止出修法（先 /systematic-debugging）。
    修材質分支前先 Read 完整 if (hitType==X) 分支。
 7. C1 目前除木門／鐵門／家具物件外全走烘焙；烘焙面是預算結果、不需累積 SPP 即可判讀，
    要與 LIVE 對照約 10 spp 就很乾淨。A–E 是使用者確認的 BUG、與 SPP 無關、不論多少 SPP 都存在；
    待查的只有根因機制，禁止把任何瑕疵當「需更多 SPP 才能確認是否存在」。
 8. 整塊 A1 必須無縫同色才算過。禁止把任一小塊（如 B）當「正常／已修好／基準」——
    A1 被切成不同外觀本身就是 BUG。補回直接光只是其中一步，非 episode 完成。
```

---

## 2. Part 1 —— 漏採直接光（已補回，正確但不完整；非 episode 完成）

### 2.1 症狀（補回前）

北牆木門西側 A1 區整片比周圍北牆暗（均勻暗），LIVE 全程正常。此為**表層症狀**，是底下分裂架構被「均勻暗」蓋住的狀態。

### 2.2 子根因（runtime 合成路徑漏採直接光）

檔案 `shaders/Home_Studio_Fragment.glsl`，主算圖迴圈 first-hit 合成段：

```
 xatlas first-hit（6596）：加完 xatlas 間接光後「break」→ 漏採下游 7073 直接光（NEE）。
 北牆 hybrid（6610）       ：加間接光「無 break」→ 一路到 7073 NEE 採直接光。
 A1 大部分 texel 兩個旗標同時為真，舊碼 xatlas 先命中並 break → A1 只有間接光 → 均勻暗。
 周圍牆走 hybrid → 間接+直接 → 亮；LIVE 完整 path tracing → 亮。
```

旗標來源（皆 `bounces==0`）：
- `r7310XatlasRuntimeFirstHit`（5897）：A1 北牆 UV + xatlas atlas 該 texel valid。
- `r7310NorthWallHybridFirstHit`（5790 → `r7310C1NorthWallHybridActive` 1787 → `r7310C1NorthWallDiffuseUv` 1758）：A1（x∈[-1.91,-1.52]，木門洞左側）回 true。

### 2.3 為何補回直接光後「分裂顯現」（而非整片變好）

補回直接光只解決「均勻暗」。底下分裂依舊：差異只發生在 **xatlas atlas 該 texel valid／invalid** 與**間接光值是否與周圍一致**。a1-c2c-smoke 包 validTexelRatio 不足 100%（約 23% invalid）。

```
 texel「有效」→ 走 xatlas → 間接光取自 xatlas atlas（值可能與周圍 hybrid 不同）。
 texel「無效」→ 退回北牆 hybrid → 間接光取自北牆 atlas。
 有效／無效沿 xatlas chart 幾何聚集 → 兩種來源拼貼 → 斜紋／髒斑／色塊（A、C）。
 B 只是其中「拼貼後恰好接近周圍」的一塊，非架構正確。
```

### 2.4 已動工的修改（runtime 兩行 + 守衛，零重烤）

`shaders/Home_Studio_Fragment.glsl`：

```
 6596–6605  xatlas first-hit 區塊：移除原 6601 的「break;」（改為註解保留說明），
            讓流程往下走到 7073 NEE 採直接光。
 6610       北牆 hybrid 條件改為：
            if (r7310NorthWallHybridFirstHit && !r7310XatlasRuntimeFirstHit)
            A1 既由 xatlas 加過間接光，這裡不再重複加一次間接光。
```

控制流佐證（為何移除 break 後 A1 必達 7073 直接光、且不重複間接光）：
- A1 的 `r7310NorthWallHybridFirstHit` = true，會把 A1 擋在 shortCircuit gate（6699，條件含 `!(...||r7310NorthWallHybridFirstHit||...)`）之外 → 不提早 break。
- 同一旗標也使 diffuse-bounce gate（6801）的 `!(...)` 為 false → 跳過 diffuse bounce → 落到 7073 NEE。
- 6610 守衛避免「xatlas 間接光 + hybrid 間接光」重複相加。
- 結果：A1 = xatlas 間接光（6598）+ 7073 直接光。直接光已補回；間接光來源仍是 xatlas（與分裂相關）。

註：另有 `if (r7310XatlasRuntimeFirstHit)` 在 6536，屬 probe-mode 54 診斷分支（受 `r7310C1RuntimeProbeMode` 開關），非主合成路徑，與本修改無關。

### 2.5 快取破壞鏈（三層同版本，已 bump）

```
 Home_Studio.html        :340  js/Home_Studio.js?v=r7310-xatlas-a1-nobreak-direct-light-v1
 js/Home_Studio.js       :5331 Home_Studio_Fragment.glsl?v=r7310-xatlas-a1-nobreak-direct-light-v1
 shaders/...Fragment.glsl       （上面版本號對應的實體 shader）
```

（先前兩次「畫面沒變」即因 HTML 對 Home_Studio.js 的版本號沒同步 bump、Home_Studio.js 被快取，內部新 shader 版本號未被讀到。此鏈已補齊。）

### 2.6 驗證狀態（重要：補回直接光 ≠ episode 完成）

- 使用者硬重載後肉眼確認：**「大塊均勻暗」消失**。亦即「漏採直接光」這個子問題的修改成立。
- 但此步**只移除均勻暗、揭露了底下的分裂**（A / B / C / D / E）。整塊 A1 仍未達「與其餘北牆無縫同色」。
- **DEBUG 未結束。** 不得據此宣稱 A1 修好，也不得把 B 當正常基準。
- Debug_Log 待整個 A1 episode 收尾再寫。

---

## 3. Part 2 —— A1 仍在分裂架構內（A–E 全部待解，根因未確認）

> 共同前提：A / B / C / D / E **同屬一套 xatlas C2C 架構**；補回直接光後外觀互異，**皆為使用者確認的 BUG**；待查的是根因機制，非瑕疵是否存在。
> 「B 目前看似正常」可能是巧合，**不得**當基準或當已修好（見硬約束 5、8）。
> 禁止在根因確認前出修法；先 /systematic-debugging，Read 相關 hitType／材質分支完整段落。

**深層假設（架構層，UNCONFIRMED，CODEX 優先驗證）：**
真因可能是 xatlas C2C 烘焙 + alpha policy 把 A1 切成 valid／invalid 拼塊、且 xatlas 間接光值與其餘北牆 hybrid 不一致，使 A1 無法像舊 D800（整片無縫同色）那樣輸出單一連續面。**CODEX 應把「A1 是否該改回與其餘北牆相同的烘焙架構（如 D800／separated）」列為首要調查項**，而非只逐一修 A/C/D/E 的表象。

### 3.1 環境重現

```
 URL  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-denoise-c&xatlasPackage=a1-c2c-smoke
 套件 xatlasPackage=a1-c2c-smoke → docs/data/r7-3-10-xatlas-a1-c2c-smoke-runtime-package.json
      packageStatus=architecture_probe、runtimeScope=...c2c_runtime_smoke、
      packageDir=.omc/r7-3-10-xatlas-bake-spike/20260607-062247、atlas 946×516、
      requestedSamples=1000、uploadRowFlip=false、
      xatlasC2CAlphaPolicy: per-texel backface-ratio、threshold 0.5。
 旗標 config 1、床、SPOT、地板/北牆/東牆/西牆/南牆/天花板/樑柱/鐵門開口烘焙=開、北東非方格=開。
```

### 3.2 圖一（北牆，A / B / C —— B 非基準）

相機（live，paused:false）：
```
 cameraState={"position":{"x":-1.588045,"y":2.556184,"z":-1.641069},"yaw":0.2252,"pitch":0.75,"fov":55,
   "forward":{"x":-0.163387,"y":0.681639,"z":-0.713213}}  facing 北(-Z)
```

**A = 斑馬線斜紋（zebra 斜向交替條紋）**
- 位置：北牆上緣靠梁／天花板交界（A1 頂端，近 beam gap sliver 區 west x[-1.908,-1.752] y[2.525,2.905]）。
- 假設（排序，UNCONFIRMED）：
  1. xatlasC2CAlphaPolicy 的 per-texel backface-ratio 在 threshold 0.5 上下跳動：邊緣相鄰 texel valid(1)/invalid(0) 交替 → valid 走 xatlas、invalid 退 hybrid，兩者來源／亮度差 → 斑馬交替。斜向＝沿 beam／chart 三角邊。
  2. xatlas chart UV 接縫處 bilinear（`r7310C1XatlasRuntimeSampleValidLinear`）跨 valid/invalid 取樣 → 沿三角斜邊條紋。
  3. 三區交界（xatlas valid / beam-gap invalid live-trace / hybrid）逐 texel 互疊。
- 建議探針：probe 56（alpha 診斷）看該區遮罩是否交替；probe 49（北牆 pre-albedo 間接）比對 xatlas vs hybrid 在斑馬帶的值；量 backface-ratio 是否壓在 0.5 附近。

**B = 目前看似正常（疑歪打正著，UNCONFIRMED，非基準、非已修好）**
- 位置：A1 中段，補回直接光後恰與其餘北牆相近。
- 重點：**不得當正常基準、不得視為已修好**。B 與 A/C 同走 xatlas C2C valid texel 路徑，僅是該局部間接光值＋直接光剛好疊到接近周圍，未證實架構正確。
- 風險：若拿 B 當基準去比對 A/C，會重蹈「量到正常區誤判」（硬約束 5）。
- 建議探針：probe 49 比對 B 區 xatlas 間接光 vs 其餘北牆 hybrid 間接光是否**真的相等**（而非僅總亮度相近）；probe 54 確認 B 走 xatlas(source-id 1)、周圍走 hybrid(source-id 2)——**來源不同卻看似同色，正是歪打正著的證據**。

**C = 烘焙髒斑（baked dirty spots）**
- 位置：北牆中段（A1 範圍內）。
- 假設（排序，UNCONFIRMED）：
  1. a1-c2c-smoke 為 architecture_probe／spike 烘焙、atlas 僅 946×516：atlas 本身殘留烘焙雜訊／blotch，被直接光照出後顯為髒斑。查 `validation-report.json` 的 actualSamples 與是否 denoise。
  2. 低 validTexelRatio 邊緣 texel 內插拉到 invalid/zero → 暗點。查 dilation 是否足夠。
  3. xatlas 該格間接光值本身與周圍 hybrid 不一致（與 A、B 同源的分裂機制）。
- 建議探針：直接讀 atlas-patch-000-rgba-f32.bin 看髒斑座標是否對應 atlas 本身的烘焙雜訊／alpha 洞（C 是 atlas 端的烘焙瑕疵，與 runtime SPP 無關）。

### 3.3 圖二（西牆交界，D / E）

相機（此截圖為 paused、1 spp 狀態；D／E 屬烘焙面瑕疵、與 SPP 無關）：
```
 cameraState={"position":{"x":-1.705665,"y":1.924279,"z":-1.460364},"yaw":0.2708,"pitch":0.427,"fov":55,
   "forward":{"x":-0.243484,"y":0.414142,"z":-0.877042}}  facing 北(-Z)
```

**D = 髒帶（dirty band，西牆交界）**
- 位置：北牆／西牆交界（西北角）一側的垂直帶。
- 假設（排序，UNCONFIRMED）：
  1. A1 xatlas 西緣與西牆 bake 交界：alpha-invalid texel／dilation bleed 在 atlas 端形成髒帶（烘焙端瑕疵，與 runtime SPP 無關）。
  2. 西牆 bake 邊緣／角落陰影（西側有 beam／column hybrid：WestWall、WestWallBeam、SwColumn…）在交界的 seam。
  3. 兩面 atlas（北牆 / 西牆）在共用邊不一致的 seam。
- 建議探針：probe 56/49 看交界 alpha 遮罩與間接光來源；probe 54 確認交界兩側各走哪條 first-hit；讀西牆／北牆 atlas bin 比對共用邊。

**E = 亮帶（bright band，西牆交界）**
- 位置：北牆／西牆交界的垂直亮帶。
- 假設（排序，UNCONFIRMED）：
  1. A1 xatlas 區西緣（x→-1.91，`r7310C1NorthWallHiddenBySideWall` 邊界）：補回直接光後 A1 已採直接光，但最邊緣 xatlas 間接光可能因 alpha-invalid 趨零，只剩直接光 → 偏亮的窄帶。
  2. A1 xatlas 與西牆／側牆 atlas 的 seam，邊界亮度不連續。
  3. 可能為**本次補回直接光所揭露**：A1 由「整片暗」轉為「有直接光」後，邊界處理不乾淨才顯出亮帶。建議與補回前截圖對照，判定是新增或既有。
- 建議探針：probe 54 看亮帶兩側 source-id；量亮帶處 xatlas 間接光是否趨零（probe 49）；檢查 x≈-1.91 邊界 UV／alpha clamp。

---

## 4. 關鍵檔案地圖

| 用途 | 位置 |
|------|------|
| Runtime 合成 first-hit／NEE（本次修改、A–E 主場） | `shaders/Home_Studio_Fragment.glsl` 6536/6596/6610/6699/6801/7073 |
| xatlas first-hit 旗標 | glsl 5897 `r7310XatlasRuntimeFirstHit` |
| 北牆 hybrid 旗標 / active / UV | glsl 5790 / 1787 / 1758 |
| 側牆排除 / beam gap | glsl `r7310C1NorthWallHiddenBySideWall` / `...HiddenByBeamGap` |
| albedo-free bake 判定 | glsl 6790 `r7310AlbedoFreeBakeFirstHit` |
| Runtime 載入 / uploadRowFlip / albedo 乘 | `js/InitCommon.js` 2196 / 3846-3854 / 13064(renderer) |
| 快取破壞鏈 | `Home_Studio.html`:340、`js/Home_Studio.js`:5331 |
| a1-c2c-smoke 套件 | `docs/data/r7-3-10-xatlas-a1-c2c-smoke-runtime-package.json` → packageDir `.omc/r7-3-10-xatlas-bake-spike/20260607-062247` |
| 對照基準（曾無縫同色的舊架構） | D800 / separated：`docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json`、`...north-east-non-square-d800-denoise-c-preview-runtime-package.json` |
| Debug 紀律 / 修史 | `docs/SOP/Debug_Log.md`（開頭通用紀律 + grep 索引） |

## 5. 探針速查（probe mode）

```
 49  北牆 pre-albedo 間接（比對 xatlas vs hybrid 間接光值是否真的相等）
 54  final runtime source-id（看每格走哪條 first-hit：1=xatlas 2=北牆hybrid 3=西梁 5=其他 …）
 56  alpha 診斷（看 xatlas C2C alpha 遮罩 valid/invalid 分佈）
```

## 6. 已排除（勿重走）

```
 uploadRowFlip 雙重 flip（中段兩條垂直長條對位）—— 已修，uploadRowFlip=false。
 albedo 架構差 35%（wrong area）—— 對照錯基準，已證偽（current D800 與 xatlas 同為 albedo-free+runtime 乘）。
 bake exact-zero / no-borrow 終結、補保底光 —— 使用者否決，永久禁止。
 「變暗是真實光照」—— 使用者多次否定，禁止再猜。
```

## 7. 本次認知修正紀錄（避免重蹈）

```
 OPUS 初版誤把 B 標為「正常區／參考基準」。使用者 2026-06-07 裁定：
 B 看似正常 ≠ 架構正確，極可能歪打正著；把 B 當修好＝承認「A1 被切割」為對，那是錯的。
 正確認知：A–E 全部待解，整塊 A1 須無縫同色才算過，補回直接光只是第一步，DEBUG 未結束。
```
