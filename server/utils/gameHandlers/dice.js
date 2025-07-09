const { getRandomNumber } = require('../random');

async function handleDice(playerChoice, targetNumber) {
    // Generate a random number between 0 and 10000 for precision
    const randomResult = await getRandomNumber(0, 10000);
    const roll = randomResult.value / 100; // Convert to 0-100 with 2 decimal places
    const gameResult = roll.toFixed(2);
    
    let won = false;
    let multiplier = 1;
    
    if (playerChoice === 'higher') {
        won = roll > targetNumber;
        // Calculate multiplier (99% RTP)
        multiplier = 0.99 / ((100 - targetNumber) / 100);
    } else if (playerChoice === 'lower') {
        won = roll < targetNumber;
        // Calculate multiplier (99% RTP)
        multiplier = 0.99 / (targetNumber / 100);
    }
    
    return {
        gameResult,
        won,
        multiplier,
        randomHash: randomResult.hash,
        randomTimestamp: randomResult.timestamp
    };
}

module.exports = { handleDice }; 