"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import AppNav from "@/app/ui/AppNav";
import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import layoutStyles from "@/app/ui/Layout.module.css";
import styles from "@/app/planner/Planner.module.css";
import PlannerDayCard from "@/app/planner/PlannerDayCard";
import { buildPlannerDayViews } from "@/app/planner/plannerDayView";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import { getWeekStartForDate, parseDateString } from "@/lib/plans/client";

type Meal = components["schemas"]["Meal"];
type Plan = components["schemas"]["Plan"];
type PlanDay = components["schemas"]["PlanDay"];

enum PlannerStatusMessage {
  LoadFailed = "Unable to load the planner.",
  PlanGenerated = "Plan generated.",
  PlanRegenerated = "Plan regenerated.",
  PlanGenerateFailed = "Unable to generate plan.",
  PlanDayUpdateFailed = "Unable to update plan day.",
  DayLocked = "Day locked.",
  DayUnlocked = "Day unlocked.",
  MealSwapped = "Meal swapped.",
  MealCleared = "Meal cleared.",
  LeftoversSet = "Leftovers added.",
  LeftoversCleared = "Leftovers cleared.",
  LeftoversFailed = "Unable to update leftovers."
}

const ELLIPSIS = "\u2026";

export default function PlannerClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStartForDate(new Date()));

  const [checkingSession, setCheckingSession] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [updatingDayId, setUpdatingDayId] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const updateWeekStart = () => {
      const nextWeekStart = getWeekStartForDate(new Date());
      setWeekStart((current) => (current === nextWeekStart ? current : nextWeekStart));
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        updateWeekStart();
      }
    };

    window.addEventListener("focus", updateWeekStart);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", updateWeekStart);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const weekLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }),
    []
  );
  const dayNameFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }),
    []
  );
  const dayDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }),
    []
  );

  const resolvedWeekStart = plan?.weekStart ?? weekStart;
  const weekStartDate = useMemo(
    () => parseDateString(resolvedWeekStart),
    [resolvedWeekStart]
  );

  const weekLabel = useMemo(() => {
    if (!weekStartDate) {
      return "Plan your meals for the week.";
    }
    return `Week of ${weekLabelFormatter.format(weekStartDate)}`;
  }, [weekLabelFormatter, weekStartDate]);

  const mealOptions = useMemo(
    () => meals.map((meal) => ({ id: meal.id, name: meal.name })),
    [meals]
  );

  const mealIdSet = useMemo(() => new Set(meals.map((meal) => meal.id)), [meals]);

  const mealNameById = useMemo(() => {
    const map = new Map<string, string>();
    meals.forEach((meal) => {
      map.set(meal.id, meal.name);
    });
    return map;
  }, [meals]);

  const hasMealPool = meals.length > 0;
  const mealPoolEmpty = !hasMealPool;
  const hasAssignments = useMemo(
    () => (plan ? plan.days.some((day) => Boolean(day.mealId)) : false),
    [plan]
  );

  const dayViews = useMemo(() => {
    if (!plan) {
      return [];
    }

    return buildPlannerDayViews({
      days: plan.days,
      mealNameById,
      mealIdSet,
      dayNameFormatter,
      dayDateFormatter,
      updatingDayId
    });
  }, [
    plan,
    mealNameById,
    mealIdSet,
    dayNameFormatter,
    dayDateFormatter,
    updatingDayId
  ]);

  const loadPlanner = useCallback(async () => {
    if (isMountedRef.current) {
      setStatus(null);
    }

    try {
      const planPromise = api.GET("/api/plans", {
        params: { query: { weekStart } }
      });
      const mealsPromise = api.GET("/api/meals");
      const [planResult, mealsResult] = await Promise.all([planPromise, mealsPromise]);

      if (planResult.response?.status === 401 || mealsResult.response?.status === 401) {
        router.replace("/");
        return false;
      }

      let nextStatus: string | null = null;

      if (planResult.response?.ok && planResult.data) {
        if (isMountedRef.current) {
          setPlan(planResult.data);
        }
      } else {
        nextStatus =
          getApiErrorMessage(planResult.error) ?? PlannerStatusMessage.LoadFailed;
        if (isMountedRef.current) {
          setPlan(null);
        }
      }

      if (mealsResult.response?.ok && mealsResult.data) {
        if (isMountedRef.current) {
          setMeals(mealsResult.data.meals ?? []);
        }
      } else {
        if (!nextStatus) {
          nextStatus =
            getApiErrorMessage(mealsResult.error) ?? PlannerStatusMessage.LoadFailed;
        }
        if (isMountedRef.current) {
          setMeals([]);
        }
      }

      if (nextStatus && isMountedRef.current) {
        setStatus(nextStatus);
      }
    } catch {
      if (isMountedRef.current) {
        setPlan(null);
        setMeals([]);
        setStatus(PlannerStatusMessage.LoadFailed);
      }
    }

    return true;
  }, [api, router, weekStart]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      const authorized = await loadPlanner();
      if (isMounted && authorized) {
        setCheckingSession(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [loadPlanner]);

  const applyPlanDayUpdate = useCallback((updatedDay: PlanDay) => {
    setPlan((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        days: previous.days.map((day) => (day.id === updatedDay.id ? updatedDay : day))
      };
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (generating) {
      return;
    }

    setStatus(null);
    setGenerating(true);
    const hadMeals = plan ? plan.days.some((day) => Boolean(day.mealId)) : false;

    try {
      const responsePayload = await api.POST("/api/plans/generate", {
        body: { weekStart: resolvedWeekStart }
      });

      if (responsePayload.response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!responsePayload.response?.ok || !responsePayload.data) {
        setStatus(
          getApiErrorMessage(responsePayload.error) ??
            PlannerStatusMessage.PlanGenerateFailed
        );
        return;
      }

      setPlan(responsePayload.data);
      setStatus(
        hadMeals ? PlannerStatusMessage.PlanRegenerated : PlannerStatusMessage.PlanGenerated
      );
    } catch {
      setStatus(PlannerStatusMessage.PlanGenerateFailed);
    } finally {
      setGenerating(false);
    }
  }, [api, generating, plan, resolvedWeekStart, router]);

  const handleToggleLock = useCallback(
    async (id: string, nextLocked: boolean) => {
      if (updatingDayId) {
        return;
      }

      setStatus(null);
      setUpdatingDayId(id);

      try {
        const responsePayload = await api.PATCH("/api/plans/days/{id}", {
          params: { path: { id } },
          body: { locked: nextLocked }
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              PlannerStatusMessage.PlanDayUpdateFailed
          );
          return;
        }

        applyPlanDayUpdate(responsePayload.data);
        setStatus(nextLocked ? PlannerStatusMessage.DayLocked : PlannerStatusMessage.DayUnlocked);
      } catch {
        setStatus(PlannerStatusMessage.PlanDayUpdateFailed);
      } finally {
        setUpdatingDayId(null);
      }
    },
    [api, applyPlanDayUpdate, router, updatingDayId]
  );

  const handleSwapMeal = useCallback(
    async (id: string, mealId: string | null) => {
      if (updatingDayId) {
        return;
      }

      setStatus(null);
      setUpdatingDayId(id);

      try {
        const responsePayload = await api.PATCH("/api/plans/days/{id}", {
          params: { path: { id } },
          body: { mealId }
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              PlannerStatusMessage.PlanDayUpdateFailed
          );
          return;
        }

        applyPlanDayUpdate(responsePayload.data);
        setStatus(mealId ? PlannerStatusMessage.MealSwapped : PlannerStatusMessage.MealCleared);
      } catch {
        setStatus(PlannerStatusMessage.PlanDayUpdateFailed);
      } finally {
        setUpdatingDayId(null);
      }
    },
    [api, applyPlanDayUpdate, router, updatingDayId]
  );

  const handleSetLeftovers = useCallback(
    async (id: string, sourceId: string) => {
      if (updatingDayId) {
        return;
      }

      setStatus(null);
      setUpdatingDayId(id);

      try {
        const responsePayload = await api.PATCH("/api/plans/days/{id}", {
          params: { path: { id } },
          body: { leftoverFromPlanDayId: sourceId }
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              PlannerStatusMessage.LeftoversFailed
          );
          return;
        }

        applyPlanDayUpdate(responsePayload.data);
        setStatus(PlannerStatusMessage.LeftoversSet);
      } catch {
        setStatus(PlannerStatusMessage.LeftoversFailed);
      } finally {
        setUpdatingDayId(null);
      }
    },
    [api, applyPlanDayUpdate, router, updatingDayId]
  );

  const handleClearLeftovers = useCallback(
    async (id: string) => {
      if (updatingDayId) {
        return;
      }

      setStatus(null);
      setUpdatingDayId(id);

      try {
        const responsePayload = await api.PATCH("/api/plans/days/{id}", {
          params: { path: { id } },
          body: { leftoverFromPlanDayId: null }
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              PlannerStatusMessage.LeftoversFailed
          );
          return;
        }

        applyPlanDayUpdate(responsePayload.data);
        setStatus(PlannerStatusMessage.LeftoversCleared);
      } catch {
        setStatus(PlannerStatusMessage.LeftoversFailed);
      } finally {
        setUpdatingDayId(null);
      }
    },
    [api, applyPlanDayUpdate, router, updatingDayId]
  );

  if (checkingSession) {
    return (
      <PageLayout title="Planner" subtitle={weekLabel} size="wide" nav={<AppNav />}>
        <Card>
          <p>Loading planner{ELLIPSIS}</p>
        </Card>
      </PageLayout>
    );
  }

  const disableActions = generating || updatingDayId !== null;
  const actionLabel = hasAssignments ? "Regenerate Plan" : "Generate Plan";
  const actionBusyLabel = hasAssignments
    ? `Regenerating${ELLIPSIS}`
    : `Generating${ELLIPSIS}`;

  const actionButton = (
    <Button
      type="button"
      onClick={handleGenerate}
      disabled={!plan || !hasMealPool || disableActions}
    >
      {generating ? actionBusyLabel : actionLabel}
    </Button>
  );

  return (
    <PageLayout
      title="Planner"
      subtitle={weekLabel}
      size="wide"
      nav={<AppNav />}
      actions={actionButton}
    >
      {!plan ? (
        <Card className={styles.emptyState}>
          <h2>Planner Unavailable</h2>
          <p className={styles.helperText}>
            Unable to load your plan right now. Refresh the page to try again.
          </p>
        </Card>
      ) : (
        <>
          {!hasMealPool ? (
            <Card className={styles.emptyState}>
              <h2>Meal Pool Empty</h2>
              <p className={styles.helperText}>
                Add meals to generate a plan. Visit Meals to build your meal pool.
              </p>
              <Link href="/meals">Go to Meals</Link>
            </Card>
          ) : null}

          {hasMealPool && !hasAssignments ? (
            <Card className={styles.emptyState}>
              <h2>No Meals Assigned Yet</h2>
              <p className={styles.helperText}>
                Generate the week to fill in meals for each day.
              </p>
            </Card>
          ) : null}

          <ul className={styles.weekGrid}>
            {dayViews.map((dayView) => (
              <li key={dayView.id} className={styles.dayItem}>
                <PlannerDayCard
                  id={dayView.id}
                  weekdayLabel={dayView.weekdayLabel}
                  dateLabel={dayView.dateLabel}
                  mealName={dayView.mealName}
                  mealId={dayView.mealId}
                  leftoverFromLabel={dayView.leftoverFromLabel}
                  leftoverSourceId={dayView.leftoverSourceId}
                  leftoverSourceLabel={dayView.leftoverSourceLabel}
                  locked={dayView.locked}
                  updating={dayView.updating}
                  disableActions={disableActions}
                  disableSwap={
                    disableActions ||
                    !hasMealPool ||
                    Boolean(dayView.leftoverFromPlanDayId)
                  }
                  meals={mealOptions}
                  mealMissing={dayView.mealMissing}
                  mealPoolEmpty={mealPoolEmpty}
                  onToggleLock={handleToggleLock}
                  onSwapMeal={handleSwapMeal}
                  onSetLeftovers={handleSetLeftovers}
                  onClearLeftovers={handleClearLeftovers}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {status ? (
        <p className={layoutStyles.status} role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </PageLayout>
  );
}
