/**
 * 🎵 Бесплатные аудиоразборы — верхние табы .tabs/.tab, мгновенный переход
 */
class FreeAudiosPage {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.state = app.state;
    this.telegram = app.telegram;
    this.items = [];
  }

  async init() { 
    this.items = []; 
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

  renderList() {
    if (!Array.isArray(this.items) || this.items.length === 0) {
      return `
        <div class="cards">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-text">Загружаем бесплатные аудиоразборы...</div>
          </div>
        </div>
      `;
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
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        try {
          const resp = await fetch(`/api/audio/${encodeURIComponent(id)}`, { credentials: 'include' });
          const meta = await resp.json();
          const url = meta?.audioUrl || `/media/free/${encodeURIComponent(id)}.mp3`;
          if (this.telegram && this.telegram.openLink) {
            this.telegram.openLink(url);
          } else {
            window.open(url, '_blank');
          }
        } catch {
          const fallback = `/media/free/${encodeURIComponent(id)}.mp3`;
          if (this.telegram && this.telegram.openLink) {
            this.telegram.openLink(fallback);
          } else {
            window.open(fallback, '_blank');
          }
        }
      });
    });
  }

  async onShow() {
    try {
      const res = await fetch('/api/audio/free', { credentials: 'include' });
      const list = await res.json();
      this.items = Array.isArray(list) ? list : (list?.data || []);
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
    } catch (e) { 
      console.warn('⚠️ FreeAudiosPage load failed:', e); 
    }
  }

  onHide() {}
}
window.FreeAudiosPage = FreeAudiosPage;
