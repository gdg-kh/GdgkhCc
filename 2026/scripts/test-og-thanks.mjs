import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveThanksBadgeLabel, renderOgImage } from './render-og.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_2026 = path.resolve(__dirname, '..');
const CONTENT_PATH = path.join(ROOT_2026, 'data', 'content.json');

const contentRaw = await fs.readFile(CONTENT_PATH, 'utf8');
const content = JSON.parse(contentRaw);

let passed = 0;
let total = 0;

async function test(name, fn) {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.warn(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

console.warn('\n=== 1. thanksGroups 動態標籤解析測試 (resolveThanksBadgeLabel) ===');

await test('[貓缶簿 nyakei] (groupId: company) 應解析為「贊助夥伴」', async () => {
  const nyakeiItem = content.thanks.find((t) => t.id === 'nyakei');
  assert.ok(nyakeiItem, 'nyakei 應存在於 content.thanks');
  assert.equal(nyakeiItem.groupId, 'company');

  // 1. 傳入 content
  const labelWithContent = await resolveThanksBadgeLabel(nyakeiItem, content);
  assert.equal(labelWithContent, '贊助夥伴');

  // 2. 未傳入 content（自動動態讀取 content.json）
  const labelWithoutContent = await resolveThanksBadgeLabel(nyakeiItem);
  assert.equal(labelWithoutContent, '贊助夥伴');
});

await test('[JetBrains] (groupId: company) 應解析為「贊助夥伴」', async () => {
  const jbItem = content.thanks.find((t) => t.id === 'jetbrains');
  assert.ok(jbItem, 'jetbrains 應存在於 content.thanks');
  assert.equal(jbItem.groupId, 'company');

  const label = await resolveThanksBadgeLabel(jbItem, content);
  assert.equal(label, '贊助夥伴');
});

await test('[Google for Developers] (groupId: partner) 應解析為「合作夥伴」', async () => {
  const gItem = content.thanks.find((t) => t.id === 'googel_for_developers');
  assert.ok(gItem, 'googel_for_developers 應存在於 content.thanks');
  assert.equal(gItem.groupId, 'partner');

  const label = await resolveThanksBadgeLabel(gItem, content);
  assert.equal(label, '合作夥伴');
});

await test('自訂群組 (groupId: personal) 應解析為「個人贊助」', async () => {
  const personalItem = { id: 'test_user', groupId: 'personal', name: { 'zh-Hant': '測試者' } };
  const label = await resolveThanksBadgeLabel(personalItem, content);
  assert.equal(label, '個人贊助');
});

await test('當 layout.badgeLabel 存在時，應優先採用 layout.badgeLabel', async () => {
  const nyakeiItem = { id: 'nyakei', groupId: 'company', name: { 'zh-Hant': '貓缶簿' } };
  const label = await resolveThanksBadgeLabel(nyakeiItem, content, { badgeLabel: '特別贊助' });
  assert.equal(label, '特別贊助');
});

await test('自訂 content 資料傳入時，應動態依照傳入的 thanksGroups 解析', async () => {
  const customContent = {
    thanksGroups: [
      { id: 'diamond', name: { 'zh-Hant': '鑽石贊助' } },
      { id: 'silver', name: '白銀贊助' },
    ],
  };
  const diamondItem = { id: 'sponsor_a', groupId: 'diamond' };
  const silverItem = { id: 'sponsor_b', groupId: 'silver' };

  assert.equal(await resolveThanksBadgeLabel(diamondItem, customContent), '鑽石贊助');
  assert.equal(await resolveThanksBadgeLabel(silverItem, customContent), '白銀贊助');
});

await test('支援同步呼叫 resolveThanksBadgeLabel（無需 await）', async () => {
  const nyakeiItem = content.thanks.find((t) => t.id === 'nyakei');
  const syncLabel = resolveThanksBadgeLabel(nyakeiItem, content);
  assert.equal(typeof syncLabel, 'string');
  assert.equal(syncLabel, '贊助夥伴');
});

await test('當 thanksGroups 項目僅有英文名稱時，應透過 pickLang 降級解析', async () => {
  const enOnlyContent = {
    thanksGroups: [{ id: 'intl_sponsor', name: { en: 'Global Partner' } }],
  };
  const item = { id: 'intl_item', groupId: 'intl_sponsor' };
  const label = resolveThanksBadgeLabel(item, enOnlyContent);
  assert.equal(label, 'Global Partner');
});

await test('所有現有 content.thanks 項目皆能正確動態解析所屬分類標籤', async () => {
  const expectedLabels = {
    googel_for_developers: '合作夥伴',
    edbkcg: '合作夥伴',
    legend_innovation: '合作夥伴',
    ko_in: '合作夥伴',
    developer_buffet: '合作夥伴',
    jetbrains: '贊助夥伴',
    nyakei: '贊助夥伴',
  };
  for (const item of content.thanks) {
    const label = resolveThanksBadgeLabel(item, content);
    assert.equal(label, expectedLabels[item.id], `${item.id} 應解析為「${expectedLabels[item.id]}」`);
  }
});

console.warn('\n=== 2. 邊界與異常情況測試 (Edge Cases) ===');

await test('未知的 groupId 應安全 fallback 為「合作夥伴」', async () => {
  const unknownItem = { id: 'unknown', groupId: 'non_existent_group' };
  const label = await resolveThanksBadgeLabel(unknownItem, content);
  assert.equal(label, '合作夥伴');
});

await test('未提供 groupId 時應安全 fallback 為「合作夥伴」', async () => {
  const noGroupItem = { id: 'no_group' };
  const label = await resolveThanksBadgeLabel(noGroupItem, content);
  assert.equal(label, '合作夥伴');
});

await test('傳入 null 或空物件時應安全 fallback 為「合作夥伴」', async () => {
  assert.equal(await resolveThanksBadgeLabel(null, content), '合作夥伴');
  assert.equal(await resolveThanksBadgeLabel({}, content), '合作夥伴');
  assert.equal(await resolveThanksBadgeLabel(null, null), '合作夥伴');
});

await test('content 缺少 thanksGroups 陣列時應安全 fallback 為「合作夥伴」', async () => {
  const item = { id: 'test', groupId: 'company' };
  assert.equal(await resolveThanksBadgeLabel(item, {}), '合作夥伴');
  assert.equal(await resolveThanksBadgeLabel(item, { thanksGroups: null }), '合作夥伴');
});

console.warn('\n=== 3. 實際產生 OG 圖檔測試 (renderOgImage) ===');

await test('為貓缶簿產生 OG 圖，確認繪圖與存檔正常運作', async () => {
  const nyakeiItem = content.thanks.find((t) => t.id === 'nyakei');
  const tempOut = path.join(ROOT_2026, 'images', 'og', 'thanks', 'nyakei.png');

  await renderOgImage({
    type: 'thanks',
    item: nyakeiItem,
    content,
    layout: {
      imagePath: path.join(ROOT_2026, 'images', 'thanks', 'nyakei.png'),
    },
    outPath: tempOut,
  });

  const stat = await fs.stat(tempOut);
  assert.ok(stat.size > 1000, '輸出的圖片檔案大小應大於 1KB');
});

console.warn(`\n✔ 測試全數通過！總共 ${passed}/${total} 項測試通過。\n`);
