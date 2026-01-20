import { useCallback, useEffect, useState } from "react";

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

type HouseholdSnapshot = {
  household: HouseholdInfo | null;
  loading: boolean;
  error: string | null;
};

const householdListeners = new Set<(snapshot: HouseholdSnapshot) => void>();
let householdSnapshot: HouseholdSnapshot = {
  household: null,
  loading: true,
  error: null
};
let householdPromise: Promise<void> | null = null;
let householdLoaded = false;

const notifyHouseholdListeners = (snapshot: HouseholdSnapshot) => {
  householdSnapshot = snapshot;
  householdListeners.forEach((listener) => listener(snapshot));
};

const loadHousehold = async ({ showLoading }: { showLoading: boolean }) => {
  if (householdPromise) {
    return householdPromise;
  }

  const shouldShowLoading = showLoading || !householdLoaded;
  notifyHouseholdListeners({
    household: householdSnapshot.household,
    loading: shouldShowLoading ? true : householdSnapshot.loading,
    error: null
  });

  householdPromise = (async () => {
    try {
      const response = await fetch("/api/household");
      if (!response.ok) {
        throw new Error("Failed to fetch household");
      }
      const data = await response.json();
      notifyHouseholdListeners({
        household: {
          id: data.id,
          name: data.name,
          role: data.role,
          status: data.status
        },
        loading: false,
        error: null
      });
    } catch (err) {
      notifyHouseholdListeners({
        household: null,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      householdLoaded = true;
      householdPromise = null;
    }
  })();

  return householdPromise;
};

/**
 * Hook to fetch current household context
 */
export function useHousehold() {
  const [snapshot, setSnapshot] = useState<HouseholdSnapshot>(() => householdSnapshot);

  useEffect(() => {
    householdListeners.add(setSnapshot);
    return () => {
      householdListeners.delete(setSnapshot);
    };
  }, []);

  useEffect(() => {
    void loadHousehold({ showLoading: true });
  }, []);

  const refetch = useCallback(() => loadHousehold({ showLoading: false }), []);

  return { household: snapshot.household, loading: snapshot.loading, error: snapshot.error, refetch };
}

/**
 * Hook to fetch all households user is a member of
 */
export function useHouseholdList() {
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHouseholds = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void fetchHouseholds();
  }, [fetchHouseholds]);

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
