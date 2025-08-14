from __future__ import annotations

import datetime as dt

import pytest
from django.urls import reverse

from recipes.models import Meal, Recipe


pytestmark = pytest.mark.django_db


def test_weekly_plan_no_meals(client):
    url = reverse("recipes:weekly-plan")
    resp = client.get(url)
    assert resp.status_code == 200
    plan = resp.context["plan"]
    assert len(plan) == 7
    # No meals available -> all entries None and has_meals False
    assert all(m is None for _, m in plan)
    assert resp.context["has_meals"] is False


def test_weekly_plan_with_meal_and_custom_start(client):
    recipe = Recipe.objects.create(
        name="Tacos",
        description="",
        ingredients="tortilla\nbeef",
        instructions="Cook and serve",
    )
    Meal.objects.create(name="Dinner", recipe=recipe)

    start = dt.date(2024, 1, 3)
    url = reverse("recipes:weekly-plan") + f"?start={start.isoformat()}"
    resp = client.get(url)
    assert resp.status_code == 200
    plan = resp.context["plan"]
    assert len(plan) == 7
    assert resp.context["has_meals"] is True
    assert resp.context["start"] == start


def test_meal_list_view(client):
    url = reverse("recipes:meal-list")
    resp = client.get(url)
    assert resp.status_code == 200


def test_recipe_list_view(client):
    url = reverse("recipes:recipe-list")
    resp = client.get(url)
    assert resp.status_code == 200

