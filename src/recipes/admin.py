from __future__ import annotations

from django.contrib import admin

from .models import Meal, Recipe


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ("name", "prep_time_minutes", "updated_at")
    search_fields = ("name", "ingredients")


@admin.register(Meal)
class MealAdmin(admin.ModelAdmin):
    list_display = ("name", "recipe", "created_at")
    search_fields = ("name",)

