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
const NOTIFICATION_DURATION = 5100;
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

// Client-side badge definitions
const CLIENT_BADGES = [
    {
        code: 'first_win',
        name: 'First Win',
        description: 'Win your first game',
        icon: 'target',
        color: '#10b981',
        criteria: { type: 'wins', value: 1 }
    },
    {
        code: 'novice',
        name: 'Novice Gambler',
        description: 'Reach level 5',
        icon: 'star',
        color: '#10b981',
        criteria: { type: 'level', value: 5 }
    },
    {
        code: 'intermediate',
        name: 'Intermediate Gambler',
        description: 'Reach level 25',
        icon: 'stars',
        color: '#3b82f6',
        criteria: { type: 'level', value: 25 }
    },
    {
        code: 'expert',
        name: 'Expert Gambler',
        description: 'Reach level 50',
        icon: 'award',
        color: '#8b5cf6',
        criteria: { type: 'level', value: 50 }
    },
    {
        code: 'master',
        name: 'Master Gambler',
        description: 'Reach level 100',
        icon: 'crown',
        color: '#f59e0b',
        criteria: { type: 'level', value: 100 }
    },
    {
        code: 'winner',
        name: 'Winner',
        description: 'Win 10 games',
        icon: 'trophy',
        color: '#10b981',
        criteria: { type: 'wins', value: 10 }
    },
    {
        code: 'champion',
        name: 'Champion',
        description: 'Win 100 games',
        icon: 'medal',
        color: '#3b82f6',
        criteria: { type: 'wins', value: 100 }
    },
    {
        code: 'legend',
        name: 'Legend',
        description: 'Win 1000 games',
        icon: 'flame',
        color: '#8b5cf6',
        criteria: { type: 'wins', value: 1000 }
    },
    {
        code: 'millionaire',
        name: 'Millionaire',
        description: 'Reach a balance of $1,000,000',
        icon: 'diamond',
        color: '#f59e0b',
        criteria: { type: 'balance', value: 1000000 }
    },
    {
        code: 'dedicated',
        name: 'Dedicated Player',
        description: 'Play 1000 games',
        icon: 'target',
        color: '#10b981',
        criteria: { type: 'games', value: 1000 }
    },
    {
        code: 'highroller',
        name: 'High Roller',
        description: 'Place a bet of $10,000 or more',
        icon: 'trending-up',
        color: '#3b82f6',
        criteria: { type: 'bet', value: 10000 }
    },
    {
        code: 'streak_master',
        name: 'Streak Master',
        description: 'Win 5 games in a row',
        icon: 'zap',
        color: '#8b5cf6',
        criteria: { type: 'winstreak', value: 5 }
    },
    {
        code: 'meme_lord',
        name: 'Meme Lord',
        description: 'Place a bet of exactly $69,420',
        icon: 'sparkles',
        color: '#f59e0b',
        secret: true,
        criteria: { type: 'specific', value: 69420 }
    }
];

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
        COLORS,
        CLIENT_BADGES
    };
}        