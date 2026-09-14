// src/utils/referralIdentity.js

export function normalizeIdentity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function getUserIdentityValues(user) {
  const values = [
    user?.uid,
    user?.id,
    user?.userId,
    user?.phone,
    user?.phoneNumber,
    user?.mobile,
    user?.email,
    user?.profile?.id,
    user?.profile?.uid,
    user?.profile?.userId,
    user?.userData?.id,
    user?.userData?.uid,
    user?.userData?.userId,
    user?.profile?.phone,
    user?.profile?.phoneNumber,
    user?.userData?.phone,
    user?.userData?.phoneNumber,
  ].filter(Boolean);

  return {
    identities: new Set(values.map(normalizeIdentity)),
    phones: new Set(
      values
        .map(normalizePhone)
        .filter((value) => value.length === 10)
    ),
  };
}

export function getReferralIdentityValues(referral) {
  const referrer = referral?.referrer || {};

  return [
    referral?.referrerId,
    referral?.referrerUid,
    referral?.userId,
    referral?.createdBy,
    referral?.referredBy,
    referral?.referrerPhone,
    referral?.referrerMobile,
    referral?.referrerPhoneNumber,
    referral?.referrerEmail,
    referrer?.id,
    referrer?.uid,
    referrer?.userId,
    referrer?.phone,
    referrer?.phoneNumber,
    referrer?.email,
  ].filter(Boolean);
}

export function referralBelongsToUser(referral, user) {
  if (!user) return false;

  const { identities, phones } = getUserIdentityValues(user);

  if (!identities.size && !phones.size) return false;

  return getReferralIdentityValues(referral).some((value) => {
    if (identities.has(normalizeIdentity(value))) return true;

    const phone = normalizePhone(value);

    return phone.length === 10 && phones.has(phone);
  });
}

export function getReferralReward(referral = {}) {
  const values = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
    referral.reward,
  ];

  const value = values.find(
    (item) => item !== undefined && item !== null && item !== ""
  );

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

export function isPaidReferral(referral = {}) {
  const status = String(referral.status || "")
    .trim()
    .toLowerCase();

  const paymentStatus = String(referral.paymentStatus || "")
    .trim()
    .toLowerCase();

  const rewardStatus = String(referral.rewardStatus || "")
    .trim()
    .toLowerCase();

  return (
    status === "paid" ||
    status === "successful" ||
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    rewardStatus === "paid"
  );
}
