#!/usr/bin/env python
import os
import sys
from pathlib import Path


def main() -> None:
    # Ensure `src/` is on sys.path so the project package imports.
    project_root = Path(__file__).resolve().parent
    src_path = project_root / "src"
    if src_path.exists():
        sys.path.insert(0, str(src_path))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mealplanner.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

