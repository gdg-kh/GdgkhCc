#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// 檔案路徑
const THANKS_JSON = path.join(__dirname, 'data', 'thanks.json');
const OUTPUT_DIR = path.join(__dirname, 'share', 'thanks');

// OG 圖片尺寸
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * 讀取感謝名單資料
 */
function loadThanks() {
  try {
    const data = fs.readFileSync(THANKS_JSON, 'utf-8');
    const json = JSON.parse(data);
    return json.thanks;
  } catch (error) {
    console.error('❌ 無法讀取感謝名單資料:', error.message);
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
 * 產生感謝名單 OG 圖片
 */
async function generateThanksOgImage(thanks) {
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

  // 感謝名單 Logo 區域（左側，白色圓角矩形背景）
  const logoSize = 300;
  const logoX = 150;
  const logoY = 165;

  // 繪製白色背景
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 20);
  ctx.fill();

  // 載入並繪製感謝名單 Logo
  try {
    const logoPath = path.join(__dirname, thanks.logo);
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
    console.warn('⚠ 無法載入感謝名單 Logo，使用預設樣式', error);
  }

  // 感謝名單資訊區域（右側）
  const infoX = 550;
  let currentY = 200;

  // 感謝名單名稱
  const nameZh = thanks.name.zh || thanks.name.en;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  currentY = wrapText(ctx, nameZh, infoX, currentY, 600, 70, 2);
  currentY += 20;

  // 感謝類別標籤
  if (thanks.category && thanks.category.zh) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(thanks.category.zh, infoX, currentY);
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

  // 感謝名單描述
  if (thanks.description && thanks.description.zh) {
    const descriptionZh = thanks.description.zh.replace(/<br>/g, ' ');
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
async function saveThanksOgImage(thanks) {
  const thanksId = thanks.id;
  const thanksDir = path.join(OUTPUT_DIR, thanksId);

  // 確保資料夾存在
  if (!fs.existsSync(thanksDir)) {
    fs.mkdirSync(thanksDir, { recursive: true });
  }

  try {
    // 產生圖片
    const canvas = await generateThanksOgImage(thanks);

    // 儲存為 PNG
    const outputPath = path.join(thanksDir, 'og-image.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`✓ 產生 OG 圖片: thanks/${thanksId}/og-image.png (${Math.round(buffer.length / 1024)}KB)`);
  } catch (error) {
    console.error(`❌ 產生 ${thanksId} OG 圖片失敗:`, error.message);
  }
}

/**
 * 主函式
 */
async function main() {
  console.log('🚀 開始產生感謝名單 OG 圖片...\n');

  // 讀取資料
  const thanks = loadThanks();
  console.log(`📊 找到 ${thanks.length} 個感謝名單\n`);

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 產生所有感謝名單 OG 圖片
  let successCount = 0;
  for (const item of thanks) {
    try {
      await saveThanksOgImage(item);
      successCount++;
    } catch (error) {
      console.error(`❌ 處理 ${item.id} 時發生錯誤:`, error.message);
    }
  }

  console.log(`\n✅ 完成！成功產生 ${successCount}/${thanks.length} 個感謝名單 OG 圖片`);
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
}

// 執行
main().catch((error) => {
  console.error('❌ 執行失敗:', error);
  process.exit(1);
});
