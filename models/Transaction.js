const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    from: {
        type: String,
        ref: 'User',
        required: true
    },
    to: {
        type: String,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    fee: {
        type: Number,
        default: 0
    },
    feeRate: {
        type: String,
        default: '0.3%'
    },
    totalDeduct: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['payment', 'deposit', 'withdraw', 'flight_booking'],
        default: 'payment'
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
    },
    transactionHash: {
        type: String,
        default: ''
    },
    metadata: {
        type: Map,
        of: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

TransactionSchema.index({ from: 1, to: 1 });
TransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);