import type { ValidConfig } from "../../utils/config-types.js";

// Everything is an OpenAI-compatible endpoint: the only facts needed are
// base URL + API key. Returns null when nothing is configured.
export const getGenerateParams = (config: ValidConfig) => {
  if (!config.OPENAI_BASE_URL && !config.OPENAI_API_KEY) {
    return null;
  }
  return {
    model: config.OPENAI_MODEL || "",
    baseUrl: config.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey: config.OPENAI_API_KEY || "",
    timeout: config.timeout || 60_000,
  };
};
