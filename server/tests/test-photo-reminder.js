/**
 * 🧪 Тестовая отправка напоминания с картинками
 * Отправляет обе картинки Анне и Giorgi для оценки
 * 
 * Запуск: node server/tests/test-photo-reminder.js
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createReadStream } = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ID получателей
const RECIPIENTS = [
  { id: '251634573', name: 'Анна' },
  { id: '1798451247', name: 'Giorgi' }
];

// Пути к картинкам (они в той же папке)
const PHOTO_VERTICAL = path.join(__dirname, 'images', 'photo_2025-11-09_09-22-53.jpg');
const PHOTO_HORIZONTAL = path.join(__dirname, 'images', 'photo_2025-11-09_09-22-51.jpg');

async function sendTestReminder() {
  console.log('🚀 Начинаем тестовую отправку напоминаний с картинками...\n');
  console.log('📸 Картинки:');
  console.log('  - Вертикальная (с книгой):', PHOTO_VERTICAL);
  console.log('  - Горизонтальная (с цитатой):', PHOTO_HORIZONTAL);
  console.log('');

  for (const recipient of RECIPIENTS) {
    try {
      console.log(`📤 Отправка для ${recipient.name} (ID: ${recipient.id})...`);

      // ═══════════════════════════════════════════════════
      // ВАРИАНТ 1: Вертикальная картинка с информационным текстом
      // ═══════════════════════════════════════════════════
      const message1 = `🌅 Доброе утро!

Как говорила мудрая Марина Цветаева: "В каждом слове — целая жизнь"

Не забудьте сегодня сохранить цитату, которая откликнется вашей душе.

📚 Кстати, у Анны сейчас идёт новый клуб по теме "Женский гнев" (стартовал 10.11) — возможно, вам будет интересно!

💬 Ваших цитат на этой неделе: 3`;

      await bot.telegram.sendPhoto(
        recipient.id,
        { source: createReadStream(PHOTO_VERTICAL) },
        { caption: message1 }
      );
      console.log(`  ✅ Вариант 1 (вертикальная картинка) отправлен`);

      // Пауза 3 секунды между вариантами
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ═══════════════════════════════════════════════════
      // ВАРИАНТ 2: Горизонтальная картинка с мотивационной цитатой
      // ═══════════════════════════════════════════════════
      const message2 = `✨ Время для вдохновения!

"Следуя словам Мамардашвили, суть их такова: жизнь сложна, и чтобы справиться с ней, придется и самому усложняться" 
— Анна Бусел

Сегодня отличный день, чтобы добавить новую цитату в ваш дневник.

Что вас вдохновило сегодня? 📝`;

      await bot.telegram.sendPhoto(
        recipient.id,
        { source: createReadStream(PHOTO_HORIZONTAL) },
        { caption: message2 }
      );
      console.log(`  ✅ Вариант 2 (горизонтальная картинка) отправлен`);

      console.log(`✅ Все варианты отправлены для ${recipient.name}\n`);

      // Пауза 2 секунды перед следующим получателем
      if (RECIPIENTS.indexOf(recipient) < RECIPIENTS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Ошибка отправки для ${recipient.name}:`, error.message);
    }
  }

  console.log('\n🎉 Тестовая отправка завершена!');
  console.log('💡 Оцените:');
  console.log('   - Как выглядят картинки в Telegram?');
  console.log('   - Правильный ли размер?');
  console.log('   - Читается ли текст?');
  console.log('   - Какой вариант лучше?');
  
  process.exit(0);
}

// Запуск
sendTestReminder().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
