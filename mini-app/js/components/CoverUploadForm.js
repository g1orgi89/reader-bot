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
        this.selectedCaption = '';
        this.uploading = false;
        
        // Validation constraints
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (increased for HEIC/HEIF support)
        this.MAX_CAPTION_LENGTH = 300;
        this.ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        
        // 🔧 FIX A: Debounce timer for file input changes
        this._changeDebounceTimer = null;
        
        // Store bound event handlers for proper cleanup
        this._boundHandlers = {};
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
     * 🔧 FIX A: Remove old listeners before attaching new ones to prevent duplicates
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
        
        // 🔧 FIX A: Remove old event listeners if they exist
        this._removeEventListeners();
        
        // 🔧 FIX: Set accept attribute for iOS media library compatibility
        fileInput.accept = 'image/*';
        fileInput.removeAttribute('capture');
        
        // Create and store bound handlers
        this._boundHandlers.uploadBtnClick = () => {
            // 🔧 FIX A: Don't open file picker if already uploading
            if (this.uploading) return;
            fileInput.click();
        };
        
        // 🔧 FIX A: Debounced file selection handler
        this._boundHandlers.fileInputChange = (e) => {
            // Clear any existing debounce timer
            if (this._changeDebounceTimer) {
                clearTimeout(this._changeDebounceTimer);
            }
            
            // 🔧 FIX A: Debounce to prevent double/empty change events (iOS WebView)
            this._changeDebounceTimer = setTimeout(() => {
                this._changeDebounceTimer = null;
                requestAnimationFrame(() => {
                    this.handleFileSelect(e);
                });
            }, 80); // 80ms debounce
        };
        
        this._boundHandlers.removeBtnClick = () => {
            this.clearPreview();
        };
        
        this._boundHandlers.captionInput = (e) => {
            // Store caption in component state
            this.selectedCaption = e.target.value;
            this.updateCharCount(e.target.value.length);
        };
        
        this._boundHandlers.submitBtnClick = () => {
            // 🔧 FIX A: Guard against double-click and concurrent uploads
            if (!this.uploading) {
                this.handleSubmit();
            }
        };
        
        // Attach event listeners
        uploadBtn.addEventListener('click', this._boundHandlers.uploadBtnClick);
        fileInput.addEventListener('change', this._boundHandlers.fileInputChange);
        removeBtn.addEventListener('click', this._boundHandlers.removeBtnClick);
        captionInput.addEventListener('input', this._boundHandlers.captionInput);
        submitBtn.addEventListener('click', this._boundHandlers.submitBtnClick);
        
        // 🔧 FIX A: Restore caption from component state if it exists
        if (this.selectedCaption && captionInput.value !== this.selectedCaption) {
            captionInput.value = this.selectedCaption;
            this.updateCharCount(this.selectedCaption.length);
        }
    }
    
    /**
     * 🔧 FIX A: Remove event listeners to prevent duplicates
     * @private
     */
    _removeEventListeners() {
        const uploadBtn = document.getElementById('coverUploadBtn');
        const fileInput = document.getElementById('coverFileInput');
        const submitBtn = document.getElementById('coverSubmitBtn');
        const removeBtn = document.getElementById('coverRemoveBtn');
        const captionInput = document.getElementById('coverCaptionInput');
        
        if (this._boundHandlers.uploadBtnClick && uploadBtn) {
            uploadBtn.removeEventListener('click', this._boundHandlers.uploadBtnClick);
        }
        if (this._boundHandlers.fileInputChange && fileInput) {
            fileInput.removeEventListener('change', this._boundHandlers.fileInputChange);
        }
        if (this._boundHandlers.removeBtnClick && removeBtn) {
            removeBtn.removeEventListener('click', this._boundHandlers.removeBtnClick);
        }
        if (this._boundHandlers.captionInput && captionInput) {
            captionInput.removeEventListener('input', this._boundHandlers.captionInput);
        }
        if (this._boundHandlers.submitBtnClick && submitBtn) {
            submitBtn.removeEventListener('click', this._boundHandlers.submitBtnClick);
        }
    }
    
    /**
     * Handle file selection
     * @param {Event} event - File input change event
     * 
     * 🔧 FIX: Uses requestAnimationFrame to reliably get file from iOS media library
     * iOS Safari can have timing issues where event.target.files[0] is not immediately
     * available after selection. Using requestAnimationFrame ensures we process the file
     * after the browser has fully updated the input element's files property.
     */
    handleFileSelect(event) {
        const fileInput = event.target;
        
        // 🔧 FIX: Wait for next frame to ensure file is fully loaded (iOS compatibility)
        const processFile = () => {
            const file = fileInput.files[0];
            
            if (!file) {
                // Try one more time with a longer delay for slower devices
                setTimeout(() => {
                    const retryFile = fileInput.files[0];
                    if (!retryFile) {
                        console.warn('⚠️ CoverUploadForm: No file selected after retry');
                        return;
                    }
                    this.validateAndStoreFile(retryFile, fileInput);
                }, 100);
                return;
            }
            
            this.validateAndStoreFile(file, fileInput);
        };
        
        processFile();
    }
    
    /**
     * Validate and store the selected file
     * @param {File} file - Selected file
     * @param {HTMLInputElement} fileInput - File input element (for reset on error)
     */
    validateAndStoreFile(file, fileInput) {
        // Validate file type
        if (!this.ALLOWED_TYPES.includes(file.type)) {
            this.showError('Поддерживаются только JPEG, PNG, WebP, HEIC и HEIF изображения');
            if (fileInput) fileInput.value = '';
            return;
        }
        
        // Validate file size
        if (file.size > this.MAX_FILE_SIZE) {
            this.showError('Размер файла не должен превышать 10 МБ');
            if (fileInput) fileInput.value = '';
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
        
        // 🔧 FIX A: Clear component state
        this.selectedFile = null;
        this.selectedCaption = '';
        
        // Clear any pending debounce timer
        if (this._changeDebounceTimer) {
            clearTimeout(this._changeDebounceTimer);
            this._changeDebounceTimer = null;
        }
        
        // 🔧 FIX: Fully reset file input state
        if (fileInput) {
            fileInput.value = '';
        }
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
     * 🔧 FIX A: Read caption from component state (more reliable than DOM)
     */
    async handleSubmit() {
        if (!this.selectedFile) {
            this.showError('Пожалуйста, выберите фото');
            return;
        }
        
        if (this.uploading) {
            return;
        }
        
        // 🔧 FIX A: Read from component state, fallback to DOM if needed
        let caption = this.selectedCaption || '';
        
        // Fallback: read from DOM if component state is empty
        if (!caption) {
            const captionInput = document.getElementById('coverCaptionInput');
            caption = captionInput ? captionInput.value.trim() : '';
            this.selectedCaption = caption; // Sync to component state
        }
        
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
     * 🔧 FIX A: Clean up all state and timers
     */
    destroy() {
        // Clear timers
        if (this._changeDebounceTimer) {
            clearTimeout(this._changeDebounceTimer);
            this._changeDebounceTimer = null;
        }
        
        // Remove event listeners
        this._removeEventListeners();
        
        // Clear state
        this.selectedFile = null;
        this.selectedCaption = '';
        this.uploading = false;
        this._boundHandlers = {};
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.CoverUploadForm = CoverUploadForm;
}
