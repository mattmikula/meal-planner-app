import type { components } from "@/lib/api/types";
import { parseDateString } from "@/lib/plans/client";

type PlanDay = components["schemas"]["PlanDay"];

export type PlannerDayView = {
  id: string;
  weekdayLabel: string;
  dateLabel: string;
  mealName: string;
  mealId: string | null;
  leftoverFromLabel: string | null;
  leftoverFromPlanDayId: string | null;
  leftoverSourceId: string | null;
  leftoverSourceLabel: string | null;
  locked: boolean;
  updating: boolean;
  mealMissing: boolean;
};

type BuildPlannerDayViewsArgs = {
  days: PlanDay[];
  mealNameById: Map<string, string>;
  mealIdSet: Set<string>;
  dayNameFormatter: Intl.DateTimeFormat;
  dayDateFormatter: Intl.DateTimeFormat;
  updatingDayId: string | null;
};

export const buildPlannerDayViews = ({
  days,
  mealNameById,
  mealIdSet,
  dayNameFormatter,
  dayDateFormatter,
  updatingDayId
}: BuildPlannerDayViewsArgs): PlannerDayView[] => {
  const dayById = new Map(days.map((day) => [day.id, day]));

  return days.map((day, index) => {
    const parsedDate = parseDateString(day.date);
    const weekdayLabel = parsedDate ? dayNameFormatter.format(parsedDate) : day.date;
    const dateLabel = parsedDate ? dayDateFormatter.format(parsedDate) : day.date;
    const normalizedMealId = day.mealId ?? null;
    const mealName = normalizedMealId
      ? mealNameById.get(normalizedMealId) ?? "Unknown meal"
      : "Unassigned";
    const mealMissing = normalizedMealId ? !mealIdSet.has(normalizedMealId) : false;
    const isUpdating = updatingDayId === day.id;

    const leftoverSource = day.leftoverFromPlanDayId
      ? dayById.get(day.leftoverFromPlanDayId) ?? null
      : null;
    const leftoverSourceDate = leftoverSource ? parseDateString(leftoverSource.date) : null;
    const leftoverFromLabel = leftoverSourceDate
      ? dayNameFormatter.format(leftoverSourceDate)
      : null;

    const previousDay = index > 0 ? days[index - 1] : null;
    const previousDayHasMeal = Boolean(previousDay?.mealId);
    const previousDayDate = previousDay ? parseDateString(previousDay.date) : null;
    const leftoverSourceLabel =
      previousDayHasMeal && previousDayDate
        ? dayNameFormatter.format(previousDayDate)
        : null;
    const leftoverSourceId = previousDayHasMeal ? previousDay?.id ?? null : null;

    return {
      id: day.id,
      weekdayLabel,
      dateLabel,
      mealName,
      mealId: normalizedMealId,
      leftoverFromLabel,
      leftoverFromPlanDayId: day.leftoverFromPlanDayId ?? null,
      leftoverSourceId,
      leftoverSourceLabel,
      locked: day.locked,
      updating: isUpdating,
      mealMissing
    };
  });
};
