import shutil
import tempfile
import unittest
from pathlib import Path

import forecast_predict
import forecast_train
from forecast_prepare import prepare_time_series_features
from forecast_train import train_forecasting_model_from_prepared


class TestForecastPredict(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        self._original_models_dir = forecast_train.MODELS_DIR
        forecast_train.MODELS_DIR = Path(self._tmpdir)
        forecast_predict.MODELS_DIR = Path(self._tmpdir)

    def tearDown(self):
        forecast_train.MODELS_DIR = self._original_models_dir
        forecast_predict.MODELS_DIR = self._original_models_dir
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_generates_future_predictions(self):
        import pandas as pd

        df = pd.DataFrame(
            {
                "date": [f"2024-01-{day:02d}" for day in range(1, 21)],
                "sales": [10 * day for day in range(1, 21)],
            }
        )
        prepared = prepare_time_series_features(df)
        train_forecasting_model_from_prepared(prepared, dataset_id="predict-test")
        artifact = forecast_predict.load_trained_forecast_model("predict-test")

        result = forecast_predict.predict_forecast_from_prepared(
            prepared,
            dataset_id="predict-test",
            artifact=artifact,
            days=5,
        )

        self.assertEqual(result["dataset_id"], "predict-test")
        self.assertEqual(result["days"], 5)
        self.assertEqual(len(result["predictions"]), 5)
        self.assertIn("date", result["predictions"][0])
        self.assertIn("value", result["predictions"][0])
        first_date = result["predictions"][0]["date"]
        self.assertTrue(str(first_date).startswith("2024-01-21"))

    def test_missing_model_returns_404(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            forecast_predict.load_trained_forecast_model("no-such-model")
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
