const mongoose = require('mongoose');

const KYCSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: 'India' }
    },
    documentType: {
        type: String,
        enum: ['aadhaar', 'pan', 'passport', 'driving_license'],
        required: true
    },
    documentNumber: {
        type: String,
        required: true
        // ❌ Removed `unique: true` here to avoid duplicate index with schema.index()
    },
    documentFront: {
        type: String,
        required: true
    },
    documentBack: {
        type: String
    },
    selfie: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'submitted', 'verified', 'rejected'],
        default: 'submitted'
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    verifiedBy: {
        type: String,
        default: ''
    },
    verifiedAt: {
        type: Date
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// ✅ Only one index definition — this creates the unique index
KYCSchema.index({ userId: 1, status: 1 });
KYCSchema.index({ documentNumber: 1 }, { unique: true });

module.exports = mongoose.model('KYC', KYCSchema);