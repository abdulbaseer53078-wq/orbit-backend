// ========================================
// ORBIT - EMAIL SERVICE
// ========================================

const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send verification email
const sendVerificationEmail = async (email, username, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Orbit - Verify Your Email',
        html: `
            <h1>Welcome to Orbit! 🌍</h1>
            <p>Hello @${username},</p>
            <p>Thank you for signing up! Please verify your email address with this code:</p>
            <h2 style="color: #6C3CE1; font-size: 32px;">${otp}</h2>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't sign up for Orbit, please ignore this email.</p>
            <hr />
            <p>🌍 Orbit - Cross-Border Payments</p>
            <p>Send money across borders at 0.3% fee</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Orbit - Password Reset',
        html: `
            <h1>Reset Your Password 🔐</h1>
            <p>Click the link below to reset your password:</p>
            <a href="http://localhost:5000/reset-password?token=${resetToken}">
                Reset Password
            </a>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr />
            <p>🌍 Orbit - Cross-Border Payments</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Password reset email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
};

// Send transaction receipt
const sendTransactionReceipt = async (email, username, transaction) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Orbit - Transaction Receipt #${transaction.id}`,
        html: `
            <h1>Transaction Receipt 🧾</h1>
            <p>Hello @${username},</p>
            <h2>Payment Details:</h2>
            <ul>
                <li><strong>From:</strong> ${transaction.from}</li>
                <li><strong>To:</strong> ${transaction.to}</li>
                <li><strong>Amount:</strong> $${transaction.amount}</li>
                <li><strong>Fee:</strong> $${transaction.fee} (0.3%)</li>
                <li><strong>Status:</strong> ${transaction.status}</li>
                <li><strong>Date:</strong> ${new Date(transaction.timestamp).toLocaleString()}</li>
            </ul>
            <hr />
            <p>🌍 Orbit - Cross-Border Payments</p>
            <p>Send money across borders at 0.3% fee</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Receipt sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendTransactionReceipt
};