from __future__ import annotations

import math
from decimal import Decimal
from typing import Any


def normalize_numeric(value: int | float | Decimal) -> int | float:
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        value = float(value)

    if isinstance(value, int):
        return value

    if not math.isfinite(value):
        return value

    rounded = round(value, 6)
    if math.isclose(rounded, round(rounded), rel_tol=0, abs_tol=1e-9):
        return int(round(rounded))
    return rounded


def normalize_json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return normalize_numeric(value)
    if isinstance(value, float):
        return normalize_numeric(value)
    if isinstance(value, dict):
        return {str(k): normalize_json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize_json_value(v) for v in value]
    return value
