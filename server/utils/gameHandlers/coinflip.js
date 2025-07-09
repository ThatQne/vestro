const { getRandomNumber } = require('../random');

async function handleCoinflip(playerChoice) {
    const randomResult = await getRandomNumber(0, 1);
    const gameResult = randomResult.value === 0 ? 'heads' : 'tails';
    const won = gameResult === playerChoice.toLowerCase();
    const multiplier = 2; // 2x payout for coin flip
    
    return {
        gameResult,
        won,
        multiplier,
        randomHash: randomResult.hash,
        randomTimestamp: randomResult.timestamp
    };
}

module.exports = { handleCoinflip }; 