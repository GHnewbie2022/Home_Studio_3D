# R7-3.10 交接：北牆收尾完成 → 下一步「Blender 架構級根治」討論

> 用途：貼給「全新 OPUS / CODEX 視窗」的自包含交接。新視窗無本輪對話記憶，請先讀本檔，再讀下方指名文件。
> 撰寫：OPUS，2026-06-13。

---

## 0. 你是誰、現在在哪

- 專案：`Home_Studio_3D`，R7-3.10 階段。WebGL / three.js 路徑追蹤渲染的音樂工作室房間。
- 分工：**OPUS＝唯讀審查 + 寫 canonical `source.md` 裁示**；**CODEX＝實作 + 重生 index.html + 跑烘焙**。使用者在兩者間中繼。
- 先讀：`CLAUDE.md`、`docs/SOP/R0：全景地圖.md`、本檔、`docs/r7-3-10-arch-cure-blender-cycles-reference.md`。
- 進行中的 review 文件（canonical）：`docs/html-review/2026-06-12-r7-3-10-full-north-wall-xatlas-expansion-plan/source.md`。

---

## 1. 剛完成什麼（北牆收尾，已正式定案）

北牆 lightmap 的「共面接觸線黑線」已全部用**指紋 helper（whole-seam）**修好，並經使用者肉眼 1000SPP raw LIVE 驗收 PASS：

```
床頂（source.md §44）
西樑 west-beam（§68）：plane x=-1.750, y[2.515,2.905], escape +X
東樑 east-beam（§69）：plane x= 1.850, y[2.516,2.905], escape -X
北牆交界：使用者原話「東樑北牆交界修好了 都正常」
```

**技術驗收已全 PASS、北牆 lightmap 收尾。** 依使用者 2026-06-13 指示，CODEX 需完成正式定案（正式 pointer + promote + commit + push main）。
新視窗接手時，先跑 `git log --oneline -5` 與 `git status` 確認 main 是否已含正式定案 commit。

---

## 2. 下一個議題（這次交接的主題）：架構級根治

### 為什麼要做
指紋 helper 是「逐條接觸線、手動圈 y 範圍 + 重烤 + 肉眼驗」的打地鼠法。未來 **GIK 吸音板、南方櫃、桌**等貼牆物件烘焙時，每條新接觸線又要重來一輪。

### 目標（使用者原話精神）
一套規則自動判定、結果跟 LIVE 一模一樣的「自動巡邏系統」，不用每條手動掃。

### 方案＝補上烘焙射線的 self-intersection 防護
經 web 查證確認，這正是 **Blender Cycles 生產環境在用的標準三層**（屬補課，非新發明）：

```
① primitive self-skip：記住起點 primitive、下一跳打到同一個就跳；
   直接光 / shadow ray 兩端都跳（起點 primitive + 光源 primitive）。
② Wächter-Binder 法線 offset（Ray Tracing Gems ch6，免調參）。
③ t_min 近裁面（單用治標，故三層冗餘）。
```

**有開源碼可搬。** 完整業界依據、開源碼搬運點（Cycles 函式名/路徑、RTG offset_ray.cu）、對應我們的修法調整，全在 `docs/r7-3-10-arch-cure-blender-cycles-reference.md`。

---

## 3. 關鍵技術約束（搬運時必守）

```
1. bake-only gated：用 uR738C1BakeCaptureMode（0=LIVE / 2=bake）把三層只掛烘焙射線，
   LIVE 走 no-op、位元不變。LIVE 本無此病，嚴禁動 LIVE 核心。
2. 剔除鍵用 boxIdx（每盒唯一，glsl:4532/4566），嚴禁 hitObjectID
   （結構盒共用=1，glsl:4572，用它會誤剔整類牆）。
3. NEE 半修陷阱：須新增 lastNeeSourceBoxIdx，shadow ray「起點 + 光源」兩端都要記。
   漏此＝只修一半、黑線根因不解。
4. EPS 基準已查明：uEPS_intersect 生效=0.001（bake ×8=0.008），tMinFloor 量級 0.001~0.008。
5. 相關 source.md 章節：§64（路線圖）、§66（worthIt 翻案 + 五前提坐實 + bake-only B1）、
   §67-69（whole-seam 驗收史 + 北牆收尾）。
```

---

## 4. 啟動序（建議）

```
B0 診斷（整條 bake-vs-LIVE 逐列對拍，驗證接觸線屬共面自交）
→ B0.5 零行為等價重構（19 處 rayOrigin → 單一 helper，三機位 bit-exact）
→ B1 bake-only gated（注入三層，LIVE 位元不變）
→ 用現存 whole-seam 指紋當「驗證 oracle」證等價（關指紋 + 開架構修，烤出同樣乾淨）
→ 指紋逐線退役。
停在 B1，不做 B2（LIVE 開閘）：LIVE 無此病、開閘零收益。
```

---

## 5. 待使用者拍板（討論起點）

```
1. 是否現在啟動架構根治 B0。
   OPUS 前評：觸發門檻已滿足——GIK / 南櫃 / 桌 3 件貼牆待烘 + 已有西樑/東樑同病實例。
2. 做到 B1 兩層（t_min + self-skip），還是含第三層 Wächter-Binder 法線 offset。
3. 指紋 whole-seam 何時退役。
```

---

## 6. 工作守則紅線（兩視窗都守）

```
- 100% 繁體中文，嚴禁簡體與中國用語（PostToolUse / Stop hook 會擋並要求補發）。
- 引用官方文件用國際版網域（docs.blender.org、research.nvidia.com 等），禁中國區 .cn。
- 不碰 / 不 pkill Brave（使用者日常瀏覽器，有大量活分頁）；headless 強制 Chrome。
- 烘焙面驗收用「~10 SPP vs LIVE」即可判讀；烘焙面 BUG 與 SPP 無關，勿套「每相機 500 SPP 累積截圖」
  （那是 LIVE 即時光追收斂用，與烘焙面前提衝突）。
- 任何 shader/JS 改動、重烤、commit、切 pointer、promote、碰 Brave 須使用者當次拍板。
- OPUS 寫 source.md（canonical）→ CODEX 重生 index.html；嚴禁只改 index.html（會造成 SOURCE/page 分歧）。
- 信任使用者肉眼實測勝過讀碼 / probe；矛盾時預設是讀錯。
```

---

## 7. 兩視窗的第一步動作

```
新 OPUS：讀 docs/r7-3-10-arch-cure-blender-cycles-reference.md + source.md §64/§66，
         準備「是否啟動 B0」的啟動裁示。
新 CODEX：讀同檔；於 Blender Cycles repo（intern/cycles/kernel/）核對
         intersection_skip_self_shadow / ray_offset() 實際檔名行號；準備 B0 診斷工具
         （整條接觸線 bake-vs-LIVE 逐列對拍）。
```
