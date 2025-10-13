#!/usr/bin/env node

/**
 * 批次 OG 圖片生成器
 * 使用 node-canvas 為每位講者自動生成 Open Graph 圖片
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// 讀取講者資料
const speakersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'speakers.json'), 'utf-8'));

// Canvas 尺寸（Open Graph 標準）
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;

/**
 * 繪製圓形圖片
 */
function drawCircularImage(ctx, img, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // 計算圖片裁切以填滿圓形
  const scale = Math.max((radius * 2) / img.width, (radius * 2) / img.height);
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;
  const offsetX = x - scaledWidth / 2;
  const offsetY = y - scaledHeight / 2;

  ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.restore();
}

/**
 * 自動換行文字
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const characters = text.split('');
  let line = '';
  let lineCount = 0;

  for (let i = 0; i < characters.length; i++) {
    const testLine = line + characters[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, y);
      line = characters[i];
      y += lineHeight;
      lineCount++;

      if (lineCount >= maxLines - 1 && i < characters.length - 1) {
        // 最後一行加上省略號
        const remaining = characters.slice(i).join('');
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
 * 生成單個講者的 OG 圖片
 */
async function generateOgImage(speaker) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
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

  // 講者照片（圓形，左側）
  try {
    const photoPath = speaker.photo
      ? path.join(__dirname, speaker.photo)
      : path.join(__dirname, 'images', 'default-speaker.png');

    if (fs.existsSync(photoPath)) {
      const photoImg = await loadImage(photoPath);
      drawCircularImage(ctx, photoImg, 250, 315, 150);

      // 照片邊框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(250, 315, 150, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 預設圓形佔位符
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(250, 315, 150, 0, Math.PI * 2);
      ctx.fill();

      // 邊框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(250, 315, 150, 0, Math.PI * 2);
      ctx.stroke();
    }
  } catch (error) {
    console.warn(`  ⚠ 無法載入講者照片: ${speaker.photo}`, error.message);
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
  ctx.font = 'bold 64px sans-serif';
  const speakerName = speaker.name.zh || speaker.name.en;
  ctx.fillText(speakerName, infoX, currentY);
  currentY += 80;

  // 組織
  if (speaker.org.zh || speaker.org.en) {
    ctx.font = '32px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const orgName = speaker.org.zh || speaker.org.en;
    ctx.fillText(orgName, infoX, currentY);
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
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffd54f';
    const sessionName = speaker.session.name.zh || speaker.session.name.en;
    currentY = wrapText(ctx, sessionName, infoX, currentY, 650, 50);
  }

  // 底部資訊條
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = '28px sans-serif';
  ctx.fillText('📅 2025年1月11日-12日', 40, canvas.height - 35);
  ctx.fillText('📍 高雄', 450, canvas.height - 35);
  ctx.fillText('🌐 devfest2025.gdgkaohsiung.org', 650, canvas.height - 35);

  return canvas;
}

/**
 * 主執行函式
 */
async function main() {
  console.log('🎨 開始批次生成 OG 圖片...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const speaker of speakersData.speakers) {
    const speakerId = speaker.id;
    const speakerDir = path.join(__dirname, 'speakers', speakerId);
    const outputPath = path.join(speakerDir, 'og-image.png');

    try {
      // 確保資料夾存在
      if (!fs.existsSync(speakerDir)) {
        console.log(`  ⚠ 資料夾不存在，跳過: ${speakerId}`);
        errorCount++;
        continue;
      }

      console.log(`📸 生成中: ${speaker.name.zh || speaker.name.en}...`);

      // 生成 Canvas
      const canvas = await generateOgImage(speaker);

      // 儲存為 PNG
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);

      console.log(`  ✓ 已儲存: speakers/${speakerId}/og-image.png`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ 生成失敗: ${speakerId}`, error.message);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 完成！成功: ${successCount} 個，失敗: ${errorCount} 個`);
  console.log('='.repeat(60));

  if (successCount > 0) {
    console.log('\n📋 下一步：');
    console.log('1. 檢查生成的圖片: speakers/講者id/og-image.png');
    console.log('2. 測試講者頁面: http://localhost:8000/speakers/講者id/');
    console.log('3. 使用社交媒體測試工具驗證 OG 圖片是否正確顯示');
  }

  if (errorCount > 0) {
    console.log('\n⚠ 部分圖片生成失敗，請檢查錯誤訊息。');
  }
}

// 執行腳本
main().catch((error) => {
  console.error('❌ 執行失敗:', error);
  process.exit(1);
});
