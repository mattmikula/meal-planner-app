from __future__ import annotations

import calendar
import datetime as dt
import random
from typing import Iterable, List, Tuple

from .models import Meal


def start_of_week(date: dt.date) -> dt.date:
    return date - dt.timedelta(days=date.weekday())


def parse_week_start(param: str | None, today: dt.date) -> dt.date:
    # Simple and explicit: if a param is provided, try to parse; otherwise use week start.
    if not param:
        return start_of_week(today)
    try:
        return dt.date.fromisoformat(param)
    except ValueError:
        return start_of_week(today)


def generate_weekly_plan(meals: Iterable[Meal], start: dt.date) -> List[Tuple[str, Meal | None]]:
    items = list(meals)
    choices = items or [None]
    plan: List[Tuple[str, Meal | None]] = []
    for i in range(7):
        day = start + dt.timedelta(days=i)
        label = f"{calendar.day_name[day.weekday()]} ({day.isoformat()})"
        plan.append((label, random.choice(choices)))
    return plan
