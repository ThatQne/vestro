const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticateToken: auth } = require('../middleware/auth');
const Case = require('../models/Case');
const User = require('../models/User');
const UserInventory = require('../models/UserInventory');
const CaseBattle = require('../models/CaseBattle');
const { v4: uuidv4 } = require('uuid');

console.log('Cases routes loaded, User model:', User ? 'Loaded' : 'Not loaded'); // Debug log

// Test route to check user existence
router.get('/test-user/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        res.json({ 
            success: true, 
            userExists: !!user,
            user: user ? { id: user._id, username: user.username, balance: user.balance } : null
        });
    } catch (error) {
        console.error('Error testing user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all available cases
router.get('/', async (req, res) => {
    try {
        const cases = await Case.find({ isActive: true }).sort({ price: 1 });
        res.json({ success: true, cases });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get case by ID
router.get('/:id', async (req, res) => {
    try {
        const caseItem = await Case.findById(req.params.id);
        if (!caseItem) {
            return res.status(404).json({ success: false, message: 'Case not found' });
        }
        res.json({ success: true, case: caseItem });
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Open a case
router.post('/open/:id', auth, async (req, res) => {
    try {
        console.log('Case opening request for case:', req.params.id, 'by user:', req.user.id); // Debug log
        console.log('User object from token:', req.user); // Debug log
        
        const caseItem = await Case.findById(req.params.id);
        if (!caseItem) {
            console.log('Case not found:', req.params.id); // Debug log
            return res.status(404).json({ success: false, message: 'Case not found' });
        }

        if (!caseItem.isActive) {
            return res.status(400).json({ success: false, message: 'Case is not available' });
        }

        console.log('Looking for user with ID:', req.user.id); // Debug log
        const user = await User.findById(req.user.id);
        console.log('User found:', user ? 'Yes' : 'No'); // Debug log
        if (!user) {
            console.log('User not found in database for ID:', req.user.id); // Debug log
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if user has enough balance
        if (user.balance < caseItem.price) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Get random item from case
        const wonItem = caseItem.getRandomItem();
        
        // Deduct case price from user balance
        user.balance -= caseItem.price;
        user.balanceHistory.push(user.balance);
        await user.save();

        // Add item to user inventory
        let userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            userInventory = new UserInventory({ userId: req.user.id });
        }

        await userInventory.addItem({
            name: wonItem.name,
            caseSource: caseItem.name,
            value: wonItem.value,
            isLimited: wonItem.isLimited,
            image: wonItem.image,
            rarity: wonItem.rarity
        });

        // Update case opening statistics
        caseItem.totalOpenings += 1;
        await caseItem.save();

        // Emit real-time update to user
        const io = req.app.get('io');
        io.to(req.user.id).emit('case-opened', {
            caseId: caseItem._id,
            caseName: caseItem.name,
            item: wonItem,
            newBalance: user.balance
        });

        res.json({
            success: true,
            message: 'Case opened successfully!',
            item: wonItem,
            caseName: caseItem.name,
            newBalance: user.balance,
            caseItems: caseItem.items // Include all items from the case for animation
        });

    } catch (error) {
        console.error('Error opening case:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== BATTLE ROUTES ====================

// Create a case battle
router.post('/battle/create', auth, async (req, res) => {
    try {
        const { cases, mode } = req.body;

        if (!cases || !Array.isArray(cases) || cases.length === 0) {
            return res.status(400).json({ success: false, message: 'Cases are required' });
        }

        if (!mode || !['1v1', '2v2', '1v1v1', '1v1v1v1'].includes(mode)) {
            return res.status(400).json({ success: false, message: 'Invalid battle mode' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Validate and calculate total cost
        let totalCost = 0;
        const battleCases = [];
        let totalCases = 0;

        for (const caseData of cases) {
            const caseItem = await Case.findById(caseData.caseId);
            if (!caseItem || !caseItem.isActive) {
                return res.status(400).json({ success: false, message: `Case ${caseData.caseId} not found or inactive` });
            }

            const quantity = Math.min(caseData.quantity || 1, 25);
            totalCases += quantity;
            
            if (totalCases > 25) {
                return res.status(400).json({ success: false, message: 'Maximum 25 cases allowed per battle' });
            }

            totalCost += caseItem.price * quantity;

            battleCases.push({
                caseId: caseItem._id,
                caseName: caseItem.name,
                casePrice: caseItem.price,
                quantity: quantity
            });
        }

        // Check if user has enough balance
        if (user.balance < totalCost) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Determine max players based on mode
        const maxPlayers = mode === '1v1' ? 2 : mode === '2v2' ? 4 : mode === '1v1v1' ? 3 : 4;

        // Create battle
        const battle = new CaseBattle({
            battleId: uuidv4(),
            mode: mode,
            maxPlayers: maxPlayers,
            cases: battleCases,
            totalCost: totalCost,
            isPrivate: false
        });

        await battle.save();

        // Add creator to battle
        await battle.addPlayer(req.user.id, user.username, false, true);

        // Deduct cost from user balance
        user.balance -= totalCost;
        user.balanceHistory.push(user.balance);
        await user.save();

        // Emit battle created event
        const io = req.app.get('io');
        io.emit('battle-created', battle.getSummary());

        res.json({
            success: true,
            message: 'Battle created successfully!',
            battle: battle.getFullDetails(),
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Error creating battle:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Get active battles
router.get('/battles/active', async (req, res) => {
    try {
        const now = new Date();
        // Include waiting and recently completed battles (within 2 minutes)
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
        const battles = await CaseBattle.find({
            $or: [
                { status: 'waiting', isPrivate: false, expiresAt: { $gt: now } },
                { status: 'completed', completedAt: { $gte: twoMinutesAgo }, isPrivate: false }
            ]
        }).sort({ createdAt: -1 }).limit(20);

        res.json({ success: true, battles: battles.map(b => b.getSummary()) });
    } catch (error) {
        console.error('Error fetching battles:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get battle details
router.get('/battle/:battleId', async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });
        if (!battle) {
            return res.status(404).json({ success: false, message: 'Battle not found' });
        }

        res.json({ success: true, battle: battle.getFullDetails() });
    } catch (error) {
        console.error('Error fetching battle:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Join a battle
router.post('/battle/:battleId/join', auth, async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });
        if (!battle) {
            return res.status(404).json({ success: false, message: 'Battle not found' });
        }

        if (battle.status !== 'waiting') {
            return res.status(400).json({ success: false, message: 'Battle is not available to join' });
        }

        if (battle.isExpired()) {
            battle.status = 'cancelled';
            await battle.save();
            return res.status(400).json({ success: false, message: 'Battle has expired' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if user has enough balance
        if (user.balance < battle.totalCost) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Add player to battle
        await battle.addPlayer(req.user.id, user.username, false, false);

        // Deduct cost from user balance
        user.balance -= battle.totalCost;
        user.balanceHistory.push(user.balance);
        await user.save();

        // Emit battle updated event
        const io = req.app.get('io');
        io.emit('battle-updated', battle.getFullDetails());
        
        // Emit to battle participants
        battle.players.forEach(player => {
            if (!player.isBot) {
                io.to(player.userId.toString()).emit('battle-player-joined', {
                    battleId: battle.battleId,
                    player: {
                        username: user.username,
                        isBot: false
                    },
                    battle: battle.getFullDetails()
                });
            }
        });

        res.json({
            success: true,
            message: 'Joined battle successfully!',
            battle: battle.getFullDetails(),
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Error joining battle:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Call bots to join battle
router.post('/battle/:battleId/call-bots', auth, async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });
        if (!battle) {
            return res.status(404).json({ success: false, message: 'Battle not found' });
        }

        if (battle.status !== 'waiting') {
            return res.status(400).json({ success: false, message: 'Battle is not available to join' });
        }

        if (battle.isExpired()) {
            battle.status = 'cancelled';
            await battle.save();
            return res.status(400).json({ success: false, message: 'Battle has expired' });
        }

        // Check if user is the creator
        const isCreator = battle.players.some(p => p.userId.toString() === req.user.id && p.isCreator);
        if (!isCreator) {
            return res.status(403).json({ success: false, message: 'Only the battle creator can call bots' });
        }

        // Add bots to fill the battle
        await battle.addBots();

        // Emit battle updated event
        const io = req.app.get('io');
        io.emit('battle-updated', battle.getFullDetails());
        
        // Emit to battle participants
        battle.players.forEach(player => {
            if (!player.isBot) {
                io.to(player.userId.toString()).emit('battle-bots-added', {
                    battleId: battle.battleId,
                    battle: battle.getFullDetails()
                });
            }
        });

        // If the battle is now full, autostart it
        if (battle.players.length === battle.maxPlayers) {
            // Start the battle
            await battle.start();
            io.emit('battle-started', battle.getFullDetails());
            battle.players.forEach(player => {
                if (!player.isBot) {
                    io.to(player.userId.toString()).emit('battle-started', {
                        battleId: battle.battleId,
                        battle: battle.getFullDetails()
                    });
                }
            });
            // Start processing case openings
            processNextBattleOpening(battle.battleId, io);
        }

        res.json({
            success: true,
            message: 'Bots have joined the battle!',
            battle: battle.getFullDetails()
        });

    } catch (error) {
        console.error('Error calling bots:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Start battle
router.post('/battle/:battleId/start', auth, async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });
        if (!battle) {
            return res.status(404).json({ success: false, message: 'Battle not found' });
        }

        if (battle.status !== 'waiting') {
            return res.status(400).json({ success: false, message: 'Battle cannot be started' });
        }

        if (battle.players.length < battle.maxPlayers) {
            return res.status(400).json({ success: false, message: 'Battle is not full' });
        }

        // Check if user is the creator
        const isCreator = battle.players.some(p => p.userId.toString() === req.user.id && p.isCreator);
        if (!isCreator) {
            return res.status(403).json({ success: false, message: 'Only the battle creator can start the battle' });
        }

        // Start the battle
        await battle.start();

        // Emit battle started event
        const io = req.app.get('io');
        io.emit('battle-started', battle.getSummary());
        
        // Emit to battle participants
        battle.players.forEach(player => {
            if (!player.isBot) {
                io.to(player.userId.toString()).emit('battle-started', {
                    battleId: battle.battleId,
                    battle: battle.getFullDetails()
                });
            }
        });

        // Start processing case openings
        processNextBattleOpening(battle.battleId, io);

        res.json({
            success: true,
            message: 'Battle started successfully!',
            battle: battle.getFullDetails()
        });

    } catch (error) {
        console.error('Error starting battle:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Function to process battle openings with real-time updates
async function processNextBattleOpening(battleId, io) {
    try {
        const battle = await CaseBattle.findOne({ battleId: battleId });
        if (!battle) {
            console.error('Battle not found:', battleId);
            return;
        }

        if (battle.status !== 'starting' && battle.status !== 'in_progress') {
            console.log('Battle not in progress:', battleId, battle.status);
            return;
        }

        const result = await battle.processNextOpening(Case);
        
        // Emit opening result to all participants
        battle.players.forEach(player => {
            if (!player.isBot) {
                io.to(player.userId.toString()).emit('battle-opening', {
                    battleId: battle.battleId,
                    opening: result.opening,
                    progress: {
                        current: result.currentIndex,
                        total: result.totalOpenings,
                        percentage: Math.round((result.currentIndex / result.totalOpenings) * 100)
                    }
                });
            }
        });

        // Emit to general battle watchers
        io.emit('battle-opening-public', {
            battleId: battle.battleId,
            opening: result.opening,
            progress: {
                current: result.currentIndex,
                total: result.totalOpenings,
                percentage: Math.round((result.currentIndex / result.totalOpenings) * 100)
            }
        });

        if (result.isComplete) {
            // Battle is complete, handle winner and inventory updates
            await handleBattleComplete(battle, io);
        } else {
            // Schedule next opening
            setTimeout(() => {
                processNextBattleOpening(battleId, io);
            }, 2000); // 2 second delay between openings
        }

    } catch (error) {
        console.error('Error processing battle opening:', error);
        
        // Try to mark battle as cancelled on error
        try {
            const battle = await CaseBattle.findOne({ battleId: battleId });
            if (battle) {
                battle.status = 'cancelled';
                await battle.save();
                
                io.emit('battle-error', {
                    battleId: battleId,
                    message: 'Battle encountered an error and was cancelled'
                });
            }
        } catch (cancelError) {
            console.error('Error cancelling battle:', cancelError);
        }
    }
}

// Function to handle battle completion
async function handleBattleComplete(battle, io) {
    try {
        // Add items to winner's inventory (only for real users, not bots)
        const winner = battle.players.find(p => p.isWinner);
        if (winner && !winner.isBot) {
            let userInventory = await UserInventory.findOne({ userId: winner.userId });
            if (!userInventory) {
                userInventory = new UserInventory({ userId: winner.userId });
            }

            // Add all items from all players to winner's inventory
            for (const player of battle.players) {
                for (const item of player.items) {
                    await userInventory.addItem({
                        name: item.itemName,
                        caseSource: item.caseSource,
                        value: item.itemValue,
                        isLimited: item.isLimited,
                        image: item.itemImage,
                        rarity: item.itemRarity
                    });
                }
            }
        }

        // Emit battle completed event
        io.emit('battle-completed', battle.getSummary());
        
        // Emit to battle participants
        battle.players.forEach(player => {
            if (!player.isBot) {
                io.to(player.userId.toString()).emit('battle-completed', {
                    battleId: battle.battleId,
                    winner: {
                        username: battle.winnerUsername,
                        isBot: winner ? winner.isBot : false
                    },
                    battle: battle.getFullDetails(),
                    won: player.isWinner
                });
            }
        });

        console.log(`Battle ${battle.battleId} completed. Winner: ${battle.winnerUsername}`);

    } catch (error) {
        console.error('Error handling battle completion:', error);
    }
}

module.exports = router; 