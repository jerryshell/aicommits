import { command } from "cleye";
import { outro } from "@clack/prompts";
import { getConfig, setConfigs, getGenerateParams } from "../utils/config-runtime.js";
import { selectModel } from "../models.js";
import { KnownError, handleCommandError } from "../utils/error.js";
import { isInteractive } from "../utils/headless.js";

export default command(
  {
    name: "model",
    description: "Select or change your AI model",
    help: {
      description: "Select or change your AI model",
    },
    alias: ["-m", "models"],
  },
  () => {
    (async () => {
      if (!isInteractive()) {
        throw new KnownError("Interactive terminal required for model selection.");
      }

      const config = await getConfig();

      const params = getGenerateParams(config);
      if (!params) {
        outro("No provider configured. Run `aicommits setup` first.");
        return;
      }

      // Select model using default base URL
      const selectedModel = await selectModel(params.baseUrl, params.apiKey, config.OPENAI_MODEL);

      if (selectedModel) {
        // Save the selected model
        await setConfigs([["OPENAI_MODEL", selectedModel]]);
        outro(`✅ Model updated to: ${selectedModel}`);
      } else {
        outro("Model selection cancelled");
      }
    })().catch(handleCommandError);
  },
);
