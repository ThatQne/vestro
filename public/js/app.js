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

    // Update badges
    updateBadges();

    // Update chart data with animations
    updateChart();
}

function getRequiredXP(level) {
    // Base 50 XP + 10 XP per level
    return 50 + (level * 10);
}

function updateXPBar() {
    const currentXPElement = document.getElementById('current-xp');
    const requiredXPElement = document.getElementById('required-xp');
    const xpFillElement = document.getElementById('xp-fill');
    
    if (currentUser && currentXPElement && requiredXPElement && xpFillElement) {
        const xpForCurrentLevel = getRequiredXP(currentUser.level - 1); // XP needed for current level
        const xpForNextLevel = getRequiredXP(currentUser.level); // XP needed for next level
        const xpProgress = currentUser.experience - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;
        const xpPercentage = Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100));
        
        currentXPElement.textContent = Math.max(0, xpProgress);
        requiredXPElement.textContent = xpNeeded;
        xpFillElement.style.width = xpPercentage + '%';
    }
}

function updateProfileXPBar() {
    const currentXPElement = document.getElementById('profile-current-xp');
    const requiredXPElement = document.getElementById('profile-required-xp');
    const xpFillElement = document.getElementById('profile-xp-fill');
    
    if (currentUser && currentXPElement && requiredXPElement && xpFillElement) {
        const xpForCurrentLevel = getRequiredXP(currentUser.level - 1); // XP needed for current level
        const xpForNextLevel = getRequiredXP(currentUser.level); // XP needed for next level
        const xpProgress = currentUser.experience - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;
        const xpPercentage = Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100));
        
        currentXPElement.textContent = Math.max(0, xpProgress);
        requiredXPElement.textContent = xpNeeded;
        xpFillElement.style.width = xpPercentage + '%';
    }
}

function updateBadges() {
    const badgesGrid = document.getElementById('badges-grid');
    if (!badgesGrid || !currentUser) return;

    badgesGrid.innerHTML = '';
    
    // Get all badges first
    fetch(`${API_BASE_URL}/api/badges`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const allBadges = data.badges;
                const earnedBadges = new Set(currentUser.badges.map(b => b.badgeId._id));
                
                // Sort badges: earned first, then non-secret locked, then secret
                const sortedBadges = allBadges.sort((a, b) => {
                    const aEarned = earnedBadges.has(a._id);
                    const bEarned = earnedBadges.has(b._id);
                    
                    if (aEarned && !bEarned) return -1;
                    if (!aEarned && bEarned) return 1;
                    
                    if (a.secret && !b.secret) return 1;
                    if (!a.secret && b.secret) return -1;
                    
                    return a.name.localeCompare(b.name);
                });

                sortedBadges.forEach(badge => {
                    const isEarned = earnedBadges.has(badge._id);
                    const earnedBadgeData = currentUser.badges.find(b => b.badgeId._id === badge._id);
                    
                    // Skip secret badges that haven't been earned
                    if (badge.secret && !isEarned) return;

                    const badgeElement = document.createElement('div');
                    badgeElement.className = `badge-item${badge.secret ? ' secret' : ''}${isEarned ? ' earned' : ' locked'}`;
                    
                    let earnedText = isEarned 
                        ? `Earned ${new Date(earnedBadgeData.earnedAt).toLocaleDateString()}`
                        : 'Not earned yet';
                    
                    badgeElement.innerHTML = `
                        <div class="badge-icon" style="background: ${badge.color}${isEarned ? '20' : '10'};">
                            <i data-lucide="${badge.icon}" style="color: ${badge.color};"></i>
                        </div>
                        <div class="badge-name">${badge.name}</div>
                        <div class="badge-description">${badge.description}</div>
                        <div class="badge-earned">${earnedText}</div>
                    `;
                    
                    badgesGrid.appendChild(badgeElement);
                });

                // Initialize Lucide icons for the new badge elements
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        })
        .catch(error => {
            console.error('Error fetching badges:', error);
        });
}

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
let isAutoBetting = false;
let autoBetCount = 0;

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
    
    let chance, multiplier;
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
    multiplier = (0.99 / chance).toFixed(2);
    
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

    const currentBalance = currentUser ? Math.ceil(currentUser.balance * 100) / 100 : 0;
    let currentBet = Math.ceil(parseFloat(betInput.value || 0) * 100) / 100;
    
    switch(action) {
        case 'half':
            const halved = Math.ceil((currentBet / 2) * 100) / 100;
            betInput.value = Math.max(0.01, halved).toFixed(2);
            break;
        case 'double':
            const doubled = Math.ceil((currentBet * 2) * 100) / 100;
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

// Roll dice function
async function rollDice() {
    if (!currentUser || isRolling) return;
    
    const betInput = document.getElementById('dice-bet-amount');
    let betAmount = Math.ceil(parseFloat(betInput.value) * 100) / 100;
    const targetValue = parseFloat(document.getElementById('dice-target').value);
    
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
                targetNumber: rollType === 'over' ? targetValue : 100 - targetValue
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUserInterface();
            
            // Update dice pointer and result
            const pointer = document.getElementById('dice-pointer');
            const result = document.getElementById('dice-result');
            const resultNumber = parseFloat(data.result.gameResult);
            
            if (pointer) pointer.style.left = resultNumber + '%';
            if (result) {
                result.textContent = resultNumber.toFixed(2);
                result.classList.add('show', data.result.won ? 'win' : 'lose');
            }
            
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
    
    if (!isAutoBetting) {
        // Start auto bet
        const count = parseInt(document.getElementById('auto-bet-count').value) || 10;
        autoBetCount = count;
        isAutoBetting = true;
        
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
    isAutoBetting = false;
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
    if (!isAutoBetting) return;
    
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
            'level-up': '↑'
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

async function loadProfileData() {
    // This function can be expanded to load additional profile data
    updateUserInterface();
} 