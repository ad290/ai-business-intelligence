from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import HTTPException
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from forecast_prepare import prepare_forecasting_dataset

MODELS_DIR = Path(__file__).resolve().parent / "models"
TRAIN_FRACTION = 0.8
RANDOM_STATE = 42

INPUT_FEATURE_COLUMNS = [
    "lag_1",
    "lag_7",
    "rolling_mean_7",
    "day_of_week",
    "day_of_month",
    "month",
    "year",
]
TARGET_COLUMN = "value"


def _features_frame_from_prepared(prepared: dict[str, Any]) -> pd.DataFrame:
    features = prepared.get("features")
    if not isinstance(features, list) or len(features) == 0:
        raise HTTPException(
            status_code=400,
            detail="No prepared features available for training",
        )

    frame = pd.DataFrame(features)
    if "date" not in frame.columns:
        raise HTTPException(status_code=400, detail="Prepared features missing date column")

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame[TARGET_COLUMN] = pd.to_numeric(frame[TARGET_COLUMN], errors="coerce")
    for col in ("lag_1", "lag_7", "rolling_mean_7"):
        if col in frame.columns:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")

    frame["day_of_week"] = frame["date"].dt.dayofweek
    frame["day_of_month"] = frame["date"].dt.day
    frame["month"] = frame["date"].dt.month
    frame["year"] = frame["date"].dt.year

    return frame


def train_forecasting_model_from_prepared(
    prepared: dict[str, Any],
    *,
    dataset_id: str,
) -> dict[str, Any]:
    frame = _features_frame_from_prepared(prepared)
    model_df = frame.dropna(subset=[*INPUT_FEATURE_COLUMNS, TARGET_COLUMN]).reset_index(
        drop=True
    )

    row_count_after_drop = int(len(model_df))
    if row_count_after_drop < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough rows with complete features for training",
        )

    split_index = int(row_count_after_drop * TRAIN_FRACTION)
    if split_index < 1:
        split_index = 1
    if split_index >= row_count_after_drop:
        split_index = row_count_after_drop - 1

    train_df = model_df.iloc[:split_index]
    test_df = model_df.iloc[split_index:]

    x_train = train_df[INPUT_FEATURE_COLUMNS]
    y_train = train_df[TARGET_COLUMN]
    x_test = test_df[INPUT_FEATURE_COLUMNS]
    y_test = test_df[TARGET_COLUMN]

    model = RandomForestRegressor(
        n_estimators=100,
        random_state=RANDOM_STATE,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    test_mae = float(mean_absolute_error(y_test, predictions))

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_filename = f"forecast_{dataset_id}.joblib"
    model_path = MODELS_DIR / model_filename

    artifact = {
        "model": model,
        "feature_columns": INPUT_FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "date_column": prepared.get("date_column"),
        "value_column": prepared.get("value_column"),
        "dataset_id": dataset_id,
    }
    joblib.dump(artifact, model_path)

    return {
        "dataset_id": dataset_id,
        "model_path": str(model_path.relative_to(MODELS_DIR.parent)),
        "row_count_after_drop": row_count_after_drop,
        "train_row_count": int(len(train_df)),
        "test_row_count": int(len(test_df)),
        "test_mae": test_mae,
        "feature_columns": INPUT_FEATURE_COLUMNS,
    }


def train_forecasting_model(dataset_id: str) -> dict[str, Any]:
    prepared = prepare_forecasting_dataset(dataset_id)
    return train_forecasting_model_from_prepared(prepared, dataset_id=dataset_id)
