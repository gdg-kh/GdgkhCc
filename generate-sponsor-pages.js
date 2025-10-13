#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 檔案路徑
const SPONSORS_JSON = path.join(__dirname, 'data', 'sponsors.json');
const TEMPLATE_FILE = path.join(__dirname, 'sponsor-template.html');
const OUTPUT_DIR = path.join(__dirname, 'sponsors');

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
 * 產生單一贊助商頁面
 */
function generateSponsorPage(sponsor, template) {
  const sponsorId = sponsor.id;
  const sponsorDir = path.join(OUTPUT_DIR, sponsorId);

  // 建立贊助商資料夾
  if (!fs.existsSync(sponsorDir)) {
    fs.mkdirSync(sponsorDir, { recursive: true });
    console.log(`📁 建立資料夾: ${sponsorDir}`);
  }

  // 複製模板到贊助商資料夾
  const htmlPath = path.join(sponsorDir, 'index.html');
  fs.writeFileSync(htmlPath, template, 'utf-8');
  console.log(`✓ 產生頁面: sponsors/${sponsorId}/index.html`);

  // 建立 og-image.png 的佔位檔案（如果不存在）
  const ogImagePath = path.join(sponsorDir, 'og-image.png');
  if (!fs.existsSync(ogImagePath)) {
    // 不建立實際檔案，只是提示需要手動添加
    console.log(`  ⚠ 請手動添加: sponsors/${sponsorId}/og-image.png`);
  }
}

/**
 * 主函式
 */
function main() {
  console.log('🚀 開始產生贊助商頁面...\n');

  // 讀取資料
  const sponsors = loadSponsors();
  const template = loadTemplate();

  console.log(`📊 找到 ${sponsors.length} 個贊助商\n`);

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 產生所有贊助商頁面
  let successCount = 0;
  sponsors.forEach((sponsor) => {
    try {
      generateSponsorPage(sponsor, template);
      successCount++;
    } catch (error) {
      console.error(`❌ 產生 ${sponsor.id} 頁面失敗:`, error.message);
    }
  });

  console.log(`\n✅ 完成！成功產生 ${successCount}/${sponsors.length} 個贊助商頁面`);
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
}

// 執行
main();
