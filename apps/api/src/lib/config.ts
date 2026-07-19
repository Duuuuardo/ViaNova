import { createConfigClient, type ConfigMap, type ConfigValue as ClientConfigValue } from '@vianova/config-client'

export type ConfigValue = ClientConfigValue

export let productConfig: ConfigMap = {}

export async function loadProductConfig(): Promise<ConfigMap> {
  const baseUrl = process.env.VIANOVA_CONFIG_SERVER_URL
  const internalSecret = process.env.VIANOVA_INTERNAL_SECRET

  if (!baseUrl) {
    console.warn('[config] VIANOVA_CONFIG_SERVER_URL not set, using empty config')
    productConfig = {}
    return productConfig
  }

  const environment =
    process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'staging' ? 'staging' : 'development'

  const client = createConfigClient({ baseUrl, internalSecret })
  productConfig = await client.get('vianova', environment)
  console.log(`[config] loaded vianova/${environment}`)
  return productConfig
}

export function getConfigValue<T extends ConfigValue>(key: string, fallback: T): T {
  const keys = key.split('.')
  let value: ConfigValue | undefined = productConfig

  for (const k of keys) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return fallback
    }
    value = (value as ConfigMap)[k]
  }

  return (value as T) ?? fallback
}
