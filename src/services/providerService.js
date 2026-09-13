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

const providersCollection = collection(
  db,
  "providers"
);

/**
 * Get provider document reference.
 */
export function getProviderRef(providerId) {
  if (!providerId) {
    throw new Error("Provider ID is required.");
  }

  return doc(db, "providers", providerId);
}

/**
 * Get provider by document ID.
 */
export async function getProviderById(providerId) {
  const providerSnapshot = await getDoc(
    getProviderRef(providerId)
  );

  if (!providerSnapshot.exists()) {
    return null;
  }

  return {
    id: providerSnapshot.id,
    ...providerSnapshot.data(),
  };
}

/**
 * Get provider by phone number.
 */
export async function getProviderByPhone(phone) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    return null;
  }

  const providerQuery = query(
    providersCollection,
    where("phone", "==", cleanPhone),
    limit(1)
  );

  const snapshot = await getDocs(providerQuery);

  if (snapshot.empty) {
    return null;
  }

  const providerDocument = snapshot.docs[0];

  return {
    id: providerDocument.id,
    ...providerDocument.data(),
  };
}

/**
 * Get all providers.
 */
export async function getAllProviders() {
  const providersQuery = query(
    providersCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(providersQuery);

  return snapshot.docs.map((providerDocument) => ({
    id: providerDocument.id,
    ...providerDocument.data(),
  }));
}

/**
 * Get providers by approval/status.
 */
export async function getProvidersByStatus(status) {
  if (!status) {
    throw new Error("Provider status is required.");
  }

  const providersQuery = query(
    providersCollection,
    where("status", "==", status)
  );

  const snapshot = await getDocs(providersQuery);

  return snapshot.docs.map((providerDocument) => ({
    id: providerDocument.id,
    ...providerDocument.data(),
  }));
}

/**
 * Get providers by service category.
 */
export async function getProvidersByCategory(category) {
  if (!category) {
    throw new Error("Provider category is required.");
  }

  const providersQuery = query(
    providersCollection,
    where("category", "==", category)
  );

  const snapshot = await getDocs(providersQuery);

  return snapshot.docs.map((providerDocument) => ({
    id: providerDocument.id,
    ...providerDocument.data(),
  }));
}

/**
 * Update provider status.
 *
 * Example statuses:
 * pending
 * approved
 * rejected
 * suspended
 */
export async function updateProviderStatus(
  providerId,
  status,
  reason = ""
) {
  if (!providerId) {
    throw new Error("Provider ID is required.");
  }

  if (!status) {
    throw new Error("Provider status is required.");
  }

  const updates = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (reason) {
    updates.statusReason = String(reason).trim();
  }

  await updateDoc(
    getProviderRef(providerId),
    updates
  );

  return {
    success: true,
    message: "Provider status updated successfully.",
  };
}

/**
 * Update provider verification status.
 */
export async function updateProviderVerification(
  providerId,
  verificationStatus,
  verificationReason = ""
) {
  if (!providerId) {
    throw new Error("Provider ID is required.");
  }

  if (!verificationStatus) {
    throw new Error(
      "Verification status is required."
    );
  }

  const updates = {
    verificationStatus,
    updatedAt: serverTimestamp(),
  };

  if (verificationReason) {
    updates.verificationReason =
      String(verificationReason).trim();
  }

  await updateDoc(
    getProviderRef(providerId),
    updates
  );

  return {
    success: true,
    message:
      "Provider verification updated successfully.",
  };
}

/**
 * Search providers by name or phone.
 */
export async function searchProviders(searchTerm) {
  const cleanSearchTerm = String(
    searchTerm || ""
  )
    .trim()
    .toLowerCase();

  const providers = await getAllProviders();

  if (!cleanSearchTerm) {
    return providers;
  }

  return providers.filter((provider) => {
    const name = String(
      provider.name ||
        provider.fullName ||
        provider.providerName ||
        ""
    ).toLowerCase();

    const phone = normalizePhone(
      provider.phone || ""
    );

    return (
      name.includes(cleanSearchTerm) ||
      phone.includes(
        normalizePhone(cleanSearchTerm)
      )
    );
  });
}

/**
 * Get provider statistics for Admin Dashboard.
 */
export async function getProviderStats() {
  const snapshot = await getDocs(
    providersCollection
  );

  const providers = snapshot.docs.map(
    (providerDocument) =>
      providerDocument.data()
  );

  return {
    totalProviders: providers.length,

    pendingProviders: providers.filter(
      (provider) =>
        provider.status === "pending"
    ).length,

    approvedProviders: providers.filter(
      (provider) =>
        provider.status === "approved"
    ).length,

    rejectedProviders: providers.filter(
      (provider) =>
        provider.status === "rejected"
    ).length,

    suspendedProviders: providers.filter(
      (provider) =>
        provider.status === "suspended"
    ).length,
  };
}

export default {
  getProviderRef,
  getProviderById,
  getProviderByPhone,
  getAllProviders,
  getProvidersByStatus,
  getProvidersByCategory,
  updateProviderStatus,
  updateProviderVerification,
  searchProviders,
  getProviderStats,
};