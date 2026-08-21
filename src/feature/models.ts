// Model fetching and selection utilities
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { CURRENT_LABEL_FORMAT } from "../utils/constants.js";
import { isCancel, spinner } from "@clack/prompts";
import { fileExists } from "../utils/fs.js";

interface ModelObject {
  id?: string;
  name?: string;
  type?: string;
}

interface FetchModelsResult {
  models: string[];
  error?: string;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const getCacheDir = (): string => {
  const platform = process.platform;
  const home = os.homedir();

  if (platform === "darwin") {
    return path.join(home, "Library", "Caches", "aicommits", "models");
  } else if (platform === "win32") {
    return path.join(home, "AppData", "Local", "aicommits", "models");
  } else {
    // Linux/Unix
    const xdgCache = process.env.XDG_CACHE_HOME;
    const baseCache = xdgCache ? xdgCache : path.join(home, ".cache");
    return path.join(baseCache, "aicommits", "models");
  }
};

const getCacheKey = (baseUrl: string): string => {
  const hash = crypto.createHash("sha256");
  hash.update(baseUrl);
  return hash.digest("hex");
};

const getCachePath = (key: string): string => path.join(getCacheDir(), `${key}.json`);

const readCache = async (
  key: string,
): Promise<{ data: FetchModelsResult; timestamp: number } | null> => {
  const cachePath = getCachePath(key);
  try {
    if (!(await fileExists(cachePath))) return null;
    const data = await fs.readFile(cachePath, "utf8");
    const entry = JSON.parse(data);
    if (!Array.isArray(entry?.data?.models)) return null;
    // Invalidate pre-refactor caches that stored raw model objects
    if (entry.data.models.some((m: unknown) => typeof m !== "string")) return null;
    return entry;
  } catch {
    return null;
  }
};

const writeCache = async (key: string, data: FetchModelsResult): Promise<void> => {
  try {
    const cacheDir = getCacheDir();
    await fs.mkdir(cacheDir, { recursive: true });
    const cachePath = getCachePath(key);
    await fs.writeFile(cachePath, JSON.stringify({ data, timestamp: Date.now() }), "utf8");
  } catch {
    // Ignore write errors
  }
};

// Generic OpenAI-compatible filter: keep chat/language models only
const isChatModel = (model: ModelObject) =>
  !model.type || model.type === "chat" || model.type === "language";

const fetchModels = async (baseUrl: string, apiKey: string): Promise<FetchModelsResult> => {
  const cacheKey = getCacheKey(baseUrl);
  const now = Date.now();

  const cached = await readCache(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Some APIs return { data: [...] }, others return the array directly
    const modelsArray: ModelObject[] = (data.data ? data.data : data) || [];
    const models = modelsArray
      .filter(isChatModel)
      .map((model) => model.id || model.name)
      .filter(Boolean) as string[];

    const result = { models };
    if (models.length > 0) {
      await writeCache(cacheKey, result);
    }
    return result;
  } catch (error: unknown) {
    return { models: [], error: error instanceof Error ? error.message : "Request failed" };
  }
};

const prepareModelOptions = (models: string[], currentModel?: string) => {
  const modelOptions = models.map((model: string) => ({
    label: model,
    value: model,
  }));

  if (currentModel && currentModel !== "undefined") {
    const currentIndex = modelOptions.findIndex((opt) => opt.value === currentModel);

    if (currentIndex >= 0) {
      modelOptions[currentIndex].label = CURRENT_LABEL_FORMAT(modelOptions[currentIndex].value);
      if (currentIndex > 0) {
        const [current] = modelOptions.splice(currentIndex, 1);
        modelOptions.unshift(current);
      }
    } else {
      modelOptions.unshift({ label: CURRENT_LABEL_FORMAT(currentModel), value: currentModel });
    }
  }

  return modelOptions;
};

const handleSearch = async (
  models: string[],
  select: any,
  text: any,
  isCancel: any,
): Promise<string | null> => {
  const searchTerm = await text({
    message: "Enter search term for models:",
    placeholder: "e.g., gpt, llama",
  });
  if (isCancel(searchTerm)) {
    return null;
  }

  let filteredModels = models;
  if (searchTerm) {
    filteredModels = models.filter((model: string) =>
      model.toLowerCase().includes((searchTerm as string).toLowerCase()),
    );
  }

  const searchOptions = filteredModels.slice(0, 20).map((model: string) => ({
    label: model,
    value: model,
  }));

  const searchChoice = await select({
    message: `Choose your model (filtered by "${searchTerm}"):`,
    options: [...searchOptions, { label: "Custom model name...", value: "custom" }],
  });

  if (isCancel(searchChoice)) return null;

  return searchChoice as string;
};

const handleCustom = async (text: any): Promise<string | null> => {
  const customModel = await text({
    message: "Enter your custom model name:",
    validate: (value: string) => {
      if (!value) return "Model name is required";
      return;
    },
  });

  if (isCancel(customModel)) return null;

  return customModel as string;
};

export const selectModel = async (
  baseUrl: string,
  apiKey: string,
  currentModel?: string,
): Promise<string | null> => {
  const s = spinner();
  s.start("Fetching available models...");
  const result = await fetchModels(baseUrl, apiKey);
  if (result.error) {
    console.error(`Failed to fetch models: ${result.error}`);
  }
  s.stop(`${result.models.length} models available`);

  let selectedModel: string | null = null;

  if (result.models.length > 0) {
    const { select, text, isCancel } = await import("@clack/prompts");

    let modelOptions = prepareModelOptions(result.models, currentModel);

    // Limit to max 10 models to prevent UI breaking in terminals
    const maxModels = 10;
    if (modelOptions.length > maxModels) {
      modelOptions = modelOptions.slice(0, maxModels);
    }

    let modelChoice = await select({
      message: "Choose your model:",
      options: [
        { label: "🔍 Search models...", value: "search" },
        ...modelOptions,
        { label: "Custom model name...", value: "custom" },
      ],
      initialValue: modelOptions.length > 0 ? modelOptions[0].value : undefined,
    });

    if (isCancel(modelChoice)) return null;

    if (modelChoice === "search") {
      const searchChoice = await handleSearch(result.models, select, text, isCancel);
      if (searchChoice === null) return null;
      modelChoice = searchChoice;
    }

    if (modelChoice === "custom") {
      selectedModel = await handleCustom(text);
      if (selectedModel === null) return null;
    } else {
      selectedModel = modelChoice as string;
    }
  } else {
    console.log("Could not fetch available models. Please specify a model name manually.");
    const { text, isCancel } = await import("@clack/prompts");
    try {
      const model = await text({
        message: "Enter your model name:",
        validate: (value) => {
          if (!value) return "Model name is required";
          return;
        },
      });
      if (isCancel(model)) return null;
      selectedModel = model as string;
    } catch {
      return null;
    }
  }

  return selectedModel;
};
