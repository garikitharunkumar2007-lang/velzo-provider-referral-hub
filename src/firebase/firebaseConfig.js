/* =========================================
   VELZO FIREBASE CONFIGURATION
========================================= */

import { initializeApp } from "firebase/app";

import {
  getAnalytics,
  isSupported as analyticsIsSupported,
} from "firebase/analytics";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { getFirestore } from "firebase/firestore";

import { getDatabase } from "firebase/database";

import { getStorage } from "firebase/storage";

import { getFunctions } from "firebase/functions";

/* =========================================
   FIREBASE PROJECT CONFIG
========================================= */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,

  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,

  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId: import.meta.env.VITE_FIREBASE_APP_ID,

  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/* =========================================
   CONFIGURATION VALIDATION
========================================= */

const requiredFirebaseConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

const missingFirebaseValues = Object.entries(requiredFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseValues.length > 0) {
  console.error(
    "Missing Firebase environment variables:",
    missingFirebaseValues
  );

  throw new Error(
    `Firebase configuration is incomplete. Missing: ${missingFirebaseValues.join(
      ", "
    )}`
  );
}

/* =========================================
   INITIALIZE FIREBASE APP
========================================= */

const app = initializeApp(firebaseConfig);

/* =========================================
   FIREBASE AUTHENTICATION
========================================= */

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Firebase Auth persistence error:", error);
});

/* =========================================
   CLOUD FIRESTORE
========================================= */

export const db = getFirestore(app);

/* =========================================
   REALTIME DATABASE
========================================= */

export const realtimeDb = getDatabase(app);

/* =========================================
   FIREBASE STORAGE
========================================= */

export const storage = getStorage(app);

/* =========================================
   FIREBASE CLOUD FUNCTIONS
========================================= */

export const functions = getFunctions(app, "asia-south1");

/* =========================================
   FIREBASE ANALYTICS
========================================= */

export let analytics = null;

analyticsIsSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch((error) => {
    console.warn("Firebase Analytics is not available:", error);
  });

/* =========================================
   DEFAULT EXPORT
========================================= */

export default app;