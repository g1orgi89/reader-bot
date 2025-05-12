/**
 * @file Типизированный скрипт для загрузки базы знаний (продолжение)
 * @description Продолжение файла с созданием примеров и основной функцией
 */

  const faqPath = path.join(loader.baseKnowledgePath, 'troubleshooting', 'en', 'faq.md');
  await fs.writeFile(faqPath, faqContent, 'utf8');
  
  // Создание технической документации
  const technicalDocContent = `---
title: Technical Documentation
tags: [api, development, smart-contracts]
language: en
category: technical
version: 1.0
---

# Technical Documentation

## Smart Contract Architecture

The SHROOMS project is built on the Stacks blockchain using Clarity smart contracts.

### Main Contracts

- **SHROOMS Token Contract**: Implements SIP-010 fungible token standard
- **Farming Contract**: Manages liquidity farming pools
- **Staking Contract**: Handles token staking mechanisms

## API Endpoints

### Authentication

All authenticated endpoints require a valid Stacks wallet signature.

\`\`\`
POST /api/auth/connect
Content-Type: application/json

{
  "walletAddress": "ST...",
  "signature": "...",
  "message": "..."
}
\`\`\`

### Token Information

\`\`\`
GET /api/token/balance/:address
\`\`\`

Returns the SHROOMS token balance for the specified address.

## Development Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`
   STACKS_NETWORK=testnet
   \`\`\`

3. Deploy contracts:
   \`\`\`bash
   npm run deploy:contracts
   \`\`\`

#development #api #smart-contracts #stacks
`;
  
  const techPath = path.join(loader.baseKnowledgePath, 'technical', 'api-documentation.md');
  await fs.writeFile(techPath, technicalDocContent, 'utf8');
  
  // Создание документа о токеномике
  const tokenomicsContent = `---
title: Токеномика SHROOMS
tags: [токены, распределение, экономика]
language: ru
category: tokenomics
---

# Токеномика SHROOMS

## Обзор токена

SHROOMS - основной токен экосистемы проекта:

- **Общее предложение**: 100,000,000 SHROOMS
- **Стандарт**: SIP-010 (Stacks)
- **Десятичные знаки**: 6

## Распределение токенов

| Категория | Процент | Количество | График разблокировки |
|-----------|---------|------------|---------------------|
| Фарминг и стейкинг | 40% | 40,000,000 | 4 года |
| Команда | 25% | 25,000,000 | 3 года, ежемесячная разблокировка |
| Инвесторы | 20% | 20,000,000 | 2 года, ежеквартальная разблокировка |
| Маркетинг | 15% | 15,000,000 | По мере необходимости |

## Механизмы фарминга

### Пулы ликвидности

1. **STX-SHROOMS**: Основной пул (60% от вознаграждений)
2. **BTC-SHROOMS**: Специальный пул (40% от вознаграждений)

### Доходность

- Текущая APY: ~12.5%
- Обновляется ежедневно
- Зависит от общей ликвидности

## Стейкинг

### Варианты стейкинга

- Гибкий: ~5% APY
- 30 дней: ~8% APY
- 90 дней: ~15% APY

### Бонусы

- Голосование в DAO
- Приоритетный доступ к NFT
- Скидки на комиссии

#токеномика #farming #staking #shrooms
`;
  
  const tokenomicsPath = path.join(loader.baseKnowledgePath, 'tokenomics', 'ru', 'overview.md');
  await fs.writeFile(tokenomicsPath, tokenomicsContent, 'utf8');
  
  logger.info('Example documents created successfully');
}

/**
 * Главная функция скрипта
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Проверка переменных окружения с типизацией
    const requiredEnvVars = [
      'VECTOR_DB_URL',
      'VECTOR_DB_TYPE'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
    
    // Проверка API ключей для embeddings
    const embeddingProviders = ['VOYAGE_API_KEY', 'OPENAI_API_KEY', 'COHERE_API_KEY'];
    const hasApiKey = embeddingProviders.some(key => process.env[key]);
    
    if (!hasApiKey) {
      throw new Error(`At least one embedding provider API key is required: ${embeddingProviders.join(', ')}`);
    }
    
    // Создание экземпляра загрузчика с типизацией
    const config = {
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY) || os.cpus().length,
      processingOptions: {
        chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
        splitter: process.env.SPLITTER || 'recursive'
      }
    };
    
    const loader = new TypedKnowledgeLoader(config);
    
    // Проверка и создание примеров (если нужно)
    try {
      await fs.access(loader.baseKnowledgePath);
      const files = await fs.readdir(loader.baseKnowledgePath);
      if (files.length === 0 || (files.length === 1 && files[0] === '.gitkeep')) {
        logger.info('Knowledge directory is empty. Creating examples...');
        await createExampleDocuments();
      }
    } catch (error) {
      logger.info('Creating initial directory structure and examples...');
      await createExampleDocuments();
    }
    
    // Запуск процесса загрузки с типизированным результатом
    const stats = await loader.loadKnowledgeBase();
    
    // Проверка результатов
    if (stats.errors.length > 0) {
      logger.warn(`Completed with ${stats.errors.length} errors`);
      process.exit(1);
    }
    
    logger.info('Knowledge base loading completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error(`Script failed: ${error.message}`);
    if (error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

// Обработка сигналов для graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  process.exit(1);
});

// Запуск скрипта, если файл выполняется напрямую
if (require.main === module) {
  main().catch(error => {
    logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

// Экспорт класса для использования в других модулях
module.exports = TypedKnowledgeLoader;