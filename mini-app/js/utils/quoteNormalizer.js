/**
 * @fileoverview Client-side quote normalization utilities
 * @description Mirrors server-side normalization for consistent like tracking
 * 
 * This module provides the same normalization functions as the server
 * to ensure consistent key generation for quote likes on the client side.
 */

// Define in global scope for use across the application
window.QuoteNormalizer = (function() {
  /**
   * Normalize text for grouping quotes with slight formatting variations
   * Removes various quote characters, unifies dashes, collapses whitespace,
   * strips trailing dots/ellipsis, trims and lowercases
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  function normalizeQuoteField(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    let normalized = text;
    
    // Remove various quote characters (guillemets, smart quotes, straight quotes)
    normalized = normalized.replace(/[«»""„"']/g, '');
    
    // Unify dashes (em dash, en dash, minus) to hyphen
    normalized = normalized.replace(/[—–−]/g, '-');
    
    // Collapse whitespace to single spaces
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Strip trailing dots and ellipsis with adjacent whitespace
    normalized = normalized.replace(/[\s.…]*\.{2,}[\s.…]*$/g, '');
    normalized = normalized.replace(/[\s.]*\.[\s.]*$/g, '');
    
    // Trim and lowercase
    normalized = normalized.trim().toLowerCase();
    
    return normalized;
  }

  /**
   * Compute normalized key from text and author
   * @param {string} text - Quote text
   * @param {string} author - Quote author (optional)
   * @returns {string} Normalized key in format "normalizedText|||normalizedAuthor"
   */
  function computeNormalizedKey(text, author = '') {
    const normalizedText = normalizeQuoteField(text || '');
    const normalizedAuthor = normalizeQuoteField(author || '');
    return `${normalizedText}|||${normalizedAuthor}`;
  }

  // Public API
  return {
    normalizeQuoteField,
    computeNormalizedKey
  };
})();
