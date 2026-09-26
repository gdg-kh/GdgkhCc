import assert from 'node:assert/strict';
import {
  isMobileDevice,
  canUseNativeShare,
  copyTextToClipboard,
  fallbackCopyText,
  makeShareButton,
} from '../assets/js/ui/detail-modal.js';

let passed = 0;
let total = 0;

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

async function testAsync(name, fn) {
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

const originalNavigator = globalThis.navigator;
const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalNode = globalThis.Node;

function setMockNavigator(mock) {
  Object.defineProperty(globalThis, 'navigator', {
    value: mock,
    configurable: true,
    writable: true,
  });
}

function restoreAll() {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: originalDocument,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'Node', {
    value: originalNode,
    configurable: true,
    writable: true,
  });
}

// 簡易 DOM 節點 Mock
class MockNode {}

class MockElement extends MockNode {
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attrs = {};
    this.listeners = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this._classes = new Set();
  }

  get className() {
    return Array.from(this._classes).join(' ');
  }

  set className(val) {
    this._classes = new Set(String(val || '').split(/\s+/).filter(Boolean));
  }

  get classList() {
    return {
      add: (...cls) => cls.forEach((c) => this._classes.add(c)),
      remove: (...cls) => cls.forEach((c) => this._classes.delete(c)),
      contains: (c) => this._classes.has(c),
    };
  }

  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }

  getAttribute(k) {
    return this.attrs[k] !== undefined ? this.attrs[k] : null;
  }

  removeAttribute(k) {
    delete this.attrs[k];
  }

  addEventListener(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get textContent() {
    return this.children
      .map((c) => (c instanceof MockTextNode ? c.text : c.textContent))
      .join('');
  }

  async dispatch(event, eventObj = {}) {
    const handlers = this.listeners[event] || [];
    for (const h of handlers) {
      await h({
        stopPropagation: () => {},
        preventDefault: () => {},
        target: this,
        ...eventObj,
      });
    }
  }
}

class MockTextNode extends MockNode {
  constructor(text) {
    super();
    this.text = text;
    this.parentNode = null;
  }
}

function setupMockDom() {
  globalThis.Node = MockNode;
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: (tag) => new MockElement(tag),
      createTextNode: (text) => new MockTextNode(text),
      body: new MockElement('body'),
    },
    configurable: true,
    writable: true,
  });
}

console.warn('\n=== 1. 裝置環境偵測（Device Detection）測試 ===');

test('macOS Safari (MacBook / iMac) 應判定為桌面環境', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  });
  assert.equal(isMobileDevice(), false);
});

test('macOS Chrome 應判定為桌面環境', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    userAgentData: { mobile: false },
  });
  assert.equal(isMobileDevice(), false);
});

test('macOS Firefox 應判定為桌面環境', () => {
  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  });
  assert.equal(isMobileDevice(), false);
});

test('Windows 11 Chrome / Edge 應判定為桌面環境', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    platform: 'Win32',
    maxTouchPoints: 0,
    userAgentData: { mobile: false },
  });
  assert.equal(isMobileDevice(), false);
});

test('Windows 觸控筆電（Surface Pro）應判定為桌面環境，不被誤判為手機', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 10,
    userAgentData: { mobile: false },
  });
  assert.equal(isMobileDevice(), false);
});

test('Linux Ubuntu Chrome / Firefox 應判定為桌面環境', () => {
  setMockNavigator({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    maxTouchPoints: 0,
  });
  assert.equal(isMobileDevice(), false);
});

test('Android 手機 Chrome 應判定為行動裝置', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    userAgentData: { mobile: true },
  });
  assert.equal(isMobileDevice(), true);
});

test('Android 平板 Chrome（無 Mobile 字樣）應判定為行動裝置', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    platform: 'Linux aarch64',
    maxTouchPoints: 5,
  });
  assert.equal(isMobileDevice(), true);
});

test('iPhone Safari 應判定為行動裝置', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
  });
  assert.equal(isMobileDevice(), true);
});

test('iPad 原生/行動版 UA（含 iPad 字樣且無 Mobile）應判定為行動裝置', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    platform: 'iPad',
    maxTouchPoints: 5,
  });
  assert.equal(isMobileDevice(), true);
});

test('iPadOS Safari 桌面版 UA（Macintosh 且 maxTouchPoints > 1）應判定為行動裝置', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  });
  assert.equal(isMobileDevice(), true);
});

test('Android 手機 Firefox（Android; Mobile）應判定為行動裝置', () => {
  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
    platform: 'Linux aarch64',
    maxTouchPoints: 5,
  });
  assert.equal(isMobileDevice(), true);
});

test('Android 平板 Firefox（Android; Tablet）應判定為行動裝置', () => {
  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Android 14; Tablet; rv:126.0) Gecko/126.0 Firefox/126.0',
    platform: 'Linux aarch64',
    maxTouchPoints: 5,
  });
  assert.equal(isMobileDevice(), true);
});

test('ChromeOS 觸控筆電（CrOS 且 maxTouchPoints > 0）應判定為桌面環境', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    maxTouchPoints: 10,
    userAgentData: { mobile: false },
  });
  assert.equal(isMobileDevice(), false);
});

console.warn('\n=== 2. 原生分享可用性（canUseNativeShare）測試 ===');

test('macOS 桌面瀏覽器即便 navigator.share 存在，也不應使用原生分享', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    share: () => Promise.resolve(),
    canShare: () => true,
  });
  const data = { title: 'Test', text: 'Desc', url: 'https://gdgkh.cc/2026/' };
  assert.equal(canUseNativeShare(data), false);
});

test('Windows 桌面 Chrome 即便支援 Web Share API，也不應觸發原生共用視窗', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
    share: () => Promise.resolve(),
    canShare: () => true,
    userAgentData: { mobile: false },
  });
  const data = { title: 'Test', text: 'Desc', url: 'https://gdgkh.cc/2026/' };
  assert.equal(canUseNativeShare(data), false);
});

test('Android 手機支援 navigator.share 時，應啟用原生分享', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    share: () => Promise.resolve(),
    canShare: () => true,
    userAgentData: { mobile: true },
  });
  const data = { title: 'Test', text: 'Desc', url: 'https://gdgkh.cc/2026/' };
  assert.equal(canUseNativeShare(data), true);
});

test('iPhone 支援 navigator.share 時，應啟用原生分享', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
    share: () => Promise.resolve(),
    canShare: () => true,
  });
  const data = { title: 'Test', text: 'Desc', url: 'https://gdgkh.cc/2026/' };
  assert.equal(canUseNativeShare(data), true);
});

test('若 canShare 檢查回傳 false，即使是行動裝置也不應呼叫 share', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    share: () => Promise.resolve(),
    canShare: () => false,
  });
  const data = { title: 'Test', text: 'Desc', url: 'invalid-url' };
  assert.equal(canUseNativeShare(data), false);
});

test('若 canShare 拋出錯誤（TypeError），應安全判定為不使用原生分享（回傳 false）', () => {
  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    share: () => Promise.resolve(),
    canShare: () => {
      throw new TypeError('Invalid URL component');
    },
  });
  const data = { title: 'Test', text: 'Desc', url: 'invalid-url' };
  assert.equal(canUseNativeShare(data), false);
});

console.warn('\n=== 3. 剪貼簿複製機制（copyTextToClipboard / fallbackCopyText）測試 ===');

await testAsync('現代瀏覽器 navigator.clipboard.writeText 成功時應回傳 true', async () => {
  let written = '';
  setMockNavigator({
    clipboard: {
      writeText: async (t) => {
        written = t;
      },
    },
  });
  const res = await copyTextToClipboard('https://gdgkh.cc/2026/share/speakers/andy/');
  assert.equal(res, true);
  assert.equal(written, 'https://gdgkh.cc/2026/share/speakers/andy/');
});

await testAsync('當 navigator.clipboard 拋出錯誤時，應無縫降級至 textarea execCommand', async () => {
  let execCommandCalled = false;
  let appendedElement = null;

  globalThis.Node = MockNode;
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: (tag) => {
        const el = {
          tag,
          value: '',
          style: {},
          setAttribute: () => {},
          focus: () => {},
          select: () => {},
          setSelectionRange: () => {},
        };
        return el;
      },
      body: {
        appendChild: (el) => {
          appendedElement = el;
        },
        removeChild: () => {},
      },
      execCommand: (cmd) => {
        if (cmd === 'copy') {
          execCommandCalled = true;
          return true;
        }
        return false;
      },
    },
    configurable: true,
    writable: true,
  });

  setMockNavigator({
    clipboard: {
      writeText: async () => {
        throw new Error('Permission denied');
      },
    },
  });

  const res = await copyTextToClipboard('https://gdgkh.cc/2026/test');
  assert.equal(res, true);
  assert.equal(execCommandCalled, true);
  assert.equal(appendedElement.value, 'https://gdgkh.cc/2026/test');
});

await testAsync('非安全上下文（無 navigator.clipboard）時，直接執行 textarea execCommand', async () => {
  let execCommandCalled = false;

  globalThis.Node = MockNode;
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: () => ({
        value: '',
        style: {},
        setAttribute: () => {},
        focus: () => {},
        select: () => {},
        setSelectionRange: () => {},
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
      execCommand: (cmd) => {
        if (cmd === 'copy') {
          execCommandCalled = true;
          return true;
        }
        return false;
      },
    },
    configurable: true,
    writable: true,
  });

  setMockNavigator({});

  const res = await copyTextToClipboard('https://gdgkh.cc/insecure');
  assert.equal(res, true);
  assert.equal(execCommandCalled, true);
});

test('fallbackCopyText 異常時應安全回傳 false，不引發未捕獲例外', () => {
  globalThis.Node = MockNode;
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: () => {
        throw new Error('DOM manipulation not permitted');
      },
    },
    configurable: true,
    writable: true,
  });
  const res = fallbackCopyText('https://test');
  assert.equal(res, false);
});

test('fallbackCopyText 建立的 DOM 元素應具備防止 iOS 縮放（fontSize 16px）與固定於螢幕外（left -9999px）之防護樣式', () => {
  let createdStyles = null;
  globalThis.Node = MockNode;
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: () => {
        const el = {
          value: '',
          style: {},
          setAttribute: () => {},
          focus: () => {},
          select: () => {},
          setSelectionRange: () => {},
        };
        createdStyles = el.style;
        return el;
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
      execCommand: () => true,
    },
    configurable: true,
    writable: true,
  });
  const res = fallbackCopyText('https://test');
  assert.equal(res, true);
  assert.equal(createdStyles.fontSize, '16px');
  assert.equal(createdStyles.left, '-9999px');
  assert.equal(createdStyles.position, 'fixed');
});

console.warn('\n=== 4. 詳細彈窗分享按鈕元件（makeShareButton）點擊互動測試 ===');

await testAsync('在 macOS 桌面環境點擊分享：直接複製連結至剪貼簿，且按鈕顯示「已複製連結！」', async () => {
  setupMockDom();
  let clipboardText = '';
  let shareCalled = false;

  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    share: async () => {
      shareCalled = true;
    },
    clipboard: {
      writeText: async (text) => {
        clipboardText = text;
      },
    },
  });

  const btn = makeShareButton({
    name: '王小明',
    shareUrl: 'https://gdgkh.cc/2026/share/speakers/ming/',
  });

  assert.ok(btn, '按鈕應成功建立');
  assert.equal(btn.getAttribute('aria-label'), '分享');

  await btn.dispatch('click');

  assert.equal(shareCalled, false, 'macOS 桌面不應呼叫原生 share');
  assert.equal(clipboardText, 'https://gdgkh.cc/2026/share/speakers/ming/', '應寫入剪貼簿');
  assert.equal(btn.classList.contains('gk-modal-share-copied'), true, '按鈕應加上已複製樣式');
  assert.equal(btn.getAttribute('aria-label'), '已複製連結！', 'aria-label 應更新');
  assert.equal(btn.textContent, '已複製連結！', '按鈕文字應更新');
});

await testAsync('在 Android 行動裝置點擊分享：呼叫原生 share，不覆寫剪貼簿', async () => {
  setupMockDom();
  let clipboardCalled = false;
  let sharedData = null;

  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    userAgentData: { mobile: true },
    share: async (data) => {
      sharedData = data;
    },
    clipboard: {
      writeText: async () => {
        clipboardCalled = true;
      },
    },
  });

  const btn = makeShareButton({
    name: '林小華',
    shareUrl: 'https://gdgkh.cc/2026/share/speakers/hua/',
  });

  await btn.dispatch('click');

  assert.ok(sharedData, '應呼叫原生 share');
  assert.equal(sharedData.url, 'https://gdgkh.cc/2026/share/speakers/hua/');
  assert.equal(clipboardCalled, false, '行動裝置原生分享成功時不應額外覆寫剪貼簿');
  assert.equal(btn.classList.contains('gk-modal-share-copied'), false);
});

await testAsync('在行動裝置上使用者取消原生分享（AbortError）時：安靜結束，不干擾剪貼簿與 UI', async () => {
  setupMockDom();
  let clipboardCalled = false;

  const abortError = new Error('The share operation was canceled');
  abortError.name = 'AbortError';

  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    share: async () => {
      throw abortError;
    },
    clipboard: {
      writeText: async () => {
        clipboardCalled = true;
      },
    },
  });

  const btn = makeShareButton({
    name: '測試',
    shareUrl: 'https://gdgkh.cc/2026/share/booths/test/',
  });

  await btn.dispatch('click');

  assert.equal(clipboardCalled, false, '使用者取消時不應寫入剪貼簿');
  assert.equal(btn.classList.contains('gk-modal-share-copied'), false, '樣式不應改變');
});

await testAsync('在行動裝置上原生分享回傳 InvalidStateError（如重複觸發）：安靜結束，不干擾剪貼簿與 UI', async () => {
  setupMockDom();
  let clipboardCalled = false;

  const invalidStateErr = new Error('A share operation is already in progress.');
  invalidStateErr.name = 'InvalidStateError';

  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    share: async () => {
      throw invalidStateErr;
    },
    clipboard: {
      writeText: async () => {
        clipboardCalled = true;
      },
    },
  });

  const btn = makeShareButton({
    name: '連點測試',
    shareUrl: 'https://gdgkh.cc/2026/share/booths/test/',
  });

  await btn.dispatch('click');

  assert.equal(clipboardCalled, false, 'InvalidStateError 時不應誤觸剪貼簿');
  assert.equal(btn.classList.contains('gk-modal-share-copied'), false, '樣式不應改變');
});

await testAsync('快速連點分享按鈕（Concurrency Guard）：在分享處理進行中時忽略第二次點擊', async () => {
  setupMockDom();
  let shareCount = 0;
  let resolveShare;
  const sharePromise = new Promise((resolve) => {
    resolveShare = resolve;
  });

  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
    userAgentData: { mobile: true },
    share: async () => {
      shareCount += 1;
      await sharePromise;
    },
  });

  const btn = makeShareButton({
    name: '併發測試',
    shareUrl: 'https://gdgkh.cc/2026/share/speakers/concurrent/',
  });

  // 第一次點擊：發起分享
  const click1 = btn.dispatch('click');
  // 第二次點擊：在 share 尚未完成前立即再次觸發
  const click2 = btn.dispatch('click');

  // 解除第一次 share 的 pending
  resolveShare();
  await Promise.all([click1, click2]);

  assert.equal(shareCount, 1, '進行中時的第二次點擊應被防護機制擋下，只觸發一次 share');
});

await testAsync('在行動裝置上原生分享失敗（非 AbortError，如權限錯誤）時：自動降級至剪貼簿複製', async () => {
  setupMockDom();
  let clipboardText = '';

  const notAllowedErr = new Error('Permission denied');
  notAllowedErr.name = 'NotAllowedError';

  setMockNavigator({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
    share: async () => {
      throw notAllowedErr;
    },
    clipboard: {
      writeText: async (text) => {
        clipboardText = text;
      },
    },
  });

  const btn = makeShareButton({
    name: '贊助商測試',
    shareUrl: 'https://gdgkh.cc/2026/share/thanks/sponsor/',
  });

  await btn.dispatch('click');

  assert.equal(clipboardText, 'https://gdgkh.cc/2026/share/thanks/sponsor/', '應降級寫入剪貼簿');
  assert.equal(btn.classList.contains('gk-modal-share-copied'), true, '按鈕應更新為已複製狀態');
});

restoreAll();

console.warn(`\n✔ 測試全數通過！總共 ${passed}/${total} 項測試通過。\n`);
