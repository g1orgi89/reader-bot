// Рендер «Последние цитаты» и синхронизация
window.HomeView = class HomeView {
  /**
   * @param {HTMLElement} root контейнер главной страницы
   */
  constructor(root) {
    this.root = root;
    this.latestContainer = null;
    this._onQuotesChanged = this._onQuotesChanged.bind(this);
  }

  mount() {
    if (!this.root) return;
    this.latestContainer = document.getElementById('home-latest-quotes');
    document.addEventListener('quotes:changed', this._onQuotesChanged, false);
    this.renderLatestQuotes();
  }

  unmount() {
    document.removeEventListener('quotes:changed', this._onQuotesChanged, false);
  }

  async renderLatestQuotes() {
    if (!this.latestContainer) return;
    try {
      const latest = await window.QuoteService.getLatestQuotes(3);
      this.latestContainer.innerHTML = this._renderLatestQuotesSection(latest);
      this.latestContainer.style.display = 'block';
    } catch (e) {
      console.error('Failed to load latest quotes', e);
      this.latestContainer.innerHTML = '';
      this.latestContainer.style.display = 'none';
    }
  }

  _renderLatestQuotesSection(quotes) {
    if (!Array.isArray(quotes) || quotes.length === 0) {
      return `
        <div class="recent-quotes-section">
          <div class="section-title">💫 Последние цитаты</div>
          <div class="empty-recent-quotes">
            <p>✍️ Добавьте первую цитату, чтобы она появилась здесь</p>
          </div>
        </div>
      `;
    }

    const quotesHtml = quotes.map(q => this._renderQuoteItem(q)).join('');
    return `
      <div class="recent-quotes-section">
        <div class="section-title">💫 Последние цитаты</div>
        <div class="recent-quotes-list">
          ${quotesHtml}
        </div>
      </div>
    `;
  }

  _renderQuoteItem(q) {
    const author = q.author ? `— ${q.author}` : '';
    const text = q.text || '';
    const truncatedText = text.length > 120 ? text.substring(0, 120) + '...' : text;
    
    return `
      <article class="quote-card recent-quote-item" data-id="${q._id || q.id}">
        <button class="quote-kebab" aria-label="menu" title="Действия">…</button>
        <div class="quote-text">${this._escape(truncatedText)}</div>
        ${author ? `<div class="quote-author">${this._escape(author)}</div>` : ''}
        <div class="quote-actions-inline"></div>
      </article>
    `;
  }

  _onQuotesChanged() {
    this.renderLatestQuotes();
  }

  _escape(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
};