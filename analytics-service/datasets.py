import json
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import psycopg2.extras
from fastapi import HTTPException

from cleaning import clean_dataframe, detected_data_types
from db import connect_postgres
from profiling import profile_dataframe


def _parse_row_data(data: Any) -> dict[str, Any]:
    if isinstance(data, str):
        parsed = json.loads(data)
    else:
        parsed = data
    if not isinstance(parsed, dict):
        raise ValueError("Dataset row data must be a JSON object")
    return parsed


def dataset_exists(dataset_id: str) -> bool:
    conn = connect_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT 1 FROM "Dataset" WHERE id = %s', (dataset_id,))
            return cur.fetchone() is not None
    finally:
        conn.close()


def fetch_dataset_row_records(dataset_id: str) -> list[dict[str, Any]]:
    conn = connect_postgres()
    try:
        psycopg2.extras.register_default_jsonb(conn)
        psycopg2.extras.register_default_json(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT data
                FROM "DatasetRow"
                WHERE "datasetId" = %s
                ORDER BY "createdAt" ASC
                """,
                (dataset_id,),
            )
            return [_parse_row_data(row[0]) for row in cur.fetchall()]
    finally:
        conn.close()


def update_dataset_processing(dataset_id: str, processed_row_count: int) -> datetime:
    processed_at = datetime.now(timezone.utc)
    conn = connect_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "Dataset"
                SET "processedRowCount" = %s,
                    "processedAt" = %s,
                    "updatedAt" = %s
                WHERE id = %s
                """,
                (processed_row_count, processed_at, processed_at, dataset_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Dataset not found")
        conn.commit()
    finally:
        conn.close()
    return processed_at


def dataset_dataframe_summary(dataset_id: str) -> dict[str, Any]:
    if not dataset_exists(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")

    records = fetch_dataset_row_records(dataset_id)
    raw_df = pd.DataFrame(records) if records else pd.DataFrame()
    original_row_count = int(len(raw_df))

    cleaned_df = clean_dataframe(raw_df)
    cleaned_row_count = int(len(cleaned_df))

    update_dataset_processing(dataset_id, cleaned_row_count)

    column_types = detected_data_types(cleaned_df)
    head_rows = json.loads(
        cleaned_df.head(5).to_json(orient="records", date_format="iso")
    )
    all_rows = json.loads(
        cleaned_df.to_json(orient="records", date_format="iso")
    )

    return {
        "dataset_id": dataset_id,
        "original_row_count": original_row_count,
        "cleaned_row_count": cleaned_row_count,
        "columns": [str(col) for col in cleaned_df.columns],
        "detected_data_types": column_types,
        "statistics": profile_dataframe(cleaned_df, column_types),
        "head": head_rows,
        "rows": all_rows,
    }
