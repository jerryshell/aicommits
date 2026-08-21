import fs from "fs/promises";
import path from "path";
import os from "os";
import ini from "ini";
import { fileExists } from "./fs.js";
import { KnownError } from "./error.js";
import {
  configParsers,
  hasOwn,
  type ValidConfig,
  type ConfigKeys,
  type RawConfig,
} from "./config-types.js";

const getConfigPath = () => path.join(os.homedir(), ".aicommits");

const readConfigFile = async (): Promise<RawConfig> => {
  const configExists = await fileExists(getConfigPath());
  if (!configExists) {
    return Object.create(null);
  }

  const configString = await fs.readFile(getConfigPath(), "utf8");
  return ini.parse(configString);
};

export const getConfig = async (
  cliConfig?: RawConfig,
  envConfig?: RawConfig,
  suppressErrors?: boolean,
): Promise<ValidConfig> => {
  const config = await readConfigFile();

  // Check for deprecated config properties
  if (hasOwn(config, "proxy")) {
    console.warn('The "proxy" config property is deprecated and no longer supported');
  }

  const parsedConfig: Record<string, unknown> = {};
  const effectiveEnvConfig = envConfig ?? {};

  for (const key of Object.keys(configParsers) as ConfigKeys[]) {
    const parser = configParsers[key];
    const value = cliConfig?.[key] ?? effectiveEnvConfig?.[key] ?? config[key];

    if (suppressErrors) {
      try {
        parsedConfig[key] = parser(value);
      } catch {}
    } else {
      parsedConfig[key] = parser(value);
    }
  }

  // If only an API key is provided without a base URL, default to OpenAI
  if (!parsedConfig.OPENAI_BASE_URL && parsedConfig.OPENAI_API_KEY) {
    parsedConfig.OPENAI_BASE_URL = "https://api.openai.com/v1";
  }

  return { ...parsedConfig, model: parsedConfig.OPENAI_MODEL } as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: string][]) => {
  const config = await readConfigFile();

  for (const [key, value] of keyValues) {
    if (!hasOwn(configParsers, key)) {
      throw new KnownError(`Invalid config property: ${key}`);
    }

    if (value === "") {
      delete config[key as ConfigKeys];
    } else {
      const parsed = configParsers[key as ConfigKeys](value);
      config[key as ConfigKeys] = parsed as any;
    }
  }

  await fs.writeFile(getConfigPath(), ini.stringify(config), "utf8");
};
