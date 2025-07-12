const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1
        },
        obtainedAt: {
            type: Date,
            default: Date.now
        },
        obtainedFrom: {
            type: String,
            enum: ['case', 'trade', 'purchase', 'gift', 'battle', 'jackpot'],
            default: 'case'
        },
        caseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Case'
        },
        battleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CaseBattle'
        }
    }],
    totalValue: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add item to inventory
inventorySchema.methods.addItem = function(itemId, quantity = 1, source = 'case', metadata = {}) {
    const existingItem = this.items.find(invItem => 
        invItem.item.toString() === itemId.toString()
    );
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        this.items.push({
            item: itemId,
            quantity: quantity,
            obtainedFrom: source,
            caseId: metadata.caseId,
            battleId: metadata.battleId
        });
    }
    
    this.updatedAt = new Date();
};

// Remove item from inventory
inventorySchema.methods.removeItem = function(itemId, quantity = 1) {
    const existingItem = this.items.find(invItem => 
        invItem.item.toString() === itemId.toString()
    );
    
    if (!existingItem) {
        throw new Error('Item not found in inventory');
    }
    
    if (existingItem.quantity <= quantity) {
        this.items = this.items.filter(invItem => 
            invItem.item.toString() !== itemId.toString()
        );
    } else {
        existingItem.quantity -= quantity;
    }
    
    this.updatedAt = new Date();
};

// Calculate total inventory value
inventorySchema.methods.calculateTotalValue = async function() {
    await this.populate('items.item');
    
    this.totalValue = this.items.reduce((sum, invItem) => {
        const itemValue = invItem.item.isLimited ? 
            (invItem.item.currentPrice || invItem.item.value) : 
            invItem.item.value;
        return sum + (itemValue * invItem.quantity);
    }, 0);
    
    return this.totalValue;
};

// Get items by category
inventorySchema.methods.getItemsByCategory = async function(category) {
    await this.populate('items.item');
    return this.items.filter(invItem => invItem.item.category === category);
};

// Get items by rarity
inventorySchema.methods.getItemsByRarity = async function(rarity) {
    await this.populate('items.item');
    return this.items.filter(invItem => invItem.item.rarity === rarity);
};

// Get limited items only
inventorySchema.methods.getLimitedItems = async function() {
    await this.populate('items.item');
    return this.items.filter(invItem => invItem.item.isLimited);
};

// Get sellable items (with calculated sell prices)
inventorySchema.methods.getSellableItems = async function() {
    await this.populate('items.item');
    return this.items.map(invItem => ({
        ...invItem.toObject(),
        sellPrice: invItem.item.getSellPrice()
    }));
};

inventorySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

inventorySchema.index({ user: 1 });
inventorySchema.index({ 'items.item': 1 });
inventorySchema.index({ user: 1, 'items.item': 1 });

module.exports = mongoose.model('Inventory', inventorySchema); 