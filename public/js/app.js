// Global variables
let currentUser = null;
let socket = null;
let currentPage = 'login';

// API Base URL - use Render backend for both dev and prod
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'https://vestro-lz81.onrender.com' 
    : '';

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
        // Connect to Render backend for socket connection
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'https://vestro-lz81.onrender.com' 
            : '';
        socket = io(socketUrl);
        
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

    // Add username input handler for live indicator
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', checkUserExists);
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/check-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username })
        });

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

async function fetchUserProfile() {
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
            hideLoginPage();
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
        'profile-avatar': currentUser.username.charAt(0).toUpperCase()
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Update XP bar
    updateXPBar();

    // No need to save to localStorage anymore

    // Update chart data with animations
    updateChart();
}

function updateXPBar() {
    const currentXPElement = document.getElementById('current-xp');
    const requiredXPElement = document.getElementById('required-xp');
    const xpFillElement = document.getElementById('xp-fill');
    
    if (currentUser && currentXPElement && requiredXPElement && xpFillElement) {
        const currentXP = currentUser.experience || 0;
        const requiredXP = currentUser.level * 100; // 100 XP per level
        const xpProgress = currentXP % 100; // XP progress in current level
        const xpPercentage = (xpProgress / 100) * 100;
        
        currentXPElement.textContent = xpProgress;
        requiredXPElement.textContent = 100;
        xpFillElement.style.width = xpPercentage + '%';
    }
}

// Remove localStorage functions as we're using MongoDB now

function showPage(pageId) {
    // Hide all pages
    const pages = ['dashboard-page', 'games-page', 'trades-page', 'marketplace-page', 'profile-page', 'coinflip-game-page', 'dice-game-page'];
    pages.forEach(page => {
        const pageElement = document.getElementById(page);
        if (pageElement) {
            pageElement.classList.add('hidden');
        }
    });

    // Show selected page
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    currentPage = pageId;
    
    // Reinitialize icons after page change
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 50);
    }
    
    // Update page-specific data
    if (pageId === 'profile') {
        loadProfileData();
    }
    
    // Redraw chart when showing dashboard
    if (pageId === 'dashboard' && currentUser) {
        setTimeout(() => {
            drawBalanceChart();
        }, 100);
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
    const dataPoints = currentUser.balanceHistory;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set up scales
    const xScale = (width - padding * 2) / (dataPoints.length - 1);
    const minBalance = Math.min(...dataPoints);
    const maxBalance = Math.max(...dataPoints);
    const balanceRange = maxBalance - minBalance;
    const yScale = (height - padding * 2) / balanceRange;
    
    // Draw grid
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
        const x = padding + (width - padding * 2) * (i / 10);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }
    
    // Horizontal grid lines and labels
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height - padding * 2) * (i / 5);
        const value = maxBalance - (balanceRange * (i / 5));
        
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
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < dataPoints.length; i++) {
        const x = padding + i * xScale;
        const y = height - padding - (dataPoints[i] - minBalance) * yScale;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw points
    for (let i = 0; i < dataPoints.length; i++) {
        const x = padding + i * xScale;
        const y = height - padding - (dataPoints[i] - minBalance) * yScale;
        const isWin = i > 0 && dataPoints[i] > dataPoints[i-1];
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isWin ? '#3fb950' : '#f85149';
        ctx.fill();
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = 1;
        ctx.stroke();
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

// Dice Game Variables
let isRolling = false;
let autoBetActive = false;
let autoBetCount = 0;
let autoBetSettings = {
    count: 0,
    stopWin: 0,
    stopLoss: 0,
    increaseLoss: 0
};

let rollType = 'over'; // 'over' or 'under'

// Initialize dice game
function initializeDiceGame() {
    const targetSlider = document.getElementById('dice-target');
    const targetValue = document.getElementById('dice-target-value');
    const multiplierDisplay = document.getElementById('dice-multiplier');
    const chanceDisplay = document.getElementById('dice-chance');
    const rollTypeText = document.getElementById('roll-type-text');
    
    function updateDiceStats() {
        const target = parseFloat(targetSlider.value);
        let chance, multiplier;
        
        if (rollType === 'over') {
            chance = (100 - target) / 100;
            if (rollTypeText) rollTypeText.textContent = 'Roll Over';
        } else {
            chance = (target - 1) / 100;
            if (rollTypeText) rollTypeText.textContent = 'Roll Under';
        }
        
        multiplier = 0.99 / chance;
        
        if (targetValue) targetValue.textContent = target.toFixed(2);
        if (multiplierDisplay) multiplierDisplay.textContent = multiplier.toFixed(2) + 'x';
        if (chanceDisplay) chanceDisplay.textContent = (chance * 100).toFixed(2) + '%';
    }
    
    if (targetSlider) {
        targetSlider.addEventListener('input', updateDiceStats);
        updateDiceStats();
    }
}

function setRollType(type) {
    rollType = type;
    const overBtn = document.getElementById('roll-over-btn');
    const underBtn = document.getElementById('roll-under-btn');
    const sliderTrack = document.querySelector('.slider-track');
    const diceTrack = document.querySelector('.dice-track');
    
    if (overBtn && underBtn) {
        if (type === 'over') {
            overBtn.classList.add('active');
            underBtn.classList.remove('active');
            if (sliderTrack) sliderTrack.classList.remove('under');
            if (diceTrack) diceTrack.classList.remove('under');
        } else {
            underBtn.classList.add('active');
            overBtn.classList.remove('active');
            if (sliderTrack) sliderTrack.classList.add('under');
            if (diceTrack) diceTrack.classList.add('under');
        }
    }
    
    // Update stats display
    const targetSlider = document.getElementById('dice-target');
    const targetValue = document.getElementById('dice-target-value');
    const multiplierDisplay = document.getElementById('dice-multiplier');
    const chanceDisplay = document.getElementById('dice-chance');
    const rollTypeText = document.getElementById('roll-type-text');
    
    if (targetSlider) {
        const target = parseFloat(targetSlider.value);
        let chance, multiplier;
        
        if (rollType === 'over') {
            chance = (100 - target) / 100;
            if (rollTypeText) rollTypeText.textContent = 'Roll Over';
        } else {
            chance = (target - 1) / 100;
            if (rollTypeText) rollTypeText.textContent = 'Roll Under';
        }
        
        multiplier = 0.99 / chance;
        
        if (multiplierDisplay) multiplierDisplay.textContent = multiplier.toFixed(2) + 'x';
        if (chanceDisplay) chanceDisplay.textContent = (chance * 100).toFixed(2) + '%';
    }
}

// Bet amount functions
function setBetAmount(action) {
    const betInput = document.getElementById('dice-bet-amount');
    const currentBalance = currentUser ? currentUser.balance : 1000;
    let currentBet = parseFloat(betInput.value) || 0;
    
    switch(action) {
        case 'half':
            betInput.value = (currentBet / 2).toFixed(2);
            break;
        case 'double':
            betInput.value = (currentBet * 2).toFixed(2);
            break;
        case 'max':
            betInput.value = currentBalance.toFixed(2);
            break;
        case 'clear':
            betInput.value = '';
            break;
    }
}

// Roll dice function
async function rollDice() {
    if (!currentUser || isRolling) return;
    
    const betAmount = parseFloat(document.getElementById('bet-amount').value);
    if (isNaN(betAmount) || betAmount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }
    
    if (betAmount > currentUser.balance) {
        showError('Insufficient balance');
        return;
    }
    
    isRolling = true;
    const rollButton = document.getElementById('roll-button');
    const buttonText = rollButton.querySelector('span');
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
                targetNumber: rollType === 'over' ? targetValue : 100 - targetValue
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUserInterface();
            showGameNotification(data.result.won, data.result.winAmount);
            
            if (data.result.levelUp.leveledUp) {
                showGameNotification(true, data.result.levelUp.bonusAmount, 
                    `Level Up! +${data.result.levelUp.levelsGained} level(s) and $${data.result.levelUp.bonusAmount} bonus!`);
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

// Auto bet functionality
function toggleAutoBet() {
    const autoBetBtn = document.getElementById('auto-bet-btn');
    const autoBetSettings = document.getElementById('auto-bet-settings');
    
    if (!autoBetActive) {
        // Start auto bet
        const count = parseInt(document.getElementById('auto-bet-count').value) || 10;
        autoBetCount = count;
        autoBetActive = true;
        
        autoBetBtn.classList.add('active');
        autoBetBtn.textContent = `Stop (${autoBetCount})`;
        autoBetSettings.classList.add('show');
        
        // Start first roll
        rollDice();
    } else {
        // Stop auto bet
        stopAutoBet();
    }
}

function stopAutoBet() {
    autoBetActive = false;
    autoBetCount = 0;
    
    const autoBetBtn = document.getElementById('auto-bet-btn');
    const autoBetSettings = document.getElementById('auto-bet-settings');
    
    autoBetBtn.classList.remove('active');
    autoBetBtn.textContent = 'Auto';
    autoBetSettings.classList.remove('show');
    
    const rollBtnText = document.getElementById('roll-btn-text');
    rollBtnText.textContent = 'Roll Dice';
}

function continueAutoBet(wasWin, profit) {
    if (!autoBetActive) return;
    
    autoBetCount--;
    
    // Check stop conditions
    const stopWin = parseFloat(document.getElementById('auto-stop-win').value) || 0;
    const stopLoss = parseFloat(document.getElementById('auto-stop-loss').value) || 0;
    
    if (autoBetCount <= 0) {
        stopAutoBet();
        showGameNotification(true, 0, 'Auto bet completed!');
        return;
    }
    
    if (stopWin > 0 && profit >= stopWin) {
        stopAutoBet();
        showGameNotification(true, profit, 'Stop win reached!');
        return;
    }
    
    if (stopLoss > 0 && profit <= -stopLoss) {
        stopAutoBet();
        showGameNotification(false, profit, 'Stop loss reached!');
        return;
    }
    
    // Update button text
    const autoBetBtn = document.getElementById('auto-bet-btn');
    autoBetBtn.textContent = `Stop (${autoBetCount})`;
    
    // Continue with next roll after delay
    setTimeout(() => {
        if (autoBetActive) {
            rollDice();
        }
    }, 1000);
}

function showGameNotification(isWin, amount, customMessage = null) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(20, 20, 20, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        z-index: 3000;
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    if (customMessage) {
        notification.innerHTML = `
            <div style="font-size: 1.5rem; margin-bottom: 1rem;">🎲</div>
            <div style="font-size: 1.2rem; font-weight: 600; color: #f1f1f1; margin-bottom: 0.5rem;">${customMessage}</div>
        `;
    } else {
        const icon = isWin ? '🎉' : '😞';
        const title = isWin ? 'You Won!' : 'You Lost';
        const color = isWin ? '#10b981' : '#ef4444';
        const sign = amount >= 0 ? '+' : '';
        
        notification.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 1rem;">${icon}</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: ${color}; margin-bottom: 0.5rem;">${title}</div>
            <div style="font-size: 1.2rem; font-weight: 600; color: ${color};">${sign}$${formatNumber(Math.abs(amount))}</div>
        `;
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg z-50';
    errorDiv.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #f87171;
        padding: 1rem;
        border-radius: 12px;
        z-index: 3000;
        backdrop-filter: blur(8px);
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
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

async function loadProfileData() {
    // This function can be expanded to load additional profile data
    updateUserInterface();
} 