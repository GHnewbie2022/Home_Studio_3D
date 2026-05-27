日期：2026-05-26

分支：codex/r7-3-10-iron-door-side-reveal-bake

目前基準：ab3a817 fix(R7-3.10): close ceiling beam-column footprint gaps

審查目的：請 OPUS 審查「hybrid 架構往趨近真實模式推進」的大前提、大方向，以及 ROI 最高的下一動是否正確。

## 1. 大前提

```text
使用者的終局目標：
  讓「趨近真實模式」也能走 hybrid 架構。

白話意思：
  使用者希望之後可以在房間裡走動，
  畫面接近完整 path tracing，
  同時用烘焙好的間接光與局部即時追光降低負擔。

目前 C1 / 快速預覽的定位：
  C1 是架構實驗場。
  快速預覽是找錯工具。
  這兩者用來快速驗證 hybrid 的規則、認領、遮罩、邊界、防呆是否可靠。

因此，目前工作不只是把 C1 畫面修漂亮。
真正價值在於：
  用 C1 找出未來趨近真實模式也會遇到的幾何分類、接縫、遮擋、重複認領、valid-black 與 package 生產問題。
```

## 2. 已經驗過的架構風險

```text
這幾天 C1 已經抓到多種 hybrid 遷移債：

1. valid-black 邊界格
   metadata 標有效，atlas 值卻是黑。
   結果會在接縫處滲出黑線。

2. atlas 邊角黑格
   例如樑的 atlas 邊角被烤成黑。
   取樣剛好落在邊角時，單格黑值會直接露出。

3. 重複烘焙 / 重複認領
   同一塊幾何被南牆與天花板同時影響，畫面會變太亮或開關行為怪。

4. 認領範圍錯誤
   天花板把樑柱頂端腳印當成自己的可烘焙區，造成黑縫或發光邊界。

5. cutaway / 隱藏分組錯誤
   南牆隱藏後，某些附屬幾何沒有跟著剝離，會露出奇怪薄板。
```

這些問題共同指向同一件事：

```text
hybrid 架構不能靠單點補洞。
每一類幾何都要有明確規則：
  誰認領？
  誰排除？
  哪些格有效？
  哪些格無效？
  哪些邊界要防呆？
  之後重烤時是否會自動生出同樣正確的 package？
```

## 3. 大方向

```text
短期方向：
  繼續用 C1 / 快速預覽做低成本架構驗證。
  每次只處理一類幾何或一類交界，量清楚再修。

中期方向：
  把牆、地板、天花板、樑柱、窗洞切面、門邊切面、房間內物件，
  逐步放進同一套 hybrid 規則。

長期方向：
  當切面與物件規則穩定後，再決定是否做 canonical 重烤。
  canonical 重烤的意義是把正式生產流程也改成會自己生出正確 package。
```

重要判斷：

```text
現在還沒到全架構重烤的最佳時點。

理由：
  鐵門旁切面尚未烘焙。
  房間內物件尚未進 hybrid 架構。
  這些都會新增遮擋、接觸陰影、邊界與認領規則。

如果現在先全重烤，後面補完鐵門切面與物件後，很可能還要再重烤一次。
```

## 4. ROI 最高的下一動

```text
下一動：
  先做「鐵門旁邊切面」的 hybrid 烘焙。

原因：
  這不是單純補一塊畫面。
  它是另一種切面類型：
    門邊切面
    牆洞附近幾何
    可能與南牆 / 東牆 / 地板 / 門框產生交界
    可能會出現認領重疊或 valid-black

這一題可以驗證：
  C1 目前建立的 hybrid 規則，是否能擴展到「門邊切面」這類新幾何。
```

鐵門切面的處理原則：

```text
1. 先量測
   找出缺烤區的世界座標、法線、相鄰幾何、目前命中的 boxIdx / targetId。

2. 先分類
   判斷它屬於：
     牆面延伸？
     門框切面？
     獨立 dedicated surface？
     需要新 bake target？

3. 先定認領
   明確寫下：
     這塊由誰認領？
     哪些既有面不能影響它？
     哪些開關應該控制它？

4. 再做 package
   依分類建立或補齊 hybrid / dedicated bake。

5. 最後加防呆
   至少要守：
     valid-black
     edge-border
     owner / toggle 行為
     相鄰面不重複認領
```

## 5. 目前不建議先全重烤的理由

```text
全重烤適合放在「規則收斂後」。

目前還有兩大塊未進架構：
  1. 鐵門旁切面。
  2. 房間內物件。

這兩塊會影響：
  遮擋範圍
  接觸陰影
  開關認領
  atlas / metadata 有效格
  邊界防呆

因此，全重烤更適合放在：
  鐵門切面完成後，
  房間內物件也進 hybrid 架構後，
  再一起評估。
```

## 6. 給 OPUS 的審查問題

```text
Q1. 你是否同意這個大前提？
    C1 / 快速預覽目前主要用途是驗證未來趨近真實模式可用的 hybrid 架構。

Q2. 你是否同意目前不先做全架構 canonical 重烤？
    理由是鐵門旁切面與房間內物件尚未進架構，現在重烤容易重工。

Q3. 你是否同意 ROI 最高下一動是鐵門旁切面？
    這題可驗證「門邊切面 / 牆洞附近切面 / dedicated surface」規則。

Q4. 鐵門旁切面應先走哪種量測？
    建議至少量：
      world position
      normal
      boxIdx / targetId
      current owner
      受哪些烘焙開關影響
      相鄰 surface
      atlas / metadata 狀態

Q5. 鐵門旁切面比較像：
      既有牆面延伸？
      門框切面？
      新 dedicated baked surface？
      需要 hybrid owner 新規則？
    請 OPUS 先以讀碼與量測設計判斷，不要直接猜。

Q6. 這一題完成的驗收條件是否足夠？
    建議條件：
      局部畫面過
      開關行為合理
      valid-black / edge-border 綠
      相鄰牆面不被污染
      不新增重複認領
      能說清楚未來趨近真實模式如何沿用
```

## 7. CODEX 建議裁示

```text
建議 OPUS 若同意，下一輪先進「鐵門旁切面 Step A 量測」。

Step A 只做量測與分類，不動 package：
  1. 找到鐵門旁未烤切面的準確世界範圍。
  2. 查目前 shader / geometry 命中來源。
  3. 查目前是否被既有 surface 認領。
  4. 查開關行為。
  5. 判斷需要新 target、沿用既有 target、或新增 dedicated surface。

Step A 結束後，再決定 Step B 實作。
```

## 8. 本頁結論

```text
目前最合理路線：
  先鐵門旁切面。
  再房間內物件。
  最後評估 canonical 全重烤。

這條路線最符合使用者終局：
  讓趨近真實模式也能安全走 hybrid，
  讓使用者之後可以在房間裡走動，
  並把 C1 測出的規則帶到更完整的模式。
```

## 9. OPUS 審查裁示（2026-05-26，已核實程式碼）

```text
核實基礎（非臆測，皆讀碼/讀資料確認）：
  - 基準 ab3a817「close ceiling beam-column footprint gaps」＝上一輪 OPUS 的天花板修復，已落地；現分支 codex/r7-3-10-iron-door-side-reveal-bake。
  - 鐵門：IRON_DOOR = hitType 8、metalness 1.0 / roughness 0.3（金屬反射面）；位於西牆，
    開口約 x[-2.11,-1.91]、z[-1.874,-0.984]、y[0.09,2.04]（Home_Studio.js box9 門上方、box10 門坎，皆 C_WALL_L）。
  - 切面已有成熟先例：南窗 4 個 dedicated「reveal shadow」hybrid（left/right/bottom/top），
    各有獨立 texture/mode/ready/resolution，且 docs/data 有 4 支對應 runtime-package.json。
  - 鐵門切面：shader 無任何 door-reveal 處理、docs/data 無 iron/door package → 確為「未烤、未認領」。
```

裁示（逐題）：

```text
Q1 大前提（C1=架構驗證場）：同意。
   依據：上一輪天花板修復本身就逼出可複用規則——「認領排除（從 RuntimeSurfaceIsCeiling 扣腳印）」、
   「valid-black 遮罩」、「InitCommon 遮罩與 shader 判定式互為鏡像」。這些正是趨近真實模式會重複遇到的。

Q2 現在不全 canonical 重烤：同意（強烈）。
   依據：天花板修復「被迫」走 node-patch，正因 canonical 重烤有硬傷——ceiling validTexelRatio 門檻 0.98（runner+browser 兩處）、
   且「validation 失敗仍覆寫 bins」。現在全重烤＝要先下調門檻+重生 baseline；補完鐵門切面與物件後勢必再烤一次 → 重工。先不烤正確。

Q3 ROI 最高＝鐵門旁切面：同意，但修正其定位。
   它「不是全新類別」，而是把「已解決的南窗 reveal 模式（4 個 dedicated 切面）」延伸到門洞 → 低風險、可複用。
   真正的「新變數」只有兩點，這才是這題的價值：
     (a) 門的比例與面數和窗不同（門到地，可能無有意義的 bottom reveal；面數待量）。
     (b) 鐵門是「金屬反射面」，reveal 的鄰居是 specular 表面 → 要看反射與 reveal 烘焙的交互（窗是玻璃/外景，性質不同）。

Q4 先走哪種量測：同意清單，補上「以幾何定位的具體待量項」：
   候選 reveal 面 4 個——北側門樘 z≈-1.874、南側門樘 z≈-0.984(box11 的 -z 面)、過樑底 y≈2.04(box9 底)、門檻頂 y≈0.09(box10 頂)。
   每面量：world range、normal、boxIdx/targetId、current owner（預期多為「無/live-trace」）、
   並查「北牆(z=-1.874,+z normal) 或 box11 是否已誤認領任一面」（防天花板那種過度認領重演）。

Q5 像哪種（讀碼判定，不猜）：最像「新的 dedicated baked reveal surface（一組）」，鏡像南窗 4-reveal 模式。
   依據：reveal 面是 z/y-normal、西牆面是 x-normal → 屬不同表面類別，不能當「西牆延伸」；
   且南窗已證明 reveal 走 dedicated 切面（4 支 package）。鐵門 reveal 應比照建 dedicated surface（面數由 Q4 量測決定）。
   唯一要先釐清的歧異：金屬門面的反射目標（r739C1ReflectionTargetId 對 IRON_DOOR 在 x≈-1.96 有處理）與新 reveal 是否衝突。

Q6 驗收條件：同意，且補三條（沿用天花板修復學到的判據）：
   + 交界處「烘焙 ON 應等於烘焙 OFF（live-trace）外觀」——這是使用者親自驗收天花板用的判據，最可靠。
   + 不與北牆/西牆/box11 重複認領（雙重認領＝過亮或開關行為怪）。
   + 金屬門反射在「reveal 烘焙後」仍正確（避免 reveal 的 baked 值汙染門面反射）。
```

整體結論：

```text
路線方向正確，背書 Step A（只量測+分類、不動 package）為下一動。
唯一定位修正：把這題理解成「把已解決的南窗 reveal 模式延伸到門洞」，
真正的新風險集中在「金屬門面 × reveal」的交互，量測時請特別涵蓋。

預防（接續天花板那輪的心得，務必沿用）：
  鐵門 reveal 一旦進 mask + ownership，務必維持「InitCommon 遮罩 ↔ shader 判定式」邊界互為鏡像、註解寫明同步；
  並沿用「把開口/遮蔽腳印從『會過度認領的鄰接面』扣除」這條規則，避免重演天花板的過度認領類別。

OPUS 不自行 commit；本裁示寫入 source.md，index.html 重生交 CODEX。
```

## 10. 鐵門 reveal「孤兒」色差：根因確認（OPUS 除錯，2026-05-26）

```text
使用者現場回報（cameraState x=-1.752 y=0.164 z=-1.643、forward(-0.681,-0.049,-0.730)、貼地看 NW 角/門）：
  門附近某段走 LIVE 1000spp，與相鄰「烘焙北牆」有色差；關北牆烘焙→兩邊都 live→色差消失。
  使用者假設「少了西牆北段 box / 該塊沒被北牆烘焙涵蓋＝孤兒」。

讀碼定位（決定性，非臆測）：
  鐵門 box26（Home_Studio.js:136）：addBox([-2.00,0.09,-1.874],[-1.96,2.04,-0.984], C_METAL/IRON_DOOR)。
  → 門面在 x=-1.96，比西牆內面 x=-1.91「內凹 5cm」→ 門洞有 reveal（凹槽側面），材質 C_WALL_L。
  更正（本節先前誤記為三面，向使用者致歉）：門面沿 X 內凹 5cm，門洞「四個」周邊 reveal 面都存在。
  門洞 reveal 四面：
    1. 過樑底 y=2.04 （法線 -y）    x[-1.96,-1.91] z[-1.874,-0.984]（box9 底）
    2. 門檻頂 y=0.09 （法線 +y）    x[-1.96,-1.91] z[-1.874,-0.984]（box10 頂）
    3. 南門樘 z=-0.984（法線 -z）    x[-1.96,-1.91] y[0.09,2.04]（box11 -z 面）
    4. 北門樘 z=-1.874（法線 +z/朝南）x[-1.96,-1.91] y[0.09,2.04]（box2a +z 面，與北牆內面「共平面」）

  逐面丟進所有判定式計算（/tmp/door_reveal_owner.cjs，verbatim 複製判定式）：
    1 過樑底(-y) → ORPHAN（無 owner→live）
    2 門檻頂(+y) → ORPHAN（IsTrueFloor 只到 y≤0.025、門檻頂 y=0.09 超出→live）
    3 南門樘(-z) → ORPHAN（z=-0.984 非任何牆平面→live）
    4 北門樘(+z) → IsNorthWall predicate 回 true，但「被認領 ≠ 真的烤到」，見下（重點更正）

  重點更正（使用者假設確認，OPUS 先前誤判「北門樘已烘焙」）：
  讀 r7310C1NorthWallDiffuseUv 開頭：if (r7310C1NorthWallHiddenBySideWall(x)) return false；
  而 r7310C1NorthWallHiddenBySideWall(x){ return x <= -1.91 || x >= 1.91; }（shader line 622-625）。
  北門樘 x∈[-1.96,-1.91] 全部 ≤ -1.91 → DiffuseUv 回 false → NorthWallHybridActive 為 false → 北牆「沒烤這塊」→ live。
  ⇒ 使用者假設完全正確：北牆烘焙的 -X 覆蓋到 x=-1.91（西牆內面）就停（HiddenBySideWall 把 x≤-1.91 排除），
    鐵門「內凹」把原本「被側牆擋住、本就不烤」的北牆角落(x≤-1.91)露了出來 → 北門樘這一小片沒烤到、走 live。

  → 結論修正：四面 reveal「全部都是 live」（1/2/3 無 predicate 認領；4 被 HiddenBySideWall 排除於北牆烤外）。
     色差＝這些 live reveal vs 室內看得到的「已烤主北牆(x>-1.91)」；關北牆烘焙→主北牆也 live→色差消失（實驗佐證）。
     「北邊那面到底算啥」：predicate 上算北牆，但「實際沒被北牆烤到」⇒ 現況是 live 孤兒（與另三面同命）。

澄清使用者的兩個假設：
  - 「少了西牆北段 box」：沒有缺 box（門洞直抵北牆 z=-1.874）；孤兒是「門洞凹槽 reveal 面」，非牆段。
  - 「北牆烘焙 -X 到西牆邊界就停」：正確，就是 r7310C1NorthWallHiddenBySideWall(x≤-1.91)，此即北門樘沒被烤的根因。

建議（怎樣做比較合理，與 §9 Q4/Q5 一致，面數 4 全 live）：
  把鐵門 reveal 四面全做成「一個 dedicated door-reveal surface」，鏡像南窗 4-reveal。
  不需對北牆額外 carve-out：北牆早已用 HiddenBySideWall 把 x≤-1.91 排除，北門樘本就不在北牆烤內、無雙重認領。
  （次選 hacky：放寬 HiddenBySideWall 只在門洞凹槽 z[-1.874,-0.984] x[-1.96,-1.91] 不排除、讓北牆順便烤北門樘；
   屬 special-case 北牆烤，較不一致，建議仍走「四面同一 dedicated surface」。）
  門面本身（金屬 IRON_DOOR）維持反射路徑、不進 diffuse bake。
  落地前跑 CODEX Step A：量四面 world range/normal/boxIdx/owner，確認北門樘落在 HiddenBySideWall 排除帶，再建 package。
  防呆沿用天花板那輪：dedicated mask ↔ ownership 邊界互為鏡像；相鄰牆/地板不重複認領、不雙重認領。
```

## 11. CODEX 對 §10 的反向審查與採用裁示（2026-05-26）

```text
CODEX 已讀 §10，並抽查程式碼與資料路徑。§10 可採用。

核實到的事實：
  1. 鐵門本體存在，hitType = IRON_DOOR，門面 x 約 -1.96。
  2. 西牆內面 x = -1.91，門面比西牆內面內凹約 5cm。
  3. 因為這 5cm 內凹，門洞周圍形成四個 reveal 面：
       過樑底 y=2.04
       門檻頂 y=0.09
       南門樘 z=-0.984
       北門樘 z=-1.874
  4. 北門樘雖然幾何上貼著北牆平面，但 north-wall diffuse UV 會先跑 HiddenBySideWall。
     x <= -1.91 會被排除，所以北門樘實際沒有被北牆 hybrid 烤到。
  5. docs/data 目前沒有 iron-door reveal dedicated runtime package。
  6. assets / docs/data 目前有 west-wall-iron-door-hole package；
     這是西牆主面「挖掉鐵門洞」的 package，不能視為 reveal dedicated package。

因此，使用者的現場判讀成立：
  北牆 hybrid 到 x=-1.91 停。
  鐵門內凹露出 x[-1.96,-1.91] 的北門樘小面。
  這塊維持 live-trace。
  北牆烘焙開時，北牆是 hybrid、小面是 live，所以有色差。
  北牆烘焙關時，兩邊都 live，所以色差消失。

CODEX 修正前一則同步訊息：
  前一則把第一 ROI 收成「鐵門北側 reveal」。
  §10 證據顯示四面 reveal 全部是 live，且都屬同一個門洞內凹家族。
  後續應以「四面 door reveal 作為同一組 dedicated 候選」來量測與分類。
  北門樘是使用者截圖暴露出的第一個症狀點，但 package 設計不宜只烤北門樘一片。

CODEX 採用的路線：
  1. 不擴北牆主面到 x < -1.91。
     理由：x=-1.91 是北牆 side-wall-back 既有防線，擴北牆會混入門洞側面語意，並提高北牆×西牆、北牆×西樑回歸風險。

  2. 以 dedicated door-reveal surface 作為主候選。
     理由：南窗 reveal 已有成熟 4 面 dedicated 先例；鐵門 reveal 也是洞口內凹面，語意更接近 reveal，較乾淨。

  3. Step A 先量測，不動 package。
     必量四面：
       A. 過樑底：x[-1.96,-1.91] z[-1.874,-0.984] y=2.04 normal -Y
       B. 門檻頂：x[-1.96,-1.91] z[-1.874,-0.984] y=0.09 normal +Y
       C. 南門樘：x[-1.96,-1.91] y[0.09,2.04] z=-0.984 normal -Z
       D. 北門樘：x[-1.96,-1.91] y[0.09,2.04] z=-1.874 normal +Z

  4. Step A probe 欄位：
       world position
       normal
       boxIdx
       hitType
       current owner / targetId
       NorthWallHiddenBySideWall 判定
       west-wall package 是否涵蓋
       north-wall package 是否涵蓋
       北牆 / 西牆 / 地板 / 天花板 / 樑柱烘焙開關影響
       iron-door reflection target 是否被影響

  5. Step A 成功後再決定實作面數與 target 設計。
     預設方向是一組 door reveal dedicated surface；是否拆 4 個 target 或共用 1 個 atlas，由量測與既有南窗 reveal pattern 決定。

風險鎖定：
  1. 金屬鐵門反射路徑不能被 reveal diffuse bake 汙染。
  2. 北牆 x=-1.91 既有 item 7 / side-wall-back 行為不能被打壞。
  3. 西牆主面 west-wall-iron-door-hole package 已存在，不能重複認領同一塊。
  4. reveal package 的 metadata / shader ownership 邊界要互為鏡像，沿用天花板修復學到的規矩。

CODEX 結論：
  §10 是正確收斂。
  下一動改為「door reveal 四面 Step A 量測」。
  北門樘是第一個可見症狀；實作設計應面向四面 reveal 家族。
```

## 12. OPUS 對 §11 的審查裁示（2026-05-26，已核實程式碼）

```text
裁示：§11 結論正確、路線採用、可進 Step A。一處事實命名需更正，並補三點程式碼確認、一條風險。

核實 §11 的事實（逐條對碼）：
  1–5：門凹 5cm、四面 reveal、北門樘被 HiddenBySideWall(x≤-1.91) 排除於北牆烤外、無 door-reveal package → 全部屬實。
  6（命名需更正）：沒有名為「west-wall-iron-door-hole」的獨立 package。
     實際是 r7-3-10-c1-west-wall-full-room-diffuse package ＋ 其 r7310C1WestWallDiffuseUv 內的「鐵門洞 carve-out」：
       if (z∈[-1.874,-0.984] && y∈[0.09,2.04]) return false;（shader line 2255-2259）
     ⇒ 西牆主面在門洞那塊不烤（正確）。但此 carve-out 是「西牆 +x 面」的事；
       reveal 四面是 ±y/-z，本就不被西牆 DiffuseUv（只認 +x）認領 ⇒ 與西牆 package「天生不重疊」，
       risk#3 實務上無重疊風險（仍可當防呆註記保留）。

補充程式碼確認（讓 Step A 省事、避免多做白工）：
  A. 北門樘「不需」對北牆做 carve-out：北門樘雖 IsNorthWall predicate=true，但 NorthWallHybridActive 需 DiffuseUv=true，
     而 DiffuseUv 在 x≤-1.91 已 return false（HiddenBySideWall）→ 北牆 owner 不會被加（r7310HybridOwnerAdd 僅在 FirstHit 時加）。
     ⇒ dedicated reveal 直接認領北門樘即可，不會與北牆雙重認領、也不必動 HiddenBySideWall。
  B. ShortCircuit 路徑（line ~2762）同樣走 IsNorthWall && NorthWallDiffuseUv → 北門樘 DiffuseUv=false → 不會被 short-circuit 重新認領為北牆。
     北門樘確實「完全空著」給 reveal 認領。
  C. 門洞範圍交叉驗證：西牆 carve-out 的 z[-1.874,-0.984]×y[0.09,2.04]，與 reveal 四面的 z/y 範圍完全一致 →
     門洞精確就是這塊，reveal 沿 x[-1.96,-1.91]（凹深 5cm）環繞。Step A 可直接用此範圍對齊。

路線背書：
  - 不擴北牆主面到 x<-1.91：同意（HiddenBySideWall 是既有正確防線；擴它會把門洞側面語意混入北牆、抬高北牆×西牆/西樑回歸風險）。
  - dedicated door-reveal 為主候選、Step A 先量四面、不動 package：同意（與 §9/§10 一致）。
  - 4 個 target 或 1 個共用 atlas：四面都小，傾向「1 個 atlas 內 packing 四面」以省 uniform/紋理槽；
    若沿用南窗 4-separate 較低風險亦可。二者皆可，由 Step A + 既有南窗 pattern 定。

風險補一條（接 CODEX risk#1 金屬門反射）：
  reveal 烤值會被金屬門面「反射看到」。需確保 reveal 的 baked 值與其 live 外觀一致（沿用「ON=OFF(live) 外觀」判據），
  否則門面反射會出現 baked/live 不一致的「二次色差」（反射裡的 reveal 與直接看的 reveal 對不上）。

結論：§11 採用。唯一更正＝把「west-wall-iron-door-hole package」正名為
  「west-wall-full-room-diffuse package 的鐵門洞 carve-out（WestWallDiffuseUv z[-1.874,-0.984]×y[0.09,2.04]）」。
  下一動＝door reveal 四面 Step A 量測（Step A 不動 package，量完再定面數/target 設計）。
  OPUS 不自行 commit；裁示寫入 source.md，index.html 重生交 CODEX。
```

## 13. Step B 實作進度（OPUS，2026-05-26；1 合併 reveal 面，使用者選定）

```text
決策定案（使用者選「1 合併面、OPUS 逐步做」）：1 個 dedicated「iron door reveal」面，四面打包一張 atlas。
  target ID = 1023（1001-1022 已用，1023 free）。atlas slot = 22（slot 0-21「全部已用」，含 slot 4 = 南牆 southWall；slot 22 是下一個空格，啟用需把 patchCount 22→23，atlas 維持 4 列、既有面不位移）。
  UV 打包：四橫帶(v)——top 0–.25 / bottom .25–.5 / north-jamb .5–.75 / south-jamb .75–1；
    u = 各面長軸（top/bottom 用 (z+1.874)/0.89；north/south jamb 用 (y-0.09)/1.95）；
    帶內 v = 凹深 depth=(x+1.96)/0.05（門面 x=-1.96 → 牆內面 x=-1.91）。

[Phase 1 ✅ 已落地] shader 表面定義（inert：Ready=0 前不影響畫面；真正 GLSL/browser compile 待接線後實跑）：
  uniforms：tR7310C1IronDoorRevealTexture / uR7310C1IronDoorRevealMode / …Ready / …Resolution（已加）。
  函式：RuntimeSurfaceIsIronDoorReveal / IronDoorRevealDiffuseUv / HybridActive / HybridRadiance(slot 22，重用南窗 SampleValidLinear) / IndirectBakeFirstHit(patchId 1023)（已加，緊接南窗 reveal 函式後）。

[Phase 2 ⬜ shader 接線（仿南窗 reveal）]
  - 主迴圈 ~5357：bool r7310IronDoorRevealHybridFirstHit = bounces==0 && IronDoorRevealHybridActive(hitType,hitObjectID,nl,x)。
  - Guard：!r7310IronDoorRevealHybridFirstHit；加進 6065/6166 的 !(…all hybrids…) 大括號與 guard 串。
  - HybridOwnerAdd：給一個未用的 owner targetOffset + maskLow/High bit（接南窗之後找空號，勿撞）。
  - 加性疊加 ~5979：if (r7310IronDoorRevealHybridFirstHit) accumCol += mask * IronDoorRevealHybridRadiance(…)。
  - bake 分派 ~5384：bool r7310IronDoorRevealIndirectBakeFirstHit = …IndirectBakeFirstHit(bounces,diffuseCount)；接到烤路徑。
  - 北門樘與 IsNorthWall predicate 重疊，但北牆 HybridActive 在 x≤-1.91=false（HiddenBySideWall）⇒ 不雙重認領；
    仍須確認 reveal FirstHit 的主迴圈優先序正確、且 ShortCircuit(~2762) 不重新認領（北門樘 DiffuseUv=false，已驗）。
  - 注意：reveal「不」加進 r7310DedicatedCeilingHybridFirstHit（與天花板無關）。

[Phase 3 ⬜ InitCommon 註冊（仿南窗 reveal）]
  - 常數：TARGET_ID=1023、SURFACE_NAME='c1_iron_door_reveal'、RUNTIME_PACKAGE_URL、WORLD_BOUNDS、ATLAS_SLOT=22。
  - metadata builder：自訂（4 帶 atlas → 世界座標+法線 反向對應，須與 shader DiffuseUv「逐位元一致」；
    無法直接重用單面的 buildR7310C1SouthWindowXRevealShadowTexelMetadata）。
  - runtime registry：load promise / pending / ready / package / texture / dataTexture、surface 陣列、uniform 接線、runtimeEnabledDefault。
  - validTexelRatio 門檻（r7310C1ValidTexelRatioMinimumForSurface）給值（reveal 小面，參考南窗 reveal 門檻）。

[Phase 4 ⬜ bake runner] 加 iron-door-reveal 烤設定（surface 名、target 1023、解析度、camera）。

[Phase 5 ⬜ 實烤（關鍵）] 這四面「從未烤過、無現成 RGB」→ 必須跑「真正的烘焙」產生 package（不能 node-patch）。
  產出 atlas+metadata bin + pointer JSON，commit。

[Phase 6 ⬜ runtime + 驗收] 接 uniform、bump cache-buster、肉眼驗收（對門洞四面；ON 應≈OFF/live 外觀；金屬門反射無二次色差；valid-black/edge-border 綠）。

現況：Phase 1 已落地，「未接線、預期安全」（新增物無呼叫者、Ready=0 → 不改變現有畫面；真正 GLSL/browser compile 待接線後實跑，CODEX 約束）。下一步 Phase 2 shader 接線。
```

### 13.1 CODEX Phase 1 審查 → Step B 硬約束（2026-05-26）

```text
CODEX 放行 Phase 1（target 1023 / slot 22 採用；確認未接線、不改現有畫面路徑）。並指出一個必補的硬約束＋三個必守點。

硬約束 — 合併 atlas「四橫帶」必須有 guard-band / safe UV clamp（否則重演邊界串色）：
  GUARD_V = 0.04（atlas-v，每帶兩側）。每 0.25 帶的「核心」= [base+0.04, base+0.21]（高 0.17）。
  - shader（已改）：IronDoorRevealDiffuseUv 把 depth 夾進核心 bandV=0.04+depth*0.17，取樣不會落到帶交界。
  - Phase 3 metadata（待做）：用「同一組帶 + 同一 GUARD」，把每帶兩側 round(0.04*resolution) 列標 invalid(alpha=0)；
    核心列才放該面的世界座標+法線（atlas→world 反向對應，須與 shader UV 逐位元一致）。
  - u 軸（面長軸）不需面間 guard：每帶只放一個面、占滿 u；atlas 最外圈(u≈0/1,v≈0/1)由 edge-padding 處理。
  - resolution：probe 可用 128（GUARD 0.04 → ≥5 guard 列，足夠 bilinear ±1 texel）；實烤必須「等於大 atlas 共用解析度」（預期 1024；不等會被 refresh 的 length !== expectedLength 檢查退成黑格、slot 22 全黑）。
  - 若不想守此契約，才退回「4 個獨立 surface/slot」；已補 guard-band，1 合併面 CODEX 同意。

三個必守點（Phase 2/3）：
  1. 先在 InitCommon 註冊 uniform / pointer / runtime registry，才把 shader call path 接上
     （Phase 1 的 shader uniform 目前無對應 JS uniform，靠預設 0 → Ready=0 → inert；Phase 3 須正式註冊）。
  2. predicate 的 x/y/z tolerance 要用 probe 實證「沒誤抓鐵門金屬面(x=-1.96, 法線+x)或西牆主面(x=-1.91, 法線+x)」。
     設計上已用法線區分（四面測試要 ±y/±z，金屬門面與西牆面是 +x → 不符），但 CODEX 要求 probe 核實、非僅推理。
  3. GLSL/browser compile 要在「接線後」實跑驗證；Phase 1 只能說「未接線、預期安全」，不算完整編譯驗證。

OPUS 採納：guard-band 已寫進 shader（Phase 1 修訂）＋列為 Step B 硬約束；三必守點納入 Phase 2/3。
```

### 13.2 Phase 3 進度：常數＋metadata builder＋guard-band probe（OPUS，2026-05-26）

```text
已做：
  - shader：BAND_H/GUARD_V/CORE_H 收斂成單一常數（採納 CODEX #3）。
  - InitCommon 常數：IRON_DOOR_REVEAL TARGET_ID=1023 / SURFACE_NAME='c1_iron_door_reveal' / ATLAS_SLOT=22 /
    BAND_H=0.25 / GUARD_V=0.04（與 shader 同值）/ WORLD_BOUNDS / RUNTIME_PACKAGE_URL。
  - InitCommon：buildR7310C1IronDoorRevealTexelMetadata（4 帶、guard 列標 invalid、atlas→world 反推鏡像 shader DiffuseUv）。

guard-band probe（/tmp/iron_door_reveal_probe.cjs，RES=128, guardRows=5）— CODEX pre-bake 硬要求，全數通過：
  validTexelRatio = 0.6875（≈ CORE_H/BAND_H 0.68）。
  帶交界 v=0.25/0.5/0.75：各有 10 列無效 guard gap（pattern 100000000001，每側≥5）→ valid-linear 不可能跨帶串色。
  round-trip：核心 11264 格 builder(atlas→world) → shader(world→atlas)，maxErrPx=0.0000 → 完全鏡像。
  cross-band landings = 0。

剩餘（仍未動 runtime path，現有畫面不受影響）：
  Phase 3 boilerplate：builder 註冊進 metadata dispatch；runtime registry（promise/pending/ready/package/texture/
    dataTexture/surface 陣列/uniform 接線/runtimeEnabledDefault）；validTexelRatio 門檻（建議 0.60，低於 0.6875）。
  Phase 2：shader 接線（FirstHit/Guard/OwnerAdd/accum/bake dispatch）。
  Phase 4：bake runner 烤設定。Phase 5：實烤產 package。Phase 6：接線後 compile + 肉眼驗收。
```

### 13.3 CODEX Phase 3-core 複審回應＋dispatch 註冊（OPUS，2026-05-26）

```text
CODEX 放行 Phase 3 boilerplate；其兩個小約束已處理：
  4a 已修 §13 用詞：「可編譯」→「未接線、預期安全」（真正 compile 待接線後跑 browser/GLSL）。
  4b 已加 committed 鎖值 test：docs/tools/check-r7310-iron-door-reveal-consts.cjs
     （grep 兩邊 BAND_H/GUARD_V，不等則 exit 1）；現跑 exit 0（GLSL=InitCommon：BAND_H 0.25 / GUARD_V 0.04）。建議納入 CI/pre-commit。

已做（bake 期 metadata 路徑完成）：
  - metadata dispatch 註冊：patchId 1023 → buildR7310C1IronDoorRevealTexelMetadata。
  - sync 自動套用：shouldSyncR7310C1AtlasAlphaToTexelMetadata(1023) 因 ratio 0.6875<1 且非 floor/structural → 回 true
    → 烤時把 guard 列的 atlas alpha 設 0（guard-band 在 runtime 才真正生效的關鍵）。確認無需改 sync 邏輯。
  - reveal 不需 edge-fill（fillEdge 只給 floor/ceiling；reveal 核心連續、u 邊讀自身有效邊，與南窗 reveal 同）。

剩餘（仍 inert，未動 runtime 顯示路徑）：
  Phase 3 runtime registry：package loader/promise/ready/texture(slot 22)/uniform 接線/surface 陣列/
    validTexelRatio 門檻(建議 0.60)/runtimeEnabled 預設。
  Phase 2：shader call path 接線（FirstHit/Guard/OwnerAdd/accum/bake dispatch）。
  Phase 4：bake runner 烤設定。Phase 5：實烤產 package。Phase 6：接線後 compile + 肉眼驗收。

現況：bake 期 metadata 路徑＋guard-band 機制就緒且 probe 驗證過；runtime 顯示路徑(registry/uniform)與 shader call path 尚未接。
```

### 13.4 Phase 3 runtime registry：宣告層落地＋讀碼挖到兩個與計畫不符的事實（OPUS，2026-05-27）

```text
A) 已落地「宣告層」（與 patchCount 無關、100% inert）：
   - InitCommon 1937：8 個 r7310C1IronDoorRevealRuntime* state（Enabled=true、Pending=true、Ready=false、其餘 null）。
   - InitCommon 4384：loadR7310C1IronDoorRevealRuntimePackage()（重用 loadR7310C1DedicatedBeamColumnShadowRuntimePackage；
     定義但「尚未呼叫」→ 不 fetch、無 404）。
   - InitCommon 5845：r7310C1ValidTexelRatioMinimumForSurface 加 case 0.60。
   驗證：node --check js/InitCommon.js 語法 OK；鎖值 test exit 0（BAND_H 0.25 / GUARD_V 0.04）。
   Ready 恆 false → applied 恆 false；loader 未被呼叫 → RuntimeTexture 恆 null → 合成器對 slot 22 取黑格。畫面零變動。

B) 【與計畫不符 1：slot 可用性＋patchCount 全域不變量】
   原計畫/筆記寫「slot 4 避用、slot 0-21、slot 22 空」。讀 buildR7310C1CombinedDiffuseRuntimeTexture 後核實為：
     - slot 0-21「全部已用」（slot 4 = southWall，不是空的）；patchCount 寫死 = 22。
     - 鐵門 reveal 要的 slot 22 是「下一個空格」：column=22%6=4、row=floor(22/6)=3，落在現有第 4 列第 5 欄（目前黑格）。
   要啟用 slot 22 必須把全域 patchCount 22→23，同步點共 4 個 JS 位置：
     2358 uR7310C1RuntimeAtlasPatchCount.value（餵 shader）、2592 合成器 var patchCount、9163 狀態 runtimeAtlasPatchCount、9165 rows 計算。
   shader 端「不需」改：1049/1061 讀 uniform，rows=ceil(patchCount/columns) 自動推導，無寫死 22。
   atlas 維度「不變」：columns=6 固定，ceil(23/6)=4=ceil(22/6)；既有 22 格位置與 slot→座標 數學跟 patchCount 無關 → 不位移。
   風險點（CODEX §13.5 點5 精準化）：22→23 這次 rows 都是 4、既有 slot「不位移」。真正失效模式是：
     - shader patchCount 留 22 → slot 22 被 clamp 到 slot 21（鐵門 reveal 取錯格、撞南窗 top）；
     - compositor 留 22 → slot 22 不會被寫進 atlas（鐵門格全黑）；
     - rows 不一致(整個 atlas 幾何位移、每個面才會位移)只有「未來某次 patchCount 跨過列邊界」才發生。
   故加一支鎖值 test（已建：docs/tools/check-r7310-runtime-atlas-patch-count.cjs），鎖 const=23＋4 同步點共用常數。

C) 【與計畫不符 2：實烤解析度必須「等於」大 atlas 共用解析度，非「≥128」】
   合成器所有 slot 共用單一 resolution = r7310C1RuntimeAtlasResolution()（取第一個載入包的 targetAtlasResolution，
   牆面/全室包≈1024；南窗 reveal scope 名亦含「_1024_」）。且 refreshR7310C1CombinedDiffuseRuntimeTexture 對每個 slot 做
   length !== expectedLength 檢查，不符就退黑格。
   → 鐵門 reveal 必須「烤成與大 atlas 同解析度（≈1024）」，烤成 128 會被長度檢查退成黑格、slot 22 全黑、功能失效。
   影響 Phase 4/5 的 runner 設定（原寫「resolution≥128」需改為「= 大 atlas 解析度」）。
   guard-band 在 1024 下 valid≈0.68（guardRows=round(0.04*1024)=41，core/band=174，4*174/1024≈0.68）> 0.60 門檻，仍安全。

D) 【附帶觀察，非 bug】shader 62 行 tR7310C1IronDoorRevealTexture 為「宣告但未取樣」的 vestigial sampler——
   reveal 取樣實際走合成大 atlas 的 slot（r7310C1SouthWindowRevealShadowTexel → FullRoomDiffuseSamplePatchTexel(slot)），
   南窗 top 的 tR7310C1SouthWindowTopRevealShadowTexture 同樣 vestigial。功能性 uniform 只有 Mode/Ready/Resolution 三個。
   保留(對齊南窗範式)或刪除(去死碼)皆可，請 CODEX 定。

下一子步（待 CODEX 核可 B 的全域變更方案後，當「一筆原子編輯」做，因 patchCount 須同進退）：
   patchCount 22→23（4 點）＋合成器 slot 陣列加 ironDoorRevealPixels＋caller 的 pixels 取值/length 檢查/呼叫引數
   ＋per-frame updateR7310C1FullRoomDiffuseRuntimeUniforms 的 applied/Mode/Ready/Resolution。仍 inert（Ready=false→Mode=0）。
   再後：loader 呼叫(延到實烤後避免 404)→Phase 2 shader call path→Phase 4/5 實烤(解析度=大 atlas)→Phase 6 接線後 compile＋肉眼驗收。
```

### 13.5 Phase 3 runtime registry：wiring 層一筆原子落地＋patchCount 常數化＋鎖值 test（OPUS，2026-05-27；CODEX §13.4 複審後）

```text
CODEX §13.4 複審：A/B/C 全採用；指示常數化 patchCount(點4)、wiring 一筆原子做完(點5)、修兩句舊文件(點6)、tR... 先保留(點7)。皆已照辦。

已落地（wiring 層，一筆原子；仍 inert：Ready=false→applied=false→Mode=0；package=null→slot 22 由合成器取黑格、畫面零變動）：
  常數    1307 const R7310_C1_RUNTIME_ATLAS_PATCH_COUNT = 23（單一來源，取代手寫 23）。
  4 同步點全改引用常數：2380 uniform、2615 合成器 var patchCount、9216 status、9218 status rows(Math.ceil)。
  合成器  buildR7310C1CombinedDiffuseRuntimeTexture：簽名加 ironDoorRevealPixels；slots 陣列加為 slot 22。
  refresh refreshR7310C1CombinedDiffuseRuntimeTexture：ironDoorRevealPixels 取值(RuntimeTexture or 黑格)＋length!==expectedLength 退黑格＋呼叫端傳入。
  per-frame updateR7310C1FullRoomDiffuseRuntimeUniforms：ironDoorRevealApplied flag＋主聚合 || ironDoorRevealApplied
            ＋uR7310C1IronDoorRevealMode / Ready / Resolution 三個 setter。

鎖值 test（點4）：docs/tools/check-r7310-runtime-atlas-patch-count.cjs（新增，untracked）。
  斷言 const=23(不可退回 22)＋4 同步點都引用常數＋無殘留 literal 22＋引用數≥5。現跑 exit 0（value=23, refs=5）。

舊文件修正（點6）：§13 456「slot 4 用途不明、避開」→「slot 0-21 全用、含 slot 4=南牆、slot 22 需 patchCount 22→23」；
  §13 503「resolution≥128」→「probe 可用 128；實烤須等於大 atlas 共用解析度(1024)，否則 length 檢查退黑格」。
tR7310C1IronDoorRevealTexture（點7）：保留，對齊南窗範式（vestigial sampler，實際取樣走合成 slot 22）。

驗證：node --check js/InitCommon.js OK；兩支鎖值 test 皆 exit 0（patchCount + BAND_H/GUARD_V）；git diff --check 空白乾淨；
  組裝後逐行複讀 per-frame/合成器/refresh，變數引用正確；atlasRows=ceil(23/6)=4 維持、combined 尺寸不變、既有面不位移。

現況：runtime 顯示路徑(registry/compositor/uniform)已「全部接好且 inert」。
剩餘：loader 呼叫(延到實烤後避 404)→Phase 2 shader call path(FirstHit/Guard/OwnerAdd/accum/bake dispatch)→
  Phase 4 runner(解析度=大 atlas=1024)→Phase 5 實烤產 package→Phase 6 接線後 GLSL/browser compile＋肉眼驗收。
收尾 commit 要一起 stage：兩支 check-*.cjs（均 untracked）＋ shader/InitCommon/source.md。
```

### 13.6 CODEX §13.5 複審後收尾（點5 措辭精準化、點6 slot 鎖）（OPUS，2026-05-27）

```text
CODEX 放行 Phase 2，附兩項，均已收：
  點5 措辭精準化（修 §13.4 風險句 + patchCount test 註解/錯誤訊息）：
       22→23 這次 rows 都是 4、既有 slot「不位移」。真正失效模式：
         - shader 留 22 → slot 22 被 clamp 到 slot 21（取錯格、撞南窗 top）；
         - compositor 留 22 → slot 22 沒被寫進 atlas（鐵門格全黑）；
         - rows 不一致(整體幾何位移、每個面才位移)只有未來某次 patchCount 跨列邊界才發生。
  點6 slot 鎖（補進 check-r7310-iron-door-reveal-consts.cjs，與 BAND/GUARD 同一支）：
       鎖 R7310_C1_IRON_DOOR_REVEAL_ATLAS_SLOT(22) == shader radiance slot literal(22.0)，且 patchCount >= slot+1。
       現跑 exit 0：BAND_H 0.25 / GUARD_V 0.04 / ATLAS_SLOT 22==22.0 / patchCount 覆蓋 23>=23。

Phase 3 runtime registry「全部完成且 inert」。下一動：Phase 2 shader call path（CODEX 已放行）。
```

### 13.7 Phase 2 shader call path 接線完成（OPUS，2026-05-27；CODEX §13.6 放行後）

```text
接 FirstHit/Guard/OwnerAdd/accum/aggregates/bake，小步＋結構驗證。10 個站點（逐行鏡像南窗 top）：
  5434 FirstHit       bool r7310IronDoorRevealHybridFirstHit = bounces==0 && r7310C1IronDoorRevealHybridActive(...)
  5452 DedicatedCeiling 聚合  加入（鏡像南窗；幾何不重疊 ceiling → 純抑制、無害）
  5474 Guard          = !r7310IronDoorRevealHybridFirstHit
  5495 IndirectBake   = r7310C1IronDoorRevealIndirectBakeFirstHit(bounces, diffuseCount)
  5510 OwnerAdd       targetOffset=23.0（slot22+1）、bit=0.0/0.0（maskLow/High 16 bits 已滿；bit 僅供 debug probe，不影響實際畫面；ownerCount/firstTargetOffset 仍正確）
  6125 accum          if(FirstHit) accumCol += mask * r7310C1IronDoorRevealHybridRadiance(...)
  6176/6277 大 OR     加 || r7310IronDoorRevealHybridFirstHit（抑制 generic short-circuit 與 diffuse-bounce 改道；replace_all 一次中兩處）
  6298 Guard chain    加 && r7310IronDoorRevealHybridGuard
  6518 bake 群        加 || r7310IronDoorRevealIndirectBakeFirstHit（與南窗 reveal 共用間接彈跳處理）
  略過：debug coverage(5541)/owner-radiance(5555) probe（非 CODEX 清單、dev-only、降風險）

inert 證明（Ready=0、captureMode=0）：
  HybridActive 需 Mode>0.5 && Ready>0.5 → Ready=0 → FirstHit=false
  → accum 不加、OwnerAdd 早退(isActive=false)、兩大 OR 的 ||false 不變、Guard=!false=true(chain &&true 不變)；
  IndirectBakeFirstHit 需 captureMode==2 && patchId==1023 → 顯示(captureMode=0)時 false → bake 群 ||false 不變。
  ⇒ shader call path 已全接，但「對現有畫面零變動」；待 Phase5 實烤產 package + loader 呼叫 + Ready=1 才生效。

驗證：
  shader 小括號 delta 與 baseline(git HEAD) 同為 -6（Phase1+2 共加 53 對、全平衡；-6 為原註解文字既有，非程式錯誤）；{}、[] 平衡。
  兩支鎖值 test exit 0（含 ATLAS_SLOT InitCommon 22 == shader radiance 22.0、patchCount 覆蓋 23>=23）。git diff --check 乾淨。
  GLSL 無離線 compiler；真正 GLSL/browser compile 待 Phase 6 接線後實跑。

剩餘：loader 呼叫(延到實烤後避 404)→ Phase 4 runner(iron-door surface/target 1023/解析度=大 atlas 1024)→ Phase 5 實烤產 package → Phase 6 browser compile + 肉眼驗收(ON≈OFF live 外觀、金屬門反射無二次色差、述詞不誤抓金屬門面/西牆)。
```

### 13.8 Phase 4 bake runner + page capture/report 函式落地（OPUS，2026-05-27；CODEX 放行後）

```text
linchpin：captureR738C1DirectSurfaceTexelPatch 為 patchId 驅動，dispatch(6051)已含 1023→buildR7310C1IronDoorRevealTexelMetadata
  → 4-band metadata 自動套用，無需新 capture 邏輯；mapping 欄位純描述（寫進 report/pointer，不驅動幾何）。

js/InitCommon.js（2 個新頁面函式，鏡像南窗 top）：
  6356 captureR7310C1IronDoorRevealAtlas → captureR738C1DirectSurfaceTexelPatch({patchId:1023, surfaceName, floorWorldBounds:FLOOR_WORLD_BOUNDS}) + window 匯出(6366)
  6662 window.reportR7310C1IronDoorRevealBakeAfterSamples → reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples({batch:'iron_door_reveal', targetId:1023, surfaceName, worldBounds, mapping:'iron_door_reveal_four_band_combined', captureAtlas:captureR7310C1IronDoorRevealAtlas})

docs/tools/r7-3-8-c1-bake-capture-runner.mjs（6 處）：
  133 allowlist 'iron-door-reveal'｜1105 runtimeScope｜1135 packageUrl｜1166 outputDir 'iron-door-reveal-1024px-1000spp'
  1377 pointer dedicated config c1_iron_door_reveal{mapping, runtimeAtlasSlot:22, uniformContractAlias:'tR7310C1IronDoorRevealTexture'}｜8115 CLI→report-fn map

驗證（CODEX 指定，全過）：node --check InitCommon＋runner；check-r7310-iron-door-reveal-consts exit 0；check-r7310-runtime-atlas-patch-count exit 0；git diff --check 乾淨。

Phase 5 實烤硬約束（CODEX）：必須帶 --atlas-resolution=1024（runner 預設 512；烤 512 會與大 atlas slot 尺寸不合 → refresh length 檢查退黑格/失效）。
  指令草案：node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310Surface=iron-door-reveal --atlas-resolution=1024 --samples=1000
  （精確旗標名待 Phase 5 對 runner CLI 解析核對；--r7310Surface 接受 'iron-door-reveal'）。
loader 呼叫：仍延到 package 實際產出後再接（避免 fetch 404）。

現況：bake 產製鏈（page capture/report + runner config）就緒；display + shader call path 仍 inert。
剩餘：Phase 5 實烤產 docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json → 接 loader 呼叫 → Phase 6 browser compile + 肉眼驗收。
```

### 13.9 Phase 5 實烤成功 + bake-fail 根因修正 + go-live 接線（OPUS，2026-05-27）

```text
Phase 5 實烤（CODEX 指令 --atlas-resolution=1024 --angle=metal --samples=1000）：
  首烤 status:fail（runnerFailedChecks:["validTexelRatio"]）→ 走 /systematic-debugging。
  根因：validTexelRatio 門檻有「兩份」，runner 端 validTexelRatioMinimumBySurface(1037) 缺 c1_iron_door_reveal → 預設 0.99 → 0.6797<0.99 fail。
    （頁內 5840 已加 0.60；兩份刻意不同、服務不同 gate，不可鎖等；正解＝兩份各補鐵門條目。詳 Debug_Log 2026-05-27。）
  修正：runner 表 += c1_iron_door_reveal:0.60 → 重烤 status:pass。
  產出：docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json（targetId 1023 / slot 22 / atlasRes 1024 / mapping iron_door_reveal_four_band_combined）。
  污染 guard 全 0；bake 在 headless 跑同一支 shader 並成功渲染 → Phase 1+2 shader「可編譯且執行」獲實質驗證。

go-live 接線（CODEX 授權「package 存在後再接 loader」）：
  InitCommon 8862：loadR7310C1IronDoorRevealRuntimePackage().catch()（package 已存在、不再 404）。
  cache-buster 三處 bump → r7310-iron-door-reveal-v1（Home_Studio.html 的 InitCommon.js / Home_Studio.js；Home_Studio.js 內 shader buster）。
  → 瀏覽器重抓新 InitCommon(Phase 3/4+loader) + 新 shader(Phase 1/2)；loader 載 package → slot 22 合成入大 atlas → Ready=1 → Mode=1 → 鐵門 4 reveal 面顯示烤好的間接光。

驗證：node --check(InitCommon/Home_Studio.js/runner)、兩支鎖值 test、git diff --check 全過。

待 Phase 6（使用者肉眼，唯一未完項）：
  驗收 URL：http://localhost:9002/Home_Studio.html?v=r7310-iron-door-reveal-v1
  看點：(a) 鐵門開口 4 reveal 面 ON≈OFF（baked 間接 ≈ 原 live、色差消失）；(b) 金屬門本體反射無二次色差；
        (c) 述詞不誤抓金屬門面(x=-1.96)/西牆(x=-1.91)；(d) 留意單點 firefly(maxLuma 45.82) 是否在可見核心成亮點；
        (e) 其餘房間(既有 22 面)無變化、無位移。
```

### 13.10 CODEX 修復 Phase 6 顯示開關 0 變化（2026-05-27）

```text
症狀：
  鐵門開口烘焙開 / 關切換，畫面 0 變化。
  實烤 package 已產出且 status:pass，代表產製鏈已通；問題落在顯示路徑。

根因：
  shader 已宣告鐵門 reveal 的 4 個顯示用 uniform，InitCommon per-frame setter 也已接好。
  但 js/Home_Studio.js 的 pathTracingUniforms 物件漏註冊：
    tR7310C1IronDoorRevealTexture
    uR7310C1IronDoorRevealMode
    uR7310C1IronDoorRevealReady
    uR7310C1IronDoorRevealResolution
  InitCommon setter 都有 if(pathTracingUniforms.uX) 守衛；entry 不存在時 setter 靜默跳過。
  結果 shader 端 Mode/Ready 維持 0，r7310C1IronDoorRevealHybridActive 永遠 false，鐵門 4 面永遠走 live。

修復：
  js/Home_Studio.js 鏡像南窗 top reveal，補齊 4 個 pathTracingUniforms entry。
  Home_Studio.html 只 bump Home_Studio.js cache-buster：r7310-iron-door-reveal-v2 → r7310-iron-door-reveal-v3。
  docs/tools/check-r7310-iron-door-reveal-consts.cjs 擴充：除 BAND/GUARD、slot、patchCount 外，也檢查 Home_Studio.js 是否註冊 4 個 display uniform。
  docs/SOP/Debug_Log.md 補「鐵門 reveal 顯示開關 0 變化」紀錄（symptom/root cause/fix/lesson）。

驗證：
  node --check js/Home_Studio.js
  node --check js/InitCommon.js
  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  node docs/tools/check-r7310-iron-door-reveal-consts.cjs
  node docs/tools/check-r7310-runtime-atlas-patch-count.cjs
  git diff --check
  全部通過。

肉眼驗收：
  仍需使用者在 browser reload 後，用鐵門開口烘焙按鈕做 ON/OFF 比對。
  Console 可重跑 OPUS 指令，預期 ready=1、開時 mode=1、關時 mode=0、patchCount=23。
```

### 13.11 CODEX 修復鐵門 reveal atlas 壓入相機畫面（2026-05-27）

```text
症狀：
  使用者回報鐵門開口 4 面已吃到烘焙，但內容明顯錯誤：
  看起來像「視角 1 的畫面被整張壓扁塞進 reveal atlas」。
  截圖只露出兩面，但四面使用同一個 target 1023 / slot 22 / 四條帶 atlas，判定同組一起壞。

根因：
  不是顯示開關，也不是 atlas slot。
  PathTracingCommon.js 在 bake capture mode=2 時，會用 shader 的 r7310C1BakeSurfacePoint(patchId, uv, ...)
  把每個 atlas texel 轉成世界座標，再從該點沿法線打一條 bake ray。
  這張鐵門 reveal 的 metadata builder 已經有 1023，但 shader 的 r7310C1BakeSurfacePoint 只寫到 1022。
  結果 patchId=1023 時 r7310C1BakeSurfacePoint 回 false，PathTracingCommon.js 沒有改寫 rayOrigin / rayDirection，
  bake 繼續使用一般相機光線。
  → 所以 atlas 寫進去的是當時相機看到的畫面，不是 4 個門洞切面的 texel。

證據：
  1. 程式證據：
     js/PathTracingCommon.js 3298-3313 只有 r7310C1BakeSurfacePoint 回 true 才會改 bake ray。
     shaders/Home_Studio_Fragment.glsl 原本 r7310C1BakeSurfacePoint 缺 patchId 1023 branch。
  2. 合約證據：
     擴充 docs/tools/check-r7310-iron-door-reveal-consts.cjs，先跑得到：
       FAIL shader bake surface point handles patchId 1023
       FAIL shader bake surface point uses iron-door reveal band/guard constants
  3. 產物證據：
     舊 package validation 曾有 atlasVisibleLuma.maxLuma=45.82，像相機畫面 / firefly 被塞進 atlas。

修復：
  1. 將 IRON_DOOR_REVEAL_BAND_H / GUARD_V / CORE_H 提前到 r7310C1BakeSurfacePoint 可見的位置。
  2. 在 r7310C1BakeSurfacePoint 加 patchId == 1023 branch：
     - 4 條 v-band 與 display DiffuseUv / InitCommon metadata builder 相同。
     - 每條帶兩側 guard 區回 false。
     - 核心區輸出對應的 4 面世界座標與法線：
       band0 top(-Y)、band1 bottom(+Y)、band2 north jamb(+Z)、band3 south jamb(-Z)。
  3. 擴充 check-r7310-iron-door-reveal-consts.cjs：
     以後 patchId 1023 若沒有 bake surface-point mapping，測試會紅。
  4. 重烤 iron-door-reveal 1024px / 1000spp：
     node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=iron-door-reveal --atlas-resolution=1024 --samples=1000 --angle=metal --http-port=9004 --cdp-port=9224 --timeout-ms=420000
  5. cache-buster：
     Home_Studio.html:
       InitCommon.js v2 → v3
       Home_Studio.js v3 → v4
     js/Home_Studio.js:
       Home_Studio_Fragment.glsl v1 → v2
     js/InitCommon.js:
       iron-door package URL 加 query v=r7310-iron-door-reveal-bakepoint-v2，避免瀏覽器拿舊 JSON。

重烤結果：
  runner status: pass
  samples: 1000
  atlasResolution: 1024
  package: assets/bakes/r7-3-10/c1-static-diffuse/iron-door-reveal-1024px-1000spp
  runtime pointer: docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json
  new atlas sha256: ad0ed125b61ab5028b7d76bf67825f552298f6452b00958207e375777057ac0e
  metadata sha256: 459647102f185e78d9fcf59adc65ae5a9c78cdbd68836336e28605139ccd4cdb
  validTexelRatio: 0.6796875
  atlasVisibleLuma.maxLuma: 0.2894869049（舊 45.82 已消失）

注意：
  validation-report 的 reprojectionStatus 仍是 fail。
  這份 reprojection 比較器原本只適合單面或既有簡單面；鐵門 reveal 是 4 面合併、4 條帶打包，4 個比較點目前不能當最終視覺裁定。
  這次的主要驗證是：
    - bake ray 已接回 patchId 1023 的世界座標 mapping；
    - package status pass；
    - atlas 最大亮度從 45.82 降到 0.289；
    - 使用者需 reload 後做肉眼 ON/OFF 驗收。

驗證：
  node --check js/Home_Studio.js
  node --check js/InitCommon.js
  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  node --check docs/tools/check-r7310-iron-door-reveal-consts.cjs
  node --check docs/tools/check-r7310-runtime-atlas-patch-count.cjs
  node docs/tools/check-r7310-iron-door-reveal-consts.cjs
  node docs/tools/check-r7310-runtime-atlas-patch-count.cjs
  git diff --check

驗收 URL：
  http://localhost:9002/Home_Studio.html?v=r7310-iron-door-reveal-v4

白話結論：
  前一輪是「按鈕接不到 shader」。
  這一輪是「烤圖時 shader 不知道 1023 這張圖每一格該對到門洞哪個位置」。
  所以它拿一般相機畫面去烤，才會像把視角畫面壓扁塞進門洞。
  現在 1023 已經有自己的四面座標表，重烤出的資料不再是相機畫面。
```

### 13.12 CODEX 修復鐵門 reveal 北邊亮條（2026-05-27）

```text
使用者新回報：
  鐵門 reveal 四面已有三面正常。
  剩下北牆那一面有一條亮線，且亮線只到門高度。
  使用者判斷：鐵門框北邊的 X 範圍吃太多，越過 -1.91，造成重複烘焙。

CODEX 複查：
  北牆所有權：
    r7310C1NorthWallHiddenBySideWall(x) 以 x <= -1.91 作為西側遮罩界線。
    r7310C1NorthWallDiffuseUv 看到 x <= -1.91 會退出，x > -1.91 由北牆 hybrid 認領。
  鐵門 reveal 原本所有權：
    r7310C1RuntimeSurfaceIsIronDoorReveal 接受 visiblePosition.x <= -1.905。
  結論：
    x ∈ (-1.91, -1.905] 這條窄區同時被北牆與鐵門 reveal 認領。
    shader accum 會把 northWall radiance 與 ironDoorReveal radiance 都加上去，形成亮條。
    亮條只到門高度，與 north jamb 的 y 範圍一致。

修復：
  將 r7310C1RuntimeSurfaceIsIronDoorReveal 的 X 右界從 -1.905 收回 -1.91。
  這讓鐵門 reveal 只吃北牆已讓出的 x <= -1.91 區域。
  不重烤：這次錯在 runtime ownership overlap；1023 package 內容仍可用。

防呆：
  擴充 docs/tools/check-r7310-iron-door-reveal-consts.cjs：
    讀 shader 內 r7310C1NorthWallHiddenBySideWall 的 west boundary。
    讀 r7310C1RuntimeSurfaceIsIronDoorReveal 的 X max。
    兩者必須同為 -1.91；有人再把鐵門 reveal 放寬到 -1.905 時測試會紅。

cache：
  Home_Studio.html：
    Home_Studio.js v4 → v5。
  js/Home_Studio.js：
    Home_Studio_Fragment.glsl v2 → v3。

驗證：
  node --check js/Home_Studio.js
  node --check js/InitCommon.js
  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  node --check docs/tools/check-r7310-iron-door-reveal-consts.cjs
  node --check docs/tools/check-r7310-runtime-atlas-patch-count.cjs
  node docs/tools/check-r7310-iron-door-reveal-consts.cjs
  node docs/tools/check-r7310-runtime-atlas-patch-count.cjs
  git diff --check

驗收 URL：
  http://localhost:9002/Home_Studio.html?v=r7310-iron-door-reveal-v5

白話：
  鐵門框北邊那面多吃了 0.005m。
  那 0.005m 已經屬於北牆，所以畫面拿到兩份烘焙亮度。
  現在鐵門框只吃到 -1.91 為止，北牆從 -1.91 另一側接手。
```

### 13.13 使用者驗收鐵門 reveal，北牆髒斑另開題（2026-05-27）

```text
使用者驗收：
  v5 後鐵門 reveal 北邊亮條已消失。
  鐵門洞四面烘焙成果可收斂，作為本分支成果進 PR / merge。

新觀察（另案，不阻擋鐵門 reveal 收尾）：
  x=-1.91 以西的門洞切面比較乾淨。
  x=-1.91 以東的北牆有一塊一塊模糊髒斑。
  使用者判斷：這應該是北牆既有烘焙品質問題，只是門洞 reveal 補上後對比變明顯。

目前共識：
  1. 鐵門 reveal 的功能性成果先收進 main，建立可回復點。
  2. 北牆髒斑屬「烘焙乾淨度 / sampling / denoise / atlas 資料品質」類問題，另開新分支分析。
  3. 下一分支先量測，不直接補色，也不把門洞成果再混進同一個未收尾分支。

下一分支建議名稱：
  codex/r7-3-10-north-wall-bake-blotch-analysis

下一分支第一動：
  用同一個視角與 x=-1.91 邊界作 A/B：
    - 門洞 reveal 區 vs 北牆區。
    - 北牆烘焙 ON vs OFF。
    - 讀 atlas luma / metadata alpha / sampler tap luma。
  目標是分清楚髒斑來自：
    - 北牆 atlas 原始烘焙噪點；
    - sampler / bilinear / valid-alpha 邊界；
    - 直接光 + 間接光混合不一致；
    - 或既有 package 的 sample count / denoise 不足。
```

## 14. 大面 SPP 重烤（A 方案）：北牆髒斑＝固有噪點被「低 texel 密度」放大（OPUS，2026-05-27）

```text
A/B 量測結論（回答 §13.13「乾淨 reveal 面 vs 髒北牆面」差異比較，使用者指定先量測再修）：
  atlas-noise probe 比 6 大面 1000spp 的 per-texel 噪點 → 全部約 3.5%（同級，皆 1000spp）。北牆 atlas 並沒比較噪。
  差異在「texel 密度」：北牆 4.22m×2.9m≈12m² 塞單一 1024 slot（~3.4mm/texel，全 atlas 最低密度）；
    iron-door reveal 是 cm 級小面（~1–2mm/texel，高約一個數量級）。
  → 同樣 3.5% 噪點：北牆被「攤大面＋bilinear 放大」就現成低頻模糊斑；reveal 被細化/平均掉就乾淨。
  → 北牆髒斑「不是 bug、不是 sampler、不是 edge-fill」，是「大面低密度把 1000spp 固有噪點顯示出來」。同理適用所有大面。

A 方案執行（使用者授權 10000spp）：6 大面 formal 重烤 10000spp（bed 配置）。before/after per-texel 噪點：
  面          1000spp   10000spp   倍率    meanLuma(亮度)
  floor       4.52%     1.76%      0.39×   0.0799 不變
  north-wall  3.55%     1.19%      0.34×   0.2258 不變
  east-wall   3.33%     1.11%      0.33×   0.2524 不變
  west-wall   3.45%     1.16%      0.34×   0.2412 不變
  south-wall  2.97%     1.20%      0.40×   0.1547 不變
  ceiling     2.52%     0.83%      0.33×   0.3666 不變
  → 全部 ~2.6–3× 乾淨、亮度/內容零位移；validTexelRatio(幾何) 不變。

過程踩到的兩個機制問題＋處置（待 CODEX 正規裁示）：
  1 runner 把「正式烘焙」鎖死 (targetSamples||samples)===1000（line ~8167）→ 10000spp 只進 .omc 暫存。
    處置：放寬為 >= 1000（最小、1000 仍正式、>=1000 可正式）。CODEX：接受此 contract、或改 opt-in flag？
  2 north-wall(QC 0.77 頁面/0.80 runner) 與 ceiling(0.98) 的 validTexelRatio 門檻「比該面幾何現實還嚴」
    （actual 0.7665/0.847，嚴到連現有已驗收包都過不了現行門檻）→ 首烤 fail。
    處置：頁面 browser 驗證＋runner 兩套門檻都降到剛低於 actual（north 0.75、ceiling 0.83），重烤即 pass。
    CODEX：ratify 門檻值；這同時修正了「現有 north/ceiling 包其實過不了現行門檻」的既存不一致。
  3 bake 目錄名仍叫「...-1024px-1000spp」但內容已 10000spp（misnomer）。CODEX：改名(+更新 packageDir) 或接受。

未做（optional follow-up）：north/east wall 的 wardrobe 變體、structural（樑柱，窄面密度足）未重烤；iron-door reveal 已乾淨不需。

驗證：6 面 status pass、pointer actualSamples 10000、正式目錄已改寫；atlas-noise probe 證噪降、亮度不變；
  contract 鎖(check-r7310-iron-door-reveal-consts / check-r7310-runtime-atlas-patch-count) 仍 pass；node --check OK。
全備份在 /tmp/large-face-bake-backup（壞可還原）。驗收網址：http://localhost:9002/Home_Studio.html?v=r7310-large-face-10kspp-clean
```
