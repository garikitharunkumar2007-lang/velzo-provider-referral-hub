import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { logout } from "../utils/logout";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    gender: "",
    role: "user",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    gender: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const firebaseUser = auth.currentUser;

        if (!firebaseUser) {
          navigate("/login", { replace: true });
          return;
        }

        const phone = firebaseUser.email
          ?.replace("@velzo.com", "")
          ?.replace(/\D/g, "");

        if (!phone) {
          setErrorMessage("Registered mobile number not found.");
          setLoading(false);
          return;
        }

        const userRef = doc(db, "users", phone);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data();

          const updatedProfile = {
            name: data.name || "",
            phone: data.phone || phone,
            gender: data.gender || "",
            role: data.role || "user",
          };

          setProfile(updatedProfile);

          setEditForm({
            name: updatedProfile.name,
            gender: updatedProfile.gender,
          });
        } else {
          setProfile({
            name: "",
            phone,
            gender: "",
            role: "user",
          });

          setEditForm({
            name: "",
            gender: "",
          });
        }
      } catch (error) {
        console.error("Profile loading failed:", error);
        setErrorMessage("Unable to load profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleEditClick = () => {
    setEditForm({
      name: profile.name,
      gender: profile.gender === "Not provided" ? "" : profile.gender,
    });

    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditForm({
      name: profile.name,
      gender: profile.gender === "Not provided" ? "" : profile.gender,
    });

    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(false);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveChanges = async (event) => {
    event.preventDefault();

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      navigate("/login", { replace: true });
      return;
    }

    const trimmedName = editForm.name.trim();

    if (!trimmedName) {
      setErrorMessage("Please enter your name.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const phone = firebaseUser.email
        ?.replace("@velzo.com", "")
        ?.replace(/\D/g, "");

      if (!phone) {
        setErrorMessage("Registered mobile number not found.");
        return;
      }

      const userRef = doc(db, "users", phone);

      const updatedData = {
        name: trimmedName,
        gender: editForm.gender || "Not provided",
      };

      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        await updateDoc(userRef, updatedData);
      } else {
        await setDoc(userRef, {
          phone,
          role: "user",
          ...updatedData,
        });
      }

      setProfile((previous) => ({
        ...previous,
        name: trimmedName,
        gender: editForm.gender || "Not provided",
      }));

      setEditForm({
        name: trimmedName,
        gender: editForm.gender || "",
      });

      setIsEditing(false);
      setSuccessMessage("Profile updated successfully.");
    } catch (error) {
      console.error("Profile update failed:", error);
      setErrorMessage("Unable to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="profile-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-top">
          <div className="profile-avatar">
            {profile.name
              ? profile.name.charAt(0).toUpperCase()
              : "U"}
          </div>

          <h1>{profile.name || "VELZO User"}</h1>

          <span className="profile-account-label">
            VELZO Account
          </span>
        </div>

        {errorMessage && (
          <div className="profile-message error-message">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="profile-message success-message">
            {successMessage}
          </div>
        )}

        {!isEditing ? (
          <>
            <div className="profile-details">
              <div className="profile-row">
                <span>Registered Mobile Number</span>
                <strong>
                  {profile.phone || "Not available"}
                </strong>
              </div>

              <div className="profile-row">
                <span>Name</span>
                <strong>
                  {profile.name || "Not provided"}
                </strong>
              </div>

              <div className="profile-row">
                <span>Gender</span>
                <strong>
                  {profile.gender || "Not provided"}
                </strong>
              </div>

              <div className="profile-row">
                <span>Role</span>
                <strong className="role-badge">
                  {profile.role === "provider"
                    ? "Provider"
                    : "User"}
                </strong>
              </div>
            </div>

            <div className="profile-actions">
              <button
                type="button"
                className="edit-button"
                onClick={handleEditClick}
              >
                ✏️ Edit Profile
              </button>

              <button
                type="button"
                className="logout-button"
                onClick={() => logout(navigate)}
              >
                🚪 Logout
              </button>
            </div>
          </>
        ) : (
          <form
            className="profile-edit-form"
            onSubmit={handleSaveChanges}
          >
            <div className="form-group">
              <label htmlFor="profile-phone">
                Registered Mobile Number
              </label>

              <input
                id="profile-phone"
                type="text"
                value={profile.phone || "Not available"}
                disabled
                readOnly
              />

              <small>
                Mobile number cannot be changed here.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="profile-name">
                Name
              </label>

              <input
                id="profile-name"
                name="name"
                type="text"
                value={editForm.name}
                onChange={handleInputChange}
                placeholder="Enter your name"
                maxLength={80}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-gender">
                Gender
              </label>

              <select
                id="profile-gender"
                name="gender"
                value={editForm.gender}
                onChange={handleInputChange}
              >
                <option value="">
                  Select gender
                </option>
                <option value="Male">
                  Male
                </option>
                <option value="Female">
                  Female
                </option>
                <option value="Other">
                  Other
                </option>
                <option value="Prefer not to say">
                  Prefer not to say
                </option>
              </select>
            </div>

            <div className="edit-actions">
              <button
                type="submit"
                className="save-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}