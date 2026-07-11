const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const uri = "mongodb+srv://abdulbaseer53078_db_user:FI91M4dHtlnKBHQW@cluster0.kzqf5kz.mongodb.net/orbit?retryWrites=true&w=majority&appName=Cluster0";

console.log('🔍 Testing connection string...');

mongoose.connect(uri)
    .then(() => {
        console.log('✅ Connected successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err.message);
        process.exit(1);
    });