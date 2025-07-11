const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    balance: {
        type: Number,
        default: 100,
        min: 0
    },
    balanceHistory: {
        type: [Number],
        default: [100]
    },
    level: {
        type: Number,
        default: 1,
        min: 1
    },
    experience: {
        type: Number,
        default: 0,
        min: 0
    },
    badges: [{
        code: {
            type: String,
            required: true
        },
        earnedAt: {
            type: Date,
            default: Date.now
        }
    }],
    currentWinStreak: {
        type: Number,
        default: 0
    },
    bestWinStreak: {
        type: Number,
        default: 0
    },
    gamesPlayed: {
        type: Number,
        default: 0,
        min: 0
    },
    totalWagered: {
        type: Number,
        default: 0,
        min: 0
    },
    totalWon: {
        type: Number,
        default: 0,
        min: 0
    },
    bestWin: {
        type: Number,
        default: 0,
        min: 0
    },
    wins: {
        type: Number,
        default: 0,
        min: 0
    },
    losses: {
        type: Number,
        default: 0,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate required XP for a given level
function getRequiredXP(level) {
    // Base 50 XP + 10 XP per level
    return 50 + (level * 10);
}

// Calculate total XP needed to reach a specific level
function getTotalXPForLevel(level) {
    let totalXP = 0;
    for (let i = 1; i <= level; i++) {
        totalXP += getRequiredXP(i);
    }
    return totalXP;
}

// Add experience and handle level ups
userSchema.methods.addExperience = function(amount) {
    this.experience += amount;
    
    let levelsGained = 0;
    let leveledUp = false;
    
    // Check if we can level up - use >= to handle exact matches
    while (this.experience >= getRequiredXP(this.level)) {
        const xpNeeded = getRequiredXP(this.level);
        this.experience -= xpNeeded; // Subtract XP needed for current level
        this.level += 1; // Increase level
        levelsGained += 1;
        leveledUp = true;
        
        // Level up bonus removed per user request
        // this.balance += 50; // $50 bonus per level up
        // this.balanceHistory.push(this.balance);
    }
    
    return { leveledUp, levelsGained };
};

// Update game statistics and check for badges
userSchema.methods.updateGameStats = async function(won, betAmount, winAmount) {
    // Import CLIENT_BADGES from constants
    const CLIENT_BADGES = require('../constants/badges');
    const earnedBadges = [];
    
    // Update basic stats
    this.gamesPlayed += 1;
    this.totalWagered += betAmount;
    
    if (won) {
        this.wins += 1;
        this.totalWon += winAmount;
        this.currentWinStreak += 1;
        this.bestWinStreak = Math.max(this.bestWinStreak, this.currentWinStreak);
        
        if (winAmount > this.bestWin) {
            this.bestWin = winAmount;
        }
    } else {
        this.losses += 1;
        this.currentWinStreak = 0;
    }

    // Balance history is now added in the game route after all calculations

    // Check for badges using client-side definitions
    for (const badge of CLIENT_BADGES) {
        // Skip if user already has this badge
        if (this.badges.some(b => b.code === badge.code)) continue;

        let earned = false;
        switch (badge.criteria.type) {
            case 'level':
                earned = this.level >= badge.criteria.value;
                break;
            case 'wins':
                earned = this.wins >= badge.criteria.value;
                break;
            case 'balance':
                earned = this.balance >= badge.criteria.value;
                break;
            case 'games':
                earned = this.gamesPlayed >= badge.criteria.value;
                break;
            case 'bet':
                earned = betAmount >= badge.criteria.value;
                break;
            case 'winstreak':
                earned = this.currentWinStreak >= badge.criteria.value;
                break;
            case 'specific':
                earned = betAmount === badge.criteria.value;
                break;
        }

        if (earned) {
            this.badges.push({ code: badge.code });
            earnedBadges.push(badge);
        }
    }

    return earnedBadges;
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

module.exports = mongoose.model('User', userSchema); 