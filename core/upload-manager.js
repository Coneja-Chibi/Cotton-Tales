/**
 * ============================================================================
 * COTTON-TALES UPLOAD MANAGER
 * ============================================================================
 * Handles file uploads for sprites, sprite packs, and backgrounds.
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { getRequestHeaders } from '../../../../../script.js';
import { getSpritesList, spriteCache } from '../ct-expressions.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODULE_NAME = 'ct-upload-manager';

export const UPLOAD_ENDPOINTS = {
    SINGLE_SPRITE: '/api/sprites/upload',
    SPRITE_PACK: '/api/sprites/upload-zip',
    BACKGROUND: '/api/backgrounds/upload'
};

// =============================================================================
// CORE UPLOAD HANDLER
// =============================================================================

/**
 * Core file upload handler
 * @param {string} url - Upload endpoint
 * @param {FormData} formData - Form data with file
 * @returns {Promise<Object>} Server response
 */
export async function handleFileUpload(url, formData) {
    try {
        const result = await fetch(url, {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
            body: formData,
            cache: 'no-cache',
        });

        if (!result.ok) {
            const errorText = await result.text().catch(() => result.statusText);
            throw new Error(`Upload failed: ${result.status} ${errorText}`);
        }

        const data = await result.json();

        // Refresh cache for sprite uploads
        const characterName = formData.get('name');
        if (characterName && spriteCache) {
            delete spriteCache[characterName];
            await getSpritesList(characterName);
        }

        return data ?? {};
    } catch (error) {
        console.error(`[${MODULE_NAME}] Upload error:`, error);
        throw error;
    }
}

// =============================================================================
// FILE VALIDATION
// =============================================================================

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {boolean} True if valid
 */
function isValidImageFile(file) {
    if (!file) return false;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    return validTypes.includes(file.type) && file.size > 0;
}

/**
 * Validate archive file
 * @param {File} file - File to validate
 * @returns {boolean} True if valid
 */
function isValidArchiveFile(file) {
    if (!file) return false;
    const validTypes = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'];
    return validTypes.includes(file.type) && file.size > 0;
}

// =============================================================================
// SPRITE UPLOADS
// =============================================================================

/**
 * Upload a single sprite image
 * @param {string} characterName - Character folder name
 * @param {string} expression - Expression label
 * @param {File} file - Image file
 * @param {string|null} spriteName - Optional custom filename
 * @returns {Promise<Object>} Upload result
 */
export async function uploadSprite(characterName, expression, file, spriteName = null) {
    if (!characterName || !expression || !file) {
        throw new Error('Missing required parameters');
    }

    if (!isValidImageFile(file)) {
        throw new Error(`Invalid file type: ${file.type}. Please use PNG, JPG, WebP, or GIF.`);
    }

    const formData = new FormData();
    formData.append('name', characterName);
    formData.append('label', expression);
    formData.append('avatar', file);
    formData.append('spriteName', spriteName || expression);

    return handleFileUpload(UPLOAD_ENDPOINTS.SINGLE_SPRITE, formData);
}

/**
 * Upload a ZIP file containing multiple sprites
 * @param {string} characterName - Character folder name
 * @param {File} zipFile - ZIP file
 * @returns {Promise<Object>} Upload result
 */
export async function uploadSpritePackage(characterName, zipFile) {
    if (!characterName || !zipFile) {
        throw new Error('Missing required parameters');
    }

    if (!isValidArchiveFile(zipFile)) {
        throw new Error(`Invalid file type: ${zipFile.type}. Please use a ZIP file.`);
    }

    const formData = new FormData();
    formData.append('name', characterName);
    formData.append('avatar', zipFile);

    return handleFileUpload(UPLOAD_ENDPOINTS.SPRITE_PACK, formData);
}

// =============================================================================
// BACKGROUND UPLOADS
// =============================================================================

/**
 * Upload a background image
 * @param {File} file - Image file
 * @returns {Promise<Object>} Upload result
 */
export async function uploadBackground(file) {
    if (!file) {
        throw new Error('No file provided');
    }

    if (!isValidImageFile(file)) {
        throw new Error(`Invalid image file: ${file.type}. Please use PNG, JPG, WebP, or GIF.`);
    }

    const formData = new FormData();
    formData.append('image', file);

    return handleFileUpload(UPLOAD_ENDPOINTS.BACKGROUND, formData);
}
