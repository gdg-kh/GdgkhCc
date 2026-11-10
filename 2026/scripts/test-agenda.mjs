import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE = path.join(__dirname, '..');

let total = 0;
let passed = 0;

function test(name, fn) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.warn(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

console.warn('\n=== 1. 2026 議程時間表（Agenda）時程與分場結構驗證 ===');

const content = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'content.json'), 'utf8'));
const sessions = content.sessions || [];

test('Pizza Time 必須設定於 11:50 ~ 12:30 且 trackId 為 all', () => {
  const pizza = sessions.find((s) => s.id === 'pizza_time');
  assert.ok(pizza, '必須存在 id 為 pizza_time 的議程');
  assert.equal(pizza.trackId, 'all', 'pizza_time 的 trackId 應為 all');
  assert.equal(pizza.start, '2026-11-14T11:50', 'pizza_time 開始時間應為 11:50');
  assert.equal(pizza.end, '2026-11-14T12:30', 'pizza_time 結束時間應為 12:30');
  assert.equal(pizza.type, 'break', 'pizza_time 類型應為 break');
});

test('第一會場 14:20 ~ 14:50 必須存在議程 (session_5_3)', () => {
  const ses = sessions.find((s) => s.id === 'session_5_3');
  assert.ok(ses, '必須存在 id 為 session_5_3 的議程');
  assert.equal(ses.trackId, 'track_1', 'session_5_3 應位於第一會場 (track_1)');
  assert.equal(ses.start, '2026-11-14T14:20', '開始時間應為 14:20');
  assert.equal(ses.end, '2026-11-14T14:50', '結束時間應為 14:50');
  assert.equal(ses.type, 'talk', '類型應為 talk');
  assert.deepEqual(ses.speakerIds, ['sylph_lin'], '講者應包含 sylph_lin');
  assert.equal(ses.title && ses.title['zh-Hant'], '代理影片生成的新時代', '必須提供繁中標題');
});

test('各會場所有議程時間不得有重疊衝突', () => {
  function toMinutes(iso) {
    const [h, m] = iso.slice(11, 16).split(':').map(Number);
    return h * 60 + m;
  }

  const byTrack = {};
  for (const s of sessions) {
    if (s.trackId === 'all') continue;
    (byTrack[s.trackId] ||= []).push(s);
  }

  for (const [track, list] of Object.entries(byTrack)) {
    const sorted = [...list].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        toMinutes(sorted[i].start) >= toMinutes(sorted[i - 1].end),
        `會場 ${track}: ${sorted[i - 1].id} 與 ${sorted[i].id} 時間重疊`
      );
    }
  }

  const allList = sessions.filter((s) => s.trackId === 'all');
  for (const allSes of allList) {
    const aS = toMinutes(allSes.start);
    const aE = toMinutes(allSes.end);
    for (const [track, list] of Object.entries(byTrack)) {
      for (const s of list) {
        const sS = toMinutes(s.start);
        const sE = toMinutes(s.end);
        const overlap = Math.max(aS, sS) < Math.min(aE, sE);
        assert.ok(!overlap, `全館議程 ${allSes.id} 與會場 ${track} 議程 ${s.id} 時間衝突`);
      }
    }
  }
});

test('時間軸陣列在包含 11:50 與 14:20 後，行數與 intermediate 計算精準', () => {
  function parseTimeMinutes(iso) {
    const [h, m] = iso.slice(11, 16).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const timePoints = Array.from(new Set(sessions.map((s) => s.start))).sort();
  assert.ok(timePoints.includes('2026-11-14T11:50'), '時間點應包含 11:50');
  assert.ok(timePoints.includes('2026-11-14T14:20'), '時間點應包含 14:20');

  // 11:00 session_2_1 (11:00~11:40) 跨過 11:30，rowSpan 應為 2
  const ses21 = sessions.find((s) => s.id === 'session_2_1');
  const ses21Start = parseTimeMinutes(ses21.start);
  const ses21End = parseTimeMinutes(ses21.end);
  const ses21Inter = timePoints.filter((tp) => {
    const m = parseTimeMinutes(tp);
    return m > ses21Start && m < ses21End;
  });
  assert.equal(ses21Inter.length, 1, 'session_2_1 期間僅跨過 11:30');

  // 13:00 workshop_4_1 (13:00~14:10) 跨過 13:30，rowSpan 應為 2
  const ws41 = sessions.find((s) => s.id === 'workshop_4_1');
  const ws41Start = parseTimeMinutes(ws41.start);
  const ws41End = parseTimeMinutes(ws41.end);
  const ws41Inter = timePoints.filter((tp) => {
    const m = parseTimeMinutes(tp);
    return m > ws41Start && m < ws41End;
  });
  assert.equal(ws41Inter.length, 1, 'workshop_4_1 期間僅跨過 13:30');

  // 14:20 session_5_3 (14:20~14:50) 無中間時間點，rowSpan 應為 1
  const ses53 = sessions.find((s) => s.id === 'session_5_3');
  const ses53Start = parseTimeMinutes(ses53.start);
  const ses53End = parseTimeMinutes(ses53.end);
  const ses53Inter = timePoints.filter((tp) => {
    const m = parseTimeMinutes(tp);
    return m > ses53Start && m < ses53End;
  });
  assert.equal(ses53Inter.length, 0, 'session_5_3 rowSpan 應為 1');
});

console.warn(`✔ 議程時間表時程驗證全數通過！總共 ${passed}/${total} 項測試通過。\n`);
