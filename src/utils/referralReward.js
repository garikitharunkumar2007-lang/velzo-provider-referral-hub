// src/utils/referralReward.js

export function getReferralReward(referral) {
  if (!referral) return 0;

  const possibleRewards = [
    referral.reward,
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
  ];

  for (const value of possibleRewards) {
    const amount = Number(value);

    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return 0;
}

export function isReferralSuccessful(referral) {
  if (!referral) return false;

  const status = String(referral.status || "").toLowerCase();
  const paymentStatus = String(
    referral.paymentStatus || ""
  ).toLowerCase();

  const adminStatus = String(
    referral.adminStatus || ""
  ).toLowerCase();

  const verificationStatus = String(
    referral.verificationStatus || ""
  ).toLowerCase();

  const onboardingStatus = String(
    referral.onboardingStatus || ""
  ).toLowerCase();

  return (
    [
      "paid",
      "successful",
      "success",
      "completed",
      "approved",
      "accepted",
    ].includes(status) ||
    ["paid", "completed", "success", "successful"].includes(
      paymentStatus
    ) ||
    ["paid", "completed", "success", "successful"].includes(
      adminStatus
    ) ||
    verificationStatus === "verified" ||
    onboardingStatus === "completed"
  );
}

export function hasUnionOrLabourId(referral) {
  if (!referral) return false;

  const unionId =
    referral.unionId ||
    referral.unionID ||
    referral.labourId ||
    referral.labourID ||
    referral.unionLabourId ||
    referral.unionLabourID ||
    "";

  return String(unionId).trim().length > 0;
}