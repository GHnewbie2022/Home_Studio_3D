# R7-3.10 上線策略 B 路（不推 LFS 大檔、工作本體上 GitHub）— 交 CODEX 審查報告

撰寫：OPUS　日期：2026-06-15　分支：`codex/r7-3-10-arch-cure-blender-cycles-migration`
狀態：**尚未執行任何 history rewrite／merge／push**；等 CODEX 審查 ＋ 使用者拍板。

---

## 一句話總結

使用者確認沒有付費 GitHub LFS。免費 LFS 僅 1 GiB，而本次 push 會新增約 734 MB 的烤圖 LFS 大檔，極可能撞配額；且這些大檔在 GitHub Pages 上本來就取不到（實測佐證）。因此提議 B 路：把東牆 commit `af24130` 改寫成「不含烤圖大檔」，只把工作本體（程式／小指標 JSON／工具／文件）merge 進 main 並 push（main..HEAD 零新增 LFS），烤圖 `.bin` 留本機。未來要讓朋友用行動網路逛房間，走另一條「壓縮 web 貼圖 ＋ 會送檔的 host」的部署管道（本報告 §6 給方向，非本次動作）。

---

## 1. 背景與現況

- 目前分支領先 `main` 7 個 commit、落後 0（可 fast-forward）。`origin/main == main == 4ff19c5`，遠端 main 未分岔。
- 此分支從未 push（無 upstream）。
- 帶烤圖大檔的 commit 只有 `af24130`（東牆批次）；`cbecd8f`（清理）只改兩份文件。

---

## 2. 實證（皆現場跑過）

```
[A] git lfs push --dry-run origin <branch>：待上傳的 LFS 只有 3 個物件，全是東牆——
    ed9d738 east OIDN atlas        146,754,000 bytes（約 147 MB）
    a814c64 east RAW atlas         146,754,000 bytes（約 147 MB）
    154dc1f east texel-metadata    440,262,000 bytes（約 420 MB；RAW/OIDN 同 oid，去重算一份）
    合計 unique ≈ 733,770,000 bytes（約 734 MB）。
    註：dry-run 以 commit graph 推算「main..HEAD 的新 LFS」，它「假設」main 內的大檔已在伺服器，
        並未逐物件向伺服器核對 → 不能用它證明北牆大檔真的在 GitHub。

[B] .gitignore L19：.omc/r7-3-10-xatlas-bake-spike/*  本就忽略整個 bake 目錄。
    北、東兩批烤圖當初都是 git add -f 強制蓋過此規則才收進去的。
    → 專案原始意圖即「烤圖留本機、不入庫」。

[C] runtime 只讀 atlas：loadR7310C1XatlasStackedSegment（js/InitCommon.js:4486-4490）只 fetch
    pointer.artifacts.atlasPatch0（atlas .bin）。那個約 420 MB 的 texel-metadata 是烘焙副產品，
    runtime 完全不載入。

[D] GitHub Pages 不送 LFS／取不到 bakes（實測北牆 .bin）：
    - Pages URL（ghnewbie2022.github.io/.../20260611-115310/atlas-patch-000-rgba-f32.bin）
      → 回 GitHub 404 HTML（載不到）。
    - raw.githubusercontent（main 同檔）
      → 回 LFS 指標文字「version https://git-lfs.github.com/spec/v1 … size 124962816」（約 119 MiB）。
    結論：線上完全取不到烤圖真內容；北牆現況早已如此。

[E] main 樹內 .bin 大小加總約 3.15 GB（含重複 oid）。origin/main 已帶這些「指標」（[D] 證實），
    但「實際 LFS 二進位是否真存在於 GitHub LFS 伺服器」＝未驗證假說
    （若使用者確無付費，最可能是當年超過 1 GiB 後二進位未全部上傳，線上那批本就殘缺）。
```

---

## 3. B 路目標

```
- 工作本體（程式碼、紀錄）安全備份上 GitHub。
- main..HEAD 零新增 LFS 上傳 → 完全避開 1 GiB 配額。
- 烤圖 .bin 留本機（本機驗收照常；線上本來就用不到）。
- 恢復 .gitignore 對 bake 目錄的忽略（回到專案原始意圖）。
```

---

## 4. 具體改動（提議）

```
(1) 改寫 commit af24130：移除兩個東牆烤圖目錄（共 18 檔）：
      .omc/r7-3-10-xatlas-bake-spike/20260615-022106/                （RAW，8 檔）
      .omc/r7-3-10-xatlas-bake-spike/20260615-022106-oidn-rt-high-beta/（OIDN，10 檔）
    其中含 4 個 LFS .bin（2 atlas + 2 texel-metadata）與小 JSON（diagnostics/manifest/validation 等）。
    手法：git rm --cached -r 兩目錄（保留工作區實體檔）→ 重建 commit。
    保留於 af24130'：4 程式（glsl/InitCommon/Home_Studio.js/html）+ 2 docs/data pointer JSON
                    + 3 docs/tools + 1 審查報告 = 10 檔。

(2) cbecd8f（清理）內容不動，接到 af24130' 之上。

(3) git checkout main → git merge --ff-only <branch> → git push origin main。
    改寫後 main..HEAD 應為「零 LFS 物件」（dry-run 驗證為 0）。

環境限制：本環境不支援 git rebase -i（互動式）。
  提議非互動法：temp 分支於 af24130 → git rm --cached 兩目錄 → git commit --amend → cherry-pick cbecd8f
  → 將原分支指到新 tip。或用 git filter-repo --invert-paths（若可用）。請 CODEX 指定偏好。
```

---

## 5. 影響與權衡

```
- 線上 toggle（北/東真非方格 RAW/OIDN）載不到烤圖 → graceful fail，回退 hybrid／不顯示。
  此為本機開發功能；北牆線上現況已是如此（[D]）。3D 房間主體（即時光追）不受影響。
- docs/data 兩個 pointer JSON 保留（小、記錄 bake 設定）；線上指向的 .omc 目錄不存在 → toggle 安全失敗。
- 本機 .bin 不刪，使用者本機驗收照常。
- 北牆既存於 main 的 bake LFS：本次不動（範圍外，見 §7(3)）。
```

---

## 6. 未來部署方向（非本次動作，給 CODEX 同步；使用者問「朋友 5G 逛房間」）

```
觀念：開發檔 ≠ 部署檔
  現行 atlas .bin＝2325×3945×4×4＝約 147 MB 的 RGBA float32 原始烤圖。對行動網路過重，不可直接送。
  部署應把每面牆烤圖壓成 web 貼圖（KTX2/Basis-U、或 RGBE/half-float PNG），目標個位數 MB/面。
  runtime 只需 atlas（texel-metadata 不上線）。

host 選項（要「會把二進位送給瀏覽器」的空間）：
  - GitHub Pages：可服務「正常提交的小檔」（非 LFS、單檔 < 100 MB）。壓縮後小貼圖直接 commit 即可，免換家。
  - Cloudflare Pages / Netlify：免費、自帶 CDN，行動裝置全球更快（註：Cloudflare Pages 單檔上限 25 MiB）。
  - 物件儲存（Cloudflare R2 / S3 / B2）＋ CDN：無單檔上限，適合壓完仍偏大或全室多面。

部署管道與本次 B 路無衝突：B 路只決定「開發大檔不入 LFS」；部署走壓縮小檔 ＋ 另一 host。
建議列為獨立 R 階段（壓縮格式選型 → 量實際 MB／面 → 估行動載入時間 → 使用者拍板 host）。
```

---

## 7. 待 CODEX 裁示

```
(1) 同意 B 路（af24130 去烤圖目錄、main..HEAD 零新 LFS、push 工作本體）？
(2) docs/data 兩個 pointer JSON：保留（建議）or 也移除？
(3) 北牆既存 main 內 bake LFS：本次不動、列未來清理？是否要先以一次 LFS fetch 實測伺服器二進位是否存在
    （會耗約 119 MB 下載頻寬，故預設不跑，等指示）？
(4) history rewrite 手法：temp 分支 amend + cherry-pick vs git filter-repo，CODEX 偏好哪個？
(5) 是否同步立規矩「未來 bake 一律不 git add -f」，避免重蹈大檔入庫？
(6) push 範圍：只 push main，or 也 push 工作分支當備份？
(7) 未來部署：壓縮格式（KTX2/Basis-U vs RGBE-PNG vs half-float）＋ host 選型，是否同意列為獨立階段？
```

---

## 8. 紅線

```
- 尚未執行任何 history rewrite／merge／push。
- 本機烤圖 .bin 不刪。
- 等 CODEX 審查 ＋ 使用者拍板後才動。
```
