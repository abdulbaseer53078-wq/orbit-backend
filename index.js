// ========================================
// ORBIT - COMPLETE BACKEND
// ========================================
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

console.log('🌍 Orbit Backend Starting...');

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const StellarSdk = require('@stellar/stellar-sdk');
const axios = require('axios');
require('dotenv').config();

const { verifyToken, generateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json());

// ========================================
// STELLAR SETUP
// ========================================
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

// ========================================
// DATABASE (in-memory for testing)
// ========================================
const users = {};
const transactions = [];
const exchangeRates = { USD: 1, INR: 85, EUR: 0.92, GBP: 0.78 };

// ========================================
// EXCHANGE RATE API
// ========================================
async function getExchangeRates() {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        Object.assign(exchangeRates, response.data.rates);
        console.log('💱 Rates updated');
    } catch (error) {
        console.error('Error fetching rates:', error);
    }
}
setInterval(getExchangeRates, 5 * 60 * 1000);
getExchangeRates();

// ========================================
// HELPER FUNCTIONS
// ========================================
function formatCurrency(amount, currency) {
    const symbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
    return `${symbols[currency] || ''}${amount.toFixed(2)}`;
}

// ========================================
// API ROUTES (API ROUTES FIRST!)
// ========================================

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Orbit Payments',
        version: '3.0.0',
        feeRate: '0.3%',
        timestamp: new Date().toISOString(),
        stats: {
            totalUsers: Object.keys(users).length,
            totalTransactions: transactions.length
        }
    });
});

// 2. REGISTER USER
app.post('/api/register', async (req, res) => {
    try {
        const { username, name, email, phone, password } = req.body;

        if (!username || !username.match(/^[a-zA-Z0-9_]{3,20}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Username must be 3-20 characters (letters, numbers, underscore)'
            });
        }

        if (users[username]) {
            return res.status(400).json({
                success: false,
                error: 'Username already taken'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const keypair = StellarSdk.Keypair.random();
        const response = await fetch(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
        if (!response.ok) throw new Error('Failed to fund account');

        users[username] = {
            publicKey: keypair.publicKey(),
            secretKey: keypair.secret(),
            balance: 1000,
            name: name || username,
            email: email || '',
            phone: phone || '',
            password: hashedPassword,
            kycStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        const token = generateToken(username, username);

        console.log(`✅ User registered: @${username}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully!',
            token,
            user: {
                username: `@${username}`,
                name: users[username].name,
                email: users[username].email,
                balance: {
                    USD: users[username].balance,
                    INR: users[username].balance * exchangeRates.INR
                }
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

// 3. LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password required'
            });
        }

        const user = users[username];
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const token = generateToken(username, username);

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                username: `@${username}`,
                name: user.name,
                email: user.email,
                balance: {
                    USD: user.balance,
                    INR: user.balance * exchangeRates.INR
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 4. GET USER INFO (Protected)
app.get('/api/user/:username', verifyToken, (req, res) => {
    const { username } = req.params;
    const cleanUsername = username.replace('@', '');

    if (cleanUsername !== req.user.username) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    if (!users[cleanUsername]) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    const balanceUSD = users[cleanUsername].balance;

    res.json({
        success: true,
        user: {
            username: `@${cleanUsername}`,
            publicKey: users[cleanUsername].publicKey,
            name: users[cleanUsername].name,
            email: users[cleanUsername].email,
            phone: users[cleanUsername].phone,
            kycStatus: users[cleanUsername].kycStatus,
            createdAt: users[cleanUsername].createdAt,
            balance: {
                USD: balanceUSD,
                INR: balanceUSD * exchangeRates.INR,
                EUR: balanceUSD * exchangeRates.EUR,
                GBP: balanceUSD * exchangeRates.GBP
            },
            formatted: {
                USD: formatCurrency(balanceUSD, 'USD'),
                INR: formatCurrency(balanceUSD * exchangeRates.INR, 'INR'),
                EUR: formatCurrency(balanceUSD * exchangeRates.EUR, 'EUR'),
                GBP: formatCurrency(balanceUSD * exchangeRates.GBP, 'GBP')
            }
        },
        exchangeRates: {
            USD_INR: exchangeRates.INR,
            USD_EUR: exchangeRates.EUR,
            USD_GBP: exchangeRates.GBP
        }
    });
});

// 5. SEND MONEY (Protected)
app.post('/api/send', verifyToken, async (req, res) => {
    try {
        const { toUsername, amount } = req.body;
        const from = req.user.username;
        const to = toUsername.replace('@', '');

        if (!to || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be positive'
            });
        }
        if (!users[from]) {
            return res.status(404).json({
                success: false,
                error: 'Sender not found'
            });
        }
        if (!users[to]) {
            return res.status(404).json({
                success: false,
                error: 'Recipient not found'
            });
        }

        const feeRate = 0.003;
        const fee = amount * feeRate;
        const totalDeduct = amount + fee;

        if (users[from].balance < totalDeduct) {
            return res.status(400).json({
                success: false,
                error: `Insufficient balance. You have $${users[from].balance.toFixed(2)}, need $${totalDeduct.toFixed(2)} (includes $${fee.toFixed(2)} fee)`
            });
        }

        const senderAccount = await server.loadAccount(users[from].publicKey);
        const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
        })
        .addOperation(
            StellarSdk.Operation.payment({
                destination: users[to].publicKey,
                asset: StellarSdk.Asset.native(),
                amount: amount.toString()
            })
        )
        .setTimeout(30)
        .build();

        const senderKeypair = StellarSdk.Keypair.fromSecret(users[from].secretKey);
        transaction.sign(senderKeypair);
        const result = await server.submitTransaction(transaction);

        users[from].balance -= totalDeduct;
        users[to].balance += amount;

        const txRecord = {
            id: result.hash,
            from: `@${from}`,
            to: `@${to}`,
            amount: amount,
            fee: fee,
            feeRate: '0.3%',
            totalDeduct: totalDeduct,
            timestamp: new Date().toISOString(),
            type: 'payment',
            status: 'success'
        };
        transactions.push(txRecord);

        console.log(`✅ Payment: @${from} → @${to} ($${amount.toFixed(2)}, fee: $${fee.toFixed(2)})`);

        res.json({
            success: true,
            message: `Payment successful! Fee: 0.3% (${formatCurrency(fee)})`,
            transaction: {
                id: txRecord.id,
                from: txRecord.from,
                to: txRecord.to,
                amount: txRecord.amount,
                fee: txRecord.fee,
                feeRate: txRecord.feeRate,
                total: txRecord.totalDeduct,
                timestamp: txRecord.timestamp
            },
            senderBalance: {
                USD: users[from].balance,
                INR: users[from].balance * exchangeRates.INR,
                formatted: formatCurrency(users[from].balance, 'USD')
            },
            recipientBalance: {
                USD: users[to].balance,
                INR: users[to].balance * exchangeRates.INR,
                formatted: formatCurrency(users[to].balance, 'USD')
            }
        });

    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment failed: ' + error.message
        });
    }
});

// 6. GET TRANSACTION HISTORY (Protected)
app.get('/api/transactions/:username', verifyToken, (req, res) => {
    const { username } = req.params;
    const cleanUsername = username.replace('@', '');

    if (cleanUsername !== req.user.username) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    if (!users[cleanUsername]) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    const userTxs = transactions.filter(
        tx => tx.from === `@${cleanUsername}` || tx.to === `@${cleanUsername}`
    );

    res.json({
        success: true,
        username: `@${cleanUsername}`,
        total: userTxs.length,
        transactions: userTxs
    });
});

// 7. GET BALANCE (Protected)
app.get('/api/balance', verifyToken, (req, res) => {
    const username = req.user.username;
    const user = users[username];

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    res.json({
        success: true,
        balance: {
            USD: user.balance,
            INR: user.balance * exchangeRates.INR,
            EUR: user.balance * exchangeRates.EUR,
            GBP: user.balance * exchangeRates.GBP
        },
        formatted: {
            USD: formatCurrency(user.balance, 'USD'),
            INR: formatCurrency(user.balance * exchangeRates.INR, 'INR')
        }
    });
});

// 8. GET ALL USERS (Admin only, Protected)
app.get('/api/users', verifyToken, (req, res) => {
    if (req.user.username !== 'admin') {
        const userList = Object.keys(users).map(username => ({
            username: `@${username}`,
            name: users[username].name,
            balance: {
                USD: users[username].balance,
                INR: users[username].balance * exchangeRates.INR
            }
        }));
        return res.json({
            success: true,
            total: userList.length,
            users: userList
        });
    }

    const userList = Object.keys(users).map(username => ({
        username: `@${username}`,
        publicKey: users[username].publicKey,
        name: users[username].name,
        email: users[username].email,
        phone: users[username].phone,
        kycStatus: users[username].kycStatus,
        balance: {
            USD: users[username].balance,
            INR: users[username].balance * exchangeRates.INR
        },
        createdAt: users[username].createdAt
    }));

    res.json({
        success: true,
        total: userList.length,
        users: userList
    });
});

// 9. GET EXCHANGE RATES (Public)
app.get('/api/rates', (req, res) => {
    res.json({
        success: true,
        rates: exchangeRates,
        formatted: {
            USD_INR: `₹${exchangeRates.INR.toFixed(2)}`,
            USD_EUR: `€${exchangeRates.EUR.toFixed(2)}`,
            USD_GBP: `£${exchangeRates.GBP.toFixed(2)}`
        },
        updatedAt: new Date().toISOString()
    });
});

// 10. PAYMENT SUMMARY (Protected)
app.get('/api/payments/summary', verifyToken, (req, res) => {
    const totalUsers = Object.keys(users).length;
    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalFees = transactions.reduce((sum, tx) => sum + (tx.fee || 0), 0);

    res.json({
        success: true,
        totalUsers,
        totalTransactions,
        totalVolume: {
            USD: totalVolume,
            INR: totalVolume * exchangeRates.INR,
            formatted: formatCurrency(totalVolume, 'USD')
        },
        totalFees: {
            USD: totalFees,
            INR: totalFees * exchangeRates.INR,
            formatted: formatCurrency(totalFees, 'USD')
        },
        averageTransaction: totalTransactions > 0 ? {
            USD: totalVolume / totalTransactions,
            INR: (totalVolume / totalTransactions) * exchangeRates.INR,
            formatted: formatCurrency(totalVolume / totalTransactions, 'USD')
        } : 0,
        feeRate: '0.3%',
        exchangeRates: {
            USD_INR: exchangeRates.INR,
            USD_EUR: exchangeRates.EUR,
            USD_GBP: exchangeRates.GBP
        }
    });
});

// ========================================
// ROOT ROUTE (MUST COME LAST)
// ========================================
app.get('/', (req, res) => {
    res.json({
        name: 'Orbit Payments API',
        version: '3.0.0',
        status: 'running',
        feeRate: '0.3%',
        message: '🌍 Orbit - Cross-Border Payments',
        endpoints: {
            public: {
                register: 'POST /api/register',
                login: 'POST /api/login',
                health: 'GET /api/health',
                rates: 'GET /api/rates'
            },
            protected: {
                user: 'GET /api/user/:username (Auth required)',
                send: 'POST /api/send (Auth required)',
                balance: 'GET /api/balance (Auth required)',
                transactions: 'GET /api/transactions/:username (Auth required)',
                summary: 'GET /api/payments/summary (Auth required)',
                users: 'GET /api/users (Auth required)'
            }
        }
    });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`\n🌍 Orbit Payments running on http://localhost:${PORT}`);
    console.log(`💱 Exchange rates: 1 USD = ${exchangeRates.INR.toFixed(2)} INR`);
    console.log(`💰 Fee Rate: 0.3%`);
    console.log(`🔐 JWT Authentication: ✅ Enabled`);
    console.log(`\n📋 Public Routes:`);
    console.log(`   POST   /api/register     - Register user`);
    console.log(`   POST   /api/login        - Login user`);
    console.log(`   GET    /api/health       - Health check`);
    console.log(`   GET    /api/rates        - Exchange rates`);
    console.log(`\n📋 Protected Routes (JWT required):`);
    console.log(`   GET    /api/user/:username - Get user info`);
    console.log(`   GET    /api/balance      - Get balance`);
    console.log(`   POST   /api/send         - Send money`);
    console.log(`   GET    /api/transactions/:username - Transaction history`);
    console.log(`   GET    /api/payments/summary - Payment analytics`);
    console.log(`   GET    /api/users        - List users`);
    console.log(`\n🔗 Try it: http://localhost:${PORT}/api/health\n`);
});