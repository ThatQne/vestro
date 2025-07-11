const express = require('express');
const User = require('../models/User');
const Badge = require('../models/Badge');
const GameHistory = require('../models/GameHistory');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');

// Import game handlers
const { handleCoinflip } = require('../utils/gameHandlers/coinflip');
const { handleDice } = require('../utils/gameHandlers/dice');
const { handlePlinko } = require('../utils/gameHandlers/plinko');
const { handleMines, calculateMinesMultiplier } = require('../utils/gameHandlers/mines');
const { dealBlackjack, hitBlackjack, standBlackjack, doubleBlackjack } = require('../utils/gameHandlers/blackjack');

// Import utilities
const {
    withTransaction,
    roundToTwoDecimals,
    updateUserStats,
    addExperienceToUser,
    cleanupOldGameHistory,
    validateGameParams,
    validateUserBalance
} = require('../utils/gameUtils');

const router = express.Router();

// Game handlers map
const GAME_HANDLERS = {
    coinflip: handleCoinflip,
    dice: handleDice,
    plinko: handlePlinko,
    mines: handleMines
};

// Play a game
router.post('/play', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
            const { gameType, betAmount, playerChoice, targetNumber } = req.body;
            
            // Validate basic parameters
            validateGameParams(gameType, betAmount, playerChoice);
            
            // Validate game type
            if (!GAME_HANDLERS[gameType]) {
                throw new Error('Invalid game type');
        }

        // Get user with session
        const user = await User.findById(req.user.userId).session(session);
        if (!user) {
                throw new Error('User not found');
            }
            
            // Validate balance and get rounded amounts
            const { userBalance, betAmountRounded } = validateUserBalance(user, betAmount);
            
            // Deduct bet amount immediately
            const balanceBefore = userBalance;
            const balanceAfter = roundToTwoDecimals(userBalance - betAmountRounded);
            user.balance = balanceAfter;
        await user.save({ session });

            // Create initial game history
        const gameHistory = new GameHistory({
            userId: req.user.userId,
            gameType,
            betAmount: betAmountRounded,
            playerChoice,
                gameResult: '{}',
            won: false,
                balanceBefore,
                balanceAfter
        });
        await gameHistory.save({ session });
            
            // Handle game logic based on type
            let gameResult, won, multiplier, randomHash, randomTimestamp;
            
            if (gameType === 'dice') {
                const result = await handleDice(playerChoice, targetNumber);
                ({ gameResult, won, multiplier, randomHash, randomTimestamp } = result);
            } else if (gameType === 'mines') {
                const result = await handleMines(playerChoice, betAmountRounded);
                ({ gameResult, won, multiplier, randomHash, randomTimestamp } = result);
                
                // For mines, save initial state and return early
                gameHistory.gameResult = JSON.stringify(gameResult);
                await gameHistory.save({ session });
                
                return {
                    gameHistory,
                    gameResult,
                    won,
                    winAmount: 0,
                    balanceBefore,
                    balanceAfter,
                    experienceGained: 5,
                    levelUpResult: user.addExperience(5),
                    newLevel: user.level,
                    randomHash,
                    randomTimestamp
                };
            } else {
                const handler = GAME_HANDLERS[gameType];
                const result = await handler(playerChoice);
                ({ gameResult, won, multiplier, randomHash, randomTimestamp } = result);
            }
            
            // Calculate win amount and final balance
            let winAmount = 0;
            let finalBalance = balanceAfter;
            
            if (won || (gameType === 'plinko' && multiplier > 0)) {
                winAmount = roundToTwoDecimals(betAmountRounded * multiplier);
                
                if (gameType === 'plinko') {
                    won = winAmount > 0;
                }
                
                finalBalance = roundToTwoDecimals(balanceAfter + winAmount);
                user.balance = finalBalance;
            }
            
            // Update user stats and check for badges
            const earnedBadges = await user.updateGameStats(won, betAmountRounded, winAmount);
            const { experienceGained, levelUpResult } = addExperienceToUser(user, won);
            
            // Update balance history
            user.balanceHistory.push(finalBalance);
            await user.save({ session });
            
            // Clean up old game history
            await cleanupOldGameHistory(user._id);
            
            // Update and save game history
            gameHistory.gameResult = JSON.stringify(gameResult);
        gameHistory.won = won;
        gameHistory.winAmount = winAmount;
            gameHistory.balanceAfter = finalBalance;
        gameHistory.experienceGained = experienceGained;
        gameHistory.leveledUp = levelUpResult.leveledUp;
        await gameHistory.save({ session });

            return {
                gameHistory,
            gameResult,
            won,
                winAmount,
                balanceBefore,
                balanceAfter: finalBalance,
            experienceGained,
                levelUpResult,
                newLevel: user.level,
                randomHash,
                randomTimestamp,
                earnedBadges
            };
        });
        
        // Emit live game event to all connected clients
        const io = req.app.get('io');
        if (io) {
            // Get user for username
            const user = await User.findById(req.user.userId, { username: 1 });
            if (user) {
                io.emit('live-game', {
                    username: user.username,
                    game: req.body.gameType,
                    amount: result.won ? result.winAmount : req.body.betAmount,
                    won: result.won,
                    timestamp: Date.now()
                });
            }
        }
        
        // Send response
        res.json({
            success: true,
            result: {
                _id: result.gameHistory._id,
                gameType: req.body.gameType,
                playerChoice: req.body.playerChoice,
                gameResult: result.gameResult,
                won: result.won,
                winAmount: result.winAmount,
                balanceBefore: result.balanceBefore,
                balanceAfter: result.balanceAfter,
                experienceGained: result.experienceGained,
                leveledUp: result.levelUpResult.leveledUp,
                levelsGained: result.levelUpResult.levelsGained,
                newLevel: result.newLevel,
                randomHash: result.randomHash,
                randomTimestamp: result.randomTimestamp,
                earnedBadges: result.earnedBadges
            }
        });
        
    } catch (error) {
        console.error('Play game error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

// Mines tile reveal endpoint
router.post('/mines/reveal', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
        const { gameId, tileIndex } = req.body;
        
        // Validation
        if (!gameId || tileIndex === undefined) {
                throw new Error('Game ID and tile index are required');
        }
        
        if (tileIndex < 0 || tileIndex > 24) {
                throw new Error('Invalid tile index (0-24)');
        }
        
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
                throw new Error('Invalid game ID format');
        }
        
            // Get game and user
        const gameHistory = await GameHistory.findOne({
            userId: req.user.userId,
            gameType: 'mines',
            _id: gameId
        }).session(session);
        
        if (!gameHistory) {
                throw new Error('Game not found');
            }
            
            const user = await User.findById(req.user.userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Parse and validate game state
        const gameResult = JSON.parse(gameHistory.gameResult);
        const { mines, mineCount, active, cashedOut } = gameResult;
        
        if (!active || cashedOut) {
                throw new Error('Game is no longer active');
        }
        
        // Check if tile is a mine
        const hitMine = mines.includes(tileIndex);
        
        if (hitMine) {
                // Game over - update everything
            gameResult.active = false;
            gameResult.multiplier = 0;
            gameHistory.gameResult = JSON.stringify(gameResult);
            gameHistory.won = false;
            gameHistory.winAmount = 0;
            gameHistory.balanceAfter = user.balance;
            await gameHistory.save({ session });
            
            // Update user stats and check for badges
                const earnedBadges = await user.updateGameStats(false, gameResult.betAmount, 0);
            user.balanceHistory.push(user.balance);
            await user.save({ session });
            
                return {
                    tileIndex,
                    hitMine: true,
                    gameOver: true,
                    mines,
                    multiplier: 0,
                    winAmount: 0,
                    balanceAfter: user.balance
                };
        } else {
                // Safe tile - update multiplier
            const revealedTiles = (gameResult.revealedTiles || 0) + 1;
            const newMultiplier = calculateMinesMultiplier(mineCount, revealedTiles);
            
            gameResult.revealedTiles = revealedTiles;
            gameResult.multiplier = newMultiplier;
            gameHistory.gameResult = JSON.stringify(gameResult);
            await gameHistory.save({ session });
            
                const potentialWinAmount = roundToTwoDecimals(gameResult.betAmount * newMultiplier);
                
                return {
                    tileIndex,
                    hitMine: false,
                    gameOver: false,
                    multiplier: newMultiplier,
                    revealedTiles,
                    potentialWinAmount,
                    canCashOut: true
                };
                }
            });
        
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Mines reveal error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

// Mines cash out endpoint
router.post('/mines/cashout', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
            const { gameId, revealedTiles, currentMultiplier } = req.body;
            
            if (!gameId || !revealedTiles || !currentMultiplier) {
                throw new Error('Game ID, revealed tiles, and current multiplier are required');
            }
            
            // Get game and user
        const gameHistory = await GameHistory.findOne({
            userId: req.user.userId,
            gameType: 'mines',
            _id: gameId
        }).session(session);
        
        if (!gameHistory) {
                throw new Error('Game not found');
            }
            
        const user = await User.findById(req.user.userId).session(session);
        if (!user) {
                throw new Error('User not found');
            }
            
            // Parse and validate game state
        const gameResult = JSON.parse(gameHistory.gameResult);
            const { active, cashedOut, betAmount, mines, mineCount } = gameResult;
        
        if (!active || cashedOut) {
                throw new Error('Game cannot be cashed out');
            }
            
            // Validate revealed tiles don't contain mines
            for (const tileIndex of revealedTiles) {
                if (mines.includes(tileIndex)) {
                    throw new Error('Invalid game state: revealed tile contains a mine');
                }
            }
            
            // Validate multiplier
            const expectedMultiplier = calculateMinesMultiplier(mineCount, revealedTiles.length);
            if (Math.abs(expectedMultiplier - currentMultiplier) > 0.01) {
                throw new Error('Invalid multiplier');
            }
            
            // Calculate win amount and update balance
            const winAmount = roundToTwoDecimals(betAmount * expectedMultiplier);
            const newBalance = roundToTwoDecimals(user.balance + winAmount);
        user.balance = newBalance;
        user.balanceHistory.push(newBalance);
        
            // Update user stats and check for badges
            const earnedBadges = await user.updateGameStats(true, betAmount, winAmount);
            const { experienceGained, levelUpResult } = addExperienceToUser(user, true);
        await user.save({ session });
        
        // Update game history
        gameResult.active = false;
        gameResult.cashedOut = true;
            gameResult.multiplier = expectedMultiplier;
            gameResult.revealedTiles = revealedTiles.length;
        gameHistory.gameResult = JSON.stringify(gameResult);
        gameHistory.won = true;
        gameHistory.winAmount = winAmount;
        gameHistory.balanceAfter = newBalance;
        gameHistory.experienceGained = experienceGained;
        gameHistory.leveledUp = levelUpResult.leveledUp;
        await gameHistory.save({ session });
        
            return {
                winAmount,
                multiplier: expectedMultiplier,
                balanceAfter: newBalance,
                experienceGained,
                levelUpResult,
                newLevel: user.level,
                earnedBadges
            };
        });

        // Emit live game event for mines cashout
        const io = req.app.get('io');
        if (io) {
            const user = await User.findById(req.user.userId, { username: 1 });
            if (user) {
                io.emit('live-game', {
                    username: user.username,
                    game: 'mines',
                    amount: result.winAmount,
                    won: true,
                    timestamp: Date.now()
                });
            }
        }

        res.json({ success: true, result });

    } catch (error) {
        console.error('Mines cashout error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
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

// Blackjack game routes
router.post('/blackjack/deal', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
            const { betAmount } = req.body;
            
            // Validate bet amount
            if (!betAmount || betAmount <= 0) {
                throw new Error('Invalid bet amount');
            }
            
            // Get user with session
            const user = await User.findById(req.user.userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Validate balance
            const { userBalance, betAmountRounded } = validateUserBalance(user, betAmount);
            
            // Deduct bet amount
            const balanceBefore = userBalance;
            const balanceAfter = roundToTwoDecimals(userBalance - betAmountRounded);
            user.balance = balanceAfter;
            await user.save({ session });
            
            // Deal initial cards
            const gameState = await dealBlackjack(betAmountRounded);
            
            // Create game history
            const gameHistory = new GameHistory({
                userId: req.user.userId,
                gameType: 'blackjack',
                betAmount: betAmountRounded,
                playerChoice: 'deal',
                gameResult: JSON.stringify({
                    ...gameState,
                    betAmount: betAmountRounded
                }),
                won: false,
                balanceBefore,
                balanceAfter
            });
            
            // Check for immediate game end (blackjacks)
            if (gameState.gameStatus !== 'playing') {
                let finalBalance = balanceAfter;
                
                if (gameState.winAmount > 0) {
                    finalBalance = roundToTwoDecimals(balanceAfter + gameState.winAmount);
                    user.balance = finalBalance;
                }
                
                // Update user stats and check for badges
                const won = gameState.winAmount > 0;
                const earnedBadges = await user.updateGameStats(won, betAmountRounded, gameState.winAmount);
                const { experienceGained, levelUpResult } = addExperienceToUser(user, won);
                
                // Update balance history
                user.balanceHistory.push(finalBalance);
                await user.save({ session });
                
                // Update game history
                gameHistory.won = won;
                gameHistory.winAmount = gameState.winAmount;
                gameHistory.balanceAfter = finalBalance;
                gameHistory.experienceGained = experienceGained;
                gameHistory.leveledUp = levelUpResult.leveledUp;
            }
            
            await gameHistory.save({ session });
            
            return {
                gameId: gameHistory._id,
                gameState,
                balanceAfter: user.balance,
                experienceGained: gameHistory.experienceGained || 0,
                levelUpResult: gameHistory.leveledUp ? { leveledUp: true, levelsGained: 1 } : { leveledUp: false, levelsGained: 0 },
                newLevel: user.level,
                earnedBadges: earnedBadges || []
            };
        });
        
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Blackjack deal error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

router.post('/blackjack/hit', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
            const { gameId } = req.body;
            
            if (!gameId) {
                throw new Error('Game ID is required');
            }
            
            // Get game and user
            const gameHistory = await GameHistory.findOne({
                userId: req.user.userId,
                gameType: 'blackjack',
                _id: gameId
            }).session(session);
            
            if (!gameHistory) {
                throw new Error('Game not found');
            }
            
            const user = await User.findById(req.user.userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Parse game state
            const gameState = JSON.parse(gameHistory.gameResult);
            
            if (gameState.gameStatus !== 'playing') {
                throw new Error('Game is not in playing state');
            }
            
            // Hit
            const newGameState = await hitBlackjack(gameState);
            
            // Update game history
            gameHistory.gameResult = JSON.stringify(newGameState);
            
            // Check if game ended (bust)
            if (newGameState.gameStatus === 'bust') {
                // Player busted - update stats and check for badges
                const earnedBadges = await user.updateGameStats(false, newGameState.betAmount, 0);
                const { experienceGained, levelUpResult } = addExperienceToUser(user, false);
                
                user.balanceHistory.push(user.balance);
                await user.save({ session });
                
                gameHistory.won = false;
                gameHistory.winAmount = 0;
                gameHistory.experienceGained = experienceGained;
                gameHistory.leveledUp = levelUpResult.leveledUp;
            }
            
            await gameHistory.save({ session });
            
            return {
                gameState: newGameState,
                balanceAfter: user.balance,
                earnedBadges: earnedBadges || []
            };
        });
        
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Blackjack hit error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

router.post('/blackjack/stand', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
            const { gameId } = req.body;
            
            if (!gameId) {
                throw new Error('Game ID is required');
            }
            
            // Get game and user
            const gameHistory = await GameHistory.findOne({
                userId: req.user.userId,
                gameType: 'blackjack',
                _id: gameId
            }).session(session);
            
            if (!gameHistory) {
                throw new Error('Game not found');
            }
            
            const user = await User.findById(req.user.userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Parse game state
            const gameState = JSON.parse(gameHistory.gameResult);
            
            if (gameState.gameStatus !== 'playing') {
                throw new Error('Game is not in playing state');
            }
            
            // Stand - dealer plays
            const newGameState = await standBlackjack(gameState);
            
            // Update balance if player won
            let finalBalance = user.balance;
            if (newGameState.winAmount > 0) {
                finalBalance = roundToTwoDecimals(user.balance + newGameState.winAmount);
                user.balance = finalBalance;
            }
            
            // Update user stats and check for badges
            const won = newGameState.winAmount > 0;
            const earnedBadges = await user.updateGameStats(won, newGameState.betAmount, newGameState.winAmount);
            const { experienceGained, levelUpResult } = addExperienceToUser(user, won);
            
            // Update balance history
            user.balanceHistory.push(finalBalance);
            await user.save({ session });
            
            // Update game history
            gameHistory.gameResult = JSON.stringify(newGameState);
            gameHistory.won = won;
            gameHistory.winAmount = newGameState.winAmount;
            gameHistory.balanceAfter = finalBalance;
            gameHistory.experienceGained = experienceGained;
            gameHistory.leveledUp = levelUpResult.leveledUp;
            await gameHistory.save({ session });
            
            return {
                gameState: newGameState,
                balanceAfter: finalBalance,
                experienceGained,
                levelUpResult,
                newLevel: user.level,
                earnedBadges
            };
        });
        
        // Emit live game event for blackjack stand
        const io = req.app.get('io');
        if (io) {
            const user = await User.findById(req.user.userId, { username: 1 });
            if (user) {
                io.emit('live-game', {
                    username: user.username,
                    game: 'blackjack',
                    amount: result.gameState.won ? result.gameState.winAmount : result.gameState.betAmount,
                    won: result.gameState.winAmount > 0,
                    timestamp: Date.now()
                });
            }
        }
        
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Blackjack stand error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

router.post('/blackjack/double', authenticateToken, async (req, res) => {
    try {
        const result = await withTransaction(async (session) => {
            const { gameId } = req.body;
            
            if (!gameId) {
                throw new Error('Game ID is required');
            }
            
            // Get game and user
            const gameHistory = await GameHistory.findOne({
                userId: req.user.userId,
                gameType: 'blackjack',
                _id: gameId
            }).session(session);
            
            if (!gameHistory) {
                throw new Error('Game not found');
            }
            
            const user = await User.findById(req.user.userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Parse game state
            const gameState = JSON.parse(gameHistory.gameResult);
            
            if (gameState.gameStatus !== 'playing') {
                throw new Error('Game is not in playing state');
            }
            
            if (!gameState.canDouble) {
                throw new Error('Cannot double at this time');
            }
            
            // Validate user has enough balance for double
            const additionalBet = gameState.betAmount;
            if (user.balance < additionalBet) {
                throw new Error('Insufficient balance to double');
            }
            
            // Deduct additional bet
            user.balance = roundToTwoDecimals(user.balance - additionalBet);
            await user.save({ session });
            
            // Double down
            const newGameState = await doubleBlackjack(gameState);
            
            // Update balance if player won
            let finalBalance = user.balance;
            if (newGameState.winAmount > 0) {
                finalBalance = roundToTwoDecimals(user.balance + newGameState.winAmount);
                user.balance = finalBalance;
            }
            
            // Update user stats and check for badges
            const won = newGameState.winAmount > 0;
            const earnedBadges = await user.updateGameStats(won, newGameState.betAmount, newGameState.winAmount);
            const { experienceGained, levelUpResult } = addExperienceToUser(user, won);
            
            // Update balance history
            user.balanceHistory.push(finalBalance);
            await user.save({ session });
            
            // Update game history
            gameHistory.betAmount = newGameState.betAmount; // Update to doubled bet
            gameHistory.gameResult = JSON.stringify(newGameState);
            gameHistory.won = won;
            gameHistory.winAmount = newGameState.winAmount;
            gameHistory.balanceAfter = finalBalance;
            gameHistory.experienceGained = experienceGained;
            gameHistory.leveledUp = levelUpResult.leveledUp;
            await gameHistory.save({ session });
            
            return {
                gameState: newGameState,
                balanceAfter: finalBalance,
                experienceGained,
                levelUpResult,
                newLevel: user.level,
                earnedBadges
            };
        });
        
        // Emit live game event for blackjack double
        const io = req.app.get('io');
        if (io) {
            const user = await User.findById(req.user.userId, { username: 1 });
            if (user) {
                io.emit('live-game', {
                    username: user.username,
                    game: 'blackjack',
                    amount: result.gameState.winAmount > 0 ? result.gameState.winAmount : result.gameState.betAmount,
                    won: result.gameState.winAmount > 0,
                    timestamp: Date.now()
                });
            }
        }
        
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('Blackjack double error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

module.exports = router; 