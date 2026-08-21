import { Provider } from "./base.js";
import type { ValidConfig } from "../../utils/config-types.js";
import { KnownError } from "../../utils/error.js";
import { providers } from "./providers-data.js";

export function getProvider(config: ValidConfig): Provider | null {
  const providerName = config.provider;
  const pDef = providers.find((p) => p.name === providerName);
  return pDef ? new Provider(pDef, config) : null;
}

export function getAvailableProviders(): { value: string; label: string }[] {
  return providers.map((p) => ({
    value: p.name,
    label: p.displayName,
  }));
}

export function getProviderBaseUrl(providerName: string): string {
  const provider = providers.find((p) => p.name === providerName);
  return provider?.baseUrl || "";
}

// Shared by the main command and the prepare-commit-msg hook: resolve the
// provider's call parameters from the config, failing fast on bad config.
export const getGenerateParams = (providerInstance: Provider, config: ValidConfig) => {
  const validation = providerInstance.validateConfig();
  if (!validation.valid) {
    throw new KnownError(
      `Provider configuration issues: ${validation.errors.join(
        ", ",
      )}. Run \`aicommits setup\` to reconfigure.`,
    );
  }
  return {
    model: config.OPENAI_MODEL || providerInstance.getDefaultModel(),
    baseUrl: providerInstance.getBaseUrl(),
    apiKey: providerInstance.getApiKey() || "",
    headers: providerInstance.getHeaders(),
    timeout: config.timeout || (providerInstance.name === "ollama" ? 30_000 : 15_000),
  };
};
