const { randomBetween } = require('../random');

// Card values and suits
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Create a new deck of cards
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ 
                suit, 
                value, 
                color: (suit === '♥' || suit === '♦') ? 'red' : 'black' 
            });
        }
    }
    return shuffleDeck(deck);
}

// Shuffle deck using Fisher-Yates algorithm
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Calculate hand value
function calculateHandValue(cards) {
    let value = 0;
    let aces = 0;
    
    for (const card of cards) {
        if (card.value === 'A') {
            aces++;
            value += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value);
        }
    }
    
    // Adjust for aces
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    
    return value;
}

// Check if hand is blackjack (21 with 2 cards)
function isBlackjack(cards) {
    return cards.length === 2 && calculateHandValue(cards) === 21;
}

// Check if hand is bust
function isBust(cards) {
    return calculateHandValue(cards) > 21;
}

// Dealer logic - hits on soft 17
function shouldDealerHit(cards) {
    const value = calculateHandValue(cards);
    if (value < 17) return true;
    if (value > 17) return false;
    
    // Check for soft 17 (17 with ace counted as 11)
    let hasAce = false;
    let softValue = 0;
    
    for (const card of cards) {
        if (card.value === 'A') {
            hasAce = true;
            softValue += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            softValue += 10;
        } else {
            softValue += parseInt(card.value);
        }
    }
    
    // If we have an ace and the soft value is 17, dealer hits
    return hasAce && softValue === 17;
}

// Basic strategy for autoplay
function getBasicStrategyAction(playerCards, dealerUpCard, canDouble = true) {
    const playerValue = calculateHandValue(playerCards);
    const dealerValue = dealerUpCard.value === 'A' ? 11 : 
                       ['J', 'Q', 'K'].includes(dealerUpCard.value) ? 10 : 
                       parseInt(dealerUpCard.value);
    
    // Check for pairs
    if (playerCards.length === 2 && playerCards[0].value === playerCards[1].value) {
        const pairValue = playerCards[0].value;
        
        // Always split aces and 8s
        if (pairValue === 'A' || pairValue === '8') return 'split';
        
        // Never split 4s, 5s, 10s
        if (pairValue === '4' || pairValue === '5' || 
            ['10', 'J', 'Q', 'K'].includes(pairValue)) return 'hit';
        
        // Split 2s, 3s, 6s, 7s against dealer 2-7
        if (['2', '3', '6', '7'].includes(pairValue) && dealerValue >= 2 && dealerValue <= 7) {
            return 'split';
        }
        
        // Split 9s against dealer 2-9 except 7
        if (pairValue === '9' && dealerValue >= 2 && dealerValue <= 9 && dealerValue !== 7) {
            return 'split';
        }
    }
    
    // Check for soft hands (with ace)
    let hasAce = false;
    let softValue = 0;
    
    for (const card of playerCards) {
        if (card.value === 'A') {
            hasAce = true;
            softValue += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            softValue += 10;
        } else {
            softValue += parseInt(card.value);
        }
    }
    
    if (hasAce && softValue !== playerValue) {
        // Soft hand strategy
        if (softValue >= 19) return 'stand';
        if (softValue === 18) {
            if (dealerValue >= 2 && dealerValue <= 6) return canDouble ? 'double' : 'stand';
            if (dealerValue === 7 || dealerValue === 8) return 'stand';
            return 'hit';
        }
        if (softValue === 17) {
            return (dealerValue >= 3 && dealerValue <= 6 && canDouble) ? 'double' : 'hit';
        }
        if (softValue >= 15) {
            return (dealerValue >= 4 && dealerValue <= 6 && canDouble) ? 'double' : 'hit';
        }
        if (softValue >= 13) {
            return (dealerValue >= 5 && dealerValue <= 6 && canDouble) ? 'double' : 'hit';
        }
        return 'hit';
    }
    
    // Hard hand strategy
    if (playerValue >= 17) return 'stand';
    if (playerValue >= 13) return (dealerValue >= 2 && dealerValue <= 6) ? 'stand' : 'hit';
    if (playerValue === 12) return (dealerValue >= 4 && dealerValue <= 6) ? 'stand' : 'hit';
    if (playerValue === 11) return canDouble ? 'double' : 'hit';
    if (playerValue === 10) {
        return (dealerValue >= 2 && dealerValue <= 9 && canDouble) ? 'double' : 'hit';
    }
    if (playerValue === 9) {
        return (dealerValue >= 3 && dealerValue <= 6 && canDouble) ? 'double' : 'hit';
    }
    
    return 'hit';
}

// Deal initial cards
async function dealBlackjack(betAmount) {
    const deck = createDeck();
    
    // Deal initial cards
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCards = [deck.pop(), deck.pop()];
    
    const playerValue = calculateHandValue(playerCards);
    const dealerValue = calculateHandValue(dealerCards);
    
    // Check for blackjacks
    const playerBlackjack = isBlackjack(playerCards);
    const dealerBlackjack = isBlackjack(dealerCards);
    
    let gameStatus = 'playing';
    let multiplier = 1;
    let winAmount = 0;
    
    if (playerBlackjack && dealerBlackjack) {
        gameStatus = 'push';
        multiplier = 1;
        winAmount = betAmount; // Return bet
    } else if (playerBlackjack) {
        gameStatus = 'blackjack';
        multiplier = 2.5; // 3:2 payout
        winAmount = betAmount * multiplier;
    } else if (dealerBlackjack) {
        gameStatus = 'dealer_blackjack';
        multiplier = 0;
        winAmount = 0;
    }
    
    return {
        deck,
        playerCards,
        dealerCards,
        playerValue,
        dealerValue,
        gameStatus,
        multiplier,
        winAmount,
        canDouble: true,
        canSplit: playerCards[0].value === playerCards[1].value
    };
}

// Player hits
async function hitBlackjack(gameState) {
    const { deck, playerCards } = gameState;
    
    if (deck.length === 0) {
        throw new Error('Deck is empty');
    }
    
    const newCard = deck.pop();
    playerCards.push(newCard);
    
    const playerValue = calculateHandValue(playerCards);
    let gameStatus = gameState.gameStatus;
    let multiplier = gameState.multiplier;
    let winAmount = gameState.winAmount;
    
    if (isBust(playerCards)) {
        gameStatus = 'bust';
        multiplier = 0;
        winAmount = 0;
    }
    
    return {
        ...gameState,
        deck,
        playerCards,
        playerValue,
        gameStatus,
        multiplier,
        winAmount,
        canDouble: false, // Can't double after hitting
        canSplit: false   // Can't split after hitting
    };
}

// Player stands - dealer plays
async function standBlackjack(gameState) {
    const { deck, playerCards, dealerCards } = gameState;
    
    const playerValue = calculateHandValue(playerCards);
    let dealerValue = calculateHandValue(dealerCards);
    
    // Dealer plays
    while (shouldDealerHit(dealerCards)) {
        if (deck.length === 0) {
            throw new Error('Deck is empty');
        }
        
        const newCard = deck.pop();
        dealerCards.push(newCard);
        dealerValue = calculateHandValue(dealerCards);
    }
    
    // Determine winner
    let gameStatus, multiplier, winAmount;
    
    if (isBust(dealerCards)) {
        gameStatus = 'win';
        multiplier = 2;
        winAmount = gameState.betAmount * multiplier;
    } else if (playerValue > dealerValue) {
        gameStatus = 'win';
        multiplier = 2;
        winAmount = gameState.betAmount * multiplier;
    } else if (playerValue < dealerValue) {
        gameStatus = 'lose';
        multiplier = 0;
        winAmount = 0;
    } else {
        gameStatus = 'push';
        multiplier = 1;
        winAmount = gameState.betAmount; // Return bet
    }
    
    return {
        ...gameState,
        deck,
        dealerCards,
        dealerValue,
        gameStatus,
        multiplier,
        winAmount
    };
}

// Player doubles down
async function doubleBlackjack(gameState) {
    const { deck, playerCards, betAmount } = gameState;
    
    if (!gameState.canDouble) {
        throw new Error('Cannot double at this time');
    }
    
    if (deck.length === 0) {
        throw new Error('Deck is empty');
    }
    
    // Double the bet
    const newBetAmount = betAmount * 2;
    
    // Deal one card
    const newCard = deck.pop();
    playerCards.push(newCard);
    
    const playerValue = calculateHandValue(playerCards);
    
    // Check if player busted
    if (isBust(playerCards)) {
        return {
            ...gameState,
            deck,
            playerCards,
            playerValue,
            betAmount: newBetAmount,
            gameStatus: 'bust',
            multiplier: 0,
            winAmount: 0,
            canDouble: false,
            canSplit: false
        };
    }
    
    // Player must stand after doubling, so dealer plays
    const standResult = await standBlackjack({
        ...gameState,
        deck,
        playerCards,
        playerValue,
        betAmount: newBetAmount,
        canDouble: false,
        canSplit: false
    });
    
    return standResult;
}

module.exports = {
    dealBlackjack,
    hitBlackjack,
    standBlackjack,
    doubleBlackjack,
    calculateHandValue,
    isBlackjack,
    isBust,
    getBasicStrategyAction,
    createDeck,
    shuffleDeck
}; 