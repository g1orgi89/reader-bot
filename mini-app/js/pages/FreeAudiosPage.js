/**
 * 🎵 Бесплатные аудио разборы — верхние табы .tabs/.tab, мгновенный переход
 */
class FreeAudiosPage {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.state = app.state;
    this.telegram = app.telegram;
    this.items = [];
    this.loaded = false;
    this.aliceMeta = null;
    this.aliceLoaded = false;
  }

  init() {
    this.items = [];
    this.loaded = false;
    this.aliceMeta = null;
    this.aliceLoaded = false;
  }

  renderTopTabs() {
    const normalized = this.app?.router?.normalizePath?.(window.location.hash.slice(1)) || '/free-audios';
    const isCatalog = normalized === '/catalog';
    return `
      <div class="tabs">
        <button class="tab ${isCatalog ? 'active' : ''}" data-href="/catalog">Каталог</button>
        <button class="tab ${!isCatalog ? 'active' : ''}" data-href="/free-audios">Аудиоразборы</button>
      </div>
    `;
  }

  escape(t) { 
    const d = document.createElement('div'); 
    d.textContent = String(t||''); 
    return d.innerHTML; 
  }

  renderEmptyStateBlock() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🎧</div>
        <h3>Бесплатные аудио пока недоступны</h3>
        <p>Загляните позже — мы добавим новые материалы.</p>
      </div>
    `;
  }

  renderAliceCard() {
    if (!this.aliceLoaded) {
      return '';
    }
    
    const unlockStatus = this.aliceMeta?.unlockStatus || false;
    const remainingDays = this.aliceMeta?.remainingDays || 0;
    
    if (!unlockStatus) {
      // Locked state - show CTA to achievements with badge icon
      return `
        <div class="alice-audio-card locked">
          <div class="audio-card-content">
            <div class="audio-cover-wrapper">
              <img class="audio-cover-img" src="/assets/audio-covers/alice.svg" alt="Алиса в стране чудес" onerror="this.style.display='none'">
              <div class="audio-locked-overlay">
                <div class="lock-icon">🔒</div>
              </div>
            </div>
            <div class="audio-card-info">
              <div class="audio-card-title-row">
                <h3 class="audio-card-title">Алиса в стране чудес</h3>
                <img src="/assets/badges/alice-badge.png" alt="Alice Badge" class="audio-badge-icon" onerror="this.style.display='none'">
              </div>
              <p class="audio-card-subtitle">Требуется бейдж</p>
              <p class="audio-card-description">Выполните условия для получения доступа к эксклюзивному аудиоразбору</p>
              <button class="audio-cta-button" data-action="navigate-achievements">
                Получить доступ
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Unlocked state - show play button and remaining days
      return `
        <div class="alice-audio-card unlocked">
          <div class="audio-card-content">
            <div class="audio-cover-wrapper">
              <img class="audio-cover-img" src="/assets/audio-covers/alice.svg" alt="Алиса в стране чудес" onerror="this.style.display='none'">
            </div>
            <div class="audio-card-info">
              <h3 class="audio-card-title">Алиса в стране чудес</h3>
              <p class="audio-card-subtitle">Осталось ${remainingDays} дн.</p>
              <p class="audio-card-description">Эксклюзивный аудиоразбор классического произведения</p>
              <button class="audio-play-button" data-audio-id="alice_wonderland">
                ▶ Прослушать
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  renderList() {
    if (!this.loaded) {
      return `
        <div class="cards">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-text">Загружаем бесплатные аудио разборы...</div>
          </div>
        </div>
      `;
    }
    
    const aliceCardHTML = this.renderAliceCard();
    
    if (!Array.isArray(this.items) || this.items.length === 0) {
      return `
        ${aliceCardHTML}
        ${this.renderEmptyStateBlock()}
      `;
    }
    return `
      ${aliceCardHTML}
      <div class="cards">
        ${this.items.map(x => `
          <div class="book-card" data-id="${this.escape(x.id)}">
            <div class="book-main">
              <div class="book-cover cover-1">
                <img class="book-cover-img" src="${this.escape(x.coverUrl||'')}" alt="${this.escape(x.title)}" onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
                <div class="cover-fallback-text" style="display: none;">${this.escape(x.title)}</div>
              </div>
              <div class="book-info">
                <div class="book-header">
                  <div>
                    <div class="book-title">${this.escape(x.title)}</div>
                    ${x.author ? `<div class="book-author">${this.escape(x.author)}</div>` : ''}
                  </div>
                </div>
                <div class="book-description">${this.escape(x.description||'')}</div>
              </div>
            </div>
            <div class="book-footer">
              <div class="book-pricing"><div class="book-price">Бесплатно</div></div>
              <button class="buy-button" data-id="${this.escape(x.id)}">Прослушать</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  render() {
    return `
      <div class="content">
        ${this.renderTopTabs()}
        ${this.renderList()}
      </div>
    `;
  }

  attachEventListeners() {
    const tabButtons = document.querySelectorAll('.tabs .tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const href = btn.getAttribute('data-href');
        tabButtons.forEach(b => b.classList.toggle('active', b === btn));
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
          this.telegram.hapticFeedback('light');
        }
        this.app.router.navigate(href);
      });
    });

    document.querySelectorAll('.buy-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
          this.telegram.hapticFeedback('light');
        }
        this.app.router.navigate(`/free-audios/${encodeURIComponent(id)}`, { state: { id } });
      });
    });
    
    // Alice card CTA button (navigate to achievements)
    const ctaButton = document.querySelector('.audio-cta-button[data-action="navigate-achievements"]');
    if (ctaButton) {
      ctaButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
          this.telegram.hapticFeedback('medium');
        }
        this.app.router.navigate('/achievements');
      });
    }
    
    // Alice card play button (navigate to player)
    const playButton = document.querySelector('.audio-play-button[data-audio-id]');
    if (playButton) {
      playButton.addEventListener('click', (e) => {
        e.preventDefault();
        const audioId = playButton.getAttribute('data-audio-id');
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
          this.telegram.hapticFeedback('light');
        }
        this.app.router.navigate(`/free-audios/${encodeURIComponent(audioId)}`, { state: { id: audioId } });
      });
    }
  }

  parseListResponse(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.audios)) return json.audios;
    if (Array.isArray(json?.items)) return json.items;
    if (json && typeof json === 'object') {
      const values = Object.values(json);
      if (values.length && typeof values[0] === 'object' && values[0].id) return values;
    }
    return [];
  }

  async onShow() {
    try {
      // Fetch Alice metadata
      try {
        const aliceRes = await fetch('/api/audio/alice_wonderland?userId=me', { credentials: 'include' });
        if (aliceRes.ok) {
          this.aliceMeta = await aliceRes.json();
        } else {
          // Fallback to locked state
          this.aliceMeta = { unlockStatus: false, remainingDays: 0 };
        }
      } catch (e) {
        console.warn('⚠️ FreeAudiosPage: Failed to load Alice metadata:', e);
        this.aliceMeta = { unlockStatus: false, remainingDays: 0 };
      }
      this.aliceLoaded = true;
      
      // Fetch free audio list
      const res = await fetch('/api/audio/free', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      this.items = this.parseListResponse(json);
      this.loaded = true;
    } catch (e) { 
      console.warn('⚠️ FreeAudiosPage: Failed to load free audio list:', e);
      this.items = [];
      this.loaded = true;
    }
    const container = document.getElementById('page-content');
    if (container) {
      container.innerHTML = this.render();
      this.attachEventListeners();
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        container.scrollTop = 0;
      }
    }
  }

  onHide() {}
}
window.FreeAudiosPage = FreeAudiosPage;
