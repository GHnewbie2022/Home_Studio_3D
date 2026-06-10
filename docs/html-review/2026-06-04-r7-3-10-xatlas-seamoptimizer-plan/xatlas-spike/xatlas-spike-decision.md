# xatlas spike decision

## 1. 結論

```text
1.1 SPIKE RESULT：PASS
1.2 本輪只驗證 coverage 與 UV。
1.3 本輪尚未證明正式烘焙與 runtime 無縫。
```

## 2. 實測事實

```text
2.1 xatlas API：Atlas.add_mesh + Atlas.generate + Atlas.get_mesh
2.2 xatlas version：0.0.11
2.3 includedBoxIndices：[15, 28]
2.4 vertices：48
2.5 triangles：24
2.6 atlas：946 × 516, chartCount=12, atlasCount=1
2.7 A1 cap triangles：[20, 21]
2.8 A1 wall triangles：[10, 11]
2.9 幾何校正：西樑 A1 帽面是 box 28 的 -Z 面；北牆是 box 15 的 +Z 面。
```

## 3. A1 coverage 驗收

```text
3.1 allHaveChart：True
3.2 uvValid：True
3.3 noCoverageHole：True
3.4 bboxOverlapCandidates：[[10, 11], [20, 21]]
```

## 4. 下一步

```text
4.1 可進下一個 bake spike：把 path-traced GI 烤進 xatlas atlas。
4.2 下一步仍需使用者 A1 相機驗收。
```
