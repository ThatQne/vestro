const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { CLIENT_BADGES } = require('../public/js/constants');

// Get top 50 players for leaderboard
router.get('/', authenticateToken, async (req, res) => {
    try {
        const players = await User.find({}, {
            username: 1,
            balance: 1,
            level: 1,
            gamesPlayed: 1,
            wins: 1,
            losses: 1,
            totalWon: 1,
            bestWin: 1,
            bestWinStreak: 1,
            createdAt: 1
        })
        .sort({ balance: -1 })
        .limit(50)
        .lean();

        // Calculate win rates and add rank
        const playersWithStats = players.map((player, index) => {
            const winRate = player.gamesPlayed > 0 ? (player.wins / player.gamesPlayed) * 100 : 0;
            
            return {
                ...player,
                rank: index + 1,
                winRate: winRate,
                gamesPlayed: player.gamesPlayed || 0,
                totalWon: player.totalWon || 0,
                bestWin: player.bestWin || 0,
                bestWinStreak: player.bestWinStreak || 0
            };
        });

        res.json({
            success: true,
            players: playersWithStats
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard'
        });
    }
});

// Search players by username
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { username } = req.query;
        
        if (!username || username.length < 2) {
            return res.json({
                success: true,
                players: []
            });
        }

        // Find players matching the search query
        const players = await User.find({
            username: { $regex: username, $options: 'i' }
        }, {
            username: 1,
            balance: 1,
            level: 1,
            gamesPlayed: 1,
            wins: 1,
            losses: 1,
            totalWon: 1,
            bestWin: 1,
            bestWinStreak: 1,
            createdAt: 1
        })
        .limit(20)
        .lean();

        // Get all players sorted by balance to calculate ranks
        const allPlayers = await User.find({}, { _id: 1, balance: 1 })
            .sort({ balance: -1 })
            .lean();

        // Create a map of user ID to rank
        const rankMap = new Map();
        allPlayers.forEach((player, index) => {
            rankMap.set(player._id.toString(), index + 1);
        });

        // Calculate win rates and add ranks
        const playersWithStats = players.map(player => {
            const winRate = player.gamesPlayed > 0 ? (player.wins / player.gamesPlayed) * 100 : 0;
            const rank = rankMap.get(player._id.toString()) || 'N/A';
            
            return {
                ...player,
                rank: rank,
                winRate: winRate,
                gamesPlayed: player.gamesPlayed || 0,
                totalWon: player.totalWon || 0,
                bestWin: player.bestWin || 0,
                bestWinStreak: player.bestWinStreak || 0
            };
        });

        res.json({
            success: true,
            players: playersWithStats
        });
    } catch (error) {
        console.error('Error searching players:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search players'
        });
    }
});

// Get detailed player profile by username
router.get('/profile/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Find the player
        const player = await User.findOne({ username: username })
            .lean();

        if (!player) {
            return res.status(404).json({
                success: false,
                message: 'Player not found'
            });
        }

        // Get all players sorted by balance to calculate rank
        const allPlayers = await User.find({}, { _id: 1, balance: 1 })
            .sort({ balance: -1 })
            .lean();

        // Find the player's rank
        const rank = allPlayers.findIndex(p => p._id.toString() === player._id.toString()) + 1;

        // Calculate win rate
        const winRate = player.gamesPlayed > 0 ? (player.wins / player.gamesPlayed) * 100 : 0;

        // Create a map of badge definitions by code
        const badgeMap = new Map();
        CLIENT_BADGES.forEach(badge => {
            badgeMap.set(badge.code, badge);
        });

        // Format badges using client definitions
        const badges = player.badges.map(badge => {
            const badgeDefinition = badgeMap.get(badge.code);
            return {
                code: badge.code,
                name: badgeDefinition.name,
                description: badgeDefinition.description,
                icon: badgeDefinition.icon,
                color: badgeDefinition.color,
                secret: badgeDefinition.secret,
                earnedAt: badge.earnedAt
            };
        }).filter(badge => badge.name); // Filter out any badges that don't have definitions

        const playerProfile = {
            username: player.username,
            balance: player.balance,
            level: player.level,
            experience: player.experience,
            rank: rank,
            winRate: winRate,
            gamesPlayed: player.gamesPlayed || 0,
            totalWon: player.totalWon || 0,
            bestWin: player.bestWin || 0,
            bestWinStreak: player.bestWinStreak || 0,
            currentWinStreak: player.currentWinStreak || 0,
            wins: player.wins || 0,
            losses: player.losses || 0,
            totalWagered: player.totalWagered || 0,
            badges: badges,
            createdAt: player.createdAt,
            lastLogin: player.lastLogin
        };

        res.json({
            success: true,
            user: playerProfile
        });
    } catch (error) {
        console.error('Error fetching player profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch player profile'
        });
    }
});

module.exports = router; 