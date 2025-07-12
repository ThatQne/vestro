const mongoose = require('mongoose');
const Item = require('../models/Item');
const Case = require('../models/Case');

// Sample items data
const sampleItems = [
    // Common items
    { name: 'Basic Knife', description: 'A simple utility knife', rarity: 'common', value: 5.00, category: 'weapon', icon: 'knife' },
    { name: 'Wooden Crate', description: 'A sturdy wooden storage crate', rarity: 'common', value: 2.50, category: 'decoration', icon: 'package' },
    { name: 'Cloth Bandage', description: 'Basic medical supplies', rarity: 'common', value: 1.00, category: 'consumable', icon: 'bandage' },
    { name: 'Leather Gloves', description: 'Protective work gloves', rarity: 'common', value: 3.00, category: 'accessory', icon: 'hand' },
    { name: 'Metal Scraps', description: 'Useful crafting materials', rarity: 'common', value: 0.50, category: 'misc', icon: 'wrench' },
    
    // Uncommon items
    { name: 'Steel Sword', description: 'A well-crafted steel blade', rarity: 'uncommon', value: 15.00, category: 'weapon', icon: 'sword' },
    { name: 'Tactical Vest', description: 'Lightweight protective gear', rarity: 'uncommon', value: 12.00, category: 'accessory', icon: 'shield' },
    { name: 'Energy Drink', description: 'Restores stamina quickly', rarity: 'uncommon', value: 8.00, category: 'consumable', icon: 'zap' },
    { name: 'Digital Watch', description: 'Precise timekeeping device', rarity: 'uncommon', value: 10.00, category: 'accessory', icon: 'watch' },
    { name: 'Camping Gear', description: 'Essential outdoor equipment', rarity: 'uncommon', value: 18.00, category: 'misc', icon: 'tent' },
    
    // Rare items
    { name: 'Plasma Rifle', description: 'Advanced energy weapon', rarity: 'rare', value: 50.00, category: 'weapon', icon: 'zap', isLimited: true },
    { name: 'Nano Suit', description: 'High-tech protective armor', rarity: 'rare', value: 75.00, category: 'accessory', icon: 'shield', isLimited: true },
    { name: 'Quantum Core', description: 'Rare energy source', rarity: 'rare', value: 60.00, category: 'misc', icon: 'cpu', isLimited: true },
    { name: 'Holo Projector', description: 'Holographic display device', rarity: 'rare', value: 45.00, category: 'decoration', icon: 'projector' },
    { name: 'Medkit Pro', description: 'Advanced medical equipment', rarity: 'rare', value: 35.00, category: 'consumable', icon: 'heart' },
    
    // Epic items
    { name: 'Dragon Blade', description: 'Legendary weapon of ancient power', rarity: 'epic', value: 150.00, category: 'weapon', icon: 'sword', isLimited: true },
    { name: 'Phoenix Armor', description: 'Mystical protective gear', rarity: 'epic', value: 200.00, category: 'accessory', icon: 'shield', isLimited: true },
    { name: 'Void Crystal', description: 'Mysterious dark energy crystal', rarity: 'epic', value: 120.00, category: 'misc', icon: 'gem', isLimited: true },
    { name: 'Time Manipulator', description: 'Device that bends time itself', rarity: 'epic', value: 180.00, category: 'misc', icon: 'clock', isLimited: true },
    
    // Legendary items
    { name: 'Excalibur', description: 'The legendary sword of kings', rarity: 'legendary', value: 500.00, category: 'weapon', icon: 'sword', isLimited: true },
    { name: 'Crown of Eternity', description: 'Grants immortality to the wearer', rarity: 'legendary', value: 750.00, category: 'accessory', icon: 'crown', isLimited: true },
    { name: 'Philosophers Stone', description: 'Turns base metals into gold', rarity: 'legendary', value: 1000.00, category: 'misc', icon: 'gem', isLimited: true },
    
    // Mythic items
    { name: 'Godslayer', description: 'Weapon capable of slaying gods', rarity: 'mythic', value: 2500.00, category: 'weapon', icon: 'sword', isLimited: true },
    { name: 'Universe Orb', description: 'Contains the power of creation', rarity: 'mythic', value: 5000.00, category: 'misc', icon: 'globe', isLimited: true }
];

// Sample cases data (will be populated after items are created)
const sampleCases = [
    {
        name: 'Starter Pack',
        description: 'Perfect for beginners - contains basic items',
        price: 5.00,
        icon: 'package',
        category: 'mixed',
        items: [] // Will be populated with item IDs and probabilities
    },
    {
        name: 'Weapon Crate',
        description: 'Specialized case containing various weapons',
        price: 25.00,
        icon: 'package-2',
        category: 'weapon',
        items: []
    },
    {
        name: 'Rare Treasures',
        description: 'Higher chance of rare and epic items',
        price: 100.00,
        icon: 'gift',
        category: 'special',
        items: []
    },
    {
        name: 'Legendary Vault',
        description: 'Exclusive case with legendary items',
        price: 500.00,
        icon: 'crown',
        category: 'limited',
        items: []
    }
];

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');
        
        // Clear existing data
        await Item.deleteMany({});
        await Case.deleteMany({});
        console.log('Cleared existing data');
        
        // Create items
        const createdItems = await Item.insertMany(sampleItems);
        console.log(`Created ${createdItems.length} items`);
        
        // Create item lookup for easier access
        const itemsByRarity = {};
        const itemsByCategory = {};
        
        createdItems.forEach(item => {
            if (!itemsByRarity[item.rarity]) {
                itemsByRarity[item.rarity] = [];
            }
            itemsByRarity[item.rarity].push(item);
            
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        });
        
        // Configure cases with items and probabilities
        
        // Starter Pack - mostly common items
        sampleCases[0].items = [
            ...itemsByRarity.common.map(item => ({ item: item._id, probability: 15 })),
            ...itemsByRarity.uncommon.slice(0, 2).map(item => ({ item: item._id, probability: 5 }))
        ];
        
        // Weapon Crate - weapon focused
        const weaponItems = itemsByCategory.weapon || [];
        sampleCases[1].items = [
            ...weaponItems.filter(item => item.rarity === 'common').map(item => ({ item: item._id, probability: 30 })),
            ...weaponItems.filter(item => item.rarity === 'uncommon').map(item => ({ item: item._id, probability: 20 })),
            ...weaponItems.filter(item => item.rarity === 'rare').map(item => ({ item: item._id, probability: 15 })),
            ...weaponItems.filter(item => item.rarity === 'epic').map(item => ({ item: item._id, probability: 10 })),
            ...weaponItems.filter(item => item.rarity === 'legendary').map(item => ({ item: item._id, probability: 4 })),
            ...weaponItems.filter(item => item.rarity === 'mythic').map(item => ({ item: item._id, probability: 1 }))
        ];
        
        // Rare Treasures - higher tier items
        sampleCases[2].items = [
            ...itemsByRarity.uncommon.map(item => ({ item: item._id, probability: 20 })),
            ...itemsByRarity.rare.map(item => ({ item: item._id, probability: 15 })),
            ...itemsByRarity.epic.map(item => ({ item: item._id, probability: 10 })),
            ...itemsByRarity.legendary.map(item => ({ item: item._id, probability: 4 })),
            ...itemsByRarity.mythic.map(item => ({ item: item._id, probability: 1 }))
        ];
        
        // Legendary Vault - premium items only
        sampleCases[3].items = [
            ...itemsByRarity.rare.map(item => ({ item: item._id, probability: 30 })),
            ...itemsByRarity.epic.map(item => ({ item: item._id, probability: 25 })),
            ...itemsByRarity.legendary.map(item => ({ item: item._id, probability: 15 })),
            ...itemsByRarity.mythic.map(item => ({ item: item._id, probability: 5 }))
        ];
        
        // Normalize probabilities to sum to 100%
        sampleCases.forEach(caseData => {
            const totalProbability = caseData.items.reduce((sum, item) => sum + item.probability, 0);
            if (totalProbability !== 100) {
                const factor = 100 / totalProbability;
                caseData.items.forEach(item => {
                    item.probability = Math.round(item.probability * factor * 100) / 100;
                });
                
                // Ensure exact 100% by adjusting the first item
                const newTotal = caseData.items.reduce((sum, item) => sum + item.probability, 0);
                if (newTotal !== 100) {
                    caseData.items[0].probability += (100 - newTotal);
                }
            }
        });
        
        // Create cases
        const createdCases = await Case.insertMany(sampleCases);
        console.log(`Created ${createdCases.length} cases`);
        
        // Add some price history to limited items
        const limitedItems = createdItems.filter(item => item.isLimited);
        for (const item of limitedItems) {
            // Add some fake price history
            const basePrice = item.value;
            for (let i = 0; i < 10; i++) {
                const variation = (Math.random() - 0.5) * 0.2; // ±20% variation
                const price = basePrice * (1 + variation);
                item.addSale(price, 1);
            }
            await item.save();
        }
        
        console.log('Database seeding completed successfully!');
        console.log('\nCreated Cases:');
        createdCases.forEach(caseItem => {
            console.log(`- ${caseItem.name}: $${caseItem.price} (${caseItem.items.length} items)`);
        });
        
    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
}

module.exports = { seedDatabase }; 