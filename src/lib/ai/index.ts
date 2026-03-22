export type AiModelName = "default" | "qa" | "profile" | "followup";

export interface AiGenerateParams {
  model: AiModelName;
  prompt: string;
  /** 覆盖该任务默认的 max_tokens（画像 JSON 等需要较大输出上限） */
  maxTokens?: number;
}

export interface AiGenerateResult<T = unknown> {
  rawText: string;
  parsed?: T;
}

export interface AiClient {
  generate<T = unknown>(params: AiGenerateParams): Promise<AiGenerateResult<T>>;
}

export { aiClient } from "./openai";
export { generateText, verifyDeepSeekTextConnectivity } from "./openai";

