// Validação de arquivos enviados por workspaces de produto.
// Regra dura: tudo que não está na allowlist é rejeitado.
// Objetivo: impedir que usuários façam upload de executáveis, scripts, HTML,
// ou qualquer arquivo que possa rodar no servidor/navegador.

const ALLOWED_MIME_TYPES: Record<string, string> = {
  // Imagens
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  // Áudio
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  // Vídeo
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  // Documentos
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
}

const MIME_BY_EXTENSION = Object.fromEntries(
  Object.entries(ALLOWED_MIME_TYPES).map(([mime, ext]) => [ext, mime]),
)

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase() in ALLOWED_MIME_TYPES
}

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_MIME_TYPES[mimeType.toLowerCase()] ?? null
}

export function mimeTypeForExtension(extension: string): string | null {
  return MIME_BY_EXTENSION[extension.toLowerCase().replace(/^\./, '')] ?? null
}

export function sanitizeFileName(name: string): string {
  // Remove path traversal e caracteres perigosos; mantém letras, números,
  // espaços, hífens, underscores e pontos.
  return name
    .replace(/\\/g, '/')
    .split('/')
    .pop() ?? 'file'
    .replace(/[^a-zA-Z0-9\u00C0-\u00FF\s._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .trim()
}

export type FileValidationResult =
  | { ok: true; extension: string; mimeType: string; sanitizedName: string }
  | { ok: false; message: string }

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0]!.trim()
}

export function validateWorkspaceFile(file: File): FileValidationResult {
  const mimeType = normalizeMimeType(file.type)
  if (!isAllowedMimeType(mimeType)) {
    return {
      ok: false,
      message:
        'Formato de arquivo não permitido. Aceitamos imagens, áudio, vídeo, PDF e documentos de texto.',
    }
  }

  const ext = extensionForMimeType(mimeType)
  if (!ext) {
    return { ok: false, message: 'Extensão não reconhecida para o tipo informado.' }
  }

  const originalExt = file.name.split('.').pop()?.toLowerCase()
  if (!originalExt || mimeTypeForExtension(originalExt) !== mimeType) {
    return { ok: false, message: 'A extensão do arquivo não corresponde ao conteúdo.' }
  }

  const sanitizedName = sanitizeFileName(file.name)
  if (sanitizedName.length === 0 || sanitizedName === '_') {
    return { ok: false, message: 'Nome de arquivo inválido.' }
  }

  return { ok: true, extension: ext, mimeType, sanitizedName }
}

// Garante que um MIME type cadastrado no banco nunca seja servido como algo
// executável. Se por algum bug o mime type estiver fora da allowlist, força
// download genérico.
export function safeContentType(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (isAllowedMimeType(normalized)) return normalized
  return 'application/octet-stream'
}

export function shouldForceDownload(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase()
  // SVG pode conter scripts; força download até sanitizarmos no futuro.
  if (normalized === 'image/svg+xml') return true
  // Documentos em geral ficam melhor como attachment.
  if (normalized.startsWith('application/') || normalized === 'text/plain') return true
  return false
}
