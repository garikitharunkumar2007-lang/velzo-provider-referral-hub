const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");

const {
  setGlobalOptions,
} = require("firebase-functions/v2");

const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

setGlobalOptions({
  region: "asia-south1",
});

/*
=========================================
PHONE NORMALIZATION
=========================================
*/

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return digits;
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return digits.substring(2);
  }

  return "";
}

/*
=========================================
PHONE DOCUMENT ID OPTIONS
=========================================
*/

function getPhoneDocumentIds(phone) {
  return [
    phone,
    `+91${phone}`,
    `91${phone}`,
  ];
}

/*
=========================================
ROLE NORMALIZATION
=========================================
*/

function normalizeRole(role) {
  return String(role || "user")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

/*
=========================================
ADMIN ROLE CHECK
=========================================
*/

function isAdminRole(role) {
  const normalizedRole = normalizeRole(role);

  return [
    "admin",
    "referral-admin",
    "referraladmin",
    "super-admin",
    "superadmin",
  ].includes(normalizedRole);
}

/*
=========================================
FIND USER BY PHONE
=========================================
*/

async function findUserByPhone(phone) {
  const documentIds = getPhoneDocumentIds(phone);

  for (const documentId of documentIds) {
    const userReference = db
      .collection("users")
      .doc(documentId);

    const userSnapshot = await userReference.get();

    if (userSnapshot.exists) {
      return {
        documentId,
        snapshot: userSnapshot,
        data: userSnapshot.data() || {},
      };
    }
  }

  const phoneQuery = await db
    .collection("users")
    .where("phone", "in", [
      phone,
      `+91${phone}`,
      `91${phone}`,
    ])
    .limit(1)
    .get();

  if (!phoneQuery.empty) {
    const firstDocument = phoneQuery.docs[0];

    return {
      documentId: firstDocument.id,
      snapshot: firstDocument,
      data: firstDocument.data() || {},
    };
  }

  return null;
}

/*
=========================================
CREATE USER NOTIFICATION
=========================================
*/

async function createUserNotification({
  userId,
  title,
  message,
  type,
  referralId,
  rejectionReason = "",
}) {
  if (!userId) {
    console.warn(
      "Notification skipped because userId is missing."
    );

    return null;
  }

  if (!referralId) {
    console.warn(
      "Notification skipped because referralId is missing."
    );

    return null;
  }

  /*
  Deterministic document ID prevents duplicates.

  Example:
  referralId_rejected
  referralId_accepted
  */

  const notificationId = `${referralId}_${type}`;

  const notificationReference = db
    .collection("notifications")
    .doc(notificationId);

  const notificationSnapshot =
    await notificationReference.get();

  /*
  If notification already exists,
  do not create another duplicate.
  */

  if (notificationSnapshot.exists) {
    console.log(
      "Notification already exists:",
      notificationId
    );

    return notificationId;
  }

  const notificationData = {
    title: String(
      title || "VELZO Update"
    ),

    message: String(
      message ||
        "You have a new update from VELZO."
    ),

    type: String(
      type || "general"
    ),

    targetUserId: String(userId),

    userId: String(userId),

    recipientId: String(userId),

    targetRole: "user",

    referralId: String(referralId),

    relatedId: String(referralId),

    relatedCollection: "referrals",

    rejectionReason: String(
      rejectionReason || ""
    ),

    read: false,

    isRead: false,

    status: "unread",

    createdAt:
      admin.firestore.FieldValue.serverTimestamp(),

    updatedAt:
      admin.firestore.FieldValue.serverTimestamp(),
  };

  await notificationReference.create(
    notificationData
  );

  console.log(
    "Notification created:",
    notificationId
  );

  return notificationId;
}

/*
=========================================
CREATE NOTIFICATION FROM REFERRAL STATUS
=========================================
*/

async function createReferralStatusNotification({
  referralId,
  referralData,
  status,
}) {
  const referrerId =
    referralData.referrerId ||
    referralData.referrerUid ||
    referralData.userId ||
    "";

  if (!referrerId) {
    console.warn(
      "Referral notification skipped. Referrer ID missing.",
      referralId
    );

    return null;
  }

  const rejectionReason = String(
    referralData.rejectionReason ||
      referralData.rejectedReason ||
      referralData.reason ||
      ""
  ).trim();

  if (status === "accepted" || status === "approved") {
    return createUserNotification({
      userId: referrerId,

      title: "Referral Accepted",

      message:
        "Good news! Your referred provider has been accepted by VELZO.",

      type: "referral-accepted",

      referralId,
    });
  }

  if (status === "rejected") {
    const friendlyReason =
      getFriendlyRejectionReason(
        rejectionReason
      );

    return createUserNotification({
      userId: referrerId,

      title: "Referral Rejected",

      message:
        `Your referral was rejected. Reason: ${friendlyReason}`,

      type: "referral-rejected",

      referralId,

      rejectionReason: friendlyReason,
    });
  }

  return null;
}

/*
=========================================
FRIENDLY REJECTION REASON
=========================================
*/

function getFriendlyRejectionReason(reason) {
  const cleanReason = String(
    reason || ""
  ).trim();

  if (!cleanReason) {
    return "The referral could not be approved. Please check the provider details.";
  }

  const normalizedReason = cleanReason
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  const friendlyReasons = {
    invalid_information:
      "The information provided for this provider is invalid. Please check the details and try again.",

    phone_already_exists:
      "This phone number is already registered with VELZO. Please refer a different provider.",

    provider_already_exists:
      "This provider is already registered with VELZO.",

    duplicate:
      "This referral appears to be a duplicate referral.",

    incomplete_information:
      "Some provider details are missing. Please check the information and try again.",

    invalid_phone:
      "The provider phone number is invalid. Please check the number and try again.",

    invalid_union_id:
      "The Union / Labour ID is invalid. Please check the details and try again.",
  };

  return (
    friendlyReasons[normalizedReason] ||
    cleanReason
  );
}

/*
=========================================
ADMIN ACCESS CHECK
=========================================
*/

function checkAdminAccess(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Please login as admin."
    );
  }

  const role =
    request.auth.token?.role ||
    request.auth.token?.userRole ||
    "";

  if (
    role &&
    !isAdminRole(role)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Admin access required."
    );
  }
}

/*
=========================================
VERIFY VELZO MOBILE APP USER
=========================================
*/

exports.verifyVelzoUser = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const requestData =
        request.data || {};

      const cleanPhone =
        normalizePhone(
          requestData.phone
        );

      if (
        !/^\d{10}$/.test(cleanPhone)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Please enter a valid 10-digit phone number."
        );
      }

      const foundUser =
        await findUserByPhone(
          cleanPhone
        );

      if (!foundUser) {
        throw new HttpsError(
          "not-found",
          "No VELZO account found with this phone number. Please register in the VELZO mobile app first."
        );
      }

      const userData =
        foundUser.data;

      if (
        userData.isActive === false ||
        userData.status === "disabled" ||
        userData.status === "blocked"
      ) {
        throw new HttpsError(
          "permission-denied",
          "Your VELZO account is disabled."
        );
      }

      let firebaseUid =
        userData.uid;

      if (
        typeof firebaseUid !== "string" ||
        firebaseUid.trim().length === 0
      ) {
        firebaseUid =
          `velzo-${cleanPhone}`;
      }

      const customToken =
        await admin
          .auth()
          .createCustomToken(
            firebaseUid,
            {
              phone: cleanPhone,

              role:
                userData.role ||
                "user",

              velzoUser: true,
            }
          );

      return {
        success: true,

        token: customToken,

        user: {
          uid: firebaseUid,

          phone: cleanPhone,

          name:
            userData.name ||
            userData.fullName ||
            userData.displayName ||
            "",

          role:
            userData.role ||
            "user",

          photoURL:
            userData.photoURL ||
            userData.profilePhoto ||
            userData.profileImage ||
            "",

          isAdmin: isAdminRole(
            userData.role ||
              "user"
          ),
        },
      };
    } catch (error) {
      console.error(
        "VELZO user verification error:",
        error
      );

      if (
        error instanceof HttpsError
      ) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Unable to verify your VELZO account. Please try again."
      );
    }
  }
);

/*
=========================================
APPROVE REFERRAL
=========================================
*/

exports.approveReferral = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      checkAdminAccess(request);

      const requestData =
        request.data || {};

      const referralId =
        requestData.referralId ||
        requestData.id;

      if (!referralId) {
        throw new HttpsError(
          "invalid-argument",
          "Referral ID is required."
        );
      }

      const referralReference = db
        .collection("referrals")
        .doc(referralId);

      const referralSnapshot =
        await referralReference.get();

      if (
        !referralSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Referral not found."
        );
      }

      await referralReference.update({
        status: "accepted",

        rewardStatus: "approved",

        paymentStatus: "pending",

        acceptedAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,

        message:
          "Referral accepted successfully.",
      };
    } catch (error) {
      console.error(
        "Approve referral error:",
        error
      );

      if (
        error instanceof HttpsError
      ) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Unable to approve referral. Please try again."
      );
    }
  }
);

/*
=========================================
REJECT REFERRAL
=========================================
*/

exports.rejectReferral = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      checkAdminAccess(request);

      const requestData =
        request.data || {};

      const referralId =
        requestData.referralId ||
        requestData.id;

      const reason = String(
        requestData.reason ||
          requestData.rejectionReason ||
          ""
      ).trim();

      if (!referralId) {
        throw new HttpsError(
          "invalid-argument",
          "Referral ID is required."
        );
      }

      if (!reason) {
        throw new HttpsError(
          "invalid-argument",
          "Rejection reason is required."
        );
      }

      const referralReference = db
        .collection("referrals")
        .doc(referralId);

      const referralSnapshot =
        await referralReference.get();

      if (
        !referralSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Referral not found."
        );
      }

      await referralReference.update({
        status: "rejected",

        rejectionReason: reason,

        rewardStatus: "rejected",

        paymentStatus: "not_paid",

        reward: 0,

        rewardAmount: 0,

        rewardEarned: 0,

        referralReward: 0,

        paymentAmount: 0,

        rejectedAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,

        message:
          "Referral rejected successfully.",
      };
    } catch (error) {
      console.error(
        "Reject referral error:",
        error
      );

      if (
        error instanceof HttpsError
      ) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Unable to reject referral. Please try again."
      );
    }
  }
);

/*
=========================================
AUTOMATIC REFERRAL NOTIFICATION TRIGGER
=========================================
*/

exports.onReferralStatusChanged =
  onDocumentUpdated(
    {
      document: "referrals/{referralId}",
      region: "asia-south1",
    },
    async (event) => {
      try {
        const beforeData =
          event.data?.before?.data() || {};

        const afterData =
          event.data?.after?.data() || {};

        const referralId =
          event.params.referralId;

        const beforeStatus = String(
          beforeData.status || ""
        )
          .trim()
          .toLowerCase();

        const afterStatus = String(
          afterData.status || ""
        )
          .trim()
          .toLowerCase();

        /*
        Only create notification when status
        changes to accepted/approved/rejected.
        */

        const validStatuses = [
          "accepted",
          "approved",
          "rejected",
        ];

        if (
          !validStatuses.includes(
            afterStatus
          )
        ) {
          console.log(
            "No notification required for status:",
            afterStatus
          );

          return null;
        }

        if (
          beforeStatus === afterStatus
        ) {
          console.log(
            "Status did not change:",
            afterStatus
          );

          return null;
        }

        await createReferralStatusNotification({
          referralId,

          referralData: afterData,

          status: afterStatus,
        });

        console.log(
          "Referral status notification processed:",
          referralId,
          afterStatus
        );

        return null;
      } catch (error) {
        console.error(
          "Referral notification trigger error:",
          error
        );

        return null;
      }
    }
  );