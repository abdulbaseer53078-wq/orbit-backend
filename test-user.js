// test-user.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// DNS fix for Node.js
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const User = require('./models/User');

async function testUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Create a test user
        const testUser = new User({
            username: 'testuser',
            name: 'Test User',
            email: 'test@email.com',
            phone: '+919876543210',
            password: 'test123',
            publicKey: 'GABCDEF1234567890',
            secretKey: 'SABCDEF1234567890',
            balance: 1000
        });

        // Save to database
        await testUser.save();
        console.log('✅ User saved:', testUser.username);

        // Find the user
        const found = await User.findOne({ username: 'testuser' });
        console.log('✅ Found user:', found.name);

        // Test password comparison
        const isMatch = await found.comparePassword('test123');
        console.log('✅ Password match:', isMatch);

        // Add balance
        await found.addBalance(500);
        console.log('✅ New balance after adding 500:', found.balance);

        // Deduct balance
        await found.deductBalance(200);
        console.log('✅ New balance after deducting 200:', found.balance);

        // Delete test user (cleanup)
        await User.deleteOne({ username: 'testuser' });
        console.log('✅ Test user deleted');

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        // If connection failed, exit
        if (error.message.includes('MongoDB')) {
            process.exit(1);
        }
    }
}

testUser();