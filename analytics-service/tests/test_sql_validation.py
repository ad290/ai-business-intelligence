import unittest

from sql_validation import SqlValidationError, validate_generated_sql


class TestSqlValidation(unittest.TestCase):
    def test_allows_select_on_dataset_snapshot(self):
        sql = validate_generated_sql(
            "SELECT SUM(revenue) FROM dataset_snapshot"
        )
        self.assertIn("FROM dataset_snapshot", sql)

    def test_appends_from_when_missing(self):
        sql = validate_generated_sql("SELECT COUNT(*)")
        self.assertEqual(sql, "SELECT COUNT(*) FROM dataset_snapshot")

    def test_rejects_non_select(self):
        with self.assertRaises(SqlValidationError):
            validate_generated_sql("DELETE FROM dataset_snapshot")

    def test_rejects_wrong_table(self):
        with self.assertRaises(SqlValidationError):
            validate_generated_sql("SELECT * FROM business_sales_sample")

    def test_rejects_multiple_statements(self):
        with self.assertRaises(SqlValidationError):
            validate_generated_sql("SELECT 1; SELECT 2")


if __name__ == "__main__":
    unittest.main()
