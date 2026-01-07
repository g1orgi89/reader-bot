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
  }

  init() {
    this.items = [];
    this.loaded = false;
  }

  renderTopTabs() {
    const normalized = this.app?.router?.normalizePath?.(window.location.hash.slice(1)) || '/free-audios';
    const isCatalog = normalized === '/catalog';
    return `
      <div class="tabs">
        <button class="tab ${isCatalog ? 'active' : ''}" data-href="/catalog">Каталог</button>
        <button class="tab ${!isCatalog ? 'active' : ''}" data-href="/free-audios">Аудио</button>
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
    if (!Array.isArray(this.items) || this.items.length === 0) {
      return this.renderEmptyStateBlock();
    }
    return `
      <div class="cards">
        ${this.items.map(x => `
          <div class="book-card" data-id="${this.escape(x.id)}">
            <div class="book-main">
              <div class="book-cover cover-1">
                <img class="book-cover-img" src="${this.escape(x.coverUrl||'')}" alt="${this.escape(x.title)}" onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
                <div class="cover-fallback-text fallback">${this.escape(x.title)}</div>
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
        this.app.router.navigate(`/free-audios/${encodeURIComponent(id)}`);
      });
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
