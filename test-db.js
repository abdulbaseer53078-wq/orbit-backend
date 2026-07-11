const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB connection...');

// First, test DNS resolution
console.log('📡 Testing DNS SRV lookup for MongoDB Atlas...');
dns.resolveSrv('_mongodb._tcp.cluster0.kzqf5kz.mongodb.net', (err, addresses) => {
    if (err) {
        console.error('❌ DNS SRV lookup failed:', err.message);
        console.log('⚠️  This might indicate a network/DNS issue');
    } else {
        console.log('✅ DNS SRV records found:');
        addresses.forEach(addr => {
            console.log(`   - ${addr.name}:${addr.port} (priority: ${addr.priority}, weight: ${addr.weight})`);
        });
    }
    
    // Proceed with connection attempt
    console.log('\n🔄 Attempting MongoDB connection...');
    
    mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        ssl: true,
        tlsAllowInvalidCertificates: false,
    })
    .then(() => {
        console.log('✅ Successfully connected to MongoDB!');
        console.log('📊 Connection state:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected');
        
        // Test the connection with a simple operation
        return mongoose.connection.db.admin().ping();
    })
    .then(() => {
        console.log('✅ Database ping successful!');
        console.log('🎉 Everything is working perfectly!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Connection error:', err.message);
        
        // Provide troubleshooting tips
        console.log('\n🔧 Troubleshooting tips:');
        console.log('1. Check if your IP is whitelisted in MongoDB Atlas');
        console.log('2. Verify username and password in .env file');
        console.log('3. Make sure your network allows outbound connections on port 27017');
        console.log('4. Check if the cluster name (cluster0.kzqf5kz) is correct');
        console.log('5. Try adding 0.0.0.0/0 to IP whitelist temporarily for testing');
        
        process.exit(1);
    });
});

// Handle connection events
mongoose.connection.on('error', (err) => {
    console.error('⚠️  MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('📴 MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        console.log('👋 MongoDB connection closed through app termination');
        process.exit(0);
    });
});