const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username cannot exceed 20 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    publicKey: {
        type: String,
        required: true,
        unique: true
    },
    secretKey: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        default: 0,
        min: [0, 'Balance cannot be negative']
    },
    kycStatus: {
        type: String,
        enum: ['pending', 'submitted', 'verified', 'rejected'],
        default: 'pending'
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

UserSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Update last login
UserSchema.methods.updateLastLogin = function() {
    this.lastLogin = Date.now();
    return this.save();
};

// Add balance
UserSchema.methods.addBalance = function(amount) {
    if (amount < 0) throw new Error('Amount cannot be negative');
    this.balance += amount;
    return this.save();
};

// Deduct balance
UserSchema.methods.deductBalance = function(amount) {
    if (amount < 0) throw new Error('Amount cannot be negative');
    if (this.balance < amount) throw new Error('Insufficient balance');
    this.balance -= amount;
    return this.save();
};

// Check if KYC verified
UserSchema.methods.isKYCVerified = function() {
    return this.kycStatus === 'verified';
};

// Find by username (with @ support)
UserSchema.statics.findByUsername = function(username) {
    const cleanUsername = username.replace('@', '');
    return this.findOne({ username: cleanUsername });
};

// Find by email or phone
UserSchema.statics.findByEmailOrPhone = function(email, phone) {
    return this.findOne({
        $or: [
            { email: email.toLowerCase() },
            { phone: phone }
        ]
    });
};

module.exports = mongoose.model('User', UserSchema);