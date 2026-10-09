import unittest

import pandas as pd
from fastapi import HTTPException

from anomaly_detect import detect_anomalies_from_prepared
from forecast_prepare import prepare_time_series_features


class TestAnomalyDetect(unittest.TestCase):
    def test_flags_clear_outlier(self):
        values = [10.0, 12.0, 11.0, 13.0, 10.0, 12.0, 11.0, 500.0]
        df = pd.DataFrame(
            {
                "date": [f"2024-01-{i:02d}" for i in range(1, len(values) + 1)],
                "sales": values,
            }
        )
        prepared = prepare_time_series_features(df)
        prepared["dataset_id"] = "test-dataset"

        result = detect_anomalies_from_prepared(prepared)

        self.assertEqual(result["value_column"], "sales")
        self.assertEqual(result["row_count"], len(values))
        points = result["points"]
        self.assertEqual(points[-1]["value"], 500.0)
        self.assertTrue(points[-1]["is_anomaly"])
        self.assertGreaterEqual(result["anomaly_count"], 1)

    def test_returns_date_value_and_flag_for_each_row(self):
        df = pd.DataFrame(
            {
                "date": ["2024-01-01", "2024-01-02", "2024-01-03"],
                "amount": [1.0, 2.0, 3.0],
            }
        )
        prepared = prepare_time_series_features(df)
        result = detect_anomalies_from_prepared(prepared)

        self.assertEqual(len(result["points"]), 3)
        for point in result["points"]:
            self.assertIn("date", point)
            self.assertIn("value", point)
            self.assertIn("is_anomaly", point)
            self.assertIsInstance(point["is_anomaly"], bool)

    def test_rejects_too_few_daily_values(self):
        df = pd.DataFrame(
            {
                "date": ["2024-01-01", "2024-01-02"],
                "sales": [10.0, 12.0],
            }
        )
        prepared = prepare_time_series_features(df)

        with self.assertRaises(HTTPException) as ctx:
            detect_anomalies_from_prepared(prepared)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
