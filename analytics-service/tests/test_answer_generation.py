import json
import unittest
from unittest.mock import patch

from answer_generation import build_answer_prompt, explain_query_result


class TestAnswerGeneration(unittest.TestCase):
    def test_prompt_includes_question_sql_and_result(self):
        result = [{"total_revenue": 1250000}]
        prompt = build_answer_prompt(
            "What was our total revenue?",
            "SELECT SUM(revenue) FROM dataset_snapshot",
            result,
        )
        self.assertIn("What was our total revenue?", prompt)
        self.assertIn("SELECT SUM(revenue)", prompt)
        self.assertIn("1250000", prompt)
        self.assertIn("do not change or rewrite", prompt.lower())

    @patch("answer_generation.chat_completion")
    def test_explain_returns_trimmed_model_text(self, mock_chat):
        mock_chat.return_value = "  Your total revenue was 1,250,000.  "
        answer = explain_query_result(
            "What was our total revenue?",
            "SELECT SUM(revenue) AS total_revenue FROM dataset_snapshot",
            [{"total_revenue": 1250000}],
        )
        self.assertEqual(answer, "Your total revenue was 1,250,000.")
        sent_prompt = mock_chat.call_args[0][0]
        self.assertIn("1250000", sent_prompt)


if __name__ == "__main__":
    unittest.main()
