// Dynamic Content Management System
// 動態內容管理系統

class DynamicContentManager {
  constructor() {
    this.currentLanguage = 'zh-Hant';
    this.data = {
      speakers: [],
      markets: [],
      sponsors: [],
      community: [],
      staff: [],
      about: [],
      carousel: [],
    };
  }

  // 設定當前語言
  setLanguage(lang) {
    if (lang === 'en') {
      this.currentLanguage = 'en';
    } else if (lang === 'ja') {
      this.currentLanguage = 'ja';
    } else if (lang === 'zh-Hant' || lang === 'zh') {
      this.currentLanguage = 'zh';
    } else {
      this.currentLanguage = 'zh';
    }
  }

  // 取得多語言文字
  getText(textObj) {
    return textObj[this.currentLanguage] || textObj['zh'] || textObj['en'] || textObj['ja'] || '';
  }

  // 載入所有資料
  async loadAllData() {
    try {
      const [speakers, markets, sponsors, community, staff, about, carousel] = await Promise.all([
        this.loadJSON('data/speakers.json'),
        this.loadJSON('data/markets.json'),
        this.loadJSON('data/sponsors.json'),
        this.loadJSON('data/community.json'),
        this.loadJSON('data/staff.json'),
        this.loadJSON('data/about.json'),
        this.loadJSON('data/carousel.json'),
      ]);

      this.data.speakers = speakers.speakers || [];
      this.data.markets = markets.booths || [];
      this.data.sponsors = sponsors.sponsors || [];
      this.data.community = community.community || [];
      this.data.staff = staff.staff || [];
      this.data.about = about.about || [];
      this.data.carousel = carousel.slides || [];

      this.renderAllContent();
      this.enhanceScheduleWithSpeakers();
      this.initHashNavigation(); // 初始化 hash 導航功能
    } catch (error) {
      console.error('載入資料時發生錯誤:', error);
    }
  }

  // 載入 JSON 檔案
  async loadJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return await response.json();
  }

  // 渲染所有內容
  renderAllContent() {
    this.renderCarousel();
    this.renderSpeakers();
    this.renderMarkets();
    this.renderSponsors();
    this.renderCommunity();
    this.renderStaff();
    this.renderAbout();
    // 綁定所有分享按鈕的事件
    this.bindShareButtons();
  }

  // 渲染輪播圖
  renderCarousel() {
    const container = document.querySelector('.slides-carousel');
    const indicatorsContainer = document.querySelector('.slide-indicators');
    if (!container) return;

    // 保存 Monitor Animation 容器（如果存在）
    const monitorAnimation = container.querySelector('.monitor-animation');

    // 清空現有內容
    container.innerHTML = '';

    // 創建輪播圖片
    this.data.carousel.forEach((slide, index) => {
      const slideElement = this.createCarouselSlide(slide, index === 0);
      container.appendChild(slideElement);
    });

    // 恢復 Monitor Animation 容器
    if (monitorAnimation) {
      container.appendChild(monitorAnimation);
    }

    // 渲染指示器（如果指示器容器存在）
    if (indicatorsContainer && this.data.carousel.length > 1) {
      indicatorsContainer.innerHTML = '';
      this.data.carousel.forEach((slide, index) => {
        const indicator = document.createElement('span');
        indicator.className = index === 0 ? 'indicator active' : 'indicator';
        indicatorsContainer.appendChild(indicator);
      });
    }

    // 重新初始化輪播圖功能
    this.initCarouselAutoplay();
  }

  // 初始化輪播圖自動播放
  initCarouselAutoplay() {
    const slides = document.querySelectorAll('.slides-carousel .slide');
    const indicators = document.querySelectorAll('.slide-indicators .indicator');

    if (slides.length === 0 || indicators.length === 0) return;

    let currentSlide = 0;
    let autoplayInterval = null;

    const showSlide = (index) => {
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });
      indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
      });
      currentSlide = index;
    };

    const nextSlide = () => {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    };

    // 自動播放每 5 秒切換一次
    autoplayInterval = setInterval(nextSlide, 5000);

    // 指示器點擊事件
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        clearInterval(autoplayInterval);
        showSlide(index);
        autoplayInterval = setInterval(nextSlide, 5000);
      });
    });

    // 滑鼠懸停時暫停
    const carousel = document.querySelector('.slides-carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', () => {
        if (autoplayInterval) {
          clearInterval(autoplayInterval);
        }
      });

      carousel.addEventListener('mouseleave', () => {
        autoplayInterval = setInterval(nextSlide, 5000);
      });
    }
  }

  // 建立輪播圖片元素
  createCarouselSlide(slide, isActive = false) {
    const slideDiv = document.createElement('div');
    slideDiv.className = isActive ? 'slide active' : 'slide';

    // 使用 ImageLoader 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(slide.image, this.getText(slide.alt), {
      className: '',
      loading: slide.loading || 'eager',
      placeholder: true,
      title: slide.title ? this.getText(slide.title) : '',
      dataAttributes: slide.dataAttributes || {},
    });

    // 如果 ImageLoader 不可用，使用傳統方式
    if (!imageContainer) {
      const img = document.createElement('img');
      img.src = slide.image;
      img.alt = this.getText(slide.alt);
      img.loading = slide.loading || 'eager';

      if (slide.title) {
        img.title = this.getText(slide.title);
      }

      if (slide.dataAttributes) {
        Object.entries(slide.dataAttributes).forEach(([key, value]) => {
          img.setAttribute(`data-${key}`, value);
        });
      }

      slideDiv.appendChild(img);
    } else {
      slideDiv.appendChild(imageContainer);
    }

    return slideDiv;
  }

  // 渲染講者
  renderSpeakers() {
    const container = document.querySelector('#speakers .speakers-grid');
    if (!container) return;

    container.innerHTML = '';

    // 定義分類順序
    const categoryOrder = [
      {
        zh: 'Gemini AI 的生成式實踐',
        en: 'Gemini AI in Practice',
        ja: 'Gemini AI の生成AI実践',
        color: '#4285f4',
      },
      {
        zh: 'Google Cloud 的雲端實踐',
        en: 'Google Cloud in Practice',
        ja: 'Google Cloud のクラウド実践',
        color: '#34a853',
      },
      {
        zh: '科技向善的實踐之路',
        en: 'Goodness in Practice',
        ja: 'テクノロジーで社会貢献を実現する道',
        color: '#f9ab00',
      },
      {
        zh: '中午說書人',
        en: 'Midday Storyteller',
        ja: '昼の語り手',
        color: '#ea4335',
      },
      {
        zh: '第二屆 AI 生成大賽',
        en: 'The 2nd AI Generative Contest',
        ja: '第2回 AI 生成コンテスト',
        color: '#1e1e1e',
      },
    ];

    // 依照分類分組講者
    categoryOrder.forEach((category) => {
      // 篩選出該分類的講者
      const categorySpeakers = this.data.speakers.filter((speaker) => {
        const speakerCategoryZh = speaker.topic_category ? this.getText(speaker.topic_category) : '';
        const categoryZh = category.zh;
        return speakerCategoryZh === categoryZh || (speaker.topic_category && speaker.topic_category.zh === categoryZh);
      });

      // 如果該分類有講者，則創建分類標題和講者卡片
      if (categorySpeakers.length > 0) {
        // 創建分類標題
        const categoryTitle = document.createElement('div');
        categoryTitle.className = 'speaker-category-title';
        categoryTitle.innerHTML = `<h3 style="color: ${category.color}; border-bottom-color: ${category.color};">${this.getText(category)}</h3>`;
        container.appendChild(categoryTitle);

        // 創建分類容器
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'speaker-category-container';

        // 添加該分類的講者卡片
        categorySpeakers.forEach((speaker) => {
          const speakerCard = this.createSpeakerCard(speaker);
          categoryContainer.appendChild(speakerCard);
        });

        container.appendChild(categoryContainer);
      }
    });

    // 重新綁定點擊事件
    this.bindSpeakerEvents();
  }

  // 建立講者卡片
  createSpeakerCard(speaker) {
    const card = document.createElement('div');
    card.className = 'speaker-card';
    card.setAttribute('data-speaker-id', speaker.id);
    card.id = speaker.id; // 設定 ID 以支援 URL hash 導航

    const tagsHTML = speaker.tags.map((tag) => `<span>#${tag}</span>`).join('');
    // 生成講者的靜態頁面網址
    const shareUrl = `${window.location.origin}/share/speakers/${speaker.id}/`;
    const socialLinks = this.createSocialLinks(speaker.social, shareUrl);

    // 取得「查看更多」和「顯示較少」的多語言文字
    let viewMoreText = '查看更多';
    let collapseText = '顯示較少';
    let sessionInfoTitle = '議程資訊';
    let sessionCategoryLabel = '分類：';
    let sessionNameLabel = '名稱：';
    let sessionAbstractLabel = '簡介：<br>';

    if (this.currentLanguage === 'en') {
      viewMoreText = 'View More';
      collapseText = 'Show Less';
      sessionInfoTitle = 'Session Info';
      sessionCategoryLabel = 'Category: ';
      sessionNameLabel = 'Title: ';
      sessionAbstractLabel = 'Abstract:<br>';
    } else if (this.currentLanguage === 'ja') {
      viewMoreText = 'もっと見る';
      collapseText = '表示を減らす';
      sessionInfoTitle = 'セッション情報';
      sessionCategoryLabel = 'カテゴリ：';
      sessionNameLabel = 'タイトル：';
      sessionAbstractLabel = '概要：<br>';
    }

    // 創建講者照片容器
    const photoContainer = window.imageLoader?.createOptimizedImage(
      speaker.photo,
      `Photo of ${this.getText(speaker.name)}`,
      {
        className: 'speaker-photo',
        loading: 'lazy',
        placeholder: true,
      }
    );

    card.innerHTML = `
            <div class="speaker-info">
                <h3 class="speaker-name">${this.getText(speaker.name)}</h3>
                <p class="speaker-org">${this.getText(speaker.org)}</p>
                <p class="speaker-title">${this.getText(speaker.title)}</p>
                <div class="speaker-tags summary-tags">
                    ${tagsHTML}
                </div>
                ${socialLinks}
            </div>
            <div class="speaker-details">
                <div class="speaker-details-content">
                    <p class="speaker-bio-full">${this.getText(speaker.bio)}</p>
                    <div class="session-info-block">
                        <h4>${sessionInfoTitle}</h4>
                        <p><strong>${sessionCategoryLabel}</strong><span>${this.getText(speaker.topic_category)}</span></p>
                        <p><strong>${sessionNameLabel}</strong><span>${this.getText(speaker.session.name)}</span></p>
                        <p><strong>${sessionAbstractLabel}</strong><span>${this.getText(speaker.session.abstract)}</span></p>
                    </div>
                </div>
            </div>
            <div class="speaker-expand-hint" data-view-more="${viewMoreText}" data-collapse="${collapseText}">
                <span class="expand-text">${viewMoreText}</span>
                <svg class="expand-arrow" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 11L3 6h10l-5 5z"/>
                </svg>
            </div>
        `;

    // 在卡片最前面插入照片
    if (photoContainer) {
      card.insertBefore(photoContainer, card.firstChild);
    } else {
      // Fallback：如果 ImageLoader 不可用
      const img = document.createElement('img');
      img.className = 'speaker-photo';
      img.src = speaker.photo;
      img.alt = `Photo of ${this.getText(speaker.name)}`;
      img.loading = 'lazy';
      card.insertBefore(img, card.firstChild);
    }

    return card;
  }

  // 渲染技術創作市集
  renderMarkets() {
    const container = document.querySelector('#tech-creation-market .market-grid');
    if (!container) return;

    container.innerHTML = '';

    this.data.markets.forEach((booth) => {
      const boothCard = this.createMarketCard(booth);
      container.appendChild(boothCard);
    });
  }

  // 建立技術市集卡片
  createMarketCard(booth) {
    const card = document.createElement('div');
    card.className = 'market-booth-card';
    card.setAttribute('data-booth-id', booth.id);
    card.id = booth.id; // 設定 ID 以支援 URL hash 導航

    // 生成攤位的靜態頁面網址
    const shareUrl = `${window.location.origin}/share/markets/${booth.id}/`;
    const socialLinks = this.createSocialLinks(booth.social, shareUrl);

    // 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(booth.logo, `${this.getText(booth.name)} Logo`, {
      className: 'market-booth-image',
      loading: 'lazy',
      placeholder: true,
    });

    card.innerHTML = `
            <div class="market-booth-info">
                <h3 class="market-booth-title">${this.getText(booth.name)}</h3>
                <div class="market-booth-description">${this.getText(booth.description)}</div>
                ${socialLinks}
            </div>
        `;

    // 在卡片最前面插入圖片
    if (imageContainer) {
      card.insertBefore(imageContainer, card.firstChild);
    } else {
      const img = document.createElement('img');
      img.className = 'market-booth-image';
      img.src = booth.logo;
      img.alt = `${this.getText(booth.name)} Logo`;
      img.loading = 'lazy';
      card.insertBefore(img, card.firstChild);
    }

    return card;
  }

  // 渲染贊助夥伴
  renderSponsors() {
    const container = document.querySelector('#sponsors .sponsors-grid');
    if (!container) return;

    container.innerHTML = '';

    this.data.sponsors.forEach((sponsor) => {
      const sponsorCard = this.createSponsorCard(sponsor);
      container.appendChild(sponsorCard);
    });
  }

  // 建立贊助商卡片
  createSponsorCard(sponsor) {
    const card = document.createElement('div');
    card.className = 'sponsor-card';
    card.setAttribute('data-sponsor-id', sponsor.id);
    card.id = sponsor.id; // 設定 ID 以支援 URL hash 導航

    // 生成贊助商的靜態頁面網址
    const shareUrl = `${window.location.origin}/share/sponsors/${sponsor.id}/`;
    const socialLinks = this.createSocialLinks(sponsor.social, shareUrl);

    // 使用 category 作為贊助類型 (partner 或其他類型)
    const sponsorType = sponsor.type || 'company'; // 預設為公司
    const categoryText = this.getText(sponsor.category);

    // 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(
      sponsor.logo,
      `${this.getText(sponsor.name)} Logo`,
      {
        className: 'sponsor-image',
        loading: 'lazy',
        placeholder: true,
        onClick: () => window.open(sponsor.website, '_blank'),
      }
    );

    card.innerHTML = `
            <div class="sponsor-info">
                <div class="sponsor-type ${sponsorType}">${categoryText}</div>
                <h3 class="sponsor-title">${this.getText(sponsor.name)}</h3>
                <div class="sponsor-description">${this.getText(sponsor.description)}</div>
                ${socialLinks}
            </div>
        `;

    // 在卡片最前面插入圖片
    if (imageContainer) {
      card.insertBefore(imageContainer, card.firstChild);
    } else {
      const img = document.createElement('img');
      img.className = 'sponsor-image';
      img.src = sponsor.logo;
      img.alt = `${this.getText(sponsor.name)} Logo`;
      img.loading = 'lazy';
      img.style.cursor = 'pointer';
      img.onclick = () => window.open(sponsor.website, '_blank');
      card.insertBefore(img, card.firstChild);
    }

    return card;
  }

  // 渲染參與社群
  renderCommunity() {
    const container = document.querySelector('#community .community-grid');
    if (!container) return;

    container.innerHTML = '';

    this.data.community.forEach((community) => {
      const communityCard = this.createCommunityCard(community);
      container.appendChild(communityCard);
    });
  }

  // 建立社群卡片
  createCommunityCard(community) {
    const card = document.createElement('div');
    card.className = 'community-card';
    card.setAttribute('data-community-id', community.id);
    card.id = community.id; // 設定 ID 以支援 URL hash 導航

    // 生成社群的靜態頁面網址
    const shareUrl = `${window.location.origin}/share/community/${community.id}/`;
    const socialLinks = this.createSocialLinks(community.social, shareUrl);

    // 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(
      community.logo,
      `${this.getText(community.name)} Logo`,
      {
        className: 'community-image',
        loading: 'lazy',
        placeholder: true,
        onClick: () => window.open(community.website, '_blank'),
      }
    );

    card.innerHTML = `
            <div class="community-info">
                <h3 class="community-title">${this.getText(community.name)}</h3>
                <div class="community-category">${this.getText(community.category).join(', ')}</div>
                <div class="community-description">${this.getText(community.description)}</div>
                ${socialLinks}
            </div>
        `;

    // 在卡片最前面插入圖片
    if (imageContainer) {
      card.insertBefore(imageContainer, card.firstChild);
    } else {
      const img = document.createElement('img');
      img.className = 'community-image';
      img.src = community.logo;
      img.alt = `${this.getText(community.name)} Logo`;
      img.loading = 'lazy';
      img.style.cursor = 'pointer';
      img.onclick = () => window.open(community.website, '_blank');
      card.insertBefore(img, card.firstChild);
    }

    return card;
  }

  // 渲染關於我們
  renderAbout() {
    const container = document.querySelector('#about .about-grid');
    if (!container) return;

    container.innerHTML = '';

    this.data.about.forEach((booth) => {
      const boothCard = this.createAboutCard(booth);
      container.appendChild(boothCard);
    });
  }

  // 建立關於我們卡片
  createAboutCard(booth) {
    const card = document.createElement('div');
    card.className = 'about-card';

    const socialLinks = this.createSocialLinks(booth.social);

    // 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(booth.logo, `${this.getText(booth.name)} Logo`, {
      className: 'about-image',
      loading: 'lazy',
      placeholder: true,
    });

    card.innerHTML = `
            <div class="about-info-new">
                <h3 class="about-title">${this.getText(booth.name)}</h3>
                <div class="about-description-new">${this.getText(booth.description)}</div>
                ${socialLinks}
            </div>
        `;

    // 在卡片最前面插入圖片
    if (imageContainer) {
      card.insertBefore(imageContainer, card.firstChild);
    } else {
      const img = document.createElement('img');
      img.className = 'about-image';
      img.src = booth.logo;
      img.alt = `${this.getText(booth.name)} Logo`;
      img.loading = 'lazy';
      card.insertBefore(img, card.firstChild);
    }

    return card;
  }

  // 建立社群連結
  createSocialLinks(social, shareUrl = null) {
    // 創建分享按鈕（如果提供了分享網址）
    let shareButton = '';
    if (shareUrl) {
      const shareText = this.getShareButtonText();
      shareButton = `<button class="share-link" data-share-url="${shareUrl}" title="${shareText}">${shareText}</button>`;
    }

    // 如果沒有社群連結且沒有分享按鈕，返回空字串
    if (!social && !shareButton) return '';

    // 創建社群連結
    const links = social
      ? Object.entries(social)
          .map(([platform, url]) => {
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="social-link">${platformName}</a>`;
          })
          .join(' ')
      : '';

    // 將分享按鈕放在最前面
    return `<div class="social-links">${shareButton}${shareButton && links ? ' ' : ''}${links}</div>`;
  }

  // 取得分享按鈕的多語言文字
  getShareButtonText() {
    if (this.currentLanguage === 'en') {
      return 'Share';
    } else if (this.currentLanguage === 'ja') {
      return '共有';
    } else {
      return '分享';
    }
  }

  // 取得複製成功的多語言文字
  getCopiedText() {
    if (this.currentLanguage === 'en') {
      return 'Copied!';
    } else if (this.currentLanguage === 'ja') {
      return 'コピー済み';
    } else {
      return '已複製！';
    }
  }

  // 綁定所有分享按鈕的點擊事件
  bindShareButtons() {
    const shareButtons = document.querySelectorAll('.share-link');
    shareButtons.forEach((button) => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation(); // 防止觸發卡片的其他點擊事件
        e.preventDefault();

        const url = button.getAttribute('data-share-url');
        if (!url) return;

        try {
          // 使用 Clipboard API 複製網址
          await navigator.clipboard.writeText(url);

          // 保存原始文字
          const originalText = button.textContent;

          // 顯示複製成功的回饋
          button.textContent = this.getCopiedText();
          button.classList.add('copied');

          // 2 秒後恢復原始狀態
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('複製失敗:', err);
          // 如果 Clipboard API 不可用，使用舊方法
          this.fallbackCopyText(url, button);
        }
      });
    });
  }

  // 備用的複製方法（適用於不支援 Clipboard API 的瀏覽器）
  fallbackCopyText(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');

      // 保存原始文字
      const originalText = button.textContent;

      // 顯示複製成功的回饋
      button.textContent = this.getCopiedText();
      button.classList.add('copied');

      // 2 秒後恢復原始狀態
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('備用複製方法失敗:', err);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  // 綁定講者卡片點擊事件
  bindSpeakerEvents() {
    const speakerCards = document.querySelectorAll('.speaker-card');
    speakerCards.forEach((card) => {
      card.addEventListener('click', () => {
        // Toggle the clicked card
        const isExpanded = card.classList.toggle('expanded');

        // 更新提示文字
        const hint = card.querySelector('.speaker-expand-hint');
        const expandText = hint.querySelector('.expand-text');

        if (isExpanded) {
          expandText.textContent = hint.getAttribute('data-collapse');
        } else {
          expandText.textContent = hint.getAttribute('data-view-more');
        }
      });
    });
  }

  // 新增講者
  async addSpeaker(speakerData) {
    this.data.speakers.push(speakerData);
    await this.saveData('speakers', { speakers: this.data.speakers });
    this.renderSpeakers();
  }

  // 新增技術市集攤位
  async addMarketBooth(boothData) {
    this.data.markets.push(boothData);
    await this.saveData('markets', { booths: this.data.markets });
    this.renderMarkets();
  }

  // 新增贊助商
  async addSponsor(sponsorData) {
    this.data.sponsors.push(sponsorData);
    await this.saveData('sponsors', { sponsors: this.data.sponsors });
    this.renderSponsors();
  }

  // 新增參與社群
  async addCommunity(communityData) {
    this.data.community.push(communityData);
    await this.saveData('community', { community: this.data.community });
    this.renderCommunity();
  }

  // 渲染志工介紹
  renderStaff() {
    const container = document.querySelector('#staff .staff-grid');
    if (!container) return;

    container.innerHTML = '';

    this.data.staff.forEach((staff) => {
      const staffCard = this.createStaffCard(staff);
      container.appendChild(staffCard);
    });
  }

  // 建立志工卡片
  createStaffCard(staff) {
    const card = document.createElement('div');
    card.className = 'staff-card';
    card.setAttribute('data-staff-id', staff.id);
    card.id = staff.id; // 設定 ID 以支援 URL hash 導航

    // 生成工作人員的靜態頁面網址
    const shareUrl = `${window.location.origin}/share/staff/${staff.id}/`;
    const socialLinks = this.createSocialLinks(staff.social, shareUrl);

    // 組織和職稱（如果有的話）
    const orgHTML = staff.org ? `<p class="staff-org">${this.getText(staff.org)}</p>` : '';
    const titleHTML = staff.title ? `<p class="staff-title-position">${this.getText(staff.title)}</p>` : '';

    // 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(staff.photo, `${this.getText(staff.name)} Photo`, {
      className: 'staff-image',
      loading: 'lazy',
      placeholder: true,
    });

    card.innerHTML = `
            <div class="staff-info">
                <h3 class="staff-title">${this.getText(staff.name)}</h3>
                ${orgHTML}
                ${titleHTML}
                <div class="staff-category">${this.getText(staff.category)}</div>
                <div class="staff-description">${this.getText(staff.description)}</div>
                ${socialLinks}
            </div>
        `;

    // 在卡片最前面插入圖片
    if (imageContainer) {
      card.insertBefore(imageContainer, card.firstChild);
    } else {
      const img = document.createElement('img');
      img.className = 'staff-image';
      img.src = staff.photo;
      img.alt = `${this.getText(staff.name)} Photo`;
      img.loading = 'lazy';
      img.style.cursor = 'pointer';
      card.insertBefore(img, card.firstChild);
    }

    return card;
  }

  // 新增志工
  async addStaff(staffData) {
    this.data.staff.push(staffData);
    await this.saveData('staff', { staff: this.data.staff });
    this.renderStaff();
  }

  // 新增關於我們
  async addAbout(aboutData) {
    this.data.about.push(aboutData);
    await this.saveData('about', { about: this.data.about });
    this.renderAbout();
  }

  // 儲存資料（注意：這在靜態網站中不會真的儲存到檔案）
  async saveData(type, data) {
    console.log(`Saving ${type} data:`, data);
    // 在真實環境中，這裡需要呼叫後端 API 來儲存資料
    // 或者使用其他儲存方式如 localStorage（但重新整理後會消失）
  }

  // 語言切換時重新渲染
  onLanguageChange(lang) {
    this.setLanguage(lang);
    this.renderAllContent();
    // 清理現有的議程增強內容，然後重新增強
    this.clearScheduleEnhancements();
    this.enhanceScheduleWithSpeakers();
  }

  // 清理議程增強內容
  clearScheduleEnhancements() {
    // 移除所有動態添加的講者資訊和標籤
    const speakerInfos = document.querySelectorAll('.speaker-info-inline');
    const sessionTags = document.querySelectorAll('.session-tags-container');
    const expandableContents = document.querySelectorAll('.session-expandable');

    speakerInfos.forEach((el) => el.remove());
    sessionTags.forEach((el) => el.remove());
    expandableContents.forEach((el) => el.remove());

    // 重置議程標題的點擊事件和樣式
    const sessionTitles = document.querySelectorAll('.session-title.clickable');
    sessionTitles.forEach((titleEl) => {
      titleEl.classList.remove('clickable');
      // 移除事件監聽器（通過克隆元素）
      const newTitleEl = titleEl.cloneNode(true);
      titleEl.parentNode.replaceChild(newTitleEl, titleEl);
    });

    // 移除議程項目上的點擊事件處理器
    const sessions = document.querySelectorAll('.session:not(.break)');
    sessions.forEach((sessionEl) => {
      if (sessionEl._clickHandler) {
        sessionEl.removeEventListener('click', sessionEl._clickHandler);
        delete sessionEl._clickHandler;
      }
      sessionEl.style.cursor = '';
      sessionEl.classList.remove('expanded');
    });
  }

  // 增強議程頁面，加入講者資訊
  enhanceScheduleWithSpeakers() {
    // 找到所有議程項目
    const sessions = document.querySelectorAll('.session:not(.break)');

    sessions.forEach((sessionEl) => {
      // 取得議程標題元素
      const titleEl = sessionEl.querySelector('.session-title');
      if (!titleEl) return;

      // 從 data-i18n-key 取得 session_id
      const sessionId = titleEl.getAttribute('data-i18n-key');
      if (!sessionId) return;

      // 找到對應的講者
      const speaker = this.data.speakers.find((s) => s.schedule && s.schedule.session_id === sessionId);
      if (!speaker) return;

      // 檢查是否已經加入講者資訊
      if (sessionEl.querySelector('.speaker-info-inline')) return;

      // 更新議程標題為講者的實際議程名稱
      titleEl.textContent = this.getText(speaker.session.name);

      // 讓議程標題可以點擊連結到講者頁面
      titleEl.classList.add('clickable');

      titleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateToSpeaker(speaker.id);
      });

      // 創建並插入 tags 標籤到標題下方
      const tagsEl = this.createSessionTags(speaker);
      titleEl.parentNode.insertBefore(tagsEl, titleEl.nextSibling);

      // 創建講者資訊元素
      const speakerInfoEl = this.createInlineSpeakerInfo(speaker);

      // 創建可展開的詳細內容（不包含簡介文字）
      const expandableContentEl = this.createExpandableContent(speaker);

      // 將講者資訊插入到 session-info 中
      const sessionInfoEl = sessionEl.querySelector('.session-info');
      if (sessionInfoEl) {
        sessionInfoEl.appendChild(speakerInfoEl);
        sessionInfoEl.appendChild(expandableContentEl);
      }

      // 添加摺疊/展開功能
      this.addToggleExpandFunctionality(sessionEl, speaker.id);
    });
  }

  // 創建內嵌講者資訊
  createInlineSpeakerInfo(speaker) {
    const speakerInfo = document.createElement('div');
    speakerInfo.className = 'speaker-info-inline';

    // 創建講者詳情
    const speakerDetails = document.createElement('div');
    speakerDetails.className = 'speaker-details-inline';
    speakerDetails.innerHTML = `
            <div class="speaker-name-small">${this.getText(speaker.name)}</div>
            <div class="speaker-org-small">${this.getText(speaker.org)}</div>
        `;

    // 創建講者頭像容器
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'speaker-avatar';

    // 創建優化的圖片
    const imageContainer = window.imageLoader?.createOptimizedImage(speaker.photo, this.getText(speaker.name), {
      className: 'speaker-photo-small',
      loading: 'lazy',
      placeholder: true,
    });

    if (imageContainer) {
      avatarDiv.appendChild(imageContainer);
    } else {
      const img = document.createElement('img');
      img.className = 'speaker-photo-small';
      img.src = speaker.photo;
      img.alt = this.getText(speaker.name);
      img.loading = 'lazy';
      avatarDiv.appendChild(img);
    }

    speakerInfo.appendChild(avatarDiv);
    speakerInfo.appendChild(speakerDetails);

    return speakerInfo;
  }

  // 創建議程標題下方的 tags 標籤
  createSessionTags(speaker) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'session-tags-container';

    // 創建講者標籤
    const tagsHTML = speaker.tags.map((tag) => `<span class="session-tag">#${tag}</span>`).join('');

    tagsContainer.innerHTML = tagsHTML;

    return tagsContainer;
  }

  // 創建可展開的議程詳細內容（不包含講者簡介）
  createExpandableContent(speaker) {
    const expandableContent = document.createElement('div');
    expandableContent.className = 'session-expandable';

    // 根據當前語言動態設定標籤文字
    const sessionAbstractLabel =
      this.currentLanguage === 'en' ? 'Session Overview:' : this.currentLanguage === 'ja' ? '概要：' : '簡介：';

    // 取得分類文字
    const categoryText = speaker.topic_category ? this.getText(speaker.topic_category) : '';
    const categoryHTML = categoryText
      ? `
            <div class="session-category-expanded">
                <strong>${sessionAbstractLabel.replace('簡介', '分類').replace('Session Overview', 'Category').replace('概要', 'カテゴリ')}</strong>
                <p>${categoryText}</p>
            </div>
        `
      : '';

    expandableContent.innerHTML = `
            <div class="session-details-expanded">
                ${categoryHTML}
                <div class="session-abstract">
                    <strong>${sessionAbstractLabel}</strong>
                    <p>${this.getText(speaker.session.abstract)}</p>
                </div>
            </div>
        `;

    return expandableContent;
  }

  // 添加摺疊/展開功能
  addToggleExpandFunctionality(sessionEl, speakerId) {
    sessionEl.style.cursor = 'pointer';

    // 使用命名函數來確保可以移除舊的事件監聽器
    const clickHandler = (e) => {
      // 檢查是否為手機版 (寬度小於768px)
      if (window.innerWidth <= 768) {
        e.stopPropagation();
        this.toggleSessionExpansion(sessionEl);
      } else {
        // 桌面版直接跳轉到講者頁面
        this.navigateToSpeaker(speakerId);
      }
    };

    // 儲存事件處理器的引用,以便之後可以移除
    if (!sessionEl._clickHandler) {
      sessionEl._clickHandler = clickHandler;
      sessionEl.addEventListener('click', clickHandler);
    }
  }

  // 切換議程展開/收合狀態
  toggleSessionExpansion(sessionEl) {
    const isExpanded = sessionEl.classList.contains('expanded');

    if (isExpanded) {
      // 收合
      sessionEl.classList.remove('expanded');
    } else {
      // 先收合其他已展開的議程
      const expandedSessions = document.querySelectorAll('.session.expanded');
      expandedSessions.forEach((session) => {
        if (session !== sessionEl) {
          session.classList.remove('expanded');
        }
      });

      // 展開當前議程
      sessionEl.classList.add('expanded');

      // 滾動到可視區域
      setTimeout(() => {
        sessionEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);
    }
  }

  // 導航到講者詳細頁面
  navigateToSpeaker(speakerId) {
    this.navigateToItem(speakerId, 'speakers');
  }

  // 通用導航函數
  navigateToItem(itemId, pageType) {
    // 更新 URL hash（不會觸發頁面重新載入）
    if (window.location.hash !== `#${itemId}`) {
      window.history.pushState(null, '', `#${itemId}`);
    }

    // 頁面類型對應表
    const pageMapping = {
      speakers: 'speakers',
      markets: 'tech-creation-market',
      sponsors: 'sponsors',
      community: 'community',
      staff: 'staff',
    };

    // 切換到對應頁面
    const targetPage = pageMapping[pageType];
    const pageTab = document.querySelector(`[data-page="${targetPage}"]`);
    if (pageTab) {
      pageTab.click();
    }

    // 等待頁面切換完成後，滾動到對應項目
    setTimeout(() => {
      const itemCard = document.getElementById(itemId);
      if (itemCard) {
        itemCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        itemCard.classList.add('highlighted');

        // 2秒後移除高亮效果
        setTimeout(() => {
          itemCard.classList.remove('highlighted');
        }, 2000);
      }
    }, 300);
  }

  // 處理 URL hash 變化
  handleHashChange() {
    const hash = window.location.hash.slice(1); // 移除 # 符號
    if (!hash) return;

    // 檢查是否為講者 ID
    const speaker = this.data.speakers.find((s) => s.id === hash);
    if (speaker) {
      this.navigateToItem(hash, 'speakers');
      return;
    }

    // 檢查是否為技術市集 ID
    const booth = this.data.markets.find((m) => m.id === hash);
    if (booth) {
      this.navigateToItem(hash, 'markets');
      return;
    }

    // 檢查是否為贊助商 ID
    const sponsor = this.data.sponsors.find((s) => s.id === hash);
    if (sponsor) {
      this.navigateToItem(hash, 'sponsors');
      return;
    }

    // 檢查是否為社群 ID
    const community = this.data.community.find((c) => c.id === hash);
    if (community) {
      this.navigateToItem(hash, 'community');
      return;
    }

    // 檢查是否為志工 ID
    const staff = this.data.staff.find((s) => s.id === hash);
    if (staff) {
      this.navigateToItem(hash, 'staff');
      return;
    }
  }

  // 初始化 hash 導航
  initHashNavigation() {
    // 監聽 hash 變化
    window.addEventListener('hashchange', () => {
      this.handleHashChange();
    });

    // 頁面載入時處理 hash
    if (window.location.hash) {
      // 延遲處理，確保數據已載入
      setTimeout(() => {
        this.handleHashChange();
      }, 500);
    }
  }
}

// 建立全域實例
window.dynamicContentManager = new DynamicContentManager();

// 在頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
  window.dynamicContentManager.loadAllData();
});

// 匯出給其他模組使用
export default DynamicContentManager;
