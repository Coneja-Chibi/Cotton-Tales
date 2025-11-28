/**
 * ============================================================================
 * COTTON-TALES SETTINGS PANEL
 * ============================================================================
 * Game-like carousel UI for sprite and settings management.
 * Cute, adorable, cozy game aesthetic.
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { getContext } from '../../../../extensions.js';
import { getRequestHeaders } from '../../../../../script.js';
import { EXTENSION_NAME, EXPRESSION_API, PROMPT_TYPE, DEFAULT_LLM_PROMPT, VECTHARE_TRIGGER, CLASSIFIER_MODELS } from '../core/constants.js';
import { getSettings, updateSetting } from '../core/settings-manager.js';
import { onVNModeToggled, openSpriteManager } from '../index.js';
import { isVectHareAvailable, clearEmotionEmbeddingsCache } from '../ct-expressions.js';
import { ConnectionManagerRequestService } from '../../../shared.js';

// =============================================================================
// STATE
// =============================================================================

let selectedCharacter = null;
let characterSpriteCache = {};
let currentTab = 'characters';
let modalEventsBound = false;
let escKeyHandler = null;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safe toastr wrapper - falls back to console if toastr unavailable
 */
const notify = {
    info: (msg) => typeof toastr !== 'undefined' ? toastr.info(msg) : console.info(`[Cotton-Tales] ${msg}`),
    success: (msg) => typeof toastr !== 'undefined' ? toastr.success(msg) : console.log(`[Cotton-Tales] ✓ ${msg}`),
    warning: (msg) => typeof toastr !== 'undefined' ? toastr.warning(msg) : console.warn(`[Cotton-Tales] ${msg}`),
    error: (msg) => typeof toastr !== 'undefined' ? toastr.error(msg) : console.error(`[Cotton-Tales] ${msg}`),
};

/**
 * Escape HTML to prevent XSS in dynamic content
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =============================================================================
// TAG COLORS (BunnyWorks style)
// =============================================================================

const TAG_COLORS = [
    '#F472B6', '#34D399', '#60A5FA', '#FBBF24', '#A78BFA',
    '#fb7185', '#F97316', '#10B981', '#06B6D4', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F59E0B', '#6366F1', '#EF4444',
    '#22D3EE', '#A3E635', '#C084FC', '#FB923C', '#4ADE80',
    '#38BDF8', '#818CF8', '#F87171', '#FDBA74', '#86EFAC',
    '#7DD3FC', '#A5B4FC', '#FCA5A5', '#FDE047', '#D8B4FE'
];

function getTagColor(tag) {
    const str = tag.toLowerCase();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function getSettingsHTML() {
    const settings = getSettings();
    return `
        <div id="cotton-tales-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Cotton-Tales</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <!-- Compact drawer content - just quick toggles and open button -->
                    <div class="ct-drawer-compact">
                        <!-- Quick Enable Toggle -->
                        <div class="ct-quick-toggle">
                            <div class="ct-quick-toggle-info">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                                <span>VN Mode</span>
                            </div>
                            <label class="ct-switch">
                                <input type="checkbox" id="ct_master_enable" ${settings.enabled ? 'checked' : ''} />
                                <span class="ct-switch-slider"></span>
                            </label>
                        </div>

                        <!-- Open Settings Modal Button -->
                        <button class="ct-open-modal-btn" id="ct_open_settings_modal">
                            <i class="fa-solid fa-gear"></i>
                            <span>Open Settings Panel</span>
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </button>

                        <div class="ct-drawer-footer">
                            Cotton-Tales v0.1.0
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getModalHTML() {
    return `
        <div id="ct-modal-overlay" class="ct-modal-overlay">
            <div class="ct-modal">
                <!-- Modal Header - OS Window Style -->
                <div class="ct-modal-header">
                    <div class="ct-modal-header-left">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span class="ct-modal-title">Cotton-Tales Settings</span>
                        <span class="ct-modal-subtitle">cotton-tales.config</span>
                    </div>
                    <div class="ct-modal-header-right">
                        <div class="ct-modal-header-dots">
                            <div class="ct-modal-dot minimize"></div>
                            <div class="ct-modal-dot maximize"></div>
                            <div class="ct-modal-dot close" id="ct_modal_close"></div>
                        </div>
                    </div>
                </div>

                <!-- Modal Body -->
                <div class="ct-modal-body">
                    <!-- Sidebar Navigation -->
                    <div class="ct-modal-sidebar">
                        <div class="ct-sidebar-section">
                            <div class="ct-sidebar-label">Content</div>
                            <button class="ct-sidebar-item active" data-tab="characters">
                                <i class="fa-solid fa-users"></i>
                                <span>Characters</span>
                            </button>
                            <button class="ct-sidebar-item" data-tab="expressions">
                                <i class="fa-solid fa-face-smile"></i>
                                <span>Expressions</span>
                            </button>
                            <button class="ct-sidebar-item" data-tab="backgrounds">
                                <i class="fa-solid fa-image"></i>
                                <span>Backgrounds</span>
                            </button>
                        </div>

                        <div class="ct-sidebar-section">
                            <div class="ct-sidebar-label">Display</div>
                            <button class="ct-sidebar-item" data-tab="display">
                                <i class="fa-solid fa-display"></i>
                                <span>VN Settings</span>
                            </button>
                            <button class="ct-sidebar-item" data-tab="scenes">
                                <i class="fa-solid fa-clapperboard"></i>
                                <span>Scenes</span>
                            </button>
                        </div>

                        <div class="ct-sidebar-footer">
                            <a href="https://github.com/Coneja-Chibi" target="_blank">
                                <i class="fa-brands fa-github"></i>
                                Coneja Chibi
                            </a>
                        </div>
                    </div>

                    <!-- Main Content Area -->
                    <div class="ct-modal-content">
                        <!-- Characters Tab -->
                        <div class="ct-modal-tab active" data-tab="characters">
                            ${getCharactersTabHTML()}
                        </div>

                        <!-- Expressions Tab -->
                        <div class="ct-modal-tab" data-tab="expressions">
                            ${getExpressionsTabHTML()}
                        </div>

                        <!-- Backgrounds Tab -->
                        <div class="ct-modal-tab" data-tab="backgrounds">
                            ${getBackgroundsTabHTML()}
                        </div>

                        <!-- Display Tab -->
                        <div class="ct-modal-tab" data-tab="display">
                            ${getDisplayTabHTML()}
                        </div>

                        <!-- Scenes Tab -->
                        <div class="ct-modal-tab" data-tab="scenes">
                            ${getScenesTabHTML()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getCharactersTabHTML() {
    return `
        <!-- Master Toggle -->
        <div class="ct-master-toggle">
            <div class="ct-toggle-info">
                <h3>Enable Visual Novel Mode</h3>
                <p>Transform your chat into a VN experience</p>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_modal_master_enable" />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Character Carousel -->
        <div class="ct-section-label">
            <i class="fa-solid fa-star"></i>
            Your Characters
        </div>

        <div class="ct-carousel-wrapper">
            <button class="ct-carousel-arrow left" id="ct_char_prev">
                <i class="fa-solid fa-chevron-left"></i>
            </button>

            <div class="ct-carousel" id="ct_character_carousel">
                <!-- Cards populated by JS -->
                <div class="ct-empty-state">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <div class="ct-empty-state-text">Loading characters...</div>
                </div>
            </div>

            <button class="ct-carousel-arrow right" id="ct_char_next">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>

        <!-- Detail Panel (shown when card selected) -->
        <div class="ct-detail-panel" id="ct_character_detail">
            <!-- Populated by JS when character selected -->
        </div>

        <!-- Sprite Manager Button -->
        <div class="ct-action-row" style="justify-content: center; margin-top: 16px;">
            <button class="ct-btn" id="ct_open_sprite_manager">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                Open Sprite Manager
            </button>
        </div>
        <p style="text-align: center; font-size: 11px; color: var(--ct-text-light); margin-top: 8px;">
            Manage sprites, outfits, NPCs, and triggers
        </p>
    `;
}

function getExpressionsTabHTML() {
    const settings = getSettings();
    const vectHareAvailable = isVectHareAvailable();

    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-brain"></i>
            Expression Classification
        </div>

        <p style="font-size: 12px; color: var(--ct-text-light); margin-bottom: 16px;">
            Choose how Cotton-Tales detects emotions in messages to switch character sprites.
        </p>

        <!-- Classification API -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Classification Method</span>
            </div>
            <select class="ct-select" id="ct_expression_api">
                <option value="${EXPRESSION_API.local}" ${settings.expressionApi === EXPRESSION_API.local ? 'selected' : ''}>
                    Local (Built-in BERT)
                </option>
                <option value="${EXPRESSION_API.llm}" ${settings.expressionApi === EXPRESSION_API.llm ? 'selected' : ''}>
                    LLM (Current Chat API)
                </option>
                <option value="${EXPRESSION_API.webllm}" ${settings.expressionApi === EXPRESSION_API.webllm ? 'selected' : ''}>
                    WebLLM (Browser-based)
                </option>
                <option value="${EXPRESSION_API.extras}" ${settings.expressionApi === EXPRESSION_API.extras ? 'selected' : ''}>
                    Extras Server
                </option>
                <option value="${EXPRESSION_API.vecthare}" ${settings.expressionApi === EXPRESSION_API.vecthare ? 'selected' : ''}
                    ${!vectHareAvailable ? 'disabled' : ''}>
                    VectHare Semantic ${!vectHareAvailable ? '(Not Installed)' : '✓'}
                </option>
                <option value="${EXPRESSION_API.none}" ${settings.expressionApi === EXPRESSION_API.none ? 'selected' : ''}>
                    None (Fallback Only)
                </option>
            </select>
        </div>

        <!-- API Help Text -->
        <div id="ct_api_help" style="font-size: 11px; color: var(--ct-text-light); margin-bottom: 16px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px;">
            <strong>Local:</strong> Uses transformers.js BERT model. Fast and private, runs entirely in browser.
        </div>

        <!-- Local Classifier Settings (shown when Local selected) -->
        <div id="ct_local_classifier_settings" style="display: ${settings.expressionApi === EXPRESSION_API.local ? 'block' : 'none'}; margin-bottom: 16px; padding: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <div class="ct-section-label" style="margin-bottom: 12px; padding-bottom: 8px;">
                <i class="fa-solid fa-microchip"></i>
                Classifier Model
            </div>

            <!-- Model Selector -->
            <div class="ct-slider-row" style="margin-bottom: 12px;">
                <div class="ct-slider-header">
                    <span class="ct-slider-label">Model</span>
                </div>
                <select class="ct-select" id="ct_classifier_model">
                    ${Object.values(CLASSIFIER_MODELS).map(model => `
                        <option value="${model.id}" ${settings.classifierModel === model.id ? 'selected' : ''}>
                            ${model.name} (${model.labels} labels)
                        </option>
                    `).join('')}
                </select>
            </div>

            <!-- Model Description -->
            <div id="ct_model_description" style="font-size: 11px; color: var(--ct-text-light); margin-bottom: 12px; padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                ${CLASSIFIER_MODELS[settings.classifierModel]?.description || ''}
            </div>

            <!-- Quantization Toggle -->
            <div class="ct-toggle-row" style="padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.1);">
                <div>
                    <div class="ct-toggle-label">Use Quantized Model</div>
                    <div class="ct-toggle-sublabel">Smaller & faster, slightly less accurate</div>
                </div>
                <label class="ct-switch">
                    <input type="checkbox" id="ct_use_quantized" ${settings.useQuantizedModel ? 'checked' : ''} />
                    <span class="ct-switch-slider"></span>
                </label>
            </div>

            <!-- Custom Repo Override -->
            <div class="ct-slider-row" style="margin-top: 12px;">
                <div class="ct-slider-header">
                    <span class="ct-slider-label">Custom HuggingFace Repo</span>
                </div>
                <input type="text" class="ct-input" id="ct_custom_classifier_repo"
                    placeholder="username/repo-name (leave blank for default)"
                    value="${settings.customClassifierRepo || ''}"
                    style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--ct-wood-dark); background: var(--ct-cream); font-size: 12px;" />
            </div>
            <p style="font-size: 10px; color: var(--ct-text-light); margin-top: 4px;">
                Mirror models to your own HuggingFace for reliability. Leave blank to use original repos.
            </p>
        </div>

        ${vectHareAvailable ? `
        <!-- VectHare Bonus Section -->
        <div class="ct-vecthare-bonus" id="ct_vecthare_settings" style="margin: 16px 0; padding: 12px; background: linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.1)); border: 1px solid rgba(139,92,246,0.3); border-radius: 8px; display: ${settings.expressionApi === EXPRESSION_API.vecthare ? 'block' : 'none'};">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <i class="fa-solid fa-rabbit" style="color: #8b5cf6;"></i>
                <span style="font-weight: 600; color: #8b5cf6;">VectHare Semantic Classification</span>
            </div>
            <p style="font-size: 11px; color: var(--ct-text-light); margin: 0 0 12px 0;">
                Uses VectHare's embedding provider to semantically match text to emotions via cosine similarity.
                This understands emotion context rather than just keywords.
            </p>

            <!-- Classification Trigger -->
            <div class="ct-slider-row" style="margin-bottom: 8px;">
                <div class="ct-slider-header">
                    <span class="ct-slider-label" style="font-size: 12px;">Classification Trigger</span>
                </div>
                <select class="ct-select" id="ct_vecthare_trigger" style="font-size: 11px;">
                    <option value="${VECTHARE_TRIGGER.after_response}" ${settings.vecthareTrigger === VECTHARE_TRIGGER.after_response ? 'selected' : ''}>
                        After AI Response
                    </option>
                    <option value="${VECTHARE_TRIGGER.before_send}" ${settings.vecthareTrigger === VECTHARE_TRIGGER.before_send ? 'selected' : ''}>
                        Before User Sends (classify previous)
                    </option>
                </select>
            </div>
            <p style="font-size: 10px; color: var(--ct-text-light); margin: 0 0 12px 0;">
                "After AI Response" classifies immediately. "Before User Sends" waits until user starts typing.
            </p>

            <!-- Cache Emotions Toggle -->
            <div class="ct-toggle-row" style="padding: 8px 0;">
                <div>
                    <div class="ct-toggle-label" style="font-size: 12px;">Cache Emotion Embeddings</div>
                    <div class="ct-toggle-sublabel" style="font-size: 10px;">Faster classification (embeddings computed once)</div>
                </div>
                <label class="ct-switch">
                    <input type="checkbox" id="ct_vecthare_cache" ${settings.vecthareCacheEmotions ? 'checked' : ''} />
                    <span class="ct-switch-slider"></span>
                </label>
            </div>

            <!-- Clear Cache Button -->
            <button class="ct-btn secondary" id="ct_clear_emotion_cache" style="margin-top: 8px; font-size: 11px;">
                <i class="fa-solid fa-trash"></i>
                Clear Emotion Cache
            </button>
        </div>
        ` : ''}

        <!-- LLM Settings (shown when LLM selected) -->
        <div id="ct_llm_settings" style="display: ${settings.expressionApi === EXPRESSION_API.llm ? 'block' : 'none'};">
            <div class="ct-section-label" style="margin-top: 16px;">
                <i class="fa-solid fa-message"></i>
                LLM Settings
            </div>

            <!-- Connection Profile -->
            <div class="ct-slider-row">
                <div class="ct-slider-header">
                    <span class="ct-slider-label">Connection Profile</span>
                </div>
                <select class="ct-select" id="ct_expression_connection_profile">
                    <option value="">Use Current Chat API</option>
                    <!-- Populated by JS -->
                </select>
            </div>
            <p style="font-size: 10px; color: var(--ct-text-light); margin: 4px 0 12px 0;">
                Use a different API connection for classification (e.g., a cheaper/faster model)
            </p>

            <!-- Prompt Type -->
            <div class="ct-slider-row" id="ct_prompt_type_row">
                <div class="ct-slider-header">
                    <span class="ct-slider-label">Prompt Type</span>
                </div>
                <select class="ct-select" id="ct_expression_prompt_type">
                    <option value="${PROMPT_TYPE.raw}" ${settings.expressionPromptType === PROMPT_TYPE.raw ? 'selected' : ''}>
                        Raw (Just text + instruction)
                    </option>
                    <option value="${PROMPT_TYPE.full}" ${settings.expressionPromptType === PROMPT_TYPE.full ? 'selected' : ''}>
                        Full (Uses chat context)
                    </option>
                </select>
            </div>

            <!-- Custom Prompt -->
            <div class="ct-slider-row">
                <div class="ct-slider-header">
                    <span class="ct-slider-label">Classification Prompt</span>
                </div>
                <textarea class="ct-textarea" id="ct_llm_prompt" rows="3"
                    placeholder="Use {{labels}} for available expressions"
                    style="width: 100%; resize: vertical; font-size: 12px; padding: 8px; border-radius: 6px; border: 1px solid var(--ct-wood-dark); background: var(--ct-cream);"
                >${settings.expressionLlmPrompt || DEFAULT_LLM_PROMPT}</textarea>
            </div>

            <button class="ct-btn secondary" id="ct_reset_prompt" style="margin-top: 8px;">
                <i class="fa-solid fa-rotate-left"></i>
                Reset to Default
            </button>
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-sliders"></i>
            Classification Options
        </div>

        <!-- Fallback Expression -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Fallback Expression</span>
            </div>
            <select class="ct-select" id="ct_fallback_expression">
                <option value="neutral" ${settings.fallbackExpression === 'neutral' ? 'selected' : ''}>neutral</option>
                <option value="joy" ${settings.fallbackExpression === 'joy' ? 'selected' : ''}>joy</option>
                <option value="sadness" ${settings.fallbackExpression === 'sadness' ? 'selected' : ''}>sadness</option>
                <option value="anger" ${settings.fallbackExpression === 'anger' ? 'selected' : ''}>anger</option>
                <option value="surprise" ${settings.fallbackExpression === 'surprise' ? 'selected' : ''}>surprise</option>
                <option value="fear" ${settings.fallbackExpression === 'fear' ? 'selected' : ''}>fear</option>
                <option value="#none" ${settings.fallbackExpression === '#none' ? 'selected' : ''}>None (hide sprite)</option>
            </select>
        </div>

        <!-- Filter Available -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Filter to Available Sprites</div>
                <div class="ct-toggle-sublabel">Only suggest expressions that have sprites</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_filter_available" ${settings.filterAvailableExpressions ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Translate Before Classify -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Translate to English</div>
                <div class="ct-toggle-sublabel">Translate text before classification (if translate extension enabled)</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_translate_classify" ${settings.translateBeforeClassify ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>
    `;
}

function getBackgroundsTabHTML() {
    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-image"></i>
            Background Library
        </div>

        <div class="ct-carousel-wrapper">
            <button class="ct-carousel-arrow left" id="ct_bg_prev">
                <i class="fa-solid fa-chevron-left"></i>
            </button>

            <div class="ct-carousel" id="ct_background_carousel">
                <div class="ct-empty-state">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <div class="ct-empty-state-text">Loading backgrounds...</div>
                </div>
            </div>

            <button class="ct-carousel-arrow right" id="ct_bg_next">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>

        <div class="ct-action-row" style="margin-top: 20px; justify-content: center;">
            <button class="ct-btn" id="ct_upload_bg">
                <i class="fa-solid fa-upload"></i>
                Upload Background
            </button>
        </div>
    `;
}

function getDisplayTabHTML() {
    const settings = getSettings();

    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            Visual Settings
        </div>

        <!-- Layout Mode -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Layout Style</span>
            </div>
            <select class="ct-select" id="ct_layout_mode">
                <option value="adv" ${settings.layoutMode === 'adv' ? 'selected' : ''}>ADV - Full screen, dialogue at bottom (Ren'Py)</option>
                <option value="prt" disabled>PRT - Portrait panels on side (Coming Soon)</option>
            </select>
        </div>

        <!-- Dialogue Opacity -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Dialogue Box Opacity</span>
                <span class="ct-slider-value" id="ct_opacity_val">${settings.dialogueOpacity}%</span>
            </div>
            <input type="range" class="ct-slider" id="ct_dialogue_opacity"
                   min="20" max="100" value="${settings.dialogueOpacity}" />
        </div>

        <!-- Typewriter Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Typewriter Effect</div>
                <div class="ct-toggle-sublabel">Text appears character by character</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_typewriter" ${settings.typewriterEnabled ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Typewriter Speed -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Typewriter Speed</span>
                <span class="ct-slider-value" id="ct_speed_val">${settings.typewriterSpeed}ms</span>
            </div>
            <input type="range" class="ct-slider" id="ct_typewriter_speed"
                   min="10" max="100" value="${settings.typewriterSpeed}" />
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-masks-theater"></i>
            Sprite Settings
        </div>

        <!-- Effects Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Sprite Effects</div>
                <div class="ct-toggle-sublabel">Hearts, sparkles, sweat drops, etc.</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_effects" ${settings.effectsEnabled ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Sprite Transition -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Sprite Transition</span>
            </div>
            <select class="ct-select" id="ct_sprite_transition">
                <option value="fade" ${settings.spriteTransition === 'fade' ? 'selected' : ''}>Fade</option>
                <option value="dissolve" ${settings.spriteTransition === 'dissolve' ? 'selected' : ''}>Dissolve</option>
                <option value="none" ${settings.spriteTransition === 'none' ? 'selected' : ''}>Instant</option>
            </select>
        </div>

        <!-- Transition Duration -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Transition Duration</span>
                <span class="ct-slider-value" id="ct_trans_val">${settings.spriteTransitionDuration}ms</span>
            </div>
            <input type="range" class="ct-slider" id="ct_transition_duration"
                   min="100" max="1000" step="50" value="${settings.spriteTransitionDuration}" />
        </div>
    `;
}

function getScenesTabHTML() {
    const settings = getSettings();

    return `
        <div class="ct-section-label">
            <i class="fa-solid fa-list-check"></i>
            Choice Settings
        </div>

        <!-- Choice Count -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Choices Per Turn</span>
                <span class="ct-slider-value" id="ct_choice_val">${settings.choiceCount}</span>
            </div>
            <input type="range" class="ct-slider" id="ct_choice_count"
                   min="2" max="4" value="${settings.choiceCount}" />
        </div>

        <!-- Custom Input Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Custom Input Option</div>
                <div class="ct-toggle-sublabel">Always show "Type your own..." choice</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_custom_input" ${settings.showCustomInput ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Button Style -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Choice Button Style</span>
            </div>
            <select class="ct-select" id="ct_choice_style">
                <option value="rounded" ${settings.choiceButtonStyle === 'rounded' ? 'selected' : ''}>Rounded</option>
                <option value="square" ${settings.choiceButtonStyle === 'square' ? 'selected' : ''}>Square</option>
                <option value="pill" ${settings.choiceButtonStyle === 'pill' ? 'selected' : ''}>Pill</option>
            </select>
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-panorama"></i>
            Background Automation
        </div>

        <!-- Auto Background Toggle -->
        <div class="ct-toggle-row">
            <div>
                <div class="ct-toggle-label">Auto Background Switching</div>
                <div class="ct-toggle-sublabel">AI can change backgrounds via schema</div>
            </div>
            <label class="ct-switch">
                <input type="checkbox" id="ct_auto_bg" ${settings.autoBackgroundEnabled ? 'checked' : ''} />
                <span class="ct-switch-slider"></span>
            </label>
        </div>

        <!-- Background Transition -->
        <div class="ct-slider-row">
            <div class="ct-slider-header">
                <span class="ct-slider-label">Background Transition</span>
            </div>
            <select class="ct-select" id="ct_bg_transition">
                <option value="fade" ${settings.backgroundTransition === 'fade' ? 'selected' : ''}>Fade</option>
                <option value="dissolve" ${settings.backgroundTransition === 'dissolve' ? 'selected' : ''}>Dissolve</option>
                <option value="none" ${settings.backgroundTransition === 'none' ? 'selected' : ''}>Instant</option>
            </select>
        </div>

        <div class="ct-section-label" style="margin-top: 24px;">
            <i class="fa-solid fa-wand-sparkles"></i>
            Stage Composer
        </div>

        <div class="ct-action-row" style="justify-content: center;">
            <button class="ct-btn" id="ct_open_stage">
                <i class="fa-solid fa-theater-masks"></i>
                Open Stage Composer
            </button>
        </div>
        <p style="text-align: center; font-size: 11px; color: var(--ct-text-light); margin-top: 10px;">
            Visually arrange characters and preview scenes
        </p>
    `;
}

// =============================================================================
// CHARACTER CARD GENERATION
// =============================================================================

function generateCharacterCard(char, isNPC = false, isActive = false) {
    const spriteCount = characterSpriteCache[char.folder]?.length || 0;
    const avatarSrc = char.avatar ? `/characters/${char.avatar}` : '';
    const fileExt = isNPC ? '.npc' : '.char';

    // Get tags from character data (escape for XSS safety)
    const tags = char.data?.tags || [];
    const tagsHtml = tags.slice(0, 5).map(tag => {
        const color = getTagColor(tag);
        const safeTag = escapeHtml(tag);
        return `<span class="ct-tag" style="color: ${color}; border: 1px solid ${color}60; box-shadow: 0 0 12px ${color}30;">${safeTag}</span>`;
    }).join('');

    // Get costumes/variants (sprites grouped by expression labels)
    const sprites = characterSpriteCache[char.folder] || [];
    const costumes = [...new Set(sprites.map(s => s.label))];
    const hasCostumes = costumes.length > 1;

    // Escape user-provided content to prevent XSS
    const safeName = escapeHtml(char.name);
    const safeFolder = escapeHtml(char.folder);

    return `
        <div class="ct-card ${isActive ? 'ct-card-active' : ''}" data-character="${safeFolder}" data-name="${safeName}">
            ${isActive ? `
                <!-- Rainbow Border for Active Character -->
                <div class="ct-card-rainbow-border"></div>
                <div class="ct-card-active-badge">
                    <i class="fa-solid fa-star"></i>
                </div>
            ` : ''}

            <!-- OS Window Title Bar -->
            <div class="ct-card-titlebar">
                <div class="ct-card-titlebar-left">
                    <i class="fa-solid fa-user ct-card-titlebar-icon"></i>
                    <span class="ct-card-titlebar-text">${safeFolder}${fileExt}</span>
                </div>
                <div class="ct-card-titlebar-dots">
                    <div class="ct-card-titlebar-dot"></div>
                    <div class="ct-card-titlebar-dot"></div>
                    <div class="ct-card-titlebar-dot"></div>
                </div>
            </div>

            <!-- Content Area -->
            <div class="ct-card-content">
                <div class="ct-card-avatar">
                    ${avatarSrc
                        ? `<img src="${avatarSrc}" alt="${safeName}" />`
                        : `<div class="ct-avatar-placeholder"><i class="fa-solid fa-user"></i></div>`
                    }
                </div>
                <div class="ct-card-name">${safeName}</div>
                <div class="ct-card-badge ${isNPC ? 'npc' : 'card'}">
                    <i class="fa-solid ${isNPC ? 'fa-ghost' : 'fa-id-card'}"></i>
                    ${isNPC ? 'NPC' : 'Card'}
                </div>

                ${tags.length > 0 ? `
                    <div class="ct-card-tags">
                        ${tagsHtml}
                    </div>
                ` : ''}

                ${hasCostumes ? `
                    <div class="ct-card-variants" data-costumes='${JSON.stringify(costumes)}'>
                        <div class="ct-variants-label">Alternates</div>
                        <div class="ct-variants-carousel">
                            <button class="ct-variant-arrow ct-variant-prev">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <div class="ct-variant-display">
                                <div class="ct-variant-name">
                                    <span class="ct-variant-current">${costumes[0] || 'Default'}</span>
                                    <span class="ct-variant-type">Cover</span>
                                </div>
                            </div>
                            <button class="ct-variant-arrow ct-variant-next">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="ct-variant-dots">
                            ${costumes.map((_, i) => `<div class="ct-variant-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <button class="ct-card-action">
                    <i class="fa-solid fa-sparkles"></i>
                    Manage
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>

            <!-- Status Bar -->
            <div class="ct-card-statusbar">
                <div class="ct-card-statusbar-left">
                    <i class="fa-solid fa-mouse-pointer"></i>
                    <span>Click to manage</span>
                </div>
                ${spriteCount > 0 ? `
                    <div class="ct-card-statusbar-sprites">
                        <i class="fa-solid fa-image"></i>
                        <span>${spriteCount}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function generateAddCard() {
    return `
        <div class="ct-card ct-card-add" id="ct_add_character">
            <!-- Title Bar for Add Card -->
            <div class="ct-card-titlebar" style="background: linear-gradient(135deg, rgba(92, 225, 230, 0.6), rgba(107, 159, 255, 0.6));">
                <div class="ct-card-titlebar-left">
                    <i class="fa-solid fa-plus ct-card-titlebar-icon"></i>
                    <span class="ct-card-titlebar-text">new.char</span>
                </div>
                <div class="ct-card-titlebar-dots">
                    <div class="ct-card-titlebar-dot"></div>
                    <div class="ct-card-titlebar-dot"></div>
                    <div class="ct-card-titlebar-dot"></div>
                </div>
            </div>

            <!-- Content Area -->
            <div class="ct-card-content">
                <div class="ct-card-add-icon">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <div class="ct-card-add-text">Add NPC</div>
            </div>
        </div>
    `;
}

// =============================================================================
// DETAIL PANEL
// =============================================================================

function showCharacterDetail(charFolder, charName) {
    const detailPanel = document.getElementById('ct_character_detail');
    if (!detailPanel) return;

    const sprites = characterSpriteCache[charFolder] || [];

    // Group sprites by expression
    const grouped = {};
    for (const sprite of sprites) {
        if (!grouped[sprite.label]) {
            grouped[sprite.label] = [];
        }
        grouped[sprite.label].push(sprite);
    }

    detailPanel.innerHTML = `
        <div class="ct-detail-header">
            <div class="ct-detail-title">
                <i class="fa-solid fa-user"></i>
                ${charName}
            </div>
            <button class="ct-detail-close" id="ct_close_detail">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>

        <div class="ct-section-label">
            <i class="fa-solid fa-shirt"></i>
            Costumes
        </div>
        <div class="ct-costume-row">
            <button class="ct-costume-btn active">Default</button>
            <button class="ct-costume-btn add">+ Add Costume</button>
        </div>

        <div class="ct-section-label">
            <i class="fa-solid fa-face-smile"></i>
            Expressions (${Object.keys(grouped).length})
        </div>
        <div class="ct-sprite-grid">
            ${Object.entries(grouped).map(([label, files]) => `
                <div class="ct-sprite-item" title="${label}">
                    <img src="${files[0].path}" alt="${label}" loading="lazy" />
                    <div class="ct-sprite-item-label">${label}</div>
                </div>
            `).join('')}
        </div>

        <div class="ct-action-row">
            <button class="ct-btn" id="ct_upload_sprite">
                <i class="fa-solid fa-upload"></i>
                Upload Sprite
            </button>
            <button class="ct-btn secondary" id="ct_upload_pack">
                <i class="fa-solid fa-file-zipper"></i>
                Upload Pack
            </button>
        </div>
    `;

    detailPanel.classList.add('active');

    // Bind close button
    document.getElementById('ct_close_detail')?.addEventListener('click', () => {
        detailPanel.classList.remove('active');
        selectedCharacter = null;
        document.querySelectorAll('.ct-card').forEach(c => c.classList.remove('selected'));
    });
}

// =============================================================================
// CAROUSEL POPULATION
// =============================================================================

async function populateCharacterCarousel() {
    const carousel = document.getElementById('ct_character_carousel');
    if (!carousel) return;

    const context = getContext();
    const characters = context.characters || [];

    // Get currently active character (the one in the current chat)
    const activeCharName = context.name2 || '';
    const activeCharAvatar = context.characterId !== undefined ? characters[context.characterId]?.avatar : null;
    const activeCharFolder = activeCharAvatar?.replace(/\.[^/.]+$/, '') || activeCharName;

    console.debug(`[${EXTENSION_NAME}] populateCharacterCarousel: found ${characters.length} characters, active: ${activeCharFolder}`);

    // Build character list from cards
    const charList = [];
    for (const char of characters) {
        if (!char.name) continue;
        const folder = char.avatar?.replace(/\.[^/.]+$/, '') || char.name;
        charList.push({
            name: char.name,
            folder: folder,
            avatar: char.avatar,
            data: char.data, // Include character data for tags
            isNPC: false,
            isActive: folder === activeCharFolder
        });

        // Pre-fetch sprite counts
        try {
            const res = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`);
            if (res.ok) {
                characterSpriteCache[folder] = await res.json();
            }
        } catch (e) {
            console.debug(`[${EXTENSION_NAME}] Could not fetch sprites for ${folder}`);
        }
    }

    // TODO: Also load NPCs from our own storage

    // Sort so active character is first
    charList.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });

    // Generate HTML
    if (charList.length === 0) {
        carousel.innerHTML = `
            <div class="ct-empty-state">
                <i class="fa-solid fa-user-slash"></i>
                <div class="ct-empty-state-text">No characters found</div>
            </div>
        `;
        return;
    }

    carousel.innerHTML = charList.map(c => generateCharacterCard(c, c.isNPC, c.isActive)).join('') + generateAddCard();

    // Initialize variant carousel state on each card (stored in dataset to avoid memory leaks)
    carousel.querySelectorAll('.ct-card-variants').forEach(variantContainer => {
        variantContainer.dataset.currentIndex = '0';
    });

    // Bind card clicks
    carousel.querySelectorAll('.ct-card:not(.ct-card-add)').forEach(card => {
        card.addEventListener('click', () => {
            const folder = card.dataset.character;
            const name = card.dataset.name;

            // Toggle selection
            if (selectedCharacter === folder) {
                selectedCharacter = null;
                card.classList.remove('selected');
                document.getElementById('ct_character_detail')?.classList.remove('active');
            } else {
                document.querySelectorAll('.ct-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedCharacter = folder;
                showCharacterDetail(folder, name);
            }
        });
    });

    // Add character button
    document.getElementById('ct_add_character')?.addEventListener('click', () => {
        // TODO: Show add NPC modal
        notify.info('Add Character - Coming soon!');
    });
}

async function populateBackgroundCarousel() {
    const carousel = document.getElementById('ct_background_carousel');
    if (!carousel) return;

    try {
        const res = await fetch('/api/backgrounds/all', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({})
        });

        if (!res.ok) {
            carousel.innerHTML = `
                <div class="ct-empty-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <div class="ct-empty-state-text">Could not load backgrounds</div>
                </div>
            `;
            return;
        }

        const data = await res.json();
        const backgrounds = data.images || [];

        if (backgrounds.length === 0) {
            carousel.innerHTML = `
                <div class="ct-empty-state">
                    <i class="fa-solid fa-image"></i>
                    <div class="ct-empty-state-text">No backgrounds found</div>
                </div>
            `;
            return;
        }

        carousel.innerHTML = backgrounds.slice(0, 20).map(bg => `
            <div class="ct-card" data-bg="${bg}" style="flex: 0 0 200px;">
                <div style="height: 100px; border-radius: 8px; overflow: hidden; margin-bottom: 10px; border: 2px solid var(--ct-wood-light);">
                    <img src="backgrounds/${encodeURIComponent(bg)}" alt="${bg}"
                         style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
                </div>
                <div class="ct-card-name" style="font-size: 11px;">${bg.replace(/\.[^/.]+$/, '')}</div>
            </div>
        `).join('');

    } catch (e) {
        console.error(`[${EXTENSION_NAME}] Error loading backgrounds:`, e);
    }
}

// =============================================================================
// EVENT BINDING
// =============================================================================

/**
 * Handle variant carousel navigation via event delegation
 * @param {HTMLElement} variantContainer - The .ct-card-variants element
 * @param {number} direction - -1 for prev, +1 for next, or specific index
 * @param {boolean} isIndex - If true, direction is treated as a specific index
 */
function handleVariantNavigation(variantContainer, direction, isIndex = false) {
    const card = variantContainer.closest('.ct-card');
    const charFolder = card?.dataset.character;
    if (!charFolder) return;

    let costumes;
    try {
        costumes = JSON.parse(variantContainer.dataset.costumes || '[]');
    } catch (e) {
        console.error(`[${EXTENSION_NAME}] Failed to parse costumes data:`, e);
        return;
    }

    if (costumes.length <= 1) return;

    let currentIndex = parseInt(variantContainer.dataset.currentIndex || '0', 10);
    let newIndex;

    if (isIndex) {
        newIndex = direction;
    } else {
        newIndex = (currentIndex + direction + costumes.length) % costumes.length;
    }

    variantContainer.dataset.currentIndex = String(newIndex);
    const selectedCostume = costumes[newIndex];

    // Update label
    const currentLabel = variantContainer.querySelector('.ct-variant-current');
    if (currentLabel) currentLabel.textContent = selectedCostume;

    // Update dots
    variantContainer.querySelectorAll('.ct-variant-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === newIndex);
    });

    // Update card image
    const cardAvatar = card.querySelector('.ct-card-avatar img');
    const sprites = characterSpriteCache[charFolder] || [];
    const costumeSprite = sprites.find(s => s.label === selectedCostume);

    if (costumeSprite && cardAvatar) {
        const spritePath = `/characters/${charFolder}/${costumeSprite.path}`;
        cardAvatar.src = spritePath;
        cardAvatar.style.objectFit = 'contain';
        cardAvatar.style.objectPosition = 'center bottom';
    }
}

function bindEvents() {
    // Variant carousel - use event delegation on character carousel (no memory leak)
    const charCarousel = document.getElementById('ct_character_carousel');
    if (charCarousel) {
        charCarousel.addEventListener('click', (e) => {
            const target = e.target.closest('.ct-variant-prev, .ct-variant-next, .ct-variant-dot');
            if (!target) return;

            e.stopPropagation();
            const variantContainer = target.closest('.ct-card-variants');
            if (!variantContainer) return;

            if (target.classList.contains('ct-variant-prev')) {
                handleVariantNavigation(variantContainer, -1);
            } else if (target.classList.contains('ct-variant-next')) {
                handleVariantNavigation(variantContainer, 1);
            } else if (target.classList.contains('ct-variant-dot')) {
                const index = parseInt(target.dataset.index || '0', 10);
                handleVariantNavigation(variantContainer, index, true);
            }
        });
    }

    // Tab switching
    document.querySelectorAll('.ct-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Update tab buttons
            document.querySelectorAll('.ct-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update content
            document.querySelectorAll('.ct-tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector(`.ct-tab-content[data-tab="${tabName}"]`)?.classList.add('active');

            currentTab = tabName;

            // Lazy load tab content
            if (tabName === 'backgrounds') {
                populateBackgroundCarousel();
            }
        });
    });

    // Carousel arrows
    bindCarouselArrows('ct_char_prev', 'ct_char_next', 'ct_character_carousel');
    bindCarouselArrows('ct_bg_prev', 'ct_bg_next', 'ct_background_carousel');

    // Master enable toggle in modal (syncs with drawer toggle)
    document.getElementById('ct_modal_master_enable')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        updateSetting('enabled', enabled);
        onVNModeToggled(enabled);
        // Sync drawer toggle
        const drawerToggle = document.getElementById('ct_master_enable');
        if (drawerToggle) drawerToggle.checked = enabled;
    });

    // Display settings
    bindSlider('ct_dialogue_opacity', 'dialogueOpacity', 'ct_opacity_val', '%');
    bindSlider('ct_typewriter_speed', 'typewriterSpeed', 'ct_speed_val', 'ms');
    bindSlider('ct_transition_duration', 'spriteTransitionDuration', 'ct_trans_val', 'ms');
    bindSlider('ct_choice_count', 'choiceCount', 'ct_choice_val', '');

    bindSelect('ct_layout_mode', 'layoutMode');
    bindSelect('ct_sprite_transition', 'spriteTransition');
    bindSelect('ct_choice_style', 'choiceButtonStyle');
    bindSelect('ct_bg_transition', 'backgroundTransition');

    bindToggle('ct_typewriter', 'typewriterEnabled');
    bindToggle('ct_effects', 'effectsEnabled');
    bindToggle('ct_custom_input', 'showCustomInput');
    bindToggle('ct_auto_bg', 'autoBackgroundEnabled');

    // Stage composer button
    document.getElementById('ct_open_stage')?.addEventListener('click', () => {
        notify.info('Stage Composer - Coming soon!');
    });

    // Sprite Manager button
    document.getElementById('ct_open_sprite_manager')?.addEventListener('click', () => {
        openSpriteManager();
    });

    // ==========================================================================
    // EXPRESSIONS TAB BINDINGS
    // ==========================================================================

    // Expression API selector
    const apiSelect = document.getElementById('ct_expression_api');
    const llmSettings = document.getElementById('ct_llm_settings');
    const promptTypeRow = document.getElementById('ct_prompt_type_row');
    const apiHelp = document.getElementById('ct_api_help');

    const apiHelpTexts = {
        [EXPRESSION_API.local]: '<strong>Local:</strong> Uses transformers.js BERT model. Fast and private, runs entirely in browser.',
        [EXPRESSION_API.llm]: '<strong>LLM:</strong> Uses your current chat API to classify emotions. More context-aware but uses API calls.',
        [EXPRESSION_API.webllm]: '<strong>WebLLM:</strong> Uses browser-based LLM. Requires WebLLM extension installed.',
        [EXPRESSION_API.extras]: '<strong>Extras:</strong> Uses SillyTavern Extras server classify endpoint. Requires Extras running.',
        [EXPRESSION_API.vecthare]: '<strong>VectHare:</strong> Semantic emotion matching using embeddings. Experimental bonus feature.',
        [EXPRESSION_API.none]: '<strong>None:</strong> No classification. Only uses fallback expression.',
    };

    const vecthareSettings = document.getElementById('ct_vecthare_settings');
    const localClassifierSettings = document.getElementById('ct_local_classifier_settings');

    apiSelect?.addEventListener('change', (e) => {
        const api = parseInt(e.target.value, 10);
        updateSetting('expressionApi', api);

        // Show/hide LLM settings (only for LLM, not WebLLM which doesn't use profiles)
        const showLlm = api === EXPRESSION_API.llm;
        if (llmSettings) llmSettings.style.display = showLlm ? 'block' : 'none';

        // Show/hide VectHare settings
        const showVecthare = api === EXPRESSION_API.vecthare;
        if (vecthareSettings) vecthareSettings.style.display = showVecthare ? 'block' : 'none';

        // Show/hide Local classifier settings
        const showLocal = api === EXPRESSION_API.local;
        if (localClassifierSettings) localClassifierSettings.style.display = showLocal ? 'block' : 'none';

        // Update help text
        if (apiHelp) apiHelp.innerHTML = apiHelpTexts[api] || '';
    });

    // ==========================================================================
    // LOCAL CLASSIFIER SETTINGS BINDINGS
    // ==========================================================================

    // Classifier model selector
    const classifierModelSelect = document.getElementById('ct_classifier_model');
    const modelDescription = document.getElementById('ct_model_description');

    classifierModelSelect?.addEventListener('change', (e) => {
        const modelId = e.target.value;
        updateSetting('classifierModel', modelId);

        // Update description
        if (modelDescription && CLASSIFIER_MODELS[modelId]) {
            modelDescription.textContent = CLASSIFIER_MODELS[modelId].description;
        }

        notify.info(`Classifier model changed to ${CLASSIFIER_MODELS[modelId]?.name || modelId}. Reload may be required.`);
    });

    // Quantization toggle
    bindToggle('ct_use_quantized', 'useQuantizedModel');

    // Custom repo input
    document.getElementById('ct_custom_classifier_repo')?.addEventListener('change', (e) => {
        updateSetting('customClassifierRepo', e.target.value.trim());
        if (e.target.value.trim()) {
            notify.info('Custom classifier repo set. Reload required to apply.');
        }
    });

    // Connection profile dropdown - use ConnectionManagerRequestService
    initConnectionProfileDropdown();

    // Prompt type
    bindSelect('ct_expression_prompt_type', 'expressionPromptType');

    // LLM prompt textarea
    document.getElementById('ct_llm_prompt')?.addEventListener('change', (e) => {
        updateSetting('expressionLlmPrompt', e.target.value);
    });

    // Reset prompt button
    document.getElementById('ct_reset_prompt')?.addEventListener('click', () => {
        const textarea = document.getElementById('ct_llm_prompt');
        if (textarea) {
            textarea.value = DEFAULT_LLM_PROMPT;
            updateSetting('expressionLlmPrompt', DEFAULT_LLM_PROMPT);
            notify.success('Prompt reset to default');
        }
    });

    // Fallback expression
    bindSelect('ct_fallback_expression', 'fallbackExpression');

    // Classification options toggles
    bindToggle('ct_filter_available', 'filterAvailableExpressions');
    bindToggle('ct_translate_classify', 'translateBeforeClassify');

    // ==========================================================================
    // VECTHARE SETTINGS BINDINGS
    // ==========================================================================

    // VectHare trigger
    document.getElementById('ct_vecthare_trigger')?.addEventListener('change', (e) => {
        updateSetting('vecthareTrigger', e.target.value);
    });

    // VectHare cache toggle
    bindToggle('ct_vecthare_cache', 'vecthareCacheEmotions');

    // Clear emotion cache button
    document.getElementById('ct_clear_emotion_cache')?.addEventListener('click', () => {
        clearEmotionEmbeddingsCache();
        notify.success('Emotion embeddings cache cleared');
    });
}

/**
 * Initialize the connection profile dropdown using ConnectionManagerRequestService
 */
function initConnectionProfileDropdown() {
    const settings = getSettings();
    const dropdown = document.getElementById('ct_expression_connection_profile');

    if (!dropdown) return;

    try {
        // Check if Connection Manager is available
        const context = getContext();
        if (context.extensionSettings?.disabledExtensions?.includes('connection-manager')) {
            dropdown.innerHTML = '<option value="" disabled>Connection Manager not available</option>';
            return;
        }

        // Use the handleDropdown helper from ConnectionManagerRequestService
        ConnectionManagerRequestService.handleDropdown(
            '#ct_expression_connection_profile',
            settings.expressionConnectionProfile || '',
            // onChange - when user selects a profile
            (profile) => {
                updateSetting('expressionConnectionProfile', profile?.id || '');
                console.log(`[${EXTENSION_NAME}] Expression connection profile changed:`, profile?.name || 'Current API');
            },
            // onCreate - when a new profile is created
            () => {},
            // onUpdate - when a profile is updated
            () => {},
            // onDelete - when a profile is deleted
            () => {}
        );
    } catch (error) {
        console.debug(`[${EXTENSION_NAME}] Connection Manager not available:`, error.message);
        dropdown.innerHTML = '<option value="">Use Current Chat API</option><option value="" disabled>Connection Manager not installed</option>';
    }
}

function bindCarouselArrows(prevId, nextId, carouselId) {
    const carousel = document.getElementById(carouselId);
    const scrollAmount = 200;

    document.getElementById(prevId)?.addEventListener('click', () => {
        carousel?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    document.getElementById(nextId)?.addEventListener('click', () => {
        carousel?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
}

function bindSlider(id, settingKey, displayId, suffix) {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);

    // Debounce the settings save to avoid spamming
    let saveTimeout = null;

    slider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        // Update display immediately for responsiveness
        if (display) display.textContent = val + suffix;

        // Debounce the actual setting save
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            updateSetting(settingKey, val);
        }, 150);
    });
}

function bindSelect(id, settingKey) {
    document.getElementById(id)?.addEventListener('change', (e) => {
        updateSetting(settingKey, e.target.value);
    });
}

function bindToggle(id, settingKey) {
    document.getElementById(id)?.addEventListener('change', (e) => {
        updateSetting(settingKey, e.target.checked);
    });
}

// =============================================================================
// RENDER
// =============================================================================

export function renderSettings() {
    const container = document.getElementById('extensions_settings');
    if (!container) {
        console.error(`[${EXTENSION_NAME}] Extensions container not found`);
        return;
    }

    if (document.getElementById('cotton-tales-settings')) {
        return; // Already rendered
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = getSettingsHTML();
    container.appendChild(wrapper.firstElementChild);

    // Bind drawer events
    bindDrawerEvents();

    console.log(`[${EXTENSION_NAME}] Settings panel rendered`);
}

function openSettingsModal() {
    // Don't open if already open
    if (document.getElementById('ct-modal-overlay')) {
        return;
    }

    // Insert modal into body
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = getModalHTML();
    document.body.appendChild(modalWrapper.firstElementChild);

    // Animate in
    requestAnimationFrame(() => {
        document.getElementById('ct-modal-overlay')?.classList.add('active');
    });

    // Bind modal events
    bindModalEvents();

    // Populate content
    populateCharacterCarousel();
    populateBackgroundCarousel();
}

function closeSettingsModal() {
    const overlay = document.getElementById('ct-modal-overlay');
    if (!overlay) return;

    // Clean up escape key handler
    if (escKeyHandler) {
        document.removeEventListener('keydown', escKeyHandler);
        escKeyHandler = null;
    }

    overlay.classList.remove('active');

    // Remove after animation
    setTimeout(() => {
        overlay.remove();
    }, 300);
}

function bindDrawerEvents() {
    // Master enable toggle in drawer (syncs with modal toggle)
    document.getElementById('ct_master_enable')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        updateSetting('enabled', enabled);
        onVNModeToggled(enabled);
        // Sync modal toggle if it exists
        const modalToggle = document.getElementById('ct_modal_master_enable');
        if (modalToggle) modalToggle.checked = enabled;
    });

    // Open modal button
    document.getElementById('ct_open_settings_modal')?.addEventListener('click', () => {
        openSettingsModal();
    });
}

function bindModalEvents() {
    // Close button
    document.getElementById('ct_modal_close')?.addEventListener('click', closeSettingsModal);

    // Click outside to close
    document.getElementById('ct-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'ct-modal-overlay') {
            closeSettingsModal();
        }
    });

    // Escape key to close - use module-scoped handler for proper cleanup
    escKeyHandler = (e) => {
        if (e.key === 'Escape') {
            closeSettingsModal();
        }
    };
    document.addEventListener('keydown', escKeyHandler);

    // Sidebar navigation
    document.querySelectorAll('.ct-sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;

            // Update sidebar
            document.querySelectorAll('.ct-sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Update content
            document.querySelectorAll('.ct-modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`.ct-modal-tab[data-tab="${tabName}"]`)?.classList.add('active');

            currentTab = tabName;
        });
    });

    // Bind all the rest of the events (only once per session to avoid leaks)
    if (!modalEventsBound) {
        bindEvents();
        modalEventsBound = true;
    }
}

export { populateCharacterCarousel, openSettingsModal, closeSettingsModal };
