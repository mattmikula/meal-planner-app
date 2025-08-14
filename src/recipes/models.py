from __future__ import annotations

from django.db import models
from typing import ClassVar


class Recipe(models.Model):
    # Hint to type checkers: Django injects this at runtime.
    objects: ClassVar[models.Manager]
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    ingredients = models.TextField(help_text="One item per line")
    instructions = models.TextField()
    prep_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:  # pragma: no cover - human-readable
        return self.name


class Meal(models.Model):
    # Hint to type checkers: Django injects this at runtime.
    objects: ClassVar[models.Manager]
    name = models.CharField(max_length=200)
    recipe = models.ForeignKey(Recipe, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:  # pragma: no cover
        return self.name
