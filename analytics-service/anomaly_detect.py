from typing import Any

import pandas as pd
from fastapi import HTTPException
from sklearn.ensemble import IsolationForest

from forecast_prepare import _json_safe, prepare_time_series_features
from datasets import dataset_exists, fetch_dataset_row_records

RANDOM_STATE = 42
MIN_ROWS = 3


def detect_anomalies_from_prepared(prepared: dict[str, Any]) -> dict[str, Any]:
    features = prepared.get("features")
    if not isinstance(features, list) or len(features) == 0:
        raise HTTPException(
            status_code=400,
            detail="No prepared features available for anomaly detection",
        )

    frame = pd.DataFrame(features)
    if "date" not in frame.columns or "value" not in frame.columns:
        raise HTTPException(
            status_code=400,
            detail="Prepared features must include date and value columns",
        )

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame["value"] = pd.to_numeric(frame["value"], errors="coerce")
    frame = frame.dropna(subset=["date", "value"]).sort_values("date").reset_index(drop=True)

    if len(frame) < MIN_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {MIN_ROWS} daily values for anomaly detection",
        )

    values = frame[["value"]].to_numpy()
    model = IsolationForest(random_state=RANDOM_STATE)
    predictions = model.fit_predict(values)

    points: list[dict[str, Any]] = []
    for row, pred in zip(frame.itertuples(index=False), predictions, strict=True):
        points.append(
            {
                "date": _json_safe(row.date),
                "value": _json_safe(row.value),
                "is_anomaly": bool(pred == -1),
            }
        )

    anomaly_count = sum(1 for point in points if point["is_anomaly"])

    return {
        "dataset_id": prepared.get("dataset_id"),
        "date_column": prepared.get("date_column"),
        "value_column": prepared.get("value_column"),
        "row_count": len(points),
        "anomaly_count": anomaly_count,
        "points": points,
    }


def detect_anomalies_for_dataset(dataset_id: str) -> dict[str, Any]:
    if not dataset_exists(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")

    records = fetch_dataset_row_records(dataset_id)
    raw_df = pd.DataFrame(records) if records else pd.DataFrame()
    prepared = prepare_time_series_features(raw_df)
    prepared["dataset_id"] = dataset_id
    return detect_anomalies_from_prepared(prepared)


def run_dataset_anomaly_detection(dataset_id: str) -> dict[str, Any]:
    """Analytics service entry point for the anomalies HTTP endpoint."""
    return detect_anomalies_for_dataset(dataset_id)
