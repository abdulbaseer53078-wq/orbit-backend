const KYC = require('../models/KYC');

const submitKYC = async (userId, username, data) => {
    try {
        const existingKYC = await KYC.findOne({ userId });
        if (existingKYC) {
            Object.assign(existingKYC, data);
            existingKYC.status = 'submitted';
            existingKYC.updatedAt = new Date();
            await existingKYC.save();
            return existingKYC;
        }

        const kyc = new KYC({
            userId,
            username,
            ...data,
            status: 'submitted'
        });
        await kyc.save();
        return kyc;
    } catch (error) {
        throw new Error(`KYC submission failed: ${error.message}`);
    }
};

const getKYCByUserId = async (userId) => {
    return await KYC.findOne({ userId });
};

const getKYCByStatus = async (status) => {
    return await KYC.find({ status });
};

const verifyKYC = async (kycId, status, rejectionReason = '') => {
    const kyc = await KYC.findById(kycId);
    if (!kyc) {
        throw new Error('KYC record not found');
    }

    kyc.status = status;
    kyc.verifiedAt = new Date();
    kyc.verifiedBy = 'admin';
    if (status === 'rejected') {
        kyc.rejectionReason = rejectionReason;
    }
    await kyc.save();

    return kyc;
};

module.exports = {
    submitKYC,
    getKYCByUserId,
    getKYCByStatus,
    verifyKYC
};