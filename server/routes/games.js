const express = require('express');
const User = require('../models/User');
const Badge = require('../models/Badge');
const GameHistory = require('../models/GameHistory');
const { authenticateToken } = require('../middleware/auth');
const { getRandomNumber } = require('../utils/random');
const mongoose = require('mongoose');

const router = express.Router();

// Calculate mines multiplier based on mine count and revealed tiles
function calculateMinesMultiplier(mineCount, revealedTiles) {
    if (revealedTiles <= 0) return 1;
    
    const totalTiles = 25;
    const safeTiles = totalTiles - mineCount;
    
    // Calculate probability of revealing N safe tiles
    let multiplier = 1;
    for (let i = 0; i < revealedTiles; i++) {
        const remainingSafeTiles = safeTiles - i;
        const remainingTiles = totalTiles - i;
        const probability = remainingSafeTiles / remainingTiles;
        multiplier *= (1 / probability);
    }
    
    // Apply house edge (97% RTP)
    multiplier *= 0.97;
    
    return Math.max(multiplier, 0.01); // Minimum 0.01x multiplier
}

// Play a game
router.post('/play', authenticateToken, async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        
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

        // Get user with session
        const user = await User.findById(req.user.userId).session(session);
        if (!user) {
            throw new Error('User not found');
        }

        // Fix precision issues by rounding to 2 decimal places
        const userBalance = Math.round(user.balance * 100) / 100;
        const betAmountRounded = Math.round(betAmount * 100) / 100;

        // Check balance with small tolerance for floating point errors
        if (userBalance < betAmountRounded) {
            throw new Error('Insufficient balance');
        }

        // Deduct bet amount immediately for all games
        const startBalanceBefore = userBalance;
        const startNewBalance = Math.round((userBalance - betAmountRounded) * 100) / 100;
        user.balance = startNewBalance;
        await user.save({ session });

        // Create game history with session
        const gameHistory = new GameHistory({
            userId: req.user.userId,
            gameType,
            betAmount: betAmountRounded,
            playerChoice,
            gameResult: '{}',  // Will update after game logic
            won: false,
            balanceBefore: startBalanceBefore,
            balanceAfter: startNewBalance
        });
        
        // Save with session
        await gameHistory.save({ session });

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
            // Plinko game logic - generate outcome server-side
            const [risk, rows] = playerChoice.split('-');
            const rowCount = parseInt(rows);
            
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
            
            // Generate random bucket index using binomial distribution
            const bucketCount = rowCount + 1;
            let sum = 0;
            for (let i = 0; i < rowCount; i++) {
                sum += Math.random() < 0.5 ? 1 : 0;
            }
            const bucketIndex = Math.min(Math.max(sum, 0), bucketCount - 1);
            
            multiplier = validMultipliers[bucketIndex];
            // Always calculate win amount for any positive multiplier
            won = multiplier > 0;
            
            gameResult = {
                bucketIndex,
                multiplier,
                risk,
                rows: rowCount
            };
        } else if (gameType === 'mines') {
            // Mines game logic - generate minefield server-side
            const mineCount = parseInt(playerChoice) || 3; // Default to 3 mines
            
            // Generate random hash for provably fair
            const randomResult = await getRandomNumber(0, 1000000);
            randomHash = randomResult.hash;
            randomTimestamp = randomResult.timestamp;
            
            // Validate mine count (1-24 mines in 5x5 grid)
            if (mineCount < 1 || mineCount > 24) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid mine count (1-24)'
                });
            }
            
            // Generate minefield (5x5 = 25 tiles)
            const totalTiles = 25;
            const safeTiles = totalTiles - mineCount;
            
            // Create array of positions
            const positions = Array.from({ length: totalTiles }, (_, i) => i);
            
            // Fisher-Yates shuffle using the random result as seed
            let seed = randomResult.value;
            for (let i = positions.length - 1; i > 0; i--) {
                // Use a different part of the seed for each swap
                seed = (seed * 16807) % 2147483647; // Park-Miller LCG
                const j = seed % (i + 1);
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
            
            // Take first N positions as mines
            const mines = positions.slice(0, mineCount);

            // Create a grid state for client-side prediction
            const gridState = Array(25).fill(false);
            mines.forEach(mineIndex => {
                gridState[mineIndex] = true;
            });

            // Create a verification hash of the grid state
            const gridHash = require('crypto')
                .createHash('sha256')
                .update(JSON.stringify(gridState) + randomResult.hash)
                .digest('hex');
            
            gameResult = {
                mines,
                mineCount,
                multiplier: 1,
                revealedTiles: 0,
                betAmount: betAmountRounded,
                active: true,
                cashedOut: false,
                gridState: gridState, // Add grid state for client
                gridHash: gridHash, // Add verification hash
                revealedTilesMap: {} // Track which tiles have been revealed server-side
            };
            
            // Update game history with initial game state
            gameHistory.gameResult = JSON.stringify(gameResult);
            await gameHistory.save({ session });
            
            // Commit the transaction
            await session.commitTransaction();
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type'
            });
        }

        // Calculate results with proper precision
        const finalBalanceBefore = userBalance;
        let finalNewBalance = userBalance - betAmountRounded; // Deduct bet amount immediately

        // Calculate win amount for winning games or games with positive multiplier
        if (won || (gameType === 'plinko' && multiplier > 0)) {
            // Calculate win amount with proper precision
            const rawWinAmount = betAmountRounded * multiplier;
            winAmount = Math.round(rawWinAmount * 100) / 100;
            
            // For plinko: consider it a "win" if we get any money back
            if (gameType === 'plinko') {
                won = winAmount > 0;
                finalNewBalance = Math.round((finalNewBalance + winAmount) * 100) / 100;
            } else {
                finalNewBalance = Math.round((finalNewBalance + winAmount) * 100) / 100;
            }
        } else {
            finalNewBalance = Math.round(finalNewBalance * 100) / 100;
        }
        
        // For mines, don't mark as won or add win amount - this is handled in cashout
        if (gameType === 'mines') {
            won = false;
            winAmount = 0;
        }

        // Update user balance
        user.balance = finalNewBalance;
        
        // Initialize default values
        let experienceGained = 0;
        let levelUpResult = { leveledUp: false, levelsGained: 0 };
        
        // For mines, don't update stats until game ends
        if (gameType !== 'mines') {
            // Add experience (5 XP for playing, +5 XP for winning)
            experienceGained = won ? 10 : 5;
            levelUpResult = user.addExperience(experienceGained);

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
        } else {
            // For mines, just give 5 XP for starting the game
            experienceGained = 5;
            levelUpResult = user.addExperience(experienceGained);
        }

        // Save user
        await user.save({ session });

        // Clean up old game history (keep only last 30 games)
        const gameHistoryCount = await GameHistory.countDocuments({ userId: user._id });
        if (gameHistoryCount >= 30) {
            const oldGames = await GameHistory.find({ userId: user._id })
                .sort({ timestamp: 1 })
                .limit(gameHistoryCount - 29);
            
            const oldGameIds = oldGames.map(game => game._id);
            await GameHistory.deleteMany({ _id: { $in: oldGameIds } });
        }

        // For mines, don't save final game history until game ends
        if (gameType !== 'mines') {
            // Save game history
            gameHistory.won = won;
            gameHistory.winAmount = winAmount;
            gameHistory.balanceAfter = user.balance;
            gameHistory.experienceGained = experienceGained;
            gameHistory.leveledUp = levelUpResult.leveledUp;
            await gameHistory.save({ session });
        }

        // Send response
        res.json({
            success: true,
            result: {
                _id: gameHistory._id,
            gameType,
                playerChoice,
            gameResult,
            won,
                winAmount,
                balanceBefore: finalBalanceBefore,
                balanceAfter: finalNewBalance,
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
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error('Error aborting transaction:', abortError);
            }
        }
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    } finally {
        if (session) {
            try {
                session.endSession();
            } catch (endError) {
                console.error('Error ending session:', endError);
            }
        }
    }
});

// Mines tile reveal endpoint
router.post('/mines/reveal', authenticateToken, async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        
        const { gameId, tileIndex } = req.body;
        
        // Validation
        if (!gameId || tileIndex === undefined) {
            throw new Error('Game ID and tile index are required');
        }
        
        if (tileIndex < 0 || tileIndex > 24) {
            throw new Error('Invalid tile index (0-24)');
        }
        
        // Ensure gameId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
            throw new Error('Invalid game ID format');
        }
        
        // Get the game with session
        const gameHistory = await GameHistory.findOne({
            userId: req.user.userId,
            gameType: 'mines',
            _id: gameId
        }).session(session);
        
        if (!gameHistory) {
            throw new Error('Game not found');
        }
        
        // Parse game result
        const gameResult = JSON.parse(gameHistory.gameResult);
        const { mines, mineCount, active, cashedOut } = gameResult;
        
        console.log('🎯 Reveal Debug:', {
            gameId,
            tileIndex,
            active,
            cashedOut,
            gameHistoryWon: gameHistory.won,
            mines
        });
        
        // Check if game is still active
        if (!active || cashedOut) {
            throw new Error('Game is no longer active');
        }
        
        // Check if tile is a mine
        const hitMine = mines.includes(tileIndex);
        
        if (hitMine) {
            // Get user in the same transaction
            const user = await User.findById(req.user.userId).session(session);
            if (!user) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // No need for additional check - already verified game is active above
            
            // Update game state
            gameResult.active = false;
            gameResult.multiplier = 0;
            gameHistory.gameResult = JSON.stringify(gameResult);
            gameHistory.won = false;
            gameHistory.winAmount = 0;
            // Critical: Mark the current balance as final
            gameHistory.balanceAfter = user.balance;
            await gameHistory.save({ session });
            
            // Update user stats and balance history
            user.gamesPlayed += 1;
            user.totalWagered = Math.round((user.totalWagered + gameResult.betAmount) * 100) / 100;
            user.losses += 1;
            user.currentWinStreak = 0;
            user.balanceHistory.push(user.balance);
            await user.save({ session });
            
            // Commit transaction AFTER all updates
            await session.commitTransaction();
            
            res.json({
                success: true,
                result: {
                    tileIndex,
                    hitMine: true,
                    gameOver: true,
                    mines: mines,
                    multiplier: 0,
                    winAmount: 0,
                    balanceAfter: user.balance
                }
            });
        } else {
            // Safe tile - calculate new multiplier
            const revealedTiles = (gameResult.revealedTiles || 0) + 1;
            const newMultiplier = calculateMinesMultiplier(mineCount, revealedTiles);
            
            // Update game result
            gameResult.revealedTiles = revealedTiles;
            gameResult.multiplier = newMultiplier;
            gameHistory.gameResult = JSON.stringify(gameResult);
            await gameHistory.save({ session });
            
            // Calculate potential win amount (don't add to balance yet)
            const potentialWinAmount = Math.round(gameResult.betAmount * newMultiplier * 100) / 100;
            
            // Commit transaction
            await session.commitTransaction();
            
            res.json({
                success: true,
                result: {
                    tileIndex,
                    hitMine: false,
                    gameOver: false,
                    multiplier: newMultiplier,
                    revealedTiles: revealedTiles,
                    potentialWinAmount,
                    canCashOut: true
                }
            });
        }
        
    } catch (error) {
        console.error('Mines reveal error:', error);
        console.error('Error details:', {
            gameId: req.body.gameId,
            tileIndex: req.body.tileIndex,
            errorMessage: error.message,
            errorStack: error.stack
        });
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error('Error aborting transaction:', abortError);
            }
        }
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    } finally {
        if (session) {
            try {
                session.endSession();
            } catch (endError) {
                console.error('Error ending session:', endError);
            }
        }
    }
});

// Mines cash out endpoint
router.post('/mines/cashout', authenticateToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { gameId, revealedTiles, currentMultiplier } = req.body;
        
        if (!gameId || !revealedTiles || !currentMultiplier) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Game ID, revealed tiles, and current multiplier are required'
            });
        }
        
        // Get the game with session
        const gameHistory = await GameHistory.findOne({
            userId: req.user.userId,
            gameType: 'mines',
            _id: gameId
        }).session(session);
        
        if (!gameHistory) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Game not found'
            });
        }
        
        // Get user with session
        const user = await User.findById(req.user.userId).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Parse game result
        const gameResult = JSON.parse(gameHistory.gameResult);
        const { active, cashedOut, betAmount, mines, mineCount, gridState } = gameResult;
        
        // Check if game can be cashed out
        if (!active || cashedOut) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Game cannot be cashed out'
            });
        }
        
        // Validate revealed tiles against mines
        for (const tileIndex of revealedTiles) {
            if (mines.includes(tileIndex)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Invalid game state: revealed tile contains a mine'
                });
            }
        }
        
        // Calculate and validate multiplier
        const expectedMultiplier = calculateMinesMultiplier(mineCount, revealedTiles.length);
        const multiplierDifference = Math.abs(expectedMultiplier - currentMultiplier);
        
        if (multiplierDifference > 0.01) { // Allow small floating point differences
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Invalid multiplier'
            });
        }
        
        console.log('💰 Cashout Debug:', {
            gameId,
            currentMultiplier,
            expectedMultiplier,
            revealedTilesCount: revealedTiles.length,
            betAmount,
            active,
            cashedOut
        });
        
        // Use the validated multiplier
        const multiplier = expectedMultiplier;
        
        // Calculate win amount (multiplier includes the bet)
        const winAmount = Math.round(betAmount * multiplier * 100) / 100;
        console.log('💰 Win amount calculation:', { betAmount, multiplier, winAmount });
        
        // Update user balance (add win amount, bet amount was already deducted at game start)
        const newBalance = Math.round((user.balance + winAmount) * 100) / 100;
        user.balance = newBalance;
        user.balanceHistory.push(newBalance);
        
        // Update stats - now properly update game stats
        user.gamesPlayed += 1;
        user.totalWagered = Math.round((user.totalWagered + betAmount) * 100) / 100;
        user.wins += 1;
        user.totalWon = Math.round((user.totalWon + (winAmount - betAmount)) * 100) / 100;
        user.currentWinStreak += 1;
        user.bestWinStreak = Math.max(user.bestWinStreak, user.currentWinStreak);
        
        if (winAmount > user.bestWin) {
            user.bestWin = winAmount;
        }
        
        // Add experience for winning
        const experienceGained = 10;
        const levelUpResult = user.addExperience(experienceGained);
        
        await user.save({ session });
        
        // Update game history - only update when game actually ends
        gameResult.active = false;
        gameResult.cashedOut = true;
        gameResult.multiplier = multiplier;
        gameResult.revealedTiles = revealedTiles.length;
        gameHistory.gameResult = JSON.stringify(gameResult);
        gameHistory.won = true;
        gameHistory.winAmount = winAmount;
        gameHistory.balanceAfter = newBalance;
        gameHistory.experienceGained = experienceGained;
        gameHistory.leveledUp = levelUpResult.leveledUp;
        await gameHistory.save({ session });
        
        // Commit transaction
        await session.commitTransaction();

        res.json({
            success: true,
            result: {
                winAmount,
                multiplier,
                balanceAfter: newBalance,
                experienceGained,
                leveledUp: levelUpResult.leveledUp,
                levelsGained: levelUpResult.levelsGained,
                newLevel: user.level
            }
        });

    } catch (error) {
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error('Error aborting transaction:', abortError);
            }
        }
        console.error('Mines cashout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    } finally {
        if (session) {
            try {
                session.endSession();
            } catch (endError) {
                console.error('Error ending session:', endError);
            }
        }
    }
});

// Mines verify endpoint removed - now using reveal and cashout endpoints directly

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