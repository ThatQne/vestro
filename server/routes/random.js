const express = require('express');
const { getRandomNumber, flipCoin, rollDice } = require('../utils/random');

const router = express.Router();

// Get random number
router.post('/number', async (req, res) => {
    try {
        const { min = 1, max = 100 } = req.body;
        
        const number = await getRandomNumber(min, max);
        
        res.json({
            success: true,
            number,
            min,
            max
        });
    } catch (error) {
        console.error('Random number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate random number'
        });
    }
});

// Flip coin
router.post('/coinflip', async (req, res) => {
    try {
        const result = await flipCoin();
        
        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Coin flip error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to flip coin'
        });
    }
});

// Roll dice
router.post('/dice', async (req, res) => {
    try {
        const { sides = 6 } = req.body;
        const result = await rollDice(sides);
        
        res.json({
            success: true,
            result,
            sides
        });
    } catch (error) {
        console.error('Dice roll error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to roll dice'
        });
    }
});

module.exports = router; 