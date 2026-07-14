import { createVianovaClient } from '@vianova/client'

const baseUrl =
  typeof window !== 'undefined'
    ? (import.meta.env.VITE_VIANOVA_API_URL ?? 'http://localhost:5000')
    : (process.env.VIANOVA_API_URL ?? 'http://localhost:5000')

export const api = createVianovaClient(baseUrl)

export const API_URL = baseUrl
