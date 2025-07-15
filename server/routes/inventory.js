const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const UserInventory = require('../models/UserInventory');
const User = require('../models/User');
const { getUserById, updateUserBalance } = require('../utils/userHelpers');
const { getUserInventory, findInventoryItem } = require('../utils/inventoryHelpers');
const { createErrorResponse, createSuccessResponse, handleRouteError } = require('../utils/responseHelpers');

console.log('Inventory routes loaded, User model:', User ? 'Loaded' : 'Not loaded'); // Debug log

// Get user's inventory
router.get('/', auth, async (req, res) => {
    try {
        console.log('Inventory request for user:', req.user.id); // Debug log
        console.log('User object from token:', req.user); // Debug log
        
        // First check if user exists
        const user = await getUserById(req.user.id);
        if (!user) {
            console.log('User not found in database for inventory request:', req.user.id);
            return res.status(404).json(createErrorResponse('User not found'));
        }
        
        const userInventory = await getUserInventory(req.user.id);

        console.log('Returning inventory:', userInventory);
        res.json(createSuccessResponse({ inventory: userInventory }));
    } catch (error) {
        handleRouteError(error, res);
    }
});

// Get inventory statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const userInventory = await getUserInventory(req.user.id, false);
        if (!userInventory) {
            return res.json(createSuccessResponse({
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
            }));
        }

        // Calculate stats with single pass through items
        const itemsByRarity = userInventory.items.reduce((acc, item) => {
            acc[item.rarity] = (acc[item.rarity] || 0) + 1;
            return acc;
        }, {});

        const stats = {
            totalItems: userInventory.totalItems,
            totalValue: userInventory.totalValue,
            limitedItems: userInventory.limitedItems,
            itemsByRarity: {
                common: itemsByRarity.common || 0,
                uncommon: itemsByRarity.uncommon || 0,
                rare: itemsByRarity.rare || 0,
                epic: itemsByRarity.epic || 0,
                legendary: itemsByRarity.legendary || 0,
                mythical: itemsByRarity.mythical || 0
            }
        };

        res.json(createSuccessResponse({ stats }));
    } catch (error) {
        handleRouteError(error, res);
    }
});

// Sell an item (70% of value for non-limited items)
router.post('/sell/:itemId', auth, async (req, res) => {
    try {
        const { count = 1 } = req.body; // Allow selling multiple items at once
        
        const { userInventory, item } = await findInventoryItem(req.user.id, req.params.itemId);

        if (item.isListed || item.isTrading) {
            return res.status(400).json(createErrorResponse('Item is currently listed or being traded'));
        }

        // Validate count
        if (count > item.count) {
            return res.status(400).json(createErrorResponse('Not enough items to sell'));
        }

        // Calculate sell price (70% of value for non-limited items)
        const sellPricePerItem = item.isLimited ? item.value : Math.floor(item.value * 0.7);
        const totalSellPrice = sellPricePerItem * count;

        // Remove item(s) from inventory
        await userInventory.removeItem(req.params.itemId, count);

        // Add money to user balance
        const user = await updateUserBalance(req.user.id, totalSellPrice);

        // Emit real-time update
        const io = req.app.get('io');
        io.to(req.user.id).emit('item-sold', {
            itemId: req.params.itemId,
            itemName: item.itemName,
            sellPrice: totalSellPrice,
            count: count,
            newBalance: user.balance
        });

        res.json(createSuccessResponse({
            sellPrice: totalSellPrice,
            sellPricePerItem: sellPricePerItem,
            count: count,
            newBalance: user.balance
        }, count === 1 ? 'Item sold successfully!' : `${count} items sold successfully!`));

    } catch (error) {
        handleRouteError(error, res);
    }
});

// Get items by rarity
router.get('/rarity/:rarity', auth, async (req, res) => {
    try {
        const { rarity } = req.params;
        const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];
        
        if (!validRarities.includes(rarity)) {
            return res.status(400).json(createErrorResponse('Invalid rarity'));
        }

        const userInventory = await getUserInventory(req.user.id, false);
        if (!userInventory) {
            return res.json(createSuccessResponse({ items: [] }));
        }

        const items = userInventory.items.filter(item => item.rarity === rarity);
        res.json(createSuccessResponse({ items }));

    } catch (error) {
        handleRouteError(error, res);
    }
});

// Get limited items only
router.get('/limited', auth, async (req, res) => {
    try {
        const userInventory = await getUserInventory(req.user.id, false);
        if (!userInventory) {
            return res.json(createSuccessResponse({ items: [] }));
        }

        const limitedItems = userInventory.getLimitedItems();
        res.json(createSuccessResponse({ items: limitedItems }));

    } catch (error) {
        handleRouteError(error, res);
    }
});

// Toggle item listing status (for marketplace)
router.post('/toggle-listing/:itemId', auth, async (req, res) => {
    try {
        const { userInventory, item } = await findInventoryItem(req.user.id, req.params.itemId);

        if (!item.isLimited) {
            return res.status(400).json(createErrorResponse('Only limited items can be listed on marketplace'));
        }

        if (item.isTrading) {
            return res.status(400).json(createErrorResponse('Item is currently being traded'));
        }

        // Toggle listing status
        item.isListed = !item.isListed;
        await userInventory.save();

        res.json(createSuccessResponse({
            isListed: item.isListed
        }, item.isListed ? 'Item listed for marketplace' : 'Item removed from marketplace'));

    } catch (error) {
        handleRouteError(error, res);
    }
});

// Get item details
router.get('/item/:itemId', auth, async (req, res) => {
    try {
        const { item } = await findInventoryItem(req.user.id, req.params.itemId);
        res.json(createSuccessResponse({ item }));

    } catch (error) {
        handleRouteError(error, res);
    }
});

module.exports = router;    