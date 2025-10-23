#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 檔案路徑
const ABOUT_JSON = path.join(__dirname, 'data', 'about.json');
const TEMPLATE_FILE = path.join(__dirname, 'about-template.html');
const OUTPUT_DIR = path.join(__dirname, 'share', 'about');

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

  // 準備 meta tags 資料
  const baseUrl = 'https://gdgkh.cc';
  const aboutUrl = `${baseUrl}/share/about/${aboutId}/`;
  const ogImageUrl = `${baseUrl}/share/about/${aboutId}/og-image.png`;

  const nameZh = about.name.zh || about.name.en;
  const descriptionZh = (about.description.zh || about.description.en)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .substring(0, 200)
    .trim();

  const title = `${nameZh} - DevFest Kaohsiung X S. TW Communities Gathering 2025`;
  const ogTitle = `${nameZh} - DevFest 高雄場 X 南臺灣技術社群大聚 2025`;
  const description =
    '今年 GDG Kaohsiung 和開發者 Buffet 一起在高雄舉辦軟體社群年會 - 一起探索 Google Cloud、Gemini AI、Android 開發及科技向善的最新趨勢,並且與眾多技術社群一同交流學習。';
  const keywords = `DevFest, Kaohsiung, ${nameZh}, About, Google Developer`;

  // 替換模板中的 meta tags
  let html = template;

  // 替換 title
  html = html.replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${escapeHtml(title)}</title>`);

  // 替換 Open Graph meta tags
  html = html.replace(
    /<meta property="og:url" content="" id="ogUrl" \/>/,
    `<meta property="og:url" content="${escapeHtml(aboutUrl)}" id="ogUrl" />`
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
    `<meta property="twitter:url" content="${escapeHtml(aboutUrl)}" id="twitterUrl" />`
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
    `<link rel="canonical" href="${escapeHtml(aboutUrl)}" id="canonicalUrl" />`
  );

  // 寫入檔案
  const htmlPath = path.join(aboutDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`✓ 產生頁面: share/about/${aboutId}/index.html`);

  // 提示需要手動添加 og-image.png
  const ogImagePath = path.join(aboutDir, 'og-image.png');
  if (!fs.existsSync(ogImagePath)) {
    console.log(`  ⚠ 請手動添加: share/about/${aboutId}/og-image.png`);
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
