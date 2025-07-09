const { getRandomNumber } = require('../random');
const crypto = require('crypto');

// Calculate mines multiplier based on mine count and revealed tiles
function calculateMinesMultiplier(mineCount, revealedTiles) {
    if (revealedTiles <= 0) return 1;
    
    const totalTiles = 25;
    const safeTiles = totalTiles - mineCount;
    
    // Calculate probability of revealing N safe tiles
    let multiplier = 1;
    for (let i = 0; i < revealedTiles; i++) {
        const remainingSafeTiles = safeTiles - i;
        const remainingTiles = totalTiles - i;
        const probability = remainingSafeTiles / remainingTiles;
        multiplier *= (1 / probability);
    }
    
    // Apply house edge (97% RTP)
    multiplier *= 0.97;
    
    return Math.max(multiplier, 0.01); // Minimum 0.01x multiplier
}

function validateMineCount(mineCount) {
    if (mineCount < 1 || mineCount > 24) {
        throw new Error('Invalid mine count (1-24)');
    }
}

async function handleMines(playerChoice, betAmount) {
    const mineCount = parseInt(playerChoice) || 3;
    
    // Validate mine count
    validateMineCount(mineCount);
    
    // Generate random hash for provably fair
    const randomResult = await getRandomNumber(0, 1000000);
    
    // Generate minefield (5x5 = 25 tiles)
    const totalTiles = 25;
    
    // Create array of positions
    const positions = Array.from({ length: totalTiles }, (_, i) => i);
    
    // Fisher-Yates shuffle using the random result as seed
    let seed = randomResult.value;
    for (let i = positions.length - 1; i > 0; i--) {
        // Use a different part of the seed for each swap
        seed = (seed * 16807) % 2147483647; // Park-Miller LCG
        const j = seed % (i + 1);
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    // Take first N positions as mines
    const mines = positions.slice(0, mineCount);

    // Create a grid state for client-side prediction
    const gridState = Array(25).fill(false);
    mines.forEach(mineIndex => {
        gridState[mineIndex] = true;
    });

    // Create a verification hash of the grid state
    const gridHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(gridState) + randomResult.hash)
        .digest('hex');
    
    const gameResult = {
        mines,
        mineCount,
        multiplier: 1,
        revealedTiles: 0,
        betAmount,
        active: true,
        cashedOut: false,
        gridState,
        gridHash,
        revealedTilesMap: {}
    };
    
    return {
        gameResult,
        won: false, // Mines games don't "win" until cashout
        multiplier: 1,
        randomHash: randomResult.hash,
        randomTimestamp: randomResult.timestamp
    };
}

module.exports = { 
    handleMines, 
    calculateMinesMultiplier 
}; 