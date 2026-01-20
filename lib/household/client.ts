import { useEffect, useState } from "react";

export type HouseholdInfo = {
  id: string;
  name: string | null;
  role: string;
  status: string;
};

export type HouseholdListItem = {
  householdId: string;
  householdName: string | null;
  role: string;
  isCurrent: boolean;
};

/**
 * Hook to fetch current household context
 */
export function useHousehold() {
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHousehold() {
      try {
        const response = await fetch("/api/household");
        if (!response.ok) {
          throw new Error("Failed to fetch household");
        }
        const data = await response.json();
        setHousehold({
          id: data.id,
          name: data.name,
          role: data.role,
          status: data.status
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchHousehold();
  }, []);

  return { household, loading, error };
}

/**
 * Hook to fetch all households user is a member of
 */
export function useHouseholdList() {
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHouseholds = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/household/list");
      if (!response.ok) {
        throw new Error("Failed to fetch households");
      }
      const data = await response.json();
      setHouseholds(data.households);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouseholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { households, loading, error, refetch: fetchHouseholds };
}

/**
 * Switch to a different household
 */
export async function switchHousehold(householdId: string): Promise<void> {
  const response = await fetch("/api/household/switch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ householdId })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to switch household");
  }
}

/**
 * Update household name
 */
export async function updateHouseholdName(name: string): Promise<void> {
  const response = await fetch("/api/household", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to update household name");
  }
}
