import re

DATASET_TABLE = "dataset_snapshot"

FORBIDDEN_KEYWORD = re.compile(
    r"\b("
    r"insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"copy|execute|call|merge|replace|into|outfile|pg_sleep|"
    r"set\s+role|reset\s+role"
    r")\b",
    re.IGNORECASE,
)

FROM_TABLE = re.compile(r"\bfrom\s+([\"`]?(?:[\w.]+)[\"`]?)", re.IGNORECASE)


class SqlValidationError(ValueError):
    pass


def validate_generated_sql(sql: str) -> str:
    text = sql.strip().rstrip(";").strip()
    if not text:
        raise SqlValidationError("SQL is empty")

    if ";" in text:
        raise SqlValidationError("Multiple SQL statements are not allowed")

    if FORBIDDEN_KEYWORD.search(text):
        raise SqlValidationError("Only read-only SELECT queries are allowed")

    if not re.match(r"^select\b", text, re.IGNORECASE):
        raise SqlValidationError("Query must be a SELECT statement")

    from_match = FROM_TABLE.search(text)
    if from_match:
        table = from_match.group(1).strip('"').strip("`").split(".")[-1]
        if table.lower() != DATASET_TABLE:
            raise SqlValidationError(
                f"Query must read from {DATASET_TABLE} only"
            )
    else:
        text = f"{text} FROM {DATASET_TABLE}"

    return text
