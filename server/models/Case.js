const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    icon: {
        type: String,
        default: 'package-2' // Lucide icon name
    },
    image: {
        type: String,
        default: null // Future case image
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true
        },
        probability: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        enum: ['weapon', 'skin', 'mixed', 'special', 'limited'],
        default: 'mixed'
    },
    tags: [String],
    totalOpened: {
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

// Validate that probabilities add up to 100
caseSchema.pre('save', function(next) {
    const totalProbability = this.items.reduce((sum, item) => sum + item.probability, 0);
    if (Math.abs(totalProbability - 100) > 0.01) {
        return next(new Error('Item probabilities must add up to 100%'));
    }
    this.updatedAt = new Date();
    next();
});

// Open a case and return a random item based on probabilities
caseSchema.methods.openCase = function() {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const caseItem of this.items) {
        cumulative += caseItem.probability;
        if (random <= cumulative) {
            this.totalOpened += 1;
            return caseItem.item;
        }
    }
    
    // Fallback to last item if something goes wrong
    return this.items[this.items.length - 1].item;
};

// Get expected value of the case
caseSchema.methods.getExpectedValue = async function() {
    await this.populate('items.item');
    return this.items.reduce((sum, caseItem) => {
        const itemValue = caseItem.item.value;
        const probability = caseItem.probability / 100;
        return sum + (itemValue * probability);
    }, 0);
};

// Get items by rarity for display
caseSchema.methods.getItemsByRarity = async function() {
    await this.populate('items.item');
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    
    return this.items.sort((a, b) => {
        const aIndex = rarityOrder.indexOf(a.item.rarity);
        const bIndex = rarityOrder.indexOf(b.item.rarity);
        return aIndex - bIndex;
    });
};

caseSchema.index({ isActive: 1, category: 1 });
caseSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Case', caseSchema); 