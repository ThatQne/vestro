const UserInventory = require('../models/UserInventory');

async function getUserInventory(userId, createIfNotExists = true) {
    let userInventory = await UserInventory.findOne({ userId });
    
    if (!userInventory && createIfNotExists) {
        userInventory = new UserInventory({ userId });
        await userInventory.save();
    }
    
    return userInventory;
}

async function getUserInventoryOrThrow(userId) {
    const userInventory = await getUserInventory(userId, false);
    if (!userInventory) {
        throw new Error('Inventory not found');
    }
    return userInventory;
}

async function findInventoryItem(userId, itemId) {
    const userInventory = await getUserInventoryOrThrow(userId);
    const item = userInventory.items.find(item => item._id.toString() === itemId);
    if (!item) {
        throw new Error('Item not found');
    }
    return { userInventory, item };
}

module.exports = {
    getUserInventory,
    getUserInventoryOrThrow,
    findInventoryItem
};
