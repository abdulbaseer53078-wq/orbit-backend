const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOTPEmail = async (email, username, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Orbit - Verify Your Email',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8faff; border-radius: 12px;">
                <div style="text-align: center; padding: 20px 0;">
                    <h1 style="color: #1a1a3e;">🌍 Orbit</h1>
                    <p style="color: #666;">Cross-Border Payments</p>
                </div>
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <h2 style="color: #1a1a3e; margin-bottom: 16px;">Verify Your Email</h2>
                    <p style="color: #555; line-height: 1.6;">Hello <strong>@${username}</strong>,</p>
                    <p style="color: #555; line-height: 1.6;">Thank you for signing up for Orbit! Please verify your email address using the code below:</p>
                    <div style="text-align: center; padding: 20px 0;">
                        <span style="font-size: 36px; font-weight: bold; color: #6C3CE1; letter-spacing: 8px; background: #f0f0ff; padding: 12px 30px; border-radius: 8px;">${otp}</span>
                    </div>
                    <p style="color: #888; font-size: 14px;">This code will expire in 10 minutes.</p>
                    <p style="color: #888; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                </div>
                <div style="text-align: center; padding: 20px 0; color: #aaa; font-size: 12px;">
                    <p>🌍 Orbit - Cross-Border Payments</p>
                    <p>Send money across borders at 0.3% fee</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 OTP email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
};

const sendTransactionReceipt = async (email, username, transaction) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Orbit - Transaction Receipt #${transaction.id.substring(0, 8)}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8faff; border-radius: 12px;">
                <div style="text-align: center; padding: 20px 0;">
                    <h1 style="color: #1a1a3e;">🌍 Orbit</h1>
                </div>
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <h2 style="color: #1a1a3e;">Transaction Receipt 🧾</h2>
                    <p style="color: #555;">Hello <strong>@${username}</strong>,</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px 0; color: #888;">Transaction ID</td><td style="padding: 8px 0; text-align: right; font-family: monospace;">${transaction.id.substring(0, 12)}...</td></tr>
                        <tr><td style="padding: 8px 0; color: #888;">From</td><td style="padding: 8px 0; text-align: right;">${transaction.from}</td></tr>
                        <tr><td style="padding: 8px 0; color: #888;">To</td><td style="padding: 8px 0; text-align: right;">${transaction.to}</td></tr>
                        <tr><td style="padding: 8px 0; color: #888;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">$${transaction.amount}</td></tr>
                        <tr><td style="padding: 8px 0; color: #888;">Fee (0.3%)</td><td style="padding: 8px 0; text-align: right;">$${transaction.fee.toFixed(2)}</td></tr>
                        <tr><td style="padding: 8px 0; color: #888;">Status</td><td style="padding: 8px 0; text-align: right; color: #4caf50;">✅ ${transaction.status}</td></tr>
                    </table>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <p style="color: #888; font-size: 12px;">${new Date(transaction.timestamp).toLocaleString()}</p>
                </div>
            </div>
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

module.exports = { sendOTPEmail, sendTransactionReceipt };