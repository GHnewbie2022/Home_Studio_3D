# R7-3.10 北牆族 1b 東北家具 Owner 規格草案

## 1. 目的

```text
這份規格承接北牆族 1a。

1a 已把靜態北牆 owner 規則收斂到 SurfaceOwnerPolicy：
  - A1 XATLAS
  - D800 北牆
  - side-wall / door-hole / beam-gap exclusions
  - runtime gate / bake-point / JS mirror 三邊總入口

1b 要處理家具狀態：
  - 東北床
  - 東北衣櫃
  - 家具存在時才生效的 contact exclusions
  - 床 / 衣櫃 package 與 UI 狀態同步
  - grid sweep 從 1a 基線升級成產品 route 檢查
```

## 2. 目前已知事實

```text
1. 目前分支
   codex/r7-3-10-furniture-owner-1b

2. 基底
   main 已同步到 PR #12 merge commit：
   76efe21 Merge pull request #12 from GHnewbie2022/codex/r7-3-10-xatlas-owner-unification

3. 1a 狀態
   OPUS 已簽結 1a DONE。
   產品程式與防漂移測試可收。

4. 家具 UI 狀態
   Home_Studio.js 現有：
     c2NortheastFurnitureMode = 'bed'
     allowed values: bed / wardrobe
     window.setC2NortheastFurnitureMode(mode)
     window.reportC2NortheastFurnitureLayout()

5. runtime 家具狀態
   InitCommon.js 現有：
     r7310C1NortheastFurnitureRuntimeMode = 'bed'
     window.setR7310C1NortheastFurnitureRuntimeMode(mode)
     r7310C1NorthWallActiveDiffuseRuntimePackage()
     r7310C1EastWallActiveDiffuseRuntimePackage()
     r7310C1EastWallBeamShadowActiveRuntimePackage()

6. 家具幾何
   wardrobe.main:
     min [1.35, 0.0, -1.874]
     max [1.91, 1.955, -0.703]

   bed.main:
     min [-0.027, 0.0, -1.874]
     max [1.91, 0.28, -0.314]

7. 現有 package 指標
   bed mode:
     docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json
     docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json
     docs/data/r7-3-10-c1-east-wall-beam-shadow-runtime-package.json

   wardrobe mode:
     docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json
     docs/data/r7-3-10-c1-east-wall-wardrobe-full-room-diffuse-runtime-package.json
     docs/data/r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-package.json

8. 既有契約
   docs/tests/r7-3-10-ne-furniture-wall-bake-variants.test.js
   已鎖 package mode / runtimeScope / runtimeArchitecture / targetId / samples / validation。

9. 目前缺口
   docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
   仍斷言：
     contract.c1NorthWallBatch.invalidTexelRegions.wardrobeContact === undefined

   代表家具 contact exclusion 尚未進入北牆 owner registry。
```

## 3. 本輪範圍

```text
本輪 1b 規格只定義制度與檢查。

目前先不做：
  1. 不改 shader。
  2. 不改 JS runtime。
  3. 不改 bake pipeline。
  4. 不改 runtime pointer。
  5. 不重烤 package。
  6. 不修床邊縫隙畫面。
  7. 不把東牆 / 西牆 / 南牆 / 天花板納入本輪。

OPUS 審過本規格後，下一輪才進 code GOAL。
```

## 4. 1b 要解的問題

```text
1. 家具狀態如何進入 SurfaceOwnerPolicy？
   1a 的 policy 只描述靜態北牆。
   1b 要讓 policy 能表達 bed / wardrobe 模式。

2. exclusions 怎麼跟家具狀態連動？
   家具 contact 區只在對應家具存在時生效。
   例如 bed contact 只在 bed mode 生效。

3. package 怎麼跟家具狀態同步？
   bed mode 與 wardrobe mode 已有不同 runtime package。
   policy 要能明確描述 mode 對應 package。

4. owner precedence 怎麼定？
   家具本體、北牆 atlas、東牆 atlas、beam shadow package 可能在接觸區互相重疊。
   1b 要定義啟用條件成立時，最高 precedence 必須唯一。

5. grid sweep 如何升級？
   1a 的 grid sweep 是基線模型。
   1b 起要驅動產品 route，或解析 shader 實際 route。
```

## 5. SurfaceOwnerPolicy 欄位補強

### 5.1 furnitureStateRef

```text
新增或正式啟用欄位：

furnitureStateRef: {
  modeKey: 'northeastFurnitureMode',
  source: {
    ui: 'c2NortheastFurnitureMode',
    runtime: 'r7310C1NortheastFurnitureRuntimeMode',
    setter: 'window.setR7310C1NortheastFurnitureRuntimeMode'
  },
  allowedValues: ['bed', 'wardrobe'],
  defaultValue: 'bed',
  packageByMode: {
    bed: {
      northWall: 'R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL',
      eastWall: 'R7310_C1_EAST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL',
      eastWallBeamShadow: 'R7310_C1_EAST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL'
    },
    wardrobe: {
      northWall: 'R7310_C1_NORTH_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL',
      eastWall: 'R7310_C1_EAST_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL',
      eastWallBeamShadow: 'R7310_C1_EAST_WALL_BEAM_SHADOW_WARDROBE_RUNTIME_PACKAGE_URL'
    }
  }
}
```

### 5.2 exclusion activeWhen

```text
每個家具 contact exclusion 都要支援 activeWhen：

exclusions: [
  {
    id: 'bedContact',
    helper: 'r7310C1NorthWallHiddenByBedContact',
    type: 'rectXY',
    activeWhen: {
      furnitureStateRef: 'northeastFurnitureMode',
      equals: 'bed'
    },
    executionLayer: 'packageMetadata',
    reason: '床存在時，北牆床接觸區不可由北牆 atlas 越界認領'
  },
  {
    id: 'wardrobeContact',
    helper: 'r7310C1NorthWallHiddenByWardrobeContact',
    type: 'rectXY',
    activeWhen: {
      furnitureStateRef: 'northeastFurnitureMode',
      equals: 'wardrobe'
    },
    executionLayer: 'packageMetadata',
    reason: '衣櫃存在時，北牆衣櫃接觸區不可由北牆 atlas 越界認領'
  }
]

執行層定義：
  activeWhen 不要求 shader runtime gate 分模式。
  家具 mode 目前活在 JS package 選擇層：
    r7310C1NortheastFurnitureRuntimeMode
    r7310C1NorthWallActiveDiffuseRuntimePackage()

  因此家具 contact exclusion 的執行層是：
    bake-point / metadata builder 依 mode 產生 package alpha
    JS 依 mode 載入對應 package
    valid-linear 依 package alpha 決定是否取 atlas

  shader runtime gate r7310C1NorthWallOwnerExcluded 維持靜態三排除：
    side-wall
    door-hole
    beam-gap
```

### 5.3 activeWhen 判準

```text
1. activeWhen 成立時，mode-aware metadata builder 必須把該 contact 區寫進 package alpha。
2. activeWhen 成立時，JS package 選擇必須載入對應 mode 的 package。
3. activeWhen 成立時，package pointer 的 northeastFurnitureMode 必須等於該 mode。
4. activeWhen 不成立時，該 contact exclusion 不可影響另一個家具模式。
5. shader runtime gate 不新增 furniture mode uniform。
6. shader runtime gate 不分 bed / wardrobe。
7. contract 要同時驗 bed / wardrobe 兩個 mode。
```

## 6. 北牆族 1b policy 草案

### 6.1 D800 north wall base policy

```text
id: 'd800-north-wall'
surfaceId: 'north_wall'
precedence: 100
activationCondition:
  uR7310C1NorthWallDiffuseMode > 0.5

furnitureStateRef:
  northeastFurnitureMode

packageByMode:
  bed      -> base north-wall package
  wardrobe -> north-wall wardrobe package

mode-aware metadata:
  bed package:
    applies bedContact alpha policy
  wardrobe package:
    applies wardrobeContact alpha policy

exclusions:
  side-wall
  door-hole
  beam-gap
  bedContact      activeWhen bed      executionLayer packageMetadata
  wardrobeContact activeWhen wardrobe executionLayer packageMetadata
```

### 6.2 A1 XATLAS policy

```text
id: 'xatlas-a1-north-wall'
surfaceId: 'north_wall'
precedence: 200
activationCondition:
  uR7310C1NorthWallDiffuseMode > 0.5
  uR7310C1XatlasRuntimeMode > 0.5
  uR7310C1XatlasRuntimeReady > 0.5

furnitureStateRef:
  northeastFurnitureMode

packageByMode:
  bed      -> A1 full4x package
  wardrobe -> A1 full4x package

mode policy:
  A1 full4x 維持 mode-agnostic。
  A1 x 範圍 [-1.912, -1.518]。
  家具 contact x 範圍從 bed / wardrobe AABB 來看皆 >= -0.027。
  兩者幾何不相交。
  因此 A1 在 bed / wardrobe mode 共用同一包，不需要 furniture-aware A1 package。

exclusions:
  side-wall
  door-hole
  beam-gap
  bedContact      registered for registry completeness, no A1 geometry overlap
  wardrobeContact registered for registry completeness, no A1 geometry overlap
```

### 6.3 家具本體 owner policy

```text
家具本體 baked owner policy 移出 1b。

1b 的範圍：
  1. 北牆側 contact exclusion。
  2. furnitureStateRef。
  3. mode-aware package metadata。
  4. JS package 選擇與 pointer mode 對帳。

家具本體目前作為 live geometry。
contact 區由 package alpha 與 valid-linear 落回 live-trace。

若日後要把家具本體納入 baked owner，另開 phase 與規格。
```

## 7. contact exclusion 初步座標來源

```text
目前不能直接把下列幾何轉成正式 exclusion。
它們是規格審查的座標來源，正式值要走三步：
  1. AABB 投影當初值。
  2. bake 視角遮擋 / 可見性測試校正。
  3. 加 texel-footprint guard band。

bed.main:
  x [-0.027, 1.91]
  y [0.0, 0.28]
  z [-1.874, -0.314]

wardrobe.main:
  x [1.35, 1.91]
  y [0.0, 1.955]
  z [-1.874, -0.703]

北牆平面:
  z = -1.874

可能的 north-wall contact projection：
  bedContact:
    x [-0.027, 1.91]
    y [0.0, 0.28]

  wardrobeContact:
    x [1.35, 1.91]
    y [0.0, 1.955]

待審問題：
  1. bake 視角遮擋測試要採哪個工具輸出。
  2. texel-footprint guard band 要用 package resolution 還是 metadata texel spacing。
  3. contact 區是否排除整片矩形，或只排除靠牆的一條帶。
  4. bedContact 是否會誤傷北牆床後方可見區。
  5. wardrobeContact 是否等同既有 wardrobe package 的遮擋範圍。
```

## 8. 測試設計

### 8.1 registry contract

```text
檔案候選：
  docs/tests/r7-3-10-surface-owner-policy-furniture-state-contract.test.js

必驗：
  1. furnitureStateRef 存在。
  2. modeKey / allowedValues / defaultValue 正確。
  3. packageByMode bed / wardrobe 對到現有 pointer constants。
  4. 每個 mode 的 pointer JSON 內 northeastFurnitureMode 正確。
  5. bedContact / wardrobeContact 都有 activeWhen。
  6. activeWhen 的 mode 值在 allowedValues 內。
  7. UI state / runtime state / pointer JSON mode 三者對帳。
  8. activeWhen 的 executionLayer 必須是 packageMetadata。
  9. shader 不新增 furniture mode uniform。
```

### 8.2 activeWhen parity contract

```text
目的：
  確認同一個 contact exclusion 在 package / metadata / JS package 選擇三者的模式門控一致。

必驗：
  1. metadata builder 接收 northeastFurnitureMode 或等效 mode 參數。
  2. bed package metadata 啟用 bedContact alpha policy。
  3. wardrobe package metadata 啟用 wardrobeContact alpha policy。
  4. JS package 選擇 helper 依 r7310C1NortheastFurnitureRuntimeMode 選對 package。
  5. bed mode 只啟用 bedContact。
  6. wardrobe mode 只啟用 wardrobeContact。
  7. shader runtime gate 維持 mode-agnostic。
```

### 8.3 product route grid sweep

```text
1b 起 grid sweep 要升級。

1a 版本：
  測試自己重寫 owner 模型，作為基線可接受。

1b 版本要求：
  1. 驅動產品 JS route：
     r7310C1NortheastFurnitureRuntimeMode
     r7310C1NorthWallActiveDiffuseRuntimePackage()
     mode-aware metadata 判定
     r7310C1NorthWallOwnerExcluded

  2. 對以下點做 truth table：
     - A1 內部正常北牆點
     - D800-only 北牆點
     - door-hole 點
     - side-wall 點
     - beam-gap 點
     - bedContact 點
     - wardrobeContact 點
     - contact 外的可見北牆點

  3. 對以下模式做組合：
     - bed + XATLAS ready
     - bed + XATLAS not ready
     - wardrobe + XATLAS ready
     - wardrobe + XATLAS not ready

  4. 判準：
     啟用條件成立的 owner 中，最高 precedence 必須唯一。

  5. 不解析 shader furniture mode route，因為 shader 目前沒有 furniture mode。
```

### 8.4 package alpha audit

```text
若 1b 需要新 package 或確認既有 wardrobe package：

必驗：
  1. 該顯示的北牆可見區 alpha=1。
  2. contact exclusion 區依 mode 正確處理。
  3. alpha=1 的 gap / contact 區不得被 runtime 偷吃。
  4. rgbNonzeroAlphaZeroTexels = 0。
  5. owner 帳目零殘差。
```

## 9. 進場門檻

```text
OPUS 審規格時，請裁示以下 blocker。

1. 是否接受 furnitureStateRef 欄位。
2. 是否接受 activeWhen 欄位。
3. bedContact / wardrobeContact 是否都要納入 1b。
4. contact projection 初始座標如何定。
5. guard band 是否需要。
6. 是否接受 A1 full4x 在家具 mode 共用同一包。
7. 是否接受家具本體 baked owner policy 移出 1b。
8. 是否接受 grid sweep 驅動 JS/package/metadata route。
9. 1b code GOAL 是否先做 schema + tests + 現況 route probe。
10. 加入 contact 時，full-room 契約 wardrobeContact===undefined 是否同 commit 翻面。
```

## 10. 風險與護欄

```text
1. contact exclusion 過大
   風險：可見北牆被錯誤排除。
   護欄：grid sweep + package alpha audit 必須含 contact 外可見點。

2. contact exclusion 過小
   風險：家具與北牆交界仍有縫或亮帶。
   護欄：bed / wardrobe 兩組 contact 邊界點都進 truth table。

3. mode 門控漂移
   風險：UI 是 bed，runtime package 卻取 wardrobe。
   護欄：furnitureStateRef 對帳 UI state / runtime state / pointer JSON mode。

4. A1 與 D800 優先權漂移
   風險：XATLAS ready 時 D800 搶回 A1 範圍。
   護欄：延續 1a precedence invariant。

5. grid sweep 再次變成測試自寫模型
   風險：測試綠，產品 route 漂移。
   護欄：1b 起 grid sweep 必須讀 JS package 選擇、mode-aware metadata、OwnerExcluded。

6. 誤加 shader furniture uniform
   風險：規格外擴大產品改動。
   護欄：contract 明確掃 shader，不可新增 furniture mode uniform。

7. full-room 契約沒翻面
   風險：code 加了 contact exclusion，契約仍宣稱 wardrobeContact undefined。
   護欄：加入 contact 的同一 commit 必須更新 full-room 契約。
```

## 11. 建議 1b 實作順序

```text
Phase 0：OPUS 審本規格。

Phase 1：只補 registry schema 與 tests。
  - furnitureStateRef
  - activeWhen
  - mode parity contract
  - product route grid sweep

Phase 2：依 OPUS 裁示補 mode-aware metadata。
  - metadata builder 接 mode 參數
  - bedContact package alpha policy
  - wardrobeContact package alpha policy
  - full-room 契約 wardrobeContact 同 commit 翻面
  - shader runtime gate 維持 mode-agnostic

Phase 3：只跑現有 package / runtime 驗證。
  - 不重烤
  - 不改 pointer
  - 先用 truth table 與 browser route probe 看床邊縫隙走哪條 package / owner route

Phase 4：若證據指出 package 本身需要更新，再另開 bake GOAL。
  - contact 值流程：AABB 投影初值 → bake 遮擋校正 → texel-footprint guard band
  - 若需要新 package，再由 bake GOAL 處理
```

## 12. 給 OPUS 的審查問題

```text
1. furnitureStateRef 欄位是否足夠？
2. activeWhen 掛在 exclusion 上，執行層定為 packageMetadata，是否可收？
3. bedContact / wardrobeContact 初始座標是否能從家具 AABB 投影到北牆？
4. contact exclusion 的 guard band 是否用 texel-footprint 決定？
5. A1 full4x 在 bed / wardrobe mode 共用同一包是否可收？
6. 家具本體 baked owner policy 移出 1b 是否可收？
7. product route grid sweep 改成 JS package 選擇 + mode-aware metadata + OwnerExcluded 是否可收？
8. 加 contact 時，full-room 契約 wardrobeContact===undefined 同 commit 翻面是否可收？
9. 1b code GOAL 是否先限定 schema + tests + route probe，再另開 bake GOAL？
```

## 13. CODEX 暫定結論

```text
1. 1b 可以從 main 的 1a 成功狀態開工。
2. 本輪只建規格，不碰產品程式。
3. 家具變體的核心新增概念是 activeWhen + packageMetadata executionLayer。
4. mode 門控要跟 UI state、runtime state、pointer JSON、package metadata 對齊。
5. shader runtime gate 維持 mode-agnostic。
6. 東北床邊縫隙要先用 product route grid sweep 查 package / owner route，再決定是否改 code。
7. OPUS 審過 §12 後，再進 1b code GOAL。
```

---

## 14. OPUS 1b 規格審查裁示（2026-06-11）

唯讀核實，已對照 InitCommon.js / shader / 既有契約，未改產品程式、未重烤、未動 runtime pointer。

### 14.0 一句話裁示

```text
方向對，但有一個根本前提錯了，必須先修規格再進 code：
家具 mode 不是 shader uniform——shader 對 furniture 零引用，mode 完全活在 JS
（r7310C1NortheastFurnitureRuntimeMode，用 ==='wardrobe' 決定載哪個 package）。
所以 §5.3「activeWhen 成立時該 exclusion 必須被 shader runtime gate 使用」做不到：
runtime gate 沒有 mode uniform，要它分模式就得新增一條 shader uniform（規格沒承認的產品改動）。
正確的層：家具 contact exclusion 屬「package / bake 層」，由 JS 的 package 選擇 keying，
shader runtime gate 維持 mode-agnostic（只有 side-wall/door-hole/beam-gap 三條靜態）。
這點改掉，其餘欄位與測試設計大致可用。
```

### 14.1 根本前提修正：activeWhen 的執行層是 package/bake，不是 shader runtime gate【最高優先】

```text
核實證據：
  1. shader 對 "furniture" 零引用（唯一命中 glsl:4388 是 object ID，與 mode 無關）。
  2. mode 是 JS 變數 r7310C1NortheastFurnitureRuntimeMode（InitCommon.js:2344），
     用 ==='wardrobe' 在 r7310C1NorthWallActiveDiffuseRuntimePackage() 等決定載哪包。
  3. metadata builder buildR7310C1NorthWallTexelMetadataRect(width,height)（js:6063）
     不吃 mode 參數、body 無 wardrobe/bed/mode——目前 mode-agnostic。
     代表 bed 與 wardrobe 兩包的「有效 texel mask」目前相同（都只有靜態三排除），
     兩包差別在 radiance（家具遮光不同），不在 validity。這也是 §2.9
     full-room 契約仍斷言 wardrobeContact===undefined 的原因：contact 還沒進任何一包。

由此，1b 有兩條路，建議走 A：
  方案A（package metadata，mode-keyed，零新 shader uniform）【建議】
    - 讓 metadata builder 變 mode-aware：bed 包把 bedContact texel 標 alpha=0；
      wardrobe 包把 wardrobeContact 標 alpha=0。
    - shader runtime gate r7310C1NorthWallOwnerExcluded 維持「只有靜態三排除」，不碰 mode。
    - mode 門控＝JS 已在做的「載哪個 package」。valid-linear 取到 alpha=0 → 自動落 live-trace。
    - 三邊鏡像對 furniture contact 變成：bake-point(mode-aware builder) + package metadata
      + JS package 選擇；shader runtime gate 不參與 mode 分支。
  方案B（shader 新增 furniture uniform，runtime gate 分模式）
    - 較大改動，且與「package 已按 mode 切換」重複。不建議，除非有 A 無法覆蓋的即時需求。

裁示：採方案A。§5.2 / §5.3 / §6.1 / §6.2 要改寫——
  activeWhen 仍可掛在 exclusion 上，但「執行層」明確寫成
  bake-point(mode-aware) + package metadata + JS package 選擇，
  不要寫「shader runtime gate 必須用該 exclusion」（那會逼出不存在的 shader mode uniform）。
```

### 14.2 §12 八問逐項裁示

```text
Q1 furnitureStateRef 欄位足夠？
   足夠（modeKey/source.ui/source.runtime/setter/allowedValues/defaultValue/packageByMode）。
   兩個 URL 常數已核實存在（js:1511 bed、js:1669 wardrobe）。
   要補一點：contract 必須驗 UI state ↔ runtime state ↔ pointer JSON mode 三者一致
   （§10.3 漂移風險的守門），§8.1 item4 已含 pointer mode，再加 UI↔runtime 對帳。

Q2 activeWhen 掛 exclusion 還是 policy？
   掛 exclusion（每條 contact 各自按 mode 生效）。
   但執行層＝package/bake（見 14.1），規格要把這句寫死，否則會被讀成 shader 分支。

Q3 contact 座標從 AABB 投影？
   可當「起點」，不可當「定值」。
   核實：A1 x[-1.912,-1.518] 與 bed x[-0.027,1.91]、wardrobe x[1.35,1.91] 幾何不相交
   （A1 max x=-1.518 < bed min x=-0.027），所以 A1 與家具 contact 無關（接 Q5）。
   但「該排除的牆面」不等於「家具貼牆的 AABB 投影面」——要排除的是
   家具讓北牆 bake 變無效/被遮的 texel，可能比接觸面大。
   建議：投影面當初值，最終值用 bake 視角的遮擋/可見性測試校正，不要純幾何定值。

Q4 contact 需要 guard band？
   需要。比照 1a door-hole/beam-gap，guard band 尺寸由 atlas texel footprint（bilinear 觸及範圍）決定，
   避免接觸邊 bilinear 取樣把無效 texel 拉進來。這是 §16/§20 已立的原則。

Q5 A1 full4x 在 bed/wardrobe 共用同一包？
   共用，且 A1 維持 mode-agnostic、單一 full4x 包、不需 furniture-aware A1。
   理由：A1 西樑區（x≤-1.518）與家具（x≥-0.027）幾何不相交，家具遮光影響不到 A1。
   A1 policy 的 packageByMode = 兩 mode 同一包。

Q6 家具本體 owner policy 進 1b？
   不進。家具本體是 live geometry（path-traced），1b 只需「牆側 contact exclusion + 正確 package-by-mode」，
   contact 排除後該區自然 live-trace（含家具本體）。
   §6.3 的 precedence=300 家具本體 baked owner 先不做，保持 1b 最小。
   若日後家具本體要 baked light，另開 phase。

Q7 grid sweep 驅動 helper vs 解析 shader route？
   驅動 JS helper。因為 mode 在 JS、shader 無 mode 可解析。
   helper 集合要含 r7310C1NortheastFurnitureRuntimeMode + package 選擇 helper
   + mode-aware metadata 判定 + r7310C1NorthWallOwnerExcluded，不能只驅動 OwnerExcluded。

Q8 1b code GOAL 先限 schema+tests、不碰 bake/package？
   同意先 schema+tests + 用 grid sweep / browser route probe 查現況。
   但要先預告：方案A 的最終修法很可能要動 metadata builder（變 mode-aware）→ 是 bake-adjacent 改動，
   屆時另開 bake GOAL。先把這個方向寫進 Phase 4 預期。
```

### 14.3 進 1b code GOAL 前，規格要先改的項目

```text
1.（必改）§5.2/§5.3/§6.1/§6.2：activeWhen 執行層改寫成 bake-point(mode-aware)+package metadata
   +JS package 選擇；移除「shader runtime gate 必須分模式」的隱含要求。
2.（必加）A1 packageByMode = 兩 mode 同一包，明寫 A1 與家具 contact 幾何不相交、維持 mode-agnostic。
3.（必加）contact 值流程：AABB 投影為初值 → bake 視角遮擋測試校正 → 加 texel-footprint guard band。
4.（必加）furnitureStateRef contract 加 UI↔runtime↔pointer mode 三者對帳。
5.（必標）§2.9 full-room 契約 wardrobeContact===undefined 斷言，等 1b 加 wardrobeContact 時要同 commit 翻面
   （同 1a owner-policy-contract 時序教訓）。
6.（刪減）家具本體 baked owner policy（§6.3 precedence=300）移出 1b。
```

### 14.4 簽結

```text
1. 1b 規格方向正確，activeWhen 概念正確，但執行層前提錯（家具 mode 非 shader uniform）。
2. 採方案A：contact exclusion 落 package/bake 層、由 JS package 選擇 keying，shader runtime gate 不分模式。
3. §12 八問已逐項裁示（14.2）；進 code 前先改 14.3 六項。
4. 改好規格再交 OPUS 複審一次（只看 14.3 是否落實），通過才進 1b code GOAL。
5. 本節唯讀核實，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

## 15. CODEX 依 OPUS §14 裁示整合回填（2026-06-11）

本節只更新規格文字，未改產品程式、未改 shader、未改 runtime pointer、未重烤。

### 15.1 §14.3 六項落實狀態

```text
1. activeWhen 執行層已改寫
   已更新：
     §5.2 exclusion activeWhen
     §5.3 activeWhen 判準
     §6.1 D800 north wall base policy
     §6.2 A1 XATLAS policy

   現在明寫：
     activeWhen 不要求 shader runtime gate 分模式。
     執行層是 package metadata + mode-aware metadata builder + JS package 選擇。
     shader runtime gate r7310C1NorthWallOwnerExcluded 維持 mode-agnostic。

2. A1 packageByMode 已補
   §6.2 已明寫：
     bed      -> A1 full4x package
     wardrobe -> A1 full4x package
     A1 x 範圍 [-1.912, -1.518]
     家具 contact x 範圍皆 >= -0.027
     兩者幾何不相交，A1 維持 mode-agnostic。

3. contact 值流程已補
   §7 已改成三步：
     AABB 投影當初值
     bake 視角遮擋 / 可見性測試校正
     加 texel-footprint guard band

4. furnitureStateRef contract 已補 UI↔runtime↔pointer mode 對帳
   §8.1 已新增：
     UI state / runtime state / pointer JSON mode 三者對帳。

5. full-room 契約翻面已標
   §9 / §10 / §11 / §12 已標：
     目前 contract.c1NorthWallBatch.invalidTexelRegions.wardrobeContact === undefined。
     加 contact exclusion 時，full-room 契約要同 commit 翻面。

6. 家具本體 baked owner policy 已移出 1b
   §6.3 已改成：
     家具本體目前作為 live geometry。
     1b 只處理北牆側 contact exclusion、furnitureStateRef、mode-aware package metadata、JS package 選擇。
     家具本體 baked owner 若需要，另開 phase。
```

### 15.2 測試設計同步調整

```text
已更新 §8：

1. registry contract
   加 UI state / runtime state / pointer JSON mode 對帳。
   加 executionLayer 必須是 packageMetadata。
   加 shader 不新增 furniture mode uniform。

2. activeWhen parity contract
   改驗 package / metadata / JS package 選擇三者一致。
   移除 shader runtime gate mode 條件。

3. product route grid sweep
   改成驅動 JS route：
     r7310C1NortheastFurnitureRuntimeMode
     r7310C1NorthWallActiveDiffuseRuntimePackage()
     mode-aware metadata 判定
     r7310C1NorthWallOwnerExcluded

   並明寫：不解析 shader furniture mode route，因為 shader 目前沒有 furniture mode。
```

### 15.3 下一步

```text
請 OPUS 複審 §15 是否完整落實 §14.3。

若 §15 可收：
  下一步才進 1b code GOAL。

若 §15 仍有缺口：
  先繼續改規格，不碰產品程式。
```

---

## 16. OPUS §15 複審簽結（2026-06-11）

唯讀核實，逐項把 §15 宣告回正文核對（非只信 §15 清單），未改產品程式、未重烤、未動 runtime pointer。

### 16.0 結論：§15 完整落實 §14.3，規格可凍結，准進 1b code GOAL

```text
§14.3 六項在正文逐項核對全部到位，方案A 的執行層前提已一致改寫。
規格在 Option A 下內部一致，准進 1b code GOAL（先 schema+tests，bake 另開）。
```

### 16.1 §14.3 六項回正文核對（全綠）

```text
1. activeWhen 執行層改寫 → 已落實。
   §5.2 L169/180 executionLayer:'packageMetadata' + L185-200 執行層定義
   （明寫「不要求 shader runtime gate 分模式」、OwnerExcluded 維持靜態三排除）。
   §5.3 L209-210 item5/6「shader 不新增 furniture uniform / 不分 bed-wardrobe」。
   §6.1 L232-243 mode-aware metadata + 兩 contact executionLayer packageMetadata。
   §6.2 L264-277 mode policy 寫明不相交、exclusions 標 no A1 geometry overlap。✓

2. A1 packageByMode 同包 + 不相交 → §6.2 L260-269 bed/wardrobe 同 A1 full4x、x 不相交。✓

3. contact 值流程三步 → §7 L300-303 AABB 初值 → bake 遮擋校正 → texel-footprint guard band。✓

4. furnitureStateRef UI↔runtime↔pointer 對帳 → §8.1 L350 item7。✓

5. full-room 契約翻面時序 → §9 item10 / §10 risk7 / §11 Phase2 / §12 Q8 四處皆標同 commit 翻面。✓

6. 家具本體 baked owner 移出 1b → §6.3 L282-294 改為 live geometry、baked owner 另開 phase。✓

額外加分（超出六項、方向正確）：
  §8.1 item8/9（executionLayer 必為 packageMetadata、掃 shader 禁新增 furniture uniform）、
  §10 risk6（誤加 shader uniform 的 contract 守門）、§8.3 item5（不解析 shader furniture route）。
```

### 16.2 進 code GOAL 的兩個 sequencing / scope 提醒（非 blocker）

```text
1. metadata-alpha 翻轉 ≠ 重烤 radiance，要分清楚，能讓 1b 更輕。
   方案A 是「把 contact texel 的 validity 標 alpha=0」。validity mask 可只重生 metadata、
   radiance 不動（path-trace 不重跑）。若成立，1b Phase 2 走 metadata-only 重生即可，
   不必落 Phase 4 的完整重烤。請 Phase 2 先確認 metadata 能獨立重生再決定要不要 bake GOAL。
   （§3「不重烤」對 radiance 成立；metadata 重生是否算重烤，Phase 2 釐清並記錄。）

2. grid sweep 的「mode-aware metadata 判定」route 在 Phase 2 才上線。
   §8.3 把它列為被驅動 route，但該 helper 是 Phase 2 才建。
   Phase 1 的 grid sweep 先驅動既有 route（mode / package 選擇 / OwnerExcluded），
   mode-aware metadata 那段等 Phase 2 接上再補滿。順序講清楚即可，不影響凍結。
```

### 16.3 簽結

```text
1. §15 完整落實 §14.3，六項回正文核對全綠，規格凍結通過。
2. 准進 1b code GOAL：Phase 1 schema+tests + 現況 route probe → Phase 2 mode-aware metadata
   （含 full-room 契約同 commit 翻面、shader 維持 mode-agnostic）→ Phase 3 現況驗證 → Phase 4 視證據另開 bake GOAL。
3. 16.2 兩點為實作 sequencing 提醒，凍結後於 code GOAL 內處理。
4. 本節唯讀核實，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

## 17. CODEX Phase 1 code GOAL 回填（2026-06-11）

本節記錄 1b Phase 1 的實作與驗證。範圍維持在 schema、測試與 route probe；metadata builder、shader runtime gate、runtime pointer、正式 package 皆維持原狀。

### 17.1 實作內容

```text
1. 新增 R7310_C1_NORTHEAST_FURNITURE_STATE_REF。
   - modeKey: northeastFurnitureMode
   - UI source: c2NortheastFurnitureMode
   - runtime source: r7310C1NortheastFurnitureRuntimeMode
   - setter: window.setR7310C1NortheastFurnitureRuntimeMode
   - allowedValues: bed / wardrobe
   - packageByMode: northWall / eastWall / eastWallBeamShadow 三條 package 常數對照

2. 新增北牆家具 contact 候選登記。
   - bedContact: x[-0.027,1.91] y[0,0.28]
   - wardrobeContact: x[1.35,1.91] y[0,1.955]
   - executionLayer: packageMetadata
   - status: phase2-metadata-pending

3. D800 north-wall policy 補 furnitureStateRef / packageByMode / modeAwareExclusions。
   - bed 指向 R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL
   - wardrobe 指向 R7310_C1_NORTH_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL

4. A1 XATLAS policy 補 furnitureStateRef / packageByMode / modeAwareExclusions。
   - bed 與 wardrobe 共用 resolveR7310C1XatlasRuntimePackageUrl
   - A1 維持 mode-agnostic

5. 新增 browser route probe helper。
   - r7310C1NorthWallFurnitureOwnerRouteForPoint(point, options)
   - window.reportR7310C1NorthWallFurnitureOwnerRouteProbe(point, options)
   - 回傳 ownerExcluded、D800/A1 bounds 命中、winner、mode package URL

6. Home_Studio.html 的 InitCommon cache-buster 更新為 r7310-furniture-owner-1b-v1。
```

### 17.2 測試與驗證

```text
先紅後綠：
  node docs/tests/r7-3-10-surface-owner-policy-registry-contract.test.js
  初次失敗：缺 R7310_C1_NORTHEAST_FURNITURE_STATE_REF
  實作後：PASS

本輪通過：
  node docs/tests/r7-3-10-surface-owner-policy-registry-contract.test.js
  node docs/tests/r7-3-10-surface-owner-policy-grid-sweep.test.js
  node docs/tests/r7-3-10-xatlas-owner-policy-contract.test.js
  node docs/tests/r7-3-10-a1-contact-edge-registry-contract.test.js
  node docs/tests/r7-3-10-ne-furniture-wall-bake-variants.test.js
  node docs/tests/r7-3-10-c2-ne-furniture-toggle.test.js
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  node docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js
  node docs/tests/r7-3-10-xatlas-c2c-contract.test.js
  node docs/tests/r7-3-10-render-space-seam-gate.test.js
  node docs/tests/r7-3-10-seam-shared-constant-contract.test.js
  node --check js/InitCommon.js
  node --check js/Home_Studio.js
  node --check docs/html-review/2026-06-11-r7-3-10-furniture-owner-1b-plan/assets/html-review.js

測試同步：
  r7-3-10-ne-furniture-wall-bake-variants.test.js
    requestedSamples 從 exact 1000 改為 >=1000，配合 bed package 已升到 10000 samples 的現況。
  r7-3-10-c2-ne-furniture-toggle.test.js
    cache-buster 斷言改為檢查 InitCommon.js?v=r7310-*，避免鎖死舊版字串。
```

### 17.3 現況 route probe

```text
工具：
  .omc/r7-3-10-furniture-owner-1b/phase1-route-probe.mjs
  .omc/r7-3-10-furniture-owner-1b/phase1-route-probe-result.json

頁面：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-v1&xatlasPackage=a1-westbeam-full4x-oidn

probe 點：
  x=-0.050192
  y=0.050955
  z=-1.874

結果：
  bed mode:
    ownerExcluded=false
    d800InBounds=true
    a1InBounds=false
    winner=r7310-c1-d800-north-wall
    package=docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json

  wardrobe mode:
    ownerExcluded=false
    d800InBounds=true
    a1InBounds=false
    winner=r7310-c1-d800-north-wall
    package=docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json
```

### 17.4 判讀

```text
1. 使用者標的床邊點位於 A1 claimBounds 外，A1 不參與該點。
2. 靜態 owner gate 沒有排除該點，D800 north-wall owner 會認領。
3. bed / wardrobe 兩種 mode 都走 D800 owner，差異是 JS package 選擇已切到對應 package。
4. Phase 1 指向：床邊縫隙下一步要查 package metadata alpha / valid-linear，
   也就是 Phase 2 的 mode-aware metadata builder，而非 shader runtime gate。
```

### 17.5 交 OPUS 複審的問題

```text
1. Phase 1 schema 與測試是否可收？
2. route probe 顯示床邊點由 D800 owner 認領，是否同意 Phase 2 轉查 package metadata alpha？
3. Phase 2 是否先做 metadata-only 重生可行性調查，再決定是否需要完整 bake GOAL？
```

---

## 18. OPUS Phase 1 審查裁示（2026-06-11）

唯讀核實實機 diff、親自重跑 11 契約 + seam + node --check ×2（全綠），未改產品程式、未重烤、未動 runtime pointer。

### 18.0 結論

```text
Phase 1 schema + tests + route helper 可收。
方向同意：Phase 2 轉查 package metadata alpha / valid-linear（Option A 的正確戰場）。
metadata-only 重生可行性先查、再決定要不要完整 bake GOAL：同意。
但 §17.4 判讀漏了一個會直接決定 Phase 2 contact 取值的事實，必須補（見 18.2）。
```

### 18.1 Phase 1 核實（可收）

```text
1. R7310_C1_NORTHEAST_FURNITURE_STATE_REF 形狀正確（modeKey/source.ui/runtime/setter/
   allowedValues/defaultValue/packageByMode）。
2. modeAwareExclusions 兩條 executionLayer=packageMetadata、status=phase2-metadata-pending，
   正確標示「尚未在任何層生效」，與 Option A 一致。
3. route helper r7310C1NorthWallFurnitureOwnerRouteForPoint 驅動的是真實產品 route：
   r7310C1NorthWallOwnerExcluded、實際 policy claimBounds、r7310C1NortheastFurnitureRuntimeMode、
   package 選擇 helper；winner 按 precedence 排序（延續 1a 不變式）。符合 §14.2 Q7 裁示。
4. A1 packageByMode 兩 mode 共用 resolveR7310C1XatlasRuntimePackageUrl、維持 mode-agnostic。✓
5. 測試同步合理：ne-furniture-wall-bake-variants requestedSamples 改 >=1000（bed 包現況 10000）
   是放寬硬編、非放寬語意；c2-ne-furniture-toggle cache-buster 改 r7310-* glob 避免鎖死舊字串。
6. 我獨立重跑 11 契約 + seam + node --check ×2 全 PASS；shader / metadata builder / pointer 皆未動。
```

### 18.2 §17.4 判讀補正：probe 點落在 bedContact 候選「之外」【Phase 2 必看】

```text
事實（從實機常數核對）：
  probe 點 x = -0.050192
  bedContact 候選 xMin = -0.027（R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE）
  → -0.0502 < -0.027，probe 點在 bedContact 候選「西側約 2.3cm 外」。
  bed.main 西面也在 x=-0.027，所以這點是「床西緣再往西 2.3cm 的牆」。

兩個後果，Phase 2 必須處理：
  1. route probe 只回答「誰 own」（D800），不回答「這點是不是壞」。
     winner=D800 在 bedContact 外是「目前正確」的，不是 bug 證據。
     要判定床邊縫隙是不是缺陷，Phase 2 必須把 route probe 配上「視覺/alpha 證據」：
     在這點讀 D800 package 的 metadata alpha 與 valid-linear 取值，
     對照 LIVE，看 D800 radiance 在床緊鄰處是否失真。
  2. 若 x=-0.05 正是縫隙位置，那 bedContact 候選（xMin=-0.027）「蓋不到它」。
     這就實證了 §7 第3步 / 我 §14.2 Q4 的 guard band 需求，且給了具體校正方向：
     bedContact 西緣至少要往西擴到涵蓋 x≈-0.05（含 texel-footprint guard band）。
  3. 單點不足。Phase 2 要沿「床西緣 + 床頂緣（y≈0.28）」掃一排點，
     畫出 D800 radiance 失真區 vs live-trace 區的邊界，再回推 bedContact 正式值。
```

### 18.3 §17.5 三問裁示

```text
Q1 Phase 1 schema + tests 可收？
   可收。見 18.1。

Q2 同意 Phase 2 轉查 package metadata alpha / valid-linear？
   同意。route probe 已證該點不經 shader gate、由 D800 package 決定，正是 Option A 的 metadata/valid-linear 層。
   但 Phase 2 要把「ownership 探測」升級成「ownership + alpha/valid-linear + 對照 LIVE 的缺陷探測」，
   並把 18.2 的「probe 點在 bedContact 外」納入取值校正，不要直接拿 AABB 投影當定值。

Q3 Phase 2 先做 metadata-only 重生可行性調查？
   同意。先回答一個二擇一：package 的 alpha（validity）能否獨立於 radiance 重生？
     - 能 → 走 metadata-only：1b 可不重烤 radiance，只重生 validity mask，最輕。
     - 不能（alpha 與 radiance 同烤不可分） → 才需要 Phase 4 完整 bake GOAL。
   這個可行性結論要寫進 Phase 2 報告，作為「要不要開 bake GOAL」的依據。
```

### 18.4 簽結

```text
1. Phase 1 可收：schema / 測試 / route helper 全部核實正確、11 契約全綠、限制全守。
2. Phase 2 方向同意（package metadata alpha / valid-linear），但要：
   (a) route probe 升級成「含 alpha/valid-linear + 對照 LIVE」的缺陷探測；
   (b) 沿床西緣 + 頂緣掃點，畫出失真邊界；
   (c) 用掃點結果校正 bedContact 正式值 + guard band（probe 已暗示西緣要外擴）；
   (d) 先做 metadata-only 重生可行性結論，再決定要不要 bake GOAL。
3. 把 Phase 2 報告（含 (a)~(d)）交我審，通過才動 metadata builder。
4. 本節唯讀核實 + 親自重跑，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 19. CODEX Phase 2 CPU alpha / valid-linear 調查（2026-06-11）

本節回應 §18.4 的 Phase 2 要求。範圍維持在 CPU 檔案量測與 package 可行性調查；未改產品程式、未改 shader、未改 metadata builder、未重烤、未改 runtime pointer。因使用者已禁止 Brave，本輪不啟動 browser capture；LIVE 對照留到後續 Chrome 驗收或 OPUS 指定路徑。

### 19.1 量測工具與輸出

```text
工具：
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-edge-alpha-sweep.mjs
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-contact-grid-sweep.mjs
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-contact-alpha-projection.mjs

輸出：
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-edge-alpha-sweep.csv
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-edge-alpha-sweep.json
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-contact-grid-sweep.csv
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-contact-grid-sweep-full-coarse.csv
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-contact-grid-sweep-summary.json
  .omc/r7-3-10-furniture-owner-1b/phase2-bed-contact-alpha-projection.json

讀取 package：
  bed-separated：
    docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json
    assets/bakes/r7-3-10/c1-static-diffuse/north-wall-separated-1024px-1000spp
  wardrobe：
    docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json
    assets/bakes/r7-3-10/c1-static-diffuse/north-wall-wardrobe-door-hole-1024px-1000spp

共同參數：
  resolution = 1024
  north wall bounds = x[-2.11,2.11] y[0,2.905] z=-1.874
  texel footprint ≈ 0.004121m × 0.002837m
```

### 19.2 使用者點位與床西緣掃描

```text
使用者點位附近：
  x = -0.050192
  y = 0.050955

bed-separated package：
  alphaWeighted = 1
  validLinear = true
  lumaWeighted at x=-0.05 = 0.225817
  lumaWeighted at x=-0.027 = 0.010141
  lumaWeighted at x=-0.015 = 0
  lumaWeighted at x=0      = 0

wardrobe package 同點對照：
  lumaWeighted at x=-0.05  = 0.290274
  lumaWeighted at x=-0.027 = 0.275694
  lumaWeighted at x=-0.015 = 0.296465
  lumaWeighted at x=0      = 0.281171

判讀：
  1. OPUS §18.2 的判斷成立：x≈-0.05 在原 bedContact 候選 xMin=-0.027 外。
  2. 亮度斷崖從床西緣附近開始：x=-0.027 已接近全黑，x=-0.015 起為 0。
  3. alpha / valid-linear 在這些點全部維持有效，runtime 會吃 bed-separated atlas。
```

### 19.3 局部網格與全床寬掃描

```text
localWindow：
  掃描 x[-0.10,0.35] y[0,0.45]，step=0.005m，共 8,281 點。
  validLinearCount = 8,281
  invalidLinearCount = 0
  severeBounds（bed luma <= 0.05）：
    count=4,256
    x[-0.025,0.35] y[0,0.275]
  darkBounds（bed luma <= 0.12）：
    count=4,332
    x[-0.025,0.35] y[0,0.28]
  contrastBounds（wardrobe-bed >= 0.06）：
    count=4,805
    x[-0.10,0.35] y[0,0.28]
  alphaMismatchBounds（metadata valid + alpha valid + bed luma <= 0.12）：
    count=4,332
    x[-0.025,0.35] y[0,0.28]

fullCoarseWindow：
  掃描 x[-0.10,1.90] y[0,0.45]，step=0.02m × 0.01m，共 4,646 點。
  validLinearCount = 4,646
  invalidLinearCount = 0
  severeBounds（bed luma <= 0.05）：
    count=2,716
    x[-0.02,1.90] y[0,0.27]
  darkBounds（bed luma <= 0.12）：
    count=2,813
    x[-0.02,1.90] y[0,0.28]
  contrastBounds（wardrobe-bed >= 0.06）：
    count=2,060
    x[-0.10,1.34] y[0,0.28]
  alphaMismatchBounds：
    count=2,813
    x[-0.02,1.90] y[0,0.28]
```

### 19.4 Contact 範圍校正候選

```text
局部暗區 + guard band：
  basis = bed luma <= 0.12
  suggestedContact = x[-0.035,0.36] y[0,0.29]
  用途：對準使用者截圖縫隙位置，適合做局部驗證。

全床寬暗區 + guard band：
  basis = bed luma <= 0.12
  suggestedContact = x[-0.06,1.94] y[0,0.30]
  實作時 xMax 需套回北牆 side-wall / room bound，實質上不應超過可見北牆右界。
  用途：對準床貼牆整塊接觸區，適合做正式 bed package mask。

對照差異區 + guard band：
  basis = wardrobeMinusBed >= 0.06
  suggestedContact = x[-0.14,1.38] y[0,0.30]
  用途：指出肉眼明顯跳差的區域；這組較保守地排除床右側較亮區，需 OPUS 判斷是否符合家具幾何。
```

### 19.5 Alpha projection 乾跑

```text
originalCandidate x[-0.027,1.91] y[0,0.28]：
  total=46,530
  metadataValid=46,530
  alphaOne=46,530
  nonzero=1
  black=46,529
  maxLuma=0.000115

localDarkGuard x[-0.035,1.91] y[0,0.29]：
  total=48,042
  metadataValid=48,042
  alphaOne=48,042
  nonzero=1,513
  black=46,529
  maxLuma=0.493426

fullDarkGuard x[-0.06,1.91] y[0,0.30]：
  total=50,668
  metadataValid=50,668
  alphaOne=50,668
  nonzero=4,139
  black=46,529
  maxLuma=0.502279

判讀：
  原 bedContact 候選已覆蓋 46,529 個 alpha=1 的全黑 texel。
  現況 package 把這些 texel 當有效 atlas；valid-linear 不會落回 live。
  縫隙根因收斂為：bed mode package 的 contact validity mask 尚未切掉床後牆面。
```

### 19.6 Metadata-only 可行性

```text
既有工具：
  docs/tools/r7-3-10-sync-atlas-alpha-to-metadata.mjs

工具行為：
  讀 atlas-patch-000-rgba-f32.bin
  讀 texel-metadata-patch-000-f32.bin
  對 metadata valid flag <= 0.5 的 texel：
    atlas RGB = 0
    atlas alpha = 0
  寫回 atlas-patch-000-rgba-f32.bin
  產生 JSON report

可行性結論：
  metadata-only 路線可行，條件是：
    1. 先讓 metadata builder 依 mode 寫出 bedContact / wardrobeContact valid flag。
    2. 在複製出的新 package 目錄跑 alpha sync，不修改既有正式 package。
    3. 更新新 package 的 manifest / pointer hash 與 validation report。
    4. runtime pointer 維持不動，等 OPUS 審過與使用者肉眼驗收後再切換。

限制：
  這條路線只改 validity mask 與 alpha，保留 RGB radiance 來源。
  若後續肉眼驗收顯示 alpha 落 live 後仍有明顯錯位，再另開完整 bake GOAL。
```

### 19.7 Phase 2 結論與交 OPUS 審查問題

```text
已確認：
  1. 使用者點位由 D800 north-wall owner 認領，A1 不參與。
  2. bed-separated package 在床後接觸區 alpha=1、metadata valid、valid-linear=true。
  3. 同區 RGB radiance 大量為 0 或近 0，runtime 仍吃 atlas，因此形成床邊縫隙。
  4. wardrobe package 同世界點亮度正常，可作 bed mode 的對照。
  5. metadata-only alpha sync 有既有工具支撐；正式修法可先走 metadata-only 測試 package。

尚未做：
  1. LIVE 對照：本輪遵守使用者新限制，不碰 Brave；後續若要畫面對照，改用 Chrome。
  2. 正式 contact 值拍板：本節提供 dark / contrast / full-width 三組候選，等 OPUS 裁示。
  3. metadata builder 實作：等 OPUS 審過本報告再動。

交 OPUS 問題：
  Q1 是否接受根因收斂：
     bed mode package contact validity mask 未切掉床後牆面，導致 alpha=1 的黑 texel 被 runtime 取用。
  Q2 正式 bedContact 初版採哪組：
     A. originalCandidate x[-0.027,1.91] y[0,0.28]
     B. localDarkGuard x[-0.035,1.91] y[0,0.29]
     C. fullDarkGuard x[-0.06,1.91] y[0,0.30]
     D. contrastGuardPreview x[-0.11,1.38] y[0,0.30]
  Q3 是否同意下一步先做 metadata-only 測試 package：
     mode-aware metadata builder → copied package → alpha sync → local pointer / URL 驗收。
```

---

## 20. OPUS Phase 2 根因 + bedContact 取值裁示（2026-06-12）

唯讀核實 §19 全部數字與候選定義，未改產品程式、未重烤、未動 runtime pointer。

### 20.0 結論

```text
Q1 根因收斂：接受。證據定論（46,529/46,530 個 alpha=1 全黑 texel、valid-linear=true → runtime 吃黑 atlas）。
Q2 bedContact 初版：選 B（localDarkGuard x[-0.035,1.91] y[0,0.29]）。否決 A / C / D，理由見 20.2。
Q3 metadata-only 測試 package：同意。流程正確、sync 工具已存在、不碰正式 package 與 pointer。
但 B 是「待 LIVE 確認」的初版；LIVE（Chrome）對照前不得拍板鎖死。
```

### 20.1 Q1 根因 — 接受

```text
bed-separated package 在床後接觸區 alpha=1 + metadata valid + valid-linear=true，
但 RGB 大量為 0（§19.5 原候選 46,530 中 46,529 黑）。runtime 因此吃到黑 atlas → 床邊縫隙。
wardrobe 同點正常（§19.2 luma 0.27-0.29）佐證這是 bed package validity mask 漏切，不是幾何或 shader。
根因「bed mode package contact validity mask 未切掉床後牆面」成立，且正是 Option A 的戰場。
```

### 20.2 Q2 bedContact 取值 — 選 B，否決 A / C / D

```text
先釐清 §19.2 亮度斷崖（這點改變了直覺答案）：
  bed luma：x=-0.05 → 0.2258（亮）；x=-0.027 → 0.010（近黑）；x<=-0.015 → 0（全黑）。
  → 使用者點 x=-0.0502「是亮牆」，不是黑瑕疵本身。
  → 真正的黑瑕疵區從 x≈-0.027 knee 起、x<=-0.015 全黑，向東延伸到 x≈1.90（全床寬）。
  → 使用者看到的「縫」＝這條「亮→黑」斷崖，黑側該 live-trace、亮側該保留。

該排除的＝黑瑕疵區 + texel-footprint guard band（texel x≈0.004121m，§19.1）。
  knee 在 -0.027；往西 2 texel(≈0.008m) → xMin≈-0.035。

逐案：
  A x[-0.027,1.91] y[0,0.28]：剛好壓在 knee、零 guard band。
    bilinear 會把黑 texel 混進西側亮區 → 殘留半黑毛邊。否決（正是 §14.2 Q4 要 guard 的原因）。
  B x[-0.035,1.91] y[0,0.29]：黑區 + 約 2 texel 西側 guard；xMax=1.91 覆蓋全床寬。【選這個】
    - 西緣 -0.035 落在亮→黑過渡帶（luma~0.1），live-trace 接手點順、不吃掉 x<=-0.05 的亮牆(0.226)。
    - xMax=1.91 正好等於 side-wall 東界(R7310_C1_NORTH_WALL_SIDE_WALL_EAST_X_MIN=1.91)，一致不越界。
    - 使用者點 x=-0.0502 是亮牆，B 不排除它＝正確（不該把亮牆改 live）。
  C x[-0.06,1.91] y[0,0.30]：西緣 -0.06 吃進 3cm 亮牆（x[-0.06,-0.027] luma 到 0.22）。
    過度排除合法亮牆、可能把縫往西推到 -0.06，而非消除。否決（除非 LIVE 證明 B 西緣仍有殘縫才放寬）。
  D x[-0.11,1.38] y[0,0.30]：用 contrast(wardrobe-bed) 當基準是錯指標——
    contrast 在 x[1.35,1.91] 低是因為該處兩 mode 都被家具遮黑，但 bed mode 那段仍是黑瑕疵、仍要切。
    D 的 xMax=1.38 會把床東半 x[1.38,1.90] 的黑區漏掉 → 床右側縫殘留。否決。

裁示：B。它是「全床寬黑區 + 細掃西緣 guard」的正確組合（§19.4 局部西緣 -0.035 ⊕ 全寬東界 1.91）。
```

### 20.3 Q3 metadata-only 測試 package — 同意

```text
同意先走 metadata-only，且這回答了我 §18.3 Q3 的可行性：alpha(validity) 能獨立於 radiance 重生
（docs/tools/r7-3-10-sync-atlas-alpha-to-metadata.mjs 已支援，不需重烤 radiance）。
流程照 §19.6：
  1. mode-aware metadata builder 依 mode 對 bedContact(B 值) 寫 valid=0。
  2. 複製出新 package 目錄跑 alpha sync，不動既有正式 package。
  3. 更新新 package 的 manifest / pointer hash / validation report。
  4. runtime pointer 不動，等 LIVE + 使用者肉眼驗收過再切換。
  full-room 契約 wardrobeContact===undefined 翻面要與「contact 進 registry」同 commit（§14.3 第5）。
```

### 20.4 LIVE 為唯一未補證據（拍板前必做）

```text
B 是 CPU 推導的初版，仍缺 LIVE 對照。CPU 能證「哪裡 alpha=1 黑」，證不到「換 alpha=0 後 live-trace 是否補得順」。
依烘焙面驗收紀律（與 LIVE 對照約 10 SPP 即可判讀，非 500 SPP 累積），驗收條件：
  bed mode、床西緣 + 頂緣 ROI、新 metadata-only package vs LIVE：
    1. 亮→黑斷崖消失、live-trace 接手處無新硬邊。
    2. x<=-0.05 的亮牆未被吃掉（未過度排除）。
    3. 床右側 x[1.38,1.90] 無殘縫（驗 B 的全寬東界有效、佐證否決 D）。
  Brave 禁用，走 Chrome 路線。
若 LIVE 顯示 B 西緣仍殘縫 → 才放寬向 C；若顯示過度排除 → B 不會發生（B 已貼黑區）。
拍板鎖死 bedContact 正式值，須在 LIVE 通過後。
```

### 20.5 簽結

```text
1. Q1 接受根因；Q2 選 B（否決 A/C/D，理由 20.2）；Q3 同意 metadata-only 測試 package。
2. B 為待 LIVE 初版；Chrome LIVE 對照（20.4 三條）通過才拍板。
3. 下一步：CODEX 做 mode-aware metadata builder + 複製 package + alpha sync(B 值) + local pointer，
   交我審「builder 是否 mode-aware、是否只動複製包、契約翻面是否同 commit」，
   並備 Chrome LIVE 截圖給使用者肉眼驗收。
4. 本節唯讀核實，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

## 21. CODEX Phase 2 實作回填（metadata-only 測試包）

本節記錄依 §20 裁示完成的 Phase 2 實作。範圍維持在 metadata-aware package 產製與本機驗收入口；正式 runtime pointer 未切換，path tracing radiance 未重烤。

### 21.1 程式與契約變更

```text
1. bedContact 取值更新為 §20 選定的 B：
   x[-0.035,1.91] y[0,0.29]

2. mode-aware metadata helper 已建立：
   r7310C1NorthWallOwnerExcludedForMetadata(x, y, mode)
   - bed mode 啟用 bedContact
   - wardrobe mode 啟用 wardrobeContact
   - shader runtime gate 維持 mode-agnostic，沒有新增 furniture uniform

3. buildR7310C1NorthWallTexelMetadataRect(width,height,options) 已接收 northeastFurnitureMode。
   capture 端在 north-wall patchId=1002 時傳入 options.northeastFurnitureMode。

4. full-room 契約已翻面：
   c1NorthWallBatch.invalidTexelRegions.bedContact
   c1NorthWallBatch.invalidTexelRegions.wardrobeContact
   兩者皆標 executionLayer=packageMetadata 與 activeWhen。

5. 新增安全本機 pointer 覆寫：
   - northWallPackage
   - northWallBedPackage
   - northWallWardrobePackage
   預設仍回原正式 pointer；帶 query 時才載入測試 pointer。
```

### 21.2 metadata-only 測試包

```text
工具：
  docs/tools/r7-3-10-north-wall-contact-alpha-package.mjs

輸入正式 bed pointer：
  docs/data/r7-3-10-c1-north-wall-separated-diffuse-runtime-package.json

輸出測試 pointer：
  docs/data/r7-3-10-c1-north-wall-separated-bed-contact-b-alpha-test-runtime-package.json

輸出測試 package：
  assets/bakes/r7-3-10/c1-static-diffuse/north-wall-separated-1024px-1000spp-bed-contact-b-alpha-test/

正式 package：
  未覆寫、未改 pointer、未重烤 radiance。
```

### 21.3 alpha sync 結果

```text
bedContact(B) 內：
  contactTexels = 48,042
  newlyInvalidatedTexels = 48,042
  invalidAtlasAlphaOneBefore = 48,042
  invalidBrightTexelsBefore = 1,513
  maxInvalidLumaBefore = 0.493426
  invalidAtlasAlphaOneAfter = 0
  invalidBrightTexelsAfter = 0

測試包整體：
  texelCount = 1,048,576
  validTexels = 755,700
  invalidTexels = 292,876
  validTexelRatio = 0.7206916809

判讀：
  原本會被 runtime 取樣的 bedContact 黑 atlas 區，已在測試包中變成 alpha=0。
  valid-linear 將不再吃該區 atlas，會交回即時光追。
```

### 21.4 測試與驗證

```text
先紅後綠：
  node docs/tests/r7-3-10-surface-owner-policy-registry-contract.test.js
    先紅：contact status / B 值 / mode-aware metadata helper 尚未存在
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    先紅：bedContact / wardrobeContact 尚未登記
  node docs/tests/r7-3-10-ne-furniture-wall-bake-variants.test.js
    先紅：northWallPackage query 覆寫 helper 尚未存在

已通過：
  node docs/tests/r7-3-10-surface-owner-policy-registry-contract.test.js
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
  node docs/tests/r7-3-10-ne-furniture-wall-bake-variants.test.js
  node docs/tests/r7-3-10-ne-furniture-contact-alpha-package.test.js
  node --check js/InitCommon.js
  node --check docs/tools/r7-3-10-north-wall-contact-alpha-package.mjs
```

### 21.5 Chrome 驗收入口

```text
測試 URL（Chrome 使用；Brave 禁用）：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-bed-contact-b-alpha-test&northWallPackage=docs/data/r7-3-10-c1-north-wall-separated-bed-contact-b-alpha-test-runtime-package.json&xatlasPackage=a1-westbeam-full4x-oidn

待肉眼驗收三點：
  1. 床西緣 + 頂緣的亮→黑斷崖消失。
  2. x<=-0.05 的亮牆未被吃掉。
  3. 床右側 x[1.38,1.90] 無殘縫。
```

### 21.6 OPUS 複審焦點

```text
請核對：
  1. builder 是否真 mode-aware。
  2. 測試 package 是否只改複製包，正式 package / 正式 pointer 未動。
  3. full-room 契約翻面是否與 contact 進 registry 同步。
  4. local pointer query 覆寫是否只影響明確帶參數的本機驗收 URL。
  5. Chrome LIVE / 肉眼驗收通過前，B 值仍維持「測試初版」身分。
```

---

## 22. OPUS Phase 2 WIP 診斷包審查裁示（2026-06-12）

唯讀核實實機 diff、新測試斷言、正式包保護、B 值散布，未改產品程式、未重烤、未動 runtime pointer。

### 22.0 結論

```text
口徑更正接受：1024 planar_xy 方格包是工程診斷包，不能當畫質驗收；CODEX 自我校正正確。
Q1 診斷包機制：可收（alpha 排除、mode-aware builder、route、正式包保護都核實正確）。
   但有一個與 1a 同型的 desync 風險要先收：B 值(-0.035) 散在 7 檔、無 parity 綁單一真相，
   且 full-room 官方契約已嵌入這個「尚未 LIVE 驗證」的 B 值。
Q2 轉非方格高解析 raw/OIDN 給 Chrome 肉眼驗收：同意，但 LIVE 是 B 拍板的前提，
   官方基準翻面宜在 LIVE 後（或現在標 provisional + 補 parity）。
```

### 22.1 Q1 機制核實（可收的部分）

```text
1. mode-aware helper r7310C1NorthWallOwnerExcludedForMetadata(x,y,mode) 正確：
   靜態三排除 OR (wardrobe && wardrobeContact) OR (bed && bedContact)，Option A 正解。
2. buildR7310C1NorthWallTexelMetadataRect(width,height,options) 接 northeastFurnitureMode，
   走 OwnerExcludedForMetadata。✓
3. alpha sync 驗證紮實：新測試斷言 contactValid=0 / contactAlphaOne=0 / contactNonzero=0（48,042 全切），
   且對 source 與 test 兩包都驗 sha256。黑 atlas 區確實被排除。✓
4. 正式包保護：正式 north-wall-separated-diffuse 包未被改（git 只有新增 ?? 診斷包與 bake dir）；
   新測試還比對 source 包 hash 確保未被覆寫。✓
5. registry 常數 R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE 已從 A(-0.027) 更新到 B(-0.035)，無 A/B 內部 desync。✓
6. c2-toggle 的 -0.027 是 bed.min 幾何座標，非 stale bedContact 西緣，無誤。✓
```

### 22.2 Q1 必收的 desync 風險：B 值 7 檔散布、無 parity、官方基準提前翻面【1a 同型】

```text
B 值(-0.035) 目前獨立硬寫在 7 個檔：
  js/InitCommon.js（常數＝單一真相，正確）
  docs/tools/r7-3-10-north-wall-contact-alpha-package.mjs（L9 硬寫 -0.035，未讀常數）← 漂移源
  docs/data/r7-3-10-full-room-diffuse-bake-contract.json（官方契約基準，已翻面嵌入 B）
  docs/data/...bed-contact-b-alpha-test-runtime-package.json（診斷包，合理）
  docs/tests/full-room-diffuse-bake-contract.test.js（drift 偵測，合理但見下）
  docs/tests/surface-owner-policy-registry-contract.test.js（drift 偵測，合理）
  docs/tests/ne-furniture-contact-alpha-package.test.js（drift 偵測，合理）

問題：
  1. .mjs 工具硬寫 -0.035、沒讀 R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE。
     這正是 1a 殺掉的「裸數字多份複本」回潮。工具應讀常數。
  2. full-room 測試雖 readFileSync('js/InitCommon.js')，但只為 large-face loader 檢查，
     沒有對 bedContact 做「json === InitCommon 常數」parity。
     → full-room json 的 bedContact 與單一真相常數可獨立漂移，無人攔。
  3. full-room 是「官方架構契約」，已被翻面宣告 bedContact/wardrobeContact，
     但這個 B 值尚未 LIVE 驗證（§20.4 明列 LIVE 為拍板前提），
     且正式 runtime 包（pointer）並未帶這些 invalid 區——官方基準領先產品。

要收的修正（純測試/工具，零畫質依賴）：
  a. .mjs 工具改讀 R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE，不硬寫 -0.035。
  b. 補 parity：full-room json bedContact（與診斷包 json）必須對 InitCommon 常數逐值比對，
     讓單一真相驅動其餘、post-LIVE 改 B 只改一處、parity 強制其餘跟上。
  c. full-room 官方基準的翻面標為 provisional，或改成「LIVE 拍板 B + 正式包重生」同 commit 才翻
     （延續 §14.3 第5 的時序精神：契約不領先產品）。
```

### 22.3 Q2 轉非方格高解析 raw/OIDN — 同意，附條件與時序

```text
同意產出非方格高解析 raw + OIDN 給 Chrome 肉眼驗收。這是 B 拍板的關鍵證據（§20.4）。
條件：
  1. 以非方格高解析 D800 北牆包為來源（與正式 runtime 架構一致，非 1024 方格診斷架構）。
  2. 套同一個 bedContact B metadata alpha 規則（且 B 來自單一真相常數，見 22.2）。
  3. raw 無 OIDN 一份 + OIDN 一份。
  4. Chrome-only，URL 明確標示「肉眼驗收包」，與 1024 工程診斷 URL 分流。
  5. 驗收檢查（烘焙面紀律，約 10 SPP 對照 LIVE）：
     - §20.4 三條（斷崖消失/西側亮牆未被吃/床右側 x[1.38,1.90] 無殘縫）。
     - 新增第四條：B 內 1,513 個 bright texel（maxLuma 0.49）被設 alpha=0 後，
       live-trace 接手是否自然、有沒有把亮過渡帶變暗或造成新暗塊。
時序建議：
  Q2 的 LIVE 驗收「先於」把 B 鎖進官方 full-room 基準。
  也就是：先出高解析 raw/OIDN → Chrome LIVE → 使用者肉眼拍板 B →
  再以單一真相常數定 B + 正式包重生 + full-room 翻面 + parity，全部同 commit。
```

### 22.4 簽結

```text
1. 口徑更正接受；Q1 機制可收（alpha 排除/builder/route/正式包保護核實正確）。
2. Q1 收尾前補 22.2 三項（工具讀常數、補 bedContact parity、官方基準翻面標 provisional 或延到 LIVE 同 commit）。
3. Q2 同意產非方格高解析 raw/OIDN 給 Chrome 肉眼驗收，照 22.3 五條件；LIVE 先於官方基準拍板。
4. 本節唯讀核實，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 23. CODEX Phase 2 WIP 收尾回填（Q1 desync 風險關閉）

本節回應 §22.2 的三個 Q1 收尾項。範圍仍是工程診斷包收尾，不是非方格高解析肉眼驗收；正式 runtime pointer 未改，正式 package 未覆寫，未啟動 Brave。

### 23.1 已修正項目

```text
1. 工具改吃單一真相
   檔案：
     docs/tools/r7-3-10-north-wall-contact-alpha-package.mjs
   變更：
     移除工具內硬寫 CONTACTS。
     新增 loadContactCandidates()，從 js/InitCommon.js 讀：
       R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE
       R7310_C1_NORTH_WALL_WARDROBE_CONTACT_CANDIDATE
   結果：
     bedContact B 值只由 InitCommon 常數決定，工具輸出跟隨單一真相。

2. full-room 契約補 parity
   檔案：
     docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
   變更：
     新增 parseJsObjectConst() / assertRegionMatchesJsConst()。
     contract.c1NorthWallBatch.invalidTexelRegions.bedContact
       逐值比對 R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE。
     contract.c1NorthWallBatch.invalidTexelRegions.wardrobeContact
       逐值比對 R7310_C1_NORTH_WALL_WARDROBE_CONTACT_CANDIDATE。
   結果：
     full-room JSON 若與 InitCommon 常數漂移，測試會紅。

3. 官方契約標 provisional
   檔案：
     docs/data/r7-3-10-full-room-diffuse-bake-contract.json
   變更：
     bedContact / wardrobeContact 加上：
       status: provisional-pending-live-acceptance
   結果：
     full-room 契約可記錄 Phase 2 診斷值，但不把 B 值偽裝成已經 LIVE 拍板的正式基準。

4. 診斷 pointer 同步標 provisional
   檔案：
     docs/data/r7-3-10-c1-north-wall-separated-bed-contact-b-alpha-test-runtime-package.json
   變更：
     invalidTexelRegions.bedContact / wardrobeContact 加上同一個 provisional status。
   結果：
     使用這個 local pointer 時，資料本身也明確標示它是待 LIVE 驗收的測試值。
```

### 23.2 TDD 與驗證

```text
先紅：
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    失敗點：full-room JSON 缺 provisional status。

  node docs/tests/r7-3-10-ne-furniture-contact-alpha-package.test.js
    失敗點：工具沒有引用 R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE，
            且仍有 const CONTACTS。

轉綠：
  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    PASS

  node docs/tests/r7-3-10-ne-furniture-contact-alpha-package.test.js
    PASS

  node --check docs/tools/r7-3-10-north-wall-contact-alpha-package.mjs
    PASS
```

### 23.3 目前狀態

```text
Q1 三項已關：
  a. 工具讀常數，不再硬寫 -0.035。
  b. full-room JSON 與 InitCommon contact 常數有 parity。
  c. 官方契約與診斷 pointer 都標 provisional，等待 LIVE 肉眼驗收再拍板。

仍未做：
  1. 非方格高解析 raw 診斷/驗收包。
  2. 非方格高解析 OIDN 診斷/驗收包。
  3. Chrome LIVE 肉眼驗收。
  4. 正式 package 重生。
  5. 正式 runtime pointer 切換。

下一步：
  依 §22.3 產出非方格高解析 raw + OIDN 兩份，Chrome-only，並明確標成肉眼驗收包。
```

### 23.4 請 OPUS 複審

```text
請核對：
  1. .mjs 是否已從 InitCommon 讀取 bed/wardrobe contact 常數。
  2. full-room 契約 parity 是否足以擋 JSON 與 InitCommon 漂移。
  3. provisional status 是否滿足「LIVE 拍板前官方契約不正式鎖 B」的時序要求。
  4. 是否可進 §22.3 的非方格高解析 raw/OIDN 產出。
```

---

## 24. CODEX Phase 2 高解析 raw/OIDN 驗收包回填

本節回應 §22.3：產出非方格高解析 raw 與 OIDN 兩份肉眼驗收包。這兩份包只改 D800 non-square atlas 的 bedContact alpha/RGB，不跑 path tracing，不改正式 runtime pointer，不覆寫正式 source package。

### 24.1 產出包

```text
raw 高解析驗收包：
  pointer:
    docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-b-alpha-raw-runtime-package.json
  package:
    assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-d800-bed-contact-b-alpha-raw-3379x4043-1000spp
  source:
    docs/data/r7-3-10-c1-north-east-non-square-d800-preview-runtime-package.json

OIDN 高解析驗收包：
  pointer:
    docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-b-alpha-oidn-runtime-package.json
  package:
    assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-d800-bed-contact-b-alpha-oidn-3379x4043-1000spp
  source:
    docs/data/r7-3-10-c1-north-east-non-square-d800-denoise-c-preview-runtime-package.json
```

### 24.2 尺寸與來源

```text
兩份驗收包共同規格：
  targetAtlasWidth  = 3379
  targetAtlasHeight = 4043
  northWall face    = 3379 × 2327
  requestedSamples  = 1000
  diffuseOnly       = true
  upscaled          = false

這是 D800 non-square 北牆高解析路徑，不是 1024 planar_xy 診斷包。
```

### 24.3 bedContact B alpha 結果

```text
bedContact B：
  x[-0.035, 1.91]
  y[0, 0.29]

raw：
  contactTexels             = 361,456
  contactAlphaOneBefore     = 361,456
  contactBrightTexelsBefore = 14,033
  maxContactLumaBefore      = 0.5048286006
  contactAlphaOneAfter      = 0
  contactBrightTexelsAfter  = 0

OIDN：
  contactTexels             = 361,456
  contactAlphaOneBefore     = 361,456
  contactBrightTexelsBefore = 17,461
  maxContactLumaBefore      = 0.5015701311
  contactAlphaOneAfter      = 0
  contactBrightTexelsAfter  = 0
```

### 24.4 Chrome 肉眼驗收網址

```text
raw 無 OIDN：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-b-alpha-raw&nonSquarePackage=d800-bed-contact-b-alpha-raw&xatlasPackage=a1-westbeam-full4x-raw

OIDN：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-b-alpha-oidn&nonSquarePackage=d800-bed-contact-b-alpha-oidn&xatlasPackage=a1-westbeam-full4x-oidn
```

### 24.5 驗證

```text
新增工具：
  docs/tools/r7-3-10-north-wall-contact-alpha-nonsquare-package.mjs

新增測試：
  docs/tests/r7-3-10-ne-furniture-contact-alpha-nonsquare-package.test.js

已通過：
  node docs/tests/r7-3-10-ne-furniture-contact-alpha-nonsquare-package.test.js
  node docs/tests/r7-3-10-non-square-data-path.test.js
  node --check docs/tools/r7-3-10-north-wall-contact-alpha-nonsquare-package.mjs

cache-buster：
  Home_Studio.html 的 InitCommon.js query 已 bump 到 r7310-furniture-owner-1b-v3，
  確保 Chrome 載入含新 nonSquarePackage key 的 InitCommon。
```

### 24.6 請 OPUS 複審

```text
請核對：
  1. raw/OIDN 兩份是否確實為 D800 non-square 高解析包。
  2. non-square alpha sync 是否只改複製包，不碰 source package。
  3. contact 區 alpha/RGB 是否已全清為 0。
  4. resolver key 是否能讓 Chrome 以 nonSquarePackage 切到兩份新包。
  5. 這兩個網址是否可交使用者作肉眼驗收。
```

---

## 25. OPUS Phase 2 高解析驗收包審查裁示（2026-06-12）

唯讀核實 artifacts + Q1 收尾 + 親自 Chrome preview 自驗 OIDN 網址，未改產品程式、未重烤、未動正式 runtime pointer。

### 25.0 結論

```text
六點資料層全部核實通過；Q1 三項 desync 收尾確認到位。
我額外用 Chrome preview（9006，與 Brave 禁用相容）自驗 OIDN 網址：
  可開、非黑、新 OIDN 包與 3379×4043 atlas 都 200 載入、床模式 + 北東非方格:開、累積中、零 console error。
唯一要補：兩條網址沒有對準床西緣 contact 的相機預設 / ROI 指示，
與 CODEX 自己 §22.3 條件4「URL 明確標示當前要看哪個交界」有落差。
補上 ROI 框定再交使用者，否則可能重演上一輪「看錯區/用錯標準」的驗收口徑錯誤。
```

### 25.1 六點逐項核實

```text
1. raw/OIDN 是否 D800 non-square 高解析包：是。
   兩包 targetAtlas 3379×4043、northWall face 3379×2327、diffuseOnly=true、upscaled=false。
2. non-square alpha sync 是否只改複製包：是。
   git 顯示 source（non-square-d800-preview / denoise-c-preview）未動；新包與 bake dir 皆 untracked 新增。
3. contact 區 alpha/RGB 是否全清 0：是。
   新測試實讀 atlas binary：contactAlphaOne=0、contactNonzero=0（raw 361,456／OIDN 361,456 全切）。
   sync 報告 contactAlphaOneAfter=0、contactBrightTexelsAfter=0（raw 14,033／OIDN 17,461 bright texel 也清掉）。
4. resolver key 切包：是。
   resolveR7310C1NonSquarePackageUrl() 認 nonSquarePackage=d800-bed-contact-b-alpha-raw / -oidn；
   Chrome network 實證 OIDN 包 JSON(.22) 與其 atlas .bin(.62) 都 200。
5. URL 可交驗收：技術面可（見 25.2），但要補 ROI 框定（見 25.3）。

Q1 三項收尾（§22.2）：
  a. .mjs 工具改讀 R7310_C1_NORTH_WALL_BED/WARDROBE_CONTACT_CANDIDATE（readRect），不再硬寫 -0.035。✓
  b. full-room 契約加 bedContact/wardrobeContact 對 InitCommon 常數的 parity（L306/322）。✓
  c. full-room JSON 與兩新包 contact 區標 status: provisional-pending-live-acceptance。✓
獨立重跑 11 契約 + seam + node --check 全 PASS。
```

### 25.2 Chrome preview 自驗（依交付網址自驗紀律）

```text
工具：Claude preview（Chrome），9006 埠（9002 被 CODEX server 佔用；package 解析只看 query，與埠無關）。
導向 OIDN 網址後實測：
  - 可開：頁面 200、3D 房間完整渲染。
  - 非黑：天花燈、牆面、吸音板、喇叭、地板皆正常；非全黑（render 鏈正常）。
  - 非 smoke 包：network 確認載入 r7-3-10-...-d800-bed-contact-b-alpha-oidn 包 + 3379×4043 atlas（真高解析，非 1024 診斷）。
  - 模式正確：UI「床」高亮、「北東非方格烘焙：開」。
  - 累積：Samples 正在累積（低 SPP，烘焙面對照約 10 SPP 即可判讀，符合紀律）。
  - 零 console error、network 無 failed。
自驗後已停掉 9006 preview server。
```

### 25.3 要補：相機 / ROI 未框定床西緣 contact【交使用者前必補】

```text
§24.4 只給兩條網址，沒有相機預設或「看哪個交界」的指示。
我自驗時預設相機是房間廣角，床西緣 contact 縫（x≈-0.05、貼地 y[0,0.29]）並未清楚入框。
後果：使用者可能找不到正確交界、或對錯區域下判斷——正是上一輪「用錯畫質標準」口徑錯誤的同型風險。
CODEX 自己 §22.3 條件4 已承諾「URL 明確標示當前要看哪個交界」，§24.4 未落實。
補法（擇一）：
  1. 在網址附帶可直接定位床西緣/床後牆基的相機預設（視角參數或 cameraState）。
  2. 或在交付訊息明確寫：載入後切到哪個視角、看床的哪一側貼牆處、對照 LIVE 看斷崖是否消失。
並附 §20.4 三條 + §22.3 第四條（1,513/14,033 bright texel 設 alpha=0 後 live-trace 是否自然）當驗收檢查清單。
```

### 25.4 簽結

```text
1. 六點資料層全部通過；Q1 三項 desync 收尾到位；Chrome 自驗可開/非黑/正確包/零錯誤。
2. 兩條高解析網址「技術面」可交驗收；交付前補 25.3 的 ROI 框定 + 驗收檢查清單。
3. 維持 §22.3 時序：LIVE 肉眼拍板 B「先於」把 B 鎖進官方 full-room 基準與正式包重生。
4. 本節唯讀核實 + Chrome 自驗（已停 server），未改產品程式、未重烤、未動正式 runtime pointer；
   index.html 交 CODEX 由本 source.md 重生。
```

---

## 26. CODEX Phase 2 ROI 框定補件（交使用者驗收用）

本節補 §25.3：兩條高解析驗收網址要搭配固定床西緣 ROI 視角使用。這不是新一輪產品改動；只補交付口徑，避免用廣角預設畫面判錯區域。

### 26.1 驗收網址

```text
raw 無 OIDN：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-b-alpha-raw&nonSquarePackage=d800-bed-contact-b-alpha-raw&xatlasPackage=a1-westbeam-full4x-raw

OIDN：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-b-alpha-oidn&nonSquarePackage=d800-bed-contact-b-alpha-oidn&xatlasPackage=a1-westbeam-full4x-oidn
```

### 26.2 固定 ROI 視角

載入任一網址後，使用「貼上視角」貼入下列內容。這組視角取自使用者 2026-06-12 的 LIVE / BAKE 對照畫面，會對準北牆與床西緣接觸處。

```text
cameraState={"position":{"x":-0.066371,"y":0.193755,"z":-1.841858},"yaw":-1.0504,"pitch":-0.436,"fov":55,"forward":{"x":0.786455,"y":-0.422317,"z":-0.450708}}
forward={"x":0.786455,"y":-0.422317,"z":-0.450708}
view={"facing":"東(+X)","config":1,"samples":200,"paused":false,"sppCap":200}
```

### 26.3 要看的位置

```text
主 ROI：
  北牆與床西緣貼牆處。

看法：
  1. 先開 raw 無 OIDN，貼上 26.2 視角。
  2. 再開 OIDN，貼上同一組視角。
  3. 對照 LIVE 畫面，看床西緣旁的北牆是否仍有硬梯度陰影。
  4. 同時檢查 bedContact alpha=0 後，live-trace 接手處是否自然。
```

### 26.4 驗收清單

```text
通過條件：
  1. 床西緣貼牆處的「亮到黑」斷崖消失，或明顯收斂成 LIVE 類型的自然接觸暗化。
  2. x<=-0.05 的亮牆沒有被吃掉，左側亮牆仍保持合理亮度。
  3. 床右側 x[1.38,1.90] 沒有殘留縫。
  4. raw 與 OIDN 都沒有新增暗塊；OIDN 可較平滑，但不能把新硬邊藏起來。

未通過時要回報：
  1. raw 或 OIDN 哪一條失敗。
  2. 失敗位置在床西緣、床右側、或亮牆側。
  3. 是否像硬線、暗塊、或亮牆被切掉。
```

### 26.5 交付口徑

```text
這兩條網址是非方格高解析 D800 北牆驗收包：
  targetAtlasWidth  = 3379
  targetAtlasHeight = 4043
  northWall face    = 3379 × 2327

它們不是 1024 planar_xy 工程診斷包。
本節只補 ROI 與驗收清單，不改產品程式、不重烤、不切正式 runtime pointer。
```

---

## 27. OPUS §26 ROI 補件複審簽結（2026-06-12）

唯讀核實 §26 補件，未改產品程式、未重烤、未動正式 runtime pointer。

### 27.0 結論：§25.3 缺口已關，兩條網址可交使用者肉眼驗收

```text
§26 補上固定 ROI 視角 + 驗收清單，§25.3「URL 未框定床西緣 contact」缺口已關。
cameraState 取自使用者自己的對照畫面（provenance 即權威），幾何也確認框住床西緣交界。
驗收清單與我 §20.4 / §22.3 條件完全對齊。准交使用者用 Chrome 9002 肉眼驗收。
```

### 27.1 核實

```text
1. ROI 幾何正確：
   cameraState pos z=-1.842（離北牆 z=-1.874 僅 3cm）、x=-0.066（床西緣 -0.027 旁）、
   y=0.194（落在 bed contact y[0,0.29] 帶內）、facing 東(+X) 向下。
   → 鏡頭位於床西緣、貼北牆基、往東下看，正對床西緣 contact 交界。
2. cameraState 來源 = 使用者 2026-06-12 LIVE/BAKE 對照畫面，provenance 權威。
3. 驗收清單 §26.4 四條 = §20.4 三條（斷崖消失／x≤-0.05 亮牆保留／床右 x[1.38,1.90] 無殘縫）
   + §22.3 第四條（bright texel 設 alpha=0 後 live-trace 是否自然、無新暗塊）。完全對齊。
4. 交付口徑清楚標示 3379×4043、northWall face 3379×2327，非 1024 診斷包。
5. raw / OIDN 兩條網址不變，與 §25.2 我自驗過的 OIDN 一致。
```

### 27.2 使用者驗收後的時序（提醒，未變）

```text
LIVE 肉眼拍板 B「先於」鎖 B 進產品：
  使用者驗收 raw/OIDN 通過 → B 拍板
  → 同一 commit：常數定 B + 正式包重生（metadata-only alpha sync）
    + full-room 契約去 provisional 翻面 + bedContact/wardrobeContact parity
  → 交 OPUS 複審。
若驗收未過：依 §26.4 回報哪條/哪處/何種瑕疵，B 值回 §20.4 用掃點重新校正（可能放寬向 C）。
```

### 27.3 簽結

```text
1. §26 ROI 補件可收；§25.3 缺口關閉；兩條高解析網址准交使用者肉眼驗收。
2. 等使用者 Chrome 9002 驗收結果；通過才走「鎖 B + 正式包重生 + 翻面 + parity」同 commit。
3. 本節唯讀核實，未改產品程式、未重烤、未動正式 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 28. OPUS Phase 2 raw 驗收失敗調查（2026-06-12，OPUS 視覺對照）

使用者肉眼驗收 raw 未通過，回報床/北牆交界寬暗帶。依 debug 紀律先收集證據、不提修法。
本節為 OPUS 端視覺對照（Chrome preview，9006 埠，未碰 Brave），未改產品程式、未重烤、未動 runtime pointer。

### 28.0 一句話結論

```text
寬暗帶 100% 由 bedContact B 的 alpha=0 排除造成，且是結構性 radiance 差異（raw/OIDN 都有，非噪聲）。
更關鍵：被當驗收來源的 d800-non-square 高解析包，其床/牆交界本來就乾淨——
沒有 §19 在 separated-1024 包量到的「黑接觸區」缺陷。
也就是 B 是針對「另一個包(separated-1024)的缺陷」校的，套到「沒這缺陷的包(d800-non-square)」上，
反而把好的烘焙 radiance 換成較暗的 live-trace，憑空製造寬暗帶。
```

### 28.1 視覺對照證據（同一使用者 cameraState）

```text
用使用者 2026-06-12 視角，依序載入同一視角對照三個 nonSquarePackage：

1. d800-north-preview（源包，無 alpha 排除；B-raw 正是從它 sync 來、僅差 alpha）：
   北牆面乾淨、均勻，床/牆交界只有自然窄接觸暗化，無寬暗帶。
2. d800-bed-contact-b-alpha-raw（B-raw，失敗包）：
   床/牆交界出現寬暗帶/陰影，牆面貼床側明顯比左側暗，有噪。
3. d800-bed-contact-b-alpha-oidn（B-OIDN）：
   同樣有寬暗帶，OIDN 較平滑但未藏住（符合 §26.4 第4條「OIDN 不能把新硬邊藏起來」）。

判別：
  源包(1) 與 B-raw(2) 是「同一烤、僅差 bedContact alpha sync」（§24 raw source = d800-preview）。
  (1) 乾淨、(2) 有暗帶 → 暗帶因果 100% 歸 bedContact B 排除。
  raw(2) 與 OIDN(3) 都有帶 → 結構性 radiance 差異，不是 raw 噪聲/denoise 路徑問題（H4 答案）。
```

### 28.2 假說裁示

```text
H1（B 過寬/過高 → alpha=0 後 live-trace 寬陰影）：成立，是直接機制。
  alpha=0 把本來有好 radiance 的牆條交給 live-trace；live-trace（低 SPP + 床部分遮擋）比收斂烘焙暗 → 寬暗帶。
H2（y 範圍切到可見牆）：部分成立（暗帶可見是因排除區含相機看得到的牆），但非根因。
H3（valid-linear 邊界混色）：非主因。暗帶是整條床footprint寬，不是單一邊界過渡。
H4（raw/OIDN 分開判）：已答——兩者都有帶，OIDN 較平滑但未藏；結構性非噪聲。
H5（使用者看到床頂後緣、B 要重新校）：方向對，但比「重校 B」更根本——見 H6。

H6【OPUS 新增，最關鍵】：包不匹配（package mismatch）。
  §19 的「黑接觸區」缺陷量在 separated-1024 包（north-wall-separated-1024px，bed-mode runtime 包）。
  但高解析驗收包是 d800-non-square 3379×4043，是另一次更高品質的烤，
  其床/牆交界本來就乾淨、沒有黑接觸區。
  把為 separated-1024 缺陷校的 bedContact B 套到 d800-non-square，
  等於排除一塊本來烤得好的 radiance，換成較暗 live-trace → 製造缺陷。
```

### 28.3 給下一步的關鍵問題（先釐清再談新 B）

```text
這不只是「B 值要重校」，而是「目標包到底有沒有缺陷、bed-mode runtime 到底用哪個包」：

1. bed-mode runtime 北牆實際用哪個包？
   - R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL = north-wall-separated-diffuse（1024）。
   - 但「北東非方格:開」時北東走 d800-non-square。兩條路徑哪條是使用者實際看到床邊縫的那條？
2. §19 的黑接觸區只在 separated-1024 有，d800-non-square 沒有 → 需 CODEX CPU 核對兩包 contact 區 radiance：
   - separated-1024 contact 區是否真的黑（alpha=1 黑）。
   - d800-non-square 同區是否本來就有非零 radiance（與我看到的乾淨牆一致）。
3. 若 d800-non-square 本來就乾淨：那它不需要 bedContact 排除，B 對它是錯的；
   方向可能是「bed-mode 北東改用 d800-non-square 這種乾淨烤」，而非加 contact 排除。
4. 若使用者實際縫在 separated-1024 路徑：B 要對 separated-1024 驗收，不是對 d800-non-square。
```

### 28.4 結論與交接

```text
1. raw 驗收未過屬實；B 值不能拍板；provisional 維持；禁止正式包重生 / full-room 翻面 / pointer 切換（遵照使用者）。
2. 暗帶因果已定：bedContact B alpha 排除造成，raw/OIDN 皆有，結構性非噪聲。
3. 根因指向「包不匹配」：B 校在 separated-1024 缺陷、套到本來乾淨的 d800-non-square，憑空造缺陷。
4. 下一步先釐清 28.3 四問（CODEX CPU 核對兩包 contact radiance + 確認 runtime 實際路徑），再決定：
   是「換乾淨烤包」還是「對正確的目標包重校 contact」。先別急著調新 B 值。
5. 本節唯讀視覺對照（已停 9006 server），未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 29. OPUS 對 CODEX CPU 調查的對帳與裁示（2026-06-12）

唯讀，對帳 CODEX §CPU 調查與我 §28 視覺結論，未改產品程式、未重烤、未動 runtime pointer。

### 29.0 一句話

```text
CODEX 的 CPU 把根因縮到「yMax=0.29 過切，把 y≈0.2803~0.2890 的亮牆(source luma~0.41 raw / ~0.23 OIDN)清成 alpha=0」。
這比我 §28 H6「d800-non-square 完全沒缺陷」更精確——我那條太強，部分收回（見 29.1）。
同意暫停 B、維持 provisional、做 yMax-only 縮版診斷包再上使用者相機驗。
但鎖任何 B 前還有三個未答問題（29.3），先別當作只調一個數字就結案。
```

### 29.1 對帳：我 §28 H6 部分收回，採 CODEX 更精確的定位

```text
我 §28 視覺結論（保留，正確）：
  暗帶 100% 由 bedContact B alpha 排除造成；raw/OIDN 都有、結構性非噪聲。
我 §28 H6（部分收回）：
  我說「d800-non-square 本來就乾淨、完全沒黑接觸區缺陷」——太強。
  CODEX CPU 顯示 source 在 y=0.2715~0.2790 確實是黑（luma~0.0007），這段切掉合理；
  問題在 yMax=0.29 又往上多切了 y=0.2803~0.2890 的亮牆（~0.41）。
  所以不是「整包無缺陷」，而是「鏟子多挖約 1cm，挖到床頂上方的亮牆」。
為什麼我視覺看 source「乾淨」、但它其實有 y0.27~0.279 黑條：
  那條黑只有 ~7.5mm 高、貼在床頂接觸線，讀起來像自然接觸暗線；
  B 把它「上方」的亮牆(y0.28~0.289)也清掉走 live-trace 變暗，才疊成肉眼可見的寬暗帶。
裁示：採 CODEX 的精確定位（yMax 過切）為直接根因。
```

### 29.2 同意的下一步（CODEX 五點）

```text
1. 暫停 B 拍板 — 同意。
2. 維持 provisional、禁止正式包重生 / full-room 翻面 / pointer 切換 — 同意。
3. yMax 重校到亮度 knee 前（資料：黑到 0.2790、亮從 0.2803，knee 在其間）— 同意方向。
4. 產「只縮 yMax、x 不動」高解析 raw/OIDN 診斷包當假說測試 — 同意（隔離單一變數，做法正確）。
5. 用使用者這組相機驗：寬暗帶是否消失、原縫是否仍被處理 — 同意。
```

### 29.3 鎖任何 B 前要先答的三問（別只當調一個數字）

```text
A. y0.2715~0.2790 那條黑，是「缺陷要切」還是「正確接觸陰影要保留」？
   它是 source 烤出來的 alpha=1 黑(~0.0007)。若它是床貼牆的正確接觸暗化，
   切掉走 live-trace 反而可能換成另一種暗；那連這條窄切都要 LIVE 對照才能定。
   先分清「該保留的自然接觸暗」與「該挖掉的烘焙黑洞」。

B. yMax knee 太窄，CPU 校不出乾淨邊界，LIVE 是必要關卡。
   黑(0.2790) 到 亮(0.2803) 只差 ~1.3mm，小於一個 texel(y footprint~2.837mm)。
   代表縮 yMax 後切邊本來就會有 bilinear 混過渡；CPU 數字定不死，必須用使用者相機 LIVE 收。
   別期待縮 yMax 就一次乾淨，要準備 1~2 輪微調。

C. 目標包問題仍未答（我 §28.3 第1/2 問還在）：
   - bed-mode runtime 北牆實際走哪個包？separated-1024(R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL)
     還是「北東非方格:開」時的 d800-non-square？
   - §19 的黑接觸缺陷量在 separated-1024；現在驗收/校正都在 d800-non-square。
     B 最終要鎖進哪個包，就必須在那個包上 LIVE 通過，不能 A 包校、B 包鎖。
   這題不擋 yMax 診斷實驗，但鎖正式 B 前一定要答。
```

### 29.4 裁示

```text
1. 採 CODEX 精確根因：yMax=0.29 過切床頂上方亮牆(y0.2803~0.2890)；我 §28 H6 過強，部分收回。
2. 同意暫停 B、維持 provisional、做「只縮 yMax、x 不動」高解析 raw/OIDN 診斷包、上使用者相機驗。
3. 但縮 yMax 不是純數字題：先答 29.3 三問（窄黑條該切該留 / knee 太窄要 LIVE 收 / 目標包是哪個）。
4. 診斷包出來後交我視覺複審（同一使用者相機，對照 source/raw/OIDN），通過再談是否能拍板。
5. 本節唯讀對帳，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 30. CODEX yMax 0.279 診斷包回填（只縮 yMax，不動 x）

本節回應 §29.2：產出只縮 yMax 的高解析 raw/OIDN 診斷包，讓使用者與 OPUS 用同一相機確認寬暗帶是否消失、原床邊縫是否仍被處理。這是診斷包，不是正式 B 拍板。

### 30.1 變更範圍

```text
診斷變數：
  原 B：
    x[-0.035, 1.91]
    y[0, 0.29]

  y279 診斷：
    x[-0.035, 1.91]
    y[0, 0.279]

不變：
  xMin / xMax 不動。
  source raw / source OIDN 不動。
  正式 runtime pointer 不動。
  InitCommon 的正式 BED_CONTACT_CANDIDATE 仍維持 yMax=0.29。
  只在工具執行時用 --contact-y-max 0.279 產診斷包。
```

### 30.2 產出包

```text
raw y279 診斷包：
  pointer:
    docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-y279-alpha-raw-runtime-package.json
  package:
    assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-d800-bed-contact-y279-alpha-raw-3379x4043-1000spp

OIDN y279 診斷包:
  pointer:
    docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-y279-alpha-oidn-runtime-package.json
  package:
    assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-d800-bed-contact-y279-alpha-oidn-3379x4043-1000spp
```

### 30.3 CPU 結果

```text
raw y279：
  contactTexels             = 347,434
  contactAlphaOneBefore     = 347,434
  contactBrightTexelsBefore = 1,562
  maxContactLumaBefore      = 0.2735626218
  contactAlphaOneAfter      = 0
  contactBrightTexelsAfter  = 0

OIDN y279：
  contactTexels             = 347,434
  contactAlphaOneBefore     = 347,434
  contactBrightTexelsBefore = 3,439
  maxContactLumaBefore      = 0.2726964955
  contactAlphaOneAfter      = 0
  contactBrightTexelsAfter  = 0

對照原 B：
  raw bright before  14,033 → y279 1,562
  OIDN bright before 17,461 → y279 3,439

判讀：
  y279 已避開 y=0.2803~0.2890 這條明亮牆帶；
  仍會切掉 y<=0.279 附近的窄黑帶，這正是 §29.3 A 要用 LIVE 判定該切或該留的區域。
```

### 30.4 驗收網址

```text
raw y279：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-y279-alpha-raw&nonSquarePackage=d800-bed-contact-y279-alpha-raw&xatlasPackage=a1-westbeam-full4x-raw

OIDN y279：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-y279-alpha-oidn&nonSquarePackage=d800-bed-contact-y279-alpha-oidn&xatlasPackage=a1-westbeam-full4x-oidn
```

### 30.5 使用者這次回報用相機

載入任一 y279 網址後，使用「貼上視角」貼入下列內容。這是使用者回報「raw 超寬暗帶」的相機。

```text
cameraState={"position":{"x":-0.257471,"y":0.370277,"z":-1.570738},"yaw":-0.7732,"pitch":-0.428,"fov":55,"forward":{"x":0.635429,"y":-0.415052,"z":-0.651123}}
forward={"x":0.635429,"y":-0.415052,"z":-0.651123}
view={"facing":"北(-Z)","config":1,"samples":39,"paused":false,"sppCap":1000}
```

### 30.6 驗收清單

```text
請看四件事：
  1. 原 B 造成的超寬暗帶是否消失。
  2. 床後緣原本的小縫是否仍被處理。
  3. y<=0.279 的窄黑帶看起來像自然接觸暗化，還是仍像不自然黑線。
  4. raw 與 OIDN 是否同型；若只有 raw 失敗，需分開處理 raw 噪聲與 alpha 規則。

通過後仍不能立刻正式拍板：
  需要回答 §29.3 A/C：
    A. y0.2715~0.2790 的窄黑帶該切或該留。
    C. 正式 bed-mode runtime 目標包到底是哪個。
```

### 30.7 驗證

```text
紅燈：
  新增測試先因缺 y279 pointer / resolver key 失敗。

綠燈：
  node docs/tests/r7-3-10-ne-furniture-contact-alpha-nonsquare-package.test.js
  node docs/tests/r7-3-10-non-square-data-path.test.js
  node --check docs/tools/r7-3-10-north-wall-contact-alpha-nonsquare-package.mjs
  node --check js/InitCommon.js

說明：
  測試會實讀 y279 raw/OIDN atlas binary，確認 contact 區 alpha=0、RGB=0，
  並確認 y279 診斷包的 status 是 diagnostic-ymax-probe。
```

---

## 31. OPUS y279 診斷包視覺複審（2026-06-12）

唯讀視覺對照（Chrome preview 9006，未碰 Brave），用使用者同一相機，未改產品程式、未重烤、未動 runtime pointer。

### 31.0 結論：yMax 過切假說視覺證實，y279 寬暗帶消失

```text
用使用者「寬暗帶相機」載入 y279-raw 與 y279-OIDN（resolver 已確認載到 y279 包、非 fallback）：
  兩條都「北牆面乾淨、寬暗帶消失」，回到 source 的乾淨外觀，床/牆交界只剩自然窄接觸線。
yMax=0.29→0.279 確實消除了 §28/§29 的寬暗帶。CODEX CPU（bright cut 14,033→1,562 raw）與我視覺一致。
假說證實。但這只證「寬暗帶因 yMax 過切、縮 yMax 可消」；不等於正式 B 可拍板（見 31.2）。
```

### 31.1 CODEX 四問裁示

```text
Q1 y279 是否足以證明 yMax 過切假說：足以。
   raw/OIDN y279 同相機都消除寬暗帶；CPU bright-cut 大降；source 對照成立。假說證實。
Q2 raw/OIDN y279 是否可交使用者同相機驗：可。
   resolver 路由正確（我 eval 確認回傳 y279 路徑）、包載入、非黑、寬暗帶消。技術面 ok，交使用者。
Q3 下一步判 y<=0.279 窄黑帶該切該留（§29.3-A）：仍由使用者 LIVE 判。
   我視覺看 y279 的窄接觸線自然、未見不自然黑線；但該切該留是使用者肉眼權威，我不替代。
Q4 正式目標包未釐清、正式 B 未拍板：同意，維持（§29.3-C 仍開）。
```

### 31.2 交使用者前要它一起看的兩點（我視覺沒看到問題，但需肉眼確認）

```text
1. y=0.279 切邊是否有「新的水平接縫」。
   y279 在 y=0.279 處 alpha 由 1(下,live-trace)→0... 實為下方 alpha=0 走 live、上方 baked-bright，
   交界可能因 bilinear knee 太窄(黑0.2790→亮0.2803 僅~1.3mm<1 texel)出現水平細縫。
   我截圖未見明顯水平線，但請使用者在切邊近看一次。
2. 原始縫是否仍處理。
   y279 仍切 y[0,0.279]（含原黑接觸區），原縫的修復保留、過切移除——我視覺判斷成立，請使用者確認。
```

### 31.3 維持的紅線（未變）

```text
1. 正式 B 不拍板；provisional 維持；禁止正式包重生 / full-room 翻面 / pointer 切換（遵照使用者）。
2. 拍板前要答 §29.3：A（窄黑帶該切該留）、C（正式 bed-mode runtime 目標包是哪個）。
3. y279 是 diagnostic-ymax-probe，不是正式值；若使用者 LIVE 通過，再依 §29.3-C 決定鎖進哪個包、再走
   「常數定值 + 正式包重生 + full-room 去 provisional 翻面 + parity」同 commit。
```

### 31.4 簽結

```text
1. yMax 過切假說視覺證實：y279 raw/OIDN 同相機寬暗帶消失、回乾淨外觀。
2. 兩條 y279 網址可交使用者同相機肉眼驗（含 31.2 兩點一起看）。
3. 正式 B 仍不拍板；§29.3 A/C 仍要答；紅線維持。
4. 本節唯讀視覺對照（已停 9006 server），未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 32. CODEX xMin -0.027 / yMax 0.279 診斷包回填（2026-06-12）

使用者回報：y279 診斷包已讓上方東西向交界不再出現寬暗帶，但左方上下向交界仍有暗帶。這代表 yMax 過切已處理一半，還要檢查 xMin 是否也多切到亮牆。

### 32.1 根因補釘：xMin -0.035 也過切

CPU 讀 high-resolution D800 source raw 與 y279 raw，沿 `x=-0.035..-0.0275`、`y<=0.279` 掃描：

```text
觀察：
  y279 仍使用 xMin=-0.035。
  source raw 在 x=-0.035 到 -0.0275 這 7 條 texel 欄，luma 多在 0.18~0.24。
  但 y279 診斷包把這 7 欄整段 alpha=0。

判讀：
  左方上下向殘線不是新問題；
  它是同一把「contact 鏟子」在 x 方向也多挖了約 8mm。
  yMax=0.279 修掉上方水平過切；
  xMin=-0.027 用床幾何西緣當界線，專門檢查左側垂直殘線。
```

### 32.2 本輪只改一個變數

```text
上一輪 y279：
  xMin = -0.035
  yMax = 0.279

本輪 x027-y279：
  xMin = -0.027
  yMax = 0.279

目標：
  保留已修好的上方東西向交界；
  只放回左側 x[-0.035,-0.027] 這段亮牆，確認上下向暗帶是否消失。
```

### 32.3 新診斷包

```text
raw:
  pointer = docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-raw-runtime-package.json
  package = assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-d800-bed-contact-x027-y279-alpha-raw-3379x4043-1000spp
  status  = diagnostic-xmin-ymax-probe

OIDN:
  pointer = docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-oidn-runtime-package.json
  package = assets/bakes/r7-3-10/c1-static-diffuse/north-east-non-square-d800-bed-contact-x027-y279-alpha-oidn-3379x4043-1000spp
  status  = diagnostic-xmin-ymax-probe
```

### 32.4 數字對照

```text
x027-y279 raw:
  contactTexels               = 345,873
  contactAlphaOneBefore       = 345,873
  contactBrightTexelsBefore   = 1
  maxContactLumaBefore        = 0.0003369835
  contactAlphaOneAfter        = 0
  contactBrightTexelsAfter    = 0

x027-y279 OIDN:
  contactTexels               = 345,873
  contactAlphaOneBefore       = 345,873
  contactBrightTexelsBefore   = 1,878
  maxContactLumaBefore        = 0.0013260177
  contactAlphaOneAfter        = 0
  contactBrightTexelsAfter    = 0

對照：
  原 B raw brightBefore      = 14,033
  y279 raw brightBefore      = 1,562
  x027-y279 raw brightBefore = 1

  原 B OIDN brightBefore      = 17,461
  y279 OIDN brightBefore      = 3,439
  x027-y279 OIDN brightBefore = 1,878
```

### 32.5 驗收網址

```text
raw x027-y279：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-x027-y279-alpha-raw&nonSquarePackage=d800-bed-contact-x027-y279-alpha-raw&xatlasPackage=a1-westbeam-full4x-raw

OIDN x027-y279：
  http://127.0.0.1:9002/Home_Studio.html?v=r7310-furniture-owner-1b-d800-bed-contact-x027-y279-alpha-oidn&nonSquarePackage=d800-bed-contact-x027-y279-alpha-oidn&xatlasPackage=a1-westbeam-full4x-oidn
```

### 32.6 建議驗收相機

使用者最新截圖未附 cameraState；先沿用上一輪「寬暗帶」相機，可同時看到床後緣與左側交界。若使用者有更新貼上視角，請以使用者最新視角為準。

```text
cameraState={"position":{"x":-0.257471,"y":0.370277,"z":-1.570738},"yaw":-0.7732,"pitch":-0.428,"fov":55,"forward":{"x":0.635429,"y":-0.415052,"z":-0.651123}}
forward={"x":0.635429,"y":-0.415052,"z":-0.651123}
view={"facing":"北(-Z)","config":1,"samples":39,"paused":false,"sppCap":1000}
```

### 32.7 驗收清單

```text
請看四件事：
  1. 上方東西向交界仍維持乾淨。
  2. 左方上下向殘線是否消失或明顯變窄。
  3. x=-0.027 附近有沒有新的亮縫或硬線。
  4. raw / OIDN 是否同型；若 raw 有噪點但 OIDN 乾淨，分開判讀噪點與 alpha 規則。

仍維持紅線：
  x027-y279 是 diagnostic-xmin-ymax-probe，不是正式值。
  使用者肉眼通過後，仍需回答正式 bed-mode runtime 目標包是哪個，再談正式包重生與契約翻面。
```

### 32.8 驗證

```text
紅燈：
  node docs/tests/r7-3-10-ne-furniture-contact-alpha-nonsquare-package.test.js
    先因缺 x027-y279 pointer 失敗。
  node docs/tests/r7-3-10-non-square-data-path.test.js
    先因缺 x027-y279 resolver key 失敗。

綠燈：
  node docs/tests/r7-3-10-ne-furniture-contact-alpha-nonsquare-package.test.js
  node docs/tests/r7-3-10-non-square-data-path.test.js
  node --check docs/tools/r7-3-10-north-wall-contact-alpha-nonsquare-package.mjs
  node --check js/InitCommon.js

補充：
  工具新增 --contact-x-min，可與 --contact-y-max 同時使用；
  Home_Studio.html InitCommon cache-buster 已更新為 r7310-furniture-owner-1b-v5。
```

---

## 33. 使用者 x027-y279 肉眼驗收與「打地鼠」風險判斷（2026-06-12）

使用者以 `x027-y279` 診斷包肉眼驗收後回報：上方東西向交界已無暗帶，左方上下向交界也已解決。這代表 `xMin=-0.027 / yMax=0.279` 是目前 bedContact 的最佳候選值。

### 33.1 使用者驗收結果

```text
使用者觀察：
  1. y279 已修掉上方東西向暗帶。
  2. x027-y279 已修掉左方上下向暗帶。
  3. 畫面中床與北牆交界恢復自然，未見原本寬暗帶與垂直殘線。

目前最佳候選：
  bedContact.xMin = -0.027
  bedContact.yMax = 0.279

候選狀態：
  仍是 diagnostic-xmin-ymax-probe。
  尚未正式拍板。
```

### 33.2 這是不是打地鼠

```text
判斷：
  有打地鼠的味道，但本輪不是隨機打。

原因：
  1. 症狀上看起來像「修上方、冒左方」。
  2. 數據上兩條暗帶都來自同一個 contact alpha 矩形範圍過大。
  3. 上方暗帶 = yMax=0.29 多切到亮牆。
  4. 左方暗帶 = xMin=-0.035 多切到亮牆。
  5. x=-0.027 / y=0.279 同時修掉兩條錯邊，表示這是在校正同一個矩形 mask，不是兩個互不相關的問題。
```

### 33.3 真正需要防止的打地鼠型風險

```text
風險：
  如果下一片家具、下一片牆、下一個 contact 都靠肉眼看到線後再手調數字，
  那就會變成真正的打地鼠。

需要收成規格的規則：
  1. contact 範圍不可只靠 AABB 粗框。
  2. 每次調整 contact mask，都要 CPU 掃描被切掉的 source luma。
  3. alpha=0 區域內若有大量亮牆 texel，要自動紅燈。
  4. 要記錄 raw 與 OIDN 各自的 brightTexelsBefore / maxContactLumaBefore。
  5. 診斷包通過後，才能交使用者肉眼驗收。
  6. 肉眼通過後，仍需確認正式目標包，再進正式包重生與 contract 翻面。
```

### 33.4 建議 OPUS 裁示點

```text
請 OPUS 審三件事：
  1. 是否接受 x=-0.027 / y=0.279 作為 bedContact 的正式候選值。
  2. 是否同意把「bright wall overcut CPU audit」列為 1b 之後每個 contact mask 的必跑檢查。
  3. 是否可進下一步：確認正式 bed-mode runtime 目標包，規劃正式包 metadata-only 重生與 contract 去 provisional。
```

## 34. OPUS 對 §33 的裁示（2026-06-12）

唯讀，依使用者 LIVE 結論裁示，未改產品程式、未重烤、未動 runtime pointer。

### 34.0 一句話

```text
Q1 接受 x=-0.027 / y=0.279 為 bedContact 正式候選（使用者 LIVE 為權威）。
Q2 強烈同意：bright wall overcut CPU audit 列為每個 contact mask 的必跑檢查（防打地鼠的正解）。
Q3 可進「規劃」，但正式鎖值前的 gate-zero 是先答 §29.3-C（runtime 北牆實際走哪個包），見 34.3。
順帶認錯：B 的兩條過切（xMin=-0.035、yMax=0.29）都源自我自己的 guard band 主張，要記成設計教訓。
```

### 34.1 Q1：接受 x027-y279，並認 guard band 教訓

```text
接受。使用者 LIVE 確認上下、左右兩條暗帶都消，x=-0.027 / y=0.279 為正式候選值。
同意 §33.2：本輪不是亂打——兩條暗帶是「同一個 contact 矩形的兩條過切邊」，
收斂到 x=-0.027（=bed.main 西面）、y=0.279（=床頂 0.28 前的亮度 knee），等於把 mask 貼齊床的遮擋邊界。

認錯（記成教訓）：
  兩條過切都來自我的 guard band 主張——
    §20.2 我選 B 的 xMin=-0.035（比 bed 西面 -0.027 再往西 guard）→ 吃掉西側亮牆 = 左暗帶。
    §14.2 Q4 / §20 我要 yMax 加 guard → 0.29 吃掉床頂上方亮牆 = 上暗帶。
  設計原則更正：
    contact 排除要「貼齊遮擋/亮度 knee」，不可往可見亮牆方向加 guard band。
    guard band 只對「不可見/已全黑的內部」有意義；一旦越過 knee 進亮牆，alpha=0 → live-trace 變暗 = 憑空造帶。
    正確的 contact 邊 = source luma 由暗轉亮的那條線，不是 AABB ± 緩衝。
```

### 34.2 Q2：bright wall overcut CPU audit 列為必跑檢查（同意，並補規格）

```text
強烈同意。這正是把「肉眼事後抓過切」變成「CPU 事前抓過切」的防打地鼠機制。
本輪若先有這個 audit，14,033 個亮 texel 被切早就紅燈，不必等使用者看到帶。

audit 規格（建議收進 contact-exclusion contract，bedContact / wardrobeContact / 未來每個 contact 都跑）：
  輸入：contact 矩形 + 對應 source package（raw 與 OIDN 各跑）。
  量測並記錄：brightTexelsBefore（source luma > 門檻）、maxContactLumaBefore、
             以及「亮 texel 的分佈邊界」（哪條邊、x/y 範圍）——這是關鍵，
             單看總數看不出是哪邊過切；要 per-edge 邊界才知道是西緣還是頂緣。
  紅燈條件（gross overcut）：
    被切亮 texel 形成「越過亮度 knee 的連續帶」，或數量遠高於合理接觸陰影基線。
    以本案校準：x027-y279 的 bright cut（raw 1,562）為「可接受」量級；
              B 的 14,033 為「過切」量級。門檻取兩者之間、偏保守。
  邊界對齊檢查：contact 每條邊應落在 source luma knee 上（暗→亮轉折），不可越過進亮牆。

定位（誠實寫清楚）：
  這個 audit 抓的是「gross 過切」（數量級），能砍掉大部分肉眼來回，但不取代最後一次 LIVE。
  因為連可接受的 x027-y279 也切了 1,562 個亮 texel、使用者看了才算數；
  knee 太窄（§31.2）時 CPU 定不死最後 1~2 texel。所以流程是「CPU 事前篩 gross → 一次 LIVE 收尾」，
  而不是「CPU 全自動拍板」。§33.3 六條規則我全部同意，第 5/6 條的順序正是這個定位。
```

### 34.3 Q3：可規劃，但鎖值前 gate-zero 是答 §29.3-C

```text
同意進「規劃」正式包 metadata-only 重生 + contract 去 provisional；
但「正式鎖 x027-y279 進產品」前，gate-zero 必須先答 §29.3-C，否則可能 A 包驗收、B 包鎖。

我核實到的分支（給 CODEX 收口）：
  glsl:3219 北牆 baked radiance 由 r7310C1ShouldUseNonSquareAtlas(1.0) 在
    「非方格包(d800-non-square)」與「separated/square 包」之間二擇一，
    由 JS 旗標 r7310C1UseNonSquareAtlas 決定。
  使用者驗收的 x027-y279 是在「非方格包」上驗的。
gate-zero 三問：
  1. bed-mode 出貨預設：r7310C1UseNonSquareAtlas 預設開還是關？北牆出貨走非方格還是 separated？
  2. 若出貨走非方格 → d800-non-square 就是目標包，x027-y279 直接適用，可進正式重生。
  3. 若出貨走 separated（或兩條都會出貨）→ separated 包要各自跑 bright-overcut audit + 各自一次 LIVE，
     因為 §19 已知 separated-1024 的 contact 缺陷剖面與非方格不同，不能假設同一組值通用。

§29.3-A（窄黑帶 y0.27~0.279 該切該留）：視為已由使用者 LIVE 回答——
  x027-y279 切了 y[0,0.279]、使用者看了自然 → 該切，no further action。
```

### 34.4 正式鎖值的同 commit 清單（規劃，待 gate-zero 通過後執行）

```text
gate-zero（§29.3-C）通過、目標包確認後，同一 commit 做：
  1. R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE 定值 xMin=-0.027 / yMax=0.279（單一真相）。
  2. 目標正式包 metadata-only 重生（alpha sync，不重烤 radiance）。
  3. 跑 bright-overcut audit 並把 brightTexelsBefore/maxLuma（raw+OIDN）寫進 package report。
  4. full-room 契約 bedContact 去 provisional 翻面 + 對單一真相常數 parity。
  5. 全部既有 contact/seam/registry 契約綠燈。
  交 OPUS 複審 + 留最後一次 LIVE 截圖。
wardrobeContact 仍維持 provisional，待 bedContact 流程定型後比照辦理（含 bright-overcut audit）。
```

### 34.5 簽結

```text
1. Q1 接受 x=-0.027 / y=0.279 為正式候選；guard band 教訓記入（contact 貼 knee、不往亮牆加 guard）。
2. Q2 同意 bright-overcut CPU audit 列必跑檢查，規格見 34.2（per-edge 邊界 + knee 對齊 + gross 紅燈 + 仍留一次 LIVE）。
3. Q3 可規劃，但鎖值 gate-zero 先答 §29.3-C（runtime 北牆走非方格還是 separated）；§29.3-A 已由 LIVE 回答。
4. 紅線維持：未答 gate-zero 前不正式重生、不去 provisional、不切 pointer。
5. 本節唯讀裁示，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 35. CODEX gate-zero 收口：bed-mode 北牆正式目標包（2026-06-12）

OPUS §34 要求在正式鎖值前回答 §29.3-C：bed-mode runtime 北牆到底走非方格包還是 separated 包。CODEX 讀 code 與既有契約後，結論如下。

### 35.1 路由層答案

```text
出貨預設開關：
  js/InitCommon.js:2506
    r7310C1UseNonSquareAtlas = true

UI 初始文字：
  Home_Studio.html:61
    北東非方格：開

契約鎖定：
  docs/tests/r7-3-10-non-square-atlas-contract.test.js
    斷言 r7310C1UseNonSquareAtlas 預設 true
    斷言 uniform uR7310C1UseNonSquareAtlas 會同步此旗標

shader 路由：
  shaders/Home_Studio_Fragment.glsl:1394
    r7310C1ShouldUseNonSquareAtlas(patchSlot)
      = uR7310C1UseNonSquareAtlas > 0.5
        && uR7310C1NonSquareAtlasReady > 0.5
        && patchSlot in {1,2}

  shaders/Home_Studio_Fragment.glsl:3219
    北牆 patchSlot=1 時，若 r7310C1ShouldUseNonSquareAtlas(1.0) 成立，
    取 tR7310C1FullRoomDiffuseAtlasTextureNonSquare；
    否則才取 combined / separated 路徑。
```

判定：

```text
bed-mode 正常出貨畫面，在非方格 runtime ready 時，北牆走非方格包。
separated 北牆包是 fallback 路徑：
  1. 非方格開關被關掉；
  2. 或非方格包尚未 ready；
  3. 或工程 probe 強制 forceNonSquareAtlas=false。
```

### 35.2 包層答案：目前預設非方格包尚未等於 x027-y279 D800

```text
目前預設非方格 pointer：
  docs/data/r7-3-10-c1-north-east-non-square-runtime-package.json
  packageDir = north-east-non-square-p5d-runtime-preview
  targetAtlas = 2912 x 3432
  northWall face = 2492 x 1716

使用者驗收通過的診斷包：
  docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-raw-runtime-package.json
  docs/data/r7-3-10-c1-north-east-non-square-d800-bed-contact-x027-y279-alpha-oidn-runtime-package.json
  targetAtlas = 3379 x 4043
  northWall face = 3379 x 2327

因此：
  runtime 路由已收口為「非方格」；
  正式 package promotion 尚未完成。
```

### 35.3 CODEX 對 §29.3-C 的回答

```text
Q：bed-mode 出貨預設 r7310C1UseNonSquareAtlas 開還關？
A：開。

Q：北牆出貨走非方格還 separated？
A：非方格優先；separated 是 fallback。

Q：x027-y279 是否可直接適用？
A：可適用於非方格 D800 目標包。
   但正式鎖值前需把「使用者驗收通過的 D800 x027-y279 診斷包」
   明確提升為正式非方格目標包，或明確指定某個正式非方格包重新套同一 contact 值。

Q：separated 是否還要各自跑？
A：若出貨仍允許使用者關閉北東非方格，separated fallback 仍存在。
   但本輪 bedContact 正式值先鎖在非方格主路徑；
   separated fallback 可列為後續相容性檢查，不能阻擋非方格主路徑收斂。
```

### 35.4 下一步門檻

```text
可進正式鎖值規劃，但還不能直接改正式 pointer。

下一步應先由 OPUS / 使用者裁示：
  1. 是否把 x027-y279 D800 raw/OIDN 診斷包升為正式非方格 bed-mode 目標包。
  2. 是否同步把預設 nonSquarePackage pointer 從 p5d preview 改到 D800 x027-y279 正式包。
  3. separated fallback 是否只保留為 fallback 相容性檢查，或也要求同輪做 bright-overcut audit + LIVE。

一旦第 1 點通過，正式同 commit 清單：
  1. R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE 鎖定 xMin=-0.027 / yMax=0.279。
  2. 目標 D800 non-square raw/OIDN package 去 diagnostic status，改正式 metadata-only package。
  3. package report 寫入 bright-overcut audit：brightTexelsBefore / maxContactLuma / per-edge 分佈。
  4. full-room contract 去 provisional，並對常數 parity。
  5. resolver / pointer promotion 與契約同 commit。
```

---

## 36. OPUS 對 §35 gate-zero 的裁示（2026-06-12）

唯讀，依 §35 路由收口裁示，未改產品程式、未重烤、未動 runtime pointer。

### 36.0 一句話

```text
gate-zero 路由答案接受：北牆出貨走非方格、separated 是 fallback。
但 §35.2 暴露新 mismatch：出貨預設非方格包是 p5d preview(2912×3432)，
使用者 x027-y279 全程在 D800(3379×4043) 上驗——是兩個不同烤的包。
裁示把兩件事拆開：
  (1) 鎖 contact 值 x027-y279（world 座標，已驗）。
  (2) 把預設非方格包從 p5d preview promote 成 D800——這是整面北牆+東牆換烤，比 contact 大。
(2) 不能用「contact 已驗」順勢通過；它需要使用者一次「整面牆」LIVE nod，不只床 ROI。
```

### 36.1 接受的部分

```text
1. 北牆 runtime 走非方格（r7310C1UseNonSquareAtlas 預設 true、glsl:3219 路由、契約鎖定）— 核實接受。
2. x027-y279 是 world 座標 contact 值，metadata builder 用各包 atlas 尺寸 + UV rect 映射，
   定義上 package-agnostic，可套到任何非方格包。— 接受。
3. separated 是 fallback、不阻擋非方格主路徑收斂 — 接受（但有但書，見 36.4）。
```

### 36.2 promote D800 是「整面牆換烤」決策，與 contact 修法分開，需使用者整面 nod

```text
關鍵事實（要先講清楚）：
  - 預設非方格 pointer = north-east-non-square-runtime-package.json（p5d preview，2912×3432）。
  - 使用者這輪所有 LIVE 都是 URL override 到 d800-* 包看的；預設 p5d 從沒被這輪檢視。
  - promote D800 = 把整面北牆（且非方格路徑同時含東牆 patchSlot=2）從 p5d 烤換成 D800 烤。

為什麼不能順勢通過：
  使用者 LIVE 通過的是「D800 上的床 contact 區」，不是「D800 整面北牆/東牆 vs 現行 p5d」。
  promote 會換掉整面牆的烘焙，床 ROI 以外的區域（牆其他處、東牆、衣櫃側）使用者這輪沒看過。
  contact 修法的驗收，回答不了「整面 D800 當出貨基準是否有別處退化」。

裁示：
  方向同意 promote D800（packageDir 標 p5d「preview」、D800 是更高解析的預定正式烤、contact 已在其上驗）。
  但 flip 預設 pointer 前，要使用者給「一次整面牆 D800 LIVE nod」：
    至少一支相機看整面北牆 + 一支看東牆（非方格同時換東牆），確認床 ROI 以外無新退化。
  這支 nod 很便宜，但能擋「換烤換出別處 regression 卻沒人看」。非走完不可的硬關卡，但強烈建議。
```

### 36.3 bright-overcut audit 跑在最終 D800 promote 包上（必跑）

```text
依 §34.2，contact 值的「不過切」是 package-specific（看該包 luma 剖面）。
x027-y279 的 1,562 bright-cut 是在 D800 raw 量的；promote 的就是這個 D800 包，audit 直接適用。
要求：最終 promote 包的 report 寫入 bright-overcut audit（brightTexelsBefore / maxContactLuma / per-edge 分佈，raw+OIDN）。
若日後改用別的非方格烤（非這個 D800），contact 值要在那個包重跑 audit + 一次 LIVE，不可假設同值通用。
```

### 36.4 separated fallback：同意 fallback-only，但要寫明「fallback = 縫會回來」

```text
同意 separated 列 fallback 相容性檢查、不阻擋非方格主路徑，本輪不要求 separated 同步做 contact。
但要寫明後果，別讓它變隱性 desync：
  separated fallback 包沒有 bedContact 排除（不同包、不同 builder）。
  當 fallback 觸發（非方格關 / 非方格未 ready / probe 強制 false）時，床邊縫會重新出現。
處理（擇一，本輪記錄即可）：
  a. 文件明寫「fallback 為已知降級模式，床 contact 縫會回來」，接受。
  b. 後續另開子任務把 contact 也套到 separated（含 separated 自己的 bright-overcut audit + LIVE，
     因 §19 separated-1024 contact 剖面與非方格不同）。
不可預設「鎖了非方格就全域解決」。
```

### 36.5 正式鎖值同 commit 清單（promote 通過 + 整面 nod 後）

```text
前置：使用者整面牆 D800 LIVE nod（36.2）通過。
同一 commit：
  1. R7310_C1_NORTH_WALL_BED_CONTACT_CANDIDATE 鎖定 xMin=-0.027 / yMax=0.279（單一真相）。
  2. D800 x027-y279 raw/OIDN 包去 diagnostic status → 正式 metadata-only package。
  3. 預設 nonSquarePackage pointer 從 p5d preview 改指 D800 x027-y279 正式包。
  4. package report 寫入 bright-overcut audit（raw+OIDN，per-edge）。
  5. full-room contract 去 provisional + 對常數 parity。
  6. separated fallback 行為文件化（36.4）。
  7. 既有 non-square / contact / seam / registry 契約全綠。
  交 OPUS 複審 + 留最後一次 LIVE 截圖（整面 + 床 ROI）。
wardrobeContact 維持 provisional，待 bedContact 定型後比照（含 bright-overcut audit + LIVE）。
```

### 36.6 簽結

```text
1. gate-zero 路由答案接受（北牆走非方格、separated fallback）。
2. 拆兩件事：鎖 contact 值 OK；promote D800 是整面牆換烤，需使用者一次整面 LIVE nod（36.2），不可順勢通過。
3. 最終 promote 包必跑 bright-overcut audit（36.3）；separated fallback 的「縫會回來」要文件化（36.4）。
4. 紅線維持：整面 nod 前不 flip 預設 pointer、不去 provisional、不鎖正式值。
5. 本節唯讀裁示，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```

---

## 37. 方向校正：D800 contact 線降級為診斷，主線回歸完整北牆 XATLAS（2026-06-12）

使用者明確指出本輪 1b 被帶歪：原意是「先把整面北牆推進 XATLAS，再在 XATLAS 狀態下檢查床邊縫」，主線是全域 XATLAS，D800/non-square 只是對照與診斷資料。OPUS 接受校正，並指出它印證了我先前一直在敲的架構疑慮（§28 H6 包不匹配、§29.3-C runtime 走哪個包、§36 D800 promote 是整面換烤）。

### 37.1 降級與停止項

```text
立即停止 / 降級：
  1. 停止把 D800 x027-y279 往正式 promotion 推進。
  2. §35 / §36 的「D800 變預設非方格包」討論，降級為診斷紀錄，不是正式解法。
  3. §20~§34 的 D800 contact 收斂線（B → y279 → x027-y279）整段，
     保留為「診斷經驗」，不是正式產品方向。
  4. §36.5 的「正式鎖值同 commit 清單」凍結，不執行（除非未來主線另有需要）。
不刪除上述章節（它們是真實調查紀錄），但效力降為 diagnostic / reference。
```

### 37.2 校正後仍有效的「帶得走」資產

```text
這段 D800 診斷不是白做，下列結論帶進 XATLAS 主線：
  1. 床邊縫是「架構/包相依」的——D800 hybrid 上呈現的縫，未必等於 XATLAS 上的縫；
     所以「先上 XATLAS 再驗縫」方向正確（這正是 §28 H6 / §29.3-C 指向的）。
  2. contact 排除紀律（[[project-r7310-contact-exclusion-hug-knee]]）：
     排除邊貼亮度 knee、不往可見亮牆加 guard band；每個 contact 跑 bright-overcut CPU audit（per-edge）。
     若 XATLAS 主線也需要家具 contact 處理，這套紀律直接沿用。
  3. x027-y279（bed footprint 投影 world 值）、bright-overcut 量級（raw bright 可接受≈1,562 vs 過切 14,033）
     留作參考數據。
  4. 交付口徑教訓：肉眼驗收網址要標清架構（XATLAS / D800），不可把 D800 當 XATLAS 交給使用者看。
```

### 37.3 新主線：Full North Wall XATLAS expansion（交 CODEX 起新規格）

```text
下一份規格另開新 HTML Review：「Full North Wall XATLAS expansion plan」。
由 CODEX 起草 source.md，OPUS 審。規格至少涵蓋（沿用 A1 樣板 + 1a owner registry + 1b 診斷）：

  A. 密度
     full4x / D800 等效密度（高變化接觸邊需 full4x，西樑硬黑邊實證）；整面北牆的 atlas 尺寸與分塊。
  B. owner registry / OwnerExcluded（承 1a）
     整面北牆 XATLAS 登記成 SurfaceOwnerPolicy；precedence / activationCondition；
     與既有 A1（precedence 200）的關係（A1 是被整面取代，還是仍當西樑高密度子區共存？要定義）。
  C. 三邊一致（承 §13~§16）
     runtime gate + bake-point + JS metadata mirror 走同一 OwnerExcluded；
     side-wall / door-hole / beam-gap / 家具 contact 都納入。
  D. 已知 XATLAS 陷阱（必須在規格內預先規避）
     - first-hit break 漏直接光（見 [[project-r7310-xatlas-a1-breaks-direct-light]]）：整面 XATLAS 不可重蹈 indirect-only 變暗。
     - fragment sampler 16 上限（見 [[project-r7310-fragment-sampler-16-tiu-ceiling]]）：新 atlas 重用既有 slot，別超 16 → 全黑。
  E. 自動檢查（承 1a + 1b）
     重複認領、越界認領、alpha 誤殺、gap 被 atlas 吃進來、bright-overcut（per-edge）。
  F. 驗收
     整面北牆 XATLAS 包存在後，才重新驗收東北床邊縫；
     驗收網址明確標 XATLAS，與 D800 對照網址分流。
```

### 37.4 簽結

```text
1. 接受方向校正：主線＝完整北牆 XATLAS；D800 contact 線（§20~§36）降為診斷/參考，不正式收斂。
2. 帶得走的資產：縫是架構相依、contact-hug-knee 紀律、bright-overcut audit、x027-y279 參考值、架構標示口徑。
3. 下一步：CODEX 起草「Full North Wall XATLAS expansion plan」新 source.md（涵蓋 37.3 A~F），交 OPUS 審。
4. D800 正式 promotion / pointer flip / provisional 翻面一律凍結，不執行。
5. 本節唯讀校正紀錄，未改產品程式、未重烤、未動 runtime pointer；index.html 交 CODEX 由本 source.md 重生。
```
