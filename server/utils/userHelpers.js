const User = require('../models/User');

async function getUserById(userId, session = null) {
    const query = User.findById(userId);
    if (session) {
        query.session(session);
    }
    return await query;
}

async function getUserByIdOrThrow(userId, session = null) {
    const user = await getUserById(userId, session);
    if (!user) {
        throw new Error('User not found');
    }
    return user;
}

async function updateUserBalance(userId, amount, session = null) {
    const user = await getUserByIdOrThrow(userId, session);
    user.balance += amount;
    user.balanceHistory.push(user.balance);
    await user.save();
    return user;
}

module.exports = {
    getUserById,
    getUserByIdOrThrow,
    updateUserBalance
};
