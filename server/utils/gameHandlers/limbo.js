const { getRandomNumber } = require('../random');

/**
 * Limbo game logic:
 * - User sets a multiplier (min 1.01)
 * - Roll a random multiplier (provably fair)
 * - If rolled multiplier >= user multiplier, win bet * user multiplier
 * - Else, lose bet
 * - House edge: 1% (99% RTP)
 */
async function handleLimbo(playerChoice) {
    // playerChoice is the multiplier as a string
    let userMultiplier = parseFloat(playerChoice);
    if (isNaN(userMultiplier) || userMultiplier < 1.01) {
        userMultiplier = 1.01;
    }

    // Calculate win probability (99% RTP)
    // P(win) = 0.99 / userMultiplier
    const winProbability = 0.99 / userMultiplier;

    // Roll a random float between 0 and 1
    const randomResult = await getRandomNumber(0, 1000000);
    const roll = randomResult.value / 1000000;

    // If roll < winProbability, user wins
    const won = roll < winProbability;
    const multiplier = won ? userMultiplier : 0;

    // For animation, reveal the actual rolled multiplier
    // The rolled multiplier is: 0.99 / roll
    const rolledMultiplier = Math.max(1.01, 0.99 / roll);

    const gameResult = {
        userMultiplier,
        rolledMultiplier: parseFloat(rolledMultiplier.toFixed(2)),
        winProbability: parseFloat((winProbability * 100).toFixed(2)),
        roll: parseFloat(roll.toFixed(6)),
    };

    return {
        gameResult,
        won,
        multiplier,
        randomHash: randomResult.hash,
        randomTimestamp: randomResult.timestamp
    };
}

module.exports = { handleLimbo }; 