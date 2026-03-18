import "server-only";

import type {
  AiClient,
  AiGenerateParams,
  AiGenerateResult,
} from "@/lib/ai";

type DeepSeekTextGenerateOptions = {
  temperature?: number;
  maxTokens?: number;
};

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

function getDeepSeekTextConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "[DeepSeek] DEEPSEEK_API_KEY is missing. Set it in .env.local before calling the AI layer."
    );
  }

  const model = process.env.DEEPSEEK_MODEL_TEXT;
  if (!model || !model.trim()) {
    throw new Error(
      "[DeepSeek] DEEPSEEK_MODEL_TEXT is missing or empty. Set it in .env.local before calling the AI layer."
    );
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  return {
    apiKey: apiKey.trim(),
    model: model.trim(),
    baseUrl: normalizedBaseUrl,
  };
}

async function callChatCompletions(
  prompt: string,
  options?: DeepSeekTextGenerateOptions
) {
  const { apiKey, model, baseUrl } = getDeepSeekTextConfig();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? 0,
      max_tokens: options?.maxTokens ?? 256,
    }),
  });

  if (!res.ok) {
    type DeepSeekErrorResponse = {
      error?: {
        message?: unknown;
      };
      message?: unknown;
    };

    let errMessage = "";
    try {
      const errJson = (await res.json()) as unknown as DeepSeekErrorResponse;
      const msgUnknown = errJson.error?.message ?? errJson.message;
      if (typeof msgUnknown === "string" && msgUnknown.trim()) {
        errMessage = msgUnknown.trim();
      }
    } catch {
      // ignore parsing failure
    }

    const suffix = errMessage ? `: ${errMessage}` : ".";
    throw new Error(`[DeepSeek] Request failed with status ${res.status}${suffix}`);
  }

  const data = (await res.json()) as unknown;

  type ChatCompletionsResponse = {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
      text?: unknown;
    }>;
  };

  const parsed = data as ChatCompletionsResponse;

  const contentUnknown =
    parsed.choices?.[0]?.message?.content ?? parsed.choices?.[0]?.text;

  if (typeof contentUnknown !== "string" || !contentUnknown.trim()) {
    throw new Error("[DeepSeek] Empty response content.");
  }

  return contentUnknown.trim();
}

/**
 * Minimal reusable text-generation helper for server-only usage.
 * - Uses `DEEPSEEK_MODEL_TEXT`
 * - Returns clean plain text (trimmed)
 */
export async function generateText(
  prompt: string,
  options?: DeepSeekTextGenerateOptions
): Promise<string> {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error(
      "[DeepSeek] generateText: prompt must be a non-empty string."
    );
  }

  return callChatCompletions(prompt, options);
}

export async function verifyDeepSeekTextConnectivity() {
  const config = getDeepSeekTextConfig();

  const sample = await generateText(
    "DeepSeek 通信校验：如果你能成功完成请求，请回复 'OK'（不要包含多余内容）。",
    { temperature: 0, maxTokens: 64 }
  );

  return {
    ok: true,
    model: config.model,
    sample,
  };
}

class DeepSeekTextAiClient implements AiClient {
  async generate<T = unknown>(
    params: AiGenerateParams
  ): Promise<AiGenerateResult<T>> {
    // Demo stage: no model routing yet; all AiModelName routes use DEEPSEEK_MODEL_TEXT.
    // Note: any JSON parsing / outputSchema validation should be handled in upper-level services,
    // not inside this aiClient wrapper.
    const rawText = await generateText(params.prompt);
    return { rawText };
  }
}

export const aiClient: AiClient = new DeepSeekTextAiClient();

