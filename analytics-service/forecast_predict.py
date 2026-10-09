from typing import Any

import joblib
import pandas as pd
from fastapi import HTTPException

from forecast_prepare import prepare_forecasting_dataset, _json_safe
from forecast_train import INPUT_FEATURE_COLUMNS, MODELS_DIR


def _model_path_for_dataset(dataset_id: str):
    return MODELS_DIR / f"forecast_{dataset_id}.joblib"


def load_trained_forecast_model(dataset_id: str) -> dict[str, Any]:
    model_path = _model_path_for_dataset(dataset_id)
    if not model_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Forecast model not found for dataset; train the model first",
        )
    artifact = joblib.load(model_path)
    if not isinstance(artifact, dict) or "model" not in artifact:
        raise HTTPException(status_code=500, detail="Invalid saved forecast model")
    return artifact


def _historical_values_from_prepared(prepared: dict[str, Any]) -> tuple[pd.Timestamp, list[float]]:
    features = prepared.get("features")
    if not isinstance(features, list) or len(features) == 0:
        raise HTTPException(
            status_code=400,
            detail="No historical features available for prediction",
        )

    frame = pd.DataFrame(features)
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame["value"] = pd.to_numeric(frame["value"], errors="coerce")
    frame = frame.dropna(subset=["date", "value"]).sort_values("date")
    if frame.empty:
        raise HTTPException(
            status_code=400,
            detail="No historical values available for prediction",
        )

    last_date = pd.Timestamp(frame["date"].iloc[-1]).normalize()
    values = [float(v) for v in frame["value"].tolist()]
    return last_date, values


def _lag_and_rolling_features(values: list[float]) -> dict[str, float]:
    lag_1 = values[-1]
    lag_7 = values[-7] if len(values) >= 7 else values[0]
    window = values[-7:]
    rolling_mean_7 = sum(window) / len(window)
    return {
        "lag_1": lag_1,
        "lag_7": lag_7,
        "rolling_mean_7": rolling_mean_7,
    }


def predict_forecast_from_prepared(
    prepared: dict[str, Any],
    *,
    dataset_id: str,
    artifact: dict[str, Any],
    days: int,
) -> dict[str, Any]:
    if days < 1:
        raise HTTPException(status_code=400, detail="days must be at least 1")

    model = artifact["model"]
    feature_columns = artifact.get("feature_columns", INPUT_FEATURE_COLUMNS)
    last_date, values = _historical_values_from_prepared(prepared)

    predictions: list[dict[str, Any]] = []
    for offset in range(1, days + 1):
        next_date = last_date + pd.Timedelta(days=offset)
        row = _lag_and_rolling_features(values)
        row["day_of_week"] = next_date.dayofweek
        row["day_of_month"] = next_date.day
        row["month"] = next_date.month
        row["year"] = next_date.year

        feature_frame = pd.DataFrame([row])
        predicted_value = float(model.predict(feature_frame[feature_columns])[0])
        values.append(predicted_value)
        predictions.append(
            {
                "date": _json_safe(next_date),
                "value": _json_safe(predicted_value),
            }
        )

    return {
        "dataset_id": dataset_id,
        "days": days,
        "predictions": predictions,
    }


def predict_forecast(dataset_id: str, days: int = 30) -> dict[str, Any]:
    artifact = load_trained_forecast_model(dataset_id)
    prepared = prepare_forecasting_dataset(dataset_id)
    return predict_forecast_from_prepared(
        prepared,
        dataset_id=dataset_id,
        artifact=artifact,
        days=days,
    )
