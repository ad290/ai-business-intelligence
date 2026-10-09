import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "google/gemma-2-9b-it:free"


def get_openrouter_api_key() -> str:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key or not key.strip():
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    return key.strip().strip('"')


def get_openrouter_model() -> str:
    model = os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)
    return model.strip().strip('"') or DEFAULT_MODEL


def chat_completion(user_message: str) -> str:
    """Send a single user message to OpenRouter and return the assistant reply."""
    payload = {
        "model": get_openrouter_model(),
        "messages": [{"role": "user", "content": user_message}],
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        OPENROUTER_CHAT_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {get_openrouter_api_key()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"OpenRouter request failed ({exc.code}): {error_body}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenRouter request failed: {exc.reason}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {data}") from exc
