export type ConfigValue = string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue }
export type ConfigMap = Record<string, ConfigValue>

export type ConfigClientOptions = {
  baseUrl: string
  serviceToken?: string
  internalSecret?: string
}

export function createConfigClient({ baseUrl, serviceToken, internalSecret }: ConfigClientOptions) {
  if (!serviceToken && !internalSecret) {
    throw new Error('Either serviceToken or internalSecret must be provided')
  }

  return {
    async get(product: string, environment: string): Promise<ConfigMap> {
      const url = new URL(`/config/${product}/${environment}`, baseUrl)
      const headers: Record<string, string> = {}

      if (serviceToken) {
        headers.authorization = `Bearer ${serviceToken}`
      }
      if (internalSecret) {
        headers['x-internal-secret'] = internalSecret
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`config-server error ${response.status}: ${body}`)
      }

      const json = (await response.json()) as { config: ConfigMap }
      return json.config
    },
  }
}

export type ConfigClient = ReturnType<typeof createConfigClient>
