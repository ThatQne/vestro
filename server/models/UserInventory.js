const mongoose = require('mongoose');

const userInventorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        itemName: {
            type: String,
            required: true
        },
        caseSource: {
            type: String,
            required: true
        },
        value: {
            type: Number,
            required: true,
            min: 0
        },
        isLimited: {
            type: Boolean,
            default: false
        },
        image: {
            type: String,
            default: 'default-item.png'
        },
        rarity: {
            type: String,
            enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'],
            default: 'common'
        },
        obtainedAt: {
            type: Date,
            default: Date.now
        },
        // For marketplace tracking
        currentPrice: {
            type: Number,
            default: 0
        },
        // For trading status
        isTrading: {
            type: Boolean,
            default: false
        },
        isListed: {
            type: Boolean,
            default: false
        }
    }],
    totalValue: {
        type: Number,
        default: 0
    },
    totalItems: {
        type: Number,
        default: 0
    },
    limitedItems: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update totals before saving
userInventorySchema.pre('save', function(next) {
    this.totalItems = this.items.length;
    this.totalValue = this.items.reduce((sum, item) => sum + item.value, 0);
    this.limitedItems = this.items.filter(item => item.isLimited).length;
    this.lastUpdated = Date.now();
    next();
});

// Method to add an item to inventory
userInventorySchema.methods.addItem = function(itemData) {
    this.items.push({
        itemName: itemData.name,
        caseSource: itemData.caseSource,
        value: itemData.value,
        isLimited: itemData.isLimited,
        image: itemData.image,
        rarity: itemData.rarity,
        currentPrice: itemData.isLimited ? itemData.value : 0
    });
    return this.save();
};

// Method to remove an item from inventory
userInventorySchema.methods.removeItem = function(itemId) {
    this.items = this.items.filter(item => item._id.toString() !== itemId);
    return this.save();
};

// Method to get items by rarity
userInventorySchema.methods.getItemsByRarity = function(rarity) {
    return this.items.filter(item => item.rarity === rarity);
};

// Method to get limited items only
userInventorySchema.methods.getLimitedItems = function() {
    return this.items.filter(item => item.isLimited);
};

// Index for efficient queries
userInventorySchema.index({ userId: 1 });
userInventorySchema.index({ 'items.isLimited': 1 });
userInventorySchema.index({ 'items.isListed': 1 });

module.exports = mongoose.model('UserInventory', userInventorySchema); 