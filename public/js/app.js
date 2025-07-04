// Global variables
let currentUser = null;
let socket = null;
let currentPage = 'login';

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

// Plinko game variables
let plinkoRows = 12;
let plinkoRisk = 'medium';
let isPlinkoDropping = false;
let plinkoAutoBetting = false;
let plinkoAutoConfig = {
    count: 10,
    infinite: false,
    stopOnWin: null,
    stopOnLoss: null,
    stopOnBalanceGain: null,
    stopOnBalanceLoss: null,
    onLossAction: 'reset',
    onWinAction: 'reset',
    onLossMultiplier: 2.0,
    onWinMultiplier: 2.0,
    currentCount: 0,
    initialBalance: 0,
    currentBet: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
};

// Plinko multipliers for different configurations
const plinkoMultipliers = {
    8: {
        low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
        medium: [13, 3, 1.3, 0.7, 0.7, 0.7, 0.7, 1.3, 3, 13],
        high: [29, 4, 1.5, 0.3, 0.2, 0.2, 0.3, 1.5, 4, 29]
    },
    10: {
        low: [8.9, 3, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3, 8.9],
        medium: [22, 4, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 4, 22],
        high: [43, 7, 2, 1.1, 1.0, 0.2, 1.0, 1.1, 2, 7, 43]
    },
    12: {
        low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
        medium: [33, 5, 2, 1.5, 1.1, 1.0, 0.5, 1.0, 1.1, 1.5, 2, 5, 33],
        high: [58, 9, 3, 1.3, 1.0, 0.7, 0.2, 0.7, 1.0, 1.3, 3, 9, 58]
    },
    14: {
        low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
        medium: [18, 5, 2.1, 1.6, 1.4, 1.2, 1.0, 0.5, 1.0, 1.2, 1.4, 1.6, 2.1, 5, 18],
        high: [110, 13, 3, 1.9, 1.2, 0.9, 0.7, 0.2, 0.7, 0.9, 1.2, 1.9, 3, 13, 110]
    },
    16: {
        low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
        medium: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
        high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
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
    
    // Initialize Plinko game
    initializePlinko();
    
    // Initialize notifications
    initializeNotifications();

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
    const username = document.getElementById('username').value.trim();
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    if (username.length < 3) {
        statusIndicator.classList.add('hidden');
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

        const data = await response.json();
        
        statusIndicator.classList.remove('hidden');
        if (data.exists) {
            statusIndicator.className = 'status-indicator login';
            statusText.textContent = 'User exists - will log in';
        } else {
            statusIndicator.className = 'status-indicator create';
            statusText.textContent = 'New user - will create account';
        }
    } catch (error) {
        console.error('Error checking user:', error);
        statusIndicator.classList.remove('hidden');
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = '⚠ Connection error - please try again';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
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

        const data = await response.json();

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
        showError('Connection error. Please try again.');
        console.error('Login error:', error);
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
    document.getElementById(pageId + '-page').classList.remove('hidden');

    // Update active navigation item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

    // Page-specific handling
    if (pageId === 'dashboard' && currentUser) {
        // Fetch fresh profile data to get updated balance history
        fetchUserProfile(true).then(() => {
            setTimeout(() => {
                drawBalanceChart();
                updateBadges(); // Update badges display
            }, 100);
        });
    } else if (pageId === 'plinko-game' && currentUser) {
        // Initialize Plinko board when page is shown
        setTimeout(() => {
            setupPlinkoBoard();
        }, 100);
    }
    
    // Initialize dice game when showing dice page
    if (pageId === 'dice-game') {
        setTimeout(() => {
            initializeDiceGame();
        }, 100);
    }
    
    // Reinitialize icons after page change
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 50);
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
            persistent = false
        } = options;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Create notification content
        const header = document.createElement('div');
        header.className = 'notification-header';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = this.getIcon(type);
        
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
            notification.appendChild(amountElement);
        }
        
        // Add progress bar for auto-dismiss
        if (!persistent && duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            progressBar.style.width = '100%';
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

function showGameNotification(isWin, amount, customMessage = null) {
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
        if (isWin) {
            notifications.success('You Won!', 'Congratulations on your win!', amount);
        } else {
            notifications.error('You Lost', 'Better luck next time!', amount);
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

// Initialize Plinko game
function initializePlinko() {
    setupPlinkoBoard();
    setupPlinkoAutobet();
}

// Setup Plinko board
function setupPlinkoBoard() {
    const board = document.getElementById('plinko-board');
    const multipliersContainer = document.getElementById('plinko-multipliers');
    
    if (!board || !multipliersContainer) return;

    // Clear existing content
    board.innerHTML = '';
    multipliersContainer.innerHTML = '';

    // Add drop zone
    const dropZone = document.createElement('div');
    dropZone.className = 'plinko-drop-zone';
    board.appendChild(dropZone);

    // Generate pegs
    const boardWidth = board.offsetWidth;
    const boardHeight = board.offsetHeight;
    const pegSpacing = boardWidth / (plinkoRows + 1);
    
    for (let row = 1; row <= plinkoRows; row++) {
        const pegsInRow = row + 1;
        const startX = (boardWidth - (pegsInRow - 1) * pegSpacing) / 2;
        const y = (row * (boardHeight - 60)) / (plinkoRows + 1);
        
        for (let peg = 0; peg < pegsInRow; peg++) {
            const pegElement = document.createElement('div');
            pegElement.className = 'plinko-peg';
            pegElement.style.left = `${startX + peg * pegSpacing}px`;
            pegElement.style.top = `${y}px`;
            board.appendChild(pegElement);
        }
    }

    // Generate multipliers
    const multipliers = plinkoMultipliers[plinkoRows][plinkoRisk];
    multipliers.forEach((multiplier, index) => {
        const multiplierElement = document.createElement('div');
        multiplierElement.className = 'plinko-multiplier';
        multiplierElement.textContent = `${multiplier}x`;
        multiplierElement.dataset.multiplier = multiplier;
        multiplierElement.dataset.index = index;
        
        // Add color class based on multiplier value
        if (multiplier >= 100) {
            multiplierElement.classList.add('ultra');
        } else if (multiplier >= 10) {
            multiplierElement.classList.add('high');
        } else if (multiplier >= 2) {
            multiplierElement.classList.add('medium');
        } else {
            multiplierElement.classList.add('low');
        }
        
        multipliersContainer.appendChild(multiplierElement);
    });
}

// Set Plinko rows
function setPlinkoRows(rows) {
    plinkoRows = rows;
    
    // Update active button
    document.querySelectorAll('[id^="rows-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`rows-${rows}`).classList.add('active');
    
    // Update display
    document.getElementById('plinko-rows').textContent = rows;
    
    // Rebuild board
    setupPlinkoBoard();
}

// Set Plinko risk
function setPlinkoRisk(risk) {
    plinkoRisk = risk;
    
    // Update active button
    document.querySelectorAll('[id^="risk-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`risk-${risk}`).classList.add('active');
    
    // Update display
    document.getElementById('plinko-risk').textContent = risk.charAt(0).toUpperCase() + risk.slice(1);
    
    // Rebuild board
    setupPlinkoBoard();
}

// Set Plinko bet amount
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

// Drop Plinko ball
async function dropPlinko() {
    if (!currentUser || isPlinkoDropping) return;
    
    const betAmount = parseFloat(document.getElementById('plinko-bet-amount').value);
    
    if (!betAmount || betAmount <= 0) {
        showGameNotification(false, 0, 'Please enter a valid bet amount');
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showGameNotification(false, 0, 'Insufficient balance');
        return;
    }
    
    isPlinkoDropping = true;
    
    // Update button state
    const dropBtn = document.getElementById('drop-plinko-btn');
    const btnText = document.getElementById('plinko-btn-text');
    dropBtn.disabled = true;
    btnText.textContent = 'Dropping...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameType: 'plinko',
                betAmount: betAmount,
                rows: plinkoRows,
                risk: plinkoRisk
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update current user data
            if (data.user) {
                currentUser = data.user;
            } else if (currentUser && data.result) {
                if (typeof data.result.balanceAfter !== 'undefined') {
                    currentUser.balance = data.result.balanceAfter;
                }
                if (typeof data.result.newLevel !== 'undefined') {
                    currentUser.level = data.result.newLevel;
                }
                if (typeof data.result.experienceGained !== 'undefined') {
                    currentUser.experience += data.result.experienceGained;
                }
                
                // Update game stats
                if (typeof currentUser.gamesPlayed === 'number') {
                    currentUser.gamesPlayed += 1;
                }
                if (data.result.won) {
                    if (typeof currentUser.wins === 'number') currentUser.wins += 1;
                    if (typeof currentUser.totalWon === 'number') currentUser.totalWon += data.result.winAmount;
                    if (typeof currentUser.currentStreak === 'number') currentUser.currentStreak += 1;
                    if (typeof currentUser.bestStreak === 'number') currentUser.bestStreak = Math.max(currentUser.bestStreak, currentUser.currentStreak);
                } else {
                    if (typeof currentUser.losses === 'number') currentUser.losses += 1;
                    if (typeof currentUser.totalLost === 'number') currentUser.totalLost += betAmount;
                    if (typeof currentUser.currentStreak === 'number') currentUser.currentStreak = 0;
                }
            }
            
            updateUserInterface();
            
            // Animate ball drop
            animatePlinkoball(data.result.path, data.result.multiplierIndex);
            
            // Display random hash
            if (data.result.hash) {
                displayRandomHash(data.result.hash, data.result.timestamp);
            }
            
            // Show result after animation
            setTimeout(() => {
                const profit = data.result.won ? data.result.winAmount - betAmount : 0;
                showGameNotification(data.result.won, profit);
                
                if (data.result && data.result.leveledUp) {
                    setTimeout(() => {
                        showGameNotification(true, null, 
                            `Level Up! +${data.result.levelsGained} level(s)!`);
                        fetchUserProfile(true);
                    }, 500);
                }
                
                drawBalanceChart();
                
                if (plinkoAutoBetting) {
                    continuePlinkoAutoBet(data.result.won, data.result.winAmount - betAmount);
                }
            }, 2000);
            
        } else {
            showGameNotification(false, 0, data.message || 'Game failed');
        }
    } catch (error) {
        console.error('Plinko game error:', error);
        showGameNotification(false, 0, 'Network error occurred');
    } finally {
        isPlinkoDropping = false;
        dropBtn.disabled = false;
        btnText.textContent = 'Drop Ball';
    }
}

// Animate Plinko ball
function animatePlinkoball(path, multiplierIndex) {
    const board = document.getElementById('plinko-board');
    const ball = document.createElement('div');
    ball.className = 'plinko-ball';
    
    // Start at drop zone
    ball.style.left = '50%';
    ball.style.top = '10px';
    ball.style.transform = 'translateX(-50%)';
    
    board.appendChild(ball);
    
    // Animate through path
    let step = 0;
    const animateStep = () => {
        if (step < path.length) {
            const pos = path[step];
            ball.style.left = `${pos.x}%`;
            ball.style.top = `${pos.y}%`;
            step++;
            setTimeout(animateStep, 150);
        } else {
            // Ball reached bottom, highlight multiplier
            const multipliers = document.querySelectorAll('.plinko-multiplier');
            if (multipliers[multiplierIndex]) {
                multipliers[multiplierIndex].classList.add('hit');
                setTimeout(() => {
                    multipliers[multiplierIndex].classList.remove('hit');
                }, 1000);
            }
            
            // Remove ball
            setTimeout(() => {
                ball.remove();
            }, 1000);
        }
    };
    
    setTimeout(animateStep, 300);
}

// Setup Plinko auto-bet
function setupPlinkoAutobet() {
    const autoBetBtn = document.getElementById('plinko-auto-bet-btn');
    const autoBetSettings = document.getElementById('plinko-auto-bet-settings');
    const startAutoBetBtn = document.getElementById('plinko-start-auto-bet');
    const stopAutoBetBtn = document.getElementById('plinko-stop-auto-bet');
    
    if (!autoBetBtn || !autoBetSettings || !startAutoBetBtn || !stopAutoBetBtn) return;
    
    // Toggle auto-bet settings
    autoBetBtn.addEventListener('click', () => {
        autoBetSettings.classList.toggle('show');
    });
    
    // Strategy button handlers
    setupPlinkoStrategyButtons();
    
    // Start auto-bet
    startAutoBetBtn.addEventListener('click', startPlinkoAutoBet);
    
    // Stop auto-bet
    stopAutoBetBtn.addEventListener('click', stopPlinkoAutoBet);
}

// Setup Plinko strategy buttons
function setupPlinkoStrategyButtons() {
    // On Loss strategy
    ['reset', 'multiply', 'stop'].forEach(action => {
        const btn = document.getElementById(`plinko-on-loss-${action}`);
        if (btn) {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[id^="plinko-on-loss-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                plinkoAutoConfig.onLossAction = action;
                
                const settings = document.getElementById('plinko-on-loss-settings');
                if (settings) {
                    settings.style.display = action === 'multiply' ? 'block' : 'none';
                }
            });
        }
    });
    
    // On Win strategy
    ['reset', 'multiply', 'stop'].forEach(action => {
        const btn = document.getElementById(`plinko-on-win-${action}`);
        if (btn) {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[id^="plinko-on-win-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                plinkoAutoConfig.onWinAction = action;
                
                const settings = document.getElementById('plinko-on-win-settings');
                if (settings) {
                    settings.style.display = action === 'multiply' ? 'block' : 'none';
                }
            });
        }
    });
    
    // Infinite toggle
    const infiniteToggle = document.getElementById('plinko-infinite-bets-toggle');
    if (infiniteToggle) {
        infiniteToggle.addEventListener('click', () => {
            plinkoAutoConfig.infinite = !plinkoAutoConfig.infinite;
            infiniteToggle.classList.toggle('active', plinkoAutoConfig.infinite);
            
            const countInput = document.getElementById('plinko-auto-bet-count');
            if (countInput) {
                countInput.disabled = plinkoAutoConfig.infinite;
            }
        });
    }
}

// Start Plinko auto-bet
function startPlinkoAutoBet() {
    if (!currentUser || plinkoAutoBetting) return;
    
    const betAmount = parseFloat(document.getElementById('plinko-bet-amount').value);
    if (!betAmount || betAmount <= 0) {
        showGameNotification(false, 0, 'Please enter a valid bet amount');
        return;
    }
    
    // Get auto-bet configuration
    plinkoAutoConfig.count = parseInt(document.getElementById('plinko-auto-bet-count').value) || 10;
    plinkoAutoConfig.stopOnWin = parseFloat(document.getElementById('plinko-auto-stop-win').value) || null;
    plinkoAutoConfig.stopOnLoss = parseFloat(document.getElementById('plinko-auto-stop-loss').value) || null;
    plinkoAutoConfig.stopOnBalanceGain = parseFloat(document.getElementById('plinko-auto-stop-balance-gain').value) || null;
    plinkoAutoConfig.stopOnBalanceLoss = parseFloat(document.getElementById('plinko-auto-stop-balance-loss').value) || null;
    plinkoAutoConfig.onLossMultiplier = parseFloat(document.getElementById('plinko-on-loss-multiplier').value) || 2.0;
    plinkoAutoConfig.onWinMultiplier = parseFloat(document.getElementById('plinko-on-win-multiplier').value) || 2.0;
    
    // Initialize auto-bet state
    plinkoAutoConfig.currentCount = 0;
    plinkoAutoConfig.initialBalance = currentUser.balance;
    plinkoAutoConfig.currentBet = betAmount;
    plinkoAutoConfig.consecutiveWins = 0;
    plinkoAutoConfig.consecutiveLosses = 0;
    
    plinkoAutoBetting = true;
    
    // Update UI
    document.getElementById('plinko-start-auto-bet').classList.add('hidden');
    document.getElementById('plinko-stop-auto-bet').classList.remove('hidden');
    document.getElementById('drop-plinko-btn').disabled = true;
    
    // Start auto-betting
    dropPlinko();
}

// Stop Plinko auto-bet
function stopPlinkoAutoBet() {
    plinkoAutoBetting = false;
    
    // Update UI
    document.getElementById('plinko-start-auto-bet').classList.remove('hidden');
    document.getElementById('plinko-stop-auto-bet').classList.add('hidden');
    document.getElementById('drop-plinko-btn').disabled = false;
}

// Continue Plinko auto-bet
function continuePlinkoAutoBet(won, profit) {
    if (!plinkoAutoBetting) return;
    
    plinkoAutoConfig.currentCount++;
    
    // Check stopping conditions
    if (!plinkoAutoConfig.infinite && plinkoAutoConfig.currentCount >= plinkoAutoConfig.count) {
        stopPlinkoAutoBet();
        showGameNotification(true, null, 'Auto-bet completed');
        return;
    }
    
    if (plinkoAutoConfig.stopOnWin && profit >= plinkoAutoConfig.stopOnWin) {
        stopPlinkoAutoBet();
        showGameNotification(true, null, 'Auto-bet stopped - win target reached');
        return;
    }
    
    if (plinkoAutoConfig.stopOnLoss && -profit >= plinkoAutoConfig.stopOnLoss) {
        stopPlinkoAutoBet();
        showGameNotification(false, null, 'Auto-bet stopped - loss limit reached');
        return;
    }
    
    const balanceChange = ((currentUser.balance - plinkoAutoConfig.initialBalance) / plinkoAutoConfig.initialBalance) * 100;
    if (plinkoAutoConfig.stopOnBalanceGain && balanceChange >= plinkoAutoConfig.stopOnBalanceGain) {
        stopPlinkoAutoBet();
        showGameNotification(true, null, 'Auto-bet stopped - balance gain target reached');
        return;
    }
    
    if (plinkoAutoConfig.stopOnBalanceLoss && -balanceChange >= plinkoAutoConfig.stopOnBalanceLoss) {
        stopPlinkoAutoBet();
        showGameNotification(false, null, 'Auto-bet stopped - balance loss limit reached');
        return;
    }
    
    // Apply win/loss strategy
    if (won) {
        plinkoAutoConfig.consecutiveWins++;
        plinkoAutoConfig.consecutiveLosses = 0;
        
        switch (plinkoAutoConfig.onWinAction) {
            case 'reset':
                plinkoAutoConfig.currentBet = parseFloat(document.getElementById('plinko-bet-amount').value);
                break;
            case 'multiply':
                plinkoAutoConfig.currentBet *= plinkoAutoConfig.onWinMultiplier;
                break;
            case 'stop':
                stopPlinkoAutoBet();
                showGameNotification(true, null, 'Auto-bet stopped - win condition met');
                return;
        }
    } else {
        plinkoAutoConfig.consecutiveLosses++;
        plinkoAutoConfig.consecutiveWins = 0;
        
        switch (plinkoAutoConfig.onLossAction) {
            case 'reset':
                plinkoAutoConfig.currentBet = parseFloat(document.getElementById('plinko-bet-amount').value);
                break;
            case 'multiply':
                plinkoAutoConfig.currentBet *= plinkoAutoConfig.onLossMultiplier;
                break;
            case 'stop':
                stopPlinkoAutoBet();
                showGameNotification(false, null, 'Auto-bet stopped - loss condition met');
                return;
        }
    }
    
    // Ensure bet doesn't exceed balance
    if (plinkoAutoConfig.currentBet > currentUser.balance) {
        stopPlinkoAutoBet();
        showGameNotification(false, null, 'Auto-bet stopped - insufficient balance');
        return;
    }
    
    // Update bet amount input
    document.getElementById('plinko-bet-amount').value = plinkoAutoConfig.currentBet.toFixed(2);
    
    // Continue auto-betting
    setTimeout(() => {
        dropPlinko();
    }, 1000);
} 