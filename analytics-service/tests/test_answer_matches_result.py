import re
import unittest
from unittest.mock import patch

from dotenv import load_dotenv

load_dotenv(".env")

from answer_generation import explain_query_result
from dataset_schema import fetch_dataset_record
from sql_execution import execute_dataset_query

DATASET_ID = "4af9cfb4-a316-4d3b-b67b-e91be4940de6"


class TestAnswerMatchesResult(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._name, cls._company_id, cls._columns = fetch_dataset_record(
            DATASET_ID
        )

    @patch("answer_generation.chat_completion")
    def test_answer_references_total_revenue_value(self, mock_chat):
        rows = execute_dataset_query(
            DATASET_ID,
            self._columns,
            "SELECT SUM(revenue) AS total_revenue FROM dataset_snapshot",
        )
        total = rows[0]["total_revenue"]
        mock_chat.return_value = f"Your total revenue was {total}."

        answer = explain_query_result(
            "What is the total revenue?",
            "SELECT SUM(revenue) AS total_revenue FROM dataset_snapshot",
            rows,
        )

        self.assertIn(str(int(total)), answer.replace(",", ""))

    @patch("answer_generation.chat_completion")
    def test_answer_references_record_count(self, mock_chat):
        rows = execute_dataset_query(
            DATASET_ID,
            self._columns,
            "SELECT COUNT(*) AS record_count FROM dataset_snapshot",
        )
        count = int(rows[0]["record_count"])
        mock_chat.return_value = f"There are {count} records."

        answer = explain_query_result(
            "How many records are there?",
            "SELECT COUNT(*) AS record_count FROM dataset_snapshot",
            rows,
        )

        self.assertRegex(answer, re.compile(str(count)))


if __name__ == "__main__":
    unittest.main()
