import json
from typing import Any

from llm_client import chat_completion
from value_format import normalize_json_value


def _format_result_for_prompt(result: list[dict[str, Any]]) -> str:
    cleaned = [normalize_json_value(row) for row in result]
    return json.dumps(cleaned, indent=2, default=str)


def build_answer_prompt(
    question: str,
    sql: str,
    result: list[dict[str, Any]],
) -> str:
    result_text = _format_result_for_prompt(result)
    return f"""You are a business analytics assistant. Write a short, clear answer for a non-technical user.

User question:
{question.strip()}

SQL that was already run (do not change or rewrite this):
{sql.strip()}

Query result (JSON):
{result_text}

Rules:
- Base your answer ONLY on the query result above.
- Do not generate SQL, suggest SQL changes, or mention database tables.
- Keep the answer to one or two sentences.
- If the result contains numbers, include them in the answer.
- Write whole numbers without a decimal part (400, not 400.0). Use decimals only when the value is genuinely fractional (e.g. 12.5).
- Return plain text only. No Markdown and no bullet lists.
"""


def explain_query_result(
    question: str,
    sql: str,
    result: list[dict[str, Any]],
) -> str:
    prompt = build_answer_prompt(question, sql, result)
    raw = chat_completion(prompt)
    return raw.strip()
