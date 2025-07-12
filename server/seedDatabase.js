const mongoose = require('mongoose');
const { seedCases } = require('./utils/seedCases');

// Load environment variables
require('dotenv').config({ 
    path: process.env.NODE_ENV === 'development' 
        ? './environment.dev.env' 
        : './environment.env' 
});

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Seed cases
        await seedCases();
        console.log('Database seeding completed successfully!');
        
        // Close connection
        await mongoose.connection.close();
        console.log('Database connection closed');
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase(); 