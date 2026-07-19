import { readdir, readFile, watch } from 'fs/promises'
import path from 'path'

export type ConfigValue = string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue }
export type ConfigMap = Record<string, ConfigValue>

const CONFIG_DIR = process.env.CONFIG_DIR ?? path.resolve(import.meta.dir, '../config')

export function deepMerge(base: ConfigMap, override: ConfigMap): ConfigMap {
  const result: ConfigMap = { ...base }

  for (const key of Object.keys(override)) {
    const baseValue = result[key]
    const overrideValue = override[key]

    if (
      baseValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue) &&
      overrideValue !== null &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = deepMerge(baseValue as ConfigMap, overrideValue as ConfigMap)
    } else {
      result[key] = overrideValue
    }
  }

  return result
}

class ConfigStore {
  private cache = new Map<string, ConfigMap>()
  private watcher: ReturnType<typeof watch> | null = null

  async load(product: string, environment: string): Promise<ConfigMap> {
    const cacheKey = `${product}:${environment}`
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const base = await this.readJson(product, 'default')
    const env = await this.readJson(product, environment)
    const merged = deepMerge(base, env)

    this.cache.set(cacheKey, merged)
    return merged
  }

  invalidate(product: string, environment: string) {
    this.cache.delete(`${product}:${environment}`)
  }

  async startWatching() {
    if (this.watcher) return

    this.watcher = watch(CONFIG_DIR, { recursive: true })
    for await (const event of this.watcher) {
      const filename = typeof event.filename === 'string' ? event.filename : event.filename?.toString()
      if (filename?.endsWith('.json')) {
        console.log(`[config-server] arquivo alterado: ${filename}`)
        this.cache.clear()
      }
    }
  }

  private async readJson(product: string, name: string): Promise<ConfigMap> {
    const filePath = path.join(CONFIG_DIR, product, `${name}.json`)

    try {
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as ConfigMap
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw err
    }
  }
}

export const configStore = new ConfigStore()
