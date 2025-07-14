const mongoose = require('mongoose');

const caseBattleSchema = new mongoose.Schema({
    battleId: {
        type: String,
        required: true,
        unique: true
    },
    mode: {
        type: String,
        enum: ['1v1', '2v2', '1v1v1', '1v1v1v1'],
        required: true
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: 2,
        max: 4
    },
    cases: [{
        caseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Case',
            required: true
        },
        caseName: {
            type: String,
            required: true
        },
        casePrice: {
            type: Number,
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1,
            max: 25
        }
    }],
    totalCost: {
        type: Number,
        required: true,
        min: 0
    },
    players: [{
        userId: {
            type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String for bots
            required: true
        },
        username: {
            type: String,
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        isBot: {
            type: Boolean,
            default: false
        },
        isCreator: {
            type: Boolean,
            default: false
        },
        items: [{
            itemName: {
                type: String,
                required: true
            },
            itemValue: {
                type: Number,
                required: true
            },
            itemImage: {
                type: String,
                default: 'default-item.png'
            },
            itemRarity: {
                type: String,
                enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'],
                required: true
            },
            caseSource: {
                type: String,
                required: true
            },
            isLimited: {
                type: Boolean,
                default: false
            },
            openedAt: {
                type: Date,
                default: Date.now
            }
        }],
        totalValue: {
            type: Number,
            default: 0
        },
        isWinner: {
            type: Boolean,
            default: false
        }
    }],
    openings: [{
        playerId: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        playerName: {
            type: String,
            required: true
        },
        caseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Case',
            required: true
        },
        caseName: {
            type: String,
            required: true
        },
        item: {
            itemName: String,
            itemValue: Number,
            itemImage: String,
            itemRarity: String,
            isLimited: Boolean
        },
        openedAt: {
            type: Date,
            default: Date.now
        },
        order: {
            type: Number,
            required: true
        }
    }],
    status: {
        type: String,
        enum: ['waiting', 'starting', 'in_progress', 'completed', 'cancelled'],
        default: 'waiting'
    },
    winnerId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    winnerUsername: {
        type: String,
        default: null
    },
    totalPrizeValue: {
        type: Number,
        default: 0
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    startedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        }
    },
    currentOpeningIndex: {
        type: Number,
        default: 0
    }
});

// Calculate total cost and values before saving
caseBattleSchema.pre('save', function(next) {
    // Calculate total cost
    this.totalCost = this.cases.reduce((sum, caseItem) => sum + (caseItem.casePrice * caseItem.quantity), 0);
    
    // Calculate total values for each player
    this.players.forEach(player => {
        player.totalValue = player.items.reduce((sum, item) => sum + item.itemValue, 0);
    });
    
    // Calculate total prize value
    this.totalPrizeValue = this.players.reduce((sum, player) => sum + player.totalValue, 0);
    
    next();
});

// Method to add a player
caseBattleSchema.methods.addPlayer = function(userId, username, isBot = false, isCreator = false) {
    if (this.players.length >= this.maxPlayers) {
        throw new Error('Battle is full');
    }
    
    // Check if player already joined
    if (this.players.some(p => p.userId.toString() === userId.toString())) {
        throw new Error('Player already joined this battle');
    }
    
    this.players.push({
        userId: userId,
        username: username,
        isBot: isBot,
        isCreator: isCreator,
        items: [],
        totalValue: 0
    });
    
    return this.save();
};

// Method to add bots to fill the battle
caseBattleSchema.methods.addBots = function() {
    const botsNeeded = this.maxPlayers - this.players.length;
    const botNames = ['BotAlpha', 'BotBeta', 'BotGamma', 'BotDelta', 'BotEcho', 'BotFoxtrot'];
    
    for (let i = 0; i < botsNeeded; i++) {
        const botName = botNames[i] || `Bot${i + 1}`;
        const botId = `bot_${Date.now()}_${i}`;
        
        this.players.push({
            userId: botId,
            username: botName,
            isBot: true,
            isCreator: false,
            items: [],
            totalValue: 0
        });
    }
    
    return this.save();
};

// Method to start battle
caseBattleSchema.methods.start = function() {
    if (this.players.length < this.maxPlayers) {
        throw new Error('Not enough players to start battle');
    }
    
    if (this.status !== 'waiting') {
        throw new Error('Battle cannot be started');
    }
    
    this.status = 'starting';
    this.startedAt = new Date();
    return this.save();
};

// Method to process next case opening
caseBattleSchema.methods.processNextOpening = function(Case) {
    return new Promise(async (resolve, reject) => {
        try {
            if (this.status !== 'starting' && this.status !== 'in_progress') {
                return reject(new Error('Battle is not in progress'));
            }
            
            this.status = 'in_progress';
            
            // Calculate total openings needed
            const totalOpenings = this.cases.reduce((sum, c) => sum + c.quantity, 0) * this.players.length;
            
            if (this.currentOpeningIndex >= totalOpenings) {
                // Battle is complete
                return this.complete().then(resolve).catch(reject);
            }
            
            // Determine which player and case to open
            const playerIndex = this.currentOpeningIndex % this.players.length;
            const player = this.players[playerIndex];
            
            // Calculate which case to open for this player
            const playerOpeningIndex = Math.floor(this.currentOpeningIndex / this.players.length);
            let caseToOpen = null;
            let currentCaseIndex = 0;
            
            for (const caseData of this.cases) {
                if (playerOpeningIndex < currentCaseIndex + caseData.quantity) {
                    caseToOpen = caseData;
                    break;
                }
                currentCaseIndex += caseData.quantity;
            }
            
            if (!caseToOpen) {
                return this.complete().then(resolve).catch(reject);
            }
            
            // Get the case and open it
            const caseItem = await Case.findById(caseToOpen.caseId);
            if (!caseItem) {
                return reject(new Error('Case not found'));
            }
            
            const wonItem = caseItem.getRandomItem();
            
            // Add item to player
            player.items.push({
                itemName: wonItem.name,
                itemValue: wonItem.value,
                itemImage: wonItem.image,
                itemRarity: wonItem.rarity,
                caseSource: caseItem.name,
                isLimited: wonItem.isLimited,
                openedAt: new Date()
            });
            
            // Add to openings history
            this.openings.push({
                playerId: player.userId,
                playerName: player.username,
                caseId: caseItem._id,
                caseName: caseItem.name,
                item: {
                    itemName: wonItem.name,
                    itemValue: wonItem.value,
                    itemImage: wonItem.image,
                    itemRarity: wonItem.rarity,
                    isLimited: wonItem.isLimited
                },
                openedAt: new Date(),
                order: this.currentOpeningIndex
            });
            
            this.currentOpeningIndex++;
            
            await this.save();
            resolve({
                opening: this.openings[this.openings.length - 1],
                isComplete: this.currentOpeningIndex >= totalOpenings,
                totalOpenings: totalOpenings,
                currentIndex: this.currentOpeningIndex
            });
            
        } catch (error) {
            reject(error);
        }
    });
};

// Method to complete battle
caseBattleSchema.methods.complete = function() {
    // Find winner (player with highest total value)
    if (this.players.length === 0) {
        this.status = 'completed';
        this.completedAt = new Date();
        return this.save();
    }
    
    let winner = this.players.reduce((prev, current) => 
        (prev.totalValue > current.totalValue) ? prev : current
    );
    
    // Reset all winners first
    this.players.forEach(player => {
        player.isWinner = false;
    });
    
    // Set the winner
    winner.isWinner = true;
    this.winnerId = winner.userId;
    this.winnerUsername = winner.username;
    this.status = 'completed';
    this.completedAt = new Date();
    
    return this.save();
};

// Method to cancel battle
caseBattleSchema.methods.cancel = function() {
    this.status = 'cancelled';
    return this.save();
};

// Method to check if battle is expired
caseBattleSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Method to get battle summary for listings
caseBattleSchema.methods.getSummary = function() {
    return {
        battleId: this.battleId,
        mode: this.mode,
        maxPlayers: this.maxPlayers,
        currentPlayers: this.players.length,
        totalCost: this.totalCost,
        status: this.status,
        cases: this.cases.map(c => ({
            caseName: c.caseName,
            quantity: c.quantity,
            price: c.casePrice, // always include casePrice for frontend
            casePrice: c.casePrice, // for compatibility
            caseId: c.caseId
        })),
        players: this.players.map(p => ({
            username: p.username,
            isBot: p.isBot,
            isCreator: p.isCreator,
            totalValue: p.totalValue
        })),
        winnerId: this.winnerId,
        winnerUsername: this.winnerUsername,
        totalPrizeValue: this.totalPrizeValue,
        createdAt: this.createdAt,
        expiresAt: this.expiresAt
    };
};

// Method to get full battle details
caseBattleSchema.methods.getFullDetails = function() {
    return {
        battleId: this.battleId,
        mode: this.mode,
        maxPlayers: this.maxPlayers,
        currentPlayers: this.players.length,
        totalCost: this.totalCost,
        status: this.status,
        cases: this.cases.map(c => ({
            caseId: c.caseId,
            caseName: c.caseName,
            casePrice: c.casePrice,
            price: c.casePrice, // for compatibility
            quantity: c.quantity
        })),
        players: this.players,
        openings: this.openings.sort((a, b) => a.order - b.order),
        winnerId: this.winnerId,
        winnerUsername: this.winnerUsername,
        totalPrizeValue: this.totalPrizeValue,
        createdAt: this.createdAt,
        startedAt: this.startedAt,
        completedAt: this.completedAt,
        expiresAt: this.expiresAt,
        currentOpeningIndex: this.currentOpeningIndex
    };
};

// Index for efficient queries
caseBattleSchema.index({ battleId: 1 });
caseBattleSchema.index({ status: 1 });
caseBattleSchema.index({ 'players.userId': 1 });
caseBattleSchema.index({ createdAt: -1 });
caseBattleSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('CaseBattle', caseBattleSchema); 