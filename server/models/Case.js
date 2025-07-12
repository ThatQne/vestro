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

// Create sample cases
caseSchema.statics.createSampleCases = async function() {
    const cases = [
        {
            name: 'Starter Case',
            description: 'A basic case with affordable items',
            price: 5.00,
            icon: 'package',
            category: 'mixed',
            items: [
                { name: 'Basic Knife', value: 2.00, probability: 40, icon: 'sword' },
                { name: 'Simple Gloves', value: 3.00, probability: 30, icon: 'hand' },
                { name: 'Steel Helmet', value: 8.00, probability: 20, icon: 'hard-hat' },
                { name: 'Golden Ring', value: 15.00, probability: 10, icon: 'circle' }
            ]
        },
        {
            name: 'Weapon Case',
            description: 'Collection of rare weapons',
            price: 15.00,
            icon: 'sword',
            category: 'weapon',
            items: [
                { name: 'Dragon Slayer', value: 50.00, probability: 5, icon: 'swords' },
                { name: 'Shadow Dagger', value: 30.00, probability: 15, icon: 'knife' },
                { name: 'Thunder Bow', value: 20.00, probability: 25, icon: 'bow' },
                { name: 'Frost Staff', value: 15.00, probability: 25, icon: 'staff' },
                { name: 'Iron Sword', value: 10.00, probability: 30, icon: 'sword' }
            ]
        },
        {
            name: 'Armor Case',
            description: 'Protective gear and shields',
            price: 25.00,
            icon: 'shield',
            category: 'armor',
            items: [
                { name: 'Dragon Scale Armor', value: 80.00, probability: 5, icon: 'shield-half' },
                { name: 'Knight\'s Shield', value: 40.00, probability: 15, icon: 'shield' },
                { name: 'Mithril Helmet', value: 30.00, probability: 20, icon: 'hard-hat' },
                { name: 'Steel Gauntlets', value: 20.00, probability: 25, icon: 'hand-metal' },
                { name: 'Leather Boots', value: 15.00, probability: 35, icon: 'boot' }
            ]
        },
        {
            name: 'Mythic Treasures',
            description: 'Ultra rare legendary items',
            price: 50.00,
            icon: 'sparkles',
            category: 'special',
            items: [
                { name: 'Excalibur', value: 250.00, probability: 2, icon: 'swords' },
                { name: 'Phoenix Wings', value: 150.00, probability: 8, icon: 'wings' },
                { name: 'Crown of Kings', value: 100.00, probability: 15, icon: 'crown' },
                { name: 'Ancient Scroll', value: 75.00, probability: 25, icon: 'scroll' },
                { name: 'Magic Crystal', value: 50.00, probability: 50, icon: 'gem' }
            ]
        },
        {
            name: 'Tech Case',
            description: 'Modern technology items',
            price: 30.00,
            icon: 'cpu',
            category: 'tech',
            items: [
                { name: 'Quantum Computer', value: 100.00, probability: 5, icon: 'cpu' },
                { name: 'Holographic Display', value: 60.00, probability: 15, icon: 'monitor' },
                { name: 'Neural Interface', value: 40.00, probability: 25, icon: 'brain' },
                { name: 'Power Core', value: 30.00, probability: 25, icon: 'battery-charging' },
                { name: 'Data Crystal', value: 20.00, probability: 30, icon: 'database' }
            ]
        }
    ];

    // Create items for each case
    const Item = mongoose.model('Item');
    for (const caseData of cases) {
        const items = [];
        for (const itemData of caseData.items) {
            const item = await Item.create({
                name: itemData.name,
                description: `A unique item from the ${caseData.name}`,
                value: itemData.value,
                icon: itemData.icon,
                category: caseData.category,
                isLimited: itemData.value >= 100.00 // Make high-value items limited
            });
            items.push({
                item: item._id,
                probability: itemData.probability
            });
        }
        
        await this.create({
            ...caseData,
            items
        });
    }
};

// Helper function to get value based on rarity
function getValueForRarity(rarity) {
    switch (rarity) {
        case 'common': return 1.00;
        case 'uncommon': return 3.00;
        case 'rare': return 8.00;
        case 'epic': return 20.00;
        case 'legendary': return 50.00;
        case 'mythic': return 100.00;
        default: return 1.00;
    }
}

// Helper function to get icon based on rarity
function getIconForRarity(rarity) {
    switch (rarity) {
        case 'common': return 'box';
        case 'uncommon': return 'package';
        case 'rare': return 'gem';
        case 'epic': return 'diamond';
        case 'legendary': return 'crown';
        case 'mythic': return 'sparkles';
        default: return 'box';
    }
}

caseSchema.index({ isActive: 1, category: 1 });
caseSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Case', caseSchema); 