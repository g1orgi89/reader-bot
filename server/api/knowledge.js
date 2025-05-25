/**
 * @route POST /api/knowledge/test-search
 * @desc Test RAG search functionality for admin panel with chunking support
 * @access Private (Admin only)
 * @body {string} query - Search query to test
 * @body {number} [limit=5] - Number of results to return
 * @body {boolean} [returnChunks=false] - Return individual chunks instead of grouped documents
 */
router.post('/test-search', requireAdminAuth, async (req, res) => {
  try {
    const { query, limit = 5, returnChunks = false } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    logger.info(`🍄 RAG test search initiated: \"${query}\" (returnChunks: ${returnChunks})`);

    // Используем векторный поиск для тестирования с поддержкой чанкинга
    let results = [];
    let searchType = 'none';
    let chunkingUsed = false;
    
    if (vectorStoreService && typeof vectorStoreService.search === 'function') {
      // Пробуем векторный поиск с новой опцией returnChunks
      const vectorResults = await vectorStoreService.search(query, { 
        limit,
        returnChunks: returnChunks  // Используем новую опцию
      });
      
      if (vectorResults && vectorResults.length > 0) {
        results = vectorResults.map(result => {
          // Используем улучшенную детекцию чанков
          const isChunk = returnChunks ? 
            (result.isChunk || (result.metadata?.id && result.metadata?.id.includes('_chunk_'))) :
            (result.metadata?.sourceType === 'chunk');
          
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
              chunkIndex: result.metadata?.chunkIndex || result.chunkInfo?.chunkIndex,
              totalChunks: result.metadata?.totalChunks || result.chunkInfo?.totalChunks,
              startPosition: result.metadata?.startPosition || result.chunkInfo?.startPosition,
              endPosition: result.metadata?.endPosition || result.chunkInfo?.endPosition
            } : null,
            // Дополнительная отладочная информация
            debug: {
              metadataId: result.metadata?.id,
              resultId: result.id,
              originalId: originalId,
              hasChunkIndex: (result.metadata?.chunkIndex !== undefined) || (result.chunkInfo?.chunkIndex !== undefined),
              sourceType: result.metadata?.sourceType,
              returnChunksMode: returnChunks
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
          source: 'mongodb',
          returnChunksMode: returnChunks
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
        searchMode: returnChunks ? 'chunks' : 'documents',
        // Дополнительная диагностическая информация
        debug: {
          vectorSearchAttempted: true,
          vectorServiceAvailable: vectorStoreService && typeof vectorStoreService.search === 'function',
          returnChunksRequested: returnChunks
        }
      }
    });

    logger.info(`🍄 RAG test search completed: \"${query}\" - ${results.length} results found (${searchType}), chunking: ${chunkingUsed ? 'used' : 'not used'}, mode: ${returnChunks ? 'chunks' : 'documents'}`);
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