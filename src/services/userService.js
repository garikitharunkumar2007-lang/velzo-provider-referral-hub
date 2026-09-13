import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebaseConfig";

import {
  normalizePhone,
} from "../utils/normalizePhone";

/**
 * Users collection reference.
 */
const usersCollection = collection(db, "users");

/**
 * Get a user document reference.
 */
export function getUserRef(phone) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("Valid phone number is required.");
  }

  return doc(db, "users", cleanPhone);
}

/**
 * Get a user by phone number.
 */
export async function getUserByPhone(phone) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    return null;
  }

  const userSnapshot = await getDoc(
    getUserRef(cleanPhone)
  );

  if (!userSnapshot.exists()) {
    return null;
  }

  return {
    id: userSnapshot.id,
    ...userSnapshot.data(),
  };
}

/**
 * Get a user by Firebase UID.
 */
export async function getUserByUid(uid) {
  if (!uid) {
    return null;
  }

  const userQuery = query(
    usersCollection,
    where("uid", "==", uid),
    limit(1)
  );

  const snapshot = await getDocs(userQuery);

  if (snapshot.empty) {
    return null;
  }

  const userDocument = snapshot.docs[0];

  return {
    id: userDocument.id,
    ...userDocument.data(),
  };
}

/**
 * Get all users.
 *
 * Used mainly by the Admin Portal.
 */
export async function getAllUsers() {
  const usersQuery = query(
    usersCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(usersQuery);

  return snapshot.docs.map((userDocument) => ({
    id: userDocument.id,
    ...userDocument.data(),
  }));
}

/**
 * Get users by role.
 *
 * Supported roles:
 * user
 * provider
 * admin
 */
export async function getUsersByRole(role) {
  if (!role) {
    throw new Error("User role is required.");
  }

  const usersQuery = query(
    usersCollection,
    where("role", "==", role)
  );

  const snapshot = await getDocs(usersQuery);

  return snapshot.docs.map((userDocument) => ({
    id: userDocument.id,
    ...userDocument.data(),
  }));
}

/**
 * Update editable user profile details.
 *
 * Password must never be updated or stored here.
 * Password changes must be handled through Firebase Auth.
 */
export async function updateUserProfile(
  phone,
  profileData = {}
) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("Valid phone number is required.");
  }

  const allowedFields = [
    "name",
    "phone",
    "profileImage",
    "address",
    "city",
    "state",
    "pincode",
    "fcmToken",
  ];

  const safeUpdates = {};

  for (const field of allowedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        profileData,
        field
      )
    ) {
      safeUpdates[field] = profileData[field];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new Error("No valid profile details to update.");
  }

  safeUpdates.updatedAt = serverTimestamp();

  await updateDoc(
    getUserRef(cleanPhone),
    safeUpdates
  );

  return {
    success: true,
    message: "Profile updated successfully.",
  };
}

/**
 * Update FCM token for notifications.
 */
export async function updateUserFcmToken(
  phone,
  fcmToken
) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("Valid phone number is required.");
  }

  await updateDoc(
    getUserRef(cleanPhone),
    {
      fcmToken: String(fcmToken || ""),
      updatedAt: serverTimestamp(),
    }
  );

  return {
    success: true,
  };
}

/**
 * Check whether a phone number is already registered.
 */
export async function userExists(phone) {
  const user = await getUserByPhone(phone);

  return Boolean(user);
}

/**
 * Get user statistics for Admin Dashboard.
 */
export async function getUserStats() {
  const snapshot = await getDocs(usersCollection);

  const users = snapshot.docs.map((userDocument) =>
    userDocument.data()
  );

  return {
    totalUsers: users.length,
    normalUsers: users.filter(
      (user) => user.role === "user"
    ).length,
    providers: users.filter(
      (user) => user.role === "provider"
    ).length,
    admins: users.filter(
      (user) => user.role === "admin"
    ).length,
  };
}

export default {
  getUserRef,
  getUserByPhone,
  getUserByUid,
  getAllUsers,
  getUsersByRole,
  updateUserProfile,
  updateUserFcmToken,
  userExists,
  getUserStats,
};