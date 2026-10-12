export function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}_${id}`
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  const sep = cursor.indexOf('_')
  if (sep <= 0) return null
  const createdAt = cursor.slice(0, sep)
  const id = cursor.slice(sep + 1)
  if (!id || Number.isNaN(new Date(createdAt).getTime())) return null
  return { createdAt, id }
}
