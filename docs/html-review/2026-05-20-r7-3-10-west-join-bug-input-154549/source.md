<section>
  <h1>R7-3.10 西牆交界缺陷輸入報告</h1>
  <p>本報告只整理使用者於 2026-05-20 15:42 提供的單一視角 BUG 資訊，作為後續逐項修正與審查的輸入文件。</p>
</section>

<section>
  <h2>基本資訊</h2>
  <ul>
    <li>報告時間：2026-05-20 15:45:49</li>
    <li>頁面版本：<code>r7310-camera-pose-copy-v1</code></li>
    <li>場景設定：config 1，samples 1，暫停，SPP 上限 1000</li>
    <li>觀察區域：西牆、西樑、西南柱交界</li>
  </ul>
</section>

<section>
  <h2>重現視角</h2>
  <p>以下內容保留使用者複製的視角資訊原文，後續 runner 或人工驗收應優先使用這組條件重播。</p>
  <pre><code>cameraState={"position":{"x":-1.853876,"y":2.489781,"z":2.775573},"yaw":1.993985,"pitch":0.224,"fov":55,"forward":{"x":-0.889005,"y":0.222131,"z":0.40041}}
forward={"x":-0.889005,"y":0.222131,"z":0.40041}
view={"facing":"西(-X)","config":1,"samples":1,"paused":true,"sppCap":1000}
viewport={"innerWidth":1458,"innerHeight":741,"canvasCssWidth":1318,"canvasCssHeight":741,"drawingBufferWidth":1280,"drawingBufferHeight":720,"devicePixelRatio":3.5,"aspect":1.777778}</code></pre>
</section>

<section>
  <h2>使用者觀察</h2>
  <h3>BUG 01：西牆與西樑交界</h3>
  <ul>
    <li>交界處可見縫隙。</li>
    <li>西牆邊界形成柔邊。</li>
    <li>西樑邊界形成硬邊。</li>
    <li>此現象需要與 west wall route、west beam route 的接管邊界分開檢查。</li>
  </ul>

  <h3>BUG 02：西樑與西南柱交界</h3>
  <ul>
    <li>交界處可見縫隙。</li>
    <li>西牆邊界形成陰影。</li>
    <li>西南柱邊界形成硬邊。</li>
    <li>此現象需要與西樑南端、柱體北面、陰影 patch 採樣邊界分開檢查。</li>
  </ul>
</section>

<section>
  <h2>畫面證據</h2>
  <p>原始畫面為使用者於對話中貼上的截圖。本報告另外附上一組由 runner 以同 cameraState 產生的本機輔助重播圖，方便後續代理不用只靠文字定位。</p>

  <figure>
    <img src="../../../.omc/r7-3-10-west-wall-beam-shadow-live-match/20260520-154151/live-reference.png" alt="同 cameraState live reference 輔助截圖">
    <figcaption>輔助截圖 A：同 cameraState，live reference，UI 已隱藏，samples 1。</figcaption>
  </figure>

  <figure>
    <img src="../../../.omc/r7-3-10-west-wall-beam-shadow-live-match/20260520-154151/west-wall-beam-shadow-bake.png" alt="同 cameraState west wall beam shadow bake 輔助截圖">
    <figcaption>輔助截圖 B：同 cameraState，west-wall-beam-shadow bake route，UI 已隱藏，samples 1。</figcaption>
  </figure>

  <p>輔助截圖只證明 runner 可以用同一 cameraState 重播並輸出素材；這份輸入報告仍保留為待查狀態。</p>
</section>

<section>
  <h2>後續調查邊界</h2>
  <ul>
    <li>先把 BUG 01 與 BUG 02 分開處理，避免西牆、西樑、西南柱三者的邊界問題混在同一個修法裡。</li>
    <li>BUG 01 優先比對西牆邊界柔邊與西樑邊界硬邊是否來自不同 route 的亮度或 alpha 連續性問題。</li>
    <li>BUG 02 優先比對西樑南端與西南柱北面是否有幾何接觸、採樣範圍或 hybrid route 接管差異。</li>
    <li>下一輪若新增 probe 或修正，請沿用本報告的 cameraState 作同視角 A/B 驗收。</li>
  </ul>
  <p>本報告為輸入整理，尚未包含根因判定與修復方案。</p>
</section>
