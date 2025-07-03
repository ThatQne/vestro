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
        badgeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Badge'
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
    
    // Find the highest level we can achieve with current XP
    let newLevel = 1;
    while (getTotalXPForLevel(newLevel) <= this.experience) {
        newLevel++;
    }
    newLevel--; // Back off one level since we went one too far
    
    if (newLevel > this.level) {
        const levelsGained = newLevel - this.level;
        this.level = newLevel;
        return { leveledUp: true, levelsGained };
    }
    
    return { leveledUp: false };
};

// Update game statistics and check for badges
userSchema.methods.updateGameStats = async function(betAmount, winAmount) {
    const Badge = mongoose.model('Badge');
    const earnedBadges = [];
    
    // Update basic stats
    this.gamesPlayed += 1;
    this.totalWagered += betAmount;
    
    if (winAmount > 0) {
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

    // Add current balance to history
    this.balanceHistory.push(this.balance);

    // Check for badges
    const badges = await Badge.find();
    for (const badge of badges) {
        // Skip if user already has this badge
        if (this.badges.some(b => b.badgeId.equals(badge._id))) continue;

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
            this.badges.push({ badgeId: badge._id });
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