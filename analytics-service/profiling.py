import math
from typing import Any

import numpy as np
import pandas as pd


def _json_number(value: Any) -> float | int | None:
    if value is None:
        return None
    if isinstance(value, (float, np.floating)) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (int, float)):
        return value
    return float(value)


def _profile_numeric(series: pd.Series) -> dict[str, Any]:
    return {
        "type": "number",
        "count": int(series.count()),
        "mean": _json_number(series.mean()),
        "min": _json_number(series.min()),
        "max": _json_number(series.max()),
        "std": _json_number(series.std()),
    }


def _profile_categorical(series: pd.Series) -> dict[str, Any]:
    non_null = series.dropna()
    if non_null.empty:
        return {
            "type": "categorical",
            "count": 0,
            "unique_count": 0,
            "most_common": None,
        }

    as_text = non_null.map(
        lambda v: v if isinstance(v, str) else str(v)
    )
    counts = as_text.value_counts()
    return {
        "type": "categorical",
        "count": int(len(non_null)),
        "unique_count": int(non_null.nunique()),
        "most_common": counts.index[0],
    }


def _profile_datetime(series: pd.Series) -> dict[str, Any]:
    non_null = series.dropna()
    if non_null.empty:
        return {
            "type": "datetime",
            "min": None,
            "max": None,
        }

    min_val = non_null.min()
    max_val = non_null.max()
    return {
        "type": "datetime",
        "min": min_val.isoformat() if hasattr(min_val, "isoformat") else str(min_val),
        "max": max_val.isoformat() if hasattr(max_val, "isoformat") else str(max_val),
    }


def profile_dataframe(
    df: pd.DataFrame, column_types: dict[str, str]
) -> dict[str, Any]:
    statistics: dict[str, Any] = {}

    for col, col_type in column_types.items():
        if col not in df.columns:
            continue

        series = df[col]
        if col_type == "number":
            statistics[col] = _profile_numeric(series)
        elif col_type == "datetime":
            statistics[col] = _profile_datetime(series)
        else:
            statistics[col] = _profile_categorical(series)

    return statistics
