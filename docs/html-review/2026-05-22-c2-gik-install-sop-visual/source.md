<style>
.gik-fig{background:#f6efdd;border:1px solid #5a4a32;border-radius:8px;padding:14px 14px 6px;margin:18px 0;}
.gik-fig svg{display:block;width:100%;height:auto;}
.gik-cap{color:#7a6c52;font-size:13px;margin:8px 2px 6px;text-align:center;}
.gik-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;margin:10px 0 4px;color:#5a4a32;}
.gik-legend span{display:inline-flex;align-items:center;gap:6px;}
.gik-sw{width:18px;height:12px;border-radius:2px;display:inline-block;border:1px solid #00000033;}
.gik-step{display:flex;gap:14px;align-items:flex-start;margin:16px 0;flex-wrap:wrap;}
.gik-step .gik-mini{flex:0 0 168px;background:#f6efdd;border:1px solid #5a4a32;border-radius:6px;padding:6px;}
.gik-step .gik-mini svg{display:block;width:100%;height:auto;}
.gik-step .gik-stxt{flex:1;min-width:240px;}
</style>

<div class="callout">
<strong>看圖前先記住座標與單位</strong><br>
原點 (0,0,0) = 聆聽點正下方的地板。X 軸：東(+)／西(−)；Z 軸：南(+)／北(−)；Y 軸：高度由地板往上。模型用公尺，以下全部已換算成<strong>公分</strong>。<br>
室內淨尺寸：寬（東西）382 cm × 長（南北）493 cm × 高 290.5 cm。<br>
所有板都是 60 × 120 cm，<strong>背面貼平牆、往室內凸出</strong>。施工只需在牆上框出每片的矩形，再把板貼平框內即可。
</div>

<div class="gik-legend">
<span><i class="gik-sw" style="background:#e08a3c"></i>第一反射點板（W2／E2，最關鍵）</span>
<span><i class="gik-sw" style="background:#4a78b5"></i>側牆其餘板（W1/W3/E1/E3）</span>
<span><i class="gik-sw" style="background:#5a9e6a"></i>北牆板（N1/N2/N3）</span>
<span><i class="gik-sw" style="background:#d9cdb5"></i>要避開的門／插座</span>
<span><i class="gik-sw" style="background:#cfd8c4"></i>床（C2 預設，低家具）</span>
</div>

<h2>一、俯視平面圖（先建立方位感）</h2>
<p>從天花板往下看。北牆在上、南牆在下、西牆在左、東牆在右。注意：左右兩側板完全鏡像對稱；E3／W3 的凸出比較薄（5.08 cm 薄板），其餘 11.8 cm。</p>

<div class="gik-fig">
<svg viewBox="0 0 442 600" role="img" aria-label="C2 吸音板俯視平面圖">
  <!-- room -->
  <rect x="30" y="30" width="382" height="493" fill="#fffaf0" stroke="#5a4a32" stroke-width="2"/>
  <!-- bed (C2 default NE furniture), low ~28cm; drawn under panels so panels stay visible -->
  <rect x="218.3" y="30" width="193.7" height="156" fill="#cfd8c4" fill-opacity="0.6" stroke="#9aa888" stroke-width="0.8"/>
  <text x="318" y="115" text-anchor="middle" font-size="12" fill="#6f7d5e" font-family="sans-serif">床（低家具）</text>
  <!-- compass / wall labels -->
  <text x="221" y="20" text-anchor="middle" font-size="15" fill="#3a3024" font-family="sans-serif">北牆 N（z=−187.4）</text>
  <text x="221" y="545" text-anchor="middle" font-size="14" fill="#7a6c52" font-family="sans-serif">南牆 S（z=305.6）</text>
  <text x="18" y="280" text-anchor="middle" font-size="14" fill="#3a3024" font-family="sans-serif" transform="rotate(-90 18 280)">西牆 W（x=−191）</text>
  <text x="426" y="280" text-anchor="middle" font-size="14" fill="#3a3024" font-family="sans-serif" transform="rotate(90 426 280)">東牆 E（x=191）</text>

  <!-- North panels (top edge), from west 131..251 -->
  <rect x="161" y="30" width="120" height="11.8" fill="#5a9e6a" stroke="#356b41" stroke-width="1"/>
  <text x="221" y="55" text-anchor="middle" font-size="12" fill="#356b41" font-family="sans-serif">N1/N2/N3（疊三層）</text>
  <!-- north door from west 39..118 -->
  <rect x="69" y="30" width="79" height="8" fill="#d9cdb5" stroke="#9a8a6a" stroke-width="0.8"/>
  <text x="108" y="50" text-anchor="middle" font-size="10.5" fill="#8a7a5a" font-family="sans-serif">木門</text>

  <!-- West panels (left edge), from north -->
  <!-- W1 118.5..178.5 -->
  <rect x="30" y="148.5" width="11.8" height="60" fill="#4a78b5" stroke="#28507e" stroke-width="1"/>
  <text x="48" y="182" font-size="12" fill="#28507e" font-family="sans-serif">W1</text>
  <!-- W2 207.2..267.2 first reflection -->
  <rect x="30" y="237.2" width="11.8" height="60" fill="#e08a3c" stroke="#a85f1c" stroke-width="1"/>
  <text x="48" y="271" font-size="12" fill="#a85f1c" font-family="sans-serif">W2 ★</text>
  <!-- W3 295.9..355.9 thin 5.08 -->
  <rect x="30" y="325.9" width="5.08" height="60" fill="#4a78b5" stroke="#28507e" stroke-width="1"/>
  <text x="42" y="360" font-size="12" fill="#28507e" font-family="sans-serif">W3（薄）</text>

  <!-- East panels (right edge) -->
  <rect x="400.2" y="148.5" width="11.8" height="60" fill="#4a78b5" stroke="#28507e" stroke-width="1"/>
  <text x="396" y="182" font-size="12" fill="#28507e" font-family="sans-serif" text-anchor="end">E1</text>
  <rect x="400.2" y="237.2" width="11.8" height="60" fill="#e08a3c" stroke="#a85f1c" stroke-width="1"/>
  <text x="396" y="271" font-size="12" fill="#a85f1c" font-family="sans-serif" text-anchor="end">★ E2</text>
  <rect x="406.92" y="325.9" width="5.08" height="60" fill="#4a78b5" stroke="#28507e" stroke-width="1"/>
  <text x="398" y="360" font-size="12" fill="#28507e" font-family="sans-serif" text-anchor="end">（薄）E3</text>

  <!-- C2 預設東北角為床（已於上方繪製，低家具，置於板下層）；無高櫃 -->

  <!-- listening point + mic stand -->
  <circle cx="221" cy="217.4" r="7" fill="none" stroke="#a8324a" stroke-width="2"/>
  <circle cx="221" cy="217.4" r="2.2" fill="#a8324a"/>
  <text x="221" y="300" text-anchor="middle" font-size="12" fill="#a8324a" font-family="sans-serif">聆聽中心點 (0,0)</text>
  <text x="221" y="314" text-anchor="middle" font-size="11" fill="#a8324a" font-family="sans-serif">＝麥克風架基準樁</text>
  <text x="221" y="328" text-anchor="middle" font-size="11" fill="#a8324a" font-family="sans-serif">距北牆 187.4 cm</text>

  <!-- symmetry lines center to W2/E2 centers -->
  <line x1="221" y1="217.4" x2="35.9" y2="267.2" stroke="#a8324a" stroke-width="1" stroke-dasharray="4 3"/>
  <line x1="221" y1="217.4" x2="406.1" y2="267.2" stroke="#a8324a" stroke-width="1" stroke-dasharray="4 3"/>
  <text x="120" y="255" font-size="10.5" fill="#a8324a" font-family="sans-serif" text-anchor="middle">197.4</text>
  <text x="322" y="255" font-size="10.5" fill="#a8324a" font-family="sans-serif" text-anchor="middle">197.4</text>

  <!-- dimensions -->
  <text x="221" y="565" text-anchor="middle" font-size="11" fill="#7a6c52" font-family="sans-serif">寬 382 cm</text>
  <!-- 距北牆 187.4 已併入紅色聆聽中心點標註，不再單列 -->
</svg>
<div class="gik-cap">圖一　俯視平面：左右側板鏡像、北牆板置中、E3/W3 為薄板（凸出較淺）。紅圈為聆聽中心點，也是麥克風架對稱基準。</div>
</div>

<h2>二、西牆立面（面對西牆：北在右手邊）</h2>
<p>本圖已照你<strong>站在房間面對西牆時的實際左右</strong>：北在右、南在左。所有高度從地板量起，水平距離仍從北牆角（右側）往南量。</p>

<div class="gik-fig">
<svg viewBox="0 0 553 366" role="img" aria-label="西牆立面圖（面對西牆：北在右）">
  <!-- wall -->
  <rect x="40" y="20" width="493" height="290.5" fill="#fffaf0" stroke="#5a4a32" stroke-width="2"/>
  <!-- floor & ceiling -->
  <line x1="40" y1="310.5" x2="533" y2="310.5" stroke="#5a4a32" stroke-width="3"/>
  <text x="36" y="314" text-anchor="end" font-size="11" fill="#7a6c52" font-family="sans-serif">地板 0</text>
  <text x="36" y="24" text-anchor="end" font-size="11" fill="#7a6c52" font-family="sans-serif">頂 290.5</text>
  <text x="46" y="34" font-size="11" fill="#7a6c52" font-family="sans-serif">← 南　　　　　　北 →（面對西牆的實際左右）</text>

  <!-- iron door at north end (now on the right) -->
  <rect x="444" y="106.5" width="89" height="195" fill="#d9cdb5" stroke="#9a8a6a" stroke-width="1"/>
  <text x="488.5" y="210" text-anchor="middle" font-size="12" fill="#8a7a5a" font-family="sans-serif">鐵門</text>

  <!-- W3 thin (south, now on the left) -->
  <rect x="177.1" y="111" width="60" height="120" fill="#4a78b5" fill-opacity="0.85" stroke="#28507e" stroke-width="1.5"/>
  <text x="207.1" y="167" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">W3</text>
  <text x="207.1" y="184" text-anchor="middle" font-size="10.5" fill="#eaf2fb" font-family="sans-serif">薄板5.08</text>
  <!-- W2 first reflection (mid) -->
  <rect x="265.8" y="125" width="60" height="120" fill="#e08a3c" fill-opacity="0.9" stroke="#a85f1c" stroke-width="1.5"/>
  <text x="295.8" y="181" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">W2 ★</text>
  <text x="295.8" y="200" text-anchor="middle" font-size="10" fill="#fff" font-family="sans-serif">底65.5</text>
  <text x="295.8" y="213" text-anchor="middle" font-size="10" fill="#fff" font-family="sans-serif">頂185.5</text>
  <text x="295.8" y="118" text-anchor="middle" font-size="11" fill="#a85f1c" font-family="sans-serif">第一反射點</text>

  <!-- W1 (north, now on the right) -->
  <rect x="354.5" y="111" width="60" height="120" fill="#4a78b5" fill-opacity="0.85" stroke="#28507e" stroke-width="1.5"/>
  <text x="384.5" y="167" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">W1</text>
  <text x="384.5" y="184" text-anchor="middle" font-size="10" fill="#eaf2fb" font-family="sans-serif">底79.5</text>
  <text x="384.5" y="197" text-anchor="middle" font-size="10" fill="#eaf2fb" font-family="sans-serif">頂199.5</text>

  <!-- west switch (between W2 and W1) -->
  <rect x="342.5" y="188.7" width="12" height="7" fill="#d9cdb5" stroke="#9a8a6a" stroke-width="0.8"/>
  <text x="340" y="210" text-anchor="middle" font-size="8" fill="#8a7a5a" font-family="sans-serif">開關</text>

  <!-- bottom distance ticks (distance from north corner; north on right) -->
  <g font-size="10" fill="#5a4a32" font-family="sans-serif" text-anchor="middle">
    <line x1="414.5" y1="310.5" x2="414.5" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="414.5" y="331">118.5</text>
    <line x1="354.5" y1="310.5" x2="354.5" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="354.5" y="331">178.5</text>
    <line x1="325.8" y1="310.5" x2="325.8" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="325.8" y="343">207.2</text>
    <line x1="265.8" y1="310.5" x2="265.8" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="265.8" y="343">267.2</text>
    <line x1="237.1" y1="310.5" x2="237.1" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="237.1" y="331">295.9</text>
    <line x1="177.1" y1="310.5" x2="177.1" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="177.1" y="331">355.9</text>
  </g>
  <text x="287" y="360" text-anchor="middle" font-size="10.5" fill="#7a6c52" font-family="sans-serif">↑ 數字＝距北牆角（右）的距離 (cm)</text>
</svg>
<div class="gik-cap">圖二　西牆三片。W2（橘）比 W1/W3 低 14 cm，板心落在坐姿耳朵高度 125.5 cm。鐵門與開關需避開。</div>
</div>

<h2>三、東牆立面（面對東牆：北在左，與西牆鏡像）</h2>
<p>數字與西牆一模一樣（這正是左右對稱的保證）。北端沿牆有低床（高約 28 cm），位於高處板的下方，不影響框線。</p>

<div class="gik-fig">
<svg viewBox="0 0 553 366" role="img" aria-label="東牆立面圖">
  <rect x="40" y="20" width="493" height="290.5" fill="#fffaf0" stroke="#5a4a32" stroke-width="2"/>
  <line x1="40" y1="310.5" x2="533" y2="310.5" stroke="#5a4a32" stroke-width="3"/>
  <text x="36" y="314" text-anchor="end" font-size="11" fill="#7a6c52" font-family="sans-serif">地板 0</text>
  <text x="36" y="24" text-anchor="end" font-size="11" fill="#7a6c52" font-family="sans-serif">頂 290.5</text>
  <text x="46" y="34" font-size="11" fill="#7a6c52" font-family="sans-serif">← 北　　　　　　南 →</text>

  <!-- bed (C2 default NE furniture) along north end, low ~28cm -->
  <rect x="40" y="282.5" width="156" height="28" fill="#cfd8c4" fill-opacity="0.7" stroke="#9aa888" stroke-width="0.8"/>
  <text x="118" y="300" text-anchor="middle" font-size="10.5" fill="#6f7d5e" font-family="sans-serif">床（低 28cm，不擋高處板）</text>

  <!-- E1 -->
  <rect x="158.5" y="111" width="60" height="120" fill="#4a78b5" fill-opacity="0.85" stroke="#28507e" stroke-width="1.5"/>
  <text x="188.5" y="167" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">E1</text>
  <text x="188.5" y="184" text-anchor="middle" font-size="10" fill="#eaf2fb" font-family="sans-serif">底79.5</text>
  <text x="188.5" y="197" text-anchor="middle" font-size="10" fill="#eaf2fb" font-family="sans-serif">頂199.5</text>

  <!-- E2 -->
  <rect x="247.2" y="125" width="60" height="120" fill="#e08a3c" fill-opacity="0.9" stroke="#a85f1c" stroke-width="1.5"/>
  <text x="277.2" y="181" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">E2 ★</text>
  <text x="277.2" y="200" text-anchor="middle" font-size="10" fill="#fff" font-family="sans-serif">底65.5</text>
  <text x="277.2" y="213" text-anchor="middle" font-size="10" fill="#fff" font-family="sans-serif">頂185.5</text>
  <text x="277.2" y="118" text-anchor="middle" font-size="11" fill="#a85f1c" font-family="sans-serif">第一反射點</text>

  <!-- E3 thin -->
  <rect x="335.9" y="111" width="60" height="120" fill="#4a78b5" fill-opacity="0.85" stroke="#28507e" stroke-width="1.5"/>
  <text x="365.9" y="167" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">E3</text>
  <text x="365.9" y="184" text-anchor="middle" font-size="10.5" fill="#eaf2fb" font-family="sans-serif">薄板5.08</text>
  <g font-size="10" fill="#5a4a32" font-family="sans-serif" text-anchor="middle">
    <line x1="158.5" y1="310.5" x2="158.5" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="158.5" y="331">118.5</text>
    <line x1="218.5" y1="310.5" x2="218.5" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="218.5" y="331">178.5</text>
    <line x1="247.2" y1="310.5" x2="247.2" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="247.2" y="343">207.2</text>
    <line x1="307.2" y1="310.5" x2="307.2" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="307.2" y="343">267.2</text>
    <line x1="335.9" y1="310.5" x2="335.9" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="335.9" y="331">295.9</text>
    <line x1="395.9" y1="310.5" x2="395.9" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="395.9" y="331">355.9</text>
  </g>
  <text x="287" y="360" text-anchor="middle" font-size="10.5" fill="#7a6c52" font-family="sans-serif">↑ 數字＝距北牆角的距離 (cm)</text>
</svg>
<div class="gik-cap">圖三　東牆三片，數字鏡像西牆。校驗時東西同名板的「距北牆」「離地」要逐一相等。</div>
</div>

<h2>四、北牆立面（三片橫擺，留兩道 7 cm 縫）</h2>
<p>三片同寬同位（距西牆 131→251 cm，置中），由下往上疊。<strong>兩道 7 cm 縫不可貼死</strong>：下縫正好讓開北牆插座／開關。</p>

<div class="gik-fig">
<svg viewBox="0 0 442 366" role="img" aria-label="北牆立面圖">
  <rect x="40" y="20" width="382" height="290.5" fill="#fffaf0" stroke="#5a4a32" stroke-width="2"/>
  <line x1="40" y1="310.5" x2="422" y2="310.5" stroke="#5a4a32" stroke-width="3"/>
  <text x="36" y="314" text-anchor="end" font-size="11" fill="#7a6c52" font-family="sans-serif">地板 0</text>
  <text x="36" y="24" text-anchor="end" font-size="11" fill="#7a6c52" font-family="sans-serif">頂 290.5</text>
  <text x="46" y="34" font-size="11" fill="#7a6c52" font-family="sans-serif">← 西　　　　東 →</text>

  <!-- north door from west 39..118 h0..203 -->
  <rect x="79" y="107.5" width="79" height="203" fill="#d9cdb5" stroke="#9a8a6a" stroke-width="1"/>
  <text x="118.5" y="215" text-anchor="middle" font-size="12" fill="#8a7a5a" font-family="sans-serif">木門</text>

  <!-- N3 d131..251 h192.5..252.5 -> y58..118 -->
  <rect x="171" y="58" width="120" height="60" fill="#5a9e6a" fill-opacity="0.88" stroke="#356b41" stroke-width="1.5"/>
  <text x="231" y="86" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">N3</text>
  <text x="231" y="102" text-anchor="middle" font-size="10.5" fill="#eafaef" font-family="sans-serif">底192.5 頂252.5</text>
  <!-- gap 2 -->
  <text x="305" y="125" font-size="10" fill="#a8324a" font-family="sans-serif">↕7cm縫</text>

  <!-- N2 h125.5..185.5 -> y125..185 -->
  <rect x="171" y="125" width="120" height="60" fill="#5a9e6a" fill-opacity="0.88" stroke="#356b41" stroke-width="1.5"/>
  <text x="231" y="153" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">N2</text>
  <text x="231" y="169" text-anchor="middle" font-size="10.5" fill="#eafaef" font-family="sans-serif">底125.5 頂185.5</text>
  <!-- gap 1 with outlet -->
  <rect x="192" y="185" width="12" height="7" fill="#d9cdb5" stroke="#9a8a6a" stroke-width="0.8"/>
  <text x="305" y="192" font-size="10" fill="#a8324a" font-family="sans-serif">↕7cm縫（插座）</text>

  <!-- N1 h58.5..118.5 -> y192..252 -->
  <rect x="171" y="192" width="120" height="60" fill="#5a9e6a" fill-opacity="0.88" stroke="#356b41" stroke-width="1.5"/>
  <text x="231" y="220" text-anchor="middle" font-size="16" fill="#fff" font-family="sans-serif">N1</text>
  <text x="231" y="236" text-anchor="middle" font-size="10.5" fill="#eafaef" font-family="sans-serif">底58.5 頂118.5</text>
  <g font-size="10" fill="#5a4a32" font-family="sans-serif" text-anchor="middle">
    <line x1="171" y1="310.5" x2="171" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="171" y="331">131</text>
    <line x1="291" y1="310.5" x2="291" y2="320" stroke="#5a4a32" stroke-width="0.8"/><text x="291" y="331">251</text>
  </g>
  <text x="231" y="360" text-anchor="middle" font-size="10.5" fill="#7a6c52" font-family="sans-serif">↑ 數字＝距西牆角的距離 (cm)　三片同寬置中</text>
</svg>
<div class="gik-cap">圖四　北牆三片由下往上 N1→N2→N3。下縫對齊插座／開關，務必留空。木門在左下，板從 131 cm 起算可完全避開。</div>
</div>

<h2>五、麥克風架的兩種定位用法</h2>
<p>沒有雷射水平儀時，麥克風架就是你的「高度複製尺」與「鉛垂線」。</p>

<div class="gik-fig">
<svg viewBox="0 0 760 280" role="img" aria-label="麥克風架定位用法">
  <!-- divider -->
  <line x1="380" y1="20" x2="380" y2="260" stroke="#cbbd9e" stroke-width="1" stroke-dasharray="5 4"/>

  <!-- LEFT: story pole as level line -->
  <text x="190" y="34" text-anchor="middle" font-size="14" fill="#3a3024" font-family="sans-serif">用法 A：高度複製尺 → 畫水平線</text>
  <!-- floor -->
  <line x1="40" y1="240" x2="340" y2="240" stroke="#5a4a32" stroke-width="2.5"/>
  <!-- wall -->
  <line x1="300" y1="60" x2="300" y2="240" stroke="#5a4a32" stroke-width="2"/>
  <text x="312" y="150" font-size="11" fill="#7a6c52" font-family="sans-serif" transform="rotate(90 312 150)">牆面</text>
  <!-- mic stand base + pole -->
  <ellipse cx="110" cy="240" rx="34" ry="6" fill="#888" /><rect x="106" y="120" width="8" height="118" fill="#444"/>
  <circle cx="110" cy="120" r="6" fill="#444"/>
  <!-- locked height marker -->
  <line x1="110" y1="120" x2="300" y2="120" stroke="#a8324a" stroke-width="1.6" stroke-dasharray="6 4"/>
  <text x="150" y="113" font-size="11" fill="#a8324a" font-family="sans-serif">鎖死高度（例 79.5cm）</text>
  <!-- slide arrows -->
  <text x="200" y="255" text-anchor="middle" font-size="11" fill="#5a4a32" font-family="sans-serif">沿牆滑 2～3 點 → 點同高 → 連成水平線</text>
  <!-- marks on wall -->
  <circle cx="300" cy="120" r="3" fill="#a8324a"/>
  <text x="60" y="200" font-size="11" fill="#7a6c52" font-family="sans-serif">麥架</text>

  <!-- RIGHT: plumb line -->
  <text x="570" y="34" text-anchor="middle" font-size="14" fill="#3a3024" font-family="sans-serif">用法 B：鉛垂線 → 畫垂直邊</text>
  <line x1="430" y1="240" x2="710" y2="240" stroke="#5a4a32" stroke-width="2.5"/>
  <!-- wall vertical reference: from top mark hang string+weight -->
  <circle cx="570" cy="70" r="4" fill="#a8324a"/>
  <text x="578" y="66" font-size="11" fill="#a8324a" font-family="sans-serif">板頂記號</text>
  <line x1="570" y1="70" x2="570" y2="215" stroke="#333" stroke-width="1.4"/>
  <path d="M564 215 h12 l-6 14 z" fill="#444"/>
  <text x="585" y="150" font-size="11" fill="#5a4a32" font-family="sans-serif">細線＋小重物</text>
  <text x="585" y="166" font-size="11" fill="#5a4a32" font-family="sans-serif">（麥克風夾／螺帽）</text>
  <text x="570" y="258" text-anchor="middle" font-size="11" fill="#5a4a32" font-family="sans-serif">線自然垂直 → 沿線描＝真正垂直邊</text>
</svg>
<div class="gik-cap">圖五　左：把架子鎖在板底高度，沿牆滑動取得一條水平線（取代雷射水平儀，前提是地板大致平整）。右：從頂端記號吊重物當鉛垂，描出直板的垂直邊。要鎖的高度只有 5 個：58.5／65.5／79.5／125.5／192.5 cm。</div>
</div>

<h2>六、驗證方法圖解（全程只用捲尺）</h2>

<div class="gik-fig">
<svg viewBox="0 0 760 280" role="img" aria-label="驗證方法">
  <line x1="380" y1="20" x2="380" y2="260" stroke="#cbbd9e" stroke-width="1" stroke-dasharray="5 4"/>

  <!-- LEFT: diagonal check -->
  <text x="190" y="34" text-anchor="middle" font-size="14" fill="#3a3024" font-family="sans-serif">驗證 A：對角線相等 → 不歪斜</text>
  <rect x="130" y="60" width="120" height="160" fill="#eef3fa" stroke="#28507e" stroke-width="2"/>
  <line x1="130" y1="60" x2="250" y2="220" stroke="#a8324a" stroke-width="1.6"/>
  <line x1="250" y1="60" x2="130" y2="220" stroke="#a8324a" stroke-width="1.6"/>
  <text x="190" y="245" text-anchor="middle" font-size="12" fill="#a8324a" font-family="sans-serif">兩條對角線都應 = 134.2 cm</text>
  <text x="190" y="262" text-anchor="middle" font-size="11" fill="#7a6c52" font-family="sans-serif">(60 × 120 板)</text>
  <text x="120" y="145" text-anchor="end" font-size="11" fill="#28507e" font-family="sans-serif">120</text>
  <text x="190" y="54" text-anchor="middle" font-size="11" fill="#28507e" font-family="sans-serif">60</text>

  <!-- RIGHT: symmetry check -->
  <text x="570" y="34" text-anchor="middle" font-size="14" fill="#3a3024" font-family="sans-serif">驗證 B：左右對稱（俯視示意，非比例）</text>
  <!-- center -->
  <circle cx="570" cy="90" r="6" fill="none" stroke="#a8324a" stroke-width="2"/><circle cx="570" cy="90" r="2" fill="#a8324a"/>
  <text x="570" y="80" text-anchor="middle" font-size="11" fill="#a8324a" font-family="sans-serif">聆聽中心點（麥架）</text>
  <!-- W2 left, E2 right -->
  <rect x="455" y="150" width="14" height="40" fill="#e08a3c" stroke="#a85f1c"/>
  <text x="462" y="205" text-anchor="middle" font-size="12" fill="#a85f1c" font-family="sans-serif">W2</text>
  <rect x="671" y="150" width="14" height="40" fill="#e08a3c" stroke="#a85f1c"/>
  <text x="678" y="205" text-anchor="middle" font-size="12" fill="#a85f1c" font-family="sans-serif">E2</text>
  <line x1="570" y1="90" x2="462" y2="170" stroke="#a8324a" stroke-width="1.5"/>
  <line x1="570" y1="90" x2="678" y2="170" stroke="#a8324a" stroke-width="1.5"/>
  <text x="500" y="125" text-anchor="middle" font-size="12" fill="#a8324a" font-family="sans-serif">197.4</text>
  <text x="640" y="125" text-anchor="middle" font-size="12" fill="#a8324a" font-family="sans-serif">197.4</text>
  <text x="570" y="248" text-anchor="middle" font-size="11.5" fill="#5a4a32" font-family="sans-serif">中心→W2 = 中心→E2 = 197.4 cm</text>
  <text x="570" y="264" text-anchor="middle" font-size="11" fill="#7a6c52" font-family="sans-serif">兩邊相等＝左右反射對稱</text>
</svg>
<div class="gik-cap">圖六　左：每片掛前量兩條對角線，皆 ≈ 134.2 cm 表示四角是直角。右：用中心點麥架量到 W2／E2 板心，兩邊都 197.4 cm 即左右對稱。掛後再量上下凸出（11.8 或 5.08 cm）是否一致，確認貼平。</div>
</div>

<h2>七、施作順序 SOP（階段 0 → 4）</h2>
<p>原則：按「離地高度」分組，同高度的左右兩面牆一起做，做完一對立刻驗對稱，最後做北牆。每組高度線只設定一次，又能即時抓出左右歪斜。</p>
<p>下圖為施作順序總覽，與下方步驟相輔相成：先做中段第一反射點對（階段 1），再補側牆其餘四片（階段 2），最後北牆三片（階段 3）。</p>

<div class="gik-fig">
<svg viewBox="0 0 640 215" role="img" aria-label="施作順序總覽 storyboard">
  <text x="320" y="17" text-anchor="middle" font-size="13" fill="#3a3024" font-family="sans-serif">施作順序：每階段「新增」的板（橘＝本階段新做、藍/綠＝已完成、灰框＝尚未做）</text>

  <!-- Mini A 階段1 -->
  <rect x="45" y="30" width="110" height="130" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.5"/>
  <text x="100" y="44" text-anchor="middle" font-size="8" fill="#9a8a6a" font-family="sans-serif">北 ↑</text>
  <rect x="82.7" y="27" width="34.6" height="5" fill="none" stroke="#c9bfa8" stroke-width="1"/>
  <rect x="42.5" y="61" width="5" height="16" fill="none" stroke="#c9bfa8" stroke-width="1"/>
  <rect x="42.5" y="85" width="5" height="16" fill="#e08a3c"/>
  <rect x="42.5" y="108" width="5" height="16" fill="none" stroke="#c9bfa8" stroke-width="1"/>
  <rect x="152.5" y="61" width="5" height="16" fill="none" stroke="#c9bfa8" stroke-width="1"/>
  <rect x="152.5" y="85" width="5" height="16" fill="#e08a3c"/>
  <rect x="152.5" y="108" width="5" height="16" fill="none" stroke="#c9bfa8" stroke-width="1"/>
  <circle cx="100" cy="79" r="3" fill="none" stroke="#a8324a" stroke-width="1.4"/>
  <text x="100" y="184" text-anchor="middle" font-size="12" fill="#a85f1c" font-family="sans-serif">階段 1</text>
  <text x="100" y="200" text-anchor="middle" font-size="10" fill="#5a4a32" font-family="sans-serif">第一反射點對 W2/E2</text>

  <line x1="163" y1="93" x2="262" y2="93" stroke="#9a8a6a" stroke-width="1.5"/>
  <path d="M262 93 l-8 -4 v8 z" fill="#9a8a6a"/>

  <!-- Mini B 階段2 -->
  <rect x="270" y="30" width="110" height="130" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.5"/>
  <rect x="307.7" y="27" width="34.6" height="5" fill="none" stroke="#c9bfa8" stroke-width="1"/>
  <rect x="267.5" y="61" width="5" height="16" fill="#e08a3c"/>
  <rect x="267.5" y="85" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="267.5" y="108" width="5" height="16" fill="#e08a3c"/>
  <rect x="377.5" y="61" width="5" height="16" fill="#e08a3c"/>
  <rect x="377.5" y="85" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="377.5" y="108" width="5" height="16" fill="#e08a3c"/>
  <circle cx="325" cy="79" r="3" fill="none" stroke="#a8324a" stroke-width="1.4"/>
  <text x="325" y="184" text-anchor="middle" font-size="12" fill="#a85f1c" font-family="sans-serif">階段 2</text>
  <text x="325" y="200" text-anchor="middle" font-size="10" fill="#5a4a32" font-family="sans-serif">側牆其餘四片</text>

  <line x1="388" y1="93" x2="487" y2="93" stroke="#9a8a6a" stroke-width="1.5"/>
  <path d="M487 93 l-8 -4 v8 z" fill="#9a8a6a"/>

  <!-- Mini C 階段3 -->
  <rect x="495" y="30" width="110" height="130" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.5"/>
  <rect x="532.7" y="27" width="34.6" height="5" fill="#5a9e6a"/>
  <rect x="492.5" y="61" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="492.5" y="85" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="492.5" y="108" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="602.5" y="61" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="602.5" y="85" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="602.5" y="108" width="5" height="16" fill="#4a78b5" fill-opacity="0.8"/>
  <circle cx="550" cy="79" r="3" fill="none" stroke="#a8324a" stroke-width="1.4"/>
  <text x="550" y="184" text-anchor="middle" font-size="12" fill="#356b41" font-family="sans-serif">階段 3</text>
  <text x="550" y="200" text-anchor="middle" font-size="10" fill="#5a4a32" font-family="sans-serif">北牆三片 N1→N2→N3</text>
</svg>
<div class="gik-cap">圖七　施作順序總覽（俯視，北在上）：橘色是該階段新做、藍/綠是已完成、灰框尚未做。對照下方階段 0～4 步驟一起看。</div>
</div>

<div class="gik-step">
<div class="gik-mini">
<svg viewBox="0 0 150 124" role="img" aria-label="階段0 置中">
  <rect x="33" y="10" width="84" height="104" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.2"/>
  <text x="75" y="8" text-anchor="middle" font-size="7" fill="#9a8a6a" font-family="sans-serif">北</text>
  <circle cx="75" cy="50" r="4" fill="none" stroke="#a8324a" stroke-width="1.5"/><circle cx="75" cy="50" r="1.5" fill="#a8324a"/>
  <line x1="33" y1="50" x2="71" y2="50" stroke="#a8324a" stroke-width="0.7" stroke-dasharray="3 2"/>
  <line x1="79" y1="50" x2="117" y2="50" stroke="#a8324a" stroke-width="0.7" stroke-dasharray="3 2"/>
  <text x="52" y="47" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">191</text>
  <text x="98" y="47" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">191</text>
  <line x1="75" y1="10" x2="75" y2="46" stroke="#a8324a" stroke-width="0.7" stroke-dasharray="3 2"/>
  <text x="93" y="30" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">187.4</text>
  <text x="75" y="64" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">麥架</text>
  <text x="75" y="120" text-anchor="middle" font-size="8" fill="#5a4a32" font-family="sans-serif">置中＋立基準樁</text>
</svg>
</div>
<div class="gik-stxt"><strong>階段 0　前置</strong>：確認地板大致平整（麥架移到各板角地面，桿頂高度差 ≤ 0.5 cm）。量出聆聽中心點（兩側牆各 191 cm 取中、往北 187.4 cm），麥架立此當對稱基準樁。</div>
</div>

<div class="gik-step">
<div class="gik-mini">
<svg viewBox="0 0 150 124" role="img" aria-label="階段1 第一反射點對">
  <rect x="33" y="10" width="84" height="104" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.2"/>
  <text x="75" y="8" text-anchor="middle" font-size="7" fill="#9a8a6a" font-family="sans-serif">北</text>
  <rect x="30" y="54" width="5" height="14" fill="#e08a3c"/>
  <rect x="115" y="54" width="5" height="14" fill="#e08a3c"/>
  <circle cx="75" cy="50" r="3" fill="none" stroke="#a8324a" stroke-width="1.3"/>
  <line x1="75" y1="50" x2="35" y2="61" stroke="#a8324a" stroke-width="0.7"/>
  <line x1="75" y1="50" x2="115" y2="61" stroke="#a8324a" stroke-width="0.7"/>
  <text x="52" y="45" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">197.4</text>
  <text x="98" y="45" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">197.4</text>
  <text x="26" y="52" text-anchor="middle" font-size="7" fill="#a85f1c" font-family="sans-serif">W2</text>
  <text x="124" y="52" text-anchor="middle" font-size="7" fill="#a85f1c" font-family="sans-serif">E2</text>
  <text x="75" y="120" text-anchor="middle" font-size="8" fill="#5a4a32" font-family="sans-serif">先做 W2/E2（橘）</text>
</svg>
</div>
<div class="gik-stxt"><strong>階段 1　先做第一反射點這一對（W2 + E2）</strong>：麥架鎖 65.5 cm，西牆「距北牆 207.2～267.2 cm」畫板底線；同高度跨到東牆同位畫線。補垂直邊框出 60×120 方框，量對角線 134.2 cm、量中心點到兩板心 197.4 cm，過了再掛板。</div>
</div>

<div class="gik-step">
<div class="gik-mini">
<svg viewBox="0 0 150 124" role="img" aria-label="階段2 側牆四片">
  <rect x="33" y="10" width="84" height="104" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.2"/>
  <text x="75" y="8" text-anchor="middle" font-size="7" fill="#9a8a6a" font-family="sans-serif">北</text>
  <rect x="30" y="34" width="5" height="14" fill="#e08a3c"/>
  <rect x="30" y="54" width="5" height="14" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="30" y="74" width="5" height="14" fill="#e08a3c"/>
  <rect x="115" y="34" width="5" height="14" fill="#e08a3c"/>
  <rect x="115" y="54" width="5" height="14" fill="#4a78b5" fill-opacity="0.8"/>
  <rect x="115" y="74" width="5" height="14" fill="#e08a3c"/>
  <circle cx="75" cy="50" r="3" fill="none" stroke="#a8324a" stroke-width="1.3"/>
  <text x="75" y="120" text-anchor="middle" font-size="8" fill="#5a4a32" font-family="sans-serif">補四片（橘＝新）</text>
</svg>
</div>
<div class="gik-stxt"><strong>階段 2　補側牆四片（W1/E1 偏北、W3/E3 偏南）</strong>：板底都是 79.5 cm。麥架改鎖 79.5 cm，一次把四片板底線畫好（W1/E1 距北牆 118.5～178.5；W3/E3 距北牆 295.9～355.9）。框方框、驗對稱、掛板（E3/W3 是 5.08 cm 薄板，別拿錯）。</div>
</div>

<div class="gik-step">
<div class="gik-mini">
<svg viewBox="0 0 150 124" role="img" aria-label="階段3 北牆三片">
  <rect x="22" y="12" width="106" height="96" fill="#fffaf0" stroke="#5a4a32" stroke-width="1.2"/>
  <rect x="48" y="20" width="54" height="18" fill="#5a9e6a" fill-opacity="0.88"/><text x="75" y="33" text-anchor="middle" font-size="8" fill="#fff" font-family="sans-serif">N3</text>
  <rect x="48" y="44" width="54" height="18" fill="#5a9e6a" fill-opacity="0.88"/><text x="75" y="57" text-anchor="middle" font-size="8" fill="#fff" font-family="sans-serif">N2</text>
  <rect x="48" y="68" width="54" height="18" fill="#5a9e6a" fill-opacity="0.88"/><text x="75" y="81" text-anchor="middle" font-size="8" fill="#fff" font-family="sans-serif">N1</text>
  <text x="111" y="43" text-anchor="middle" font-size="6.5" fill="#a8324a" font-family="sans-serif">7cm</text>
  <text x="111" y="67" text-anchor="middle" font-size="6.5" fill="#a8324a" font-family="sans-serif">7cm</text>
  <path d="M34 84 L34 48 M34 48 l-3 5 M34 48 l3 5" stroke="#5a4a32" stroke-width="1" fill="none"/>
  <text x="75" y="120" text-anchor="middle" font-size="8" fill="#5a4a32" font-family="sans-serif">由下往上，留兩縫</text>
</svg>
</div>
<div class="gik-stxt"><strong>階段 3　北牆三片（由下往上 N1 → N2 → N3）</strong>：水平位置都一樣（距西牆 131～251 cm），先畫兩條垂直邊；麥架依序鎖 58.5／125.5／192.5 cm 畫板底線，板頂分別 118.5／185.5／252.5 cm。嚴守兩道 7 cm 縫，下縫讓開插座。下一片可暫靠已掛好的板對位。</div>
</div>

<div class="gik-step">
<div class="gik-mini">
<svg viewBox="0 0 150 124" role="img" aria-label="階段4 驗收">
  <rect x="52" y="16" width="42" height="64" fill="#eef3fa" stroke="#28507e" stroke-width="1.3"/>
  <line x1="52" y1="16" x2="94" y2="80" stroke="#a8324a" stroke-width="1"/>
  <line x1="94" y1="16" x2="52" y2="80" stroke="#a8324a" stroke-width="1"/>
  <text x="73" y="93" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">對角 134.2</text>
  <text x="73" y="104" text-anchor="middle" font-size="7" fill="#a8324a" font-family="sans-serif">左右 197.4</text>
  <text x="73" y="115" text-anchor="middle" font-size="7" fill="#5a4a32" font-family="sans-serif">凸出一致＋鏡子實測</text>
</svg>
</div>
<div class="gik-stxt"><strong>階段 4　總驗收</strong>：東西同名板「距北牆」「離地」逐一比對相等；每片上下凸出一致；（選用）拿鏡子做第一反射點實測，鏡中看到喇叭高音單體時，鏡子位置應落在 E2／W2 範圍內。</div>
</div>

<h2>八、採購與數據速查</h2>

<table>
<thead><tr><th>板</th><th>牆面</th><th>水平位置</th><th>離地高度（底→頂）</th><th>厚度</th></tr></thead>
<tbody>
<tr><td>W1</td><td>西牆</td><td>距北牆 118.5 → 178.5</td><td>79.5 → 199.5</td><td>11.8 cm</td></tr>
<tr><td>W2 ★</td><td>西牆</td><td>距北牆 207.2 → 267.2</td><td>65.5 → 185.5</td><td>11.8 cm</td></tr>
<tr><td>W3</td><td>西牆</td><td>距北牆 295.9 → 355.9</td><td>79.5 → 199.5</td><td>5.08 cm</td></tr>
<tr><td>E1</td><td>東牆</td><td>距北牆 118.5 → 178.5</td><td>79.5 → 199.5</td><td>11.8 cm</td></tr>
<tr><td>E2 ★</td><td>東牆</td><td>距北牆 207.2 → 267.2</td><td>65.5 → 185.5</td><td>11.8 cm</td></tr>
<tr><td>E3</td><td>東牆</td><td>距北牆 295.9 → 355.9</td><td>79.5 → 199.5</td><td>5.08 cm</td></tr>
<tr><td>N1</td><td>北牆</td><td>距西牆 131 → 251</td><td>58.5 → 118.5</td><td>11.8 cm</td></tr>
<tr><td>N2</td><td>北牆</td><td>距西牆 131 → 251</td><td>125.5 → 185.5</td><td>11.8 cm</td></tr>
<tr><td>N3</td><td>北牆</td><td>距西牆 131 → 251</td><td>192.5 → 252.5</td><td>11.8 cm</td></tr>
</tbody>
</table>

<p><strong>採購：</strong>7 片厚 11.8 cm（N1/N2/N3/E1/E2/W1/W2）＋ 2 片薄 5.08 cm（E3/W3）。全部 60 × 120 cm。★ = 第一反射點，全室最關鍵的一對。</p>
<p style="color:#aa9a82;font-size:13px">資料來源：js/Home_Studio.js:331-348（C2 面板與南側厚度）、js/Home_Studio.js:4-9（房間邊界）、js/InitCommon.js:1309-1396（牆面世界座標）。預設南側 E3/W3 為 spot 薄板 5.08 cm，專案內可切回 11.8 cm。</p>
