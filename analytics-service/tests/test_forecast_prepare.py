import unittest

import pandas as pd
from fastapi import HTTPException

from forecast_prepare import (
    detect_date_column,
    detect_value_column,
    prepare_time_series_features,
)
from cleaning import clean_dataframe, detected_data_types


class TestForecastPrepare(unittest.TestCase):
    def test_detects_date_and_value_columns(self):
        df = pd.DataFrame(
            {
                "order_date": ["2024-01-01", "2024-01-02"],
                "revenue": [100, 200],
                "order_id": [1, 2],
            }
        )
        cleaned = clean_dataframe(df)
        types = detected_data_types(cleaned)
        date_col = detect_date_column(cleaned, types)
        self.assertEqual(date_col, "order_date")
        value_col = detect_value_column(cleaned, types, exclude={date_col or ""})
        self.assertEqual(value_col, "revenue")

    def test_aggregates_sorts_and_builds_features(self):
        df = pd.DataFrame(
            {
                "date": [
                    "2024-01-01",
                    "2024-01-01",
                    "2024-01-02",
                    "2024-01-03",
                    "2024-01-04",
                    "2024-01-05",
                    "2024-01-06",
                    "2024-01-07",
                    "2024-01-08",
                ],
                "sales": [10, 5, 20, 30, 40, 50, 60, 70, 80],
            }
        )
        result = prepare_time_series_features(df)

        self.assertEqual(result["date_column"], "date")
        self.assertEqual(result["value_column"], "sales")
        self.assertEqual(result["aggregated_row_count"], 8)

        features = result["features"]
        self.assertEqual(features[0]["value"], 15)
        self.assertIsNone(features[0]["lag_1"])
        self.assertEqual(features[1]["lag_1"], 15)
        self.assertEqual(features[7]["lag_7"], features[0]["value"])
        self.assertAlmostEqual(features[6]["rolling_mean_7"], 40.714285714285715)

    def test_rejects_missing_datetime(self):
        df = pd.DataFrame({"name": ["a", "b"], "amount": [1, 2]})
        with self.assertRaises(HTTPException) as ctx:
            prepare_time_series_features(df)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
