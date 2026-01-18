/**
 * NewsCarousel — карусель новостей на CSS scroll-snap.
 * - 5 карточек-изображений, свайп вправо/влево
 * - Явные стрелки и точки-индикаторы
 * - Использует глобальный RBImageErrorHandler для onerror у <img>
 * - Vanilla JS + JSDoc, без фреймворков
 */
class NewsCarousel {
  /**
   * @param {Object} options
   * @param {Array<{id:string,title:string,subtitle?:string,imageUrl:string,link?:string}>} options.items
   * @param {string} options.containerId
   */
  constructor({ items = [], containerId = 'news-carousel' } = {}) {
    this.items = Array.isArray(items) ? items.slice(0, 5) : [];
    this.containerId = containerId;
    this.currentIndex = 0;

    this._bound = {
      onArrowClick: this.onArrowClick.bind(this),
      onDotClick: this.onDotClick.bind(this),
      onScroll: this.onScroll.bind(this)
    };
  }

  render() {
    if (!this.items.length) return '';
    return `
      <section class="news-carousel" id="${this.containerId}">
        <div class="news-header">
          <h2 class="news-title">Новости</h2>
          <div class="news-hint">Свайп вправо, чтобы посмотреть</div>
        </div>

        <div class="news-track" tabindex="0" aria-roledescription="carousel" aria-label="Новости">
          ${this.items.map((x, i) => `
            <article class="news-slide" role="group" aria-label="${i+1} из ${this.items.length}">
              <div class="news-media">
                <img class="news-img" src="${this.escape(x.imageUrl)}" alt="${this.escape(x.title)}"
                     onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
                <div class="news-overlay">
                  <div class="news-caption">
                    <div class="news-caption-title">${this.escape(x.title)}</div>
                    ${x.subtitle ? `<div class="news-caption-subtitle">${this.escape(x.subtitle)}</div>` : ''}
                    ${x.link ? `<a class="news-link" href="${this.escape(x.link)}" target="_blank" rel="noopener">Подробнее</a>` : ''}
                  </div>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

        <div class="news-controls">
          <button class="news-arrow prev" aria-label="Предыдущая новость">‹</button>
          <div class="news-dots">
            ${this.items.map((_x, i) => `<button class="news-dot ${i===0?'active':''}" data-index="${i}" aria-label="Перейти к ${i+1}-й новости"></button>`).join('')}
          </div>
          <button class="news-arrow next" aria-label="Следующая новость">›</button>
        </div>
      </section>
    `;
  }

  /**
   * Установка обработчиков и начальной позиции
   * @param {HTMLElement|string} root
   */
  mount(root) {
    const container = (typeof root === 'string') ? document.getElementById(root) : (root || document.getElementById(this.containerId));
    if (!container) return;

    const track = container.querySelector('.news-track');
    container.querySelector('.news-arrow.prev')?.addEventListener('click', (e) => this._bound.onArrowClick(e, -1));
    container.querySelector('.news-arrow.next')?.addEventListener('click', (e) => this._bound.onArrowClick(e, +1));
    container.querySelectorAll('.news-dot')?.forEach(dot => {
      dot.addEventListener('click', this._bound.onDotClick);
    });
    track?.addEventListener('scroll', this._bound.onScroll, { passive: true });

    this.scrollToIndex(container, 0, false);
  }

  onArrowClick(_e, dir) {
    const container = document.getElementById(this.containerId);
    const nextIndex = Math.max(0, Math.min(this.items.length - 1, this.currentIndex + dir));
    this.scrollToIndex(container, nextIndex, true);
  }

  onDotClick(e) {
    const i = Number(e.currentTarget?.dataset?.index || 0);
    const container = document.getElementById(this.containerId);
    this.scrollToIndex(container, i, true);
  }

  onScroll(e) {
    const track = e.currentTarget;
    const slideWidth = track.querySelector('.news-slide')?.offsetWidth || track.offsetWidth;
    const i = Math.round(track.scrollLeft / Math.max(1, slideWidth));
    if (i !== this.currentIndex) {
      this.currentIndex = i;
      this.updateDotsActive();
    }
  }

  scrollToIndex(container, i, smooth = true) {
    const track = container?.querySelector('.news-track');
    const slideWidth = track?.querySelector('.news-slide')?.offsetWidth || track?.offsetWidth || 0;
    const left = i * slideWidth;
    track?.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    this.currentIndex = i;
    this.updateDotsActive();
  }

  updateDotsActive() {
    const container = document.getElementById(this.containerId);
    container?.querySelectorAll('.news-dot')?.forEach((d, idx) => {
      d.classList.toggle('active', idx === this.currentIndex);
    });
  }

  escape(t) {
    const d = document.createElement('div');
    d.textContent = String(t || '');
    return d.innerHTML;
  }
}
window.NewsCarousel = NewsCarousel;
