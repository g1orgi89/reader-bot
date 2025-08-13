/**
 * 🖼️ IMAGE UTILS - Утилиты для работы с изображениями
 * 
 * Функции для:
 * - Валидации изображений
 * - Изменения размера
 * - Сжатия
 * - Конвертации форматов
 * 
 * @author Claude Assistant
 * @version 1.0.0
 */

class ImageUtils {
    /**
     * Константы для валидации
     */
    static CONSTRAINTS = {
        MAX_FILE_SIZE: 3 * 1024 * 1024, // 3MB
        TARGET_SIZE: 512, // 512x512 пикселей
        QUALITY: 0.8, // 80% качества
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        OUTPUT_FORMAT: 'image/jpeg' // Выходной формат
    };

    /**
     * 🔍 Валидация файла изображения
     * @param {File} file - Файл изображения
     * @returns {{isValid: boolean, error?: string}} Результат валидации
     */
    static validateImage(file) {
        try {
            // Проверка существования файла
            if (!file) {
                return { isValid: false, error: 'Файл не выбран' };
            }

            // Проверка типа файла
            if (!this.CONSTRAINTS.ALLOWED_TYPES.includes(file.type)) {
                return { 
                    isValid: false, 
                    error: 'Неподдерживаемый формат. Используйте JPG, PNG или WebP' 
                };
            }

            // Проверка размера файла
            if (file.size > this.CONSTRAINTS.MAX_FILE_SIZE) {
                const sizeMB = Math.round(file.size / (1024 * 1024) * 10) / 10;
                return { 
                    isValid: false, 
                    error: `Файл слишком большой (${sizeMB}MB). Максимум: 3MB` 
                };
            }

            // Базовая проверка имени файла
            if (!file.name || file.name.length < 3) {
                return { 
                    isValid: false, 
                    error: 'Некорректное имя файла' 
                };
            }

            return { isValid: true };

        } catch (error) {
            console.error('❌ Ошибка валидации изображения:', error);
            return { 
                isValid: false, 
                error: 'Ошибка при проверке файла' 
            };
        }
    }

    /**
     * 📏 Изменение размера изображения
     * @param {File} file - Исходный файл
     * @param {number} targetSize - Целевой размер (квадрат)
     * @param {number} quality - Качество сжатия (0.1-1.0)
     * @returns {Promise<Blob>} Обработанное изображение
     */
    static async resizeImage(file, targetSize = this.CONSTRAINTS.TARGET_SIZE, quality = this.CONSTRAINTS.QUALITY) {
        return new Promise((resolve, reject) => {
            try {
                // Создаем элементы для обработки
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                img.onload = () => {
                    try {
                        // Вычисляем размеры для кропа (квадрат из центра)
                        const minDimension = Math.min(img.width, img.height);
                        const cropX = (img.width - minDimension) / 2;
                        const cropY = (img.height - minDimension) / 2;

                        // Устанавливаем размер canvas
                        canvas.width = targetSize;
                        canvas.height = targetSize;

                        // Включаем сглаживание для лучшего качества
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';

                        // Рисуем обрезанное и масштабированное изображение
                        ctx.drawImage(
                            img,
                            cropX, cropY, minDimension, minDimension, // Источник (квадрат из центра)
                            0, 0, targetSize, targetSize // Назначение (целевой размер)
                        );

                        // Конвертируем в blob
                        canvas.toBlob(
                            (blob) => {
                                if (blob) {
                                    console.log(`✅ Изображение обработано: ${img.width}x${img.height} → ${targetSize}x${targetSize}`);
                                    resolve(blob);
                                } else {
                                    reject(new Error('Не удалось создать blob'));
                                }
                            },
                            this.CONSTRAINTS.OUTPUT_FORMAT,
                            quality
                        );

                    } catch (error) {
                        reject(new Error(`Ошибка обработки изображения: ${error.message}`));
                    }
                };

                img.onerror = () => {
                    reject(new Error('Не удалось загрузить изображение'));
                };

                // Загружаем изображение
                img.src = URL.createObjectURL(file);

            } catch (error) {
                reject(new Error(`Ошибка инициализации обработки: ${error.message}`));
            }
        });
    }

    /**
     * 🔄 Полная обработка изображения
     * @param {File} file - Исходный файл
     * @param {Object} options - Опции обработки
     * @returns {Promise<{blob: Blob, preview: string}>} Обработанное изображение и превью
     */
    static async processImage(file, options = {}) {
        try {
            // Объединяем опции с дефолтными значениями
            const config = {
                targetSize: this.CONSTRAINTS.TARGET_SIZE,
                quality: this.CONSTRAINTS.QUALITY,
                ...options
            };

            console.log('🔄 Начинаем обработку изображения:', {
                name: file.name,
                size: file.size,
                type: file.type,
                config
            });

            // Валидация
            const validation = this.validateImage(file);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Изменяем размер
            const blob = await this.resizeImage(file, config.targetSize, config.quality);

            // Создаем URL для превью
            const preview = URL.createObjectURL(blob);

            console.log('✅ Изображение обработано успешно:', {
                originalSize: file.size,
                processedSize: blob.size,
                compression: Math.round((1 - blob.size / file.size) * 100) + '%'
            });

            return { blob, preview };

        } catch (error) {
            console.error('❌ Ошибка обработки изображения:', error);
            throw error;
        }
    }

    /**
     * 🎨 Создание превью изображения
     * @param {File|Blob} fileOrBlob - Файл или blob
     * @returns {Promise<string>} URL превью
     */
    static async createPreview(fileOrBlob) {
        try {
            if (!fileOrBlob) {
                throw new Error('Файл не предоставлен');
            }

            return URL.createObjectURL(fileOrBlob);

        } catch (error) {
            console.error('❌ Ошибка создания превью:', error);
            throw new Error('Не удалось создать превью изображения');
        }
    }

    /**
     * 🧹 Очистка URL объектов для освобождения памяти
     * @param {string|string[]} urls - URL или массив URL для очистки
     */
    static cleanupUrls(urls) {
        try {
            const urlArray = Array.isArray(urls) ? urls : [urls];
            
            urlArray.forEach(url => {
                if (url && typeof url === 'string' && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });

            console.log('🧹 Очищены URL объекты:', urlArray.length);

        } catch (error) {
            console.warn('⚠️ Ошибка очистки URL объектов:', error);
        }
    }

    /**
     * 📊 Получение информации об изображении
     * @param {File} file - Файл изображения
     * @returns {Promise<Object>} Информация об изображении
     */
    static async getImageInfo(file) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();

                img.onload = () => {
                    const info = {
                        width: img.width,
                        height: img.height,
                        aspectRatio: img.width / img.height,
                        isSquare: img.width === img.height,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        lastModified: file.lastModified
                    };

                    URL.revokeObjectURL(img.src);
                    resolve(info);
                };

                img.onerror = () => {
                    URL.revokeObjectURL(img.src);
                    reject(new Error('Не удалось загрузить изображение для анализа'));
                };

                img.src = URL.createObjectURL(file);

            } catch (error) {
                reject(new Error(`Ошибка анализа изображения: ${error.message}`));
            }
        });
    }

    /**
     * 🎯 Проверка поддержки форматов браузером
     * @returns {Object} Объект с поддерживаемыми форматами
     */
    static getSupportedFormats() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;

        const formats = {
            jpeg: true, // JPEG поддерживается везде
            png: true,  // PNG поддерживается везде
            webp: false,
            avif: false
        };

        try {
            // Проверяем WebP
            formats.webp = canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
            
            // Проверяем AVIF (новый формат)
            formats.avif = canvas.toDataURL('image/avif').indexOf('image/avif') === 5;
        } catch (error) {
            console.warn('⚠️ Ошибка проверки поддержки форматов:', error);
        }

        return formats;
    }

    /**
     * 📱 Проверка возможностей устройства
     * @returns {Object} Информация о возможностях
     */
    static getDeviceCapabilities() {
        return {
            // Поддержка File API
            fileApi: !!(window.File && window.FileReader && window.FileList && window.Blob),
            
            // Поддержка Canvas API
            canvas: !!(document.createElement('canvas').getContext),
            
            // Поддержка drag & drop
            dragDrop: ('draggable' in document.createElement('div')) && !!window.FileReader,
            
            // Мобильное устройство
            isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            
            // Доступ к камере
            camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            
            // Максимальный размер canvas (приблизительно)
            maxCanvasSize: this.getMaxCanvasSize()
        };
    }

    /**
     * 📐 Определение максимального размера canvas
     * @returns {number} Максимальный размер в пикселях
     */
    static getMaxCanvasSize() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Пробуем разные размеры, начиная с больших
            const sizes = [32767, 16384, 8192, 4096, 2048];
            
            for (const size of sizes) {
                canvas.width = size;
                canvas.height = size;
                
                // Пробуем нарисовать что-то
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, 1, 1);
                
                // Если получилось прочитать пиксель, размер поддерживается
                const imageData = ctx.getImageData(0, 0, 1, 1);
                if (imageData && imageData.data && imageData.data[3] === 255) {
                    return size;
                }
            }
            
            return 2048; // Безопасный fallback

        } catch (error) {
            console.warn('⚠️ Ошибка определения размера canvas:', error);
            return 2048;
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageUtils;
} else {
    window.ImageUtils = ImageUtils;
}