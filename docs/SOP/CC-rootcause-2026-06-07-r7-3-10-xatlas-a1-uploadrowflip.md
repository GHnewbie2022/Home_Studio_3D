# 根因報告（CC 接手）：R7-3.10 xatlas A1 C2C 北牆「兩條垂直長條」破圖

- 日期：2026-06-07
- 作者：Claude Code（接手 CODEX 062247 重烤後的破圖）
- 方法：systematic-debugging Phase 1-3（先根因、不先修），讀碼 + bin 證據 + CPU 重現
- 包：`.omc/r7-3-10-xatlas-bake-spike/20260607-062247`（runtime pointer 已指向此包）
- 工具：`docs/tools/r7-3-10-xatlas-a1-uv-alignment-probe.py`
- 輸出：`docs/data/r7-3-10-xatlas-a1-uv-alignment-probe.json`

---

## 結論（一句話）

本次「兩條垂直長條有光、其餘大片退 D800」的直接根因**不是** alpha/RGB 解耦（那是 023242 黑洞時代的問題，CODEX 的 exact-zero 修法已消除），而是 **runtime atlas 上傳時多做了一次 row flip**：`loadR7310C1XatlasRuntimePackage` 把 `pointer.uploadRowFlip:true` 誤讀成「atlas-patch 要翻轉」並真的翻了，破壞了 atlas-patch 與硬寫 UV 之間本已正確的 row 對齊。修它零重烤。

---

## 矛盾起點

```
atlas 端（062247 alpha report）：tri10 alphaOne 77.03% luma0.282、tri11 80.44% luma0.240，健康。
runtime 端（使用者實機）：只有兩條垂直長條有光，其餘大片退 D800。
→ atlas 大部分有光 ↔ runtime 大部分無光 = 直接矛盾。矛盾必在 atlas→runtime 之間。
```

## 證據鏈

```
1. bin 內部 world↔UV 對齊：硬寫 UV 公式(shader 1228-1233)套到 062247 metadata 的 world，
   對 tri10/11 alpha=1 texel，H1(無翻轉) 殘差中位數 0.707px、p90 0.707px。
   → atlas-patch 的 (row,col) 已與硬寫 UV 精確對齊。UV 常數沒錯、bake 沒錯。

2. row flip 全鏈（只 flip 一次、無人抵銷）：
   bake prepare(InitCommon 5595-5597) 對 worldpos/normal/tri flip 一次 → 用 flip 後資料建 metadata(5625)
     → atlas-patch(runner readback) 與 metadata 同屬「flip 後 row order」，硬寫 UV 對齊它（見證據1）
   prepare 記錄 uploadRowFlip:true(5613) ＝「prepare 做過 flip」的事實
   runner 把它寫進 runtime pointer（InitCommon 7301）
   runtime load(InitCommon 3846-3848) 誤把它當「atlas-patch 上傳要 flip」→ flipR7310C1XatlasRgba32fRows 再翻一次
   shader sampleTexel(glsl 1174) 用 texelFetch 直讀，無補償 flip
   → runtime 在 world(wx,wy) 取到 bin row (H-1-v*H)，而正確內容在 bin row (v*H) = H2 錯位

3. CPU 重現（docs/tools/...uv-alignment-probe.py）：
   flip=true（實際 runtime，現況）：alpha_one_hit 18.27%、落 tri10/11 僅 16.25%、
     vertical_lit_band_count = 2（[[13,17],[67,79]]），col_hit 西→東大片 0.0、零星兩處 0.8
     → 精確重現使用者「兩條垂直長條」
   flip=false（修法後）：alpha_one_hit 78.95%、全 80 欄有光、單一連續段、col_hit 0.74~0.84 均勻
     → 整面均勻有光

4. 歷史一致：flip 錯位一直存在（023242、062247 的 uploadRowFlip 都 true）。
   023242 那批 alpha=1 黑洞，經 flip 錯位採樣在 world 區顯示為「紅」(OPUS probe56 看到的)；
   062247 把黑洞改 alpha=0 後，同 world 區改顯示為「藍」(退D800) + 殘兩條綠
   → 正是任務描述「probe56 無紅、變大片藍+兩條綠」。CODEX exact-zero 修法對，
     但沒碰更底層的 flip，破圖換形式續存。contract 只驗 bin 內容（都對），驗不到 runtime flip 對齊。
```

## 方位吻合

flip 後僅 world-x∈[-1.577,-1.52]（最東 0.057m）落回 atlas alpha=1 區，西側 0.33m 全落 alpha=0。
木門在西側 → 木門西側北牆退 D800/變髒，與使用者觀察一致。tri10 alpha=1 的 world-x 起點 -1.86（非 -1.91）也對應木門西側那一小段缺光。

---

## 修法選項（皆零重烤）

```
乙（推薦）：runtime load 端不 flip atlas-patch。
   改 loadR7310C1XatlasRuntimePackage(InitCommon 3846-3848)：uploadPixels = atlasPixels（直接上傳）。
   理由：atlas-patch 是 runner readback 產物，row order 已與 metadata/硬寫UV 對齊(H1實證)；
         pointer.uploadRowFlip 描述的是 bake prepare 對「輸入貼圖」做過 flip，與 runtime 上傳無關。
   範圍：只影響 xatlas A1 北牆 runtime（此 load 路徑專用），不動 bake、不動其他 23 面。
   風險：低；CPU 端 r7310C1XatlasRuntimeCpuTexel 讀同一 uploadPixels，自動跟著對齊。

甲（止血）：只改 062247 pointer/manifest 的 uploadRowFlip:false。
   最小，但 runner 重烤會再從 prepared.uploadRowFlip=true 寫回 true → 治標。

丙（最治根）：runner 寫 runtime pointer 時，runtime 上傳 flip 與 bake prepare flip 脫鉤，
   runtime 明確設 false。動 runner，未來重烤永不復發。乙+丙可並行。
```

不需回退 CODEX 的 exact-zero / dilation / C2C alphaOneExactBlackTexels==0 contract：那防的是 alpha=1 黑洞復發，與本根因正交，留著。

## 驗證計畫（修後）

```
1. 實機開圖（北牆 cameraState position(-1.199,1.725,1.168) forward 朝北 fov55）：probe mode 56 應整面綠、無兩條 band、西側不退藍。
2. 正常算圖：北牆木門西側不再髒。
3. CPU 重現工具 flip=false 已預測整面 78.95% 有光，作為對照。
```
