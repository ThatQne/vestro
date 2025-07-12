const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Item = require('../models/Item');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Middleware to attach io to request
router.use((req, res, next) => {
    req.io = req.app.get('io');
    next();
});

// Get all active cases
router.get('/', async (req, res) => {
    try {
        const cases = await Case.find({ isActive: true })
            .populate('items.item')
            .sort({ createdAt: -1 });
        
        const casesWithExpectedValue = await Promise.all(
            cases.map(async (caseItem) => {
                const expectedValue = await caseItem.getExpectedValue();
                return {
                    ...caseItem.toObject(),
                    expectedValue: expectedValue
                };
            })
        );
        
        res.json({
            success: true,
            cases: casesWithExpectedValue
        });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cases'
        });
    }
});

// Get case by ID with items
router.get('/:id', async (req, res) => {
    try {
        const caseItem = await Case.findById(req.params.id)
            .populate('items.item');
        
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }
        
        const expectedValue = await caseItem.getExpectedValue();
        const itemsByRarity = await caseItem.getItemsByRarity();
        
        res.json({
            success: true,
            case: {
                ...caseItem.toObject(),
                expectedValue: expectedValue,
                itemsByRarity: itemsByRarity
            }
        });
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch case'
        });
    }
});

// Open a case
router.post('/:id/open', authenticateToken, async (req, res) => {
    try {
        const caseItem = await Case.findById(req.params.id)
            .populate('items.item');
        
        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            });
        }
        
        if (!caseItem.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Case is not active'
            });
        }
        
        // Check if user has enough balance
        const user = await User.findById(req.user.id);
        if (user.balance < caseItem.price) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }
        
        // Open the case
        const wonItemId = caseItem.openCase();
        const wonItem = await Item.findById(wonItemId);
        
        if (!wonItem) {
            return res.status(500).json({
                success: false,
                message: 'Error processing case opening'
            });
        }
        
        // Deduct case price from user balance
        user.balance -= caseItem.price;
        await user.save();
        
        // Add item to user's inventory
        let inventory = await Inventory.findOne({ user: req.user.id });
        if (!inventory) {
            inventory = new Inventory({ user: req.user.id });
        }
        
        inventory.addItem(wonItemId, 1, 'case', { caseId: caseItem._id });
        await inventory.save();
        
        // Update case statistics
        await caseItem.save();
        
        // Emit real-time update
        if (req.io) {
            req.io.to(`user_${req.user.id}`).emit('caseOpened', {
                case: caseItem.name,
                item: wonItem,
                newBalance: user.balance
            });
        }
        
        res.json({
            success: true,
            item: wonItem,
            newBalance: user.balance,
            message: `You won ${wonItem.name}!`
        });
    } catch (error) {
        console.error('Error opening case:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open case'
        });
    }
});

// Get user's inventory
router.get('/inventory/items', authenticateToken, async (req, res) => {
    try {
        let inventory = await Inventory.findOne({ user: req.user.id })
            .populate('items.item');
        
        if (!inventory) {
            inventory = new Inventory({ user: req.user.id });
            await inventory.save();
        }
        
        const totalValue = await inventory.calculateTotalValue();
        
        // Group items by category and rarity
        const itemsByCategory = {};
        const itemsByRarity = {};
        
        inventory.items.forEach(invItem => {
            const category = invItem.item.category;
            const rarity = invItem.item.rarity;
            
            if (!itemsByCategory[category]) {
                itemsByCategory[category] = [];
            }
            if (!itemsByRarity[rarity]) {
                itemsByRarity[rarity] = [];
            }
            
            const itemData = {
                ...invItem.toObject(),
                sellPrice: invItem.item.getSellPrice(),
                rarityColor: invItem.item.getRarityColor()
            };
            
            itemsByCategory[category].push(itemData);
            itemsByRarity[rarity].push(itemData);
        });
        
        res.json({
            success: true,
            inventory: {
                items: inventory.items,
                totalValue: totalValue,
                itemsByCategory: itemsByCategory,
                itemsByRarity: itemsByRarity,
                limitedItems: await inventory.getLimitedItems()
            }
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inventory'
        });
    }
});

// Sell item from inventory
router.post('/inventory/sell/:itemId', authenticateToken, async (req, res) => {
    try {
        const { quantity = 1 } = req.body;
        const itemId = req.params.itemId;
        
        const inventory = await Inventory.findOne({ user: req.user.id })
            .populate('items.item');
        
        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Inventory not found'
            });
        }
        
        const inventoryItem = inventory.items.find(invItem => 
            invItem.item._id.toString() === itemId
        );
        
        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in inventory'
            });
        }
        
        if (inventoryItem.quantity < quantity) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient quantity'
            });
        }
        
        const sellPrice = inventoryItem.item.getSellPrice();
        const totalSellValue = sellPrice * quantity;
        
        // Remove item from inventory
        inventory.removeItem(itemId, quantity);
        await inventory.save();
        
        // Add money to user balance
        const user = await User.findById(req.user.id);
        user.balance += totalSellValue;
        await user.save();
        
        // Emit real-time update
        if (req.io) {
            req.io.to(`user_${req.user.id}`).emit('itemSold', {
                item: inventoryItem.item.name,
                quantity: quantity,
                sellPrice: totalSellValue,
                newBalance: user.balance
            });
        }
        
        res.json({
            success: true,
            soldPrice: totalSellValue,
            newBalance: user.balance,
            message: `Sold ${quantity}x ${inventoryItem.item.name} for $${totalSellValue.toFixed(2)}`
        });
    } catch (error) {
        console.error('Error selling item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sell item'
        });
    }
});

module.exports = router; 