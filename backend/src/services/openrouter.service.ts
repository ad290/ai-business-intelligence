import { config } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function chatCompletion(userMessage: string): Promise<string> {
  const apiKey = config.openRouter.apiKey;
  if (apiKey === undefined) {
    throw new AppError(
      "OpenRouter is not configured",
      503,
      "OPENROUTER_UNAVAILABLE"
    );
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openRouter.model,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch {
    throw new AppError(
      "OpenRouter request failed",
      502,
      "OPENROUTER_UNAVAILABLE"
    );
  }

  const data = (await response.json()) as OpenRouterChatResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    const detail =
      typeof data.error?.message === "string"
        ? data.error.message
        : "OpenRouter request failed";
    throw new AppError(detail, 502, "OPENROUTER_UNAVAILABLE");
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AppError(
      "Unexpected OpenRouter response",
      502,
      "OPENROUTER_UNAVAILABLE"
    );
  }

  return content.trim();
}
