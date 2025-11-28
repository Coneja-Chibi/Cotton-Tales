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
    eventSource,
    event_types,
    generateQuietPrompt,
    generateRaw,
    getRequestHeaders,
    online_status,
    saveSettingsDebounced,
    substituteParams,
    substituteParamsExtended,
    system_message_types,
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
import { EXTENSION_NAME } from './core/constants.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODULE_NAME = 'ct-expressions';
const UPDATE_INTERVAL = 2000;
const STREAMING_UPDATE_INTERVAL = 10000;
const DEFAULT_FALLBACK_EXPRESSION = 'joy';
const DEFAULT_LLM_PROMPT = 'Classify the emotion of the last message. Output just one word. Choose only one: {{labels}}';

const DEFAULT_EXPRESSIONS = [
    'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring',
    'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval',
    'disgust', 'embarrassment', 'excitement', 'fear', 'gratitude', 'grief',
    'joy', 'love', 'nervousness', 'optimism', 'pride', 'realization',
    'relief', 'remorse', 'sadness', 'surprise', 'neutral',
];

/** @enum {number} */
const EXPRESSION_API = {
    local: 0,
    extras: 1,
    llm: 2,
    none: 99,
};

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

/**
 * Gets the current expression settings from Cotton-Tales
 * Maps CT settings to the format expected by expression functions
 */
function getExpressionSettings() {
    const ctSettings = getSettings();
    return {
        api: EXPRESSION_API.none, // Default to none, can be configured later
        fallback_expression: ctSettings.fallbackExpression || DEFAULT_FALLBACK_EXPRESSION,
        showDefault: false,
        allowMultiple: true,
        rerollIfSame: false,
    };
}

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

    const settings = getExpressionSettings();

    // Find sprites for this expression
    let sprite = spriteCache[spriteFolderName].find(x => x.label === expression);

    // Try fallback if no match
    if (!(sprite?.files?.length > 0) && settings.fallback_expression) {
        sprite = spriteCache[spriteFolderName].find(x => x.label === settings.fallback_expression);
        console.debug(`[${MODULE_NAME}] Using fallback expression: ${settings.fallback_expression}`);
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
        // No sprite found
        img.attr('src', '');
        img.attr('data-expression', expression);
        console.debug(`[${MODULE_NAME}] No sprite found for expression:`, expression);
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

        if (expressionImage.length) {
            if (!spriteFolderName || spriteFolderName == memberSpriteFolderName) {
                await validateImages(memberSpriteFolderName, true);
                const path = spriteFile?.imageSrc || '';
                const img = expressionImage.find('img');
                await setImage(img, path);
            }
            expressionImage.toggleClass('hidden', !spriteFile);
        } else {
            // Create new expression holder for this character
            const template = $('#ct-expression-holder').clone();
            template.attr('id', `ct-expression-${avatar}`);
            template.attr('data-avatar', avatar);
            template.find('.drag-grabber').attr('id', `ct-expression-${avatar}header`);
            $('#ct-visual-novel-wrapper').append(template);
            dragElement($(template[0]));
            template.toggleClass('hidden', !spriteFile);

            const img = template.find('img');
            await setImage(img, spriteFile?.imageSrc || '');

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
 * Process text for classification
 */
function sampleClassifyText(text) {
    if (!text) return text;

    let result = substituteParams(text).replace(/[*"]/g, '');

    const SAMPLE_THRESHOLD = 500;
    if (text.length < SAMPLE_THRESHOLD) {
        result = trimToEndSentence(result);
    } else {
        result = trimToEndSentence(result.slice(0, 250)) + ' ' + trimToStartSentence(result.slice(-250));
    }

    return result.trim();
}

/**
 * Classify text to get expression label
 */
async function getExpressionLabel(text) {
    const settings = getExpressionSettings();

    if (!text) {
        return settings.fallback_expression;
    }

    text = sampleClassifyText(text);

    try {
        // Try local classifier first
        const localResult = await fetch('/api/extra/classify', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ text: text }),
        });

        if (localResult.ok) {
            const data = await localResult.json();
            return data.classification[0].label;
        }
    } catch (error) {
        console.debug(`[${MODULE_NAME}] Classification failed, using fallback`);
    }

    return settings.fallback_expression;
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

    // Skip if not enabled or no character
    if (!ctSettings.enabled) return;
    if (!context.groupId && context.characterId === undefined) {
        removeExpression();
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
};
