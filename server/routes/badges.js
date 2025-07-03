const express = require('express');
const router = express.Router();
const Badge = require('../models/Badge');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all badges
router.get('/', auth, async (req, res) => {
    try {
        // Get all badges
        const badges = await Badge.find({});
        
        // Get user's earned badges
        const user = await User.findById(req.user.id);
        const earnedBadges = user.badges || [];

        // Process badges to hide secret ones unless earned
        const processedBadges = badges.map(badge => {
            const earned = earnedBadges.find(eb => eb.code === badge.code);
            
            // If badge is secret and not earned, hide details
            if (badge.secret && !earned) {
                return {
                    code: badge.code,
                    name: '???',
                    description: 'Hidden achievement',
                    icon: 'help-circle',
                    color: '#666666',
                    secret: true,
                    earned: false
                };
            }

            // Return full badge info with earned status
            return {
                code: badge.code,
                name: badge.name,
                description: badge.description,
                icon: badge.icon,
                color: badge.color,
                secret: badge.secret,
                earned: !!earned,
                earnedAt: earned ? earned.earnedAt : null
            };
        });

        res.json({ success: true, badges: processedBadges });
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ success: false, message: 'Error fetching badges' });
    }
});

module.exports = router; 