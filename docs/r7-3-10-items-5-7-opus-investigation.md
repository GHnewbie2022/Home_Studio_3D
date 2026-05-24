# R7-3.10 餘震 items 5-7 — OPUS 獨立調查（烘焙端直讀）

claude opus 4.7 ／ 2026-05-23 ／ 使用者外出期間的平行調查

---

## 0. 這份是什麼、怎麼查的

使用者外出，要我跟 CODEX 平行查 items 5-7。我用的方法是**純 Node 直讀烘焙圖集**（`atlas-patch-000-rgba-f32.bin` ＋ `texel-metadata-patch-000-f32.bin`），不需要瀏覽器。這正是當初釘死 item 3（1008）的決定性證據之一：直接看「烘焙端」每個 texel 的 RGB／luma／alpha／metadataAlpha。

我能做的＝**烘焙端真相**（這塊 texel 烤成什麼）。我**不能**從這裡得到的＝**runtime 端**（route 交棒、bilinear 混色）與 **LIVE 對照**（純光追真值）——那半留給 CODEX 的 live 探針（規格見第 6 節）。

- 腳本：`.omc/r7-3-10-items-5-7-opus/atlas-read-items-5-7.mjs`
- 結果：`.omc/r7-3-10-items-5-7-opus/atlas-read-items-5-7-result.json`

遵循 systematic-debugging（先證據、找生成點，未定性不提修法）與 karpathy（明說假設、最小變動、別過度複雜）。

---

## 1. 一頁總結

```text
item 5 南牆窗洞/西南柱(兩條黑線):
  烘焙端已確認: 南牆 SW 柱腳印區(x<-1.76)整片 luma=0、alpha=1、metaAlpha=1
  → 近黑「有效」死角(Family A)，與已修好的 items 1/2/4 同型。
  生成點: 南牆 metadata 沒遮 SW 柱腳印 → 烤成 alpha=1 的純黑，bilinear 滲到可見邊=黑線。
  信心: 高(「垂直南牆」那條)。第二條「垂直桌面」需 live(疑桌面遮擋/窗 reveal 邊界)。

item 6 西牆/北牆/地板角(地板色污染):
  烘焙端修正了假設: 西牆「整面」就是暖色 chroma≈{0.43,0.33,0.24}，跟地板{0.44,0.325,0.235}幾乎一樣;
  NW 角落 chroma{0.40,0.335,0.26} 其實比牆正常色「更中性」，不是更偏地板。角落只是略暗(luma 0.22 vs 牆 0.28-0.33)。
  → 「地板色污染」不被 chroma 證據支持;比較像「牆與地板同暖色系 + 角落 AO 變暗」被誤認為污染。
  生成點: 待定。可能(a)正確 AO+GI(非 bug)、或(b)牆底邊 gutter/取樣 artifact。必須對 LIVE 才能分。
  信心: 中。明確的是「不是 Family C 那種異色污染、也不是 alpha 問題」;是不是 bug 由 LIVE 決定。

item 7 北牆/東牆 90度角(細線):
  烘焙端已確認: 角落 y=2.45，北牆緣 luma≈0.15 vs 東牆緣 luma≈0.18，兩者皆 alpha=1、chroma 一致(無錯色)。
  → wall/wall 值不連續 seam(印證我 §9.5)，非錯色(Family C)、非死角(Family A)。
  生成點: 兩面牆各自 chart 在 90 度角的值有 ~0.03 luma 落差;凹角在光追下應是平滑 AO 漸層。
  信心: 中高(是 seam 類)。是「先天接縫」還是「可消除的烤值不連續」由 LIVE 決定。
```

修法家族對照（沿用本專案既有分類）：

```text
Family A 死角(alpha=1 近黑) → 遮(alpha=0)。已驗證: items 1/2/4。 → item 5 主線屬此。
Family B/seam 可見交界值不連續 → 值連續/stitching，不是遮、不是補色。 → item 7 屬此。
Family C 有效但錯色(跨面滲異色) → gutter/UV/邊界歸屬。 → item 6 原本假設此，但被我證據弱化。
```

---

## 2. item 5：南牆窗洞／西南柱（兩條細黑線）

使用者視角 `position (-1.665, 1.110, 3.009)`，朝南(+Z)。

南牆烘焙圖（`south-wall-window-hole-1024px-1000spp`）沿 x 掃描（luma／alpha／metaAlpha）：

```text
y=0.8(窗下):  x∈[-2.00,-1.76] 全 = 0/1/1(近黑·有效·valid)，x≥-1.74 = 0.41~0.47/1/1(正常亮牆)。
              → 在 x≈-1.75 出現「純黑↔亮牆」銳利邊界。
y=1.5(窗高):  x∈[-2.00,-1.76]=0/1/1(黑·有效);  x∈[-1.74,-1.70]=0/0/0(窗洞遮罩);
              x∈[-1.68,-1.52]=0.22~0.28/1/1(左 reveal 有效);  x≤-1.50=0/0/0(窗洞遮罩)。
y=2.2:        同 y=1.5 結構。
```

判讀：

```text
1. x<-1.76 的整片 luma=0 但 alpha=1、metaAlpha=1 → 這是「南牆被西南柱(+SW 牆角)遮住」的死角，
   烤成純黑卻標成有效。可見邊界的 bilinear 把這片純黑混進來 = 使用者看到的「垂直南牆」黑線。
   這是 Family A，和已修好的 items 1/2/4 完全同型(柱後死角未遮)。
2. 生成點明確: buildR7310C1SouthWallTexelMetadata 只遮窗洞(window hole)，沒遮 SW/SE 柱腳印 →
   柱後死角 isValid=true → 烤 alpha=1 純黑。
3. 對照已修家族: items 1/2/4 是在「牆 patch」把柱後/樑後死角 return false(alpha=0)。
   南牆同樣要把 SW(以及 SE)柱腳印區判為無效。這就是 §29 B 案的同一招，套到南牆。
4. 第二條「垂直桌面」線: 烘焙圖看不全(桌子是家具、不在牆 atlas)。疑似桌面遮擋窗下牆/或左 reveal↔窗玻璃
   邊界。需 live 沿該線掃描定 surface pair。
```

> 注意：item 4（東南柱／南牆）CODEX 報「已正常」，但南牆 metadata 同樣沒遮 SE 柱腳印。要嘛 item 4 是
> 「角度看不到」而非真修好、要嘛另有 south-wall-ac-shadow patch 處理東南側。CODEX 套南牆遮蔽時請順帶
> 確認 SE 側狀態，避免「以為好了其實只是沒看到」（這是本專案吃過的虧）。

---

## 3. item 6：西牆／北牆／地板角（疑地板色污染）— 我修正了假設

使用者視角 `position (-1.849, 0.052, -1.821)`，朝西(-X)，貼近西北底角。

西牆烘焙圖（`west-wall-iron-door-hole`）西北底角逐 y、＋西牆正常色、＋地板色：

```text
西牆 NW 角(z=-1.874):  y=0.02 luma0.2225 a1 metaA1 chroma{0.404,0.335,0.260}
                       y=0.05 luma0.2352 a1 metaA1 chroma{0.405,0.336,0.259}
                       y≥0.10 = 0/0/0 (鐵門洞遮罩 y≥0.09)
西牆「正常色」(門洞以南 z=-0.5/0.5/1.5、各高度): luma 0.27~0.33, chroma≈{0.43,0.33,0.24}
地板色(NW角/中央/西側): luma 0.24~0.43, chroma≈{0.44,0.325,0.235}
```

判讀（這推翻了原本「Family C 地板污染」的直覺）：

```text
1. 西牆「整面」本來就是暖色 chroma≈{0.43,0.33,0.24}，跟地板{0.44,0.325,0.235}幾乎同色系。
2. NW 角落 chroma{0.40,0.335,0.26} 其實比西牆正常色「更中性一點」(r 更低、b 更高)，並沒有更偏地板。
   → 「角落被地板色污染」這個 chroma 上的證據「不成立」。
3. 角落確實「略暗」(luma 0.22 vs 牆正常 0.28-0.33)。這跟「凹角 AO 變暗 + 地板暖反射」的物理是一致的。
4. 因此 item 6 最可能是兩種之一，必須對 LIVE 才能分:
     (a) 正確 GI: 牆與地板同暖色系 + 角落 AO 變暗 → 使用者把「牆像地板」誤認成污染，其實是真值。
     (b) 烘焙 artifact: 牆底邊(y≈0)取樣/gutter 把地板值吃進牆角 → 才是 bug。
   能先排除的: 不是 alpha 問題(角落 alpha=1 metaA=1)、也不是「異色」污染(chroma 沒偏向地板)。
5. 修法分流: (a)→根本不用修(是真值);(b)→ gutter/邊界歸屬/ray origin，非 alpha=0、非補色。
```

> 這是 systematic-debugging 的價值：差點順著「地板污染」確認 Family C，但補讀「西牆正常色」參考後發現
> 牆本來就跟地板同暖色，污染假設被弱化。**先別把 item 6 當錯色 bug 修**，先用 LIVE 確認它到底是不是 bug。

---

## 4. item 7：北牆／東牆 90 度交界（細線）

使用者視角 `position (1.879, 2.450, -1.853)`，朝上(+Y)，貼近東北上角。

北牆（`north-wall-door-hole`）東緣 vs 東牆（`east-wall`）北緣，沿 y：

```text
            北牆東緣(x→1.91)            東牆北緣(z→-1.874)
y=1.5:      luma≈0.25  chroma{0.40,0.344,0.255}   luma≈0.28  chroma{0.40,0.343,0.260}
y=2.0:      luma≈0.21  chroma{0.41,0.34,0.25}     luma≈0.24  chroma{0.40,0.343,0.257}
y=2.45:     luma≈0.15  chroma{0.42,0.34,0.243}    luma≈0.18  chroma{0.40,0.343,0.255}
y≥2.7:      北牆=0/a1(近黑有效)          東牆=0/a0(beam handoff 遮罩)
```

判讀：

```text
1. 在使用者線位置 y≈2.45: 北牆 luma≈0.15、東牆 luma≈0.18，差 ~0.03;兩者都 alpha=1、chroma 一致(無錯色)。
   → 兩面全牆在 90 度凹角各自 chart 的烤值有小落差 = wall/wall 值不連續 seam(印證 §9.5)。
2. 排除: 非 Family A(兩面在該高度都 valid、非近黑死角);非 Family C(chroma 一致、無異色)。
3. 兩面 luma 從 y=1.5 到 2.45 都遞減(0.25→0.15 / 0.28→0.18)，是往天花板/樑變暗的合理趨勢;
   問題只在「兩面在交界線上各自的值對不齊」那 ~0.03 落差。
4. 一個附帶觀察: 北牆 y≥2.7(近天花板)有「luma=0 但 alpha=1」的近黑有效區(東牆該處是 alpha=0 遮罩)。
   這在使用者線(y≈2.45)之上，但若之後鏡頭往上，北牆頂緣可能也有 Family A 風險，順手記著。
5. 修法分流(待 LIVE): LIVE 在凹角是平滑漸層 → bake 的 0.15|0.18 落差是可消除的烤值不連續(查兩牆
   交界取樣/解析度/stitching);LIVE 本身就有階梯 → 屬先天接縫(§25)，只能 padding/解析度緩解。
   兩條都不是 alpha=0、不是補色。
```

---

## 5. 我想說的話（策略與框架）

```text
1. 三項分屬三個不同家族，修法各異，千萬別用同一招套:
     item 5 = Family A 死角 → 遮(alpha=0)，沿用已驗證的 §29/§42 B 案 + 自動 sync。最有把握。
     item 6 = 可能根本不是 bug(真 GI) → 先用 LIVE 證明它是不是 bug，再決定要不要修。最該「先別動手」。
     item 7 = 值不連續 seam → 值連續/stitching 或接受先天接縫緩解。不是遮、不是補色。
2. item 5 是「同型 bug 再現」: 南牆 metadata 漏遮柱腳印，跟 1008 漏在 mask 名單外同樣是「手動列舉漏項」。
   建議修 item 5 時，順手把「牆 patch 是否該遮所有柱/樑腳印」做成可檢核的規則，別再一個一個補(呼應 §42 的
   架構批評: 手動名單脆弱)。
3. item 6 是這輪最該守紀律的: 使用者用「污染」描述，但烘焙端 chroma 證據顯示牆本來就跟地板同暖色。
   若沒對 LIVE 就去「修地板污染」，極可能是把正確的 GI 改錯(治標反成製造 bug)。先量、先對 LIVE。
4. 全程不補色、不 cross-fade — 跟前面 12 節的共識一致。item 5 走遮、item 7 走值連續、item 6 待定性。
5. 我只做了烘焙端;runtime/LIVE 那半(route 交棒、bilinear、純光追真值)請 CODEX 用既有 live 探針補(第 6 節)。
   兩邊資料疊起來就能像 item 3 那樣收斂。
```

---

## 6. 給 CODEX 的 LIVE 探針規格（我沒做的那半）

```text
共通: 全烘焙同開(allOn) + 同點 LIVE(關烘焙純光追) + 每點記 routeId/targetId/coverage(alpha,weightSum)/
      RGB/luma/world/normal。沿用 §35/§40 的 1D 掃線 harness。

item 5(兩條線各掃一條):
  相機 position(-1.665,1.110,3.009) 朝南。
  線A(垂直南牆): 跨 x≈-1.75 橫掃(我已知南牆 x<-1.76 烤成 alpha1 純黑) → 確認可見黑線像素是這片死角的
                bilinear bleed;同點 LIVE 應為「暗但非純 0」→ 證明 bake 的純 0 是 artifact → 套南牆遮蔽。
  線B(垂直桌面): 沿使用者第二條線掃 → 定 surface pair(南牆/左 reveal/窗玻璃/桌面 哪兩個)，再分類。

item 6(定 bug vs 真 GI — 最關鍵):
  相機 position(-1.849,0.052,-1.821) 朝西。沿西牆底邊(y 0→0.3)在 NW 角附近掃。
  每點比 allOn vs LIVE 的 RGB/chroma:
    allOn 與 LIVE 一致 → 是正確 AO+GI，item 6 不是 bug，結案(不修)。
    allOn 比 LIVE 更偏地板色/更暗 → 牆底邊取樣 artifact → 查 gutter/ray origin/邊界歸屬(非 alpha=0)。

item 7(定 seam artifact vs 先天):
  相機 position(1.879,2.450,-1.853) 朝上。跨北牆/東牆 90 度線橫掃。
  比 allOn 的北牆側 vs 東牆側 luma 落差，對同點 LIVE:
    LIVE 平滑無階梯 → bake 值不連續(可消除) → 查兩牆交界取樣/解析度/stitching。
    LIVE 本身有階梯 → 先天接縫 → padding/解析度緩解。
  另記: 確認此線是否就是兩 chart 交棒線(routeId 在線兩側不同)。
```

---

## 7. 證據檔案

```text
.omc/r7-3-10-items-5-7-opus/atlas-read-items-5-7.mjs        (直讀腳本)
.omc/r7-3-10-items-5-7-opus/atlas-read-items-5-7-result.json (完整數據)
程式碼依據:
  buildR7310C1SouthWallTexelMetadata  js/InitCommon.js:4817 (只遮窗洞、未遮柱腳印 → item 5 生成點)
  buildR7310C1WestWallTexelMetadata   js/InitCommon.js:4780 (item 6 西牆)
  buildR7310C1NorthWallTexelMetadata  js/InitCommon.js:4678 (item 7 北牆)
  buildR7310C1EastWallTexelMetadata   js/InitCommon.js:4713 (item 7 東牆 + handoff 遮罩)
  world-bounds 常數                    js/InitCommon.js:1309-1412
```
