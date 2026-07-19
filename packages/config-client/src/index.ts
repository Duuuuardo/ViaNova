export type ConfigValue = string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue }
export type ConfigMap = Record<string, ConfigValue>

export type ConfigClientOptions = {
  baseUrl: string
  serviceToken: string
}

export function createConfigClient({ baseUrl, serviceToken }: ConfigClientOptions) {
  return {
    async get(product: string, environment: string): Promise<ConfigMap> {
      const url = new URL(`/config/${product}/${environment}`, baseUrl)
      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${serviceToken}`,
        },
      })

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
