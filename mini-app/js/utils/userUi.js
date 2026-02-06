/**
 * User UI Utilities
 * Centralized helpers for rendering user-related UI elements
 * @file mini-app/js/utils/userUi.js
 */

/**
 * Badge icon map - maps badge IDs to icon paths
 */
const BADGE_ICON_MAP = {
  'alice': '/assets/badges/alice.png',
  'alice_badge': '/assets/badges/alice.png'
  // Add more badges here as they are introduced
};

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}

/**
 * Render user name with badge icon
 * Creates HTML for displaying user's name with their primary badge icon to the right
 * Format: [displayName] [badge-icon] [@username]
 * 
 * @param {Object} user - User object
 * @param {string} user.name - Display name
 * @param {string} [user.username] - Telegram username (without @)
 * @param {Array<string>} [user.badges] - Array of badge IDs
 * @param {Array<Object>} [user.achievements] - Array of achievement objects
 * @returns {string} HTML string for username with badge
 */
function renderUserNameWithBadge(user) {
  if (!user) return '';
  
  const displayName = escapeHtml(user.name || 'User');
  const username = user.username ? `@${escapeHtml(user.username)}` : '';
  
  // Get badges array from either badges or achievements field
  let badges = user.badges || [];
  if (!badges.length && user.achievements && Array.isArray(user.achievements)) {
    badges = user.achievements
      .map(a => a.achievementId || a.id)
      .filter(Boolean); // Remove undefined/null values
  }
  
  // Find primary badge (first badge that has an icon)
  const primaryBadge = badges.find(badgeId => BADGE_ICON_MAP[badgeId]);
  
  let badgeHtml = '';
  if (primaryBadge) {
    const iconPath = BADGE_ICON_MAP[primaryBadge];
    const altText = primaryBadge === 'alice' || primaryBadge === 'alice_badge' 
      ? 'Бейдж «Алиса в стране чудес»'
      : `Бейдж ${primaryBadge}`;
    
    badgeHtml = `<img src="${iconPath}" alt="${altText}" title="${altText}" class="badge-inline" />`;
  }
  
  // Format: displayName [badge] @username
  const parts = [
    `<span class="user-display-name">${displayName}</span>`,
    badgeHtml,
    username ? `<span class="user-username">${username}</span>` : ''
  ].filter(Boolean);
  
  return parts.join(' ');
}

/**
 * Render just the badge icon (no name)
 * @param {Array<string>} badges - Array of badge IDs
 * @returns {string} HTML for badge icon or empty string
 */
function renderBadgeIcon(badges) {
  if (!badges || badges.length === 0) return '';
  
  const primaryBadge = badges.find(badgeId => BADGE_ICON_MAP[badgeId]);
  if (!primaryBadge) return '';
  
  const iconPath = BADGE_ICON_MAP[primaryBadge];
  const altText = primaryBadge === 'alice' || primaryBadge === 'alice_badge'
    ? 'Бейдж «Алиса в стране чудес»'
    : `Бейдж ${primaryBadge}`;
  
  return `<img src="${iconPath}" alt="${altText}" title="${altText}" class="badge-inline" />`;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderUserNameWithBadge,
    renderBadgeIcon,
    BADGE_ICON_MAP
  };
}

// Also expose globally for direct script tag usage
if (typeof window !== 'undefined') {
  window.UserUiUtils = {
    renderUserNameWithBadge,
    renderBadgeIcon,
    BADGE_ICON_MAP
  };
}
