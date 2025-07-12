// Cases System - Handles case opening, inventory management, and animations
let currentCase = null;
let currentInventoryItem = null;
let inventoryFilters = {
    category: '',
    rarity: '',
    type: ''
};

// Initialize cases system
function initializeCasesSystem() {
    // Load cases when cases page is shown
    if (document.getElementById('cases-page')) {
        loadCases();
    }
    
    // Setup inventory filters
    setupInventoryFilters();
    
    // Setup WebSocket listeners for real-time updates
    if (socket) {
        socket.on('caseOpened', handleCaseOpenedNotification);
        socket.on('itemSold', handleItemSoldNotification);
        socket.on('itemPurchased', handleItemPurchasedNotification);
    }
}

// Load and display cases
async function loadCases() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayCases(data.cases);
        } else {
            showError('Failed to load cases');
        }
    } catch (error) {
        console.error('Error loading cases:', error);
        showError('Failed to load cases');
    }
}

// Display cases in grid
function displayCases(cases) {
    const casesGrid = document.getElementById('cases-grid');
    if (!casesGrid) return;
    
    casesGrid.innerHTML = '';
    
    cases.forEach((caseItem, index) => {
        const caseCard = createCaseCard(caseItem, index);
        casesGrid.appendChild(caseCard);
    });
    
    // Animate case cards in
    animateCaseCardsIn();
}

// Create case card element
function createCaseCard(caseItem, index) {
    const card = document.createElement('div');
    card.className = 'case-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.onclick = () => openCaseModal(caseItem);
    
    // Get rarity colors for items preview
    const itemPreviews = caseItem.items.slice(0, 6).map(item => {
        const rarityColor = getRarityColor(item.item.rarity);
        return `<div class="case-item-preview ${item.item.rarity}" title="${item.item.name} (${item.probability}%)">
            <i data-lucide="${item.item.icon}"></i>
        </div>`;
    }).join('');
    
    card.innerHTML = `
        <div class="case-header">
            <div class="case-icon">
                <i data-lucide="${caseItem.icon}"></i>
            </div>
            <div class="case-info">
                <h3>${caseItem.name}</h3>
                <p>${caseItem.description}</p>
            </div>
        </div>
        
        <div class="case-price">$${caseItem.price.toFixed(2)}</div>
        
        <div class="case-stats">
            <div class="case-stat">
                <div class="case-stat-label">Expected Value</div>
                <div class="case-stat-value">$${caseItem.expectedValue.toFixed(2)}</div>
            </div>
            <div class="case-stat">
                <div class="case-stat-label">Items</div>
                <div class="case-stat-value">${caseItem.items.length}</div>
            </div>
            <div class="case-stat">
                <div class="case-stat-label">Opened</div>
                <div class="case-stat-value">${caseItem.totalOpened}</div>
            </div>
        </div>
        
        <div class="case-items-preview">
            ${itemPreviews}
        </div>
        
        <button class="case-open-btn" onclick="event.stopPropagation(); openCase('${caseItem._id}')">
            Open Case
        </button>
    `;
    
    return card;
}

// Animate case cards in with staggered effect
function animateCaseCardsIn() {
    const cards = document.querySelectorAll('.case-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Open case modal with item preview
function openCaseModal(caseItem) {
    currentCase = caseItem;
    
    // Update modal content
    document.getElementById('case-opening-title').textContent = `Opening ${caseItem.name}`;
    
    // Populate reel with items
    populateCaseReel(caseItem);
    
    // Show modal
    document.getElementById('case-opening-modal').classList.remove('hidden');
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Populate case reel with items
function populateCaseReel(caseItem) {
    const reel = document.getElementById('case-reel');
    reel.innerHTML = '';
    
    // Create extended reel for smooth animation (50+ items)
    const extendedItems = [];
    for (let i = 0; i < 50; i++) {
        const randomItem = caseItem.items[Math.floor(Math.random() * caseItem.items.length)];
        extendedItems.push(randomItem);
    }
    
    extendedItems.forEach((item, index) => {
        const reelItem = document.createElement('div');
        reelItem.className = 'case-reel-item';
        reelItem.style.setProperty('--rarity-color', getRarityColor(item.item.rarity));
        
        reelItem.innerHTML = `
            <div class="item-icon">
                <i data-lucide="${item.item.icon}"></i>
            </div>
            <div class="item-name">${item.item.name}</div>
        `;
        
        reel.appendChild(reelItem);
    });
}

// Open case with animation
async function openCase(caseId) {
    try {
        // Check if user has enough balance
        const userBalance = parseFloat(document.getElementById('top-balance').textContent.replace('$', ''));
        if (userBalance < currentCase.price) {
            showError('Insufficient balance to open this case');
            return;
        }
        
        // Disable button during opening
        const openBtn = event.target;
        openBtn.disabled = true;
        openBtn.textContent = 'Opening...';
        
        // Start case opening animation
        startCaseOpeningAnimation();
        
        // Make API call to open case
        const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/open`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update balance
            document.getElementById('top-balance').textContent = `$${data.newBalance.toFixed(2)}`;
            
            // Show result after animation
            setTimeout(() => {
                showCaseResult(data.item);
            }, 3000);
            
            // Show success notification
            showSuccess(data.message);
        } else {
            showError(data.message || 'Failed to open case');
            closeCaseOpeningModal();
        }
    } catch (error) {
        console.error('Error opening case:', error);
        showError('Failed to open case');
        closeCaseOpeningModal();
    }
}

// Start case opening animation
function startCaseOpeningAnimation() {
    const reel = document.getElementById('case-reel');
    const reelItems = reel.children;
    
    // Calculate final position (center on a random item)
    const finalIndex = Math.floor(Math.random() * (reelItems.length - 10)) + 5;
    const itemWidth = 140; // 120px + 20px gap
    const finalPosition = -(finalIndex * itemWidth - (reel.parentElement.offsetWidth / 2) + 60);
    
    // Apply animation
    reel.style.transform = `translateX(${finalPosition}px)`;
    
    // Add spinning effect to individual items
    Array.from(reelItems).forEach((item, index) => {
        setTimeout(() => {
            item.style.transform = 'scale(1.1) rotate(360deg)';
            setTimeout(() => {
                item.style.transform = 'scale(1) rotate(0deg)';
            }, 200);
        }, index * 50);
    });
}

// Show case result
function showCaseResult(item) {
    // Hide animation, show result
    document.querySelector('.case-opening-animation').style.display = 'none';
    document.getElementById('case-result').classList.remove('hidden');
    
    // Populate result
    const resultIcon = document.getElementById('result-item-icon');
    const resultName = document.getElementById('result-item-name');
    const resultRarity = document.getElementById('result-item-rarity');
    const resultValue = document.getElementById('result-item-value');
    
    const rarityColor = getRarityColor(item.rarity);
    
    resultIcon.innerHTML = `<i data-lucide="${item.icon}"></i>`;
    resultIcon.style.setProperty('--rarity-color', rarityColor);
    resultName.textContent = item.name;
    resultRarity.textContent = item.rarity;
    resultRarity.style.color = rarityColor;
    resultValue.textContent = `$${item.value.toFixed(2)}`;
    
    // Animate result in
    const resultElement = document.getElementById('case-result');
    resultElement.style.opacity = '0';
    resultElement.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        resultElement.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        resultElement.style.opacity = '1';
        resultElement.style.transform = 'scale(1)';
    }, 100);
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Close case opening modal
function closeCaseOpeningModal() {
    document.getElementById('case-opening-modal').classList.add('hidden');
    
    // Reset modal state
    document.querySelector('.case-opening-animation').style.display = 'block';
    document.getElementById('case-result').classList.add('hidden');
    
    // Reset reel position
    const reel = document.getElementById('case-reel');
    reel.style.transform = 'translateX(0)';
    
    currentCase = null;
}

// Load and display inventory
async function loadInventory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/inventory/items`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayInventory(data.inventory);
            updateInventoryStats(data.inventory);
        } else {
            showError('Failed to load inventory');
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        showError('Failed to load inventory');
    }
}

// Display inventory items
function displayInventory(inventory) {
    const inventoryGrid = document.getElementById('inventory-grid');
    if (!inventoryGrid) return;
    
    inventoryGrid.innerHTML = '';
    
    // Filter items based on current filters
    let filteredItems = inventory.items;
    
    if (inventoryFilters.category) {
        filteredItems = filteredItems.filter(item => item.item.category === inventoryFilters.category);
    }
    
    if (inventoryFilters.rarity) {
        filteredItems = filteredItems.filter(item => item.item.rarity === inventoryFilters.rarity);
    }
    
    if (inventoryFilters.type === 'limited') {
        filteredItems = filteredItems.filter(item => item.item.isLimited);
    } else if (inventoryFilters.type === 'regular') {
        filteredItems = filteredItems.filter(item => !item.item.isLimited);
    }
    
    if (filteredItems.length === 0) {
        inventoryGrid.innerHTML = '<div class="no-items">No items found matching your filters</div>';
        return;
    }
    
    filteredItems.forEach((inventoryItem, index) => {
        const itemCard = createInventoryItemCard(inventoryItem, index);
        inventoryGrid.appendChild(itemCard);
    });
    
    // Animate items in
    animateInventoryItemsIn();
}

// Create inventory item card
function createInventoryItemCard(inventoryItem, index) {
    const card = document.createElement('div');
    card.className = `inventory-item ${inventoryItem.item.isLimited ? 'limited' : ''}`;
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.onclick = () => openItemDetailModal(inventoryItem);
    
    const rarityColor = getRarityColor(inventoryItem.item.rarity);
    card.style.setProperty('--rarity-color', rarityColor);
    
    card.innerHTML = `
        <div class="item-icon">
            <i data-lucide="${inventoryItem.item.icon}"></i>
        </div>
        <div class="item-details">
            <div class="item-name">${inventoryItem.item.name}</div>
            <div class="item-rarity">${inventoryItem.item.rarity}</div>
            <div class="item-value">$${inventoryItem.item.value.toFixed(2)}</div>
            <div class="item-quantity">Quantity: ${inventoryItem.quantity}</div>
        </div>
    `;
    
    return card;
}

// Animate inventory items in
function animateInventoryItemsIn() {
    const items = document.querySelectorAll('.inventory-item');
    items.forEach((item, index) => {
        setTimeout(() => {
            item.style.transition = 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

// Update inventory stats
function updateInventoryStats(inventory) {
    const totalItems = inventory.items.reduce((sum, item) => sum + item.quantity, 0);
    const limitedItems = inventory.items.filter(item => item.item.isLimited).length;
    
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('total-value').textContent = `$${inventory.totalValue.toFixed(2)}`;
    document.getElementById('limited-items').textContent = limitedItems;
    
    // Animate stats update
    animateStatsUpdate();
}

// Animate stats update
function animateStatsUpdate() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(stat => {
        stat.style.transform = 'scale(1.1)';
        stat.style.color = '#10b981';
        setTimeout(() => {
            stat.style.transform = 'scale(1)';
            stat.style.color = '';
        }, 200);
    });
}

// Open item detail modal
function openItemDetailModal(inventoryItem) {
    currentInventoryItem = inventoryItem;
    
    const item = inventoryItem.item;
    const rarityColor = getRarityColor(item.rarity);
    
    // Update modal content
    document.getElementById('item-detail-name').textContent = item.name;
    document.getElementById('item-detail-icon').innerHTML = `<i data-lucide="${item.icon}"></i>`;
    document.getElementById('item-detail-icon').style.setProperty('--rarity-color', rarityColor);
    document.getElementById('item-detail-rarity').textContent = item.rarity;
    document.getElementById('item-detail-rarity').style.color = rarityColor;
    document.getElementById('item-detail-category').textContent = item.category;
    document.getElementById('item-detail-value').textContent = `$${item.value.toFixed(2)}`;
    document.getElementById('item-detail-description').textContent = item.description || 'No description available.';
    document.getElementById('item-detail-quantity').textContent = inventoryItem.quantity;
    document.getElementById('item-detail-sell-price').textContent = `$${inventoryItem.sellPrice.toFixed(2)}`;
    document.getElementById('item-detail-obtained').textContent = inventoryItem.obtainedFrom;
    
    // Show/hide marketplace button for limited items
    const listBtn = document.getElementById('list-item-btn');
    if (item.isLimited) {
        listBtn.style.display = 'flex';
    } else {
        listBtn.style.display = 'none';
    }
    
    // Show modal with animation
    const modal = document.getElementById('item-detail-modal');
    modal.classList.remove('hidden');
    
    // Animate modal in
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.opacity = '0';
    modalContent.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
        modalContent.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        modalContent.style.opacity = '1';
        modalContent.style.transform = 'scale(1)';
    }, 10);
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Close item detail modal
function closeItemDetailModal() {
    const modal = document.getElementById('item-detail-modal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.style.opacity = '0';
    modalContent.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
        modal.classList.add('hidden');
        currentInventoryItem = null;
    }, 300);
}

// Sell item
async function sellItem() {
    if (!currentInventoryItem) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/cases/inventory/sell/${currentInventoryItem.item._id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: 1 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update balance
            document.getElementById('top-balance').textContent = `$${data.newBalance.toFixed(2)}`;
            
            // Close modal and refresh inventory
            closeItemDetailModal();
            loadInventory();
            
            showSuccess(data.message);
        } else {
            showError(data.message || 'Failed to sell item');
        }
    } catch (error) {
        console.error('Error selling item:', error);
        showError('Failed to sell item');
    }
}

// List item on marketplace (placeholder)
function listItem() {
    showInfo('Marketplace listing coming soon!');
}

// Setup inventory filters
function setupInventoryFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const rarityFilter = document.getElementById('rarity-filter');
    const typeFilter = document.getElementById('type-filter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            inventoryFilters.category = e.target.value;
            loadInventory();
        });
    }
    
    if (rarityFilter) {
        rarityFilter.addEventListener('change', (e) => {
            inventoryFilters.rarity = e.target.value;
            loadInventory();
        });
    }
    
    if (typeFilter) {
        typeFilter.addEventListener('change', (e) => {
            inventoryFilters.type = e.target.value;
            loadInventory();
        });
    }
}

// Get rarity color
function getRarityColor(rarity) {
    const colors = {
        common: '#9CA3AF',
        uncommon: '#10B981',
        rare: '#3B82F6',
        epic: '#8B5CF6',
        legendary: '#F59E0B',
        mythic: '#EF4444'
    };
    return colors[rarity] || colors.common;
}

// WebSocket event handlers
function handleCaseOpenedNotification(data) {
    showNotification({
        type: 'success',
        title: 'Case Opened!',
        message: `You received ${data.item.name}`,
        duration: 5000
    });
}

function handleItemSoldNotification(data) {
    showNotification({
        type: 'success',
        title: 'Item Sold!',
        message: `Sold for $${data.sellPrice.toFixed(2)}`,
        duration: 3000
    });
}

function handleItemPurchasedNotification(data) {
    showNotification({
        type: 'success',
        title: 'Item Purchased!',
        message: `Bought ${data.item} for $${data.price.toFixed(2)}`,
        duration: 3000
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeCasesSystem();
});

// Export functions for global access
window.openCase = openCase;
window.closeCaseOpeningModal = closeCaseOpeningModal;
window.closeItemDetailModal = closeItemDetailModal;
window.sellItem = sellItem;
window.listItem = listItem;
window.loadInventory = loadInventory; 