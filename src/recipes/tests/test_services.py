from __future__ import annotations

import datetime as dt

import pytest

from recipes.models import Meal, Recipe
from recipes.services import (
    generate_weekly_plan,
    parse_week_start,
    start_of_week,
)


def test_start_of_week_returns_monday():
    # Wednesday -> Monday of same week
    wednesday = dt.date(2024, 7, 10)
    assert start_of_week(wednesday) == dt.date(2024, 7, 8)


@pytest.mark.parametrize(
    "param,today,expected",
    [
        (None, dt.date(2024, 7, 10), dt.date(2024, 7, 8)),  # missing param -> week start
        ("2024-01-03", dt.date(2024, 7, 10), dt.date(2024, 1, 3)),  # iso date
        ("not-a-date", dt.date(2024, 7, 10), dt.date(2024, 7, 8)),  # fallback on bad input
    ],
)
def test_parse_week_start(param: str | None, today: dt.date, expected: dt.date):
    assert parse_week_start(param, today=today) == expected


def test_generate_weekly_plan_with_no_meals_is_deterministic():
    start = dt.date(2024, 7, 8)  # Monday
    plan = generate_weekly_plan([], start)
    # Always seven days, labels include weekday + iso date, and all meals None
    assert len(plan) == 7
    for i, (label, meal) in enumerate(plan):
        assert meal is None
        day = start + dt.timedelta(days=i)
        assert day.isoformat() in label


@pytest.mark.django_db
def test_generate_weekly_plan_with_single_meal_is_deterministic():
    # With exactly one meal, random.choice will always return that meal
    recipe = Recipe.objects.create(
        name="Pasta",
        description="",
        ingredients="noodles\nsauce",
        instructions="Boil and mix",
    )
    meal = Meal.objects.create(name="Dinner", recipe=recipe)

    start = dt.date(2024, 7, 8)
    plan = generate_weekly_plan(Meal.objects.all(), start)

    assert len(plan) == 7
    # Instances fetched via queryset are distinct objects; compare by pk/equality
    assert all((m is not None and m.pk == meal.pk) for _, m in plan)

