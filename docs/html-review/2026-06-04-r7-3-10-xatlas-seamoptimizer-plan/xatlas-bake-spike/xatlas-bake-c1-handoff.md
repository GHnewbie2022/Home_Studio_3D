# R7-3.10 xatlas bake spike C1 交審包

收件：OPUS  
寄件：CODEX  
日期：2026-06-04  
階段：第 7 章 C1，atlas texel → world 映射

## 1. 本輪範圍

```
1.1 只做第 7 章 C1。
1.2 本輪沒有動 shader。
1.3 本輪沒有跑 bake。
1.4 本輪沒有改 runtime package。
1.5 本輪沒有 promotion。
```

## 2. 實作內容

```
2.1 新增工具：
    docs/tools/r7-3-10-xatlas-bake-texelmap.py

2.2 新增測試：
    docs/tests/r7-3-10-xatlas-bake-texelmap.test.py

2.3 工具輸入：
    §6 的 xatlas spike 產物。

2.4 工具輸出：
    xatlas-bake-texelmap.json
    xatlas-bake-starting-point-lock.json
    xatlas-bake-texelmap.bin
    xatlas-bake-worldpos-rgba32f.bin
    xatlas-bake-normal-rgba32f.bin
    xatlas-bake-tri-valid-rgba32f.bin
    xatlas-bake-dilation-source.bin

2.5 大型 binary 已由本資料夾 .gitignore 排除。
```

## 3. 起點鎖定

```
3.1 input mesh sha16：
    6ec89e9ce8a729c6

3.2 output uv sha16：
    0692b510b95a63fa

3.3 coverage report sha16：
    bd9dc533c2e3ad93

3.4 chart debug sha16：
    a0fdf3b3004a8147

3.5 lock 檔：
    xatlas-bake-starting-point-lock.json

3.6 lock 行為：
    第一次執行會建立 lock。
    後續若起點檔內容改變，工具會中止。
```

## 4. C1 實測結果

```
4.1 atlas 尺寸：
    946 × 516

4.2 total texels：
    488,136

4.3 valid texels：
    356,029

4.4 empty texels：
    132,107

4.5 post-bake dilation texels：
    47,752

4.6 overlapTexelsSkipped：
    8

4.7 A1 北牆側 valid texels：
    45,978

4.8 A1 西樑帽側 valid texels：
    2,464

4.9 A1 z 範圍：
    -1.873999953269959 到 -1.873999953269958

4.10 A1 z 最大誤差：
    0.000000046730042058129584 m

4.11 A1 z 容差：
    0.001 m

4.12 C1 判定：
    PASS
```

## 5. 驗證紀錄

```
5.1 RED：
    python3 docs/tests/r7-3-10-xatlas-bake-texelmap.test.py

    結果：
    2 tests failed，原因是工具尚未存在。

5.2 GREEN：
    python3 docs/tests/r7-3-10-xatlas-bake-texelmap.test.py

    結果：
    2 tests passed。

5.3 syntax：
    python3 -m py_compile docs/tools/r7-3-10-xatlas-bake-texelmap.py docs/tests/r7-3-10-xatlas-bake-texelmap.test.py

    結果：
    通過。

5.4 真實 C1 輸出：
    python3 docs/tools/r7-3-10-xatlas-bake-texelmap.py ... --out-dir docs/html-review/2026-06-04-r7-3-10-xatlas-seamoptimizer-plan/xatlas-bake-spike

    結果：
    PASS C1 texelmap: 946x516 valid=356029 dilation=47752
```

## 6. 請 OPUS 審查

```
6.1 C1 工具是否符合 §7.3。

6.2 xatlas-bake-texelmap.json 的 schema 是否足夠 C2 使用。

6.3 binary layout 是否可作為 C2 data texture 輸入。

6.4 A1 北牆側與西樑帽側 valid texel 數是否足以核准進 C2。

6.5 overlapTexelsSkipped=8 是否可接受。
    CODEX 初判：這 8 格屬 triangle 邊界重疊或浮點邊界情況，未影響 A1 valid 判定。
    若 OPUS 要求零 overlap，請回 ITERATE。

6.6 若核准，CODEX 下一步進 C2：
    新增最小 xatlas bake mode。
```
