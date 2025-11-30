/**
 * ============================================================================
 * COTTON-TALES CHOICE PANEL
 * ============================================================================
 * VN-style choice buttons that appear after AI responses.
 *
 * Features:
 * - 2 prefilled AI-generated choices
 * - 1 custom input choice (user types their own response)
 * - Animated appearance
 * - Keyboard shortcuts (1, 2, 3 or Enter for custom)
 *
 * @version 1.0.0
 * ============================================================================
 */

import { getSettings } from '../core/settings-manager.js';

const MODULE_NAME = 'CT-ChoicePanel';

// =============================================================================
// STATE
// =============================================================================

let choicePanelElement = null;
let currentChoices = [];
let onChoiceCallback = null;
let isVisible = false;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the choice panel
 * Creates the DOM element and sets up event listeners
 */
export function initChoicePanel() {
    if (choicePanelElement) {
        console.debug(`[${MODULE_NAME}] Already initialized`);
        return;
    }

    // Create the choice panel container
    choicePanelElement = document.createElement('div');
    choicePanelElement.id = 'ct-choice-panel';
    choicePanelElement.className = 'ct-choice-panel';
    choicePanelElement.innerHTML = getChoicePanelHTML();

    // Add to body (will be positioned absolutely)
    document.body.appendChild(choicePanelElement);

    // Set up keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcut);

    console.log(`[${MODULE_NAME}] Initialized`);
}

/**
 * Clean up the choice panel
 */
export function destroyChoicePanel() {
    if (choicePanelElement) {
        choicePanelElement.remove();
        choicePanelElement = null;
    }
    document.removeEventListener('keydown', handleKeyboardShortcut);
    isVisible = false;
}

// =============================================================================
// HTML GENERATION
// =============================================================================

/**
 * Generate the choice panel HTML structure
 */
function getChoicePanelHTML() {
    return `
        <div class="ct-choice-panel-inner">
            <!-- Choice 1: AI-generated -->
            <button class="ct-choice-btn ct-choice-prefilled" data-choice-index="0">
                <span class="ct-choice-number">1</span>
                <span class="ct-choice-text"></span>
            </button>

            <!-- Choice 2: AI-generated -->
            <button class="ct-choice-btn ct-choice-prefilled" data-choice-index="1">
                <span class="ct-choice-number">2</span>
                <span class="ct-choice-text"></span>
            </button>

            <!-- Choice 3: Custom input -->
            <div class="ct-choice-btn ct-choice-custom" data-choice-index="custom">
                <span class="ct-choice-number">
                    <i class="fa-solid fa-pen"></i>
                </span>
                <div class="ct-choice-input-wrapper">
                    <input
                        type="text"
                        class="ct-choice-input"
                        placeholder="Type your own response..."
                        maxlength="500"
                    />
                    <button class="ct-choice-send" title="Send (Enter)">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Show the choice panel with given choices
 * @param {Array<{label: string, prompt: string}>} choices - Choice options from AI
 * @param {Function} onChoice - Callback when a choice is selected: (choiceText, isCustom) => void
 */
export function showChoices(choices, onChoice) {
    if (!choicePanelElement) {
        initChoicePanel();
    }

    currentChoices = choices || [];
    onChoiceCallback = onChoice;

    // Update choice buttons with AI-generated options
    const choiceButtons = choicePanelElement.querySelectorAll('.ct-choice-prefilled');

    choiceButtons.forEach((btn, index) => {
        const choice = currentChoices[index];
        const textEl = btn.querySelector('.ct-choice-text');

        if (choice) {
            textEl.textContent = choice.label || choice.prompt || `Option ${index + 1}`;
            btn.style.display = 'flex';
            btn.classList.remove('ct-hidden');
        } else {
            // Hide if no choice provided
            btn.style.display = 'none';
            btn.classList.add('ct-hidden');
        }
    });

    // Clear custom input
    const customInput = choicePanelElement.querySelector('.ct-choice-input');
    if (customInput) {
        customInput.value = '';
    }

    // Bind events
    bindChoiceEvents();

    // Show with animation
    choicePanelElement.classList.add('ct-visible');
    isVisible = true;

    // Focus the custom input after a small delay (for animation)
    setTimeout(() => {
        const settings = getSettings();
        if (settings.showCustomInput !== false) {
            customInput?.focus();
        }
    }, 300);

    console.debug(`[${MODULE_NAME}] Showing ${currentChoices.length} choices`);
}

/**
 * Hide the choice panel
 */
export function hideChoices() {
    if (!choicePanelElement) return;

    choicePanelElement.classList.remove('ct-visible');
    isVisible = false;
    currentChoices = [];
    onChoiceCallback = null;

    console.debug(`[${MODULE_NAME}] Hidden`);
}

/**
 * Check if choice panel is currently visible
 */
export function isChoicePanelVisible() {
    return isVisible;
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

/**
 * Bind click/input events to choice buttons
 */
function bindChoiceEvents() {
    if (!choicePanelElement) return;

    // Prefilled choice buttons
    const prefilledButtons = choicePanelElement.querySelectorAll('.ct-choice-prefilled');
    prefilledButtons.forEach((btn, index) => {
        // Remove old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            selectChoice(index);
        });
    });

    // Custom input
    const customInput = choicePanelElement.querySelector('.ct-choice-input');
    const sendButton = choicePanelElement.querySelector('.ct-choice-send');

    if (customInput) {
        // Clone to remove old listeners
        const newInput = customInput.cloneNode(true);
        customInput.parentNode.replaceChild(newInput, customInput);

        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitCustomChoice();
            }
        });
    }

    if (sendButton) {
        const newSendBtn = sendButton.cloneNode(true);
        sendButton.parentNode.replaceChild(newSendBtn, sendButton);

        newSendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitCustomChoice();
        });
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcut(e) {
    if (!isVisible) return;

    // Don't intercept if typing in the custom input
    const activeEl = document.activeElement;
    if (activeEl?.classList.contains('ct-choice-input')) {
        return;
    }

    // Number keys 1-3
    if (e.key === '1' && currentChoices[0]) {
        e.preventDefault();
        selectChoice(0);
    } else if (e.key === '2' && currentChoices[1]) {
        e.preventDefault();
        selectChoice(1);
    } else if (e.key === '3') {
        e.preventDefault();
        // Focus custom input
        const customInput = choicePanelElement?.querySelector('.ct-choice-input');
        customInput?.focus();
    }
}

/**
 * Select a prefilled choice
 */
function selectChoice(index) {
    const choice = currentChoices[index];
    if (!choice) return;

    // Visual feedback
    const buttons = choicePanelElement?.querySelectorAll('.ct-choice-prefilled');
    buttons?.[index]?.classList.add('ct-choice-selected');

    // Get the prompt (what to send) vs label (what was displayed)
    const choiceText = choice.prompt || choice.label || '';

    console.log(`[${MODULE_NAME}] Selected choice ${index + 1}: "${choiceText}"`);

    // Trigger callback
    if (onChoiceCallback) {
        onChoiceCallback(choiceText, false);
    }

    // Hide after selection
    setTimeout(() => {
        hideChoices();
    }, 150);
}

/**
 * Submit the custom input choice
 */
function submitCustomChoice() {
    const customInput = choicePanelElement?.querySelector('.ct-choice-input');
    const customText = customInput?.value?.trim();

    if (!customText) {
        // Shake animation for empty input
        customInput?.classList.add('ct-shake');
        setTimeout(() => customInput?.classList.remove('ct-shake'), 500);
        return;
    }

    console.log(`[${MODULE_NAME}] Custom choice: "${customText}"`);

    // Visual feedback
    const customBtn = choicePanelElement?.querySelector('.ct-choice-custom');
    customBtn?.classList.add('ct-choice-selected');

    // Trigger callback
    if (onChoiceCallback) {
        onChoiceCallback(customText, true);
    }

    // Hide after selection
    setTimeout(() => {
        hideChoices();
    }, 150);
}

// =============================================================================
// UTILITY
// =============================================================================

/**
 * Update choice panel position (for different dialogue positions)
 * @param {'bottom' | 'top' | 'center'} position
 */
export function setChoicePanelPosition(position = 'bottom') {
    if (!choicePanelElement) return;

    choicePanelElement.classList.remove('ct-position-bottom', 'ct-position-top', 'ct-position-center');
    choicePanelElement.classList.add(`ct-position-${position}`);
}

/**
 * Get the current choice panel element (for external styling)
 */
export function getChoicePanelElement() {
    return choicePanelElement;
}
