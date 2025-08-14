from __future__ import annotations

import datetime as dt

from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, ListView, UpdateView

from .models import Meal, Recipe
from .services import generate_weekly_plan, parse_week_start


class RecipeListView(ListView):
    model = Recipe
    template_name = "recipes/recipe_list.html"
    paginate_by = 20


class RecipeCreateView(CreateView):
    model = Recipe
    fields = ("name", "description", "ingredients", "instructions", "prep_time_minutes")
    template_name = "recipes/recipe_form.html"
    success_url = reverse_lazy("recipes:recipe-list")


class RecipeUpdateView(UpdateView):
    model = Recipe
    fields = ("name", "description", "ingredients", "instructions", "prep_time_minutes")
    template_name = "recipes/recipe_form.html"
    success_url = reverse_lazy("recipes:recipe-list")


class RecipeDeleteView(DeleteView):
    model = Recipe
    template_name = "recipes/recipe_confirm_delete.html"
    success_url = reverse_lazy("recipes:recipe-list")


class MealListView(ListView):
    model = Meal
    template_name = "recipes/meal_list.html"
    paginate_by = 20

    def get_queryset(self) -> QuerySet[Meal]:
        return Meal.objects.select_related("recipe").all()


class MealCreateView(CreateView):
    model = Meal
    fields = ("name", "recipe", "notes")
    template_name = "recipes/meal_form.html"
    success_url = reverse_lazy("recipes:meal-list")


class MealUpdateView(UpdateView):
    model = Meal
    fields = ("name", "recipe", "notes")
    template_name = "recipes/meal_form.html"
    success_url = reverse_lazy("recipes:meal-list")


class MealDeleteView(DeleteView):
    model = Meal
    template_name = "recipes/meal_confirm_delete.html"
    success_url = reverse_lazy("recipes:meal-list")


def weekly_plan(request: HttpRequest) -> HttpResponse:
    start = parse_week_start(request.GET.get("start"), today=dt.date.today())
    meals = Meal.objects.select_related("recipe").all()
    plan = generate_weekly_plan(meals, start)
    context = {"plan": plan, "has_meals": bool(plan) and any(m for _, m in plan), "start": start}
    return render(request, "recipes/weekly_plan.html", context)
