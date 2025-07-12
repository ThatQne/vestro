const mongoose = require('mongoose');

const caseBattleSchema = new mongoose.Schema({
    battleId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    cases: [{
        case: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Case',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1
        }
    }],
    maxPlayers: {
        type: Number,
        default: 2,
        min: 2,
        max: 8
    },
    entryFee: {
        type: Number,
        required: true,
        min: 0
    },
    players: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String,
        isBot: {
            type: Boolean,
            default: false
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        totalValue: {
            type: Number,
            default: 0
        },
        items: [{
            item: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Item'
            },
            value: Number,
            caseIndex: Number,
            round: Number
        }]
    }],
    status: {
        type: String,
        enum: ['waiting', 'active', 'completed', 'cancelled'],
        default: 'waiting'
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    currentRound: {
        type: Number,
        default: 0
    },
    totalRounds: {
        type: Number,
        default: 1
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Generate unique battle ID
caseBattleSchema.pre('save', function(next) {
    if (!this.battleId) {
        this.battleId = 'battle_' + Math.random().toString(36).substr(2, 9);
    }
    this.updatedAt = new Date();
    next();
});

// Add player to battle
caseBattleSchema.methods.addPlayer = function(userId, username, isBot = false) {
    if (this.players.length >= this.maxPlayers) {
        throw new Error('Battle is full');
    }
    
    if (this.status !== 'waiting') {
        throw new Error('Battle has already started');
    }
    
    const existingPlayer = this.players.find(p => 
        p.user && p.user.toString() === userId.toString()
    );
    
    if (existingPlayer) {
        throw new Error('Player already in battle');
    }
    
    this.players.push({
        user: isBot ? null : userId,
        username: username,
        isBot: isBot
    });
    
    // Start battle if full
    if (this.players.length === this.maxPlayers) {
        this.status = 'active';
        this.startedAt = new Date();
    }
};

// Remove player from battle
caseBattleSchema.methods.removePlayer = function(userId) {
    if (this.status !== 'waiting') {
        throw new Error('Cannot leave battle after it has started');
    }
    
    this.players = this.players.filter(p => 
        !p.user || p.user.toString() !== userId.toString()
    );
};

// Open case for player
caseBattleSchema.methods.openCaseForPlayer = async function(playerIndex, caseIndex) {
    const player = this.players[playerIndex];
    const battleCase = this.cases[caseIndex];
    
    if (!player || !battleCase) {
        throw new Error('Invalid player or case index');
    }
    
    // Populate case to access openCase method
    await this.populate('cases.case');
    const wonItemId = battleCase.case.openCase();
    
    // Populate item to get value
    await this.populate('cases.case.items.item');
    const wonItem = battleCase.case.items.find(item => 
        item.item._id.toString() === wonItemId.toString()
    );
    
    if (!wonItem) {
        throw new Error('Item not found in case');
    }
    
    const itemValue = wonItem.item.isLimited ? 
        (wonItem.item.currentPrice || wonItem.item.value) : 
        wonItem.item.value;
    
    // Add item to player's battle inventory
    player.items.push({
        item: wonItemId,
        value: itemValue,
        caseIndex: caseIndex,
        round: this.currentRound
    });
    
    player.totalValue += itemValue;
    
    return {
        item: wonItem.item,
        value: itemValue
    };
};

// Calculate winner
caseBattleSchema.methods.calculateWinner = function() {
    if (this.players.length === 0) return null;
    
    let winner = this.players[0];
    for (const player of this.players) {
        if (player.totalValue > winner.totalValue) {
            winner = player;
        }
    }
    
    this.winner = winner.user;
    return winner;
};

// Complete battle
caseBattleSchema.methods.completeBattle = function() {
    this.status = 'completed';
    this.completedAt = new Date();
    this.calculateWinner();
};

// Get battle summary
caseBattleSchema.methods.getSummary = function() {
    return {
        battleId: this.battleId,
        name: this.name,
        status: this.status,
        players: this.players.map(p => ({
            username: p.username,
            isBot: p.isBot,
            totalValue: p.totalValue,
            itemCount: p.items.length
        })),
        totalValue: this.players.reduce((sum, p) => sum + p.totalValue, 0),
        winner: this.winner
    };
};

caseBattleSchema.index({ battleId: 1 });
caseBattleSchema.index({ status: 1 });
caseBattleSchema.index({ createdBy: 1 });
caseBattleSchema.index({ 'players.user': 1 });

module.exports = mongoose.model('CaseBattle', caseBattleSchema); 