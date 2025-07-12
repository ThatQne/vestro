const mongoose = require('mongoose');
const { seedDatabase } = require('./utils/seedData');
require('dotenv').config({ 
    path: process.env.NODE_ENV === 'development' 
        ? './environment.dev.env' 
        : './environment.env' 
});

async function runSeeding() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Run seeding
        await seedDatabase();
        
        console.log('Seeding completed successfully!');
        
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        // Close connection
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    }
}

runSeeding(); 