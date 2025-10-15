
import { useEffect, useMemo, useRef, useState } from "react"

const TOTAL_SHOTS = 4
const COUNTDOWN_SECONDS = 10
const PHOTO_WIDTH = 480
const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * (4 / 3))
const PHOTO_GAP = 56
const FRAME_MARGIN = 48
const PANEL_PADDING = 36
const LABEL_AREA = 110

const FILTERS = [
  { id: "raw", name: "Arcade Raw", css: "contrast(1.12) saturate(1.28)" },
  { id: "neon", name: "Neon Bloom", css: "contrast(1.28) saturate(1.6) hue-rotate(-18deg) brightness(1.02)" },
  { id: "ultra", name: "Ultraviolet", css: "contrast(1.35) saturate(1.35) hue-rotate(208deg)" },
  { id: "holo", name: "Hologram", css: "contrast(1.18) saturate(1.4) hue-rotate(130deg) brightness(1.05)" },
  { id: "cyber", name: "Cyber Noir", css: "grayscale(0.12) contrast(1.65) brightness(0.92)" },
  { id: "crt", name: "Retro CRT", css: "contrast(1.4) saturate(0.9) sepia(0.25)" },
]

const FRAME_COLORS = [
  "#0FF0FC",
  "#FF1F92",
  "#7C3AED",
  "#FEEF54",
  "#00FF8F",
  "#FF6B00",
  "#36CFFF",
  "#F200FF",
  "#7DF9FF",
  "#FF4B8B",
  "#9333FF",
  "#00F5D4",
  "#111827",
  "#1F1A3F",
  "#0B1120",
  "#22D3EE",
  "#FB7185",
  "#C084FC",
  "#FACC15",
  "#FFFFFF",
]

const emojiFromCodePoints = (...codePoints) => String.fromCodePoint(...codePoints)

const STICKERS = [
  { id: "bolt", label: "Shock", emoji: emojiFromCodePoints(0x26a1) },
  { id: "bot", label: "Robot", emoji: emojiFromCodePoints(0x1f916) },
  { id: "ufo", label: "UFO", emoji: emojiFromCodePoints(0x1f6f8) },
  { id: "disc", label: "Disc", emoji: emojiFromCodePoints(0x1f4bf) },
  { id: "orb", label: "Orb", emoji: emojiFromCodePoints(0x1f52e) },
  { id: "pad", label: "Gamepad", emoji: emojiFromCodePoints(0x1f3ae) },
  { id: "planet", label: "Planet", emoji: emojiFromCodePoints(0x1fa90) },
  { id: "grid", label: "Grid", emoji: emojiFromCodePoints(0x1f310) },
  { id: "sat", label: "Satellite", emoji: emojiFromCodePoints(0x1f6f0, 0xfe0f) },
  { id: "storm", label: "Storm", emoji: emojiFromCodePoints(0x1f329, 0xfe0f) },
  { id: "laptop", label: "Laptop", emoji: emojiFromCodePoints(0x1f4bb) },
  { id: "visor", label: "Visor", emoji: emojiFromCodePoints(0x1f97d) },
]

const MIN_STICKER_SIZE = 0.6
const MAX_STICKER_SIZE = 1.8
const STICKER_STEP = 0.1

const DEFAULT_STICKER_POSITIONS = [
  { x: 0.2, y: 0.18 },
  { x: 0.8, y: 0.18 },
  { x: 0.2, y: 0.82 },
  { x: 0.8, y: 0.82 },
  { x: 0.5, y: 0.18 },
  { x: 0.5, y: 0.82 },
  { x: 0.32, y: 0.5 },
  { x: 0.68, y: 0.5 },
]

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)))

const hexToRgb = (hex) => {
  if (!hex) {
    return { r: 255, g: 255, b: 255 }
  }
  let normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('')
  }
  const int = parseInt(normalized.slice(0, 6), 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

const rgbToHex = (r, g, b) =>
  `#${[r, g, b]
    .map((value) => clampByte(value).toString(16).padStart(2, '0'))
    .join('')}`

const mixHex = (source, target, amount) => {
  const from = hexToRgb(source)
  const to = hexToRgb(target)
  return rgbToHex(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount
  )
}

const lighten = (hex, amount) => mixHex(hex, '#ffffff', amount)
const darken = (hex, amount) => mixHex(hex, '#000000', amount)

const withAlpha = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const computeFrameStyles = (color) => {
  const surface = `linear-gradient(155deg, ${withAlpha(lighten(color, 0.3), 0.85)}, ${withAlpha(darken(color, 0.28), 0.95)})`
  const inner = `linear-gradient(155deg, ${withAlpha(darken(color, 0.18), 0.92)}, ${withAlpha(darken(color, 0.4), 0.98)})`
  const border = withAlpha(lighten(color, 0.22), 0.7)
  const glow = withAlpha(color, 0.3)
  const chipBg = withAlpha(lighten(color, 0.2), 0.18)
  const chipBorder = withAlpha(lighten(color, 0.35), 0.4)
  const chipText = withAlpha(lighten(color, 0.55), 0.88)
  const topText = withAlpha(lighten(color, 0.45), 0.65)
  const tileBackground = withAlpha(darken(color, 0.45), 0.9)
  const tileIdleBorder = withAlpha(darken(color, 0.15), 0.35)
  const tileActiveBorder = withAlpha(lighten(color, 0.2), 0.9)
  const tileOverlay = withAlpha(lighten(color, 0.25), 0.35)
  const labelBg = withAlpha(darken(color, 0.52), 0.78)
  const labelText = withAlpha(lighten(color, 0.58), 0.88)
  const accentText = withAlpha(lighten(color, 0.6), 0.7)
  return {
    surface,
    inner,
    border,
    glow,
    chipBg,
    chipBorder,
    chipText,
    topText,
    tileBackground,
    tileIdleBorder,
    tileActiveBorder,
    tileOverlay,
    labelBg,
    labelText,
    accentText,
  }
}
function App() {
  const videoRef = useRef(null)
  const photoAreaRef = useRef(null)
  const [captures, setCaptures] = useState(Array(TOTAL_SHOTS).fill(null))
  const [currentSlot, setCurrentSlot] = useState(0)
  const [lastCapturedIndex, setLastCapturedIndex] = useState(null)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [timer, setTimer] = useState(COUNTDOWN_SECONDS)
  const [awaitingDecision, setAwaitingDecision] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0].id)
  const [frameColor, setFrameColor] = useState(FRAME_COLORS[0])
  const [selectedStickers, setSelectedStickers] = useState([])
  const [activeStickerId, setActiveStickerId] = useState(null)
  const [dragSession, setDragSession] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [activePage, setActivePage] = useState('capture')

  const frameStyles = useMemo(() => computeFrameStyles(frameColor), [frameColor])
  const sessionComplete = useMemo(() => captures.every(Boolean), [captures])
  const activeSticker = useMemo(() => {
    if (!selectedStickers.length) {
      return null
    }
    if (activeStickerId) {
      return selectedStickers.find((item) => item.id === activeStickerId) ?? selectedStickers[0]
    }
    return selectedStickers[0]
  }, [activeStickerId, selectedStickers])
  const activeFilter = useMemo(
    () => FILTERS.find((item) => item.id === selectedFilter) ?? FILTERS[0],
    [selectedFilter]
  )
  const capturedCount = captures.filter(Boolean).length
  const canCustomize = capturedCount > 0

  useEffect(() => {
    let stream

    const enableCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Browser tidak mendukung kamera. Silakan gunakan browser modern.')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 720 },
            height: { ideal: 960 },
            aspectRatio: { ideal: 3 / 4 },
            facingMode: 'user',
          },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraReady(true)
        }
      } catch (err) {
        setError('Kamera tidak dapat diakses. Pastikan izin kamera sudah diberikan.')
        console.error(err)
      }
    }

    enableCamera()

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (!isCountingDown) {
      return
    }

    if (timer <= 0) {
      capturePhoto(currentSlot)
      return
    }

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isCountingDown, timer, currentSlot])

  useEffect(() => {
    if (sessionComplete) {
      setActivePage('customize')
    }
  }, [sessionComplete])

  useEffect(() => {
    if (!canCustomize && activePage === 'customize') {
      setActivePage('capture')
    }
  }, [canCustomize, activePage])

  useEffect(() => {
    if (selectedStickers.length === 0) {
      setActiveStickerId(null)
      return
    }

    if (!selectedStickers.some((item) => item.id === activeStickerId)) {
      setActiveStickerId(selectedStickers[0].id)
    }
  }, [selectedStickers, activeStickerId])

  const startCountdown = (index) => {
    if (!cameraReady || isCountingDown) {
      return
    }

    setCurrentSlot(index)
    setTimer(COUNTDOWN_SECONDS)
    setIsCountingDown(true)
    setAwaitingDecision(false)
  }

  const capturePhoto = (index) => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      setError('Kamera belum siap untuk mengambil foto.')
      setIsCountingDown(false)
      return
    }

    const canvas = document.createElement('canvas')
    const width = video.videoWidth || 720
    const height = video.videoHeight || 960
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    context.filter = activeFilter.css
    context.drawImage(video, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/png')

    setCaptures((prev) => {
      const next = [...prev]
      next[index] = dataUrl

      const nextEmpty = next.findIndex((item) => !item)
      setCurrentSlot(nextEmpty === -1 ? index : nextEmpty)

      return next
    })

    setIsCountingDown(false)
    setTimer(COUNTDOWN_SECONDS)
    setAwaitingDecision(true)
    setLastCapturedIndex(index)
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
  }

  const toggleSticker = (sticker) => {
    setSelectedStickers((prev) => {
      if (prev.some((item) => item.id === sticker.id)) {
        const next = prev.filter((item) => item.id !== sticker.id)
        if (activeStickerId === sticker.id) {
          setActiveStickerId(next.length ? next[0].id : null)
        }
        return next
      }

      const fallback = DEFAULT_STICKER_POSITIONS[prev.length % DEFAULT_STICKER_POSITIONS.length] ?? {
        x: 0.5,
        y: 0.5,
      }

      const nextSticker = { ...sticker, x: fallback.x, y: fallback.y, size: 1 }
      setActiveStickerId(nextSticker.id)
      return [...prev, nextSticker]
    })
  }

  const updateStickerSize = (id, size) => {
    const clamped = Math.min(MAX_STICKER_SIZE, Math.max(MIN_STICKER_SIZE, size))
    setSelectedStickers((prev) =>
      prev.map((item) => (item.id === id ? { ...item, size: clamped } : item))
    )
  }

  const stepStickerSize = (id, delta) => {
    const target = selectedStickers.find((item) => item.id === id)
    if (!target) {
      return
    }
    updateStickerSize(id, target.size + delta)
  }

  const handleReset = () => {
    setCaptures(Array(TOTAL_SHOTS).fill(null))
    setCurrentSlot(0)
    setLastCapturedIndex(null)
    setAwaitingDecision(false)
    setTimer(COUNTDOWN_SECONDS)
    setSelectedStickers([])
    setActiveStickerId(null)
    setActivePage('capture')
  }
  const generateCollageCanvas = async () => {
    const images = await Promise.all(captures.map((src) => loadImage(src)))

    const photoAreaWidth = PHOTO_WIDTH * 2 + PHOTO_GAP
    const photoAreaHeight = PHOTO_HEIGHT * 2 + PHOTO_GAP

    const width = photoAreaWidth + FRAME_MARGIN * 2
    const height = photoAreaHeight + FRAME_MARGIN * 2 + LABEL_AREA
    const usableX = FRAME_MARGIN
    const usableY = FRAME_MARGIN
    const labelTop = usableY + photoAreaHeight

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    const surfaceGradient = ctx.createLinearGradient(0, 0, width, height)
    surfaceGradient.addColorStop(0, lighten(frameColor, 0.28))
    surfaceGradient.addColorStop(1, darken(frameColor, 0.32))
    ctx.fillStyle = surfaceGradient
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = withAlpha(darken(frameColor, 0.45), 0.85)
    drawRoundedRect(
      ctx,
      usableX - PANEL_PADDING,
      usableY - PANEL_PADDING,
      photoAreaWidth + PANEL_PADDING * 2,
      photoAreaHeight + PANEL_PADDING * 2,
      56
    )
    ctx.fill()

    images.forEach((image, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = usableX + col * (PHOTO_WIDTH + PHOTO_GAP)
      const y = usableY + row * (PHOTO_HEIGHT + PHOTO_GAP)
      const radius = 44
      ctx.save()
      drawRoundedRect(ctx, x, y, PHOTO_WIDTH, PHOTO_HEIGHT, radius)
      ctx.clip()
      ctx.drawImage(image, x, y, PHOTO_WIDTH, PHOTO_HEIGHT)
      ctx.restore()
    })

    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    selectedStickers.forEach((sticker) => {
      const stickerSize = sticker.size ?? 1
      ctx.font = `${76 * stickerSize}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`
      const x = usableX + sticker.x * photoAreaWidth
      const y = usableY + sticker.y * photoAreaHeight
      ctx.save()
      ctx.shadowColor = withAlpha(lighten(frameColor, 0.45), 0.5)
      ctx.shadowBlur = 24
      ctx.fillText(sticker.emoji, x, y)
      ctx.restore()
    })

    ctx.fillStyle = frameStyles.labelBg
    drawRoundedRect(ctx, usableX - PANEL_PADDING, labelTop + 20, photoAreaWidth + PANEL_PADDING * 2, LABEL_AREA - 24, 32)
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "34px 'Orbitron','Poppins','Segoe UI',sans-serif"
    ctx.fillStyle = frameStyles.labelText
    ctx.fillText('BeeSnap Neon Booth', width / 2, labelTop + 56)

    ctx.font = "20px 'Poppins','Segoe UI',sans-serif"
    ctx.fillStyle = withAlpha(lighten(frameColor, 0.55), 0.8)
    ctx.fillText(new Date().toLocaleString(), width / 2, labelTop + 90)

    const FINAL_WIDTH = 1200
    const FINAL_HEIGHT = 1800
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = FINAL_WIDTH
    finalCanvas.height = FINAL_HEIGHT
    const finalCtx = finalCanvas.getContext('2d')
    finalCtx.fillStyle = '#030014'
    finalCtx.fillRect(0, 0, FINAL_WIDTH, FINAL_HEIGHT)

    const scale = Math.min((FINAL_WIDTH - 120) / width, (FINAL_HEIGHT - 120) / height)
    const offsetX = (FINAL_WIDTH - width * scale) / 2
    const offsetY = (FINAL_HEIGHT - height * scale) / 2

    finalCtx.drawImage(canvas, offsetX, offsetY, width * scale, height * scale)

    return finalCanvas
  }
  const handleDownload = async () => {
    if (!sessionComplete) {
      return
    }

    try {
      const canvas = await generateCollageCanvas()
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `beesnap-neon-${Date.now()}.png`
      link.click()
    } catch (err) {
      console.error(err)
      setError('Gagal menyiapkan file unduhan.')
    }
  }

  const handlePrint = async () => {
    if (!sessionComplete) {
      return
    }

    try {
      const canvas = await generateCollageCanvas()
      const dataUrl = canvas.toDataURL('image/png')
      const printWindow = window.open('', '_blank', 'width=720,height=1080')

      if (!printWindow) {
        setError('Tidak dapat membuka jendela cetak. Izinkan pop-up pada browser Anda.')
        return
      }

      const printHtml = `<!doctype html><html><head><title>BeeSnap Neon Print</title><style>@page { size: 4in 6in; margin: 0; } body { margin: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #030014; } img { width: 100%; height: auto; }</style></head><body><img src="${dataUrl}" alt="BeeSnap Neon Booth" /></body></html>`
      printWindow.document.open()
      printWindow.document.write(printHtml)
      printWindow.document.close()
      const img = printWindow.document.querySelector('img')
      img.onload = () => {
        img.onload = null
        printWindow.focus()
        printWindow.print()
        setTimeout(() => printWindow.close(), 300)
      }
    } catch (err) {
      console.error(err)
      setError('Cetak foto gagal dibuat.')
    }
  }

  const clamp = (value, min = 0.04, max = 0.96) => Math.min(max, Math.max(min, value))

  const beginStickerDrag = (event, stickerId) => {
    if (activePage !== 'customize') {
      return
    }

    const container = photoAreaRef.current
    if (!container) {
      return
    }

    const rect = container.getBoundingClientRect()
    const pointerX = (event.clientX - rect.left) / rect.width
    const pointerY = (event.clientY - rect.top) / rect.height

    const sticker = selectedStickers.find((item) => item.id === stickerId)
    if (!sticker) {
      return
    }

    setActiveStickerId(stickerId)

    setDragSession({
      id: stickerId,
      pointerId: event.pointerId,
      offsetX: pointerX - sticker.x,
      offsetY: pointerY - sticker.y,
    })

    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const moveSticker = (event) => {
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return
    }

    const container = photoAreaRef.current
    if (!container) {
      return
    }

    const rect = container.getBoundingClientRect()
    const pointerX = (event.clientX - rect.left) / rect.width
    const pointerY = (event.clientY - rect.top) / rect.height

    const nextX = clamp(pointerX - dragSession.offsetX)
    const nextY = clamp(pointerY - dragSession.offsetY)

    setSelectedStickers((prev) =>
      prev.map((item) => (item.id === dragSession.id ? { ...item, x: nextX, y: nextY } : item))
    )

    event.preventDefault()
  }

  const endStickerDrag = (event) => {
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragSession(null)
    event.preventDefault()
  }

  const countdownLabel = isCountingDown ? `Foto diambil dalam ${timer}s` : 'Siap memotret'

  const handleTileClick = (index) => {
    if (activePage === 'capture') {
      startCountdown(index)
      return
    }

    setActivePage('capture')
    setCurrentSlot(index)
  }
  const renderPhotoStrip = (mode) => {
    const isCustomize = mode === 'customize'

    return (
      <div className="relative w-full max-w-sm">
        <div
          className="relative rounded-[36px] border p-6 backdrop-blur"
          style={{
            background: frameStyles.surface,
            borderColor: frameStyles.border,
            boxShadow: `0 0 45px ${frameStyles.glow}`,
          }}
        >
          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.35em]" style={{ color: frameStyles.topText }}>
            <span
              className="rounded-full border px-4 py-1"
              style={{
                backgroundColor: frameStyles.chipBg,
                borderColor: frameStyles.chipBorder,
                color: frameStyles.chipText,
              }}
            >
              4 Shots
            </span>
            <span>{isCustomize ? 'Neon Strip' : 'Live Capture'}</span>
          </div>
          <div className="space-y-5">
            <div
              className="rounded-[28px] border shadow-inner"
              style={{
                background: frameStyles.inner,
                borderColor: frameStyles.border,
              }}
            >
              <div className="p-5">
                <div ref={isCustomize ? photoAreaRef : null} className="relative">
                  <div className="grid grid-cols-2" style={{ gap: `${PHOTO_GAP / 2}px` }}>
                    {captures.map((capture, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleTileClick(index)}
                        className="group relative aspect-[3/4] overflow-hidden rounded-[28px] border transition-transform duration-200 ease-out hover:scale-[1.01]"
                        style={{
                          background: frameStyles.tileBackground,
                          borderColor: capture ? frameStyles.tileActiveBorder : frameStyles.tileIdleBorder,
                          boxShadow: capture ? `0 0 28px ${frameStyles.tileOverlay}` : undefined,
                        }}
                      >
                        {capture ? (
                          <img src={capture} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: frameStyles.accentText }}>
                            <span className="text-base font-semibold">Frame #{index + 1}</span>
                            <span className="text-[11px] tracking-[0.2em]">Tap to shoot</span>
                          </div>
                        )}
                        {mode === 'capture' && currentSlot === index && !isCountingDown && !capture && (
                          <div className="absolute inset-0 border-2 border-white/70" />
                        )}
                        {capture && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">
                            <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-black">
                              {mode === 'capture' ? 'Retake' : 'Reshoot'}
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedStickers.length > 0 && (
                    <div className="pointer-events-none absolute inset-0">
                      {selectedStickers.map((sticker) => {
                        const stickerSize = sticker.size ?? 1
                        const isActive = isCustomize && activeSticker?.id === sticker.id
                        return (
                          <span
                            key={sticker.id}
                            role="img"
                            aria-label={sticker.label}
                            className={`absolute transition-transform ${
                              isCustomize ? 'pointer-events-auto cursor-move' : ''
                            } ${isActive ? 'drop-shadow-[0_0_20px_rgba(255,255,255,0.75)]' : ''}`}
                            style={{
                              top: `${sticker.y * 100}%`,
                              left: `${sticker.x * 100}%`,
                              transform: 'translate(-50%, -50%)',
                              fontSize: `${48 * stickerSize}px`,
                            }}
                            onPointerDown={isCustomize ? (event) => beginStickerDrag(event, sticker.id) : undefined}
                            onPointerMove={isCustomize ? moveSticker : undefined}
                            onPointerUp={isCustomize ? endStickerDrag : undefined}
                            onPointerCancel={isCustomize ? endStickerDrag : undefined}
                          >
                            {sticker.emoji}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-center text-[11px] uppercase tracking-[0.48em]" style={{ color: frameStyles.labelText }}>
              BeeSnap Neon Booth
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030014] via-[#090424] to-[#00121b] px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-cyan-300">BeeSnap</p>
          <h1 className="mt-3 text-3xl font-semibold text-cyan-100 sm:text-4xl">
            Photo Booth Neon  Kamera Online & Strip Futuristik
          </h1>
          <p className="mt-4 text-base text-cyan-200/70">
            Ambil empat frame, aktifkan filter synthwave, susun stiker cyberpunk, lalu unduh atau cetak hasil strip neonmu.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
            {error}
          </div>
        )}

        <nav className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setActivePage('capture')}
            className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
              activePage === 'capture'
                ? 'bg-gradient-to-r from-[#ff00e0] to-[#6a00ff] text-white shadow-[0_0_35px_rgba(255,0,224,0.35)]'
                : 'border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20'
            }`}
          >
            Ambil Foto
          </button>
          <button
            type="button"
            onClick={() => setActivePage('customize')}
            disabled={!canCustomize}
            className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
              activePage === 'customize'
                ? 'bg-gradient-to-r from-[#00e5ff] to-[#712bff] text-white shadow-[0_0_35px_rgba(0,229,255,0.35)]'
                : 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
            } ${!canCustomize ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            Edit Frame & Stiker
          </button>
        </nav>

        {activePage === 'capture' ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <section className="flex flex-col items-center gap-6">
              {renderPhotoStrip('capture')}
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-fuchsia-500/40 bg-transparent px-6 py-3 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/10"
              >
                Reset Semua Frame
              </button>
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_40px_rgba(56,189,248,0.2)] backdrop-blur">
                <h2 className="text-lg font-semibold text-cyan-100">Area Kamera</h2>
                <p className="mt-1 text-sm text-cyan-200/70">
                  {countdownLabel}  Frame {Math.min(capturedCount + (isCountingDown ? 1 : 0), TOTAL_SHOTS)} / {TOTAL_SHOTS}
                </p>
                <div className="relative mx-auto mt-4 w-full max-w-[240px] sm:max-w-[280px] md:max-w-[320px] overflow-hidden rounded-[32px] border border-cyan-500/30 bg-black/40">
                  <div className="relative aspect-[3/4]">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 h-full w-full object-cover"
                      playsInline
                      muted
                      style={{ filter: activeFilter.css }}
                    />
                    {flash && <div className="pointer-events-none absolute inset-0 bg-white/80" />}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!cameraReady && <span className="text-sm text-cyan-200/60">Menyiapkan kamera...</span>}
                  <button
                    type="button"
                    onClick={() => startCountdown(currentSlot)}
                    disabled={!cameraReady || isCountingDown}
                    className="rounded-full bg-gradient-to-r from-[#ff00e0] to-[#6a00ff] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_30px_rgba(255,0,224,0.25)] transition hover:from-[#ff27f1] hover:to-[#7d2bff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {captures[currentSlot] ? `Ambil Ulang Frame ${currentSlot + 1}` : `Mulai Frame ${currentSlot + 1}`}
                  </button>
                  {awaitingDecision && lastCapturedIndex !== null && lastCapturedIndex < TOTAL_SHOTS - 1 && (
                    <button
                      type="button"
                      onClick={() => startCountdown(lastCapturedIndex + 1)}
                      disabled={!cameraReady || isCountingDown}
                      className="rounded-full border border-cyan-400/50 px-5 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
                    >
                      Lanjut ke Frame {lastCapturedIndex + 2}
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_40px_rgba(56,189,248,0.15)] backdrop-blur">
                <h3 className="text-lg font-semibold text-cyan-100">Filter Kamera</h3>
                <p className="mt-1 text-sm text-cyan-200/70">Pilih suasana pencahayaan khas cyberpunk sebelum memotret.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSelectedFilter(filter.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        selectedFilter === filter.id
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                          : 'border-cyan-500/20 bg-[#040414]/90 text-cyan-200/70 hover:border-cyan-400/40 hover:text-cyan-100'
                      }`}
                    >
                      <div className="text-sm font-semibold">{filter.name}</div>
                      <div
                        className="mt-2 h-12 rounded-xl border border-white/10 bg-gradient-to-br from-[#0b1029] to-[#1c0f2d]"
                        style={{ filter: filter.css }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <section className="flex flex-col items-center gap-6">
              {renderPhotoStrip('customize')}
              <p className="text-sm text-cyan-200/70">Tarik stiker langsung di atas frame untuk komposisi neon terbaik.</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!sessionComplete}
                  className="rounded-full bg-gradient-to-r from-[#ff00e0] to-[#ff8f00] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_rgba(255,0,224,0.35)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unduh Strip Neon
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!sessionComplete}
                  className="rounded-full border border-cyan-400/60 px-6 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cetak Strip
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full border border-fuchsia-500/40 px-6 py-3 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/10"
                >
                  Ambil Ulang Semua
                </button>
              </div>
              {!sessionComplete && (
                <p className="text-center text-xs text-cyan-200/60">
                  Selesaikan semua frame untuk mengunduh atau mencetak hasil neon strip.
                </p>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_40px_rgba(56,189,248,0.15)] backdrop-blur">
                <h3 className="text-lg font-semibold text-cyan-100">Warna Frame</h3>
                <p className="mt-1 text-sm text-cyan-200/70">Pilih aksen neon untuk bingkai stripmu.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {FRAME_COLORS.map((color) => {
                    const isActive = frameColor === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFrameColor(color)}
                        className="h-10 w-10 rounded-full border-2 transition"
                        style={{
                          background: color,
                          borderColor: isActive ? '#ffffff' : withAlpha(color, 0.35),
                          boxShadow: isActive
                            ? `0 0 20px ${withAlpha(color, 0.55)}`
                            : `0 0 12px ${withAlpha(color, 0.25)}`,
                        }}
                        aria-label={`Pilih frame warna ${color}`}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_40px_rgba(56,189,248,0.15)] backdrop-blur">
                <h3 className="text-lg font-semibold text-cyan-100">Stiker Cyber</h3>
                <p className="mt-1 text-sm text-cyan-200/70">Aktifkan ikon neon lalu seret untuk menyusun strip futuristikmu.</p>
                <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {STICKERS.map((sticker) => {
                    const isSelected = selectedStickers.some((item) => item.id === sticker.id)
                    return (
                      <button
                        key={sticker.id}
                        type="button"
                        onClick={() => toggleSticker(sticker)}
                        className={`flex h-14 flex-col items-center justify-center rounded-2xl border text-xl transition ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(56,189,248,0.35)]'
                            : 'border-cyan-500/20 bg-[#040414]/80 text-cyan-200/70 hover:border-cyan-400/40 hover:text-cyan-100'
                        }`}
                      >
                        <span role="img" aria-label={sticker.label}>
                          {sticker.emoji}
                        </span>
                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]">{sticker.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-cyan-200/60">
                  Klik salah satu frame untuk kembali ke mode kamera dan ambil ulang pose.
                </p>
              {selectedStickers.length > 0 && (
                <div className="rounded-3xl border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_40px_rgba(56,189,248,0.15)] backdrop-blur">
                  <h3 className="text-lg font-semibold text-cyan-100">Ukuran Stiker</h3>
                  <p className="mt-1 text-sm text-cyan-200/70">Pilih stiker lalu atur skalanya agar pas dengan komposisi frame.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedStickers.map((sticker) => {
                      const isActive = activeSticker?.id === sticker.id
                      return (
                        <button
                          key={sticker.id}
                          type="button"
                          onClick={() => setActiveStickerId(sticker.id)}
                          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                            isActive
                              ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                              : 'border-cyan-500/20 bg-[#040414]/80 text-cyan-200/70 hover:border-cyan-400/40 hover:text-cyan-100'
                          }`}
                        >
                          <span className="text-lg">{sticker.emoji}</span>
                          <span className="uppercase tracking-[0.2em] text-[9px]">{sticker.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {activeSticker && (
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2 sm:flex-1">
                        <button
                          type="button"
                          onClick={() => stepStickerSize(activeSticker.id, -STICKER_STEP)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/40 text-lg text-cyan-100 transition hover:bg-cyan-500/10"
                        >
                          â€“
                        </button>
                        <input
                          type="range"
                          min={Math.round(MIN_STICKER_SIZE * 100)}
                          max={Math.round(MAX_STICKER_SIZE * 100)}
                          step={Math.round(STICKER_STEP * 100)}
                          value={Math.round((activeSticker.size ?? 1) * 100)}
                          onChange={(event) => updateStickerSize(activeSticker.id, Number(event.target.value) / 100)}
                          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-cyan-500/20 accent-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => stepStickerSize(activeSticker.id, STICKER_STEP)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/40 text-lg text-cyan-100 transition hover:bg-cyan-500/10"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                        {Math.round((activeSticker.size ?? 1) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
