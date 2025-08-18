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
    const params = new URLSearchParams({ 
      limit: String(limit), 
      sort: '-createdAt' 
    });
    const res = await fetch(`/api/reader/quotes?${params.toString()}`, { 
      method: 'GET' 
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