const express = require('express');
const router = express.Router();
const Badge = require('../models/Badge');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Get all badges
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Get all badges
        const badges = await Badge.find({});
        
        // Get user's earned badges
        const user = await User.findById(req.user.userId).populate('badges.badgeId');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const earnedBadges = user.badges || [];

        // Process badges to hide secret ones unless earned
        const processedBadges = badges.map(badge => {
            const earned = earnedBadges.find(eb => eb.badgeId && eb.badgeId._id.toString() === badge._id.toString());
            
            // If badge is secret and not earned, skip it entirely
            if (badge.secret && !earned) {
                return null;
            }

            // Return full badge info with earned status
            return {
                _id: badge._id,
                name: badge.name,
                description: badge.description,
                icon: badge.icon,
                color: badge.color,
                secret: badge.secret,
                earned: !!earned,
                earnedAt: earned ? earned.earnedAt : null
            };
        }).filter(badge => badge !== null); // Remove null entries

        res.json({ success: true, badges: processedBadges });
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ success: false, message: 'Error fetching badges' });
    }
});

// Sync client-side badges to server (for migration)
router.post('/sync', authenticateToken, async (req, res) => {
    try {
        const { clientBadges } = req.body;
        
        if (!clientBadges || !Array.isArray(clientBadges)) {
            return res.status(400).json({ success: false, message: 'Invalid client badges data' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get all badges from database
        const badges = await Badge.find({});
        const badgeMap = new Map();
        badges.forEach(badge => {
            badgeMap.set(badge.code, badge);
        });

        let syncedCount = 0;
        
        // Process each client badge
        for (const clientBadge of clientBadges) {
            const serverBadge = badgeMap.get(clientBadge.code);
            
            if (serverBadge) {
                // Check if user already has this badge
                const hasBadge = user.badges.some(b => b.badgeId.equals(serverBadge._id));
                
                if (!hasBadge) {
                    // Add badge to user
                    user.badges.push({
                        badgeId: serverBadge._id,
                        earnedAt: new Date(clientBadge.earnedAt)
                    });
                    syncedCount++;
                }
            }
        }

        if (syncedCount > 0) {
            await user.save();
        }

        res.json({ 
            success: true, 
            message: `Synced ${syncedCount} badges`,
            syncedCount 
        });
    } catch (error) {
        console.error('Error syncing badges:', error);
        res.status(500).json({ success: false, message: 'Error syncing badges' });
    }
});

module.exports = router; 