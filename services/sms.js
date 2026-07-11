// ========================================
// ORBIT - SMS SERVICE (Disabled)
// ========================================

// Twilio is disabled temporarily. Uncomment when you have credentials.
/*
const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const sendOTPSMS = async (phone, otp) => {
    try {
        const message = await client.messages.create({
            body: `🌍 Orbit Verification Code: ${otp}\n\nThis code will expire in 10 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        console.log(`📱 OTP SMS sent to ${phone}: ${message.sid}`);
        return true;
    } catch (error) {
        console.error('SMS error:', error);
        return false;
    }
};

module.exports = { sendOTPSMS };
*/

// Mock SMS service (always returns success)
const sendOTPSMS = async (phone, otp) => {
    console.log(`📱 [MOCK] OTP SMS would be sent to ${phone}: ${otp}`);
    console.log(`✅ [MOCK] SMS verification is disabled. Set TWILIO credentials to enable.`);
    return true;
};

module.exports = { sendOTPSMS };