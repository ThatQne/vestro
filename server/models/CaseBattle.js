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
            max: 25 // Allow up to 25 cases per individual case type
        }
    }],
    totalCost: {
        type: Number,
        required: true,
        min: 0
    },
    players: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
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
    status: {
        type: String,
        enum: ['waiting', 'in_progress', 'completed', 'cancelled'],
        default: 'waiting'
    },
    winnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    viewingPeriodEndsAt: {
        type: Date,
        default: null
    }
});

// Calculate total cost before saving
caseBattleSchema.pre('save', function(next) {
    const totalCases = this.cases.reduce((sum, caseItem) => sum + caseItem.quantity, 0);
    if (totalCases > 25) {
        const error = new Error('Maximum of 25 cases allowed per battle');
        return next(error);
    }
    
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
caseBattleSchema.methods.addPlayer = function(userId, username, isBot = false) {
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
        items: [],
        totalValue: 0
    });
    
    return this.save();
};

// Method to start battle
caseBattleSchema.methods.start = function() {
    if (this.players.length < this.maxPlayers) {
        throw new Error('Not enough players to start battle');
    }
    
    this.status = 'in_progress';
    this.startedAt = new Date();
    return this.save();
};

// Method to complete battle
caseBattleSchema.methods.complete = function() {
    // Find winner (player with highest total value)
    let winner = this.players.reduce((prev, current) => 
        (prev.totalValue > current.totalValue) ? prev : current
    );
    
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

// Method to add bot players
caseBattleSchema.methods.addBots = async function() {
    const remainingSlots = this.maxPlayers - this.players.length;
    if (remainingSlots <= 0) return;
    
    const botNames = ['Bot_Alpha', 'Bot_Beta', 'Bot_Gamma', 'Bot_Delta'];
    
    for (let i = 0; i < remainingSlots; i++) {
        const botName = `${botNames[i % botNames.length]}_${Math.floor(Math.random() * 1000)}`;
        
        this.players.push({
            userId: mongoose.Types.ObjectId(), // Generate a random ID for the bot
            username: botName,
            isBot: true,
            items: [],
            totalValue: 0
        });
    }
    
    return this.save();
};

// Method to check if battle is expired
caseBattleSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Method to get battle summary
caseBattleSchema.methods.getSummary = function() {
    return {
        battleId: this.battleId,
        mode: this.mode,
        maxPlayers: this.maxPlayers,
        currentPlayers: this.players.length,
        totalCost: this.totalCost,
        status: this.status,
        winnerId: this.winnerId,
        winnerUsername: this.winnerUsername,
        totalPrizeValue: this.totalPrizeValue,
        createdAt: this.createdAt,
        expiresAt: this.expiresAt,
        players: this.players.map(p => ({
            userId: p.userId,
            username: p.username,
            isBot: p.isBot
        })),
        cases: this.cases
    };
};

// Index for efficient queries
caseBattleSchema.index({ battleId: 1 });
caseBattleSchema.index({ status: 1 });
caseBattleSchema.index({ 'players.userId': 1 });
caseBattleSchema.index({ createdAt: -1 });
caseBattleSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('CaseBattle', caseBattleSchema);      