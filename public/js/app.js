// Global variables
let currentUser = null;
let socket = null;
let currentPage = 'login';

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchUserProfile();
    } else {
        showLoginPage();
    }

    // Initialize socket connection
    if (typeof io !== 'undefined') {
        socket = io();
        
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
}

function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('main-content').style.marginLeft = '0';
    document.getElementById('sidebar').style.display = 'none';
    currentPage = 'login';
}

function hideLoginPage() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-content').style.marginLeft = '4rem';
    document.getElementById('sidebar').style.display = 'block';
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
        const response = await fetch('/api/auth/check-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        
        statusIndicator.classList.remove('hidden');
        if (data.exists) {
            statusIndicator.className = 'text-center text-sm py-2 rounded-lg bg-blue-500/20 text-blue-400';
            statusText.textContent = '✓ User exists - will log in';
        } else {
            statusIndicator.className = 'text-center text-sm py-2 rounded-lg bg-green-500/20 text-green-400';
            statusText.textContent = '✓ New user - will create account';
        }
    } catch (error) {
        console.error('Error checking user:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const button = e.target.querySelector('button[type="submit"]');
    
    // Show loading state
    button.textContent = 'Connecting...';
    button.disabled = true;

    try {
        const response = await fetch('/api/auth/login', {
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
        button.textContent = 'Continue';
        button.disabled = false;
    }
}

async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/auth/profile', {
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

    // Update all user-related elements
    const elements = {
        'welcome-username': currentUser.username,
        'user-balance': currentUser.balance,
        'user-level': currentUser.level,
        'user-experience': currentUser.experience,
        'games-played': currentUser.gamesPlayed,
        'total-won': currentUser.totalWon,
        'profile-username': currentUser.username,
        'profile-level': currentUser.level,
        'profile-balance': currentUser.balance,
        'profile-games-played': currentUser.gamesPlayed,
        'profile-total-won': currentUser.totalWon,
        'profile-avatar': currentUser.username.charAt(0).toUpperCase()
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Update level progress
    const levelProgress = document.getElementById('level-progress');
    if (levelProgress) {
        const progress = (currentUser.experience % 100);
        levelProgress.style.width = `${progress}%`;
    }
}

function showPage(pageId) {
    // Hide all pages
    const pages = ['dashboard-page', 'games-page', 'trades-page', 'marketplace-page', 'profile-page'];
    pages.forEach(page => {
        document.getElementById(page).classList.add('hidden');
    });

    // Show selected page
    document.getElementById(pageId + '-page').classList.remove('hidden');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    currentPage = pageId;
    
    // Update page-specific data
    if (pageId === 'profile') {
        loadProfileData();
    }
}

async function playCoinFlip(choice) {
    const betAmount = document.getElementById('coinflip-bet').value;
    if (!betAmount || betAmount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }

    if (betAmount > currentUser.balance) {
        showError('Insufficient balance');
        return;
    }

    try {
        const response = await fetch('/api/games/play', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameType: 'coinflip',
                betAmount: parseFloat(betAmount),
                playerChoice: choice
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUserInterface();
            showGameResult(data.result);
        } else {
            showError(data.message || 'Game failed');
        }
    } catch (error) {
        showError('Connection error');
        console.error('Game error:', error);
    }
}

async function playDice(choice) {
    const betAmount = document.getElementById('dice-bet').value;
    if (!betAmount || betAmount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }

    if (betAmount > currentUser.balance) {
        showError('Insufficient balance');
        return;
    }

    try {
        const response = await fetch('/api/games/play', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                gameType: 'dice',
                betAmount: parseFloat(betAmount),
                playerChoice: choice
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUserInterface();
            showGameResult(data.result);
        } else {
            showError(data.message || 'Game failed');
        }
    } catch (error) {
        showError('Connection error');
        console.error('Game error:', error);
    }
}

function showGameResult(result) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="glass-effect p-8 rounded-xl max-w-md w-full mx-4">
            <div class="text-center">
                <div class="text-6xl mb-4">${result.won ? '🎉' : '😔'}</div>
                <h3 class="text-2xl font-bold mb-2">${result.won ? 'You Won!' : 'You Lost!'}</h3>
                <p class="text-gray-400 mb-2">Result: ${result.gameResult}</p>
                <p class="text-gray-400 mb-6">
                    ${result.won ? `+$${result.winAmount}` : `-$${result.betAmount}`}
                </p>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all">
                    Continue
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 5000);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg z-50';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    showLoginPage();
    if (socket) {
        socket.disconnect();
    }
}

async function loadProfileData() {
    // This function would load additional profile data like game history
    // For now, it just updates the existing interface
    updateUserInterface();
} 