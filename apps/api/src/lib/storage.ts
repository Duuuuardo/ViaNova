import { S3Client } from 'bun'

const S3_ENDPOINT = process.env.VIANOVA_S3_ENDPOINT ?? 'http://localhost:9100'
const S3_ACCESS_KEY = process.env.VIANOVA_S3_ACCESS_KEY ?? 'vianova'
const S3_SECRET_KEY = process.env.VIANOVA_S3_SECRET_KEY ?? 'vianova_secret'

// Bucket exclusivo para avatares de conta. Nunca misturar com workspace files.
const avatarsS3 = new S3Client({
  endpoint: S3_ENDPOINT,
  accessKeyId: S3_ACCESS_KEY,
  secretAccessKey: S3_SECRET_KEY,
  bucket: process.env.VIANOVA_AVATARS_BUCKET ?? 'vianova-avatars',
})

// Bucket para arquivos de workspaces de produto (Vianova Storage).
export const WORKSPACE_FILES_BUCKET = process.env.VIANOVA_FILES_BUCKET ?? 'vianova-files'
const filesS3 = new S3Client({
  endpoint: S3_ENDPOINT,
  accessKeyId: S3_ACCESS_KEY,
  secretAccessKey: S3_SECRET_KEY,
  bucket: WORKSPACE_FILES_BUCKET,
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
  await avatarsS3.write(name, file, { type: file.type })
}

export async function getAvatar(name: string) {
  const ref = avatarsS3.file(name)
  if (!(await ref.exists())) return null
  const ext = name.split('.').pop() ?? ''
  return {
    bytes: await ref.arrayBuffer(),
    type: EXTENSION_TYPES[ext] ?? 'application/octet-stream',
  }
}

export async function deleteAvatar(name: string) {
  await avatarsS3.delete(name).catch(() => {})
}

// --- Workspace files (Vianova Storage) ---

export async function putWorkspaceFile(key: string, file: File) {
  await filesS3.write(key, file, { type: file.type })
}

export async function getWorkspaceFile(key: string) {
  const ref = filesS3.file(key)
  if (!(await ref.exists())) return null
  return {
    bytes: await ref.arrayBuffer(),
  }
}

export async function deleteWorkspaceFile(key: string) {
  await filesS3.delete(key).catch(() => {})
}

export async function workspaceFileExists(key: string): Promise<boolean> {
  return filesS3.file(key).exists()
}
