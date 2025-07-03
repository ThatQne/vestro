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

module.exports = router; 