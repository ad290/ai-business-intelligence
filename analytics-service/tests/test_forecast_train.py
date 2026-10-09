import shutil
import tempfile
import unittest
from pathlib import Path

import joblib
from fastapi import HTTPException

import forecast_train
from forecast_prepare import prepare_time_series_features
from forecast_train import train_forecasting_model_from_prepared


class TestForecastTrain(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        self._original_models_dir = forecast_train.MODELS_DIR
        forecast_train.MODELS_DIR = Path(self._tmpdir)

    def tearDown(self):
        forecast_train.MODELS_DIR = self._original_models_dir
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_trains_saves_model_and_returns_mae(self):
        df = _sample_sales_frame()
        prepared = prepare_time_series_features(df)
        result = train_forecasting_model_from_prepared(
            prepared, dataset_id="test-dataset-id"
        )

        self.assertEqual(result["dataset_id"], "test-dataset-id")
        self.assertGreater(result["row_count_after_drop"], result["train_row_count"])
        self.assertGreater(result["test_row_count"], 0)
        self.assertIsInstance(result["test_mae"], float)
        self.assertGreaterEqual(result["test_mae"], 0.0)

        model_file = forecast_train.MODELS_DIR / "forecast_test-dataset-id.joblib"
        self.assertTrue(model_file.is_file())
        artifact = joblib.load(model_file)
        self.assertIn("model", artifact)
        self.assertEqual(artifact["feature_columns"], forecast_train.INPUT_FEATURE_COLUMNS)

    def test_rejects_empty_prepared_features(self):
        with self.assertRaises(HTTPException) as ctx:
            train_forecasting_model_from_prepared(
                {"features": []}, dataset_id="empty-features"
            )
        self.assertEqual(ctx.exception.status_code, 400)


def _sample_sales_frame():
    import pandas as pd

    return pd.DataFrame(
        {
            "date": [
                f"2024-01-{day:02d}"
                for day in range(1, 21)
            ],
            "sales": [10 * day + (day % 3) for day in range(1, 21)],
        }
    )


if __name__ == "__main__":
    unittest.main()
