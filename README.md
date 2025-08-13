# Meal Planner

A simple Django application to track recipes and meals and to generate a random weekly meal plan.

Quick start
- Create venv: `make venv`
- Install deps: `make setup`
- Migrate DB: `make migrate`
- Seed demo data: `make loaddata`
- Run dev server: `make run` (open http://127.0.0.1:8000)

Notes
- Uses `uv` when available (fast dependency management) and falls back to pip.
- App code lives under `src/`; Django project is `mealplanner`, app is `recipes`.
- See `AGENTS.md` for full repo guidelines and commands.

