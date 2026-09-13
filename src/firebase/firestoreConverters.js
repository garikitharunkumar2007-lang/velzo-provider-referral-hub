// src/firebase/firestoreConverters.js

import {
  Timestamp,
  collection as firestoreCollection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebaseConfig";

/* =========================================
   COMMON HELPERS
========================================= */

/**
 * Convert Firestore Timestamp, Date, number,
 * or string into a JavaScript Date.
 */
export function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  if (
    typeof value === "object" &&
    typeof value.seconds === "number"
  ) {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (typeof value === "string") {
    const parsedDate = new Date(value);

    return Number.isNaN(parsedDate.getTime())
      ? null
      : parsedDate;
  }

  return null;
}

/**
 * Convert Firestore Timestamp values into
 * JavaScript Date values recursively.
 */
export function convertTimestamps(value) {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  if (Array.isArray(value)) {
    return value.map(convertTimestamps);
  }

  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date)
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        convertTimestamps(item),
      ])
    );
  }

  return value;
}

/**
 * Convert a Firestore document snapshot
 * into a normal application object.
 */
export function convertDocument(snapshot) {
  if (!snapshot || !snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...convertTimestamps(snapshot.data()),
  };
}

/**
 * Convert a Firestore query snapshot
 * into an array of application objects.
 */
export function convertQuerySnapshot(snapshot) {
  if (!snapshot) {
    return [];
  }

  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...convertTimestamps(documentSnapshot.data()),
  }));
}

/* =========================================
   USER CONVERTER
========================================= */

export function userConverter() {
  return {
    toFirestore(user) {
      return {
        uid: user.uid || "",
        name: user.name || "",
        phone: user.phone || "",
        role: user.role || "user",
        fcmToken: user.fcmToken || "",
        referralHubEnabled:
          user.referralHubEnabled ?? true,
        createdAt:
          user.createdAt || Timestamp.now(),
        updatedAt:
          user.updatedAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   PROVIDER CONVERTER
========================================= */

export function providerConverter() {
  return {
    toFirestore(provider) {
      return {
        uid: provider.uid || "",
        name: provider.name || "",
        phone: provider.phone || "",
        service: provider.service || "",
        category: provider.category || "",
        address: provider.address || "",
        city: provider.city || "",
        role: provider.role || "provider",
        status: provider.status || "pending",
        approvalStatus:
          provider.approvalStatus || "pending",
        profileImage:
          provider.profileImage || "",
        unionId: provider.unionId || "",
        labourId: provider.labourId || "",
        rating: Number(provider.rating || 0),
        totalBookings:
          Number(provider.totalBookings || 0),
        createdAt:
          provider.createdAt || Timestamp.now(),
        updatedAt:
          provider.updatedAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   BOOKING CONVERTER
========================================= */

export function bookingConverter() {
  return {
    toFirestore(booking) {
      return {
        userId: booking.userId || "",
        providerId: booking.providerId || "",
        userName: booking.userName || "",
        providerName: booking.providerName || "",
        service: booking.service || "",
        address: booking.address || "",
        bookingDate: booking.bookingDate || null,
        bookingTime: booking.bookingTime || "",
        status: booking.status || "pending",
        paymentStatus:
          booking.paymentStatus || "pending",
        amount: Number(booking.amount || 0),
        velzoCharge: Number(
          booking.velzoCharge || 0
        ),
        tax: Number(booking.tax || 0),
        totalAmount: Number(
          booking.totalAmount || 0
        ),
        createdAt:
          booking.createdAt || Timestamp.now(),
        updatedAt:
          booking.updatedAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   PAYMENT CONVERTER
========================================= */

export function paymentConverter() {
  return {
    toFirestore(payment) {
      return {
        userId: payment.userId || "",
        providerId: payment.providerId || "",
        bookingId: payment.bookingId || "",
        razorpayOrderId:
          payment.razorpayOrderId || "",
        razorpayPaymentId:
          payment.razorpayPaymentId || "",
        amount: Number(payment.amount || 0),
        velzoCharge: Number(
          payment.velzoCharge || 0
        ),
        tax: Number(payment.tax || 0),
        totalAmount: Number(
          payment.totalAmount || 0
        ),
        currency: payment.currency || "INR",
        status: payment.status || "pending",
        paymentMethod:
          payment.paymentMethod || "razorpay",
        createdAt:
          payment.createdAt || Timestamp.now(),
        updatedAt:
          payment.updatedAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   COMPLAINT CONVERTER
========================================= */

export function complaintConverter() {
  return {
    toFirestore(complaint) {
      return {
        userId: complaint.userId || "",
        providerId: complaint.providerId || "",
        bookingId: complaint.bookingId || "",
        subject: complaint.subject || "",
        description:
          complaint.description || "",
        category: complaint.category || "",
        status: complaint.status || "open",
        adminReply:
          complaint.adminReply || "",
        priority:
          complaint.priority || "normal",
        createdAt:
          complaint.createdAt || Timestamp.now(),
        updatedAt:
          complaint.updatedAt || Timestamp.now(),
        resolvedAt:
          complaint.resolvedAt || null,
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   REFERRAL CONVERTER
========================================= */

export function referralConverter() {
  return {
    toFirestore(referral) {
      return {
        referrerId:
          referral.referrerId || "",

        referrerName:
          referral.referrerName || "",

        referrerPhone:
          referral.referrerPhone || "",

        providerName:
          referral.providerName ||
          referral.fullName ||
          "",

        phone: referral.phone || "",

        address:
          referral.address || "",

        role:
          referral.role || "",

        unionId:
          referral.unionId || "",

        upiNumber:
          referral.upiNumber || "",

        consent:
          referral.consent ?? false,

        status:
          referral.status || "pending",

        verificationStatus:
          referral.verificationStatus || "pending",

        adminStatus:
          referral.adminStatus || "pending",

        onboardingStatus:
          referral.onboardingStatus || "pending",

        reward: Number(referral.reward || 0),

        rewardStatus:
          referral.rewardStatus || "not_earned",

        paymentStatus:
          referral.paymentStatus || "pending",

        rejectionReason:
          Array.isArray(referral.rejectionReason)
            ? referral.rejectionReason
            : [],

        matchedCollection:
          referral.matchedCollection || "",

        matchedDocumentId:
          referral.matchedDocumentId || "",

        createdAt:
          referral.createdAt || Timestamp.now(),

        verifiedAt:
          referral.verifiedAt || null,

        approvedAt:
          referral.approvedAt || null,

        rejectedAt:
          referral.rejectedAt || null,

        completedAt:
          referral.completedAt || null,

        updatedAt:
          referral.updatedAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   NOTIFICATION CONVERTER
========================================= */

export function notificationConverter() {
  return {
    toFirestore(notification) {
      return {
        title: notification.title || "",
        message: notification.message || "",
        type: notification.type || "general",
        targetUserId:
          notification.targetUserId || "",
        targetRole:
          notification.targetRole || "all",
        isRead:
          notification.isRead ?? false,
        createdAt:
          notification.createdAt || Timestamp.now(),
        updatedAt:
          notification.updatedAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   ADMIN AUDIT CONVERTER
========================================= */

export function auditLogConverter() {
  return {
    toFirestore(log) {
      return {
        adminId: log.adminId || "",
        adminName: log.adminName || "",
        action: log.action || "",
        collectionName:
          log.collectionName || "",
        documentId: log.documentId || "",
        reason: log.reason || "",
        metadata: log.metadata || {},
        createdAt:
          log.createdAt || Timestamp.now(),
      };
    },

    fromFirestore(snapshot) {
      return convertDocument(snapshot);
    },
  };
}

/* =========================================
   FIRESTORE CRUD HELPERS
========================================= */

/**
 * Get all documents from a Firestore collection.
 */
export async function getCollection(collectionName) {
  if (!collectionName) {
    throw new Error("Collection name is required.");
  }

  const collectionReference = firestoreCollection(
    db,
    collectionName
  );

  const snapshot = await getDocs(collectionReference);

  return convertQuerySnapshot(snapshot);
}

/**
 * Get one document from Firestore.
 */
export async function getDocument(
  collectionName,
  documentId
) {
  if (!collectionName || !documentId) {
    return null;
  }

  const documentReference = doc(
    db,
    collectionName,
    documentId
  );

  const snapshot = await getDoc(documentReference);

  return convertDocument(snapshot);
}

/**
 * Add a new document with an automatic document ID.
 */
export async function addDocument(
  collectionName,
  data
) {
  if (!collectionName) {
    throw new Error("Collection name is required.");
  }

  const collectionReference = firestoreCollection(
    db,
    collectionName
  );

  const documentReference = await addDoc(
    collectionReference,
    {
      ...data,
      createdAt:
        data.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return documentReference.id;
}

/**
 * Create or replace a document with a custom ID.
 */
export async function setDocument(
  collectionName,
  documentId,
  data
) {
  if (!collectionName || !documentId) {
    throw new Error(
      "Collection name and document ID are required."
    );
  }

  const documentReference = doc(
    db,
    collectionName,
    documentId
  );

  await setDoc(documentReference, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  return documentId;
}

/**
 * Update selected fields of an existing document.
 */
export async function updateDocument(
  collectionName,
  documentId,
  data
) {
  if (!collectionName || !documentId) {
    throw new Error(
      "Collection name and document ID are required."
    );
  }

  const documentReference = doc(
    db,
    collectionName,
    documentId
  );

  await updateDoc(documentReference, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  return documentId;
}

/**
 * Delete a document from Firestore.
 */
export async function deleteDocument(
  collectionName,
  documentId
) {
  if (!collectionName || !documentId) {
    throw new Error(
      "Collection name and document ID are required."
    );
  }

  const documentReference = doc(
    db,
    collectionName,
    documentId
  );

  await deleteDoc(documentReference);

  return true;
}

/**
 * Get latest documents ordered by a date field.
 */
export async function getLatestDocuments(
  collectionName,
  dateField = "createdAt",
  maxDocuments = 10
) {
  if (!collectionName) {
    throw new Error("Collection name is required.");
  }

  const collectionReference = firestoreCollection(
    db,
    collectionName
  );

  const documentsQuery = query(
    collectionReference,
    orderBy(dateField, "desc"),
    limit(maxDocuments)
  );

  const snapshot = await getDocs(documentsQuery);

  return convertQuerySnapshot(snapshot);
}

/* =========================================
   DEFAULT EXPORT
========================================= */

const firestoreConverters = {
  userConverter,
  providerConverter,
  bookingConverter,
  paymentConverter,
  complaintConverter,
  referralConverter,
  notificationConverter,
  auditLogConverter,

  toDate,
  convertTimestamps,
  convertDocument,
  convertQuerySnapshot,

  getCollection,
  getDocument,
  addDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  getLatestDocuments,
};

export default firestoreConverters;