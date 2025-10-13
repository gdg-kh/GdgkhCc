#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 檔案路徑
const ABOUT_JSON = path.join(__dirname, 'data', 'about.json');
const TEMPLATE_FILE = path.join(__dirname, 'about-template.html');
const OUTPUT_DIR = path.join(__dirname, 'about');

/**
 * 讀取關於我們資料
 */
function loadAbout() {
  try {
    const data = fs.readFileSync(ABOUT_JSON, 'utf-8');
    const json = JSON.parse(data);
    return json.about;
  } catch (error) {
    console.error('❌ 無法讀取關於我們資料:', error.message);
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
 * 產生單一組織頁面
 */
function generateAboutPage(about, template) {
  const aboutId = about.id;
  const aboutDir = path.join(OUTPUT_DIR, aboutId);

  // 建立組織資料夾
  if (!fs.existsSync(aboutDir)) {
    fs.mkdirSync(aboutDir, { recursive: true });
    console.log(`📁 建立資料夾: ${aboutDir}`);
  }

  // 複製模板到組織資料夾
  const htmlPath = path.join(aboutDir, 'index.html');
  fs.writeFileSync(htmlPath, template, 'utf-8');
  console.log(`✓ 產生頁面: about/${aboutId}/index.html`);

  // 提示需要手動添加 og-image.png
  const ogImagePath = path.join(aboutDir, 'og-image.png');
  if (!fs.existsSync(ogImagePath)) {
    console.log(`  ⚠ 請手動添加: about/${aboutId}/og-image.png`);
  }
}

/**
 * 主函式
 */
function main() {
  console.log('🚀 開始產生關於我們頁面...\n');

  // 讀取資料
  const about = loadAbout();
  const template = loadTemplate();

  console.log(`📊 找到 ${about.length} 個組織\n`);

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 產生所有組織頁面
  let successCount = 0;
  about.forEach((org) => {
    try {
      generateAboutPage(org, template);
      successCount++;
    } catch (error) {
      console.error(`❌ 產生 ${org.id} 頁面失敗:`, error.message);
    }
  });

  console.log(`\n✅ 完成！成功產生 ${successCount}/${about.length} 個組織頁面`);
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
}

// 執行
main();
