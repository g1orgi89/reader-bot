/**
 * @fileoverview Image Viewer Component (Lightbox)
 * @description Full-screen image viewer with zoom and pan capabilities
 */

class ImageViewer {
    constructor() {
        this.isOpen = false;
        this.currentImage = null;
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.lastTapTime = 0;
        
        this.initViewer();
        this.attachEventListeners();
    }
    
    initViewer() {
        // Create viewer container
        this.overlay = document.createElement('div');
        this.overlay.className = 'image-viewer-overlay';
        this.overlay.style.display = 'none';
        
        this.container = document.createElement('div');
        this.container.className = 'image-viewer-container';
        
        this.image = document.createElement('img');
        this.image.className = 'image-viewer-image';
        this.image.alt = 'Full screen image';
        
        this.closeButton = document.createElement('button');
        this.closeButton.className = 'image-viewer-close';
        this.closeButton.innerHTML = '&times;';
        this.closeButton.setAttribute('aria-label', 'Закрыть');
        
        this.container.appendChild(this.image);
        this.container.appendChild(this.closeButton);
        this.overlay.appendChild(this.container);
        
        document.body.appendChild(this.overlay);
    }
    
    attachEventListeners() {
        // Close button click
        this.closeButton.addEventListener('click', () => this.close());
        
        // Click on overlay background to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Double tap to zoom
        this.image.addEventListener('touchstart', (e) => {
            const currentTime = new Date().getTime();
            const tapGap = currentTime - this.lastTapTime;
            
            if (tapGap < 300 && tapGap > 0) {
                // Double tap detected
                e.preventDefault();
                this.toggleZoom();
            }
            
            this.lastTapTime = currentTime;
        });
        
        // Double click to zoom (desktop)
        this.image.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this.toggleZoom();
        });
        
        // Pan on drag when zoomed
        this.image.addEventListener('touchstart', (e) => this.handlePanStart(e));
        this.image.addEventListener('touchmove', (e) => this.handlePanMove(e));
        this.image.addEventListener('touchend', () => this.handlePanEnd());
        
        this.image.addEventListener('mousedown', (e) => this.handlePanStart(e));
        this.image.addEventListener('mousemove', (e) => this.handlePanMove(e));
        this.image.addEventListener('mouseup', () => this.handlePanEnd());
        this.image.addEventListener('mouseleave', () => this.handlePanEnd());
    }
    
    toggleZoom() {
        if (this.scale === 1) {
            this.scale = 1.5;
        } else {
            this.scale = 1;
            this.translateX = 0;
            this.translateY = 0;
        }
        this.updateTransform();
    }
    
    handlePanStart(e) {
        if (this.scale <= 1) return;
        
        this.isDragging = true;
        const point = this.getEventPoint(e);
        this.startX = point.x - this.translateX;
        this.startY = point.y - this.translateY;
        
        this.image.style.cursor = 'grabbing';
    }
    
    handlePanMove(e) {
        if (!this.isDragging || this.scale <= 1) return;
        
        e.preventDefault();
        const point = this.getEventPoint(e);
        this.translateX = point.x - this.startX;
        this.translateY = point.y - this.startY;
        
        this.updateTransform();
    }
    
    handlePanEnd() {
        this.isDragging = false;
        if (this.scale > 1) {
            this.image.style.cursor = 'grab';
        } else {
            this.image.style.cursor = 'default';
        }
    }
    
    getEventPoint(e) {
        if (e.touches && e.touches[0]) {
            return {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
    
    updateTransform() {
        this.image.style.transform = `scale(${this.scale}) translate(${this.translateX / this.scale}px, ${this.translateY / this.scale}px)`;
        this.image.style.cursor = this.scale > 1 ? 'grab' : 'default';
    }
    
    open(imageUrl, caption = '') {
        this.currentImage = imageUrl;
        this.image.src = imageUrl;
        this.image.alt = caption || 'Full screen image';
        
        // Reset zoom and pan
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
        
        this.overlay.style.display = 'flex';
        this.isOpen = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.overlay.style.display = 'none';
        this.isOpen = false;
        this.currentImage = null;
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Export as global singleton
if (typeof window !== 'undefined') {
    window.ImageViewer = ImageViewer;
}
