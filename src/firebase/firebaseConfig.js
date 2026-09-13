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

import {
  getFirestore,
} from "firebase/firestore";

import {
  getDatabase,
} from "firebase/database";

import {
  getStorage,
} from "firebase/storage";

import {
  getFunctions,
} from "firebase/functions";

/* =========================================
   FIREBASE PROJECT CONFIG
========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyB07S9hV1l0YXtSKrkX0pNzJLyymsKJ8iA",
  authDomain: "helpmate-3cb4f.firebaseapp.com",

  databaseURL:
    "https://helpmate-3cb4f-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "helpmate-3cb4f",

  storageBucket:
    "helpmate-3cb4f.firebasestorage.app",

  messagingSenderId: "577115961619",

  appId:
    "1:577115961619:web:b091bb1791b99d461442e6",

  measurementId: "G-M187BC4QL5",
};

/* =========================================
   INITIALIZE FIREBASE APP
========================================= */

const app = initializeApp(firebaseConfig);

/* =========================================
   FIREBASE SERVICES
========================================= */

/*
 * Firebase Authentication
 *
 * Used if Firebase Auth is required
 * elsewhere in the application.
 */
export const auth = getAuth(app);

/*
 * Keep Firebase Auth session persistent
 * in the browser.
 */
setPersistence(
  auth,
  browserLocalPersistence
).catch((error) => {
  console.error(
    "Firebase Auth persistence error:",
    error
  );
});

/*
 * Cloud Firestore
 *
 * VELZO mobile app users are stored in:
 *
 * users/{phoneNumber}
 */
export const db = getFirestore(app);

/*
 * Firebase Realtime Database
 */
export const realtimeDb = getDatabase(app);

/*
 * Firebase Storage
 */
export const storage = getStorage(app);

/*
 * Firebase Cloud Functions
 *
 * Region must match deployed functions.
 */
export const functions = getFunctions(
  app,
  "asia-south1"
);

/* =========================================
   ANALYTICS
========================================= */

/*
 * Analytics may not be supported in every
 * browser or local development environment.
 */
export let analytics = null;

analyticsIsSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch((error) => {
    console.warn(
      "Firebase Analytics is not available:",
      error
    );
  });

/* =========================================
   DEFAULT EXPORT
========================================= */

export default app;