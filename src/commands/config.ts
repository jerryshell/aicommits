import { command } from "cleye";
import { hasOwn } from "../utils/config-types.js";
import { getConfig, setConfigs } from "../utils/config-runtime.js";
import { KnownError, handleCommandError } from "../utils/error.js";

export default command(
  {
    name: "config",
    description: "View or modify configuration settings",
    help: {
      description: "View or modify configuration settings",
    },
    parameters: ["[mode]", "[key=value...]"],
  },
  (argv) => {
    (async () => {
      const [mode, ...keyValues] = argv._;

      // If no mode provided, show all current config (excluding defaults)
      if (!mode) {
        const config = await getConfig({}, {}, true);

        console.log("Provider:", config.provider);
        if (config.OPENAI_API_KEY) {
          console.log("API Key:", `${config.OPENAI_API_KEY.substring(0, 4)}****`);
        }
        if (config.OPENAI_BASE_URL) {
          console.log("Base URL:", config.OPENAI_BASE_URL);
        }
        if (config.OPENAI_MODEL) {
          console.log("Model:", config.OPENAI_MODEL);
        }

        return;
      }

      if (mode === "get") {
        const config = await getConfig({}, {}, true);
        const sensitiveKeys = ["OPENAI_API_KEY"];
        for (const key of keyValues) {
          if (hasOwn(config, key)) {
            const value = config[key as keyof typeof config];
            const displayValue = sensitiveKeys.includes(key)
              ? `${String(value).substring(0, 4)}****`
              : String(value);
            console.log(`${key}=${displayValue}`);
          }
        }
        return;
      }

      if (mode === "set") {
        await setConfigs(keyValues.map((keyValue) => keyValue.split("=") as [string, string]));
        return;
      }

      throw new KnownError(`Invalid mode: ${mode}`);
    })().catch(handleCommandError);
  },
);
