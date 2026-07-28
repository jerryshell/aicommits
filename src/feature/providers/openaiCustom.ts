import { ProviderDef } from "./base.js";

export const OpenAiCustom: ProviderDef = {
  name: "custom",
  displayName: "Custom (OpenAI-compatible)",
  baseUrl: "",
  modelsFilter: (models) =>
    models
      .filter((m: any) => !m.type || m.type === "chat" || m.type === "language")
      .map((m: any) => m.id),
  defaultModels: [],
  requiresApiKey: true,
};
