// API Configuration
const API_BASE_URL = 'https://vestro-lz81.onrender.com';

// Rate limiting constants
const MINES_MAX_RETRIES = 3;
const MINES_REVEAL_DELAY_MS = 300;
const MINES_RATE_LIMIT_DELAY_MS = 1000;

// Animation constants
const ANIMATION_DURATION = 600;
const CHART_ANIMATION_DURATION = 300;

// Game constants
const MINES_GRID_SIZE = 25;
const MINES_MIN_COUNT = 1;
const MINES_MAX_COUNT = 24;

// UI constants
const NOTIFICATION_DURATION = 5000;
const CHART_POINTS_LIMIT = 100;

// Colors
const COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4',
    background: '#1f2937',
    surface: '#374151'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_BASE_URL,
        MINES_MAX_RETRIES,
        MINES_REVEAL_DELAY_MS,
        MINES_RATE_LIMIT_DELAY_MS,
        ANIMATION_DURATION,
        CHART_ANIMATION_DURATION,
        MINES_GRID_SIZE,
        MINES_MIN_COUNT,
        MINES_MAX_COUNT,
        NOTIFICATION_DURATION,
        CHART_POINTS_LIMIT,
        COLORS
    };
} 