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
        res.json(createSuccessResponse({ cases }));
    } catch (error) {
        handleRouteError(error, res);
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
        handleRouteError(error, res);
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

        // Validate and calculate total cost with 25-case limit
        let totalCost = 0;
        let totalCases = 0;
        const battleCases = [];

        for (const caseData of cases) {
            const caseItem = await Case.findById(caseData.caseId);
            if (!caseItem || !caseItem.isActive) {
                return res.status(400).json({ success: false, message: `Case ${caseData.caseId} not found or inactive` });
            }

            const quantity = caseData.quantity || 1;
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
            return res.status(400).json(createErrorResponse('Insufficient balance'));
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
        user.balance -= totalCost;
        user.balanceHistory.push(user.balance);
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
            return res.status(400).json(createErrorResponse('Insufficient balance'));
        }

        // Add player to battle
        await battle.addPlayer(req.user.id, user.username);

        // Deduct cost from user balance
        user.balance -= battle.totalCost;
        user.balanceHistory.push(user.balance);
        await user.save();

        // Check if battle is full and start it
        if (battle.players.length >= battle.maxPlayers) {
            await battle.startCaseOpening();
            
            // Emit battle starting event
            const io = req.app.get('io');
            if (io) {
                io.emit('battle-starting', { battleId: battle.battleId });
            }
            
            setTimeout(() => {
                processBattleCaseOpening(battle.battleId, io);
            }, 2000);
        } else {
            // Check if battle should be filled with bots after 30 seconds
            setTimeout(async () => {
                const updatedBattle = await CaseBattle.findOne({ battleId: battle.battleId });
                if (updatedBattle && updatedBattle.status === 'waiting' && updatedBattle.players.length < updatedBattle.maxPlayers) {
                    await updatedBattle.addBots();
                    await updatedBattle.startCaseOpening();
                    
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('battle-starting', { battleId: updatedBattle.battleId });
                        
                        setTimeout(() => {
                            processBattleCaseOpening(updatedBattle.battleId, io);
                        }, 2000);
                    }
                }
            }, 30000);
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
        const battles = await CaseBattle.find({ 
            status: 'waiting',
            isPrivate: false,
            expiresAt: { $gt: new Date() }
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

        res.json({ success: true, battle });
    } catch (error) {
        console.error('Error fetching battle:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


module.exports = router;  

// Process battle case opening with animations
async function processBattleCaseOpening(battleId, io) {
    try {
        const battle = await CaseBattle.findOne({ battleId });
        if (!battle || battle.battleProgress !== 'opening_cases') return;

        const totalCases = battle.cases.reduce((sum, c) => sum + c.quantity, 0);
        
        for (let caseIndex = 0; caseIndex < totalCases; caseIndex++) {
            let currentCaseData = null;
            let caseCount = 0;
            
            for (const caseItem of battle.cases) {
                if (caseIndex < caseCount + caseItem.quantity) {
                    currentCaseData = caseItem;
                    break;
                }
                caseCount += caseItem.quantity;
            }
            
            if (!currentCaseData) continue;
            
            const caseItem = await Case.findById(currentCaseData.caseId);
            
            for (const player of battle.players) {
                const wonItem = caseItem.getRandomItem();
                
                // Add item to battle results
                battle.caseOpeningResults.push({
                    playerId: player.userId,
                    caseIndex: caseIndex,
                    item: {
                        itemName: wonItem.name,
                        itemValue: wonItem.value,
                        itemImage: wonItem.image,
                        itemRarity: wonItem.rarity
                    }
                });
                
                // Add to player items
                player.items.push({
                    itemName: wonItem.name,
                    itemValue: wonItem.value,
                    itemImage: wonItem.image,
                    itemRarity: wonItem.rarity,
                    caseSource: caseItem.name,
                    isLimited: wonItem.isLimited
                });
                
                // Add to user inventory if not bot
                if (!player.isBot) {
                    let userInventory = await UserInventory.findOne({ userId: player.userId });
                    if (!userInventory) {
                        userInventory = new UserInventory({ userId: player.userId });
                    }
                    
                    await userInventory.addItem({
                        name: wonItem.name,
                        caseSource: caseItem.name,
                        value: wonItem.value,
                        isLimited: wonItem.isLimited,
                        image: wonItem.image,
                        rarity: wonItem.rarity
                    });
                }
            }
            
            battle.currentCaseIndex = caseIndex;
            await battle.save();
            
            if (io) {
                io.emit('case-opening-progress', {
                    battleId: battle.battleId,
                    caseIndex: caseIndex,
                    totalCases: totalCases,
                    results: battle.caseOpeningResults.filter(r => r.caseIndex === caseIndex)
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        await battle.complete();
        await battle.scheduleCleanup();
        
        // Emit battle completed
        if (io) {
            io.emit('battle-completed', battle);
        }
        
        setTimeout(async () => {
            await CaseBattle.findOneAndDelete({ battleId: battle.battleId });
            if (io) {
                io.emit('battle-cleanup', { battleId: battle.battleId });
            }
        }, 2 * 60 * 1000);
        
    } catch (error) {
        console.error('Error processing battle case opening:', error);
    }
}

module.exports = router;     
