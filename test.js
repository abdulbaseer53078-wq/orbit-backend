// test.js

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Connecting to MongoDB...');
console.log('📡 Using URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ Missing');

if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    process.exit(0);
})
.catch(err => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});