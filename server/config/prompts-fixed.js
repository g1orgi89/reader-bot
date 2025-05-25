/**
 * ⚠️ DEACTIVATED FILE - DO NOT USE
 * @file server/config/prompts-fixed.js
 * 
 * Этот файл деактивирован и не должен использоваться!
 * 
 * ДЛЯ ПРОМПТОВ ИСПОЛЬЗУЙТЕ:
 * - PromptService: server/services/promptService.js
 * - Fallback промпты: server/config/fallbackPrompts.js
 * 
 * Резервная копия старых промптов: server/config/prompts-fixed-backup.js
 */

// ⚠️ ФАЙЛ ДЕАКТИВИРОВАН - НИЧЕГО НЕ ЭКСПОРТИРУЕМ!
throw new Error(`
🍄 ОШИБКА: prompts-fixed.js деактивирован!

Этот файл больше не используется. Используйте вместо него:

1. PromptService для динамических промптов:
   const promptService = require('../services/promptService');
   
2. Fallback промпты для резерва:
   const { FALLBACK_PROMPTS } = require('./fallbackPrompts');

3. Диагностические константы встроены в DiagnosticsService

Если нужна резервная копия старых промптов:
   server/config/prompts-fixed-backup.js
`);

module.exports = {};
