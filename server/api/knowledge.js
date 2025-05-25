/**
 * @route POST /api/knowledge/test-search
 * @desc Test RAG search functionality for admin panel with chunking support
 * @access Private (Admin only)
 * @body {string} query - Search query to test
 * @body {number} [limit=5] - Number of results to return
 */
router.post('/test-search', requireAdminAuth, async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    logger.info(`🍄 RAG test search initiated: "${query}"`);

    // Используем векторный поиск для тестирования с поддержкой чанкинга
    let results = [];
    let searchType = 'none';
    let chunkingUsed = false;
    
    if (vectorStoreService && typeof vectorStoreService.search === 'function') {
      // Пробуем векторный поиск
      const vectorResults = await vectorStoreService.search(query, { limit });
      
      if (vectorResults && vectorResults.length > 0) {
        results = vectorResults.map(result => {
          // ИСПРАВЛЕНО: правильная проверка чанков
          const isChunk = result.metadata?.id && result.metadata?.id.includes('_chunk_');
          const originalId = result.metadata?.originalId || result.id;
          
          return {
            id: result.id,
            title: result.metadata?.title || 'Без названия',
            content: result.content || '',
            category: result.metadata?.category || 'general',
            language: result.metadata?.language || 'en',
            score: result.score || 0,
            isChunk: isChunk,
            chunkInfo: isChunk ? {
              originalId: originalId,
              chunkIndex: result.metadata?.chunkIndex,
              totalChunks: result.metadata?.totalChunks,
              startPosition: result.metadata?.startPosition,
              endPosition: result.metadata?.endPosition
            } : null,
            // Дополнительная отладочная информация
            debug: {
              metadataId: result.metadata?.id,
              resultId: result.id,
              originalId: originalId,
              hasChunkIndex: result.metadata?.chunkIndex !== undefined
            }
          };
        });
        searchType = 'vector';
        chunkingUsed = results.some(r => r.isChunk);
      }
    }
    
    // Если векторный поиск не дал результатов, используем MongoDB поиск
    if (results.length === 0) {
      logger.info('🍄 Vector search returned no results, falling back to MongoDB search');
      
      const mongoResults = await KnowledgeDocument.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ],
        status: 'published'
      })
      .limit(parseInt(limit))
      .select('title content category language tags')
      .lean();
      
      results = mongoResults.map(doc => ({
        id: doc._id.toString(),
        title: doc.title,
        content: doc.content.substring(0, 500), // Обрезаем для превью
        category: doc.category,
        language: doc.language,
        score: 0.5, // Примерный score для MongoDB результатов
        isChunk: false,
        chunkInfo: null,
        debug: {
          source: 'mongodb'
        }
      }));
      searchType = 'mongodb';
    }

    res.json({
      success: true,
      data: {
        results,
        query,
        totalFound: results.length,
        searchType,
        chunkingUsed,
        chunksFound: results.filter(r => r.isChunk).length,
        documentsFound: results.filter(r => !r.isChunk).length,
        // Дополнительная диагностическая информация
        debug: {
          vectorSearchAttempted: true,
          vectorServiceAvailable: vectorStoreService && typeof vectorStoreService.search === 'function'
        }
      }
    });

    logger.info(`🍄 RAG test search completed: "${query}" - ${results.length} results found (${searchType}), chunking: ${chunkingUsed ? 'used' : 'not used'}`);
  } catch (error) {
    logger.error(`Error in RAG test search: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Test search failed',
      errorCode: 'TEST_SEARCH_ERROR',
      details: error.message
    });
  }
});