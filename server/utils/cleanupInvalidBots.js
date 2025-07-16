const mongoose = require('mongoose');
const CaseBattle = require('../models/CaseBattle');

async function cleanupInvalidBotUserIds() {
    try {
        console.log('Starting cleanup of invalid bot userIds...');
        
        const battlesWithInvalidBots = await CaseBattle.find({
            'players.userId': { $type: 'string', $regex: /^bot_/ }
        });
        
        console.log(`Found ${battlesWithInvalidBots.length} battles with invalid bot userIds`);
        
        for (const battle of battlesWithInvalidBots) {
            let hasInvalidBots = false;
            
            battle.players.forEach(player => {
                if (typeof player.userId === 'string' && player.userId.startsWith('bot_')) {
                    console.log(`Fixing invalid bot userId: ${player.userId} in battle ${battle.battleId}`);
                    player.userId = new mongoose.Types.ObjectId();
                    hasInvalidBots = true;
                }
            });
            
            if (hasInvalidBots) {
                await battle.save();
                console.log(`Fixed battle ${battle.battleId}`);
            }
        }
        
        console.log('Cleanup completed successfully');
        return battlesWithInvalidBots.length;
    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}

module.exports = { cleanupInvalidBotUserIds };

if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vestro')
        .then(() => {
            console.log('Connected to MongoDB');
            return cleanupInvalidBotUserIds();
        })
        .then((count) => {
            console.log(`Cleanup completed. Fixed ${count} battles.`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('Cleanup failed:', error);
            process.exit(1);
        });
}
