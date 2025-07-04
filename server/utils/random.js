const axios = require('axios');

const RANDOM_ORG_API_URL = 'https://api.random.org/json-rpc/4/invoke';
const API_KEY = process.env.RANDOM_ORG_API_KEY;

// Generic function to get random number from Random.org
async function getRandomNumber(min, max) {
    try {
        // Validate parameters
        if (typeof min !== 'number' || typeof max !== 'number') {
            throw new Error('Min and max must be numbers');
        }
        
        if (min > max) {
            throw new Error('Min cannot be greater than max');
        }
        
        // Ensure integers
        min = Math.floor(min);
        max = Math.floor(max);
        
        if (!API_KEY) {
            throw new Error('Random.org API key not configured');
        }

        const response = await axios.post(RANDOM_ORG_API_URL, {
            jsonrpc: '2.0',
            method: 'generateSignedIntegers',
            params: {
                apiKey: API_KEY,
                n: 1,
                min: min,
                max: max,
                replacement: true,
                base: 10
            },
            id: Date.now()
        }, {
            timeout: 5000 // 5 second timeout
        });

        if (response.data.error) {
            throw new Error(`Random.org API error: ${response.data.error.message}`);
        }

        const result = response.data.result;
        return {
            value: result.random.data[0],
            hash: result.signature,
            timestamp: result.random.completionTime
        };
    } catch (error) {
        console.error('Random.org API error:', error.message);
        
        // Fallback to Math.random if Random.org fails
        console.log('Falling back to Math.random');
        const value = Math.floor(Math.random() * (max - min + 1)) + min;
        return {
            value: value,
            hash: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Flip a coin (0 = heads, 1 = tails)
async function flipCoin() {
    const result = await getRandomNumber(0, 1);
    return {
        result: result.value === 0 ? 'heads' : 'tails',
        hash: result.hash,
        timestamp: result.timestamp
    };
}

// Roll a dice
async function rollDice(sides = 6) {
    const result = await getRandomNumber(1, sides);
    return {
        result: result.value,
        hash: result.hash,
        timestamp: result.timestamp
    };
}

// Get multiple random numbers
async function getRandomNumbers(count, min, max) {
    try {
        // Validate parameters
        if (typeof count !== 'number' || count <= 0) {
            throw new Error('Count must be a positive number');
        }
        
        if (typeof min !== 'number' || typeof max !== 'number') {
            throw new Error('Min and max must be numbers');
        }
        
        if (min > max) {
            throw new Error('Min cannot be greater than max');
        }
        
        // Ensure integers
        min = Math.floor(min);
        max = Math.floor(max);
        count = Math.floor(count);
        
        if (!API_KEY) {
            throw new Error('Random.org API key not configured');
        }

        const response = await axios.post(RANDOM_ORG_API_URL, {
            jsonrpc: '2.0',
            method: 'generateSignedIntegers',
            params: {
                apiKey: API_KEY,
                n: count,
                min: min,
                max: max,
                replacement: true,
                base: 10
            },
            id: Date.now()
        }, {
            timeout: 5000
        });

        if (response.data.error) {
            throw new Error(`Random.org API error: ${response.data.error.message}`);
        }

        const result = response.data.result;
        return {
            values: result.random.data,
            hash: result.signature,
            timestamp: result.random.completionTime
        };
    } catch (error) {
        console.error('Random.org API error:', error.message);
        
        // Fallback to Math.random
        const values = [];
        for (let i = 0; i < count; i++) {
            values.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return {
            values: values,
            hash: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    getRandomNumber,
    flipCoin,
    rollDice,
    getRandomNumbers
}; 