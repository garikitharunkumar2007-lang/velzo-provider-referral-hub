// src/firebase/verifiedProviderService.js

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "./firebaseConfig";

/*
|--------------------------------------------------------------------------
| Collections that must be checked before accepting a referral
|--------------------------------------------------------------------------
*/

export const PROVIDER_COLLECTIONS_TO_CHECK = [
  "tadepalligudem_mechanics",
  "tanuku_plumbers",
  "tanuku_mechanics",
  "union_master_list",
  "verifiedProviders",
];

/*
|--------------------------------------------------------------------------
| Phone field names
|--------------------------------------------------------------------------
*/

const PHONE_FIELD_NAMES = new Set([
  "phone",
  "phonenumber",
  "phone_number",
  "phone-no",
  "phoneno",
  "phone_no",

  "mobile",
  "mobilenumber",
  "mobile_number",
  "mobileno",
  "mobile_no",

  "contact",
  "contactnumber",
  "contact_number",
  "contactno",
  "contact_no",

  "providerphone",
  "provider_phone",
  "providermobile",
  "provider_mobile",

  "whatsapp",
  "whatsappnumber",
  "whatsapp_number",

  "telephone",
  "telephone_number",
]);

/*
|--------------------------------------------------------------------------
| Normalize phone number
|--------------------------------------------------------------------------
|
| Supports:
| 9966278866
| +919966278866
| +91 9966278866
| 99662-78866
|
*/

export function normalizePhoneNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const digits = String(value).replace(
    /\D/g,
    ""
  );

  if (!digits) {
    return "";
  }

  // Indian number with country code
  if (
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return digits.slice(2);
  }

  // Any longer number: use the last 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

/*
|--------------------------------------------------------------------------
| Normalize field name
|--------------------------------------------------------------------------
*/

function normalizeFieldName(fieldName) {
  return String(fieldName || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

/*
|--------------------------------------------------------------------------
| Detect possible phone field
|--------------------------------------------------------------------------
*/

function isPhoneField(fieldName) {
  const normalizedName =
    normalizeFieldName(
      fieldName
    );

  if (
    PHONE_FIELD_NAMES.has(
      fieldName
    )
  ) {
    return true;
  }

  if (
    PHONE_FIELD_NAMES.has(
      normalizedName
    )
  ) {
    return true;
  }

  /*
   * Also support unknown names such as:
   * alternatePhone
   * emergencyMobile
   * contactMobileNumber
   */

  return (
    normalizedName.includes("phone") ||
    normalizedName.includes("mobile") ||
    normalizedName.includes("contactnumber") ||
    normalizedName.includes("whatsapp") ||
    normalizedName.includes("telephone")
  );
}

/*
|--------------------------------------------------------------------------
| Extract phone values from nested Firestore data
|--------------------------------------------------------------------------
*/

function collectPhoneValues(
  value,
  fieldName = ""
) {
  const phoneValues = [];

  if (
    value === null ||
    value === undefined
  ) {
    return phoneValues;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    if (
      isPhoneField(fieldName)
    ) {
      phoneValues.push(
        value
      );
    }

    return phoneValues;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      phoneValues.push(
        ...collectPhoneValues(
          item,
          fieldName
        )
      );
    }

    return phoneValues;
  }

  if (
    typeof value === "object"
  ) {
    for (const [
      nestedFieldName,
      nestedValue,
    ] of Object.entries(value)) {
      phoneValues.push(
        ...collectPhoneValues(
          nestedValue,
          nestedFieldName
        )
      );
    }
  }

  return phoneValues;
}

/*
|--------------------------------------------------------------------------
| Check one provider document
|--------------------------------------------------------------------------
*/

function documentContainsPhone(
  documentData,
  targetPhone
) {
  const phoneValues =
    collectPhoneValues(
      documentData
    );

  return phoneValues.some(
    (phoneValue) => {
      const normalizedValue =
        normalizePhoneNumber(
          phoneValue
        );

      return (
        normalizedValue ===
          targetPhone &&
        normalizedValue.length === 10
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Search one collection
|--------------------------------------------------------------------------
*/

async function searchCollectionForPhone(
  collectionName,
  targetPhone
) {
  const providerCollection =
    collection(
      db,
      collectionName
    );

  const snapshot =
    await getDocs(
      providerCollection
    );

  for (
    const providerDocument of snapshot.docs
  ) {
    const providerData =
      providerDocument.data();

    if (
      documentContainsPhone(
        providerData,
        targetPhone
      )
    ) {
      return {
        id: providerDocument.id,
        collectionName,
        ...providerData,
      };
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Find provider by phone in every required collection
|--------------------------------------------------------------------------
*/

export async function findProviderByPhone(
  phoneNumber
) {
  const targetPhone =
    normalizePhoneNumber(
      phoneNumber
    );

  if (
    targetPhone.length !== 10
  ) {
    return null;
  }

  for (
    const collectionName of
      PROVIDER_COLLECTIONS_TO_CHECK
  ) {
    const existingProvider =
      await searchCollectionForPhone(
        collectionName,
        targetPhone
      );

    if (
      existingProvider
    ) {
      return existingProvider;
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Public duplicate checker
|--------------------------------------------------------------------------
*/

export async function checkProviderPhoneExists(
  phoneNumber
) {
  const normalizedPhone =
    normalizePhoneNumber(
      phoneNumber
    );

  if (
    normalizedPhone.length !== 10
  ) {
    return {
      isDuplicate: false,
      existingProvider: null,
      normalizedPhone,
    };
  }

  const existingProvider =
    await findProviderByPhone(
      normalizedPhone
    );

  return {
    isDuplicate:
      Boolean(
        existingProvider
      ),

    existingProvider,

    normalizedPhone,
  };
}

export async function findVerifiedProviderByPhone(
  phoneNumber
) {
  return findProviderByPhone(
    phoneNumber
  );
}

export default {
  normalizePhoneNumber,
  findProviderByPhone,
  findVerifiedProviderByPhone,
  checkProviderPhoneExists,
};