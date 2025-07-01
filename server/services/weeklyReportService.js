  /**
   * ✅ AI-анализ цитат за неделю через существующий claudeService
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<Object>} Анализ недели
   */
  async analyzeWeeklyQuotes(quotes, userProfile) {
    const quotesText = quotes.map(q => `"${q.text}" ${q.author ? `(${q.author})` : ''}`).join('\n\n');
    
    const prompt = `Ты психолог Анна Бусел. Проанализируй цитаты пользователя за неделю и дай психологический анализ.

Имя пользователя: ${userProfile.name}
Результаты теста: ${JSON.stringify(userProfile.testResults)}

Цитаты за неделю:
${quotesText}

Напиши анализ в стиле Анны Бусел:
- Тон: теплый, профессиональный, обращение на "Вы"
- Глубокий психологический анализ
- Связь с результатами первоначального теста
- Выводы о текущем состоянии и интересах
- 2-3 абзаца

Верни JSON:
{
  "summary": "Краткий анализ недели одним предложением",
  "dominantThemes": ["тема1", "тема2"],
  "emotionalTone": "позитивный/нейтральный/задумчивый/etc",
  "insights": "Подробный психологический анализ от Анны",
  "personalGrowth": "Наблюдения о личностном росте пользователя"
}`;

    try {
      // ✅ ИСПРАВЛЕНИЕ: Отключаем RAG для анализа цитат - нам не нужна база знаний
      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: userProfile.userId,
        context: 'weekly_report_analysis',
        useRag: false // 🔧 FIX: Отключаем RAG - анализируем только цитаты пользователя
      });
      
      const analysis = JSON.parse(response.message);
      
      // Валидация результата
      if (!analysis.summary || !analysis.insights) {
        throw new Error('Invalid analysis structure');
      }

      return {
        summary: analysis.summary,
        dominantThemes: analysis.dominantThemes || [],
        emotionalTone: analysis.emotionalTone || 'размышляющий',
        insights: analysis.insights,
        personalGrowth: analysis.personalGrowth || 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
      };
      
    } catch (error) {
      logger.error(`📖 Error in AI weekly analysis: ${error.message}`);
      
      // ✅ Fallback анализ в случае ошибки AI
      return this.getFallbackAnalysis(quotes, userProfile);
    }
  }