// ==================== BATTLE SYSTEM ====================

// Battle state management
let currentBattle = null;
let battleSocket = null;
let selectedCasesForBattle = [];

// Initialize battle system
function initializeBattleSystem() {
    setupBattleSocketListeners();
    setupBattleEventListeners();
}

// Setup socket listeners for real-time battle updates
function setupBattleSocketListeners() {
    if (typeof io !== 'undefined') {
        const socket = io(API_BASE_URL);
        
        // Battle events
        socket.on('battle-created', (battle) => {
            console.log('Battle created:', battle);
            loadBattles(); // Refresh battles list
        });
        
        socket.on('battle-updated', (battle) => {
            console.log('Battle updated:', battle);
            loadBattles(); // Refresh battles list
            if (currentBattle && currentBattle.battleId === battle.battleId) {
                updateBattleDetails(battle);
            }
        });
        
        socket.on('battle-started', (data) => {
            console.log('Battle started:', data);
            if (currentBattle && currentBattle.battleId === data.battleId) {
                handleBattleStarted(data.battle);
            }
        });
        
        socket.on('battle-opening', (data) => {
            console.log('Battle opening:', data);
            if (currentBattle && currentBattle.battleId === data.battleId) {
                handleBattleOpening(data.opening, data.progress);
            }
        });
        
        socket.on('battle-completed', (data) => {
            console.log('Battle completed:', data);
            if (currentBattle && currentBattle.battleId === data.battleId) {
                handleBattleCompleted(data);
            }
            loadBattles(); // Refresh battles list
        });
        
        socket.on('battle-player-joined', (data) => {
            console.log('Player joined battle:', data);
            if (currentBattle && currentBattle.battleId === data.battleId) {
                updateBattleDetails(data.battle);
            }
        });
        
        socket.on('battle-bots-added', (data) => {
            console.log('Bots added to battle:', data);
            if (currentBattle && currentBattle.battleId === data.battleId) {
                updateBattleDetails(data.battle);
            }
        });
        
        socket.on('battle-error', (data) => {
            console.error('Battle error:', data);
            showNotification(data.message, 'error');
            if (currentBattle && currentBattle.battleId === data.battleId) {
                closeBattleDetailsModal();
            }
        });
        
        battleSocket = socket;
    }
}

// Setup battle event listeners
function setupBattleEventListeners() {
    // Battle case selection
    document.addEventListener('click', (e) => {
        if (e.target.closest('.battle-case-option')) {
            const caseOption = e.target.closest('.battle-case-option');
            const caseId = caseOption.dataset.caseId;
            const caseName = caseOption.dataset.caseName;
            const casePrice = parseFloat(caseOption.dataset.casePrice);
            
            addCaseToBattle(caseId, caseName, casePrice, caseOption);
        }
        
        if (e.target.closest('.case-clear-btn')) {
            const clearBtn = e.target.closest('.case-clear-btn');
            const caseOption = clearBtn.closest('.battle-case-option');
            const caseId = caseOption.dataset.caseId;
            
            clearCaseFromBattle(caseId, caseOption);
        }
    });
}

// Load battles list
async function loadBattles() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battles/active`);
        
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

// Display battles in the grid
function displayBattles(battles) {
    const battlesGrid = document.getElementById('battles-grid');
    if (!battlesGrid) return;
    
    battlesGrid.innerHTML = '';
    
    if (battles.length === 0) {
        battlesGrid.innerHTML = '<div class="no-battles">No active battles found</div>';
        return;
    }
    
    const now = Date.now();
    battles.forEach(battle => {
        const battleCard = document.createElement('div');
        battleCard.className = 'battle-card';
        
        let statusClass = 'waiting';
        let statusText = 'Waiting';
        if (battle.status === 'in_progress') {
            statusClass = 'in-progress';
            statusText = 'In Progress';
        } else if (battle.status === 'completed') {
            statusClass = 'completed';
            statusText = 'Done';
        }
        
        // If completed, show as done and set a timer to remove after 2 minutes
        if (battle.status === 'completed' && battle.completedAt) {
            const completedAt = new Date(battle.completedAt).getTime();
            const timeSinceCompleted = now - completedAt;
            if (timeSinceCompleted < 2 * 60 * 1000) {
                // Mark as done, and set a timer to reload battles after 2 minutes
                setTimeout(() => {
                    loadBattles();
                }, 2 * 60 * 1000 - timeSinceCompleted);
            } else {
                // Skip rendering this battle, it's expired
                return;
            }
        }
        
        battleCard.innerHTML = `
            <div class="battle-header">
                <div class="battle-mode">${battle.mode}</div>
                <div class="battle-cost">$${battle.totalCost.toFixed(2)}</div>
                <div class="battle-status ${statusClass}">${statusText}</div>
            </div>
            <div class="battle-players">
                ${(battle.players || []).map(player => `
                    <div class="battle-player ${player.isBot ? 'bot' : ''} ${player.isCreator ? 'creator' : ''}">
                        ${(player.username || '?').charAt(0).toUpperCase()}
                        ${player.isCreator ? '<i data-lucide="crown"></i>' : ''}
                    </div>
                `).join('')}
                ${Array.from({length: battle.maxPlayers - (battle.currentPlayers || 0)}, () => 
                    '<div class="battle-player empty">?</div>'
                ).join('')}
            </div>
            <div class="battle-cases">
                ${(battle.cases || []).map(caseItem => 
                    `<div class="battle-case">${caseItem.caseName} x${caseItem.quantity}</div>`
                ).join('')}
            </div>
            <div class="battle-actions">
                <button class="battle-view-btn" onclick="showBattleDetails('${battle.battleId}')">
                    <i data-lucide="eye"></i>
                    View Details
                </button>
                ${battle.status === 'waiting' && (battle.currentPlayers || 0) < battle.maxPlayers ? 
                    `<button class="battle-join-btn" onclick="joinBattle('${battle.battleId}')">
                        <i data-lucide="user-plus"></i>
                        Join Battle
                    </button>` : ''
                }
            </div>
        `;
        
        battlesGrid.appendChild(battleCard);
    });
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Show create battle modal
function showCreateBattleModal() {
    const modal = document.getElementById('create-battle-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadBattleCases();
        resetBattleForm();
    }
}

// Close create battle modal
function closeCreateBattleModal() {
    const modal = document.getElementById('create-battle-modal');
    if (modal) {
        modal.classList.add('hidden');
        resetBattleForm();
    }
}

// Reset battle form
function resetBattleForm() {
    selectedCasesForBattle = [];
    updateBattleCost();
    
    // Reset case options
    const caseOptions = document.querySelectorAll('.battle-case-option');
    caseOptions.forEach(option => {
        option.classList.remove('selected');
        const counter = option.querySelector('.case-counter');
        const clearBtn = option.querySelector('.case-clear-btn');
        if (counter) counter.textContent = '0';
        if (clearBtn) clearBtn.style.display = 'none';
    });
}

// Load cases for battle creation
async function loadBattleCases() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases`);
        
        if (!response.ok) {
            throw new Error('Failed to load cases');
        }
        
        const data = await response.json();
        displayBattleCases(data.cases);
    } catch (error) {
        console.error('Error loading battle cases:', error);
        showNotification('Error loading cases', 'error');
    }
}

// Display cases for battle creation
function displayBattleCases(cases) {
    const grid = document.getElementById('battle-cases-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Define unique icons and colors for each case
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
        caseOption.dataset.caseId = caseItem._id;
        caseOption.dataset.caseName = caseItem.name;
        caseOption.dataset.casePrice = caseItem.price;
        
        const caseIcon = caseIcons[caseItem.name] || { icon: 'package', color: '#10b981' };
        
        caseOption.innerHTML = `
            <div class="case-counter">0</div>
            <div class="case-clear-btn" style="display: none;">
                <i data-lucide="x"></i>
            </div>
            <div class="case-icon" style="background: ${caseIcon.color}">
                <i data-lucide="${caseIcon.icon}" style="color: white"></i>
            </div>
            <div class="case-info">
                <div class="case-name">${caseItem.name}</div>
                <div class="case-price">$${caseItem.price.toFixed(2)}</div>
            </div>
        `;
        
        grid.appendChild(caseOption);
    });
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Add case to battle selection
function addCaseToBattle(caseId, caseName, casePrice, caseOption) {
    const totalCases = selectedCasesForBattle.reduce((sum, c) => sum + c.quantity, 0);
    
    if (totalCases >= 25) {
        showNotification('Maximum 25 cases allowed per battle', 'error');
        return;
    }
    
    let existingCase = selectedCasesForBattle.find(c => c.caseId === caseId);
    
    if (existingCase) {
        if (existingCase.quantity < 25) {
            existingCase.quantity++;
        } else {
            showNotification('Maximum 25 of the same case allowed', 'error');
            return;
        }
    } else {
        selectedCasesForBattle.push({
            caseId: caseId,
            caseName: caseName,
            casePrice: casePrice,
            quantity: 1
        });
    }
    
    updateCaseOptionDisplay(caseOption);
    updateBattleCost();
}

// Clear case from battle selection
function clearCaseFromBattle(caseId, caseOption) {
    selectedCasesForBattle = selectedCasesForBattle.filter(c => c.caseId !== caseId);
    updateCaseOptionDisplay(caseOption);
    updateBattleCost();
}

// Update case option display
function updateCaseOptionDisplay(caseOption) {
    const caseId = caseOption.dataset.caseId;
    const selectedCase = selectedCasesForBattle.find(c => c.caseId === caseId);
    const counter = caseOption.querySelector('.case-counter');
    const clearBtn = caseOption.querySelector('.case-clear-btn');
    
    if (selectedCase) {
        counter.textContent = selectedCase.quantity;
        clearBtn.style.display = 'block';
        caseOption.classList.add('selected');
    } else {
        counter.textContent = '0';
        clearBtn.style.display = 'none';
        caseOption.classList.remove('selected');
    }
}

// Update battle cost display
function updateBattleCost() {
    const totalCost = selectedCasesForBattle.reduce((sum, c) => sum + (c.casePrice * c.quantity), 0);
    const costDisplay = document.getElementById('battle-total-cost');
    if (costDisplay) {
        costDisplay.textContent = totalCost.toFixed(2);
    }
}

// Create battle
async function createBattle() {
    if (selectedCasesForBattle.length === 0) {
        showNotification('Please select at least one case', 'error');
        return;
    }
    
    const mode = document.getElementById('battle-mode-select').value;
    
    const battleData = {
        cases: selectedCasesForBattle.map(c => ({
            caseId: c.caseId,
            quantity: c.quantity
        })),
        mode: mode
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
        
        // Close modal and show battle details
        closeCreateBattleModal();
        
        // Show the created battle details
        if (data.battle) {
            currentBattle = data.battle;
            populateBattleDetailsModal(data.battle);
            
            const modal = document.getElementById('battle-details-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        }
        
        showNotification('Battle created successfully!', 'success');
    } catch (error) {
        console.error('Error creating battle:', error);
        showNotification(error.message || 'Error creating battle', 'error');
    }
}

// Show battle details
async function showBattleDetails(battleId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/${battleId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load battle details');
        }
        
        const data = await response.json();
        currentBattle = data.battle;
        
        populateBattleDetailsModal(data.battle);
        
        const modal = document.getElementById('battle-details-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading battle details:', error);
        showNotification('Error loading battle details', 'error');
    }
}

// Populate battle details modal
function populateBattleDetailsModal(battle) {
    if (!battle || !Array.isArray(battle.players)) {
        console.error('populateBattleDetailsModal: battle.players is missing or not an array', battle);
        return;
    }
    // Set title and basic info
    document.getElementById('battle-details-title').textContent = `Battle #${battle.battleId}`;
    document.getElementById('battle-mode-display').textContent = `Mode: ${battle.mode}`;
    document.getElementById('battle-jackpot').textContent = `Jackpot: $${battle.totalCost.toFixed(2)}`;
    document.getElementById('battle-status').textContent = `Status: ${battle.status}`;
    
    // Populate players
    const playersGrid = document.getElementById('battle-players-grid');
    playersGrid.innerHTML = '';
    
    Array.from({length: battle.maxPlayers}, (_, i) => {
        const player = battle.players[i];
        const playerCard = document.createElement('div');
        playerCard.className = `battle-player-card ${!player ? 'empty' : ''}`;
        
        if (player) {
            playerCard.innerHTML = `
                <div class="player-avatar ${player.isBot ? 'bot' : ''} ${player.isCreator ? 'creator' : ''}">
                    <span class="avatar-circle">${player.username.charAt(0).toUpperCase()}</span>
                    ${player.isCreator ? '<i data-lucide="crown"></i>' : ''}
                </div>
                <div class="player-info">
                    <div class="player-name">${player.username} ${player.isBot ? '<span class="player-bot-badge">BOT</span>' : ''}</div>
                    <div class="player-score">$${player.totalValue.toFixed(2)}</div>
                </div>
            `;
        } else {
            playerCard.innerHTML = `
                <div class="player-avatar empty">?</div>
                <div class="player-info">
                    <div class="player-name">Empty Slot</div>
                    <div class="player-score"></div>
                </div>
            `;
        }
        playersGrid.appendChild(playerCard);
    });
    
    // Populate cases
    const casesList = document.getElementById('battle-cases-list');
    casesList.innerHTML = '';
    
    if (battle.cases && battle.cases.length > 0) {
        battle.cases.forEach(caseItem => {
            const price = caseItem.casePrice || caseItem.price || 0;
            const caseElement = document.createElement('div');
            caseElement.className = 'battle-case-item';
            caseElement.innerHTML = `
                <div class="case-name">${caseItem.caseName}</div>
                <div class="case-quantity">x${caseItem.quantity}</div>
                <div class="case-total">$${(price * caseItem.quantity).toFixed(2)}</div>
            `;
            casesList.appendChild(caseElement);
        });
    } else {
        casesList.innerHTML = '<div class="no-cases">No cases found</div>';
    }
    
    // Show/hide appropriate elements based on battle status
    updateBattleUI(battle);
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Update battle UI based on status
function updateBattleUI(battle) {
    if (!battle || !Array.isArray(battle.players)) {
        console.error('updateBattleUI: battle.players is missing or not an array', battle);
        return;
    }
    const callBotsBtn = document.getElementById('call-bots-btn');
    const startBattleBtn = document.getElementById('start-battle-btn');
    const battleActions = document.getElementById('battle-actions');
    const battleLiveSection = document.getElementById('battle-live-section');
    const battleResults = document.getElementById('battle-results');
    const battleProgressBar = document.getElementById('battle-progress-bar');
    const statusText = document.getElementById('battle-status');
    
    // Check if current user is the creator
    const currentUserId = getCurrentUserId();
    const isCreator = battle.players.some(p => 
        p.userId.toString() === currentUserId && p.isCreator
    );
    
    // Reset display
    battleActions.style.display = 'block';
    battleLiveSection.style.display = 'none';
    battleResults.style.display = 'none';
    battleProgressBar.style.display = 'none';
    
    // Hide call bots if full, show 'Starting...' if autostarting
    if (battle.status === 'waiting') {
        if (battle.players.length === battle.maxPlayers) {
            callBotsBtn.style.display = 'none';
            startBattleBtn.style.display = isCreator ? 'inline-flex' : 'none';
            statusText.textContent = 'Status: Full - Starting...';
        } else {
            callBotsBtn.style.display = isCreator ? 'inline-flex' : 'none';
            startBattleBtn.style.display = 'none';
            statusText.textContent = 'Status: Waiting for players';
        }
    } else if (battle.status === 'starting' || battle.status === 'in_progress') {
        battleActions.style.display = 'none';
        battleLiveSection.style.display = 'block';
        battleProgressBar.style.display = 'block';
        statusText.textContent = 'Status: In Progress';
        // Show existing openings if any
        if (battle.openings && battle.openings.length > 0) {
            displayBattleOpenings(battle.openings);
        }
    } else if (battle.status === 'completed') {
        battleActions.style.display = 'none';
        battleLiveSection.style.display = 'none';
        battleResults.style.display = 'block';
        statusText.textContent = 'Status: Completed';
        showBattleResults(battle);
    }
}

// Display battle openings
function displayBattleOpenings(openings) {
    const openingsContainer = document.getElementById('battle-openings');
    openingsContainer.innerHTML = '';
    
    openings.forEach(opening => {
        const openingElement = document.createElement('div');
        openingElement.className = 'battle-opening';
        openingElement.innerHTML = `
            <div class="opening-player">${opening.playerName}</div>
            <div class="opening-case">${opening.caseName}</div>
            <div class="opening-item">
                <div class="item-name">${opening.item.itemName}</div>
                <div class="item-value rarity-${opening.item.itemRarity}">$${opening.item.itemValue.toFixed(2)}</div>
            </div>
        `;
        openingsContainer.appendChild(openingElement);
    });
    
    // Scroll to bottom
    openingsContainer.scrollTop = openingsContainer.scrollHeight;
}

// Handle real-time battle updates
function updateBattleDetails(battle) {
    if (currentBattle && currentBattle.battleId === battle.battleId) {
        currentBattle = battle;
        populateBattleDetailsModal(battle);
    }
}

// Handle battle started
function handleBattleStarted(battle) {
    currentBattle = battle;
    updateBattleUI(battle);
    showNotification('Battle has started!', 'success');
}

// Handle battle opening
function handleBattleOpening(opening, progress) {
    // Add opening to display
    const openingsContainer = document.getElementById('battle-openings');
    const openingElement = document.createElement('div');
    openingElement.className = 'battle-opening';
    openingElement.innerHTML = `
        <div class="opening-player">${opening.playerName}</div>
        <div class="opening-case">${opening.caseName}</div>
        <div class="opening-item">
            <div class="item-name">${opening.item.itemName}</div>
            <div class="item-value rarity-${opening.item.itemRarity}">$${opening.item.itemValue.toFixed(2)}</div>
        </div>
    `;
    openingsContainer.appendChild(openingElement);
    
    // Update progress bar
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${progress.percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${progress.current} / ${progress.total}`;
    }
    
    // Scroll to bottom
    openingsContainer.scrollTop = openingsContainer.scrollHeight;
    
    // Update player values if we have the current battle data
    if (currentBattle) {
        const player = currentBattle.players.find(p => p.userId === opening.playerId);
        if (player) {
            player.totalValue = (player.totalValue || 0) + opening.item.itemValue;
            updatePlayerScores();
        }
    }
}

// Update player scores in real-time
function updatePlayerScores() {
    const playerCards = document.querySelectorAll('.battle-player-card');
    playerCards.forEach((card, index) => {
        const player = currentBattle.players[index];
        if (player) {
            const scoreElement = card.querySelector('.player-score');
            if (scoreElement) {
                scoreElement.textContent = `$${player.totalValue.toFixed(2)}`;
            }
        }
    });
}

// Handle battle completed
function handleBattleCompleted(data) {
    if (!data || !data.battle) {
        console.error('handleBattleCompleted: missing battle data', data);
        return;
    }
    currentBattle = data.battle;
    updateBattleUI(data.battle);
    
    // Defensive: check winner
    let winnerName = (data.battle.players || []).find(p => p.isWinner)?.username || data.battle.winnerUsername || 'Unknown';
    if (data.won) {
        showNotification('🎉 Congratulations! You won the battle!', 'success');
    } else {
        showNotification(`Battle completed. Winner: ${winnerName}`, 'info');
    }
}

// Show battle results
function showBattleResults(battle) {
    const battleWinner = document.getElementById('battle-winner');
    const battleFinalScores = document.getElementById('battle-final-scores');
    
    const winner = (battle.players || []).find(p => p.isWinner);
    
    if (winner) {
        battleWinner.innerHTML = `
            <div class="winner-announcement">
                <div class="winner-crown">👑</div>
                <div class="winner-name">${winner.username || 'Unknown'}</div>
                <div class="winner-prize">Wins $${(battle.totalPrizeValue || 0).toFixed(2)}!</div>
            </div>
        `;
    } else {
        battleWinner.innerHTML = '<div class="winner-announcement">No winner</div>';
    }
    
    // Show final scores
    battleFinalScores.innerHTML = '';
    (battle.players || []).forEach(player => {
        const playerScore = document.createElement('div');
        playerScore.className = `final-score ${player.isWinner ? 'winner' : ''}`;
        playerScore.innerHTML = `
            <div class="score-player">
                ${(player.username || 'Unknown')}
                ${player.isBot ? '<span class="bot-badge">BOT</span>' : ''}
            </div>
            <div class="score-value">$${(player.totalValue || 0).toFixed(2)}</div>
        `;
        battleFinalScores.appendChild(playerScore);
    });
}

// Join battle
async function joinBattle(battleId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/${battleId}/join`, {
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
        
        // Show battle details
        currentBattle = data.battle;
        populateBattleDetailsModal(data.battle);
        
        const modal = document.getElementById('battle-details-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        
        showNotification('Joined battle successfully!', 'success');
    } catch (error) {
        console.error('Error joining battle:', error);
        showNotification(error.message || 'Error joining battle', 'error');
    }
}

// Call bots
async function callBots() {
    if (!currentBattle) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/${currentBattle.battleId}/call-bots`, {
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
        currentBattle = data.battle;
        
        // Update the modal with new data
        populateBattleDetailsModal(data.battle);
        
        showNotification('Bots have joined the battle!', 'success');
    } catch (error) {
        console.error('Error calling bots:', error);
        showNotification(error.message || 'Error calling bots', 'error');
    }
}

// Start battle
async function startBattle() {
    if (!currentBattle) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/battle/${currentBattle.battleId}/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to start battle');
        }
        
        const data = await response.json();
        currentBattle = data.battle;
        
        // Update UI
        updateBattleUI(data.battle);
        
        showNotification('Battle started!', 'success');
    } catch (error) {
        console.error('Error starting battle:', error);
        showNotification(error.message || 'Error starting battle', 'error');
    }
}

// Close battle details modal
function closeBattleDetailsModal() {
    const modal = document.getElementById('battle-details-modal');
    if (modal) {
        modal.classList.add('hidden');
        currentBattle = null;
    }
}

// Get current user ID (helper function)
function getCurrentUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch (error) {
        console.error('Error parsing token:', error);
        return null;
    }
}

// Make functions globally accessible for HTML onclick handlers
window.loadBattles = loadBattles;
window.showCreateBattleModal = showCreateBattleModal;
window.closeCreateBattleModal = closeCreateBattleModal;
window.createBattle = createBattle;
window.showBattleDetails = showBattleDetails;
window.closeBattleDetailsModal = closeBattleDetailsModal;
window.joinBattle = joinBattle;
window.callBots = callBots;
window.startBattle = startBattle;

// Also make case selection functions available
window.addCaseToBattle = addCaseToBattle;
window.clearCaseFromBattle = clearCaseFromBattle; 