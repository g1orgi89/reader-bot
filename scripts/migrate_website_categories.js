/**
 * @fileoverview Migration script to seed Category collection with 14 website categories
 * @description Seeds the Category collection with the exact categories from Anna's website
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');
const Category = require('../server/models/Category');

// Load environment variables
require('dotenv').config();

/**
 * Website categories data exactly as specified in the plan
 */
const WEBSITE_CATEGORIES = [
  {
    name: 'КРИЗИСЫ',
    description: 'Цитаты о преодолении трудностей и кризисных ситуаций',
    icon: '⚡',
    color: '#DC2626',
    keywords: ['кризис', 'трудност', 'проблем', 'преодоле', 'выход', 'решени'],
    priority: 10,
    aiPromptHint: 'Цитаты о способах справиться с кризисами, трудностями и проблемами'
  },
  {
    name: 'Я — ЖЕНЩИНА',
    description: 'Цитаты о женственности, самопознании и женской силе',
    icon: '👩',
    color: '#EC4899',
    keywords: ['женщин', 'женственност', 'сила', 'красота', 'самопознан', 'женск'],
    priority: 9,
    aiPromptHint: 'Цитаты о женской природе, силе, красоте и самопознании'
  },
  {
    name: 'ЛЮБОВЬ',
    description: 'Цитаты о любви во всех её проявлениях',
    icon: '❤️',
    color: '#EF4444',
    keywords: ['любовь', 'сердце', 'чувств', 'страст', 'привязанност', 'романтик'],
    priority: 10,
    aiPromptHint: 'Цитаты о любви к партнеру, к себе, к жизни и всех видах любви'
  },
  {
    name: 'ОТНОШЕНИЯ',
    description: 'Цитаты о межличностных отношениях и общении',
    icon: '🤝',
    color: '#3B82F6',
    keywords: ['отношени', 'общени', 'дружб', 'близост', 'понимани', 'связь'],
    priority: 9,
    aiPromptHint: 'Цитаты о построении отношений, дружбе, общении с людьми'
  },
  {
    name: 'ДЕНЬГИ',
    description: 'Цитаты о финансах, богатстве и отношении к деньгам',
    icon: '💰',
    color: '#10B981',
    keywords: ['деньг', 'богатств', 'финанс', 'успех', 'материальн', 'благополуч'],
    priority: 8,
    aiPromptHint: 'Цитаты о деньгах, финансовом благополучии и отношении к богатству'
  },
  {
    name: 'ОДИНОЧЕСТВО',
    description: 'Цитаты о одиночестве, уединении и самостоятельности',
    icon: '🌙',
    color: '#6366F1',
    keywords: ['одиночеств', 'уединени', 'самостоятельност', 'независимост', 'тишин'],
    priority: 8,
    aiPromptHint: 'Цитаты о ценности одиночества, уединения и самостоятельности'
  },
  {
    name: 'СМЕРТЬ',
    description: 'Цитаты о смерти, конечности жизни и её ценности',
    icon: '🕊️',
    color: '#64748B',
    keywords: ['смерть', 'конечност', 'бренност', 'вечност', 'память', 'утрат'],
    priority: 7,
    aiPromptHint: 'Цитаты о принятии смерти, ценности жизни из-за её конечности'
  },
  {
    name: 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
    description: 'Цитаты о семье, родителях, детях и семейных ценностях',
    icon: '👨‍👩‍👧‍👦',
    color: '#F59E0B',
    keywords: ['семь', 'родител', 'дети', 'мама', 'папа', 'родственник', 'семейн'],
    priority: 9,
    aiPromptHint: 'Цитаты о семейных отношениях, воспитании, связи поколений'
  },
  {
    name: 'СМЫСЛ ЖИЗНИ',
    description: 'Цитаты о поиске смысла, предназначении и цели существования',
    icon: '🎯',
    color: '#8B5CF6',
    keywords: ['смысл', 'предназначени', 'цель', 'миссия', 'призвани', 'суть'],
    priority: 10,
    aiPromptHint: 'Цитаты о поиске смысла жизни, предназначения и жизненной цели'
  },
  {
    name: 'СЧАСТЬЕ',
    description: 'Цитаты о счастье, радости и положительных эмоциях',
    icon: '😊',
    color: '#F59E0B',
    keywords: ['счасть', 'радост', 'веселье', 'удовольстви', 'блаженств', 'эйфори'],
    priority: 10,
    aiPromptHint: 'Цитаты о том, что такое счастье и как его достичь'
  },
  {
    name: 'ВРЕМЯ И ПРИВЫЧКИ',
    description: 'Цитаты о времени, привычках и организации жизни',
    icon: '⏰',
    color: '#06B6D4',
    keywords: ['время', 'привычк', 'рутин', 'организаци', 'планировани', 'дисциплин'],
    priority: 8,
    aiPromptHint: 'Цитаты о ценности времени, формировании привычек и самодисциплине'
  },
  {
    name: 'ДОБРО И ЗЛО',
    description: 'Цитаты о морали, этике, добре и зле',
    icon: '⚖️',
    color: '#84CC16',
    keywords: ['добро', 'зло', 'мораль', 'этика', 'справедливост', 'нравственност'],
    priority: 7,
    aiPromptHint: 'Цитаты о моральных принципах, добре, зле и этических вопросах'
  },
  {
    name: 'ОБЩЕСТВО',
    description: 'Цитаты об обществе, социальных вопросах и взаимодействии с миром',
    icon: '🌍',
    color: '#14B8A6',
    keywords: ['общество', 'социум', 'мир', 'люди', 'человечество', 'цивилизаци'],
    priority: 7,
    aiPromptHint: 'Цитаты о месте человека в обществе и социальных взаимодействиях'
  },
  {
    name: 'ПОИСК СЕБЯ',
    description: 'Цитаты о самопознании, саморазвитии и поиске собственного пути',
    icon: '🔍',
    color: '#A855F7',
    keywords: ['самопознани', 'саморазвити', 'поиск', 'путь', 'рост', 'развити', 'познани'],
    priority: 10,
    aiPromptHint: 'Цитаты о самопознании, личностном росте и поиске своего пути'
  }
];

/**
 * Main migration function
 */
async function migrateWebsiteCategories() {
  try {
    console.log('🚀 Starting website categories migration...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');

    // Wipe existing categories
    console.log('🗑️  Clearing existing categories...');
    const deletedCount = await Category.deleteMany({});
    console.log(`   Deleted ${deletedCount.deletedCount} existing categories`);

    // Insert new categories
    console.log('📝 Inserting website categories...');
    const inserted = await Category.insertMany(WEBSITE_CATEGORIES);
    console.log(`✅ Successfully inserted ${inserted.length} categories:`);
    
    inserted.forEach((category, index) => {
      console.log(`   ${index + 1}. ${category.name} ${category.icon} (${category.keywords.length} keywords)`);
    });

    console.log('\n🎉 Website categories migration completed successfully!');
    console.log(`   Total categories: ${inserted.length}`);
    console.log('   All categories are active and ready for AI analysis');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    // Close connection
    try {
      await mongoose.connection.close();
      console.log('📡 MongoDB connection closed');
    } catch (closeError) {
      console.error('⚠️  Error closing MongoDB connection:', closeError);
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateWebsiteCategories()
    .then(() => {
      console.log('✨ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = {
  migrateWebsiteCategories,
  WEBSITE_CATEGORIES
};