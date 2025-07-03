const express = require('express');
const User = require('../models/User');
const Badge = require('../models/Badge');
const GameHistory = require('../models/GameHistory');
const { authenticateToken } = require('../middleware/auth');
const { getRandomNumber } = require('../utils/random');

const router = express.Router();

// Play a game
router.post('/play', authenticateToken, async (req, res) => {
    try {
        const { gameType, betAmount, playerChoice, targetNumber } = req.body;
        
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
            // Generate a random number between 0 and 100 with 2 decimal places
            const roll = Math.round((await getRandomNumber(0, 10000)) / 100);
            gameResult = roll.toFixed(2);
            
            if (playerChoice === 'higher') {
                won = roll > targetNumber;
                // Calculate multiplier (99% RTP)
                multiplier = 0.99 / ((100 - targetNumber) / 100);
            } else if (playerChoice === 'lower') {
                won = roll < targetNumber;
                // Calculate multiplier (99% RTP)
                multiplier = 0.99 / (targetNumber / 100);
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type'
            });
        }

        // Calculate results
        const balanceBefore = user.balance;
        user.balance -= betAmount; // Deduct bet
        user.balanceHistory.push(user.balance); // Add balance after bet

        if (won) {
            // Calculate raw win amount
            const rawWinAmount = betAmount * multiplier;
            // Split into dollars and cents
            const dollars = Math.floor(rawWinAmount);
            const cents = (rawWinAmount - dollars) * 100;
            // Only round up cents if they exist
            winAmount = dollars + (cents > 0 ? Math.ceil(cents) : Math.round(cents)) / 100;
            
            user.balance += winAmount;
            user.balanceHistory.push(user.balance); // Add balance after win
        }

        // Add experience (5 XP for playing, +5 XP for winning)
        const experienceGained = won ? 10 : 5;
        const levelUpResult = user.addExperience(experienceGained);

        // Update game statistics and check for badges
        const earnedBadges = await user.updateGameStats(betAmount, won ? winAmount : 0);

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

        // Populate badge details
        if (earnedBadges.length > 0) {
            await User.populate(user, {
                path: 'badges.badgeId',
                model: 'Badge'
            });
        }

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
                levelUp: levelUpResult,
                earnedBadges: earnedBadges.map(badge => ({
                    name: badge.name,
                    description: badge.description,
                    icon: badge.icon,
                    color: badge.color,
                    secret: badge.secret
                }))
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