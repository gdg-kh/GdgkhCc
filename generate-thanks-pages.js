#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 檔案路徑
const THANKS_JSON = path.join(__dirname, 'data', 'thanks.json');
const TEMPLATE_FILE = path.join(__dirname, 'thanks-template.html');
const OUTPUT_DIR = path.join(__dirname, 'share', 'thanks');

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
 * 產生單一感謝名單頁面
 */
function generateThanksPage(thanks, template) {
  const thanksId = thanks.id;
  const thanksDir = path.join(OUTPUT_DIR, thanksId);

  // 建立感謝名單資料夾
  if (!fs.existsSync(thanksDir)) {
    fs.mkdirSync(thanksDir, { recursive: true });
    console.log(`📁 建立資料夾: ${thanksDir}`);
  }

  // 準備 meta tags 資料
  const baseUrl = 'https://gdgkh.cc';
  const thanksUrl = `${baseUrl}/share/thanks/${thanksId}/`;
  const ogImageUrl = `${baseUrl}/share/thanks/${thanksId}/og-image.png`;

  const nameZh = thanks.name.zh || thanks.name.en;
  const descriptionZh = (thanks.description.zh || thanks.description.en)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .substring(0, 200)
    .trim();

  const title = `${nameZh} - DevFest Kaohsiung X S. TW Communities Gathering 2025`;
  const ogTitle = `${nameZh} - DevFest 高雄場 X 南臺灣技術社群大聚 2025`;
  const description =
    '今年 GDG Kaohsiung 和開發者 Buffet 一起在高雄舉辦軟體社群年會 - 一起探索 Google Cloud、Gemini AI、Android 開發及科技向善的最新趨勢,並且與眾多技術社群一同交流學習。';
  const keywords = `DevFest, Kaohsiung, ${nameZh}, Thanks, Google Developer`;

  // 替換模板中的 meta tags
  let html = template;

  // 替換 title
  html = html.replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${escapeHtml(title)}</title>`);

  // 替換 Open Graph meta tags
  html = html.replace(
    /<meta property="og:url" content="" id="ogUrl" \/>/,
    `<meta property="og:url" content="${escapeHtml(thanksUrl)}" id="ogUrl" />`
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
    `<meta property="twitter:url" content="${escapeHtml(thanksUrl)}" id="twitterUrl" />`
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
    `<link rel="canonical" href="${escapeHtml(thanksUrl)}" id="canonicalUrl" />`
  );

  // 寫入檔案
  const htmlPath = path.join(thanksDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`✓ 產生頁面: share/thanks/${thanksId}/index.html`);

  // 建立 og-image.png 的佔位檔案(如果不存在)
  const ogImagePath = path.join(thanksDir, 'og-image.png');
  if (!fs.existsSync(ogImagePath)) {
    // 不建立實際檔案,只是提示需要手動添加
    console.log(`  ⚠ 請手動添加: share/thanks/${thanksId}/og-image.png`);
  }
}

/**
 * 主函式
 */
function main() {
  console.log('🚀 開始產生感謝名單頁面...\n');

  // 讀取資料
  const thanks = loadThanks();
  const template = loadTemplate();

  console.log(`📊 找到 ${thanks.length} 個感謝名單\n`);

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 產生所有感謝名單頁面
  let successCount = 0;
  thanks.forEach((item) => {
    try {
      generateThanksPage(item, template);
      successCount++;
    } catch (error) {
      console.error(`❌ 產生 ${item.id} 頁面失敗:`, error.message);
    }
  });

  console.log(`\n✅ 完成！成功產生 ${successCount}/${thanks.length} 個感謝名單頁面`);
  console.log(`📁 輸出目錄: ${OUTPUT_DIR}`);
}

// 執行
main();
