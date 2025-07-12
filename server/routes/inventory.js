const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const UserInventory = require('../models/UserInventory');
const User = require('../models/User');

console.log('Inventory routes loaded, User model:', User ? 'Loaded' : 'Not loaded'); // Debug log

// Get user's inventory
router.get('/', auth, async (req, res) => {
    try {
        console.log('Inventory request for user:', req.user.id); // Debug log
        console.log('User object from token:', req.user); // Debug log
        
        // First check if user exists
        const user = await User.findById(req.user.id);
        if (!user) {
            console.log('User not found in database for inventory request:', req.user.id); // Debug log
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        let userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            console.log('Creating new inventory for user:', req.user.id); // Debug log
            userInventory = new UserInventory({ userId: req.user.id });
            await userInventory.save();
        }

        console.log('Returning inventory:', userInventory); // Debug log
        res.json({ success: true, inventory: userInventory });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get inventory statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.json({ 
                success: true, 
                stats: {
                    totalItems: 0,
                    totalValue: 0,
                    limitedItems: 0,
                    itemsByRarity: {
                        common: 0,
                        uncommon: 0,
                        rare: 0,
                        epic: 0,
                        legendary: 0,
                        mythical: 0
                    }
                }
            });
        }

        // Calculate stats
        const stats = {
            totalItems: userInventory.totalItems,
            totalValue: userInventory.totalValue,
            limitedItems: userInventory.limitedItems,
            itemsByRarity: {
                common: userInventory.items.filter(item => item.rarity === 'common').length,
                uncommon: userInventory.items.filter(item => item.rarity === 'uncommon').length,
                rare: userInventory.items.filter(item => item.rarity === 'rare').length,
                epic: userInventory.items.filter(item => item.rarity === 'epic').length,
                legendary: userInventory.items.filter(item => item.rarity === 'legendary').length,
                mythical: userInventory.items.filter(item => item.rarity === 'mythical').length
            }
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching inventory stats:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Sell an item (70% of value for non-limited items)
router.post('/sell/:itemId', auth, async (req, res) => {
    try {
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.status(404).json({ success: false, message: 'Inventory not found' });
        }

        const item = userInventory.items.find(item => item._id.toString() === req.params.itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.isListed || item.isTrading) {
            return res.status(400).json({ success: false, message: 'Item is currently listed or being traded' });
        }

        // Calculate sell price (70% of value for non-limited items)
        const sellPrice = item.isLimited ? item.value : Math.floor(item.value * 0.7);

        // Remove item from inventory
        await userInventory.removeItem(req.params.itemId);

        // Add money to user balance
        const user = await User.findById(req.user.id);
        user.balance += sellPrice;
        user.balanceHistory.push(user.balance);
        await user.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.to(req.user.id).emit('item-sold', {
            itemId: req.params.itemId,
            itemName: item.itemName,
            sellPrice: sellPrice,
            newBalance: user.balance
        });

        res.json({
            success: true,
            message: 'Item sold successfully!',
            sellPrice: sellPrice,
            newBalance: user.balance
        });

    } catch (error) {
        console.error('Error selling item:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get items by rarity
router.get('/rarity/:rarity', auth, async (req, res) => {
    try {
        const { rarity } = req.params;
        const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];
        
        if (!validRarities.includes(rarity)) {
            return res.status(400).json({ success: false, message: 'Invalid rarity' });
        }

        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.json({ success: true, items: [] });
        }

        const items = userInventory.items.filter(item => item.rarity === rarity);
        res.json({ success: true, items });

    } catch (error) {
        console.error('Error fetching items by rarity:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get limited items only
router.get('/limited', auth, async (req, res) => {
    try {
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.json({ success: true, items: [] });
        }

        const limitedItems = userInventory.getLimitedItems();
        res.json({ success: true, items: limitedItems });

    } catch (error) {
        console.error('Error fetching limited items:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Toggle item listing status (for marketplace)
router.post('/toggle-listing/:itemId', auth, async (req, res) => {
    try {
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.status(404).json({ success: false, message: 'Inventory not found' });
        }

        const item = userInventory.items.find(item => item._id.toString() === req.params.itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (!item.isLimited) {
            return res.status(400).json({ success: false, message: 'Only limited items can be listed on marketplace' });
        }

        if (item.isTrading) {
            return res.status(400).json({ success: false, message: 'Item is currently being traded' });
        }

        // Toggle listing status
        item.isListed = !item.isListed;
        await userInventory.save();

        res.json({
            success: true,
            message: item.isListed ? 'Item listed for marketplace' : 'Item removed from marketplace',
            isListed: item.isListed
        });

    } catch (error) {
        console.error('Error toggling listing status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get item details
router.get('/item/:itemId', auth, async (req, res) => {
    try {
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.status(404).json({ success: false, message: 'Inventory not found' });
        }

        const item = userInventory.items.find(item => item._id.toString() === req.params.itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, item });

    } catch (error) {
        console.error('Error fetching item details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router; 