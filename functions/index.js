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
  if (digits.length === 12 && digits.startsWith("91")) {
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
    const userRef = db.collection("users").doc(documentId);
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
VERIFY VELZO MOBILE APP USER
=========================================
*/

exports.verifyVelzoUser = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const requestData = request.data || {};

      const cleanPhone = normalizePhone(requestData.phone);

      if (!/^\d{10}$/.test(cleanPhone)) {
        throw new HttpsError(
          "invalid-argument",
          "Please enter a valid 10-digit phone number."
        );
      }

      const foundUser = await findUserByPhone(cleanPhone);

      if (!foundUser) {
        throw new HttpsError(
          "not-found",
          "No VELZO account found with this phone number. Please register in the VELZO mobile app first."
        );
      }

      const userData = foundUser.data;

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

      let firebaseUid = userData.uid;

      /*
      If uid is missing, create a stable UID.
      */

      if (
        typeof firebaseUid !== "string" ||
        firebaseUid.trim().length === 0
      ) {
        firebaseUid = `velzo-${cleanPhone}`;
      }

      /*
      Create Firebase custom token
      */

      const customToken = await admin
        .auth()
        .createCustomToken(firebaseUid, {
          phone: cleanPhone,
          role: userData.role || "user",
          velzoUser: true,
        });

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

          role: userData.role || "user",

          photoURL:
            userData.photoURL ||
            userData.profilePhoto ||
            userData.profileImage ||
            "",

          isAdmin: isAdminRole(
            userData.role || "user"
          ),
        },
      };
    } catch (error) {
      console.error(
        "VELZO user verification error:",
        error
      );

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Unable to verify your VELZO account. Please try again."
      );
    }
  }
);