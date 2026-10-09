from __future__ import annotations

from datetime import date, datetime
from typing import Any


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def _is_boolean_string(value: str) -> bool:
    return value.strip().lower() in {"true", "false"}


def _is_number_string(value: str) -> bool:
    trimmed = value.strip()
    if not trimmed:
        return False
    try:
        float(trimmed)
    except ValueError:
        return False
    return True


def _is_date_string(value: str) -> bool:
    trimmed = value.strip()
    if not trimmed or not any(ch.isdigit() for ch in trimmed):
        return False
    if _is_number_string(trimmed):
        return False
    try:
        datetime.fromisoformat(trimmed.replace("Z", "+00:00"))
        return True
    except ValueError:
        pass
    # Fallback for common non-ISO date strings.
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            datetime.strptime(trimmed, fmt)
            return True
        except ValueError:
            continue
    return False


def _matches_column_type(value: Any, col_type: str) -> bool:
    if col_type == "boolean":
        return isinstance(value, bool) or (
            isinstance(value, str) and _is_boolean_string(value)
        )
    if col_type == "number":
        if isinstance(value, bool):
            return False
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        return isinstance(value, str) and _is_number_string(value)
    if col_type == "date":
        if isinstance(value, (datetime, date)):
            return True
        return isinstance(value, str) and _is_date_string(value)
    return True


def infer_column_type(values: list[Any]) -> str:
    non_empty = [value for value in values if not _is_empty(value)]
    if not non_empty:
        return "string"

    for candidate in ("boolean", "number", "date"):
        if all(_matches_column_type(value, candidate) for value in non_empty):
            return candidate
    return "string"


def refine_columns_from_row_samples(
    columns: list[dict[str, str]],
    samples: list[dict[str, Any]],
) -> list[dict[str, str]]:
    if not columns or not samples:
        return columns

    refined: list[dict[str, str]] = []
    for col in columns:
        name = col["name"]
        values = [row.get(name) for row in samples if isinstance(row, dict)]
        refined.append({"name": name, "type": infer_column_type(values)})
    return refined
