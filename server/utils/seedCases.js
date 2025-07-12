const mongoose = require('mongoose');
const Case = require('../models/Case');

const initialCases = [
    {
        name: "Starter Case",
        description: "Perfect for beginners! Contains basic items with decent value.",
        price: 10,
        image: "starter-case.png",
        items: [
            {
                name: "Bronze Coin",
                value: 5,
                probability: 45,
                isLimited: false,
                image: "bronze-coin.png",
                rarity: "common"
            },
            {
                name: "Silver Coin",
                value: 12,
                probability: 30,
                isLimited: false,
                image: "silver-coin.png",
                rarity: "uncommon"
            },
            {
                name: "Gold Coin",
                value: 25,
                probability: 20,
                isLimited: false,
                image: "gold-coin.png",
                rarity: "rare"
            },
            {
                name: "Platinum Coin",
                value: 50,
                probability: 4.5,
                isLimited: false,
                image: "platinum-coin.png",
                rarity: "epic"
            },
            {
                name: "Diamond Coin",
                value: 150,
                probability: 0.5,
                isLimited: true,
                image: "diamond-coin.png",
                rarity: "legendary"
            }
        ]
    },
    {
        name: "Gambler's Delight",
        description: "High-risk, high-reward case for serious gamblers.",
        price: 50,
        image: "gamblers-delight.png",
        items: [
            {
                name: "Luck Charm",
                value: 20,
                probability: 40,
                isLimited: false,
                image: "luck-charm.png",
                rarity: "common"
            },
            {
                name: "Golden Dice",
                value: 60,
                probability: 25,
                isLimited: false,
                image: "golden-dice.png",
                rarity: "uncommon"
            },
            {
                name: "Ruby Chips",
                value: 120,
                probability: 20,
                isLimited: false,
                image: "ruby-chips.png",
                rarity: "rare"
            },
            {
                name: "Emerald Card",
                value: 250,
                probability: 10,
                isLimited: false,
                image: "emerald-card.png",
                rarity: "epic"
            },
            {
                name: "Fortune's Crown",
                value: 500,
                probability: 4,
                isLimited: false,
                image: "fortune-crown.png",
                rarity: "legendary"
            },
            {
                name: "Midas Touch",
                value: 1500,
                probability: 1,
                isLimited: true,
                image: "midas-touch.png",
                rarity: "mythical"
            }
        ]
    },
    {
        name: "Mystic Treasures",
        description: "Ancient artifacts with mysterious powers and incredible value.",
        price: 100,
        image: "mystic-treasures.png",
        items: [
            {
                name: "Ancient Scroll",
                value: 50,
                probability: 35,
                isLimited: false,
                image: "ancient-scroll.png",
                rarity: "common"
            },
            {
                name: "Crystal Orb",
                value: 120,
                probability: 25,
                isLimited: false,
                image: "crystal-orb.png",
                rarity: "uncommon"
            },
            {
                name: "Enchanted Ring",
                value: 200,
                probability: 20,
                isLimited: false,
                image: "enchanted-ring.png",
                rarity: "rare"
            },
            {
                name: "Wizard's Staff",
                value: 400,
                probability: 12,
                isLimited: false,
                image: "wizard-staff.png",
                rarity: "epic"
            },
            {
                name: "Phoenix Feather",
                value: 800,
                probability: 6,
                isLimited: false,
                image: "phoenix-feather.png",
                rarity: "legendary"
            },
            {
                name: "Dragon's Eye",
                value: 2000,
                probability: 2,
                isLimited: true,
                image: "dragon-eye.png",
                rarity: "mythical"
            }
        ]
    },
    {
        name: "Neon Dreams",
        description: "Futuristic items from the cyber world with electric appeal.",
        price: 75,
        image: "neon-dreams.png",
        items: [
            {
                name: "Neon Chip",
                value: 35,
                probability: 30,
                isLimited: false,
                image: "neon-chip.png",
                rarity: "common"
            },
            {
                name: "Cyber Token",
                value: 80,
                probability: 25,
                isLimited: false,
                image: "cyber-token.png",
                rarity: "uncommon"
            },
            {
                name: "Holographic Card",
                value: 150,
                probability: 20,
                isLimited: false,
                image: "holo-card.png",
                rarity: "rare"
            },
            {
                name: "Digital Crown",
                value: 350,
                probability: 15,
                isLimited: false,
                image: "digital-crown.png",
                rarity: "epic"
            },
            {
                name: "Quantum Core",
                value: 750,
                probability: 8,
                isLimited: false,
                image: "quantum-core.png",
                rarity: "legendary"
            },
            {
                name: "Neural Matrix",
                value: 1800,
                probability: 2,
                isLimited: true,
                image: "neural-matrix.png",
                rarity: "mythical"
            }
        ]
    },
    {
        name: "Ocean's Bounty",
        description: "Treasures from the deep sea with mysterious oceanic powers.",
        price: 60,
        image: "ocean-bounty.png",
        items: [
            {
                name: "Seashell Fragment",
                value: 25,
                probability: 40,
                isLimited: false,
                image: "seashell.png",
                rarity: "common"
            },
            {
                name: "Coral Crystal",
                value: 65,
                probability: 30,
                isLimited: false,
                image: "coral-crystal.png",
                rarity: "uncommon"
            },
            {
                name: "Siren's Pearl",
                value: 140,
                probability: 20,
                isLimited: false,
                image: "siren-pearl.png",
                rarity: "rare"
            },
            {
                name: "Trident Piece",
                value: 280,
                probability: 7,
                isLimited: false,
                image: "trident-piece.png",
                rarity: "epic"
            },
            {
                name: "Kraken's Ink",
                value: 600,
                probability: 2.5,
                isLimited: false,
                image: "kraken-ink.png",
                rarity: "legendary"
            },
            {
                name: "Poseidon's Blessing",
                value: 1200,
                probability: 0.5,
                isLimited: true,
                image: "poseidon-blessing.png",
                rarity: "mythical"
            }
        ]
    }
];

async function seedCases() {
    try {
        // Clear existing cases
        await Case.deleteMany({});
        console.log('Cleared existing cases');

        // Insert new cases
        const createdCases = await Case.insertMany(initialCases);
        console.log(`Created ${createdCases.length} cases successfully:`);
        
        createdCases.forEach(caseItem => {
            console.log(`- ${caseItem.name}: $${caseItem.price} (${caseItem.items.length} items)`);
            const limitedItems = caseItem.items.filter(item => item.isLimited);
            if (limitedItems.length > 0) {
                console.log(`  Limited items: ${limitedItems.map(item => item.name).join(', ')}`);
            }
        });

        return createdCases;
    } catch (error) {
        console.error('Error seeding cases:', error);
        throw error;
    }
}

module.exports = { seedCases, initialCases }; 