from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import psycopg2.extras

from db import connect_postgres
from sql_validation import DATASET_TABLE, validate_generated_sql
from value_format import normalize_json_value, normalize_numeric


def _quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _json_field_expr(column_name: str, column_type: str) -> str:
    key = column_name.replace("'", "''")
    base = f"(data->>'{key}')"
    if column_type == "number":
        return f"({base})::numeric"
    if column_type == "boolean":
        return f"({base})::boolean"
    if column_type == "date":
        return f"({base})::timestamptz"
    return f"({base})::text"


def build_dataset_snapshot_subquery(columns: list[dict[str, str]]) -> str:
    if not columns:
        raise ValueError("Dataset has no columns")
    projections = [
        f"{_json_field_expr(col['name'], col['type'])} AS {_quote_ident(col['name'])}"
        for col in columns
    ]
    return (
        f"SELECT {', '.join(projections)} "
        f'FROM "DatasetRow" '
        f'WHERE "datasetId" = %s'
    )


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return normalize_numeric(value)
    if isinstance(value, float):
        return normalize_numeric(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _serialize_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    return value


def execute_dataset_query(
    dataset_id: str,
    columns: list[dict[str, str]],
    sql: str,
) -> list[dict[str, Any]]:
    validated_sql = validate_generated_sql(sql)
    snapshot_sql = build_dataset_snapshot_subquery(columns)
    wrapped = f"WITH {DATASET_TABLE} AS ({snapshot_sql}) {validated_sql}"

    conn = connect_postgres()
    try:
        psycopg2.extras.register_default_jsonb(conn)
        psycopg2.extras.register_default_json(conn)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(wrapped, (dataset_id,))
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {key: _serialize_value(val) for key, val in dict(row).items()} for row in rows
    ]
