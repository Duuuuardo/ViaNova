import { createVianovaClient } from '@vianova/client'
import { requireEnv } from './env'

const baseUrl =
  typeof window !== 'undefined'
    ? requireEnv('VITE_VIANOVA_API_URL')
    : requireEnv('VIANOVA_API_URL')

export const api = createVianovaClient(baseUrl)

export const API_URL = baseUrl
