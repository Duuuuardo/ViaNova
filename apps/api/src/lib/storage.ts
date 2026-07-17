import { S3Client } from 'bun'

// Servidor de arquivos próprio do Vianova (MinIO, S3-compatible). Exclusivo
// deste repo: nenhum produto fala com o storage — só recebem a URL pública
// proxied por /files/avatars/:name (claim `picture` do token).
const s3 = new S3Client({
  endpoint: process.env.VIANOVA_S3_ENDPOINT ?? 'http://localhost:9100',
  accessKeyId: process.env.VIANOVA_S3_ACCESS_KEY ?? 'vianova',
  secretAccessKey: process.env.VIANOVA_S3_SECRET_KEY ?? 'vianova_secret',
  bucket: process.env.VIANOVA_S3_BUCKET ?? 'vianova-avatars',
})

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

const AVATAR_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export function avatarExtension(mimeType: string): string | null {
  return AVATAR_TYPES[mimeType] ?? null
}

const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

export async function putAvatar(name: string, file: File) {
  await s3.write(name, file, { type: file.type })
}

export async function getAvatar(name: string) {
  const ref = s3.file(name)
  if (!(await ref.exists())) return null
  const ext = name.split('.').pop() ?? ''
  return {
    bytes: await ref.arrayBuffer(),
    type: EXTENSION_TYPES[ext] ?? 'application/octet-stream',
  }
}

export async function deleteAvatar(name: string) {
  await s3.delete(name).catch(() => {})
}
