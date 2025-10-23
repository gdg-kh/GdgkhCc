#!/usr/bin/env node

/**
 * 講者專屬頁面生成器
 * 為每個講者生成獨立的 HTML 頁面，包含動態的 Open Graph meta 標籤
 */

const fs = require('fs');
const path = require('path');

// 讀取講者資料
const speakersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'speakers.json'), 'utf-8'));

// 輸出目錄
const OUTPUT_DIR = path.join(__dirname, 'share', 'speakers');

// 確保輸出目錄存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 跳脫 HTML 特殊字元
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * 生成講者專屬的 HTML 頁面（使用動態模板）
 */
function generateSpeakerPage(speaker) {
  const speakerId = speaker.id;
  const speakerDir = path.join(OUTPUT_DIR, speakerId);

  // 建立講者資料夾
  if (!fs.existsSync(speakerDir)) {
    fs.mkdirSync(speakerDir, { recursive: true });
  }

  // 讀取動態模板
  const templatePath = path.join(__dirname, 'speaker-template.html');
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  // 準備 meta tags 資料
  const baseUrl = 'https://gdgkh.cc';
  const speakerUrl = `${baseUrl}/share/speakers/${speakerId}/`;
  const ogImageUrl = `${baseUrl}/share/speakers/${speakerId}/og-image.png`;

  const nameZh = speaker.name.zh || speaker.name.en;
  const orgZh = speaker.org.zh || speaker.org.en || '';
  const sessionName = speaker.session?.name?.zh || speaker.session?.name?.en || '';
  const bioZh = (speaker.bio.zh || speaker.bio.en || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .substring(0, 200)
    .trim();

  const title = `${nameZh} - DevFest Kaohsiung X S. TW Communities Gathering 2025`;
  const ogTitle = `${nameZh} - DevFest 高雄場 X 南臺灣技術社群大聚 2025`;
  const description =
    '今年 GDG Kaohsiung 和開發者 Buffet 一起在高雄舉辦軟體社群年會 - 一起探索 Google Cloud、Gemini AI、Android 開發及科技向善的最新趨勢,並且與眾多技術社群一同交流學習。';
  const keywords = `DevFest, Kaohsiung, ${nameZh}, ${orgZh}, Speaker, Google Developer`;

  // 替換模板中的 meta tags
  let html = templateContent;

  // 替換 title
  html = html.replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${escapeHtml(title)}</title>`);

  // 替換 Open Graph meta tags
  html = html.replace(
    /<meta property="og:url" content="" id="ogUrl" \/>/,
    `<meta property="og:url" content="${escapeHtml(speakerUrl)}" id="ogUrl" />`
  );
  html = html.replace(
    /<meta property="og:title" content="" id="ogTitle" \/>/,
    `<meta property="og:title" content="${escapeHtml(ogTitle)}" id="ogTitle" />`
  );
  html = html.replace(
    /<meta property="og:description" content="" id="ogDescription" \/>/,
    `<meta property="og:description" content="${escapeHtml(description)}" id="ogDescription" />`
  );
  html = html.replace(
    /<meta property="og:image" content="" id="ogImage" \/>/,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" id="ogImage" />`
  );
  html = html.replace(
    /<meta property="og:image:alt" content="" id="ogImageAlt" \/>/,
    `<meta property="og:image:alt" content="${escapeHtml(nameZh)}" id="ogImageAlt" />`
  );

  // 替換 Twitter meta tags
  html = html.replace(
    /<meta property="twitter:url" content="" id="twitterUrl" \/>/,
    `<meta property="twitter:url" content="${escapeHtml(speakerUrl)}" id="twitterUrl" />`
  );
  html = html.replace(
    /<meta property="twitter:title" content="" id="twitterTitle" \/>/,
    `<meta property="twitter:title" content="${escapeHtml(ogTitle)}" id="twitterTitle" />`
  );
  html = html.replace(
    /<meta property="twitter:description" content="" id="twitterDescription" \/>/,
    `<meta property="twitter:description" content="${escapeHtml(description)}" id="twitterDescription" />`
  );
  html = html.replace(
    /<meta property="twitter:image" content="" id="twitterImage" \/>/,
    `<meta property="twitter:image" content="${escapeHtml(ogImageUrl)}" id="twitterImage" />`
  );

  // 替換其他 meta tags
  html = html.replace(
    /<meta name="description" content="" id="metaDescription" \/>/,
    `<meta name="description" content="${escapeHtml(description)}" id="metaDescription" />`
  );
  html = html.replace(
    /<meta name="keywords" content="" id="metaKeywords" \/>/,
    `<meta name="keywords" content="${escapeHtml(keywords)}" id="metaKeywords" />`
  );

  // 替換 canonical URL
  html = html.replace(
    /<link rel="canonical" href="" id="canonicalUrl" \/>/,
    `<link rel="canonical" href="${escapeHtml(speakerUrl)}" id="canonicalUrl" />`
  );

  // 寫入檔案
  const htmlPath = path.join(speakerDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`✓ Generated: share/speakers/${speakerId}/index.html`);

  return {
    speakerId,
    speakerDir,
    speaker,
  };
}

/**
 * 生成 OG 圖片生成器的 HTML 頁面
 */
function generateOgImageGenerator() {
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OG Image Generator - DevFest 2025</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Roboto', 'Noto Sans TC', sans-serif;
      padding: 2rem;
      background: #f5f5f5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      color: #333;
      margin-bottom: 2rem;
      text-align: center;
    }

    .controls {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #666;
      font-weight: 500;
    }

    select, button {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }

    select {
      background: white;
      cursor: pointer;
    }

    button {
      background: #1a73e8;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.3s;
    }

    button:hover {
      background: #1557b0;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .preview-section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .preview-title {
      margin-bottom: 1rem;
      color: #333;
      font-size: 1.2rem;
    }

    .canvas-container {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
    }

    #ogCanvas {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .info {
      background: #e8f0fe;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
      color: #1a73e8;
    }

    .button-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .success-message {
      background: #34a853;
      color: white;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
      display: none;
    }

    .success-message.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 DevFest 2025 講者 OG 圖片生成器</h1>

    <div class="controls">
      <div class="form-group">
        <label for="speakerSelect">選擇講者 / Select Speaker:</label>
        <select id="speakerSelect">
          <option value="">-- 請選擇講者 --</option>
        </select>
      </div>

      <div class="button-group">
        <button id="generateBtn" disabled>生成預覽 Generate Preview</button>
        <button id="downloadBtn" disabled>下載圖片 Download Image</button>
      </div>

      <div id="successMessage" class="success-message">
        ✓ 圖片已生成！您可以下載或繼續選擇其他講者。
      </div>
    </div>

    <div class="preview-section">
      <h2 class="preview-title">預覽 Preview (1200 x 630)</h2>
      <div class="canvas-container">
        <canvas id="ogCanvas" width="1200" height="630"></canvas>
      </div>
      <div class="info">
        💡 提示：生成預覽後，點擊「下載圖片」按鈕將圖片儲存為 <code>og-image.png</code>，然後將其放入對應的講者資料夾中。
      </div>
    </div>
  </div>

  <script>
    let speakersData = [];
    let currentSpeaker = null;

    // 載入講者資料
    async function loadSpeakers() {
      try {
        const response = await fetch('../data/speakers.json');
        const data = await response.json();
        speakersData = data.speakers;
        populateSpeakerSelect();
      } catch (error) {
        console.error('Error loading speakers:', error);
        alert('無法載入講者資料，請確認檔案路徑正確。');
      }
    }

    // 填充講者選單
    function populateSpeakerSelect() {
      const select = document.getElementById('speakerSelect');
      speakersData.forEach(speaker => {
        const option = document.createElement('option');
        option.value = speaker.id;
        option.textContent = \`\${speaker.name.zh || speaker.name.en} - \${speaker.session?.name?.zh || speaker.session?.name?.en || 'No Session'}\`;
        select.appendChild(option);
      });
    }

    // 載入圖片（支援跨域）
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    // 繪製圓形圖片
    function drawCircularImage(ctx, img, x, y, radius) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // 計算圖片裁切以填滿圓形
      const scale = Math.max(radius * 2 / img.width, radius * 2 / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const offsetX = x - scaledWidth / 2;
      const offsetY = y - scaledHeight / 2;

      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      ctx.restore();
    }

    // 自動換行文字
    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split('');
      let line = '';
      let lineCount = 0;
      const maxLines = 3;

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i];
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line !== '') {
          ctx.fillText(line, x, y);
          line = words[i];
          y += lineHeight;
          lineCount++;

          if (lineCount >= maxLines - 1 && i < words.length - 1) {
            // 最後一行加上省略號
            const remaining = words.slice(i).join('');
            const ellipsis = '...';
            let truncated = '';
            for (let j = 0; j < remaining.length; j++) {
              const test = truncated + remaining[j] + ellipsis;
              if (ctx.measureText(test).width > maxWidth) {
                break;
              }
              truncated += remaining[j];
            }
            ctx.fillText(truncated + ellipsis, x, y);
            return y + lineHeight;
          }
        } else {
          line = testLine;
        }
      }

      ctx.fillText(line, x, y);
      return y + lineHeight;
    }

    // 生成 OG 圖片
    async function generateOgImage(speaker) {
      const canvas = document.getElementById('ogCanvas');
      const ctx = canvas.getContext('2d');

      // 清空畫布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 背景漸層
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 半透明覆蓋層
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // DevFest Logo 區域（左上）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, 0, 400, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Roboto, sans-serif';
      ctx.fillText('DevFest 2025', 40, 75);

      // 講者照片（圓形，左側）
      try {
        const photoPath = speaker.photo ? \`../\${speaker.photo}\` : '../images/default-speaker.png';
        const photoImg = await loadImage(photoPath);
        drawCircularImage(ctx, photoImg, 250, 315, 150);

        // 照片邊框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(250, 315, 150, 0, Math.PI * 2);
        ctx.stroke();
      } catch (error) {
        console.warn('無法載入講者照片，使用預設樣式', error);
        // 預設圓形佔位符
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(250, 315, 150, 0, Math.PI * 2);
        ctx.fill();
      }

      // 講者資訊區域（右側）
      const infoX = 450;
      let currentY = 200;

      // 講者姓名
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Roboto, Noto Sans TC, sans-serif';
      ctx.fillText(speaker.name.zh || speaker.name.en, infoX, currentY);
      currentY += 80;

      // 組織
      if (speaker.org.zh || speaker.org.en) {
        ctx.font = '32px Roboto, Noto Sans TC, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(speaker.org.zh || speaker.org.en, infoX, currentY);
        currentY += 60;
      }

      // 分隔線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(infoX, currentY);
      ctx.lineTo(infoX + 650, currentY);
      ctx.stroke();
      currentY += 40;

      // 議程主題
      if (speaker.session?.name?.zh || speaker.session?.name?.en) {
        ctx.font = 'bold 36px Roboto, Noto Sans TC, sans-serif';
        ctx.fillStyle = '#ffd54f';
        const sessionName = speaker.session.name.zh || speaker.session.name.en;
        currentY = wrapText(ctx, sessionName, infoX, currentY, 650, 50);
      }

      // 底部資訊條
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

      ctx.fillStyle = '#ffffff';
      ctx.font = '28px Roboto, sans-serif';
      ctx.fillText('🗓 2025年1月11日-12日', 40, canvas.height - 35);
      ctx.fillText('📍 高雄', 450, canvas.height - 35);
      ctx.fillText('🌐 devfest2025.gdgkaohsiung.org', 650, canvas.height - 35);

      return canvas;
    }

    // 下載圖片
    function downloadImage() {
      const canvas = document.getElementById('ogCanvas');
      const link = document.createElement('a');
      link.download = \`og-image-\${currentSpeaker.id}.png\`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      document.getElementById('successMessage').classList.add('show');
      setTimeout(() => {
        document.getElementById('successMessage').classList.remove('show');
      }, 3000);
    }

    // 事件監聽器
    document.getElementById('speakerSelect').addEventListener('change', (e) => {
      const speakerId = e.target.value;
      currentSpeaker = speakersData.find(s => s.id === speakerId);
      document.getElementById('generateBtn').disabled = !speakerId;
      document.getElementById('downloadBtn').disabled = true;
    });

    document.getElementById('generateBtn').addEventListener('click', async () => {
      if (currentSpeaker) {
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('generateBtn').textContent = '生成中...';

        try {
          await generateOgImage(currentSpeaker);
          document.getElementById('downloadBtn').disabled = false;
        } catch (error) {
          console.error('生成圖片失敗:', error);
          alert('生成圖片時發生錯誤，請查看控制台。');
        } finally {
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = '生成預覽 Generate Preview';
        }
      }
    });

    document.getElementById('downloadBtn').addEventListener('click', downloadImage);

    // 初始化
    loadSpeakers();
  </script>
</body>
</html>`;

  const htmlPath = path.join(__dirname, 'og-image-generator.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log('✓ Generated: og-image-generator.html');
}

/**
 * 主執行函式
 */
function main() {
  console.log('🚀 開始生成講者專屬頁面...\n');

  // 生成每個講者的頁面
  const results = speakersData.speakers.map(generateSpeakerPage);

  // 生成 OG 圖片生成器
  generateOgImageGenerator();

  console.log(`\n✅ 完成！共生成 ${results.length} 個講者頁面。`);
  console.log('\n📋 下一步操作：');
  console.log('1. 啟動本地伺服器: npm run serve');
  console.log('2. 開啟瀏覽器: http://localhost:8000/og-image-generator.html');
  console.log('3. 為每個講者生成並下載 OG 圖片');
  console.log('4. 將圖片重新命名為 og-image.png，並放入對應的 speakers/講者id/ 資料夾');
  console.log('\n🌐 講者頁面 URL 格式:');
  console.log('   https://gdgkh.cc/share/speakers/講者id/');
}

// 執行腳本
main();
