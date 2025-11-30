/**
 * ============================================================================
 * COTTON-TALES CUSTOM EMOTION CLASSIFIER
 * ============================================================================
 * Per-character custom emotion classifiers built on VectHare infrastructure.
 *
 * Users define:
 * - Emotions (e.g., "flustered", "smug", "pouty")
 * - Vector phrases per emotion - example sentences for semantic matching
 * - Keyword boosts per emotion - literal words that boost scores
 *
 * @version 1.0.0
 * ============================================================================
 */

import { getSettings, saveSettings } from './settings-manager.js';
import { extension_settings } from '../../../../extensions.js';

const MODULE_NAME = 'CT-CustomClassifier';

// =============================================================================
// VECTHARE API ACCESS
// =============================================================================

/**
 * Get VectHare settings
 */
function getVectHareSettings() {
    return extension_settings?.vecthare || {};
}

/**
 * Check if VectHare is available
 */
export function isVectHareAvailable() {
    try {
        return typeof extension_settings?.vecthare !== 'undefined';
    } catch {
        return false;
    }
}

/**
 * Get VectHare core API functions
 * These are loaded dynamically to avoid hard dependency
 */
async function getVectHareAPI() {
    if (!isVectHareAvailable()) {
        throw new Error('VectHare is not installed');
    }

    try {
        const api = await import('../../VectHare/core/core-vector-api.js');
        return {
            insertVectorItems: api.insertVectorItems,
            queryCollection: api.queryCollection,
            deleteVectorItems: api.deleteVectorItems,
            purgeVectorIndex: api.purgeVectorIndex,
            getSavedHashes: api.getSavedHashes,
        };
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to load VectHare API:`, error);
        throw new Error('Failed to load VectHare API');
    }
}

/**
 * Get collection ID for a character's custom emotions
 */
function getCollectionId(charFolder) {
    return `ct-emotions-${charFolder.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

// =============================================================================
// EMOTION MANAGEMENT
// =============================================================================

/**
 * Get all custom emotions for a character
 * @param {string} charFolder - Character folder name
 * @returns {Object} Emotions config { emotionName: { vectors: [], keywords: {} } }
 */
export function getCharacterEmotions(charFolder) {
    const settings = getSettings();
    return settings.characterEmotions?.[charFolder]?.customEmotions || {};
}

/**
 * Save custom emotions for a character
 * @param {string} charFolder - Character folder name
 * @param {Object} emotions - Emotions config
 */
export async function saveCharacterEmotions(charFolder, emotions) {
    const settings = getSettings();

    if (!settings.characterEmotions) {
        settings.characterEmotions = {};
    }
    if (!settings.characterEmotions[charFolder]) {
        settings.characterEmotions[charFolder] = {};
    }

    settings.characterEmotions[charFolder].customEmotions = emotions;
    await saveSettings();
}

/**
 * Add or update an emotion for a character
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion name (e.g., "flustered")
 * @param {Object} config - { vectors: string[], keywords: { word: weight } }
 */
export async function setEmotion(charFolder, emotionName, config) {
    const emotions = getCharacterEmotions(charFolder);
    emotions[emotionName] = {
        vectors: config.vectors || [],
        keywords: config.keywords || {},
    };
    await saveCharacterEmotions(charFolder, emotions);

    // Sync vectors to VectHare collection
    await syncEmotionVectors(charFolder, emotionName);

    console.log(`[${MODULE_NAME}] Saved emotion "${emotionName}" for ${charFolder}`);
}

/**
 * Remove an emotion from a character
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion to remove
 */
export async function removeEmotion(charFolder, emotionName) {
    const emotions = getCharacterEmotions(charFolder);
    delete emotions[emotionName];
    await saveCharacterEmotions(charFolder, emotions);

    // Remove vectors from VectHare collection
    await removeEmotionVectors(charFolder, emotionName);

    console.log(`[${MODULE_NAME}] Removed emotion "${emotionName}" from ${charFolder}`);
}

// =============================================================================
// VECTOR MANAGEMENT
// =============================================================================

/**
 * Add a vector phrase to an emotion
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion name
 * @param {string} phrase - Vector phrase to add
 */
export async function addVector(charFolder, emotionName, phrase) {
    const emotions = getCharacterEmotions(charFolder);

    if (!emotions[emotionName]) {
        emotions[emotionName] = { vectors: [], keywords: {} };
    }

    if (!emotions[emotionName].vectors.includes(phrase)) {
        emotions[emotionName].vectors.push(phrase);
        await saveCharacterEmotions(charFolder, emotions);
        await syncEmotionVectors(charFolder, emotionName);
    }
}

/**
 * Remove a vector phrase from an emotion
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion name
 * @param {number} index - Index of phrase to remove
 */
export async function removeVector(charFolder, emotionName, index) {
    const emotions = getCharacterEmotions(charFolder);

    if (emotions[emotionName]?.vectors) {
        emotions[emotionName].vectors.splice(index, 1);
        await saveCharacterEmotions(charFolder, emotions);
        await syncEmotionVectors(charFolder, emotionName);
    }
}

/**
 * Sync emotion vectors to VectHare collection
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion to sync
 */
async function syncEmotionVectors(charFolder, emotionName) {
    if (!isVectHareAvailable()) {
        console.debug(`[${MODULE_NAME}] VectHare not available, skipping vector sync`);
        return;
    }

    try {
        const api = await getVectHareAPI();
        const vhSettings = getVectHareSettings();
        const collectionId = getCollectionId(charFolder);
        const emotions = getCharacterEmotions(charFolder);
        const emotion = emotions[emotionName];

        if (!emotion?.vectors?.length) {
            return;
        }

        // Build items for VectHare
        const items = emotion.vectors.map((phrase, idx) => ({
            text: phrase,
            hash: hashString(`${emotionName}-${idx}-${phrase}`),
            metadata: {
                emotion: emotionName,
                index: idx,
                type: 'ct-emotion-vector',
            }
        }));

        // First, remove existing vectors for this emotion
        await removeEmotionVectors(charFolder, emotionName);

        // Insert new vectors
        await api.insertVectorItems(collectionId, items, vhSettings);
        console.log(`[${MODULE_NAME}] Synced ${items.length} vectors for "${emotionName}"`);

    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to sync vectors:`, error);
    }
}

/**
 * Remove all vectors for an emotion from VectHare
 */
async function removeEmotionVectors(charFolder, emotionName) {
    if (!isVectHareAvailable()) return;

    try {
        const api = await getVectHareAPI();
        const vhSettings = getVectHareSettings();
        const collectionId = getCollectionId(charFolder);

        // Get all hashes in collection
        const existingHashes = await api.getSavedHashes(collectionId, vhSettings, true);

        // Filter to just this emotion's vectors
        const hashesToDelete = existingHashes
            .filter(item => item.metadata?.emotion === emotionName)
            .map(item => item.hash);

        if (hashesToDelete.length > 0) {
            await api.deleteVectorItems(collectionId, hashesToDelete, vhSettings);
            console.log(`[${MODULE_NAME}] Removed ${hashesToDelete.length} vectors for "${emotionName}"`);
        }

    } catch (error) {
        // Collection might not exist yet, that's fine
        console.debug(`[${MODULE_NAME}] Could not remove vectors:`, error.message);
    }
}

// =============================================================================
// KEYWORD MANAGEMENT
// =============================================================================

/**
 * Add or update a keyword boost for an emotion
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion name
 * @param {string} keyword - Keyword to add
 * @param {number} weight - Boost weight (1.0 - 3.0)
 */
export async function setKeyword(charFolder, emotionName, keyword, weight) {
    const emotions = getCharacterEmotions(charFolder);

    if (!emotions[emotionName]) {
        emotions[emotionName] = { vectors: [], keywords: {} };
    }

    emotions[emotionName].keywords[keyword.toLowerCase()] = Math.max(1.0, Math.min(3.0, weight));
    await saveCharacterEmotions(charFolder, emotions);
}

/**
 * Remove a keyword from an emotion
 * @param {string} charFolder - Character folder name
 * @param {string} emotionName - Emotion name
 * @param {string} keyword - Keyword to remove
 */
export async function removeKeyword(charFolder, emotionName, keyword) {
    const emotions = getCharacterEmotions(charFolder);

    if (emotions[emotionName]?.keywords) {
        delete emotions[emotionName].keywords[keyword.toLowerCase()];
        await saveCharacterEmotions(charFolder, emotions);
    }
}

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * Classify text using character's custom emotion classifier
 * @param {string} charFolder - Character folder name
 * @param {string} text - Text to classify
 * @returns {Promise<{emotion: string, score: number, boosted: boolean}|null>}
 */
export async function classifyWithCustomEmotions(charFolder, text) {
    const emotions = getCharacterEmotions(charFolder);
    const emotionNames = Object.keys(emotions);

    if (emotionNames.length === 0) {
        return null; // No custom emotions defined
    }

    // Check if any emotions have vectors
    const hasVectors = emotionNames.some(e => emotions[e].vectors?.length > 0);

    if (!hasVectors) {
        // No vectors, just use keyword matching
        return classifyByKeywordsOnly(emotions, text);
    }

    if (!isVectHareAvailable()) {
        console.debug(`[${MODULE_NAME}] VectHare not available, falling back to keywords`);
        return classifyByKeywordsOnly(emotions, text);
    }

    try {
        const api = await getVectHareAPI();
        const vhSettings = getVectHareSettings();
        const collectionId = getCollectionId(charFolder);

        // Query VectHare for similar vectors
        const results = await api.queryCollection(collectionId, text, 10, vhSettings);

        if (!results?.metadata?.length) {
            return classifyByKeywordsOnly(emotions, text);
        }

        // Aggregate scores by emotion
        const emotionScores = {};
        for (const meta of results.metadata) {
            const emotion = meta.emotion;
            const score = meta.score || 0;

            if (!emotionScores[emotion] || score > emotionScores[emotion]) {
                emotionScores[emotion] = score;
            }
        }

        // Apply keyword boosts
        const textLower = text.toLowerCase();
        let bestEmotion = null;
        let bestScore = -Infinity;
        let wasBoosted = false;

        for (const [emotionName, baseScore] of Object.entries(emotionScores)) {
            let finalScore = baseScore;
            const keywords = emotions[emotionName]?.keywords || {};

            // Apply keyword boosts (multiplicative)
            for (const [keyword, weight] of Object.entries(keywords)) {
                if (textLower.includes(keyword)) {
                    finalScore *= weight;
                    wasBoosted = true;
                }
            }

            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestEmotion = emotionName;
            }
        }

        if (bestEmotion) {
            console.log(`[${MODULE_NAME}] Custom classifier: "${bestEmotion}" (${bestScore.toFixed(3)})${wasBoosted ? ' [boosted]' : ''}`);
            return { emotion: bestEmotion, score: bestScore, boosted: wasBoosted };
        }

        return null;

    } catch (error) {
        console.error(`[${MODULE_NAME}] Classification failed:`, error);
        return classifyByKeywordsOnly(emotions, text);
    }
}

/**
 * Fallback: classify using only keyword matching
 */
function classifyByKeywordsOnly(emotions, text) {
    const textLower = text.toLowerCase();
    let bestEmotion = null;
    let bestScore = 0;

    for (const [emotionName, config] of Object.entries(emotions)) {
        let score = 0;
        const keywords = config.keywords || {};

        for (const [keyword, weight] of Object.entries(keywords)) {
            if (textLower.includes(keyword)) {
                score += weight;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestEmotion = emotionName;
        }
    }

    if (bestEmotion && bestScore > 0) {
        console.log(`[${MODULE_NAME}] Keyword-only match: "${bestEmotion}" (${bestScore.toFixed(2)})`);
        return { emotion: bestEmotion, score: bestScore, boosted: true };
    }

    return null;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Simple string hash function
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Purge all custom emotion vectors for a character
 */
export async function purgeCharacterEmotions(charFolder) {
    if (!isVectHareAvailable()) return;

    try {
        const api = await getVectHareAPI();
        const vhSettings = getVectHareSettings();
        const collectionId = getCollectionId(charFolder);

        await api.purgeVectorIndex(collectionId, vhSettings);
        console.log(`[${MODULE_NAME}] Purged emotion collection for ${charFolder}`);
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Could not purge collection:`, error.message);
    }
}

/**
 * Rebuild all vectors for a character from settings
 */
export async function rebuildCharacterVectors(charFolder) {
    const emotions = getCharacterEmotions(charFolder);

    // Purge existing
    await purgeCharacterEmotions(charFolder);

    // Rebuild each emotion
    for (const emotionName of Object.keys(emotions)) {
        await syncEmotionVectors(charFolder, emotionName);
    }

    console.log(`[${MODULE_NAME}] Rebuilt vectors for ${charFolder}`);
}
