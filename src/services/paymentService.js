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

const paymentsCollection = collection(
  db,
  "payments"
);

/**
 * Get payment document reference.
 */
export function getPaymentRef(paymentId) {
  if (!paymentId) {
    throw new Error("Payment ID is required.");
  }

  return doc(db, "payments", paymentId);
}

/**
 * Get payment by ID.
 */
export async function getPaymentById(paymentId) {
  const paymentSnapshot = await getDoc(
    getPaymentRef(paymentId)
  );

  if (!paymentSnapshot.exists()) {
    return null;
  }

  return {
    id: paymentSnapshot.id,
    ...paymentSnapshot.data(),
  };
}

/**
 * Get all payments.
 */
export async function getAllPayments() {
  const paymentsQuery = query(
    paymentsCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(paymentsQuery);

  return snapshot.docs.map((paymentDocument) => ({
    id: paymentDocument.id,
    ...paymentDocument.data(),
  }));
}

/**
 * Get payments by booking ID.
 */
export async function getPaymentsByBookingId(
  bookingId
) {
  if (!bookingId) {
    throw new Error("Booking ID is required.");
  }

  const paymentsQuery = query(
    paymentsCollection,
    where("bookingId", "==", bookingId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(paymentsQuery);

  return snapshot.docs.map((paymentDocument) => ({
    id: paymentDocument.id,
    ...paymentDocument.data(),
  }));
}

/**
 * Get payments by customer phone.
 */
export async function getPaymentsByCustomerPhone(
  phone
) {
  if (!phone) {
    throw new Error(
      "Customer phone number is required."
    );
  }

  const paymentsQuery = query(
    paymentsCollection,
    where("customerPhone", "==", phone),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(paymentsQuery);

  return snapshot.docs.map((paymentDocument) => ({
    id: paymentDocument.id,
    ...paymentDocument.data(),
  }));
}

/**
 * Get payments by payment status.
 *
 * Examples:
 * pending
 * paid
 * failed
 * refunded
 */
export async function getPaymentsByStatus(status) {
  if (!status) {
    throw new Error("Payment status is required.");
  }

  const paymentsQuery = query(
    paymentsCollection,
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(paymentsQuery);

  return snapshot.docs.map((paymentDocument) => ({
    id: paymentDocument.id,
    ...paymentDocument.data(),
  }));
}

/**
 * Update payment status.
 */
export async function updatePaymentStatus(
  paymentId,
  status,
  details = {}
) {
  if (!paymentId) {
    throw new Error("Payment ID is required.");
  }

  if (!status) {
    throw new Error("Payment status is required.");
  }

  const updates = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (details.razorpayPaymentId) {
    updates.razorpayPaymentId =
      details.razorpayPaymentId;
  }

  if (details.razorpayOrderId) {
    updates.razorpayOrderId =
      details.razorpayOrderId;
  }

  if (details.failureReason) {
    updates.failureReason =
      String(details.failureReason).trim();
  }

  if (status === "paid") {
    updates.paidAt = serverTimestamp();
  }

  if (status === "failed") {
    updates.failedAt = serverTimestamp();
  }

  if (status === "refunded") {
    updates.refundedAt = serverTimestamp();
  }

  await updateDoc(
    getPaymentRef(paymentId),
    updates
  );

  return {
    success: true,
    message: "Payment status updated successfully.",
  };
}

/**
 * Get payment statistics for Admin Dashboard.
 */
export async function getPaymentStats() {
  const snapshot = await getDocs(
    paymentsCollection
  );

  const payments = snapshot.docs.map(
    (paymentDocument) =>
      paymentDocument.data()
  );

  const totalAmount = payments.reduce(
    (total, payment) =>
      total + Number(
        payment.amount ||
          payment.totalAmount ||
          0
      ),
    0
  );

  const successfulAmount = payments
    .filter(
      (payment) =>
        payment.status === "paid" ||
        payment.status === "success" ||
        payment.status === "completed"
    )
    .reduce(
      (total, payment) =>
        total + Number(
          payment.amount ||
            payment.totalAmount ||
            0
        ),
      0
    );

  return {
    totalPayments: payments.length,

    successfulPayments: payments.filter(
      (payment) =>
        payment.status === "paid" ||
        payment.status === "success" ||
        payment.status === "completed"
    ).length,

    pendingPayments: payments.filter(
      (payment) =>
        payment.status === "pending"
    ).length,

    failedPayments: payments.filter(
      (payment) =>
        payment.status === "failed"
    ).length,

    refundedPayments: payments.filter(
      (payment) =>
        payment.status === "refunded"
    ).length,

    totalAmount,
    successfulAmount,
  };
}

export default {
  getPaymentRef,
  getPaymentById,
  getAllPayments,
  getPaymentsByBookingId,
  getPaymentsByCustomerPhone,
  getPaymentsByStatus,
  updatePaymentStatus,
  getPaymentStats,
};