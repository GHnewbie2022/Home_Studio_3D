# Open Questions

> 跨 plan 的未解問題、延後決策、待使用者裁定事項集中於本檔。
> Planner / Analyst 產出新 plan 時把 open questions 追加於此，而非散落於各 plan。

## R3-6.5 動態光源池 — 2026-04-20（iter 2 更新）

- [ ] **Q2**：shader helper 雙函式並存 vs 單函式 `uR3DynamicPoolEnabled` 分支 — 前者（iter 2 採納）rollback 二分定位乾淨但維護成本 × 2、後者維護簡潔但有 GLSL Dead Code Elimination（死碼消除）風險（對齊 memory `feedback_pathtracing_dce_sink_gate_trap.md`） — 影響日後刪除 legacy helper 的時機（FU3）。Architect iter 2 可複核此選擇，若仍堅持單函式則須附 DCE 量化證據。
- [ ] **Q4**：contract test `docs/tests/r3-6-5-dynamic-pool.test.js` 落地時機 — Step 6 與 End-to-End 驗收合併 fix06 vs 獨立 `r3-6-5-fix07-contract-test` — 影響 cache-buster 數量與 ultrawork 迭代粒度。

> iter 2 已決議移除：
> - ~~Q1（pdfNeeForLight 讀 uniform vs 加參數）~~ → 採「加 `float selectPdfArg` 參數」，記入 R3-6.5.md ADR Decisions
> - ~~Q3（observability N 值顯示位置）~~ → 採「GUI label 即時顯示 N」，Step 6 實作 `activeLightCountDisplay` textCtrl

## R6-1 階段 1（Bilateral Post-Denoise）

> Open Questions 已遷入 docs/SOP/R6-1：雙邊濾波後處理降噪.md §G

## R6-2 Phase 1.5 Step 2 leaf fetch packing — 2026-04-27（Planner v1）

來源：`.omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md` §F

- [ ] **Q1**：5-texel 順序重排「真的能 early-out 省 fetch」嗎？— ANGLE 編譯後是否 serialize texelFetch、是否 burst coalesce 已抹平人工 early-out 收益 — 影響整個 Option 3 的核心假設；建議 Architect 提 steelman antithesis「人工 early-out 收穫 0%」並設低成本反證實驗。
- [ ] **Q2**：是否存在 Option 5（4-texel layout）？— uintBitsToFloat 把 fixtureGroup/cullable/meta/type 四個整數 pack 進單 channel，per-box 直接省 20% fetch 數 — 影響是否升級首選方案；待 Architect/Critic 評估「不損精度」邊界。
- [ ] **Q3**：updateBoxDataTexture 之外是否有第三條 boxData 寫入路徑？— grep `tBoxDataTexture.value` 確認 — 影響 Step B 雙端同步完整性；交 Critic 驗。
- [ ] **Q4**：NEE shadow 路徑是否也呼叫 fetchBoxData？— grep `fetchBoxData(` 全部呼叫點 — 影響 Step C 是否漏改一處；交 Architect 驗 grep 結果。
- [ ] **Q5**：C3 21% frame-skip 異常是否會把 Step D 量測污染到誤判通過？— 建議 commit 門檻改「C1/C2/C4 至少 2 個 ≥ +5%」、C3 取消投票權僅供參考；交 Critic 裁決。
- [ ] **Q6**：本步驟是否同步把 BVH_TEX_W 從 512 升 1024 為 R3-8 採購擴張預留？— 建議否（守 P1 域純度），R3-8 階段獨立做；交使用者最終裁定。
- [ ] **Q7**：USE_PACKED_BOXDATA 切 hard-code `#define` 還是 runtime uniform？— 建議 hard-code（compile-time）以 Step D 跑兩個 build 對比；交 Architect 確認對 Step E 後續維護負擔評估。

## R6-2 桶 4 F2 三段 timer 拆解 — 2026-04-27（Planner v3，Critic ITERATE 後採 OQ1 嚴格版）

來源：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` §F + §H v3 條目

> v3 修訂歷程：
>   Planner v1 → Architect r1 REVISE（5 致命 + 4 應修）
>   → Planner v2（5 致命全閉鎖）→ Architect r2 APPROVE w/caveats（3 caveat）
>   → Critic r2 ITERATE（4 MAJOR + 5 MINOR + 3 建議）
>   → 使用者裁示採 B 選項：跳過 Round 3 共識、採 OQ1 嚴格版
>   → Planner v3（4 MAJOR + 3 caveat 全閉鎖、本檔同步）

- [ ] **Q1**：probe 切點位置是否最佳？— Stage A：mode 1 在 sampleStochasticLightDynamic L262 後 / L263 前 early-return + caller-side 10 處 NEE dispatch break；mode 2 在 SceneIntersect 後 (L971) / hitType 分支前 (L1013) 區間 break + 4 個發光 hitType emission 預載（LIGHT + TRACK_LIGHT + TRACK_WIDE_LIGHT + CLOUD_LIGHT）。Stage B 改 #ifdef N+1 編譯時 build。改切點則差分公式變、業務語義變、§A.2 D1 須重寫；v3 已 lock。
- [ ] **Q2**：NEE shadow ray 之 secondary SceneIntersect 算入 BVH 還是 NEE？— Stage A 採前者（業務語義打折扣、T_NEE 不含 secondary BVH 走訪、歸 T_first_hit_BVH）；Stage B Option 3 #ifdef 整段 wrap 後可徹底切離。v3 lock：兩階段策略採納。
- [ ] **Q3**：量測 window 內 sampleCounter 安全區間？— 當前 [10, MAX_SAMPLES − 100]、替代 sceneIsDynamic = true 強制 sampleCounter = 1.0（會打亂 progressive refinement 視覺對比） — 影響 RAF host throttle 對齊紀律；交 Critic 評是否需 needClearAccumulation 自動觸發。
- [ ] **Q4**：C3 21% frame-skip 處理 — v3 lock 採「標棄權無投票權」（對齊 plan v3 leaf-packing §C.5 體例 + Phase 1.0 §5 21% frame-skip 教訓）；替代「加投票權 + 5% 修正係數補償」延後評估、僅作 follow-up F-F2-2。
- [ ] **Q5**：probe build 半年保留還是即移除？— v3 lock 採「保留半年」（對齊 plan v3 ADR 體例 + USE_PACKED_BOXDATA 同期）；F2 完工後評估 follow-up F-F2-1。
- [ ] **Q6**：若 Step 0 fail-fast，升 Option 3 (N+1 編譯時 build) 還是退場？— v3 lock 採嚴格版：< 1% 合格 / ≥ 1% 即升 Stage B（Option 3 #ifdef）、Stage B 仍 fail-fast 才退場（Path U）；取消 v2「1%~3% 警告繼續 Stage A」帶（Critic MJ2）。
- [ ] **Q7**：若 mode 1/mode 2 視覺截圖肉眼判斷與預期不符（如 mode 1 不夠暗）是否需 GPU pipeline trace 補證？— 影響 Test I3/I4 acceptance 標準；交 Architect 評。
- [ ] **Q8**：結論判斷規則「≥ 30% 為瓶頸」之灰色帶（28~30%）處理？— 標「準瓶頸」還是「不可信」 — SOP §86 寫「>30%」與本計畫採「≥ 30%」差 1% 視為對齊但灰色帶處理需明確；交 Critic 確認。
- [ ] **Q9**：EXT_disjoint_timer_query_webgl2 query pool 大小？— 當前推測 8（ANGLE/Metal 限制）、替代 4 / 16 — 影響 Scenario 2 GPU_DISJOINT 觸發率；2026-04-27 探針已驗 EXT 支援、pool size 待 Step 0-2.5 量測補驗。
- [ ] **Q10（v3 新增，Critic MJ4）**：mode 2 emission 預載是否該擴大到所有發光 hitType？— v3 採「LIGHT + TRACK_LIGHT + TRACK_WIDE_LIGHT + CLOUD_LIGHT」共 4 個發光 hitType（Cam 1 視場含吸頂燈 + 軌道燈、必須涵蓋）；shader 親證 hitType 平行分支共 17 處、其中 4 個為發光體；若實作後仍有發光體分支漏列（如 second CLOUD_LIGHT L1664 OR-and case），補列即可。
- [ ] **Q11（v3 新增，Critic OQ1）**：Stage A 失敗為「預期常態」還是「異常」？— v3 採嚴格版「預期常態」、視為 Step 0a fast-skip 探針價值（即使 Stage A 9 hr 工程沉沒、Stage B 升級路徑仍有效）；對應 Critic 推薦 OQ1 嚴格版。

## R7-3.10 B 方案（per-surface texel density 逐面貼圖像素密度）— 2026-05-27（Planner deliberate，v2 修訂）

來源：`.omc/plans/R7-3.10-B-per-surface-texel-density.md` §7（v2 已依 Architect=REVISE / Critic=REJECT 修訂）

> v2 變更：M（中間路線分磚）已淘汰（核實與單一 scalar resolution 衝突）；packer 改手寫 23 筆 rect 常數表；
> 契約改動由 2 處更正為 18 處（CODEX 重疊 14 處）；新增工具缺口與 inset 各軸換算。

- [ ] **Q1**：全室目標密度 D 的確切值？— 建議 ≈590 texels/m（北牆 1.7 mm/texel，相對現況 3.4 翻倍）— 更高 D 更清但 atlas 更大、烤更久（北牆約 4.2M texel、現 1.05M 約 4×，時間約隨 texel 線性）；更低 D 治糊不足 — 影響 §0 階段 0 試算表與總烤時間；交 Critic 核密度帶。附總 texel/烤時間估算（由 §8 工具 9 輸出）。
- [ ] **Q2**：atlas 邊長對齊規則 POT（2 的次方）vs 4-texel 倍數？— 建議 4-texel（密度最齊、與 §5 padding 同粒度）；POT 浪費且密度仍不齊 — 影響密度一致性；交 Architect 定。
- [ ] **Q3（v2 改寫）**：排版用手寫 23 筆 rect 常數表 vs packer？— v2 預設手寫常數表（重用 slot 6 既有手寫島嶼表範式 glsl:1460-1470，K 神最小實作）；packer 僅當面數 >40 或需 runtime 增刪面才採 — 影響 §1 階段 3 工程量；交 Architect 確認門檻。
- [ ] **Q4（v2 改寫）**：北牆止血路徑？— v2 已淘汰中間路線 M（核實 r7310C1RuntimeAtlasResolution() 回單一 scalar、與北牆 2048²+其餘 1024² 混排衝突，§6），改「北牆單面直走 B-full uvRect 路徑」止血 — 交 Architect 確認此取代成立。
- [ ] **Q5（v2.3 更正維度）**：uvRect/faceSizePx 傳遞 uniform ★vec4[7]+vec2[7]=42 floats（slots 0-6，較 v2.1 的 138 大降；glsl:186-231 有固定大小陣列先例，現最大 [11]）vs 貼圖查找表？— 影響 §1 階段 4 shader 改法；交 Architect 確認 < fragment uniform 上限（§8 工具 12 實證）。
- [ ] **Q6（v2.3 更正維度）**：GPU MAX_TEXTURE_SIZE + fragment uniform 餘額實測值？— 非正方 atlas 總尺寸上限與 ★vec4[7]+vec2[7]=42 floats（slots 0-6，較 v2.1 的 138 大降）須實證 — 影響 D 上限與 Q5；階段 3 開工前由 §8 工具 12 量。
- [ ] **Q7（協調點，★v2.3 重算）**：B 階段 2 真正改動 = ★A 類 9 處 expectedBytes（slots 0-6），其中落 CODEX 73% 修復同區(≥3144) = ★6 處（3156/3220/3282/3345/3414/3494）；A 類 3 處（2957/3024/3089）區外可較早動；B 類 8 處（slots 7-22）本期不改、不衝突 — 規則「A 類 6 處重疊面等 CODEX merge 落地後開工，開工前 git pull + 契約測試全綠 + check-r7310-runtime-atlas-patch-count.cjs 綠，限縮改 expectedBytes/DataTexture 不碰 requestedSamples 行」— 交 Critic 確認排序。
- [x] **Q8（v2.3 結案，Critic 溯源 + C-B1 分類）**：18 處 expectedBytes 按 targetId 分 = ★A 類 9 改非正方（2957/3024/3089/3156/3220/3282/3345/3414/3494，slots 0-6）/ B 類 8 維持方形（3591/3674/3757/3842/3928/4011/4094/4178，slots 7-22）/ preview 1 豁免（2888）。A 類含 FLOOR/NORTH/EAST（guard 溯源 2945/3012/3077）。→ 改 9、維持方形 9。結案。
- [ ] **Q9（v2.1 改寫）**：試點選擇 — ★v2.1 R6 更正：取樣端零 resolution 依賴的乾淨面不存在（所有 Sample* 都要 atlasUv×resolution 轉像素座標），故改以「變因最少」為準 → 首選 Ceiling(slot 5，UV 端純線性 + 取樣端最單純 SamplePatchValidLinear)，次選 EastWall(slot 2，取樣端 RectTent3 多兩層 res)。WestWall(slot 3) UV 端疑似乾淨待 Architect 逐行複核 — 影響 §1 階段 4 試點順序。
- [ ] **Q10（v2.3 更正維度）**：docs/tools/ 目前無 texel 密度量測（工具 9）、密度回歸鎖（工具 10）、★slot↔常數表↔uvRect[7] 三同步點鎖（工具 11，僅 slots 0-6）、GPU 上限/uniform 餘額探針（工具 12）— 四支全須新建，否則驗收門檻「密度比≤1.25、北牆 3.4→≤1.7」不可測、P1 單一參數治理無 enforcement — 交 Architect/Critic 確認工具規格與落地時機（建議工具 9/12 排 T0 前置）。
- [x] **Q11（v2.1 結案，Critic 裁定 Planner 正確）**：階段 4 與 4b 在 shader 層為「不可分原子步驟」（取樣端 resolution 不可分，錨點 7b）— 改 Ceiling 核心包圍盒公式時，5 個 Sample*(1095/1107/1167/1182/1205) 內部 resolution→faceSizePx 須同步改。Critic 終審裁定：此原子合併不違反「分層可獨立驗收」原則 P3（層間 runner/契約/compositor/shader 獨立驗收仍成立，只 shader 層內部假切分合併）。結案。
- [x] **Q12（v2.4 定案，Critic 第 4 輪以證據裁定甲）**：採「甲＝2 張紋理」。slots 0-6 移第二張非正方紋理（新 sampler2D tR7310C1FullRoomDiffuseAtlasTextureNonSquare）、slots 7-22 留現有 combined 等格紋理 tR7310C1FullRoomDiffuseAtlasTexture（glsl:46，唯一被讀 diffuse 紋理、讀取點 1081/1105）不動。乙（單張混排）已排除：SamplePatchTexel 等格佈局（column=mod(slot,6)、固定正方格）硬假設正方、slots 0-6 非正方塞不進、會破壞 slots 7-22 等格。→ 階段 3 產 2 張 DataTexture。★Architect 階段 3 開工前最終複核。
- [~] **Q13（v2.4，★已被新基線 Q-F 取代）**：v2.4 列「分叉 5 函式 + probe 分支」。新基線 v2 第 1 輪 critic 核實此清單**不完整**——漏底層 SamplePatchTexel（5 外層內部最終全呼叫它、硬綁舊紋理）→ 只分叉 5 外層 slots 0-6 仍全黑。新版更正為「6 標的」（底層 SamplePatchTexelNonSquare + 5 外層 NonSquare 版 + probe 分支），見新基線 Q-F。★以新基線 Q-F 為準，本 v2.4 Q13 作廢。
- [~] **OQ-C（v2.4，★已遷入新基線計畫 ADR Follow-up OQ-1）**：16 個 dead t*ShadowTexture uniform 本期不刪、留 R4-2 統一清。內容不變，已寫入新計畫 §7 ADR Follow-ups OQ-1。本檔此條僅留歷史。
- [~] **OQ-D（v2.4，★已遷入新基線計畫 ADR Follow-up OQ-2）**：slots 7-22 未來升級觸發條件。內容不變，已寫入新計畫 §7 ADR Follow-ups OQ-2。本檔此條僅留歷史。

> ★版本混雜標註（2026-05-28 第 1 輪 ITERATE 後）：以上 Q1-Q13/OQ-C/OQ-D 屬「舊基線 v2.x 系列」，多數已結案或被新基線取代。
>   新基線 4941338 + CODEX 契約修復的有效開放問題＝下方「per-surface texel density v2」區塊的 Q-A~Q-J。
>   v2.4 Q13 已被新基線 Q-F 取代（5→6 標的）；OQ-C/OQ-D 內容已遷入新計畫 ADR Follow-up（OQ-1/OQ-2）。其餘 v2.x 結案項（Q8/Q11/Q12 等）僅留歷史。

## R7-3.10 B 方案 per-surface texel density v2 — 2026-05-28（新基線 4941338 重核）

> 對應計畫：`.omc/plans/R7-3.10-B-per-surface-texel-density-v2.md`。舊版 v2.4 經 critic REJECT，新基線重寫；第 1 輪共識 VERDICT=ITERATE，已修 5 必修 + 2 張力 + 1 OQ + CODEX 契約 3 點，本版定稿交 CODEX 二審。下方 Q-A~Q-J 為新基線有效開放問題（取代上方 v2.x 系列）。

- [ ] **Q-A**：對齊規則 POT（2 次方）vs 4-texel 倍數 — 建議 4-texel。CODEX 二審核可。
- [ ] **Q-B**：全室目標密度 D 確切值 — 建議 ≈590 texels/m — 核密度帶 + 工具 4 出 GPU 數據後可能須降 D（VRAM 門檻）。
- [ ] **Q-C2a（第 1 輪張力 2 改寫，已綁 VRAM 決策）**：refresh 段 A 對 slots 0-6 那 7 格 — 不再「無腦黑圖」，與 VRAM 決策綁同一點：工具 4 出 MAX_TEXTURE_SIZE 後，若第二張紋理單邊逼近上限優先「縮 16 格佈局」（降級 2，回收約 118MB + 騰單邊預算），單邊充裕才「餵黑圖」。CODEX 二審裁。
- [x] **Q-D（第 1 輪定案，CODEX 契約 3）**：runner 3 個未提交檔由 CODEX 修復、buildR7310RuntimePointer 已加 c1_south_wall enrich 分支。階段 1 待 CODEX 這批 commit 落地後「接在其上」加 per-surface 解析度、保留 enrich 分支、不另開新檔、不覆蓋。
- [ ] **Q-E**：手寫 7 筆 uvRect 常數表 vs runtime packer — 本期手寫；packer 僅當面數 >40 或需 runtime 增刪面才採。CODEX 二審確認門檻。
- [ ] **Q-F（第 1 輪必修 1 更正為 6 標的）**：slots-0-6 取樣鏈分叉清單 = 底層 SamplePatchTexelNonSquare（標的 0，讀第二張紋理 + per-axis faceSizePx）+ 5 外層 NonSquare 版（標的 1-5）+ PatchCoverageProbe slots 0-6 分支。★原 v2.4「只 5 外層」漏底層會致 slots 0-6 全黑。Critic 初判不被 slots 7-22 呼叫，交 CODEX 二審終核 6 標的與「分叉乾淨」。
- [ ] **Q-G**：VRAM 超門檻是否啟用降級 4（拆兩張非正方紋理 + slot→sampler 路由）— 階段 3 工具 4 出數據後裁。
- [x] **Q-H（第 1 輪必修 4 定案）**：16 個 shadow loader catch 補 markStepComplete 升為「階段 -1 必做」（與 9 diffuse loader 同批）；spec-driven loadR7310C1DedicatedBeamColumnShadowRuntimePackage catch 補 spec.stepName。理由：留任一 enabled loader catch 缺 mark 即拆鎖不完整。
- [ ] **Q-I（第 1 輪 OQ）**：slot 6（structural）島嶼 rect clamp 與 uvRect 面層映射兩層組合的具體 GLSL 公式 — 標「階段 4 實作前待補」，CODEX 二審或實作者落地時定（原則：先面內 clamp 後面層映射、不相乘）。
- [ ] **Q-J（第 1 輪 CODEX 納入 1）**：南牆（slot 4）NonSquare 取樣鏈消費 windowHole/windowRevealAtlasRegions 時，「世界座標（公尺）→ texel/UV」換算用該面 faceSizePx、禁寫死 1024。CODEX 二審確認南牆分叉鏈 region 換算式正確。

## R7-3.10 B 方案 per-surface texel density v4 — 2026-05-29（全室標準 + Metal + 16-sampler 重核）

> 對應計畫：`.omc/plans/R7-3.10-B-per-surface-texel-density-v4.md`（SUPERSEDES v3）。
> 標準升級：全 23 面（含全部窄面 slots 7-22）一律 worldSize × 同一 D、密度一致，無例外（v3「窄面留 1024」妥協已被使用者 REJECT）。
> 架構：單一共用非正方 atlas + per-slot uvRect（active sampler +0，守 Metal 16 天花板）。執行漸進：北+東試點 → 逐批擴張。
> v2 區塊 Q-A~Q-J 在 v4 重裁（CLOSE/DEFER）詳見 v4 計畫 §6。下方為 v4 新增的有效開放問題。

- [ ] **Q-K（v4 新增）**：全室 D=590 單一共用 atlas 打包後單邊是否 ≤ 實測 MAX_TEXTURE_SIZE（M4 典型 8192/16384）？— 影響是否須降 D（全室一起降，首選）或拆 ≤2 張共用 atlas（後者 +1 sampler 會破當前 active=16 零餘裕，須先退役舊正方紋理才可行）— Phase 0 GPU 探針出數據後由 Architect 裁。
- [ ] **Q-L（v4 新增）**：slots 7-22 的 12 個 *ShadowTexel / shadow 取樣鏈改走 NonSquare 後，取樣語義（ValidLinear vs RectLinear vs tent）逐面對應是否完全一致？— 影響 Phase 4 窄面正確性回歸（非密度，是正確性）— 交 Architect 逐面核。
- [ ] **Q-M（v4 新增，v5 升級為白漆貼圖前置必做）**：舊正方紋理 tR7310C1FullRoomDiffuseAtlasTexture 何時可安全刪宣告？— 須全 23 面 e2e 確認 fallback 路徑不再被觸發才刪（過早刪會斷 fallback），且不能靠 DCE（fallback 靜態引用，須實體刪除 fallback 分支 + 舊取樣函式 + 舊宣告），刪後 active sampler 再 -1 騰餘裕 — ★v5 重裁：分離本身 +0 sampler 不需此退役；僅當做「選配牆面白漆貼圖（+1 sampler）」時才前置必做 — Phase 4 裁。

## R7-3.10 B 方案 v5（分離烘焙：烤純光 + runtime 乘材質）— 2026-05-29（Planner deliberate，pivot 後重核）

> 對應計畫：`.omc/plans/R7-3.10-B-per-surface-texel-density-v5.md`（SUPERSEDES v4）。
> Pivot：放棄「混烤（光×材質一起烤）+ 拉 D」。全室漫反射改「分離烘焙」＝atlas 只烤 irradiance（到達該面的純光，含 color bleed 溢染、不含本面 albedo），runtime 取樣後乘該面 albedo/貼圖。直接光維持 NEE LIVE（已含 albedo、不再乘）。反射/亮面隨視角維持 LIVE（逐項拆）。全烘焙終極範圍含貼圖物件（GIK/喇叭漫反射項/門/窗）。
> 執行漸進：北牆分離試點（收斂後區塊均值比 ∈ [0.98,1.02]，非逐像素）→ 結構面批次 →（待 spike）貼圖物件 → 選配白漆貼圖。
> ★第 1 輪共識（Architect=REVISE、Critic=ITERATE）已套用 R1-R9：兩條烤值消費路徑（R1）、結構面 NEE 證據改正（R2）、收斂後區塊均值比取代 pixel-exact（R3）、pointer 改用新旗標不動語義鍵（R4）、first-hit forcing 完整 mask 鏈（R5）、borrow clamp 審計（R6）、Phase 3/4 降為待 spike（R7）、L-union albedo（R8）、Phase 0 新建測試檔（R9）。
> ★第 2 輪共識（Architect + Critic 皆 APPROVE）已 finalize F1-F6 定稿：forcing 改「全 albedo 層定值後令 hitColor=vec3(1.0)」（F1，修正只中和 uWallAlbedo 漏 boxColor）、貼圖物件第三條 per-object NEE 路徑正名 + GIK「有 NEE 耦合」改正（F2）、全檔行號實測校正（F3）、shader diffuse mode uniform 單一真相源（F4）、ADR 自含五個關鍵決策（F6）。
> v4 / v2 區塊 Q1/Q-B/Q-A~Q-M 在 v5 重裁詳見 v5 計畫 §7。下方為 v5 新增的有效開放問題。

- [ ] **Q1 / Q-B（v5 重裁，移除硬寫 590）**：全室目標密度 D 確切值 — ★v5 改「由北牆 irradiance 試點實測決定，不硬寫」。分離後細節改由貼圖負責、光照圖只解析平滑光 + 光影邊 → D 大概率降低（≤ 590、甚至 ≤ 512）。590 降為「上限參考值」（實測 D 超過它代表分離沒移走材質職責、須查 bug）— Phase 0 工具出候選帶（300/420/512/590）VRAM/單邊表、Phase 1 北牆試點選「能解析光影細節的最低 D」為全室 D — Phase 1 GATE-D 定。
- [ ] **Q-N（v5 新增，分離最易切頂風險）**：bake capture path（captureR738C1DirectSurfaceTexelPatch 等 3 個 render 點 + atlas 寫入）是否有 [0,1] clamp 會把「純光（irradiance，值域 > 混烤值）」切頂？— 純光因移除 albedo<1 的壓抑，值域比混烤大；若 capture/blit clamp 到 [0,1] 會切亮部 → 分離後亮面偏暗失真 — 交 CODEX 確認 atlas 格式（RGBA32F 應無 clamp，但 capture/blit 路徑須逐點查）+ 契約測試 7 鎖 — Phase 0 規格 + Phase 1 GATE-CLAMP 驗。
- [ ] **Q-O（v5 新增，分離正確性核心，★F1 定稿）**：bake capture 的 first-hit forcing 乾淨改點？— ★F1：須「bake 模式 + first-hit 命中目標面時，在 hitColor 三層全部定值之後（glsl:4154 boxColor / 4155-4156 L-union dynamic / 4159 *= uWallAlbedo 全部之後）、glsl:6454 mask*=hitColor 之前，令 hitColor=vec3(1.0)」一次中和全 albedo 層；後續 bounce 維持真實色（保 bleed）。★修正 v5 原「只中和 uWallAlbedo」漏 boxColor。★注入點順序寫死「三層後、6454 前」否則 L-union 覆寫抵銷 forcing。親證 first-hit 判定 r7310C1NorthWallIndirectBakeFirstHit(glsl:1661，呼叫點 5660) — 交 CODEX 隨 Q-R 確認不誤抽 bleed、不漏設 — Phase 1 GATE-BLEED 驗。
- [ ] **Q-P（v5 新增，貼圖物件分離）**：貼圖物件（GIK/喇叭/門/窗）分離納入烤的「irradiance patch 配置」（atlas 區域 + uvRect）與「既有 sampler 復用作 albedo」如何配置？— 須確認復用 uGikGrayTex/u150F/u750F/uWoodDoorTex/uWinTex 等既有 sampler（+0 sampler）、patch 是否增 surfaceKey（影響 settle gating）— 交 Architect/CODEX 在 Phase 3 細化。
- [ ] **Q-Q（v5 新增，逐項拆點，★R7 升級為 Phase 3 前置 spike）**：貼圖物件（走第三條 per-object NEE 路徑，F2）的「漫反射項」是否可從直接光 NEE 乾淨抽出？— 喇叭 diffuse 分支(glsl:4896-4925)與 NEE 耦合（4917 sampleStochasticLightDynamic + 4921 mask*=weight）、且有 stochastic 反射/金屬切換(4884/4893) → 漫反射項非閉式可抽。★Phase 3 前置 spike：先用 GIK（glsl:5181-5207，無 stochastic 反射、最乾淨，但★有 NEE 耦合 5196/5200——F2 改正）驗可分離性，通過才納入；失敗則貼圖物件維持 LIVE、本期不烤。★不拿喇叭當第一個 — 交 Architect 逐物件核 — Phase 3。
- [ ] **Q-R（v5 新增，缺口 7，★R1/R5/F1 注入點前置）**：bake capture 模式（uR738C1BakeCaptureMode==2）下 first-hit 實際走哪條路徑？— short-circuit 在 glsl:2989 `if(uR738C1BakeCaptureMode!=0) return false` 關閉、hybrid 在 glsl:1648 `uR738C1BakeCaptureMode==0` 關閉 → first-hit 應走「普通 NEE 路徑 glsl:6454」，須 CODEX 逐行確認 — 決定 F1 forcing（在 4154/4155-4156/4159 全層後、6454 前令 hitColor=1）的精確注入位置 — CODEX 先確認再動 shader — Phase 1 前置。
- [ ] **Q-T（v5 新增，GATE 比帶容差，★R3）**：GATE-PIXEL 的 ±2% 區塊均值比帶是否足夠？— 2000 SPP 收斂雜訊 floor 須實測：Phase 0 先用「現行混烤版同版本、兩個不同 seed」量同面區塊均值雜訊分佈，據此定容差（雜訊 >2% 則放寬比帶或提高 SPP）— Phase 0 規格 + Phase 1 套用。
- [ ] **Q-S（v5 新增，★F2 改正 + F4 回填）**：GIK 取樣分支（glsl:5181-5207）的可分離性 — ★F2 已親證 GIK「無 stochastic 反射分支但有 NEE 耦合（5196 dispatch + 5200 mask*=weight）」，spike 驗證對象＝「第三條路徑的漫反射項能否從 NEE 耦合分離」（非「GIK 是否無 NEE 耦合」）。★F4 回填：實作層該面是否乘 albedo 由 diffuse mode uniform 統一真相源閘控（與 JS 旗標同源、不在 GLSL 硬寫面清單）— 下輪交 Architect 確認 GIK 第三條路徑分離的 GLSL 改法 — Phase 3 spike 前置。
- [ ] **Q-U（v5 新增，★F5）**：北牆 boxColor 實值待 CODEX 確認 — 決定「雙層 albedo 缺口（boxColor + uWallAlbedo）」在 Phase 1（北牆 boxColor 非純白即暴露）還是 Phase 2 暴露；★F1 forcing 令 hitColor=vec3(1.0) 對「boxColor 純白 / 非純白」兩種情況皆安全（一次中和全層），故此 OQ 不阻擋 Phase 1，僅供驗收歸因 — Phase 1。
