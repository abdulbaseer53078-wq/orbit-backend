const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

console.log('Testing with direct MongoDB driver...');
console.log('URI format check:', uri.includes('mongodb+srv://') ? '✅ SRV format' : '❌ Wrong format');

const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
});

async function test() {
    try {
        await client.connect();
        console.log('✅ Connected successfully!');
        await client.db('orbit').command({ ping: 1 });
        console.log('✅ Database ping successful!');
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.log('\n💡 Possible issues:');
        console.log('1. Wrong password - Reset it again in Atlas');
        console.log('2. Wrong username - Check exact spelling in Database Access');
        console.log('3. Password has special characters that need encoding');
        console.log('4. User might not have access to the "orbit" database');
    } finally {
        await client.close();
    }
}

test();