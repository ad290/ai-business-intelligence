from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from ai_query import run_ai_query
from dataset_schema import build_dataset_schema_payload
from datasets import dataset_dataframe_summary
from anomaly_detect import run_dataset_anomaly_detection
from forecast_prepare import prepare_forecasting_dataset
from forecast_predict import predict_forecast
from forecast_train import train_forecasting_model
from db import check_postgres_connection
from embeddings import EMBEDDING_DIMENSION, embed_text
from llm_client import chat_completion
from sql_generation import generate_sql_for_question

app = FastAPI(title="Analytics Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service"}


@app.get("/db-health")
def db_health():
    try:
        check_postgres_connection()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"PostgreSQL connection failed: {exc}",
        ) from exc
    return {"status": "ok", "database": "connected"}


@app.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    return dataset_dataframe_summary(dataset_id)


@app.get("/datasets/{dataset_id}/forecast/prepare")
def forecast_prepare(dataset_id: str):
    return prepare_forecasting_dataset(dataset_id)


@app.get("/datasets/{dataset_id}/anomalies")
def dataset_anomalies(dataset_id: str):
    return run_dataset_anomaly_detection(dataset_id)


@app.post("/datasets/{dataset_id}/forecast/train")
def forecast_train(dataset_id: str):
    return train_forecasting_model(dataset_id)


class ForecastRequest(BaseModel):
    days: int = Field(default=30, ge=1)


@app.post("/datasets/{dataset_id}/forecast")
def forecast_predict_endpoint(
    dataset_id: str, body: ForecastRequest = ForecastRequest()
):
    return predict_forecast(dataset_id, days=body.days)


class AiTestRequest(BaseModel):
    message: str = Field(..., min_length=1)


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1)


class GenerateSqlRequest(BaseModel):
    datasetId: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)


class AiQueryRequest(BaseModel):
    datasetId: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    companyId: str | None = Field(default=None, min_length=1)


@app.get("/ai/schema/{dataset_id}")
def ai_schema(dataset_id: str):
    return build_dataset_schema_payload(dataset_id)


@app.post("/ai/embed")
def ai_embed(body: EmbedRequest):
    try:
        embedding = embed_text(body.text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        "embedding": embedding,
        "dimension": EMBEDDING_DIMENSION,
    }


@app.post("/ai/test")
def ai_test(body: AiTestRequest):
    try:
        reply = chat_completion(body.message)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"response": reply}


@app.post("/ai/generate-sql")
def ai_generate_sql(body: GenerateSqlRequest):
    try:
        return generate_sql_for_question(body.datasetId, body.question)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/ai/query")
def ai_query(body: AiQueryRequest):
    try:
        return run_ai_query(body.datasetId, body.question, body.companyId)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
