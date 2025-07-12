// Case Battles System - Handles multiplayer case battles with real-time updates
let currentBattle = null;
let currentBattleId = null;
let availableCases = [];
let selectedCases = [];

// Initialize case battles system
function initializeCaseBattlesSystem() {
    // Load case battles when page is shown
    if (document.getElementById('case-battles-page')) {
        loadCaseBattles();
        loadAvailableCases();
    }
    
    // Setup WebSocket listeners for real-time updates
    if (socket) {
        socket.on('battleCreated', handleBattleCreated);
        socket.on('playerJoined', handlePlayerJoined);
        socket.on('playerLeft', handlePlayerLeft);
        socket.on('battleStarted', handleBattleStarted);
        socket.on('caseOpened', handleCaseOpenedInBattle);
        socket.on('battleCompleted', handleBattleCompleted);
        socket.on('botAdded', handleBotAdded);
    }
    
    // Setup modal event listeners
    setupBattleModalListeners();
}

// Load available cases for battle creation
async function loadAvailableCases() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            availableCases = data.cases;
            displayCasesSelection();
        } else {
            showError('Failed to load available cases');
        }
    } catch (error) {
        console.error('Error loading cases:', error);
        showError('Failed to load available cases');
    }
}

// Display cases selection in create battle modal
function displayCasesSelection() {
    const container = document.getElementById('battle-cases-selection');
    if (!container) return;
    
    container.innerHTML = '';
    
    availableCases.forEach(caseItem => {
        const caseCard = document.createElement('div');
        caseCard.className = 'battle-case-card';
        caseCard.innerHTML = `
            <div class="case-icon">
                <i data-lucide="${caseItem.icon || 'package'}"></i>
            </div>
            <div class="case-info">
                <div class="case-name">${caseItem.name}</div>
                <div class="case-price">$${caseItem.price.toFixed(2)}</div>
            </div>
            <div class="case-actions">
                <button class="btn-small" onclick="addCaseToBattle('${caseItem._id}')">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        `;
        container.appendChild(caseCard);
    });
    
    // Refresh icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Add case to battle selection
function addCaseToBattle(caseId) {
    const caseItem = availableCases.find(c => c._id === caseId);
    if (!caseItem) return;
    
    const existingCase = selectedCases.find(c => c.case === caseId);
    if (existingCase) {
        existingCase.quantity += 1;
    } else {
        selectedCases.push({
            case: caseId,
            quantity: 1,
            name: caseItem.name,
            price: caseItem.price
        });
    }
    
    updateSelectedCasesDisplay();
    updateBattleEntryFee();
}

// Remove case from battle selection
function removeCaseFromBattle(caseId) {
    const existingCase = selectedCases.find(c => c.case === caseId);
    if (!existingCase) return;
    
    if (existingCase.quantity > 1) {
        existingCase.quantity -= 1;
    } else {
        selectedCases = selectedCases.filter(c => c.case !== caseId);
    }
    
    updateSelectedCasesDisplay();
    updateBattleEntryFee();
}

// Update selected cases display
function updateSelectedCasesDisplay() {
    const container = document.getElementById('battle-cases-selection');
    if (!container) return;
    
    // Clear and rebuild
    container.innerHTML = '';
    
    // Show available cases
    availableCases.forEach(caseItem => {
        const selectedCase = selectedCases.find(c => c.case === caseItem._id);
        const quantity = selectedCase ? selectedCase.quantity : 0;
        
        const caseCard = document.createElement('div');
        caseCard.className = `battle-case-card ${quantity > 0 ? 'selected' : ''}`;
        caseCard.innerHTML = `
            <div class="case-icon">
                <i data-lucide="${caseItem.icon || 'package'}"></i>
            </div>
            <div class="case-info">
                <div class="case-name">${caseItem.name}</div>
                <div class="case-price">$${caseItem.price.toFixed(2)}</div>
                ${quantity > 0 ? `<div class="case-quantity">x${quantity}</div>` : ''}
            </div>
            <div class="case-actions">
                ${quantity > 0 ? `
                    <button class="btn-small btn-danger" onclick="removeCaseFromBattle('${caseItem._id}')">
                        <i data-lucide="minus"></i>
                    </button>
                ` : ''}
                <button class="btn-small" onclick="addCaseToBattle('${caseItem._id}')">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        `;
        container.appendChild(caseCard);
    });
    
    // Refresh icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Update battle entry fee based on selected cases
function updateBattleEntryFee() {
    const totalCost = selectedCases.reduce((sum, c) => sum + (c.price * c.quantity), 0);
    document.getElementById('battle-entry-fee').value = totalCost.toFixed(2);
}

// Load and display case battles
async function loadCaseBattles() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayCaseBattles(data.battles);
        } else {
            showError('Failed to load case battles');
        }
    } catch (error) {
        console.error('Error loading case battles:', error);
        showError('Failed to load case battles');
    }
}

// Display case battles
function displayCaseBattles(battles) {
    const container = document.getElementById('battles-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (battles.length === 0) {
        container.innerHTML = `
            <div class="no-battles">
                <i data-lucide="swords"></i>
                <h3>No Active Battles</h3>
                <p>Create a new battle to get started!</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }
    
    battles.forEach(battle => {
        const battleCard = document.createElement('div');
        battleCard.className = 'battle-card';
        battleCard.innerHTML = `
            <div class="battle-header">
                <div class="battle-name">${battle.name}</div>
                <div class="battle-status ${battle.status}">${battle.status}</div>
            </div>
            <div class="battle-info">
                <div class="battle-stat">
                    <span>Entry Fee:</span>
                    <span>$${battle.entryFee.toFixed(2)}</span>
                </div>
                <div class="battle-stat">
                    <span>Players:</span>
                    <span>${battle.players.length}/${battle.maxPlayers}</span>
                </div>
                <div class="battle-stat">
                    <span>Cases:</span>
                    <span>${battle.cases.length}</span>
                </div>
                <div class="battle-stat">
                    <span>Creator:</span>
                    <span>${battle.createdBy.username}</span>
                </div>
            </div>
            <div class="battle-actions">
                ${battle.status === 'waiting' ? `
                    <button class="btn-primary" onclick="showJoinBattleModal('${battle.battleId}')">
                        <i data-lucide="users"></i>
                        Join Battle
                    </button>
                ` : `
                    <button class="btn-secondary" onclick="viewBattle('${battle.battleId}')">
                        <i data-lucide="eye"></i>
                        View Battle
                    </button>
                `}
            </div>
        `;
        container.appendChild(battleCard);
    });
    
    // Refresh icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Show create battle modal
function showCreateBattleModal() {
    selectedCases = [];
    loadAvailableCases();
    document.getElementById('create-battle-modal').classList.remove('hidden');
}

// Close create battle modal
function closeCreateBattleModal() {
    document.getElementById('create-battle-modal').classList.add('hidden');
    selectedCases = [];
}

// Show join battle modal
function showJoinBattleModal(battleId) {
    currentBattleId = battleId;
    // Load battle details and show modal
    loadBattleDetails(battleId).then(battle => {
        if (battle) {
            document.getElementById('join-battle-name').textContent = battle.name;
            document.getElementById('join-battle-fee').textContent = `$${battle.entryFee.toFixed(2)}`;
            document.getElementById('join-battle-players').textContent = `${battle.players.length}/${battle.maxPlayers}`;
            document.getElementById('join-battle-creator').textContent = battle.createdBy.username;
            
            // Show password field if private
            const passwordGroup = document.getElementById('join-battle-password-group');
            if (battle.isPrivate) {
                passwordGroup.style.display = 'block';
            } else {
                passwordGroup.style.display = 'none';
            }
            
            document.getElementById('join-battle-modal').classList.remove('hidden');
        }
    });
}

// Close join battle modal
function closeJoinBattleModal() {
    document.getElementById('join-battle-modal').classList.add('hidden');
    currentBattleId = null;
}

// Load battle details
async function loadBattleDetails(battleId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles/${battleId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.battle;
        } else {
            showError('Failed to load battle details');
            return null;
        }
    } catch (error) {
        console.error('Error loading battle details:', error);
        showError('Failed to load battle details');
        return null;
    }
}

// Create case battle
async function createCaseBattle() {
    const name = document.getElementById('battle-name').value.trim();
    const maxPlayers = parseInt(document.getElementById('battle-players').value);
    const entryFee = parseFloat(document.getElementById('battle-entry-fee').value);
    const isPrivate = document.getElementById('battle-private').checked;
    const password = document.getElementById('battle-password').value;
    
    if (!name) {
        showError('Please enter a battle name');
        return;
    }
    
    if (selectedCases.length === 0) {
        showError('Please select at least one case');
        return;
    }
    
    if (isNaN(entryFee) || entryFee <= 0) {
        showError('Please enter a valid entry fee');
        return;
    }
    
    if (currentUser.balance < entryFee) {
        showError('Insufficient balance to create battle');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                name,
                cases: selectedCases,
                maxPlayers,
                entryFee,
                isPrivate,
                password: isPrivate ? password : null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update balance
            currentUser.balance -= entryFee;
            updateUserInterface();
            
            closeCreateBattleModal();
            showSuccess('Battle created successfully!');
            
            // Enter battle room
            currentBattle = data.battle;
            currentBattleId = data.battle.battleId;
            showBattleRoom();
            
            // Refresh battles list
            loadCaseBattles();
        } else {
            showError(data.message || 'Failed to create battle');
        }
    } catch (error) {
        console.error('Error creating battle:', error);
        showError('Failed to create battle');
    }
}

// Join case battle
async function joinCaseBattle() {
    if (!currentBattleId) return;
    
    const password = document.getElementById('join-battle-password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles/${currentBattleId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update balance
            currentUser.balance -= data.battle.entryFee;
            updateUserInterface();
            
            closeJoinBattleModal();
            showSuccess('Joined battle successfully!');
            
            // Enter battle room
            currentBattle = data.battle;
            showBattleRoom();
            
            // Refresh battles list
            loadCaseBattles();
        } else {
            showError(data.message || 'Failed to join battle');
        }
    } catch (error) {
        console.error('Error joining battle:', error);
        showError('Failed to join battle');
    }
}

// Show battle room
function showBattleRoom() {
    if (!currentBattle) return;
    
    document.getElementById('battle-room-title').textContent = currentBattle.name;
    document.getElementById('battle-room-entry-fee').textContent = `$${currentBattle.entryFee.toFixed(2)}`;
    document.getElementById('battle-room-players').textContent = `${currentBattle.players.length}/${currentBattle.maxPlayers}`;
    document.getElementById('battle-room-status').textContent = currentBattle.status;
    
    // Display cases
    displayBattleCases();
    
    // Display players
    displayBattlePlayers();
    
    // Show appropriate buttons
    updateBattleRoomButtons();
    
    document.getElementById('battle-room-modal').classList.remove('hidden');
}

// Display battle cases
function displayBattleCases() {
    const container = document.getElementById('battle-cases-list');
    if (!container || !currentBattle) return;
    
    container.innerHTML = '';
    
    currentBattle.cases.forEach(battleCase => {
        const caseCard = document.createElement('div');
        caseCard.className = 'battle-case-item';
        caseCard.innerHTML = `
            <div class="case-icon">
                <i data-lucide="${battleCase.case.icon || 'package'}"></i>
            </div>
            <div class="case-info">
                <div class="case-name">${battleCase.case.name}</div>
                <div class="case-price">$${battleCase.case.price.toFixed(2)}</div>
                <div class="case-quantity">x${battleCase.quantity}</div>
            </div>
        `;
        container.appendChild(caseCard);
    });
    
    // Refresh icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Display battle players
function displayBattlePlayers() {
    const container = document.getElementById('battle-players-list');
    if (!container || !currentBattle) return;
    
    container.innerHTML = '';
    
    currentBattle.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'battle-player-item';
        playerCard.innerHTML = `
            <div class="player-avatar">
                ${player.isBot ? '<i data-lucide="bot"></i>' : player.username.charAt(0).toUpperCase()}
            </div>
            <div class="player-info">
                <div class="player-name">${player.username}</div>
                <div class="player-type">${player.isBot ? 'Bot' : 'Player'}</div>
                <div class="player-value">$${player.totalValue.toFixed(2)}</div>
            </div>
        `;
        container.appendChild(playerCard);
    });
    
    // Refresh icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Update battle room buttons
function updateBattleRoomButtons() {
    const addBotBtn = document.getElementById('add-bot-btn');
    const startBattleBtn = document.getElementById('start-battle-btn');
    
    if (!currentBattle) return;
    
    // Show add bot button only for creator when battle is waiting
    const isCreator = currentBattle.createdBy === currentUser._id;
    const canAddBot = isCreator && currentBattle.status === 'waiting' && currentBattle.players.length < currentBattle.maxPlayers;
    
    addBotBtn.style.display = canAddBot ? 'inline-block' : 'none';
    
    // Show start button when battle is full and user is creator
    const canStart = isCreator && currentBattle.status === 'active';
    startBattleBtn.style.display = canStart ? 'inline-block' : 'none';
}

// Add bot to battle
async function addBotToBattle() {
    if (!currentBattleId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles/${currentBattleId}/add-bot`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Bot added to battle!');
        } else {
            showError(data.message || 'Failed to add bot');
        }
    } catch (error) {
        console.error('Error adding bot:', error);
        showError('Failed to add bot');
    }
}

// Leave battle room
function leaveBattleRoom() {
    if (currentBattle && currentBattle.status === 'waiting') {
        // Leave battle if still waiting
        leaveBattle();
    } else {
        // Just close modal if battle is active/completed
        document.getElementById('battle-room-modal').classList.add('hidden');
        currentBattle = null;
        currentBattleId = null;
    }
}

// Leave battle
async function leaveBattle() {
    if (!currentBattleId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles/${currentBattleId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Refund entry fee
            currentUser.balance += currentBattle.entryFee;
            updateUserInterface();
            
            document.getElementById('battle-room-modal').classList.add('hidden');
            currentBattle = null;
            currentBattleId = null;
            
            showSuccess('Left battle successfully');
            loadCaseBattles();
        } else {
            showError(data.message || 'Failed to leave battle');
        }
    } catch (error) {
        console.error('Error leaving battle:', error);
        showError('Failed to leave battle');
    }
}

// View battle details (for completed battles)
async function viewBattle(battleId) {
    try {
        const battle = await loadBattleDetails(battleId);
        if (battle) {
            currentBattle = battle;
            currentBattleId = battleId;
            showBattleRoom();
        }
    } catch (error) {
        console.error('Error viewing battle:', error);
        showError('Failed to load battle details');
    }
}

// Start battle (for battle creator)
async function startBattle() {
    if (!currentBattleId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/case-battles/${currentBattleId}/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Battle started!');
            // Update battle status
            currentBattle.status = 'active';
            document.getElementById('battle-room-status').textContent = 'Active';
            updateBattleRoomButtons();
        } else {
            showError(data.message || 'Failed to start battle');
        }
    } catch (error) {
        console.error('Error starting battle:', error);
        showError('Failed to start battle');
    }
}

// Setup battle modal listeners
function setupBattleModalListeners() {
    // Private battle checkbox
    const privateCheckbox = document.getElementById('battle-private');
    const passwordGroup = document.getElementById('battle-password-group');
    
    if (privateCheckbox && passwordGroup) {
        privateCheckbox.addEventListener('change', function() {
            if (this.checked) {
                passwordGroup.classList.remove('hidden');
            } else {
                passwordGroup.classList.add('hidden');
            }
        });
    }
}

// Real-time event handlers
function handleBattleCreated(data) {
    showNotification(`New battle created: ${data.name}`, 'info');
    loadCaseBattles();
}

function handlePlayerJoined(data) {
    if (currentBattleId === data.battleId) {
        showNotification(`${data.player} joined the battle`, 'info');
        // Reload battle details
        loadBattleDetails(data.battleId).then(battle => {
            if (battle) {
                currentBattle = battle;
                displayBattlePlayers();
                updateBattleRoomButtons();
                document.getElementById('battle-room-players').textContent = `${data.currentPlayers}/${data.maxPlayers}`;
            }
        });
    }
    loadCaseBattles();
}

function handlePlayerLeft(data) {
    if (currentBattleId === data.battleId) {
        showNotification(`Player left the battle`, 'info');
        // Reload battle details
        loadBattleDetails(data.battleId).then(battle => {
            if (battle) {
                currentBattle = battle;
                displayBattlePlayers();
                updateBattleRoomButtons();
                document.getElementById('battle-room-players').textContent = `${data.currentPlayers}/${currentBattle.maxPlayers}`;
            }
        });
    }
    loadCaseBattles();
}

function handleBattleStarted(data) {
    if (currentBattleId === data.battleId) {
        showNotification('Battle started!', 'success');
        document.getElementById('battle-room-status').textContent = 'Active';
        updateBattleRoomButtons();
    }
    loadCaseBattles();
}

function handleCaseOpenedInBattle(data) {
    if (currentBattleId === data.battleId) {
        showNotification(`${data.player} opened ${data.item.name} worth $${data.value.toFixed(2)}`, 'info');
        // Update player values
        displayBattlePlayers();
    }
}

function handleBattleCompleted(data) {
    if (currentBattleId === data.battleId) {
        showNotification(`Battle completed! Winner: ${data.winner} with $${data.totalValue.toFixed(2)}`, 'success');
        document.getElementById('battle-room-status').textContent = 'Completed';
        updateBattleRoomButtons();
    }
    loadCaseBattles();
}

function handleBotAdded(data) {
    if (currentBattleId === data.battleId) {
        showNotification(`Bot ${data.botName} added to battle`, 'info');
        // Reload battle details
        loadBattleDetails(data.battleId).then(battle => {
            if (battle) {
                currentBattle = battle;
                displayBattlePlayers();
                updateBattleRoomButtons();
                document.getElementById('battle-room-players').textContent = `${data.currentPlayers}/${currentBattle.maxPlayers}`;
            }
        });
    }
    loadCaseBattles();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeCaseBattlesSystem();
});

// Also initialize when the page becomes visible
if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', function() {
        if (!document.hidden && document.getElementById('case-battles-page') && !document.getElementById('case-battles-page').classList.contains('hidden')) {
            loadCaseBattles();
        }
    });
} 