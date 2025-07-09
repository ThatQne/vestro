const mongoose = require('mongoose');

// Utility function to handle transaction operations
async function withTransaction(operation) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const result = await operation(session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

// Utility function to round to 2 decimal places
function roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
}

// Utility function to update user stats for completed games
function updateUserStats(user, won, betAmount, winAmount) {
    user.gamesPlayed += 1;
    user.totalWagered = roundToTwoDecimals(user.totalWagered + betAmount);
    
    if (won) {
        user.wins += 1;
        user.totalWon = roundToTwoDecimals(user.totalWon + winAmount);
        user.currentWinStreak += 1;
        user.bestWinStreak = Math.max(user.bestWinStreak, user.currentWinStreak);
        
        if (winAmount > user.bestWin) {
            user.bestWin = winAmount;
        }
    } else {
        user.losses += 1;
        user.currentWinStreak = 0;
    }
}

// Utility function to add experience and check for level up
function addExperienceToUser(user, won) {
    const experienceGained = won ? 10 : 5;
    const levelUpResult = user.addExperience(experienceGained);
    return { experienceGained, levelUpResult };
}

// Utility function to clean up old game history
async function cleanupOldGameHistory(userId, maxGames = 30) {
    const GameHistory = require('../models/GameHistory');
    
    const gameHistoryCount = await GameHistory.countDocuments({ userId });
    if (gameHistoryCount >= maxGames) {
        const oldGames = await GameHistory.find({ userId })
            .sort({ timestamp: 1 })
            .limit(gameHistoryCount - (maxGames - 1));
        
        const oldGameIds = oldGames.map(game => game._id);
        await GameHistory.deleteMany({ _id: { $in: oldGameIds } });
    }
}

// Utility function to validate basic game parameters
function validateGameParams(gameType, betAmount, playerChoice) {
    if (!gameType || !betAmount || !playerChoice) {
        throw new Error('Game type, bet amount, and player choice are required');
    }
    
    if (betAmount <= 0) {
        throw new Error('Bet amount must be greater than 0');
    }
}

// Utility function to check user balance
function validateUserBalance(user, betAmount) {
    const userBalance = roundToTwoDecimals(user.balance);
    const betAmountRounded = roundToTwoDecimals(betAmount);
    
    if (userBalance < betAmountRounded) {
        throw new Error('Insufficient balance');
    }
    
    return { userBalance, betAmountRounded };
}

module.exports = {
    withTransaction,
    roundToTwoDecimals,
    updateUserStats,
    addExperienceToUser,
    cleanupOldGameHistory,
    validateGameParams,
    validateUserBalance
}; 