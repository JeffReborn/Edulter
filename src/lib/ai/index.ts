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

class NotConfiguredAiClient implements AiClient {
  async generate<T>(): Promise<AiGenerateResult<T>> {
    throw new Error(
      "AiClient is not configured yet. Implement it in a later task card before calling."
    );
  }
}

export const aiClient: AiClient = new NotConfiguredAiClient();

