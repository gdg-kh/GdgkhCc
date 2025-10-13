#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// 檔案路徑
const SPONSORS_JSON = path.join(__dirname, 'data', 'sponsors.json');
const OUTPUT_DIR = path.join(__dirname, 'sponsors');

// OG 圖片尺寸
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * 讀取贊助商資料
 */
function loadSponsors() {
  try {
    const data = fs.readFileSync(SPONSORS_JSON, 'utf-8');
    const json = JSON.parse(data);
    return json.sponsors;
  } catch (error) {
    console.error('❌ 無法讀取贊助商資料:', error.message);
    process.exit(1);
  }
}

/**
 * 載入圖片（支援錯誤處理）
 */
async function loadImageSafe(imagePath) {
  try {
    return await loadImage(imagePath);
  } catch (error) {
    console.warn(`⚠ 無法載入圖片: ${imagePath}`, error.message);
    return null;
  }
}

/**
 * 繪製圓角矩形
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 自動換行文字（支援中英文）
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const chars = text.split('');
  let line = '';
  let lineCount = 0;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, y);
      line = chars[i];
      y += lineHeight;
      lineCount++;

      if (lineCount >= maxLines - 1 && i < chars.length - 1) {
        // 最後一行加省略號
        const remaining = chars.slice(i).join('');
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

/**
 * 產生贊助商 OG 圖片
 */
async function generateSponsorOgImage(sponsor) {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext('2d');

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
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('DevFest 2025', 40, 75);

  // 贊助商 Logo 區域（左側，白色圓角矩形背景）
  const logoSize = 300;
  const logoX = 150;
  const logoY = 165;

  // 繪製白色背景
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 20);
  ctx.fill();

  // 載入並繪製贊助商 Logo
  try {
    const logoPath = path.join(__dirname, sponsor.logo);
    const logoImg = await loadImageSafe(logoPath);

    if (logoImg) {
      // 計算縮放以適應正方形區域（保持比例）
      const padding = 40;
      const maxLogoSize = logoSize - padding * 2;
      const scale = Math.min(maxLogoSize / logoImg.width, maxLogoSize / logoImg.height);
      const scaledWidth = logoImg.width * scale;
      const scaledHeight = logoImg.height * scale;

      // 置中繪製
      const imgX = logoX + (logoSize - scaledWidth) / 2;
      const imgY = logoY + (logoSize - scaledHeight) / 2;
      ctx.drawImage(logoImg, imgX, imgY, scaledWidth, scaledHeight);
    } else {
      // 預設佔位符
      ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
      drawRoundedRect(ctx, logoX + 50, logoY + 50, logoSize - 100, logoSize - 100, 10);
      ctx.fill();
    }
  } catch (error) {
    console.warn('⚠ 無法載入贊助商 Logo，使用預設樣式', error);
  }

  // 贊助商資訊區域（右側）
  const infoX = 550;
  let currentY = 200;

  // 贊助商名稱
  const nameZh = sponsor.name.zh || sponsor.name.en;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  currentY = wrapText(ctx, nameZh, infoX, currentY, 600, 70, 2);
  currentY += 20;

  // 贊助類別標籤
  if (sponsor.category && sponsor.category.zh) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(sponsor.category.zh, infoX, currentY);
    currentY += 60;
  }

  // 分隔線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(infoX, currentY);
  ctx.lineTo(infoX + 600, currentY);
  ctx.stroke();
  currentY += 40;

  // 贊助商描述
  if (sponsor.description && sponsor.description.zh) {
    const descriptionZh = sponsor.description.zh.replace(/<br>/g, ' ');
    ctx.font = '28px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    currentY = wrapText(ctx, descriptionZh, infoX, currentY, 600, 40, 4);
  }

  // 底部資訊條
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = '28px sans-serif';
  ctx.fillText('🗓 2025年1月11日-12日', 40, canvas.height - 35);
  ctx.fillText('📍 高雄', 450, canvas.height - 35);
  ctx.fillText('🌐 devfest2025.gdgkaohsiung.org', 650, canvas.height - 35);

  return canvas;
}

/**
 * 儲存 OG 圖片
 */
async function saveSponsorOgImage(sponsor) {
  const sponsorId = sponsor.id;
  const sponsorDir = path.join(OUTPUT_DIR, sponsorId);

  // 確保資料夾存在
  if (!fs.existsSync(sponsorDir)) {
    fs.mkdirSync(sponsorDir, { recursive: true });
  }

  try {
    // 產生圖片
    const canvas = await generateSponsorOgImage(sponsor);

    // 儲存為 PNG
    const outputPath = path.join(sponsorDir, 'og-image.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`✓ 產生 OG 圖片: sponsors/${sponsorId}/og-image.png (${Math.round(buffer.length / 1024)}KB)`);
  } catch (error) {
    console.error(`❌ 產生 ${sponsorId} OG 圖片失敗:`, error.message);
  }
}

/**
 * 主函式
 */
async function main() {
  console.log('🚀 開始產生贊助商 OG 圖片...\n');

  // 讀取資料
  const sponsors = loadSponsors();
  console.log(`📊 找到 ${sponsors.length} 個贊助商\n`);

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 產生所有贊助商 OG 圖片
  let successCount = 0;
  for (const sponsor of sponsors) {
    try {
      await saveSponsorOgImage(sponsor);
      successCount++;
    } catch (error) {
      console.error(`❌ 處理 ${sponsor.id} 時發生錯誤:`, error.message);
    }
  }

  console.log(`\n✅ 完成！成功產生 ${successCount}/${sponsors.length} 個贊助商 OG 圖片`);
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
}

// 執行
main().catch((error) => {
  console.error('❌ 執行失敗:', error);
  process.exit(1);
});
