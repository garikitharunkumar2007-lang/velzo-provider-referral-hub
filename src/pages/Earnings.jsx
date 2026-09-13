import React, {
  useEffect,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  getAuth,
} from "firebase/auth";

import { db } from "../firebase/firebaseConfig";

import "./Earnings.css";

export default function Earnings() {
  const [referrals, setReferrals] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const auth =
      getAuth();

    const user =
      auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const earningsQuery =
      query(
        collection(
          db,
          "referrals"
        ),
        where(
          "referrerId",
          "==",
          user.uid
        ),
        where(
          "rewardStatus",
          "==",
          "earned"
        )
      );

    const unsubscribe =
      onSnapshot(
        earningsQuery,
        (snapshot) => {
          const data =
            snapshot.docs.map(
              (doc) => ({
                id: doc.id,
                ...doc.data(),
              })
            );

          setReferrals(data);
          setLoading(false);
        },
        (error) => {
          console.error(
            error
          );

          setLoading(false);
        }
      );

    return unsubscribe;
  }, []);

  const totalEarned =
    referrals.reduce(
      (sum, item) =>
        sum +
        Number(
          item.reward || 0
        ),
      0
    );

  const fourRupee =
    referrals.filter(
      (item) =>
        Number(
          item.reward
        ) === 4
    ).length;

  const threeRupee =
    referrals.filter(
      (item) =>
        Number(
          item.reward
        ) === 3
    ).length;

  return (
    <div className="earnings-page">
      <div className="page-heading">
        <p className="eyebrow">
          VELZO
        </p>

        <h1>
          Earnings
        </h1>

        <p>
          Your rewards from successful provider referrals.
        </p>
      </div>

      <div className="earnings-hero">
        <span>
          TOTAL EARNED
        </span>

        <strong>
          ₹{totalEarned}
        </strong>

        <small>
          From {referrals.length} successful referral
          {referrals.length !==
          1
            ? "s"
            : ""}
        </small>
      </div>

      <div className="earnings-grid">
        <div className="earning-card">
          <span>
            ₹4 REFERRALS
          </span>

          <strong>
            {fourRupee}
          </strong>

          <small>
            With Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>
            ₹3 REFERRALS
          </span>

          <strong>
            {threeRupee}
          </strong>

          <small>
            Without Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>
            SUCCESSFUL
          </span>

          <strong>
            {referrals.length}
          </strong>

          <small>
            Approved referrals
          </small>
        </div>
      </div>

      <div className="earnings-list">
        <h2>
          Reward History
        </h2>

        {loading ? (
          <p>
            Loading...
          </p>
        ) : referrals.length ===
          0 ? (
          <p>
            No earned rewards yet.
          </p>
        ) : (
          referrals.map(
            (referral) => (
              <div
                className="earning-row"
                key={
                  referral.id
                }
              >
                <div>
                  <strong>
                    {referral.providerName ||
                      "Provider"}
                  </strong>

                  <span>
                    Successful referral
                  </span>
                </div>

                <strong>
                  +₹
                  {referral.reward}
                </strong>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}