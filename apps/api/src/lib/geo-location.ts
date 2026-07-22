import { isIP } from 'node:net'

export interface ApproximateLocation {
  label: string
  city?: string
  region?: string
  country?: string
  countryCode?: string
  regionCode?: string
  key: string
}

interface IpWhoResponse {
  success: boolean
  message?: string
  city?: string
  region?: string
  region_code?: string
  country?: string
  country_code?: string
}

export async function locateIp(ip?: string): Promise<ApproximateLocation | null> {
  if (!ip || isIP(ip) === 0) return null

  try {
    const fields = 'success,message,city,region,region_code,country,country_code'
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?lang=pt-BR&fields=${fields}`,
      { signal: AbortSignal.timeout(2_000) },
    )
    if (!response.ok) return null

    const data = await response.json() as IpWhoResponse
    if (!data.success) return null

    const city = data.city
    const region = data.region
    const country = data.country
    const parts = [city, region, country].filter(
      (part, index, values): part is string => Boolean(part) && values.indexOf(part) === index,
    )
    if (parts.length === 0) return null
    const countryCode = data.country_code
    const regionCode = data.region_code
    return {
      label: parts.join(', '),
      city,
      region,
      country,
      countryCode,
      regionCode,
      key: [countryCode, regionCode].filter(Boolean).join(':'),
    }
  } catch (error) {
    console.error('[geoip] consulta de localização indisponível:', error)
    return null
  }
}

export function getIpNetworkKey(ip?: string): string | null {
  if (!ip) return null
  const version = isIP(ip)
  if (version === 4) return ip.split('.').slice(0, 3).join('.')
  if (version !== 6) return null

  const [left = '', right = ''] = ip.toLowerCase().split('::')
  const leftGroups = left ? left.split(':') : []
  const rightGroups = right ? right.split(':') : []
  const missingGroups = Math.max(0, 8 - leftGroups.length - rightGroups.length)
  const expanded = [...leftGroups, ...Array(missingGroups).fill('0'), ...rightGroups]
    .map((group) => group.padStart(4, '0'))
  return expanded.slice(0, 4).join(':')
}

export function abbreviateIp(ip?: string): string {
  if (!ip) return 'indisponível'
  if (isIP(ip) !== 6) return ip
  const groups = ip.split(':').filter(Boolean)
  if (groups.length < 4) return ip
  return `${groups.slice(0, 2).join(':')}:…:${groups.at(-1)}`
}

export function formatLoginAlertDescription(
  location: ApproximateLocation | null,
  ip?: string,
): string {
  const shortIp = abbreviateIp(ip)
  if (location) {
    return `Detectamos um login em ${location.label}. IP: ${shortIp}. Se não foi você, altere sua senha imediatamente.`
  }
  return `Detectamos um login em um novo dispositivo. Localização aproximada indisponível. IP: ${shortIp}. Se não foi você, altere sua senha imediatamente.`
}
