import type { ProviderDef } from "./base.js";

export const providers: ProviderDef[] = [
  {
    name: "togetherai",
    displayName: "Together AI (recommended)",
    baseUrl: "https://api.together.xyz/v1",
    modelsFilter: (models) =>
      models
        .filter(
          (m: any) =>
            (!m.type || m.type === "chat" || m.type === "language") &&
            !m.id.toLowerCase().includes("vision"),
        )
        .map((m: any) => m.id),
    defaultModels: ["Qwen/Qwen2.5-7B-Instruct-Turbo", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    requiresApiKey: true,
  },
  {
    name: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelsFilter: (models) =>
      models
        .filter(
          (m: any) =>
            m.id &&
            (m.id.includes("gpt") ||
              m.id.includes("o1") ||
              m.id.includes("o3") ||
              m.id.includes("o4") ||
              m.id.includes("o5") ||
              !m.type ||
              m.type === "chat"),
        )
        .map((m: any) => m.id),
    defaultModels: ["gpt-5-mini", "gpt-4o-mini", "gpt-4o", "gpt-5-nano"],
    requiresApiKey: true,
  },
  {
    name: "groq",
    displayName: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelsFilter: (models) =>
      models
        .filter((m: any) => m.id && (!m.type || m.type === "chat" || m.type === "language"))
        .map((m: any) => m.id),
    defaultModels: ["openai/gpt-oss-120b", "llama-3.1-8b-instant", "openai/gpt-oss-20b"],
    requiresApiKey: true,
  },
  {
    name: "xai",
    displayName: "xAI",
    baseUrl: "https://api.x.ai/v1",
    modelsFilter: (models) =>
      models
        .filter((m: any) => m.id && (!m.type || m.type === "chat" || m.type === "language"))
        .map((m: any) => m.id),
    defaultModels: ["grok-4.1-fast", "grok-4-fast", "grok-code-fast-1"],
    requiresApiKey: true,
  },
  {
    name: "ollama",
    displayName: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    modelsFilter: (models) =>
      models.filter((m: any) => m.id || m.name).map((m: any) => m.id || m.name),
    defaultModels: ["qwen3.5:4b", "llama3.2:latest"],
    requiresApiKey: false,
    cacheModels: false,
    isLocal: true,
  },
  {
    name: "lmstudio",
    displayName: "LM Studio (local)",
    baseUrl: "http://localhost:1234/v1",
    modelsFilter: (models) =>
      models
        .filter((m: any) => !m.type || m.type === "chat" || m.type === "language")
        .map((m: any) => m.id),
    defaultModels: ["qwen/qwen3-4b-2507", "qwen/qwen3-8b"],
    requiresApiKey: false,
    cacheModels: false,
    isLocal: true,
  },
  {
    name: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelsFilter: (models) =>
      models.filter((m: any) => m.id && (!m.type || m.type === "chat")).map((m: any) => m.id),
    defaultModels: ["openai/gpt-oss-20b:free", "z-ai/glm-4.5-air:free"],
    requiresApiKey: true,
    headers: {
      "HTTP-Referer": "https://github.com/jerryshell/aicommits",
      "X-Title": "aicommits",
    },
  },
  {
    name: "custom",
    displayName: "Custom (OpenAI-compatible)",
    baseUrl: "",
    modelsFilter: (models) =>
      models
        .filter((m: any) => !m.type || m.type === "chat" || m.type === "language")
        .map((m: any) => m.id),
    defaultModels: [],
    requiresApiKey: true,
  },
];
