/**
 * NewsCarousel — карусель новостей на CSS scroll-snap.
 * - Баннер 2:1, object-fit: cover (ниже, чем квадрат)
 * - Без overlay/ссылок/подсказок
 * - Без пустых слайдов (битые картинки удаляются)
 * - Счётчик "текущая из всего" над картинкой (1 из N)
 * - Прокрутка по ширине видимой области (чтобы не выглядывал следующий слайд)
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
    const initialCurrent = Math.min(1, this.items.length);
    const total = this.items.length;

    return `
      <section class="news-carousel" id="${this.containerId}">
        <div class="news-header">
          <h2 class="news-title">Новости книжного клуба</h2>
          <div class="news-counter" aria-live="polite">${initialCurrent} из ${total}</div>
        </div>

        <div class="news-track" tabindex="0" aria-roledescription="carousel" aria-label="Новости">
          ${this.items.map((x, i) => `
            <article class="news-slide" role="group" aria-label="${i+1} из ${this.items.length}">
              <div class="news-media">
                <img class="news-img" src="${this.escape(x.imageUrl)}" alt="${this.escape(x.title)}"
                     onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
              </div>
            </article>
          `).join('')}
        </div>

        <div class="news-controls">
          <button class="news-arrow prev" aria-label="Предыдущая">‹</button>
          <div class="news-dots">
            ${this.items.map((_x, i) => `<button class="news-dot ${i===0?'active':''}" data-index="${i}" aria-label="Перейти к ${i+1}-й"></button>`).join('')}
          </div>
          <button class="news-arrow next" aria-label="Следующая">›</button>
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
    this.updateCounter();
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
    const slides = Array.from(track?.querySelectorAll('.news-slide') || []);
    this.slidesCount = slides.length;

    // Обновляем aria-labels для слайдов
    slides.forEach((slide, i) => {
      slide.setAttribute('aria-label', `${i+1} из ${this.slidesCount}`);
    });

    // Переиндексация точек
    if (dotsBox) {
      dotsBox.innerHTML = slides.map((_s, i) =>
        `<button class="news-dot ${i===this.currentIndex?'active':''}" data-index="${i}" aria-label="Перейти к ${i+1}-й"></button>`
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
    const viewportWidth = track.clientWidth;
    const i = Math.round(track.scrollLeft / Math.max(1, viewportWidth));
    if (i !== this.currentIndex) {
      this.currentIndex = i;
      this.updateDotsActive();
      this.updateCounter();
    }
  }

  scrollToIndex(container, i, smooth = true) {
    const track = container?.querySelector('.news-track');
    const viewportWidth = track?.clientWidth || 0;
    const left = i * viewportWidth;
    track?.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    this.currentIndex = i;
    this.updateDotsActive();
    this.updateCounter();
  }

  updateDotsActive() {
    const container = document.getElementById(this.containerId);
    container?.querySelectorAll('.news-dot')?.forEach((d, idx) => {
      d.classList.toggle('active', idx === this.currentIndex);
    });
  }

  updateCounter() {
    const container = document.getElementById(this.containerId);
    const counter = container?.querySelector('.news-counter');
    if (counter) {
      counter.textContent = `${this.slidesCount ? (this.currentIndex + 1) : 0} из ${this.slidesCount}`;
    }
  }

  escape(t) {
    const d = document.createElement('div');
    d.textContent = String(t || '');
    return d.innerHTML;
  }
}
window.NewsCarousel = NewsCarousel;
