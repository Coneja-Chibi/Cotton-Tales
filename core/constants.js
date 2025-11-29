/**
 * ============================================================================
 * COTTON-TALES CONSTANTS
 * ============================================================================
 * Centralized configuration values used across the extension.
 * Change these values here instead of hunting through the codebase.
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

// =============================================================================
// EXTENSION IDENTITY
// =============================================================================

/** Extension name for logging and UI */
export const EXTENSION_NAME = 'Cotton-Tales';

/** Extension version (keep in sync with manifest.json) */
export const VERSION = '0.1.0-alpha';

/** Module name for ST extension system */
export const MODULE_NAME = 'cotton-tales';

// =============================================================================
// VN LAYOUT MODES
// =============================================================================

/** @enum {string} Layout style for VN presentation */
export const LAYOUT_MODE = {
    /** Adventure style - Full screen background, sprites overlaid, dialogue box at bottom (Ren'Py classic) */
    ADV: 'adv',
    /** Portrait style - Character/Persona portraits in ornate side panels, speech bubbles in main area (RPG style) */
    PRT: 'prt',
};

/** Default layout mode */
export const DEFAULT_LAYOUT_MODE = LAYOUT_MODE.ADV;

// =============================================================================
// CHOICE SYSTEM
// =============================================================================

/** Minimum choices to display per turn */
export const MIN_CHOICES = 2;

/** Maximum choices to display per turn */
export const MAX_CHOICES = 4;

/** Default number of choices */
export const DEFAULT_CHOICE_COUNT = 3;

/** Whether to always show custom input option */
export const DEFAULT_SHOW_CUSTOM_INPUT = true;

// =============================================================================
// EXPRESSION / SPRITE DEFAULTS
// =============================================================================

/** Default fallback expression when none specified */
export const DEFAULT_FALLBACK_EXPRESSION = 'neutral';

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/** Default delay for UI initialization in ms */
export const UI_INIT_DELAY = 150;

/** Default fetch timeout in ms */
export const FETCH_TIMEOUT = 30000;

/** Default animation duration in ms */
export const ANIMATION_DURATION = 300;

/** Default expressions the AI can use */
export const DEFAULT_EXPRESSIONS = [
    'admiration',
    'amusement',
    'anger',
    'annoyance',
    'approval',
    'caring',
    'confusion',
    'curiosity',
    'desire',
    'disappointment',
    'disapproval',
    'disgust',
    'embarrassment',
    'excitement',
    'fear',
    'gratitude',
    'grief',
    'joy',
    'love',
    'nervousness',
    'optimism',
    'pride',
    'realization',
    'relief',
    'remorse',
    'sadness',
    'surprise',
    'neutral',
];

// =============================================================================
// EXPRESSION CLASSIFICATION API
// =============================================================================

/**
 * Available APIs for expression classification
 * @enum {number}
 */
export const EXPRESSION_API = {
    /** Local BERT classifier (transformers.js) */
    local: 0,
    /** SillyTavern Extras server */
    extras: 1,
    /** LLM-based classification (uses current chat API) */
    llm: 2,
    /** WebLLM browser-based classification */
    webllm: 3,
    /** VectHare semantic classification (bonus - if installed) */
    vecthare: 4,
    /** No classification - use fallback only */
    none: 99,
};

/**
 * LLM prompt types for expression classification
 * @enum {string}
 */
export const PROMPT_TYPE = {
    /** Raw prompt - just the text and instruction */
    raw: 'raw',
    /** Full prompt - uses chat context */
    full: 'full',
};

/** Default LLM prompt for expression classification */
export const DEFAULT_LLM_PROMPT = 'Classify the emotion of the last message. Output just one word. Choose only one: {{labels}}';

// =============================================================================
// CLASSIFIER MODELS
// =============================================================================

/**
 * Available emotion classifier models
 * Users can mirror these to their own HuggingFace for reliability
 */
export const CLASSIFIER_MODELS = {
    /** RoBERTa GoEmotions - high quality 28 labels */
    roberta_go_emotions: {
        id: 'roberta_go_emotions',
        name: 'RoBERTa GoEmotions',
        repo: 'Chi-Bi/roberta-go-emotions-onnx',
        labels: 28,
        labelList: ['admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness', 'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise', 'neutral'],
        f1: 0.54,
        description: 'High quality RoBERTa model. 28 GoEmotions labels with good accuracy.',
    },
    /** MicahB DistilRoBERTa - trained on dialogue (7 labels) */
    distilroberta_dialogue: {
        id: 'distilroberta_dialogue',
        name: 'DistilRoBERTa Dialogue',
        repo: 'Chi-Bi/emotion-text-classifier-onnx',
        labels: 7,
        labelList: ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise'],
        f1: 0.815,
        description: 'Trained on dialogue/conversation. 7 Ekman emotions. Great for RP chat.',
    },
    /** boltuix BERT - 13 labels with RP-specific emotions */
    bert_emotion_rp: {
        id: 'bert_emotion_rp',
        name: 'BERT Emotion (RP)',
        repo: 'Chi-Bi/bert-emotion-onnx',
        labels: 13,
        labelList: ['anger', 'disgust', 'fear', 'guilt', 'joy', 'love', 'sadness', 'shame', 'surprise', 'desire', 'sarcasm', 'neutral', 'embarrassment'],
        f1: 0.93,
        description: '13 labels including sarcasm, shame, guilt, desire. Perfect for roleplay.',
    },
    /** bhadresh-savani DistilBERT - 6 labels, highest accuracy */
    distilbert_high_accuracy: {
        id: 'distilbert_high_accuracy',
        name: 'DistilBERT (Highest Accuracy)',
        repo: 'Chi-Bi/distilbert-emotion-onnx',
        labels: 6,
        labelList: ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise'],
        f1: 0.938,
        description: '6 basic emotions with highest accuracy (F1: 0.938). Simple but reliable.',
    },
    /** tae898 EmoBERTa - dialogue emotion recognition */
    emoberta_dialogue: {
        id: 'emoberta_dialogue',
        name: 'EmoBERTa Large',
        repo: 'Chi-Bi/emoberta-large-onnx',
        labels: 7,
        labelList: ['neutral', 'joy', 'surprise', 'anger', 'sadness', 'disgust', 'fear'],
        f1: 0.656,
        description: 'Large RoBERTa model trained on dialogue emotion recognition.',
    },
};

/** Default classifier model */
export const DEFAULT_CLASSIFIER_MODEL = 'roberta_go_emotions';

// =============================================================================
// EMOTION PRESETS (for VectHare/LLM mode)
// =============================================================================

/**
 * Pre-configured emotion packs for users to choose from
 * Each pack has a curated set of emotions with default keywords
 */
export const EMOTION_PRESETS = {
    /** Basic 6 - Ekman's universal emotions */
    basic_6: {
        id: 'basic_6',
        name: 'Basic 6',
        description: 'Ekman\'s universal emotions - simple and reliable',
        emotions: {
            joy: { keywords: { 'happy': 1.5, 'smile': 1.3, 'laugh': 1.4, 'excited': 1.3 } },
            sadness: { keywords: { 'sad': 1.5, 'cry': 1.4, 'tears': 1.3, 'upset': 1.3 } },
            anger: { keywords: { 'angry': 1.5, 'furious': 1.6, 'mad': 1.4, 'rage': 1.5 } },
            fear: { keywords: { 'scared': 1.5, 'afraid': 1.4, 'terrified': 1.6, 'panic': 1.4 } },
            surprise: { keywords: { 'surprised': 1.5, 'shocked': 1.4, 'wow': 1.2, 'unexpected': 1.3 } },
            neutral: { keywords: { 'calm': 1.2, 'normal': 1.1 } },
        },
    },
    /** Extended 12 - Common emotions for general use */
    extended_12: {
        id: 'extended_12',
        name: 'Extended 12',
        description: 'Well-rounded set covering most situations',
        emotions: {
            joy: { keywords: { 'happy': 1.5, 'smile': 1.3, 'laugh': 1.4 } },
            sadness: { keywords: { 'sad': 1.5, 'cry': 1.4, 'tears': 1.3 } },
            anger: { keywords: { 'angry': 1.5, 'furious': 1.6, 'mad': 1.4 } },
            fear: { keywords: { 'scared': 1.5, 'afraid': 1.4, 'terrified': 1.6 } },
            surprise: { keywords: { 'surprised': 1.5, 'shocked': 1.4 } },
            disgust: { keywords: { 'disgusted': 1.5, 'gross': 1.3, 'eww': 1.4 } },
            love: { keywords: { 'love': 1.5, 'adore': 1.4, 'heart': 1.2 } },
            embarrassment: { keywords: { 'embarrassed': 1.5, 'blush': 1.4, 'flustered': 1.4 } },
            confusion: { keywords: { 'confused': 1.5, 'puzzled': 1.3, 'huh': 1.2 } },
            excitement: { keywords: { 'excited': 1.5, 'thrilled': 1.4, 'eager': 1.3 } },
            nervousness: { keywords: { 'nervous': 1.5, 'anxious': 1.4, 'worried': 1.3 } },
            neutral: { keywords: { 'calm': 1.2 } },
        },
    },
    /** Roleplay 18 - Emotions common in RP/fiction */
    roleplay_18: {
        id: 'roleplay_18',
        name: 'Roleplay 18',
        description: 'Curated for roleplay and creative writing',
        emotions: {
            joy: { keywords: { 'happy': 1.5, 'smile': 1.3, 'grin': 1.3 } },
            sadness: { keywords: { 'sad': 1.5, 'cry': 1.4, 'tears': 1.3 } },
            anger: { keywords: { 'angry': 1.5, 'furious': 1.6 } },
            fear: { keywords: { 'scared': 1.5, 'terrified': 1.6 } },
            surprise: { keywords: { 'surprised': 1.5, 'shocked': 1.4 } },
            love: { keywords: { 'love': 1.5, 'adore': 1.4, 'heart': 1.3 } },
            embarrassment: { keywords: { 'embarrassed': 1.5, 'blush': 1.5, 'flustered': 1.4 } },
            desire: { keywords: { 'desire': 1.5, 'want': 1.2, 'longing': 1.4 } },
            smug: { keywords: { 'smug': 1.6, 'smirk': 1.5, 'confident': 1.3 } },
            teasing: { keywords: { 'tease': 1.5, 'playful': 1.3, 'mischief': 1.4 } },
            shy: { keywords: { 'shy': 1.5, 'timid': 1.4, 'meek': 1.3 } },
            pouty: { keywords: { 'pout': 1.5, 'sulk': 1.4, 'hmph': 1.4 } },
            curiosity: { keywords: { 'curious': 1.5, 'interested': 1.3, 'intrigued': 1.4 } },
            annoyance: { keywords: { 'annoyed': 1.5, 'irritated': 1.4, 'ugh': 1.3 } },
            excitement: { keywords: { 'excited': 1.5, 'thrilled': 1.4 } },
            nervousness: { keywords: { 'nervous': 1.5, 'anxious': 1.4 } },
            determination: { keywords: { 'determined': 1.5, 'resolve': 1.4, 'focused': 1.3 } },
            neutral: { keywords: { 'calm': 1.2 } },
        },
    },
    /** NSFW 14 - For adult content */
    nsfw_14: {
        id: 'nsfw_14',
        name: 'NSFW 14',
        description: 'Adult-oriented emotion set',
        emotions: {
            joy: { keywords: { 'happy': 1.5, 'smile': 1.3 } },
            love: { keywords: { 'love': 1.5, 'adore': 1.4 } },
            desire: { keywords: { 'desire': 1.6, 'want': 1.3, 'lust': 1.6, 'aroused': 1.5 } },
            embarrassment: { keywords: { 'embarrassed': 1.5, 'blush': 1.5, 'flustered': 1.4 } },
            pleasure: { keywords: { 'pleasure': 1.6, 'moan': 1.5, 'gasp': 1.4 } },
            shy: { keywords: { 'shy': 1.5, 'timid': 1.4 } },
            teasing: { keywords: { 'tease': 1.5, 'playful': 1.3 } },
            smug: { keywords: { 'smug': 1.5, 'smirk': 1.4 } },
            surprise: { keywords: { 'surprised': 1.5, 'shocked': 1.4 } },
            submission: { keywords: { 'submit': 1.5, 'obey': 1.4, 'please': 1.2 } },
            dominance: { keywords: { 'command': 1.5, 'dominate': 1.5, 'control': 1.4 } },
            exhausted: { keywords: { 'exhausted': 1.5, 'tired': 1.3, 'spent': 1.4 } },
            bliss: { keywords: { 'bliss': 1.5, 'ecstasy': 1.5, 'heaven': 1.3 } },
            neutral: { keywords: { 'calm': 1.2 } },
        },
    },
    /** Anime 16 - Common anime expressions */
    anime_16: {
        id: 'anime_16',
        name: 'Anime 16',
        description: 'Classic anime/manga expression tropes',
        emotions: {
            joy: { keywords: { 'happy': 1.5, 'yay': 1.4, 'smile': 1.3 } },
            anger: { keywords: { 'angry': 1.5, 'rage': 1.5 } },
            embarrassment: { keywords: { 'blush': 1.6, 'embarrassed': 1.5, 'kyaa': 1.4 } },
            shock: { keywords: { 'shocked': 1.6, 'ehh': 1.4, 'nani': 1.5 } },
            smug: { keywords: { 'smug': 1.6, 'heh': 1.4, 'smirk': 1.5 } },
            determined: { keywords: { 'determined': 1.5, 'yosh': 1.4 } },
            tsundere: { keywords: { 'baka': 1.6, 'idiot': 1.3, 'not like': 1.4 } },
            sparkle: { keywords: { 'sparkle': 1.5, 'amazing': 1.3, 'beautiful': 1.3 } },
            deadpan: { keywords: { 'deadpan': 1.5, 'blank': 1.3, 'stare': 1.3 } },
            crying: { keywords: { 'cry': 1.5, 'tears': 1.4, 'waaah': 1.5 } },
            tired: { keywords: { 'tired': 1.5, 'sleepy': 1.4, 'exhausted': 1.4 } },
            curious: { keywords: { 'curious': 1.5, 'hmm': 1.3, 'interesting': 1.3 } },
            love: { keywords: { 'love': 1.5, 'doki': 1.5, 'heart': 1.3 } },
            scared: { keywords: { 'scared': 1.5, 'eek': 1.4, 'hide': 1.3 } },
            pout: { keywords: { 'pout': 1.5, 'muu': 1.4, 'sulk': 1.4 } },
            neutral: { keywords: { 'calm': 1.2 } },
        },
    },
    /** GoEmotions 28 - Full BERT model set */
    go_emotions_28: {
        id: 'go_emotions_28',
        name: 'GoEmotions 28',
        description: 'Full 28-label set matching RoBERTa GoEmotions',
        emotions: {
            admiration: { keywords: { 'admire': 1.5, 'respect': 1.3, 'impressed': 1.4 } },
            amusement: { keywords: { 'amused': 1.5, 'funny': 1.4, 'lol': 1.3 } },
            anger: { keywords: { 'angry': 1.5, 'mad': 1.4, 'furious': 1.5 } },
            annoyance: { keywords: { 'annoyed': 1.5, 'irritated': 1.4 } },
            approval: { keywords: { 'approve': 1.5, 'agree': 1.3, 'yes': 1.2 } },
            caring: { keywords: { 'care': 1.5, 'concern': 1.3, 'worry about': 1.3 } },
            confusion: { keywords: { 'confused': 1.5, 'puzzled': 1.4 } },
            curiosity: { keywords: { 'curious': 1.5, 'wonder': 1.3 } },
            desire: { keywords: { 'desire': 1.5, 'want': 1.3 } },
            disappointment: { keywords: { 'disappointed': 1.5, 'let down': 1.4 } },
            disapproval: { keywords: { 'disapprove': 1.5, 'disagree': 1.3 } },
            disgust: { keywords: { 'disgusted': 1.5, 'gross': 1.4 } },
            embarrassment: { keywords: { 'embarrassed': 1.5, 'blush': 1.4 } },
            excitement: { keywords: { 'excited': 1.5, 'thrilled': 1.4 } },
            fear: { keywords: { 'afraid': 1.5, 'scared': 1.5 } },
            gratitude: { keywords: { 'grateful': 1.5, 'thank': 1.3 } },
            grief: { keywords: { 'grief': 1.5, 'mourn': 1.5, 'loss': 1.4 } },
            joy: { keywords: { 'happy': 1.5, 'joy': 1.4 } },
            love: { keywords: { 'love': 1.5, 'adore': 1.4 } },
            nervousness: { keywords: { 'nervous': 1.5, 'anxious': 1.4 } },
            optimism: { keywords: { 'optimistic': 1.5, 'hopeful': 1.4 } },
            pride: { keywords: { 'proud': 1.5, 'pride': 1.4 } },
            realization: { keywords: { 'realize': 1.5, 'understand': 1.3, 'oh': 1.2 } },
            relief: { keywords: { 'relieved': 1.5, 'phew': 1.4 } },
            remorse: { keywords: { 'sorry': 1.5, 'regret': 1.4 } },
            sadness: { keywords: { 'sad': 1.5, 'unhappy': 1.4 } },
            surprise: { keywords: { 'surprised': 1.5, 'shocked': 1.4 } },
            neutral: { keywords: { 'calm': 1.2 } },
        },
    },
    /** Empty - Start from scratch */
    empty: {
        id: 'empty',
        name: 'Start Empty',
        description: 'No preset emotions - build your own from scratch',
        emotions: {},
    },
};

/** Special fallback options */
export const FALLBACK_OPTIONS = {
    /** No fallback - leave blank */
    NONE: '#none',
    /** Emoji-based fallback */
    EMOJI: '#emoji',
};

/**
 * When to trigger VectHare classification
 * @enum {string}
 */
export const VECTHARE_TRIGGER = {
    /** Classify after AI response is complete */
    after_response: 'after_response',
    /** Classify before user message is sent (on previous AI message) */
    before_send: 'before_send',
};

/**
 * Emotion descriptions for semantic matching
 * Maps emotion labels to descriptive text for better embedding similarity
 */
export const EMOTION_DESCRIPTIONS = {
    admiration: 'feeling admiration, respect, awe, impressed, looking up to someone',
    amusement: 'feeling amused, entertained, finding something funny, laughing',
    anger: 'feeling angry, mad, furious, enraged, irritated',
    annoyance: 'feeling annoyed, bothered, irritated, frustrated',
    approval: 'feeling approval, agreement, acceptance, nodding along',
    caring: 'feeling caring, nurturing, protective, wanting to help',
    confusion: 'feeling confused, puzzled, bewildered, not understanding',
    curiosity: 'feeling curious, interested, wanting to know more, intrigued',
    desire: 'feeling desire, longing, wanting, craving',
    disappointment: 'feeling disappointed, let down, unsatisfied',
    disapproval: 'feeling disapproval, disagreement, rejection, shaking head',
    disgust: 'feeling disgusted, repulsed, revolted, grossed out',
    embarrassment: 'feeling embarrassed, ashamed, self-conscious, blushing',
    excitement: 'feeling excited, thrilled, eager, pumped up',
    fear: 'feeling afraid, scared, frightened, terrified',
    gratitude: 'feeling grateful, thankful, appreciative',
    grief: 'feeling grief, mourning, deep sadness, loss',
    joy: 'feeling joyful, happy, delighted, elated',
    love: 'feeling love, affection, adoration, deep caring',
    nervousness: 'feeling nervous, anxious, worried, on edge',
    optimism: 'feeling optimistic, hopeful, positive about the future',
    pride: 'feeling proud, accomplished, satisfied with achievement',
    realization: 'having a realization, understanding something, epiphany',
    relief: 'feeling relieved, weight lifted, tension released',
    remorse: 'feeling remorse, regret, sorry for something done',
    sadness: 'feeling sad, unhappy, down, melancholy',
    surprise: 'feeling surprised, shocked, astonished, unexpected',
    neutral: 'feeling neutral, calm, balanced, no strong emotion',
};

// =============================================================================
// EFFECTS
// =============================================================================

/** @enum {string} Available sprite effects */
export const SPRITE_EFFECTS = {
    NONE: 'none',
    HEARTS: 'hearts',
    SPARKLE: 'sparkle',
    SWEAT_DROP: 'sweat_drop',
    ANGER_VEIN: 'anger_vein',
    BLUSH: 'blush',
    TEARS: 'tears',
    SHOCK: 'shock',
};

// =============================================================================
// TRANSITIONS
// =============================================================================

/** @enum {string} Transition types for sprites and backgrounds */
export const TRANSITION_TYPE = {
    NONE: 'none',
    FADE: 'fade',
    DISSOLVE: 'dissolve',
    SLIDE_LEFT: 'slide_left',
    SLIDE_RIGHT: 'slide_right',
};

/** Default transition duration in milliseconds */
export const DEFAULT_TRANSITION_DURATION = 300;

/** Sprite transition duration */
export const SPRITE_TRANSITION_DURATION = 200;

/** Background transition duration */
export const BACKGROUND_TRANSITION_DURATION = 500;

// =============================================================================
// DIALOGUE BOX
// =============================================================================

/** @enum {string} Dialogue box positions */
export const DIALOGUE_POSITION = {
    BOTTOM: 'bottom',
    TOP: 'top',
};

/** Default dialogue box opacity (0-100) */
export const DEFAULT_DIALOGUE_OPACITY = 85;

/** Typewriter effect speed (ms per character) */
export const DEFAULT_TYPEWRITER_SPEED = 30;

// =============================================================================
// RESPONSE SCHEMA
// =============================================================================

/** JSON schema fields we expect from AI responses */
export const SCHEMA_FIELDS = {
    NARRATIVE: 'narrative',
    SPEAKER: 'speaker',
    EXPRESSION: 'expression',
    SCENE: 'scene',
    CHOICES: 'choices',
    AUDIO: 'audio',
};

// =============================================================================
// UI CLASSES
// =============================================================================

/** CSS class prefix for all Cotton-Tales elements */
export const CSS_PREFIX = 'ct';

/** Z-index values for layering */
export const Z_INDEX = {
    BACKGROUND: 1,
    SPRITES: 10,
    EFFECTS: 20,
    DIALOGUE_BOX: 100,
    CHOICES: 110,
    OVERLAY: 200,
    MODAL: 300,
};

// =============================================================================
// SETTINGS KEYS
// =============================================================================

/** Settings storage key in extension_settings */
export const SETTINGS_KEY = 'cottonTales';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Fetch with timeout - wraps fetch with AbortController timeout
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in ms (default: FETCH_TIMEOUT)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}
