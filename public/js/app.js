// Global variables
let currentUser = null;
let socket = null;
let currentPage = 'login';

// Matter.js physics global variables
let engine = null;
let runner = null;
let MatterModules = {};
if (typeof Matter !== 'undefined') {
    const { Engine, World, Bodies, Body, Events, Runner } = Matter;
    MatterModules = { Engine, World, Bodies, Body, Events, Runner };
}

// Mines game state
let minesPattern = {
    selectedTiles: new Set(),
    isPatternMode: false
};



// API Base URL - use Render backend for both dev and prod
const API_BASE_URL = 'https://vestro-lz81.onrender.com';

// Global variables for chart
let chartOffset = 0;
let pointsToShow = 50;
let isDragging = false;
let dragStartX = 0;
let dragStartOffset = 0;
let dragVelocity = 0;
let lastDragTime = 0;
let lastDragX = 0;
let activePoint = null;

// Auto bet state
let isAutoBetting = false;
let autoBetCount = 0;
let initialBetAmount = 0;
let startingBalance = 0;
let totalProfit = 0;
let autoBetConfig = {
    infiniteMode: false,
    targetBets: 10,
    stopWin: 0,
    stopLoss: 0,
    stopBalanceGain: 0,
    stopBalanceLoss: 0,
    onWin: {
        action: 'reset',
        multiplier: 2.0
    },
    onLoss: {
        action: 'reset',
        multiplier: 2.0
    }
};

// Client-side badge definitions
const CLIENT_BADGES = [
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

// Add global debounce timer for username checks
let checkUserDebounce = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Initialize Plinko if on plinko page
    if (window.location.hash === '#plinko-game') {
        setTimeout(() => {
            initializePlinko();
        }, 500);
    }

// Rate limiting for game requests
const requestLimiter = {
    lastRequestTime: 0,
    minInterval: 500, // minimum time between requests in ms
    canMakeRequest() {
        const now = Date.now();
        if (now - this.lastRequestTime < this.minInterval) {
            return false;
        }
        this.lastRequestTime = now;
        return true;
    }
};
});

function initializeApp() {
    // Initialize Lucide icons first
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchUserProfile();
    } else {
        showLoginPage();
    }

    // Initialize socket connection
    if (typeof io !== 'undefined') {
        socket = io(API_BASE_URL);
        
        socket.on('connect', () => {
            console.log('Connected to server');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    // Add login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Add username input handler for live indicator with debounce
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', () => {
            clearTimeout(checkUserDebounce);
            checkUserDebounce = setTimeout(() => {
                checkUserExists();
            }, 600); // 600ms debounce
        });
    }

    // Initialize dice game
    initializeDiceGame();

    // Add resize event listener for chart
    window.addEventListener('resize', () => {
        if (currentUser) {
            setTimeout(() => {
                drawBalanceChart();
            }, 100);
        }
    });

    initializeChart();
    initializeMobileMenu();
}

function showLoginPage() {
    // Hide sidebar and main content, show login
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('top-bar').classList.add('hidden');
    document.getElementById('login-page').classList.remove('hidden');
    
    // Hide all other pages
    const pages = ['dashboard-page', 'games-page', 'trades-page', 'marketplace-page', 'profile-page', 'coinflip-game-page', 'dice-game-page'];
    pages.forEach(page => {
        const pageElement = document.getElementById(page);
        if (pageElement) {
            pageElement.classList.add('hidden');
        }
    });
    
    currentPage = 'login';
}

function hideLoginPage() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('top-bar').classList.remove('hidden');
    
    // Reinitialize icons when showing sidebar
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 50);
    }
    
    showPage('dashboard');
}

async function checkUserExists() {
    const username = document.getElementById('username').value;
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    if (username.length < 3) {
        statusIndicator.classList.add('hidden');
        return;
    }
    
    if (!authRequestLimiter.canMakeRequest('check')) {
        statusIndicator.classList.remove('hidden');
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = '⚠ Please wait before checking again...';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/check-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username })
        });

        // Handle rate limiting
        if (response.status === 429) {
            authRequestLimiter.handleTooManyRequests();
            statusIndicator.classList.remove('hidden');
            statusIndicator.className = 'status-indicator error';
            statusText.textContent = '⚠ Too many attempts – please wait…';
            return;
        }

        // Ensure we only parse JSON if the response is JSON
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Non-JSON response');
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Invalid server response');
        }
        
        statusIndicator.classList.remove('hidden');
        if (data.exists) {
            statusIndicator.className = 'status-indicator login';
            statusText.textContent = 'User exists - will log in';
        } else {
            statusIndicator.className = 'status-indicator create';
            statusText.textContent = 'New user - will create account';
        }
    } catch (error) {
        console.error('❌ Error checking user:', error);
        statusIndicator.classList.remove('hidden');
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = '⚠ ' + (error.message || 'Connection error - please try again');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    if (!authRequestLimiter.canMakeRequest('login')) {
        showError('Please wait a moment before trying to log in again.');
        return;
    }
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const button = e.target.querySelector('button[type="submit"]');
    const buttonText = button.querySelector('span');
    
    // Show loading state
    buttonText.textContent = 'Connecting...';
    button.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        // Handle rate limiting
        if (response.status === 429) {
            authRequestLimiter.handleTooManyRequests();
            throw new Error('Too many login attempts. Please wait a few seconds and try again.');
        }

        // Ensure we only parse JSON if the response is JSON
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Invalid server response. Please try again.');
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Invalid server response. Please try again.');
        }

        if (data.success) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            hideLoginPage();
            updateUserInterface();
            // Check for any badges that should be awarded on login
            checkBadges();
            updateBadges();
        } else {
            showError(data.message || 'Login failed');
        }
    } catch (error) {
        showError(error.message || 'Connection error. Please try again.');
        console.error('❌ Login error:', error);
    } finally {
        buttonText.textContent = 'Continue';
        button.disabled = false;
    }
}

async function fetchUserProfile(skipHide = false) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            if (!skipHide) {
            hideLoginPage();
            }
            updateUserInterface();
        } else {
            localStorage.removeItem('token');
            showLoginPage();
        }
    } catch (error) {
        console.error('Profile fetch error:', error);
        localStorage.removeItem('token');
        showLoginPage();
    }
}

function updateUserInterface() {
    if (!currentUser) return;

    // Update all user-related elements with animations
    const balanceElement = document.getElementById('top-balance');
    if (balanceElement) {
        animateNumber(balanceElement, currentUser.balance, 600, '$');
    }

    // Update other elements
    const elements = {
        'welcome-username': currentUser.username,
        'top-username': currentUser.username,
        'top-level': currentUser.level,
        'top-avatar': currentUser.username.charAt(0).toUpperCase(),
        'profile-username': currentUser.username,
        'profile-level': currentUser.level,
        'profile-balance': `$${formatNumber(currentUser.balance)}`,
        'profile-games-played': currentUser.gamesPlayed,
        'profile-total-won': `$${formatNumber(currentUser.totalWon)}`,
        'profile-avatar': currentUser.username.charAt(0).toUpperCase(),
        'profile-win-rate': `${((currentUser.wins / (currentUser.wins + currentUser.losses || 1)) * 100).toFixed(1)}%`,
        'profile-best-win': `$${formatNumber(currentUser.bestWin)}`,
        'profile-best-streak': currentUser.bestWinStreak
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Update XP bars
    updateXPBar();
    updateProfileXPBar();

    // Update chart data with animations
    updateChart();
}

function getRequiredXP(level) {
    // Base 50 XP + 10 XP per level
    return 50 + (level * 10);
}

// Calculate total XP needed to reach a specific level
function getTotalXPForLevel(level) {
    let totalXP = 0;
    for (let i = 1; i <= level; i++) {
        totalXP += getRequiredXP(i);
    }
    return totalXP;
}

function updateXPBar() {
    const currentXPElement = document.getElementById('current-xp');
    const requiredXPElement = document.getElementById('required-xp');
    const xpFillElement = document.getElementById('xp-fill');
    
    if (currentUser && currentXPElement && requiredXPElement && xpFillElement) {
        const xpForNextLevel = getRequiredXP(currentUser.level); // XP needed for current level
        const currentXP = currentUser.experience; // Raw XP from database
        
        // Fix: Handle case where XP equals required XP (should level up)
        const xpPercentage = Math.min(100, Math.max(0, (currentXP / xpForNextLevel) * 100));
        
        // Animate the XP number
        animateNumber(currentXPElement, currentXP, 600);
        requiredXPElement.textContent = xpForNextLevel;
        
        // Smoothly animate the XP bar
        requestAnimationFrame(() => {
            xpFillElement.style.transition = 'width 0.6s ease-out';
            xpFillElement.style.width = xpPercentage + '%';
        });
    }
}

function updateProfileXPBar() {
    const currentXPElement = document.getElementById('profile-current-xp');
    const requiredXPElement = document.getElementById('profile-required-xp');
    const xpFillElement = document.getElementById('profile-xp-fill');
    
    if (currentUser && currentXPElement && requiredXPElement && xpFillElement) {
        const xpForNextLevel = getRequiredXP(currentUser.level); // XP needed for current level
        const currentXP = currentUser.experience; // Raw XP from database
        
        // Fix: Handle case where XP equals required XP (should level up)
        const xpPercentage = Math.min(100, Math.max(0, (currentXP / xpForNextLevel) * 100));
        
        // Animate the XP number
        animateNumber(currentXPElement, currentXP, 600);
        requiredXPElement.textContent = xpForNextLevel;
        
        // Smoothly animate the XP bar
        requestAnimationFrame(() => {
            xpFillElement.style.transition = 'width 0.6s ease-out';
            xpFillElement.style.width = xpPercentage + '%';
        });
    }
}

// Client-side badge checking
function checkBadges(betAmount = 0) {
    if (!currentUser) return [];
    
    const earnedBadges = JSON.parse(localStorage.getItem(`badges_${currentUser.username}`) || '[]');
    const newBadges = [];
    
    for (const badge of CLIENT_BADGES) {
        // Skip if already earned
        if (earnedBadges.some(b => b.code === badge.code)) continue;
        
        let earned = false;
        switch (badge.criteria.type) {
            case 'level':
                earned = currentUser.level >= badge.criteria.value;
                break;
            case 'wins':
                earned = currentUser.wins >= badge.criteria.value;
                break;
            case 'balance':
                earned = currentUser.balance >= badge.criteria.value;
                break;
            case 'games':
                earned = currentUser.gamesPlayed >= badge.criteria.value;
                break;
            case 'bet':
                earned = betAmount >= badge.criteria.value;
                break;
            case 'winstreak':
                earned = currentUser.currentWinStreak >= badge.criteria.value;
                break;
            case 'specific':
                earned = betAmount === badge.criteria.value;
                break;
        }
        
        if (earned) {
            const earnedBadge = {
                ...badge,
                earnedAt: new Date().toISOString()
            };
            earnedBadges.push(earnedBadge);
            newBadges.push(earnedBadge);
        }
    }
    
    // Save updated badges to localStorage
    localStorage.setItem(`badges_${currentUser.username}`, JSON.stringify(earnedBadges));
    
    return newBadges;
}

function updateBadges() {
    const badgesGrid = document.getElementById('badges-grid');
    if (!badgesGrid || !currentUser) return;

    badgesGrid.innerHTML = '';
    
    const earnedBadges = JSON.parse(localStorage.getItem(`badges_${currentUser.username}`) || '[]');
    const earnedCodes = new Set(earnedBadges.map(b => b.code));
    
    // Sort badges: earned first, then non-secret locked, then secret
    const sortedBadges = CLIENT_BADGES.sort((a, b) => {
        const aEarned = earnedCodes.has(a.code);
        const bEarned = earnedCodes.has(b.code);
        
        if (aEarned && !bEarned) return -1;
        if (!aEarned && bEarned) return 1;
        
        if (a.secret && !b.secret) return 1;
        if (!a.secret && b.secret) return -1;
        
        return a.name.localeCompare(b.name);
    });

    sortedBadges.forEach(badge => {
        const isEarned = earnedCodes.has(badge.code);
        const earnedBadgeData = earnedBadges.find(b => b.code === badge.code);
        
        // Show all badges including hidden ones
        const badgeElement = document.createElement('div');
        badgeElement.className = `badge-item${badge.secret ? ' secret' : ''}${isEarned ? ' earned' : ' locked'}`;
        
        let earnedText = isEarned 
            ? `Earned ${new Date(earnedBadgeData.earnedAt).toLocaleDateString()}`
            : 'Not earned yet';
        
        // For hidden badges that are not earned, show as "???"
        const displayName = badge.secret && !isEarned ? '???' : badge.name;
        const displayDescription = badge.secret && !isEarned ? 'Hidden badge' : badge.description;
        
        badgeElement.innerHTML = `
            <div class="badge-icon" style="background: ${badge.color}${isEarned ? '20' : '10'};">
                <i data-lucide="${badge.icon}" style="color: ${badge.color};"></i>
            </div>
            <div class="badge-name">${displayName}</div>
            <div class="badge-description">${displayDescription}</div>
            <div class="badge-earned">${earnedText}</div>
        `;
        
        badgesGrid.appendChild(badgeElement);
    });

    // Initialize Lucide icons for the new badge elements
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });

    // Show selected page
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Update active navigation item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNavItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    // Page-specific handling
    if (pageId === 'dashboard' && currentUser) {
        // Fetch fresh profile data to get updated balance history
        fetchUserProfile(true).then(() => {
            setTimeout(() => {
                drawBalanceChart();
                updateBadges(); // Update badges display
            }, 100);
        });
    }
    
    // Initialize dice game when showing dice page
    if (pageId === 'dice-game') {
        setTimeout(() => {
            initializeDiceGame();
        }, 100);
    }
    
    // Initialize Plinko when showing the plinko game page
    if (pageId === 'plinko-game') {
        setTimeout(() => {
            initializePlinko();
        }, 300);
    }
    
    // Initialize Mines when showing the mines game page
    if (pageId === 'mines-game') {
        setTimeout(() => {
            initializeMinesGame();
        }, 100);
    }
    
    // Reinitialize icons after page change
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 50);
    }
    
    // Cleanup Plinko if leaving game
    if (currentPage === 'plinko-game' && pageId !== 'plinko-game') {
        cleanupPlinkoTooltips();
        if (plinkoState.animationId) {
            cancelAnimationFrame(plinkoState.animationId);
            plinkoState.animationId = null;
        }
    }
}

function updateChart() {
    const wins = currentUser.wins || 0;
    const losses = currentUser.losses || 0;
    
    // Update chart stats
    const chartWins = document.getElementById('chart-wins');
    const chartLosses = document.getElementById('chart-losses');
    if (chartWins) chartWins.textContent = wins;
    if (chartLosses) chartLosses.textContent = losses;
    
    // Draw balance history chart
    drawBalanceChart();
}

function drawBalanceChart() {
    const canvas = document.getElementById('balance-chart');
    if (!canvas || !currentUser || !currentUser.balanceHistory || currentUser.balanceHistory.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = 400;
    const padding = 40;
    
    // Get data points with offset
    const allDataPoints = currentUser.balanceHistory;
    const maxOffset = Math.max(0, allDataPoints.length - pointsToShow);
    chartOffset = Math.max(0, Math.min(chartOffset, maxOffset)); // Clamp offset
    
    const startIndex = Math.max(0, allDataPoints.length - pointsToShow - chartOffset);
    const endIndex = allDataPoints.length - chartOffset;
    const dataPoints = allDataPoints.slice(startIndex, endIndex);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set up scales
    const xScale = (width - padding * 2) / Math.max(1, dataPoints.length - 1);
    const minBalance = Math.min(...dataPoints);
    const maxBalance = Math.max(...dataPoints);
    const balanceRange = Math.max(1, maxBalance - minBalance);
    const yScale = (height - padding * 2) / balanceRange;

    // Store point coordinates for hover detection
    canvas.dataPoints = dataPoints.map((value, i) => ({
        x: padding + i * xScale,
        y: height - padding - (value - minBalance) * yScale,
        value: value
    }));
    
    // Draw horizontal grid lines and labels
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height - padding * 2) * (i / 5);
        const value = maxBalance - (balanceRange * (i / 5));
        
        // Format value with K/M for thousands/millions
        let label = value;
        if (value >= 1000000) {
            label = (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            label = (value / 1000).toFixed(1) + 'K';
        } else {
            label = value.toFixed(0);
        }
        ctx.fillText('$' + label, padding - 5, y + 4);
    }
    
    // Draw lines between points with win/loss colors
    for (let i = 1; i < dataPoints.length; i++) {
        const x1 = padding + (i - 1) * xScale;
        const y1 = height - padding - (dataPoints[i - 1] - minBalance) * yScale;
        const x2 = padding + i * xScale;
        const y2 = height - padding - (dataPoints[i] - minBalance) * yScale;
        
        // Determine if this segment represents a win or loss
        const isWin = dataPoints[i] > dataPoints[i - 1];
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isWin ? '#3fb950' : '#f85149';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Draw points
    for (let i = 0; i < dataPoints.length; i++) {
        const x = padding + i * xScale;
        const y = height - padding - (dataPoints[i] - minBalance) * yScale;
        const isWin = i > 0 && dataPoints[i] > dataPoints[i-1];
        const isActive = activePoint === i;
        
        ctx.beginPath();
        ctx.arc(x, y, isActive ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isWin ? '#3fb950' : '#f85149';
        ctx.fill();
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        if (isActive) {
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = isWin ? '#3fb95080' : '#f8514980';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    
    // Add drag indicator if there are more games
    if (allDataPoints.length > pointsToShow) {
        const navY = height - 15;
        ctx.fillStyle = '#8b949e';
        ctx.textAlign = 'center';
        ctx.font = '11px Inter';
        
        // Game range indicator - use rounded values for display
        const displayStartIndex = Math.max(0, allDataPoints.length - pointsToShow - Math.round(chartOffset));
        const displayEndIndex = allDataPoints.length - Math.round(chartOffset);
        
        ctx.fillText(
            `Games ${allDataPoints.length - displayEndIndex + 1} - ${allDataPoints.length - displayStartIndex} of ${allDataPoints.length}`,
            width/2,
            navY
        );
        
        // Drag hint
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Inter';
        ctx.fillText('← Drag to scroll →', width/2, navY + 15);
        
        // Progress indicator
        const progressWidth = width - padding * 2;
        const progressHeight = 3;
        const progressY = height - 35;
        
        // Background
        ctx.fillStyle = '#374151';
        ctx.fillRect(padding, progressY, progressWidth, progressHeight);
        
        // Progress
        const progress = chartOffset / maxOffset;
        const progressBarWidth = progressWidth * (pointsToShow / allDataPoints.length);
        const progressBarX = padding + (progressWidth - progressBarWidth) * (1 - progress);
        
        ctx.fillStyle = '#10b981';
        ctx.fillRect(progressBarX, progressY, progressBarWidth, progressHeight);
    }
}

// Handle mouse/touch events for dragging
function handleChartMouseDown(event) {
    const canvas = document.getElementById('balance-chart');
    if (!canvas || !currentUser || !currentUser.balanceHistory) return;
    
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    dragStartX = event.clientX - rect.left;
    dragStartOffset = chartOffset;
    dragVelocity = 0;
    lastDragTime = Date.now();
    lastDragX = dragStartX;
    
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
}

function handleChartMouseMove(event) {
    const canvas = document.getElementById('balance-chart');
    if (!canvas || !currentUser || !currentUser.balanceHistory) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Handle dragging
    if (isDragging) {
        const currentX = mouseX;
        const deltaX = currentX - dragStartX;
        const currentTime = Date.now();
        
        // Calculate velocity for momentum
        const timeDelta = currentTime - lastDragTime;
        if (timeDelta > 0) {
            dragVelocity = (currentX - lastDragX) / timeDelta;
        }
        lastDragTime = currentTime;
        lastDragX = currentX;
        
        // Calculate new offset based on drag distance
        const maxOffset = Math.max(0, currentUser.balanceHistory.length - pointsToShow);
        const sensitivity = maxOffset / (canvas.width - 80); // Adjust sensitivity
        const newOffset = dragStartOffset - (deltaX * sensitivity);
        
        chartOffset = Math.max(0, Math.min(newOffset, maxOffset));
        drawBalanceChart();
        
        event.preventDefault();
        return;
    }

    // Handle hover effects
    const tooltip = document.querySelector('.price-tooltip');
    if (!canvas.dataPoints) return;

    // Find the closest point
    let minDistance = Infinity;
    let closestPoint = -1;
    
    canvas.dataPoints.forEach((point, index) => {
        const distance = Math.sqrt(
            Math.pow(mouseX - point.x, 2) + 
            Math.pow(mouseY - point.y, 2)
        );
        if (distance < minDistance && distance < 20) {
            minDistance = distance;
            closestPoint = index;
        }
    });

    if (closestPoint !== -1) {
        const point = canvas.dataPoints[closestPoint];
        activePoint = closestPoint;
        
        // Show and position tooltip
        tooltip.style.opacity = '1';
        tooltip.style.left = `${point.x + rect.left}px`;
        tooltip.style.top = `${point.y + rect.top - 30}px`;
        
        // Format the value
        let displayValue = point.value;
        if (displayValue >= 1000000) {
            displayValue = (displayValue / 1000000).toFixed(2) + 'M';
        } else if (displayValue >= 1000) {
            displayValue = (displayValue / 1000).toFixed(2) + 'K';
        } else {
            displayValue = displayValue.toFixed(2);
        }
        
        tooltip.textContent = '$' + displayValue;
        drawBalanceChart();
    } else {
        tooltip.style.opacity = '0';
        if (activePoint !== null) {
            activePoint = null;
            drawBalanceChart();
        }
    }
}

function handleChartMouseUp(event) {
    const canvas = document.getElementById('balance-chart');
    if (!canvas || !isDragging) return;
    
    isDragging = false;
    canvas.style.cursor = 'grab';
    
    // Apply momentum and snap to nearest data point
    if (Math.abs(dragVelocity) > 0.1) {
        animateChartMomentum();
    } else {
        snapToNearestPoint();
    }
    
    event.preventDefault();
}

function animateChartMomentum() {
    const friction = 0.95;
    const minVelocity = 0.1;
    
    function animate() {
        if (Math.abs(dragVelocity) < minVelocity) {
            snapToNearestPoint();
            return;
        }
        
        const maxOffset = Math.max(0, currentUser.balanceHistory.length - pointsToShow);
        const sensitivity = maxOffset / 300; // Adjust momentum sensitivity
        chartOffset -= dragVelocity * sensitivity * 10;
        chartOffset = Math.max(0, Math.min(chartOffset, maxOffset));
        
        dragVelocity *= friction;
        drawBalanceChart();
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

function snapToNearestPoint() {
    const maxOffset = Math.max(0, currentUser.balanceHistory.length - pointsToShow);
    const targetOffset = Math.round(chartOffset);
    
    if (Math.abs(targetOffset - chartOffset) > 0.1) {
        const startOffset = chartOffset;
        const startTime = Date.now();
        const duration = 200;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            
            chartOffset = startOffset + (targetOffset - startOffset) * easeProgress;
            drawBalanceChart();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        animate();
    }
}

// Touch events for mobile
function handleChartTouchStart(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        handleChartMouseDown(mouseEvent);
    }
}

function handleChartTouchMove(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        handleChartMouseMove(mouseEvent);
    }
}

function handleChartTouchEnd(event) {
    const mouseEvent = new MouseEvent('mouseup', {});
    handleChartMouseUp(mouseEvent);
}

function handleChartMouseLeave() {
    const tooltip = document.querySelector('.price-tooltip');
    tooltip.style.opacity = '0';
    if (activePoint !== null) {
        activePoint = null;
        drawBalanceChart();
    }
}

// Initialize chart controls
function initializeChart() {
    const canvas = document.getElementById('balance-chart');
    if (canvas) {
        canvas.style.cursor = 'grab';
        
        // Create tooltip element if it doesn't exist
        if (!document.querySelector('.price-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.className = 'price-tooltip';
            document.body.appendChild(tooltip);
        }
        
        // Mouse events
        canvas.addEventListener('mousedown', handleChartMouseDown);
        document.addEventListener('mousemove', handleChartMouseMove);
        document.addEventListener('mouseup', handleChartMouseUp);
        canvas.addEventListener('mouseleave', handleChartMouseLeave);
        
        // Touch events
        canvas.addEventListener('touchstart', handleChartTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleChartTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleChartTouchEnd, { passive: false });
        
        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
}

// Initialize mobile menu
function initializeMobileMenu() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (!mobileToggle || !sidebar || !overlay) return;
    
    // Toggle mobile menu
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });
    
    // Close menu when clicking overlay
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
    
    // Close menu when clicking nav items
    const navItems = sidebar.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
    });
    
    // Close menu when clicking logout
    const logoutBtn = sidebar.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
    }
}

// Number formatting and animation functions
function formatNumber(num) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function animateNumber(element, newValue, duration = 600, prefix = '') {
    if (!element) return;
    
    const oldValue = parseFloat(element.textContent.replace(/[,$]/g, '')) || 0;
    const difference = newValue - oldValue;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = oldValue + (difference * easeOut);
        
        element.textContent = prefix + formatNumber(currentValue);
        
        // Add flip animation to individual digits
        if (Math.random() < 0.3) {
            element.classList.add('number-flip-digit');
            setTimeout(() => element.classList.remove('number-flip-digit'), 300);
        }
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = prefix + formatNumber(newValue);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// Global variables for dice game
let isRolling = false;
let rollType = 'over';

function initializeDiceGame() {
    // Set initial roll type
    setRollType('over');
    
    // Add slider event listener
    const targetSlider = document.getElementById('dice-target');
    if (targetSlider) {
        targetSlider.addEventListener('input', function() {
            updateDiceStats();
        });
    }
    
    // Add roll type button event listeners as backup
    const overBtn = document.getElementById('roll-over-btn');
    const underBtn = document.getElementById('roll-under-btn');
    
    if (overBtn) {
        overBtn.addEventListener('click', () => setRollType('over'));
    }
    
    if (underBtn) {
        underBtn.addEventListener('click', () => setRollType('under'));
    }
    
    // Initialize stats display
    updateDiceStats();

    // Initialize auto bet functionality
    initializeAutoBet();
    
    // Add auto bet button click handler
    const autoBetBtn = document.getElementById('auto-bet-btn');
    if (autoBetBtn) {
        // Remove any existing event listeners
        autoBetBtn.removeEventListener('click', toggleAutoBetMenu);
        autoBetBtn.addEventListener('click', toggleAutoBetMenu);
    }
}

function toggleAutoBetMenu() {
    const settings = document.getElementById('auto-bet-settings');
    if (settings) {
        settings.classList.toggle('show');
    }
}

function updateDiceStats() {
    const targetValue = parseFloat(document.getElementById('dice-target').value);
    const targetDisplay = document.getElementById('dice-target-value');
    const multiplierDisplay = document.getElementById('dice-multiplier');
    const chanceDisplay = document.getElementById('dice-chance');
    const rollTypeText = document.getElementById('roll-type-text');
    const track = document.querySelector('.slider-track');
    const diceTrack = document.querySelector('.dice-track');
    
    if (targetDisplay) targetDisplay.textContent = targetValue.toFixed(2);
    
    // Update slider position for dynamic colors on both tracks
    const sliderPosition = targetValue + '%';
    if (track) {
        track.style.setProperty('--slider-position', sliderPosition);
    }
    if (diceTrack) {
        diceTrack.style.setProperty('--dice-position', sliderPosition);
    }
    
    let chance;
    if (rollType === 'over') {
        chance = (100 - targetValue) / 100;
        rollTypeText.textContent = 'Roll Over';
        track.classList.remove('under');
        diceTrack.classList.remove('under');
    } else {
        chance = targetValue / 100;
        rollTypeText.textContent = 'Roll Under';
        track.classList.add('under');
        diceTrack.classList.add('under');
    }
    
    // Calculate multiplier (99% RTP)
    const multiplier = (0.99 / chance).toFixed(2);
    
    if (multiplierDisplay) multiplierDisplay.textContent = multiplier + 'x';
    if (chanceDisplay) chanceDisplay.textContent = (chance * 100).toFixed(2) + '%';
}

function setRollType(type) {
    rollType = type;
    
    // Update button states
    const overBtn = document.getElementById('roll-over-btn');
    const underBtn = document.getElementById('roll-under-btn');
    
    if (overBtn && underBtn) {
        if (type === 'over') {
            overBtn.classList.add('active');
            underBtn.classList.remove('active');
        } else {
            overBtn.classList.remove('active');
            underBtn.classList.add('active');
        }
    }
    
    updateDiceStats();
}

// Bet amount functions
function setBetAmount(action) {
    const betInput = document.getElementById('dice-bet-amount');
    if (!betInput) return;

    const currentBalance = currentUser ? Math.round(currentUser.balance * 100) / 100 : 0;
    let currentBet = Math.round(parseFloat(betInput.value || 0) * 100) / 100;
    
    switch(action) {
        case 'half':
            const halved = Math.round((currentBet / 2) * 100) / 100;
            betInput.value = Math.max(0.01, halved).toFixed(2);
            break;
        case 'double':
            const doubled = Math.round((currentBet * 2) * 100) / 100;
            betInput.value = Math.min(doubled, currentBalance).toFixed(2);
            break;
        case 'max':
            betInput.value = currentBalance.toFixed(2);
            break;
        case 'clear':
            betInput.value = '';
            break;
    }
}

// Coinflip game function
async function playCoinFlip(choice) {
    if (!currentUser) return;
    
    const betInput = document.getElementById('coinflip-bet');
    let betAmount = parseFloat(betInput.value);
    
    if (isNaN(betAmount) || betAmount < 0.01) {
        showError('Minimum bet amount is $0.01');
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showError('Insufficient balance');
        return;
    }
    
    // Round bet to 2 decimal places
    betAmount = Math.ceil(betAmount * 100) / 100;
    betInput.value = betAmount.toFixed(2);
    
    const coin = document.getElementById('coin');
    coin.classList.add('flipping');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameType: 'coinflip',
                betAmount: betAmount,
                playerChoice: choice
            })
        });

        const data = await response.json();
        
        if (data.success) {
            // Update current user data if provided, otherwise just sync the balance fields manually
            if (data.user) {
            currentUser = data.user;
            } else if (currentUser && data.result) {
                // Only update the fields we know changed (balance, XP, level)
                if (typeof data.result.balanceAfter !== 'undefined') {
                    currentUser.balance = data.result.balanceAfter;
                }
                if (typeof data.result.newLevel !== 'undefined') {
                    currentUser.level = data.result.newLevel;
                }
                if (typeof data.result.experienceGained !== 'undefined') {
                    currentUser.experience += data.result.experienceGained;
                }

                // Update basic game stats locally so UI stays in sync until next full profile fetch
                if (typeof currentUser.gamesPlayed === 'number') {
                    currentUser.gamesPlayed += 1;
                }
                if (data.result.won) {
                    if (typeof currentUser.wins === 'number') currentUser.wins += 1;
                    if (typeof currentUser.totalWon === 'number') currentUser.totalWon += data.result.winAmount;
                    if (typeof currentUser.currentWinStreak === 'number') {
                        currentUser.currentWinStreak += 1;
                        if (typeof currentUser.bestWinStreak === 'number' && currentUser.currentWinStreak > currentUser.bestWinStreak) {
                            currentUser.bestWinStreak = currentUser.currentWinStreak;
                        }
                    }
                    if (typeof currentUser.bestWin === 'number' && data.result.winAmount > currentUser.bestWin) {
                        currentUser.bestWin = data.result.winAmount;
                    }
                } else {
                    if (typeof currentUser.losses === 'number') currentUser.losses += 1;
                    if (typeof currentUser.currentWinStreak === 'number') currentUser.currentWinStreak = 0;
                }
            }

            updateUserInterface();
            
            // Show result after animation
            setTimeout(() => {
                coin.classList.remove('flipping');
                
                // Update coin display
                const result = data.result.gameResult;
                if (result === 'heads') {
                    coin.style.transform = 'rotateY(0deg)';
                } else {
                    coin.style.transform = 'rotateY(180deg)';
                }
                
                // Display hash/seed at bottom of page
                displayRandomHash(data.result.randomHash, data.result.randomTimestamp);
                
                // Check for new badges
                const newBadges = checkBadges(betAmount);
                if (newBadges.length > 0) {
                    newBadges.forEach(badge => {
                        setTimeout(() => {
                            showBadgeNotification(badge);
                        }, 1000);
                    });
                    updateBadges(); // Update badge display
                }
                
                // Calculate profit (win amount minus bet amount)
                const profit = data.result.won ? data.result.winAmount - betAmount : 0;
                showGameNotification(data.result.won, profit);
                
                if (data.result && data.result.leveledUp) {
                    setTimeout(() => {
                        showGameNotification(true, null, 
                            `Level Up! +${data.result.levelsGained} level(s)!`);
                        // Refresh profile to update XP/level bars
                        fetchUserProfile(true);
                    }, 500);
                }
                
                // Update chart immediately after game result
                drawBalanceChart();
            }, 1000);
        } else {
            coin.classList.remove('flipping');
            showError(data.message || 'Failed to play game');
        }
    } catch (error) {
        coin.classList.remove('flipping');
        console.error('Game error:', error);
        showError('Connection error. Please try again.');
    }
}

// Roll dice function
async function rollDice() {
    if (!currentUser || isRolling) return;
    
    const betInput = document.getElementById('dice-bet-amount');
    let betAmount = parseFloat(betInput.value);
    const targetValue = parseFloat(document.getElementById('dice-target').value);
    
    if (isNaN(betAmount) || betAmount < 0.01) {
        showError('Minimum bet amount is $0.01');
        return;
    }
    
    // Round bet amount to 2 decimal places to match server precision
    betAmount = Math.round(betAmount * 100) / 100;
    const userBalance = Math.round(currentUser.balance * 100) / 100;
    
    // Check balance with proper precision
    if (betAmount > userBalance) {
        showError('Insufficient balance');
        return;
    }
    
    // Update input with precise value
    betInput.value = betAmount.toFixed(2);
    
    isRolling = true;
    const rollButton = document.getElementById('roll-dice-btn');
    const buttonText = document.getElementById('roll-btn-text');
    const originalText = buttonText.textContent;
    buttonText.textContent = 'Rolling...';
    rollButton.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameType: 'dice',
                betAmount: betAmount,
                playerChoice: rollType === 'over' ? 'higher' : 'lower',
                targetNumber: targetValue // Send raw target value, server will handle over/under logic
            })
        });

        const data = await response.json();
        
        if (data.success) {
            // Update current user data if provided, otherwise just sync the balance fields manually
            if (data.user) {
            currentUser = data.user;
            } else if (currentUser && data.result) {
                // Only update the fields we know changed (balance, XP, level)
                if (typeof data.result.balanceAfter !== 'undefined') {
                    currentUser.balance = data.result.balanceAfter;
                }
                if (typeof data.result.newLevel !== 'undefined') {
                    currentUser.level = data.result.newLevel;
                }
                if (typeof data.result.experienceGained !== 'undefined') {
                    currentUser.experience += data.result.experienceGained;
                }

                // Update basic game stats locally so UI stays in sync until next full profile fetch
                if (typeof currentUser.gamesPlayed === 'number') {
                    currentUser.gamesPlayed += 1;
                }
                if (data.result.won) {
                    if (typeof currentUser.wins === 'number') currentUser.wins += 1;
                    if (typeof currentUser.totalWon === 'number') currentUser.totalWon += data.result.winAmount;
                    if (typeof currentUser.currentWinStreak === 'number') {
                        currentUser.currentWinStreak += 1;
                        if (typeof currentUser.bestWinStreak === 'number' && currentUser.currentWinStreak > currentUser.bestWinStreak) {
                            currentUser.bestWinStreak = currentUser.currentWinStreak;
                        }
                    }
                    if (typeof currentUser.bestWin === 'number' && data.result.winAmount > currentUser.bestWin) {
                        currentUser.bestWin = data.result.winAmount;
                    }
                } else {
                    if (typeof currentUser.losses === 'number') currentUser.losses += 1;
                    if (typeof currentUser.currentWinStreak === 'number') currentUser.currentWinStreak = 0;
                }
            }

            updateUserInterface();
            
            // Update dice pointer and result
            const pointer = document.getElementById('dice-pointer');
            const result = document.getElementById('dice-result');
            const resultNumber = parseFloat(data.result.gameResult);
            
            if (pointer) pointer.style.left = resultNumber + '%';
            if (result) {
                result.textContent = resultNumber.toFixed(2);
                result.classList.remove('win', 'lose', 'show'); // Clear previous classes
                setTimeout(() => {
                    result.classList.add('show', data.result.won ? 'win' : 'lose');
                }, 50); // Small delay to ensure removal happens first
            }
            
            // Display hash/seed at bottom of page
            displayRandomHash(data.result.randomHash, data.result.randomTimestamp);
            
            // Check for new badges
            const newBadges = checkBadges(betAmount);
            if (newBadges.length > 0) {
                newBadges.forEach(badge => {
                    setTimeout(() => {
                        showBadgeNotification(badge);
                    }, 1000);
                });
                updateBadges(); // Update badge display
            }
            
            // Calculate profit (win amount minus bet amount)
            const profit = data.result.won ? data.result.winAmount - betAmount : 0;
            showGameNotification(data.result.won, profit);
            
            // Check if levelUp data exists before accessing it
            if (data.result && data.result.leveledUp) {
                setTimeout(() => {
                    showGameNotification(true, null, 
                        `Level Up! +${data.result.levelsGained} level(s)!`);
                    // Refresh profile to update XP/level bars
                    fetchUserProfile(true);
                }, 500);
            }
            
            // Update chart immediately after game result
            drawBalanceChart();
            
            if (isAutoBetting) {
                continueAutoBet(data.result.won, data.result.winAmount - betAmount);
            }
        } else {
            showError(data.message || 'Failed to play game');
        }
    } catch (error) {
        console.error('Game error:', error);
        showError('Connection error. Please try again.');
    } finally {
        isRolling = false;
        buttonText.textContent = originalText;
        rollButton.disabled = false;
    }
}

// Display random hash/seed for provably fair gaming
function displayRandomHash(hash, timestamp) {
    // Find the dice-visual container
    const diceVisual = document.querySelector('.dice-visual');
    if (!diceVisual) return;
    
    // Remove existing provably fair element
    let existingElement = document.getElementById('provably-fair-result');
    if (existingElement) {
        existingElement.remove();
    }
    
    // Create new provably fair element
    const provablyFairElement = document.createElement('div');
    provablyFairElement.id = 'provably-fair-result';
    provablyFairElement.className = 'provably-fair-result';
    provablyFairElement.innerHTML = `
        🎲 Provably Fair: ${hash.substring(0, 16)}...
        <button class="copy-hash-btn" onclick="copyHash('${hash}')" title="Copy full hash">
            <i data-lucide="copy"></i>
        </button>
        ${new Date(timestamp).toLocaleTimeString()}
    `;
    
    // Insert inside dice-visual container at the bottom
    diceVisual.appendChild(provablyFairElement);
    
    // Initialize the copy icon
    lucide.createIcons();
}

// Function to copy hash to clipboard
function copyHash(hash) {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(hash).then(() => {
            showCopyFeedback();
        }).catch(err => {
            console.error('Clipboard API failed:', err);
            fallbackCopyTextToClipboard(hash);
        });
    } else {
        // Use fallback for older browsers or non-secure contexts
        fallbackCopyTextToClipboard(hash);
    }
}

function showCopyFeedback() {
    const copyBtn = document.querySelector('.copy-hash-btn');
    if (!copyBtn) return;
    
    const icon = copyBtn.querySelector('i');
    if (icon) {
        // Show feedback
        icon.setAttribute('data-lucide', 'check');
        copyBtn.classList.add('copied');
        lucide.createIcons();
        
        // Reset after 2 seconds
        setTimeout(() => {
            icon.setAttribute('data-lucide', 'copy');
            copyBtn.classList.remove('copied');
            lucide.createIcons();
        }, 2000);
    }
}

// Fallback copy function for older browsers
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyFeedback();
        } else {
            showError('Failed to copy hash');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showError('Failed to copy hash');
    }
    
    document.body.removeChild(textArea);
}

// Auto bet functionality
function initializeAutoBet() {
    // Initialize infinite mode toggle with improved event handling
    const infiniteToggle = document.getElementById('infinite-bets-toggle');
    if (infiniteToggle) {
        const toggleInfinite = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const toggle = e ? e.currentTarget : document.getElementById('infinite-bets-toggle');
            toggle.classList.toggle('active');
            autoBetConfig.infiniteMode = toggle.classList.contains('active');
            const countInput = document.getElementById('auto-bet-count');
            if (countInput) {
                countInput.disabled = autoBetConfig.infiniteMode;
            }
        };

        // Clean up old event listeners by replacing the element
        const newInfiniteToggle = infiniteToggle.cloneNode(true);
        infiniteToggle.parentNode.replaceChild(newInfiniteToggle, infiniteToggle);
        
        // Add new event listeners to the new element
        newInfiniteToggle.addEventListener('click', toggleInfinite);
        newInfiniteToggle.addEventListener('touchend', (e) => {
            e.preventDefault();
            toggleInfinite(e);
        });
        
        // Ensure proper initialization
        newInfiniteToggle.style.pointerEvents = 'auto';
        newInfiniteToggle.style.cursor = 'pointer';
    }

    // Initialize strategy buttons
    ['win', 'loss'].forEach(type => {
        const buttons = document.querySelectorAll(`#on-${type}-reset, #on-${type}-multiply, #on-${type}-stop`);
        const settingsDiv = document.getElementById(`on-${type}-settings`);
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons in this group
                buttons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                // Update config
                const action = btn.id.replace(`on-${type}-`, '');
                autoBetConfig[`on${type.charAt(0).toUpperCase() + type.slice(1)}`].action = action;
                // Show/hide settings based on action
                if (settingsDiv) {
                    settingsDiv.classList.toggle('show', action === 'multiply');
                }
            });
        });
    });

    // Initialize start/stop buttons
    const startBtn = document.getElementById('start-auto-bet');
    const stopBtn = document.getElementById('stop-auto-bet');
    if (startBtn) startBtn.addEventListener('click', startAutoBet);
    if (stopBtn) stopBtn.addEventListener('click', stopAutoBet);
}

function startAutoBet() {
    if (isAutoBetting) return;

    // Get initial values
    const betInput = document.getElementById('dice-bet-amount');
    initialBetAmount = parseFloat(betInput.value);
    startingBalance = currentUser.balance;
    totalProfit = 0;

    // Validate bet amount
    if (isNaN(initialBetAmount) || initialBetAmount < 0.01) {
        showError('Please enter a valid bet amount');
        return;
    }

    // Get configuration
    autoBetConfig.targetBets = autoBetConfig.infiniteMode ? Infinity : 
        parseInt(document.getElementById('auto-bet-count').value) || 10;
    autoBetConfig.stopWin = parseFloat(document.getElementById('auto-stop-win').value) || 0;
    autoBetConfig.stopLoss = parseFloat(document.getElementById('auto-stop-loss').value) || 0;
    autoBetConfig.stopBalanceGain = parseFloat(document.getElementById('auto-stop-balance-gain').value) || 0;
    autoBetConfig.stopBalanceLoss = parseFloat(document.getElementById('auto-stop-balance-loss').value) || 0;
    
    ['Win', 'Loss'].forEach(type => {
        const multiplierInput = document.getElementById(`on-${type.toLowerCase()}-multiplier`);
        autoBetConfig[`on${type}`].multiplier = parseFloat(multiplierInput.value) || 2.0;
    });

    // Start auto betting
    isAutoBetting = true;
    autoBetCount = autoBetConfig.targetBets;
    
    // Update UI
    document.getElementById('start-auto-bet').classList.add('hidden');
    document.getElementById('stop-auto-bet').classList.remove('hidden');
    document.getElementById('auto-bet-btn').classList.add('active');
    
    // Start first roll
    rollDice();
}

function stopAutoBet() {
    isAutoBetting = false;
    autoBetCount = 0;
    
    // Reset UI
    document.getElementById('start-auto-bet').classList.remove('hidden');
    document.getElementById('stop-auto-bet').classList.add('hidden');
    document.getElementById('auto-bet-btn').classList.remove('active');
    
    // Reset bet amount to initial value
    const betInput = document.getElementById('dice-bet-amount');
    betInput.value = initialBetAmount.toFixed(2);
}

function continueAutoBet(wasWin, profit) {
    if (!isAutoBetting) return;
    
    totalProfit += profit;
    const balanceChange = ((currentUser.balance - startingBalance) / startingBalance) * 100;
    
    // Check stop conditions
    const stopConditions = [
        { condition: !autoBetConfig.infiniteMode && autoBetCount <= 1, message: 'Auto bet completed!' },
        { condition: autoBetConfig.stopWin > 0 && totalProfit >= autoBetConfig.stopWin, message: 'Stop win reached!' },
        { condition: autoBetConfig.stopLoss > 0 && totalProfit <= -autoBetConfig.stopLoss, message: 'Stop loss reached!' },
        { condition: autoBetConfig.stopBalanceGain > 0 && balanceChange >= autoBetConfig.stopBalanceGain, message: 'Balance gain target reached!' },
        { condition: autoBetConfig.stopBalanceLoss > 0 && balanceChange <= -autoBetConfig.stopBalanceLoss, message: 'Balance loss limit reached!' }
    ];

    const stopCondition = stopConditions.find(c => c.condition);
    if (stopCondition) {
        stopAutoBet();
        showGameNotification(totalProfit >= 0, totalProfit, stopCondition.message);
        return;
    }

    // Update bet amount based on result
    const betInput = document.getElementById('dice-bet-amount');
    const currentBet = parseFloat(betInput.value);
    const config = wasWin ? autoBetConfig.onWin : autoBetConfig.onLoss;
    
    switch (config.action) {
        case 'multiply':
            betInput.value = (currentBet * config.multiplier).toFixed(2);
            break;
        case 'stop':
            stopAutoBet();
            showGameNotification(wasWin, profit, wasWin ? 'Stopped after win' : 'Stopped after loss');
            return;
        case 'reset':
        default:
            betInput.value = initialBetAmount.toFixed(2);
            break;
    }

    // Update counter
    if (!autoBetConfig.infiniteMode) {
        autoBetCount--;
    }
    
    // Continue with next roll after delay
    setTimeout(() => {
        if (isAutoBetting) {
            rollDice();
        }
    }, 1000);
}

// Notification System
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification-container');
        this.notifications = [];
        this.maxNotifications = 3;
    }

    show(options) {
        const {
            type = 'info',
            title,
            message,
            amount = null,
            duration = 5000,
            persistent = false,
            customColor = null
        } = options;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Apply custom color if provided
        if (customColor) {
            notification.style.setProperty('--notification-color', customColor);
            notification.style.borderColor = customColor;
        }
        
        // Create notification content
        const header = document.createElement('div');
        header.className = 'notification-header';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = this.getIcon(type);
        
        // Apply custom color to icon if provided
        if (customColor) {
            icon.style.color = customColor;
        }
        
        const titleText = document.createElement('span');
        titleText.textContent = title;
        
        titleElement.appendChild(icon);
        titleElement.appendChild(titleText);
        header.appendChild(titleElement);
        notification.appendChild(header);
        
        if (message) {
            const messageElement = document.createElement('div');
            messageElement.className = 'notification-message';
            messageElement.textContent = message;
            notification.appendChild(messageElement);
        }
        
        if (amount !== null) {
            const amountElement = document.createElement('div');
            amountElement.className = 'notification-amount';
            const sign = amount >= 0 ? '+' : '';
            amountElement.textContent = `${sign}$${formatNumber(Math.abs(amount))}`;
            
            // Apply custom color to amount if provided
            if (customColor) {
                amountElement.style.color = customColor;
                amountElement.style.fontWeight = 'bold';
            }
            
            notification.appendChild(amountElement);
        }
        
        // Add progress bar for auto-dismiss
        if (!persistent && duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            progressBar.style.width = '100%';
            
            // Apply custom color to progress bar if provided
            if (customColor) {
                progressBar.style.backgroundColor = customColor;
            }
            
            notification.appendChild(progressBar);
            
            // Animate progress bar
            requestAnimationFrame(() => {
                progressBar.style.transition = `width ${duration}ms linear`;
                progressBar.style.width = '0%';
            });
        }
        
        // Add click to dismiss
        notification.onclick = () => this.dismiss(notification);
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Remove excess notifications
        while (this.notifications.length > this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.dismiss(oldest);
        }
        
        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto dismiss
        if (!persistent && duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }
        
        return notification;
    }

    dismiss(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '!',
            warning: '!',
            info: 'i',
            'level-up': '↑',
            'badge': '★'
        };
        return icons[type] || 'i';
    }

    // Convenience methods
    success(title, message, amount = null) {
        return this.show({ type: 'success', title, message, amount });
    }

    error(title, message) {
        return this.show({ type: 'error', title, message, duration: 7000 });
    }

    warning(title, message) {
        return this.show({ type: 'warning', title, message });
    }

    info(title, message) {
        return this.show({ type: 'info', title, message });
    }

    levelUp(title, message, amount = null) {
        return this.show({ type: 'level-up', title, message, amount, duration: 8000 });
    }
}

// Initialize notification manager
const notifications = new NotificationManager();

// Replace old notification functions
function showError(message) {
    notifications.error('Error', message);
}

function showBadgeNotification(badge) {
    const notification = notifications.show({
        type: 'badge',
        title: 'Badge Earned!',
        message: badge.name,
        duration: 8000
    });
    
    // Customize notification with badge color and icon
    if (notification) {
        notification.style.setProperty('--notification-color', badge.color);
        const iconElement = notification.querySelector('.notification-icon');
        if (iconElement) {
            iconElement.innerHTML = `<i data-lucide="${badge.icon}"></i>`;
            iconElement.style.background = badge.color;
        }
        
        // Re-initialize lucide icons for the notification
        lucide.createIcons();
    }
}

function showGameNotification(isWin, amount, customMessage = null, colorObj = null, multiplier = null) {
    if (customMessage) {
        if (customMessage.includes('Level Up')) {
            notifications.levelUp('Level Up!', customMessage);
        } else if (customMessage.includes('completed')) {
            notifications.info('Auto Bet', customMessage);
        } else if (customMessage.includes('reached')) {
            notifications.warning('Auto Bet', customMessage);
        } else {
            notifications.info('Game', customMessage);
        }
    } else {
        const optsColor = colorObj ? colorObj.text : undefined;
        if (multiplier !== null && multiplier < 1) {
            notifications.show({
                type: 'info',
                title: 'Partial Return',
                message: `You got back $${amount.toFixed(2)}`,
                amount,
                customColor: optsColor
            });
        } else if (isWin) {
            notifications.show({
                type: 'success',
                title: 'You Won!',
                message: `Won $${amount.toFixed(2)}!`,
                amount,
                customColor: optsColor
            });
        } else {
            notifications.show({
                type: 'error',
                title: 'You Lost',
                message: 'Better luck next time!',
                amount,
                customColor: optsColor
            });
        }
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('vestro_user_data');
    currentUser = null;
    showLoginPage();
    if (socket) {
        socket.disconnect();
    }
}

// Plinko Game Variables
let plinkoCanvas, plinkoCtx;
let plinkoConfig = {
    risk: 'low',
    rows: 8,
    ballSize: 24,
    pegSize: 12,
    gravity: 0.45,
};

let plinkoState = {
    isDropping: false,
    balls: [],
    pegs: [],
    buckets: [],
    multipliers: [],
    animationId: null,
    lastDropTime: 0,  // Rate limiting
    bucketAnimations: [],  // For hit animations
    currentBallSize: 16,  // Initialize with default size
    currentPegSize: 10,   // Initialize with default size
    bucketProbabilities: [] // Cache for bucket probabilities
};

// Rate limiting constants
const PLINKO_DROP_DEBOUNCE_MS = 500; // 1/4 second minimum between drops

// Collision categories for Matter.js
const collisionCategories = {
    ball: 0x0001,
    peg: 0x0002,
    bucket: 0x0004,
    wall: 0x0008
};

// Debounce for ball drops (variables declared elsewhere)

let plinkoAutobet = {
    isActive: false,
    settings: {
        betCount: 10,
        isInfinite: false,
        stopOnWin: null,
        stopOnLoss: null,
        stopOnBalanceGain: null,
        stopOnBalanceLoss: null,
        onLoss: 'reset',
        onWin: 'reset',
        lossMultiplier: 2.0,
        winMultiplier: 2.0
    },
    stats: {
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        currentStreak: 0,
        longestStreak: 0,
        startBalance: 0,
        baseBet: 0
    }
};

// Helper function from example to get a random integer
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min)) + min;

// Plinko Multiplier Tables (similar to Stake)
const plinkoMultipliers = {
    low: {
        8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
        12: [8.1, 3.0, 1.6, 1.0, 0.7, 0.7, 0.5, 0.7, 0.7, 1.0, 1.6, 3.0, 8.1],
        16: [16.0, 9.0, 2.0, 1.4, 1.1, 1.0, 0.5, 0.3, 0.5, 0.3, 0.5, 1.0, 1.1, 1.4, 2.0, 9.0, 16.0]
    },
    medium: {
        8: [13.0, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13.0],
        12: [24.0, 5.0, 2.0, 1.4, 0.6, 0.4, 0.2, 0.4, 0.6, 1.4, 2.0, 5.0, 24.0],
        16: [110.0, 41.0, 10.0, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10.0, 41.0, 110.0]
    },
    high: {
        8: [29.0, 4.0, 1.5, 0.2, 0.2, 0.2, 1.5, 4.0, 29.0],
        12: [58.0, 8.0, 2.5, 1.0, 0.2, 0.2, 0.1, 0.2, 0.2, 1.0, 2.5, 8.0, 58.0],
        16: [1000.0, 130.0, 26.0, 9.0, 4.0, 2.0, 0.7, 0.2, 0.1, 0.2, 0.7, 2.0, 4.0, 9.0, 26.0, 130.0, 1000.0]
    }
};

// Initialize Plinko Game
function initializePlinko() {
    plinkoCanvas = document.getElementById('plinko-canvas');
    if (!plinkoCanvas) {
        setTimeout(initializePlinko, 100);
        return;
    }
    
    plinkoCtx = plinkoCanvas.getContext('2d');
    
    resizePlinkoCanvas();
    setupPlinkoGame();
    
    // Set initial values after game is set up
    setPlinkoRisk('low');
    setPlinkoRows(8);
    
    setupPlinkoAutobet();
    
    if (!window.plinkoResizeListenerAdded) {
        window.addEventListener('resize', resizePlinkoCanvas);
        window.plinkoResizeListenerAdded = true;
    }
    
    if (plinkoState.animationId) {
        cancelAnimationFrame(plinkoState.animationId);
    }
    
    plinkoGameLoop();
}

// Resize canvas to maintain aspect ratio
function resizePlinkoCanvas() {
    if (!plinkoCanvas) return;
    
    const container = plinkoCanvas.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || window.innerHeight - 200;
    
    // Fixed aspect ratio for consistent gameplay
    const targetAspectRatio = 1/1; // width/height ratio - wider to reduce vertical stretching
    const maxWidth = Math.min(containerWidth, 1200); // Increased max width
    const maxHeight = Math.min(containerHeight, 600); // Significantly reduced max height to prevent long container
    
    // Calculate dimensions maintaining aspect ratio
    let canvasWidth, canvasHeight;
    
    if (containerWidth / containerHeight > targetAspectRatio) {
        // Container is wider than target ratio - fit by height
        canvasHeight = Math.min(maxHeight, containerHeight);
        canvasWidth = canvasHeight * targetAspectRatio;
    } else {
        // Container is taller than target ratio - fit by width
        canvasWidth = Math.min(maxWidth, containerWidth);
        canvasHeight = canvasWidth / targetAspectRatio;
    }
    
    // Get device pixel ratio and backing store ratio
    const devicePixelRatio = window.devicePixelRatio || 1;
    const backingStoreRatio = plinkoCtx.webkitBackingStorePixelRatio ||
                             plinkoCtx.mozBackingStorePixelRatio ||
                             plinkoCtx.msBackingStorePixelRatio ||
                             plinkoCtx.oBackingStorePixelRatio ||
                             plinkoCtx.backingStorePixelRatio || 1;
    
    // Calculate the ratio to scale the canvas
    const ratio = devicePixelRatio / backingStoreRatio;
    
    // Store logical dimensions for layout calculations
    plinkoCanvas.logicalWidth = canvasWidth;
    plinkoCanvas.logicalHeight = canvasHeight;
    
    // Set physical pixel dimensions for high-DPI support
    plinkoCanvas.width = canvasWidth * ratio;
    plinkoCanvas.height = canvasHeight * ratio;
    
    // Set display size
    plinkoCanvas.style.width = canvasWidth + 'px';
    plinkoCanvas.style.height = canvasHeight + 'px';
    
    // Scale the context
    plinkoCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    
    // Center the canvas
    plinkoCanvas.style.margin = '0 auto';
    plinkoCanvas.style.display = 'block';
    
    // Update tooltip positions
    plinkoState.buckets.forEach((bucket, i) => {
        const tooltipContainer = document.getElementById(`bucket-tooltip-${i}`);
        if (tooltipContainer) {
            tooltipContainer.style.left = `${bucket.x}px`;
            tooltipContainer.style.top = `${bucket.y}px`;
            tooltipContainer.style.width = `${bucket.width}px`;
            tooltipContainer.style.height = `${bucket.height}px`;
        }
    });
    
    setupPlinkoGame();
}

// Setup Plinko game elements and physics world
function setupPlinkoGame() {
    if (!plinkoCanvas || !plinkoCtx) {
        console.warn('Canvas not ready for setupPlinkoGame');
        return;
    }

    // --- Matter.js World Setup ---
    const { Engine, World, Bodies, Runner, Events } = MatterModules;
    if (runner) Runner.stop(runner);
    engine = Engine.create({ gravity: { x: 0, y: plinkoConfig.gravity } });
    runner = Runner.create();
    Runner.run(runner, engine);
    
    // --- Layout & SIZING FIX ---
    const { rows } = plinkoConfig;
    // Use logical dimensions for layout calculations
    const width = plinkoCanvas.logicalWidth || plinkoCanvas.width;
    const height = plinkoCanvas.logicalHeight || plinkoCanvas.height;
    
    // Combined scaling: base on canvas size AND row count
    const baseCanvasWidth = 400; // Reference width for scaling
    const baseRows = 8; // Reference row count for scaling
    
    const canvasScaleFactor = width / baseCanvasWidth;
    const rowScaleFactor = baseRows / rows; // Inverse scaling - more rows = smaller elements
    let combinedScaleFactor = canvasScaleFactor * rowScaleFactor;
    
    // Calculate required spacing first to determine if we need to scale down further
    const maxPegsInBottomRow = rows + 2; // Bottom row has the most pegs
    const availableWidth = width * 1; // Use 90% of canvas width for safety margin
    const maxPegSpacing = availableWidth / (maxPegsInBottomRow - 1); // Space between pegs
    
    // Initial ball and peg sizes
    let ballSize = plinkoConfig.ballSize * combinedScaleFactor;
    let pegSize = plinkoConfig.pegSize * combinedScaleFactor;
    
    // Check if we need to scale down further to fit
    const minRequiredSpacing = ballSize * 2.5;
    if (minRequiredSpacing > maxPegSpacing) {
        // Scale down ball and peg sizes to fit the available spacing
        const spacingScaleFactor = maxPegSpacing / minRequiredSpacing;
        ballSize *= spacingScaleFactor;
        pegSize *= spacingScaleFactor;
    }
    
    // Apply minimum sizes
    plinkoState.currentBallSize = Math.max(ballSize, 4);
    plinkoState.currentPegSize = Math.max(pegSize, 3);
    
    // --- Layout Calculations ---
    const bucketHeight = 40 * canvasScaleFactor;
    const bucketMarginFromBottom = 10; // Fixed margin from bottom
    const reservedBucketSpace = bucketHeight + bucketMarginFromBottom; // Minimal space for buckets
    const bottomGap = reservedBucketSpace; // Minimal bottom gap
    
    // Use minimal spacing - calculate what we actually need
    const minTopOffset = 50; // Very minimal space for ball drop area
    
    // Final peg spacing calculation
    const minPegSpacing = plinkoState.currentBallSize * 2.5; // Minimum for ball passage
    const pegSpacing = Math.max(maxPegSpacing, minPegSpacing);
    
    // Use proportional spacing for uniform appearance
    const rowSpacing = pegSpacing * 0.866;
    
    // Calculate actual triangle height
    const triangleHeight = (rows - 1) * rowSpacing;
    
    // Use minimal top offset
    const topOffset = minTopOffset;
    
    // Clear state
    plinkoState.pegs = [];
    plinkoState.buckets = [];
    plinkoState.balls.forEach(ball => World.remove(engine.world, ball.body));
    plinkoState.balls = [];
    plinkoState.bucketAnimations = {};
    plinkoState.pegAnimations = {}; // For hit animations
    plinkoState.multipliers = plinkoMultipliers[plinkoConfig.risk][rows];
    
    // Calculate probabilities for new row count
    plinkoState.bucketProbabilities = calculateBucketProbabilities(rows);

    const bucketCount = rows + 1;
    const bucketWidth = (width * 0.8) / bucketCount; // Use 80% of canvas width for buckets
    const bucketMargin = (width - bucketWidth * bucketCount) / (bucketCount + 1);
    
    // --- Create Physics Bodies ---
    const worldBodies = [];

    // Walls
    const wallOptions = { isStatic: true, render: { fillStyle: 'transparent' }, label: 'wall', collisionFilter: { category: collisionCategories.wall, mask: collisionCategories.ball } };
    worldBodies.push(Bodies.rectangle(0, height / 2, 10, height, wallOptions));
    worldBodies.push(Bodies.rectangle(width, height / 2, 10, height, wallOptions));
    worldBodies.push(Bodies.rectangle(width / 2, height + 40, width, 100, { isStatic: true, label: 'floor' }));

    // Pegs (Classic Triangle Formation) - with dynamic spacing
    for (let row = 0; row < rows; row++) {
        const numPegs = row + 3; // Start with 3 pegs and increase
        for (let col = 0; col < numPegs; col++) {
            const x = (width / 2) + (col - (numPegs - 1) / 2) * pegSpacing;
            const y = topOffset + row * rowSpacing;
            
            const pegBody = Bodies.circle(x, y, plinkoState.currentPegSize / 2, {
                isStatic: true,
                restitution: 0,
                friction: 0,
                render: { fillStyle: '#6b7280' },
                label: 'peg',
                collisionFilter: { category: collisionCategories.peg, mask: collisionCategories.ball }
            });
            plinkoState.pegs.push(pegBody);
        }
    }
    worldBodies.push(...plinkoState.pegs);

    // Create a single fixed tooltip container if it doesn't exist
    let fixedTooltip = document.getElementById('plinko-probability-tooltip');
    if (!fixedTooltip) {
        fixedTooltip = document.createElement('div');
        fixedTooltip.id = 'plinko-probability-tooltip';
        fixedTooltip.className = 'plinko-fixed-tooltip';
        fixedTooltip.style.opacity = '0';
        const canvasContainer = plinkoCanvas.parentElement;
        canvasContainer.appendChild(fixedTooltip);
    }

    // Buckets - create both visual buckets and collision sensors
    for (let i = 0; i < bucketCount; i++) {
        const x = bucketMargin + i * (bucketWidth + bucketMargin);
        const y = height - bucketHeight - bucketMarginFromBottom;
        const bucket = { x, y, width: bucketWidth, height: bucketHeight, index: i };
        plinkoState.buckets.push(bucket);
        
        // Create a larger sensor that covers the entire bucket area + some extra height
        const sensorHeight = bucketHeight + 20; // Extra height to catch balls
        const sensorY = y - 10; // Position slightly above bucket
        
        const sensor = Bodies.rectangle(x + bucketWidth / 2, sensorY + sensorHeight / 2, bucketWidth, sensorHeight, {
            isStatic: true,
            isSensor: true,
            label: `bucket-${i}`,
            collisionFilter: { category: collisionCategories.bucket, mask: collisionCategories.ball }
        });
        worldBodies.push(sensor);
        
        // Also create solid bucket walls and bottom to prevent balls from falling through
        const wallThickness = 3;
        
        // Left wall
        const leftWall = Bodies.rectangle(x - wallThickness/2, y + bucketHeight/2, wallThickness, bucketHeight, {
            isStatic: true,
            label: `bucket-wall-${i}`,
            collisionFilter: { category: collisionCategories.wall, mask: collisionCategories.ball }
        });
        worldBodies.push(leftWall);
        
        // Right wall
        const rightWall = Bodies.rectangle(x + bucketWidth + wallThickness/2, y + bucketHeight/2, wallThickness, bucketHeight, {
            isStatic: true,
            label: `bucket-wall-${i}`,
            collisionFilter: { category: collisionCategories.wall, mask: collisionCategories.ball }
        });
        worldBodies.push(rightWall);
        
        // Bottom wall
        const bottomWall = Bodies.rectangle(x + bucketWidth/2, y + bucketHeight + wallThickness/2, bucketWidth, wallThickness, {
            isStatic: true,
            label: `bucket-bottom-${i}`,
            collisionFilter: { category: collisionCategories.wall, mask: collisionCategories.ball }
        });
        worldBodies.push(bottomWall);
    }

    // Add canvas hover listener - remove any existing listeners first
    plinkoCanvas.removeEventListener('mousemove', handlePlinkoHover);
    plinkoCanvas.removeEventListener('mouseleave', handlePlinkoMouseLeave);
    
    plinkoCanvas.addEventListener('mousemove', handlePlinkoHover);
    plinkoCanvas.addEventListener('mouseleave', handlePlinkoMouseLeave);

    World.add(engine.world, worldBodies);

    // --- Collision Handling ---
    Events.off(engine, 'collisionStart');
    Events.on(engine, 'collisionStart', (event) => {
        for (const pair of event.pairs) {
            const { bodyA, bodyB } = pair;
            const ballBody = bodyA.label === 'ball' ? bodyA : (bodyB.label === 'ball' ? bodyB : null);
            if (!ballBody) continue;

            const otherBody = ballBody === bodyA ? bodyB : bodyA;
            
            if (otherBody.label.startsWith('bucket-')) {
                const ballObj = plinkoState.balls.find(b => b.body === ballBody);
                if (ballObj && !ballObj.hasLanded) {
                    ballObj.hasLanded = true;
                    const bucketIndex = parseInt(otherBody.label.split('-')[1], 10);
                    console.log(`🎯 Ball hit bucket sensor ${bucketIndex}`);
                    handlePlinkoBallLanding(ballObj, bucketIndex);
                }
            }
            // Handle bucket walls/bottoms - if ball hits these, determine which bucket it should land in
            else if (otherBody.label.startsWith('bucket-wall-') || otherBody.label.startsWith('bucket-bottom-')) {
                const ballObj = plinkoState.balls.find(b => b.body === ballBody);
                if (ballObj && !ballObj.hasLanded) {
                    // Extract bucket index from wall/bottom label
                    const bucketIndex = parseInt(otherBody.label.split('-')[2], 10);
                    console.log(`🎯 Ball hit bucket wall/bottom for bucket ${bucketIndex}`);
                    ballObj.hasLanded = true;
                    handlePlinkoBallLanding(ballObj, bucketIndex);
                }
            }
            // Trigger peg hit animation + pinball impulse
            else if (otherBody.label === 'peg') {
                plinkoState.pegAnimations[otherBody.id] = { startTime: Date.now() };

                // Apply strong outward velocity like a pinball bumper
                const { Body } = MatterModules;
                const dx = ballBody.position.x - otherBody.position.x;
                const dy = ballBody.position.y - otherBody.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                const speedBoost = 2; // bumper kick velocity (pixels per tick)
                
                // Find the ball object to get its target
                const ballObj = plinkoState.balls.find(b => b.body === ballBody);
                const now = Date.now();
                
                // Prevent rapid peg bouncing with cooldown
                if (ballObj && now - ballObj.lastPegCollision < 200) {
                    return; // Skip this collision
                }
                if (ballObj) {
                    ballObj.lastPegCollision = now;
                    ballObj.pegCollisionCount++;
                }
                
                if (ballObj && ballObj.targetBucketIdx !== null && ballObj.targetBucketIdx !== undefined) {
                    const targetBucket = plinkoState.buckets[ballObj.targetBucketIdx];
                    if (targetBucket) {
                        const targetX = targetBucket.x + targetBucket.width / 2;
                        const ballX = ballBody.position.x;
                        const shouldGoLeft = targetX < ballX;
                        const shouldGoRight = targetX > ballX;
                        
                        // Bias the bounce direction toward the target
                        let biasedNx = nx;
                        if (shouldGoLeft && nx > 0) {
                            biasedNx = nx * 0.1; // Strongly reduce rightward bounce
                        } else if (shouldGoRight && nx < 0) {
                            biasedNx = nx * 0.1; // Strongly reduce leftward bounce
                        }
                        
                        // Add extra push toward target
                        const targetDirection = shouldGoLeft ? -1 : shouldGoRight ? 1 : 0;
                        if (targetDirection !== 0) {
                            // Reduce bounce strength if ball has bounced too much recently
                            const bounceMultiplier = ballObj.pegCollisionCount > 10 ? 0.3 : 0.5;
                            biasedNx += targetDirection * bounceMultiplier; // Push toward target
                        }
                        
                        // Reduce overall bounce if excessive collisions
                        const finalSpeedBoost = ballObj.pegCollisionCount > 12 ? speedBoost * 0.7 : speedBoost;
                        Body.setVelocity(ballBody, { x: biasedNx * finalSpeedBoost, y: ny * finalSpeedBoost });
                    } else {
                        Body.setVelocity(ballBody, { x: nx * speedBoost, y: ny * speedBoost });
                    }
                } else {
                    Body.setVelocity(ballBody, { x: nx * speedBoost, y: ny * speedBoost });
                }
            }
            // Apply similar bounce off side walls
            else if (otherBody.label === 'wall') {
                const { Body } = MatterModules;
                const dx = ballBody.position.x - otherBody.position.x;
                const dy = ballBody.position.y - otherBody.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                const speedBoost = 1;
                Body.setVelocity(ballBody, { x: nx * speedBoost, y: ny * speedBoost });
            }
        }
    });

    // After collisionStart Events.on, add new beforeUpdate event once
    Events.off(engine, 'beforeUpdate');
    Events.on(engine, 'beforeUpdate', () => {
        const { Body } = MatterModules;
        const maxHorizSpeed = 6; // Allow stronger guidance movement
        for (const ballObj of plinkoState.balls) {
            const body = ballObj.body;
            if (!body) continue;

            // Apply small downward guidance force to discourage horizontal gliding
            Body.applyForce(body, body.position, { x: 0, y: 0.00003 * body.mass });

            // Guide ball toward predetermined target bucket
            if (ballObj.targetBucketIdx !== null && ballObj.targetBucketIdx !== undefined) {
                const targetBucket = plinkoState.buckets[ballObj.targetBucketIdx];
                if (targetBucket && body.position.y > 100) { // Only guide after it's past the starting area
                    const targetX = targetBucket.x + targetBucket.width / 2;
                    const dx = targetX - body.position.x;
                    const distance = Math.abs(dx);
                    
                    // Much stronger horizontal guidance - more aggressive steering
                    const guidanceStrength = Math.min(distance / 100, 1) * 0.0001;
                    const guidanceForce = Math.sign(dx) * guidanceStrength * body.mass;
                    Body.applyForce(body, body.position, { x: guidanceForce, y: 0 });
                    
                                        // Additional strong guidance when close to bottom
                    if (body.position.y > plinkoCanvas.height * 0.7) {
                        const strongGuidance = Math.sign(dx) * 0.0003 * body.mass;
                        Body.applyForce(body, body.position, { x: strongGuidance, y: 0 });
                        
                        // Final correction when very close to buckets
                        if (body.position.y > plinkoCanvas.height * 0.85 && distance < 50) {
                            const finalPush = Math.sign(dx) * 0.001 * body.mass;
                            Body.applyForce(body, body.position, { x: finalPush, y: 0 });
                        }
                    }
                }
            }

            // Clamp horizontal velocity
            if (Math.abs(body.velocity.x) > maxHorizSpeed) {
                Body.setVelocity(body, { x: Math.sign(body.velocity.x) * maxHorizSpeed, y: body.velocity.y });
            }

            // Anti-stuck nudge: if almost stationary
            const speed = Math.hypot(body.velocity.x, body.velocity.y);
            if (speed < 0.05) {
                const nudgeX = (Math.random() - 0.5) * 0.00005;
                const nudgeY = 0.0001;
                Body.applyForce(body, body.position, { x: nudgeX, y: nudgeY });
            }
            
            // Oscillation and stuck detection
            const positionChange = Math.hypot(body.position.x - ballObj.lastPosition.x, body.position.y - ballObj.lastPosition.y);
            
            // Update position tracking
            ballObj.lastPosition = { x: body.position.x, y: body.position.y };
            
            // If ball is moving very little vertically (stuck/oscillating)
            if (Math.abs(body.velocity.y) < 0.5 && body.position.y > 150) {
                ballObj.stuckTimer++;
                
                // After being stuck for too long, apply emergency escape
                if (ballObj.stuckTimer > 60) { // ~1 second at 60fps
                    const escapeForce = 0.002 * body.mass;
                    Body.applyForce(body, body.position, { x: 0, y: escapeForce });
                    ballObj.stuckTimer = 0; // Reset timer
                }
            } else {
                ballObj.stuckTimer = 0; // Reset if moving normally
            }
            
            // If ball has bounced too many times, reduce bounce strength
            if (ballObj.pegCollisionCount > 15) {
                // Dampen excessive bouncing
                if (Math.abs(body.velocity.x) > 2) {
                    Body.setVelocity(body, { x: body.velocity.x * 0.8, y: body.velocity.y });
                }
            }
        }
    });
}

// Modified ball landing handler - uses server-confirmed data
function handlePlinkoBallLanding(ball, bucketIdx, isForced = false) {
    // Note: hasLanded is already set to true before calling this function
    // to prevent double processing at the collision detection level
    
    console.log(`🎯 handlePlinkoBallLanding called: bucket ${bucketIdx}, target ${ball.targetBucketIdx}, win $${ball.serverWinAmount}`);
    
    // Clear timeout if it exists
    if (ball.timeoutId) {
        clearTimeout(ball.timeoutId);
        ball.timeoutId = null;
    }
    
    // Use the predetermined bucket index from the server
    const actualBucketIdx = ball.targetBucketIdx !== null ? ball.targetBucketIdx : bucketIdx;
    const multiplier = plinkoState.multipliers[actualBucketIdx];
    
    // Use server-confirmed win amount (already calculated on server)
    const winAmount = ball.serverWinAmount;
    
    if (isForced) {
        console.log(`⚠️ Ball forced to land in bucket ${actualBucketIdx} (timeout), server win: $${winAmount}`);
    } else {
        console.log(`✅ Ball landed in bucket ${bucketIdx}, predetermined was ${ball.targetBucketIdx}, using ${actualBucketIdx} for display, server win: $${winAmount}`);
    }

    // INSTANT WIN UPDATE: Add win amount immediately for instant feedback
    const balanceBeforeWin = currentUser.balance;
    currentUser.balance += winAmount;
    console.log(`💰 Instant win: +$${winAmount} (${balanceBeforeWin} → ${currentUser.balance})`);
    
    // RECONCILE: If we have expected final balance from server, use it as source of truth
    if (ball.expectedFinalBalance !== undefined) {
        console.log(`💰 Server reconciliation: ${currentUser.balance} → ${ball.expectedFinalBalance}`);
        currentUser.balance = ball.expectedFinalBalance;
    }
    
    updateUserInterface();
    
    // Show visual notification - consider it a win if we got any money back (multiplier > 0)
    const colors = getBucketColor(multiplier);
    const isWin = winAmount > 0; // Any positive win amount counts as a win
    showGameNotification(isWin, winAmount, null, colors, multiplier);
    plinkoState.bucketAnimations[actualBucketIdx] = { start: Date.now(), won: isWin };
    
    // Continue autobet if active
    if (plinkoAutobet.isActive) {
        continuePlinkoAutobet(isWin, winAmount - ball.betAmount);
    }

    // Clean up the ball properly
    ball.cleanup();
    const ballIndex = plinkoState.balls.indexOf(ball);
    if (ballIndex > -1) {
        plinkoState.balls.splice(ballIndex, 1);
    }
}

// Plinko ball class using Matter.js
class PlinkoBall {
    constructor(x, y, betAmount, targetBucketIdx = null, serverWinAmount = 0) {
        const { Bodies, World, Body } = MatterModules;
        this.betAmount = betAmount;
        this.targetBucketIdx = targetBucketIdx;
        this.serverWinAmount = serverWinAmount; // Store server-confirmed win amount
        this.radius = plinkoState.currentBallSize / 2;
        this.hasLanded = false;
        this.lastPegCollision = 0; // Cooldown for peg collisions
        this.pegCollisionCount = 0; // Track total collisions
        this.lastPosition = { x: x, y: y }; // Track position for oscillation detection
        this.stuckTimer = 0; // Timer for detecting stuck balls
        this.timeoutId = null; // For cleanup

        if (!engine || !engine.world) {
            throw new Error('Physics engine not initialized');
        }

        this.body = Bodies.circle(x, y, this.radius, {
            restitution: 0.9,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0.002,
            label: 'ball',
            collisionFilter: {
                category: collisionCategories.ball,
                mask: collisionCategories.peg | collisionCategories.bucket | collisionCategories.wall
            }
        });
        
        const startForce = 0.0005; // Smaller initial horizontal randomness for straighter drop
        const force = {
            x: (Math.random() - 0.5) * startForce,
            y: 0
        };
        Body.applyForce(this.body, this.body.position, force);

        World.add(engine.world, this.body);
    }
    
    get x() { return this.body.position.x; }
    get y() { return this.body.position.y; }
    
    // Cleanup method
    cleanup() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.body && engine && engine.world) {
            MatterModules.World.remove(engine.world, this.body);
        }
    }
}

function plinkoGameLoop() {
    if (!plinkoCtx || !plinkoCanvas) return;
    
    plinkoCtx.clearRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);
    
    // Draw Pegs with hit animations
    for (const peg of plinkoState.pegs) {
        const pegRadius = plinkoState.currentPegSize / 2;
        plinkoCtx.beginPath();
        plinkoCtx.arc(peg.position.x, peg.position.y, pegRadius, 0, 2 * Math.PI);
        plinkoCtx.fillStyle = '#6b7280';
        plinkoCtx.fill();

        const anim = plinkoState.pegAnimations[peg.id];
        if (anim) {
            const elapsed = Date.now() - anim.startTime;
            const duration = 250;
            if (elapsed > duration) {
                delete plinkoState.pegAnimations[peg.id];
            } else {
                const progress = elapsed / duration;
                const scale = 1 + 0.6 * Math.sin(progress * Math.PI); // Pop effect
                plinkoCtx.save();
                plinkoCtx.translate(peg.position.x, peg.position.y);
                plinkoCtx.scale(scale, scale);
                plinkoCtx.translate(-peg.position.x, -peg.position.y);
                
                plinkoCtx.beginPath();
                plinkoCtx.arc(peg.position.x, peg.position.y, pegRadius, 0, 2 * Math.PI);
                plinkoCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                plinkoCtx.fill();

                plinkoCtx.restore();
            }
        }
    }
    
    // Draw Balls with original gradient
    for (const ball of plinkoState.balls) {
        plinkoCtx.beginPath();
        plinkoCtx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        const gradient = plinkoCtx.createRadialGradient(
            ball.x - ball.radius/3, ball.y - ball.radius/3, 0,
            ball.x, ball.y, ball.radius
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#d1d5db');
        plinkoCtx.fillStyle = gradient;
        plinkoCtx.fill();
        plinkoCtx.strokeStyle = '#9ca3af';
        plinkoCtx.lineWidth = 1;
        plinkoCtx.stroke();
    }
    
    // Draw Buckets and Animations
    const canvasScaleFactor = plinkoCanvas.width / 400; // Same base width as in setupPlinkoGame
    const fontSize = Math.max(12 * canvasScaleFactor, 8); // Scale font but maintain minimum size
    
    for (let i = 0; i < plinkoState.buckets.length; i++) {
        const bucket = plinkoState.buckets[i];
        const multiplier = plinkoState.multipliers[i];
        const colors = getBucketColor(multiplier);
        plinkoCtx.beginPath();
        const radius = 6 * canvasScaleFactor;
        plinkoCtx.roundRect(bucket.x, bucket.y, bucket.width, bucket.height, radius);
        plinkoCtx.fillStyle = colors.bg;
        plinkoCtx.fill();
        plinkoCtx.strokeStyle = colors.border;
        plinkoCtx.lineWidth = Math.max(2 * canvasScaleFactor, 1);
        plinkoCtx.stroke();
        
        // Draw multiplier text with scaled font
        plinkoCtx.fillStyle = colors.text;
        plinkoCtx.font = `bold ${fontSize}px Outfit`;
        plinkoCtx.textAlign = 'center';
        plinkoCtx.fillText(multiplier + 'x', bucket.x + bucket.width / 2, bucket.y + bucket.height / 2 + fontSize / 3);
        
        // Bucket animations
        const anim = plinkoState.bucketAnimations[i];
        if (anim) {
            const elapsed = Date.now() - anim.start;
            const duration = 600;
            if (elapsed > duration) {
                delete plinkoState.bucketAnimations[i];
            } else {
                const progress = elapsed / duration;
                const scale = 1 + (0.4 * (1 - progress));
                plinkoCtx.save();
                plinkoCtx.globalAlpha = 0.8 * (1 - progress);
                plinkoCtx.translate(bucket.x + bucket.width / 2, bucket.y + bucket.height / 2);
                plinkoCtx.scale(scale, scale);
                plinkoCtx.translate(-(bucket.x + bucket.width / 2), -(bucket.y + bucket.height / 2));
                plinkoCtx.beginPath();
                plinkoCtx.roundRect(bucket.x, bucket.y, bucket.width, bucket.height, radius);
                plinkoCtx.fillStyle = anim.won ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
                plinkoCtx.fill();
                plinkoCtx.restore();
            }
        }
    }
    
    // Cleanup any balls that might have escaped or are stuck
    for (let i = plinkoState.balls.length - 1; i >= 0; i--) {
        const ball = plinkoState.balls[i];
        
        // Get current canvas dimensions for calculations
        const canvasHeight = plinkoCanvas.logicalHeight || plinkoCanvas.height;
        const canvasWidth = plinkoCanvas.logicalWidth || plinkoCanvas.width;
        const baseCanvasWidth = 400;
        const canvasScaleFactor = canvasWidth / baseCanvasWidth;
        const bucketHeight = 40 * canvasScaleFactor;
        const bucketMarginFromBottom = 10;
        
        // Check if ball has fallen off screen
        if (ball.y > canvasHeight + 100) {
            console.warn('Ball fell off screen, forcing landing');
            handlePlinkoBallLanding(ball, ball.targetBucketIdx || 0, true);
            continue;
        }
        
        // Fallback detection: if ball is at bucket level but hasn't landed, find closest bucket
        if (!ball.hasLanded && ball.y >= (canvasHeight - bucketHeight - bucketMarginFromBottom - 10)) {
            let closestBucketIdx = 0;
            let closestDistance = Infinity;
            
            for (let j = 0; j < plinkoState.buckets.length; j++) {
                const bucket = plinkoState.buckets[j];
                const bucketCenterX = bucket.x + bucket.width / 2;
                const distance = Math.abs(ball.x - bucketCenterX);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestBucketIdx = j;
                }
            }
            
            console.warn(`⚠️ Ball reached bucket level without collision detection, forcing landing in closest bucket ${closestBucketIdx}`);
            handlePlinkoBallLanding(ball, closestBucketIdx, true);
            continue;
        }
        
        // Check for stuck balls (not moving for too long)
        const distanceMoved = Math.abs(ball.x - ball.lastPosition.x) + Math.abs(ball.y - ball.lastPosition.y);
        if (distanceMoved < 1) {
            ball.stuckTimer += 16; // Approximate frame time
            if (ball.stuckTimer > 5000) { // 5 seconds stuck
                console.warn('Ball appears stuck, forcing landing');
                handlePlinkoBallLanding(ball, ball.targetBucketIdx || 0, true);
                continue;
            }
        } else {
            ball.stuckTimer = 0;
            ball.lastPosition = { x: ball.x, y: ball.y };
        }
    }

    // Update dropping state
    if (plinkoState.balls.length === 0 && plinkoState.isDropping) {
        plinkoState.isDropping = false;
    }
    
    plinkoState.animationId = requestAnimationFrame(plinkoGameLoop);
}

// Set plinko rows
function setPlinkoRows(rows) {
    // Don't allow changes while dropping or balls are active
    if (plinkoState.isDropping || plinkoState.balls.length > 0) {
        return;
    }
    
    // Update active button - safely handle missing elements
    try {
        document.querySelectorAll('.bet-strategy-grid .strategy-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const rowBtn = document.getElementById(`rows-${rows}-btn`);
        if (rowBtn) {
            rowBtn.classList.add('active');
        }
        
        // Update config and display
        plinkoConfig.rows = rows;
        const rowsDisplay = document.getElementById('plinko-rows');
        if (rowsDisplay) {
            rowsDisplay.textContent = rows;
        }
    } catch (error) {
        console.warn('Rows UI elements not found:', error);
    }
    
    // Clear any existing balls and animations
    plinkoState.balls = [];
    plinkoState.bucketAnimations = {};
    
    // Cleanup tooltips
    cleanupPlinkoTooltips();
    
    // Recalculate game layout with new sizes
    setupPlinkoGame();
}

// Set plinko risk
function setPlinkoRisk(risk) {
    // Don't allow changes while dropping or balls are active
    if (plinkoState.isDropping || plinkoState.balls.length > 0) {
        return;
    }
    
    plinkoConfig.risk = risk;
    
    // Update UI - safely handle missing elements
    try {
        document.querySelectorAll('[id^="risk-"]').forEach(btn => {
            btn.classList.remove('active');
        });
        const riskBtn = document.getElementById(`risk-${risk}-btn`);
        if (riskBtn) {
            riskBtn.classList.add('active');
        }
    } catch (error) {
        console.warn('Risk UI elements not found:', error);
    }
    
    // Update multipliers if available
    if (plinkoMultipliers[risk] && plinkoMultipliers[risk][plinkoConfig.rows]) {
        plinkoState.multipliers = plinkoMultipliers[risk][plinkoConfig.rows];
    }
    
    // Clear any existing balls and animations
    plinkoState.balls = [];
    plinkoState.bucketAnimations = {};
    
    // Cleanup tooltips
    cleanupPlinkoTooltips();
    
    // Recalculate game layout
    setupPlinkoGame();
}

// Set plinko bet amount
function setPlinkoAmount(action) {
    const betInput = document.getElementById('plinko-bet-amount');
    if (!betInput) return;
    
    const currentBalance = currentUser ? Math.round(currentUser.balance * 100) / 100 : 0;
    let currentBet = Math.round(parseFloat(betInput.value || 0) * 100) / 100;
    
    switch(action) {
        case 'half':
            const halved = Math.round((currentBet / 2) * 100) / 100;
            betInput.value = Math.max(0.01, halved).toFixed(2);
            break;
        case 'double':
            const doubled = Math.round((currentBet * 2) * 100) / 100;
            betInput.value = Math.min(doubled, currentBalance).toFixed(2);
            break;
        case 'max':
            betInput.value = currentBalance.toFixed(2);
            break;
        case 'clear':
            betInput.value = '';
            break;
    }
}

// Drop a new ball - completely rewritten for proper sync
async function dropBall() {
    if (!currentUser || plinkoState.isDropping) return;
    
    // Rate limiting - prevent drops faster than 500ms
    const now = Date.now();
    if (now - plinkoState.lastDropTime < PLINKO_DROP_DEBOUNCE_MS) {
        console.log('Rate limited - please wait');
        return;
    }
    
    const betAmount = parseFloat(document.getElementById('plinko-bet-amount').value);
    
    if (!betAmount || betAmount <= 0) {
        showGameNotification(false, null, 'Please enter a valid bet amount');
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showGameNotification(false, null, 'Insufficient balance');
        return;
    }
    
    // Set dropping state immediately to prevent multiple calls
    plinkoState.isDropping = true;
    plinkoState.lastDropTime = now;
    
    // Store original balance for potential rollback
    const originalBalance = currentUser.balance;
    
    // OPTIMISTIC UPDATE: Deduct bet amount immediately for instant feedback
    console.log(`💰 Instant deduction: $${betAmount} (${originalBalance} → ${originalBalance - betAmount})`);
    currentUser.balance -= betAmount;
    updateUserInterface();
    
    try {
        // Make API call - server will validate and return actual result
        const response = await fetch(`${API_BASE_URL}/api/games/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameType: 'plinko',
                betAmount: betAmount,
                playerChoice: `${plinkoConfig.risk}-${plinkoConfig.rows}`,
                targetNumber: 0
            })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Server error');
        }

        // Server confirmed the game - now we can proceed
        console.log('✅ Server confirmed game:', data.result);
        
        // Parse game result
        let gameResult;
        if (typeof data.result.gameResult === 'string') {
            gameResult = JSON.parse(data.result.gameResult);
        } else {
            gameResult = data.result.gameResult;
        }
        
        const bucketIndex = gameResult.bucketIndex;
        const multiplier = gameResult.multiplier;
        const serverWinAmount = data.result.winAmount || 0;
        
        // RECONCILE: Use server balance as source of truth (handles any discrepancies)
        // Note: We don't update balance here since it will be updated when ball lands
        // We'll store the server balance on the ball object for final reconciliation
        
        if (data.result.newLevel !== undefined) {
            currentUser.level = data.result.newLevel;
        }
        if (data.result.experienceGained !== undefined) {
            currentUser.xp = (currentUser.xp || 0) + data.result.experienceGained;
        }

        // Update game stats locally
        if (typeof currentUser.gamesPlayed === 'number') {
            currentUser.gamesPlayed += 1;
        }
        if (data.result.won) {
            if (typeof currentUser.wins === 'number') currentUser.wins += 1;
            if (typeof currentUser.totalWon === 'number') currentUser.totalWon += serverWinAmount;
            if (typeof currentUser.currentWinStreak === 'number') {
                currentUser.currentWinStreak += 1;
                if (typeof currentUser.bestWinStreak === 'number' && currentUser.currentWinStreak > currentUser.bestWinStreak) {
                    currentUser.bestWinStreak = currentUser.currentWinStreak;
                }
            }
            if (typeof currentUser.bestWin === 'number' && serverWinAmount > currentUser.bestWin) {
                currentUser.bestWin = serverWinAmount;
            }
        } else {
            if (typeof currentUser.losses === 'number') currentUser.losses += 1;
            if (typeof currentUser.currentWinStreak === 'number') currentUser.currentWinStreak = 0;
        }

        // Update UI with server data
        updateUserInterface();
        
        // NOW create the ball with server-confirmed data
        const logicalWidth = plinkoCanvas.logicalWidth || plinkoCanvas.width;
        const ball = new PlinkoBall(logicalWidth / 2, 10, betAmount, bucketIndex, serverWinAmount);
        ball.expectedFinalBalance = data.result.balanceAfter; // Store server balance for reconciliation
        plinkoState.balls.push(ball);
        
        // Set a timeout to force ball landing if physics fails
        ball.timeoutId = setTimeout(() => {
            if (!ball.hasLanded && plinkoState.balls.includes(ball)) {
                console.warn('⚠️ Ball timeout - forcing landing');
                handlePlinkoBallLanding(ball, bucketIndex, true);
            }
        }, 10000); // 10 second timeout
        
        console.log(`🎯 Ball created: Bucket ${bucketIndex}, Multiplier ${multiplier}x, Win: $${serverWinAmount}`);
        
        // Display provably fair data
        if (data.result.randomHash) {
            displayRandomHash(data.result.randomHash, data.result.randomTimestamp);
        }
        
        // Check for badges
        const newBadges = checkBadges(betAmount);
        if (newBadges.length > 0) {
            newBadges.forEach(badge => {
                setTimeout(() => {
                    showBadgeNotification(badge);
                }, 1000);
            });
            updateBadges();
        }
        
        // Level up notification
        if (data.result && data.result.leveledUp) {
            setTimeout(() => {
                showGameNotification(true, null, 
                    `Level Up! +${data.result.levelsGained} level(s)!`);
            }, 500);
        }
        
        // Update chart
        drawBalanceChart();
        
    } catch (error) {
        console.error('❌ Plinko API error:', error);
        
        // ROLLBACK: Restore original balance on error
        currentUser.balance = originalBalance;
        updateUserInterface();
        
        // Show error to user
        showGameNotification(false, null, error.message || 'Connection error. Please try again.');
    } finally {
        // Always clear dropping state
        plinkoState.isDropping = false;
    }
}

// Setup plinko autobet
function setupPlinkoAutobet() {
    const autoBetBtn = document.getElementById('plinko-auto-bet-btn');
    const autoBetSettings = document.getElementById('plinko-auto-bet-settings');
    const startAutoBetBtn = document.getElementById('plinko-start-auto-bet');
    const stopAutoBetBtn = document.getElementById('plinko-stop-auto-bet');
    
    if (!autoBetBtn) return;
    
    // Toggle auto bet settings
    autoBetBtn.addEventListener('click', () => {
        autoBetSettings.classList.toggle('show');
    });
    
    // Strategy buttons
    setupAutoBetStrategy('plinko-on-loss', 'loss');
    setupAutoBetStrategy('plinko-on-win', 'win');
    
    // Start auto bet
    startAutoBetBtn.addEventListener('click', startPlinkoAutobet);
    
    // Stop auto bet
    stopAutoBetBtn.addEventListener('click', stopPlinkoAutobet);
    
    // Infinite toggle
    const infiniteToggle = document.getElementById('plinko-infinite-bets-toggle');
    infiniteToggle.addEventListener('click', () => {
        plinkoAutobet.settings.isInfinite = !plinkoAutobet.settings.isInfinite;
        infiniteToggle.classList.toggle('active', plinkoAutobet.settings.isInfinite);
        document.getElementById('plinko-auto-bet-count').disabled = plinkoAutobet.settings.isInfinite;
    });
}

// Setup auto bet strategy
function setupAutoBetStrategy(prefix, type) {
    const resetBtn = document.getElementById(`${prefix}-reset`);
    const multiplyBtn = document.getElementById(`${prefix}-multiply`);
    const stopBtn = document.getElementById(`${prefix}-stop`);
    const settings = document.getElementById(`${prefix}-settings`);
    
    if (!resetBtn) return;
    
    [resetBtn, multiplyBtn, stopBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            [resetBtn, multiplyBtn, stopBtn].forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update settings
            plinkoAutobet.settings[`on${type.charAt(0).toUpperCase() + type.slice(1)}`] = btn.textContent.toLowerCase();
            
            // Show/hide multiplier input
            settings.style.display = btn === multiplyBtn ? 'block' : 'none';
        });
    });
}

// Start plinko autobet
function startPlinkoAutobet() {
    if (!currentUser || plinkoState.isDropping) return;
    
    const betAmount = parseFloat(document.getElementById('plinko-bet-amount').value);
    
    if (!betAmount || betAmount <= 0) {
        showGameNotification(false, null, 'Please enter a valid bet amount');
        return;
    }
    
    // Gather settings
    plinkoAutobet.settings.betCount = parseInt(document.getElementById('plinko-auto-bet-count').value) || 10;
    plinkoAutobet.settings.stopOnWin = parseFloat(document.getElementById('plinko-auto-stop-win').value) || null;
    plinkoAutobet.settings.stopOnLoss = parseFloat(document.getElementById('plinko-auto-stop-loss').value) || null;
    plinkoAutobet.settings.stopOnBalanceGain = parseFloat(document.getElementById('plinko-auto-stop-balance-gain').value) || null;
    plinkoAutobet.settings.stopOnBalanceLoss = parseFloat(document.getElementById('plinko-auto-stop-balance-loss').value) || null;
    plinkoAutobet.settings.lossMultiplier = parseFloat(document.getElementById('plinko-on-loss-multiplier').value) || 2.0;
    plinkoAutobet.settings.winMultiplier = parseFloat(document.getElementById('plinko-on-win-multiplier').value) || 2.0;
    
    // Initialize stats
    plinkoAutobet.stats = {
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        currentStreak: 0,
        longestStreak: 0,
        startBalance: currentUser.balance,
        baseBet: betAmount
    };
    
    plinkoAutobet.isActive = true;
    
    // Update UI
    document.getElementById('plinko-start-auto-bet').classList.add('hidden');
    document.getElementById('plinko-stop-auto-bet').classList.remove('hidden');
    document.getElementById('drop-ball-btn').disabled = true;
    
    // Start first bet
    dropBall();
}

// Stop plinko autobet
function stopPlinkoAutobet() {
    plinkoAutobet.isActive = false;
    
    // Update UI
    document.getElementById('plinko-start-auto-bet').classList.remove('hidden');
    document.getElementById('plinko-stop-auto-bet').classList.add('hidden');
    document.getElementById('drop-ball-btn').disabled = false;
    
    // Show final stats
    const { stats } = plinkoAutobet;
    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : '0.0';
    
    showGameNotification(stats.totalProfit > 0, stats.totalProfit, 
        `Autobet completed: ${stats.totalBets} bets, ${winRate}% win rate, ${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)} profit`);
}

// Continue plinko autobet after a game completes
function continuePlinkoAutobet(won, profit) {
    if (!plinkoAutobet.isActive) return;
    
    const { settings, stats } = plinkoAutobet;
    
    // Update stats
    stats.totalBets++;
    stats.totalProfit += profit;
    
    if (won) {
        stats.totalWins++;
        stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
    } else {
        stats.totalLosses++;
        stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
    }
    
    stats.longestStreak = Math.max(stats.longestStreak, Math.abs(stats.currentStreak));
    
    // Check stopping conditions
    if (shouldStopAutobet(won, profit)) {
        stopPlinkoAutobet();
        return;
    }
    
    // Adjust bet amount
    const currentBet = parseFloat(document.getElementById('plinko-bet-amount').value);
    let newBet = currentBet;
    
    if (won && settings.onWin === 'multiply') {
        newBet = currentBet * settings.winMultiplier;
    } else if (won && settings.onWin === 'reset') {
        newBet = stats.baseBet;
    }
    
    if (!won && settings.onLoss === 'multiply') {
        newBet = currentBet * settings.lossMultiplier;
    } else if (!won && settings.onLoss === 'reset') {
        newBet = stats.baseBet;
    }
    
    // Update bet amount
    document.getElementById('plinko-bet-amount').value = Math.min(newBet, currentUser.balance).toFixed(2);
    
    // Continue if conditions are met
    if ((!won && settings.onLoss === 'stop') || (won && settings.onWin === 'stop')) {
        stopPlinkoAutobet();
    } else {
        // Next bet after delay - wait for ball to land before next drop
        setTimeout(() => {
            if (plinkoAutobet.isActive && plinkoState.balls.length === 0) {
                dropBall();
            } else if (plinkoAutobet.isActive) {
                // If balls still exist, wait a bit more
                setTimeout(() => {
                    if (plinkoAutobet.isActive) dropBall();
                }, 500);
            }
        }, PLINKO_DROP_DEBOUNCE_MS + 200); // Extra buffer for autobet
    }
}

// Should stop autobet helper
function shouldStopAutobet(won, profit) {
    const { settings, stats } = plinkoAutobet;
    
    // Check bet count
    if (!settings.isInfinite && stats.totalBets >= settings.betCount) {
        showGameNotification(profit >= 0, profit, 'Auto bet completed!');
        return true;
    }
    
    // Check stop conditions
    if (settings.stopOnWin > 0 && stats.totalProfit >= settings.stopOnWin) {
        showGameNotification(true, profit, 'Stop win reached!');
        return true;
    }
    
    if (settings.stopOnLoss > 0 && stats.totalProfit <= -settings.stopOnLoss) {
        showGameNotification(false, profit, 'Stop loss reached!');
        return true;
    }
    
    const balanceChange = ((currentUser.balance - stats.startBalance) / stats.startBalance) * 100;
    
    if (settings.stopOnBalanceGain > 0 && balanceChange >= settings.stopOnBalanceGain) {
        showGameNotification(true, profit, 'Balance gain target reached!');
        return true;
    }
    
    if (settings.stopOnBalanceLoss > 0 && balanceChange <= -settings.stopOnBalanceLoss) {
        showGameNotification(false, profit, 'Balance loss limit reached!');
        return true;
    }
    
    return false;
}

// Helper to map multiplier to color
function getBucketColor(multiplier) {
    if (multiplier >= 10) return { bg: 'rgba(239, 68, 68, 0.3)', border: 'rgba(239, 68, 68, 0.8)', text: '#ef4444' }; // red
    if (multiplier >= 5)  return { bg: 'rgba(245, 158, 11, 0.3)', border: 'rgba(245, 158, 11, 0.8)', text: '#f59e0b' }; // orange
    if (multiplier >= 2)  return { bg: 'rgba(34, 197, 94, 0.3)',  border: 'rgba(34, 197, 94, 0.8)',  text: '#22c55e' }; // green
    if (multiplier >= 1)  return { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 0.8)', text: '#3b82f6' }; // blue
    return { bg: 'rgba(107, 114, 128, 0.3)', border: 'rgba(107, 114, 128, 0.8)', text: '#6b7280' }; // grey
}

// Calculate probability distribution for Plinko buckets
function calculateBucketProbabilities(rows) {
    const bucketCount = rows + 1;
    const probabilities = new Array(bucketCount).fill(0);
    const trials = 1000000; // Large number of trials for accuracy
    
    // Calculate binomial probabilities directly
    for (let bucketIdx = 0; bucketIdx < bucketCount; bucketIdx++) {
        // For each bucket, calculate the probability of getting exactly k heads in n flips
        // where k is the bucket index and n is the number of rows
        const k = bucketIdx; // Number of "rights" needed to reach this bucket
        const n = rows; // Number of rows (coin flips)
        
        // Calculate binomial coefficient (n choose k) * 0.5^n
        let prob = 1;
        for (let i = 0; i < k; i++) {
            prob *= (n - i) / (k - i);
        }
        prob *= Math.pow(0.5, n); // Multiply by 0.5^n since each flip has 50% chance
        
        probabilities[bucketIdx] = (prob * 100).toFixed(4);
    }
    
    return probabilities;
}

// Add cleanup function
function cleanupPlinkoTooltips() {
    // Remove all existing tooltips
    const tooltips = document.querySelectorAll('[id^="bucket-tooltip-"]');
    tooltips.forEach(tooltip => {
        tooltip.parentElement.removeChild(tooltip);
    });

    // Remove the fixed tooltip
    const fixedTooltip = document.getElementById('plinko-probability-tooltip');
    if (fixedTooltip) {
        fixedTooltip.parentElement.removeChild(fixedTooltip);
    }
}

// Add this new function for handling bucket hover
function handlePlinkoHover(event) {
    const tooltip = document.getElementById('plinko-probability-tooltip');
    if (!tooltip) return;

    const rect = plinkoCanvas.getBoundingClientRect();
    const logicalWidth = plinkoCanvas.logicalWidth || plinkoCanvas.width;
    const logicalHeight = plinkoCanvas.logicalHeight || plinkoCanvas.height;
    
    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    let hoveredBucket = null;
    for (let i = 0; i < plinkoState.buckets.length; i++) {
        const bucket = plinkoState.buckets[i];
        if (x >= bucket.x && x <= bucket.x + bucket.width &&
            y >= bucket.y && y <= bucket.y + bucket.height) {
            hoveredBucket = bucket;
            break;
        }
    }

    if (hoveredBucket) {
        const probability = plinkoState.bucketProbabilities[hoveredBucket.index];
        const multiplier = plinkoState.multipliers[hoveredBucket.index];
        tooltip.textContent = `Bucket ${hoveredBucket.index + 1}: ${probability}% chance | ${multiplier}x multiplier`;
        tooltip.style.opacity = '1';
    } else {
        tooltip.style.opacity = '0';
    }
}

function handlePlinkoMouseLeave() {
    const tooltip = document.getElementById('plinko-probability-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
    }
}

// Constants
const MINES_REQUEST_DEBOUNCE_MS = 500;
const MINES_REVEAL_DELAY_MS = 300;  // Delay between revealing tiles
const MINES_RETRY_DELAY_MS = 1000;  // Delay before retrying on rate limit
const MINES_MAX_RETRIES = 3;       // Maximum number of retries for rate limited requests

// Helper for handling rate limits
async function handleRateLimit(operation, maxRetries = MINES_MAX_RETRIES) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await operation();
        } catch (error) {
            if (error.message && error.message.includes('Too many')) {
                retries++;
                if (retries < maxRetries) {
                    console.log(`Rate limited, retry ${retries}/${maxRetries} in ${MINES_RETRY_DELAY_MS}ms`);
                    await new Promise(resolve => setTimeout(resolve, MINES_RETRY_DELAY_MS));
                    continue;
                }
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}
const AUTH_REQUEST_DEBOUNCE_MS = 2000; // Auth endpoints need more aggressive rate limiting

// Rate limiting for auth requests
const authRequestLimiter = {
    lastLoginTime: 0,
    lastCheckTime: 0,
    isRateLimited: false,
    
    canMakeRequest(type) {
        const now = Date.now();
        const lastTime = type === 'login' ? this.lastLoginTime : this.lastCheckTime;
        
        if (this.isRateLimited) {
            return false;
        }
        
        if (now - lastTime < AUTH_REQUEST_DEBOUNCE_MS) {
            return false;
        }
        
        if (type === 'login') {
            this.lastLoginTime = now;
        } else {
            this.lastCheckTime = now;
        }
        return true;
    },
    
    handleTooManyRequests() {
        this.isRateLimited = true;
        setTimeout(() => {
            this.isRateLimited = false;
        }, 5000); // Wait 5 seconds before allowing new requests
    }
};

// Mines Game Implementation
const minesState = {
    isLoading: false,
    gameId: null,
    gameActive: false,
    revealedTiles: 0,
    mineCount: 3,
    currentMultiplier: 1.0,
    currentProfit: 0,
    betAmount: 0,
    tiles: [],
    mines: [],
    lastRequestTime: 0
};

const minesAutobet = {
    isActive: false,
    settings: {
        betCount: 10,
        isInfinite: false,
        stopOnWin: 0,
        stopOnLoss: 0,
        autoRevealCount: 3,
        onWin: 'reset',
        onLoss: 'reset',
        winMultiplier: 2.0,
        lossMultiplier: 2.0
    },
    stats: {
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        startBalance: 0,
        baseBet: 0,
        currentStreak: 0,
        longestStreak: 0
    }
};

// Initialize mines game
function initializeMinesGame() {
    setupMinesGrid();
    setupMinesControls();
    setupMinesAutobet();
    updateMinesStats();
}

// Setup mines grid (5x5)
function setupMinesGrid() {
    const grid = document.getElementById('mines-grid');
    grid.innerHTML = '';
    
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('div');
        tile.className = 'mines-tile';
        tile.dataset.index = i;
        tile.addEventListener('click', () => {
            if (minesPattern.isPatternMode) {
                togglePatternTile(i);
            } else {
                revealTile(i);
            }
        });
        grid.appendChild(tile);
    }
    
    minesState.tiles = Array.from(grid.children);
}

function togglePatternTile(index) {
    const tile = document.querySelector(`.mines-tile[data-index="${index}"]`);
    if (!tile) return;

    if (minesPattern.selectedTiles.has(index)) {
        minesPattern.selectedTiles.delete(index);
        tile.classList.remove('pattern-selected');
    } else {
        minesPattern.selectedTiles.add(index);
        tile.classList.add('pattern-selected');
        
        // Update auto reveal count to match selected tiles
        document.getElementById('mines-auto-reveal-count').value = minesPattern.selectedTiles.size;
    }
}

// Setup mines controls
function setupMinesControls() {
    // Mine count slider
    const slider = document.getElementById('mines-count-slider');
    const valueDisplay = document.getElementById('mines-count-value');
    
    slider.addEventListener('input', (e) => {
        if (minesState.gameActive || minesState.isLoading) {
            e.preventDefault();
            return;
        }
        const count = parseInt(e.target.value);
        minesState.mineCount = count;
        valueDisplay.textContent = count;
        document.getElementById('mines-count').textContent = count;
        updateMinesStats();
    });
    
    // Auto bet button
    const autoBetBtn = document.getElementById('mines-auto-bet-btn');
    const autoBetSettings = document.getElementById('mines-auto-bet-settings');
    
    autoBetBtn.addEventListener('click', () => {
        autoBetSettings.classList.toggle('show');
    });
    
    // Strategy buttons
    setupMinesAutoBetStrategy('mines-on-loss', 'loss');
    setupMinesAutoBetStrategy('mines-on-win', 'win');
    
    // Start/stop auto bet
    document.getElementById('mines-start-auto-bet').addEventListener('click', startMinesAutobet);
    document.getElementById('mines-stop-auto-bet').addEventListener('click', stopMinesAutobet);
    
    // Infinite toggle
    const infiniteToggle = document.getElementById('mines-infinite-bets-toggle');
    infiniteToggle.addEventListener('click', () => {
        minesAutobet.settings.isInfinite = !minesAutobet.settings.isInfinite;
        infiniteToggle.classList.toggle('active', minesAutobet.settings.isInfinite);
        document.getElementById('mines-auto-bet-count').disabled = minesAutobet.settings.isInfinite;
    });

    // Pattern mode toggle
    const patternToggle = document.getElementById('mines-pattern-toggle');
    patternToggle.addEventListener('click', () => {
        minesPattern.isPatternMode = !minesPattern.isPatternMode;
        patternToggle.classList.toggle('active', minesPattern.isPatternMode);
        
        // Clear pattern when disabling pattern mode
        if (!minesPattern.isPatternMode) {
            minesPattern.selectedTiles.clear();
            document.querySelectorAll('.mines-tile').forEach(tile => {
                tile.classList.remove('pattern-selected');
            });
        }
    });
}

// Setup auto bet strategy for mines
function setupMinesAutoBetStrategy(prefix, type) {
    const resetBtn = document.getElementById(`${prefix}-reset`);
    const multiplyBtn = document.getElementById(`${prefix}-multiply`);
    const stopBtn = document.getElementById(`${prefix}-stop`);
    const settings = document.getElementById(`${prefix}-settings`);
    
    if (!resetBtn) return;
    
    const buttons = [resetBtn, multiplyBtn, stopBtn];
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const strategy = btn.id.includes('reset') ? 'reset' : 
                           btn.id.includes('multiply') ? 'multiply' : 'stop';
            
            if (type === 'loss') {
                minesAutobet.settings.onLoss = strategy;
            } else {
                minesAutobet.settings.onWin = strategy;
            }
            
            // Show/hide multiplier input
            if (strategy === 'multiply') {
                settings.classList.add('show');
            } else {
                settings.classList.remove('show');
            }
        });
    });
    
    // Update multiplier values
    const multiplierInput = document.getElementById(`${prefix}-multiplier`);
    if (multiplierInput) {
        multiplierInput.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value) || 2.0;
            if (type === 'loss') {
                minesAutobet.settings.lossMultiplier = value;
            } else {
                minesAutobet.settings.winMultiplier = value;
            }
        });
    }
}

// Start mines game
async function startMinesGame() {
    if (minesState.gameActive) return;
    
    // Rate limiting - prevent requests more frequent than debounce time
    const now = Date.now();
    if (now - minesState.lastRequestTime < MINES_REQUEST_DEBOUNCE_MS) {
        console.log('Rate limited - please wait');
        return;
    }
    
    const betAmount = parseFloat(document.getElementById('mines-bet-amount').value);
    
    if (!betAmount || betAmount <= 0) {
        showGameNotification(false, null, 'Please enter a valid bet amount');
        if (minesAutobet.isActive) {
            stopMinesAutobet();
        }
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showGameNotification(false, null, 'Insufficient balance');
        if (minesAutobet.isActive) {
            stopMinesAutobet();
        }
        return;
    }
    
    // Set state immediately to prevent multiple calls
    minesState.isLoading = true;
    minesState.lastRequestTime = now;
    
    try {
        // Store original balance for potential rollback
        const originalBalance = currentUser.balance;
        
        // OPTIMISTIC UPDATE: Deduct bet amount immediately for instant feedback
        console.log(`💰 Instant deduction: $${betAmount} (${originalBalance} → ${originalBalance - betAmount})`);
        currentUser.balance -= betAmount;
        updateUserInterface();
        
        const data = await handleRateLimit(async () => {
            const response = await fetch(`${API_BASE_URL}/api/games/play`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    gameType: 'mines',
                    betAmount: betAmount,
                    playerChoice: minesState.mineCount.toString(),
                    targetNumber: 0
                })
            });
            
            if (response.status === 429) {
                throw new Error('Too many requests');
            }
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Server error');
            }
            
            return data;
        });
        
        console.log('✅ Mines game started:', data.result);
        
        // Parse game result
        let gameResult;
        if (typeof data.result.gameResult === 'string') {
            gameResult = JSON.parse(data.result.gameResult);
        } else {
            gameResult = data.result.gameResult;
        }
        
        // Initialize game state
        minesState.gameId = data.result._id;
        minesState.gameActive = true;
        minesState.revealedTiles = 0;
        minesState.currentMultiplier = gameResult.multiplier;
        minesState.betAmount = betAmount;
        minesState.mines = gameResult.mines;
        minesState.currentProfit = 0;
        minesState.gridState = gameResult.gridState;
        minesState.gridHash = gameResult.gridHash;
        minesState.pendingRevealedTiles = new Set(); // Track tiles revealed client-side
        minesState.serverVerified = false; // Track if server has verified our moves
        
        // Reset and activate tiles with animation
        minesState.tiles.forEach((tile, index) => {
            tile.className = 'mines-tile';
            tile.innerHTML = '';
            // Add active class immediately
            tile.classList.add('active');
            // Restore pattern selection if in pattern mode
            if (minesPattern.isPatternMode && minesPattern.selectedTiles.has(index)) {
                tile.classList.add('pattern-selected');
            }
        });
        
        // Update UI
        updateMinesStats();
        document.getElementById('mines-start-btn').style.display = 'none';
        document.getElementById('mines-cashout-btn').style.display = 'inline-block';
        document.getElementById('mines-count-slider').disabled = true;
        
        // Display provably fair data
        if (data.result.randomHash) {
            displayRandomHash(data.result.randomHash, data.result.randomTimestamp);
        }
        
    } catch (error) {
        console.error('❌ Mines start error:', error);
        showGameNotification(false, null, error.message || 'Connection error. Please try again.');
        
        // Rollback balance on error
        if (originalBalance !== undefined) {
            currentUser.balance = originalBalance;
            updateUserInterface();
        }
    } finally {
        // Re-enable controls if game failed to start
        if (!minesState.gameActive) {
            minesState.isLoading = false;
            document.getElementById('mines-start-btn').disabled = false;
            document.getElementById('mines-bet-amount').disabled = false;
            document.querySelectorAll('.mines-control-btn').forEach(btn => btn.disabled = false);
        }
    }
}

// Reveal a tile
async function revealTile(tileIndex) {
    // Add check for game active state and revealing animation
    if (!minesState.gameActive || 
        minesState.tiles[tileIndex].classList.contains('revealed') ||
        minesState.tiles[tileIndex].classList.contains('revealing') ||
        minesState.pendingRevealedTiles.has(tileIndex)) {
        return;
    }
    
    const tile = minesState.tiles[tileIndex];
    
    // Add revealing animation
    tile.classList.add('revealing');
    
    // Check against local grid state
    const hitMine = minesState.gridState[tileIndex];
    
    // Add to pending revealed tiles
    minesState.pendingRevealedTiles.add(tileIndex);
    
    // Calculate new multiplier locally
    const revealedTiles = minesState.pendingRevealedTiles.size;
    const mineCount = minesState.mines.length;
    const totalTiles = 25;
    const safeTiles = totalTiles - mineCount;
    
    // Calculate probability of revealing N safe tiles
    let multiplier = 1;
    for (let i = 0; i < revealedTiles; i++) {
        const remainingSafeTiles = safeTiles - i;
        const remainingTiles = totalTiles - i;
        const probability = remainingSafeTiles / remainingTiles;
        multiplier *= (1 / probability);
    }
    
    // Apply house edge (97% RTP)
    multiplier *= 0.97;
    multiplier = Math.max(multiplier, 0.01); // Minimum 0.01x multiplier
    
    setTimeout(() => {
        tile.classList.remove('revealing');
        
        if (hitMine) {
            // Hit a mine - game over
            // Set game state to inactive FIRST before revealing tiles
            minesState.gameActive = false;
            document.getElementById('mines-start-btn').style.display = 'inline-block';
            document.getElementById('mines-cashout-btn').style.display = 'none';
            document.getElementById('mines-count-slider').disabled = false;
            
            // Remove active state from all tiles BEFORE revealing
            minesState.tiles.forEach(t => t.classList.remove('active'));
            
            // Now reveal the hit mine
            tile.classList.add('revealed', 'mine');
            tile.innerHTML = '<i data-lucide="bomb"></i>';
            
            // Reveal all other mines
            minesState.gridState.forEach((isMine, idx) => {
                if (isMine && idx !== tileIndex) {
                    const mineTile = minesState.tiles[idx];
                    mineTile.classList.add('revealed', 'mine');
                    mineTile.innerHTML = '<i data-lucide="bomb"></i>';
                }
            });
            
            // Verify with server
            verifyGameState(tileIndex, true);
            
        } else {
            // Safe tile
            tile.classList.add('revealed', 'safe');
            tile.innerHTML = '<i data-lucide="gem"></i>';
            
            // Update game state
            minesState.revealedTiles = revealedTiles;
            minesState.currentMultiplier = multiplier;
            // Calculate profit: potential win minus bet amount
            minesState.currentProfit = (minesState.betAmount * multiplier) - minesState.betAmount;
            
            // Update UI with animations
            updateMinesStats(true);
        }
        
        // Re-initialize Lucide icons for new icons
        lucide.createIcons();
    }, 300);
}

// Verify game state with server
async function verifyGameState(lastRevealedTile, isGameOver = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/mines/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameId: minesState.gameId,
                revealedTiles: Array.from(minesState.pendingRevealedTiles),
                lastRevealedTile,
                gridHash: minesState.gridHash,
                isGameOver
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Server error');
        }
        
        // Update balance if game is over
        if (isGameOver) {
            currentUser.balance = data.result.balanceAfter;
            updateUserInterface();
            
            // Show notification with the actual loss amount
            showGameNotification(false, -minesState.betAmount, 'You hit a mine!', 
                { bg: 'rgba(239, 68, 68, 0.3)', border: 'rgba(239, 68, 68, 0.8)', text: '#ef4444' });
            
            // Continue autobet if active
            if (minesAutobet.isActive) {
                continueMinesAutobet(false, -minesState.betAmount);
            }
        }
        
        minesState.serverVerified = true;
        
    } catch (error) {
        console.error('❌ Mines verify error:', error);
        showGameNotification(false, null, error.message || 'Connection error. Please try again.');
    }
}

// Cash out mines game
async function cashOutMines() {
    if (!minesState.gameActive) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/mines/cashout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameId: minesState.gameId,
                revealedTiles: Array.from(minesState.pendingRevealedTiles),
                gridHash: minesState.gridHash
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Server error');
        }
        
        const result = data.result;
        
        // Update balance with the win amount from server
        currentUser.balance = result.balanceAfter;
        console.log('💰 Won bet, new balance:', result.balanceAfter);
        updateUserInterface();
        
        // Game complete
        minesState.gameActive = false;
        minesState.isLoading = false;
        
        // Re-enable all controls
        document.getElementById('mines-start-btn').style.display = 'inline-block';
        document.getElementById('mines-start-btn').disabled = false;
        document.getElementById('mines-cashout-btn').style.display = 'none';
        document.getElementById('mines-bet-amount').disabled = false;
        document.getElementById('mines-count-slider').disabled = false;
        document.querySelectorAll('.mines-control-btn').forEach(btn => btn.disabled = false);
        
        // Reveal all mines with animation
        minesState.gridState.forEach((isMine, index) => {
            if (isMine) {
                setTimeout(() => {
                    const mineTile = minesState.tiles[index];
                    if (!mineTile.classList.contains('revealed')) {
                        mineTile.classList.add('revealed', 'mine');
                        mineTile.innerHTML = '<i data-lucide="bomb"></i>';
                        lucide.createIcons();
                    }
                }, index * 100); // Stagger the reveal animations
            }
        });
        
        // Remove active state from all tiles
        minesState.tiles.forEach(tile => {
            tile.classList.remove('active');
        });
        
        // Show notification with profit
        const profit = result.winAmount - minesState.betAmount;
        showGameNotification(true, profit, null, 
            { bg: 'rgba(34, 197, 94, 0.3)', border: 'rgba(34, 197, 94, 0.8)', text: '#22c55e' }, 
            minesState.currentMultiplier);
        
        // Check for badges
        const newBadges = checkBadges(minesState.betAmount);
        if (newBadges.length > 0) {
            newBadges.forEach(badge => {
                showBadgeNotification(badge);
            });
        }
        
        // Continue autobet if active
        if (minesAutobet.isActive) {
            continueMinesAutobet(true, profit);
        }
        
    } catch (error) {
        console.error('❌ Mines cashout error:', error);
        showGameNotification(false, null, error.message || 'Connection error. Please try again.');
    }
}

// Update mines stats display
function updateMinesStats(animate = false) {
    document.getElementById('mines-count').textContent = minesState.mineCount;
    
    const multiplierEl = document.getElementById('mines-multiplier');
    const profitEl = document.getElementById('mines-profit');
    
    multiplierEl.textContent = `${minesState.currentMultiplier.toFixed(2)}x`;
    profitEl.textContent = `$${minesState.currentProfit.toFixed(2)}`;
    
    if (animate) {
        multiplierEl.classList.add('mines-multiplier-update');
        profitEl.classList.add('mines-profit-update');
        
        setTimeout(() => {
            multiplierEl.classList.remove('mines-multiplier-update');
            profitEl.classList.remove('mines-profit-update');
        }, 500);
    }
}

// Set mines bet amount
function setMinesAmount(action) {
    const input = document.getElementById('mines-bet-amount');
    const currentValue = parseFloat(input.value) || 0;
    
    switch (action) {
        case 'half':
            input.value = (currentValue / 2).toFixed(2);
            break;
        case 'double':
            input.value = Math.min(currentValue * 2, currentUser.balance).toFixed(2);
            break;
        case 'max':
            input.value = currentUser.balance.toFixed(2);
            break;
        case 'clear':
            input.value = '';
            break;
    }
}

// Setup mines autobet
function setupMinesAutobet() {
    // This is called from setupMinesControls, no additional setup needed here
}

// Start mines autobet
async function startMinesAutobet() {
    if (minesAutobet.isActive) return;
    
    const betCount = parseInt(document.getElementById('mines-auto-bet-count').value) || 10;
    const stopWin = parseFloat(document.getElementById('mines-auto-stop-win').value) || 0;
    const stopLoss = parseFloat(document.getElementById('mines-auto-stop-loss').value) || 0;
    const autoReveal = parseInt(document.getElementById('mines-auto-reveal-count').value) || 3;
    const baseBet = parseFloat(document.getElementById('mines-bet-amount').value) || 1;
    
    if (baseBet <= 0) {
        showGameNotification(false, null, 'Please enter a valid bet amount');
        return;
    }
    
    // Initialize autobet
    minesAutobet.isActive = true;
    minesAutobet.settings.betCount = betCount;
    minesAutobet.settings.stopOnWin = stopWin;
    minesAutobet.settings.stopOnLoss = stopLoss;
    minesAutobet.settings.autoRevealCount = autoReveal;
    
    // Store pattern if in pattern mode
    if (minesPattern.isPatternMode && minesPattern.selectedTiles.size > 0) {
        minesAutobet.settings.pattern = Array.from(minesPattern.selectedTiles).sort((a, b) => a - b);
    } else {
        minesAutobet.settings.pattern = null;
    }
    
    minesAutobet.stats = {
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        startBalance: currentUser.balance,
        baseBet: baseBet,
        currentStreak: 0,
        longestStreak: 0
    };
    
    // Update UI
    document.getElementById('mines-start-auto-bet').classList.add('hidden');
    document.getElementById('mines-stop-auto-bet').classList.remove('hidden');
    document.getElementById('mines-auto-bet-btn').classList.add('active');
    
    try {
        // If a game is in progress, cash it out first
        if (minesState.gameActive) {
            await cashOutMines();
        }
        
        // Start first game
        await startMinesGame();
        
        // Wait for game to be active
        if (!minesState.gameActive) {
            throw new Error('Game failed to start');
        }
        
        // Small delay to ensure game is ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get tiles to reveal
        const tilesToReveal = minesAutobet.settings.pattern && minesAutobet.settings.pattern.length > 0 
            ? minesAutobet.settings.pattern 
            : (() => {
                const autoReveal = minesAutobet.settings.autoRevealCount;
                const availableTiles = Array.from({length: 25}, (_, i) => i);
                const tiles = [];
                for (let i = 0; i < autoReveal; i++) {
                    const randomIndex = Math.floor(Math.random() * availableTiles.length);
                    tiles.push(availableTiles.splice(randomIndex, 1)[0]);
                }
                return tiles;
            })();
        
        // Reveal tiles one by one with proper delays
        for (const tileIndex of tilesToReveal) {
            if (!minesAutobet.isActive || !minesState.gameActive) break;
            
            try {
                // Wait before revealing next tile
                await new Promise(resolve => setTimeout(resolve, MINES_REVEAL_DELAY_MS));
                
                // Try to reveal tile with retries
                await handleRateLimit(async () => {
                    await revealTile(tileIndex);
                });
                
            } catch (error) {
                if (error.message.includes('Max retries exceeded')) {
                    console.error('❌ Rate limit retries exceeded, stopping autobet');
                    stopMinesAutobet();
                    return;
                }
                console.error('❌ Error revealing tile:', error);
                break;
            }
        }
        
        // If game is still active, cash out
        if (minesAutobet.isActive && minesState.gameActive) {
            try {
                await handleRateLimit(async () => {
                    await cashOutMines();
                });
            } catch (error) {
                console.error('❌ Error cashing out:', error);
                stopMinesAutobet();
            }
        }
        
    } catch (error) {
        console.error('❌ Error starting autobet:', error);
        stopMinesAutobet();
    }
}

// Stop mines autobet
function stopMinesAutobet() {
    minesAutobet.isActive = false;
    
    // Update UI
    document.getElementById('mines-start-auto-bet').classList.remove('hidden');
    document.getElementById('mines-stop-auto-bet').classList.add('hidden');
    document.getElementById('mines-auto-bet-btn').classList.remove('active');
    
    // Show final stats
    const { stats } = minesAutobet;
    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : '0.0';
    
    showGameNotification(stats.totalProfit > 0, stats.totalProfit, 
        `Autobet completed: ${stats.totalBets} bets, ${winRate}% win rate, ${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)} profit`);
}

// Continue mines autobet
function continueMinesAutobet(won, profit) {
    if (!minesAutobet.isActive) return;
    
    const { settings, stats } = minesAutobet;
    
    // Update stats
    stats.totalBets++;
    stats.totalProfit += profit;
    
    if (won) {
        stats.totalWins++;
        stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
    } else {
        stats.totalLosses++;
        stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
    }
    
    stats.longestStreak = Math.max(stats.longestStreak, Math.abs(stats.currentStreak));
    
    // Check stopping conditions
    if (shouldStopMinesAutobet(won, profit)) {
        stopMinesAutobet();
        return;
    }
    
    // Adjust bet amount based on win/loss
    const currentBet = parseFloat(document.getElementById('mines-bet-amount').value);
    let newBet = currentBet;
    
    if (won && settings.onWin === 'multiply') {
        newBet = currentBet * settings.winMultiplier;
    } else if (won && settings.onWin === 'reset') {
        newBet = stats.baseBet;
    }
    
    if (!won && settings.onLoss === 'multiply') {
        newBet = currentBet * settings.lossMultiplier;
    } else if (!won && settings.onLoss === 'reset') {
        newBet = stats.baseBet;
    }
    
    // Update bet amount and check if we can afford it
    newBet = Math.min(newBet, currentUser.balance);
    document.getElementById('mines-bet-amount').value = newBet.toFixed(2);
    
    if (newBet <= 0 || newBet > currentUser.balance) {
        showGameNotification(false, null, 'Insufficient balance for next bet');
        stopMinesAutobet();
        return;
    }
    
    // Stop if strategy says to stop
    if ((!won && settings.onLoss === 'stop') || (won && settings.onWin === 'stop')) {
        stopMinesAutobet();
        return;
    }
    
    // Start next game after delay
    setTimeout(async () => {
        if (!minesAutobet.isActive) return;
        
        // Start new game
        try {
            await startMinesGame();
            
            // Wait for game to be active
            if (!minesState.gameActive) {
                console.error('❌ Game failed to start');
                stopMinesAutobet();
                return;
            }
            
            // Small delay to ensure game is ready
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Get tiles to reveal
            const tilesToReveal = settings.pattern && settings.pattern.length > 0 
                ? settings.pattern 
                : (() => {
                    const autoReveal = settings.autoRevealCount;
                    const availableTiles = Array.from({length: 25}, (_, i) => i);
                    const tiles = [];
                    for (let i = 0; i < autoReveal; i++) {
                        const randomIndex = Math.floor(Math.random() * availableTiles.length);
                        tiles.push(availableTiles.splice(randomIndex, 1)[0]);
                    }
                    return tiles;
                })();
            
            // Reveal tiles one by one with proper delays
            for (const tileIndex of tilesToReveal) {
                if (!minesAutobet.isActive || !minesState.gameActive) break;
                
                try {
                    // Wait before revealing next tile
                    await new Promise(resolve => setTimeout(resolve, MINES_REVEAL_DELAY_MS));
                    
                    // Try to reveal tile with retries
                    await handleRateLimit(async () => {
                        await revealTile(tileIndex);
                    });
                    
                } catch (error) {
                    if (error.message.includes('Max retries exceeded')) {
                        console.error('❌ Rate limit retries exceeded, stopping autobet');
                        stopMinesAutobet();
                        return;
                    }
                    console.error('❌ Error revealing tile:', error);
                    break;
                }
            }
            
            // If game is still active, cash out with retries
            if (minesAutobet.isActive && minesState.gameActive) {
                try {
                    await handleRateLimit(async () => {
                        await cashOutMines();
                    });
                } catch (error) {
                    console.error('❌ Error cashing out:', error);
                    stopMinesAutobet();
                }
            }
            
        } catch (error) {
            console.error('❌ Error in autobet cycle:', error);
            stopMinesAutobet();
        }
    }, 800);
}

// Should stop mines autobet helper
function shouldStopMinesAutobet(won, profit) {
    const { settings, stats } = minesAutobet;
    
    // Check bet count
    if (!settings.isInfinite && stats.totalBets >= settings.betCount) {
        showGameNotification(profit >= 0, profit, 'Auto bet completed!');
        return true;
    }
    
    // Check stop conditions
    if (settings.stopOnWin > 0 && stats.totalProfit >= settings.stopOnWin) {
        showGameNotification(true, profit, 'Stop win reached!');
        return true;
    }
    
    if (settings.stopOnLoss > 0 && stats.totalProfit <= -settings.stopOnLoss) {
        showGameNotification(false, profit, 'Stop loss reached!');
        return true;
    }
    
    return false;
} 