import { command } from "cleye";
import { select, text, outro, isCancel, password } from "@clack/prompts";
import { getConfig, setConfigs } from "../utils/config-runtime.js";
import { KnownError, handleCommandError } from "../utils/error.js";
import { isInteractive } from "../utils/headless.js";

export default command(
  {
    name: "setup",
    description: "Configure your AI provider and settings",
    help: {
      description: "Configure your AI provider and settings",
    },
  },
  (_argv) => {
    (async () => {
      if (!isInteractive()) {
        throw new KnownError(
          "Interactive terminal required for setup. Run `aicommits setup` in a terminal.",
        );
      }

      const config = await getConfig();

      // 1. API endpoint (any OpenAI-compatible base URL)
      const baseUrlInput = await text({
        message: "Enter your OpenAI-compatible API endpoint:",
        placeholder: "https://api.openai.com/v1",
        initialValue: config.OPENAI_BASE_URL || "https://api.openai.com/v1",
        validate: (value: string) => {
          if (!value) return "Endpoint is required";
          try {
            new URL(value);
          } catch {
            return "Invalid URL format";
          }
          return;
        },
      });
      if (isCancel(baseUrlInput)) {
        outro("Setup cancelled");
        return;
      }
      const baseUrl = baseUrlInput as string;

      // 2. API key (optional for local endpoints, kept if left empty)
      const apiKeyInput = await password({
        message: config.OPENAI_API_KEY
          ? `Enter your API key (leave empty to keep current: ${config.OPENAI_API_KEY.substring(0, 4)}****):`
          : "Enter your API key:",
        validate: (value: string) => {
          if (!value && !config.OPENAI_API_KEY) {
            return "API key is required for this endpoint";
          }
          return;
        },
      });
      if (isCancel(apiKeyInput)) {
        outro("Setup cancelled");
        return;
      }

      config.OPENAI_BASE_URL = baseUrl;
      if (apiKeyInput) {
        config.OPENAI_API_KEY = apiKeyInput as string;
      }

      // 3. Select model interactively
      const { selectModel } = await import("../models.js");
      const selectedModel = await selectModel(
        baseUrl,
        config.OPENAI_API_KEY || "",
        config.OPENAI_MODEL,
      );

      if (selectedModel) {
        config.OPENAI_MODEL = selectedModel;
        console.log(`Model selected: ${selectedModel}`);
      } else {
        outro("Model selection cancelled.");
        return;
      }

      // 4. Commit message format
      const typeChoice = await select({
        message: "Choose commit message format:",
        options: [
          { value: "plain", label: "Plain - Simple format without structure" },
          { value: "conventional", label: "Conventional - Standard conventional commits" },
          {
            value: "conventional+body",
            label: "Conventional + body - Conventional commit subject and body",
          },
          { value: "gitmoji", label: "Gitmoji - Using emojis for commit types" },
          { value: "subject+body", label: "Subject + body - Git-style subject line and body" },
        ],
        initialValue: config.type,
      });

      if (isCancel(typeChoice)) {
        outro("Setup cancelled");
        return;
      }
      (config as any).type = typeChoice as string;

      // Save all config at once
      const finalUpdates = Object.entries(config).filter(
        ([k, v]) => k !== "model" && v !== undefined && v !== "" && typeof v === "string",
      ) as [string, string][];
      await setConfigs(finalUpdates);

      outro(`✅ Setup complete! You're now using ${baseUrl}.`);
    })().catch(handleCommandError);
  },
);
