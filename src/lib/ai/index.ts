export type AiModelName = "default" | "qa" | "profile" | "followup";

export interface AiGenerateParams {
  model: AiModelName;
  prompt: string;
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

