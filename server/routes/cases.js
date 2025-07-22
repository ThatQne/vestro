const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticateToken: auth } = require('../middleware/auth');
const Case = require('../models/Case');
const User = require('../models/User');
const UserInventory = require('../models/UserInventory');
const CaseBattle = require('../models/CaseBattle');
const { v4: uuidv4 } = require('uuid');
const { updateUserBalance } = require('../utils/gameUtils');

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
        updateUserBalance(user, -caseItem.price);
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

// Create a case battle
router.post('/battle/create', auth, async (req, res) => {
    try {
        const { cases, mode, isPrivate = false } = req.body;

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

        // Validate total case count
        const totalCases = cases.reduce((sum, c) => sum + (c.quantity || 1), 0);
        if (totalCases > 25) {
            return res.status(400).json({ success: false, message: 'Maximum of 25 cases allowed per battle' });
        }

        // Validate and calculate total cost
        let totalCost = 0;
        const battleCases = [];

        for (const caseData of cases) {
            const caseItem = await Case.findById(caseData.caseId);
            if (!caseItem || !caseItem.isActive) {
                return res.status(400).json({ success: false, message: `Case ${caseData.caseId} not found or inactive` });
            }

            const quantity = caseData.quantity || 1;
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
            isPrivate: isPrivate
        });

        await battle.save();

        // Add creator to battle
        await battle.addPlayer(req.user.id, user.username);

        // Deduct cost from user balance
        updateUserBalance(user, -totalCost);
        await user.save();

        // Emit battle created event
        const io = req.app.get('io');
        if (!isPrivate) {
            io.emit('battle-created', battle.getSummary());
        }

        res.json({
            success: true,
            message: 'Battle created successfully!',
            battle: battle.getSummary(),
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Error creating battle:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Join a case battle
router.post('/battle/join/:battleId', auth, async (req, res) => {
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
        await battle.addPlayer(req.user.id, user.username);

        // Deduct cost from user balance
        updateUserBalance(user, -battle.totalCost);
        await user.save();

        // Check if battle is full and start it
        if (battle.players.length >= battle.maxPlayers) {
            await battle.start();
            
            // Emit battle started event
            const io = req.app.get('io');
            io.emit('battle-started', battle.getSummary());
            
            processCompleteBattle(battle, io);
        } else {
            // Emit battle joined event
            const io = req.app.get('io');
            io.emit('battle-joined', battle.getSummary());
        }

        res.json({
            success: true,
            message: 'Joined battle successfully!',
            battle: battle.getSummary(),
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Error joining battle:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Get active battles
router.get('/battles/active', async (req, res) => {
    try {
        const now = new Date();
        const battles = await CaseBattle.find({ 
            $or: [
                { status: 'waiting', isPrivate: false, expiresAt: { $gt: now } },
                { status: 'completed', viewingPeriodEndsAt: { $gt: now } }
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

        res.json({ success: true, battle: battle.getSummary() });
    } catch (error) {
        console.error('Error fetching battle:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/battle/:battleId/call-bots', auth, async (req, res) => {
    try {
        const battle = await CaseBattle.findOne({ battleId: req.params.battleId });
        if (!battle) {
            return res.status(404).json({ message: 'Battle not found' });
        }
        
        const isCreator = battle.players.length > 0 && 
                          battle.players[0].userId.toString() === req.user.id;
        if (!isCreator) {
            return res.status(403).json({ message: 'Only the battle creator can call bots' });
        }
        
        await battle.addBots();
        
        
        if (battle.players.length >= battle.maxPlayers) {
            await battle.start();
            
            // Emit battle started event
            const io = req.app.get('io');
            io.emit('battle-started', battle.getSummary());
            
            processCompleteBattle(battle, io);
        } else {
            // Emit battle updated event
            const io = req.app.get('io');
            io.emit('battle-updated', battle.getSummary());
        }
        
        res.json({ message: 'Bots added successfully', battle: battle.getSummary() });
    } catch (error) {
        console.error('Error calling bots:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Process a complete battle (separate function for reuse)
async function processCompleteBattle(battle, io) {
    try {
        // Emit battle processing started
        io.emit('battle-processing-started', { battleId: battle.battleId });
        
        // Process all case openings with delays for animation
        for (const player of battle.players) {
            if (player.isBot) {
                const botUtils = require('../utils/botUtils');
                const { items, totalValue } = await botUtils.simulateBotCaseOpening(battle.cases);
                player.items = items;
                player.totalValue = totalValue;
            } else {
                const caseItems = [];
                
                for (const battleCase of battle.cases) {
                    const caseItem = await Case.findById(battleCase.caseId);
                    if (!caseItem) continue;
                    
                    for (let i = 0; i < battleCase.quantity; i++) {
                        const wonItem = caseItem.getRandomItem();
                        caseItems.push(wonItem);
                        
                        const itemData = {
                            itemName: wonItem.name,
                            itemValue: wonItem.value,
                            itemImage: wonItem.image || 'default-item.png',
                            itemRarity: wonItem.rarity,
                            caseSource: caseItem.name,
                            isLimited: wonItem.isLimited || false
                        };
                        
                        player.items.push(itemData);
                        
                        // Emit case opened event for real-time animation
                        io.emit('case-opened', {
                            battleId: battle.battleId,
                            playerId: player.userId,
                            playerUsername: player.username,
                            item: itemData,
                            caseIndex: i,
                            caseName: battleCase.caseName
                        });
                        
                        // Add delay between case openings for animation
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
                
                player.totalValue = player.items.reduce((sum, item) => sum + item.itemValue, 0);
            }
        }
        
        await battle.complete();
        
        battle.viewingPeriodEndsAt = new Date(Date.now() + 2 * 60 * 1000);
        await battle.save();
        
        // Add items to winner's inventory
        if (battle.winnerId && !battle.players.find(p => p.userId.toString() === battle.winnerId.toString())?.isBot) {
            const allItems = battle.players.reduce((items, player) => [...items, ...player.items], []);
            await addItemsToWinnerInventory(battle.winnerId, allItems, battle.battleId);
        }
        
        // Emit battle completed event
        if (!io) {
            io = require('../server').getIO();
        }
        io.emit('battle-completed', battle);
        
        // Notify all players
        battle.players.forEach(player => {
            if (!player.isBot) {
                io.to(player.userId.toString()).emit('battle-result', {
                    battleId: battle.battleId,
                    won: player.isWinner,
                    items: player.items,
                    totalValue: player.totalValue
                });
            }
        });
    } catch (error) {
        console.error('Error processing battle completion:', error);
    }
}

// Helper function to add items to winner's inventory
async function addItemsToWinnerInventory(userId, items, battleId) {
    try {
        let userInventory = await UserInventory.findOne({ userId });
        
        // Create inventory if it doesn't exist
        if (!userInventory) {
            userInventory = new UserInventory({
                userId,
                items: []
            });
        }
        
        // Add all items to inventory
        for (const item of items) {
            userInventory.items.push({
                name: item.itemName,
                value: item.itemValue,
                image: item.itemImage,
                rarity: item.itemRarity,
                source: `Battle: ${battleId}`,
                isListed: false,
                isLimited: item.isLimited || false,
                acquiredAt: new Date()
            });
        }
        
        await userInventory.save();
    } catch (error) {
        console.error('Error adding items to winner inventory:', error);
    }
}

module.exports = router;            