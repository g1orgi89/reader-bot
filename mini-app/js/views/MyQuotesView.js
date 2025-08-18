// Логика «…» и удаление для «Моих цитат»
window.MyQuotesView = class MyQuotesView {
  /**
   * @param {HTMLElement} root контейнер списка цитат (.my-quotes)
   */
  constructor(root) {
    this.root = root;
    this._onClick = this._onClick.bind(this);
  }

  mount() {
    if (!this.root) return;
    this.root.addEventListener('click', this._onClick, false);
  }

  unmount() {
    if (!this.root) return;
    this.root.removeEventListener('click', this._onClick, false);
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
      actions.innerHTML = `
        <button class="action-btn" data-action="edit">Редактировать</button>
        <button class="action-btn" data-action="like">Лайк</button>
        <button class="action-btn action-delete" data-action="delete">Удалить</button>
      `;
      card.appendChild(actions);
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
    
    // Пытаемся обновить на сервере
    window.QuoteService.toggleFavorite(id, newLikedState).then(() => {
      document.dispatchEvent(new CustomEvent('quotes:changed', { detail: { type: 'liked', id } }));
    }).catch((error) => {
      console.error('Failed to toggle favorite:', error);
      // Откатываем изменение UI при ошибке
      card.classList.toggle('liked', isLiked);
      this._haptic('notification', 'error');
    });
  }

  _haptic(type, style) {
    try {
      const HF = window.Telegram?.WebApp?.HapticFeedback;
      if (!HF) return;
      if (type === 'impact') HF.impactOccurred(style || 'light');
      if (type === 'notification') HF.notificationOccurred(style || 'success');
    } catch {}
  }
};