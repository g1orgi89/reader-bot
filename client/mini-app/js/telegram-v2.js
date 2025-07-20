/**
 * TELEGRAM.JS - Интеграция с Telegram Web App SDK v2.0
 * НОВОЕ: Полная поддержка всех themeParams из Telegram Mini Apps API
 * Плавные переходы между темами, автоматическая адаптация, расширенный mock режим
 */

class TelegramManager {
    constructor() {
        this.tg = null;
        this.user = null;
        this.isInitialized = false;
        this.mockMode = false;
        this.currentTheme = 'light';
        this.callbacks = {
            onUserChange: [],
            onThemeChange: [],
            onViewportChange: []
        };
        
        // НОВОЕ: Полная поддержка всех Telegram themeParams
        this.supportedThemeParams = [
            'accent_text_color',
            'bg_color', 
            'button_color',
            'button_text_color',
            'bottom_bar_bg_color',
            'destructive_text_color',
            'header_bg_color',
            'hint_color',
            'link_color',
            'secondary_bg_color',
            'section_bg_color',
            'section_header_text_color',
            'subtitle_text_color',
            'text_color',
            'section_separator_color'
        ];
        
        console.log('TelegramManager v2.0: Constructor initialized with full theme support');