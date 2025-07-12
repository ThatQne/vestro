const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const MarketplaceListing = require('../models/MarketplaceListing');
const UserInventory = require('../models/UserInventory');
const User = require('../models/User');

// Get all marketplace listings
router.get('/listings', async (req, res) => {
    try {
        const { rarity, sort = 'newest', limit = 20, page = 1 } = req.query;
        const skip = (page - 1) * limit;
        
        let query = { status: 'active', expiresAt: { $gt: new Date() } };
        
        if (rarity) {
            query.itemRarity = rarity;
        }
        
        let sortOption = {};
        switch (sort) {
            case 'price_low':
                sortOption = { listPrice: 1 };
                break;
            case 'price_high':
                sortOption = { listPrice: -1 };
                break;
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            case 'oldest':
                sortOption = { createdAt: 1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }
        
        const listings = await MarketplaceListing.find(query)
            .populate('sellerId', 'username')
            .sort(sortOption)
            .skip(skip)
            .limit(parseInt(limit));
        
        const totalCount = await MarketplaceListing.countDocuments(query);
        
        res.json({
            success: true,
            listings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching marketplace listings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create a marketplace listing
router.post('/list', auth, async (req, res) => {
    try {
        const { itemId, listPrice } = req.body;
        
        if (!itemId || !listPrice || listPrice <= 0) {
            return res.status(400).json({ success: false, message: 'Item ID and valid price are required' });
        }
        
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (!userInventory) {
            return res.status(404).json({ success: false, message: 'Inventory not found' });
        }
        
        const item = userInventory.items.find(item => item._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        if (!item.isLimited) {
            return res.status(400).json({ success: false, message: 'Only limited items can be listed on marketplace' });
        }
        
        if (item.isListed || item.isTrading) {
            return res.status(400).json({ success: false, message: 'Item is already listed or being traded' });
        }
        
        // Create marketplace listing
        const listing = new MarketplaceListing({
            sellerId: req.user.id,
            itemId: itemId,
            itemName: item.itemName,
            itemImage: item.image,
            itemRarity: item.rarity,
            baseValue: item.value,
            listPrice: listPrice,
            currentMarketPrice: item.currentPrice || item.value
        });
        
        await listing.save();
        
        // Mark item as listed
        item.isListed = true;
        await userInventory.save();
        
        // Emit real-time update
        const io = req.app.get('io');
        io.emit('marketplace-listing-created', {
            listingId: listing._id,
            itemName: item.itemName,
            listPrice: listPrice,
            seller: req.user.username
        });
        
        res.json({
            success: true,
            message: 'Item listed successfully!',
            listing: listing
        });
        
    } catch (error) {
        console.error('Error creating marketplace listing:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Purchase an item from marketplace
router.post('/purchase/:listingId', auth, async (req, res) => {
    try {
        const listing = await MarketplaceListing.findById(req.params.listingId);
        if (!listing) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }
        
        if (listing.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Listing is not active' });
        }
        
        if (listing.sellerId.toString() === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot purchase your own item' });
        }
        
        const buyer = await User.findById(req.user.id);
        const seller = await User.findById(listing.sellerId);
        
        if (!buyer || !seller) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Check if buyer has enough balance
        if (buyer.balance < listing.listPrice) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }
        
        // Transfer money
        buyer.balance -= listing.listPrice;
        seller.balance += listing.listPrice;
        
        // Update balance histories
        buyer.balanceHistory.push(buyer.balance);
        seller.balanceHistory.push(seller.balance);
        
        await buyer.save();
        await seller.save();
        
        // Transfer item
        const sellerInventory = await UserInventory.findOne({ userId: listing.sellerId });
        const buyerInventory = await UserInventory.findOne({ userId: req.user.id }) || new UserInventory({ userId: req.user.id });
        
        const item = sellerInventory.items.find(item => item._id.toString() === listing.itemId.toString());
        if (item) {
            // Add item to buyer's inventory
            await buyerInventory.addItem({
                name: item.itemName,
                caseSource: item.caseSource,
                value: item.value,
                isLimited: item.isLimited,
                image: item.image,
                rarity: item.rarity
            });
            
            // Remove item from seller's inventory
            await sellerInventory.removeItem(listing.itemId.toString());
        }
        
        // Complete the purchase
        await listing.purchase(req.user.id, listing.listPrice);
        
        // Emit real-time updates
        const io = req.app.get('io');
        io.to(req.user.id).emit('marketplace-purchase', {
            itemName: listing.itemName,
            price: listing.listPrice,
            newBalance: buyer.balance
        });
        
        io.to(listing.sellerId.toString()).emit('marketplace-sale', {
            itemName: listing.itemName,
            price: listing.listPrice,
            buyer: buyer.username,
            newBalance: seller.balance
        });
        
        io.emit('marketplace-transaction', {
            itemName: listing.itemName,
            price: listing.listPrice,
            buyer: buyer.username,
            seller: seller.username
        });
        
        res.json({
            success: true,
            message: 'Item purchased successfully!',
            purchase: {
                itemName: listing.itemName,
                price: listing.listPrice,
                newBalance: buyer.balance
            }
        });
        
    } catch (error) {
        console.error('Error purchasing item:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Cancel a marketplace listing
router.post('/cancel/:listingId', auth, async (req, res) => {
    try {
        const listing = await MarketplaceListing.findById(req.params.listingId);
        if (!listing) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }
        
        if (listing.sellerId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to cancel this listing' });
        }
        
        if (listing.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Listing is not active' });
        }
        
        // Cancel the listing
        await listing.cancel();
        
        // Unmark item as listed
        const userInventory = await UserInventory.findOne({ userId: req.user.id });
        if (userInventory) {
            const item = userInventory.items.find(item => item._id.toString() === listing.itemId.toString());
            if (item) {
                item.isListed = false;
                await userInventory.save();
            }
        }
        
        res.json({
            success: true,
            message: 'Listing cancelled successfully!'
        });
        
    } catch (error) {
        console.error('Error cancelling listing:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get price history for an item
router.get('/price-history/:itemName', async (req, res) => {
    try {
        const { itemName } = req.params;
        const { days = 30 } = req.query;
        
        const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const sales = await MarketplaceListing.find({
            itemName: itemName,
            status: 'sold',
            soldAt: { $gte: daysAgo }
        }).sort({ soldAt: 1 });
        
        const priceHistory = sales.map(sale => ({
            price: sale.soldPrice,
            date: sale.soldAt
        }));
        
        // Calculate current market price
        const currentMarketPrice = sales.length > 0 
            ? sales.reduce((sum, sale) => sum + sale.soldPrice, 0) / sales.length 
            : 0;
        
        res.json({
            success: true,
            itemName: itemName,
            priceHistory: priceHistory,
            currentMarketPrice: Math.round(currentMarketPrice * 100) / 100,
            totalSales: sales.length,
            dateRange: {
                from: daysAgo,
                to: new Date()
            }
        });
        
    } catch (error) {
        console.error('Error fetching price history:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user's marketplace listings
router.get('/my-listings', auth, async (req, res) => {
    try {
        const listings = await MarketplaceListing.find({ sellerId: req.user.id })
            .sort({ createdAt: -1 });
        
        res.json({ success: true, listings });
        
    } catch (error) {
        console.error('Error fetching user listings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get marketplace statistics
router.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const [
            totalListings,
            activeListings,
            soldLast24h,
            soldLast7d,
            totalVolume24h,
            totalVolume7d
        ] = await Promise.all([
            MarketplaceListing.countDocuments(),
            MarketplaceListing.countDocuments({ status: 'active' }),
            MarketplaceListing.countDocuments({ 
                status: 'sold', 
                soldAt: { $gte: last24Hours } 
            }),
            MarketplaceListing.countDocuments({ 
                status: 'sold', 
                soldAt: { $gte: last7Days } 
            }),
            MarketplaceListing.aggregate([
                { $match: { status: 'sold', soldAt: { $gte: last24Hours } } },
                { $group: { _id: null, total: { $sum: '$soldPrice' } } }
            ]),
            MarketplaceListing.aggregate([
                { $match: { status: 'sold', soldAt: { $gte: last7Days } } },
                { $group: { _id: null, total: { $sum: '$soldPrice' } } }
            ])
        ]);
        
        res.json({
            success: true,
            stats: {
                totalListings,
                activeListings,
                soldLast24h,
                soldLast7d,
                totalVolume24h: totalVolume24h[0]?.total || 0,
                totalVolume7d: totalVolume7d[0]?.total || 0
            }
        });
        
    } catch (error) {
        console.error('Error fetching marketplace stats:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router; 