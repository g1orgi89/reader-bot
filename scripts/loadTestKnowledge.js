/**
 * Script to load test knowledge documents
 * @file scripts/loadTestKnowledge.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const KnowledgeDocument = require('../server/models/knowledge');
const logger = require('../server/utils/logger');

const testDocuments = [
  {
    title: "Подключение кошелька Xverse",
    content: "Пошаговая инструкция по подключению грибной корзинки Xverse к нашему мицелию Shrooms:\n\n1. Установите расширение Xverse в браузере\n2. Создайте новый кошелек или импортируйте существующий\n3. Откройте сайт Shrooms.io\n4. Нажмите 'Connect Wallet'\n5. Выберите Xverse из списка\n6. Подтвердите подключение\n\nВаши споры теперь готовы к выращиванию! 🍄",
    category: "user-guide",
    language: "ru",
    tags: ["кошелек", "xverse", "подключение", "споры"]
  },
  {
    title: "SHROOMS Tokenomics",
    content: "The SHROOMS token is the core mushroom of our ecosystem! 🍄\n\nTotal supply: 100M SHROOMS\n\nDistribution:\n- 40% for farming (growing mushrooms)\n- 25% for the development team (mushroom cultivators)\n- 20% for investors (early mushroom collectors)\n- 15% for marketing and partnerships\n\nStaking rewards: Lock your SHROOMS to earn more mushrooms!\nCurrent farming yield: ~12.5% APY in the STX-SHROOMS pool.\n\nRemember: Only invest what you can afford to lose in the mushroom forest! 🌲",
    category: "tokenomics",
    language: "en",
    tags: ["shrooms", "token", "farming", "staking", "apy"]
  },
  {
    title: "Решение проблем с подключением",
    content: "Если ваша грибная корзинка не подключается:\n\n1. Убедитесь что расширение Xverse включено\n2. Проверьте что кошелек разблокирован\n3. Обновите страницу (F5)\n4. Очистите кэш браузера\n5. Проверьте баланс STX для оплаты комиссии\n6. Отключите блокировщики рекламы\n\nЕсли споры все еще не прорастают, создайте тикет поддержки! Наши грибники-эксперты помогут вам в грибном лесу. 🔧",
    category: "troubleshooting",
    language: "ru",
    tags: ["проблемы", "подключение", "xverse", "ошибки"]
  },
  {
    title: "Como conectar billetera Xverse",
    content: "Instrucciones paso a paso para conectar tu cesta de hongos Xverse a nuestro micelio Shrooms:\n\n1. Instala la extensión Xverse en tu navegador\n2. Crea una nueva billetera o importa una existente\n3. Abre el sitio Shrooms.io\n4. Haz clic en 'Connect Wallet'\n5. Selecciona Xverse de la lista\n6. Confirma la conexión\n\n¡Tus esporas ahora están listas para crecer! 🍄",
    category: "user-guide",
    language: "es",
    tags: ["billetera", "xverse", "conexion", "esporas"]
  },
  {
    title: "How to Farm SHROOMS",
    content: "Start your mushroom growing journey! 🍄\n\n1. Connect your wallet to Shrooms.io\n2. Have some STX and SHROOMS tokens ready\n3. Go to the 'Farming' section\n4. Choose a pool (STX-SHROOMS recommended)\n5. Enter the amount you want to farm\n6. Confirm the transaction\n7. Watch your mushrooms grow!\n\nCurrent yield: ~12.5% APY\nMinimum farming amount: 10 SHROOMS\n\nRemember: Farming involves impermanent loss risk!",
    category: "user-guide", 
    language: "en",
    tags: ["farming", "pool", "stx", "shrooms", "yield"]
  },
  {
    title: "Técnicas de staking avanzadas",
    content: "Maximiza tus hongos con técnicas de staking avanzadas:\n\n- Staking flexible: 5% APY, sin bloqueo\n- Staking 30 días: 8% APY, período fijo\n- Staking 90 días: 15% APY, máximas recompensas\n\nBeneficios adicionales:\n- Acceso a funciones premium\n- Descuentos en comisiones\n- Participación en governance\n- Acceso prioritario a NFTs\n\n¡Haz que tus hongos trabajen para ti! 💰",
    category: "tokenomics",
    language: "es",
    tags: ["staking", "apy", "recompensas", "governance"]
  }
];

async function loadTestDocuments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support');
    console.log('Connected to MongoDB');

    // Clear existing test documents (optional)
    const existingCount = await KnowledgeDocument.countDocuments();
    console.log(`Found ${existingCount} existing documents`);

    // Create text index if it doesn't exist
    try {
      await KnowledgeDocument.collection.createIndex(
        { title: 'text', content: 'text', tags: 'text' },
        { 
          weights: { title: 10, content: 5, tags: 3 },
          name: 'knowledge_text_search'
        }
      );
      console.log('Text search index created');
    } catch (error) {
      console.log('Text index already exists or creation failed:', error.message);
    }

    // Insert test documents
    for (const docData of testDocuments) {
      try {
        const doc = new KnowledgeDocument(docData);
        await doc.save();
        console.log(`✅ Created: "${docData.title}" (${docData.language})`);
      } catch (error) {
        console.error(`❌ Failed to create "${docData.title}":`, error.message);
      }
    }

    const finalCount = await KnowledgeDocument.countDocuments();
    console.log(`\n🎉 Loading complete! Total documents: ${finalCount}`);
    
    // Test search functionality
    console.log('\n🔍 Testing search...');
    const searchResults = await KnowledgeDocument.find({ $text: { $search: 'кошелек' } });
    console.log(`Found ${searchResults.length} results for "кошелек"`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error loading test documents:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  loadTestDocuments().catch(console.error);
}

module.exports = { loadTestDocuments, testDocuments };