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

        // Fix precision issues by rounding to 2 decimal places
        const userBalance = Math.round(user.balance * 100) / 100;
        const betAmountRounded = Math.round(betAmount * 100) / 100;

        // Check balance with small tolerance for floating point errors
        if (userBalance < betAmountRounded) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance',
                debug: {
                    userBalance: userBalance,
                    betAmount: betAmountRounded,
                    difference: userBalance - betAmountRounded
                }
            });
        }

        let gameResult = {};
        let won = false;
        let winAmount = 0;
        let multiplier = 1;
        let randomHash = null;
        let randomTimestamp = null;

        // Generate random hash for provably fair gaming
        if (gameType === 'coinflip') {
            // Coinflip specific random generation
            const randomResult = await getRandomNumber(0, 1);
            gameResult = randomResult.value === 0 ? 'heads' : 'tails';
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
        } else if (gameType === 'dice') {
            // Dice game logic
            const randomResult = await getRandomNumber(1, 100);
            const randomNumber = randomResult.value;
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
            
            let won = false;
            let multiplier = 1;
            
            if (playerChoice === 'over') {
                won = randomNumber > targetNumber;
                multiplier = won ? (99 / (99 - targetNumber)) : 0;
            } else if (playerChoice === 'under') {
                won = randomNumber < targetNumber;
                multiplier = won ? (99 / (targetNumber - 1)) : 0;
            }
            
            gameResult = {
                won,
                randomNumber,
                multiplier: Math.round(multiplier * 100) / 100,
                winAmount: won ? Math.round(betAmount * multiplier * 100) / 100 : 0
            };
        } else if (gameType === 'plinko') {
            // Plinko game logic with random hash
            const { rows, risk } = req.body;
            
            if (!rows || !risk || ![8, 10, 12, 14, 16].includes(rows) || !['low', 'medium', 'high'].includes(risk)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Plinko configuration'
                });
            }
            
            // Generate random seed for ball path
            const randomResult = await getRandomNumber(0, 1000000);
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
            
            // Use random seed to determine ball path
            const seed = randomResult.value;
            
            // Define multipliers
            const plinkoMultipliers = {
                8: {
                    low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
                    medium: [13, 3, 1.3, 0.7, 0.7, 0.7, 0.7, 1.3, 3, 13],
                    high: [29, 4, 1.5, 0.3, 0.2, 0.2, 0.3, 1.5, 4, 29]
                },
                10: {
                    low: [8.9, 3, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3, 8.9],
                    medium: [22, 4, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 4, 22],
                    high: [43, 7, 2, 1.1, 1.0, 0.2, 1.0, 1.1, 2, 7, 43]
                },
                12: {
                    low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
                    medium: [33, 5, 2, 1.5, 1.1, 1.0, 0.5, 1.0, 1.1, 1.5, 2, 5, 33],
                    high: [58, 9, 3, 1.3, 1.0, 0.7, 0.2, 0.7, 1.0, 1.3, 3, 9, 58]
                },
                14: {
                    low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
                    medium: [18, 5, 2.1, 1.6, 1.4, 1.2, 1.0, 0.5, 1.0, 1.2, 1.4, 1.6, 2.1, 5, 18],
                    high: [110, 13, 3, 1.9, 1.2, 0.9, 0.7, 0.2, 0.7, 0.9, 1.2, 1.9, 3, 13, 110]
                },
                16: {
                    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
                    medium: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
                    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
                }
            };
            
            const multipliers = plinkoMultipliers[rows][risk];
            
            // Generate ball path using seeded random
            const path = [];
            let position = 0; // Start at center
            let currentSeed = seed;
            
            // Generate path through pegs
            for (let row = 0; row < rows; row++) {
                // Add position for this row
                path.push({
                    x: 50 + (position * 3), // Convert to percentage
                    y: ((row + 1) * 80) / rows // Convert to percentage
                });
                
                // Use seeded random to determine direction
                currentSeed = (currentSeed * 9301 + 49297) % 233280;
                const normalized = currentSeed / 233280;
                
                if (normalized < 0.5) {
                    position -= 1; // Go left
                } else {
                    position += 1; // Go right
                }
            }
            
            // Calculate final multiplier index
            const centerIndex = Math.floor(multipliers.length / 2);
            const multiplierIndex = Math.max(0, Math.min(multipliers.length - 1, centerIndex + position));
            const multiplier = multipliers[multiplierIndex];
            
            const won = multiplier > 0;
            const winAmount = won ? Math.round(betAmount * multiplier * 100) / 100 : 0;
            
            gameResult = {
                won,
                multiplier,
                multiplierIndex,
                path,
                winAmount
            };
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type'
            });
        }

        // Calculate win amount and new balance
        const won = gameResult.won || (gameType === 'coinflip' && gameResult === playerChoice);
        const winAmount = gameResult.winAmount || (won && gameType === 'coinflip' ? betAmount * 2 : 0);
        
        // Update balance
        let newBalance = Math.round((user.balance - betAmount) * 100) / 100;
        
        if (won) {
            newBalance = Math.round((newBalance + winAmount) * 100) / 100;
        } else {
            // Loss handling
        }

        // Save user with new balance
        user.balance = newBalance;
        await user.save();

        // Add to game history
        const gameHistory = new GameHistory({
            userId: user._id,
            gameType,
            betAmount,
            winAmount: won ? winAmount : 0,
            multiplier: gameResult.multiplier || (gameType === 'coinflip' ? 2 : 1),
            result: gameResult,
            timestamp: new Date()
        });
        await gameHistory.save();

        // Limit game history to last 30 games
        const gameHistoryCount = await GameHistory.countDocuments({ userId: user._id });
        if (gameHistoryCount > 30) {
            const oldestGames = await GameHistory.find({ userId: user._id })
                .sort({ timestamp: 1 })
                .limit(gameHistoryCount - 30);
            
            await GameHistory.deleteMany({
                _id: { $in: oldestGames.map(g => g._id) }
            });
        }

        // Calculate experience and level
        const experienceGained = Math.floor(betAmount * 0.1); // 10% of bet amount as XP
        user.experience += experienceGained;
        
        // Level up calculation
        const newLevel = Math.floor(user.experience / 100) + 1;
        const leveledUp = newLevel > user.level;
        const levelsGained = leveledUp ? newLevel - user.level : 0;
        
        if (leveledUp) {
            user.level = newLevel;
        }
        
        await user.save();

        // Update balance history
        if (!user.balanceHistory) {
            user.balanceHistory = [];
        }
        user.balanceHistory.push(user.balance);
        if (user.balanceHistory.length > 100) {
            user.balanceHistory = user.balanceHistory.slice(-100);
        }
        await user.save();

        // Prepare response
        const response = {
            success: true,
            result: {
                won,
                winAmount: won ? winAmount : 0,
                balanceBefore: user.balance - (won ? winAmount : 0) + betAmount,
                balanceAfter: user.balance,
                experienceGained,
                leveledUp,
                levelsGained,
                newLevel,
                hash: randomHash,
                timestamp: randomTimestamp,
                ...gameResult
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Game play error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error occurred'
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

// Get all badges
router.get('/badges', authenticateToken, async (req, res) => {
    try {
        const badges = await Badge.find();
        res.json({
            success: true,
            badges
        });
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router; 