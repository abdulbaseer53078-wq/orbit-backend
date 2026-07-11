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

// ========================================
// IMPORTS
// ========================================
const connectDB = require('./config/database');
const { verifyToken, generateToken } = require('./middleware/auth');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const OTP = require('./models/OTP');
const KYC = require('./models/KYC');
const { sendOTPEmail, sendTransactionReceipt } = require('./services/email');
const { sendOTPSMS } = require('./services/sms');
const { submitKYC, getKYCByUserId, getKYCByStatus, verifyKYC } = require('./services/kyc');

// ========================================
// APP SETUP
// ========================================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ========================================
// CONNECT DATABASE
// ========================================
connectDB();

// ========================================
// STELLAR SETUP
// ========================================
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

// ========================================
// IN-MEMORY DATA (Fallback)
// ========================================
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

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========================================
// PUBLIC ROUTES
// ========================================

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Orbit Payments',
        version: '3.0.0',
        feeRate: '0.3%',
        timestamp: new Date().toISOString()
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

        const existingUser = await User.findOne({ $or: [{ username }, { email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Username, email, or phone already registered'
            });
        }

        const keypair = StellarSdk.Keypair.random();
        const response = await fetch(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
        if (!response.ok) throw new Error('Failed to fund account');

        const user = new User({
            username,
            name,
            email: email.toLowerCase(),
            phone,
            password,
            publicKey: keypair.publicKey(),
            secretKey: keypair.secret(),
            balance: 1000,
            kycStatus: 'pending',
            emailVerified: false,
            phoneVerified: false
        });

        await user.save();

        const token = generateToken(user._id, user.username);

        console.log(`✅ User registered: @${username}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully!',
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

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        await user.updateLastLogin();

        const token = generateToken(user._id, user.username);

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                username: `@${user.username}`,
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

// 4. GET EXCHANGE RATES
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

// ========================================
// PROTECTED ROUTES (JWT Required)
// ========================================

// 5. GET USER INFO
app.get('/api/user/:username', verifyToken, async (req, res) => {
    try {
        const { username } = req.params;
        const cleanUsername = username.replace('@', '');

        if (cleanUsername !== req.user.username) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const user = await User.findOne({ username: cleanUsername });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const balanceUSD = user.balance;

        res.json({
            success: true,
            user: {
                username: `@${cleanUsername}`,
                publicKey: user.publicKey,
                name: user.name,
                email: user.email,
                phone: user.phone,
                kycStatus: user.kycStatus,
                emailVerified: user.emailVerified,
                phoneVerified: user.phoneVerified,
                createdAt: user.createdAt,
                balance: {
                    USD: balanceUSD,
                    INR: balanceUSD * exchangeRates.INR,
                    EUR: balanceUSD * exchangeRates.EUR,
                    GBP: balanceUSD * exchangeRates.GBP
                },
                formatted: {
                    USD: formatCurrency(balanceUSD, 'USD'),
                    INR: formatCurrency(balanceUSD * exchangeRates.INR, 'INR')
                }
            }
        });

    } catch (error) {
        console.error('User info error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 6. GET BALANCE
app.get('/api/balance', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username });
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

    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 7. SEND MONEY
app.post('/api/send', verifyToken, async (req, res) => {
    try {
        const { toUsername, amount } = req.body;
        const from = req.user.username;
        const to = toUsername.replace('@', '');

        if (!to || !amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request. Please provide recipient and positive amount.'
            });
        }

        const sender = await User.findOne({ username: from });
        const recipient = await User.findOne({ username: to });

        if (!sender || !recipient) {
            return res.status(404).json({
                success: false,
                error: 'Sender or recipient not found'
            });
        }

        const feeRate = 0.003;
        const fee = amount * feeRate;
        const totalDeduct = amount + fee;

        if (sender.balance < totalDeduct) {
            return res.status(400).json({
                success: false,
                error: `Insufficient balance. You have $${sender.balance.toFixed(2)}, need $${totalDeduct.toFixed(2)}`
            });
        }

        // Process on Stellar
        const senderAccount = await server.loadAccount(sender.publicKey);
        const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
        })
        .addOperation(
            StellarSdk.Operation.payment({
                destination: recipient.publicKey,
                asset: StellarSdk.Asset.native(),
                amount: amount.toString()
            })
        )
        .setTimeout(30)
        .build();

        const senderKeypair = StellarSdk.Keypair.fromSecret(sender.secretKey);
        transaction.sign(senderKeypair);
        const result = await server.submitTransaction(transaction);

        // Update balances
        sender.balance -= totalDeduct;
        recipient.balance += amount;
        await sender.save();
        await recipient.save();

        const txRecord = new Transaction({
            from: `@${from}`,
            to: `@${to}`,
            amount: amount,
            fee: fee,
            feeRate: '0.3%',
            totalDeduct: totalDeduct,
            type: 'payment',
            status: 'success',
            transactionHash: result.hash
        });
        await txRecord.save();

        // Send receipt email
        if (sender.email) {
            await sendTransactionReceipt(sender.email, sender.username, txRecord);
        }

        console.log(`✅ Payment: @${from} → @${to} ($${amount.toFixed(2)}, fee: $${fee.toFixed(2)})`);

        res.json({
            success: true,
            message: `Payment successful! Fee: 0.3% (${formatCurrency(fee)})`,
            transaction: {
                id: txRecord._id,
                from: txRecord.from,
                to: txRecord.to,
                amount: txRecord.amount,
                fee: txRecord.fee,
                feeRate: txRecord.feeRate,
                total: txRecord.totalDeduct,
                timestamp: txRecord.createdAt,
                hash: txRecord.transactionHash
            },
            senderBalance: {
                USD: sender.balance,
                INR: sender.balance * exchangeRates.INR
            },
            recipientBalance: {
                USD: recipient.balance,
                INR: recipient.balance * exchangeRates.INR
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

// 8. GET TRANSACTION HISTORY
app.get('/api/transactions/:username', verifyToken, async (req, res) => {
    try {
        const { username } = req.params;
        const cleanUsername = username.replace('@', '');

        if (cleanUsername !== req.user.username) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const user = await User.findOne({ username: cleanUsername });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const transactions = await Transaction.find({
            $or: [
                { from: `@${cleanUsername}` },
                { to: `@${cleanUsername}` }
            ]
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            username: `@${cleanUsername}`,
            total: transactions.length,
            transactions: transactions.map(tx => ({
                id: tx._id,
                from: tx.from,
                to: tx.to,
                amount: tx.amount,
                fee: tx.fee,
                feeRate: tx.feeRate,
                total: tx.totalDeduct,
                type: tx.type,
                status: tx.status,
                hash: tx.transactionHash,
                timestamp: tx.createdAt
            }))
        });

    } catch (error) {
        console.error('Transaction history error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 9. GET ALL USERS (Admin only)
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const admin = await User.findOne({ username: req.user.username });
        if (!admin || !admin.isAdmin) {
            const users = await User.find({}, 'username name email balance');
            return res.json({
                success: true,
                total: users.length,
                users: users.map(u => ({
                    username: `@${u.username}`,
                    name: u.name,
                    email: u.email,
                    balance: {
                        USD: u.balance,
                        INR: u.balance * exchangeRates.INR
                    }
                }))
            });
        }

        const allUsers = await User.find({});
        res.json({
            success: true,
            total: allUsers.length,
            users: allUsers.map(u => ({
                username: `@${u.username}`,
                name: u.name,
                email: u.email,
                phone: u.phone,
                balance: {
                    USD: u.balance,
                    INR: u.balance * exchangeRates.INR
                },
                kycStatus: u.kycStatus,
                emailVerified: u.emailVerified,
                phoneVerified: u.phoneVerified,
                isActive: u.isActive,
                createdAt: u.createdAt
            }))
        });

    } catch (error) {
        console.error('Users list error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ========================================
// OTP ROUTES
// ========================================

// 10. Request Email OTP
app.post('/api/request-email-otp', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                error: 'Email already verified'
            });
        }

        const otp = generateOTP();

        await OTP.create({
            userId: user._id,
            email: user.email,
            phone: user.phone,
            otp: otp,
            type: 'email'
        });

        const sent = await sendOTPEmail(user.email, user.username, otp);
        if (!sent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send OTP. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'OTP sent to your email'
        });

    } catch (error) {
        console.error('Email OTP error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 11. Request Phone OTP
app.post('/api/request-phone-otp', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.phoneVerified) {
            return res.status(400).json({
                success: false,
                error: 'Phone already verified'
            });
        }

        const otp = generateOTP();

        await OTP.create({
            userId: user._id,
            email: user.email,
            phone: user.phone,
            otp: otp,
            type: 'phone'
        });

        const sent = await sendOTPSMS(user.phone, otp);
        if (!sent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send OTP. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'OTP sent to your phone'
        });

    } catch (error) {
        console.error('Phone OTP error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 12. Verify OTP
app.post('/api/verify-otp', verifyToken, async (req, res) => {
    try {
        const { otp, type } = req.body;
        const username = req.user.username;

        if (!otp || !type) {
            return res.status(400).json({
                success: false,
                error: 'OTP and type are required'
            });
        }

        if (!['email', 'phone'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid OTP type'
            });
        }

        const otpRecord = await OTP.findOne({
            otp: otp,
            type: type,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired OTP'
            });
        }

        otpRecord.isUsed = true;
        await otpRecord.save();

        const user = await User.findOne({ username });
        if (type === 'email') {
            user.emailVerified = true;
        } else {
            user.phoneVerified = true;
        }
        await user.save();

        res.json({
            success: true,
            message: `${type} verified successfully!`,
            user: {
                username: user.username,
                emailVerified: user.emailVerified,
                phoneVerified: user.phoneVerified
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 13. Check Verification Status
app.get('/api/verification-status', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.user.username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            kycStatus: user.kycStatus
        });

    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ========================================
// KYC ROUTES
// ========================================

// 14. Submit KYC
app.post('/api/kyc/submit', verifyToken, async (req, res) => {
    try {
        const username = req.user.username;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const { fullName, dateOfBirth, address, documentType, documentNumber, documentFront, documentBack, selfie } = req.body;

        if (!fullName || !dateOfBirth || !address || !documentType || !documentNumber || !documentFront) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const kycData = {
            fullName,
            dateOfBirth,
            address,
            documentType,
            documentNumber,
            documentFront,
            documentBack,
            selfie
        };

        const kyc = await submitKYC(user._id, username, kycData);
        user.kycStatus = 'submitted';
        await user.save();

        res.json({
            success: true,
            message: 'KYC submitted successfully!',
            kyc: {
                id: kyc._id,
                status: kyc.status,
                submittedAt: kyc.submittedAt
            }
        });

    } catch (error) {
        console.error('KYC submission error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// 15. Get KYC Status
app.get('/api/kyc/status', verifyToken, async (req, res) => {
    try {
        const username = req.user.username;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const kyc = await getKYCByUserId(user._id);

        res.json({
            success: true,
            kycStatus: user.kycStatus,
            kyc: kyc ? {
                id: kyc._id,
                status: kyc.status,
                documentType: kyc.documentType,
                submittedAt: kyc.submittedAt,
                verifiedAt: kyc.verifiedAt,
                rejectionReason: kyc.rejectionReason
            } : null
        });

    } catch (error) {
        console.error('KYC status error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 16. Admin: Get Pending KYC
app.get('/api/admin/kyc/pending', verifyToken, async (req, res) => {
    try {
        const admin = await User.findOne({ username: req.user.username });
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin only.'
            });
        }

        const pendingKYC = await getKYCByStatus('submitted');

        res.json({
            success: true,
            total: pendingKYC.length,
            kyc: pendingKYC
        });

    } catch (error) {
        console.error('Admin KYC error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// 17. Admin: Verify KYC
app.post('/api/admin/kyc/verify', verifyToken, async (req, res) => {
    try {
        const admin = await User.findOne({ username: req.user.username });
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin only.'
            });
        }

        const { kycId, status, rejectionReason } = req.body;
        if (!kycId || !status) {
            return res.status(400).json({
                success: false,
                error: 'KYC ID and status are required'
            });
        }

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be "verified" or "rejected"'
            });
        }

        const kyc = await verifyKYC(kycId, status, rejectionReason);
        const userRecord = await User.findById(kyc.userId);
        if (userRecord) {
            userRecord.kycStatus = status;
            await userRecord.save();
        }

        res.json({
            success: true,
            message: `KYC ${status}`,
            kyc
        });

    } catch (error) {
        console.error('Admin verify error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// ========================================
// ROOT ROUTE (MUST BE LAST)
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
                users: 'GET /api/users (Auth required)',
                'request-email-otp': 'POST /api/request-email-otp (Auth required)',
                'request-phone-otp': 'POST /api/request-phone-otp (Auth required)',
                'verify-otp': 'POST /api/verify-otp (Auth required)',
                'kyc-submit': 'POST /api/kyc/submit (Auth required)',
                'kyc-status': 'GET /api/kyc/status (Auth required)'
            },
            admin: {
                'kyc-pending': 'GET /api/admin/kyc/pending (Admin only)',
                'kyc-verify': 'POST /api/admin/kyc/verify (Admin only)'
            }
        }
    });
});

// ========================================
// 404 Handler
// ========================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
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
    console.log(`📧 Email Verification: ✅ Enabled`);
    console.log(`📱 Phone Verification: ✅ Enabled`);
    console.log(`🪪 KYC System: ✅ Enabled`);
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
    console.log(`   POST   /api/request-email-otp - Request email OTP`);
    console.log(`   POST   /api/request-phone-otp - Request phone OTP`);
    console.log(`   POST   /api/verify-otp   - Verify OTP`);
    console.log(`   POST   /api/kyc/submit   - Submit KYC`);
    console.log(`   GET    /api/kyc/status   - Check KYC status`);
    console.log(`\n📋 Admin Routes:`);
    console.log(`   GET    /api/admin/kyc/pending - Pending KYC`);
    console.log(`   POST   /api/admin/kyc/verify - Verify KYC`);
    console.log(`\n🔗 Try it: http://localhost:${PORT}/api/health\n`);
});