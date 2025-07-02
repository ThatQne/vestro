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

// Add experience and handle level ups
userSchema.methods.addExperience = function(amount) {
    this.experience += amount;
    
    // Check for level up (100 XP per level)
    const newLevel = Math.floor(this.experience / 100) + 1;
    if (newLevel > this.level) {
        const levelsGained = newLevel - this.level;
        this.level = newLevel;
        this.balance += levelsGained * 50; // $50 bonus per level
        return { leveledUp: true, levelsGained, bonusAmount: levelsGained * 50 };
    }
    
    return { leveledUp: false };
};

// Update game statistics
userSchema.methods.updateGameStats = function(betAmount, winAmount) {
    this.gamesPlayed += 1;
    this.totalWagered += betAmount;
    
    if (winAmount > 0) {
        this.totalWon += winAmount;
        if (winAmount > this.bestWin) {
            this.bestWin = winAmount;
        }
    }
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

module.exports = mongoose.model('User', userSchema); 