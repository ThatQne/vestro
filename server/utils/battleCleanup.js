const CaseBattle = require('../models/CaseBattle');

async function cleanupBattles() {
    try {
        const now = new Date();
        
        const expiredBattles = await CaseBattle.find({
            status: 'waiting',
            expiresAt: { $lt: now }
        });
        
        for (const battle of expiredBattles) {
            await battle.cancel();
            console.log(`Cancelled expired battle: ${battle.battleId}`);
        }
        
        const pastViewingPeriod = await CaseBattle.find({
            status: 'completed',
            viewingPeriodEndsAt: { $lt: now, $ne: null }
        });
        
        console.log(`Found ${pastViewingPeriod.length} battles past viewing period`);
    } catch (error) {
        console.error('Error in battle cleanup job:', error);
    }
}

module.exports = { cleanupBattles };
