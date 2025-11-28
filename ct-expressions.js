/**
 * ============================================================================
 * COTTON-TALES EXPRESSIONS ENGINE
 * ============================================================================
 * Adapted from SillyTavern's expressions extension.
 * Handles sprite display, VN mode for groups, and expression classification.
 *
 * All element IDs use ct- prefix to avoid conflicts with ST's native extension.
 *
 * @author Coneja Chibi (adapted from ST expressions by Cohee)
 * @version 0.1.0-alpha
 * ============================================================================
 */

// =============================================================================
// IMPORTS
// =============================================================================

// Note: Paths are relative to third-party/Cotton-Tales/
import { Fuse } from '../../../../lib.js';

import {
    characters,
    eventSource,
    event_types,
    generateQuietPrompt,
    generateRaw,
    getRequestHeaders,
    getThumbnailUrl,
    online_status,
    saveSettingsDebounced,
    substituteParams,
    substituteParamsExtended,
    system_message_types,
    this_chid,
} from '../../../../../script.js';

import { dragElement, isMobile } from '../../../RossAscends-mods.js';

import {
    getContext,
    getApiUrl,
    modules,
    extension_settings,
    ModuleWorkerWrapper,
    doExtrasFetch,
} from '../../../extensions.js';

import { loadMovingUIState, power_user } from '../../../power-user.js';
import { onlyUnique, debounce, getCharaFilename, trimToEndSentence, trimToStartSentence, waitUntilCondition } from '../../../utils.js';
import { hideMutedSprites, selected_group } from '../../../group-chats.js';
import { isJsonSchemaSupported } from '../../../textgen-settings.js';
import { debounce_timeout } from '../../../constants.js';
import { t } from '../../../i18n.js';
import { removeReasoningFromString } from '../../../reasoning.js';

// Cotton-Tales settings
import { getSettings } from './core/settings-manager.js';
import {
    EXTENSION_NAME,
    DEFAULT_EXPRESSIONS,
    EXPRESSION_API,
    PROMPT_TYPE,
    DEFAULT_LLM_PROMPT,
} from './core/constants.js';

// Shared extension utilities
import { isWebLlmSupported, generateWebLlmChatPrompt } from '../../../shared.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODULE_NAME = 'ct-expressions';
const UPDATE_INTERVAL = 2000;
const STREAMING_UPDATE_INTERVAL = 10000;

// =============================================================================
// STATE
// =============================================================================

let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
/** @type {{[characterKey: string]: Object[]}} */
let spriteCache = {};
let inApiCall = false;
let lastServerResponseTime = 0;

/** @type {{[characterName: string]: string}} */
export let lastExpression = {};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Default fallback expression */
const DEFAULT_FALLBACK_EXPRESSION = 'neutral';

/**
 * Check if Visual Novel mode is active (group chat + waifu mode)
 */
function isVisualNovelMode() {
    return Boolean(!isMobile() && power_user.waifuMode && getContext().groupId);
}

/**
 * Get sprite folder name for a character
 */
function getSpriteFolderName(characterMessage = null, characterName = null) {
    const context = getContext();
    let spriteFolderName = characterName ?? context.name2;
    const message = characterMessage ?? getLastCharacterMessage();
    const avatarFileName = getFolderNameByMessage(message);

    // Check for expression overrides
    const expressionOverrides = extension_settings.expressionOverrides || [];
    const expressionOverride = expressionOverrides.find(e => e.name == avatarFileName);

    if (expressionOverride && expressionOverride.path) {
        spriteFolderName = expressionOverride.path;
    }

    return spriteFolderName;
}

/**
 * Get folder name from message
 */
function getFolderNameByMessage(message) {
    const context = getContext();
    let avatarPath = '';

    if (context.groupId) {
        avatarPath = message.original_avatar || context.characters.find(x => message.force_avatar && message.force_avatar.includes(encodeURIComponent(x.avatar)))?.avatar;
    } else if (context.characterId !== undefined) {
        avatarPath = getCharaFilename();
    }

    if (!avatarPath) {
        return '';
    }

    const folderName = avatarPath.replace(/\.[^/.]+$/, '');
    return folderName;
}

/**
 * Get the last character message from chat
 */
function getLastCharacterMessage() {
    const context = getContext();
    const reversedChat = context.chat.slice().reverse();

    for (let mes of reversedChat) {
        if (mes.is_user || mes.is_system || mes.extra?.type === system_message_types.NARRATOR) {
            continue;
        }
        return { mes: mes.mes, name: mes.name, original_avatar: mes.original_avatar, force_avatar: mes.force_avatar };
    }

    return { mes: '', name: null, original_avatar: null, force_avatar: null };
}

// =============================================================================
// SPRITE LOADING
// =============================================================================

/**
 * Fetch sprites list from server for a character
 * @param {string} name - Character/folder name
 * @returns {Promise<Object[]>} Array of sprite objects
 */
async function getSpritesList(name) {
    console.debug(`[${MODULE_NAME}] Getting sprites for: ${name}`);

    try {
        const result = await fetch(`/api/sprites/get?name=${encodeURIComponent(name)}`);
        let sprites = result.ok ? (await result.json()) : [];

        // Group sprites by expression label
        const grouped = sprites.reduce((acc, sprite) => {
            const fileName = sprite.path.split('/').pop().split('?')[0];
            const imageData = {
                expression: sprite.label,
                fileName: fileName,
                title: fileName.replace(/\.[^/.]+$/, ''),
                imageSrc: sprite.path,
                type: 'success',
            };

            let existingExpression = acc.find(exp => exp.label === sprite.label);
            if (existingExpression) {
                existingExpression.files.push(imageData);
            } else {
                acc.push({ label: sprite.label, files: [imageData] });
            }
            return acc;
        }, []);

        return grouped;
    } catch (err) {
        console.error(`[${MODULE_NAME}] Error fetching sprites:`, err);
        return [];
    }
}

/**
 * Validate and cache sprites for a character
 * @param {string} spriteFolderName - Character folder name
 * @param {boolean} forceRedraw - Force refresh cache
 */
async function validateImages(spriteFolderName, forceRedraw = false) {
    if (!spriteFolderName) return;

    if (spriteCache[spriteFolderName] && !forceRedraw) {
        return;
    }

    const sprites = await getSpritesList(spriteFolderName);
    spriteCache[spriteFolderName] = sprites;
    console.debug(`[${MODULE_NAME}] Cached ${sprites.length} expressions for ${spriteFolderName}`);
}

/**
 * Get list of available expressions
 */
async function getExpressionsList() {
    if (Array.isArray(expressionsList)) {
        return expressionsList;
    }

    // Try to get from local classifier
    try {
        const apiResult = await fetch('/api/extra/classify/labels', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (apiResult.ok) {
            const data = await apiResult.json();
            expressionsList = data.labels;
            return expressionsList;
        }
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Local classifier not available`);
    }

    // Fall back to defaults
    expressionsList = DEFAULT_EXPRESSIONS.slice();
    return expressionsList;
}

// =============================================================================
// SPRITE DISPLAY - SINGLE CHARACTER
// =============================================================================

/**
 * Choose a sprite file for an expression
 */
function chooseSpriteForExpression(spriteFolderName, expression, { prevExpressionSrc = null } = {}) {
    if (!spriteCache[spriteFolderName]) return null;

    const ctSettings = getSettings();
    const fallbackExpression = ctSettings.fallbackExpression || DEFAULT_FALLBACK_EXPRESSION;

    // Find sprites for this expression
    let sprite = spriteCache[spriteFolderName].find(x => x.label === expression);

    // Try fallback if no match
    if (!(sprite?.files?.length > 0) && fallbackExpression) {
        sprite = spriteCache[spriteFolderName].find(x => x.label === fallbackExpression);
        console.debug(`[${MODULE_NAME}] Using fallback expression: ${fallbackExpression}`);
    }

    if (!(sprite?.files?.length > 0)) return null;

    let spriteFile = sprite.files[0];

    // Random selection if multiple sprites allowed
    if (settings.allowMultiple && sprite.files.length > 1) {
        let possibleFiles = sprite.files;
        if (settings.rerollIfSame && prevExpressionSrc) {
            possibleFiles = possibleFiles.filter(x => x.imageSrc !== prevExpressionSrc);
        }
        spriteFile = possibleFiles[Math.floor(Math.random() * possibleFiles.length)];
    }

    return spriteFile;
}

/**
 * Animated crossfade between sprites
 * @param {JQuery} img - Image element
 * @param {string} path - New image path
 */
async function setImage(img, path) {
    return new Promise(resolve => {
        const prevExpressionSrc = img.attr('src');

        if (prevExpressionSrc === path || img.hasClass('ct-expression-animating')) {
            resolve();
            return;
        }

        const expressionClone = img.clone();
        expressionClone.addClass('ct-expression-clone');
        expressionClone.css({ opacity: 0 });
        expressionClone.attr('src', path);
        expressionClone.appendTo(img.parent());

        const duration = 200;

        img.addClass('ct-expression-animating');
        expressionClone.addClass('ct-expression-animating');

        // Set min dimensions during transition
        const imgWidth = img.width();
        const imgHeight = img.height();
        const expressionHolder = img.parent();
        expressionHolder.css('min-width', imgWidth > 100 ? imgWidth : 100);
        expressionHolder.css('min-height', imgHeight > 100 ? imgHeight : 100);

        img.css('position', 'absolute').width(imgWidth).height(imgHeight);

        // Fade in clone
        expressionClone.animate({ opacity: 1 }, duration).promise().done(function() {
            // Fade out original
            img.animate({ opacity: 0 }, duration);
            img.remove();

            // Clone becomes new original
            expressionClone.removeClass('ct-expression-animating ct-expression-clone');
            expressionHolder.css('min-width', 100);
            expressionHolder.css('min-height', 100);

            if (expressionClone.prop('complete')) {
                resolve();
            } else {
                expressionClone.one('load', () => resolve());
            }
        });

        expressionClone.on('error', function() {
            console.debug(`[${MODULE_NAME}] Expression image error:`, path);
            $(this).attr('src', '');
            $(this).off('error');
            resolve();
        });
    });
}

/**
 * Set expression for single character mode
 */
async function setExpression(spriteFolderName, expression, { force = false } = {}) {
    await validateImages(spriteFolderName);

    const img = $('img.ct-expression');
    const prevExpressionSrc = img.attr('src');

    const spriteFile = chooseSpriteForExpression(spriteFolderName, expression, { prevExpressionSrc });

    if (spriteFile) {
        if (force && isVisualNovelMode()) {
            // Handle group member in VN mode
            const context = getContext();
            const group = context.groups.find(x => x.id === context.groupId);
            const memberName = spriteFolderName.split('/')[0] ?? spriteFolderName;
            const groupMember = group?.members
                .map(member => context.characters.find(x => x.avatar === member))
                .find(m => m && m.name === memberName);

            if (groupMember) {
                await setImage($(`.ct-expression-holder[data-avatar="${groupMember.avatar}"] img`), spriteFile.imageSrc);
                return;
            }
        }

        // Single character mode - animate if changed
        if (prevExpressionSrc !== spriteFile.imageSrc && !img.hasClass('ct-expression-animating')) {
            const expressionClone = img.clone();
            expressionClone.addClass('ct-expression-clone');
            expressionClone.attr('id', '').css({ opacity: 0 });
            expressionClone.attr('src', spriteFile.imageSrc);
            expressionClone.attr('data-expression', expression);
            expressionClone.attr('title', expression);
            expressionClone.appendTo($('#ct-expression-holder'));

            const duration = 200;
            img.addClass('ct-expression-animating');

            const imgWidth = img.width();
            const imgHeight = img.height();
            const expressionHolder = img.parent();
            expressionHolder.css('min-width', imgWidth > 100 ? imgWidth : 100);
            expressionHolder.css('min-height', imgHeight > 100 ? imgHeight : 100);

            img.css('position', 'absolute').width(imgWidth).height(imgHeight);
            expressionClone.addClass('ct-expression-animating');

            expressionClone.animate({ opacity: 1 }, duration).promise().done(function() {
                img.animate({ opacity: 0 }, duration);
                img.remove();
                expressionClone.attr('id', 'ct-expression-image');
                expressionClone.removeClass('ct-expression-animating ct-expression-clone');
                expressionHolder.css('min-width', 100);
                expressionHolder.css('min-height', 100);
            });
        }

        console.info(`[${MODULE_NAME}] Expression set:`, { expression: spriteFile.expression, file: spriteFile.fileName });
    } else {
        // No sprite found - fall back to character avatar
        const context = getContext();
        let avatarUrl = '';

        if (context.groupId) {
            // Group chat - find the character
            const character = context.characters.find(c => c.name === spriteFolderName || c.avatar?.replace(/\.[^/.]+$/, '') === spriteFolderName);
            if (character?.avatar) {
                avatarUrl = getThumbnailUrl('avatar', character.avatar);
            }
        } else if (this_chid !== undefined && characters[this_chid]) {
            // Single chat - use current character
            avatarUrl = getThumbnailUrl('avatar', characters[this_chid].avatar);
        }

        if (avatarUrl && img.attr('src') !== avatarUrl) {
            img.attr('src', avatarUrl);
            img.attr('data-expression', 'avatar-fallback');
            console.debug(`[${MODULE_NAME}] Using character avatar as fallback`);
        } else if (!avatarUrl) {
            img.attr('src', '');
            img.attr('data-expression', expression);
            console.debug(`[${MODULE_NAME}] No sprite or avatar found for:`, spriteFolderName);
        }
    }

    document.getElementById('ct-expression-holder').style.display = '';
}

// =============================================================================
// VISUAL NOVEL MODE - GROUP CHATS
// =============================================================================

const updateVisualNovelModeDebounced = debounce(forceUpdateVisualNovelMode, debounce_timeout.quick);

async function forceUpdateVisualNovelMode() {
    if (isVisualNovelMode()) {
        await updateVisualNovelMode();
    }
}

/**
 * Update VN mode display for all group members
 */
async function updateVisualNovelMode(spriteFolderName, expression) {
    const vnContainer = $('#ct-visual-novel-wrapper');

    await visualNovelRemoveInactive(vnContainer);
    const setSpritePromises = await visualNovelSetCharacterSprites(vnContainer, spriteFolderName, expression);
    await visualNovelUpdateLayers(vnContainer);

    await Promise.allSettled(setSpritePromises);

    if (setSpritePromises.length > 0) {
        await visualNovelUpdateLayers(vnContainer);
    }
}

/**
 * Remove inactive characters from VN display
 */
async function visualNovelRemoveInactive(container) {
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);
    const removePromises = [];

    container.find('.ct-expression-holder').each((_, current) => {
        const promise = new Promise(resolve => {
            const element = $(current);
            const avatar = element.data('avatar');

            if (!group.members.includes(avatar) || group.disabled_members.includes(avatar)) {
                element.fadeOut(250, () => {
                    element.remove();
                    resolve();
                });
            } else {
                resolve();
            }
        });
        removePromises.push(promise);
    });

    await Promise.allSettled(removePromises);
}

/**
 * Set sprites for all group members
 */
async function visualNovelSetCharacterSprites(vnContainer, spriteFolderName, expression) {
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);
    const setSpritePromises = [];

    for (const avatar of group.members) {
        if (group.disabled_members.includes(avatar) && hideMutedSprites) {
            continue;
        }

        const character = context.characters.find(x => x.avatar == avatar);
        if (!character) continue;

        const memberSpriteFolderName = getSpriteFolderName({ original_avatar: character.avatar }, character.name);

        // Load sprites if not cached
        if (spriteCache[memberSpriteFolderName] === undefined) {
            spriteCache[memberSpriteFolderName] = await getSpritesList(memberSpriteFolderName);
        }

        const expressionImage = vnContainer.find(`.ct-expression-holder[data-avatar="${avatar}"]`);
        const prevExpressionSrc = expressionImage.find('img').attr('src') || null;

        // Get expression for this character
        let charExpression = expression;
        if (!charExpression && Array.isArray(spriteCache[memberSpriteFolderName]) && spriteCache[memberSpriteFolderName].length > 0) {
            charExpression = await getLastMessageSprite(avatar);
        }

        const spriteFile = chooseSpriteForExpression(memberSpriteFolderName, charExpression, { prevExpressionSrc });

        // Get image path - sprite if available, otherwise character avatar
        let imagePath = spriteFile?.imageSrc || '';
        if (!imagePath && character.avatar) {
            imagePath = getThumbnailUrl('avatar', character.avatar);
        }

        if (expressionImage.length) {
            if (!spriteFolderName || spriteFolderName == memberSpriteFolderName) {
                await validateImages(memberSpriteFolderName, true);
                const img = expressionImage.find('img');
                await setImage(img, imagePath);
            }
            // Always show if we have any image (sprite or avatar)
            expressionImage.toggleClass('hidden', !imagePath);
        } else {
            // Create new expression holder for this character
            const template = $('#ct-expression-holder').clone();
            template.attr('id', `ct-expression-${avatar}`);
            template.attr('data-avatar', avatar);
            template.find('.drag-grabber').attr('id', `ct-expression-${avatar}header`);
            $('#ct-visual-novel-wrapper').append(template);
            dragElement($(template[0]));
            // Always show if we have any image (sprite or avatar)
            template.toggleClass('hidden', !imagePath);

            const img = template.find('img');
            await setImage(img, imagePath);

            const fadeInPromise = new Promise(resolve => {
                template.fadeIn(250, () => resolve());
            });
            setSpritePromises.push(fadeInPromise);
        }
    }

    return setSpritePromises;
}

/**
 * Get expression from character's last message
 */
async function getLastMessageSprite(avatar) {
    const context = getContext();
    const lastMessage = context.chat.slice().reverse().find(x =>
        x.original_avatar == avatar ||
        (x.force_avatar && x.force_avatar.includes(encodeURIComponent(avatar)))
    );

    if (lastMessage) {
        return await getExpressionLabel(lastMessage.mes || '');
    }
    return null;
}

/**
 * Update z-index and positioning for VN sprites
 */
async function visualNovelUpdateLayers(container) {
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);
    const recentMessages = context.chat.map(x => x.original_avatar).filter(x => x).reverse().filter(onlyUnique);
    const filteredMembers = group.members.filter(x => !group.disabled_members.includes(x));

    const layerIndices = filteredMembers.slice().sort((a, b) => {
        const aRecentIndex = recentMessages.indexOf(a);
        const bRecentIndex = recentMessages.indexOf(b);
        const aFilteredIndex = filteredMembers.indexOf(a);
        const bFilteredIndex = filteredMembers.indexOf(b);

        if (aRecentIndex !== -1 && bRecentIndex !== -1) {
            return bRecentIndex - aRecentIndex;
        } else if (aRecentIndex !== -1) {
            return 1;
        } else if (bRecentIndex !== -1) {
            return -1;
        } else {
            return aFilteredIndex - bFilteredIndex;
        }
    });

    const sortFunction = (a, b) => {
        const avatarA = $(a).data('avatar');
        const avatarB = $(b).data('avatar');
        return filteredMembers.indexOf(avatarA) - filteredMembers.indexOf(avatarB);
    };

    const containerWidth = container.width();
    const pivotalPoint = containerWidth * 0.5;

    let images = Array.from($('#ct-visual-novel-wrapper .ct-expression-holder')).sort(sortFunction);
    let imagesWidth = images.map(image => $(image).width());

    let totalWidth = imagesWidth.reduce((a, b) => a + b, 0);
    let currentPosition = pivotalPoint - (totalWidth / 2);

    if (totalWidth > containerWidth) {
        let totalOverlap = totalWidth - containerWidth;
        let totalWidthWithoutWidest = imagesWidth.reduce((a, b) => a + b, 0) - Math.max(...imagesWidth);
        let overlaps = imagesWidth.map(width => (width / totalWidthWithoutWidest) * totalOverlap);
        imagesWidth = imagesWidth.map((width, index) => width - overlaps[index]);
        currentPosition = 0;
    }

    const setLayerPromises = images.map((current, index) => {
        return new Promise(resolve => {
            const element = $(current);
            const avatar = element.data('avatar');
            const layerIndex = layerIndices.indexOf(avatar);

            element.css('z-index', layerIndex);
            element.show();

            if (power_user.reduced_motion) {
                element.css('left', currentPosition + 'px');
                requestAnimationFrame(() => resolve());
            } else {
                element.animate({ left: currentPosition + 'px' }, 500, () => resolve());
            }

            currentPosition += imagesWidth[index];
        });
    });

    await Promise.allSettled(setLayerPromises);
}

// =============================================================================
// EXPRESSION CLASSIFICATION
// =============================================================================

/**
 * Process text for classification - reduces text length for API calls
 * @param {string} text - The text to process
 * @param {number} api - The API being used
 * @returns {string} Processed text
 */
function sampleClassifyText(text, api) {
    if (!text) return text;

    // Replace macros, remove asterisks and quotes
    let result = substituteParams(text).replace(/[*"]/g, '');

    // LLM APIs can handle more text
    if (api === EXPRESSION_API.llm) {
        return result.trim();
    }

    const SAMPLE_THRESHOLD = 500;
    const HALF_SAMPLE_THRESHOLD = SAMPLE_THRESHOLD / 2;

    if (text.length < SAMPLE_THRESHOLD) {
        result = trimToEndSentence(result);
    } else {
        result = trimToEndSentence(result.slice(0, HALF_SAMPLE_THRESHOLD)) + ' ' + trimToStartSentence(result.slice(-HALF_SAMPLE_THRESHOLD));
    }

    return result.trim();
}

/**
 * Get the list of available expressions
 * @param {Object} options - Options
 * @param {boolean} options.filterAvailable - Whether to filter to only available sprites
 * @returns {Promise<string[]>} List of expression labels
 */
async function getExpressionsList({ filterAvailable = false } = {}) {
    // TODO: If filterAvailable, check sprite cache for current character
    // For now, return default list
    return [...DEFAULT_EXPRESSIONS];
}

/**
 * Get the LLM prompt for classification
 * @param {string[]} labels - Available expression labels
 * @returns {Promise<string>} The prompt to use
 */
async function getLlmPrompt(labels) {
    const settings = getSettings();
    const labelsString = labels.map(x => `"${x}"`).join(', ');
    const prompt = substituteParamsExtended(
        String(settings.expressionLlmPrompt || DEFAULT_LLM_PROMPT),
        { labels: labelsString }
    );
    return prompt;
}

/**
 * Parse LLM response to extract expression label
 * @param {string} emotionResponse - Raw response from LLM
 * @param {string[]} labels - Valid expression labels
 * @returns {string} Parsed expression label
 */
function parseLlmResponse(emotionResponse, labels) {
    try {
        // Try JSON parse first (for structured output)
        const parsedEmotion = JSON.parse(emotionResponse);
        const response = parsedEmotion?.emotion?.trim()?.toLowerCase();

        if (response && labels.includes(response)) {
            return response;
        }
        throw new Error('Emotion not in labels');
    } catch {
        // Clean reasoning from response
        emotionResponse = removeReasoningFromString(emotionResponse);

        // Fuzzy search in labels
        const fuse = new Fuse(labels, { includeScore: true });
        console.debug(`[${MODULE_NAME}] Fuzzy searching in labels:`, labels);
        const result = fuse.search(emotionResponse);

        if (result.length > 0) {
            console.debug(`[${MODULE_NAME}] Fuzzy found: ${result[0].item} for response:`, emotionResponse);
            return result[0].item;
        }

        // Direct string match
        const lowerCaseResponse = String(emotionResponse || '').toLowerCase();
        for (const label of labels) {
            if (lowerCaseResponse.includes(label.toLowerCase())) {
                console.debug(`[${MODULE_NAME}] Found label ${label} in response:`, emotionResponse);
                return label;
            }
        }
    }

    throw new Error('Could not parse emotion response: ' + emotionResponse);
}

/**
 * Check if VectHare is available and enabled
 * @returns {boolean} Whether VectHare is available
 */
function isVectHareAvailable() {
    try {
        return !!(window.extension_settings?.vecthare?.enabled_chats);
    } catch {
        return false;
    }
}

/**
 * Classify text using VectHare's semantic capabilities (bonus feature)
 * Uses embeddings to find semantically similar expressions
 * @param {string} text - Text to classify
 * @param {string[]} labels - Available labels
 * @returns {Promise<string|null>} Expression label or null if unavailable
 */
async function classifyWithVectHare(text, labels) {
    // Check if VectHare is available
    if (!isVectHareAvailable()) {
        console.debug(`[${MODULE_NAME}] VectHare not available`);
        return null;
    }

    try {
        // VectHare exposes embedding generation through the ST plugin API
        // We can use semantic similarity to match text to emotions
        const response = await fetch('/api/plugins/similharity/vectors', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: text,
                source: 'transformers', // Use local embeddings
            }),
        });

        if (!response.ok) {
            return null;
        }

        // Get text embedding
        const textVector = await response.json();

        // Pre-computed emotion label embeddings (cached)
        // For now, fall back to LLM - full VectHare integration would use semantic search
        console.debug(`[${MODULE_NAME}] VectHare embedding generated, semantic matching TODO`);

        // Placeholder: Use VectHare's semantic search to find closest emotion
        // This would require pre-indexing emotion descriptions
        return null;
    } catch (error) {
        console.debug(`[${MODULE_NAME}] VectHare classification failed:`, error);
        return null;
    }
}

/**
 * Main expression classification function
 * Supports multiple APIs: local, extras, llm, webllm, vecthare, none
 *
 * @param {string} text - The text to classify
 * @param {number} [apiOverride] - Optional API override
 * @returns {Promise<string|null>} The expression label or null
 */
async function getExpressionLabel(text, apiOverride = null) {
    const settings = getSettings();
    const api = apiOverride ?? settings.expressionApi ?? EXPRESSION_API.local;
    const fallback = settings.fallbackExpression || 'neutral';

    // Return fallback if no text or API is none
    if (!text) {
        return fallback;
    }

    // Check if extras module is available (for extras API)
    if (api === EXPRESSION_API.extras && !modules.includes('classify')) {
        console.debug(`[${MODULE_NAME}] Extras classify module not available`);
        return fallback;
    }

    // Translate if enabled
    if (settings.translateBeforeClassify && typeof globalThis.translate === 'function') {
        text = await globalThis.translate(text, 'en');
    }

    // Sample/trim text for classification
    text = sampleClassifyText(text, api);

    try {
        switch (api) {
            // =================================================================
            // LOCAL - Built-in BERT classifier (transformers.js)
            // =================================================================
            case EXPRESSION_API.local: {
                const localResult = await fetch('/api/extra/classify', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ text: text }),
                });

                if (localResult.ok) {
                    const data = await localResult.json();
                    return data.classification[0].label;
                }
                break;
            }

            // =================================================================
            // LLM - Use current chat API for classification
            // =================================================================
            case EXPRESSION_API.llm: {
                try {
                    await waitUntilCondition(() => online_status !== 'no_connection', 3000, 250);
                } catch (error) {
                    console.warn(`[${MODULE_NAME}] No LLM connection, using fallback`);
                    return fallback;
                }

                const expressionsList = await getExpressionsList({
                    filterAvailable: settings.filterAvailableExpressions
                });
                const prompt = await getLlmPrompt(expressionsList);

                let emotionResponse;
                try {
                    inApiCall = true;
                    switch (settings.expressionPromptType) {
                        case PROMPT_TYPE.raw:
                            emotionResponse = await generateRaw({ prompt: text, systemPrompt: prompt });
                            break;
                        case PROMPT_TYPE.full:
                        default:
                            emotionResponse = await generateQuietPrompt({ quietPrompt: prompt });
                            break;
                    }
                } finally {
                    inApiCall = false;
                }

                return parseLlmResponse(emotionResponse, expressionsList);
            }

            // =================================================================
            // WEBLLM - Browser-based LLM classification
            // =================================================================
            case EXPRESSION_API.webllm: {
                if (!isWebLlmSupported()) {
                    console.warn(`[${MODULE_NAME}] WebLLM not supported, using fallback`);
                    return fallback;
                }

                const expressionsList = await getExpressionsList({
                    filterAvailable: settings.filterAvailableExpressions
                });
                const prompt = await getLlmPrompt(expressionsList);
                const messages = [
                    { role: 'user', content: text + '\n\n' + prompt },
                ];

                const emotionResponse = await generateWebLlmChatPrompt(messages);
                return parseLlmResponse(emotionResponse, expressionsList);
            }

            // =================================================================
            // EXTRAS - SillyTavern Extras server
            // =================================================================
            case EXPRESSION_API.extras: {
                const url = new URL(getApiUrl());
                url.pathname = '/api/classify';

                const extrasResult = await doExtrasFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Bypass-Tunnel-Reminder': 'bypass',
                    },
                    body: JSON.stringify({ text: text }),
                });

                if (extrasResult.ok) {
                    const data = await extrasResult.json();
                    return data.classification[0].label;
                }
                break;
            }

            // =================================================================
            // VECTHARE - Semantic classification (bonus feature)
            // =================================================================
            case EXPRESSION_API.vecthare: {
                const expressionsList = await getExpressionsList();
                const result = await classifyWithVectHare(text, expressionsList);
                if (result) {
                    return result;
                }
                // Fall through to local if VectHare fails
                console.debug(`[${MODULE_NAME}] VectHare unavailable, falling back to local`);
                return getExpressionLabel(text, EXPRESSION_API.local);
            }

            // =================================================================
            // NONE - No classification, use fallback
            // =================================================================
            case EXPRESSION_API.none: {
                return '';
            }

            default: {
                console.error(`[${MODULE_NAME}] Invalid API selected: ${api}`);
                return '';
            }
        }
    } catch (error) {
        console.error(`[${MODULE_NAME}] Classification error:`, error);
        toastr.error('Could not classify expression. Check console for details.');
        return fallback;
    }

    return fallback;
}

// =============================================================================
// MAIN WORKER
// =============================================================================

/**
 * Main expression update worker
 */
async function moduleWorker() {
    const context = getContext();
    const ctSettings = getSettings();

    // Skip if not enabled - hide everything
    if (!ctSettings.enabled) {
        $('#ct-expression-wrapper').hide();
        $('#ct-visual-novel-wrapper').hide();
        return;
    }

    // No character loaded
    if (!context.groupId && context.characterId === undefined) {
        removeExpression();
        $('#ct-expression-wrapper').hide();
        $('#ct-visual-novel-wrapper').hide();
        return;
    }

    const vnMode = isVisualNovelMode();
    const vnWrapperVisible = $('#ct-visual-novel-wrapper').is(':visible');

    // Toggle between single and VN mode
    if (vnMode) {
        $('#ct-expression-wrapper').hide();
        $('#ct-visual-novel-wrapper').show();
    } else {
        $('#ct-expression-wrapper').show();
        $('#ct-visual-novel-wrapper').hide();
    }

    // Reset on mode change
    if (vnMode !== vnWrapperVisible) {
        lastMessage = null;
        $('#ct-visual-novel-wrapper').empty();
        $('#ct-expression-holder').css({ top: '', left: '', right: '', bottom: '', height: '', width: '', margin: '' });
    }

    const currentLastMessage = getLastCharacterMessage();
    let spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage.name);

    // Load sprites if not cached
    if (Object.keys(spriteCache).length === 0) {
        await validateImages(spriteFolderName);
        lastCharacter = context.groupId || context.characterId;
    }

    // Check for message change
    const lastMessageChanged = !((lastCharacter === context.characterId || lastCharacter === context.groupId) && lastMessage === currentLastMessage.mes);

    if (!lastMessageChanged) return;

    // Throttle during streaming
    if (!context.groupId && context.streamingProcessor && !context.streamingProcessor.isFinished) {
        const now = Date.now();
        if (now - lastServerResponseTime < STREAMING_UPDATE_INTERVAL) {
            return;
        }
    }

    // API busy check
    if (inApiCall) {
        console.debug(`[${MODULE_NAME}] Classification busy`);
        return;
    }

    try {
        inApiCall = true;
        let expression = await getExpressionLabel(currentLastMessage.mes);

        if (spriteFolderName === currentLastMessage.name && !context.groupId) {
            spriteFolderName = context.name2;
        }

        const force = !!context.groupId;

        await sendExpressionCall(spriteFolderName, expression, { force, vnMode });
    } catch (error) {
        console.error(`[${MODULE_NAME}] Worker error:`, error);
    } finally {
        inApiCall = false;
        lastCharacter = context.groupId || context.characterId;
        lastMessage = currentLastMessage.mes;
        lastServerResponseTime = Date.now();
    }
}

/**
 * Public API to set expression
 */
async function sendExpressionCall(spriteFolderName, expression, { force = false, vnMode = null } = {}) {
    lastExpression[spriteFolderName.split('/')[0]] = expression;

    if (vnMode === null) {
        vnMode = isVisualNovelMode();
    }

    if (vnMode) {
        await updateVisualNovelMode(spriteFolderName, expression);
    } else {
        await setExpression(spriteFolderName, expression, { force });
    }
}

/**
 * Clear expression display
 */
function removeExpression() {
    lastMessage = null;
    $('img.ct-expression').off('error');
    $('img.ct-expression').prop('src', '');
    $('img.ct-expression').removeClass('default');
}

/**
 * Immediately show or hide expressions (called on toggle)
 * @param {boolean} enabled - Whether expressions should be visible
 */
export function setExpressionsVisible(enabled) {
    if (enabled) {
        const vnMode = isVisualNovelMode();
        if (vnMode) {
            $('#ct-expression-wrapper').hide();
            $('#ct-visual-novel-wrapper').show();
        } else {
            $('#ct-expression-wrapper').show();
            $('#ct-visual-novel-wrapper').hide();
        }
        // Trigger an immediate update
        moduleWorker();
    } else {
        $('#ct-expression-wrapper').hide();
        $('#ct-visual-novel-wrapper').hide();
        removeExpression();
    }
}

// =============================================================================
// DOM CREATION
// =============================================================================

/**
 * Create the expression display containers
 */
function createExpressionContainers() {
    // Single character expression holder
    const expressionHtml = `
        <div id="ct-expression-wrapper">
            <div id="ct-expression-holder" class="ct-expression-holder" style="display:none;">
                <div id="ct-expression-holderheader" class="fa-solid fa-grip drag-grabber"></div>
                <img id="ct-expression-image" class="ct-expression">
            </div>
        </div>`;
    $('body').append(expressionHtml);

    // Visual novel mode wrapper
    const vnHtml = `<div id="ct-visual-novel-wrapper"></div>`;
    const vnElement = $(vnHtml);
    vnElement.hide();
    $('body').append(vnElement);

    // Make expression holder draggable
    dragElement($('#ct-expression-holder'));
    loadMovingUIState();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the expressions system
 */
export async function initExpressions() {
    console.log(`[${MODULE_NAME}] Initializing...`);

    // Create DOM elements
    createExpressionContainers();

    // Start worker loop
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    const updateFunction = wrapper.update.bind(wrapper);
    setInterval(updateFunction, UPDATE_INTERVAL);

    // Register event handlers
    eventSource.on(event_types.CHAT_CHANGED, () => {
        removeExpression();
        spriteCache = {};
        lastExpression = {};

        let imgElement = document.getElementById('ct-expression-image');
        if (imgElement instanceof HTMLImageElement) {
            imgElement.src = '';
        }

        if (isVisualNovelMode()) {
            $('#ct-visual-novel-wrapper').empty();
        }

        updateFunction();
    });

    eventSource.on(event_types.GROUP_UPDATED, updateVisualNovelModeDebounced);
    $(window).on('resize', updateVisualNovelModeDebounced);

    // Initial update
    moduleWorker();

    console.log(`[${MODULE_NAME}] Initialization complete`);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    MODULE_NAME,
    getSpritesList,
    validateImages,
    spriteCache,
    getExpressionLabel,
    sendExpressionCall,
    isVisualNovelMode,
    isVectHareAvailable,
};
