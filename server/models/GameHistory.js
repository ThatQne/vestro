const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['coinflip', 'dice', 'roulette', 'blackjack', 'plinko', 'mines', 'limbo']
    },
    betAmount: {
        type: Number,
        required: true,
        min: 0
    },
    playerChoice: {
        type: String,
        required: true
    },
    gameResult: {
        type: String,
        required: true
    },
    won: {
        type: Boolean,
        required: true
    },
    winAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    experienceGained: {
        type: Number,
        default: 0
    },
    leveledUp: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
gameHistorySchema.index({ userId: 1, timestamp: -1 });
gameHistorySchema.index({ gameType: 1 });

module.exports = mongoose.model('GameHistory', gameHistorySchema); 