const express = require('express');
const User = require('../models/User');
const GameHistory = require('../models/GameHistory');
const { authenticateToken } = require('../middleware/auth');
const { getRandomNumber } = require('../utils/random');

const router = express.Router();

// Play a game
router.post('/play', authenticateToken, async (req, res) => {
    try {
        const { gameType, betAmount, playerChoice } = req.body;
        
        // Validation
        if (!gameType || !betAmount || !playerChoice) {
            return res.status(400).json({
                success: false,
                message: 'Game type, bet amount, and player choice are required'
            });
        }

        if (betAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Bet amount must be greater than 0'
            });
        }

        // Get user
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check balance
        if (user.balance < betAmount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        let gameResult;
        let won = false;
        let winAmount = 0;
        let multiplier = 1;

        // Play the game based on type
        if (gameType === 'coinflip') {
            const coin = await getRandomNumber(0, 1);
            gameResult = coin === 0 ? 'heads' : 'tails';
            won = gameResult === playerChoice.toLowerCase();
            multiplier = 2; // 2x payout for coin flip
        } else if (gameType === 'dice') {
            const dice = await getRandomNumber(1, 6);
            gameResult = dice.toString();
            
            if (playerChoice.toLowerCase() === 'higher') {
                won = dice >= 4; // 4, 5, 6
            } else if (playerChoice.toLowerCase() === 'lower') {
                won = dice <= 3; // 1, 2, 3
            }
            multiplier = 1.8; // 1.8x payout for dice
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type'
            });
        }

        // Calculate results
        const balanceBefore = user.balance;
        user.balance -= betAmount; // Deduct bet

        if (won) {
            winAmount = Math.floor(betAmount * multiplier);
            user.balance += winAmount;
        }

        // Add experience (5 XP for playing, +5 XP for winning)
        const experienceGained = won ? 10 : 5;
        const levelUpResult = user.addExperience(experienceGained);

        // Update game statistics
        user.updateGameStats(betAmount, won ? winAmount : 0);

        // Save user
        await user.save();

        // Save game history
        const gameHistory = new GameHistory({
            userId: user._id,
            gameType,
            betAmount,
            playerChoice: playerChoice.toLowerCase(),
            gameResult,
            won,
            winAmount: won ? winAmount : 0,
            balanceBefore,
            balanceAfter: user.balance,
            experienceGained,
            leveledUp: levelUpResult.leveledUp
        });
        await gameHistory.save();

        res.json({
            success: true,
            result: {
                gameType,
                playerChoice: playerChoice.toLowerCase(),
                gameResult,
                won,
                betAmount,
                winAmount: won ? winAmount : 0,
                experienceGained,
                levelUp: levelUpResult
            },
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Game play error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get game history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const history = await GameHistory.find({ userId: req.user.userId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await GameHistory.countDocuments({ userId: req.user.userId });

        res.json({
            success: true,
            history,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('Game history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router; 