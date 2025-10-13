#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 檔案路徑
const MARKETS_JSON = path.join(__dirname, 'data', 'markets.json');
const TEMPLATE_FILE = path.join(__dirname, 'market-template.html');
const OUTPUT_DIR = path.join(__dirname, 'markets');

/**
 * 讀取市集攤位資料
 */
function loadMarkets() {
  try {
    const data = fs.readFileSync(MARKETS_JSON, 'utf-8');
    const json = JSON.parse(data);
    return json.booths;
  } catch (error) {
    console.error('❌ 無法讀取市集攤位資料:', error.message);
    process.exit(1);
  }
}

/**
 * 讀取模板檔案
 */
function loadTemplate() {
  try {
    return fs.readFileSync(TEMPLATE_FILE, 'utf-8');
  } catch (error) {
    console.error('❌ 無法讀取模板檔案:', error.message);
    process.exit(1);
  }
}

/**
 * 產生單一市集攤位頁面
 */
function generateMarketPage(booth, template) {
  const boothId = booth.id;
  const boothDir = path.join(OUTPUT_DIR, boothId);

  // 建立市集攤位資料夾
  if (!fs.existsSync(boothDir)) {
    fs.mkdirSync(boothDir, { recursive: true });
    console.log(`📁 建立資料夾: ${boothDir}`);
  }

  // 複製模板到市集攤位資料夾
  const htmlPath = path.join(boothDir, 'index.html');
  fs.writeFileSync(htmlPath, template, 'utf-8');
  console.log(`✓ 產生頁面: markets/${boothId}/index.html`);

  // 提示需要手動添加 og-image.png
  const ogImagePath = path.join(boothDir, 'og-image.png');
  if (!fs.existsSync(ogImagePath)) {
    console.log(`  ⚠ 請手動添加: markets/${boothId}/og-image.png`);
  }
}

/**
 * 主函式
 */
function main() {
  console.log('🚀 開始產生市集攤位頁面...\n');

  // 讀取資料
  const booths = loadMarkets();
  const template = loadTemplate();

  console.log(`📊 找到 ${booths.length} 個市集攤位\n`);

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 產生所有市集攤位頁面
  let successCount = 0;
  booths.forEach((booth) => {
    try {
      generateMarketPage(booth, template);
      successCount++;
    } catch (error) {
      console.error(`❌ 產生 ${booth.id} 頁面失敗:`, error.message);
    }
  });

  console.log(`\n✅ 完成！成功產生 ${successCount}/${booths.length} 個市集攤位頁面`);
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
}

// 執行
main();
