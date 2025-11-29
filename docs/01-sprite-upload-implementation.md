# Cotton-Tales: Sprite & Expression Upload Implementation Guide

## Executive Summary

This document provides a complete technical implementation plan for adding sprite upload, pack upload, background upload, and expression add functionality to the Cotton-Tales extension.

---

## 1. Current State: UI Upload Buttons

### 1.1 Upload Button Locations & Status

| Button | Location | ID | Status |
|--------|----------|-----|--------|
| Add Expression | sprite-manager.js:693 | N/A (function) | Shows toastr info only |
| Upload Sprite | settings-panel.js:985 | `ct_upload_sprite` | No event listener |
| Upload Pack | settings-panel.js:989 | `ct_upload_pack` | No event listener |
| Upload Background | settings-panel.js:596 | `ct_upload_bg` | No event listener |

---

## 2. SillyTavern Native Upload System

### 2.1 API Endpoints

| Endpoint | Method | Fields | Purpose |
|----------|--------|--------|---------|
| `/api/sprites/upload` | POST | `name`, `label`, `avatar`, `spriteName` | Upload single sprite |
| `/api/sprites/upload-zip` | POST | `name`, `avatar` | Upload ZIP of sprites |
| `/api/sprites/get` | GET | `name` (query param) | Fetch sprite list |
| `/api/backgrounds/all` | POST | (empty body) | Get background list |

### 2.2 FormData Patterns

**Single Sprite Upload:**
```javascript
const formData = new FormData();
formData.append('name', characterName);        // Required: folder name
formData.append('label', expressionLabel);     // Required: emotion/expression
formData.append('avatar', fileObject);         // Required: File object
formData.append('spriteName', customName);     // Optional: custom filename
```

**ZIP Pack Upload:**
```javascript
const formData = new FormData();
formData.append('name', characterName);        // Required: folder name
formData.append('avatar', zipFileObject);      // Required: ZIP File object
```

### 2.3 Critical Implementation Details

1. Use `getRequestHeaders({ omitContentType: true })` for multipart
2. Always clear cache after upload: `delete spriteCache[name]`
3. Refetch from server after upload
4. Use `toastr` for user feedback

---

## 3. Implementation Plan

### Phase 1: Create Upload Manager Module

**New file: `core/upload-manager.js`**

```javascript
/**
 * COTTON-TALES UPLOAD MANAGER
 * Handles file uploads for sprites, sprite packs, and backgrounds.
 */

import { getRequestHeaders } from '../../../../../script.js';
import { getSpritesList } from '../ct-expressions.js';

const MODULE_NAME = 'ct-upload-manager';

// Sprite cache reference (imported from ct-expressions.js)
let spriteCache = {};

export const UPLOAD_ENDPOINTS = {
    SINGLE_SPRITE: '/api/sprites/upload',
    SPRITE_PACK: '/api/sprites/upload-zip',
    BACKGROUND: '/api/backgrounds/upload'
};

/**
 * Core file upload handler
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
            throw new Error(`Upload failed: ${result.status} ${result.statusText}`);
        }

        const data = await result.json();

        // Refresh cache
        const characterName = formData.get('name');
        if (characterName) {
            delete spriteCache[characterName];
            await getSpritesList(characterName);
        }

        return data ?? {};
    } catch (error) {
        console.error(`[${MODULE_NAME}] Upload error:`, error);
        throw error;
    }
}

/**
 * Upload a single sprite image
 */
export async function uploadSprite(characterName, expression, file, spriteName = null) {
    if (!characterName || !expression || !file) {
        throw new Error('Missing required parameters');
    }

    if (!isValidImageFile(file)) {
        throw new Error(`Invalid file type: ${file.type}`);
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
 */
export async function uploadSpritePackage(characterName, zipFile) {
    if (!characterName || !zipFile) {
        throw new Error('Missing required parameters');
    }

    if (!isValidArchiveFile(zipFile)) {
        throw new Error(`Invalid file type: ${zipFile.type}`);
    }

    const formData = new FormData();
    formData.append('name', characterName);
    formData.append('avatar', zipFile);

    return handleFileUpload(UPLOAD_ENDPOINTS.SPRITE_PACK, formData);
}

/**
 * Upload a background image
 */
export async function uploadBackground(file) {
    if (!file || !isValidImageFile(file)) {
        throw new Error('Invalid image file');
    }

    const formData = new FormData();
    formData.append('image', file);

    return handleFileUpload(UPLOAD_ENDPOINTS.BACKGROUND, formData);
}

function isValidImageFile(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    return validTypes.includes(file.type) && file.size > 0;
}

function isValidArchiveFile(file) {
    const validTypes = ['application/zip', 'application/x-zip-compressed'];
    return validTypes.includes(file.type) && file.size > 0;
}
```

### Phase 2: Implement Upload Button Handlers

**Add to `settings-panel.js` - Upload Handler Functions:**

```javascript
/**
 * Handle sprite upload from detail panel
 */
async function handleUploadSprite() {
    const charFolder = selectedCharacter;
    if (!charFolder) {
        notify.warning('No character selected');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Get expression name via input modal
        const expressionName = await showInputModal(
            'Expression Name',
            'Enter expression label (e.g., joy, anger)',
            'neutral'
        );
        if (!expressionName) return;

        try {
            const { uploadSprite } = await import('../core/upload-manager.js');
            notify.info('Uploading sprite...');
            await uploadSprite(charFolder, expressionName, file);
            await populateCharacterCarousel();
            notify.success(`Sprite added: "${expressionName}"`);
        } catch (error) {
            notify.error(`Upload failed: ${error.message}`);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * Handle sprite pack (ZIP) upload
 */
async function handleUploadSpritePack() {
    const charFolder = selectedCharacter;
    if (!charFolder) {
        notify.warning('No character selected');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.zip';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { uploadSpritePackage } = await import('../core/upload-manager.js');
            notify.info('Uploading sprite pack...');
            const result = await uploadSpritePackage(charFolder, file);
            await populateCharacterCarousel();
            notify.success(`Uploaded ${result.count || 0} sprite(s)`);
        } catch (error) {
            notify.error(`Upload failed: ${error.message}`);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * Handle background image upload
 */
async function handleUploadBackground() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { uploadBackground } = await import('../core/upload-manager.js');
            notify.info('Uploading background...');
            await uploadBackground(file);
            await populateBackgroundCarousel();
            notify.success('Background uploaded!');
        } catch (error) {
            notify.error(`Upload failed: ${error.message}`);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}
```

**Add Event Listeners in `bindEvents()`:**

```javascript
// Upload buttons - use event delegation for dynamically created elements
document.addEventListener('click', async (e) => {
    if (e.target.closest('#ct_upload_sprite')) {
        await handleUploadSprite();
    } else if (e.target.closest('#ct_upload_pack')) {
        await handleUploadSpritePack();
    }
});

document.getElementById('ct_upload_bg')?.addEventListener('click', handleUploadBackground);
```

### Phase 3: Update Sprite Manager Add Expression

**Replace in `sprite-manager.js`:**

```javascript
async function addExpression() {
    const char = characterList[currentCharacterIndex];
    if (!char) {
        toastr.error('No character selected');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const expressionName = await showInputModal(
            'New Expression',
            'Enter expression name',
            ''
        );
        if (!expressionName) return;

        try {
            const { uploadSprite } = await import('../core/upload-manager.js');
            toastr.info('Uploading...');
            await uploadSprite(char.folderName, expressionName, file);

            // Refresh sprites
            char.sprites = await getSpritesList(char.folderName);
            renderExpressionGrid(char);

            toastr.success(`Added: "${expressionName}"`);
        } catch (error) {
            toastr.error(`Failed: ${error.message}`);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}
```

---

## 4. Diagnostic Checks

Add to diagnostics tool:

| Check | Failure Point | Fix |
|-------|---------------|-----|
| File validation | Invalid file type/size | Show accepted types |
| Character context | No character selected | Prompt to select |
| Network request | API endpoint unreachable | Show connection error |
| Server response | Upload rejected | Show server error message |
| Cache refresh | Sprites not appearing | Force cache clear |

---

## 5. Implementation Checklist

- [ ] Create `core/upload-manager.js`
- [ ] Add upload handler functions to `settings-panel.js`
- [ ] Bind upload button events in `bindEvents()`
- [ ] Replace `addExpression()` in `sprite-manager.js`
- [ ] Test single sprite upload
- [ ] Test sprite pack upload
- [ ] Test background upload
- [ ] Verify cache invalidation
- [ ] Add diagnostic checks
