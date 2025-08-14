# Simple developer workflow with uv (auto-fallback to pip)

SHELL := /bin/bash

VENV_DIR ?= .venv
PIP := $(VENV_DIR)/bin/pip
# If uv is present, prefer it. Otherwise use venv's python/pip.
RUN ?= $(shell command -v uv >/dev/null 2>&1 && echo "uv run" || echo "")
PY ?= $(shell if command -v uv >/dev/null 2>&1; then echo python; else echo $(VENV_DIR)/bin/python; fi)
SYNC ?= $(shell if command -v uv >/dev/null 2>&1; then echo "uv sync --all-extras"; else echo "$(PIP) install -e .[dev]"; fi)

SEED ?= src/recipes/fixtures/seed.json

.PHONY: venv setup lint format test typecheck check migrate makemigrations createsuperuser loaddata run dev clean

venv:
	@if command -v uv >/dev/null 2>&1; then \
		uv venv $(VENV_DIR); \
	else \
		python -m venv $(VENV_DIR); \
	fi; \
	echo "Activate with: source $(VENV_DIR)/bin/activate"

setup: venv
	$(SYNC)

lint:
	$(RUN) ruff check .

format:
	$(RUN) ruff format .

test:
	$(RUN) pytest --cov=src --cov-report=term-missing -q

typecheck:
	$(RUN) mypy src

check: lint typecheck test

migrate:
	$(RUN) $(PY) manage.py migrate

makemigrations:
	$(RUN) $(PY) manage.py makemigrations

createsuperuser:
	$(RUN) $(PY) manage.py createsuperuser

loaddata:
	$(RUN) $(PY) manage.py loaddata $(SEED)

run:
	$(RUN) $(PY) manage.py runserver

dev: setup migrate run

clean:
	rm -rf .pytest_cache .mypy_cache .ruff_cache **/__pycache__

.PHONY: pre-commit-install pre-commit-run
pre-commit-install:
	$(RUN) pre-commit install
	$(RUN) pre-commit autoupdate

pre-commit-run:
	$(RUN) pre-commit run --all-files
