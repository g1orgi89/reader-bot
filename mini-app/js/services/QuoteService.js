// Простые вызовы API для цитат
window.QuoteService = {
  /**
   * Удаление цитаты
   * @param {string} id ID цитаты для удаления
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteQuote(id) {
    const res = await fetch(`/api/reader/quotes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DELETE failed: ${res.status} ${text}`);
    }
    try { 
      return await res.json(); 
    } catch { 
      return { ok: true }; 
    }
  },

  /**
   * Обновление цитаты
   * @param {string} id ID цитаты для обновления
   * @param {Object} payload Данные для обновления
   * @returns {Promise<Object>} Обновленная цитата
   */
  async updateQuote(id, payload) {
    const res = await fetch(`/api/reader/quotes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PATCH failed: ${res.status} ${text}`);
    }
    return await res.json();
  },

  /**
   * Получение последних цитат
   * @param {number} limit Количество цитат (по умолчанию 3)
   * @returns {Promise<Array>} Массив последних цитат
   */
  async getLatestQuotes(limit = 3) {
    // Derive userId from available sources
    let userId = 'demo-user';
    
    // Try App.state first
    if (window.App && window.App.state && typeof window.App.state.getCurrentUserId === 'function') {
      const stateUserId = window.App.state.getCurrentUserId();
      if (stateUserId && stateUserId !== 'demo-user') {
        userId = stateUserId;
      }
    }
    
    // Try Telegram WebApp
    if (userId === 'demo-user' && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
      userId = window.Telegram.WebApp.initDataUnsafe.user.id;
    }
    
    // Dev fallbacks
    if (userId === 'demo-user') {
      // URL parameter fallback
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('userId')) {
        userId = urlParams.get('userId');
      }
      
      // localStorage fallback
      if (userId === 'demo-user' && localStorage.getItem('APP_DEV_USER_ID')) {
        userId = localStorage.getItem('APP_DEV_USER_ID');
      }
    }
    
    const params = new URLSearchParams({ 
      limit: String(limit), 
      sort: '-createdAt',
      userId: String(userId)
    });
    const res = await fetch(`/api/reader/quotes?${params.toString()}`, { 
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GET latest failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.data || data?.quotes || []);
  },

  /**
   * Лайк/дизлайк цитаты
   * @param {string} id ID цитаты
   * @param {boolean} isFavorite Статус избранного
   * @returns {Promise<Object>} Результат обновления
   */
  async toggleFavorite(id, isFavorite) {
    return this.updateQuote(id, { isFavorite });
  }
};