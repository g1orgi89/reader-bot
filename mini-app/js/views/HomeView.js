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
    // Делегирование кликов по «…» и action-кнопкам
    this.root.addEventListener('click', this._onClick, false);
    this.renderLatestQuotes();
  }

  unmount() {
    document.removeEventListener('quotes:changed', this._onQuotesChanged, false);
    if (this.root) this.root.removeEventListener('click', this._onClick, false);
  }

  _getUserId() {
    return (
      window?.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
      window?.App?.state?.get?.('user.id') ||
      localStorage.getItem('userId')
    );
  }

  // Берём последние N цитат из общего состояния (если там уже есть «Мои цитаты»)
  _pickLatestFromState(limit = 3) {
    try {
      const items = window?.App?.state?.get?.('quotes.items') || [];
      if (!Array.isArray(items) || items.length === 0) return [];
      return items
        .filter(q => q?.createdAt || q?.dateAdded)
        .sort((a, b) => new Date(b.createdAt || b.dateAdded) - new Date(a.createdAt || a.dateAdded))
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  async renderLatestQuotes() {
    if (!this.latestContainer) return;
    try {
      // 1) Пробуем отрендерить из уже загруженных «Моих цитат»
      const fromState = this._pickLatestFromState(3);
      if (fromState.length) {
        this.latestContainer.innerHTML = this._renderLatestQuotesSection(fromState);
        this.latestContainer.style.display = 'block';
        this._addActiveHandlers();
        return;
      }

      // 2) Если в состоянии пусто — идём в API с userId и безопасным парсингом
      let quotes = [];
      try {
        const userId = this._getUserId();
        const response = await window.App.api.getQuotes({ limit: 3 }, userId);
        quotes = response.data?.quotes || response.quotes || response.items || [];
      } catch (serviceError) {
        console.warn('ApiService.getQuotes failed:', serviceError);
        // Можно показать ошибку, но не надо создавать новый экземпляр ApiService!
        quotes = [];
      }

      this.latestContainer.innerHTML = this._renderLatestQuotesSection(quotes);
      this.latestContainer.style.display = 'block';
      this._addActiveHandlers();
    } catch (error) {
      console.error('renderLatestQuotes error:', error);
      // Показываем пустое состояние (не скрываем секцию), чтобы был понятный UI
      this.latestContainer.innerHTML = this._renderLatestQuotesSection([]);
      this.latestContainer.style.display = 'block';
      this._addActiveHandlers();
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
    const likedClass = q.isFavorite ? ' liked' : '';

    return `
      <article class="quote-card recent-quote-item${likedClass}" data-id="${q._id || q.id}" data-quote-id="${q._id || q.id}">
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
      return;
    }

    // Handle card selection (tap on card itself, not on action buttons)
    const cardTap = e.target.closest('.quote-card, .recent-quote-item');
    if (cardTap && !e.target.closest('.action-btn, .quote-kebab')) {
      if (this.latestContainer) {
        this.latestContainer.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
      }
      cardTap.classList.add('active');
      this._haptic('impact', 'light');
    }
  }

  _ensureActionsInline(card) {
    let actions = card.querySelector('.quote-actions-inline');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'quote-actions-inline';

      const isLiked = card.classList.contains('liked');
      const heartIcon = isLiked ? '❤️' : '🤍';

      actions.innerHTML = `
        <button class="action-btn" data-action="edit" aria-label="Редактировать цитату" title="Редактировать">✏️</button>
        <button class="action-btn" data-action="like" aria-label="Добавить в избранное" title="Избранное">${heartIcon}</button>
        <button class="action-btn action-delete" data-action="delete" aria-label="Удалить цитату" title="Удалить">🗑️</button>
      `;
      card.appendChild(actions);
    } else {
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
    if (window?.App?.router?.navigate) {
      window.App.router.navigate(`/diary?quote=${id}&action=edit`);
    }
    this._haptic('impact', 'light');
  }

  _likeQuote(card, id) {
    const isLiked = card.classList.contains('liked');
    const newLikedState = !isLiked;

    card.classList.toggle('liked', newLikedState);
    this._haptic('impact', 'light');

    const likeBtn = card.querySelector('[data-action="like"]');
    if (likeBtn) {
      likeBtn.textContent = newLikedState ? '❤️' : '🤍';
    }

    window.QuoteService.toggleFavorite(id, newLikedState).then(() => {
      document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'liked', id } }));
    }).catch((error) => {
      console.error('Failed to toggle favorite:', error);
      card.classList.toggle('liked', isLiked);
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
      // Haptic feedback not available
      console.debug('Haptic feedback not available:', error);
    }
  }

  _escape(s) {
    const div = document.createElement('div');
    div.textContent = s ?? '';
    return div.innerHTML;
  }

  _addActiveHandlers() {
    if (!this.latestContainer) return;
    const items = this.latestContainer.querySelectorAll('.recent-quote-item, .quote-card.recent-quote-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.telegram?.HapticFeedback?.impactOccurred?.('light');
      }, { passive: true });
    });
  }
};
