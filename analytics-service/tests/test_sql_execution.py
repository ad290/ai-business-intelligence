import unittest

from dotenv import load_dotenv

load_dotenv(".env")

from dataset_schema import fetch_dataset_record
from sql_execution import execute_dataset_query

DATASET_ID = "4af9cfb4-a316-4d3b-b67b-e91be4940de6"


class TestSqlExecution(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._name, cls._company_id, cls._columns = fetch_dataset_record(
            DATASET_ID
        )

    def test_count_rows(self):
        rows = execute_dataset_query(
            DATASET_ID,
            self._columns,
            "SELECT COUNT(*) AS record_count FROM dataset_snapshot",
        )
        self.assertEqual(len(rows), 1)
        self.assertGreater(int(rows[0]["record_count"]), 0)

    def test_total_revenue(self):
        rows = execute_dataset_query(
            DATASET_ID,
            self._columns,
            "SELECT SUM(revenue) AS total_revenue FROM dataset_snapshot",
        )
        self.assertEqual(len(rows), 1)
        self.assertIsNotNone(rows[0]["total_revenue"])

    def test_average_revenue(self):
        rows = execute_dataset_query(
            DATASET_ID,
            self._columns,
            "SELECT AVG(revenue) AS average_revenue FROM dataset_snapshot",
        )
        self.assertEqual(len(rows), 1)
        self.assertIsNotNone(rows[0]["average_revenue"])


if __name__ == "__main__":
    unittest.main()
