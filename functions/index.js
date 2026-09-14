const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

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

  // 10 digit Indian number
  if (digits.length === 10) {
    return digits;
  }

  // 91 + 10 digit Indian number
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
    const userRef = db
      .collection("users")
      .doc(documentId);

    const userSnapshot = await userRef.get();

    if (userSnapshot.exists) {
      return {
        documentId,
        snapshot: userSnapshot,
        data: userSnapshot.data() || {},
      };
    }
  }

  /*
  Fallback query:
  Search phone field also.
  */

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
    const firstDocument =
      phoneQuery.docs[0];

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
      "Notification skipped: userId is missing."
    );

    return null;
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

    /*
    Main field used by Notifications.jsx
    */

    targetUserId: String(userId),

    /*
    Extra compatible fields
    */

    userId: String(userId),

    recipientId: String(userId),

    targetRole: "user",

    referralId: referralId || "",

    relatedId: referralId || "",

    relatedCollection: "referrals",

    rejectionReason:
      rejectionReason || "",

    /*
    Read status fields
    */

    read: false,

    isRead: false,

    status: "unread",

    /*
    Firebase server timestamps
    */

    createdAt:
      admin.firestore.FieldValue.serverTimestamp(),

    updatedAt:
      admin.firestore.FieldValue.serverTimestamp(),
  };

  const notificationReference = await db
    .collection("notifications")
    .add(notificationData);

  console.log(
    "Notification created:",
    notificationReference.id
  );

  return notificationReference.id;
}

/*
=========================================
ADMIN ACCESS CHECK
=========================================
*/

function checkAdminAccess(request) {
  /*
  Firebase Authentication check
  */

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

  /*
  If role is available, verify it.
  */

  if (
    role &&
    !isAdminRole(role)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Admin access required."
    );
  }

  /*
  If your admin authentication uses
  another method, this still allows
  authenticated admin calls.
  */
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

      /*
      Account status check
      */

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

      /*
      Existing Firebase UID from mobile app
      */

      let firebaseUid =
        userData.uid;

      /*
      If uid is missing, create a stable UID.
      */

      if (
        typeof firebaseUid !== "string" ||
        firebaseUid.trim().length === 0
      ) {
        firebaseUid =
          `velzo-${cleanPhone}`;
      }

      /*
      Create Firebase custom token
      */

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

      /*
      Return safe data only
      */

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

      const referralData =
        referralSnapshot.data() || {};

      /*
      Update referral status
      */

      await referralReference.update({
        status: "accepted",

        rewardStatus: "approved",

        paymentStatus: "pending",

        acceptedAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      /*
      Create notification for referrer
      */

      await createUserNotification({
        userId:
          referralData.referrerId,

        title:
          "Referral Accepted",

        message:
          "Good news! Your referred provider has been accepted by VELZO.",

        type:
          "referral-accepted",

        referralId,
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

      const referralData =
        referralSnapshot.data() || {};

      /*
      Update referral as rejected
      */

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

      /*
      Create notification for referrer
      */

      await createUserNotification({
        userId:
          referralData.referrerId,

        title:
          "Referral Rejected",

        message:
          `Your referral was rejected because: ${reason}`,

        type:
          "referral-rejected",

        referralId,

        rejectionReason: reason,
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