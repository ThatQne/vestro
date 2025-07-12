const mongoose = require('mongoose');

const marketplaceListingSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
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
    listingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'sold', 'cancelled', 'expired'],
        default: 'active'
    },
    buyer: {
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
        default: null
    },
    expiresAt: {
        type: Date,
        default: function() {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30); // 30 days default
            return expiry;
        }
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

// Auto-expire listings
marketplaceListingSchema.pre('save', function(next) {
    if (this.status === 'active' && this.expiresAt < new Date()) {
        this.status = 'expired';
    }
    this.updatedAt = new Date();
    next();
});

// Complete sale
marketplaceListingSchema.methods.completeSale = function(buyerId, salePrice) {
    this.status = 'sold';
    this.buyer = buyerId;
    this.soldAt = new Date();
    this.soldPrice = salePrice || this.listingPrice;
};

// Cancel listing
marketplaceListingSchema.methods.cancel = function() {
    if (this.status !== 'active') {
        throw new Error('Cannot cancel non-active listing');
    }
    this.status = 'cancelled';
};

// Check if listing is still valid
marketplaceListingSchema.methods.isValid = function() {
    return this.status === 'active' && this.expiresAt > new Date();
};

marketplaceListingSchema.index({ seller: 1, status: 1 });
marketplaceListingSchema.index({ item: 1, status: 1 });
marketplaceListingSchema.index({ status: 1, expiresAt: 1 });
marketplaceListingSchema.index({ listingPrice: 1 });

module.exports = mongoose.model('MarketplaceListing', marketplaceListingSchema); 