/**
 * 📸 COVER UPLOAD FORM COMPONENT
 * 
 * Inline photo upload form for Covers feed
 * Features:
 * - File input with image validation (JPEG/PNG/WebP/HEIC/HEIF, max 10MB)
 * - Optional caption (max 300 chars)
 * - Brand-styled primary button
 * - Upload via API with multipart/form-data
 * - Success callback for feed refresh
 * - User-friendly error handling
 * 
 * @version 1.0.0
 * @author g1orgi89
 * @date 2026-01-22
 */

class CoverUploadForm {
    /**
     * @param {Object} options - Configuration options
     * @param {Function} options.onSuccess - Callback after successful upload
     * @param {Function} options.onError - Callback on error
     * @param {Object} options.api - API service instance
     */
    constructor(options = {}) {
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || ((error) => console.error('Upload error:', error));
        this.api = options.api || (window.app && window.app.api);
        
        this.selectedFile = null;
        this.uploading = false;
        
        // Validation constraints
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (increased for HEIC/HEIF support)
        this.MAX_CAPTION_LENGTH = 300;
        this.ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    }
    
    /**
     * Render the upload form HTML
     * @returns {string} HTML string
     */
    render() {
        return `
            <div class="cover-upload-form" id="coverUploadForm">
                <button 
                    type="button" 
                    class="cover-upload-btn"
                    id="coverUploadBtn"
                    aria-label="Добавить фото">
                    <span class="cover-upload-btn__icon">📸</span>
                    <span class="cover-upload-btn__text">Добавить фото</span>
                </button>
                
                <input 
                    type="file" 
                    id="coverFileInput"
                    class="cover-upload-form__input"
                    accept="image/*"
                    style="display: none;">
                
                <div id="coverUploadPreview" class="cover-upload-preview" style="display: none;">
                    <div class="cover-upload-preview__image-wrapper">
                        <img id="coverPreviewImage" class="cover-upload-preview__image" alt="Preview">
                        <button type="button" class="cover-upload-preview__remove" id="coverRemoveBtn" aria-label="Удалить">
                            ✕
                        </button>
                    </div>
                    
                    <textarea 
                        id="coverCaptionInput"
                        class="cover-upload-form__caption"
                        placeholder="Добавьте описание к фото (необязательно)"
                        maxlength="${this.MAX_CAPTION_LENGTH}"
                        rows="3"></textarea>
                    
                    <div class="cover-upload-form__char-count">
                        <span id="coverCharCount">0</span>/${this.MAX_CAPTION_LENGTH}
                    </div>
                    
                    <button 
                        type="button" 
                        class="cover-upload-form__submit"
                        id="coverSubmitBtn">
                        Опубликовать
                    </button>
                </div>
                
                <div id="coverUploadError" class="cover-upload-error" style="display: none;"></div>
            </div>
        `;
    }
    
    /**
     * Attach event listeners after rendering
     */
    attachEventListeners() {
        const uploadBtn = document.getElementById('coverUploadBtn');
        const fileInput = document.getElementById('coverFileInput');
        const submitBtn = document.getElementById('coverSubmitBtn');
        const removeBtn = document.getElementById('coverRemoveBtn');
        const captionInput = document.getElementById('coverCaptionInput');
        
        if (!uploadBtn || !fileInput || !submitBtn || !removeBtn || !captionInput) {
            console.error('❌ CoverUploadForm: Required elements not found in DOM');
            return;
        }
        
        // 🔧 FIX: Set accept attribute for iOS media library compatibility
        fileInput.accept = 'image/*';
        fileInput.removeAttribute('capture');
        
        // Open file picker when button clicked
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });
        
        // Handle remove button
        removeBtn.addEventListener('click', () => {
            this.clearPreview();
        });
        
        // Handle caption input
        captionInput.addEventListener('input', (e) => {
            this.updateCharCount(e.target.value.length);
        });
        
        // 🔧 FIX: Single submit handler with guard to prevent double-submit
        submitBtn.addEventListener('click', () => {
            if (!this.uploading) { // Guard against double-click
                this.handleSubmit();
            }
        });
    }
    
    /**
     * Handle file selection
     * @param {Event} event - File input change event
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        
        if (!file) {
            return;
        }
        
        // Validate file type
        if (!this.ALLOWED_TYPES.includes(file.type)) {
            this.showError('Поддерживаются только JPEG, PNG, WebP, HEIC и HEIF изображения');
            event.target.value = '';
            return;
        }
        
        // Validate file size
        if (file.size > this.MAX_FILE_SIZE) {
            this.showError('Размер файла не должен превышать 10 МБ');
            event.target.value = '';
            return;
        }
        
        this.selectedFile = file;
        this.showPreview(file);
        this.hideError();
    }
    
    /**
     * Show image preview
     * @param {File} file - Selected image file
     */
    showPreview(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const previewImage = document.getElementById('coverPreviewImage');
            const previewContainer = document.getElementById('coverUploadPreview');
            const uploadBtn = document.getElementById('coverUploadBtn');
            
            if (previewImage && previewContainer && uploadBtn) {
                previewImage.src = e.target.result;
                previewContainer.style.display = 'block';
                uploadBtn.style.display = 'none';
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    /**
     * Clear preview and reset form
     */
    clearPreview() {
        const fileInput = document.getElementById('coverFileInput');
        const previewContainer = document.getElementById('coverUploadPreview');
        const uploadBtn = document.getElementById('coverUploadBtn');
        const captionInput = document.getElementById('coverCaptionInput');
        
        this.selectedFile = null;
        
        if (fileInput) fileInput.value = '';
        if (captionInput) captionInput.value = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (uploadBtn) uploadBtn.style.display = 'flex';
        
        this.updateCharCount(0);
        this.hideError();
    }
    
    /**
     * Update character count display
     * @param {number} count - Current character count
     */
    updateCharCount(count) {
        const charCountEl = document.getElementById('coverCharCount');
        if (charCountEl) {
            charCountEl.textContent = count;
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        const errorEl = document.getElementById('coverUploadError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
    
    /**
     * Hide error message
     */
    hideError() {
        const errorEl = document.getElementById('coverUploadError');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }
    
    /**
     * Handle form submission
     */
    async handleSubmit() {
        if (!this.selectedFile) {
            this.showError('Пожалуйста, выберите фото');
            return;
        }
        
        if (this.uploading) {
            return;
        }
        
        const captionInput = document.getElementById('coverCaptionInput');
        const caption = captionInput ? captionInput.value.trim() : '';
        
        // Validate caption length
        if (caption.length > this.MAX_CAPTION_LENGTH) {
            this.showError(`Описание не должно превышать ${this.MAX_CAPTION_LENGTH} символов`);
            return;
        }
        
        this.uploading = true;
        this.setUploadingState(true);
        this.hideError();
        
        try {
            console.log('📸 CoverUploadForm: Uploading photo...');
            
            if (!this.api) {
                throw new Error('API service not available');
            }
            
            const result = await this.api.uploadCover(this.selectedFile, caption);
            
            console.log('✅ CoverUploadForm: Photo uploaded successfully', result);
            
            // Clear form
            this.clearPreview();
            
            // Trigger haptic feedback if available
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            
            // Call success callback
            this.onSuccess(result);
            
        } catch (error) {
            console.error('❌ CoverUploadForm: Upload failed', error);
            
            // Show user-friendly error message
            let errorMessage = 'Не удалось загрузить фото. Попробуйте ещё раз.';
            
            if (error.message.includes('already posted')) {
                errorMessage = 'Вы уже добавили фото сегодня. Попробуйте завтра!';
            } else if (error.message.includes('size')) {
                errorMessage = 'Файл слишком большой. Максимум 10 МБ.';
            } else if (error.message.includes('format') || error.message.includes('type')) {
                errorMessage = 'Неподдерживаемый формат. Используйте JPEG, PNG, WebP, HEIC или HEIF.';
            }
            
            this.showError(errorMessage);
            
            // Trigger haptic feedback if available
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            
            // Call error callback
            this.onError(error);
            
        } finally {
            this.uploading = false;
            this.setUploadingState(false);
        }
    }
    
    /**
     * Set uploading state (disable buttons, show spinner)
     * @param {boolean} isUploading - Whether currently uploading
     */
    setUploadingState(isUploading) {
        const submitBtn = document.getElementById('coverSubmitBtn');
        const removeBtn = document.getElementById('coverRemoveBtn');
        
        if (submitBtn) {
            submitBtn.disabled = isUploading;
            submitBtn.textContent = isUploading ? 'Загрузка...' : 'Опубликовать';
        }
        
        if (removeBtn) {
            removeBtn.disabled = isUploading;
        }
    }
    
    /**
     * Destroy component and clean up
     */
    destroy() {
        this.selectedFile = null;
        this.uploading = false;
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.CoverUploadForm = CoverUploadForm;
}
