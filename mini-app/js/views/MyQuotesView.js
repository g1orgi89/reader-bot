// Логика «…» и удаление для «Моих цитат»
window.MyQuotesView = class MyQuotesView {
  /**
   * @param {HTMLElement} root контейнер списка цитат (.my-quotes)
   */
  constructor(root) {
    this.root = root;
    this._onClick = this._onClick.bind(this);
    this._observer = null;
  }

  mount() {
    if (!this.root) return;
    this.root.addEventListener('click', this._onClick, false);
    // Гарантируем наличие кнопки «…» у всех карточек
    this._ensureKebabButtons();
    // Следим за динамическими вставками карточек
    this._observeDom();
  }

  unmount() {
    if (!this.root) return;
    this.root.removeEventListener('click', this._onClick, false);
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  _getApp() {
    const app = window.app || window.App || window.readerApp;
    if (!app || !app.api) {
      throw new Error('App instance not available');
    }
    return app;
  }
  
  _observeDom() {
    try {
      this._observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type !== 'childList') continue;
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            // Check if the node itself is a quote card
            if (node.matches?.('.quote-card, .quote-item, [data-quote-id]')) {
              this._ensureKebabForCard(node);
            }
            // Check for quote cards within the added node
            const cards = node.querySelectorAll?.('.quote-card, .quote-item, [data-quote-id]');
            cards?.forEach((card) => this._ensureKebabForCard(card));
          });
        }
      });
      this._observer.observe(this.root, { childList: true, subtree: true });
    } catch (e) {
      console.debug('MutationObserver not available:', e);
    }
  }

  _ensureKebabButtons() {
    // Find all quote cards regardless of their specific class
    const cards = this.root.querySelectorAll('.quote-card, .quote-item, [data-quote-id]');
    cards.forEach((card) => this._ensureKebabForCard(card));
  }

  _ensureKebabForCard(card) {
    // Support multiple card types: .quote-card, .quote-item, or elements with data-quote-id
    if (!card || (!card.classList?.contains('quote-card') && 
                  !card.classList?.contains('quote-item') && 
                  !card.hasAttribute('data-quote-id'))) return;
    if (!card.querySelector('.quote-kebab')) {
      const kebab = document.createElement('button');
      kebab.className = 'quote-kebab';
      kebab.setAttribute('aria-label', 'Действия');
      kebab.title = 'Действия';
      kebab.textContent = '…';
      card.appendChild(kebab);
    }
    // Если действия уже есть, синхронизируем сердечко
    const actions = card.querySelector('.quote-actions-inline');
    if (actions) {
      const likeBtn = actions.querySelector('[data-action="like"]');
      if (likeBtn) {
        const isLiked = card.classList.contains('liked');
        likeBtn.textContent = isLiked ? '❤️' : '🤍';
      }
    }
  }

  _onClick(e) {
    const kebabBtn = e.target.closest('.quote-kebab');
    if (kebabBtn) {
      // Support multiple card container types
      const card = e.target.closest('.quote-card, .quote-item, [data-quote-id]');
      if (!card) return;
      card.classList.toggle('expanded');
      this._haptic('impact', 'light');
      this._ensureActionsInline(card);
      return;
    }

    const actionBtn = e.target.closest('.action-btn');
    if (actionBtn) {
      // Support multiple card container types
      const card = e.target.closest('.quote-card, .quote-item, [data-quote-id]');
      if (!card) return;
      const id =
        card.dataset.id ||
        card.dataset.quoteId ||
        card.getAttribute('data-quote-id') ||
        card.querySelector('[data-id]')?.dataset.id ||
        card.querySelector('[data-quote-id]')?.getAttribute('data-quote-id');

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
      const app = this._getApp();

      // Дожидаемся валидного userId (если метод есть), иначе берём из state/api
      const userId =
        (await app.waitForValidUserId?.().catch(() => null)) ||
        app.state?.getCurrentUserId?.() ||
        app.api.resolveUserId();

      await app.api.deleteQuote(id, userId);

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
    // Два канала: событие + переход, чтобы гарантировать работу
    document.dispatchEvent(new CustomEvent('quotes:edit', { detail: { id } }));
    if (window?.App?.router?.navigate) {
      window.App.router.navigate(`/diary?quote=${id}&action=edit`);
    }
    this._haptic('impact', 'light');
  }

  async _likeQuote(card, id) {
    const wasLiked = card.classList.contains('liked');
    const newLikedState = !wasLiked;

    // Оптимистично изменяем UI
    card.classList.toggle('liked', newLikedState);
    this._haptic('impact', 'light');

    const likeBtn = card.querySelector('[data-action="like"]');
    if (likeBtn) {
      likeBtn.textContent = newLikedState ? '❤️' : '🤍';
    }

    try {
      const app = this._getApp();
      const quotes = app.state.get('quotes.items') || [];
      const quote = quotes.find(q => q._id === id || q.id === id);
      if (!quote) throw new Error('Quote not found');

      const updateData = {
        text: quote.text,
        author: quote.author,
        isFavorite: newLikedState
        source: quote.source
      };
      await app.api.updateQuote(id, updateData);
      document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'liked', id } }));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Откат UI
      card.classList.toggle('liked', wasLiked);
      if (likeBtn) {
        likeBtn.textContent = wasLiked ? '❤️' : '🤍';
      }
      this._haptic('notification', 'error');
    }
  }

  _haptic(type, style) {
    try {
      const HF = window.Telegram?.WebApp?.HapticFeedback;
      if (!HF) return;
      if (type === 'impact') HF.impactOccurred(style || 'light');
      if (type === 'notification') HF.notificationOccurred(style || 'success');
    } catch (error) {
      console.debug('Haptic feedback not available:', error);
    }
  }
};
