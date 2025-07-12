const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Item = require('../models/Item');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const MarketplaceListing = require('../models/MarketplaceListing');

// Get active marketplace listings
router.get('/listings', async (req, res) => {
    try {
        const listings = await MarketplaceListing.find({ status: 'active' })
            .populate('item')
            .populate('seller', 'username')
            .sort({ createdAt: -1 });

        // Group listings by item and calculate average prices
        const itemStats = {};
        listings.forEach(listing => {
            if (!itemStats[listing.item._id]) {
                itemStats[listing.item._id] = {
                    totalPrice: 0,
                    count: 0,
                    minPrice: Infinity,
                    maxPrice: 0
                };
            }
            const stats = itemStats[listing.item._id];
            stats.totalPrice += listing.price;
            stats.count++;
            stats.minPrice = Math.min(stats.minPrice, listing.price);
            stats.maxPrice = Math.max(stats.maxPrice, listing.price);
        });

        // Add price statistics to listings
        const listingsWithStats = listings.map(listing => {
            const stats = itemStats[listing.item._id];
            return {
                ...listing.toObject(),
                priceStats: {
                    average: stats.totalPrice / stats.count,
                    min: stats.minPrice,
                    max: stats.maxPrice,
                    listings: stats.count
                }
            };
        });

        res.json({
            success: true,
            listings: listingsWithStats
        });
    } catch (error) {
        console.error('Error fetching marketplace listings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch marketplace listings'
        });
    }
});

// Get item price history
router.get('/history/:itemId', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sales = await MarketplaceListing.find({
            item: req.params.itemId,
            status: 'sold',
            updatedAt: { $gte: thirtyDaysAgo }
        })
        .sort({ updatedAt: 1 })
        .select('price updatedAt');

        // Group sales by day and calculate average price
        const dailyPrices = {};
        sales.forEach(sale => {
            const date = sale.updatedAt.toISOString().split('T')[0];
            if (!dailyPrices[date]) {
                dailyPrices[date] = {
                    total: 0,
                    count: 0
                };
            }
            dailyPrices[date].total += sale.price;
            dailyPrices[date].count++;
        });

        // Convert to array and fill missing days
        const priceHistory = [];
        let currentDate = new Date(thirtyDaysAgo);
        const endDate = new Date();

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayStats = dailyPrices[dateStr];
            priceHistory.push({
                date: dateStr,
                price: dayStats ? dayStats.total / dayStats.count : null
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json({
            success: true,
            priceHistory
        });
    } catch (error) {
        console.error('Error fetching price history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch price history'
        });
    }
});

// Create new listing
router.post('/list', authenticateToken, async (req, res) => {
    try {
        const { itemId, price } = req.body;

        // Validate input
        if (!itemId || !price || price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid listing parameters'
            });
        }

        // Check if item exists in user's inventory
        const inventory = await Inventory.findOne({ user: req.user.id })
            .populate('items.item');

        const inventoryItem = inventory.items.find(item => 
            item.item._id.toString() === itemId
        );

        if (!inventoryItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in inventory'
            });
        }

        // Check if item is limited and can be listed
        if (!inventoryItem.item.isLimited) {
            return res.status(400).json({
                success: false,
                message: 'Only limited items can be listed on marketplace'
            });
        }

        // Remove item from inventory
        inventory.removeItem(itemId, 1);
        await inventory.save();

        // Create listing
        const listing = new MarketplaceListing({
            item: itemId,
            seller: req.user.id,
            price,
            status: 'active'
        });
        await listing.save();

        // Emit real-time update
        if (req.io) {
            req.io.emit('listingCreated', {
                listing: {
                    ...listing.toObject(),
                    seller: { username: req.user.username }
                }
            });
        }

        res.json({
            success: true,
            listing: listing.toObject(),
            message: 'Item listed successfully'
        });
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create listing'
        });
    }
});

// Purchase item from marketplace
router.post('/purchase/:listingId', authenticateToken, async (req, res) => {
    try {
        const listing = await MarketplaceListing.findById(req.params.listingId)
            .populate('item')
            .populate('seller', 'username');

        if (!listing || listing.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'Listing not found or no longer active'
            });
        }

        // Check if user has enough balance
        const buyer = await User.findById(req.user.id);
        if (buyer.balance < listing.price) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // Process transaction
        buyer.balance -= listing.price;
        await buyer.save();

        const seller = await User.findById(listing.seller);
        seller.balance += listing.price;
        await seller.save();

        // Add item to buyer's inventory
        let buyerInventory = await Inventory.findOne({ user: req.user.id });
        if (!buyerInventory) {
            buyerInventory = new Inventory({ user: req.user.id });
        }
        buyerInventory.addItem(listing.item._id, 1, 'marketplace', { 
            listingId: listing._id 
        });
        await buyerInventory.save();

        // Update listing status
        listing.status = 'sold';
        listing.buyer = req.user.id;
        listing.soldAt = new Date();
        await listing.save();

        // Emit real-time updates
        if (req.io) {
            req.io.emit('listingSold', {
                listingId: listing._id,
                item: listing.item.name,
                price: listing.price,
                buyer: buyer.username,
                seller: seller.username
            });

            // Send personal notifications
            req.io.to(`user_${seller._id}`).emit('itemSold', {
                item: listing.item.name,
                price: listing.price,
                newBalance: seller.balance
            });

            req.io.to(`user_${buyer._id}`).emit('itemPurchased', {
                item: listing.item.name,
                price: listing.price,
                newBalance: buyer.balance
            });
        }

        res.json({
            success: true,
            message: 'Item purchased successfully',
            newBalance: buyer.balance
        });
    } catch (error) {
        console.error('Error purchasing item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to purchase item'
        });
    }
});

// Cancel listing
router.post('/cancel/:listingId', authenticateToken, async (req, res) => {
    try {
        const listing = await MarketplaceListing.findById(req.params.listingId)
            .populate('item');

        if (!listing || listing.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'Listing not found or no longer active'
            });
        }

        if (listing.seller.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only the seller can cancel this listing'
            });
        }

        // Return item to seller's inventory
        let sellerInventory = await Inventory.findOne({ user: req.user.id });
        if (!sellerInventory) {
            sellerInventory = new Inventory({ user: req.user.id });
        }
        sellerInventory.addItem(listing.item._id, 1, 'marketplace_return', { 
            listingId: listing._id 
        });
        await sellerInventory.save();

        // Update listing status
        listing.status = 'cancelled';
        await listing.save();

        // Emit real-time update
        if (req.io) {
            req.io.emit('listingCancelled', {
                listingId: listing._id,
                item: listing.item.name
            });
        }

        res.json({
            success: true,
            message: 'Listing cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel listing'
        });
    }
});

module.exports = router; 