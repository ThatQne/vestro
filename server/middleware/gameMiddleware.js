const { updateUserBalance, completeGameProcessing, emitLiveGameEvent } = require('../utils/gameUtils');
const User = require('../models/User');

function handleGameCompletion(gameType) {
    return async (req, res, next) => {
        const { won, betAmount, winAmount } = req.gameResult;
        
        try {
            if (won && winAmount > 0) {
                updateUserBalance(req.sessionUser, winAmount);
            }
            
            const { earnedBadges, experienceGained, levelUpResult } = 
                await completeGameProcessing(req.sessionUser, won, betAmount, winAmount, req.session);
            
            const io = req.app.get('io');
            const socketUser = await User.findById(req.user.userId, { username: 1 });
            emitLiveGameEvent(io, socketUser, gameType, won ? winAmount : betAmount, won);
            
            req.completionResult = { earnedBadges, experienceGained, levelUpResult };
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = { handleGameCompletion };
