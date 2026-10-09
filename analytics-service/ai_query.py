from typing import Any

from fastapi import HTTPException

from answer_generation import explain_query_result
from dataset_schema import fetch_dataset_record
from sql_execution import execute_dataset_query
from sql_generation import generate_sql_for_question
from sql_validation import SqlValidationError


def run_ai_query(
    dataset_id: str,
    question: str,
    company_id: str | None = None,
) -> dict[str, Any]:
    _name, dataset_company_id, columns = fetch_dataset_record(dataset_id)

    if company_id is not None and company_id.strip() != dataset_company_id:
        raise HTTPException(
            status_code=403,
            detail="Dataset does not belong to this company",
        )

    generated = generate_sql_for_question(dataset_id, question)
    sql = generated["sql"]

    try:
        result = execute_dataset_query(dataset_id, columns, sql)
    except SqlValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Query execution failed: {exc}",
        ) from exc

    try:
        answer = explain_query_result(question, sql, result)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "datasetId": dataset_id,
        "question": question.strip(),
        "sql": sql,
        "result": result,
        "answer": answer,
    }
