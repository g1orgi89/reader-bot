// Рендер «Последние цитаты» и синхронизация
window.HomeView = class HomeView {
  /**
   * @param {HTMLElement} root контейнер главной страницы
   */
  constructor(root) {
    this.root = root;
    this.latestContainer = null;
    this._onQuotesChanged = this._onQuotesChanged.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  mount() {
    if (!this.root) return;
    this.latestContainer = document.getElementById('home-latest-quotes');
    document.addEventListener('quotes:changed', this._onQuotesChanged, false);
    // Add click event delegation for kebab and action buttons
    if (this.root) {
      this.root.addEventListener('click', this._onClick, false);
    }
    this.renderLatestQuotes();
  }

  unmount() {
    document.removeEventListener('quotes:changed', this._onQuotesChanged, false);
    if (this.root) {
      this.root.removeEventListener('click', this._onClick, false);
    }
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
    
    // Check if quote is favorited to add liked class
    const likedClass = q.isFavorite ? ' liked' : '';
    
    return `
      <article class="quote-card recent-quote-item${likedClass}" data-id="${q._id || q.id}">
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

  _onClick(e) {
    const kebabBtn = e.target.closest('.quote-kebab');
    if (kebabBtn) {
      const card = e.target.closest('.quote-card');
      if (!card) return;
      card.classList.toggle('expanded');
      this._haptic('impact', 'light');
      this._ensureActionsInline(card);
      return;
    }

    const actionBtn = e.target.closest('.action-btn');
    if (actionBtn) {
      const card = e.target.closest('.quote-card');
      if (!card) return;
      const id = card.dataset.id || card.dataset.quoteId;
      const action = actionBtn.dataset.action;
      if (action === 'delete') return this._deleteQuote(card, id);
      if (action === 'edit') return this._editQuote(card, id);
      if (action === 'like') return this._likeQuote(card, id);
    }
  }

  _ensureActionsInline(card) {
    let actions = card.querySelector('.quote-actions-inline');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'quote-actions-inline';
      
      // Check if card is liked to show correct heart icon
      const isLiked = card.classList.contains('liked');
      const heartIcon = isLiked ? '❤️' : '🤍';
      
      actions.innerHTML = `
        <button class="action-btn" data-action="edit" aria-label="Редактировать цитату" title="Редактировать">✏️</button>
        <button class="action-btn" data-action="like" aria-label="Добавить в избранное" title="Избранное">${heartIcon}</button>
        <button class="action-btn action-delete" data-action="delete" aria-label="Удалить цитату" title="Удалить">🗑️</button>
      `;
      card.appendChild(actions);
    } else {
      // Update heart icon if actions already exist
      const likeBtn = actions.querySelector('[data-action="like"]');
      if (likeBtn) {
        const isLiked = card.classList.contains('liked');
        likeBtn.textContent = isLiked ? '❤️' : '🤍';
      }
    }
  }

  async _deleteQuote(card, id) {
    if (!id) return;
    const ok = window.confirm('Удалить эту цитату? Это действие нельзя отменить.');
    if (!ok) return;
    try {
      await window.QuoteService.deleteQuote(id);
      card.remove();
      this._haptic('notification', 'success');
      document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'deleted', id } }));
    } catch (e) {
      console.error(e);
      this._haptic('notification', 'error');
      alert('Не удалось удалить цитату. Повторите позже.');
    }
  }

  _editQuote(card, id) {
    document.dispatchEvent(new CustomEvent('quotes:edit', { detail: { id } }));
    this._haptic('impact', 'light');
  }

  _likeQuote(card, id) {
    const isLiked = card.classList.contains('liked');
    const newLikedState = !isLiked;
    
    // Оптимистично обновляем UI
    card.classList.toggle('liked', newLikedState);
    this._haptic('impact', 'light');
    
    // Update heart icon immediately
    const likeBtn = card.querySelector('[data-action="like"]');
    if (likeBtn) {
      likeBtn.textContent = newLikedState ? '❤️' : '🤍';
    }
    
    // Пытаемся обновить на сервере
    window.QuoteService.toggleFavorite(id, newLikedState).then(() => {
      document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'liked', id } }));
    }).catch((error) => {
      console.error('Failed to toggle favorite:', error);
      // Откатываем изменение UI при ошибке
      card.classList.toggle('liked', isLiked);
      // Revert heart icon on error
      if (likeBtn) {
        likeBtn.textContent = isLiked ? '❤️' : '🤍';
      }
      this._haptic('notification', 'error');
    });
  }

  _haptic(type, style) {
    try {
      const HF = window.Telegram?.WebApp?.HapticFeedback;
      if (!HF) return;
      if (type === 'impact') HF.impactOccurred(style || 'light');
      if (type === 'notification') HF.notificationOccurred(style || 'success');
    } catch (error) {
      // Telegram WebApp may not be available in all environments
      console.debug('Haptic feedback not available:', error);
    }
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