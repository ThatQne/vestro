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

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Initialize Plinko if on plinko page
    if (window.location.hash === '#plinko-game') {
        setTimeout(() => {
            initializePlinko();
        }, 500);
    }
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

// Plinko Game Variables
let plinkoCanvas, plinkoCtx;
let plinkoConfig = {
    risk: 'low',
    rows: 8,  // Default to 8 rows
    ballSize: 8,  // Will be adjusted based on rows
    pegSize: 4,
    gravity: 0.4,
    bounce: 0.6,
    friction: 0.99
};

let plinkoState = {
    isDropping: false,
    balls: [],
    pegs: [],
    buckets: [],
    multipliers: [],
    animationId: null,
    lastGameTime: 0  // Rate limiting
};

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
        console.log('Plinko canvas not found, retrying...');
        setTimeout(() => {
            initializePlinko();
        }, 100);
        return;
    }
    
    plinkoCtx = plinkoCanvas.getContext('2d');
    
    // Set default UI state
    setPlinkoRisk('low');
    setPlinkoRows(8);
    
    // Set canvas size
    resizePlinkoCanvas();
    
    // Setup initial game state
    setupPlinkoGame();
    
    // Setup autobet handlers
    setupPlinkoAutobet();
    
    // Add resize listener (only once)
    if (!window.plinkoResizeListenerAdded) {
        window.addEventListener('resize', resizePlinkoCanvas);
        window.plinkoResizeListenerAdded = true;
    }
    
    // Start game loop
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
    const maxWidth = 500;
    const aspectRatio = 600 / 400; // height / width
    
    const canvasWidth = Math.min(containerWidth, maxWidth);
    const canvasHeight = canvasWidth * aspectRatio;
    
    plinkoCanvas.width = canvasWidth;
    plinkoCanvas.height = canvasHeight;
    plinkoCanvas.style.width = canvasWidth + 'px';
    plinkoCanvas.style.height = canvasHeight + 'px';
    
    // Recalculate game elements
    if (plinkoCtx) {
        setupPlinkoGame();
    }
}

// Setup Plinko game elements
function setupPlinkoGame() {
    if (!plinkoCanvas || !plinkoCtx) {
        console.log('Canvas not ready for setup');
        return;
    }
    
    const { rows } = plinkoConfig;
    const { width, height } = plinkoCanvas;
    
    // Adjust ball size based on rows
    plinkoConfig.ballSize = rows <= 8 ? 8 : rows <= 12 ? 6 : 5;
    plinkoConfig.pegSize = rows <= 8 ? 5 : rows <= 12 ? 4 : 3;
    
    // Clear previous state
    plinkoState.pegs = [];
    plinkoState.buckets = [];
    plinkoState.balls = [];
    
    // Calculate peg positions - start from row with 3 pegs (skip top 2 rows)
    const pegSpacing = width / (rows + 1);
    const rowSpacing = (height - 120) / rows;
    
    // Start from row 2 (which has 3 pegs) instead of row 0
    for (let row = 2; row < rows + 2; row++) {
        for (let col = 0; col <= row; col++) {
            const x = width / 2 + (col - row / 2) * pegSpacing;
            const y = 60 + (row - 2) * rowSpacing;
            
            plinkoState.pegs.push({ x, y, row, col });
        }
    }
    
    // Calculate bucket positions
    const bucketCount = rows + 1;
    const bucketWidth = width / bucketCount;
    
    for (let i = 0; i < bucketCount; i++) {
        const x = i * bucketWidth;
        const y = height - 50;
        
        plinkoState.buckets.push({
            x,
            y,
            width: bucketWidth,
            height: 50,
            index: i
        });
    }
}

// Plinko ball physics
class PlinkoBall {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        // Use current ball size from config (recalculated based on rows)
        this.radius = plinkoConfig.ballSize;
        this.bounced = false;
        this.finished = false;
        this.bucketIndex = -1;
        this.lastPegHit = null; // Prevent multiple hits on same peg
    }
    
    update() {
        // Apply gravity
        this.vy += plinkoConfig.gravity;
        
        // Apply friction
        this.vx *= plinkoConfig.friction;
        this.vy *= plinkoConfig.friction;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Check peg collisions
        this.checkPegCollisions();
        
        // Check bucket collision
        this.checkBucketCollision();
        
        // Check bounds
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx) * plinkoConfig.bounce;
        }
        if (this.x > plinkoCanvas.width - this.radius) {
            this.x = plinkoCanvas.width - this.radius;
            this.vx = -Math.abs(this.vx) * plinkoConfig.bounce;
        }
    }
    
    checkPegCollisions() {
        for (const peg of plinkoState.pegs) {
            // Skip if this is the same peg we just hit
            if (this.lastPegHit === peg) continue;
            
            const dx = this.x - peg.x;
            const dy = this.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.radius + plinkoConfig.pegSize) {
                // Calculate collision response
                const angle = Math.atan2(dy, dx);
                const force = 0.8 + Math.random() * 0.4; // Random bounce force
                
                // Add some randomness to the bounce direction
                const randomAngle = angle + (Math.random() - 0.5) * 0.3;
                
                this.vx = Math.cos(randomAngle) * force * 1.5;
                this.vy = Math.sin(randomAngle) * force * 1.5;
                
                // Separate from peg
                const separationDistance = this.radius + plinkoConfig.pegSize + 1;
                this.x = peg.x + separationDistance * Math.cos(angle);
                this.y = peg.y + separationDistance * Math.sin(angle);
                
                this.bounced = true;
                this.lastPegHit = peg;
                
                // Reset last peg hit after a short time
                setTimeout(() => {
                    if (this.lastPegHit === peg) {
                        this.lastPegHit = null;
                    }
                }, 100);
                
                break; // Only process one collision per frame
            }
        }
    }
    
    checkBucketCollision() {
        // Check if ball is in bucket area
        if (this.y > plinkoCanvas.height - 70) {
            for (let i = 0; i < plinkoState.buckets.length; i++) {
                const bucket = plinkoState.buckets[i];
                
                // More precise bucket collision detection
                if (this.x >= bucket.x - 5 && this.x <= bucket.x + bucket.width + 5) {
                    this.finished = true;
                    this.bucketIndex = i;
                    this.y = bucket.y - this.radius;
                    this.vx = 0;
                    this.vy = 0;
                    break;
                }
            }
            
            // Fallback: if ball is below buckets but not in any bucket, put in closest
            if (!this.finished && this.y > plinkoCanvas.height - 40) {
                let closestBucket = 0;
                let closestDistance = Math.abs(this.x - (plinkoState.buckets[0].x + plinkoState.buckets[0].width / 2));
                
                for (let i = 1; i < plinkoState.buckets.length; i++) {
                    const bucketCenter = plinkoState.buckets[i].x + plinkoState.buckets[i].width / 2;
                    const distance = Math.abs(this.x - bucketCenter);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestBucket = i;
                    }
                }
                
                this.finished = true;
                this.bucketIndex = closestBucket;
                this.y = plinkoState.buckets[closestBucket].y - this.radius;
                this.vx = 0;
                this.vy = 0;
            }
        }
    }
    
    draw() {
        plinkoCtx.beginPath();
        plinkoCtx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        
        // Gradient for better visual
        const gradient = plinkoCtx.createRadialGradient(
            this.x - this.radius/3, this.y - this.radius/3, 0,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#d1d5db');
        
        plinkoCtx.fillStyle = gradient;
        plinkoCtx.fill();
        plinkoCtx.strokeStyle = '#9ca3af';
        plinkoCtx.lineWidth = 1;
        plinkoCtx.stroke();
    }
}

// Game loop
function plinkoGameLoop() {
    if (!plinkoCanvas || !plinkoCtx) {
        // Canvas not ready, stop loop
        return;
    }
    
    // Update balls
    for (let i = plinkoState.balls.length - 1; i >= 0; i--) {
        const ball = plinkoState.balls[i];
        ball.update();
        
        if (ball.finished) {
            handleBallFinished(ball);
            plinkoState.balls.splice(i, 1);
        }
    }
    
    // Draw everything
    drawPlinko();
    
    // Continue loop
    plinkoState.animationId = requestAnimationFrame(plinkoGameLoop);
}

// Draw Plinko game
function drawPlinko() {
    if (!plinkoCanvas || !plinkoCtx) return;
    
    const { width, height } = plinkoCanvas;
    
    // Clear canvas
    plinkoCtx.clearRect(0, 0, width, height);
    
    // Draw pegs
    plinkoCtx.fillStyle = '#6b7280';
    plinkoCtx.strokeStyle = '#4b5563';
    plinkoCtx.lineWidth = 1;
    
    for (const peg of plinkoState.pegs) {
        plinkoCtx.beginPath();
        plinkoCtx.arc(peg.x, peg.y, plinkoConfig.pegSize, 0, 2 * Math.PI);
        plinkoCtx.fill();
        plinkoCtx.stroke();
    }
    
    // Draw buckets with multipliers
    const { risk, rows } = plinkoConfig;
    const multipliers = plinkoMultipliers[risk][rows];
    
    plinkoCtx.strokeStyle = '#374151';
    plinkoCtx.lineWidth = 2;
    plinkoCtx.font = Math.max(10, Math.min(14, width / 30)) + 'px Arial';
    plinkoCtx.textAlign = 'center';
    
    for (let i = 0; i < plinkoState.buckets.length; i++) {
        const bucket = plinkoState.buckets[i];
        const multiplier = multipliers[i];
        
        // Determine color based on risk and multiplier value
        let bucketColor = '#374151';
        let textColor = '#ffffff';
        
        if (risk === 'low') {
            if (multiplier >= 2) {
                bucketColor = '#10b981';
                textColor = '#ffffff';
            } else if (multiplier >= 1) {
                bucketColor = '#6b7280';
                textColor = '#ffffff';
            } else {
                bucketColor = '#ef4444';
                textColor = '#ffffff';
            }
        } else if (risk === 'medium') {
            if (multiplier >= 10) {
                bucketColor = '#10b981';
                textColor = '#ffffff';
            } else if (multiplier >= 2) {
                bucketColor = '#3b82f6';
                textColor = '#ffffff';
            } else {
                bucketColor = '#ef4444';
                textColor = '#ffffff';
            }
        } else if (risk === 'high') {
            if (multiplier >= 100) {
                bucketColor = '#10b981';
                textColor = '#ffffff';
            } else if (multiplier >= 10) {
                bucketColor = '#3b82f6';
                textColor = '#ffffff';
            } else {
                bucketColor = '#ef4444';
                textColor = '#ffffff';
            }
        }
        
        // Draw bucket
        plinkoCtx.strokeStyle = bucketColor;
        plinkoCtx.fillStyle = bucketColor + '20'; // Semi-transparent fill
        plinkoCtx.beginPath();
        plinkoCtx.rect(bucket.x, bucket.y, bucket.width, bucket.height);
        plinkoCtx.fill();
        plinkoCtx.stroke();
        
        // Draw multiplier text
        plinkoCtx.fillStyle = textColor;
        plinkoCtx.fillText(
            multiplier + 'x',
            bucket.x + bucket.width / 2,
            bucket.y + bucket.height / 2 + 4
        );
    }
    
    // Draw balls
    for (const ball of plinkoState.balls) {
        ball.draw();
    }
    
    // Draw drop zone - perfectly centered
    plinkoCtx.strokeStyle = '#10b981';
    plinkoCtx.lineWidth = 3;
    plinkoCtx.beginPath();
    plinkoCtx.arc(width / 2, 25, 8, 0, 2 * Math.PI);
    plinkoCtx.stroke();
    
    // Draw drop zone indicator
    plinkoCtx.fillStyle = '#10b981';
    plinkoCtx.font = '12px Arial';
    plinkoCtx.textAlign = 'center';
    plinkoCtx.fillText('DROP', width / 2, 45);
}

// Drop ball function - allow multiple balls with rate limiting
function dropBall() {
    if (!currentUser) return;
    
    // Rate limiting - prevent spam
    const now = Date.now();
    if (now - plinkoState.lastGameTime < 500) { // 500ms minimum between drops
        return;
    }
    
    // Ensure canvas is initialized
    if (!plinkoCanvas || !plinkoCtx) {
        console.log('Canvas not initialized, attempting to initialize...');
        initializePlinko();
        setTimeout(() => {
            dropBall();
        }, 200);
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
    
    plinkoState.lastGameTime = now;
    
    // Create new ball with slight randomness in starting position
    const randomOffset = (Math.random() - 0.5) * 10; // Reduced randomness
    const ball = new PlinkoBall(plinkoCanvas.width / 2 + randomOffset, 25);
    ball.betAmount = betAmount; // Store bet amount with ball
    plinkoState.balls.push(ball);
    
    // Update button text to show dropping
    const dropBtn = document.getElementById('drop-ball-btn');
    const dropBtnText = document.getElementById('drop-btn-text');
    if (dropBtn && dropBtnText) {
        dropBtnText.textContent = `Dropping (${plinkoState.balls.length})`;
    }
}

// Handle ball finished
function handleBallFinished(ball) {
    const { risk, rows } = plinkoConfig;
    const multipliers = plinkoMultipliers[risk][rows];
    
    // Ensure bucket index is valid
    if (ball.bucketIndex < 0 || ball.bucketIndex >= multipliers.length) {
        console.error('Invalid bucket index:', ball.bucketIndex);
        return;
    }
    
    const multiplier = multipliers[ball.bucketIndex];
    
    // Process the game result
    handlePlinkoGameResult(ball.bucketIndex, multiplier, ball.betAmount);
    
    // Update button text
    const dropBtn = document.getElementById('drop-ball-btn');
    const dropBtnText = document.getElementById('drop-btn-text');
    if (dropBtn && dropBtnText) {
        if (plinkoState.balls.length > 1) {
            dropBtnText.textContent = `Dropping (${plinkoState.balls.length - 1})`;
        } else {
            dropBtnText.textContent = 'Drop Ball';
        }
    }
}

// Handle game result with better error handling
async function handlePlinkoGameResult(bucketIndex, multiplier, betAmount) {
    // Rate limiting check
    const now = Date.now();
    if (now - plinkoState.lastGameTime < 100) {
        console.log('Rate limited, skipping game result');
        return;
    }
    
    const winAmount = Math.round(betAmount * multiplier * 100) / 100;
    const profit = winAmount - betAmount;
    
    // Debug logging
    console.log('Plinko Game Result:', {
        bucketIndex,
        multiplier,
        betAmount,
        winAmount,
        risk: plinkoConfig.risk,
        rows: plinkoConfig.rows,
        playerChoice: `${plinkoConfig.risk}-${plinkoConfig.rows}`
    });
    
    // Send to server with better error handling
    try {
        const gameData = {
            gameType: 'plinko',
            betAmount: Math.round(betAmount * 100) / 100, // Ensure precision
            playerChoice: `${plinkoConfig.risk}-${plinkoConfig.rows}`,
            targetNumber: bucketIndex,
            multiplier: Math.round(multiplier * 100) / 100, // Ensure precision
            winAmount: winAmount
        };
        
        console.log('Sending to server:', gameData);
        
        const response = await fetch(`${API_BASE_URL}/api/games/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(gameData)
        });
        
        console.log('Server response status:', response.status);
        
        // Handle non-JSON responses (like rate limiting)
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
            console.log('Server response data:', data);
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            showGameNotification(false, null, 'Server error - please try again');
            return;
        }
        
        if (data.success) {
            // Update user data
            if (data.user) {
                currentUser = data.user;
            } else if (currentUser && data.result) {
                currentUser.balance = Math.round(data.result.balanceAfter * 100) / 100;
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
                if (multiplier >= 1) {
                    if (typeof currentUser.wins === 'number') currentUser.wins += 1;
                    if (typeof currentUser.totalWon === 'number') currentUser.totalWon += winAmount;
                } else {
                    if (typeof currentUser.losses === 'number') currentUser.losses += 1;
                    if (typeof currentUser.totalLost === 'number') currentUser.totalLost += betAmount;
                }
            }
            
            updateUserInterface();
            
            // Show game notification
            const isWin = multiplier >= 1;
            showGameNotification(isWin, profit);
            
            // Display provably fair
            if (data.result.hash) {
                displayPlinkoHash(data.result.hash, data.result.timestamp);
            }
            
            // Handle level up
            if (data.result && data.result.leveledUp) {
                setTimeout(() => {
                    showGameNotification(true, null, 
                        `Level Up! +${data.result.levelsGained} level(s)!`);
                    fetchUserProfile(true);
                }, 500);
            }
            
            // Continue autobet
            if (plinkoAutobet.isActive) {
                continuePlinkoAutobet(isWin, profit);
            }
            
        } else {
            console.error('Game failed:', data.message);
            showGameNotification(false, null, data.message || 'Game failed');
        }
        
    } catch (error) {
        console.error('Plinko game error:', error);
        showGameNotification(false, null, 'Connection error - please try again');
    }
}

// Set plinko risk
function setPlinkoRisk(risk) {
    plinkoConfig.risk = risk;
    
    // Update UI
    document.querySelectorAll('[id^="risk-"]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`risk-${risk}-btn`).classList.add('active');
    document.getElementById('plinko-risk').textContent = risk.charAt(0).toUpperCase() + risk.slice(1);
    
    // Update game immediately
    if (plinkoCanvas && plinkoCtx) {
        setupPlinkoGame();
        drawPlinko(); // Force immediate redraw
    }
}

// Set plinko rows
function setPlinkoRows(rows) {
    plinkoConfig.rows = rows;
    
    // Update UI
    document.querySelectorAll('[id^="rows-"]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`rows-${rows}-btn`).classList.add('active');
    document.getElementById('plinko-rows').textContent = rows;
    
    // Clear existing balls since they have wrong size
    plinkoState.balls = [];
    
    // Update game immediately
    if (plinkoCanvas && plinkoCtx) {
        setupPlinkoGame();
        drawPlinko(); // Force immediate redraw
    }
}

// Display plinko hash
function displayPlinkoHash(hash, timestamp) {
    const diceVisual = document.querySelector('#plinko-game-page .dice-visual');
    if (!diceVisual) return;
    
    let existingElement = document.getElementById('plinko-provably-fair-result');
    if (existingElement) {
        existingElement.remove();
    }
    
    const provablyFairElement = document.createElement('div');
    provablyFairElement.id = 'plinko-provably-fair-result';
    provablyFairElement.className = 'provably-fair-result';
    provablyFairElement.innerHTML = `
        🎲 Provably Fair: ${hash.substring(0, 16)}...
        <button class="copy-hash-btn" onclick="copyHash('${hash}')">Copy Full Hash</button>
    `;
    
    diceVisual.appendChild(provablyFairElement);
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

// Continue plinko autobet
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
        // Next bet after delay
        setTimeout(() => {
            if (plinkoAutobet.isActive) {
                dropBall();
            }
        }, 1000);
    }
}

// Check if should stop autobet
function shouldStopAutobet(won, profit) {
    const { settings, stats } = plinkoAutobet;
    
    // Check bet count
    if (!settings.isInfinite && stats.totalBets >= settings.betCount) {
        return true;
    }
    
    // Check profit/loss limits
    if (settings.stopOnWin && stats.totalProfit >= settings.stopOnWin) {
        return true;
    }
    
    if (settings.stopOnLoss && stats.totalProfit <= -settings.stopOnLoss) {
        return true;
    }
    
    // Check balance percentage
    const balanceChange = ((currentUser.balance - stats.startBalance) / stats.startBalance) * 100;
    
    if (settings.stopOnBalanceGain && balanceChange >= settings.stopOnBalanceGain) {
        return true;
    }
    
    if (settings.stopOnBalanceLoss && balanceChange <= -settings.stopOnBalanceLoss) {
        return true;
    }
    
    return false;
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

// Set plinko risk