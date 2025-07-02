/**
 * @fileoverview Сервис системы достижений для бота "Читатель"
 * @author g1orgi89
 */

const { Quote } = require('../models');
const { UserProfile } = require('../models');

/**
 * @typedef {Object} Achievement
 * @property {string} id - Уникальный ID достижения
 * @property {string} name - Название достижения
 * @property {string} description - Описание достижения
 * @property {string} icon - Эмодзи иконка
 * @property {number} targetValue - Цель для получения
 * @property {string} type - Тип достижения
 * @property {Function} checkCondition - Функция проверки условия
 */

/**
 * Сервис системы достижений
 */
class AchievementService {
  constructor() {
    this.achievements = this._initializeAchievements();
  }

  /**
   * Инициализация списка достижений согласно ТЗ
   * @returns {Achievement[]}
   * @private
   */
  _initializeAchievements() {
    return [
      {
        id: 'first_quote',
        name: 'Первые шаги',
        description: 'Сохранили первую цитату в дневник мудрости',
        icon: '🌱',
        targetValue: 1,
        type: 'quotes_count',
        checkCondition: async (userId) => {
          const count = await Quote.countDocuments({ userId });
          return count >= 1;
        }
      },
      {
        id: 'wisdom_collector',
        name: 'Коллекционер мудрости',
        description: 'Собрали 25 цитат - настоящая библиотека вдохновения!',
        icon: '📚',
        targetValue: 25,
        type: 'quotes_count',
        checkCondition: async (userId) => {
          const count = await Quote.countDocuments({ userId });
          return count >= 25;
        }
      },
      {
        id: 'week_philosopher',
        name: 'Философ недели',
        description: '7 дней подряд с цитатами - вы превращаете чтение в привычку',
        icon: '🔥',
        targetValue: 7,
        type: 'streak_days',
        checkCondition: async (userId) => {
          const user = await UserProfile.findOne({ userId });
          return user && user.statistics.currentStreak >= 7;
        }
      },
      {
        id: 'classics_lover',
        name: 'Любитель классики',
        description: '10 цитат классиков - вы цените вечные истины',
        icon: '📖',
        targetValue: 10,
        type: 'classics_count',
        checkCondition: async (userId) => {
          const classicAuthors = [
            'Толстой', 'Лев Толстой', 'Л. Толстой',
            'Достоевский', 'Федор Достоевский', 'Ф. Достоевский',
            'Пушкин', 'Александр Пушкин', 'А. Пушкин',
            'Чехов', 'Антон Чехов', 'А. Чехов',
            'Тургенев', 'Иван Тургенев', 'И. Тургенев',
            'Гоголь', 'Николай Гоголь', 'Н. Гоголь',
            'Лермонтов', 'Михаил Лермонтов', 'М. Лермонтов'
          ];
          
          const count = await Quote.countDocuments({
            userId,
            author: { $in: classicAuthors }
          });
          return count >= 10;
        }
      },
      {
        id: 'thinker',
        name: 'Мыслитель',
        description: '10 собственных мыслей - вы не только читаете, но и размышляете',
        icon: '💭',
        targetValue: 10,
        type: 'own_thoughts',
        checkCondition: async (userId) => {
          const count = await Quote.countDocuments({
            userId,
            $or: [
              { author: { $exists: false } },
              { author: null },
              { author: '' }
            ]
          });
          return count >= 10;
        }
      },
      {
        id: 'marathon_reader',
        name: 'Марафонец чтения',
        description: '50 цитат - вы настоящий ценитель мудрости',
        icon: '🏃‍♀️',
        targetValue: 50,
        type: 'quotes_count',
        checkCondition: async (userId) => {
          const count = await Quote.countDocuments({ userId });
          return count >= 50;
        }
      },
      {
        id: 'diverse_reader',
        name: 'Разносторонний читатель',
        description: 'Цитаты из 5 разных категорий - широкий кругозор!',
        icon: '🌈',
        targetValue: 5,
        type: 'category_diversity',
        checkCondition: async (userId) => {
          const categories = await Quote.distinct('category', { userId });
          return categories.length >= 5;
        }
      },
      {
        id: 'monthly_consistent',
        name: 'Постоянство',
        description: 'Месяц с ботом и активное использование',
        icon: '⭐',
        targetValue: 30,
        type: 'days_with_bot',
        checkCondition: async (userId) => {
          const user = await UserProfile.findOne({ userId });
          if (!user) return false;
          
          const daysSinceRegistration = Math.floor(
            (new Date() - user.registeredAt) / (1000 * 60 * 60 * 24)
          );
          
          const quotesCount = await Quote.countDocuments({ userId });
          return daysSinceRegistration >= 30 && quotesCount >= 15;
        }
      }
    ];
  }

  /**
   * Получить все достижения
   * @returns {Achievement[]}
   */
  getAllAchievements() {
    return this.achievements;
  }

  /**
   * Получить достижение по ID
   * @param {string} achievementId - ID достижения
   * @returns {Achievement|null}
   */
  getAchievementById(achievementId) {
    return this.achievements.find(a => a.id === achievementId) || null;
  }

  /**
   * Проверить и разблокировать новые достижения для пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Achievement[]>} Массив новых достижений
   */
  async checkAndUnlockAchievements(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user) return [];

      const currentAchievements = user.achievements.map(a => a.achievementId);
      const newAchievements = [];

      // Проверяем каждое достижение
      for (const achievement of this.achievements) {
        // Пропускаем уже полученные достижения
        if (currentAchievements.includes(achievement.id)) {
          continue;
        }

        // Проверяем условие получения
        const isUnlocked = await achievement.checkCondition(userId);
        
        if (isUnlocked) {
          // Добавляем достижение пользователю
          await user.addAchievement(achievement.id);
          newAchievements.push(achievement);
          
          console.log(`🏆 User ${userId} unlocked achievement: ${achievement.name}`);
        }
      }

      return newAchievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Получить прогресс пользователя по всем достижениям
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object[]>} Прогресс по достижениям
   */
  async getUserAchievementProgress(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user) return [];

      const userAchievements = user.achievements.map(a => a.achievementId);
      const progress = [];

      for (const achievement of this.achievements) {
        const isUnlocked = userAchievements.includes(achievement.id);
        let currentValue = 0;

        // Получаем текущий прогресс
        if (!isUnlocked) {
          currentValue = await this._getCurrentProgress(userId, achievement);
        }

        progress.push({
          ...achievement,
          isUnlocked,
          currentValue,
          progress: isUnlocked ? 100 : Math.min((currentValue / achievement.targetValue) * 100, 100),
          unlockedAt: isUnlocked ? user.achievements.find(a => a.achievementId === achievement.id)?.unlockedAt : null
        });
      }

      return progress;
    } catch (error) {
      console.error('Error getting achievement progress:', error);
      return [];
    }
  }

  /**
   * Получить текущий прогресс по конкретному достижению
   * @param {string} userId - ID пользователя
   * @param {Achievement} achievement - Достижение
   * @returns {Promise<number>} Текущее значение прогресса
   * @private
   */
  async _getCurrentProgress(userId, achievement) {
    try {
      switch (achievement.type) {
        case 'quotes_count':
          return await Quote.countDocuments({ userId });

        case 'streak_days':
          const user = await UserProfile.findOne({ userId });
          return user ? user.statistics.currentStreak : 0;

        case 'classics_count':
          const classicAuthors = [
            'Толстой', 'Лев Толстой', 'Л. Толстой',
            'Достоевский', 'Федор Достоевский', 'Ф. Достоевский',
            'Пушкин', 'Александр Пушкин', 'А. Пушкин',
            'Чехов', 'Антон Чехов', 'А. Чехов',
            'Тургенев', 'Иван Тургенев', 'И. Тургенев',
            'Гоголь', 'Николай Гоголь', 'Н. Гоголь',
            'Лермонтов', 'Михаил Лермонтов', 'М. Лермонтов'
          ];
          return await Quote.countDocuments({
            userId,
            author: { $in: classicAuthors }
          });

        case 'own_thoughts':
          return await Quote.countDocuments({
            userId,
            $or: [
              { author: { $exists: false } },
              { author: null },
              { author: '' }
            ]
          });

        case 'category_diversity':
          const categories = await Quote.distinct('category', { userId });
          return categories.length;

        case 'days_with_bot':
          const userProfile = await UserProfile.findOne({ userId });
          if (!userProfile) return 0;
          return Math.floor(
            (new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24)
          );

        default:
          return 0;
      }
    } catch (error) {
      console.error('Error calculating progress:', error);
      return 0;
    }
  }

  /**
   * Форматировать уведомление о достижении для Telegram
   * @param {Achievement} achievement - Достижение
   * @returns {string} Форматированное сообщение
   */
  formatAchievementNotification(achievement) {
    return `🎉 *Поздравляю!*

Вы получили достижение:
${achievement.icon} *${achievement.name}*
${achievement.description}

Продолжайте собирать моменты вдохновения! 📖`;
  }

  /**
   * Получить статистику достижений для пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Статистика достижений
   */
  async getUserAchievementStats(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user) {
        return {
          totalAchievements: 0,
          unlockedAchievements: 0,
          completionRate: 0,
          recentAchievements: []
        };
      }

      const totalAchievements = this.achievements.length;
      const unlockedAchievements = user.achievements.length;
      const completionRate = Math.round((unlockedAchievements / totalAchievements) * 100);

      // Получаем последние 3 достижения
      const recentAchievements = user.achievements
        .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
        .slice(0, 3)
        .map(userAchievement => {
          const achievement = this.getAchievementById(userAchievement.achievementId);
          return {
            ...achievement,
            unlockedAt: userAchievement.unlockedAt
          };
        });

      return {
        totalAchievements,
        unlockedAchievements,
        completionRate,
        recentAchievements
      };
    } catch (error) {
      console.error('Error getting achievement stats:', error);
      return {
        totalAchievements: 0,
        unlockedAchievements: 0,
        completionRate: 0,
        recentAchievements: []
      };
    }
  }
}

module.exports = AchievementService;