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
    this._aliceUnlocked = false;
    
    // Listen for Alice badge claim event
    this._handleAliceClaimed = this._handleAliceClaimed.bind(this);
    window.addEventListener('badge:alice:claimed', this._handleAliceClaimed);
  }

  _handleAliceClaimed(event) {
    console.log('🎉 Alice badge claimed event received:', event.detail);
    // Set localStorage flag to track that Alice was ever unlocked
    localStorage.setItem('alice_ever_unlocked', '1');
    
    // Update aliceMeta to reflect unlocked state
    if (event.detail?.expiresAt) {
      const expiresAt = new Date(event.detail.expiresAt);
      const now = new Date();
      const msRemaining = expiresAt - now;
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      
      this.aliceMeta = {
        unlockStatus: true,
        remainingDays: Math.max(0, daysRemaining),
        expiresAt: event.detail.expiresAt
      };
      this.aliceLoaded = true;
      
      // Re-render if we're on the page
      const container = document.getElementById('page-content');
      if (container && this.loaded) {
        container.innerHTML = this.render();
        this.attachEventListeners();
      }
    }
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

  /**
   * Pluralize Russian "день" based on count
   * @param {number} n - Number of days
   * @returns {string} Correctly pluralized word
   */
  pluralizeDays(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return 'день';
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'дня';
    }
    return 'дней';
  }

  /**
   * Fetch Alice progress from Achievements endpoint (source of truth)
   * @returns {Promise<Object>} Alice progress data
   */
  async fetchAliceProgress() {
    const initData = window.Telegram?.WebApp?.initData || '';
    const headers = initData ? { 'X-Telegram-InitData': initData, 'Content-Type': 'application/json' } : {};
    const res = await fetch('/api/reader/gamification/progress/alice', { credentials: 'include', headers });
    if (!res.ok) throw new Error(`Alice progress HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Compute Alice state based on progress metadata
   * Uses authoritative data from server: hasAccess, claimed, expiresAt, remainingDays
   * @param {Object} meta - Alice metadata from progress endpoint
   * @returns {Object} State object with state and remainingDays
   */
  computeAliceState(meta = {}) {
    // Use authoritative hasAccess field from server
    const hasAccess = meta?.hasAccess === true;
    const claimed = meta?.claimed === true;
    const remainingDays = Number(meta?.remainingDays || 0);

    // Active state: user has current valid access
    if (hasAccess && remainingDays > 0) {
      return { state: 'active', remainingDays };
    }

    // Expired state: badge was claimed but access expired
    if (claimed && !hasAccess) {
      return { state: 'expired' };
    }

    // Locked state: badge not claimed yet
    return { state: 'locked' };
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
    const s = this.computeAliceState(this.aliceMeta || {});
    const remainingDays = s.remainingDays || 0;

    if (s.state === 'locked') {
      return `
        <div class="book-card alice-card locked" data-id="alice_wonderland">
          <div class="book-main">
            <div class="book-cover cover-1">
              <img class="book-cover-img" src="/mini-app/assets/audio-covers/alice.svg" alt="Алиса в стране чудес" onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
              <div class="lock-overlay"><span class="lock-icon">🔒</span></div>
            </div>
            <div class="book-info">
              <div class="book-header">
                <div>
                  <div class="book-title">Разбор: «Алиса в стране чудес»</div>
                  <div class="book-author">Льюис Кэрролл</div>
                </div>
              </div>
              <div class="book-description">Эксклюзивный аудиоразбор классического произведения</div>
            </div>
          </div>
          <div class="book-footer">
            <div class="book-pricing">
              <div class="book-price">
                Требуется бейдж
                <img src="/mini-app/assets/badges/alice.png" alt="Бейдж Алиса" class="footer-badge-icon" onerror="this.src='/assets/badges/alice.svg'" />
              </div>
            </div>
            <button class="buy-button" data-action="go-achievements">Получить доступ</button>
          </div>
        </div>
      `;
    }

    if (s.state === 'active') {
      const label = remainingDays >= 30 ? 'Доступен: 1 месяц' : `Осталось ${remainingDays} ${this.pluralizeDays(remainingDays)}`;
      return `
        <div class="book-card alice-card" data-id="alice_wonderland">
          <div class="book-main">
            <div class="book-cover cover-1">
              <img class="book-cover-img" src="/mini-app/assets/audio-covers/alice.svg" alt="Алиса в стране чудес" onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
              <div class="cover-fallback-text" style="display:none;">Алиса в стране чудес</div>
            </div>
            <div class="book-info">
              <div class="book-header">
                <div>
                  <div class="book-title">Разбор: «Алиса в стране чудес»</div>
                  <div class="book-author">Льюис Кэрролл</div>
                </div>
              </div>
              <div class="book-description">Эксклюзивный аудиоразбор классического произведения</div>
            </div>
          </div>
          <div class="book-footer">
            <div class="book-pricing"><div class="book-price">${label}</div></div>
            <button class="buy-button" data-id="alice_wonderland">Прослушать</button>
          </div>
        </div>
      `;
    }

    // expired — «Доступ окончен», без кнопок
    return `
      <div class="book-card alice-card expired" data-id="alice_wonderland">
        <div class="book-main">
          <div class="book-cover cover-1">
            <img class="book-cover-img" src="/mini-app/assets/audio-covers/alice.svg" alt="Алиса в стране чудес" onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
            <div class="cover-fallback-text" style="display:none;">Алиса в стране чудес</div>
          </div>
          <div class="book-info">
            <div class="book-header">
              <div>
                <div class="book-title">Разбор: «Алиса в стране чудес»</div>
                <div class="book-author">Льюис Кэрролл</div>
              </div>
            </div>
            <div class="book-description">Эксклюзивный аудиоразбор классического произведения</div>
          </div>
        </div>
        <div class="book-footer">
          <div class="book-pricing"><div class="book-price">Доступ окончен</div></div>
        </div>
      </div>
    `;
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
    
    // Filter out alice_wonderland from the generic list to avoid duplicates
    const filteredItems = Array.isArray(this.items) 
      ? this.items.filter(item => item.id !== 'alice_wonderland')
      : [];
    
    if (filteredItems.length === 0) {
      return `
        ${aliceCardHTML}
        ${this.renderEmptyStateBlock()}
      `;
    }
    return `
      ${aliceCardHTML}
      <div class="cards">
        ${filteredItems.map(x => `
          <div class="book-card" data-id="${this.escape(x.id)}">
            <div class="book-main">
              <div class="book-cover cover-1">
                <img class="book-cover-img" src="${this.escape(x.coverUrl||'')}" alt="${this.escape(x.title)}" loading="lazy" onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
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
        const action = btn.getAttribute('data-action');
        const parentCard = btn.closest('.book-card');
        const id = btn.getAttribute('data-id') || parentCard?.getAttribute('data-id');
        
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
          this.telegram.hapticFeedback('light');
        }
        
        // Handle Alice card special logic
        if (parentCard && parentCard.classList.contains('alice-card')) {
          if (action === 'go-achievements') {
            return this.app.router.navigate('/achievements');
          }
          return this.app.router.navigate(`/free-audios/${encodeURIComponent('alice_wonderland')}`, { state: { id: 'alice_wonderland' } });
        }
        
        // Handle regular audio items
        if (id) {
          this.app.router.navigate(`/free-audios/${encodeURIComponent(id)}`, { state: { id } });
        }
      });
    });

    // Safety: prevent navigation when clicking expired Alice card
    document.querySelectorAll('.book-card.alice-card.expired').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true });
    });
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
      // A. Fetch Alice progress from Achievements endpoint (source of truth)
      try {
        const progress = await this.fetchAliceProgress();
        const unlocked = !!(progress?.unlocked || progress?.claimed || progress?.unlockStatus);
        this._aliceUnlocked = unlocked;
        if (unlocked) {
          try { localStorage.setItem('alice_ever_unlocked', '1'); } catch {}
        }
        // Transfer expiry data to meta for rendering
        if (progress?.expiresAt || progress?.remainingDays != null) {
          this.aliceMeta = {
            ...(this.aliceMeta || {}),
            expiresAt: progress.expiresAt || null,
            remainingDays: Number(progress.remainingDays || 0),
          };
        }
      } catch (e) {
        console.warn('⚠️ FreeAudiosPage: Alice progress failed', e);
        // Without progress, treat as locked (don't break UI)
        this._aliceUnlocked = false;
        this.aliceMeta = { ...(this.aliceMeta || {}), remainingDays: 0 };
      }
      this.aliceLoaded = true;
      
      // B. Fetch free audio list as before
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
