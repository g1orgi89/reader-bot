/**
 * @fileoverview Weekly Report Catch-Up Service (FIXED)
 * - Устранён ReferenceError (ленивые require моделей внутри методов)
 * - Корректная передача quotes + weekMeta в generateWeeklyReport
 * - Пропуск demo-user и пустых недель
 * - Расширенное логирование и защита от дублей
 */

const WeeklyReportService = require('./weeklyReportService');
const {
  getBusinessNow,
  getISOWeekInfo,
  getISOWeekRange
} = require('../utils/isoWeek');
const logger = require('../utils/logger');

class WeeklyReportCatchUpService {
  constructor(options = {}) {
    this.weeklyReportService = new WeeklyReportService();
    this.lookbackWeeks = parseInt(process.env.CATCHUP_LOOKBACK_WEEKS, 10) ||
      options.lookbackWeeks ||
      8;
    this.minDelayMs = 150;
    this.maxUsersPerWeek = options.maxUsersPerWeek || 500; // защита от лавины
    logger.info(`[CatchUp] Initialized (lookback=${this.lookbackWeeks})`);
  }

  /**
   * Ленивый доступ к моделям (разрываем циклы require)
   */
  _models() {
    // Подгружаем только тогда, когда реально нужны
    const Quote = require('../models/quote');
    const WeeklyReport = require('../models/weeklyReport');
    const UserProfile = require('../models/userProfile');
    return { Quote, WeeklyReport, UserProfile };
  }

  /**
   * Находит недели, где есть цитаты, но отсутствуют отчёты
   * @returns {Promise<Array<{isoWeek:number, isoYear:number, users:string[] }>>}
   */
  async findMissingWeeks() {
    try {
      const { Quote, WeeklyReport } = this._models();
      const businessNow = getBusinessNow();
      const currentWeekInfo = getISOWeekInfo(businessNow);

      const missing = [];

      for (let offset = 1; offset <= this.lookbackWeeks; offset++) {
        // Смотрим прошлые недели
        let isoWeek = currentWeekInfo.isoWeek - offset;
        let isoYear = currentWeekInfo.isoYear;

        // Переход через границу года
        if (isoWeek < 1) {
            // Узнаём число недель в предыдущем ISO году через 28 декабря
            const prevDec28 = new Date(Date.UTC(isoYear - 1, 11, 28));
            const weeksInPrevYear = getISOWeekInfo(prevDec28).isoWeek;
            isoWeek = weeksInPrevYear + isoWeek;
            isoYear = isoYear - 1;
        }

        // Находим пользователей с цитатами
        const usersWithQuotes = await Quote.distinct('userId', {
          weekNumber: isoWeek,
          yearNumber: isoYear
        });

        if (!usersWithQuotes.length) continue;

        // Находим пользователей, у которых уже есть отчёт
        const usersWithReports = await WeeklyReport.distinct('userId', {
          weekNumber: isoWeek,
          year: isoYear
        });

        const needing = usersWithQuotes.filter(u => !usersWithReports.includes(u));

        if (needing.length) {
          missing.push({
            isoWeek,
            isoYear,
            users: needing.slice(0, this.maxUsersPerWeek)
          });
        }
      }

      logger.info(`[CatchUp] Missing weeks found: ${missing.length}`);
      return missing;
    } catch (e) {
      logger.error('[CatchUp] findMissingWeeks failed:', e);
      return [];
    }
  }

  /**
   * Генерирует отчёты для конкретной недели
   * @param {number} isoWeek
   * @param {number} isoYear
   * @param {string[]} userIds
   * @returns {Promise<{generated:number, skipped:number, failed:number}>}
   */
  async generateWeek(isoWeek, isoYear, userIds) {
    const { Quote, WeeklyReport, UserProfile } = this._models();
    const weekRange = getISOWeekRange(isoWeek, isoYear);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    logger.info(`[CatchUp] Week ${isoWeek}/${isoYear}: processing users=${userIds.length}`);

    for (const userId of userIds) {
      if (!userId || userId === 'demo-user') {
        skipped++;
        continue;
      }

      try {
        // Дубли (страховка — несмотря на unique индекс)
        const exists = await WeeklyReport.findOne({
          userId,
          weekNumber: isoWeek,
          year: isoYear
        }).select({ _id: 1 }).lean();

        if (exists) {
          skipped++;
          continue;
        }

        const profile = await UserProfile.findOne({
          userId,
          isOnboardingComplete: true,
          isActive: true,
          isBlocked: false
        }).lean();

        if (!profile) {
          skipped++;
          continue;
        }

        const quotes = await Quote.find({
          userId,
          weekNumber: isoWeek,
          yearNumber: isoYear
        }).sort({ createdAt: 1 });

        if (!quotes.length) {
          skipped++;
          continue;
        }

        const reportData = await this.weeklyReportService.generateWeeklyReport(
          userId,
          quotes,
          profile,
          {
            weekMeta: {
              isoWeek,
              isoYear,
              start: weekRange.start,
              end: weekRange.end
            }
          }
        );

        const wr = new WeeklyReport(reportData);
        await wr.save();
        generated++;
        logger.info(`[CatchUp] ✅ Report created user=${userId} week=${isoWeek}/${isoYear} quotes=${quotes.length}`);

      } catch (err) {
        failed++;
        logger.error(`[CatchUp] ❌ Fail user=${userId} week=${isoWeek}/${isoYear}: ${err.message}`);
      }

      // Небольшая задержка — сгладить нагрузку
      await new Promise(r => setTimeout(r, this.minDelayMs));
    }

    logger.info(`[CatchUp] Week summary ${isoWeek}/${isoYear}: generated=${generated}, skipped=${skipped}, failed=${failed}`);
    return { generated, skipped, failed };
  }

  /**
   * Основной запуск
   */
  async run() {
    logger.info('[CatchUp] Running weekly report catch-up scan...');
    const weeks = await this.findMissingWeeks();

    if (!weeks.length) {
      logger.info('[CatchUp] No missing weeks — nothing to do');
      return { totalGenerated: 0, weeksProcessed: 0 };
    }

    let totalGenerated = 0;
    let processed = 0;

    for (const w of weeks) {
      try {
        const res = await this.generateWeek(w.isoWeek, w.isoYear, w.users);
        totalGenerated += res.generated;
        processed++;
      } catch (e) {
        logger.error(`[CatchUp] Week loop failure ${w.isoWeek}/${w.isoYear}: ${e.message}`);
      }
    }

    logger.info(`[CatchUp] Completed: weeksProcessed=${processed}, totalGenerated=${totalGenerated}`);
    return { totalGenerated, weeksProcessed: processed };
  }
}

module.exports = WeeklyReportCatchUpService;
