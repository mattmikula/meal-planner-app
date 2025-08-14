from __future__ import annotations

from django.urls import path

from . import views

app_name = "recipes"

urlpatterns = [
    # Recipe CRUD
    path("recipes/", views.RecipeListView.as_view(), name="recipe-list"),
    path("recipes/add/", views.RecipeCreateView.as_view(), name="recipe-add"),
    path("recipes/<int:pk>/edit/", views.RecipeUpdateView.as_view(), name="recipe-edit"),
    path("recipes/<int:pk>/delete/", views.RecipeDeleteView.as_view(), name="recipe-delete"),
    # Meal CRUD
    path("meals/", views.MealListView.as_view(), name="meal-list"),
    path("meals/add/", views.MealCreateView.as_view(), name="meal-add"),
    path("meals/<int:pk>/edit/", views.MealUpdateView.as_view(), name="meal-edit"),
    path("meals/<int:pk>/delete/", views.MealDeleteView.as_view(), name="meal-delete"),
    # Weekly plan
    path("plan/weekly/", views.weekly_plan, name="weekly-plan"),
]
