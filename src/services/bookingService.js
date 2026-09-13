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

const bookingsCollection = collection(
  db,
  "bookings"
);

/**
 * Get booking document reference.
 */
export function getBookingRef(bookingId) {
  if (!bookingId) {
    throw new Error("Booking ID is required.");
  }

  return doc(db, "bookings", bookingId);
}

/**
 * Get booking by ID.
 */
export async function getBookingById(bookingId) {
  const bookingSnapshot = await getDoc(
    getBookingRef(bookingId)
  );

  if (!bookingSnapshot.exists()) {
    return null;
  }

  return {
    id: bookingSnapshot.id,
    ...bookingSnapshot.data(),
  };
}

/**
 * Get all bookings.
 */
export async function getAllBookings() {
  const bookingsQuery = query(
    bookingsCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(bookingsQuery);

  return snapshot.docs.map((bookingDocument) => ({
    id: bookingDocument.id,
    ...bookingDocument.data(),
  }));
}

/**
 * Get bookings by customer phone.
 */
export async function getBookingsByCustomerPhone(
  phone
) {
  if (!phone) {
    throw new Error(
      "Customer phone number is required."
    );
  }

  const bookingsQuery = query(
    bookingsCollection,
    where("customerPhone", "==", phone),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(bookingsQuery);

  return snapshot.docs.map((bookingDocument) => ({
    id: bookingDocument.id,
    ...bookingDocument.data(),
  }));
}

/**
 * Get bookings by provider ID.
 */
export async function getBookingsByProviderId(
  providerId
) {
  if (!providerId) {
    throw new Error("Provider ID is required.");
  }

  const bookingsQuery = query(
    bookingsCollection,
    where("providerId", "==", providerId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(bookingsQuery);

  return snapshot.docs.map((bookingDocument) => ({
    id: bookingDocument.id,
    ...bookingDocument.data(),
  }));
}

/**
 * Get bookings by status.
 *
 * Examples:
 * pending
 * accepted
 * assigned
 * on_the_way
 * started
 * completed
 * cancelled
 * rejected
 */
export async function getBookingsByStatus(status) {
  if (!status) {
    throw new Error("Booking status is required.");
  }

  const bookingsQuery = query(
    bookingsCollection,
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(bookingsQuery);

  return snapshot.docs.map((bookingDocument) => ({
    id: bookingDocument.id,
    ...bookingDocument.data(),
  }));
}

/**
 * Update booking status.
 */
export async function updateBookingStatus(
  bookingId,
  status,
  reason = ""
) {
  if (!bookingId) {
    throw new Error("Booking ID is required.");
  }

  if (!status) {
    throw new Error("Booking status is required.");
  }

  const updates = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (reason) {
    updates.statusReason = String(reason).trim();
  }

  if (status === "accepted") {
    updates.acceptedAt = serverTimestamp();
  }

  if (status === "started") {
    updates.startedAt = serverTimestamp();
  }

  if (status === "completed") {
    updates.completedAt = serverTimestamp();
  }

  if (status === "cancelled") {
    updates.cancelledAt = serverTimestamp();
  }

  await updateDoc(
    getBookingRef(bookingId),
    updates
  );

  return {
    success: true,
    message: "Booking status updated successfully.",
  };
}

/**
 * Assign a provider to a booking.
 */
export async function assignProviderToBooking(
  bookingId,
  provider
) {
  if (!bookingId) {
    throw new Error("Booking ID is required.");
  }

  if (!provider?.id) {
    throw new Error("Provider details are required.");
  }

  const updates = {
    providerId: provider.id,
    providerName:
      provider.name ||
      provider.fullName ||
      provider.providerName ||
      "",
    providerPhone: provider.phone || "",
    status: "assigned",
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(
    getBookingRef(bookingId),
    updates
  );

  return {
    success: true,
    message: "Provider assigned successfully.",
  };
}

/**
 * Get booking statistics for Admin Dashboard.
 */
export async function getBookingStats() {
  const snapshot = await getDocs(
    bookingsCollection
  );

  const bookings = snapshot.docs.map(
    (bookingDocument) =>
      bookingDocument.data()
  );

  return {
    totalBookings: bookings.length,

    pendingBookings: bookings.filter(
      (booking) =>
        booking.status === "pending"
    ).length,

    acceptedBookings: bookings.filter(
      (booking) =>
        booking.status === "accepted"
    ).length,

    assignedBookings: bookings.filter(
      (booking) =>
        booking.status === "assigned"
    ).length,

    completedBookings: bookings.filter(
      (booking) =>
        booking.status === "completed"
    ).length,

    cancelledBookings: bookings.filter(
      (booking) =>
        booking.status === "cancelled"
    ).length,
  };
}

export default {
  getBookingRef,
  getBookingById,
  getAllBookings,
  getBookingsByCustomerPhone,
  getBookingsByProviderId,
  getBookingsByStatus,
  updateBookingStatus,
  assignProviderToBooking,
  getBookingStats,
};