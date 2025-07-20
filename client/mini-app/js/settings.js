/**
 * Settings page functionality for Reader Bot Mini App
 * @fileoverview Manages user settings, notifications, and profile data
 * @author Claude/GPT Assistant
 * @version 1.0.0
 */

class SettingsManager {
    constructor() {
        this.currentEditField = null;
        this.userSettings = {
            name: '',
            email: '',
            dailyReminders: true,
            weeklyReports: true,
            bookRecommendations: true,
            reminderTime: '09:00',
            analytics: true
        };
        this.init();
    }

    /**
     * Initialize settings page
     */
    async init() {
        try {
            // Load user data from API
            await this.loadUserData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update UI with current settings
            this.updateSettingsUI();
            
            console.log('Settings initialized successfully');
        } catch (error) {
            console.error('Error initializing settings:', error);
            this.showError('Ошибка загрузки настроек');
        }
    }

    /**
     * Load user data from API
     */
    async loadUserData() {
        try {
            // Get user from Telegram
            const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
            
            if (telegramUser) {
                this.userSettings.name = telegramUser.first_name + (telegramUser.last_name ? ` ${telegramUser.last_name}` : '');
            }

            // Load settings from API
            const response = await fetch('/api/reader/user/settings', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${await getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const settings = await response.json();
                this.userSettings = { ...this.userSettings, ...settings };
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            // Use default settings if API fails
        }
    }

    /**
     * Setup event listeners for toggles and buttons
     */
    setupEventListeners() {
        // Toggle switches
        const toggles = ['dailyReminders', 'weeklyReports', 'bookRecommendations', 'analytics'];
        toggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    this.updateSetting(toggleId, e.target.checked);
                });
            }
        });

        // Modal event listeners
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    /**
     * Update settings UI with current values
     */
    updateSettingsUI() {
        // Update profile info
        document.getElementById('userName').textContent = this.userSettings.name || 'Не указано';
        document.getElementById('userEmail').textContent = this.userSettings.email || 'Не указан';
        document.getElementById('reminderTime').textContent = this.userSettings.reminderTime || '09:00';

        // Update toggles
        document.getElementById('dailyReminders').checked = this.userSettings.dailyReminders;
        document.getElementById('weeklyReports').checked = this.userSettings.weeklyReports;
        document.getElementById('bookRecommendations').checked = this.userSettings.bookRecommendations;
        document.getElementById('analytics').checked = this.userSettings.analytics;
    }

    /**
     * Update a specific setting
     * @param {string} key - Setting key
     * @param {any} value - New value
     */
    async updateSetting(key, value) {
        try {
            this.userSettings[key] = value;

            // Update on server
            await fetch('/api/reader/user/settings', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${await getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [key]: value })
            });

            // Haptic feedback
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }

            console.log(`Setting ${key} updated to:`, value);
        } catch (error) {
            console.error('Error updating setting:', error);
            this.showError('Ошибка сохранения настроек');
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        if (window.Telegram?.WebApp?.showAlert) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        if (window.Telegram?.WebApp?.showAlert) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
    }

    /**
     * Show modal for editing
     * @param {string} title - Modal title
     * @param {string} field - Field to edit
     * @param {string} currentValue - Current value
     * @param {string} type - Input type (text, time)
     */
    showEditModal(title, field, currentValue, type = 'text') {
        this.currentEditField = field;
        
        document.getElementById('modalTitle').textContent = title;
        
        const textInput = document.getElementById('editInput');
        const timeInput = document.getElementById('timeInput');
        
        if (type === 'time') {
            textInput.style.display = 'none';
            timeInput.style.display = 'block';
            timeInput.value = currentValue;
        } else {
            textInput.style.display = 'block';
            timeInput.style.display = 'none';
            textInput.value = currentValue;
            textInput.focus();
        }
        
        document.getElementById('editModal').style.display = 'flex';
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditField = null;
    }

    /**
     * Save edit from modal
     */
    async saveEdit() {
        if (!this.currentEditField) return;

        const textInput = document.getElementById('editInput');
        const timeInput = document.getElementById('timeInput');
        
        let newValue;
        if (timeInput.style.display !== 'none') {
            newValue = timeInput.value;
        } else {
            newValue = textInput.value.trim();
        }

        if (!newValue) {
            this.showError('Поле не может быть пустым');
            return;
        }

        // Validation
        if (this.currentEditField === 'email' && !this.isValidEmail(newValue)) {
            this.showError('Введите корректный email');
            return;
        }

        try {
            await this.updateSetting(this.currentEditField, newValue);
            this.updateSettingsUI();
            this.closeModal();
            this.showSuccess('Настройки сохранены');
        } catch (error) {
            this.showError('Ошибка сохранения');
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Export user data
     */
    async exportData() {
        try {
            const response = await fetch('/api/reader/user/export', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'reader-bot-data.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('Данные экспортированы');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showError('Ошибка экспорта данных');
        }
    }

    /**
     * Delete user account
     */
    async deleteAccount() {
        const confirmText = 'Вы уверены? Все данные будут удалены навсегда. Это действие нельзя отменить.';
        
        if (window.Telegram?.WebApp?.showConfirm) {
            window.Telegram.WebApp.showConfirm(confirmText, async (confirmed) => {
                if (confirmed) {
                    await this.performAccountDeletion();
                }
            });
        } else {
            if (confirm(confirmText)) {
                await this.performAccountDeletion();
            }
        }
    }

    /**
     * Perform actual account deletion
     */
    async performAccountDeletion() {
        try {
            const response = await fetch('/api/reader/user/delete', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });

            if (response.ok) {
                this.showSuccess('Аккаунт удален');
                // Redirect to start
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                throw new Error('Deletion failed');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showError('Ошибка удаления аккаунта');
        }
    }
}

// Initialize settings manager when page loads
let settingsManager;

document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});

// Global functions for HTML onclick handlers
function goBack() {
    window.history.back();
}

function showHelp() {
    const helpText = `
Reader Bot - ваш персональный дневник цитат

Основные функции:
• Добавляйте цитаты из книг
• Получайте еженедельные отчеты
• Открывайте новые книги через рекомендации
• Следите за своим прогрессом

Для вопросов обращайтесь в поддержку.
    `.trim();
    
    if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(helpText);
    } else {
        alert(helpText);
    }
}

function editName() {
    settingsManager.showEditModal('Изменить имя', 'name', settingsManager.userSettings.name);
}

function editEmail() {
    settingsManager.showEditModal('Изменить email', 'email', settingsManager.userSettings.email);
}

function editReminderTime() {
    settingsManager.showEditModal('Время напоминаний', 'reminderTime', settingsManager.userSettings.reminderTime, 'time');
}

function closeModal() {
    settingsManager.closeModal();
}

function saveEdit() {
    settingsManager.saveEdit();
}

function showPrivacyPolicy() {
    window.open('https://example.com/privacy', '_blank');
}

function exportData() {
    settingsManager.exportData();
}

function showAbout() {
    const aboutText = `
Reader Bot v1.0.0

Создано для помощи в сборе и анализе цитат.
Разработано с любовью к книгам и мудрости.

© 2024 Reader Bot Team
    `.trim();
    
    if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(aboutText);
    } else {
        alert(aboutText);
    }
}

function showSupport() {
    if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink('https://t.me/support_bot');
    } else {
        window.open('https://t.me/support_bot', '_blank');
    }
}

function deleteAccount() {
    settingsManager.deleteAccount();
}