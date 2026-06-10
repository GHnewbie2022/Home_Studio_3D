# R7-3.10 xatlas A1 北牆破圖：根因調查 ROADMAP（OPUS×CODEX 整合版）

> 本版整合兩份 ROADMAP：OPUS（rootcause-roadmap，偏探針/量測精度與決策框架）與
> CODEX（debug-roadmap，偏 062247 實證數字與調查流程）。
> 所有 062247 數字已由本次讀 xatlas-c2c-alpha-report.json 核實；並標明「整張 atlas」與「A1 牆面 tri10/11」兩層，
> 避免把整張 atlas 的 81% alpha=0 誤當成 A1 退化。
> 行號與 probe 編號於動工時以 shader 實讀為準。重現完整網址見第 9 節。

## 0. 前提（白話）

```
 1  A1 是北牆木門西側那塊牆（世界座標 x≈[-1.91, -1.52]）。
 2  A／B／C／D／E 五塊原本就存在，是使用者拉近確認的既有 BUG，與 SPP 無關。
 3  補回直接光只處理了「大片均勻偏暗」這個獨立子問題，已收、使用者肉眼確認消失。
 4  A–E 與「補直接光」分屬兩條線，調查時分開看，避免方向被誤導。
 5  驗收目標：整塊 A1 與其餘北牆無縫同色。B 看似接近只列為待查現象，跟整塊 A1 一起驗收。
```

## 1. 硬約束與護欄（不可違反）

```
 1  未經使用者當次明確允許，永遠禁止退回 LIVE fallback；目標全室 hybrid 烘焙。
 2  永遠禁止補保底光／borrow light；破圖一律從 bake／runtime 合成／UV／alpha／dilation／worldPos 查起。
 3  使用者實測為權威；讀碼結論與實測矛盾時，預設是自己讀錯。
 4  未確認根因前禁止出修法（先 systematic-debugging）；改材質／hitType 分支前先讀完整 if (hitType==X)。
 5  量測只量「破圖那一格」；A1 含多種外觀，量平均或量到 B 會誤判。
 6  每次只驗證一個主要假設。
 7  整塊 A1（含 A–E）須與其餘北牆無縫同色才算過；B 禁止當基準或當已修好。
 8  Debug_Log 待整個 A1 episode 收尾後再寫。
```

## 2. 現況：A1 被切成 A–E 五塊

| 區塊 | 位置 | 外觀 |
|------|------|------|
| A | 北牆上緣靠梁／天花板交界（A1 頂端、近 beam gap sliver） | 斑馬線斜紋 |
| B | A1 中段 | 看似正常（巧合，非基準） |
| C | 北牆中段（A1 範圍內） | 烘焙髒斑 |
| D | 北牆／西牆交界（西北角） | 髒帶 |
| E | 北牆／西牆交界 | 亮帶 |

五塊同屬一套 xatlas C2C 架構；瑕疵是否存在已由使用者確認，待查的是根因機制。

## 3. 062247 實證數字（已核實，分兩層判讀）★整合重點

數字來源：`.omc/r7-3-10-xatlas-bake-spike/20260607-062247/xatlas-c2c-alpha-report.json`。

```
 整張 atlas（946×516，totalTexels 488136，含 tri0..23 與 -1 共多面）
   alphaOneTexels      91885（18.8%）
   alphaZeroTexels    396251（81.2%）
   visibleExactBlack  144110 → repaired 8929、unrepaired 135181、alphaOneExactBlack 0
   ⚠ 這 81% alpha=0 大多落在「非 A1 牆面」三角形（tri0-9／12-23／-1 多為 alphaZeroPct≈100，如 tri12 全 36422、
     tri-1 全 132107）；runtime 的 A1 範圍不取這些三角形。
   ⚠ 故 unrepaired 135181 是整張 atlas 數，不可直接當「A1 退化」證據（兩份原稿都未拆此層，最易誤判）。

 A1 牆面（north_wall 可見面 = tri10 + tri11，runtime A1 UV 實際取用）
   tri10  22990 格：alpha=1 77.0%(17710)、alpha=0 23.0%(5280)、lumaAlphaOneMean 0.282
   tri11  22988 格：alpha=1 80.4%(18492)、alpha=0 19.6%(4496)、lumaAlphaOneMean 0.240
   → A1 真正拼貼比例 ≈ 77–80% 走 xatlas、20–23% 退 hybrid(D800)。
   → tri10/11 的 lumaAlphaOneMean 與 D800 同級（平均健康）；問題在拼貼分佈，平均值看不出來。

 dilation 對 A1（fillMode same-triangle-fillable-capped-dilation、maxDistance 4）
   dilatedTexels 8929（整張）；sourceTriangleCounts 內 tri10=545、tri11=445 → A1 牆面實際補值 ≈990 格（tri10/11 的 2.2%）。
   sourceAlphaZeroUsed 0、sourceBlackAlphaOneUsed 0（未以 alpha=0／黑 alpha=1 當來源，補值來源乾淨）。
   → A1 上的 dilation 借值痕跡規模小（≈990 格）但集中邊緣，列為 C／邊界候選，待 probe 看是否成可見紋理。

 exact-black 現況
   alphaOneExactBlackTexels = 0（「alpha=1 且 RGB=0」黑洞已歸零；6-07 exact-black 修法在 062247 已套）。
```

## 4. 業界參考：validity／padding／dilation／seam

官方文件對本案的直接幫助：把「逐格 valid 判定」與「成熟 lightmap 接管品質」分開。逐格判定本身屬合理流程；成品品質要求 package 階段把 invalid texel、padding、dilation 與 seam 收斂到可連續取樣。

```
 1  Unity Lightmap Parameters
    https://docs.unity3d.com/2018.3/Documentation/Manual/class-LightmapParameters.html
    Backface Tolerance 會用正面命中比例判定 texel 是否 valid；invalid texel 會用鄰近值近似。

 2  Unity Generating lightmap UVs
    https://docs.unity3d.com/2022.2/Documentation/Manual/LightingGiUvs-GeneratingLightmappingUVs.html
    lightmap UV 需要低重疊、低面積／角度誤差，且 charts 之間要留 padding。

 3  Unity Fixing lightmap UV overlap
    https://docs.unity3d.com/2022.2/Documentation/Manual/ProgressiveLightmapper-UVOverlap.html
    charts 太近時，GPU sampling 會讓一個 chart 的資料 bleed 到另一個 chart；官方解法包含增加 margin 與解析度。

 4  Unity Lightmap seam stitching
    https://docs.unity3d.com/2020.1/Documentation/Manual/Lightmapping-SeamStitching.html
    seam stitching 是官方提供的 seam artifact 緩解方向，會增加 bake 計算成本。

 5  Unreal Understanding Lightmapping
    https://dev.epicgames.com/documentation/unreal-engine/understanding-lightmapping-in-unreal-engine
    lightmap UV 要避免重疊與 wrapping，並保留足夠 padding；解析度與 padding 不匹配會產生 seam 或 light leak。

 6  Unreal Generating Lightmap UVs
    https://dev.epicgames.com/documentation/unreal-engine/generating-lightmap-uvs-in-unreal-engine
    自動 lightmap UV 以 repack 既有 UV charts 為主，來源 UV 若不適合 lightmap，repack 品質也會受限。

 7  xatlas README
    https://github.com/jpcy/xatlas
    xatlas 產生適合 lightmap baking 的唯一 UV 座標；光照 validity、補洞、seam 一致性仍由 bake／package 流程負責。

 對本案的調查含意
   alpha policy 與 dilation 是合理方向，需查 A1 上的分佈與可見痕跡。
   成熟接管目標是輸出可連續取樣的 xatlas lightmap。
   runtime 長期逐格混用 xatlas 與 D800 代表 package 仍停在探針／過渡品質。
```

## 5. 根因框架：R1／R2a／R2b ×（CODEX 5 機制映射）

頂層用 OPUS 的決策框架（依修法成本分級，利於拍板）；CODEX 的 5 機制映射為子項。

```
 R1   同架構內可修（成本低）
      (i)   valid／invalid 拼貼（alpha policy）—— 已由 tri10/11 77–80% 證據支持
      (ii)  dilation 借值痕跡 —— A1 約 990 格補值，待 probe 看是否可見
      (iii) 邊界插值／clamp／牆角權屬 —— 解釋 A 斜紋、D／E 交界帶
 R2a  package 品質／解析度（成本中）—— atlas 僅 946×516、architecture_probe 品質
      provisional（暫定）：須重烤高品質／高解析 xatlas 對照才可拍板；無對照時 R2a 與 R2b 無法終局分辨。
 R2b  xatlas C2C 架構選型（成本高）—— xatlas 與 D800 本質無法對齊（bake 路徑／worldPos 映射差）
      → A1 只要走 xatlas 就分裂，須改回與其餘北牆相同架構（D800／separated）。

 業界接管門檻
   若 A1 要由 xatlas 接管，package 階段需把 invalid texel、padding、dilation、seam 處理到 runtime 可連續取樣。
   若 runtime 仍需長期保留約 20% D800 拼貼，代表 xatlas package 仍停在探針／過渡品質。

 決勝量測項（CODEX 機制 3，分辨 R1 vs R2）
   xatlas 間接光 vs 北牆 hybrid 間接光在「同一世界座標」是否相等：
   同格相等 → 偏 R1；同格系統性不等 → 偏 R2（再由解析度／alpha 分佈分 R2a 或 R2b）。
   既有紀錄曾測 D800 denoise-c 與 xatlas 亮度接近，故保留為「局部」量測，不作預設結論。

 CODEX 5 機制 → 本框架對照
   1 valid/invalid 拼貼 → R1(i)   2 dilation 痕跡 → R1(ii)   3 xatlas-hybrid 局部差 → 決勝量測項
   4 邊界插值/clamp → R1(iii)     5 A1 架構選型 → R2b
```

## 6. 已收斂事項（後續直接沿用）

```
 1  直接光漏採已處理，大片均勻偏暗已消失（移除 xatlas first-hit 的 break + 6610 守衛）。
 2  uploadRowFlip 已修（=false），舊「兩條垂直長條」已收斂。
 3  xatlas 與 D800 的 bake 射線公式相同（origin=pos+normal*8eps、dir=-normal）；北牆 bakeNormal=[0,0,1] 正確。
 4  062247 exact-black 已歸零（alphaOneExactBlackTexels=0）。
 5  validation status=fail 來自 GPU submission 效能門檻（gpu-submission-ms-over-250、341.7>250），
    非畫質型：browserValidation=pass、finiteAtlas／atlasVisibleLuma／validTexelRatio 皆 pass、minCompletedSamples 1000。
 6  runtime weighted-luma guard 尚未實作；定位是「第二道防線」，主調查放在 062247 既有的拼貼與補值痕跡。
    若 package 端已無 alpha=1 黑洞，此 guard 不可當主修法。
 7  使用者觀察到的 A／B／C／D／E 是最高事實依據；A1 以整塊一致作為驗收。
```

## 7. ROADMAP 階段（融合 OPUS 階段 0-3 與 CODEX Phase 1-6）

```
 階段 0  校正現況（唯讀）
   server port（已測 9001 回 200）／git 分支與未提交變更／HTML→Home_Studio.js→Fragment 快取版本鏈；
   確認 xatlasPackage 指向 062247、atlas 尺寸、uploadRowFlip、alpha policy。
   開重現圖自驗：可開／非黑／cameraState／有累積／瑕疵在框／確認載入 a1-c2c-smoke 且非 fallback 空包。
   發現任一不一致先回報再繼續。

 階段 1  驗證 6-07 行級結論仍適用 062247（CODEX Phase 2）
   讀 glsl：xatlas first-hit、north wall hybrid first-hit、probe 54/56/49、NEE 直接光段與 6-07 紀錄一致；
   讀 InitCommon：xatlas package 載入、worldPos→UV 換算、alpha 與 atlas 上傳、runtime albedo 乘與 062247 pointer 一致；
   確認 r7310C1XatlasRuntimeSampleValidLinear 仍未加 weighted-luma guard。
   產出 A–E 資料流草圖（每區先標可能來源：xatlas／hybrid／D800／西牆／邊界插值）。

 階段 2  探針釘來源（核心，OPUS 階段 1 + CODEX Phase 3）
   2a probe 54 final source-id：標 A1 每格走 1=xatlas／2=legacy_d800_north／3=west_beam_shadow／
      4=live_trace／5=other_hybrid_or_baked，定位 A／B／C／D／E。
   2b 同格決勝（須兩側同基準）：hybrid 側=probe 49（北牆 hybrid pre-albedo，單邊，glsl 6061）；
      xatlas 側=r7310C1XatlasRuntimeCpuSampleValidLinear(atlasUv)（CPU mirror，同走 valid-linear；InitCommon 2263↔glsl 1176）。
      atlasUv 由 r7310C1XatlasA1NorthWallUvFromWorldPosition(worldPosition)（InitCommon 2215）取得；
      worldPosition 由 diagnostic 或 probe 32／45 取（使用前以實機確認 A1 牆面該 probe 有值）。
      CpuTexel 與 probe 56 綠階只看單點，不當決勝數值；只跑 probe 49 僅量到 hybrid 一半。
   2c probe 56 xatlas alpha＋luma（glsl 6581）：藍=alpha≤0.5 紅=alpha1且黑 綠=alpha1有亮；
      看 valid/invalid 是否沿 chart 三角邊聚集（A 斜紋）、是否壓在閾值 0.5 附近跳動。
      backface-ratio 是否貼近 0.5 門檻 probe 56 看不到 → 補讀離線工具：c2c-validity-mask.py／alpha report／c2b-backface-ratio.py。
   紀律：只量破圖那一格，避開 B。

 階段 3  讀 bin／atlas 數值（OPUS 階段 2 + CODEX Phase 4）
   atlas-patch-000-rgba-f32.bin（A／C／D／E 對應格 RGB／亮度）、texel metadata（worldPos／normal／triId／valid）、
   alpha report（拼貼與補值分佈）、validation-report（fail 已知為效能門檻、勿當光照失敗）。
   D／E 在北牆/西牆交界：先用 probe 54 定兩側 source-id；落 5(other_hybrid_or_baked 範圍大)時，
   再用 westJoin probe 22/26 或 owner probe 37/38 拆實際面（西牆／西牆梁／西南柱…），讀對應西側 package 比對。

 階段 4  根因分類（CODEX Phase 5，只分類與整理證據）
   對 R1(i/ii/iii)／R2a／R2b 排序，每項附「已支持／待補證據／可排除條件」。

 階段 5  修法方向（CODEX Phase 6，待拍板才實作）
   一個修法只對一個已確認根因，各附驗證方式。
   修法優先判斷綁階段 2 決勝量測：
     量測偏 R1  → 優先收斂 R1(i) alpha policy、R1(ii) alpha-aware dilation、R1(iii) 邊界 UV/bilinear/clamp/牆角權屬；
                  具體看 alpha=0 拼貼能否透過 alpha policy、padding、dilation、seam stitching 類方法收斂。
     量測偏 R2a → 重烤高品質／高解析 xatlas 對照，確認 package 品質／解析度是否足以接管。
     量測偏 R2b → 直接評估 A1 回到 D800/separated 架構，避免在已知架構對不上的 xatlas package 上耗 R1。
     證據尚未分流完成 → 回階段 2／3／4 補齊同格 xatlas vs hybrid 與 A–E source-id 證據。
   全程不退 LIVE、不補保底光；A–E 一起收斂到無縫同色才算過。
```

## 8. 探針速查（probe mode）

```
 22   westJoinRoute（西側交界走哪條：1=swColumnNorth 2=westWall 3=westWallBeam 4=swColumnInner 5=westBeamInner 6=westBeamUnder 7=structural）
 26   westJoinIndirectRadiance（西側交界間接光）
 37   hybridOwnerCountBitmask ／ 38 hybridOwnerRouteSummary（拆 source-id 5 的實際擁有者）
 49   北牆 hybrid pre-albedo 間接（只輸出 hybrid 側單邊；glsl 6061，須配 xatlas 側 valid-linear 才成同格比對）
 54   final runtime source-id（1=xatlas 2=legacy_d800_north 3=west_beam_shadow 4=live_trace 5=other_hybrid_or_baked；glsl 6532）
 55   xatlas A1 triId 色塊（glsl 6577）
 56   xatlas alpha＋luma 診斷（藍=alpha≤0.5 紅=alpha1且黑 綠=alpha1有亮；glsl 6581；看不到 backface-ratio 門檻）
 設法 手動：瀏覽器 console 設 pathTracingUniforms.uR7310C1RuntimeProbeMode.value = <編號>，或用 URL 參數截圖。
 上限 自動報告 reportR7310C1FullRoomDiffuseRuntimeProbe() 的 probeLevel 夾在 [1,53]（InitCommon 11343）；
      22/26/37/38 在 [1,53] 內可由自動報告跑；54/55/56 會被夾成 53，須走手動 uniform／URL 截圖，或先把 helper 上限改到 56。
  協作護欄（2026-06-10 CODEX 補記）：
      使用者已確認 Console／URL 曾成功切到 54 與 56；這代表 shader 與 Home_Studio.js 的手動路徑可用。
      本輪只補文件提醒，CODE 保持現狀；OPUS 另窗若正在改 helper 或 probe，兩邊暫時分工，避免同時改同一段 JS／GLSL。
      後續若要產自動 JSON，先確認 helper 上限；若仍為 [1,53]，54/55/56 改走手動截圖或等 helper 專案化修正。
```

## 9. 重現環境（完整網址）

```
 完整網址  http://localhost:9001/Home_Studio.html?nonSquarePackage=d800-north-denoise-c&xatlasPackage=a1-c2c-smoke
 套件      xatlasPackage=a1-c2c-smoke → docs/data/r7-3-10-xatlas-a1-c2c-smoke-runtime-package.json
           packageDir .omc/r7-3-10-xatlas-bake-spike/20260607-062247、atlas 946×516、
           requestedSamples=1000、uploadRowFlip=false、alpha policy 逐 texel backface-ratio 閾值 0.5。
 包品質    validation-report status=fail 屬效能型（gpu-submission-ms-over-250、341.7>250）、非畫質型；
           browserValidation／finiteAtlas／atlasVisibleLuma／validTexelRatio 皆 pass、minCompletedSamples 1000、timedOut=false。
 旗標      config 1、床、SPOT、地板／四牆／天花板／樑柱／鐵門開口烘焙＝開、北東非方格＝開。
 圖一相機  position(-1.588045, 2.556184, -1.641069) yaw 0.2252 pitch 0.75 fov 55 朝北（看 A／B／C）
 圖二相機  position(-1.705665, 1.924279, -1.460364) yaw 0.2708 pitch 0.427 fov 55 朝北（看 D／E）
```

## 10. 驗證標準

```
 1  A1 全區與其餘北牆無縫同色。
 2  A 斜紋消失。
 3  C 髒斑消失。
 4  D 西牆交界髒帶消失。
 5  E 西牆交界亮帶消失。
 6  B 區不再作為單獨標準，只跟整塊 A1 一起驗收。
 7  LIVE 對照約 10 spp 即乾淨；烘焙面是預算結果，不需等高 SPP 才判讀 A–E。
 8  保存圖一／圖二兩角度的對照截圖（烘焙面 vs LIVE）；烘焙面約 10 SPP 即乾淨、足以判讀 A–E，不套 path tracing 高 SPP 累積。
```

## 11. 已排除（勿重走）

```
 uploadRowFlip 雙重 flip（兩條垂直長條）—— 已修，uploadRowFlip=false。
 albedo 架構差 35%（wrong area）—— 對照錯基準，已證偽。
 bake exact-zero／補保底光 —— 使用者否決，永久禁止。
 「變暗是真實光照」—— 使用者多次否定，禁止再猜。
 改 rayDirection=-normal／半球取樣 —— 與乾淨 D800 同公式，動全 23 面共用路徑，屬非根因。
```

## 12. 關鍵檔案地圖

| 用途 | 位置 |
|------|------|
| Runtime 合成 first-hit／NEE（A–E 主場） | shaders/Home_Studio_Fragment.glsl 6532/6596/6610/6699/6801/7070 |
| xatlas valid-linear 取樣（顯示路徑） | glsl 1176 r7310C1XatlasRuntimeSampleValidLinear ／ CPU mirror InitCommon 2263 |
| worldPos→A1 UV 換算 | js/InitCommon.js 2215 r7310C1XatlasA1NorthWallUvFromWorldPosition |
| xatlas first-hit 旗標 | glsl 5897 r7310XatlasRuntimeFirstHit |
| 北牆 hybrid 旗標／active／UV | glsl 5790／1787／1758 |
| probe 49／54／55／56 定義 | glsl 6061／6532／6577／6581 |
| source-id decode（1..5 名稱） | js/InitCommon.js 10805 r7310C1FinalRuntimeSourceNameForId |
| 自動報告 probeLevel 夾值 | js/InitCommon.js 11343 |
| Runtime 載入／uploadRowFlip／albedo 乘 | js/InitCommon.js 2196／3846-3854／13064 |
| 062247 alpha report（拼貼/補值數字） | .omc/r7-3-10-xatlas-bake-spike/20260607-062247/xatlas-c2c-alpha-report.json |
| 離線 alpha／backface 工具 | docs/tools/r7-3-10-c2c-validity-mask.py、docs/tools/r7-3-10-c2b-backface-ratio.py |
| a1-c2c-smoke 套件 | docs/data/r7-3-10-xatlas-a1-c2c-smoke-runtime-package.json |
| 對照基準（曾無縫同色） | D800／separated：docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json |
| Debug 紀律／修史 | docs/SOP/Debug_Log.md（開頭通用紀律 + grep 索引） |

## 13. 整合來源對照（透明標示）

| 區段 | 主要來源 | 整合動作 |
|------|----------|----------|
| 0 前提白話 | CODEX 第 0 節 | 直接採用、精簡 |
| 1 硬約束護欄 | 兩份合併 | OPUS 6 條 + CODEX「每次一假設／Debug_Log 時機」 |
| 2 A–E 表 | OPUS 第 2 節 | 直接採用 |
| 3 062247 數字 | CODEX 第 2/3 節 ＋ 本次核實 | 採 CODEX 數字，新增「整張 atlas vs A1 牆面 tri10/11」兩層拆分（本次讀 report 增值） |
| 4 業界參考 | Unity／Unreal／xatlas 官方文件 | 新增 validity／padding／dilation／seam 與成熟 lightmap 接管門檻 |
| 5 R1/R2 框架 | OPUS 第 3 節 ＋ CODEX 5 機制 ＋ 官方參考 | OPUS 框架當頂層，CODEX 5 機制映射為子項，新增接管門檻 |
| 6 已收斂 | CODEX 第 3 節 | 採用、補 weighted-luma guard 狀態 |
| 7 階段 | OPUS 階段 0-3 ＋ CODEX Phase 1-6 ＋ 官方參考 | 融合，新增「驗證 6-07 結論仍適用」一階段，補修法優先判斷 |
| 8 探針速查 | OPUS 第 5 節 | 採用（CODEX 版 probe 描述較粗，未取） |
| 9 重現環境 | OPUS 第 6 節 | 直接採用 |
| 10 驗證標準 | CODEX 第 5 節 | 採第 1-7 點；移除第 8 點 500 SPP（與烘焙面前提衝突，使用者裁定 10 SPP 已足） |
| 11 已排除 | OPUS 第 7 節 | 直接採用 |
| 12 檔案地圖 | OPUS 第 8 節 | 採用、補 alpha report 與 worldPos→UV |

## 14. 階段性調查結論（CODEX 2026-06-08）

> 本節由 CODEX 補寫。狀態為階段性根因調查紀錄，尚未進入修法拍板。

### 14.1 本輪定位

```
 1  A1 破圖目前可拆成三套機制：
    C 低處：xatlas 有大量幾何可見洞，runtime 退 D800。
    A 上緣：有少量 alpha=1 但亮度接近 0 的 xatlas 格，runtime 仍當正常 xatlas 來源。
    D／E 西北角：west_beam 真實接觸帶與 beam gap gate 差 0.002m，造成 D800 黑窄帶旁邊接 live／xatlas 亮帶。

 2  R2b 目前降權一階：
    mapped 區大多數 xatlas 與 D800 同世界座標亮度相近。
    目前證據更偏 R1：package 可見洞、近黑 alpha=1、beam gap owner 邊界。

 3  row／UV 錯位、tile 未完成、D800 denoise-c 新增破壞、SPP 不足，皆已降權。
```

### 14.2 C 低處證據

```
 1  alpha0 component 1：
    count 5524
    worldBBox x=-1.91..-1.52, y=0..0.36
    kind visible_exact_black_unrepaired 5523、mask_invalid 1

 2  runtime 路由重播：
    xatlas 0
    D800 5451
    live 73

 3  D800 denoise-c 同區亮度：
    median 0.251802
    mean 0.252594

 4  判讀：
    低處 C 偏「xatlas 可見洞 + D800 拼貼邊界」。
    這區 D800 與周邊 xatlas 亮度級距接近，平均亮度很容易掩蓋破碎邊界。
```

### 14.3 A 上緣證據

```
 1  alpha=1 但 luma < 0.001：
    count 47
    tri11 47
    owner mapped 33、beam_gap 14
    worldY 2.885..2.905

 2  mapped 33 格的 D800 denoise-c 對照：
    mappedD800Luma median 0.141201
    xatlas luma 約 0.000056..0.000128

 3  frontFraction：
    lowAlpha1 median 0.953125
    visibleHoles median 1.0
    maskInvalid median 0.40625

 4  判讀：
    這批格多數被幾何判定為清楚可見。
    問題主軸偏 xatlas bake radiance 產生 0 或近 0，單靠 alphaOneExactBlackTexels=0 無法抓到近黑 alpha=1。
```

### 14.4 D／E 西北角證據

```
 1  contact-edge scan：
    真實 west_beam contactBand x=-1.91..-1.75, y=2.525..2.905
    現行 gateInvalidRegionWest x=-1.908..-1.752, y=2.525..2.905
    bandVsGateDelta xMin=-0.002, xMax=0.002

 2  精準接縫線取樣：
    x=-1.9095..-1.9085, y>2.6
    D800 raw 與 denoise-c 皆有 alpha=1、RGB 接近 0 的黑窄帶。

 3  runtime 路由重播：
    上緣 alpha0 component 2 count 4252
    route xatlas 40、D800 1909、live 2303
    owner mapped 1910、beam_gap 2342

 4  判讀：
    D 暗帶與 E 亮帶很可能來自 2mm owner/source 切換帶。
    這條帶同時牽涉 D800 黑 texel、beam gap live 接管、xatlas 邊界少量殘留取樣。
```

### 14.5 本輪產物

```
 /private/tmp/r7310-a1-alpha0-component-runtime-route-v1.json
 /private/tmp/r7310-a1-frontfraction-low-and-holes-v1.json
 /private/tmp/r7310-a1-west-seam-line-sample-v1.json
 /private/tmp/r7310-d800-denoise-west-upper-details-v1.json
 /private/tmp/r7310-a1-contact-edge-scan-west-v1.json
```

### 14.6 下一步調查

```
 1  釘「xatlas 幾何可見格為什麼烤成 0／近 0」：
    對 47 格 near-black alpha=1 與 8524 格 visible holes 做 second-bounce 分布、直接光命中、光源貢獻與遮蔽 box 對照。

 2  釘 D／E 2mm 接觸帶：
    把使用者看到的髒帶／亮帶位置與 x=-1.91..-1.908、x=-1.752..-1.75 兩條 gate delta 對齊。

 3  釘 package 修復條件：
    先量化低處 component 若以乾淨 alpha=1 source 補洞，需要的距離與 residual 數量。
    上緣 near-black source 需先排除，避免把近黑來源擴散。
```

### 14.7 續查紀錄（CODEX 2026-06-08）

> 本節由 CODEX 補寫。狀態為 14.6 第 1、2 項的延伸調查，仍屬根因定位。

```
 1  runtime 合成路徑確認：
    glsl 6596-6604：xatlas 命中時只加 xatlas 間接光。
    glsl 6610-6611：同一格若 xatlas 命中，北牆 hybrid 間接光會跳過。
    glsl 7071-7078：後續仍會進 direct light NEE。
    判讀：A／C／D／E 的主要差異集中在間接光來源與 owner/source 切換。

 2  xatlas 與 D800 同格總體對照：
    owner=mapped count 43184。
    xatlasLuma median 0.262349。
    d800Luma median 0.258806。
    xatlasMinusD800 median -0.000366、mean -0.000342。
    判讀：整體同格亮度高度接近，R2b 目前續降權；局部例外仍是主線。

 3  A 上緣 near-black alpha=1 對照：
    A_black_north_wall xatlasLuma 0.00012765、D800 luma 0.140733。
    second-bounce 近距離遮蔽比例 74.52%。
    top hits：天花板 37.73%、西牆橫樑 36.79%。
    健康鄰點 chart_upper_lit_neighbor luma 0.213171，近距離遮蔽比例 0%。
    判讀：A 上緣 near-black 與非常近的天花板／西樑接觸取樣強相關。

 4  C 低處洞區對照：
    low_component_band count 5688，route xatlas 243、D800 5373、live 72。
    xatlasLuma median 0.252294，D800 median 0.252172。
    alpha0/low_component_band/mapped count 5373，D800 median 0.251471。
    判讀：C 低處的健康 xatlas 與 D800 亮度一致，破圖主要來自 5373 格 alpha0 退 D800 的拼貼。

 5  D／E edge table 對照：
    y260 row：x=360/440/520 為 west_wall_beam_shadow_hybrid，westJoinLuma 約 0.230-0.242。
    同列進北牆後 xatlasValid=true，xatlas/D800 ratio 約 0.9629-1.0874。
    y430 row：x=440 為 west_wall_beam_shadow_hybrid；x=520 後進北牆 xatlas，ratio 0.9944 起。
    判讀：D／E 更偏 owner/source 邊界切換；北牆內部 xatlas 與 D800 同格接近。

 6  暫定根因排序更新：
    R1(iii) 邊界權屬／接觸帶：支持升高，主打 A 上緣 near-black 與 D／E。
    R1(i) valid/invalid 拼貼：支持維持高，主打 C 低處與上緣 alpha0 band。
    R1(ii) dilation 借值：需排除 near-black source 後再評估。
    R2a package 品質／解析度：待高品質或高解析 xatlas 對照。
    R2b 架構選型：目前降權；保留為最後拍板分支。
```

### 14.8 接觸帶與補洞條件續查（CODEX 2026-06-08）

> 本節由 CODEX 補寫。新增產物為 `/private/tmp/r7310-a1-nearblack-contact-distance-v1.json` 與 `/private/tmp/r7310-a1-visible-hole-contact-distance-v1.json`。

```
 1  near-black alpha=1 的接觸帶距離：
    count 47。
    全部在天花板 20mm 內，distToCeiling median 0.010m、max 0.020m。
    30/47 在西樑右邊界 20mm 內。
    19/47 落在西樑投影範圍內。
    atlas 分布集中在 px=0..4；py=213..228。
    判讀：A 上緣斜紋與北牆頂邊、天花板、west_beam 右邊界的接觸取樣高度吻合。

 2  visible holes 的接觸帶拆分：
    total 8524。
    低處 C：5523 格，distToCeiling median 約 2.72m，insideWestBeam 0。
    上緣：3001 格，insideWestBeam 1207，nearCeiling20mm 108，nearWestBeamRight20mm 203。
    判讀：C 低處與 A/D/E 上緣同屬 alpha0 拼貼，但空間來源不同；C 是大面積可見洞，上緣是接觸帶可見洞。

 3  dilation 半徑條件：
    current dilation maxDistanceTexels=4，A1 residual visible holes 8524。
    用 current alpha1 source 估算，<=4 texel 只能覆蓋 1355/8524。
    overall distance median 11、p95 34、max 72。
    低處 component 1 distance median 10、p95 29，nearestSourceLuma median 0.252294。
    上緣 component 2 distance median 14、p95 45，nearestSourceLuma median 0.000128。
    判讀：低處可以評估較大半徑 clean-source 補洞；上緣須先排除 near-black source。

 4  暫定機制拆分：
    C：R1(i) alpha0 visible hole + dilation 半徑不足。
    A：R1(iii) 接觸帶 near-black alpha=1 + R1(i) 上緣 alpha0 band。
    D／E：R1(iii) west_beam owner/source 切換 + 2mm gate delta。
    R2b 保留低順位，等待高品質 xatlas 對照或更明確的同格系統性差異。
```

### 14.9 near-black 來源判讀（CODEX 2026-06-08）

> 本節由 CODEX 補寫。目的為分辨 A 上緣 near-black 是 dilation 造成，或是 xatlas bake 本身產生。

```
 1  dilation 函式條件：
    docs/tools/r7-3-8-c1-bake-capture-runner.mjs 1554-1635。
    只有 alpha<=0.5 且 fillable 的格子會被填。
    source 只從既有 alpha=1 格子展開，半徑上限 4 texel。

 2  47 格 near-black 的狀態：
    alpha=1。
    luma 約 0.000056／0.000128，高於 exact-black 門檻 1e-9。
    因為 alpha 已是 1，這批格不會成為 dilation destination。

 3  歷史包對照：
    023242：代表點 xy=(2,218) 是 alpha=1 exact black。
    061741：同點 luma 0.1224446。
    062247：同點 luma 0.00012765。
    062247 的 8524 個 visible exact-black 全部都在 023242 visible exact-black 交集內。

 4  判讀：
    A 上緣 near-black 目前偏 xatlas bake 原始輻射或 bake-time 接觸判定結果。
    dilation 風險仍在上緣 component 2：它的最近 source median luma 0.000128，若拿來補洞會擴散髒來源。
```

### 14.10 C 低處 raw-zero 續查（CODEX 2026-06-09）

> 本節由 CODEX 補寫。目的為補齊 §16.3 引用的 C 低處續查數據，讓 §14 與 §16 狀態對齊。
> 本節摘要產物：`/private/tmp/r7310-a1-c-low-phase4-rootcause-classification-v1.json`。

```
 1  已做量測：
    CPU second-bounce／NEE 對照：C 低處洞 5523 格、C 低處健康點 796 格、A 上緣 near-black 對照 47 格。
    browser pre-policy 64 spp：讀 alpha policy 前的 GPU bake 記憶體。
    GPU first-hit probe 42／45／46：用現有 probe 看第一槍 box／worldPos／normal。

 2  browser pre-policy 64 spp：
    C 低處洞 count 5523，zero 5523，positive 0。
    C 低處健康點 count 796，zero 556，positive 240。
    健康點正值分布：p75 0.209402、p90 0.277218、p95 0.303510、p99 0.352581、max 0.411595。
    判讀：C 低處洞在 alpha policy 前已經是 raw zero；alpha policy 是接到 0 之後才把格子標成 alpha=0。

 3  CPU second-bounce／NEE：
    C 低處洞 light-hit 53900/80000 = 67.375%，NEE weight median 0.005827。
    C 低處健康點 light-hit 53541/80000 = 66.926%，NEE weight median 0.005875。
    A 上緣 near-black 對照 light-hit 13404/80000 = 16.755%，NEE weight median 0。
    判讀：C 低處洞與同區健康點的 second-bounce／NEE 幾何條件接近；
          A 上緣對照明顯不同，所以一般光源遮蔽對 C 低處降權。

 4  CPU first-hit replay：
    C 低處洞：miss 0，hit box15 5450、box42 73，first-hit distance median 0.008000，normal median (0,0,1)。
    C 低處健康點：miss 0，hit box15 789、box42 7，first-hit distance median 0.008000，normal median (0,0,1)。
    判讀：以 CPU 重播 metadata，第一槍設定完整且穩定。

 5  GPU first-hit probe：
    mode 42：
      C 低處洞 box15/hitType1 = 5378/5523（97.374%），miss-like 145。
      C 低處健康點 box15/hitType1 = 782/796（98.241%），miss-like 14。
    mode 45：
      C 低處洞 worldPos median 約 (-1.725, 0.180, -1.874)。
      C 低處健康點 worldPos median 約 (-1.705, 0.370, -1.874)。
    mode 46：
      C 低處洞 normal median (0,0,1)。
      C 低處健康點 normal median (0,0,1)。
    判讀：GPU 端第一槍大多打到正確北牆 box，worldPos 與 normal 也落在合理範圍；
          first-hit box／worldPos／normal 作為 5523 格 raw zero 主因降權。

 6  階段性分類：
    高支持：C 低處是 xatlas raw bake output 在 alpha policy 前已變成 0。
    降權：first-hit box／worldPos／normal 錯、一般光源遮蔽、alpha policy 主因。
    保留：alpha policy 與 capped dilation 是可見症狀放大器，會把 raw zero 轉成 alpha0 拼貼。

 7  下一個卡點：
    無改碼 probe 已把問題推到 GPU 第一槍之後。
    下一個決勝證據需要新增或暴露 GPU 診斷：
      second-hit box／hitType、sourceDot、shadow target、mask、accumCol。
    這屬 shader／runtime 診斷改動；在未取得動 CODE 允許前，只能停在候選分類。
```

## 15. OPUS 結論與方向收斂（OPUS 2026-06-08）

> 本節 OPUS 撰寫，與 §14（CODEX）互證；明確標出「已釘死／仍待釘」界線，並把先前過早的定論降級，避免重走。

```
【方向修正：三個錯方向已被數據推翻，記錄免重走】
 1  A1 退回 D800 —— 縫隙會回來、是打地鼠，撤回。
 2  xatlas chart 島切割 —— A1 是單一 chart 15、UV 連續，證偽。
 3  alpha policy／背面比例為主因 —— 降為次因（僅佔 A1 alpha=0 的 13%、集中上緣）。
 收斂：根因在「xatlas 把 A1 幾何可見的真牆面烤成 0／近 0」，alpha=0 標記是下游結果（與 §14 一致）。

【OPUS D800 對照（與 §14.2／14.7-4 互證）】
 A1 alpha=0 共 9776 格（row 翻轉對齊後分類）：87%(8524) 烤成全黑 exact-black、13%(1252) 背面比例（集中上緣）。
 C 底部 worldY<0.4：xatlas 大片烤 0（1472/1517/1508/1027 格）、D800 同區 valid luma≈0.25（約 3290 格）。
 中段 worldY 1.0~1.4：xatlas 0 格烤 0、luma 0.262 ≈ D800 0.264。
 → 坐實「C 底部牆面本來有間接光、是 xatlas 特有把它採成 0」；與 §14.7-4（健康 xatlas=D800、破圖來自 alpha0 退 D800）互證。

【機制現況：已釘 vs 待釘（誠實界線）】
 已釘  A 上緣 near-black（47 格 alpha=1）：§14.7-3 second-bounce 近距離遮蔽 74.52%、top hits 天花板 37.73%／西樑 36.79%
       → 牆頂轉角採間接光被緊鄰天花板/西樑遮 → 採近 0。屬「真實接觸遮蔽取樣」。
 待釘  C 底部 visible holes（5523 格 alpha=0）：D800 對照證明 xatlas 特有採 0（distToCeiling 2.72m、非天花板遮蔽），
       但「為何烤 0」尚未對底部 5523 格做 second-bounce／光源貢獻／遮蔽 box 分析（§14.6-1 只做了上緣 47 格）。
 ※ OPUS 先前向使用者口頭提過的「worldPos 座標落偏」屬『未證實候選』；上緣數據指向 second-bounce 取樣而非座標落偏，
   故不列為定論。C 底部機制以「對 5523 格做 §14.7-3 同款 second-bounce 分析」為準。

【修法護欄（待 C 底部機制釘死才定具體修法）】
 1  不退 LIVE、不退 D800（縫隙會回來）。
 2  不 dilation borrow：上緣 near-black source median 0.000128，補洞會擴散髒來源（§14.8／14.9）；
    C 底部即使 source 乾淨（≈0.252），借值仍非「讓格子自己烤出值」。
 3  修法應讓 xatlas 對「幾何可見的真牆面」烤出自己的正確間接光（C 底部走 second-bounce 採樣、上緣走接觸遮蔽取樣），
    使其不再 0／近 0；而非在下游補 alpha 或借鄰值。
 4  R2b（架構回退）留最後分支，待高品質／高解析 xatlas 對照或更明確同格系統性差異才拍板。
```

## 16. 調查清單盤點（OPUS 2026-06-09，供 CODEX 審閱與同步）

> 本節 OPUS 撰寫、CODEX 審閱後補正（2026-06-09）。把 §0–15 的調查攤成一張嫌疑清單，標出已查／未查，方便對齊接手。
> 另含一條對 §15 的狀態更正（A 上緣降權）；§15 保留原貌作時間線，狀態以本節為準。
> 符號：✅ 已洗清、不再相關；▽ 曾疑為主因、現降權但未完全排除；◐ 已定位或已做一輪、根因未釘；⬜ 未查或無結論。

### 16.0 狀態更正：§15「已釘 A 上緣」降回「待驗」

```
 §15 把 A 上緣 47 格 near-black 標為「已釘＝second-bounce 近距離遮蔽 74.52%」。
 經使用者質疑（牆角靠近天花板／西樑，光仍會照到，為何採成 0）後重新檢視：

 1  這包只烤間接光（indirect_diffuse_radiance；directLightAlreadyIncluded=false，
    直接光 runtime 之後才加）。直接光不因這格烤 0 而消失。

 2  74.52% 只能證明測試射線常撞到近距離結構（天花板／西樑）。
    目前不能把它解讀成「這塊本來就該暗」，也不能反過來斷定它一定不該暗。

 3  「撞到近距離結構之後為何採成 0」的可能成因，目前並列為候選、皆未驗證、未排序：
    self-hit、epsilon 太近、worldPos／normal 落偏、緊鄰面當下無亮度、測試射線採樣不正確。
    （CODEX 在 C 底部已把 first-hit box／worldPos／normal、一般光源遮蔽降權，見 §16.3／§14.10；
    但 §14.10 顯示 A 上緣 second-bounce 特徵與 C 低處不同，該降權未必適用 A 上緣。）

 結論：A 上緣的物理遮蔽解讀未經驗證，由「已釘」降回「待驗」。
       它與 C 底部同屬「bake 產生端烤出 0／近 0」這個大方向；但 §14.10 的 CPU NEE 對照顯示
       兩者 second-bounce 特徵不同（C 低處洞 light-hit 67.375%、NEE weight median 0.0058；
       A 上緣對照 light-hit 16.755%、NEE weight median 0），細節機制可能分流。
       C 低處的「GPU 第一槍之後」查法未必直接套到 A 上緣，兩者後續分開驗。
```

### 16.1 主線嫌疑已洗清／降權（✅ 洗清；▽ 降權未完全排除）

```
 ✅  runtime 讀烤圖路徑走錯           → 重播路由，xatlas／D800／live 分流正確
 ✅  xatlas 把 A1 切成多個碎島        → A1 是單一 chart（UV 展開島）15、連續
 ✅  UV 對位／row 翻轉錯              → row-flip 對齊後吻合 1.000
 ✅  runtime 取樣公式錯（雙線性×alpha）→ CPU 鏡像重算一致
 ✅  SPP（每像素取樣數）不足          → 烘焙面破圖與 SPP 無關，10SPP 即可見
 ✅  tile 沒烤完                      → 降權排除
 ✅  D800 denoise-c 這次新增破壞      → 降權排除
 ▽  整片系統性色差「為主因」          → 同格比對 median 差約 0.4%，整片色差降權；A1 局部 raw zero／near-black 另計
 ▽  albedo（底色）不等價「為主因」    → 健康區同格亮度接近，albedo 主因降權；A1 局部 raw zero／near-black 仍在 bake 產生端，albedo 分支未完整審
 ▽  背面比例／alpha policy「為主因」  → 佔 A1 alpha=0 約 13%、集中上緣，降為次因
```

### 16.2 已定位、根因未釘（◐ 查到一半）

```
 ◐  D／E 西北角 2mm 接縫帶  → 量出接觸帶與 gate delta 0.002m，根因與修法未釘（§14.4／14.7-5）
 ◐  dilation（向外擴張補洞）半徑不足 → 量出 ≤4 texel 只覆蓋 1355/8524（§14.8-3），屬症狀、非根因
```

### 16.3 待查／待釘（⬜ 卡點集中於此，全在 bake 產生端）

```
 C 底部（最大一片，5523 格）★核心
 ◐  xatlas 為何把幾何可見的真牆面烤成 0 —— 已做一輪，卡點往後縮
     已做（CODEX 續查 2026-06-09）：CPU second-bounce（第二次彈射）／NEE（直接光取樣）對照、
       browser pre-policy 64spp、GPU first-hit（第一槍命中）probe 42／45／46。
     結論：C 底部在 alpha policy 之前就已 raw zero（烘焙原始值就是 0）；
       first-hit box／worldPos／normal 降權；一般光源遮蔽降權。
     下一步：查 GPU 第一槍之後的 second-hit（第二次命中）／NEE／accumulation（多幀累積）。
     ※ 此續查的數據與產物路徑已補進 §14.10；本節保留盤點結論，避免下游再判成「未做」。

 A 上緣（47 格近黑）
 ⬜  「近距離遮蔽 74.52%」的物理意義（剛由已釘降回待驗，見 §16.0）
 ⬜  烤的當下，緊鄰天花板／西樑本身有沒有亮度

 烘焙射線本身（可能一次解釋 C 底部＋A 上緣）
 ⬜  射線起點 worldPos（世界座標）在破圖格有沒有歪
 ⬜  射線方向 normal（法線）有沒有歪
 ⬜  射線閘門 gate（glsl 3316 那道判斷）是否誤判失敗
 ⬜  self-hit（射線一出去就戳到貼著的面）／epsilon（離面偏移量）太近導致回傳 0

 package 品質
 ⬜  以更高品質／更高解析度 xatlas 重烤對照（R2a）
```

### 16.4 盤點結論

```
 1  下游「讀取端」已洗清或降權（見 §16.1）。
 2  卡點集中在上游「烘焙如何產生 0／近 0」這一層。
 3  C 底部核心已做一輪（CPU second-bounce／NEE、64spp pre-policy、GPU first-hit probe 42／45／46）：
    確認 alpha policy 之前就 raw zero，first-hit box／worldPos／normal 與一般光源遮蔽都降權；
    卡點往後縮到「GPU 第一槍之後的 second-hit／NEE／accumulation」。
 4  A 上緣仍待驗（§16.0）、D／E 仍未釘（§16.2）。
 5  因此「再查 xatlas 需多久」目前無法保證：bake 產生端「raw zero 在 GPU 第一槍之後如何形成」仍是未知數。
```

### 16.5 GPU 探針嘗試與方法學發現（OPUS 2026-06-09）

> 本節 OPUS 撰寫。記錄「動 CODE 加 GPU 診斷探針」這一輪的進展與一個方法學發現，供 probe 收尾時參考。

```
 1  已做：glsl probe 57 框架（GPU bake 模式 second-hit 探針）
    在 GPU bake 模式、bounces==1（北牆 texel 彈出後的第二槍命中）插入診斷分支。
    shader 編譯通過、正常渲染不受影響（probe≠57 不觸發）、確認 eval 可驅動 bake。
    位置：shaders/Home_Studio_Fragment.glsl 主迴圈 5902 之前；checkpoint 848ba29 之上的 working tree（未提交）。

 2  方法學發現（關鍵，避免下游踩同坑）：
    「輸出 second-hit 的 box index」在 bake 多 sample 累積下無意義。
    bake render target 是多 sample「平均」；box index 平均會把 box3（地板）與 box43（鐵門）
    平均成中間的 box23，直方圖直接毀掉。
    → 正確探針要輸出「平均後仍有意義的量」：
        light-hit 比例（second-hit 後 NEE 命中光源的比例 → 對照 §14.10 CPU 67.375%）、
        NEE weight（→ 對照 §14.10 CPU 0.0058）。
      且要插在 NEE 算完之後（glsl 7073 之後），不是命中當下（5902）。

 3  為何這更對：直接命中 §14.10 決勝點。
    §14.10 CPU replay：C 低處 second-hit 的 NEE weight median 0.0058（非零）、light-hit 67.375%；
    GPU bake 出 raw zero。決勝問題＝GPU 實際的 light-hit／NEE weight 是不是 0、在哪一步歸零。
    探針量這兩個值（GPU vs CPU）就能分辨 raw zero 出在 second-hit 幾何、NEE、還是 accumulation。

 4  probe 收尾待定（使用者裁示「先記錄」）：
    glsl probe 57 框架可沿用，把輸出 accumCol 那 3 行從 box／hitType／t 改成 light-hit／NEE weight、
    並移到 NEE（7073）之後即可；readback 走 reportR7310C1XatlasBakeAfterSamples（預設 texelmap＝062247 的輸入）。
```

### 16.6 probe 57 重跑結果：raw zero 定位到 NEE 層（OPUS 2026-06-09）

> 本節 OPUS 撰寫。probe 57 依 §16.5 修正（box index → second-hit 點自算 NEE weight）後重跑的決勝結果。

```
 1  做法：
    probe 57 改為在 second-hit（bounces==1）通用命中點呼叫一次 sampleStochasticLightDynamic，
    取未遮擋的 NEE 貢獻權重（luma）。GPU bake（8 spp、預設 texelmap、tile 512²＋fence）＋ readback，
    對 A1 北牆 texel 依 worldY 分段統計（row-flip 已套）。

 2  分段對照（8 spp，x 限 A1 −1.912..−1.518）：
    worldY 段     NEE weight 中位數    非零比例    平均       texel 數
    低 0–0.4       0                  18.87%     0.00031    22200
    中 1.0–1.4     0.0061             56.75%     0.0115     19278
    高 2.0–2.4     0.0078             62.29%     0.0117     19040
    （§14.10 CPU 對照：second-hit NEE weight median 0.0058）

 3  判讀：
    中／高段算得出健康非零 NEE weight（中位數 0.0061／0.0078 ≈ CPU 0.0058）
      → 排除「probe 普遍算 0」假象，並驗證 probe 量綱與 CPU 一致。
    低段「特有」塌到中位數 0、81% 為 0；同一支 probe、同樣取樣，只有低處塌
      → 不是取樣噪音（噪音會均勻影響三段，但中高段穩定健康）。

 4  結論：C 低處 raw zero 定位到 NEE（直接光取樣）這一層——
    second-hit 點的 NEE weight 結構性偏 0，中／高段正常。
    比 §14.10「卡在 GPU 第一槍之後」往前縮一層。

 5  誠實保留：
    本輪 8 spp（64 spp 因 fence 邊界 overhead 跑逾 5 分鐘未完成，放棄；分段對照已排除噪音）。
    更底層「為什麼低處 second-hit 的 NEE 會是 0」尚未答；候選：背對光的幾何項為 0／
    光源選擇偏差／PDF，皆未驗。下一支 probe 應拆 NEE weight 的組成（幾何項、pdf、選到的光源 idx）。

 6  工具狀態：
    glsl probe 57（NEE weight 版）在 working tree（checkpoint 848ba29 之上，未提交）。
```

### 16.7 NEE=0 成因拆解：second-hit 法線朝下、背對光源（OPUS 2026-06-09）

> 本節 OPUS 撰寫。probe 改輸出「NEE 組成」（幾何項、second-hit 法線朝向、NEE weight），把 §16.6 的「NEE=0」再往下釘一層。

```
 1  做法：probe 在 second-hit 點自算一次 NEE，輸出
    R=幾何項 max(0,dot(nl,光源方向))、G=法線朝向 (nl.y+1)/2、B=NEE weight；
    GPU bake 8 spp ＋ readback ＋ 低／中／高 worldY 分段。

 2  三段對照（8 spp，x 限 A1 −1.912..−1.518）：
    worldY 段    幾何項中位數  幾何項非零%   法線 nl.y         NEE weight 非零%
    低 0–0.4      0           25.2%        ≈ −1（朝下）      18.9%
    中 1.0–1.4    0.3032      76.8%        ≈ −0.5            55.7%
    高 2.0–2.4    0.2921      82.3%        ≈ −0.5            61.1%
    （NEE 非零比例與 §16.6 的 18.9／55.7／61.1 完全吻合，交叉驗證取樣一致）

 3  鏈條（已釘）：
    低處 NEE=0  ←  幾何項 = 0（中位數 0、僅 25% 非零）
               ←  second-hit 點法線朝下（nl.y≈−1）；光源（吸頂燈／軌道燈）在上方，
                  夾角 ≥ 90°，幾何項被 max(0,dot) 砍成 0。
    中／高段法線朝下偏斜（nl.y≈−0.5），幾何項 0.29–0.30 → NEE 正常。

 4  結論：C 低處 raw zero 的直接機制＝「second-hit 點法線朝下、背對在上方的光源，幾何項歸 0」。
    比 §16.6「卡在 NEE」再往下釘一層，到「幾何項」。

 5  新待釘（更底層）：為什麼低處 second-hit 法線「過半朝下」（nl.y≈−1）。
    候選：bake ray 從北牆低處射出後打到朝下的面（天花板／樑底／物體底面）、
         或 bake ray 方向系統性偏上、或 second-hit 的 nl faceforward 方向問題。

 6  與 §14.10 的張力（必須對齊，勿忽略）：
    §14.10 CPU replay 說低處 second-hit 多打 floor（box3，法線朝上 y=+1）；
    本輪 GPU probe 卻量到 second-hit 法線朝下（y=−1）。CPU 與 GPU 的 second-hit 對不上。
    → 下一支 probe 應輸出 second-hit 的 worldPos.y（實際命中高度），把 CPU／GPU 對齊。
    對齊之前：第 4 點「幾何項 0」結論成立，但「second-hit 打到哪」保留。
```

### 16.8 second-hit 命中位置與 bake ray 方向：根因往上游推（OPUS 2026-06-09）

> 本節 OPUS 撰寫。probe 改輸出 R=second-hit 命中高度、G=bake ray 彈出方向 y、B=幾何項，解 §16.7 的 CPU／GPU 張力並往上游推。

```
 1  做法：R=命中高度 x.y、G=bake ray 方向 rayDirection.y、B=幾何項。GPU bake 8 spp + readback + 分段。
    附註：reload 清資源後 bake 恢復 13.6 秒（先前 290s+timeout 是多次 bake 的 render target 累積）。

 2  三段對照（8 spp，可信）：
    worldY 段    命中高度 hitY   bake ray 方向 rayDirY   幾何項
    低 0–0.4      0（地板）       −1（純朝下）           0
    中 1.0–1.4    1.825           −0.103（略朝下）       0.304
    高 2.0–2.4    1.881           −0.085                 0.284

 3  張力解開（回應 §16.7 第 6 點）：
    低處 second-hit 命中高度 hitY=0（地板），與 §14.10 CPU「打 floor」一致 → CPU／GPU 不矛盾。

 4  新發現（往上游推一層）：
    低處 bake ray 彈出方向「純朝下」（rayDirY=−1）；中高只略朝下（≈−0.1）。
    北牆彈出的 bake ray 本該以 +z（朝房間）為主、y 分量散布；低處卻塌成純朝下，
    沿牆面朝下命中地板 → 幾何退化 → §16.7 的幾何項 0 → NEE 0。

 5  矛盾保留（誠實）：hitY=0（地板，法線該朝上 +y），但 §16.7 量到 nl.y=−1（朝下）。
    最可能：低處 bake ray 起點／方向異常，命中地板背面或牆-地接縫（法線朝下）。

 6  與 §14.10 的層次區分：§14.10 降權的是「first-hit（eye ray 命中北牆）的 worldPos／normal」（mode45/46 正常）；
    本節指「bake ray 彈出方向（second bounce）」，是不同層，§14.10 未查。
    → 根因鏈目前：raw zero ← NEE 0 ← 幾何項 0 ← 低處 bake ray 彈出方向異常朝下。

 7  下一步：彈出方向＝半球 around texel normal；查低處 texel 的 bake normal（prepared.normalDataForUpload），
    若 texel normal 異常朝下，彈出方向就朝下。
```

### 16.9 過夜調查統整：穩健結論、A＝C 同機制、方法邊界與卡點（OPUS 2026-06-09 夜）

> 本節 OPUS 撰寫。整夜 GPU probe 調查（§16.5–16.8）的統整：分清「穩健已釘」與「受方法限制保留」，並列出交 CODEX／使用者的卡點。

```
【穩健已釘（多種篩選下都成立）】
 1  C 低處 raw zero ＝ NEE（直接光取樣）相關量塌 0：NEE weight 與幾何項在 worldY<0.4 中位數 0，
    中／高段（1.0–2.4）正常（NEE weight 56–62% 非零、幾何項 0.28–0.30）。
 2  A 上緣 near-black（worldY 2.885–2.905、z 過濾後 1822 真實 texel）與 C 低處「同機制」：
    NEE／幾何項同樣塌 0。→ 修正 §16.0「A 上緣與 C 底部機制可能分流」的猜測，兩者是同一塌 0 機制。
 3  raw zero 的層級鏈：raw zero ← NEE 貢獻 0 ← 幾何項 max(0,dot)=0。已釘到「幾何項」這層。

【重要副發現】
 4  atlas 共 488136 texel，其中 233869 個是 invalid／padding：worldPos 被填成 (x, 2.9, −2.07)，
    z=−2.07 偏離北牆平面（z=−1.874），全擠在 worldY≈2.9。
    這些 invalid texel 會污染「高 worldY 篩選」，分析 A 上緣務必加 z 過濾（|z+1.874|<0.05）排除。

【受方法限制、保留（不過早下結論）】
 5  「為什麼幾何項塌 0」的物理細節（second-hit 命中哪、bake ray 朝哪、法線朝向）不可靠：
    加 z 過濾後 mid 的命中高度從 1.825 變 2.669、ray 方向 y 從 −0.1 變 +0.47；
    同批 atlas 只多一個過濾、物理量就大變 → 「worldPos ↔ atlas 的 row-flip 對應」有未解的不確定。
    對應釐清前，所有「命中位置／方向／法線」的絕對解讀保留。
 6  §16.7「nl.y≈−1」與 §16.8「hitY=0（地板該朝上）」的矛盾，源頭同上（對應不確定），一併保留。

【卡點（交 CODEX／使用者）】
 7  再往上游（為什麼 low＋A上緣 的 NEE 幾何條件塌 0）需要釐清三件 bake pipeline 的事，
    都屬 CODEX 寫的 bake，建議由 CODEX 確認或一起釐清：
    (a) worldPos buffer ↔ atlas buffer 的 texel 對應（row-flip 方向）；
    (b) bake primary ray 的設定來源（glsl 151/152 只宣告 texelValid/SurfaceNormal，主體找不到賦值點，疑在 JS 注入）；
    (c) 233869 個 invalid texel（worldPos=(x,2.9,−2.07)）的來歷，以及與 A 上緣／C 低處塌 0 是否同源。

【工具狀態】
 8  glsl probe 57（目前為「命中高度／ray方向／幾何項」版）在 working tree、未提交（checkpoint 848ba29 之上）。
    §16.5–16.8 的中間版本（NEE weight、NEE 組成）已被覆蓋，結果都記在對應小節。
 9  2026-06-10 CODEX 核對後只更新本 source.md；js／shader 皆保持交由既有工作線處理。
    probe 54／55／56 的手動 Console／URL 路徑可用；自動 helper 仍需先核對 probeLevel 上限才可用於 JSON 報告。
```
