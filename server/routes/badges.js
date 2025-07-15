const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const CLIENT_BADGES = require('../constants/badges');

// Get user's earned badges only
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Get user's earned badges
        const user = await getUserById(req.user.id);
        if (!user) {
            return res.status(404).json(createErrorResponse('User not found'));
        }
        
        const earnedBadges = user.badges || [];

        // Create a map of badge definitions by code
        const badgeMap = new Map();
        CLIENT_BADGES.forEach(badge => {
            badgeMap.set(badge.code, badge);
        });

        // Return only earned badges with their full data from client definitions
        const processedBadges = earnedBadges.map(earned => {
            const badgeDefinition = badgeMap.get(earned.code);
            return {
                code: earned.code,
                name: badgeDefinition.name,
                description: badgeDefinition.description,
                icon: badgeDefinition.icon,
                color: badgeDefinition.color,
                secret: badgeDefinition.secret,
                earnedAt: earned.earnedAt
            };
        }).filter(badge => badge.name); // Filter out any badges that don't have definitions

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
            return res.status(400).json(createErrorResponse('Invalid client badges data'));
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Create a map of valid badge codes
        const validBadgeCodes = new Set();
        CLIENT_BADGES.forEach(badge => {
            validBadgeCodes.add(badge.code);
        });

        let syncedCount = 0;
        
        // Process each client badge
        for (const clientBadge of clientBadges) {
            // Check if badge code is valid
            if (validBadgeCodes.has(clientBadge.code)) {
                // Check if user already has this badge
                const hasBadge = user.badges.some(b => b.code === clientBadge.code);
                
                if (!hasBadge) {
                    // Add badge to user
                    user.badges.push({
                        code: clientBadge.code,
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