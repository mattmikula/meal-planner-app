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

Testing
- Tests live alongside each app under `src/<app>/tests/` (e.g., `src/recipes/tests/`).
- Pytest is configured to discover tests under `src/` and uses `pytest-django`.
- Run tests: `uv run pytest -q` (or `pytest -q` if using pip env).
- Coverage: `uv run pytest --cov=src --cov-report=term-missing`.

Add tests for a new app
- Create `src/<your_app>/tests/__init__.py`.
- Add test files like `src/<your_app>/tests/test_<feature>.py`.
- Use `pytest.mark.django_db` or the `client` fixture as needed.

Type checking
- We use Astral's `ty` for fast type checking (reads existing mypy config).
- Run locally: `uv run ty check src` (or `ty check src` in your venv).

Pre-commit hooks
- Install hooks: `make setup && make pre-commit-install`.
- Run on all files: `make pre-commit-run`.
- Hooks include: basic file checks, Ruff lint/format (auto-fix), and `ty check src`.
