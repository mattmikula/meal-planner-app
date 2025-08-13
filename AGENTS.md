# Repository Guidelines

## Project Structure & Module Organization
- Code lives in `src/` as installable packages (e.g., `src/<package>/`).
- Tests live in `tests/` mirroring package layout: `tests/test_<module>.py`.
- Developer tooling and one-off scripts go in `scripts/`.
- Config files: `pyproject.toml` (tools/build), `uv.lock` (resolved deps), `.env.example` (env vars).

## Build, Test, and Development Commands (uv + Ruff)
- Install Python: `uv python install 3.11` (or your version).
- Create venv (optional): `uv venv .venv && source .venv/bin/activate`.
- Install deps from lock/pyproject: `uv sync` (use `--all-extras` if needed).
- Add dependencies: `uv add <pkg>`; dev deps: `uv add --dev ruff pytest mypy pytest-cov`.
- Run tests: `uv run pytest -q` (filter: `-k <pattern>`).
- Coverage: `uv run pytest --cov=src --cov-report=term-missing`.
- Lint/format: `uv run ruff check .` and `uv run ruff format .`.
- Type check: `uv run mypy src`.

### Install uv
- macOS: `brew install uv`
- Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Windows (winget): `winget install Astral.Uv` or PowerShell: `iwr -useb https://astral.sh/uv/install.ps1 | iex`
- Verify: `uv --version`

### Fallback without uv (pip)
- Create env: `python -m venv .venv && source .venv/bin/activate`.
- Install deps: `pip install -e .[dev]`.
- Lint/format: `ruff check . && ruff format .`; type check: `mypy src`; tests: `pytest --cov=src --cov-report=term-missing`.

### Django app
- Migrate DB: `uv run python manage.py migrate`.
- Create superuser: `uv run python manage.py createsuperuser`.
- Run dev server: `uv run python manage.py runserver` then open `http://127.0.0.1:8000/`.
- Seed sample data: `uv run python manage.py loaddata src/recipes/fixtures/seed.json`.
  - Without uv: drop `uv run` and use plain `python manage.py ...`.
 - Database: `db.sqlite3` is not tracked. Create it locally via migrations; remove it to reset.

## Makefile Workflow
- `make venv`: create `.venv` via `uv venv` if available, else `python -m venv`. Activate: `source .venv/bin/activate` (Windows PowerShell: `.\.venv\Scripts\Activate.ps1`).
- `make setup`: install dependencies (`uv sync --all-extras` or `pip install -e .[dev]`).
- `make migrate` / `make loaddata` / `make run`: DB migrate, load fixtures, start dev server.
- `make lint` / `make format` / `make typecheck` / `make test` / `make check`: quality and tests.
- `make dev`: setup → migrate → run (convenient first run).
- Note (Windows): if `make` is unavailable, install via Git for Windows or run the underlying commands directly.

## Coding Style & Naming Conventions
- Indentation: 4 spaces; target line length 88–100.
- Type hints for public APIs; prefer dataclasses over tuples.
- Naming: modules `lower_snake`, functions/vars `lower_snake`, classes `UpperCamel`, constants `UPPER_SNAKE`.
- Imports grouped stdlib/third-party/local; keep sorted (Ruff handles via `I` rules).
- Control flow: use straightforward `if/else` for binary decisions; reserve dispatch/jump tables for multi-branch or extensible routing. Keep functions small to minimize cyclomatic complexity. Embrace the Zen of Python: explicit, simple, and readable.
- Functions should be small and concise with minimal cyclomatic complexity
- Prefer jump tables instead of if statements for flow
- Follow the zen of python as much as possible

## Testing Guidelines
- Framework: `pytest` with `pytest-cov` for coverage.
- Place unit tests under `tests/`; name files `test_*.py`; use `conftest.py` for shared fixtures.
- Aim for ≥85% line coverage.
- Prefer fast, deterministic tests; mock I/O and network.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Imperative, concise subject lines; add context in body when needed.
- Every PR: explain change/rationale, reference issues (`Closes #123`), include tests/docs, and pass CI.
- Keep PRs focused and small; add screenshots for any UI output.

## Security & Configuration Tips
- Never commit secrets; load via environment variables. Provide `.env.example` with safe placeholders.
- Commit `pyproject.toml` and `uv.lock`. Ignore `.venv/`, `.pytest_cache/`, and local artifacts.
- If using Dev Containers, open in container for consistent tooling (`.devcontainer/`).
