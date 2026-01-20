"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHousehold, updateHouseholdName } from "@/lib/household/client";
import { createApiClient } from "@/lib/api/client";
import styles from "./HouseholdSettings.module.css";

type HouseholdMember = {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function HouseholdSettingsClient() {
  const {
    household,
    loading: householdLoading,
    error: householdError,
    refetch: refetchHousehold
  } = useHousehold();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (household) {
      setNewName(household.name || "");
    }
  }, [household]);

  useEffect(() => {
    if (!household?.id) {
      return;
    }

    let isMounted = true;

    async function fetchMembers() {
      try {
        setMembersLoading(true);
        setMembersError(null);
        const api = createApiClient();
        const { data, error } = await api.GET("/api/household/members");

        if (error || !data) {
          throw new Error("Failed to fetch household members");
        }

        if (isMounted) {
          setMembers(data.members);
        }
      } catch (err) {
        if (isMounted) {
          setMembersError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setMembersLoading(false);
        }
      }
    }

    fetchMembers();
    return () => {
      isMounted = false;
    };
  }, [household?.id]);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      setUpdateError("Household name cannot be empty");
      return;
    }

    setUpdating(true);
    setUpdateError(null);

    try {
      await updateHouseholdName(newName.trim());
      await refetchHousehold();
      setEditingName(false);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Failed to update name");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setNewName(household?.name || "");
    setEditingName(false);
    setUpdateError(null);
  };

  if (householdLoading || membersLoading) {
    return <div className={styles.loading}>Loading household settings...</div>;
  }

  if (householdError) {
    return <div className={styles.error}>Error: {householdError}</div>;
  }

  if (!household) {
    return <div className={styles.error}>No household found</div>;
  }

  const isOwner = household.role === "owner";
  const displayName = household.name || "Unnamed Household";

  return (
    <div className={styles.container}>
      {/* Household Info Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Household Information</h2>
        <div className={styles.card}>
          <div className={styles.field}>
            <label className={styles.label}>Household Name</label>
            {editingName ? (
              <div className={styles.editForm}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={styles.input}
                  maxLength={100}
                  disabled={updating}
                />
                <div className={styles.editActions}>
                  <button
                    onClick={handleUpdateName}
                    className={styles.saveButton}
                    disabled={updating}
                  >
                    {updating ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className={styles.cancelButton}
                    disabled={updating}
                  >
                    Cancel
                  </button>
                </div>
                {updateError && <p className={styles.updateError}>{updateError}</p>}
              </div>
            ) : (
              <div className={styles.nameDisplay}>
                <span className={styles.value}>{displayName}</span>
                {isOwner && (
                  <button
                    onClick={() => setEditingName(true)}
                    className={styles.editButton}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Your Role</label>
            <span className={styles.value}>
              {household.role.charAt(0).toUpperCase() + household.role.slice(1)}
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Household ID</label>
            <span className={styles.valueSecondary}>{household.id}</span>
          </div>
        </div>
      </section>

      {/* Members Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Household Members</h2>
        {membersError ? (
          <div className={styles.error}>Error loading members: {membersError}</div>
        ) : (
          <div className={styles.card}>
            {members.length === 0 ? (
              <p className={styles.emptyState}>No members found</p>
            ) : (
              <div className={styles.membersList}>
                {members.map((member) => (
                  <div key={member.id} className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberUserId}>{member.userId}</div>
                      <div className={styles.memberMeta}>
                        <span className={styles.memberRole}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                        <span className={styles.memberSeparator}>•</span>
                        <span className={styles.memberStatus}>{member.status}</span>
                        <span className={styles.memberSeparator}>•</span>
                        <span className={styles.memberDate}>
                          Joined {new Date(member.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Invitations Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Invite New Members</h2>
        <div className={styles.card}>
          <p className={styles.description}>
            Invite people to join your household so they can see and manage meals, groceries, and plans together.
          </p>
          <Link href="/household/invite" className={styles.inviteLink}>
            Go to Invite Page
          </Link>
        </div>
      </section>
    </div>
  );
}
