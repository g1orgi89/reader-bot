/**
 * @fileoverview Патч для knowledge.js - исправление критических проблем UI/UX
 * @description Подключается после knowledge.js и исправляет функции
 * @author Reader Development Team
 */

console.log('🔧 Загрузка патча для knowledge.js...');

// Ждем полной загрузки knowledge.js
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initKnowledgePatches();
    }, 200);
});

function initKnowledgePatches() {
    console.log('🔧 Применение патчей для knowledge.js...');
    
    // ПАТЧ 1: Исправление renderDocuments - правильные классы кнопок
    if (typeof window.renderDocuments === 'function') {
        const originalRenderDocuments = window.renderDocuments;
        window.renderDocuments = function(documents) {
            const result = originalRenderDocuments.call(this, documents);
            
            // Исправляем кнопки после рендера
            setTimeout(() => {
                const actionCells = document.querySelectorAll('.col-actions');
                actionCells.forEach(cell => {
                    const btnGroup = cell.querySelector('.btn-group');
                    if (btnGroup) {
                        // Исправляем классы кнопок
                        const viewBtn = btnGroup.querySelector('[onclick*="viewDocument"]');
                        const editBtn = btnGroup.querySelector('[onclick*="editDocument"]');
                        const deleteBtn = btnGroup.querySelector('[onclick*="deleteDocument"]');
                        
                        if (viewBtn) {
                            viewBtn.className = 'btn btn-sm btn-secondary';
                            viewBtn.setAttribute('title', 'Просмотр');
                        }
                        if (editBtn) {
                            editBtn.className = 'btn btn-sm btn-primary';
                            editBtn.setAttribute('title', 'Редактировать');
                        }
                        if (deleteBtn) {
                            deleteBtn.className = 'btn btn-sm btn-danger';
                            deleteBtn.setAttribute('title', 'Удалить');
                        }
                        
                        // Добавляем правильные атрибуты
                        btnGroup.setAttribute('role', 'group');
                        btnGroup.classList.add('btn-group-sm');
                    }
                });
            }, 100);
            
            return result;
        };
    }
    
    // ПАТЧ 2: Исправление модальных окон
    if (typeof window.viewDocument === 'function') {
        const originalViewDocument = window.viewDocument;
        window.viewDocument = function(documentId) {
            console.log('📄 Просмотр документа с патчем:', documentId);
            
            // Создаем улучшенное модальное окно
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'document-view-modal';
            modal.style.zIndex = '10000';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📄 Просмотр документа</h3>
                        <button type="button" class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body" id="document-view-content">
                        <div class="loading-container">
                            <div class="loading-spinner"></div>
                            📖 Загрузка документа...
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Обработчик закрытия
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
                setTimeout(() => modal.remove(), 300);
            });
            
            // Загружаем данные документа
            loadDocumentData(documentId);
        };
    }
    
    // ПАТЧ 3: Исправление editDocument
    if (typeof window.editDocument === 'function') {
        const originalEditDocument = window.editDocument;
        window.editDocument = function(documentId) {
            console.log('✏️ Редактирование документа с патчем:', documentId);
            
            // Закрываем предыдущие модалы
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                activeModal.classList.remove('active');
                setTimeout(() => activeModal.remove(), 300);
            }
            
            // Создаем улучшенное модальное окно редактирования
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'document-edit-modal';
            modal.style.zIndex = '10001';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>✏️ Редактирование документа</h3>
                        <button type="button" class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-document-form">
                            <input type="hidden" id="edit-document-id" value="${documentId}">
                            <div class="form-group">
                                <label for="edit-title">Название документа *</label>
                                <input type="text" id="edit-title" class="form-control" required>
                            </div>
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="edit-category">Категория *</label>
                                    <select id="edit-category" class="form-control" required>
                                        <option value="books">📚 Книги</option>
                                        <option value="psychology">🧠 Психология</option>
                                        <option value="self-development">✨ Саморазвитие</option>
                                        <option value="relationships">💕 Отношения</option>
                                        <option value="productivity">⚡ Продуктивность</option>
                                        <option value="mindfulness">🧘 Осознанность</option>
                                        <option value="creativity">🎨 Творчество</option>
                                        <option value="general">📖 Общие</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="edit-status">Статус *</label>
                                    <select id="edit-status" class="form-control" required>
                                        <option value="published">Опубликован</option>
                                        <option value="draft">Черновик</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="edit-content">Содержание *</label>
                                <textarea id="edit-content" class="form-control" rows="8" required></textarea>
                            </div>
                            <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
                                <button type="button" class="btn btn-secondary modal-close-btn">Отмена</button>
                                <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Обработчики закрытия
            modal.querySelector('.modal-close').addEventListener('click', () => closeModalPatch(modal));
            modal.querySelector('.modal-close-btn').addEventListener('click', () => closeModalPatch(modal));
            
            // Загружаем данные документа для редактирования
            loadDocumentForEdit(documentId);
        };
    }
    
    // ПАТЧ 4: Исправление deleteDocument
    if (typeof window.deleteDocument === 'function') {
        const originalDeleteDocument = window.deleteDocument;
        window.deleteDocument = function(documentId) {
            console.log('🗑️ Удаление документа с патчем:', documentId);
            
            if (confirm('Вы уверены, что хотите удалить этот документ? Это действие нельзя отменить.')) {
                // Используем улучшенную систему уведомлений
                if (typeof showKnowledgeNotification === 'function') {
                    showKnowledgeNotification('info', 'Удаление документа...');
                }
                
                // Вызываем оригинальную функцию
                return originalDeleteDocument.call(this, documentId);
            }
        };
    }
    
    // ПАТЧ 5: Исправление closeModal
    window.closeModalPatch = function(modal) {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                }
            }, 300);
        } else {
            // Закрываем все активные модалы
            const activeModals = document.querySelectorAll('.modal-overlay.active');
            activeModals.forEach(m => {
                m.classList.remove('active');
                setTimeout(() => {
                    if (m.parentNode) {
                        m.remove();
                    }
                }, 300);
            });
            document.body.style.overflow = '';
        }
    };
    
    // Переопределяем глобальную функцию closeModal
    window.closeModal = window.closeModalPatch;
    
    // ПАТЧ 6: Загрузка данных документа
    window.loadDocumentData = async function(documentId) {
        try {
            const response = await makeAuthenticatedRequest(`/knowledge/${documentId}`);
            
            if (response.success) {
                const doc = response.data;
                const content = document.getElementById('document-view-content');
                if (content) {
                    content.innerHTML = `
                        <div class="document-details">
                            <div class="document-header">
                                <h4>${escapeHtml(doc.title)}</h4>
                                <div class="document-meta">
                                    <span class="badge badge-primary">${getCategoryDisplayName(doc.category)}</span>
                                    <span class="badge badge-${doc.status === 'published' ? 'success' : 'warning'}">${doc.status === 'published' ? 'Опубликован' : 'Черновик'}</span>
                                </div>
                            </div>
                            <div class="document-content-text" style="max-height: 400px; overflow-y: auto; margin: 1rem 0; padding: 1rem; background: var(--hover-bg); border-radius: var(--border-radius);">
                                ${escapeHtml(doc.content || 'Содержание недоступно').replace(/\n/g, '<br>')}
                            </div>
                            <div class="document-actions" style="display: flex; gap: 1rem; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                <button class="btn btn-primary" onclick="editDocument('${doc._id}')">✏️ Редактировать</button>
                                <button class="btn btn-danger" onclick="deleteDocument('${doc._id}')">🗑️ Удалить</button>
                                <button class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
                            </div>
                        </div>
                    `;
                }
            } else {
                throw new Error(response.error || 'Документ не найден');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки документа:', error);
            const content = document.getElementById('document-view-content');
            if (content) {
                content.innerHTML = `
                    <div class="alert alert-error">
                        <strong>❌ Ошибка:</strong> ${error.message}
                    </div>
                    <div class="document-actions" style="display: flex; justify-content: center; margin-top: 1rem;">
                        <button class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
                    </div>
                `;
            }
        }
    };
    
    // ПАТЧ 7: Загрузка данных для редактирования
    window.loadDocumentForEdit = async function(documentId) {
        try {
            const response = await makeAuthenticatedRequest(`/knowledge/${documentId}`);
            if (response.success) {
                const doc = response.data;
                document.getElementById('edit-title').value = doc.title || '';
                document.getElementById('edit-category').value = doc.category || 'general';
                document.getElementById('edit-status').value = doc.status || 'draft';
                document.getElementById('edit-content').value = doc.content || '';
                
                // Обработчик формы
                document.getElementById('edit-document-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await saveDocumentChanges(documentId);
                });
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки для редактирования:', error);
            if (typeof showKnowledgeNotification === 'function') {
                showKnowledgeNotification('error', 'Ошибка загрузки документа: ' + error.message);
            }
        }
    };
    
    // ПАТЧ 8: Сохранение изменений документа
    window.saveDocumentChanges = async function(documentId) {
        try {
            const updateData = {
                title: document.getElementById('edit-title').value.trim(),
                category: document.getElementById('edit-category').value,
                status: document.getElementById('edit-status').value,
                content: document.getElementById('edit-content').value.trim()
            };
            
            const response = await makeAuthenticatedRequest(`/knowledge/${documentId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            if (response.success) {
                if (typeof showKnowledgeNotification === 'function') {
                    showKnowledgeNotification('success', 'Документ успешно обновлен');
                }
                closeModal();
                
                // Обновляем список документов
                if (typeof loadDocuments === 'function') {
                    await loadDocuments();
                }
            } else {
                throw new Error(response.error || 'Ошибка обновления');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
            if (typeof showKnowledgeNotification === 'function') {
                showKnowledgeNotification('error', 'Ошибка сохранения: ' + error.message);
            }
        }
    };
    
    console.log('✅ Патчи для knowledge.js применены успешно');
}

// Вспомогательные функции
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryDisplayName(category) {
    const categories = {
        'books': '📚 Книги',
        'psychology': '🧠 Психология',
        'self-development': '✨ Саморазвитие',
        'relationships': '💕 Отношения',
        'productivity': '⚡ Продуктивность',
        'mindfulness': '🧘 Осознанность',
        'creativity': '🎨 Творчество',
        'general': '📖 Общие'
    };
    return categories[category] || 'Неизвестно';
}

console.log('📚 Патч knowledge-patch.js загружен');