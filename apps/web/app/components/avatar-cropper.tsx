import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Image as ImageIcon, Minus, Plus, X } from 'lucide-react'
import { Button, ErrorNote } from './ui'

const OUTPUT_SIZE = 512
type Point = { x: number; y: number }
type ImageSize = { width: number; height: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDisplaySize(image: ImageSize, cropSize: number, zoom: number) {
  const coverScale = Math.max(cropSize / image.width, cropSize / image.height)
  return { width: image.width * coverScale * zoom, height: image.height * coverScale * zoom }
}

function clampPosition(position: Point, image: ImageSize, cropSize: number, zoom: number): Point {
  const display = getDisplaySize(image, cropSize, zoom)
  const maxX = Math.max(0, (display.width - cropSize) / 2)
  const maxY = Math.max(0, (display.height - cropSize) / 2)
  return { x: clamp(position.x, -maxX, maxX), y: clamp(position.y, -maxY, maxY) }
}

async function exportCrop(
  imageElement: HTMLImageElement,
  imageSize: ImageSize,
  cropSize: number,
  zoom: number,
  position: Point,
) {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível preparar a imagem.')

  const display = getDisplaySize(imageSize, cropSize, zoom)
  const outputScale = OUTPUT_SIZE / cropSize
  const width = display.width * outputScale
  const height = display.height * outputScale
  context.drawImage(
    imageElement,
    (OUTPUT_SIZE - width) / 2 + position.x * outputScale,
    (OUTPUT_SIZE - height) / 2 + position.y * outputScale,
    width,
    height,
  )

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('Não foi possível recortar a imagem.')
  return new File([blob], 'avatar.webp', { type: blob.type || 'image/webp' })
}

export function AvatarCropper({
  file,
  onClose,
  onConfirm,
}: {
  file: File
  onClose: () => void
  onConfirm: (file: File) => Promise<boolean>
}) {
  const [source, setSource] = useState('')
  const [imageSize, setImageSize] = useState<ImageSize | null>(null)
  const [cropSize, setCropSize] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ pointerId: number; origin: Point; start: Point } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateSize = () => setCropSize(viewport.clientWidth)
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, saving])

  useEffect(() => {
    if (imageSize && cropSize) {
      setPosition((current) => clampPosition(current, imageSize, cropSize, zoom))
    }
  }, [cropSize, imageSize, zoom])

  const display = imageSize && cropSize ? getDisplaySize(imageSize, cropSize, zoom) : null

  function moveTo(next: Point) {
    if (imageSize && cropSize) setPosition(clampPosition(next, imageSize, cropSize, zoom))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!imageSize) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      start: position,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    moveTo({
      x: drag.start.x + event.clientX - drag.origin.x,
      y: drag.start.y + event.clientY - drag.origin.y,
    })
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  async function handleSave() {
    if (!imageRef.current || !imageSize || !cropSize) return
    setSaving(true)
    setError(null)
    try {
      const cropped = await exportCrop(imageRef.current, imageSize, cropSize, zoom, position)
      if (await onConfirm(cropped)) {
        onClose()
      } else {
        setError('Não foi possível enviar a foto. Tente novamente.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível recortar a imagem.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-900/65 p-4 backdrop-blur-xs"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        className="avatar-crop-dialog my-auto w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="avatar-crop-title" className="font-display text-xl font-bold text-ink-900">Ajustar foto</h2>
            <p className="mt-1 text-sm text-ink-500">Arraste e ajuste o zoom para escolher o enquadramento.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar editor de foto"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-500 transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-paper hover:text-ink-900 active:scale-[0.96] disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 rounded-card bg-ink-900 p-3 sm:p-4">
          <div
            ref={viewportRef}
            tabIndex={0}
            autoFocus
            aria-label="Prévia do recorte. Arraste a foto ou use as setas do teclado para reposicionar."
            onKeyDown={(event) => {
              const step = event.shiftKey ? 20 : 6
              const moves: Partial<Record<string, Point>> = {
                ArrowLeft: { x: position.x - step, y: position.y },
                ArrowRight: { x: position.x + step, y: position.y },
                ArrowUp: { x: position.x, y: position.y - step },
                ArrowDown: { x: position.x, y: position.y + step },
              }
              const next = moves[event.key]
              if (next) {
                event.preventDefault()
                moveTo(next)
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className="relative mx-auto aspect-square w-full max-w-80 touch-none cursor-grab overflow-hidden rounded-full bg-ink-700 outline-none ring-2 ring-white/90 focus-visible:ring-4 focus-visible:ring-via-500 active:cursor-grabbing"
          >
            {source && (
              <img
                ref={imageRef}
                src={source}
                alt=""
                draggable={false}
                onLoad={(event) => setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={display ? {
                  width: display.width,
                  height: display.height,
                  transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                } : undefined}
              />
            )}
            {!imageSize && (
              <span className="absolute inset-0 grid place-items-center text-white/60">
                <ImageIcon size={28} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="avatar-zoom" className="mb-0 text-sm font-semibold text-ink-700">Zoom</label>
            <span className="text-xs tabular-nums text-ink-500">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <Minus size={16} className="shrink-0 text-ink-400" aria-hidden="true" />
            <input
              id="avatar-zoom"
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-via-600"
            />
            <Plus size={16} className="shrink-0 text-ink-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xs text-ink-500">A foto será salva em 512 × 512 px.</p>
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">Cancelar</Button>
          <Button type="button" onClick={handleSave} loading={saving} disabled={!imageSize} className="transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">Recortar e enviar</Button>
        </div>
      </section>
    </div>
  )
}
