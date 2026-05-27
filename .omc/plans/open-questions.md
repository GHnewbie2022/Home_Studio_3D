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
- [ ] **Q13（v2.4 更正，標的 A 連帶）**：共用底層 r7310C1FullRoomDiffuseSamplePatchTexel(1095) 有 ★13 個消費者（12 shadow *Texel：1585/1653/1726/1799/1872/1945/2018/2179/2608/2670/2732/2794 + PatchCoverageProbe 1132），不可盲改。slots 0-6 須分叉成「讀新紋理 + faceSizePx 感知」的取樣全鏈：SamplePatchValidLinear(1107)/SamplePatchPixel(1128)/SampleRectLinear(1167)/RectTent3(1182)/RectTent5(1205) + PatchCoverageProbe 對 slots 0-6 分支。Critic 已驗這 5 函式不被任何 slots 7-22 呼叫（解耦乾淨）— 交 Architect 定案分叉清單。
- [ ] **OQ-C（v2.4 ADR follow-up）**：16 個 dead t*ShadowTexture uniform（glsl:47-62，從未被 texture() 讀取）本期不刪，留待 R4-2 shader 扁平化階段統一清（CLAUDE.md 列 R4-2 為 dead code 刪除階段）。本期僅記錄。
- [ ] **OQ-D（v2.4 ADR follow-up）**：slots 7-22 未來升級觸發條件——某窄陰影面實測仍糊到不可接受時，比照 slots 0-6 走非正方 + 移第二張紋理，記升級成本（per-surface ShadowResolution uniform 各面獨立、可單面升級，不牽動本期架構）。
