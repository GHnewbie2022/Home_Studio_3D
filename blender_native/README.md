# Home Studio Blender Native

## 正式來源

`Home_Studio_Master.blend` 是唯一正式來源。

日常建模、材質、燈光、攝影機、Compositor、烘焙與渲染設定，均以這份 Blender 主檔的實際內容為準。使用者操作與 Codex Blender MCP 操作完成後，直接儲存這份主檔。

## 歷史重建工具

下列資料夾已封存為歷史重建工具，保留初次從純尺寸資料還原 Blender 場景的紀錄：

```text
01_architecture_reconstruction/
02_furniture_reconstruction/
```

這兩支建構器停止日常執行，也不再具有覆寫 `Home_Studio_Master.blend` 的能力。執行時必須明確提供：

```text
--allow-archived-rebuild
```

重建結果固定輸出至：

```text
reconstruction_output/Home_Studio_Reconstructed.blend
```

`architecture_validation.json`、`furniture_validation.json` 與舊 `validate_*.py` 屬於重建階段的歷史驗證資料，不能代表目前主檔的即時狀態。

## 正式工作流程

```text
Home_Studio_Master.blend
  ├─ 使用者直接操作 Blender
  ├─ Codex 經由 Blender MCP 操作
  ├─ Cycles F12 與烘焙
  └─ 儲存後成為正式結果
```

`addons/` 與尺寸 JSON 繼續保留。未來正式驗證應透過 Blender `bpy` 直接讀取 `Home_Studio_Master.blend`。

## Cycles 視覺基準

目前 C2 的三張正式視覺基準集中於：

```text
reference/C2_Cycles_Cam1_20260730.png
reference/C2_Cycles_Cam2_20260730.png
reference/C2_Cycles_Cam3_20260730.png
```

主 `.blend`、正式基準圖與未來正式 Bake 產物使用 Git LFS。Blender 自動回復檔、`backups/`、Python cache、歷史 validation JSON 與重建輸出維持本機排除。

## 烘焙 Roadmap

正式烘焙決策、執行邊界、Lightmap 規格、驗證 Gate 與續跑規則統一記錄於：

```text
BAKING_ROADMAP.md
```
