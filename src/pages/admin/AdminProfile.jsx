import React, { useEffect, useRef, useState } from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import LoadingState from "../../components/LoadingState";

import {
  auth,
  db,
  storage,
} from "../../firebase/firebaseConfig";

import "./AdminProfile.css";

const initialProfile = {
  name: "",
  email: "",
  phone: "",
  role: "Administrator",
  photoURL: "",
};

function getValue(data, keys) {
  for (const key of keys) {
    if (
      data?.[key] !== undefined &&
      data?.[key] !== null &&
      String(data[key]).trim() !== ""
    ) {
      return data[key];
    }
  }

  return "";
}

function getProfileInitial(name) {
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    return "A";
  }

  return trimmedName.charAt(0).toUpperCase();
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();

  if (
    value === "admin" ||
    value === "administrator" ||
    value === "superadmin" ||
    value === "super admin"
  ) {
    return "Administrator";
  }

  return role || "Administrator";
}

function createProfileData(firebaseUser, firestoreData = {}) {
  return {
    name:
      getValue(firestoreData, [
        "name",
        "fullName",
        "displayName",
        "username",
      ]) ||
      firebaseUser?.displayName ||
      "",

    /*
      Always use the currently authenticated Firebase email.
      This prevents an old email from being displayed.
    */
    email: firebaseUser?.email || firestoreData.email || "",

    phone: getValue(firestoreData, [
      "phone",
      "phoneNumber",
      "mobile",
    ]),

    role: normalizeRole(
      getValue(firestoreData, [
        "role",
        "userRole",
      ]) || "Administrator"
    ),

    photoURL:
      getValue(firestoreData, [
        "photoURL",
        "profileImage",
        "profileImageUrl",
        "image",
        "avatar",
      ]) ||
      firebaseUser?.photoURL ||
      "",
  };
}

async function findUserProfile(firebaseUser) {
  if (!firebaseUser) {
    return null;
  }

  const uid = firebaseUser.uid;
  const email = String(firebaseUser.email || "")
    .trim()
    .toLowerCase();

  /*
    ---------------------------------------------------------
    1. First try users/{firebaseUid}
    ---------------------------------------------------------
  */
  try {
    const userDocumentReference = doc(db, "users", uid);
    const userDocumentSnapshot = await getDoc(
      userDocumentReference
    );

    if (userDocumentSnapshot.exists()) {
      return {
        collectionName: "users",
        documentId: uid,
        data: userDocumentSnapshot.data(),
      };
    }
  } catch (error) {
    console.warn(
      "Unable to load users/{uid} profile:",
      error
    );
  }

  /*
    ---------------------------------------------------------
    2. Try users collection using Firebase email
    ---------------------------------------------------------
  */
  if (email) {
    try {
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", firebaseUser.email),
        limit(1)
      );

      const usersSnapshot = await getDocs(usersQuery);

      if (!usersSnapshot.empty) {
        const matchedDocument = usersSnapshot.docs[0];

        return {
          collectionName: "users",
          documentId: matchedDocument.id,
          data: matchedDocument.data(),
        };
      }
    } catch (error) {
      console.warn(
        "Unable to find user profile by email:",
        error
      );
    }
  }

  /*
    ---------------------------------------------------------
    3. Try adminProfiles/{firebaseUid}
    ---------------------------------------------------------
  */
  try {
    const adminDocumentReference = doc(
      db,
      "adminProfiles",
      uid
    );

    const adminDocumentSnapshot = await getDoc(
      adminDocumentReference
    );

    if (adminDocumentSnapshot.exists()) {
      return {
        collectionName: "adminProfiles",
        documentId: uid,
        data: adminDocumentSnapshot.data(),
      };
    }
  } catch (error) {
    console.warn(
      "Unable to load adminProfiles/{uid}:",
      error
    );
  }

  /*
    ---------------------------------------------------------
    4. Try adminProfiles collection using email
    ---------------------------------------------------------
  */
  if (email) {
    try {
      const adminProfilesQuery = query(
        collection(db, "adminProfiles"),
        where("email", "==", firebaseUser.email),
        limit(1)
      );

      const adminProfilesSnapshot = await getDocs(
        adminProfilesQuery
      );

      if (!adminProfilesSnapshot.empty) {
        const matchedDocument =
          adminProfilesSnapshot.docs[0];

        return {
          collectionName: "adminProfiles",
          documentId: matchedDocument.id,
          data: matchedDocument.data(),
        };
      }
    } catch (error) {
      console.warn(
        "Unable to find admin profile by email:",
        error
      );
    }
  }

  return null;
}

export default function AdminProfile() {
  const [profile, setProfile] = useState(initialProfile);

  const [profileCollection, setProfileCollection] =
    useState("users");

  const [profileId, setProfileId] = useState(null);

  const [currentFirebaseUser, setCurrentFirebaseUser] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  async function loadProfile(firebaseUser = auth.currentUser) {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      if (!firebaseUser) {
        setProfile(initialProfile);
        setProfileId(null);
        setError(
          "No authenticated admin user found. Please login again."
        );
        return;
      }

      setCurrentFirebaseUser(firebaseUser);

      const result = await findUserProfile(firebaseUser);

      if (result) {
        const loadedProfile = createProfileData(
          firebaseUser,
          result.data
        );

        setProfile(loadedProfile);
        setProfileCollection(result.collectionName);
        setProfileId(result.documentId);
      } else {
        /*
          If no Firestore profile exists yet, show the current
          Firebase email instead of old hardcoded admin data.
        */
        setProfile(
          createProfileData(firebaseUser, {
            name: firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            role: "Administrator",
            phone: "",
            photoURL: firebaseUser.photoURL || "",
          })
        );

        setProfileCollection("users");
        setProfileId(firebaseUser.uid);

        setMessage(
          "Profile record was not found. Complete your profile and save it."
        );
      }
    } catch (err) {
      console.error(
        "Failed to load current admin profile:",
        err
      );

      setError(
        err?.message ||
          "Unable to load admin profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          loadProfile(firebaseUser);
        } else {
          setCurrentFirebaseUser(null);
          setProfile(initialProfile);
          setProfileId(null);
          setLoading(false);
          setError(
            "Your admin session has expired. Please login again."
          );
        }
      }
    );

    return () => unsubscribe();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    /*
      Email and role are intentionally read-only.
      Email is controlled by Firebase Authentication.
      Role must not be changed from the profile screen.
    */
    if (name === "email" || name === "role") {
      return;
    }

    setProfile((previousProfile) => ({
      ...previousProfile,
      [name]: value,
    }));

    setMessage("");
    setError("");
  }

  function openFilePicker() {
    if (uploadingPhoto || saving) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setMessage("");
    setError("");

    if (!currentFirebaseUser) {
      setError(
        "Your Firebase session is missing. Please login again."
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      setError(
        "Profile photo must be smaller than 5 MB."
      );
      return;
    }

    try {
      setUploadingPhoto(true);

      const fileExtension =
        file.name.split(".").pop()?.toLowerCase() ||
        "jpg";

      const fileName = `profile-${Date.now()}.${fileExtension}`;

      const imageReference = storageRef(
        storage,
        `adminProfiles/${currentFirebaseUser.uid}/${fileName}`
      );

      const uploadResult = await uploadBytes(
        imageReference,
        file
      );

      const downloadURL = await getDownloadURL(
        uploadResult.ref
      );

      const previousPhotoURL = profile.photoURL;

      await saveProfileToFirestore({
        photoURL: downloadURL,
      });

      setProfile((previousProfile) => ({
        ...previousProfile,
        photoURL: downloadURL,
      }));

      setMessage(
        "Profile photo uploaded successfully."
      );

      /*
        Delete previous Firebase Storage image when possible.
      */
      if (
        previousPhotoURL &&
        previousPhotoURL.includes(
          "firebasestorage.googleapis.com"
        )
      ) {
        try {
          const previousImageReference = storageRef(
            storage,
            previousPhotoURL
          );

          await deleteObject(previousImageReference);
        } catch (deleteError) {
          console.warn(
            "Previous profile image could not be deleted:",
            deleteError
          );
        }
      }
    } catch (err) {
      console.error(
        "Failed to upload profile photo:",
        err
      );

      setError(
        err?.message ||
          "Unable to upload profile photo. Please try again."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!profile.photoURL) {
      return;
    }

    if (!currentFirebaseUser) {
      setError(
        "Your Firebase session is missing. Please login again."
      );
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage("");
      setError("");

      if (
        profile.photoURL.includes(
          "firebasestorage.googleapis.com"
        )
      ) {
        try {
          const imageReference = storageRef(
            storage,
            profile.photoURL
          );

          await deleteObject(imageReference);
        } catch (deleteError) {
          console.warn(
            "Firebase image deletion failed:",
            deleteError
          );
        }
      }

      await saveProfileToFirestore({
        photoURL: "",
      });

      setProfile((previousProfile) => ({
        ...previousProfile,
        photoURL: "",
      }));

      setMessage("Profile photo removed.");
    } catch (err) {
      console.error(
        "Failed to remove profile photo:",
        err
      );

      setError(
        err?.message ||
          "Unable to remove profile photo."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveProfileToFirestore(changes) {
    if (!currentFirebaseUser) {
      throw new Error(
        "No authenticated Firebase user found."
      );
    }

    const documentId =
      profileId || currentFirebaseUser.uid;

    const profileData = {
      ...changes,
      uid: currentFirebaseUser.uid,
      email: currentFirebaseUser.email || "",
      role: "admin",
      updatedAt: new Date(),
    };

    /*
      merge:true creates the document if it does not exist
      and updates only the provided fields.
    */
    await setDoc(
      doc(
        db,
        profileCollection,
        documentId
      ),
      profileData,
      {
        merge: true,
      }
    );

    setProfileId(documentId);
  }

  function validateProfile() {
    if (!profile.name.trim()) {
      setError("Full name is required.");
      return false;
    }

    if (profile.phone.trim()) {
      const phoneDigits = profile.phone.replace(
        /\D/g,
        ""
      );

      if (
        phoneDigits.length > 0 &&
        phoneDigits.length < 10
      ) {
        setError(
          "Please enter a valid phone number."
        );
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!validateProfile()) {
      return;
    }

    if (!currentFirebaseUser) {
      setError(
        "Your Firebase session is missing. Please login again."
      );
      return;
    }

    try {
      setSaving(true);

      const updatedProfile = {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        photoURL: profile.photoURL || "",
        uid: currentFirebaseUser.uid,
        email: currentFirebaseUser.email || "",
        role: "admin",
        updatedAt: new Date(),
      };

      await saveProfileToFirestore(updatedProfile);

      setProfile((previousProfile) => ({
        ...previousProfile,
        ...updatedProfile,
        email: currentFirebaseUser.email || "",
        role: "Administrator",
      }));

      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error(
        "Failed to update admin profile:",
        err
      );

      setError(
        err?.message ||
          "Unable to update profile. Please check Firebase permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <LoadingState message="Loading admin profile..." />
    );
  }

  return (
    <section className="admin-profile-page">
      <div className="admin-profile-header">
        <div>
          <span className="admin-profile-eyebrow">
            ACCOUNT MANAGEMENT
          </span>

          <h1>Admin Profile</h1>

          <p>
            Manage your administrator account information.
          </p>
        </div>
      </div>

      {message && (
        <div
          className="admin-profile-alert admin-profile-alert-success"
          role="alert"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="admin-profile-alert admin-profile-alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="admin-profile-card">
        <div className="admin-profile-card-header">
          <div>
            <h2>Profile Information</h2>

            <p>
              Update the information displayed in the admin
              panel.
            </p>
          </div>
        </div>

        <form
          className="admin-profile-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="admin-profile-summary">
            <div className="admin-profile-avatar-wrapper">
              <button
                type="button"
                className="admin-profile-avatar-button"
                onClick={openFilePicker}
                disabled={
                  uploadingPhoto || saving
                }
                aria-label="Upload profile photo"
                title="Upload profile photo"
              >
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt="Admin profile"
                    className="admin-profile-avatar-image"
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />
                ) : (
                  <span className="admin-profile-avatar-initial">
                    {getProfileInitial(profile.name)}
                  </span>
                )}

                <span className="admin-profile-camera-icon">
                  {uploadingPhoto ? "⏳" : "📷"}
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="admin-profile-hidden-file-input"
                onChange={handlePhotoUpload}
              />

              <button
                type="button"
                className="admin-profile-upload-button"
                onClick={openFilePicker}
                disabled={
                  uploadingPhoto || saving
                }
              >
                {uploadingPhoto
                  ? "Uploading..."
                  : profile.photoURL
                  ? "Change Photo"
                  : "Upload Photo"}
              </button>

              {profile.photoURL && (
                <button
                  type="button"
                  className="admin-profile-remove-photo-button"
                  onClick={handleRemovePhoto}
                  disabled={
                    uploadingPhoto || saving
                  }
                >
                  Remove Photo
                </button>
              )}

              <small className="admin-profile-photo-help">
                JPG, PNG or WEBP. Maximum 5 MB.
              </small>
            </div>

            <div className="admin-profile-summary-content">
              <h3>
                {profile.name || "Administrator"}
              </h3>

              <p>
                {profile.role || "Administrator"}
              </p>

              {profile.email && (
                <small>{profile.email}</small>
              )}
            </div>
          </div>

          <div className="admin-profile-form-grid">
            <div className="admin-profile-form-group">
              <label htmlFor="admin-profile-name">
                Full Name
              </label>

              <input
                id="admin-profile-name"
                name="name"
                type="text"
                value={profile.name}
                onChange={handleChange}
                className="admin-profile-input"
                placeholder="Enter full name"
                autoComplete="name"
                required
              />
            </div>

            <div className="admin-profile-form-group">
              <label htmlFor="admin-profile-email">
                Email Address
              </label>

              <input
                id="admin-profile-email"
                name="email"
                type="email"
                value={profile.email}
                className="admin-profile-input"
                placeholder="admin@example.com"
                autoComplete="email"
                readOnly
                disabled
              />

              <small>
                Email is managed by Firebase Authentication.
              </small>
            </div>

            <div className="admin-profile-form-group">
              <label htmlFor="admin-profile-phone">
                Phone Number
              </label>

              <input
                id="admin-profile-phone"
                name="phone"
                type="tel"
                value={profile.phone}
                onChange={handleChange}
                className="admin-profile-input"
                placeholder="+91 XXXXX XXXXX"
                autoComplete="tel"
              />
            </div>

            <div className="admin-profile-form-group">
              <label htmlFor="admin-profile-role">
                Role
              </label>

              <input
                id="admin-profile-role"
                name="role"
                type="text"
                value={profile.role}
                className="admin-profile-input"
                placeholder="Administrator"
                readOnly
                disabled
              />

              <small>
                Admin role cannot be changed from this page.
              </small>
            </div>
          </div>

          <div className="admin-profile-actions">
            <button
              type="button"
              className="admin-profile-secondary-button"
              onClick={() => loadProfile()}
              disabled={
                loading ||
                saving ||
                uploadingPhoto
              }
            >
              Reset
            </button>

            <button
              type="submit"
              className="admin-profile-primary-button"
              disabled={
                saving ||
                uploadingPhoto
              }
            >
              {saving
                ? "Saving..."
                : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}