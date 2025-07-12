const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
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
    currentPrice: {
        type: Number,
        default: function() {
            return this.isLimited ? this.value : null;
        }
    },
    priceHistory: [{
        price: Number,
        timestamp: {
            type: Date,
            default: Date.now
        },
        volume: {
            type: Number,
            default: 1
        }
    }],
    icon: {
        type: String,
        default: 'package' // Lucide icon name as placeholder
    },
    image: {
        type: String,
        default: null // Future 2D/3D asset path
    },
    category: {
        type: String,
        enum: ['weapon', 'skin', 'accessory', 'consumable', 'decoration', 'misc'],
        default: 'misc'
    },
    tags: [String],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the current price based on recent sales (last 30 days)
itemSchema.methods.updatePrice = function() {
    if (!this.isLimited) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSales = this.priceHistory.filter(sale => 
        sale.timestamp >= thirtyDaysAgo
    );
    
    if (recentSales.length > 0) {
        const totalValue = recentSales.reduce((sum, sale) => 
            sum + (sale.price * sale.volume), 0
        );
        const totalVolume = recentSales.reduce((sum, sale) => 
            sum + sale.volume, 0
        );
        
        this.currentPrice = totalValue / totalVolume;
        this.updatedAt = new Date();
    }
};

// Add a sale to price history
itemSchema.methods.addSale = function(price, volume = 1) {
    this.priceHistory.push({
        price: price,
        volume: volume,
        timestamp: new Date()
    });
    
    // Keep only last 1000 sales to prevent bloat
    if (this.priceHistory.length > 1000) {
        this.priceHistory = this.priceHistory.slice(-1000);
    }
    
    this.updatePrice();
};

// Get rarity color for UI
itemSchema.methods.getRarityColor = function() {
    const colors = {
        common: '#9CA3AF',
        uncommon: '#10B981',
        rare: '#3B82F6',
        epic: '#8B5CF6',
        legendary: '#F59E0B',
        mythic: '#EF4444'
    };
    return colors[this.rarity] || colors.common;
};

// Get sell price (70% of value for non-limited items)
itemSchema.methods.getSellPrice = function() {
    if (this.isLimited) {
        return this.currentPrice || this.value;
    }
    return Math.floor(this.value * 0.7 * 100) / 100; // 70% of value, rounded to 2 decimals
};

itemSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

itemSchema.index({ rarity: 1, isLimited: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Item', itemSchema); 