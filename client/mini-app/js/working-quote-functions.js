/**
 * ✨ ПОЛНОСТЬЮ РАБОЧИЕ функции для управления цитатами v2.0
 * Файл для замены в app.js - содержит улучшенные методы
 * Включает: реальные API вызовы, улучшенный UX, обработку ошибок
 * 
 * @version 2.0
 * @author Reader Bot Team
 */

/**
 * ✨ ОБНОВЛЕННАЯ функция renderQuotesList с РАБОЧИМИ кнопками действий
 * Добавлены: кнопка 3 точки, реальные API вызовы, улучшенный UX
 */
function renderQuotesList(quotes) {
    const container = document.getElementById('quotesList');
    if (!container) return;

    if (!quotes || quotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-title">Дневник пуст</div>
                <div class="empty-state-text">Добавьте первую цитату, чтобы начать собирать мудрость</div>
            </div>
        `;
        return;
    }

    container.innerHTML = quotes.map(quote => {
        const quoteId = quote._id || quote.id;
        return `
            <div class="quote-card" data-quote-id="${quoteId}">
                
                <!-- Кнопка меню действий (3 точки) -->
                <button class="quote-menu-btn" 
                        onclick="event.stopPropagation(); app.toggleQuoteActions('${quoteId}')" 
                        title="Действия с цитатой">
                    ⋮
                </button>
                
                <!-- Основной контент цитаты -->
                <div class="quote-content" onclick="app.toggleQuoteActions('${quoteId}')">
                    <div class="quote-full-text">${this.escapeHtml(quote.text)}</div>
                    <div class="quote-author">— ${this.escapeHtml(quote.author || 'Неизвестный автор')}</div>
                    <div class="quote-meta">
                        <span>${this.formatDate(quote.createdAt)}</span>
                        ${quote.isFavorite ? '<span>❤️ Избранное</span>' : ''}
                    </div>
                    ${quote.analysis ? `
                        <div class="quote-analysis">
                            <div class="analysis-tags">
                                <span class="mood-tag">${quote.analysis.mood}</span>
                                <span class="category-tag">${quote.analysis.category}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- ✨ РАБОЧИЕ inline кнопки действий -->
                <div class="quote-actions-inline" id="actions-${quoteId}" style="display: none;">
                    <button class="action-btn edit-btn" 
                            onclick="event.stopPropagation(); app.editQuote('${quoteId}')" 
                            title="Редактировать цитату">
                        <span class="btn-icon">✏️</span>
                        <span class="btn-text">Редактировать</span>
                    </button>
                    <button class="action-btn favorite-btn ${quote.isFavorite ? 'active' : ''}" 
                            onclick="event.stopPropagation(); app.toggleFavorite('${quoteId}')" 
                            title="${quote.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                        <span class="btn-icon">${quote.isFavorite ? '❤️' : '🤍'}</span>
                        <span class="btn-text">${quote.isFavorite ? 'Избранное' : 'В избранное'}</span>
                    </button>
                    <button class="action-btn delete-btn" 
                            onclick="event.stopPropagation(); app.deleteQuote('${quoteId}')" 
                            title="Удалить цитату">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">Удалить</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * ✨ ИНСТРУКЦИИ ДЛЯ ЗАМЕНЫ В app.js:
 * 
 * 1. Найти существующую функцию renderQuotesList() в классе ReaderApp
 * 2. Заменить её на функцию выше (без "function", как метод класса)
 * 3. Найти существующие методы toggleQuoteActions, editQuote, toggleFavorite, deleteQuote
 * 4. Заменить их на улучшенные версии ниже
 * 
 * ВАЖНО: Убрать "function" в начале - это методы класса!
 */

/**
 * ✨ УЛУЧШЕННЫЕ МЕТОДЫ для замены в классе ReaderApp:
 */

// toggleQuoteActions - УЛУЧШЕННАЯ ВЕРСИЯ
toggleQuoteActions(quoteId) {
    console.log('📱 Переключение действий для цитаты:', quoteId);
    
    // Скрываем кнопки других цитат
    this.hideAllQuoteActions();
    
    // Переключаем кнопки текущей цитаты
    const actionsEl = document.getElementById(`actions-${quoteId}`);
    if (actionsEl) {
        const isVisible = actionsEl.style.display !== 'none';
        
        if (isVisible) {
            // Скрываем кнопки с анимацией
            actionsEl.style.transition = 'all 0.3s ease';
            actionsEl.style.opacity = '0';
            actionsEl.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                actionsEl.style.display = 'none';
            }, 300);
            
            this.selectedQuoteId = null;
        } else {
            // Показываем кнопки с анимацией
            actionsEl.style.display = 'flex';
            actionsEl.style.opacity = '0';
            actionsEl.style.transform = 'translateY(-10px)';
            
            // Принудительно запускаем reflow перед анимацией
            actionsEl.offsetHeight;
            
            setTimeout(() => {
                actionsEl.style.transition = 'all 0.3s ease';
                actionsEl.style.opacity = '1';
                actionsEl.style.transform = 'translateY(0)';
            }, 10);
            
            this.selectedQuoteId = quoteId;
            this.triggerHaptic('light');
        }
    }
}

// hideAllQuoteActions - УЛУЧШЕННАЯ ВЕРСИЯ
hideAllQuoteActions() {
    document.querySelectorAll('.quote-actions-inline').forEach(actionsEl => {
        if (actionsEl.style.display !== 'none') {
            actionsEl.style.transition = 'all 0.3s ease';
            actionsEl.style.opacity = '0';
            actionsEl.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                actionsEl.style.display = 'none';
            }, 300);
        }
    });
    this.selectedQuoteId = null;
}

// editQuote - ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ
async editQuote(quoteId) {
    console.log('✏️ Начинаем редактирование цитаты:', quoteId);
    
    // Скрываем inline кнопки
    this.hideAllQuoteActions();
    
    // Показываем индикатор загрузки
    this.showLoading(true);
    
    try {
        // Ищем цитату в state или загружаем через API
        let quote = this.state.quotes.find(q => {
            const id = q._id || q.id;
            return id === quoteId;
        });
        
        // Если цитаты нет в локальном состоянии, загружаем через API
        if (!quote && this.apiClient) {
            console.log('📡 Загружаем цитату через API...');
            const response = await this.apiClient.getQuoteById(quoteId);
            if (response && response.success) {
                quote = response.quote;
            }
        }
        
        if (!quote) {
            throw new Error('Цитата не найдена');
        }
        
        console.log('✅ Цитата найдена для редактирования:', quote);
        
        // Сохраняем цитату в режиме редактирования
        this.editingQuote = quote;
        
        // Переходим на страницу добавления/редактирования
        this.showPage('add');
        
        // Заполняем форму данными цитаты
        const textEl = document.getElementById('quoteText');
        const authorEl = document.getElementById('quoteAuthor');
        
        if (textEl) {
            textEl.value = quote.text;
            textEl.focus(); // Фокус на поле для удобства
        }
        if (authorEl) {
            authorEl.value = quote.author || '';
        }
        
        // Обновляем счетчик символов
        const counter = document.querySelector('.char-counter');
        if (counter) {
            const length = quote.text.length;
            counter.textContent = `${length}/500`;
            
            // Обновляем цвет счетчика
            if (length > 450) {
                counter.style.color = 'var(--text-danger)';
            } else if (length > 400) {
                counter.style.color = 'var(--text-accent)';
            } else {
                counter.style.color = 'var(--text-secondary)';
            }
        }
        
        // Меняем кнопку на "Обновить"
        const saveBtn = document.getElementById('saveButton');
        if (saveBtn) {
            saveBtn.textContent = 'Обновить цитату';
            saveBtn.onclick = () => this.updateQuote();
            
            // Добавляем визуальный индикатор режима редактирования
            saveBtn.classList.add('edit-mode');
        }
        
        // Добавляем заголовок режима редактирования
        const pageTitle = document.querySelector('#add .page-title');
        if (pageTitle) {
            pageTitle.textContent = 'Редактировать цитату';
        }
        
        this.triggerHaptic('success');
        this.showSuccess('Режим редактирования активирован');
        
    } catch (error) {
        console.error('❌ Ошибка редактирования цитаты:', error);
        this.showError('Не удалось загрузить цитату для редактирования');
    } finally {
        this.showLoading(false);
    }
}

// toggleFavorite - ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ
async toggleFavorite(quoteId) {
    console.log('❤️ Переключение избранного для цитаты:', quoteId);
    
    // Находим кнопку для обновления UI
    const favoriteBtn = document.querySelector(`#actions-${quoteId} .favorite-btn`);
    const originalContent = favoriteBtn ? favoriteBtn.innerHTML : '';
    
    try {
        // Показываем индикатор загрузки в кнопке
        if (favoriteBtn) {
            favoriteBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Обновляю...</span>';
            favoriteBtn.disabled = true;
        }
        
        if (this.apiClient) {
            console.log('📡 Отправляем запрос на изменение избранного...');
            const result = await this.apiClient.toggleQuoteFavorite(quoteId);
            
            if (result.success) {
                // Обновляем локальное состояние
                const quoteIndex = this.state.quotes.findIndex(q => 
                    (q._id || q.id) === quoteId
                );
                
                if (quoteIndex !== -1) {
                    this.state.quotes[quoteIndex].isFavorite = result.isFavorite;
                }
                
                const message = result.isFavorite ? 'Добавлено в избранное ❤️' : 'Удалено из избранного 💔';
                this.showSuccess(message);
                
                // Обновляем отображение списка цитат
                await this.loadAllQuotes();
                
                this.triggerHaptic('success');
                
            } else {
                throw new Error(result.error || 'Ошибка изменения статуса избранного');
            }
        } else {
            // ДЕМО режим - обновление в локальных данных
            console.log('🔄 Демо режим: обновление избранного локально');
            
            const quoteIndex = this.state.quotes.findIndex(q => 
                (q._id || q.id) === quoteId
            );
            
            if (quoteIndex !== -1) {
                this.state.quotes[quoteIndex].isFavorite = !this.state.quotes[quoteIndex].isFavorite;
                const isFavorite = this.state.quotes[quoteIndex].isFavorite;
                
                const message = isFavorite ? 'Добавлено в избранное ❤️' : 'Удалено из избранного 💔';
                this.showSuccess(message);
                
                // Обновляем отображение
                this.renderQuotesList(this.state.quotes);
                this.triggerHaptic('success');
                
            } else {
                throw new Error('Цитата не найдена в локальных данных');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка изменения избранного:', error);
        this.showError('Не удалось изменить статус избранного');
        
        // Восстанавливаем оригинальное содержимое кнопки
        if (favoriteBtn) {
            favoriteBtn.innerHTML = originalContent;
        }
    } finally {
        // Разблокируем кнопку
        if (favoriteBtn) {
            favoriteBtn.disabled = false;
        }
    }
}

// deleteQuote - ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ
async deleteQuote(quoteId) {
    console.log('🗑️ Запрос удаления цитаты:', quoteId);
    
    // Находим цитату для отображения в подтверждении
    const quote = this.state.quotes.find(q => (q._id || q.id) === quoteId);
    const quotePreview = quote ? 
        `"${quote.text.substring(0, 50)}${quote.text.length > 50 ? '...' : ''}"\n\n` : 
        '';
    
    const confirmMessage = `Вы уверены, что хотите удалить эту цитату?\n\n${quotePreview}Это действие нельзя отменить.`;
    
    // Показываем подтверждение
    if (this.telegramManager?.tg?.showConfirm) {
        this.telegramManager.tg.showConfirm(confirmMessage, (confirmed) => {
            if (confirmed) {
                this.performDeleteQuote(quoteId);
            }
        });
    } else {
        if (confirm(confirmMessage)) {
            this.performDeleteQuote(quoteId);
        }
    }
}

// performDeleteQuote - ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ
async performDeleteQuote(quoteId) {
    console.log('🗑️ Выполняем удаление цитаты:', quoteId);
    
    // Скрываем кнопки действий
    this.hideAllQuoteActions();
    
    // Показываем индикатор загрузки
    this.showLoading(true);
    
    try {
        if (this.apiClient) {
            console.log('📡 Отправляем запрос на удаление через API...');
            const result = await this.apiClient.deleteQuote(quoteId);
            
            if (result.success) {
                // Удаляем из локального состояния
                this.state.quotes = this.state.quotes.filter(q => 
                    (q._id || q.id) !== quoteId
                );
                
                this.showSuccess('Цитата успешно удалена 🗑️');
                
                // Обновляем все связанные данные
                await Promise.all([
                    this.loadUserStats(),
                    this.loadRecentQuotes(),
                    this.loadAllQuotes()
                ]);
                
                this.triggerHaptic('success');
                
            } else {
                throw new Error(result.error || 'Ошибка удаления на сервере');
            }
        } else {
            // ДЕМО режим - удаление из локальных данных
            console.log('🔄 Демо режим: удаление цитаты локально');
            
            const quoteIndex = this.state.quotes.findIndex(q => 
                (q._id || q.id) === quoteId
            );
            
            if (quoteIndex !== -1) {
                // Удаляем цитату
                this.state.quotes.splice(quoteIndex, 1);
                
                this.showSuccess('Цитата удалена 🗑️');
                
                // Обновляем отображение
                this.loadRecentQuotes();
                this.renderQuotesList(this.state.quotes);
                
                // Обновляем счетчик в заголовке дневника
                const subtitle = document.getElementById('diarySubtitle');
                if (subtitle) {
                    subtitle.textContent = `${this.state.quotes.length} записей о мудрости`;
                }
                
                this.triggerHaptic('success');
                
            } else {
                throw new Error('Цитата не найдена в локальных данных');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка удаления цитаты:', error);
        this.showError('Не удалось удалить цитату: ' + error.message);
    } finally {
        this.showLoading(false);
    }
}

// updateQuote - УЛУЧШЕННАЯ ВЕРСИЯ
async updateQuote() {
    if (!this.editingQuote) {
        console.error('❌ Нет цитаты для обновления');
        this.showError('Ошибка: нет цитаты для обновления');
        return;
    }
    
    const textEl = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');
    const saveBtn = document.getElementById('saveButton');
    
    if (!textEl || !textEl.value.trim()) {
        this.showError('Введите текст цитаты');
        textEl?.focus();
        return;
    }

    // Проверяем, были ли изменения
    const newText = textEl.value.trim();
    const newAuthor = authorEl?.value.trim() || '';
    
    if (newText === this.editingQuote.text && newAuthor === (this.editingQuote.author || '')) {
        this.showError('Внесите изменения в цитату перед сохранением');
        return;
    }

    try {
        // Блокировка кнопки
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Обновляю...';
        }

        const quoteData = {
            id: this.editingQuote._id || this.editingQuote.id,
            text: newText,
            author: newAuthor
        };

        console.log('🔄 Отправляем обновленную цитату:', quoteData);

        if (this.apiClient) {
            const result = await this.apiClient.updateQuote(quoteData);
            
            if (result.success) {
                // Обновляем локальное состояние
                const quoteIndex = this.state.quotes.findIndex(q => 
                    (q._id || q.id) === quoteData.id
                );
                
                if (quoteIndex !== -1) {
                    this.state.quotes[quoteIndex] = {
                        ...this.state.quotes[quoteIndex],
                        text: quoteData.text,
                        author: quoteData.author
                    };
                }
                
                this.handleSuccessfulUpdate(textEl, authorEl, saveBtn);
            } else {
                throw new Error(result.error || 'Ошибка обновления на сервере');
            }
        } else {
            // ДЕМО режим - обновление в локальных данных
            console.log('🔄 Демо режим: обновление цитаты локально');
            
            const quoteIndex = this.state.quotes.findIndex(q => 
                (q._id || q.id) === (this.editingQuote._id || this.editingQuote.id)
            );
            
            if (quoteIndex !== -1) {
                this.state.quotes[quoteIndex] = {
                    ...this.state.quotes[quoteIndex],
                    text: quoteData.text,
                    author: quoteData.author
                };
                this.handleSuccessfulUpdate(textEl, authorEl, saveBtn);
            } else {
                throw new Error('Не удалось найти цитату для обновления');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка обновления цитаты:', error);
        this.showError('Не удалось обновить цитату: ' + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
        }
    }
}

// handleSuccessfulUpdate - НОВЫЙ МЕТОД
handleSuccessfulUpdate(textEl, authorEl, saveBtn) {
    // Очистка формы
    textEl.value = '';
    if (authorEl) authorEl.value = '';
    
    // Сброс счетчика символов
    const counter = document.querySelector('.char-counter');
    if (counter) {
        counter.textContent = '0/500';
        counter.style.color = 'var(--text-secondary)';
    }
    
    // Сброс кнопки в обычный режим
    if (saveBtn) {
        saveBtn.textContent = 'Сохранить в дневник';
        saveBtn.onclick = () => this.saveQuote();
        saveBtn.classList.remove('edit-mode');
    }
    
    // Сброс заголовка страницы
    const pageTitle = document.querySelector('#add .page-title');
    if (pageTitle) {
        pageTitle.textContent = 'Добавить цитату';
    }
    
    // Сброс режима редактирования
    this.editingQuote = null;
    
    this.showSuccess('Цитата успешно обновлена! ✅');
    
    // Обновление списков
    Promise.all([
        this.loadRecentQuotes(),
        this.loadAllQuotes()
    ]);
    
    // Переходим на дневник для просмотра обновленной цитаты
    setTimeout(() => {
        this.showPage('diary');
    }, 1500);
    
    this.triggerHaptic('success');
}
