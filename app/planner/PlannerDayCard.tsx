"use client";

import {
  memo,
  useCallback,
  type ChangeEvent
} from "react";

import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import Select from "@/app/ui/Select";
import formStyles from "@/app/ui/FormControls.module.css";
import styles from "@/app/planner/Planner.module.css";

const ELLIPSIS = "\u2026";

export type PlannerDayCardProps = {
  id: string;
  weekdayLabel: string;
  dateLabel: string;
  mealName: string;
  mealId: string | null;
  leftoverFromLabel: string | null;
  leftoverSourceId: string | null;
  leftoverSourceLabel: string | null;
  locked: boolean;
  updating: boolean;
  disableActions: boolean;
  disableSwap: boolean;
  meals: Array<{ id: string; name: string }>;
  mealMissing: boolean;
  mealPoolEmpty: boolean;
  onToggleLock: (id: string, nextLocked: boolean) => void;
  onSwapMeal: (id: string, mealId: string | null) => void;
  onSetLeftovers: (id: string, sourceId: string) => void;
  onClearLeftovers: (id: string) => void;
};

const PlannerDayCard = memo(function PlannerDayCard({
  id,
  weekdayLabel,
  dateLabel,
  mealName,
  mealId,
  leftoverFromLabel,
  leftoverSourceId,
  leftoverSourceLabel,
  locked,
  updating,
  disableActions,
  disableSwap,
  meals,
  mealMissing,
  mealPoolEmpty,
  onToggleLock,
  onSwapMeal,
  onSetLeftovers,
  onClearLeftovers
}: PlannerDayCardProps) {
  const selectId = `plan-day-${id}`;

  const handleToggle = useCallback(() => {
    onToggleLock(id, !locked);
  }, [id, locked, onToggleLock]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      const nextMealId = value ? value : null;
      const currentMealId = mealId ?? null;
      if (nextMealId === currentMealId) {
        return;
      }
      onSwapMeal(id, nextMealId);
    },
    [id, mealId, onSwapMeal]
  );

  const handleLeftovers = useCallback(() => {
    if (leftoverFromLabel) {
      onClearLeftovers(id);
      return;
    }
    if (leftoverSourceId) {
      onSetLeftovers(id, leftoverSourceId);
    }
  }, [id, leftoverFromLabel, leftoverSourceId, onClearLeftovers, onSetLeftovers]);

  const lockLabel = locked ? "Unlock Day" : "Lock Day";
  const lockStatus = locked ? "Locked" : "Unlocked";
  const leftoverLabel = leftoverFromLabel
    ? `Leftovers from ${leftoverFromLabel}`
    : leftoverSourceLabel
      ? `Use leftovers from ${leftoverSourceLabel}`
      : leftoverSourceId
        ? "Use leftovers from previous day"
        : "No leftovers available";
  const leftoversButtonLabel = leftoverFromLabel ? "Clear Leftovers" : "Use Leftovers";
  const disableLeftovers = disableActions || (!leftoverFromLabel && !leftoverSourceId);
  const showLeftoverHint = Boolean(leftoverFromLabel || leftoverSourceId);

  return (
    <Card className={styles.dayCard}>
      <div className={styles.dayHeader}>
        <div className={styles.dayTitle}>
          <span className={styles.dayName}>{weekdayLabel}</span>
          <span className={styles.dayDate}>{dateLabel}</span>
        </div>
        <span className={styles.badgeRow}>
          <span
            className={`${styles.lockBadge}${locked ? ` ${styles.lockedBadge}` : ""}`}
          >
            {lockStatus}
          </span>
          {leftoverFromLabel ? (
            <span className={`${styles.lockBadge} ${styles.leftoverBadge}`}>
              Leftovers
            </span>
          ) : null}
        </span>
      </div>

      <div className={styles.mealBlock}>
        <span className={styles.mealLabel}>Meal</span>
        <span className={styles.mealName}>{mealName}</span>
      </div>

      <div className={styles.controlGroup}>
        <label htmlFor={selectId} className={formStyles.label}>
          Swap Meal
        </label>
        <Select
          id={selectId}
          name={`meal-${id}`}
          value={mealId ?? ""}
          onChange={handleChange}
          disabled={disableSwap}
        >
          <option value="">Unassigned</option>
          {mealMissing && mealId ? (
            <option value={mealId} disabled>
              Missing meal
            </option>
          ) : null}
          {meals.map((meal) => (
            <option key={meal.id} value={meal.id}>
              {meal.name}
            </option>
          ))}
        </Select>
        {mealPoolEmpty ? (
          <p className={styles.helperText}>Add meals to enable swapping.</p>
        ) : null}
      </div>

      <div className={styles.dayActions}>
        <Button type="button" variant="secondary" onClick={handleToggle} disabled={disableActions}>
          {lockLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={handleLeftovers} disabled={disableLeftovers}>
          {leftoversButtonLabel}
        </Button>
      </div>

      {showLeftoverHint ? (
        <p className={styles.leftoverHint}>{leftoverLabel}</p>
      ) : null}

      {updating ? (
        <p className={styles.dayStatus} role="status" aria-live="polite">
          Updating{ELLIPSIS}
        </p>
      ) : null}
    </Card>
  );
});

export default PlannerDayCard;
