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
   * @param {boolean} options.autoplay - Enable autoplay
   * @param {number} options.interval - Autoplay interval in ms
   * @param {boolean} options.pauseOnTouch - Pause on user interaction
   * @param {boolean} options.pauseOnVisibilityChange - Pause when page hidden
   */
  constructor({ items = [], containerId = 'news-carousel', autoplay = true, interval = 6000, pauseOnTouch = true, pauseOnVisibilityChange = true } = {}) {
    this.items = Array.isArray(items) ? items.slice(0, 5) : [];
    this.containerId = containerId;
    this.currentIndex = 0;
    this.slidesCount = this.items.length;
    
    // Autoplay configuration
    this.config = {
      autoplay,
      interval,
      pauseOnTouch,
      pauseOnVisibilityChange
    };
    this.autoplayTimer = null;
    this.pauseTimer = null;

    this._bound = {
      onDotClick: this.onDotClick.bind(this),
      onScroll: this.onScroll.bind(this),
      onImageError: this.onImageError.bind(this),
      onInteractionStart: this.onInteractionStart.bind(this),
      onVisibilityChange: this.onVisibilityChange.bind(this)
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
          <div class="news-dots">
            ${this.items.map((_x, i) => `<button class="news-dot ${i===0?'active':''}" data-index="${i}" aria-label="Перейти к ${i+1}-й"></button>`).join('')}
          </div>
        </div>
      </section>
    `;
  }

  async mount(root) {
    const container = (typeof root === 'string') ? document.getElementById(root) : (root || document.getElementById(this.containerId));
    if (!container) return;

    const track = container.querySelector('.news-track');
    
    // Validate images first to get correct count
    const validatedItems = await this.validateImages(this.items);
    
    // Rebuild if some images failed to load
    if (validatedItems.length !== this.items.length) {
      this.items = validatedItems;
      this.rebuildCarousel(container);
    }
    
    // Bind dot clicks
    container.querySelectorAll('.news-dot')?.forEach(dot => {
      dot.addEventListener('click', this._bound.onDotClick);
    });
    
    // Bind scroll updates
    track?.addEventListener('scroll', this._bound.onScroll, { passive: true });
    
    // Bind touch/mouse interaction for pause/resume
    if (this.config.pauseOnTouch) {
      track?.addEventListener('touchstart', this._bound.onInteractionStart, { passive: true });
      track?.addEventListener('mousedown', this._bound.onInteractionStart);
    }
    
    // Bind visibility change
    if (this.config.pauseOnVisibilityChange) {
      document.addEventListener('visibilitychange', this._bound.onVisibilityChange);
    }

    // Удаляем битые изображения и пересчитываем карусель
    container.querySelectorAll('.news-img')?.forEach(img => {
      img.addEventListener('error', this._bound.onImageError, { once: true });
    });

    this.recalcSlides(container);
    this.scrollToIndex(container, 0, false);
    this.updateCounter();
    
    // Start autoplay after everything is set up
    if (this.config.autoplay && this.slidesCount > 1) {
      this.startAutoplay();
    }
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
        this.stopAutoplay();
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
    
    // Restart autoplay if slides count changed
    if (this.slidesCount <= 1) {
      this.stopAutoplay();
    }
  }

  /**
   * Validate images and return only successfully loaded ones
   * @param {Array} items - Array of news items
   * @returns {Promise<Array>} - Array of valid items
   */
  async validateImages(items) {
    const validationPromises = items.map(item => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ item, valid: true });
        img.onerror = () => resolve({ item, valid: false });
        img.src = item.imageUrl;
      });
    });
    
    const results = await Promise.all(validationPromises);
    return results.filter(r => r.valid).map(r => r.item);
  }

  /**
   * Rebuild carousel DOM with validated items
   * @param {HTMLElement} container - Carousel container
   */
  rebuildCarousel(container) {
    const track = container?.querySelector('.news-track');
    const dotsBox = container?.querySelector('.news-dots');
    
    if (!track || !this.items.length) return;
    
    // Rebuild slides
    track.innerHTML = this.items.map((x, i) => `
      <article class="news-slide" role="group" aria-label="${i+1} из ${this.items.length}">
        <div class="news-media">
          <img class="news-img" src="${this.escape(x.imageUrl)}" alt="${this.escape(x.title)}"
               onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)">
        </div>
      </article>
    `).join('');
    
    // Rebuild dots
    if (dotsBox) {
      dotsBox.innerHTML = this.items.map((_x, i) => 
        `<button class="news-dot ${i===0?'active':''}" data-index="${i}" aria-label="Перейти к ${i+1}-й"></button>`
      ).join('');
    }
    
    this.slidesCount = this.items.length;
    this.currentIndex = 0;
  }

  /**
   * Start autoplay timer
   */
  startAutoplay() {
    this.stopAutoplay();
    if (this.config.autoplay && this.slidesCount > 1) {
      this.autoplayTimer = setInterval(() => {
        this.next();
      }, this.config.interval);
    }
  }

  /**
   * Stop autoplay timer
   */
  stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  /**
   * Move to next slide
   */
  next() {
    const container = document.getElementById(this.containerId);
    const nextIndex = (this.currentIndex + 1) % this.slidesCount;
    this.scrollToIndex(container, nextIndex, true);
  }

  /**
   * Handle user interaction (touch/mouse) - pause briefly
   */
  onInteractionStart() {
    if (!this.config.pauseOnTouch) return;
    
    this.stopAutoplay();
    
    // Resume after 1.5s
    this.pauseTimer = setTimeout(() => {
      this.startAutoplay();
    }, 1500);
  }

  /**
   * Handle visibility change - pause when hidden
   */
  onVisibilityChange() {
    if (!this.config.pauseOnVisibilityChange) return;
    
    if (document.hidden) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  onDotClick(e) {
    const i = Number(e.currentTarget?.dataset?.index || 0);
    const container = document.getElementById(this.containerId);
    this.scrollToIndex(container, i, true);
    
    // Pause autoplay briefly on dot click
    this.onInteractionStart();
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
