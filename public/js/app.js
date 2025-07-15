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



// API_BASE_URL is now defined in constants.js

// Chart variables are now managed by the unified chart system

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

// CLIENT_BADGES is now defined in constants.js

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

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.page) {
            showPage(event.state.page);
        }
    });

    // Handle window resize to redraw charts
    window.addEventListener('resize', () => {
        if (currentUser && currentUser.balanceHistory) {
            setTimeout(() => {
                drawBalanceChart();
            }, 100);
        }
    });

    // Handle chart container resize
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        const resizeObserver = new ResizeObserver(() => {
            if (currentUser && currentUser.balanceHistory) {
                setTimeout(() => {
                    drawBalanceChart();
                }, 100);
            }
        });
        resizeObserver.observe(chartContainer);
    }

    // Handle case opening animation resize
    window.addEventListener('resize', () => {
        if (window.currentCaseAnimation && window.currentCaseAnimation.reel) {
            // Recalculate animation dimensions on resize
            const animation = window.currentCaseAnimation.animation;
            const containerWidth = animation.offsetWidth;
            const isMobile = window.innerWidth <= 768;
            const itemWidth = isMobile ? 100 : 140;
            const itemGap = isMobile ? 15 : 20;
            
            // Update stored dimensions
            window.currentCaseAnimation.itemWidth = itemWidth;
            window.currentCaseAnimation.itemGap = itemGap;
        }
    });

    initializeMobileMenu();
    
    // Restore saved page if user is already logged in
    if (localStorage.getItem('token')) {
        const savedPage = localStorage.getItem('currentPage');
        if (savedPage && savedPage !== 'login') {
            // Set the current page but don't show it yet (will be shown after profile fetch)
            currentPage = savedPage;
        }
    }
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
    
    // Restore the last visited page or default to dashboard
    const savedPage = localStorage.getItem('currentPage');
    const pageToShow = savedPage && savedPage !== 'login' ? savedPage : 'dashboard';
    
    // If showing dashboard, ensure chart is initialized
    if (pageToShow === 'dashboard') {
        setTimeout(() => {
            initializeChart('dashboard');
        }, 50);
    }
    
    showPage(pageToShow);
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
            // Sync any localStorage badges to server and update display
            syncLocalStorageBadges();
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

// Sync localStorage badges to server (for migration)
async function syncLocalStorageBadges() {
    if (!currentUser) return;
    
    try {
        const localBadges = JSON.parse(localStorage.getItem(`badges_${currentUser.username}`) || '[]');
        
        if (localBadges.length > 0) {
            const response = await fetch(`${API_BASE_URL}/api/badges/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ clientBadges: localBadges })
            });
            
            const data = await response.json();
            
            if (data.success && data.syncedCount > 0) {
                console.log(`Synced ${data.syncedCount} badges to server`);
                // Clear localStorage badges after successful sync
                localStorage.removeItem(`badges_${currentUser.username}`);
            }
        }
    } catch (error) {
        console.error('Error syncing badges:', error);
    }
}

async function updateBadges() {
    const badgesGrid = document.getElementById('badges-grid');
    if (!badgesGrid || !currentUser) return;

    try {
        // Fetch earned badges from server
        const response = await fetch(`${API_BASE_URL}/api/badges`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
    badgesGrid.innerHTML = '';
    
            // Create a map of earned badges by code
            const earnedBadgeMap = new Map();
            data.badges.forEach(badge => {
                earnedBadgeMap.set(badge.code, badge);
            });
    
    // Sort badges: earned first, then non-secret locked, then secret
    const sortedBadges = CLIENT_BADGES.sort((a, b) => {
                const aEarned = earnedBadgeMap.has(a.code);
                const bEarned = earnedBadgeMap.has(b.code);
        
        if (aEarned && !bEarned) return -1;
        if (!aEarned && bEarned) return 1;
        
        if (a.secret && !b.secret) return 1;
        if (!a.secret && b.secret) return -1;
        
        return a.name.localeCompare(b.name);
    });

    sortedBadges.forEach(badge => {
                const earnedBadge = earnedBadgeMap.get(badge.code);
                const isEarned = !!earnedBadge;
        
        const badgeElement = document.createElement('div');
        badgeElement.className = `badge-item${badge.secret ? ' secret' : ''}${isEarned ? ' earned' : ' locked'}`;
        
        let earnedText = isEarned 
                    ? `Earned ${new Date(earnedBadge.earnedAt).toLocaleDateString()}`
            : 'Not earned yet';
        
                // For secret badges that are not earned, show as "???"
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
    } catch (error) {
        console.error('Error fetching badges:', error);
    }
}

function showPage(pageId) {
    // Save current page to localStorage
    localStorage.setItem('currentPage', pageId);
    currentPage = pageId;
    
    // Update browser history
    const state = { page: pageId };
    const url = `#${pageId}`;
    history.pushState(state, '', url);
    
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
        // Initialize dashboard chart first
        initializeChart('dashboard');
        
        // Fetch fresh profile data to get updated balance history
        fetchUserProfile(true).then(() => {
            setTimeout(() => {
                drawBalanceChart();
                updateBadges(); // Update badges display
            }, 200); // Increased delay to ensure canvas is ready
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
    
    // Initialize Leaderboard when showing the leaderboard page
    if (pageId === 'leaderboard') {
        setTimeout(() => {
            initializeLeaderboard();
        }, 100);
    }
    
    // Initialize Case System when showing cases or inventory pages
    if (pageId === 'cases' || pageId === 'inventory') {
        setTimeout(() => {
            initializeCaseSystem();
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

// Old drawBalanceChart function removed - now using unified chart system

// Old chart event handlers removed - now using unified chart system

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

// formatNumber and animateNumber are now defined in utils.js

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
                
                            // Check for new badges from server
            if (data.result.earnedBadges && data.result.earnedBadges.length > 0) {
                data.result.earnedBadges.forEach(badge => {
                        setTimeout(() => {
                            showBadgeNotification(badge);
                        }, 1000);
                    });
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
            
            // Check for new badges from server
            if (data.result.earnedBadges && data.result.earnedBadges.length > 0) {
                data.result.earnedBadges.forEach(badge => {
                    setTimeout(() => {
                        showBadgeNotification(badge);
                    }, 1000);
                });
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

// NotificationManager, showError, showBadgeNotification, and showGameNotification are now defined in notifications.js

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

// randomBetween is now defined in utils.js

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
        
        // Check for badges from server
        if (data.result.earnedBadges && data.result.earnedBadges.length > 0) {
            data.result.earnedBadges.forEach(badge => {
                setTimeout(() => {
                    showBadgeNotification(badge);
                }, 1000);
            });
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

// Constants - most are now defined in constants.js
const MINES_REQUEST_DEBOUNCE_MS = 500;
const MINES_RETRY_DELAY_MS = 1000;  // Delay before retrying on rate limit

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
    if (minesState.isLoading) return;
    minesState.isLoading = true;
    
    // Reset game state
    minesState.gameId = null;
    minesState.gameActive = false;
    minesState.revealedTiles = 0;
    minesState.currentMultiplier = 1.0;
    minesState.currentProfit = 0;
    minesState.mines = [];
    minesState.pendingRevealedTiles = new Set();
    minesState.serverVerified = false;
    
    // Reset all tiles
    minesState.tiles.forEach(tile => {
        tile.className = 'mines-tile';
        tile.innerHTML = '';
    });
    
    // Update UI
    updateMinesStats();
    
    // Get bet amount
    const betAmount = parseFloat(document.getElementById('mines-bet-amount').value);
    if (!betAmount || betAmount <= 0) {
        showGameNotification(false, null, 'Please enter a valid bet amount');
        minesState.isLoading = false;
        return;
    }
    
    // Check balance
    if (betAmount > currentUser.balance) {
        showGameNotification(false, null, 'Insufficient balance');
        minesState.isLoading = false;
        return;
    }
    
    // Disable controls
    document.getElementById('mines-start-btn').disabled = true;
    document.getElementById('mines-bet-amount').disabled = true;
    document.querySelectorAll('.mines-control-btn').forEach(btn => btn.disabled = true);
    
        // Store original balance for potential rollback
        const originalBalance = currentUser.balance;
    
    try {
        
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
            
            // Send mine hit to server (this will handle notifications and control re-enabling)
            sendMineHitToServer(tileIndex);
            
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
        
        // Re-enable controls on error
        minesState.isLoading = false;
        document.getElementById('mines-start-btn').disabled = false;
        document.getElementById('mines-bet-amount').disabled = false;
        document.querySelectorAll('.mines-control-btn').forEach(btn => btn.disabled = false);
        
        // Reset game state on error
        minesState.gameActive = false;
        minesState.gameId = null;
        minesState.revealedTiles = 0;
        minesState.currentMultiplier = 1.0;
        minesState.currentProfit = 0;
        minesState.pendingRevealedTiles = new Set();
        minesState.serverVerified = false;
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
                gridHash: minesState.gridHash,
                revealedTiles: Array.from(minesState.pendingRevealedTiles),
                currentMultiplier: minesState.currentMultiplier
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
                    const mineTile = minesState.tiles[index];
                    if (!mineTile.classList.contains('revealed')) {
                        mineTile.classList.add('revealed', 'mine');
                        mineTile.innerHTML = '<i data-lucide="bomb"></i>';
                    }
            }
        });
        lucide.createIcons();
        
        // Remove active state from all tiles
        minesState.tiles.forEach(tile => {
            tile.classList.remove('active');
        });
        
        // Show notification with win amount
        showGameNotification(true, result.winAmount, null, 
            { bg: 'rgba(34, 197, 94, 0.3)', border: 'rgba(34, 197, 94, 0.8)', text: '#22c55e' }, 
            minesState.currentMultiplier);
        
        // Check for badges from server
        if (result.earnedBadges && result.earnedBadges.length > 0) {
            result.earnedBadges.forEach(badge => {
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

// Send mine hit to server
async function sendMineHitToServer(tileIndex) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/mines/reveal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameId: minesState.gameId,
                tileIndex: tileIndex
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Server error');
        }
        
        // Update balance after mine hit
        if (data.result.balanceAfter !== undefined) {
            currentUser.balance = data.result.balanceAfter;
            updateUserInterface();
        }
        
        // Show notification with the actual loss amount
        showGameNotification(false, -minesState.betAmount, 'You hit a mine!', 
            { bg: 'rgba(239, 68, 68, 0.3)', border: 'rgba(239, 68, 68, 0.8)', text: '#ef4444' });
        
        // Re-enable controls
        minesState.isLoading = false;
        document.getElementById('mines-start-btn').disabled = false;
        document.getElementById('mines-bet-amount').disabled = false;
        document.querySelectorAll('.mines-control-btn').forEach(btn => btn.disabled = false);
        
        // Continue autobet if active
        if (minesAutobet.isActive) {
            continueMinesAutobet(false, -minesState.betAmount);
        }
        
    } catch (error) {
        console.error('❌ Mine hit error:', error);
        
        // Don't show error notification for "Game is no longer active" as it's expected
        if (!error.message?.includes('Game is no longer active')) {
            showGameNotification(false, null, error.message || 'Connection error. Please try again.');
        }
        
        // Re-enable controls on error
        minesState.isLoading = false;
        document.getElementById('mines-start-btn').disabled = false;
        document.getElementById('mines-bet-amount').disabled = false;
        document.querySelectorAll('.mines-control-btn').forEach(btn => btn.disabled = false);
        
        // Reset game state on error
        minesState.gameActive = false;
        minesState.gameId = null;
        minesState.revealedTiles = 0;
        minesState.currentMultiplier = 1.0;
        minesState.currentProfit = 0;
        minesState.pendingRevealedTiles = new Set();
        minesState.serverVerified = false;
    }
}

// Blackjack Game Functions
let blackjackState = {
    gameActive: false,
    gameId: null,
    playerCards: [],
    dealerCards: [],
    playerValue: 0,
    dealerValue: 0,
    gameStatus: 'waiting',
    canHit: false,
    canStand: false,
    canDouble: false,
    currentBet: 0
};

let blackjackAutobet = {
    isActive: false,
    settings: {
        betCount: 10,
        infiniteBets: false,
        stopOnWin: null,
        stopOnLoss: null,
        strategy: 'basic',
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
        currentStreak: 0,
        longestStreak: 0,
        baseBet: 0
    }
};

// Initialize Blackjack game
function initializeBlackjackGame() {
    if (typeof showPage === 'undefined') {
        console.error('showPage function not found');
        return;
    }
    
    setupBlackjackControls();
    setupBlackjackAutobet();
    resetBlackjackGame();
}

// Setup Blackjack controls
function setupBlackjackControls() {
    // Auto bet toggle
    const autoBetBtn = document.getElementById('blackjack-auto-bet-btn');
    if (autoBetBtn) {
        autoBetBtn.addEventListener('click', toggleBlackjackAutoBet);
    }
    
    // Auto bet strategy buttons
    setupBlackjackAutoBetStrategy('blackjack-on-win', 'win');
    setupBlackjackAutoBetStrategy('blackjack-on-loss', 'loss');
    
    // Auto bet start/stop buttons
    const startAutoBetBtn = document.getElementById('blackjack-start-auto-bet');
    const stopAutoBetBtn = document.getElementById('blackjack-stop-auto-bet');
    
    if (startAutoBetBtn) {
        startAutoBetBtn.addEventListener('click', startBlackjackAutobet);
    }
    
    if (stopAutoBetBtn) {
        stopAutoBetBtn.addEventListener('click', stopBlackjackAutobet);
    }
    
    // Infinite bets toggle
    const infiniteToggle = document.getElementById('blackjack-infinite-bets-toggle');
    if (infiniteToggle) {
        infiniteToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isActive = infiniteToggle.classList.contains('active');
            infiniteToggle.classList.toggle('active', !isActive);
            
            const betCountInput = document.getElementById('blackjack-auto-bet-count');
            if (betCountInput) {
                betCountInput.disabled = !isActive;
                if (!isActive) {
                    betCountInput.placeholder = '∞';
                    betCountInput.value = '';
                } else {
                    betCountInput.placeholder = '10';
                }
            }
            
            blackjackAutobet.settings.infiniteBets = !isActive;
        });
    }
}

// Setup auto bet strategy buttons
function setupBlackjackAutoBetStrategy(prefix, type) {
    const resetBtn = document.getElementById(`${prefix}-reset`);
    const multiplyBtn = document.getElementById(`${prefix}-multiply`);
    const stopBtn = document.getElementById(`${prefix}-stop`);
    const settings = document.getElementById(`${prefix}-settings`);
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            blackjackAutobet.settings[`on${type.charAt(0).toUpperCase() + type.slice(1)}`] = 'reset';
            resetBtn.classList.add('active');
            multiplyBtn?.classList.remove('active');
            stopBtn?.classList.remove('active');
            settings?.classList.remove('show');
        });
    }
    
    if (multiplyBtn) {
        multiplyBtn.addEventListener('click', () => {
            blackjackAutobet.settings[`on${type.charAt(0).toUpperCase() + type.slice(1)}`] = 'multiply';
            multiplyBtn.classList.add('active');
            resetBtn?.classList.remove('active');
            stopBtn?.classList.remove('active');
            settings?.classList.add('show');
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            blackjackAutobet.settings[`on${type.charAt(0).toUpperCase() + type.slice(1)}`] = 'stop';
            stopBtn.classList.add('active');
            resetBtn?.classList.remove('active');
            multiplyBtn?.classList.remove('active');
            settings?.classList.remove('show');
        });
    }
    
    // Update multiplier values
    const multiplierInput = document.getElementById(`${prefix}-multiplier`);
    if (multiplierInput) {
        multiplierInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value) || 2.0;
            blackjackAutobet.settings[`${type}Multiplier`] = Math.max(1.1, Math.min(100, value));
        });
    }
}

// Toggle auto bet menu
function toggleBlackjackAutoBet() {
    const autoBetSettings = document.getElementById('blackjack-auto-bet-settings');
    const autoBetBtn = document.getElementById('blackjack-auto-bet-btn');
    
    if (autoBetSettings && autoBetBtn) {
        const isActive = autoBetBtn.classList.contains('active');
        autoBetBtn.classList.toggle('active', !isActive);
        autoBetSettings.classList.toggle('show', !isActive);
    }
}

// Set bet amount
function setBlackjackAmount(action) {
    const betInput = document.getElementById('blackjack-bet-amount');
    if (!betInput) return;
    
    const currentValue = parseFloat(betInput.value) || 0;
    const balance = currentUser ? currentUser.balance : 0;
    
    switch (action) {
        case 'half':
            betInput.value = (currentValue / 2).toFixed(2);
            break;
        case 'double':
            betInput.value = Math.min(currentValue * 2, balance).toFixed(2);
            break;
        case 'max':
            betInput.value = balance.toFixed(2);
            break;
        case 'clear':
            betInput.value = '';
            break;
    }
}

// Reset game state
function resetBlackjackGame() {
    blackjackState = {
        gameActive: false,
        gameId: null,
        playerCards: [],
        dealerCards: [],
        playerValue: 0,
        dealerValue: 0,
        gameStatus: 'waiting',
        canHit: false,
        canStand: false,
        canDouble: false,
        currentBet: 0
    };
    
    // Clear card displays explicitly
    const playerCardsContainer = document.getElementById('player-cards');
    const dealerCardsContainer = document.getElementById('dealer-cards');
    if (playerCardsContainer) playerCardsContainer.innerHTML = '';
    if (dealerCardsContainer) dealerCardsContainer.innerHTML = '';
    
    updateBlackjackUI();
}

// Update UI
function updateBlackjackUI() {
    // Update card displays
    updateCardDisplay('player-cards', blackjackState.playerCards);
    updateCardDisplay('dealer-cards', blackjackState.dealerCards, blackjackState.gameStatus === 'playing');
    
    // Update totals
    const playerTotalEl = document.getElementById('player-total');
    const dealerTotalEl = document.getElementById('dealer-total');
    
    if (playerTotalEl) playerTotalEl.textContent = blackjackState.playerValue;
    if (dealerTotalEl) {
        // Only show dealer's visible card value during play
        if (blackjackState.gameStatus === 'playing' && blackjackState.dealerCards.length > 0) {
            const visibleCard = blackjackState.dealerCards[0];
            let visibleValue = 0;
            if (visibleCard.value === 'A') {
                visibleValue = 11;
            } else if (['J', 'Q', 'K'].includes(visibleCard.value)) {
                visibleValue = 10;
            } else {
                visibleValue = parseInt(visibleCard.value);
            }
            dealerTotalEl.textContent = visibleValue;
        } else {
            dealerTotalEl.textContent = blackjackState.dealerValue;
        }
    }
    
    // Update game status
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
        const statusText = getGameStatusText();
        statusElement.textContent = statusText.text;
        statusElement.className = 'game-status ' + statusText.class;
    }
    
    // Update stats
    const dealerCountEl = document.getElementById('dealer-count');
    const playerCountEl = document.getElementById('player-count');
    const currentBetEl = document.getElementById('current-bet');
    
    if (dealerCountEl) {
        // Only show dealer's visible card value during play
        if (blackjackState.gameStatus === 'playing' && blackjackState.dealerCards.length > 0) {
            const visibleCard = blackjackState.dealerCards[0];
            let visibleValue = 0;
            if (visibleCard.value === 'A') {
                visibleValue = 11;
            } else if (['J', 'Q', 'K'].includes(visibleCard.value)) {
                visibleValue = 10;
            } else {
                visibleValue = parseInt(visibleCard.value);
            }
            dealerCountEl.textContent = visibleValue;
        } else {
            dealerCountEl.textContent = blackjackState.dealerValue;
        }
    }
    if (playerCountEl) playerCountEl.textContent = blackjackState.playerValue;
    if (currentBetEl) {
        const betAmount = blackjackState.currentBet || 0;
        currentBetEl.textContent = `$${betAmount.toFixed(2)}`;
    }
    
    // Update buttons
    updateBlackjackButtons();
}

// Update card display smoothly
function updateCardDisplay(containerId, cards, hideDealerHole = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const existingCards = container.querySelectorAll('.playing-card');
    
    // Clear container when starting a new game (cards.length === 0) or when we have fewer cards than before
    if (cards.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // If we have fewer cards than existing DOM elements, clear and rebuild
    if (cards.length < existingCards.length) {
        container.innerHTML = '';
    }
    
    // Add or update cards
    cards.forEach((card, index) => {
        let cardElement;
        const currentExistingCards = container.querySelectorAll('.playing-card');
        
        if (index < currentExistingCards.length) {
            // Update existing card with new values
            cardElement = currentExistingCards[index];
            
            // Always update the card content to match the new card values
            if (containerId === 'dealer-cards' && index === 1 && hideDealerHole) {
                cardElement.classList.add('hidden');
                cardElement.innerHTML = '<div class="card-value">?</div><div class="card-suit">?</div>';
                cardElement.className = `playing-card hidden`;
            } else {
                // Update dealer's hole card if it's being revealed
                if (containerId === 'dealer-cards' && index === 1 && cardElement.classList.contains('hidden') && !hideDealerHole) {
                    cardElement.classList.remove('hidden');
                }
                cardElement.innerHTML = `
                    <div class="card-value">${card.value}</div>
                    <div class="card-suit">${card.suit}</div>
                `;
                cardElement.className = `playing-card ${card.color}`;
            }
        } else {
            // Create new card
            cardElement = document.createElement('div');
            cardElement.className = `playing-card ${card.color}`;
            
            // Hide dealer's hole card if game is still playing
            if (containerId === 'dealer-cards' && index === 1 && hideDealerHole) {
                cardElement.classList.add('hidden');
                cardElement.innerHTML = '<div class="card-value">?</div><div class="card-suit">?</div>';
            } else {
                cardElement.innerHTML = `
                    <div class="card-value">${card.value}</div>
                    <div class="card-suit">${card.suit}</div>
                `;
            }
            
            container.appendChild(cardElement);
        }
    });
}

// Get game status text
function getGameStatusText() {
    switch (blackjackState.gameStatus) {
        case 'waiting':
            return { text: 'Place your bet to start', class: '' };
        case 'playing':
            return { text: 'Choose your action', class: '' };
        case 'blackjack':
            return { text: 'Blackjack! You win!', class: 'win' };
        case 'dealer_blackjack':
            return { text: 'Dealer has blackjack', class: 'lose' };
        case 'bust':
            return { text: 'Bust! You lose', class: 'lose' };
        case 'win':
            return { text: 'You win!', class: 'win' };
        case 'lose':
            return { text: 'You lose', class: 'lose' };
        case 'push':
            return { text: 'Push - It\'s a tie', class: 'push' };
        default:
            return { text: 'Place your bet to start', class: '' };
    }
}

// Update buttons
function updateBlackjackButtons() {
    const dealBtn = document.getElementById('blackjack-deal-btn');
    const actionButtons = document.getElementById('blackjack-action-buttons');
    const hitBtn = document.getElementById('blackjack-hit-btn');
    const standBtn = document.getElementById('blackjack-stand-btn');
    const doubleBtn = document.getElementById('blackjack-double-btn');
    
    if (dealBtn) {
        dealBtn.disabled = blackjackState.gameActive || blackjackAutobet.isActive;
    }
    
    // Show/hide action buttons container
    if (actionButtons) {
        actionButtons.style.display = blackjackState.gameActive ? 'flex' : 'none';
    }
    
    if (hitBtn) {
        hitBtn.disabled = !blackjackState.canHit || blackjackAutobet.isActive;
    }
    
    if (standBtn) {
        standBtn.disabled = !blackjackState.canStand || blackjackAutobet.isActive;
    }
    
    if (doubleBtn) {
        doubleBtn.disabled = !blackjackState.canDouble || blackjackAutobet.isActive;
    }
}

// Deal cards
async function dealBlackjack() {
    if (blackjackState.gameActive) return;
    
    // Reset game state before dealing new cards (clears previous game)
    resetBlackjackGame();
    
    const betAmount = parseFloat(document.getElementById('blackjack-bet-amount').value);
    if (!betAmount || betAmount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showError('Insufficient balance');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/blackjack/deal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ betAmount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const { gameId, gameState, balanceAfter } = data.result;
            
            blackjackState.gameActive = true;
            blackjackState.gameId = gameId;
            blackjackState.playerCards = gameState.playerCards;
            blackjackState.dealerCards = gameState.dealerCards;
            blackjackState.playerValue = gameState.playerValue;
            blackjackState.dealerValue = gameState.dealerValue;
            blackjackState.gameStatus = gameState.gameStatus;
            blackjackState.canHit = gameState.gameStatus === 'playing';
            blackjackState.canStand = gameState.gameStatus === 'playing';
            blackjackState.canDouble = gameState.canDouble;
            blackjackState.currentBet = gameState.betAmount;
            
            // Update balance
            currentUser.balance = balanceAfter;
            updateUserInterface();
            
            // Update UI
            updateBlackjackUI();
            
            // Check for immediate game end
            if (gameState.gameStatus !== 'playing') {
                setTimeout(() => {
                    handleBlackjackGameEnd(gameState.gameStatus, gameState.winAmount);
                }, 1000);
            }
            
        } else {
            showError(data.message || 'Failed to deal cards');
        }
        
    } catch (error) {
        console.error('Deal error:', error);
        showError('Failed to deal cards');
    }
}

// Hit
async function hitBlackjack() {
    if (!blackjackState.gameActive || !blackjackState.canHit) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/blackjack/hit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ gameId: blackjackState.gameId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const { gameState, balanceAfter } = data.result;
            
            blackjackState.playerCards = gameState.playerCards;
            blackjackState.playerValue = gameState.playerValue;
            blackjackState.gameStatus = gameState.gameStatus;
            blackjackState.canHit = gameState.gameStatus === 'playing';
            blackjackState.canStand = gameState.gameStatus === 'playing';
            blackjackState.canDouble = false; // Can't double after hitting
            
            // Update balance
            currentUser.balance = balanceAfter;
            updateUserInterface();
            
            // Update UI
            updateBlackjackUI();
            
            // Check for bust
            if (gameState.gameStatus === 'bust') {
                setTimeout(() => {
                    handleBlackjackGameEnd('bust', 0);
                }, 1000);
            }
            
        } else {
            showError(data.message || 'Failed to hit');
        }
        
    } catch (error) {
        console.error('Hit error:', error);
        showError('Failed to hit');
    }
}

// Stand
async function standBlackjack() {
    if (!blackjackState.gameActive || !blackjackState.canStand) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/blackjack/stand`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ gameId: blackjackState.gameId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const { gameState, balanceAfter } = data.result;
            
            blackjackState.dealerCards = gameState.dealerCards;
            blackjackState.dealerValue = gameState.dealerValue;
            blackjackState.gameStatus = gameState.gameStatus;
            blackjackState.canHit = false;
            blackjackState.canStand = false;
            blackjackState.canDouble = false;
            
            // Update balance
            currentUser.balance = balanceAfter;
            updateUserInterface();
            
            // Update UI
            updateBlackjackUI();
            
            // Handle game end
            setTimeout(() => {
                handleBlackjackGameEnd(gameState.gameStatus, gameState.winAmount);
            }, 1000);
            
        } else {
            showError(data.message || 'Failed to stand');
        }
        
    } catch (error) {
        console.error('Stand error:', error);
        showError('Failed to stand');
    }
}

// Double down
async function doubleBlackjack() {
    if (!blackjackState.gameActive || !blackjackState.canDouble) return;
    
    // Get the current bet amount from the input or state
    const betInput = document.getElementById('blackjack-bet-amount');
    const additionalBet = blackjackState.currentBet || (betInput ? parseFloat(betInput.value) : 0);
    
    if (!additionalBet || additionalBet <= 0) {
        showError('Invalid bet amount');
        return;
    }
    
    if (additionalBet > currentUser.balance) {
        showError('Insufficient balance to double');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/blackjack/double`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ gameId: blackjackState.gameId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const { gameState, balanceAfter } = data.result;
            
            blackjackState.playerCards = gameState.playerCards;
            blackjackState.dealerCards = gameState.dealerCards;
            blackjackState.playerValue = gameState.playerValue;
            blackjackState.dealerValue = gameState.dealerValue;
            blackjackState.gameStatus = gameState.gameStatus;
            blackjackState.currentBet = gameState.betAmount;
            blackjackState.canHit = false;
            blackjackState.canStand = false;
            blackjackState.canDouble = false;
            
            // Update balance
            currentUser.balance = balanceAfter;
            updateUserInterface();
            
            // Update UI
            updateBlackjackUI();
            
            // Handle game end
            setTimeout(() => {
                handleBlackjackGameEnd(gameState.gameStatus, gameState.winAmount);
            }, 1000);
            
        } else {
            showError(data.message || 'Failed to double down');
        }
        
    } catch (error) {
        console.error('Double down error:', error);
        showError('Failed to double down');
    }
}

// Handle game end
function handleBlackjackGameEnd(gameStatus, winAmount) {
    blackjackState.gameActive = false;
    blackjackState.canHit = false;
    blackjackState.canStand = false;
    blackjackState.canDouble = false;
    
    updateBlackjackUI();
    
    const currentBet = blackjackState.currentBet || 0;
    const profit = (winAmount || 0) - currentBet;
    const won = (winAmount || 0) > 0;
    
    // Show notification
    if (gameStatus === 'blackjack') {
        showGameNotification(true, winAmount, `Blackjack! 3:2 payout - Won $${winAmount ? winAmount.toFixed(2) : '0.00'}`);
    } else if (gameStatus === 'push') {
        showGameNotification(false, winAmount, `Push - bet returned $${winAmount ? winAmount.toFixed(2) : '0.00'}`);
    } else {
        const message = won ? `You win $${winAmount ? winAmount.toFixed(2) : '0.00'}!` : 'You lose';
        showGameNotification(won, winAmount, message);
    }
    
    // Update chart (commented out to prevent visual refresh)
    // updateChart();
    
    // Continue autobet if active
    if (blackjackAutobet.isActive) {
        setTimeout(() => {
            continueBlackjackAutobet(won, profit);
        }, 1500);
    }
    // For manual play, keep the final game state visible until next deal
}

// Setup autobet
function setupBlackjackAutobet() {
    // Auto bet settings are already set up in setupBlackjackControls
}

// Start autobet
async function startBlackjackAutobet() {
    if (blackjackAutobet.isActive) return;
    
    const betAmount = parseFloat(document.getElementById('blackjack-bet-amount').value);
    if (!betAmount || betAmount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showError('Insufficient balance');
        return;
    }
    
    // Get settings
    const settings = blackjackAutobet.settings;
    const betCountInput = document.getElementById('blackjack-auto-bet-count');
    const stopWinInput = document.getElementById('blackjack-auto-stop-win');
    const stopLossInput = document.getElementById('blackjack-auto-stop-loss');
    const strategyInput = document.getElementById('blackjack-auto-strategy');
    
    if (betCountInput) settings.betCount = parseInt(betCountInput.value) || 10;
    if (stopWinInput) settings.stopOnWin = parseFloat(stopWinInput.value) || null;
    if (stopLossInput) settings.stopOnLoss = parseFloat(stopLossInput.value) || null;
    if (strategyInput) settings.strategy = strategyInput.value || 'basic';
    
    // Initialize stats
    blackjackAutobet.stats = {
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalProfit: 0,
        currentStreak: 0,
        longestStreak: 0,
        baseBet: betAmount
    };
    
    blackjackAutobet.isActive = true;
    
    // Update UI
    const startBtn = document.getElementById('blackjack-start-auto-bet');
    const stopBtn = document.getElementById('blackjack-stop-auto-bet');
    const autoBetBtn = document.getElementById('blackjack-auto-bet-btn');
    
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
    if (autoBetBtn) autoBetBtn.classList.add('active');
    
    // Start first game
    await dealBlackjack();
}

// Stop autobet
function stopBlackjackAutobet() {
    blackjackAutobet.isActive = false;
    
    // Update UI
    const startBtn = document.getElementById('blackjack-start-auto-bet');
    const stopBtn = document.getElementById('blackjack-stop-auto-bet');
    const autoBetBtn = document.getElementById('blackjack-auto-bet-btn');
    
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (autoBetBtn) autoBetBtn.classList.remove('active');
    
    // Show final stats
    const { stats } = blackjackAutobet;
    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : '0.0';
    
    showGameNotification(stats.totalProfit > 0, stats.totalProfit, 
        `Autobet completed: ${stats.totalBets} bets, ${winRate}% win rate, ${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)} profit`);
}

// Continue autobet
function continueBlackjackAutobet(won, profit) {
    if (!blackjackAutobet.isActive) return;
    
    const { settings, stats } = blackjackAutobet;
    
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
    if (shouldStopBlackjackAutobet(won, profit)) {
        stopBlackjackAutobet();
        return;
    }
    
    // Adjust bet amount based on win/loss
    const betInput = document.getElementById('blackjack-bet-amount');
    if (!betInput) return;
    
    const currentBet = parseFloat(betInput.value);
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
    betInput.value = newBet.toFixed(2);
    
    if (newBet <= 0 || newBet > currentUser.balance) {
        showGameNotification(false, null, 'Insufficient balance for next bet');
        stopBlackjackAutobet();
        return;
    }
    
    // Stop if strategy says to stop
    if ((!won && settings.onLoss === 'stop') || (won && settings.onWin === 'stop')) {
        stopBlackjackAutobet();
        return;
    }
    
    // Start next game after delay
    setTimeout(async () => {
        if (!blackjackAutobet.isActive) return;
        await dealBlackjack();
    }, 1000);
}

// Check stopping conditions
function shouldStopBlackjackAutobet(won, profit) {
    const { settings, stats } = blackjackAutobet;
    
    // Check bet count
    if (!settings.infiniteBets && stats.totalBets >= settings.betCount) {
        return true;
    }
    
    // Check profit limits
    if (settings.stopOnWin && stats.totalProfit >= settings.stopOnWin) {
        return true;
    }
    
    if (settings.stopOnLoss && stats.totalProfit <= -Math.abs(settings.stopOnLoss)) {
        return true;
    }
    
    return false;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('blackjack-game-page')) {
        initializeBlackjackGame();
    }
});

// Leaderboard System
let leaderboardState = {
    players: [],
    updateTimer: null,
    updateInterval: 30000, // 30 seconds
    liveGames: [],
    searchResults: null
};

// Initialize Leaderboard
function initializeLeaderboard() {
    setupLeaderboardControls();
    loadLeaderboard();
    startLeaderboardTimer();
}

// Setup leaderboard controls
function setupLeaderboardControls() {
    const searchInput = document.getElementById('player-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handlePlayerSearch, 300));
    }
}

// Load leaderboard data
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/leaderboard`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            leaderboardState.players = data.players;
            updateLeaderboardDisplay();
            updatePodium();
        } else {
            console.error('Failed to load leaderboard:', data.message);
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Update leaderboard display
function updateLeaderboardDisplay() {
    const tableBody = document.getElementById('leaderboard-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    leaderboardState.players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.onclick = () => showPlayerDetails(player);
        
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        
        row.innerHTML = `
            <div class="table-cell rank">
                <span class="rank-number ${rankClass}">#${rank}</span>
            </div>
            <div class="table-cell player">
                <div class="player-info">
                    <div class="player-avatar">
                        <span>${player.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="player-name">${player.username}</div>
                </div>
            </div>
            <div class="table-cell balance">
                <span class="balance-amount">$${player.balance.toFixed(2)}</span>
            </div>
            <div class="table-cell level">
                <span class="level-badge">Level ${player.level}</span>
            </div>
            <div class="table-cell games">
                <span>${player.gamesPlayed || 0}</span>
            </div>
            <div class="table-cell winrate">
                <span class="winrate-badge ${getWinRateClass(player.winRate || 0)}">${(player.winRate || 0).toFixed(1)}%</span>
            </div>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update podium (top 3)
function updatePodium() {
    const top3 = leaderboardState.players.slice(0, 3);
    
    top3.forEach((player, index) => {
        const podiumPlace = document.getElementById(`podium-${index + 1}`);
        if (podiumPlace) {
            const nameEl = podiumPlace.querySelector('.podium-name');
            const balanceEl = podiumPlace.querySelector('.podium-balance');
            const avatarEl = podiumPlace.querySelector('.podium-avatar-text');
            
            if (nameEl) nameEl.textContent = player.username;
            if (balanceEl) balanceEl.textContent = `$${player.balance.toFixed(2)}`;
            if (avatarEl) avatarEl.textContent = player.username.charAt(0).toUpperCase();
            
            // Add click handler
            podiumPlace.onclick = () => showPlayerDetails(player);
        }
    });
}

// Handle player search
async function handlePlayerSearch() {
    const searchInput = document.getElementById('player-search');
    const query = searchInput.value.trim();
    const tableHeader = document.querySelector('.table-header h3');
    const podiumSection = document.querySelector('.podium-section');
    const updateTimer = document.querySelector('.update-timer');
    
    if (!query) {
        leaderboardState.searchResults = null;
        updateLeaderboardDisplay();
        tableHeader.textContent = 'Top 50 Players';
        podiumSection.style.display = 'block';
        updateTimer.style.display = 'block';
        return;
    }
    
    try {
        // Show loading state
        tableHeader.textContent = 'Searching...';
        podiumSection.style.display = 'none';
        updateTimer.style.display = 'none';
        
        const response = await fetch(`${API_BASE_URL}/api/leaderboard/search?username=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            leaderboardState.searchResults = data.players;
            tableHeader.textContent = `Search Results (${data.players.length} ${data.players.length === 1 ? 'player' : 'players'} found)`;
            updateSearchResults();
            
            // Stop leaderboard auto-update while showing search results
            if (leaderboardState.updateTimer) {
                clearInterval(leaderboardState.updateTimer);
                leaderboardState.updateTimer = null;
            }
        } else {
            console.error('Search failed:', data.message);
            tableHeader.textContent = 'Search Results (0 players found)';
            leaderboardState.searchResults = [];
            updateSearchResults();
        }
    } catch (error) {
        console.error('Error searching players:', error);
        tableHeader.textContent = 'Search Results (Error)';
        leaderboardState.searchResults = [];
        updateSearchResults();
    }
}

// Update search results
function updateSearchResults() {
    const tableBody = document.getElementById('leaderboard-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!leaderboardState.searchResults || leaderboardState.searchResults.length === 0) {
        tableBody.innerHTML = `
            <div class="no-results">
                <i data-lucide="search-x" style="width: 48px; height: 48px; color: #6b7280; margin-bottom: 1rem;"></i>
                <div>No players found</div>
                <div style="font-size: 0.9rem; color: #6b7280; margin-top: 0.5rem;">Try a different search term</div>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Display search results directly
    
    leaderboardState.searchResults.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'table-row search-result';
        row.onclick = () => showPlayerDetails(player);
        
        const rankClass = player.rank <= 3 ? `rank-${player.rank}` : '';
        
        row.innerHTML = `
            <div class="table-cell rank">
                <span class="rank-number ${rankClass}">#${player.rank}</span>
            </div>
            <div class="table-cell player">
                <div class="player-info">
                    <div class="player-avatar">
                        <span>${player.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="player-name">${player.username}</div>
                </div>
            </div>
            <div class="table-cell balance">
                <span class="balance-amount">$${player.balance.toFixed(2)}</span>
            </div>
            <div class="table-cell level">
                <span class="level-badge">Level ${player.level}</span>
            </div>
            <div class="table-cell games">
                <span>${player.gamesPlayed || 0}</span>
            </div>
            <div class="table-cell winrate">
                <span class="winrate-badge ${getWinRateClass(player.winRate || 0)}">${(player.winRate || 0).toFixed(1)}%</span>
            </div>
        `;
        
        // Add alternating background for better readability
        if (index % 2 === 1) {
            row.style.background = 'rgba(255, 255, 255, 0.02)';
        }
        
        tableBody.appendChild(row);
    });
    
    lucide.createIcons();
}

// Clear search and return to top players
function clearSearch() {
    const searchInput = document.getElementById('player-search');
    searchInput.value = '';
    leaderboardState.searchResults = null;
    updateLeaderboardDisplay();
    document.querySelector('.table-header h3').textContent = 'Top 50 Players';
    document.querySelector('.podium-section').style.display = 'block';
    document.querySelector('.update-timer').style.display = 'block';
    startLeaderboardTimer();
}

// Show player details modal
async function showPlayerDetails(player) {
    try {
        console.log('Fetching player details for:', player.username);
        const response = await fetch(`${API_BASE_URL}/api/leaderboard/profile/${player.username}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const playerData = data.user;
            populatePlayerDetailModal(playerData);
            document.getElementById('player-detail-modal').classList.remove('hidden');
            
            // Store balance history on canvas element for dragging
            const canvas = document.getElementById('player-balance-chart');
            if (canvas) {
                canvas.balanceHistory = playerData.balanceHistory || [];
                canvas.style.cursor = 'grab';
            }
            
            // Initialize chart controls
            initializePlayerChart();
            
            // Draw chart after modal is visible
            setTimeout(() => {
                drawPlayerBalanceChart(playerData.balanceHistory || []);
            }, 100);
        } else {
            showError('Failed to load player details');
        }
    } catch (error) {
        console.error('Error loading player details:', error);
        showError('Failed to load player details');
    }
}

// Populate player detail modal
function populatePlayerDetailModal(player) {
    console.log('Populating player detail modal with player data:', player);
    
    document.getElementById('player-detail-name').textContent = player.username;
    document.getElementById('player-detail-avatar-text').textContent = player.username.charAt(0).toUpperCase();
    document.getElementById('player-detail-rank').textContent = `#${player.rank || 'N/A'}`;
    document.getElementById('player-detail-level').textContent = player.level || 1;
    document.getElementById('player-detail-balance').textContent = `$${player.balance.toFixed(2)}`;
    document.getElementById('player-detail-games').textContent = player.gamesPlayed || 0;
    document.getElementById('player-detail-won').textContent = `$${(player.totalWon || 0).toFixed(2)}`;
    document.getElementById('player-detail-winrate').textContent = `${(player.winRate || 0).toFixed(1)}%`;
    document.getElementById('player-detail-best-win').textContent = `$${(player.bestWin || 0).toFixed(2)}`;
    document.getElementById('player-detail-best-streak').textContent = player.bestStreak || 0;
    
    // Update chart stats
    const wins = player.wins || 0;
    const losses = player.losses || 0;
    document.getElementById('player-chart-wins').textContent = wins;
    document.getElementById('player-chart-losses').textContent = losses;
    
    // Update badges
    const badgesContainer = document.getElementById('player-detail-badges');
    badgesContainer.innerHTML = '';
    
    if (player.badges && player.badges.length > 0) {
        // Create badges grid
        const badgesGrid = document.createElement('div');
        badgesGrid.className = 'badges-grid';
        
        player.badges.forEach(badge => {
            const badgeEl = document.createElement('div');
            badgeEl.className = `badge-item earned ${badge.type || ''}`;
            badgeEl.innerHTML = `
                <div class="badge-icon" style="background: ${badge.color}20; border-color: ${badge.color}30;">
                    <i data-lucide="${badge.icon}" style="color: ${badge.color};"></i>
                </div>
                <div class="badge-name">${badge.name}</div>
                <div class="badge-description">${badge.description}</div>
                <div class="badge-earned">Earned ${new Date(badge.earnedAt).toLocaleDateString()}</div>
            `;
            badgesGrid.appendChild(badgeEl);
        });
        
        badgesContainer.appendChild(badgesGrid);
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } else {
        badgesContainer.innerHTML = '<div class="no-badges">No badges earned yet</div>';
    }
}

// Old player chart function removed - now using unified chart system

// Handle mouse/touch events for player chart
function handlePlayerChartMouseDown(event) {
    const canvas = document.getElementById('player-balance-chart');
    if (!canvas) return;
    
    isPlayerDragging = true;
    const rect = canvas.getBoundingClientRect();
    playerDragStartX = event.clientX - rect.left;
    playerDragStartOffset = playerChartOffset;
    playerDragVelocity = 0;
    playerLastDragTime = Date.now();
    playerLastDragX = playerDragStartX;
    
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
}

function handlePlayerChartMouseMove(event) {
    const canvas = document.getElementById('player-balance-chart');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Handle dragging
    if (isPlayerDragging) {
        const currentX = mouseX;
        const deltaX = currentX - playerDragStartX;
        const currentTime = Date.now();
        
        // Calculate velocity for momentum
        const timeDelta = currentTime - playerLastDragTime;
        if (timeDelta > 0) {
            playerDragVelocity = (currentX - playerLastDragX) / timeDelta;
        }
        playerLastDragTime = currentTime;
        playerLastDragX = currentX;
        
        // Calculate new offset based on drag distance
        const maxOffset = Math.max(0, canvas.balanceHistory.length - playerPointsToShow);
        const sensitivity = maxOffset / (canvas.width - 80);
        const newOffset = playerDragStartOffset - (deltaX * sensitivity);
        
        playerChartOffset = Math.max(0, Math.min(newOffset, maxOffset));
        drawPlayerBalanceChart(canvas.balanceHistory);
        
        event.preventDefault();
        return;
    }

    // Handle hover effects
    const tooltip = document.querySelector('.player-price-tooltip');
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
        playerActivePoint = closestPoint;
        
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
        drawPlayerBalanceChart(canvas.balanceHistory);
    } else {
        tooltip.style.opacity = '0';
        if (playerActivePoint !== null) {
            playerActivePoint = null;
            const canvas = document.getElementById('player-balance-chart');
            if (canvas && canvas.balanceHistory) {
                drawPlayerBalanceChart(canvas.balanceHistory);
            }
        }
    }
}

function handlePlayerChartMouseUp(event) {
    const canvas = document.getElementById('player-balance-chart');
    if (!canvas || !isPlayerDragging) return;
    
    isPlayerDragging = false;
    canvas.style.cursor = 'grab';
    
    // Apply momentum and snap to nearest data point
    if (Math.abs(playerDragVelocity) > 0.1) {
        animatePlayerChartMomentum();
    } else {
        snapPlayerToNearestPoint();
    }
    
    event.preventDefault();
}

function animatePlayerChartMomentum() {
    const friction = 0.95;
    const minVelocity = 0.1;
    
    function animate() {
        if (Math.abs(playerDragVelocity) < minVelocity) {
            snapPlayerToNearestPoint();
            return;
        }
        
        const canvas = document.getElementById('player-balance-chart');
        const maxOffset = Math.max(0, canvas.balanceHistory.length - playerPointsToShow);
        const sensitivity = maxOffset / 300;
        playerChartOffset -= playerDragVelocity * sensitivity * 10;
        playerChartOffset = Math.max(0, Math.min(playerChartOffset, maxOffset));
        
        playerDragVelocity *= friction;
        drawPlayerBalanceChart(canvas.balanceHistory);
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

function snapPlayerToNearestPoint() {
    const canvas = document.getElementById('player-balance-chart');
    const maxOffset = Math.max(0, canvas.balanceHistory.length - playerPointsToShow);
    const targetOffset = Math.round(playerChartOffset);
    
    if (Math.abs(targetOffset - playerChartOffset) > 0.1) {
        const startOffset = playerChartOffset;
        const startTime = Date.now();
        const duration = 200;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            playerChartOffset = startOffset + (targetOffset - startOffset) * easeProgress;
            drawPlayerBalanceChart(canvas.balanceHistory);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        animate();
    }
}

function handlePlayerChartMouseLeave() {
    const tooltip = document.querySelector('.player-price-tooltip');
    tooltip.style.opacity = '0';
    if (playerActivePoint !== null) {
        playerActivePoint = null;
        const canvas = document.getElementById('player-balance-chart');
        if (canvas && canvas.balanceHistory) {
            drawPlayerBalanceChart(canvas.balanceHistory);
        }
    }
}

// Initialize player chart controls
function initializePlayerChart() {
    const canvas = document.getElementById('player-balance-chart');
    if (canvas) {
        canvas.style.cursor = 'grab';
        
        // Create tooltip element if it doesn't exist
        if (!document.querySelector('.player-price-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.className = 'player-price-tooltip price-tooltip';
            document.body.appendChild(tooltip);
        }
        
        // Mouse events
        canvas.addEventListener('mousedown', handlePlayerChartMouseDown);
        document.addEventListener('mousemove', handlePlayerChartMouseMove);
        document.addEventListener('mouseup', handlePlayerChartMouseUp);
        canvas.addEventListener('mouseleave', handlePlayerChartMouseLeave);
        
        // Touch events
        canvas.addEventListener('touchstart', handlePlayerChartTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handlePlayerChartTouchMove, { passive: false });
        canvas.addEventListener('touchend', handlePlayerChartTouchEnd, { passive: false });
        
        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
}

// ... existing code ...

// Start leaderboard timer
function startLeaderboardTimer() {
    let timeLeft = 30;
    const timerEl = document.getElementById('leaderboard-timer');
    
    leaderboardState.updateTimer = setInterval(() => {
        timeLeft--;
        if (timerEl) {
            timerEl.textContent = `${timeLeft}s`;
        }
        
        if (timeLeft <= 0) {
            loadLeaderboard();
            timeLeft = 30;
        }
    }, 1000);
}

// Utility functions
function getWinRateClass(winRate) {
    if (winRate >= 70) return 'excellent';
    if (winRate >= 50) return 'good';
    if (winRate >= 30) return 'average';
    return 'poor';
}

function getGameIcon(game) {
    const icons = {
        'dice': '🎲',
        'blackjack': '🃏',
        'mines': '💣',
        'plinko': '🎯',
        'coinflip': '🪙'
    };
    return icons[game] || '🎮';
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 

// Handle touch events for player chart
function handlePlayerChartTouchStart(event) {
    const canvas = document.getElementById('player-balance-chart');
    if (!canvas) return;
    
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    
    isPlayerDragging = true;
    playerDragStartX = touch.clientX - rect.left;
    playerDragStartOffset = playerChartOffset;
    playerDragVelocity = 0;
    playerLastDragTime = Date.now();
    playerLastDragX = playerDragStartX;
    
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
}

function handlePlayerChartTouchMove(event) {
    const canvas = document.getElementById('player-balance-chart');
    if (!canvas || !isPlayerDragging) return;
    
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const deltaX = currentX - playerDragStartX;
    const currentTime = Date.now();
    
    // Calculate velocity for momentum
    const timeDelta = currentTime - playerLastDragTime;
    if (timeDelta > 0) {
        playerDragVelocity = (currentX - playerLastDragX) / timeDelta;
    }
    playerLastDragTime = currentTime;
    playerLastDragX = currentX;
    
    // Calculate new offset based on drag distance
    const maxOffset = Math.max(0, canvas.balanceHistory.length - playerPointsToShow);
    const sensitivity = maxOffset / (canvas.width - 80);
    const newOffset = playerDragStartOffset - (deltaX * sensitivity);
    
    playerChartOffset = Math.max(0, Math.min(newOffset, maxOffset));
    drawPlayerBalanceChart(canvas.balanceHistory);
    
    event.preventDefault();
}

function handlePlayerChartTouchEnd(event) {
    const canvas = document.getElementById('player-balance-chart');
    if (!canvas || !isPlayerDragging) return;
    
    isPlayerDragging = false;
    canvas.style.cursor = 'grab';
    
    // Apply momentum and snap to nearest data point
    if (Math.abs(playerDragVelocity) > 0.1) {
        animatePlayerChartMomentum();
    } else {
        snapPlayerToNearestPoint();
    }
    
    event.preventDefault();
}

// Unified chart system
const chartInstances = {
    dashboard: {
        canvasId: 'balance-chart',
        tooltipClass: 'price-tooltip',
        offset: 0,
        pointsToShow: 50,
        isDragging: false,
        dragStartX: 0,
        dragStartOffset: 0,
        dragVelocity: 0,
        lastDragTime: 0,
        lastDragX: 0,
        activePoint: null,
        balanceHistory: null
    },
    player: {
        canvasId: 'player-balance-chart',
        tooltipClass: 'player-price-tooltip',
        offset: 0,
        pointsToShow: 50,
        isDragging: false,
        dragStartX: 0,
        dragStartOffset: 0,
        dragVelocity: 0,
        lastDragTime: 0,
        lastDragX: 0,
        activePoint: null,
        balanceHistory: null
    }
};

// Unified chart drawing function
function drawChart(instanceKey, balanceHistory) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    
    if (!canvas) {
        return;
    }
    
    // Ensure canvas has proper dimensions
            const rect = canvas.getBoundingClientRect();
    
    // If canvas has no dimensions, set it to fill the container
    if (rect.width === 0 || rect.height === 0) {
        const container = canvas.parentElement;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.width = containerRect.width;
            canvas.height = containerRect.height;
        } else {
            // Fallback to default size
            canvas.style.width = '400px';
            canvas.style.height = '200px';
            canvas.width = 400;
            canvas.height = 200;
        }
    }
    
    if (!balanceHistory || balanceHistory.length === 0) {
        const ctx = canvas.getContext('2d');
        const newRect = canvas.getBoundingClientRect();
        canvas.width = newRect.width * window.devicePixelRatio;
        canvas.height = newRect.height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            
        ctx.clearRect(0, 0, newRect.width, newRect.height);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Outfit';
            ctx.textAlign = 'center';
        ctx.fillText('No balance history available', newRect.width / 2, newRect.height / 2);
        return;
    }

    const ctx = canvas.getContext('2d');
    const newRect = canvas.getBoundingClientRect();
    
    // Set canvas size
    canvas.width = newRect.width * window.devicePixelRatio;
    canvas.height = newRect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = newRect.width;
    const height = newRect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (balanceHistory.length < 2) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('Not enough data to display chart', width / 2, height / 2);
        return;
    }

    // Store balance history
    instance.balanceHistory = balanceHistory;

    // Get data points with offset
    const allDataPoints = balanceHistory;
    const maxOffset = Math.max(0, allDataPoints.length - instance.pointsToShow);
    instance.offset = Math.max(0, Math.min(instance.offset, maxOffset));
    
    const startIndex = Math.max(0, allDataPoints.length - instance.pointsToShow - instance.offset);
    const endIndex = allDataPoints.length - instance.offset;
    const dataPoints = allDataPoints.slice(startIndex, endIndex);
    
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Calculate bounds for visible data points
    const minBalance = Math.min(...dataPoints);
    const maxBalance = Math.max(...dataPoints);
    const balanceRange = Math.max(1, maxBalance - minBalance);
    
    // Draw grid lines and labels
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    
    // Draw horizontal grid lines and labels
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight * i) / 5;
        const value = maxBalance - (balanceRange * (i / 5));
        
        // Draw grid line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
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
    
    // Store point coordinates for hover detection
    const xScale = chartWidth / Math.max(1, dataPoints.length - 1);
    const yScale = chartHeight / balanceRange;
    
    canvas.dataPoints = dataPoints.map((value, i) => ({
        x: padding + i * xScale,
        y: height - padding - (value - minBalance) * yScale,
        value: value
    }));
    
    // Draw lines between points with win/loss colors
    for (let i = 1; i < dataPoints.length; i++) {
        const x1 = padding + (i - 1) * xScale;
        const y1 = height - padding - (dataPoints[i - 1] - minBalance) * yScale;
        const x2 = padding + i * xScale;
        const y2 = height - padding - (dataPoints[i] - minBalance) * yScale;
        
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
        const isActive = instance.activePoint === i;
        
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
    if (allDataPoints.length > instance.pointsToShow) {
        const navY = height - 15;
        ctx.fillStyle = '#8b949e';
        ctx.textAlign = 'center';
        ctx.font = '11px Inter';
        
        // Game range indicator
        const displayStartIndex = Math.max(0, allDataPoints.length - instance.pointsToShow - Math.round(instance.offset));
        const displayEndIndex = allDataPoints.length - Math.round(instance.offset);
        
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
        const progress = instance.offset / maxOffset;
        const progressBarWidth = progressWidth * (instance.pointsToShow / allDataPoints.length);
        const progressBarX = padding + (progressWidth - progressBarWidth) * (1 - progress);
        
        ctx.fillStyle = '#10b981';
        ctx.fillRect(progressBarX, progressY, progressBarWidth, progressHeight);
    }
}

// Unified chart event handlers
function handleChartMouseDown(event, instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas) return;
    
    instance.isDragging = true;
    const rect = canvas.getBoundingClientRect();
    instance.dragStartX = event.clientX - rect.left;
    instance.dragStartOffset = instance.offset;
    instance.dragVelocity = 0;
    instance.lastDragTime = Date.now();
    instance.lastDragX = instance.dragStartX;
    
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
}

function handleChartMouseMove(event, instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas || !instance.balanceHistory) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Handle dragging
    if (instance.isDragging) {
        const currentX = mouseX;
        const deltaX = currentX - instance.dragStartX;
        const currentTime = Date.now();
        
        // Calculate velocity for momentum
        const timeDelta = currentTime - instance.lastDragTime;
        if (timeDelta > 0) {
            instance.dragVelocity = (currentX - instance.lastDragX) / timeDelta;
        }
        instance.lastDragTime = currentTime;
        instance.lastDragX = currentX;
        
        // Calculate new offset based on drag distance
        const maxOffset = Math.max(0, instance.balanceHistory.length - instance.pointsToShow);
        const sensitivity = maxOffset / (canvas.width - 80);
        const newOffset = instance.dragStartOffset - (deltaX * sensitivity);
        
        instance.offset = Math.max(0, Math.min(newOffset, maxOffset));
        drawChart(instanceKey, instance.balanceHistory);
        
        event.preventDefault();
        return;
    }

    // Handle hover effects
    const tooltip = document.querySelector('.' + instance.tooltipClass);
    if (!canvas.dataPoints || !tooltip) return;

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
        instance.activePoint = closestPoint;
        
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
        drawChart(instanceKey, instance.balanceHistory);
    } else {
        tooltip.style.opacity = '0';
        if (instance.activePoint !== null) {
            instance.activePoint = null;
            drawChart(instanceKey, instance.balanceHistory);
        }
    }
}

function handleChartMouseUp(event, instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas || !instance.isDragging) return;
    
    instance.isDragging = false;
    canvas.style.cursor = 'grab';
    
    // Apply momentum and snap to nearest data point
    if (Math.abs(instance.dragVelocity) > 0.1) {
        animateChartMomentum(instanceKey);
    } else {
        snapToNearestPoint(instanceKey);
    }
    
    event.preventDefault();
}

function handleChartMouseLeave(instanceKey) {
    const instance = chartInstances[instanceKey];
    const tooltip = document.querySelector('.' + instance.tooltipClass);
    if (tooltip) tooltip.style.opacity = '0';
    
    if (instance.activePoint !== null) {
        instance.activePoint = null;
        if (instance.balanceHistory) {
            drawChart(instanceKey, instance.balanceHistory);
        }
    }
}

function animateChartMomentum(instanceKey) {
    const instance = chartInstances[instanceKey];
    const friction = 0.95;
    const minVelocity = 0.1;
    
    function animate() {
        if (Math.abs(instance.dragVelocity) < minVelocity) {
            snapToNearestPoint(instanceKey);
            return;
        }
        
        const maxOffset = Math.max(0, instance.balanceHistory.length - instance.pointsToShow);
        const sensitivity = maxOffset / 300;
        instance.offset -= instance.dragVelocity * sensitivity * 10;
        instance.offset = Math.max(0, Math.min(instance.offset, maxOffset));
        
        instance.dragVelocity *= friction;
        drawChart(instanceKey, instance.balanceHistory);
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

function snapToNearestPoint(instanceKey) {
    const instance = chartInstances[instanceKey];
    const maxOffset = Math.max(0, instance.balanceHistory.length - instance.pointsToShow);
    const targetOffset = Math.round(instance.offset);
    
    if (Math.abs(targetOffset - instance.offset) > 0.1) {
        const startOffset = instance.offset;
        const startTime = Date.now();
        const duration = 200;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            instance.offset = startOffset + (targetOffset - startOffset) * easeProgress;
            drawChart(instanceKey, instance.balanceHistory);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        animate();
    }
}

// Touch event handlers
function handleChartTouchStart(event, instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas) return;
    
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    
    instance.isDragging = true;
    instance.dragStartX = touch.clientX - rect.left;
    instance.dragStartOffset = instance.offset;
    instance.dragVelocity = 0;
    instance.lastDragTime = Date.now();
    instance.lastDragX = instance.dragStartX;
    
    canvas.style.cursor = 'grabbing';
    event.preventDefault();
}

function handleChartTouchMove(event, instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas || !instance.isDragging) return;
    
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const deltaX = currentX - instance.dragStartX;
    const currentTime = Date.now();
    
    // Calculate velocity for momentum
    const timeDelta = currentTime - instance.lastDragTime;
    if (timeDelta > 0) {
        instance.dragVelocity = (currentX - instance.lastDragX) / timeDelta;
    }
    instance.lastDragTime = currentTime;
    instance.lastDragX = currentX;
    
    // Calculate new offset based on drag distance
    const maxOffset = Math.max(0, instance.balanceHistory.length - instance.pointsToShow);
    const sensitivity = maxOffset / (canvas.width - 80);
    const newOffset = instance.dragStartOffset - (deltaX * sensitivity);
    
    instance.offset = Math.max(0, Math.min(newOffset, maxOffset));
    drawChart(instanceKey, instance.balanceHistory);
    
    event.preventDefault();
}

function handleChartTouchEnd(event, instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas || !instance.isDragging) return;
    
    instance.isDragging = false;
    canvas.style.cursor = 'grab';
    
    // Apply momentum and snap to nearest data point
    if (Math.abs(instance.dragVelocity) > 0.1) {
        animateChartMomentum(instanceKey);
    } else {
        snapToNearestPoint(instanceKey);
    }
    
    event.preventDefault();
}

// Initialize chart with event listeners
function initializeChart(instanceKey) {
    const instance = chartInstances[instanceKey];
    const canvas = document.getElementById(instance.canvasId);
    if (!canvas) {
        return;
    }
    
    canvas.style.cursor = 'grab';
    
    // Create tooltip element if it doesn't exist
    if (!document.querySelector('.' + instance.tooltipClass)) {
        const tooltip = document.createElement('div');
        tooltip.className = instance.tooltipClass + ' price-tooltip';
        document.body.appendChild(tooltip);
    }
    
    // Remove existing event listeners to prevent duplicates
    const existingHandlers = canvas._chartHandlers || {};
    Object.keys(existingHandlers).forEach(event => {
        canvas.removeEventListener(event, existingHandlers[event]);
    });
    
    // Add new event listeners
    const handlers = {
        mousedown: (e) => handleChartMouseDown(e, instanceKey),
        mousemove: (e) => handleChartMouseMove(e, instanceKey),
        mouseup: (e) => handleChartMouseUp(e, instanceKey),
        mouseleave: () => handleChartMouseLeave(instanceKey),
        touchstart: (e) => handleChartTouchStart(e, instanceKey),
        touchmove: (e) => handleChartTouchMove(e, instanceKey),
        touchend: (e) => handleChartTouchEnd(e, instanceKey),
        contextmenu: (e) => e.preventDefault()
    };
    
    Object.keys(handlers).forEach(event => {
        canvas.addEventListener(event, handlers[event], { passive: false });
    });
    
    // Store handlers for cleanup
    canvas._chartHandlers = handlers;
}

// Wrapper functions for backward compatibility
function drawBalanceChart() {
    if (currentUser && currentUser.balanceHistory) {
        drawChart('dashboard', currentUser.balanceHistory);
    }
}

function drawPlayerBalanceChart(balanceHistory) {
    drawChart('player', balanceHistory);
}

function initializePlayerChart() {
    initializeChart('player');
}

// ... existing code ...

// Close player detail modal
function closePlayerDetailModal() {
    document.getElementById('player-detail-modal').classList.add('hidden');
}

// ... existing code ...

// Case System Functions
let currentCaseTab = 'cases';
let selectedCasesForBattle = {};

// Initialize case system when page loads
function initializeCaseSystem() {
    loadCases();
    loadBattles();
    loadInventory();
    setupCaseEventListeners();
    
    // Setup socket listeners for real-time updates
    if (socket) {
        socket.on('case-opened', handleCaseOpened);
        socket.on('battle-created', handleBattleCreated);
        socket.on('battle-completed', handleBattleCompleted);
        socket.on('battle-result', handleBattleResult);
        socket.on('item-sold', handleItemSold);
        socket.on('marketplace-purchase', handleMarketplacePurchase);
        socket.on('marketplace-sale', handleMarketplaceSale);
        socket.on('marketplace-transaction', handleMarketplaceTransaction);
    }
}

function setupCaseEventListeners() {
    // Case tab switching
    const casesTabs = document.querySelectorAll('.tab-btn');
    casesTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabType = e.target.textContent.toLowerCase().trim();
            showCaseTab(tabType);
        });
    });

    // Battle mode filter
    const battleModeFilter = document.getElementById('battle-mode-filter');
    if (battleModeFilter) {
        battleModeFilter.addEventListener('change', loadBattles);
    }

    // Inventory filters
    const rarityFilter = document.getElementById('rarity-filter');
    const limitedFilter = document.getElementById('limited-filter');
    if (rarityFilter) {
        rarityFilter.addEventListener('change', loadInventory);
    }
    if (limitedFilter) {
        limitedFilter.addEventListener('change', loadInventory);
    }
}

function showCaseTab(tabType) {
    currentCaseTab = tabType;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the correct tab
    const activeTab = Array.from(document.querySelectorAll('.tab-btn'))
        .find(btn => btn.textContent.toLowerCase().trim() === tabType);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active');
    });
    
    const tabContent = document.getElementById(tabType === 'cases' ? 'cases-tab' : 'battles-tab');
    if (tabContent) {
        tabContent.classList.remove('hidden');
        tabContent.classList.add('active');
    }
    
    // Load appropriate content
    if (tabType === 'cases') {
        loadCases();
    } else if (tabType === 'case battles') {
        loadBattles();
    }
}

async function loadCases() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load cases');
        }
        
        const data = await response.json();
        console.log('Cases loaded:', data.cases); // Debug log
        displayCases(data.cases);
    } catch (error) {
        console.error('Error loading cases:', error);
        showNotification('Error loading cases', 'error');
    }
}

function displayCases(cases) {
    const casesGrid = document.getElementById('cases-grid');
    if (!casesGrid) return;
    
    casesGrid.innerHTML = '';
    
    // Define unique icons and colors for each case
    const caseIcons = {
        'Starter Case': { icon: 'package', color: '#10b981' },
        'Gambler\'s Delight': { icon: 'dice-6', color: '#f59e0b' },
        'Mystic Treasures': { icon: 'sparkles', color: '#8b5cf6' },
        'Neon Dreams': { icon: 'zap', color: '#06b6d4' },
        'Ocean\'s Bounty': { icon: 'droplets', color: '#3b82f6' }
    };
    
    cases.forEach(caseItem => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        const caseIcon = caseIcons[caseItem.name] || { icon: 'package', color: '#10b981' };
        caseCard.innerHTML = `
            <div class="case-icon" style="background: ${caseIcon.color}">
                <i data-lucide="${caseIcon.icon}" style="color: white"></i>
            </div>
            <div class="case-info">
                <div class="case-name">${caseItem.name}</div>
                <div class="case-description">${caseItem.description}</div>
                <div class="case-price">$${caseItem.price.toFixed(2)}</div>
                <div class="case-stats">
                    <div class="case-stat">
                        <div class="case-stat-label">Items</div>
                        <div class="case-stat-value">${caseItem.items.length}</div>
                    </div>
                    <div class="case-stat">
                        <div class="case-stat-label">Opened</div>
                        <div class="case-stat-value">${caseItem.totalOpenings}</div>
                    </div>
                </div>

                <div class="case-actions">
                    <button class="case-action-btn primary" type="button">
                        Open $${caseItem.price.toFixed(2)}
                    </button>
                </div>
            </div>
        `;
        
        // Add click event listeners
        const openBtn = caseCard.querySelector('.case-action-btn.primary');
        
        // Make entire card clickable for details (but not buttons)
        caseCard.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.closest('.case-action-btn')) {
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            console.log('Case card clicked for details:', caseItem._id);
            showCaseDetails(caseItem);
        });
        
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Open button clicked for case:', caseItem._id);
                openCase(caseItem._id);
            });
        }
        
        casesGrid.appendChild(caseCard);
    });
    
    // Initialize Lucide icons for case icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function openCase(caseId) {
    try {
        console.log('Opening case:', caseId); // Debug log
        console.log('Current user token:', localStorage.getItem('token') ? 'Token exists' : 'No token'); // Debug auth
        const response = await fetch(`${API_BASE_URL}/api/cases/open/${caseId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to open case');
        }
        
        const data = await response.json();
        console.log('Case opened successfully:', data); // Debug log
        showCaseOpeningModal(data.caseName, data.item, data.caseItems);
        
        // Update balance
        updateBalanceDisplay(data.newBalance);
        
        // Refresh inventory
        loadInventory();
        
        showNotification(`Won ${data.item.name}!`, 'success');
    } catch (error) {
        console.error('Error opening case:', error);
        showNotification(error.message || 'Error opening case', 'error');
    }
}

// Store the last won item for quick sell
let lastWonItem = null;

function showCaseOpeningModal(caseName, wonItem, caseItems) {
    const modal = document.getElementById('case-opening-modal');
    const title = document.getElementById('case-opening-title');
    const reel = document.getElementById('case-opening-reel');
    const result = document.getElementById('case-opening-result');
    const animation = document.querySelector('.case-opening-animation');
    
    if (!modal) return;
    
    // Store the won item for quick sell
    lastWonItem = wonItem;
    
    title.textContent = `Opening ${caseName}`;
    modal.classList.remove('hidden');
    
    // Hide result initially and remove any previous classes
    result.classList.add('hidden');
    result.classList.remove('show-result');
    modal.classList.remove('shake');
    
    // Clear reel and reset transform
    reel.innerHTML = '';
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    
    // Get icon based on rarity with user preference [[memory:3053701]]
    const rarityIcons = {
        'common': 'package',
        'uncommon': 'gem', 
        'rare': 'diamond',
        'epic': 'star',
        'legendary': 'crown',
        'mythical': 'sparkles'
    };
    
    // Create more items for smoother animation
    const totalItems = 50;
    const wonItemIndex = 35 + Math.floor(Math.random() * 10); // Position winning item near the end
    
    // Generate items
    for (let i = 0; i < totalItems; i++) {
        const item = document.createElement('div');
        item.className = 'case-opening-item';
        
        let displayItem;
        if (i === wonItemIndex) {
            displayItem = wonItem;
            // Don't add winning-item class initially - it will be highlighted dynamically
        } else {
            // Use actual case items for variety
            displayItem = caseItems[Math.floor(Math.random() * caseItems.length)];
        }
        
        // Create item content with better styling
        item.innerHTML = `
            <div class="item-icon rarity-${displayItem.rarity}" style="--rarity-color: var(--${displayItem.rarity}-color)">
                <i data-lucide="${rarityIcons[displayItem.rarity] || 'package'}"></i>
            </div>
            <div class="item-content">
                <div class="item-name">${displayItem.name}</div>
                <div class="item-value">$${displayItem.value.toFixed(2)}</div>
            </div>
            <div class="item-rarity-glow rarity-${displayItem.rarity}"></div>
        `;
        
        reel.appendChild(item);
    }
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Start animation sequence
    setTimeout(() => {
        // Calculate exact positioning with responsive sizing
        const containerWidth = animation.offsetWidth;
        const isMobile = window.innerWidth <= 768;
        const itemWidth = isMobile ? 100 : 140; // Responsive item width
        const itemHeight = isMobile ? 100 : 140; // Ensure square aspect ratio
        const itemGap = isMobile ? 12 : 16; // Responsive gap (proportional to item size)
        const totalItemWidth = itemWidth + itemGap;
        
        // Ensure all items maintain square aspect ratio
        Array.from(reel.children).forEach(item => {
            item.style.width = `${itemWidth}px`;
            item.style.height = `${itemHeight}px`;
        });
        
        // Calculate winning position
        const winningPosition = wonItemIndex * totalItemWidth;
        const centerPosition = containerWidth / 2 - itemWidth / 2;
        const finalOffset = -(winningPosition - centerPosition);
        
        // Store animation state for skipping
        window.currentCaseAnimation = {
            animationFrame: null,
            startTime: Date.now(),
            duration: 4000,
            finalOffset: finalOffset,
            wonItemIndex: wonItemIndex,
            reel: reel,
            animation: animation,
            modal: modal,
            wonItem: wonItem,
            rarityIcons: rarityIcons,
            itemWidth: itemWidth,
            itemHeight: itemHeight,
            itemGap: itemGap
        };
        
        // Add window resize listener to maintain square aspect ratio
        const resizeHandler = () => {
            const newIsMobile = window.innerWidth <= 768;
            const newItemWidth = newIsMobile ? 100 : 140;
            const newItemHeight = newIsMobile ? 100 : 140;
            const newItemGap = newIsMobile ? 12 : 16;
            
            Array.from(reel.children).forEach(item => {
                item.style.width = `${newItemWidth}px`;
                item.style.height = `${newItemHeight}px`;
            });
            
            // Update the stored gap value for calculations
            if (window.currentCaseAnimation) {
                window.currentCaseAnimation.itemGap = newItemGap;
            }
        };
        
        window.addEventListener('resize', resizeHandler);
        
        // Store the resize handler for cleanup
        window.currentCaseAnimation.resizeHandler = resizeHandler;
        
        // Main animation with dynamic highlighting
        const animationDuration = 4000; // 4 seconds
        const startTime = Date.now();
        let animationFrame;
        
        // Function to update highlighting based on current position
        function updateHighlighting(currentOffset) {
            // Calculate which item is currently under the indicator
            // The indicator is at the center of the container
            const indicatorCenter = containerWidth / 2;
            
            // The reel starts at left: 50px, and each item is 140px wide with 20px gap
            // So the first item's center is at: 50 + 70 = 120px
            const firstItemCenter = 50 + itemWidth / 2;
            
            // Calculate which item index is currently under the indicator
            // currentOffset moves the reel left (negative), so we add it to find the new position
            const currentItemCenter = firstItemCenter + currentOffset;
            const distanceFromFirst = indicatorCenter - currentItemCenter;
            const currentItemIndex = Math.round(distanceFromFirst / totalItemWidth);
            
            // Remove highlighting from all items
            Array.from(reel.children).forEach((item, index) => {
                item.classList.remove('cursor-highlight');
            });
            
            // Add highlighting to current item if it's within bounds
            if (currentItemIndex >= 0 && currentItemIndex < reel.children.length) {
                reel.children[currentItemIndex].classList.add('cursor-highlight');
            }
        }
        
        // Animation loop
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Create acceleration/deceleration curve (ease-in-out)
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            const currentOffset = finalOffset * easeProgress;
            reel.style.transform = `translateX(${currentOffset}px)`;
            
            // Update highlighting
            updateHighlighting(currentOffset);
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
                window.currentCaseAnimation.animationFrame = animationFrame;
            } else {
                // Animation complete - highlight the winning item
                Array.from(reel.children).forEach((item, index) => {
                    item.classList.remove('cursor-highlight');
                    if (index === wonItemIndex) {
                        item.classList.add('winner-revealed');
                    }
                });
                
                // Add impact effects
                animation.classList.add('impact');
                modal.classList.add('shake');
                
                setTimeout(() => {
                    modal.classList.remove('shake');
                    animation.classList.remove('impact');
                }, 600);
            }
        }
        
        // Start the animation
        animate();
        
        // Show result with celebration
        setTimeout(() => {
            result.classList.remove('hidden');
            result.classList.add('show-result');
            
            // Hide skip button after animation completes
            const skipBtn = document.getElementById('skip-animation-btn');
            if (skipBtn) {
                skipBtn.style.display = 'none';
            }
            
            // Play celebration animation
            setTimeout(() => {
                animation.classList.add('celebration');
                setTimeout(() => animation.classList.remove('celebration'), 2000);
            }, 200);
            
            // Update result display
            document.getElementById('won-item-name').textContent = wonItem.name;
            document.getElementById('won-item-value').textContent = `$${wonItem.value.toFixed(2)}`;
            document.getElementById('won-item-rarity').textContent = wonItem.rarity;
            document.getElementById('won-item-rarity').className = `item-rarity ${wonItem.rarity}`;
            
            // Update quick sell button
            const quickSellBtn = document.getElementById('quick-sell-btn');
            if (quickSellBtn) {
                const sellPrice = wonItem.isLimited ? wonItem.value : Math.floor(wonItem.value * 0.7);
                quickSellBtn.textContent = `Quick Sell ($${sellPrice.toFixed(2)})`;
            }
            
            // Handle item image/icon with robust fallback
            const wonItemImage = document.getElementById('won-item-image');
            const imagePath = wonItem.image && wonItem.image !== 'default-item.png' ? 
                (wonItem.image.startsWith('http') ? wonItem.image : `/images/${wonItem.image}`) : null;
            
            if (imagePath) {
                wonItemImage.src = imagePath;
                wonItemImage.style.display = 'block';
                wonItemImage.onerror = () => {
                    wonItemImage.style.display = 'none';
                    const iconContainer = document.createElement('div');
                    iconContainer.className = `item-icon-large rarity-${wonItem.rarity}`;
                    iconContainer.innerHTML = `<i data-lucide="${rarityIcons[wonItem.rarity] || 'package'}"></i>`;
                    wonItemImage.parentNode.appendChild(iconContainer);
                    lucide.createIcons();
                };
                wonItemImage.onload = () => {
                    // Image loaded successfully, ensure icon is hidden
                    const existingIcon = wonItemImage.parentNode.querySelector('.item-icon-large');
                    if (existingIcon) {
                        existingIcon.remove();
                    }
                };
            } else {
                wonItemImage.style.display = 'none';
                const iconContainer = document.createElement('div');
                iconContainer.className = `item-icon-large rarity-${wonItem.rarity}`;
                iconContainer.innerHTML = `<i data-lucide="${rarityIcons[wonItem.rarity] || 'package'}"></i>`;
                wonItemImage.parentNode.appendChild(iconContainer);
                lucide.createIcons();
            }
            
        }, 5200);
        
    }, 200);
}

// Skip the case opening animation and show result immediately
function skipCaseAnimation() {
    if (!window.currentCaseAnimation) return;
    
    // Cancel the current animation
    if (window.currentCaseAnimation.animationFrame) {
        cancelAnimationFrame(window.currentCaseAnimation.animationFrame);
    }
    
    const { reel, animation, modal, wonItemIndex, wonItem, rarityIcons } = window.currentCaseAnimation;
    
    // Jump to final position with responsive sizing
    const containerWidth = animation.offsetWidth;
    const itemWidth = window.currentCaseAnimation.itemWidth || 140;
    const itemHeight = window.currentCaseAnimation.itemHeight || 140;
    const itemGap = window.currentCaseAnimation.itemGap || 16;
    const centerPosition = containerWidth / 2 - itemWidth / 2;
    const winningPosition = wonItemIndex * (itemWidth + itemGap);
    const finalOffset = -(winningPosition - centerPosition);
    
    // Ensure items maintain square aspect ratio
    Array.from(reel.children).forEach(item => {
        item.style.width = `${itemWidth}px`;
        item.style.height = `${itemHeight}px`;
    });
    
    reel.style.transform = `translateX(${finalOffset}px)`;
    
    // Remove all highlighting and add winner highlight
    Array.from(reel.children).forEach((item, index) => {
        item.classList.remove('cursor-highlight');
        if (index === wonItemIndex) {
            item.classList.add('winner-revealed');
        }
    });
    
    // Add impact effects
    animation.classList.add('impact');
    modal.classList.add('shake');
    
    setTimeout(() => {
        modal.classList.remove('shake');
        animation.classList.remove('impact');
    }, 600);
    
    // Show result immediately
    const result = document.getElementById('case-opening-result');
    result.classList.remove('hidden');
    result.classList.add('show-result');
    
    // Play celebration animation
    setTimeout(() => {
        animation.classList.add('celebration');
        setTimeout(() => animation.classList.remove('celebration'), 2000);
    }, 200);
    
    // Update result display
    document.getElementById('won-item-name').textContent = wonItem.name;
    document.getElementById('won-item-value').textContent = `$${wonItem.value.toFixed(2)}`;
    document.getElementById('won-item-rarity').textContent = wonItem.rarity;
    document.getElementById('won-item-rarity').className = `item-rarity ${wonItem.rarity}`;
    
    // Update quick sell button
    const quickSellBtn = document.getElementById('quick-sell-btn');
    if (quickSellBtn) {
        const sellPrice = wonItem.isLimited ? wonItem.value : Math.floor(wonItem.value * 0.7);
        quickSellBtn.textContent = `Quick Sell ($${sellPrice.toFixed(2)})`;
    }
    
    // Handle item image/icon with robust fallback
    const wonItemImage = document.getElementById('won-item-image');
    const imagePath = wonItem.image && wonItem.image !== 'default-item.png' ? 
        (wonItem.image.startsWith('http') ? wonItem.image : `/images/${wonItem.image}`) : null;
    
    if (imagePath) {
        wonItemImage.src = imagePath;
        wonItemImage.style.display = 'block';
        wonItemImage.onerror = () => {
            wonItemImage.style.display = 'none';
            const iconContainer = document.createElement('div');
            iconContainer.className = `item-icon-large rarity-${wonItem.rarity}`;
            iconContainer.innerHTML = `<i data-lucide="${rarityIcons[wonItem.rarity] || 'package'}"></i>`;
            wonItemImage.parentNode.appendChild(iconContainer);
            lucide.createIcons();
        };
        wonItemImage.onload = () => {
            // Image loaded successfully, ensure icon is hidden
            const existingIcon = wonItemImage.parentNode.querySelector('.item-icon-large');
            if (existingIcon) {
                existingIcon.remove();
            }
        };
    } else {
        wonItemImage.style.display = 'none';
        const iconContainer = document.createElement('div');
        iconContainer.className = `item-icon-large rarity-${wonItem.rarity}`;
        iconContainer.innerHTML = `<i data-lucide="${rarityIcons[wonItem.rarity] || 'package'}"></i>`;
        wonItemImage.parentNode.appendChild(iconContainer);
        lucide.createIcons();
    }
    
    // Hide skip button
    const skipBtn = document.getElementById('skip-animation-btn');
    if (skipBtn) {
        skipBtn.style.display = 'none';
    }
    
    // Clear animation state
    window.currentCaseAnimation = null;
}

// Quick sell the last won item
async function quickSellItem() {
    if (!lastWonItem) {
        showNotification('No item to sell', 'error');
        return;
    }
    
    try {
        // First, we need to find the item in the inventory
        const response = await fetch(`${API_BASE_URL}/api/inventory`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load inventory');
        }
        
        const inventoryData = await response.json();
        
        // Find the most recent item that matches the won item
        const matchingItem = inventoryData.inventory.items
            .sort((a, b) => new Date(b.obtainedAt) - new Date(a.obtainedAt))
            .find(item => 
                item.itemName === lastWonItem.name && 
                item.rarity === lastWonItem.rarity &&
                item.value === lastWonItem.value
            );
        
        if (!matchingItem) {
            throw new Error('Item not found in inventory');
        }
        
        // Sell the item
        const sellResponse = await fetch(`${API_BASE_URL}/api/inventory/sell/${matchingItem._id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!sellResponse.ok) {
            const error = await sellResponse.json();
            throw new Error(error.message || 'Failed to sell item');
        }
        
        const sellData = await sellResponse.json();
        
        // Update balance
        updateBalanceDisplay(sellData.newBalance);
        
        // Close modal
        closeCaseOpeningModal();
        
        showNotification(`Item sold for $${sellData.sellPrice.toFixed(2)}!`, 'success');
        
    } catch (error) {
        console.error('Error selling item:', error);
        showNotification(error.message || 'Error selling item', 'error');
    }
}

function closeCaseOpeningModal() {
    const modal = document.getElementById('case-opening-modal');
    const reel = document.getElementById('case-opening-reel');
    const result = document.getElementById('case-opening-result');
    const animation = document.querySelector('.case-opening-animation');
    
    if (modal) {
        modal.classList.add('hidden');
        
        // Cancel any ongoing animation and cleanup
        if (window.currentCaseAnimation) {
            if (window.currentCaseAnimation.animationFrame) {
                cancelAnimationFrame(window.currentCaseAnimation.animationFrame);
            }
            
            // Remove resize listener
            if (window.currentCaseAnimation.resizeHandler) {
                window.removeEventListener('resize', window.currentCaseAnimation.resizeHandler);
            }
            
            window.currentCaseAnimation = null;
        }
        
        // Reset skip button
        const skipBtn = document.getElementById('skip-animation-btn');
        if (skipBtn) {
            skipBtn.style.display = 'flex';
        }
        
        // Remove all animation classes
        modal.classList.remove('shake');
        if (animation) {
            animation.classList.remove('impact', 'celebration');
        }
        if (result) {
            result.classList.remove('show-result');
        }
        
        // Reset reel
        reel.style.transition = 'none';
        reel.style.transform = 'translateX(0)';
        reel.innerHTML = '';
        
        // Clean up any icon containers
        const iconContainers = modal.querySelectorAll('.item-icon-large');
        iconContainers.forEach(container => container.remove());
        
        // Reset last won item
        lastWonItem = null;
    }
}

async function loadBattles() {
    try {
        const modeFilter = document.getElementById('battle-mode-filter')?.value || '';
        const response = await fetch(`${API_BASE_URL}/api/cases/battles/active?mode=${modeFilter}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load battles');
        }
        
        const data = await response.json();
        displayBattles(data.battles);
    } catch (error) {
        console.error('Error loading battles:', error);
        showNotification('Error loading battles', 'error');
    }
}

function displayBattles(battles) {
    const battlesGrid = document.getElementById('battles-grid');
    if (!battlesGrid) return;
    
    battlesGrid.innerHTML = '';
    
    if (battles.length === 0) {
        battlesGrid.innerHTML = '<div class="no-battles">No active battles found</div>';
        return;
    }
    
    battles.forEach(battle => {
        const battleCard = document.createElement('div');
        battleCard.className = 'battle-card';
        battleCard.innerHTML = `
            <div class="battle-header">
                <div class="battle-mode">${battle.mode}</div>
                <div class="battle-cost">$${battle.totalCost.toFixed(2)}</div>
            </div>
            <div class="battle-players">
                ${Array.from({length: battle.maxPlayers}, (_, i) => {
                    const player = battle.players && battle.players[i];
                    return `<div class="battle-player ${!player ? 'empty' : ''}">
                        ${player ? player.username.charAt(0).toUpperCase() : '?'}
                    </div>`;
                }).join('')}
            </div>
            <div class="battle-cases">
                ${battle.cases ? battle.cases.map(caseItem => 
                    `<div class="battle-case">${caseItem.caseName} x${caseItem.quantity}</div>`
                ).join('') : ''}
            </div>
            <div class="battle-actions">
                <button class="battle-join-btn" onclick="joinBattle('${battle.battleId}')" 
                        ${battle.currentPlayers >= battle.maxPlayers ? 'disabled' : ''}>
                    ${battle.currentPlayers >= battle.maxPlayers ? 'Full' : 'Join Battle'}
                </button>
                ${battle.players.length > 0 && battle.players[0].userId === currentUser?.id && battle.players.length < battle.maxPlayers ? 
                    `<button class="battle-bots-btn" onclick="callBots('${battle.battleId}')">Call Bots</button>` : ''}
            </div>
        `;
        battlesGrid.appendChild(battleCard);
    });
}

async function joinBattle(battleId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/join/${battleId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to join battle');
        }
        
        const data = await response.json();
        
        // Update balance
        updateBalanceDisplay(data.newBalance);
        
        // Refresh battles
        loadBattles();
        
        showNotification('Joined battle successfully!', 'success');
    } catch (error) {
        console.error('Error joining battle:', error);
        showNotification(error.message || 'Error joining battle', 'error');
    }
}

async function callBots(battleId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/${battleId}/call-bots`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to call bots');
        }
        
        const data = await response.json();
        
        // Refresh battles
        loadBattles();
        
        showNotification('Bots added to battle!', 'success');
    } catch (error) {
        console.error('Error calling bots:', error);
        showNotification(error.message || 'Error calling bots', 'error');
    }
}


function showCreateBattleModal() {
    const modal = document.getElementById('create-battle-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadBattleCases();
    }
}

function closeCreateBattleModal() {
    const modal = document.getElementById('create-battle-modal');
    if (modal) {
        modal.classList.add('hidden');
        selectedCasesForBattle = {};
        updateSelectedCasesDisplay();
    }
}

async function loadBattleCases() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load cases');
        }
        
        const data = await response.json();
        window.availableCases = data.cases;
        displayBattleCases(data.cases);
    } catch (error) {
        console.error('Error loading battle cases:', error);
        showNotification('Error loading cases', 'error');
    }
}

function displayBattleCases(cases) {
    const grid = document.getElementById('battle-cases-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const caseIcons = {
        'Starter Case': { icon: 'package', color: '#10b981' },
        'Gambler\'s Delight': { icon: 'dice-6', color: '#f59e0b' },
        'Mystic Treasures': { icon: 'sparkles', color: '#8b5cf6' },
        'Neon Dreams': { icon: 'zap', color: '#06b6d4' },
        'Ocean\'s Bounty': { icon: 'droplets', color: '#3b82f6' }
    };
    
    cases.forEach(caseItem => {
        const caseOption = document.createElement('div');
        caseOption.className = 'battle-case-option';
        const caseIcon = caseIcons[caseItem.name] || { icon: 'package', color: '#10b981' };
        const currentQuantity = selectedCasesForBattle[caseItem._id] || 0;
        
        caseOption.innerHTML = `
            <div class="case-icon" style="background: ${caseIcon.color}; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="${caseIcon.icon}" style="color: white; width: 20px; height: 20px;"></i>
            </div>
            <div class="case-info">
                <div class="case-name">${caseItem.name}</div>
                <div class="case-price">$${caseItem.price.toFixed(2)}</div>
                <div class="case-quantity-controls">
                    <button class="quantity-btn minus" onclick="adjustCaseQuantity('${caseItem._id}', -1)" ${currentQuantity === 0 ? 'disabled' : ''}>-</button>
                    <span class="quantity-display">${currentQuantity}</span>
                    <button class="quantity-btn plus" onclick="adjustCaseQuantity('${caseItem._id}', 1)">+</button>
                </div>
            </div>
        `;
        grid.appendChild(caseOption);
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function adjustCaseQuantity(caseId, change) {
    const currentQuantity = selectedCasesForBattle[caseId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);
    
    const totalCases = Object.values(selectedCasesForBattle).reduce((sum, qty) => sum + qty, 0);
    const totalAfterChange = totalCases - currentQuantity + newQuantity;
    
    if (totalAfterChange > 25) {
        showNotification('Maximum of 25 cases allowed per battle', 'error');
        return;
    }
    
    if (newQuantity === 0) {
        delete selectedCasesForBattle[caseId];
    } else {
        selectedCasesForBattle[caseId] = newQuantity;
    }
    
    updateSelectedCasesDisplay();
    updateBattleCost();
    refreshBattleCasesDisplay();
}

function refreshBattleCasesDisplay() {
    document.querySelectorAll('.battle-case-option').forEach(option => {
        const caseId = option.querySelector('.quantity-btn').getAttribute('onclick').match(/'([^']+)'/)[1];
        const currentQuantity = selectedCasesForBattle[caseId] || 0;
        const quantityDisplay = option.querySelector('.quantity-display');
        const minusBtn = option.querySelector('.quantity-btn.minus');
        
        if (quantityDisplay) quantityDisplay.textContent = currentQuantity;
        if (minusBtn) minusBtn.disabled = currentQuantity === 0;
        
        option.classList.toggle('selected', currentQuantity > 0);
    });
}

function updateSelectedCasesDisplay() {
    const container = document.getElementById('selected-cases');
    if (!container) return;
    
    container.innerHTML = '';
    
    const totalCases = Object.values(selectedCasesForBattle).reduce((sum, qty) => sum + qty, 0);
    if (totalCases > 0) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-selection-btn';
        clearBtn.textContent = 'Clear All';
        clearBtn.onclick = clearCaseSelection;
        container.appendChild(clearBtn);
    }
    
    Object.entries(selectedCasesForBattle).forEach(([caseId, quantity]) => {
        const caseData = window.availableCases?.find(c => c._id === caseId);
        if (!caseData) return;
        
        const selectedCase = document.createElement('div');
        selectedCase.className = 'selected-case';
        selectedCase.innerHTML = `
            <span class="case-name">${caseData.name}</span>
            <span class="case-quantity">x${quantity}</span>
            <span class="case-total">$${(caseData.price * quantity).toFixed(2)}</span>
            <button class="remove-btn" onclick="removeCaseFromSelection('${caseId}')">×</button>
        `;
        container.appendChild(selectedCase);
    });
}

function clearCaseSelection() {
    selectedCasesForBattle = {};
    updateSelectedCasesDisplay();
    updateBattleCost();
    refreshBattleCasesDisplay();
}

function removeCaseFromSelection(caseId) {
    delete selectedCasesForBattle[caseId];
    updateSelectedCasesDisplay();
    updateBattleCost();
    refreshBattleCasesDisplay();
}

function updateBattleCost() {
    let totalCost = 0;
    Object.entries(selectedCasesForBattle).forEach(([caseId, quantity]) => {
        const caseData = window.availableCases?.find(c => c._id === caseId);
        if (caseData) {
            totalCost += caseData.price * quantity;
        }
    });
    
    const costDisplay = document.getElementById('battle-total-cost');
    if (costDisplay) {
        costDisplay.textContent = totalCost.toFixed(2);
    }
}

async function createBattle() {
    const totalCases = Object.values(selectedCasesForBattle).reduce((sum, qty) => sum + qty, 0);
    if (totalCases === 0) {
        showNotification('Please select at least one case', 'error');
        return;
    }
    
    const mode = document.getElementById('battle-mode-select').value;
    const isPrivate = document.getElementById('battle-private-checkbox').checked;
    
    const battleData = {
        cases: Object.entries(selectedCasesForBattle).map(([caseId, quantity]) => ({
            caseId: caseId,
            quantity: quantity
        })),
        mode: mode,
        isPrivate: isPrivate
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(battleData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create battle');
        }
        
        const data = await response.json();
        
        // Update balance
        updateBalanceDisplay(data.newBalance);
        
        // Close modal and refresh battles
        closeCreateBattleModal();
        loadBattles();
        
        showNotification('Battle created successfully!', 'success');
    } catch (error) {
        console.error('Error creating battle:', error);
        showNotification(error.message || 'Error creating battle', 'error');
    }
}

async function loadInventory() {
    try {
        const token = localStorage.getItem('token');
        console.log('Loading inventory with token:', token ? 'Token exists' : 'No token'); // Debug log
        
        const response = await fetch(`${API_BASE_URL}/api/inventory`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load inventory');
        }
        
        const data = await response.json();
        console.log('Inventory loaded:', data.inventory); // Debug log
        displayInventory(data.inventory);
        updateInventoryStats(data.inventory);
    } catch (error) {
        console.error('Error loading inventory:', error);
        // Show empty inventory instead of error
        displayInventory({ items: [] });
        updateInventoryStats({ totalItems: 0, totalValue: 0, limitedItems: 0 });
    }
}

function displayInventory(inventory) {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!inventory || !inventory.items || inventory.items.length === 0) {
        grid.innerHTML = '<div class="no-items">No items in inventory yet. Open some cases to get started!</div>';
        return;
    }
    
    inventory.items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = `inventory-item ${item.isLimited ? 'limited' : ''}`;
        
        // Get icon based on rarity
        const rarityIcons = {
            'common': 'package',
            'uncommon': 'gem',
            'rare': 'diamond',
            'epic': 'star',
            'legendary': 'crown',
            'mythical': 'sparkles'
        };
        
        const sellPrice = item.isLimited ? item.value : Math.floor(item.value * 0.7);
        
        // Escape special characters in item name and ID to prevent syntax errors
        const escapedItemName = item.itemName.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const escapedItemId = item._id.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const escapedRarity = item.rarity.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        // Create image path - try multiple possible locations
        const imagePath = item.image && item.image !== 'default-item.png' ? 
            (item.image.startsWith('http') ? item.image : `/images/${item.image}`) : null;
        
        itemCard.innerHTML = `
            <div class="item-image">
                ${imagePath ? 
                    `<img src="${imagePath}" alt="${item.itemName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" onload="this.style.display='block'; this.nextElementSibling.style.display='none';">` : 
                    ''
                }
                <div class="item-icon rarity-${item.rarity}" style="${imagePath ? 'display: flex;' : 'display: flex;'}">
                    <i data-lucide="${rarityIcons[item.rarity] || 'package'}"></i>
                </div>
            </div>
            <div class="item-details">
                <div class="item-header">
                <div class="item-name">${item.itemName}</div>
                    ${item.count > 1 ? `<div class="item-count">x${item.count}</div>` : ''}
                </div>
                <div class="item-value">$${item.value.toFixed(2)}${item.count > 1 ? ' each' : ''}</div>
                <div class="item-rarity ${item.rarity}">${item.rarity}</div>
                <div class="item-source">From ${item.caseSource}</div>
                <div class="item-actions">
                    <button class="item-action-btn sell" onclick="showSellModal('${escapedItemId}', '${escapedItemName}', ${item.count}, ${sellPrice}, '${escapedRarity}')">
                        Sell ($${sellPrice.toFixed(2)})
                    </button>
                    ${item.isLimited ? `
                        <button class="item-action-btn list" onclick="listItem('${escapedItemId}')">
                            List
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        grid.appendChild(itemCard);
    });
    
    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateInventoryStats(inventory) {
    if (!inventory) return;
    
    const totalItems = document.getElementById('inventory-total-items');
    const totalValue = document.getElementById('inventory-total-value');
    const limitedItems = document.getElementById('inventory-limited-items');
    
    if (totalItems) totalItems.textContent = inventory.totalItems || 0;
    if (totalValue) totalValue.textContent = `$${(inventory.totalValue || 0).toFixed(2)}`;
    if (limitedItems) limitedItems.textContent = inventory.limitedItems || 0;
}

// Global variables for sell modal
let currentSellItem = null;

function showSellModal(itemId, itemName, maxCount, sellPricePerItem, rarity = null) {
    const modal = document.getElementById('sell-item-modal');
    const nameElement = document.getElementById('sell-item-name');
    const quantityInput = document.getElementById('sell-quantity');
    const totalPriceElement = document.getElementById('sell-total-price');
    const rarityElement = document.getElementById('sell-item-rarity');
    
    if (!modal) return;
    
    currentSellItem = {
        id: itemId,
        name: itemName,
        maxCount: maxCount,
        pricePerItem: sellPricePerItem,
        rarity: rarity
    };
    
    nameElement.textContent = itemName;
    quantityInput.value = 1;
    quantityInput.max = maxCount;
    totalPriceElement.textContent = `$${sellPricePerItem.toFixed(2)}`;
    
    // Update rarity display
    if (rarityElement && rarity) {
        rarityElement.textContent = rarity;
        rarityElement.className = `sell-item-rarity ${rarity}`;
        rarityElement.style.display = 'block';
    } else if (rarityElement) {
        rarityElement.style.display = 'none';
    }
    
    modal.classList.remove('hidden');
}

function closeSellModal() {
    const modal = document.getElementById('sell-item-modal');
    if (modal) {
        modal.classList.add('hidden');
        currentSellItem = null;
    }
}

function adjustSellQuantity(change) {
    const quantityInput = document.getElementById('sell-quantity');
    const totalPriceElement = document.getElementById('sell-total-price');
    
    if (!currentSellItem) return;
    
    let newQuantity = parseInt(quantityInput.value) + change;
    newQuantity = Math.max(1, Math.min(newQuantity, currentSellItem.maxCount));
    
    quantityInput.value = newQuantity;
    const totalPrice = newQuantity * currentSellItem.pricePerItem;
    totalPriceElement.textContent = `$${totalPrice.toFixed(2)}`;
}

// Update quantity when input changes
document.addEventListener('DOMContentLoaded', () => {
    const quantityInput = document.getElementById('sell-quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', () => {
            const totalPriceElement = document.getElementById('sell-total-price');
            if (!currentSellItem) return;
            
            let quantity = parseInt(quantityInput.value) || 1;
            quantity = Math.max(1, Math.min(quantity, currentSellItem.maxCount));
            quantityInput.value = quantity;
            
            const totalPrice = quantity * currentSellItem.pricePerItem;
            totalPriceElement.textContent = `$${totalPrice.toFixed(2)}`;
        });
    }
});

async function confirmSellItem() {
    if (!currentSellItem) return;
    
    const quantityInput = document.getElementById('sell-quantity');
    const quantity = parseInt(quantityInput.value) || 1;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/inventory/sell/${currentSellItem.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ count: quantity })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to sell item');
        }
        
        const data = await response.json();
        
        // Update balance
        updateBalanceDisplay(data.newBalance);
        
        // Close modal
        closeSellModal();
        
        // Refresh inventory
        loadInventory();
        
        showNotification(data.message, 'success');
    } catch (error) {
        console.error('Error selling item:', error);
        showNotification(error.message || 'Error selling item', 'error');
    }
}

// Legacy function for backward compatibility
async function sellItem(itemId) {
    // This is now handled through the sell modal
    console.warn('sellItem called directly, should use showSellModal instead');
}

function showItemDetails(item) {
    const modal = document.getElementById('item-details-modal');
    if (!modal) return;
    
    document.getElementById('item-details-name').textContent = item.itemName;
    document.getElementById('item-details-value').textContent = `$${item.value.toFixed(2)}`;
    document.getElementById('item-details-rarity').textContent = item.rarity;
    document.getElementById('item-details-rarity').className = `item-rarity ${item.rarity}`;
    document.getElementById('item-details-source').textContent = `From ${item.caseSource}`;
    document.getElementById('item-details-limited').textContent = item.isLimited ? 'Limited Item' : 'Regular Item';
    
    const image = document.getElementById('item-details-image');
    image.src = item.image;
    image.onerror = () => image.style.display = 'none';
    
    // Update action buttons
    const listBtn = document.getElementById('list-item-btn');
    if (listBtn) {
        listBtn.style.display = item.isLimited ? 'block' : 'none';
        listBtn.onclick = () => listItem(item._id);
    }
    
    modal.classList.remove('hidden');
}

function closeItemDetailsModal() {
    const modal = document.getElementById('item-details-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function listItem(itemId) {
    // This would open a listing modal where users can set their price
    // For now, we'll just show a notification
    showNotification('Marketplace listing feature coming soon!', 'info');
}

function showCaseDetails(caseItem) {
    const modal = document.getElementById('case-details-modal');
    if (!modal) return;
    
    // Populate modal with case details
    document.getElementById('case-details-name').textContent = caseItem.name;
    document.getElementById('case-details-description').textContent = caseItem.description;
    document.getElementById('case-details-price').textContent = `$${caseItem.price.toFixed(2)}`;
    document.getElementById('case-details-items-count').textContent = caseItem.items.length;
    document.getElementById('case-details-openings').textContent = caseItem.totalOpenings;
    
    // Display items
    const itemsContainer = document.getElementById('case-details-items');
    itemsContainer.innerHTML = '';
    
    caseItem.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = `case-detail-item ${item.rarity}`;
        itemElement.innerHTML = `
            <div class="case-detail-item-name">${item.name}</div>
            <div class="case-detail-item-value">$${item.value.toFixed(2)}</div>
            <div class="case-detail-item-rarity ${item.rarity}">${item.rarity}</div>
            <div class="case-detail-item-probability">${item.probability}%</div>
            ${item.isLimited ? '<div class="case-detail-item-limited">Limited</div>' : ''}
        `;
        itemsContainer.appendChild(itemElement);
    });
    
    modal.classList.remove('hidden');
}

function closeCaseDetailsModal() {
    const modal = document.getElementById('case-details-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Socket event handlers
function handleCaseOpened(data) {
    // Update balance if it's for current user
    if (data.userId === currentUser?.id) {
        updateBalanceDisplay(data.newBalance);
        loadInventory();
    }
}

function handleBattleCreated(data) {
    loadBattles();
    showNotification(`New ${data.mode} battle created!`, 'info');
}

function handleBattleCompleted(data) {
    loadBattles();
    
    // Show animation for the completed battle
    showBattleAnimation(data);
    
    // Show notification
    showNotification(`Battle completed! Winner: ${data.winnerUsername}`, 'success');
}

function handleBattleResult(data) {
    if (data.won) {
        showNotification(`You won the battle! Total value: $${data.totalValue.toFixed(2)}`, 'success');
    } else {
        showNotification(`Battle completed. Total value: $${data.totalValue.toFixed(2)}`, 'info');
    }
// Battle animation state
let currentBattleAnimation = {
    battleId: null,
    currentCaseIndex: 0,
    players: [],
    cases: [],
    isAnimating: false,
    timeoutId: null
};

function showBattleAnimation(battle) {
    const modal = document.getElementById('battle-animation-modal');
    const title = document.getElementById('battle-animation-title');
    const playersContainer = document.getElementById('battle-animation-players');
    const casesContainer = document.getElementById('battle-animation-cases');
    
    if (!modal) return;
    
    // Setup animation state
    currentBattleAnimation = {
        battleId: battle.battleId,
        currentCaseIndex: 0,
        players: battle.players,
        cases: battle.cases,
        isAnimating: true,
        timeoutId: null
    };
    
    modal.classList.remove('hidden');
    
    title.textContent = `${battle.mode} Battle`;
    
    // Setup players
    playersContainer.innerHTML = '';
    battle.players.forEach(player => {
        const playerEl = document.createElement('div');
        playerEl.className = 'battle-animation-player';
        playerEl.innerHTML = `
            <div class="player-name">${player.username}</div>
            <div class="player-items" id="player-items-${player.userId}"></div>
            <div class="player-total">$0.00</div>
        `;
        playersContainer.appendChild(playerEl);
    });
    
    // Start animation
    startBattleAnimation();
}

function startBattleAnimation() {
    if (!currentBattleAnimation.isAnimating) return;
    
    const { players, cases, currentCaseIndex } = currentBattleAnimation;
    
    if (currentCaseIndex >= cases.reduce((sum, c) => sum + c.quantity, 0)) {
        // Animation complete, show results
        showBattleResults();
        return;
    }
    
    let caseToOpen = null;
    let caseIndex = 0;
    let quantityCount = 0;
    
    for (const caseItem of cases) {
        if (currentCaseIndex < quantityCount + caseItem.quantity) {
            caseToOpen = caseItem;
            caseIndex = currentCaseIndex - quantityCount;
            break;
        }
        quantityCount += caseItem.quantity;
    }
    
    if (!caseToOpen) return;
    
    // Animate case opening for each player
    animatePlayerCaseOpening(players, caseToOpen, caseIndex);
    
    currentBattleAnimation.currentCaseIndex++;
    
    // Schedule next animation
    currentBattleAnimation.timeoutId = setTimeout(startBattleAnimation, 2000);
}

function animatePlayerCaseOpening(players, caseItem, caseIndex) {
    players.forEach((player, playerIndex) => {
        const playerItemsContainer = document.getElementById(`player-items-${player.userId}`);
        if (!playerItemsContainer) return;
        
        // Calculate which item to show based on case index
        const itemIndex = caseIndex + playerIndex * caseItem.quantity;
        const item = player.items[itemIndex];
        
        if (!item) return;
        
        // Create item element
        const itemEl = document.createElement('div');
        itemEl.className = `battle-item ${item.itemRarity}`;
        itemEl.innerHTML = `
            <div class="item-name">${item.itemName}</div>
            <div class="item-value">$${item.itemValue.toFixed(2)}</div>
        `;
        
        // Add to container with animation
        playerItemsContainer.appendChild(itemEl);
        
        // Update player total
        const playerTotal = playerItemsContainer.parentElement.querySelector('.player-total');
        const currentTotal = parseFloat(playerTotal.textContent.replace('$', '')) || 0;
        const newTotal = currentTotal + item.itemValue;
        playerTotal.textContent = `$${newTotal.toFixed(2)}`;
        
        if (item.itemValue > caseItem.casePrice * 2) {
            itemEl.classList.add('highlight');
            playSound('win');
        } else {
            playSound('item');
        }
    });
}

function showBattleResults() {
    const { players } = currentBattleAnimation;
    
    // Find winner (player with highest total value)
    const winner = players.reduce((prev, current) => 
        (prev.totalValue > current.totalValue) ? prev : current
    );
    
    const winnerEl = document.getElementById(`player-items-${winner.userId}`);
    if (winnerEl) {
        winnerEl.parentElement.classList.add('winner');
    }
    
    const resultsEl = document.createElement('div');
    resultsEl.className = 'battle-results';
    resultsEl.innerHTML = `
        <div class="winner-banner">
            <div class="winner-name">${winner.username} WINS!</div>
            <div class="winner-value">$${winner.totalValue.toFixed(2)}</div>
        </div>
        <button class="close-btn" onclick="closeBattleAnimation()">Close</button>
    `;
    
    document.getElementById('battle-animation-modal').appendChild(resultsEl);
    
    // Stop animation
    currentBattleAnimation.isAnimating = false;
    if (currentBattleAnimation.timeoutId) {
        clearTimeout(currentBattleAnimation.timeoutId);
    }
    
    playSound('jackpot');
}

function closeBattleAnimation() {
    const modal = document.getElementById('battle-animation-modal');
    if (modal) {
        modal.classList.add('hidden');
        
        // Clear animation state
        currentBattleAnimation = {
            battleId: null,
            currentCaseIndex: 0,
            players: [],
            cases: [],
            isAnimating: false,
            timeoutId: null
        };
        
        // Remove any results elements
        const resultsEl = modal.querySelector('.battle-results');
        if (resultsEl) {
            resultsEl.remove();
        }
    }
}

// Helper function to play sounds
function playSound(type) {
    // Check if audio is supported and enabled
    if (!window.Audio || !currentUser?.settings?.soundEnabled) return;
    
    const sounds = {
        'win': 'win.mp3',
        'item': 'item.mp3',
        'jackpot': 'jackpot.mp3'
    };
    
    if (!sounds[type]) return;
    
    try {
        const audio = new Audio(`/sounds/${sounds[type]}`);
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Sound play error:', e));
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}


    loadInventory();
}

function handleItemSold(data) {
    updateBalanceDisplay(data.newBalance);
    loadInventory();
}

function handleMarketplacePurchase(data) {
    updateBalanceDisplay(data.newBalance);
    loadInventory();
}

function handleMarketplaceSale(data) {
    updateBalanceDisplay(data.newBalance);
    showNotification(`Item sold for $${data.price.toFixed(2)}!`, 'success');
}

function handleMarketplaceTransaction(data) {
    showNotification(`${data.itemName} sold for $${data.price.toFixed(2)}`, 'info');
}

function updateBalanceDisplay(newBalance) {
    const balanceElements = document.querySelectorAll('#top-balance, #profile-balance');
    balanceElements.forEach(element => {
        if (element) {
            element.textContent = `$${newBalance.toFixed(2)}`;
        }
    });
    
    if (currentUser) {
        currentUser.balance = newBalance;
    }
}

// Initialize case system when cases page is shown
function initializeCasesPage() {
    if (currentPage === 'cases') {
        initializeCaseSystem();
    }
}

// ... existing code ...
