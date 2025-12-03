/**
 * ============================================================================
 * SPRITE IMPORT MODAL
 * ============================================================================
 * Smart sprite pack import with method-aware handling:
 * - BERT: Shows mapping modal for fixed labels
 * - LLM/VectHare: Auto-imports using filenames as labels
 *
 * @version 1.0.0
 * ============================================================================
 */

import { getSettings } from '../core/settings-manager.js';
import { EXPRESSION_API, DEFAULT_EXPRESSIONS } from '../core/constants.js';
import { uploadSprite } from '../core/upload-manager.js';

const MODULE_NAME = 'CT-SpriteImport';

// =============================================================================
// ZIP HANDLING
// =============================================================================

/**
 * Extract images from a ZIP file
 * @param {File} zipFile - ZIP file to extract
 * @returns {Promise<Array<{name: string, blob: Blob, dataUrl: string}>>}
 */
async function extractImagesFromZip(zipFile) {
    // Load JSZip
    const JSZip = window.JSZip || (await import('/lib/jszip.min.js')).default;

    const zip = await JSZip.loadAsync(zipFile);
    const images = [];
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        const ext = relativePath.toLowerCase().match(/\.[^.]+$/)?.[0];
        if (!validExtensions.includes(ext)) continue;

        // Skip hidden/system files
        const filename = relativePath.split('/').pop();
        if (filename.startsWith('.') || filename.startsWith('__')) continue;

        try {
            const blob = await zipEntry.async('blob');
            const dataUrl = await blobToDataUrl(blob);
            const baseName = filename.replace(/\.[^.]+$/, ''); // Remove extension

            images.push({
                name: baseName,
                originalPath: relativePath,
                blob: blob,
                dataUrl: dataUrl,
                extension: ext,
            });
        } catch (err) {
            console.warn(`[${MODULE_NAME}] Failed to extract ${relativePath}:`, err);
        }
    }

    return images;
}

/**
 * Convert Blob to data URL
 */
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// =============================================================================
// BERT MAPPING MODAL
// =============================================================================

/**
 * Show BERT label mapping modal
 * @param {Array} images - Extracted images
 * @param {string} characterFolder - Target character folder
 * @returns {Promise<{imported: number, skipped: number}>}
 */
async function showBertMappingModal(images, characterFolder) {
    return new Promise((resolve) => {
        let currentIndex = 0;
        const assignments = new Map(); // imageName -> bertLabel
        const usedLabels = new Set();

        // Available BERT labels
        const bertLabels = [...DEFAULT_EXPRESSIONS];

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'ct-import-modal-overlay';
        modal.innerHTML = `
            <div class="ct-import-modal">
                <div class="ct-import-header">
                    <h3><i class="fa-solid fa-tags"></i> Assign BERT Labels</h3>
                    <span class="ct-import-progress">1 / ${images.length}</span>
                </div>

                <div class="ct-import-preview">
                    <img src="" alt="Preview" class="ct-import-image">
                    <div class="ct-import-filename"></div>
                </div>

                <div class="ct-import-controls">
                    <label class="ct-import-label">
                        Assign to expression:
                        <select class="ct-import-select">
                            <option value="">-- Skip this image --</option>
                            ${bertLabels.map(l => `<option value="${l}">${l}</option>`).join('')}
                        </select>
                    </label>

                    <div class="ct-import-used">
                        <span>Already assigned:</span>
                        <div class="ct-import-used-labels"></div>
                    </div>
                </div>

                <div class="ct-import-actions">
                    <button class="ct-import-btn ct-import-prev" disabled>
                        <i class="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <button class="ct-import-btn ct-import-skip">
                        Skip <i class="fa-solid fa-forward"></i>
                    </button>
                    <button class="ct-import-btn ct-import-next ct-primary">
                        Next <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="ct-import-footer">
                    <button class="ct-import-btn ct-import-cancel">Cancel</button>
                    <button class="ct-import-btn ct-import-finish ct-primary" style="display:none;">
                        <i class="fa-solid fa-check"></i> Import Selected
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Elements
        const imgEl = modal.querySelector('.ct-import-image');
        const filenameEl = modal.querySelector('.ct-import-filename');
        const progressEl = modal.querySelector('.ct-import-progress');
        const selectEl = modal.querySelector('.ct-import-select');
        const usedLabelsEl = modal.querySelector('.ct-import-used-labels');
        const prevBtn = modal.querySelector('.ct-import-prev');
        const nextBtn = modal.querySelector('.ct-import-next');
        const skipBtn = modal.querySelector('.ct-import-skip');
        const cancelBtn = modal.querySelector('.ct-import-cancel');
        const finishBtn = modal.querySelector('.ct-import-finish');

        // Update display for current image
        function updateDisplay() {
            const img = images[currentIndex];
            imgEl.src = img.dataUrl;
            filenameEl.textContent = img.name + img.extension;
            progressEl.textContent = `${currentIndex + 1} / ${images.length}`;

            // Restore previous selection
            selectEl.value = assignments.get(img.name) || '';

            // Update dropdown - disable already used labels
            Array.from(selectEl.options).forEach(opt => {
                if (opt.value && usedLabels.has(opt.value) && opt.value !== assignments.get(img.name)) {
                    opt.disabled = true;
                    opt.textContent = `${opt.value} (assigned)`;
                } else if (opt.value) {
                    opt.disabled = false;
                    opt.textContent = opt.value;
                }
            });

            // Update used labels display
            usedLabelsEl.innerHTML = usedLabels.size > 0
                ? [...usedLabels].map(l => `<span class="ct-import-chip">${l}</span>`).join('')
                : '<span class="ct-import-empty">None yet</span>';

            // Update buttons
            prevBtn.disabled = currentIndex === 0;

            const isLast = currentIndex === images.length - 1;
            nextBtn.style.display = isLast ? 'none' : '';
            skipBtn.style.display = isLast ? 'none' : '';
            finishBtn.style.display = isLast ? '' : 'none';
        }

        // Save current selection
        function saveSelection() {
            const selected = selectEl.value;
            const img = images[currentIndex];

            // Remove previous assignment if any
            const prevLabel = assignments.get(img.name);
            if (prevLabel) {
                usedLabels.delete(prevLabel);
            }

            if (selected) {
                assignments.set(img.name, selected);
                usedLabels.add(selected);
            } else {
                assignments.delete(img.name);
            }
        }

        // Event handlers
        selectEl.addEventListener('change', saveSelection);

        prevBtn.addEventListener('click', () => {
            saveSelection();
            currentIndex--;
            updateDisplay();
        });

        nextBtn.addEventListener('click', () => {
            saveSelection();
            currentIndex++;
            updateDisplay();
        });

        skipBtn.addEventListener('click', () => {
            selectEl.value = '';
            saveSelection();
            currentIndex++;
            updateDisplay();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve({ imported: 0, skipped: images.length });
        });

        finishBtn.addEventListener('click', async () => {
            saveSelection();
            modal.querySelector('.ct-import-modal').innerHTML = `
                <div class="ct-import-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Importing sprites...</span>
                </div>
            `;

            let imported = 0;
            let skipped = 0;

            for (const img of images) {
                const label = assignments.get(img.name);
                if (!label) {
                    skipped++;
                    continue;
                }

                try {
                    const file = new File([img.blob], label + img.extension, { type: img.blob.type });
                    await uploadSprite(characterFolder, label, file);
                    imported++;
                } catch (err) {
                    console.error(`[${MODULE_NAME}] Failed to upload ${img.name}:`, err);
                    skipped++;
                }
            }

            modal.remove();
            resolve({ imported, skipped });
        });

        // Initial display
        updateDisplay();
    });
}

// =============================================================================
// AUTO IMPORT (LLM/VectHare)
// =============================================================================

/**
 * Auto-import sprites using filenames as labels
 * @param {Array} images - Extracted images
 * @param {string} characterFolder - Target character folder
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<{imported: number, skipped: number}>}
 */
async function autoImportSprites(images, characterFolder, onProgress) {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        onProgress?.(i + 1, images.length);

        try {
            const file = new File([img.blob], img.name + img.extension, { type: img.blob.type });
            await uploadSprite(characterFolder, img.name, file);
            imported++;
        } catch (err) {
            console.error(`[${MODULE_NAME}] Failed to upload ${img.name}:`, err);
            skipped++;
        }
    }

    return { imported, skipped };
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Smart import sprite pack with method-aware handling
 * @param {File} zipFile - ZIP file to import
 * @param {string} characterFolder - Target character folder
 * @returns {Promise<{imported: number, skipped: number}>}
 */
export async function smartImportSpritePack(zipFile, characterFolder) {
    const settings = getSettings();
    const method = settings.expressionApi || EXPRESSION_API.local;

    // Show loading toast
    toastr.info('Reading sprite pack...');

    // Extract images
    const images = await extractImagesFromZip(zipFile);

    if (images.length === 0) {
        toastr.warning('No valid images found in ZIP file');
        return { imported: 0, skipped: 0 };
    }

    console.log(`[${MODULE_NAME}] Extracted ${images.length} images, method: ${method}`);

    // BERT mode - needs label mapping
    if (method === EXPRESSION_API.local) {
        // Check if any images already match BERT labels
        const matched = images.filter(img => DEFAULT_EXPRESSIONS.includes(img.name.toLowerCase()));
        const unmatched = images.filter(img => !DEFAULT_EXPRESSIONS.includes(img.name.toLowerCase()));

        // Auto-import matched ones
        if (matched.length > 0) {
            toastr.info(`Auto-importing ${matched.length} matching sprites...`);
            for (const img of matched) {
                try {
                    const label = img.name.toLowerCase();
                    const file = new File([img.blob], label + img.extension, { type: img.blob.type });
                    await uploadSprite(characterFolder, label, file);
                } catch (err) {
                    console.warn(`[${MODULE_NAME}] Failed to auto-import ${img.name}`);
                }
            }
        }

        // Show modal for unmatched
        if (unmatched.length > 0) {
            return await showBertMappingModal(unmatched, characterFolder);
        }

        return { imported: matched.length, skipped: 0 };
    }

    // LLM or VectHare mode - auto-import with progress
    const progressToast = toastr.info('Importing 0 / ' + images.length, '', { timeOut: 0, extendedTimeOut: 0 });

    const result = await autoImportSprites(images, characterFolder, (current, total) => {
        progressToast.find('.toast-message').text(`Importing ${current} / ${total}`);
    });

    toastr.clear(progressToast);
    return result;
}

// =============================================================================
// CSS (injected on first use)
// =============================================================================

let cssInjected = false;

function injectStyles() {
    if (cssInjected) return;
    cssInjected = true;

    const style = document.createElement('style');
    style.textContent = `
        .ct-import-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            z-index: 10500;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ct-import-modal {
            background: var(--SmartThemeBlurTintColor, #1a1a2e);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .ct-import-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .ct-import-header h3 {
            margin: 0;
            font-size: 16px;
            color: var(--SmartThemeBodyColor, #e0e0e0);
        }

        .ct-import-progress {
            font-size: 12px;
            color: var(--SmartThemeQuoteColor, #888);
            background: rgba(255, 255, 255, 0.1);
            padding: 4px 10px;
            border-radius: 20px;
        }

        .ct-import-preview {
            text-align: center;
            margin-bottom: 20px;
        }

        .ct-import-image {
            max-width: 200px;
            max-height: 200px;
            border-radius: 8px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            background: rgba(0, 0, 0, 0.3);
        }

        .ct-import-filename {
            margin-top: 8px;
            font-size: 12px;
            color: var(--SmartThemeQuoteColor, #888);
            font-family: monospace;
        }

        .ct-import-controls {
            margin-bottom: 20px;
        }

        .ct-import-label {
            display: block;
            font-size: 13px;
            color: var(--SmartThemeBodyColor, #e0e0e0);
            margin-bottom: 8px;
        }

        .ct-import-select {
            width: 100%;
            padding: 10px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: var(--SmartThemeBodyColor, #e0e0e0);
            font-size: 14px;
            cursor: pointer;
        }

        .ct-import-select:focus {
            outline: none;
            border-color: var(--SmartThemeQuoteColor, #888);
        }

        .ct-import-select option:disabled {
            color: #666;
        }

        .ct-import-used {
            margin-top: 12px;
            font-size: 11px;
            color: var(--SmartThemeQuoteColor, #888);
        }

        .ct-import-used-labels {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-top: 6px;
        }

        .ct-import-chip {
            background: rgba(100, 200, 100, 0.2);
            color: #8f8;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
        }

        .ct-import-empty {
            color: #666;
            font-style: italic;
        }

        .ct-import-actions {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }

        .ct-import-footer {
            display: flex;
            justify-content: space-between;
            padding-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ct-import-btn {
            padding: 10px 16px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--SmartThemeBodyColor, #e0e0e0);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .ct-import-btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
        }

        .ct-import-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .ct-import-btn.ct-primary {
            background: rgba(100, 150, 255, 0.3);
            border-color: rgba(100, 150, 255, 0.5);
        }

        .ct-import-btn.ct-primary:hover:not(:disabled) {
            background: rgba(100, 150, 255, 0.4);
        }

        .ct-import-loading {
            text-align: center;
            padding: 40px;
            color: var(--SmartThemeBodyColor, #e0e0e0);
        }

        .ct-import-loading i {
            font-size: 24px;
            margin-bottom: 12px;
            display: block;
        }
    `;
    document.head.appendChild(style);
}

// Inject styles when module loads
injectStyles();
