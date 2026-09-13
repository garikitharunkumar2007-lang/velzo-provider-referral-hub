import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebaseConfig";

const complaintsCollection = collection(
  db,
  "complaints"
);

/**
 * Get complaint document reference.
 */
export function getComplaintRef(complaintId) {
  if (!complaintId) {
    throw new Error("Complaint ID is required.");
  }

  return doc(db, "complaints", complaintId);
}

/**
 * Create a new complaint.
 */
export async function createComplaint({
  userId = "",
  userName = "",
  userPhone = "",
  bookingId = "",
  providerId = "",
  subject = "",
  description = "",
  category = "",
  priority = "normal",
}) {
  const cleanSubject = String(subject).trim();
  const cleanDescription = String(description).trim();

  if (!cleanSubject) {
    throw new Error("Complaint subject is required.");
  }

  if (!cleanDescription) {
    throw new Error("Complaint description is required.");
  }

  const complaintData = {
    userId,
    userName,
    userPhone,
    bookingId,
    providerId,
    subject: cleanSubject,
    description: cleanDescription,
    category,
    priority,
    status: "open",
    adminReply: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
  };

  const complaintReference = await addDoc(
    complaintsCollection,
    complaintData
  );

  return complaintReference.id;
}

/**
 * Get complaint by ID.
 */
export async function getComplaintById(
  complaintId
) {
  const complaintSnapshot = await getDoc(
    getComplaintRef(complaintId)
  );

  if (!complaintSnapshot.exists()) {
    return null;
  }

  return {
    id: complaintSnapshot.id,
    ...complaintSnapshot.data(),
  };
}

/**
 * Get all complaints.
 */
export async function getAllComplaints() {
  const complaintsQuery = query(
    complaintsCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(complaintsQuery);

  return snapshot.docs.map((complaintDocument) => ({
    id: complaintDocument.id,
    ...complaintDocument.data(),
  }));
}

/**
 * Get complaints by user ID.
 */
export async function getComplaintsByUserId(
  userId
) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const complaintsQuery = query(
    complaintsCollection,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(complaintsQuery);

  return snapshot.docs.map((complaintDocument) => ({
    id: complaintDocument.id,
    ...complaintDocument.data(),
  }));
}

/**
 * Get complaints by status.
 *
 * Examples:
 * open
 * in_progress
 * resolved
 * closed
 */
export async function getComplaintsByStatus(
  status
) {
  if (!status) {
    throw new Error("Complaint status is required.");
  }

  const complaintsQuery = query(
    complaintsCollection,
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(complaintsQuery);

  return snapshot.docs.map((complaintDocument) => ({
    id: complaintDocument.id,
    ...complaintDocument.data(),
  }));
}

/**
 * Update complaint status.
 */
export async function updateComplaintStatus(
  complaintId,
  status
) {
  if (!complaintId) {
    throw new Error("Complaint ID is required.");
  }

  if (!status) {
    throw new Error("Complaint status is required.");
  }

  const updates = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (
    status === "resolved" ||
    status === "closed"
  ) {
    updates.resolvedAt = serverTimestamp();
  }

  await updateDoc(
    getComplaintRef(complaintId),
    updates
  );

  return {
    success: true,
    message: "Complaint status updated successfully.",
  };
}

/**
 * Add or update admin reply.
 */
export async function replyToComplaint(
  complaintId,
  adminReply
) {
  if (!complaintId) {
    throw new Error("Complaint ID is required.");
  }

  const cleanReply = String(
    adminReply || ""
  ).trim();

  if (!cleanReply) {
    throw new Error("Reply message is required.");
  }

  await updateDoc(
    getComplaintRef(complaintId),
    {
      adminReply: cleanReply,
      status: "in_progress",
      repliedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return {
    success: true,
    message: "Reply added successfully.",
  };
}

/**
 * Get complaint statistics for Admin Dashboard.
 */
export async function getComplaintStats() {
  const snapshot = await getDocs(
    complaintsCollection
  );

  const complaints = snapshot.docs.map(
    (complaintDocument) =>
      complaintDocument.data()
  );

  return {
    totalComplaints: complaints.length,

    openComplaints: complaints.filter(
      (complaint) =>
        complaint.status === "open"
    ).length,

    inProgressComplaints: complaints.filter(
      (complaint) =>
        complaint.status === "in_progress"
    ).length,

    resolvedComplaints: complaints.filter(
      (complaint) =>
        complaint.status === "resolved"
    ).length,

    closedComplaints: complaints.filter(
      (complaint) =>
        complaint.status === "closed"
    ).length,
  };
}

export default {
  getComplaintRef,
  createComplaint,
  getComplaintById,
  getAllComplaints,
  getComplaintsByUserId,
  getComplaintsByStatus,
  updateComplaintStatus,
  replyToComplaint,
  getComplaintStats,
};