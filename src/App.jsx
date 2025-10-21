
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const GRID_DIMENSIONS = { width: 1270, height: 1870 }
const GRID_FRAME_RADIUS = 36
const BASE_GRID_FRAMES = [
  { x: 45, y: 115, width: 556, height: 727 },
  { x: 668, y: 115, width: 556, height: 727 },
  { x: 45, y: 909, width: 556, height: 677 },
  { x: 668, y: 909, width: 556, height: 677 },
]
const cloneFrames = () => BASE_GRID_FRAMES.map((frame) => ({ ...frame }))

const GRID_TEMPLATES = [
  {
    id: "grid-cybercity",
    name: "Cybercity Azure",
    image: new URL("./assets/grid.png", import.meta.url).href,
    frames: cloneFrames(),
    dimensions: GRID_DIMENSIONS,
    frameRadius: GRID_FRAME_RADIUS,
  },
  {
    id: "grid-storm",
    name: "Metropolis Storm",
    image: new URL("./assets/grid2.png", import.meta.url).href,
    frames: cloneFrames(),
    dimensions: GRID_DIMENSIONS,
    frameRadius: GRID_FRAME_RADIUS,
  },
  {
    id: "grid-hologram",
    name: "Hologram Horizon",
    image: new URL("./assets/grid3.png", import.meta.url).href,
    frames: cloneFrames(),
    dimensions: GRID_DIMENSIONS,
    frameRadius: GRID_FRAME_RADIUS,
  },
  {
    id: "grid-retro",
    name: "Retro Neon",
    image: new URL("./assets/grid4.png", import.meta.url).href,
    frames: cloneFrames(),
    dimensions: GRID_DIMENSIONS,
    frameRadius: GRID_FRAME_RADIUS,
  },
  {
    id: "grid-synthwave",
    name: "Synthwave Pulse",
    image: new URL("./assets/grid5.png", import.meta.url).href,
    frames: cloneFrames(),
    dimensions: GRID_DIMENSIONS,
    frameRadius: GRID_FRAME_RADIUS,
  },
]

const COUNTDOWN_SECONDS = 10
const FILTERS = [
  { id: "raw", name: "Arcade Raw", css: "contrast(1.12) saturate(1.28)" },
  { id: "neon", name: "Neon Bloom", css: "contrast(1.28) saturate(1.6) hue-rotate(-18deg) brightness(1.02)" },
  { id: "ultra", name: "Ultraviolet", css: "contrast(1.35) saturate(1.35) hue-rotate(208deg)" },
  { id: "holo", name: "Hologram", css: "contrast(1.18) saturate(1.4) hue-rotate(130deg) brightness(1.05)" },
  { id: "cyber", name: "Cyber Noir", css: "grayscale(0.12) contrast(1.65) brightness(0.92)" },
  { id: "crt", name: "Retro CRT", css: "contrast(1.4) saturate(0.9) sepia(0.25)" },
]

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })

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

const drawImageCover = (ctx, image, dx, dy, dWidth, dHeight) => {
  const sourceRatio = image.width / image.height
  const targetRatio = dWidth / dHeight

  let sx = 0
  let sy = 0
  let sWidth = image.width
  let sHeight = image.height

  if (sourceRatio > targetRatio) {
    sWidth = image.height * targetRatio
    sx = (image.width - sWidth) / 2
  } else if (sourceRatio < targetRatio) {
    sHeight = image.width / targetRatio
    sy = (image.height - sHeight) / 2
  }

  ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
}
function App() {
  const videoRef = useRef(null)
  const [captures, setCaptures] = useState(() => Array(GRID_TEMPLATES[0].frames.length).fill(null))
  const [currentSlot, setCurrentSlot] = useState(0)
  const [lastCapturedIndex, setLastCapturedIndex] = useState(null)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [timer, setTimer] = useState(COUNTDOWN_SECONDS)
  const [awaitingDecision, setAwaitingDecision] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0].id)
  const [selectedTemplateId, setSelectedTemplateId] = useState(GRID_TEMPLATES[0].id)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  const selectedGridTemplate = useMemo(
    () => GRID_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? GRID_TEMPLATES[0],
    [selectedTemplateId]
  )
  const totalFrames = selectedGridTemplate.frames.length

  useEffect(() => {
    setCaptures((prev) => {
      if (prev.length === totalFrames) {
        return prev
      }

      const next = Array(totalFrames).fill(null)
      for (let index = 0; index < Math.min(prev.length, totalFrames); index += 1) {
        next[index] = prev[index]
      }
      return next
    })

    setCurrentSlot((prev) => {
      if (totalFrames === 0) {
        return 0
      }
      return Math.min(prev, totalFrames - 1)
    })

    setLastCapturedIndex((prev) => (prev !== null && prev < totalFrames ? prev : null))
  }, [totalFrames])

  const sessionComplete = useMemo(
    () => captures.length === totalFrames && captures.every(Boolean),
    [captures, totalFrames]
  )
  const activeFilter = useMemo(
    () => FILTERS.find((item) => item.id === selectedFilter) ?? FILTERS[0],
    [selectedFilter]
  )
  const capturedCount = captures.filter(Boolean).length

  const capturePhoto = useCallback(
    (index) => {
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
    },
    [activeFilter]
  )

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
  }, [capturePhoto, currentSlot, isCountingDown, timer])

  const startCountdown = (index) => {
    if (!cameraReady || isCountingDown) {
      return
    }

    setCurrentSlot(index)
    setTimer(COUNTDOWN_SECONDS)
    setIsCountingDown(true)
    setAwaitingDecision(false)
  }

  const handleReset = () => {
    setCaptures(Array(totalFrames).fill(null))
    setCurrentSlot(0)
    setLastCapturedIndex(null)
    setAwaitingDecision(false)
    setTimer(COUNTDOWN_SECONDS)
    setIsCountingDown(false)
    setError('')
  }
  const generateCollageCanvas = useCallback(async () => {
    const gridImage = await loadImage(selectedGridTemplate.image)
    const photoImages = await Promise.all(
      captures.map((src) => (src ? loadImage(src) : Promise.resolve(null)))
    )

    const canvas = document.createElement('canvas')
    canvas.width = gridImage.width || selectedGridTemplate.dimensions.width
    canvas.height = gridImage.height || selectedGridTemplate.dimensions.height
    const ctx = canvas.getContext('2d')

    ctx.drawImage(gridImage, 0, 0, canvas.width, canvas.height)

    const scaleX = canvas.width / selectedGridTemplate.dimensions.width
    const scaleY = canvas.height / selectedGridTemplate.dimensions.height
    const radius = selectedGridTemplate.frameRadius * Math.min(scaleX, scaleY)

    selectedGridTemplate.frames.forEach((frame, index) => {
      const image = photoImages[index]
      if (!image) {
        return
      }

      const x = frame.x * scaleX
      const y = frame.y * scaleY
      const width = frame.width * scaleX
      const height = frame.height * scaleY

      ctx.save()
      drawRoundedRect(ctx, x, y, width, height, radius)
      ctx.clip()
      drawImageCover(ctx, image, x, y, width, height)
      ctx.restore()
    })

    return canvas
  }, [captures, selectedGridTemplate])
  const handleDownload = async () => {
    if (!sessionComplete) {
      return
    }

    try {
      const canvas = await generateCollageCanvas()
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `beesnap-${selectedGridTemplate.id}-${Date.now()}.png`
      link.click()
    } catch (err) {
      console.error(err)
      setError('Gagal menyiapkan file unduhan.')
    }
  }

  const countdownLabel = isCountingDown ? `Foto diambil dalam ${timer}s` : 'Siap memotret'
  const totalFramesLabel = totalFrames || captures.length || 1
  const displayedFrameProgress = Math.min(capturedCount + (isCountingDown ? 1 : 0), totalFramesLabel)

  const handleTileClick = (index) => {
    if (index >= totalFrames) {
      return
    }
    setCurrentSlot(index)
    startCountdown(index)
  }
  const renderPhotoStrip = () => {
    const toPercent = (value, total) => (value / total) * 100

    return (
      <div className="relative w-full max-w-sm">
        <div className="relative rounded-[36px] border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_35px_rgba(56,189,248,0.25)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-cyan-200/70">
            <span className="rounded-full border border-cyan-500/40 px-4 py-1 text-cyan-100">{totalFramesLabel} Shots</span>
            <span>Grid Preview</span>
          </div>

          <div className="relative rounded-[28px] border border-cyan-500/20 bg-black/40 p-4">
            <div className="relative aspect-[1270/1870] w-full overflow-hidden rounded-[24px]">
              <img
                src={selectedGridTemplate.image}
                alt={`${selectedGridTemplate.name} Preview`}
                className="absolute inset-0 h-full w-full select-none object-cover"
                draggable={false}
              />

              {selectedGridTemplate.frames.map((frame, index) => {
                const capture = captures[index]
                const left = toPercent(frame.x, selectedGridTemplate.dimensions.width)
                const top = toPercent(frame.y, selectedGridTemplate.dimensions.height)
                const width = toPercent(frame.width, selectedGridTemplate.dimensions.width)
                const height = toPercent(frame.height, selectedGridTemplate.dimensions.height)
                const isActive = currentSlot === index

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleTileClick(index)}
                    className="group absolute overflow-hidden rounded-[28px] border border-transparent transition-transform duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                  >
                    {capture ? (
                      <>
                        <img src={capture} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">
                          <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-black">
                            Ambil Ulang
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/35 text-cyan-100">
                        <span className="text-base font-semibold">Frame #{index + 1}</span>
                        <span className="text-[11px] tracking-[0.2em] text-cyan-100/80">Tap untuk mulai</span>
                      </div>
                    )}
                    {isActive && (
                      <div className="pointer-events-none absolute inset-0 rounded-[28px] border-2 border-white/70" />
                    )}
                  </button>
                )
              })}
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
            Photo Booth Neon & Grid Cybercity 4R
          </h1>
          <p className="mt-4 text-base text-cyan-200/70">
            Ambil empat frame dengan filter synthwave dan langsung komposisikan ke template BeeSnap Cybercity. Unduh PNG resolusi penuh siap cetak 4R.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
            {error}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <section className="flex flex-col items-center gap-6">
            {renderPhotoStrip()}
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
                {countdownLabel}  Frame {displayedFrameProgress} / {totalFramesLabel}
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
                {awaitingDecision && lastCapturedIndex !== null && lastCapturedIndex < totalFrames - 1 && (
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
              <h3 className="text-lg font-semibold text-cyan-100">Pilih Template Grid</h3>
              <p className="mt-1 text-sm text-cyan-200/70">Tentukan latar BeeSnap sebelum mengunduh hasil akhir.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {GRID_TEMPLATES.map((template) => {
                  const isActive = template.id === selectedGridTemplate.id
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`overflow-hidden rounded-2xl border text-left transition ${
                        isActive
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.25)]'
                          : 'border-cyan-500/20 bg-[#040414]/90 text-cyan-200/70 hover:border-cyan-400/40 hover:text-cyan-100'
                      }`}
                    >
                      <div className="relative aspect-[1270/1870] w-full overflow-hidden border-b border-white/10">
                        <img
                          src={template.image}
                          alt={template.name}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                        {isActive && (
                          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-semibold text-black">
                            Dipilih
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-3 text-sm font-semibold">{template.name}</div>
                    </button>
                  )
                })}
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

            <div className="rounded-3xl border border-cyan-500/30 bg-[#050417]/70 p-6 shadow-[0_0_40px_rgba(56,189,248,0.15)] backdrop-blur">
              <h3 className="text-lg font-semibold text-cyan-100">Unduh Grid Cybercity</h3>
              <p className="mt-1 text-sm text-cyan-200/70">Simpan hasil foto langsung sebagai PNG berkualitas tinggi di template BeeSnap.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!sessionComplete}
                  className="rounded-full bg-gradient-to-r from-[#ff00e0] to-[#ff8f00] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_rgba(255,0,224,0.35)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unduh PNG Resolusi Maks
                </button>
              </div>
              {!sessionComplete && (
                <p className="mt-3 text-xs text-cyan-200/60">
                  Selesaikan semua frame untuk mengaktifkan tombol unduh.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App

