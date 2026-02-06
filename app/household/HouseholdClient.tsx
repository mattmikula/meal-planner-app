"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AppNav from "@/app/ui/AppNav";
import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import TextInput from "@/app/ui/TextInput";
import formStyles from "@/app/ui/FormControls.module.css";
import layoutStyles from "@/app/ui/Layout.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";

type HouseholdContext = components["schemas"]["HouseholdContext"];
type HouseholdSummary = components["schemas"]["HouseholdSummary"];

enum HouseholdStatusMessage {
  LoadFailed = "Unable to load households.",
  UpdateFailed = "Unable to update household.",
  Updated = "Current household updated.",
  NameUpdated = "Household name updated.",
  NameUpdateFailed = "Unable to update household name."
}

const ELLIPSIS = "\u2026";

const formatHouseholdName = (name: string | null) =>
  name && name.trim() ? name : "Untitled household";

export default function HouseholdClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [current, setCurrent] = useState<HouseholdContext | null>(null);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [nameInput, setNameInput] = useState("");

  const currentSummary = households.find((household) => household.isCurrent) ?? null;
  const currentId = current?.id ?? currentSummary?.id ?? null;
  const currentName = current?.name ?? currentSummary?.name ?? null;
  const currentRole = current?.role ?? currentSummary?.role ?? null;
  const currentStatus = current?.status ?? currentSummary?.status ?? null;
  const canRename = currentRole === "owner";
  const canSaveName =
    Boolean(currentId) && canRename && nameInput.trim() !== (currentName ?? "").trim();

  const loadHouseholds = useCallback(async () => {
    setLoading(true);
    setStatus(null);

    try {
      const [contextResult, listResult] = await Promise.all([
        api.GET("/api/household"),
        api.GET("/api/households")
      ]);

      if (!isMountedRef.current) {
        return;
      }

      if (contextResult.response?.status === 401 || listResult.response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!listResult.response?.ok || !listResult.data) {
        setStatus(
          getApiErrorMessage(listResult.error) ?? HouseholdStatusMessage.LoadFailed
        );
        return;
      }

      if (contextResult.response?.status === 404) {
        setCurrent(null);
      } else if (contextResult.response?.ok && contextResult.data) {
        setCurrent(contextResult.data);
      } else if (contextResult.response) {
        setStatus(
          getApiErrorMessage(contextResult.error) ?? HouseholdStatusMessage.LoadFailed
        );
      }

      const currentHousehold = contextResult.response?.ok ? contextResult.data : null;
      const householdList = listResult.data.households;
      const currentSummary =
        householdList.find((household) => household.isCurrent) ?? null;
      const selected =
        currentSummary?.id ?? currentHousehold?.id ?? householdList[0]?.id ?? "";

      setHouseholds(householdList);
      setSelectedId(selected);
    } catch {
      if (isMountedRef.current) {
        setStatus(HouseholdStatusMessage.LoadFailed);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [api, router]);

  useEffect(() => {
    isMountedRef.current = true;
    loadHouseholds();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadHouseholds]);

  useEffect(() => {
    setNameInput(currentName ?? "");
  }, [currentId, currentName]);

  const handleUpdate = useCallback(async () => {
    if (!selectedId || selectedId === currentId) {
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const { data, response, error } = await api.PATCH("/api/household", {
        body: { householdId: selectedId }
      });

      if (!isMountedRef.current) {
        return;
      }

      if (response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!response?.ok || !data) {
        setStatus(getApiErrorMessage(error) ?? HouseholdStatusMessage.UpdateFailed);
        return;
      }

      setCurrent(data);
      setHouseholds((prev) =>
        prev.map((household) => ({
          ...household,
          isCurrent: household.id === data.id
        }))
      );
      setSelectedId(data.id);
      setStatus(HouseholdStatusMessage.Updated);
    } catch {
      if (isMountedRef.current) {
        setStatus(HouseholdStatusMessage.UpdateFailed);
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [api, currentId, router, selectedId]);

  const handleRename = useCallback(async () => {
    const targetHouseholdId = currentId;

    if (!targetHouseholdId || !canSaveName) {
      return;
    }

    const trimmedName = nameInput.trim();

    setNameSaving(true);
    setStatus(null);

    try {
      const { data, response, error } = await api.PATCH("/api/household", {
        body: {
          householdId: targetHouseholdId,
          name: trimmedName ? trimmedName : null
        }
      });

      if (!isMountedRef.current) {
        return;
      }

      if (response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!response?.ok || !data) {
        setStatus(getApiErrorMessage(error) ?? HouseholdStatusMessage.NameUpdateFailed);
        return;
      }

      setCurrent(data);
      setHouseholds((prev) =>
        prev.map((household) =>
          household.id === data.id ? { ...household, name: data.name } : household
        )
      );
      setStatus(HouseholdStatusMessage.NameUpdated);
    } catch {
      if (isMountedRef.current) {
        setStatus(HouseholdStatusMessage.NameUpdateFailed);
      }
    } finally {
      if (isMountedRef.current) {
        setNameSaving(false);
      }
    }
  }, [api, canSaveName, currentId, nameInput, router]);

  return (
    <PageLayout
      title="Household"
      subtitle="Switch the household you are planning for."
      nav={<AppNav />}
    >
      <div className={layoutStyles.stackLg}>
        <Card className={layoutStyles.stackSm}>
          <div className={layoutStyles.stackSm}>
            <p className={layoutStyles.textMuted}>Current household</p>
            <strong>
              {currentName ? formatHouseholdName(currentName) : "No household selected"}
            </strong>
          </div>
          {currentRole && currentStatus ? (
            <p className={layoutStyles.textMuted}>
              Role: {currentRole} | Status: {currentStatus}
            </p>
          ) : null}
        </Card>

        <Card className={layoutStyles.stack}>
          <div className={layoutStyles.stackSm}>
            <label htmlFor="household-name" className={formStyles.label}>
              Household name
            </label>
            <TextInput
              id="household-name"
              name="householdName"
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              autoComplete="off"
              maxLength={100}
              disabled={!currentId || !canRename}
              placeholder={`Home${ELLIPSIS}`}
            />
            {!canRename && currentId ? (
              <span className={layoutStyles.textMuted}>
                Only household owners can rename households.
              </span>
            ) : null}
          </div>
          <div className={layoutStyles.row}>
            <Button
              type="button"
              onClick={handleRename}
              disabled={!canSaveName || nameSaving}
            >
              {nameSaving ? `Saving${ELLIPSIS}` : "Save Name"}
            </Button>
          </div>
        </Card>

        <Card className={layoutStyles.stack}>
          <div className={layoutStyles.stackSm}>
            <label htmlFor="household-select" className={formStyles.label}>
              Choose household
            </label>
            <select
              id="household-select"
              className={formStyles.select}
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={loading || households.length === 0}
            >
              {households.length === 0 ? (
                <option value="">No households available</option>
              ) : (
                households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {formatHouseholdName(household.name)}
                    {household.isCurrent ? " (current)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={layoutStyles.row}>
            <Button
              type="button"
              onClick={handleUpdate}
              disabled={saving || loading || !selectedId || selectedId === currentId}
            >
              {saving ? `Updating${ELLIPSIS}` : "Set Current Household"}
            </Button>
            {loading ? <span className={layoutStyles.textMuted}>{`Loading${ELLIPSIS}`}</span> : null}
          </div>
        </Card>

        {status ? (
          <p className={layoutStyles.status} role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
      </div>
    </PageLayout>
  );
}
