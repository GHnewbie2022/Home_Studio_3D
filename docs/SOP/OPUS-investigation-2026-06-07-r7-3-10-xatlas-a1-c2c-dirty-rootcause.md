# OPUS 調查報告：R7-3.10 xatlas A1 C2C 北牆破圖根因

- 日期：2026-06-07
- 作者：OPUS（唯讀調查，未改任何 source、未產生任何診斷工具，避免與 CODEX 同時寫檔衝突）
- 對象：CODEX
- 任務來源：xatlas A1 C2C 破圖（木門西側北牆變髒，黑線已消失）
- 驗收網址：`http://localhost:9019/Home_Studio.html?nonSquarePackage=d800-north-denoise-c&xatlasPackage=a1-c2c-smoke`
- 調查方式：systematic-debugging Phase 1（先根因、不先修），全程讀碼＋讀既有 package 報告，未跑新工具
- 內部技術文件，保留 alpha / RGB / UV / SPP / NEE 等縮寫

名詞對照（給非工程背景讀者）：
- bake：事先把光線計算結果「烤」進一張貼圖
- texel：貼圖上的一個格子
- normal（法線）：表面朝外的方向
- alpha（透明度通道）：1＝這格要顯示、0＝透明讓底下露出
- RGB／luma：這格烤進去的顏色／亮度
- fallback：取樣失敗時退回的備援來源
- frontFraction（正面比例）：探針射線打到開放空間或正面的比例

---

## 結論摘要（一句話）

可見的黑／髒不是射線方向造成的；它由「runtime 混合規則」加上「alpha 與亮度兩個決策解耦」共同造成。`rayDirection=-normal` 已被程式碼反證為非根因，故原 deliverable 5 的前提不成立。

---

## 一、射線方向不是根因（反證 CODEX 假設 A）

`js/PathTracingCommon.js` 同時存在兩條 bake 射線，逐字比對：

```
xatlas bake（這次破圖）          3319  rayOrigin    = r7310XatlasWorldPos.xyz + r7310XatlasNormal * (uEPS_intersect * 8.0)
                                 3320  rayDirection = -r7310XatlasNormal
舊 per-surface bake（D800，乾淨） 3340  rayOrigin    = r738BakePoint + r738BakeNormal * (uEPS_intersect * 8.0)
                                 3341  rayDirection = -r738BakeNormal
```

兩條公式完全相同。使用者裁定「乾淨參考」的 D800 用的就是 `rayDirection=-normal`。若這條會把北牆射線打進牆內致黑，D800 也會一起黑。

補強證據：`docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike/xatlas-bake-texelmap.json` 記載北牆面 tri10／tri11 的 rawNormal 與 bakeNormal 都是 `[0,0,1]`（指入房間）。北牆在 z=-1.874=ROOM_MIN_Z，`bake_normal_from_metadata` 的 room-inward 政策回傳 `[0,0,1]` 正確；射線起點落在牆前的房間側、方向打回牆面，幾何正確。

```
判定：rayDirection=-normal 為非根因。
風險警告：此條 bake 路徑為全 23 面共用，若改動會同時破壞現在乾淨的 D800 與其餘各面。
```

這是「現在是這條 bake 射線的設計」的事實，採用「在表面前方架虛擬相機、沿 -normal 打回表面、重用既有著色」屬正規作法，與 D800 一致。

---

## 二、可見「黑／髒」如何上螢幕（已由程式碼證實）

關鍵在 runtime 混合規則，`shaders/Home_Studio_Fragment.glsl` 兩處結構一致：
- 短路路徑 `r7310C1FullRoomDiffuseShortCircuit`：3179-3202
- 主算圖路徑：6596-6601

決策流程：

```
北牆某像素：
  1. 命中 A1 北牆範圍 → 由 r7310C1XatlasA1NorthWallUv 算出 atlas UV
  2. r7310C1XatlasRuntimeSampleValidLinear 取樣（1176-1204）：
       四個鄰格只要任一 alpha>0.5 → 回 true，吐出「依 alpha 加權的 RGB」
       四格全 alpha=0          → 回 false
  3. 回 true  → 直接採用 xatlas 的 RGB 並 return／break，跳過 D800 fallback
     回 false → 落到 3190-3202 的 D800 北牆 fallback（乾淨那條）
```

致命點在第 3 步：取樣回 true 時直接採用該格 RGB，**即使 RGB＝0**。所以一個「alpha=1 但 RGB=0」的格子（可顯示的黑洞）會讓牆面該點顯示純黑，且因為回了 true，**不會退回乾淨的 D800**。

這同時解釋使用者觀察到的兩件事：

```
黑線消失：接觸邊 texel 被判 alpha=0 → 退回 D800 → 黑線沒了（C2C 的戰果）
牆面變髒：另一批 alpha=1 但 RGB=0 的 texel → 被 xatlas 認領、顯示黑、且不退回 D800 → 髒
```

---

## 三、為何存在 alpha=1 卻 RGB=0 的黑洞（已證實：兩個決策解耦）

`docs/tools/r7-3-10-c2c-validity-mask.py` 顯示 alpha 的決定方式：

```
alpha 只看幾何：用 rawNormal 射 64 條 fib 半球射線，對房間 88 個 box 做 ray-vs-AABB，
               算 frontFraction（打到開放空間或正面的比例），≥0.5 即 alpha=1。
               完全不看該格 bake 出來的亮度（程式碼第 230-235 行）。
RGB  看 path tracer 烤出來的 indirect diffuse radiance。
```

兩個決策來自三套不同幾何表述：
- alpha：88-box（`contact-edge-source.json`）＋ rawNormal
- RGB：live 場景 ＋ bakeNormal
- runtime UV：spike mesh 的硬寫 4 角雙線性

三者獨立，所以「幾何上朝開放空間（alpha=1）」與「實際烤出 0 亮度（RGB=0）」可同時成立，現行 C2C contract 攔不住。這即 CODEX 證據 5 抓到的 contract 漏洞，方向正確。

---

## 四、「那些 valid 牆面 texel 為何烤成恰好 0」尚未從讀碼釘死，需空間圖

讀碼已能排除的：

```
已排除：worldPos 與 normal 兩張貼圖錯位
        InitCommon.js 5592-5605：worldpos.bin → bake-atlas slot、normal.bin → fullroom slot，
        且 5595-5597 兩者同步翻轉（flipR7310C1XatlasRgba32fRows）後上傳，彼此對齊；
        shader 用 texelFetch 整數讀取，無 flipY 影響。
已排除：bake gate 與 validity mask 的 valid 集合不一致
        bake gate（PathTracingCommon.js 3316）與 mask（c2c-validity-mask.py 196-203）
        都綁同一份 texelmap valid，集合相同；故「gate 失敗→相機射線→黑」不會被 mask 判 alpha=1。
已排除：射線方向／法線方向錯誤（北牆 bakeNormal=[0,0,1] 正確）
```

剩下三個候選假設，需「黑洞的世界座標空間分佈」才能分辨（即 CODEX 診斷工具該產出的）：

```
H-a  spike mesh 的 worldPos 與 live 場景實際牆面有微小落差，
     在門框／西梁／box 邊緣附近，射線打到錯的或被遮的幾何 → 烤成 0
     特徵：黑洞聚集在特定世界區域（貼著門框、樑、box 接縫）
     若成立，根治法＝xatlas worldPos 改用「對 live 場景命中」的點（與 per-surface 同源）

H-b  bake 只取 indirect diffuse（diffuseOnly + 之後才補直接光），
     某些被遮凹角的間接光本就趨近 0，但 validity mask 仍判 alpha=1
     特徵：黑洞聚集在幾何凹角／遮蔽袋

H-c  runtime「整個 A1 範圍共用一組硬寫 4 角雙線性 UV」跨到鄰近 chart／cap，取到不相干的 alpha=1 格
     特徵：黑洞沿對角線（y01≈x01）或頂端 cap 區成帶狀
```

判別方式（不需新寫工具，shader 已內建診斷探針）：

```
設定 uniform：在瀏覽器 console 設 pathTracingUniforms.uR7310C1RuntimeProbeMode.value = 55 或 56
probe mode 55（glsl 6577-6580）：tri10／tri11／tri20／tri21 各一色 → CODEX 要的 triId 圖
probe mode 56（glsl 6581-6593）：
  藍（0,0.2,1）= 該牆面像素取到的最近格 alpha≤0.5（本就該退 D800）
  紅（1,0,0）  = alpha=1 但 luma<1e-5（這就是黑洞，問題候選）
  綠          = alpha=1 且有亮度（正常）
```

紅色像素的空間落點直接判定 H-a／H-b／H-c。

---

## 五、triId 對照（修正 CODEX 編號的部分誤導）

依 `xatlas-bake-texelmap.json` 與 `xatlas-c2c-alpha-report.json`：

```
tri10 / tri11  = 北牆可見面（surfaceHint=north_wall），bakeNormal [0,0,1]   ← CODEX 指認正確
               alpha report 平均亮度 0.2109 / 0.2007（與 D800 同級，平均健康）
               內含 alpha=1-黑洞的散布子集（CODEX 報的 25.33% / 16.98% 就在這裡）
tri20 / tri21  = 西梁 cap（west_beam_cap），validity 0% / 2.44% → 幾乎整片 alpha=0
               使用者說的「頂端兩塊三角形拼成的方形」最可能就是這塊 cap（alpha=0 區）
tri8 / tri9    = 各約 22000 格、alpha=1、亮度≈0 的大片黑 → 推測為 box 朝室外的面（誤導項）
               runtime 只取 A1 室內範圍，正常不會顯示它們；除非 H-c 的 UV 溢出取到
```

修正幅度很小：tri10／tri11 確實是該查的牆面，但其「平均」健康，要查的是它們內部那批 alpha=1-黑洞，不必去追 tri8／tri9 的大片黑。

證據（`xatlas-c2c-alpha-report.json` perTriangle 摘錄）：

```
tri  texels  alphaOne  alphaZero  lumaAlphaOneMean
10   22990   22989     1          0.2109
11   22988   21737     1251       0.2007
12   36422    9163    27259       0
14   36422   36422        0       0.1636
15   36420   36420        0       0.1663
16   14664   14663        1       0.0181
17   15608   15576       32       0.0037
20    1196       0     1196       null
21    1268      31     1237       0
```

---

## 六、xatlas bake 與 per-surface bake 差異表

```
項目            xatlas bake（破圖）              per-surface bake（D800，乾淨）
射線公式        origin=pos+normal*8eps           origin=pos+normal*8eps      ← 相同
                dir=-normal                      dir=-normal                  ← 相同
worldPos 來源   預先光柵化的 atlas 貼圖           當場對 live 場景射線命中
                （spike mesh 頂點重心內插）        （保證落在 live 表面）
normal 來源     bakeNormal（room-inward 政策）    live 幾何法線
gate 失敗時     退回「預設相機射線」(latent)       有 bakePointFound 把關
alpha 與 RGB    alpha 由另一套幾何(88-box)決定，   同屬一條路徑，較難解耦
                與 RGB 解耦
```

核心差異：per-surface 的 worldPos／normal 與「射線要打的場景」是同一套，必然一致；xatlas 的 worldPos／normal／alpha 來自三套不同表述，任一處對不齊就可能落出 alpha=1-黑洞。

---

## 七、修法建議（優先序）

```
最即時、零重烤（直接打掉可見黑）：
  在 runtime 取樣端把「alpha=1 但加權 luma<eps」也視為無效 → 回 false → 落回乾淨 D800。
  改一處：r7310C1XatlasRuntimeSampleValidLinear（glsl 1192-1196）回 true 前，
          多一條 weighted-luma>eps 檢查。
  理由：直接針對已證實的可見機制，不論 RGB=0 內部原因是 H-a/b/c 哪個都能止血；
        D800 fallback 本來就乾淨、現成。
  風險：eps 取值要保守（建議 1e-5 量級），避免把正常的暗部（凹角真實低光）也誤判退回。

durable（CODEX 已起手，方向正確）：
  C2C alpha policy 不得對「geometry-visible 但烤出 0」的格直接給 alpha=1；
  先標 fillable／alpha=0，補不到就維持 alpha=0 退回舊路徑。
  contract 補 alphaOneExactBlackTexels=0 硬規則（CODEX 已列）。

待空間圖確認後再定案：
  RGB=0 內部根因（H-a/b/c）要等 probe mode 56 的紅色落點判定。
  若是 H-a（worldPos 落差），真正根治＝xatlas worldPos 改用「對 live 場景命中」的點，
  而不是只靠 alpha 遮蓋。

不建議：
  改 rayDirection=-normal 或改半球取樣（第一節已反證為非根因，且動全 23 面共用路徑，風險高）。
```

關於點 E：同意，這不是 SPP 問題。exact-zero 是「alpha 與亮度解耦＋bake 輸入來源」的結構性結果，1000 SPP 與 10000 SPP 都會留下同樣的黑洞。C1 維持乾淨參考。

---

## 八、五個 deliverable 現況

```
1. triId 診斷圖        → shader 已內建 probe mode 55，設 uniform 即可出，不必新寫工具
2. alpha=1 exact-black 統計 → 需 bin 解析，等 CODEX 工具產出後由 OPUS 判讀（OPUS 不寫工具）
3. bake 射線差異表     → 已完成（本報告第六節）
4. 新舊 package 拉遠對比 → 需修法後重算圖才有意義（現在拍只會再拍到同一批黑洞）
5. -normal 最小修法    → 前提不成立（第一節），改提第七節的 runtime guard + C2C policy
```

---

## 九、證據出處索引

```
PathTracingCommon.js 3296-3344    兩條 bake 射線（xatlas 與 per-surface）
PathTracingCommon.js 3304-3324    xatlas bake gate（worldPos.w / normal.w / normalLen）
InitCommon.js        2215-2242    r7310C1XatlasA1NorthWallUvFromWorldPosition（runtime UV 硬寫 4 角）
InitCommon.js        5539-5638    prepareR7310C1XatlasBakeTextures（兩張貼圖來源與翻轉）
InitCommon.js        5546-5571    buildR7310C1XatlasBakeTexelMetadata（isValid 條件）
Home_Studio_Fragment.glsl 1176-1204   r7310C1XatlasRuntimeSampleValidLinear（取樣與 valid 回傳）
Home_Studio_Fragment.glsl 1207-1252   A1 北牆 UV / triId / 探針色
Home_Studio_Fragment.glsl 3179-3202   短路路徑混合點（xatlas 勝出則跳過 D800）
Home_Studio_Fragment.glsl 6567-6601   probe mode 55/56 與主算圖混合點
docs/tools/r7-3-10-xatlas-bake-texelmap.py        texelmap 與 bake_normal_from_metadata（room-inward）
docs/tools/r7-3-10-c2c-validity-mask.py 88-258    alpha 由 frontFraction 決定、與 RGB 解耦
.../xatlas-bake-spike/xatlas-bake-texelmap.json   a1 triangle ids 與 perTriangle bakeNormal
.../20260607-023242/xatlas-c2c-alpha-report.json  perTriangle alphaOne/Zero/lumaMean
.../xatlas-bake-spike/...validity-mask-fixed-openair-thr05-report.json  tri10/11/20/21 frontFraction
```
