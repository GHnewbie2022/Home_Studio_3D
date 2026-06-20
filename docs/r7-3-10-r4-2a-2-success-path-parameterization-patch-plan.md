# R7-3.10 R4-2A-2 — success-path 參數化共用 patch plan（PLAN ONLY）

狀態：plan 交付。未動 source、未接 west、未烤 RAW/OIDN、未進 Phase 2C、未 commit/push。
動因：R4-2B capacity gate＝FAIL_COMPILE_STALL / Case C。真天花板＝「每面一支獨立 UV/success 函式」造成 shader 冷編譯時間超線性爆炸（N=1 firstFrame 6.1s → N=17 首樣本 >180s；非 context-loss、非 atlas）。
目標：把 N 支獨立 UV 函式收斂成「1 支參數化函式 + 每面一筆參數 + loop dispatch」，使編譯成本≈與面數無關。

---

## 0. 現行架構（被取代對象）

```
每面一支 r7310C1XatlasFull<Surface>Uv(...)：
  guard：uR7310C1XatlasRuntimeMode/Ready + uR7310C1XatlasRuntimeFull<S>Mode
  IsSurface 述詞：r7310C1RuntimeSurfaceIs<S>(hitType,objId,normal,pos)
  bbox：每軸 min/max（含固定軸 ±tol）
  特殊排除：r7310C1<S>HiddenByBeamOrSeColumn(...) / 鐵門洞 z,y 範圍（僅部分面）
  UV：t_u=clamp((p[uAxis]-origin)*scale)、localUv01=vec2(mix(u_lo,u_hi,t_u), mix(v_lo,v_hi,t_v))
      （mix 端點同時編碼 half-texel inset=0.5/dim 與 flip 方向）
  投影：master（Rect.xy+localUv01*Rect.zw)/AtlasSize）/ stacked / single
dispatcher r7310C1XatlasNorthWallUv：sequential if(Full<S>Mode>0.5 && Full<S>Uv())return true（各面法線/幾何互斥）
codegen：owner block 由 docs/tools/r7-3-10-surface-owner-codegen.mjs 從 docs/data/r7-3-10-surface-owner-registry.json 生成（禁手改）；UV 軸/flip/inset 標準答案在 docs/tools/r7-3-10-surface-axis-spec.json
```

每面新增 = 多一整支函式（程式碼）→ 編譯線性/超線性成長 = N=17 爆炸根因。

---

## 1. 參數資料放 uniform array 還是小 data texture（問 1）

```
採用：uniform array（std140 vec4[]）。不採 data texture。
理由：
  · data texture 需「新增一個 sampler」→ 撞 MAX_TEXTURE_IMAGE_UNITS(16) 上限風險
    （[[project_fragment_sampler_16_tiu_ceiling]]：>16 sampler → program invalid → 3D 全黑）。
  · uniform array 不增 sampler；以「動態索引 + 單一 loop」存取 → 程式碼大小≈常數（這正是編譯時間的勝因）。
規模估算：每面 ~7 vec4（見問 2）；~30 面 → ~210 vec4，遠低於 M4 Metal MAX_FRAGMENT_UNIFORM_VECTORS（典型 ≥1024 vec4）。
擴張預案：若未來面數超出 uniform 預算，改「打包進既有貼圖的空通道」（不新增 sampler），不回 data-texture-new-sampler。
```

## 2. 每筆 surface param 欄位（問 2）

```
struct R7310SurfaceParam（codegen 產生，~7 vec4/面）：
  vec4 normal_fixedAxis    : normal.xyz（法線）, .w=fixedAxis（0/1/2）
  vec4 bboxMin             : bbox 最小 xyz, .w=mode/enabled（>0.5 啟用，等價現 Full<S>Mode）
  vec4 bboxMax             : bbox 最大 xyz, .w=specialExclusionId（0=無 / 1=eastBeamSeColumn / 2=westBeamSwColumn / 3=doorHole …）
  vec4 uMap                : uAxis(.x 0/1/2), uOrigin(.y), uScale(.z), projectionMode(.w 0 master/1 stacked/2 single)
  vec4 vMap                : vAxis(.x), vOrigin(.y), vScale(.z), normalDotThresh(.w，預設 0.5)
  vec4 mixUV               : u_lo,u_hi,v_lo,v_hi（mix 端點，編 inset+flip）
  vec4 rect                : sub-rect x,y,w,h（master sub-rect）
（int 欄位以 float 存、shader 端 int() 還原；欄位佈局可微調，以 codegen 與 shader 解碼器對齊為準。）
```

## 3. bbox / axis / flip / rect / normal / exclusion 如何表達（問 3）

```
normal     ：normal.xyz；測 dot(visibleNormal, sp.normal) >= normalDotThresh。
bbox       ：bboxMin/bboxMax（vec3 逐軸範圍）；GLSL ES 3.00 支援向量分量動態索引 p[axis]，逐軸 component-wise 範圍測。
axis       ：uAxis/vAxis（int 存 float）；u/v 對應哪個 world 軸；t = clamp((p[axis]-origin)*scale, 0,1)。
flip+inset ：mixUV 四端點 vec4(u_lo,u_hi,v_lo,v_hi)；localUv01=vec2(mix(u_lo,u_hi,t_u), mix(v_lo,v_hi,t_v))。
             端點順序編 flip（hi<lo 即反向）、端點值編 half-texel inset（0.5/dim）。由 codegen 從 spec.flip + atlasW/H 算出，不手填。
rect       ：rect=vec4(x,y,w,h)；master：atlasUv=(rect.xy+localUv01*rect.zw)/AtlasSize；stacked/single 由 projectionMode 分流（少數，保留可回退）。
exclusion  ：
   簡單矩形排除 → 進 param（可選擴充 K 筆 exclusion rect/面；多數面 K=0）。
   複雜幾何排除（HiddenByBeamOrSeColumn、鐵門洞非矩形）→ specialExclusionId 整數 → 一個 switch dispatch 到既有具名述詞（程式碼只一處 switch、非每面內聯）。
```

## 4. 哪些 surface 可共用同一函式（問 4）

```
可共用（全部平面矩形 chart，UV 結構同型）：
  north / east / west / south 牆、ceiling、floor、depth_h2、
  west/east beams、sw/se columns、south window left/right/bottom/top reveals、iron-door reveal、未來 C2A 代表面。
共用函式：
  bool r7310C1XatlasParamSurfaceUv(int surfaceId, int hitType, float objId, vec3 n, vec3 p, out vec2 atlasUv)
  loop dispatcher：
    bool r7310C1XatlasRuntimeSampleAny(...) {
      for (int i = 0; i < uR7310C1XatlasParamSurfaceCount; i++)
        if (r7310C1XatlasParamSurfaceUv(i, ...)) return true;
      return false;
    }
  N 面 = 參數資料，不是程式碼 → 編譯成本≈常數。
```

## 5. 哪些 surface 暫時保留專屬函式（問 5；分階段降風險）

```
階段 1（治 N=17 爆炸，先做）：
  · 「新加入的面」（south / 樑 / 柱 / reveals / 未來 C2A）一律走參數表（data），不新增任何專屬函式。
    → 直接消除 N=17 爆炸來源（新面只加資料、不加程式碼）。
  · 既有已驗面（ceiling/north/east/floor/depth_h2，含 east/west 的 HiddenByBeam 特殊排除）暫保留現行專屬函式。
    → 不動已肉眼驗收的面、零回歸風險。
階段 2（參數函式穩定 + specialExclusionId switch 驗過後）：
  · 把既有面逐一遷入參數表，移除其專屬函式，dispatcher 收斂成單一 loop。
保留為「程式碼」的只有：specialExclusionId 對應的少數具名排除述詞（HiddenByBeamOrSeColumn 等），以一個 switch 呼叫，非每面內聯。
```

## 6. 如何保持 identity / owner / scanner gate 不軟掉（問 6）

```
單一事實來源：param 表「由 codegen 從同一份 registry 生成」，不手寫。
  · 來源：docs/data/r7-3-10-surface-owner-registry.json（owner/identity）+ docs/tools/r7-3-10-surface-axis-spec.json（軸/flip/inset/尺寸）。
  · 擴充 codegen（docs/tools/r7-3-10-surface-owner-codegen.mjs 或同源新 generator）：一筆 registry → 同時產出
      owner const/述詞（既有）＋ param 表列（新）。新增一面只改 registry → 兩邊同步。
不被觸碰（仍是硬 gate）：
  · loader assertR7310C1<S>MasterIdentity（缺欄即 throw）、master-contract-check 的 identity 硬比對、scanner DEV/FORMAL。
  · 參數化只改「runtime UV 計算」，不改「package/pointer identity 驗證」。
新增護欄（plan 要求）：
  · param-vs-registry 一致性 checker：param 表覆蓋面 == registry runtime 面集合，欄位（normal/bbox/rect/axis）與 spec 逐欄相符（仿 master-contract-check 風格、CPU 端、不與 GLSL 共用假設）。
```

## 7. 如何重跑 capacity gate（問 7）

```
用 R4-2B 同一 harness v2（watchdog + 180s/12min 門檻）+ 改版彩排生成器（填 param uniform 陣列 N 筆 data，而非注入 N 支函式）：
  N=1-param      ：baseline，預期 PASS_USABLE。
  N=17-param     ：C1A shell 完整以參數表表達 → 預期 PASS_USABLE（編譯≈常數）＝本重構的關鍵驗證。
  N=26-param     ：worst-case 以參數表表達 → 預期 PASS_USABLE。
每組輸出同 R4-2B：classification / firstFrame / firstSample / 1000SPP / evalTimeouts / contextLost / shaderErr / watchdog / samplesSeries。
```

## 8. PASS_USABLE 後才回 west（問 8）

```
僅當 N=17-param 與 N=26-param 皆 PASS_USABLE，才回 west 800 texel/m 非方格 XATLAS RAW/OIDN（依先前 west 管線：registry/UV/gate/scanner → RAW → cameraState → OIDN）。
未達 PASS_USABLE：不接 west、不烤 RAW、不跑 OIDN。
```

---

## 9. 關鍵風險（plan 必須標註）

```
R-A loop unroll（最大風險、決定成敗）：
  參數化的編譯勝因＝「loop 不被展開」。若 GLSL 編譯器把 uniform-bound loop 完全展開（unroll）成 N 份內聯，
  程式碼又變大 → 編譯再次爆炸（前功盡棄）。
  對策：loop 上界用「uniform 變數 uR7310C1XatlasParamSurfaceCount」（非編譯期常數）逼編譯器留真迴圈；
        若仍被展開，改顯式 while + 動態 break。
  驗證：N=17-param 編譯時間必須≈常數（≈N=1）才算成功；若 N=17-param 仍 FAIL_COMPILE_STALL → loop 被展開、需換策略。
R-B 動態分量索引 p[axis]：GLSL ES 3.00 合法，但個別驅動效能差異需以實測 1000SPP 時間確認（非僅編譯）。
R-C specialExclusionId switch：複雜排除以 switch dispatch；switch 分支數小（少數面），不應重現爆炸；仍須計入。
R-D 既有面遷移（階段 2）：east/west 的 HiddenByBeam 與鐵門洞屬已肉眼驗收行為；遷入參數表後須 cameraState 對照確認 byte 等效，再移除專屬函式。
R-E #ifdef 變體交互：參數化函式仍在 R4-2A runtime variant（不在 DEBUG_PROBES/BAKE_CAPTURE）；改動須保持 wrapcheck 平衡、見證 uniform 反射不破。
```

## 10. 交付順序（每步單獨簽核，不一次到底）

```
P1：codegen 擴充產 param 表 + param-vs-registry checker（CPU 端，不動 runtime 行為）→ 靜態驗。
P2：shader 加 r7310C1XatlasParamSurfaceUv + loop dispatcher（先只給「新面」走，既有面不動）→ wrapcheck + node --check。
P3：capacity 重跑 N=1/17/26-param（harness v2）→ 必須 PASS_USABLE（尤其 N=17-param 證 loop 未展開）。
P4（P3 PASS 後）：階段 2 既有面遷入 + cameraState byte 等效對照。
P5（capacity PASS_USABLE 後）：回 west 非方格 XATLAS RAW → cameraState → OIDN。
家族 B cloud/MIS probe #ifdef 剝離＝次治（縮整體程式、再快一截），排 P3 之後視餘量決定。
C1A/C2A 分流＝架構規則仍採用，但排在參數化之後（單獨解不了 N=17）。
```

紅線：先交 plan、不直接動手；不接 west、不烤 RAW/OIDN、不進 Phase 2C、不 commit/push、不碰 Brave、不軟化 identity/owner/scanner。
