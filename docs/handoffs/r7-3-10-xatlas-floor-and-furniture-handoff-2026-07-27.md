# Home Studio 3D R7-3.10 XATLAS 交接紀錄

日期：2026-07-27

驗收入口：<http://localhost:9002/Home_Studio.html?atlasMaster=raw&cb=r7310-floor-runtime-ready-fix-v1>

## 白話現況

目前房間使用的正式 XATLAS 烘焙頁已改成多頁載入，正式頁會在開場時預先轉成 HalfFloat。牆面、天花板、H2、地板、樑柱、中央木桌、東北草綠色床、南方固定家具、南窗洞切面、西牆實體開關與西側門檻，都已有正式 FULL BAKE pointer。

這一輪最後修正的是地板開關接線。地板檔案一直存在，也已成功載入；程式卻仍拿一個已退役的舊房間旗標判斷地板能不能顯示，因此正式地板頁被錯誤關閉。現在判斷改成直接確認地板 XATLAS 頁已載入、正式地板模式已啟用、地板貼圖存在。使用者已肉眼確認地板恢復正常。

## 正式烘焙共識

| 項目 | 正式規格 |
| --- | --- |
| 幾何與 UV | XATLAS 非方格，依正式幾何面建立 chart |
| 烘焙內容 | `full_diffuse_radiance` |
| 直接光 | `directLightAlreadyIncluded = true` |
| runtime 額外直接光 | `addDirectLightAfterBakeLookup = false` |
| 正式 package 狀態 | `accepted` |
| runtime 資料 | 預轉 HalfFloat，多頁獨立載入 |
| owner | 動態建立，容量由 preflight 檢查，禁止回到寫死 72 個 |
| 地板 | diffuse 使用 FULL BAKE，roughness 預設 0.1，鏡面反射維持 LIVE |
| GPU 驗證 | Chrome + Metal，每次只跑一個 GPU 工作 |
| 黑邊處理 | 以幾何 owner、chart padding、mask、跨頁接縫檢查與 A NARROW 自動掃描處理 |

## 目前正式頁

| 表面 | package 路徑 | 狀態 |
| --- | --- | --- |
| 北牆 | `assets/runtime/r7-3-10/current-room/north/package` | accepted FULL BAKE |
| 東牆 | `assets/runtime/r7-3-10/current-room/east/package` | accepted FULL BAKE |
| 南牆 | `assets/runtime/r7-3-10/current-room/south/package` | accepted FULL BAKE |
| 西牆 | `assets/runtime/r7-3-10/current-room/west/package` | accepted FULL BAKE |
| 天花板 | `assets/runtime/r7-3-10/current-room/ceiling/package` | accepted FULL BAKE |
| H2 | `assets/runtime/r7-3-10/current-room/depth-h2/package-texel-aware-coplanar-v2` | accepted FULL BAKE |
| 地板 | `assets/runtime/r7-3-10/current-room/floor/package` | accepted FULL BAKE + LIVE reflection |
| 樑柱 | `assets/runtime/r7-3-10/current-room/structural/package` | accepted FULL BAKE |
| 中央木桌 | `assets/runtime/r7-3-10/current-room/central-desk/package` | accepted FULL BAKE |
| 東北床 | `assets/runtime/r7-3-10/current-room/northeast-bed/package` | accepted FULL BAKE |
| 南方固定家具 | `assets/runtime/r7-3-10/current-room/south-fixed-furniture/package` | accepted FULL BAKE |
| 南窗洞切面 | `assets/runtime/r7-3-10/current-room/south-window-reveals/package-texel-aware-v1` | accepted FULL BAKE |
| 西牆開關 | `assets/runtime/r7-3-10/current-room/west-wall-switch/package` | accepted FULL BAKE |
| 西側門檻 | `assets/runtime/r7-3-10/current-room/west-threshold-top/package`、`west-threshold-front/package` | accepted FULL BAKE |

## 本輪地板根因與修正

根因位於 `js/InitCommon.js` 的 `updateR7310C1FullRoomDiffuseRuntimeUniforms()`。正式地板頁已載入時，`r7310C1XatlasRuntimeFullFloorActive` 與地板 page texture 都正確；`floorApplied` 卻只接受舊的 `r7310C1FullRoomDiffuseRuntimeReady`。舊大房間 atlas 已退役，該旗標維持 false，正式地板因此落回 LIVE diffuse。

修正後新增 `floorXatlasPageReady`，正式地板會依現代多頁 XATLAS 狀態啟用。舊旗標只保留相容用途。測試已鎖住規則，避免日後又把地板綁回舊 atlas。

## 已完成驗證

Focused Node 測試共 35 項通過。`node --check js/InitCommon.js` 與 `node --check js/Home_Studio.js` 通過。

Chrome + Metal smoke 報告：`/private/tmp/r7310-floor-runtime-ready-fix-v3/xatlas-shader-compile-smoke.json`

Chrome + Metal 截圖：`/private/tmp/r7310-floor-runtime-ready-fix-v3/xatlas-shader-compile-smoke.png`

最後 smoke 重要結果為 `status=pass`、`pageLoaded=true`、`programInvalidCount=0`、`shaderErrorCount=0`、`contextLostCount=0`、`floorPageTextureReady=true`、`fullFloorActive=true`、`uniformFullFloor=1`、`uniformFullFloorMode=1`、`uniformFullFloorDirectIncluded=1`。

## 尚未完成

家具烘焙仍未全室完成。西南方四層抽屜的上下表面、頂層木桌下方與縫隙側面曾完成範圍盤點，後續因載入架構與地板回歸問題先暫停。動態 owner 與 runtime 容量 preflight 已加入，下一輪可沿用，不要再寫死 owner 數量。

重整後仍會完整重新讀取與上傳正式頁，因此第二次載入速度尚未最佳化。進度條已能依實際位元組與階段持續前進；快取與重用屬家具主線完成後的效能工作。

## 下一輪施工順序

第一步從最新 `main` 建立新的 `codex/` 家具烘焙分支，先跑既有 contract 與 runtime capacity preflight。第二步重新盤點西南抽屜與桌體所有可見面，確認動態 owner 數量、chart 面積、頁數、單頁尺寸及估算 GPU 記憶體均在門檻內。第三步只處理這一組家具的 XATLAS FULL BAKE，不動目前已驗收的牆面、樑柱、床、中央木桌與地板。第四步跑 Chrome + Metal 單一 GPU smoke，使用使用者指定視角驗收 1 SPP 與 100 SPP。第五步等家具主線完成後，再處理重整快取與 GPU 上傳重用。

## 下一輪硬性防呆

任何正式 pointer 都必須指向 `accepted` package，並同時符合 FULL BAKE 三欄。正式資料禁止指向 `.omc`、`architecture_probe`、D800、方格 preview 或診斷 package。新增家具頁前必跑容量 preflight。任何修改都要跑現有頁面回歸測試，避免修家具時讓東西南北牆、天花板、H2、地板或樑柱失效。
