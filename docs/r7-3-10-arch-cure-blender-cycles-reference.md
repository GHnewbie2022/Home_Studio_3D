# R7-3.10 架構級根治——業界做法與開源碼搬運點（Blender Cycles）

> 用途：本檔是「烘焙共面自交黑線」架構級根治（source.md §64/§66 的選項 B）的**業界依據與可搬運開源碼**整理，供北牆收尾後與 CODEX 認真討論啟動。
> 從 source.md 抽出獨立成檔，避免 source.md 過長。
> 本檔唯討論／規劃；任何 shader/JS 改動、重烤、commit 須使用者當次拍板後另線執行。
> 撰寫：OPUS，2026-06-13。來源皆國際版官方／論文網域。

---

## 0. 一句話定位

我們要補的「架構級根治」，經查證**正是 Blender Cycles 生產環境在用的射線自交標準做法**。我們不是發明新東西，是補上「自研 three.js 路徑追蹤器當初沒做完整、Blender 早就標配」的那層。連我們發現的「NEE 半修陷阱」，Cycles 的對應函式都幫我們背書。

---

## 1. 我們的病（精簡）

烘焙整面牆 lightmap 時，二次反彈／NEE（直接光）射線從「兩物體共面接觸線」出發，一射出去立刻自交打到緊貼共面的鄰體（樑／牆），直接光幾何項（geometry term）塌陷，算出的 radiance 本身偏暗 → 烤出黑線。即時算圖（LIVE）因相機視角偏一點躲過、無黑線。

根因層：**光線求交階段**（ray epsilon 太小 + 缺 primitive self-skip），可對症根除。

---

## 2. 業界標準＝Blender Cycles 的「三層冗餘」組合

Cycles 處理射線自交不是單一招，而是三層一起上、互為保險：

```
① primitive self-skip：記住「射線從哪個 primitive 出發」，下一跳打到同一個就跳過。
   直接光／shadow ray 進一步「兩端都跳」——起點 primitive + 光源 primitive。
② 幾何法線 offset（Wächter-Binder 2019）：沿幾何法線把起點推開，整數位元偏移、
   免調參數、隨座標量級自動縮放。固定浮點 epsilon 做不到隨量級縮放這點。
③ t_min 近裁面：太近的交點直接不算。傳統做法，但單用會「壓不住斜射 vs 漏掉鄰近合法
   交點」二選一（PBRT v4 明示），所以要靠①②冗餘補。
```

我們共面接觸線正是「斜射 + 緊鄰幾何」的最壞情境 → 三層一起上最穩。

---

## 3. 開源碼搬運點（具體位置）

> 下列函式名／路徑來自 web 查證（agent 讀 Cycles 原始碼 + Ray Tracing Gems）。**啟動前 CODEX 應於 Cycles repo（`intern/cycles/kernel/`）親自核對實際檔名與行號**，本檔僅標方向。

### 3.1 primitive self-skip（Cycles）

```
資料結構：Ray 同時帶 float tmin/tmax（近裁＋遠裁）+ RaySelfPrimitives self
  RaySelfPrimitives 欄位：prim / object（射線起點 primitive）
                          light_prim / light_object（光源 primitive）
  註解原文：prim =「Primitive the ray is starting from」

一般跳過：intersection_skip_self(self, object, prim)
  return (self.prim == prim) && (self.object == object);

直接光／NEE 跳過（兩端）：intersection_skip_self_shadow(...)
  ((self.prim == prim) && (self.object == object))            // 起點 primitive
  || ((self.light_prim == prim) && (self.light_object == object));  // 光源 primitive
  ← 精確對應我們「從接觸線射出的直接光 shadow ray」兩端自交。

設定時機（spawn bounce ray，shade_surface.h）：
  先設 ray.self（primitive skip），再條件式呼叫 ray offset：
    if (ray.self.object != OBJECT_NONE) { ray.P = integrate_surface_ray_offset(...); }
  shadow / 直接光額外呼叫 integrator_state_write_shadow_ray_self
    把「起點 primitive + 光源 primitive」兩端都寫進 self。
```

### 3.2 幾何法線 offset（Wächter-Binder，Cycles `ray_offset()`）

```
Cycles bvh/util.h 的 ray_offset() 逐字就是 Ray Tracing Gems 第 6 章 offset_ray，
檔案註解直接寫「Ray Tracing Gems, chapter 6.」常數一致：
  int_scale   = 256
  origin      = 1/32
  float_scale = 1/65536
做法：沿幾何法線、在浮點 mantissa 的 ULP 尺度上做整數位元偏移，座標越大位移越大；
near-zero 座標退回小幅浮點加法。
```

### 3.3 RTG 第 6 章原始碼（可直接讀的參考實作）

```
offset_ray.cu（Apress 官方 GitHub）：
  github.com/Apress/ray-tracing-gems/blob/master/
    Ch_06_A_Fast_and_Robust_Method_for_Avoiding_Self-Intersection/offset_ray.cu
```

---

## 4. 對應到我們的 §66 修法（搬運時的關鍵調整）

```
1. self-skip 剔除鍵用 boxIdx（每盒唯一），嚴禁用 hitObjectID——結構盒共用 hitObjectID=1
   （glsl:4572，objectCount=0），用 objectID 會誤剔整類牆。boxIdx 親核可用（glsl:4532/4566）。

2. NEE 兩端 skip ＝ §66.4「半修陷阱」：目前只快取 objectID 不夠，必須新增 lastNeeSourceBoxIdx，
   且 shadow ray「起點 + 光源」兩端都要記（對應 Cycles intersection_skip_self_shadow）。漏此＝只修一半。

3. 第三層 offset（Wächter-Binder）建議納入：我們 §66 目前寫 t_min + self-skip 兩層；
   PBRT v4 指出 t_min 單層治標，Cycles 是三層。共面接觸線是斜射最壞情境，三層最穩。
   惟須留意：法線 offset 沿幾何法線推，與我們指紋 helper 的「escape 方向（+X/+Y）」可能不共線；
   評估時對照 §64.5 誠實邊界（lift 方向 vs 法線 offset 不一定共線）。

4. bake-only gated：用 uR738C1BakeCaptureMode（0=LIVE / 2=bake）把三層只掛在烘焙射線，
   LIVE 走 no-op、位元不變（§66.2 已坐實旗標存在、SceneIntersect 共用靠呼叫端 gate）。
```

---

## 5. 重要澄清：Blender 的 bake「Margin」不是這個

使用者直覺「成熟軟體有成熟邊界規則可照抄」——方向對，但**該抄的是上面第 2~4 節的射線自交，不是 bake Margin**。

```
Blender bake Margin（Extend / Adjacent Faces dilation）＝紋理空間階段：
  烤完後把 UV 島邊緣像素往外複製，解「UV 接縫因 texture filtering / mip-mapping 取樣溢出」。
  它在像素「已寫入後」才動作、只搬既有值、不重算光。
對我們的黑線：無效，且方向相反——會把「已算錯的暗值」往外擴、讓黑線更寬。
結論：margin 只能當「最後補 UV 接縫取樣溢出」的常規修飾，永遠不是黑線解法。
Cage / Ray Distance / Extrusion 只用於 Selected-to-Active 高轉低模射線對位，與本案無關。
```

---

## 6. 來源（國際版官方／論文）

```
Blender 烘焙手冊（margin / cage）
  https://docs.blender.org/manual/en/latest/render/cycles/baking.html
Bake Margin Type（Extend / Adjacent Faces）Python API
  https://docs.blender.org/api/current/bpy_types_enum_items/bake_margin_type_items.html
射線自交穩健解 Wächter & Binder 2019（NVIDIA Research）
  https://research.nvidia.com/publication/2019-03_fast-and-robust-method-avoiding-self-intersection
RTG 第 6 章 offset_ray.cu（Apress GitHub）
  https://github.com/Apress/ray-tracing-gems/blob/master/Ch_06_A_Fast_and_Robust_Method_for_Avoiding_Self-Intersection/offset_ray.cu
```

---

## 7. 啟動前置（沿用 §66）

```
1. EPS 基準已查明：uEPS_intersect 生效=0.001（bake ×8=0.008），tMinFloor 量級 0.001~0.008（§66.2 第 5 點）。
2. 觸發門檻已滿足：GIK / 南櫃 / 桌 3 件貼牆待烘（§66.5）；西樑、東樑已是同病實例。
3. 序：北牆收尾（東樑+北牆交界修好）→ 認真討論啟動 → B0 診斷（整條 bake-vs-LIVE 逐列對拍，
   同時驗證「整條同屬共面自交」）→ B0.5 等價重構 → B1 bake-only gated → 指紋當 oracle 證等價 → 退役。
4. 現存指紋 whole-seam（west-beam y[2.515,2.905]）保留為架構修的「驗證 oracle」。
```
