/**
 * NewsCarousel — карусель новостей на CSS scroll-snap.
 * - Только изображения (без overlay/ссылок/подсказок)
 * - Высота как в аудиоплеере: квадрат 1:1, object-fit: cover
 * - Удаляем слайды с ошибкой загрузки (без пустых новостей)
 * - Показ "N из N новости" в заголовке
 */
class NewsCarousel {
  /**
   * @param {Object} options
   * @param {Array<{id:string,title:string,imageUrl:string}>} options.items
   * @param {string} options.containerId
   */
  constructor({ items = [], containerId = 'news-carousel' } = {}) {
    this.items = Array.isArray(items) ? items.slice(0, 5) : [];
    this.containerId = containerId;
    this.currentIndex = 0;
    this.slidesCount = this.items.length;

    this._bound = {
      onArrowClick: this.onArrowClick.bind(this),
      onDotClick: this.onDotClick.bind(this),
      onScroll: this.onScroll.bind(this),
      onImageError: this.onImageError.bind(this)
    };
  }

  render() {
    if (!this.items.length) return '';
    return `
      <section class="news-carousel" id="${this.containerId}">
        <div class="news-header">
          <h2 class="news-title">Новости</h2>
          <div class="news-total" aria-live="polite">${this.slidesCount} из ${this.slidesCount} новости</div>
        </div>

        <div class="news-track" tabindex="0" aria-roledescription="carousel" aria-label="Новости">
          ${this.items.map((x, i) => `
            <article class="news-slide" role="group" aria-label="${i+1} из ${this.items.length}">
              <div class="news-media">
                <img class="news-img" src="${this.escape(x.imageUrl)}" alt="${this.escape(x.title)}">
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

    // Удаляем битые изображения и пересчитываем карусель
    container.querySelectorAll('.news-img')?.forEach(img => {
      img.addEventListener('error', this._bound.onImageError, { once: true });
    });

    this.recalcSlides(container);
    this.scrollToIndex(container, 0, false);
  }

  onImageError(e) {
    try {
      const img = e.currentTarget;
      const slide = img.closest('.news-slide');
      const section = img.closest('.news-carousel');
      if (slide && slide.parentElement) {
        slide.parentElement.removeChild(slide);
      }
      // Пересчёт после удаления
      this.recalcSlides(section);
      // Если больше нет слайдов — скрываем секцию
      if (this.slidesCount === 0 && section) {
        section.style.display = 'none';
      }
    } catch (_) {}
  }

  recalcSlides(container) {
    const track = container?.querySelector('.news-track');
    const dotsBox = container?.querySelector('.news-dots');
    const totalEl = container?.querySelector('.news-total');
    const slides = Array.from(track?.querySelectorAll('.news-slide') || []);
    this.slidesCount = slides.length;

    // Обновляем счётчик "N из N новости"
    if (totalEl) {
      totalEl.textContent = `${this.slidesCount} из ${this.slidesCount} новости`;
    }

    // Переиндексация точек
    if (dotsBox) {
      dotsBox.innerHTML = slides.map((_s, i) =>
        `<button class="news-dot ${i===this.currentIndex?'active':''}" data-index="${i}" aria-label="Перейти к ${i+1}-й новости"></button>`
      ).join('');
      dotsBox.querySelectorAll('.news-dot')?.forEach(dot => {
        dot.addEventListener('click', this._bound.onDotClick);
      });
    }

    // Корректируем текущий индекс
    if (this.currentIndex >= this.slidesCount) {
      this.currentIndex = Math.max(0, this.slidesCount - 1);
    }
  }

  onArrowClick(_e, dir) {
    const container = document.getElementById(this.containerId);
    const nextIndex = Math.max(0, Math.min(this.slidesCount - 1, this.currentIndex + dir));
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
