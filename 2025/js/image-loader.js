// Image Loading Optimization System
// 圖片載入優化系統

class ImageLoader {
  constructor() {
    this.imageCache = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 秒
    this.observerOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0.01,
    };
    this.observer = null;
    this.init();
  }

  // 初始化
  init() {
    // 支援 Intersection Observer 的瀏覽器才使用懶加載
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.handleIntersection.bind(this), this.observerOptions);
    }
  }

  // 創建優化的圖片元素
  createOptimizedImage(src, alt, options = {}) {
    const {
      className = '',
      loading = 'lazy',
      placeholder = true,
      onClick = null,
      title = '',
      dataAttributes = {},
    } = options;

    // 創建容器
    const container = document.createElement('div');
    container.className = `image-container ${className}-container`;
    container.setAttribute('data-loading', 'true');

    // 創建 placeholder
    if (placeholder) {
      const placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'image-placeholder';
      container.appendChild(placeholderDiv);
    }

    // 創建圖片元素
    const img = document.createElement('img');
    img.className = className;
    img.alt = alt;
    img.dataset.src = src; // 先存在 data-src 中

    if (title) {
      img.title = title;
    }

    // 設定自定義 data 屬性
    Object.entries(dataAttributes).forEach(([key, value]) => {
      img.setAttribute(`data-${key}`, value);
    });

    // 如果有 onClick 事件
    if (onClick) {
      img.style.cursor = 'pointer';
      img.addEventListener('click', onClick);
    }

    // 圖片載入成功處理
    img.addEventListener('load', () => {
      this.handleImageLoad(container, img);
    });

    // 圖片載入失敗處理
    img.addEventListener('error', () => {
      this.handleImageError(container, img, src);
    });

    container.appendChild(img);

    // 根據 loading 策略決定載入方式
    if (loading === 'eager' || !this.observer) {
      // 立即載入
      this.loadImage(img);
    } else {
      // 懶加載：觀察元素
      this.observer.observe(img);
    }

    return container;
  }

  // 處理 Intersection Observer 回調
  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.observer.unobserve(img);
        this.loadImage(img);
      }
    });
  }

  // 載入圖片
  loadImage(img, retryCount = 0) {
    const src = img.dataset.src;
    if (!src) return;

    // 檢查快取
    if (this.imageCache.has(src)) {
      img.src = src;
      return;
    }

    // 載入圖片
    img.src = src;
  }

  // 圖片載入成功
  handleImageLoad(container, img) {
    const src = img.src;

    // 加入快取
    this.imageCache.set(src, true);

    // 移除 placeholder
    const placeholder = container.querySelector('.image-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // 移除錯誤訊息（如果有）
    const errorMsg = container.querySelector('.image-error');
    if (errorMsg) {
      errorMsg.remove();
    }

    // 更新狀態
    container.setAttribute('data-loading', 'false');
    container.setAttribute('data-loaded', 'true');

    // 添加淡入效果
    img.classList.add('image-loaded');
  }

  // 圖片載入失敗
  handleImageError(container, img, originalSrc, retryCount = 0) {
    console.error(`Failed to load image: ${originalSrc}`);

    if (retryCount < this.retryAttempts) {
      // 重試載入
      console.log(`Retrying... Attempt ${retryCount + 1}/${this.retryAttempts}`);
      setTimeout(
        () => {
          img.src = originalSrc;
          img.addEventListener(
            'error',
            () => {
              this.handleImageError(container, img, originalSrc, retryCount + 1);
            },
            { once: true }
          );
        },
        this.retryDelay * (retryCount + 1)
      );
    } else {
      // 重試失敗，顯示錯誤訊息
      container.setAttribute('data-loading', 'false');
      container.setAttribute('data-error', 'true');

      // 移除 placeholder
      const placeholder = container.querySelector('.image-placeholder');
      if (placeholder) {
        placeholder.remove();
      }

      // 創建錯誤訊息
      const errorDiv = document.createElement('div');
      errorDiv.className = 'image-error';

      const errorIcon = document.createElement('div');
      errorIcon.className = 'error-icon';
      errorIcon.innerHTML = '⚠️';

      const errorText = document.createElement('div');
      errorText.className = 'error-text';

      // 根據當前語言顯示錯誤訊息
      const lang = window.dynamicContentManager?.currentLanguage || 'zh';
      const errorMessages = {
        zh: '圖片載入失敗',
        en: 'Failed to load image',
        ja: '画像の読み込みに失敗しました',
      };
      errorText.textContent = errorMessages[lang] || errorMessages.zh;

      const retryButton = document.createElement('button');
      retryButton.className = 'retry-button';
      const retryTexts = {
        zh: '重新載入',
        en: 'Retry',
        ja: '再試行',
      };
      retryButton.textContent = retryTexts[lang] || retryTexts.zh;

      retryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        container.setAttribute('data-loading', 'true');
        container.setAttribute('data-error', 'false');
        errorDiv.remove();

        // 重新載入
        this.loadImage(img);
      });

      errorDiv.appendChild(errorIcon);
      errorDiv.appendChild(errorText);
      errorDiv.appendChild(retryButton);
      container.appendChild(errorDiv);
    }
  }

  // 預載入圖片
  preloadImages(urls) {
    urls.forEach((url) => {
      if (!this.imageCache.has(url)) {
        const img = new Image();
        img.src = url;
        img.addEventListener('load', () => {
          this.imageCache.set(url, true);
        });
      }
    });
  }

  // 清除快取
  clearCache() {
    this.imageCache.clear();
  }

  // 取消觀察所有元素
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// 創建全域實例
window.imageLoader = new ImageLoader();

// 匯出
export default ImageLoader;
