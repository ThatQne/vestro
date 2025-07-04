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

        let gameResult;
        let won = false;
        let winAmount = 0;
        let multiplier = 1;
        let randomHash = null;
        let randomTimestamp = null;

        // Play the game based on type
        if (gameType === 'coinflip') {
            const randomResult = await getRandomNumber(0, 1);
            gameResult = randomResult.value === 0 ? 'heads' : 'tails';
            won = gameResult === playerChoice.toLowerCase();
            multiplier = 2; // 2x payout for coin flip
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
        } else if (gameType === 'dice') {
            // Generate a random number between 0 and 10000 for precision
            const randomResult = await getRandomNumber(0, 10000);
            const roll = randomResult.value / 100; // Convert to 0-100 with 2 decimal places
            gameResult = roll.toFixed(2);
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
            
            if (playerChoice === 'higher') {
                won = roll > targetNumber;
                // Calculate multiplier (99% RTP)
                multiplier = 0.99 / ((100 - targetNumber) / 100);
            } else if (playerChoice === 'lower') {
                won = roll < targetNumber;
                // Calculate multiplier (99% RTP)
                multiplier = 0.99 / (targetNumber / 100);
            }
        } else if (gameType === 'plinko') {
            // Plinko game logic
            const [risk, rows] = playerChoice.split('-');
            const rowCount = parseInt(rows);
            const bucketIndex = parseInt(targetNumber);
            const clientMultiplier = req.body.multiplier; // Get multiplier from request body
            
            // Generate random hash for provably fair
            const randomResult = await getRandomNumber(0, 1000000);
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
            
            // Validate plinko parameters
            if (!['low', 'medium', 'high'].includes(risk)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid risk level'
                });
            }
            
            if (![8, 12, 16].includes(rowCount)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid row count'
                });
            }
            
            // Plinko multiplier tables
            const plinkoMultipliers = {
                low: {
                    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
                    12: [8.1, 3.0, 1.6, 1.0, 0.7, 0.7, 0.5, 0.7, 0.7, 1.0, 1.6, 3.0, 8.1],
                    16: [16.0, 9.0, 2.0, 1.4, 1.1, 1.0, 0.5, 0.3, 0.5, 0.3, 0.5, 1.0, 1.1, 1.4, 2.0, 9.0, 16.0]
                },
                medium: {
                    8: [13.0, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13.0],
                    12: [24.0, 5.0, 2.0, 1.4, 0.6, 0.4, 0.2, 0.4, 0.6, 1.4, 2.0, 5.0, 24.0],
                    16: [110.0, 41.0, 10.0, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10.0, 41.0, 110.0]
                },
                high: {
                    8: [29.0, 4.0, 1.5, 0.2, 0.2, 0.2, 1.5, 4.0, 29.0],
                    12: [58.0, 8.0, 2.5, 1.0, 0.2, 0.2, 0.1, 0.2, 0.2, 1.0, 2.5, 8.0, 58.0],
                    16: [1000.0, 130.0, 26.0, 9.0, 4.0, 2.0, 0.7, 0.2, 0.1, 0.2, 0.7, 2.0, 4.0, 9.0, 26.0, 130.0, 1000.0]
                }
            };
            
            const validMultipliers = plinkoMultipliers[risk][rowCount];
            
            if (!validMultipliers || bucketIndex < 0 || bucketIndex >= validMultipliers.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid bucket index'
                });
            }
            
            const expectedMultiplier = validMultipliers[bucketIndex];
            
            // Validate multiplier matches expected value (with some tolerance for floating point)
            if (Math.abs(clientMultiplier - expectedMultiplier) > 0.01) {
                console.log('Multiplier validation failed:', {
                    client: clientMultiplier,
                    expected: expectedMultiplier,
                    bucketIndex,
                    risk,
                    rows: rowCount
                });
                return res.status(400).json({
                    success: false,
                    message: 'Invalid multiplier for bucket',
                    debug: {
                        clientMultiplier,
                        expectedMultiplier,
                        bucketIndex,
                        risk,
                        rows: rowCount
                    }
                });
            }
            
            // Use the expected multiplier for calculations to avoid any precision issues
            multiplier = expectedMultiplier;
            won = multiplier > 1;
            
            const actualWinAmount = Math.round(betAmount * multiplier * 100) / 100;
            
            gameResult = {
                bucketIndex,
                multiplier,
                risk,
                rows: rowCount,
                won,
                winAmount: won ? actualWinAmount : 0,
                balanceAfter: won ? user.balance - betAmount + actualWinAmount : user.balance - betAmount,
                hash: randomHash,
                timestamp: new Date().toISOString()
            };
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type'
            });
        }

        // Calculate results with proper precision
        const balanceBefore = userBalance;
        let newBalance = userBalance - betAmountRounded;

        if (won) {
            // Calculate win amount with proper precision
            const rawWinAmount = betAmountRounded * multiplier;
            winAmount = Math.round(rawWinAmount * 100) / 100;
            newBalance = Math.round((newBalance + winAmount) * 100) / 100;
        } else {
            newBalance = Math.round(newBalance * 100) / 100;
        }

        // Update user balance
        user.balance = newBalance;
        
        // Only add final balance to history after all calculations are done
        user.balanceHistory.push(user.balance);

        // Add experience (5 XP for playing, +5 XP for winning)
        const experienceGained = won ? 10 : 5;
        const levelUpResult = user.addExperience(experienceGained);

        // Update game statistics but don't check badges (they're client-side now)
        user.gamesPlayed += 1;
        user.totalWagered = Math.round((user.totalWagered + betAmountRounded) * 100) / 100;
        
        if (won) {
            user.wins += 1;
            user.totalWon = Math.round((user.totalWon + winAmount) * 100) / 100;
            user.currentWinStreak += 1;
            user.bestWinStreak = Math.max(user.bestWinStreak, user.currentWinStreak);
            
            if (winAmount > user.bestWin) {
                user.bestWin = winAmount;
            }
        } else {
            user.losses += 1;
            user.currentWinStreak = 0;
        }

        // Save user
        await user.save();

        // Clean up old game history (keep only last 30 games)
        const gameHistoryCount = await GameHistory.countDocuments({ userId: user._id });
        if (gameHistoryCount >= 30) {
            const oldGames = await GameHistory.find({ userId: user._id })
                .sort({ timestamp: 1 })
                .limit(gameHistoryCount - 29);
            
            const oldGameIds = oldGames.map(game => game._id);
            await GameHistory.deleteMany({ _id: { $in: oldGameIds } });
        }

        // Save game history
        const gameHistory = new GameHistory({
            userId: user._id,
            gameType,
            betAmount: betAmountRounded,
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

        // Send response
        res.json({
            success: true,
            result: {
                gameType,
                playerChoice: playerChoice.toLowerCase(),
                gameResult,
                won,
                winAmount: won ? winAmount : 0,
                balanceBefore,
                balanceAfter: user.balance,
                experienceGained,
                leveledUp: levelUpResult.leveledUp,
                levelsGained: levelUpResult.levelsGained,
                newLevel: user.level,
                randomHash,
                randomTimestamp
            }
        });
    } catch (error) {
        console.error('Play game error:', error);
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