/**
 * ============================================================================
 * VN SCENE HANDLERS
 * ============================================================================
 * Handles scene change events dispatched by scene-parser.
 * Bridges Cotton-Tales scene system with SillyTavern's native systems.
 *
 * @version 1.0.0
 * ============================================================================
 */

import { eventSource, event_types } from '../../../../../script.js';

const MODULE_NAME = 'CT-SceneHandlers';

// =============================================================================
// BACKGROUND HANDLING
// =============================================================================

/**
 * Cache of available backgrounds for fuzzy matching
 * @type {Array<{name: string, file: string, element: HTMLElement}>}
 */
let backgroundCache = [];

/**
 * Refresh the background cache from ST's background menu
 */
function refreshBackgroundCache() {
    const bgElements = document.querySelectorAll('#bg_menu_content .bg_example');
    backgroundCache = [];

    bgElements.forEach(el => {
        const titleEl = el.querySelector('.BGSampleTitle');
        const file = el.getAttribute('bgfile');

        if (titleEl && file) {
            backgroundCache.push({
                name: titleEl.textContent?.trim().toLowerCase() || '',
                file: file,
                element: el,
            });
        }
    });

    console.debug(`[${MODULE_NAME}] Cached ${backgroundCache.length} backgrounds`);
}

/**
 * Find best matching background by name
 * Uses fuzzy matching: exact > starts with > contains > word match
 * @param {string} query - Background name from Director
 * @returns {{ name: string, file: string, element: HTMLElement } | null}
 */
function findBackground(query) {
    if (!query) return null;

    const q = query.toLowerCase().trim();

    // Refresh cache if empty or stale
    if (backgroundCache.length === 0) {
        refreshBackgroundCache();
    }

    // 1. Exact match (with or without extension)
    let match = backgroundCache.find(bg =>
        bg.name === q ||
        bg.file.toLowerCase() === q ||
        bg.file.toLowerCase().replace(/\.[^.]+$/, '') === q
    );
    if (match) return match;

    // 2. Starts with
    match = backgroundCache.find(bg =>
        bg.name.startsWith(q) ||
        bg.file.toLowerCase().startsWith(q)
    );
    if (match) return match;

    // 3. Contains
    match = backgroundCache.find(bg =>
        bg.name.includes(q) ||
        bg.file.toLowerCase().includes(q)
    );
    if (match) return match;

    // 4. Word match (e.g., "beach" matches "sunny_beach.jpg")
    const words = q.split(/[\s_-]+/);
    match = backgroundCache.find(bg => {
        const bgWords = bg.name.split(/[\s_-]+/);
        return words.some(w => bgWords.some(bw => bw.includes(w) || w.includes(bw)));
    });
    if (match) return match;

    // 5. Levenshtein distance for typo tolerance (simple version)
    let bestScore = Infinity;
    let bestMatch = null;
    for (const bg of backgroundCache) {
        const score = levenshteinDistance(q, bg.name);
        if (score < bestScore && score <= Math.max(3, q.length * 0.4)) {
            bestScore = score;
            bestMatch = bg;
        }
    }

    return bestMatch;
}

/**
 * Simple Levenshtein distance for typo tolerance
 */
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Handle background change request from scene-parser
 * @param {CustomEvent} event - Event with detail.background
 */
async function handleBackgroundChange(event) {
    const { background } = event.detail || {};

    if (!background) {
        console.warn(`[${MODULE_NAME}] No background specified in event`);
        return;
    }

    console.log(`[${MODULE_NAME}] Background change requested: "${background}"`);

    const match = findBackground(background);

    if (!match) {
        console.warn(`[${MODULE_NAME}] No matching background found for: "${background}"`);
        toastr.warning(`Background not found: "${background}"`);
        return;
    }

    console.log(`[${MODULE_NAME}] Matched to: "${match.file}"`);

    // Use ST's native background system via event
    // This triggers the same code path as clicking a background
    try {
        // Method 1: Click the background element (most reliable, triggers all ST handlers)
        const bgElement = match.element.querySelector('.bg_example') || match.element;
        if (bgElement) {
            bgElement.click();
            console.log(`[${MODULE_NAME}] Background set via click: "${match.file}"`);
            return;
        }
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Click method failed, trying event method`);
    }

    // Method 2: Emit ST's FORCE_SET_BACKGROUND event
    try {
        const bgUrl = `url("backgrounds/${encodeURIComponent(match.file)}")`;
        eventSource.emit(event_types.FORCE_SET_BACKGROUND, {
            url: bgUrl,
            path: match.file,
        });
        console.log(`[${MODULE_NAME}] Background set via event: "${match.file}"`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to set background:`, err);
        toastr.error(`Failed to set background: "${background}"`);
    }
}

// =============================================================================
// MUSIC HANDLING (placeholder for future)
// =============================================================================

/**
 * Handle music change request
 * @param {CustomEvent} event - Event with detail.track
 */
function handleMusicChange(event) {
    const { track } = event.detail || {};
    // TODO: Integrate with ambient sounds extension or custom audio system
    console.debug(`[${MODULE_NAME}] Music change requested: "${track}" (not implemented)`);
}

/**
 * Handle SFX play request
 * @param {CustomEvent} event - Event with detail.sfx
 */
function handleSfxPlay(event) {
    const { sfx } = event.detail || {};
    // TODO: Integrate with sound effects system
    console.debug(`[${MODULE_NAME}] SFX requested: "${sfx}" (not implemented)`);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize scene handlers
 * Call this from main index.js
 */
export function initSceneHandlers() {
    // Background changes
    document.addEventListener('ct:background:change', handleBackgroundChange);

    // Music changes (future)
    document.addEventListener('ct:music:change', handleMusicChange);

    // SFX plays (future)
    document.addEventListener('ct:sfx:play', handleSfxPlay);

    // Refresh background cache when ST's background list updates
    const observer = new MutationObserver(() => {
        backgroundCache = []; // Invalidate cache
    });

    const bgMenu = document.getElementById('bg_menu_content');
    if (bgMenu) {
        observer.observe(bgMenu, { childList: true, subtree: true });
    }

    console.log(`[${MODULE_NAME}] Scene handlers initialized`);
}

/**
 * Cleanup scene handlers
 */
export function destroySceneHandlers() {
    document.removeEventListener('ct:background:change', handleBackgroundChange);
    document.removeEventListener('ct:music:change', handleMusicChange);
    document.removeEventListener('ct:sfx:play', handleSfxPlay);
    backgroundCache = [];
}

// =============================================================================
// EXPORTS FOR DIRECT USE
// =============================================================================

export {
    findBackground,
    refreshBackgroundCache,
};
