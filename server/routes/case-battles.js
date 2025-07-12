const express = require('express');
const User = require('../models/User');
const CaseBattle = require('../models/CaseBattle');
const Case = require('../models/Case');
const Item = require('../models/Item');
const Inventory = require('../models/Inventory');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all active case battles
router.get('/', async (req, res) => {
    try {
        const battles = await CaseBattle.find({ 
            status: { $in: ['waiting', 'active'] } 
        })
        .populate('cases.case', 'name price icon')
        .populate('players.user', 'username level')
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .limit(50);

        res.json({
            success: true,
            battles: battles.map(battle => ({
                ...battle.toObject(),
                summary: battle.getSummary()
            }))
        });
    } catch (error) {
        console.error('Error fetching case battles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch case battles'
        });
    }
});

// Get battle details
router.get('/:battleId', async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId })
            .populate('cases.case')
            .populate('players.user', 'username level')
            .populate('players.items.item')
            .populate('createdBy', 'username');

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        res.json({
            success: true,
            battle: battle.toObject()
        });
    } catch (error) {
        console.error('Error fetching battle details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch battle details'
        });
    }
});

// Create new case battle
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { name, cases, maxPlayers, entryFee, isPrivate, password } = req.body;

        // Validate input
        if (!name || !cases || !Array.isArray(cases) || cases.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid battle configuration'
            });
        }

        // Check if user has enough balance
        const user = await User.findById(req.user.id);
        if (user.balance < entryFee) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance to create battle'
            });
        }

        // Validate cases exist
        const caseIds = cases.map(c => c.case);
        const validCases = await Case.find({ _id: { $in: caseIds }, isActive: true });
        if (validCases.length !== caseIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cases selected'
            });
        }

        // Create battle
        const battle = new CaseBattle({
            name,
            cases,
            maxPlayers: maxPlayers || 2,
            entryFee,
            isPrivate: isPrivate || false,
            password: isPrivate ? password : null,
            createdBy: req.user.id
        });

        // Add creator as first player
        battle.addPlayer(req.user.id, user.username);

        // Deduct entry fee
        user.balance -= entryFee;
        await user.save();

        await battle.save();

        // Emit real-time update
        if (req.io) {
            req.io.emit('battleCreated', {
                battleId: battle.battleId,
                name: battle.name,
                creator: user.username,
                entryFee: battle.entryFee,
                maxPlayers: battle.maxPlayers,
                currentPlayers: battle.players.length
            });
        }

        res.json({
            success: true,
            battle: battle.toObject(),
            message: 'Battle created successfully'
        });
    } catch (error) {
        console.error('Error creating case battle:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create battle'
        });
    }
});

// Join case battle
router.post('/:battleId/join', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId })
            .populate('players.user', 'username');

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        // Check password for private battles
        if (battle.isPrivate && battle.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

        // Check if user has enough balance
        const user = await User.findById(req.user.id);
        if (user.balance < battle.entryFee) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance to join battle'
            });
        }

        // Add player to battle
        battle.addPlayer(req.user.id, user.username);

        // Deduct entry fee
        user.balance -= battle.entryFee;
        await user.save();

        await battle.save();

        // Emit real-time update
        if (req.io) {
            req.io.emit('playerJoined', {
                battleId: battle.battleId,
                player: user.username,
                currentPlayers: battle.players.length,
                maxPlayers: battle.maxPlayers
            });

            // If battle is full, start it
            if (battle.status === 'active') {
                req.io.emit('battleStarted', {
                    battleId: battle.battleId
                });
            }
        }

        res.json({
            success: true,
            battle: battle.toObject(),
            message: 'Joined battle successfully'
        });
    } catch (error) {
        console.error('Error joining case battle:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to join battle'
        });
    }
});

// Leave case battle
router.post('/:battleId/leave', authenticateToken, async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        // Remove player from battle
        battle.removePlayer(req.user.id);

        // Refund entry fee
        const user = await User.findById(req.user.id);
        user.balance += battle.entryFee;
        await user.save();

        await battle.save();

        // Emit real-time update
        if (req.io) {
            req.io.emit('playerLeft', {
                battleId: battle.battleId,
                currentPlayers: battle.players.length
            });
        }

        res.json({
            success: true,
            message: 'Left battle successfully'
        });
    } catch (error) {
        console.error('Error leaving case battle:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to leave battle'
        });
    }
});

// Open case in battle
router.post('/:battleId/open', authenticateToken, async (req, res) => {
    try {
        const { caseIndex } = req.body;
        
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId })
            .populate('cases.case')
            .populate('players.user', 'username');

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        if (battle.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Battle is not active'
            });
        }

        // Find player
        const playerIndex = battle.players.findIndex(p => 
            p.user && p.user._id.toString() === req.user.id
        );

        if (playerIndex === -1) {
            return res.status(400).json({
                success: false,
                message: 'You are not in this battle'
            });
        }

        // Open case for player
        const result = await battle.openCaseForPlayer(playerIndex, caseIndex);
        await battle.save();

        // Check if all players have opened all cases
        const totalCases = battle.cases.reduce((sum, c) => sum + c.quantity, 0);
        const allPlayersFinished = battle.players.every(p => 
            p.items.length >= totalCases
        );

        if (allPlayersFinished) {
            battle.completeBattle();
            await battle.save();

            // Distribute winnings to winner
            const winner = battle.players.find(p => 
                p.user && p.user._id.toString() === battle.winner.toString()
            );
            
            if (winner) {
                const winnerUser = await User.findById(winner.user._id);
                const totalPot = battle.entryFee * battle.players.length;
                winnerUser.balance += totalPot;
                await winnerUser.save();

                // Add all items to winner's inventory
                let winnerInventory = await Inventory.findOne({ user: winner.user._id });
                if (!winnerInventory) {
                    winnerInventory = new Inventory({ user: winner.user._id });
                }

                // Add all items from all players to winner's inventory
                for (const player of battle.players) {
                    for (const item of player.items) {
                        winnerInventory.addItem(item.item, 1, 'battle', { 
                            battleId: battle._id 
                        });
                    }
                }
                await winnerInventory.save();
            }

            // Emit battle completed
            if (req.io) {
                req.io.emit('battleCompleted', {
                    battleId: battle.battleId,
                    winner: winner ? winner.username : 'Unknown',
                    totalValue: battle.players.reduce((sum, p) => sum + p.totalValue, 0)
                });
            }
        }

        // Emit real-time update
        if (req.io) {
            req.io.emit('caseOpened', {
                battleId: battle.battleId,
                player: battle.players[playerIndex].username,
                item: result.item,
                value: result.value,
                caseIndex
            });
        }

        res.json({
            success: true,
            result: {
                item: result.item,
                value: result.value,
                battleCompleted: battle.status === 'completed',
                winner: battle.winner
            }
        });
    } catch (error) {
        console.error('Error opening case in battle:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to open case'
        });
    }
});

// Add bot to battle
router.post('/:battleId/add-bot', authenticateToken, async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });

        if (!battle) {
            return res.status(404).json({
                success: false,
                message: 'Battle not found'
            });
        }

        if (battle.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only battle creator can add bots'
            });
        }

        // Generate bot name
        const botNames = ['BotPlayer', 'AutoBot', 'CaseBot', 'LuckyBot', 'ProBot'];
        const botName = botNames[Math.floor(Math.random() * botNames.length)] + 
                       Math.floor(Math.random() * 1000);

        // Add bot player
        battle.addPlayer(null, botName, true);
        await battle.save();

        // Emit real-time update
        if (req.io) {
            req.io.emit('botAdded', {
                battleId: battle.battleId,
                botName,
                currentPlayers: battle.players.length
            });

            // If battle is full, start it
            if (battle.status === 'active') {
                req.io.emit('battleStarted', {
                    battleId: battle.battleId
                });
            }
        }

        res.json({
            success: true,
            message: 'Bot added successfully'
        });
    } catch (error) {
        console.error('Error adding bot:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add bot'
        });
    }
});

module.exports = router; 