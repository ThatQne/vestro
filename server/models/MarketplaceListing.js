const mongoose = require('mongoose');

const marketplaceListingSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    itemImage: {
        type: String,
        default: 'default-item.png'
    },
    itemRarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'],
        required: true
    },
    baseValue: {
        type: Number,
        required: true,
        min: 0
    },
    listPrice: {
        type: Number,
        required: true,
        min: 0
    },
    currentMarketPrice: {
        type: Number,
        required: true,
        min: 0
    },
    priceHistory: [{
        price: {
            type: Number,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['active', 'sold', 'cancelled'],
        default: 'active'
    },
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    soldAt: {
        type: Date,
        default: null
    },
    soldPrice: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        }
    }
});

// Update market price based on recent sales
marketplaceListingSchema.statics.updateMarketPrice = async function(itemName) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentSales = await this.find({
        itemName: itemName,
        status: 'sold',
        soldAt: { $gte: thirtyDaysAgo }
    }).sort({ soldAt: -1 });
    
    if (recentSales.length > 0) {
        const averagePrice = recentSales.reduce((sum, sale) => sum + sale.soldPrice, 0) / recentSales.length;
        
        // Update all active listings for this item
        await this.updateMany(
            { itemName: itemName, status: 'active' },
            { 
                $set: { currentMarketPrice: averagePrice },
                $push: { 
                    priceHistory: {
                        price: averagePrice,
                        timestamp: new Date()
                    }
                }
            }
        );
        
        return averagePrice;
    }
    
    return null;
};

// Method to purchase an item
marketplaceListingSchema.methods.purchase = async function(buyerId, purchasePrice) {
    this.status = 'sold';
    this.buyerId = buyerId;
    this.soldAt = new Date();
    this.soldPrice = purchasePrice;
    
    await this.save();
    
    // Update market price after sale
    await this.constructor.updateMarketPrice(this.itemName);
    
    return this;
};

// Method to cancel listing
marketplaceListingSchema.methods.cancel = function() {
    this.status = 'cancelled';
    return this.save();
};

// Index for efficient queries
marketplaceListingSchema.index({ status: 1 });
marketplaceListingSchema.index({ sellerId: 1 });
marketplaceListingSchema.index({ itemName: 1 });
marketplaceListingSchema.index({ createdAt: -1 });
marketplaceListingSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('MarketplaceListing', marketplaceListingSchema); 