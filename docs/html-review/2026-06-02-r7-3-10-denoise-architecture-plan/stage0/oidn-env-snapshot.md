# OIDN 環境快照（§13.3 P0 第 1 / 2 項驗收存底）

CODEX 九審 APPROVE 後、§5.1.1 安裝步驟執行完成。本檔釘住環境狀態、後續 `spike-oidn-version.txt` / `metrics.json` 必填欄位以本檔為準。

## 安裝結果

```text
brew uninstall open-image-denoise
  → 移除 Homebrew bottled 版（28 files, 56.3 MB）
  → 連帶 autoremove hwloc + tbb（屬 brew 自動清理）

sudo mkdir -p /opt/oidn-official
  → 使用者執行（OPUS 受 settings.json deny "Bash(sudo *)" 限制、由使用者代跑）
  → 目錄建立成功

curl -L https://github.com/RenderKit/oidn/releases/download/v2.4.1/oidn-2.4.1.arm64.macos.tar.gz \
  | sudo tar -xz --strip-components=1 -C /opt/oidn-official
  → 下載 49 MB tar.gz、解壓到 /opt/oidn-official/
  → oidnDenoise 落點：/opt/oidn-official/bin/oidnDenoise
  → 檔案類型：Mach-O 64-bit executable arm64
```

## §5.1.1 Step A 驗證（--list_devices）

```text
$ /opt/oidn-official/bin/oidnDenoise --list_devices

Device 0
  Name: Apple M4 Pro
  Type: Metal              ← plan §5.1 鎖定的首選 GPU backend
  LUID: 6205000001000000
  Node: 1

Device 1
  Name: Apple M4 Pro
  Type: CPU                ← 備援、本案不採用（§5.1.1 / §17 R10 已禁用）
```

結論：Metal device 存在、本案執行條件 satisfied。

## §5.1.1 Step B 驗證（版本探測）

```text
$ /opt/oidn-official/bin/oidnDenoise --hdr /tmp/oidn-probe.pfm --output /tmp/_o.pfm 2>&1 \
    | grep -m1 -oE 'version=[0-9]+\.[0-9]+\.[0-9]+'

version=2.4.1
```

結論：≥ 2.3.0 plan §5.1 鎖定門檻通過。

## 完整 banner stdout（plan §5.1.1 預期格式對照）

```text
Initializing device
  device=Metal, version=2.4.1, msec=10.4219     ← 對齊 plan §5.1.1 Step B 預期格式
Loading input
Resolution: 1x1
Initializing filter
  filter=RT, msec=8.13629
Denoising 0% ... 100%
  msec=97.033
Saving output
```

## §5.1.2 路徑解析必填欄位（spike-oidn-version.txt + metrics.json 共用）

```json
{
  "oidn_resolved_path": "/opt/oidn-official/bin/oidnDenoise",
  "oidn_resolution_source": "default",
  "oidn_version": "2.4.1",
  "oidn_device_list": [
    {"id": 0, "name": "Apple M4 Pro", "type": "Metal", "luid": "6205000001000000", "node": 1},
    {"id": 1, "name": "Apple M4 Pro", "type": "CPU"}
  ],
  "oidn_device_used": "Metal",
  "oidn_install_source": "official_github_release",
  "oidn_install_url": "https://github.com/RenderKit/oidn/releases/download/v2.4.1/oidn-2.4.1.arm64.macos.tar.gz",
  "oidn_install_method": "curl_pipe_sudo_tar_strip_components_1",
  "oidn_executable_type": "Mach-O 64-bit executable arm64",
  "oidn_install_size_mb": 49,
  "host_machine": "M4 Pro 48 GB unified memory",
  "host_os": "macOS Darwin 24.6.0",
  "init_msec_metal_device": 10.4219,
  "init_msec_rt_filter": 8.13629,
  "denoise_msec_1x1_probe": 97.033
}
```

## §5.1.2 驗證 A / B / C 對照

```text
A. 路徑存在性：
   fs.existsSync('/opt/oidn-official/bin/oidnDenoise') === true     ✅

B. 來源驗證（前綴白名單）：
   resolvedPath.startsWith('/opt/oidn-official/') === true          ✅

C. Metal device 驗證：
   --list_devices 含 Type: Metal                                    ✅
```

## 環境驗收簽核

```text
OPUS：§13.3 P0 第 1 / 2 項執行完成（讀 plan + 環境前置）
CODEX：九審 APPROVE（含三道驗證、oidn_resolution_source = default 合理、
        Device 1 CPU 共存不影響 Metal 鎖定）
使用者：sudo 代執行 Step 1 / 2b、密碼確認

下一步：§13.3 P0 第 3 項動工 4 個 ADR
  ADR-Bake-Runner-Extensions
  ADR-Normal-Aux-Shader
  ADR-InitCommon-URL-Keys
  ADR-OIDN-Filter-Selection（純規格、無檔可動）
```

## 對齊 plan.md 版本

```text
plan.md：v4 九審 APPROVE（2988 行）
Git branch：codex/r7-3-10-north-wall-denoise-oidn
本檔為 stage0 第一份產出物、後續 spike-aux-decision.md / spike-metrics.json 共用本檔欄位
```
