const mongoose = require('mongoose');
const Case = require('../models/Case');

function generateBotPlayer(index) {
    const botNames = ['Bot_Alpha', 'Bot_Beta', 'Bot_Gamma', 'Bot_Delta'];
    const botName = `${botNames[index % botNames.length]}_${Math.floor(Math.random() * 1000)}`;
    
    return {
        userId: new mongoose.Types.ObjectId(), // Generate a random ObjectId for the bot
        username: botName,
        isBot: true,
        joinedAt: new Date(),
        items: [],
        totalValue: 0
    };
}

async function simulateBotCaseOpening(caseItems) {
    const botItems = [];
    let totalValue = 0;
    
    for (const caseItem of caseItems) {
        const dbCase = await Case.findById(caseItem.caseId);
        if (!dbCase) continue;
        
        for (let i = 0; i < caseItem.quantity; i++) {
            const wonItem = dbCase.getRandomItem();
            botItems.push({
                itemName: wonItem.name,
                itemValue: wonItem.value,
                itemImage: wonItem.image || 'default-item.png',
                itemRarity: wonItem.rarity,
                caseSource: dbCase.name,
                isLimited: wonItem.isLimited || false
            });
            totalValue += wonItem.value;
        }
    }
    
    return { items: botItems, totalValue };
}

module.exports = {
    generateBotPlayer,
    simulateBotCaseOpening
};
