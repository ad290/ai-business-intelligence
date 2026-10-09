from typing import Any

import numpy as np
import pandas as pd


def _normalize_missing(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in out.columns:
        if out[col].dtype == object:
            out[col] = out[col].apply(
                lambda v: np.nan
                if v is None or (isinstance(v, str) and v.strip() == "")
                else v
            )
    return out


def _drop_empty_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    normalized = df.replace("", np.nan)
    return normalized.dropna(how="all").reset_index(drop=True)


def _drop_empty_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    normalized = df.replace("", np.nan)
    return normalized.dropna(axis=1, how="all")


def _coerce_obvious_numeric(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_numeric_dtype(out[col]):
            continue
        if out[col].map(lambda v: isinstance(v, (dict, list))).any():
            continue
        coerced = pd.to_numeric(out[col], errors="coerce")
        non_null = out[col].notna()
        if not non_null.any():
            continue
        success_rate = coerced.notna()[non_null].mean()
        if success_rate >= 0.8:
            out[col] = coerced
    return out


def _coerce_obvious_datetime(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            continue
        if pd.api.types.is_numeric_dtype(out[col]):
            continue
        if out[col].map(lambda v: isinstance(v, (dict, list))).any():
            continue
        as_str = out[col].astype("string")
        coerced = pd.to_datetime(as_str, errors="coerce", utc=False)
        non_null = out[col].notna()
        if not non_null.any():
            continue
        success_rate = coerced.notna()[non_null].mean()
        if success_rate >= 0.8:
            out[col] = coerced
    return out


def _detect_column_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if series.map(lambda v: isinstance(v, (dict, list))).any():
        return "object"
    return "string"


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = _normalize_missing(df)
    cleaned = _drop_empty_rows(cleaned)
    cleaned = _drop_empty_columns(cleaned)
    cleaned = cleaned.drop_duplicates().reset_index(drop=True)
    cleaned = _coerce_obvious_numeric(cleaned)
    cleaned = _coerce_obvious_datetime(cleaned)
    return cleaned


def detected_data_types(df: pd.DataFrame) -> dict[str, str]:
    return {str(col): _detect_column_type(df[col]) for col in df.columns}
