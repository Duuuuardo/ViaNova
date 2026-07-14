import { treaty } from '@elysiajs/eden'
import type { App } from '@vianova/api'

export function createVianovaClient(baseUrl: string) {
  return treaty<App>(baseUrl, {
    fetch: { credentials: 'include' },
  })
}

export type VianovaClient = ReturnType<typeof createVianovaClient>
