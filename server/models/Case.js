const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        default: 'default-case.png'
    },
    items: [{
        name: {
            type: String,
            required: true
        },
        value: {
            type: Number,
            required: true,
            min: 0
        },
        probability: {
            type: Number,
            required: true,
            min: 0,
            max: 100
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
        }
    }],
    totalOpenings: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Validate that probabilities add up to 100
caseSchema.pre('save', function(next) {
    if (this.items && this.items.length > 0) {
        const totalProbability = this.items.reduce((sum, item) => sum + item.probability, 0);
        if (Math.abs(totalProbability - 100) > 0.001) {
            return next(new Error('Item probabilities must add up to 100'));
        }
    }
    next();
});

// Method to get a random item based on probabilities
caseSchema.methods.getRandomItem = function() {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const item of this.items) {
        cumulative += item.probability;
        if (random <= cumulative) {
            return item;
        }
    }
    
    // Fallback to last item if something goes wrong
    return this.items[this.items.length - 1];
};

// Index for efficient queries
caseSchema.index({ isActive: 1 });
caseSchema.index({ price: 1 });

module.exports = mongoose.model('Case', caseSchema); 