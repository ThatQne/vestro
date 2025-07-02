const axios = require('axios');

const RANDOM_ORG_API_URL = 'https://api.random.org/json-rpc/4/invoke';
const API_KEY = process.env.RANDOM_ORG_API_KEY;

// Generic function to get random number from Random.org
async function getRandomNumber(min, max) {
    try {
        const response = await axios.post(RANDOM_ORG_API_URL, {
            jsonrpc: '2.0',
            method: 'generateIntegers',
            params: {
                apiKey: API_KEY,
                n: 1,
                min: min,
                max: max,
                replacement: true
            },
            id: Date.now()
        }, {
            timeout: 5000 // 5 second timeout
        });

        if (response.data.error) {
            throw new Error(`Random.org API error: ${response.data.error.message}`);
        }

        return response.data.result.random.data[0];
    } catch (error) {
        console.error('Random.org API error:', error.message);
        
        // Fallback to Math.random if Random.org fails
        console.log('Falling back to Math.random');
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

// Flip a coin (0 = heads, 1 = tails)
async function flipCoin() {
    const result = await getRandomNumber(0, 1);
    return result === 0 ? 'heads' : 'tails';
}

// Roll a dice
async function rollDice(sides = 6) {
    return await getRandomNumber(1, sides);
}

// Get multiple random numbers
async function getRandomNumbers(count, min, max) {
    try {
        const response = await axios.post(RANDOM_ORG_API_URL, {
            jsonrpc: '2.0',
            method: 'generateIntegers',
            params: {
                apiKey: API_KEY,
                n: count,
                min: min,
                max: max,
                replacement: true
            },
            id: Date.now()
        }, {
            timeout: 5000
        });

        if (response.data.error) {
            throw new Error(`Random.org API error: ${response.data.error.message}`);
        }

        return response.data.result.random.data;
    } catch (error) {
        console.error('Random.org API error:', error.message);
        
        // Fallback to Math.random
        const numbers = [];
        for (let i = 0; i < count; i++) {
            numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return numbers;
    }
}

module.exports = {
    getRandomNumber,
    flipCoin,
    rollDice,
    getRandomNumbers
}; 