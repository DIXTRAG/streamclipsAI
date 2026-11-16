import { spawn } from 'child_process'

export interface AudioHighlight {
  startTime: number
  endTime: number
  confidenceScore: number
  peakRms: number
  baselineRms: number
  reason: string
}

interface AudioEnergyOptions {
  inputUrl: string
  durationSeconds: number
}

const SAMPLE_RATE = 8000
const CLIP_SECONDS = 45
const MIN_CLIP_SECONDS = 15
const MAX_HIGHLIGHTS = 8

/**
 * Turns one-second RMS measurements into candidate moments.
 * This is deliberately a lightweight loudness-spike heuristic, not an
 * understanding of speech, game events, or visual content.
 */
export function buildAudioHighlightsFromRms(
  rmsBySecond: number[],
  durationSeconds: number
): AudioHighlight[] {
  if (rmsBySecond.length < 3 || durationSeconds <= 0) return []

  const sorted = [...rmsBySecond].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] || 0
  const mean = rmsBySecond.reduce((sum, value) => sum + value, 0) / rmsBySecond.length
  const variance = rmsBySecond.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rmsBySecond.length
  const deviation = Math.sqrt(variance)
  const threshold = Math.max(median * 1.7, mean + deviation * 1.1, 0.018)

  const activeSeconds = rmsBySecond
    .map((rms, second) => ({ rms, second }))
    .filter(({ rms }) => rms >= threshold && rms >= 0.02)

  if (activeSeconds.length === 0) return []

  const groups: Array<{ start: number; end: number; peak: number }> = []
  for (const point of activeSeconds) {
    const previous = groups[groups.length - 1]
    if (previous && point.second - previous.end <= 4) {
      previous.end = point.second
      previous.peak = Math.max(previous.peak, point.rms)
    } else {
      groups.push({ start: point.second, end: point.second, peak: point.rms })
    }
  }

  const candidates = groups.map((group) => {
    const peakSecond = Math.round((group.start + group.end) / 2)
    const clipDuration = Math.min(CLIP_SECONDS, Math.max(MIN_CLIP_SECONDS, durationSeconds))
    const startTime = Math.max(0, Math.min(
      durationSeconds - clipDuration,
      peakSecond - Math.floor(clipDuration / 3)
    ))
    const endTime = Math.min(durationSeconds, startTime + clipDuration)
    const ratio = group.peak / Math.max(threshold, 0.001)
    const confidenceScore = Math.min(0.92, Math.max(0.35, 0.35 + Math.log2(ratio) * 0.16))

    return {
      startTime: Math.floor(startTime),
      endTime: Math.floor(endTime),
      confidenceScore: Number(confidenceScore.toFixed(2)),
      peakRms: Number(group.peak.toFixed(4)),
      baselineRms: Number(median.toFixed(4)),
      reason: 'Pico de intensidad de audio'
    }
  }).filter((item) => item.endTime - item.startTime >= MIN_CLIP_SECONDS)

  // Keep the strongest non-overlapping moments, then restore chronological order.
  const selected: AudioHighlight[] = []
  for (const candidate of candidates.sort((a, b) => b.confidenceScore - a.confidenceScore)) {
    const overlaps = selected.some((item) =>
      candidate.startTime < item.endTime && candidate.endTime > item.startTime
    )
    if (!overlaps) selected.push(candidate)
    if (selected.length >= MAX_HIGHLIGHTS) break
  }

  return selected.sort((a, b) => a.startTime - b.startTime)
}

/** Analyze an explicitly authorized direct media URL using FFmpeg audio decoding. */
export async function detectAudioHighlights(options: AudioEnergyOptions): Promise<AudioHighlight[]> {
  const source = new URL(options.inputUrl)
  const allowedHosts = (process.env.VIDEO_SOURCE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)

  if (source.protocol !== 'https:' || source.username || source.password) {
    throw new Error('Audio analysis requires an HTTPS media URL without embedded credentials')
  }
  if (allowedHosts.length === 0 || !allowedHosts.includes(source.hostname.toLowerCase())) {
    throw new Error('Audio source host is not allow-listed in VIDEO_SOURCE_ALLOWED_HOSTS')
  }
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
    throw new Error('VOD duration must be a positive number of seconds')
  }

  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-nostdin',
      '-v', 'error',
      '-i', options.inputUrl,
      '-t', String(options.durationSeconds),
      '-vn',
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-f', 's16le',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    const rmsBySecond: number[] = []
    let sampleCount = 0
    let sumSquares = 0
    let trailingByte: Buffer | null = null
    let stderr = ''
    let settled = false

    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      finish(new Error('Audio analysis timed out'))
    }, Math.max(120_000, options.durationSeconds * 1500))

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(buildAudioHighlightsFromRms(rmsBySecond, options.durationSeconds))
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const data = trailingByte ? Buffer.concat([trailingByte, chunk]) : chunk
      const usableLength = data.length - (data.length % 2)
      trailingByte = usableLength < data.length ? data.subarray(usableLength) : null

      for (let offset = 0; offset < usableLength; offset += 2) {
        const sample = data.readInt16LE(offset) / 32768
        sumSquares += sample * sample
        sampleCount += 1

        if (sampleCount === SAMPLE_RATE) {
          rmsBySecond.push(Math.sqrt(sumSquares / sampleCount))
          sampleCount = 0
          sumSquares = 0
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 12_000) stderr += chunk.toString()
    })
    child.on('error', (error) => finish(error))
    child.on('close', (code) => {
      if (sampleCount > 0) rmsBySecond.push(Math.sqrt(sumSquares / sampleCount))
      if (code === 0) finish()
      else finish(new Error(`FFmpeg audio analysis failed (code ${code}): ${stderr.slice(-2000)}`))
    })
  })
}
