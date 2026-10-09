"""Local text embeddings via Sentence Transformers (no paid API)."""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def embed_text(text: str) -> list[float]:
    """Return a dense embedding vector for the given text."""
    normalized = text.strip()
    if not normalized:
        raise ValueError("text must not be empty")

    model = _load_model()
    vector = model.encode(normalized, normalize_embeddings=True)
    values = vector.tolist()
    if len(values) != EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"unexpected embedding size {len(values)} (expected {EMBEDDING_DIMENSION})",
        )
    return values
