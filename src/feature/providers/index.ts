import { Provider } from "./base.js";
import type { ValidConfig } from "../../utils/config-types.js";
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
