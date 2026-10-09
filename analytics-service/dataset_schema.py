from typing import Any

from fastapi import HTTPException

from column_inference import refine_columns_from_row_samples
from db import connect_postgres


def _parse_columns_json(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        raise ValueError("Dataset columns must be a JSON array")

    columns: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        col_type = item.get("type")
        if not isinstance(name, str) or not name.strip():
            continue
        if not isinstance(col_type, str) or not col_type.strip():
            col_type = "string"
        columns.append({"name": name.strip(), "type": col_type.strip()})
    return columns


def fetch_dataset_schema_from_db(dataset_id: str) -> tuple[str, list[dict[str, str]]]:
    name, _company_id, columns = fetch_dataset_record(dataset_id)
    return name, columns


def _fetch_row_samples(cur: Any, dataset_id: str, limit: int = 200) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT data
        FROM "DatasetRow"
        WHERE "datasetId" = %s
        LIMIT %s
        """,
        (dataset_id, limit),
    )
    samples: list[dict[str, Any]] = []
    for row in cur.fetchall():
        data = row[0]
        if isinstance(data, dict):
            samples.append(data)
    return samples


def fetch_dataset_record(
    dataset_id: str,
) -> tuple[str, str, list[dict[str, str]]]:
    conn = connect_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT name, "companyId", columns
                FROM "Dataset"
                WHERE id = %s
                """,
                (dataset_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Dataset not found")

            name, company_id, columns_json = row[0], row[1], row[2]
            samples = _fetch_row_samples(cur, dataset_id)
    finally:
        conn.close()

    if not isinstance(name, str) or not name.strip():
        name = "Untitled dataset"
    if not isinstance(company_id, str) or not company_id.strip():
        raise HTTPException(status_code=500, detail="Dataset companyId is missing")

    try:
        columns = _parse_columns_json(columns_json)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid columns metadata for dataset: {exc}",
        ) from exc

    columns = refine_columns_from_row_samples(columns, samples)

    return name.strip(), company_id.strip(), columns


def format_schema_for_llm(dataset_name: str, columns: list[dict[str, str]]) -> str:
    lines = [f"Dataset: {dataset_name}", "", "Columns:"]
    for col in columns:
        lines.append(f"- {col['name']}: {col['type']}")
    return "\n".join(lines)


def build_dataset_schema_payload(dataset_id: str) -> dict[str, Any]:
    name, columns = fetch_dataset_schema_from_db(dataset_id)
    schema_text = format_schema_for_llm(name, columns)
    return {
        "dataset_id": dataset_id,
        "name": name,
        "columns": columns,
        "schema_text": schema_text,
    }
