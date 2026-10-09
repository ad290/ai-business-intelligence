import math
from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException

from cleaning import clean_dataframe, detected_data_types
from datasets import dataset_exists, fetch_dataset_row_records

DATE_NAME_HINTS = ("date", "time", "timestamp", "day", "month", "year", "created", "updated")


def _is_id_like_column(name: str) -> bool:
    lowered = name.lower().strip()
    if lowered in ("id", "uuid", "key"):
        return True
    return lowered.endswith("_id") or lowered.endswith("id")


def detect_date_column(df: pd.DataFrame, column_types: dict[str, str]) -> str | None:
    datetime_cols = [
        str(col) for col in df.columns if column_types.get(str(col)) == "datetime"
    ]
    if not datetime_cols:
        return None

    for col in datetime_cols:
        if any(hint in col.lower() for hint in DATE_NAME_HINTS):
            return col

    return datetime_cols[0]


def detect_value_column(
    df: pd.DataFrame,
    column_types: dict[str, str],
    *,
    exclude: set[str],
) -> str | None:
    numeric_cols = [
        str(col)
        for col in df.columns
        if column_types.get(str(col)) == "number" and str(col) not in exclude
    ]
    if not numeric_cols:
        return None

    candidates = [col for col in numeric_cols if not _is_id_like_column(col)]
    if not candidates:
        candidates = numeric_cols

    def score(col: str) -> float:
        series = df[col].dropna()
        if len(series) < 2:
            return float(series.count())
        variance = series.var()
        if variance is None or (isinstance(variance, float) and math.isnan(variance)):
            return float(series.count())
        return float(variance)

    return max(candidates, key=score)


def _json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, np.datetime64)):
        ts = pd.Timestamp(value)
        return ts.isoformat()
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        if math.isnan(value) or math.isinf(value):
            return None
        return float(value)
    if isinstance(value, (int,)):
        return value
    return value


def prepare_time_series_features(df: pd.DataFrame) -> dict[str, Any]:
    cleaned = clean_dataframe(df)
    if cleaned.empty:
        raise HTTPException(status_code=400, detail="Dataset has no usable rows")

    column_types = detected_data_types(cleaned)
    date_column = detect_date_column(cleaned, column_types)
    if date_column is None:
        raise HTTPException(
            status_code=400,
            detail="Could not detect a date column for forecasting",
        )

    value_column = detect_value_column(
        cleaned, column_types, exclude={date_column}
    )
    if value_column is None:
        raise HTTPException(
            status_code=400,
            detail="Could not detect a numeric column for forecasting",
        )

    working = cleaned[[date_column, value_column]].copy()
    working[date_column] = pd.to_datetime(working[date_column], errors="coerce")
    working[value_column] = pd.to_numeric(working[value_column], errors="coerce")
    working = working.dropna(subset=[date_column, value_column])
    if working.empty:
        raise HTTPException(
            status_code=400,
            detail="No rows with valid date and numeric values",
        )

    working["_date"] = working[date_column].dt.normalize()
    aggregated = (
        working.groupby("_date", as_index=False)[value_column]
        .sum()
        .rename(columns={"_date": "date", value_column: "value"})
        .sort_values("date")
        .reset_index(drop=True)
    )

    aggregated["lag_1"] = aggregated["value"].shift(1)
    aggregated["lag_7"] = aggregated["value"].shift(7)
    aggregated["rolling_mean_7"] = aggregated["value"].rolling(
        window=7, min_periods=1
    ).mean()

    feature_rows: list[dict[str, Any]] = []
    for row in aggregated.to_dict(orient="records"):
        feature_rows.append({key: _json_safe(val) for key, val in row.items()})

    return {
        "date_column": date_column,
        "value_column": value_column,
        "aggregated_row_count": len(aggregated),
        "features": feature_rows,
    }


def prepare_forecasting_dataset(dataset_id: str) -> dict[str, Any]:
    if not dataset_exists(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")

    records = fetch_dataset_row_records(dataset_id)
    raw_df = pd.DataFrame(records) if records else pd.DataFrame()
    prepared = prepare_time_series_features(raw_df)

    return {
        "dataset_id": dataset_id,
        **prepared,
    }
