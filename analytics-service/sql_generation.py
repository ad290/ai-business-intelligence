import re
from typing import Any

from dataset_schema import build_dataset_schema_payload
from llm_client import chat_completion


def build_sql_generation_prompt(question: str, schema: dict[str, Any]) -> str:
    return f"""You are a PostgreSQL expert. Write one SELECT query that answers the user's question.

{schema["schema_text"]}

User question:
{question.strip()}

Rules:
- Query only the PostgreSQL relation named dataset_snapshot (it has exactly the columns listed above).
- Use SELECT only. Example: SELECT SUM(revenue) FROM dataset_snapshot
- Use SUM, AVG, MIN, and MAX only on columns whose type is "number".
- Never aggregate columns whose type is "date", "string", or "boolean".
- Return ONLY the SQL query text. No explanations, labels, or Markdown.
"""


def normalize_sql_response(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # Drop a leading "Generated SQL:" or similar single label line.
    text = re.sub(
        r"^(?:generated\s+sql|sql)\s*:\s*",
        "",
        text,
        count=1,
        flags=re.IGNORECASE,
    ).strip()
    return text


def generate_sql_for_question(dataset_id: str, question: str) -> dict[str, Any]:
    schema = build_dataset_schema_payload(dataset_id)
    prompt = build_sql_generation_prompt(question, schema)
    raw_sql = chat_completion(prompt)
    sql = normalize_sql_response(raw_sql)
    return {
        "datasetId": dataset_id,
        "datasetName": schema["name"],
        "question": question.strip(),
        "sql": sql,
    }
