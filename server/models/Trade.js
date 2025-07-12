const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
    initiatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    initiatorItems: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        itemName: {
            type: String,
            required: true
        },
        itemValue: {
            type: Number,
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
        }
    }],
    targetItems: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        itemName: {
            type: String,
            required: true
        },
        itemValue: {
            type: Number,
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
        }
    }],
    initiatorTotalValue: {
        type: Number,
        default: 0
    },
    targetTotalValue: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'cancelled', 'completed'],
        default: 'pending'
    },
    message: {
        type: String,
        maxlength: 500,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    respondedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        }
    }
});

// Calculate total values before saving
tradeSchema.pre('save', function(next) {
    this.initiatorTotalValue = this.initiatorItems.reduce((sum, item) => sum + item.itemValue, 0);
    this.targetTotalValue = this.targetItems.reduce((sum, item) => sum + item.itemValue, 0);
    next();
});

// Method to accept trade
tradeSchema.methods.accept = function() {
    this.status = 'accepted';
    this.respondedAt = new Date();
    return this.save();
};

// Method to decline trade
tradeSchema.methods.decline = function() {
    this.status = 'declined';
    this.respondedAt = new Date();
    return this.save();
};

// Method to cancel trade
tradeSchema.methods.cancel = function() {
    this.status = 'cancelled';
    this.respondedAt = new Date();
    return this.save();
};

// Method to complete trade
tradeSchema.methods.complete = function() {
    this.status = 'completed';
    this.completedAt = new Date();
    return this.save();
};

// Method to check if trade is expired
tradeSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Method to get trade summary
tradeSchema.methods.getSummary = function() {
    return {
        id: this._id,
        initiatorId: this.initiatorId,
        targetId: this.targetId,
        initiatorItemCount: this.initiatorItems.length,
        targetItemCount: this.targetItems.length,
        initiatorTotalValue: this.initiatorTotalValue,
        targetTotalValue: this.targetTotalValue,
        status: this.status,
        createdAt: this.createdAt,
        expiresAt: this.expiresAt
    };
};

// Index for efficient queries
tradeSchema.index({ initiatorId: 1 });
tradeSchema.index({ targetId: 1 });
tradeSchema.index({ status: 1 });
tradeSchema.index({ createdAt: -1 });
tradeSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Trade', tradeSchema); 