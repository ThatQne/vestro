const { getRandomNumber } = require('../random');

// Plinko multiplier tables
const PLINKO_MULTIPLIERS = {
    low: {
        8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
        12: [8.1, 3.0, 1.6, 1.0, 0.7, 0.7, 0.5, 0.7, 0.7, 1.0, 1.6, 3.0, 8.1],
        16: [16.0, 9.0, 2.0, 1.4, 1.1, 1.0, 0.5, 0.3, 0.5, 0.3, 0.5, 1.0, 1.1, 1.4, 2.0, 9.0, 16.0]
    },
    medium: {
        8: [13.0, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13.0],
        12: [24.0, 5.0, 2.0, 1.4, 0.6, 0.4, 0.2, 0.4, 0.6, 1.4, 2.0, 5.0, 24.0],
        16: [110.0, 41.0, 10.0, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10.0, 41.0, 110.0]
    },
    high: {
        8: [29.0, 4.0, 1.5, 0.2, 0.2, 0.2, 1.5, 4.0, 29.0],
        12: [58.0, 8.0, 2.5, 1.0, 0.2, 0.2, 0.1, 0.2, 0.2, 1.0, 2.5, 8.0, 58.0],
        16: [1000.0, 130.0, 26.0, 9.0, 4.0, 2.0, 0.7, 0.2, 0.1, 0.2, 0.7, 2.0, 4.0, 9.0, 26.0, 130.0, 1000.0]
    }
};

function validatePlinkoParams(risk, rowCount) {
    if (!['low', 'medium', 'high'].includes(risk)) {
        throw new Error('Invalid risk level');
    }
    
    if (![8, 12, 16].includes(rowCount)) {
        throw new Error('Invalid row count');
    }
}

async function handlePlinko(playerChoice) {
    const [risk, rows] = playerChoice.split('-');
    const rowCount = parseInt(rows);
    
    // Validate parameters
    validatePlinkoParams(risk, rowCount);
    
    // Generate random hash for provably fair
    const randomResult = await getRandomNumber(0, 1000000);
    
    const validMultipliers = PLINKO_MULTIPLIERS[risk][rowCount];
    
    // Generate random bucket index using binomial distribution
    const bucketCount = rowCount + 1;
    let sum = 0;
    for (let i = 0; i < rowCount; i++) {
        sum += Math.random() < 0.5 ? 1 : 0;
    }
    const bucketIndex = Math.min(Math.max(sum, 0), bucketCount - 1);
    
    const multiplier = validMultipliers[bucketIndex];
    const won = multiplier > 0;
    
    const gameResult = {
        bucketIndex,
        multiplier,
        risk,
        rows: rowCount
    };
    
    return {
        gameResult,
        won,
        multiplier,
        randomHash: randomResult.hash,
        randomTimestamp: randomResult.timestamp
    };
}

module.exports = { handlePlinko }; 