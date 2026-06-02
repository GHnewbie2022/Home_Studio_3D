# Row Order Probe 判讀材料（plan §5.2.3 Step 3.5、交 CODEX 判讀）

本檔由 OPUS 動工、CODEX 判讀紅頂/綠底後鎖定 row order，再進 Stage 0 四組對照。

## Probe 方法

```text
工具：docs/tools/r7-3-10-oidn-bridge.mjs --emit-row-probe（probe-only 模式）
input atlas 尺寸：3379 × 2327（D800 北牆、取真實 atlas 尺寸、不讀內容）
染色：row 0 → 紅 (1,0,0)、row (H-1) → 綠 (0,1,0)、其餘 row → 黑
鏈路：writePFM(flipRows=false) → oidnDenoise RT high → readPFM(flipRows=false) → pfm-to-png(gamma 2.2)
```

## Probe 結果（截圖）

```text
stage0/row-probe-input.png      probe 輸入（OIDN 前）
stage0/row-probe-denoised.png   OIDN 降噪後
```

OPUS 觀察（兩張並列）：

```text
row-probe-input.png    ：紅線在頂、綠線在底、中間全黑
row-probe-denoised.png ：紅線在頂、綠線在底、中間全黑（與 input 一致）
```

## OPUS 技術分析

```text
1. input 與 denoised 紅綠位置一致
   → OIDN 不改變 row order（denoise 是局部鄰域運算、不翻轉掃描線）。

2. 按 plan §5.2.3 Step 3.5 Step E 準則：
   紅在頂、綠在底 → atlas 是 top-to-bottom、OIDN row order 對齊、不需翻轉。
   → flipRows = false 正確。

3. 更關鍵的一致性論證（補充 plan probe 設計）：
   oidn-bridge 讀 atlas binary（readAtlasRGBA32F、row 0 = binary 第一行）
   與寫回 binary（post-mask、row 0 = binary 第一行）用同一 row 慣例，
   中間 writePFM / readPFM 也用同一 flipRows。
   → 整條讀寫鏈 row order 一致、denoised binary 與 input binary row order 對齊、
     可直接替換、runtime 取樣不受影響。
   → row order 對降噪品質不敏感（OIDN 局部運算）、關鍵在「讀寫一致」（已保證）。

4. 注意（probe 設計侷限、誠實標註）：
   本 probe 用合成染色 atlas、不經 runner GPU readback、
   故測的是「oidn-bridge PFM 讀寫 + OIDN」鏈、不是「runner readback 的 binary 方向」。
   但由第 3 點：oidn-bridge 讀寫一致即可保證 denoised 與 input 對齊、
   runner readback 方向不影響本工具的正確性（input/output 同方向進出）。
```

## 待 CODEX 裁示

```text
Q1. row-probe-denoised.png 紅頂綠底是否如 OPUS 觀察？
Q2. row order 鎖定 flipRows = false（不翻轉）是否核准？
Q3. 核准後 OPUS git commit 保存 8 工具 + ADR 接線、再跑 Stage 0 a/b/c/d 四組。
```

## 對齊版本

```text
plan.md：v4 CODEX 四審核准（8 工具完成）
input atlas：.omc/r7-3-10-full-room-diffuse-bake/20260602-015822/atlas-patch-000-rgba-f32.bin
            （c1_north_wall、3379×2327、1000 SPP、diffuseOnly、今日 06-02 throwaway）
Git branch：codex/r7-3-10-north-wall-denoise-oidn
```
