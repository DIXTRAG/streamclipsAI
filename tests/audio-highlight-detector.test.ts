import { describe, expect, it } from 'vitest'
import { buildAudioHighlightsFromRms } from '@/lib/audio-highlight-detector'

describe('buildAudioHighlightsFromRms', () => {
  it('returns no highlights for quiet, steady audio', () => {
    expect(buildAudioHighlightsFromRms(Array(120).fill(0.01), 120)).toEqual([])
  })

  it('finds loud moments and returns clip ranges within the VOD', () => {
    const rms = Array(180).fill(0.01)
    for (let second = 72; second <= 75; second += 1) rms[second] = 0.16

    const highlights = buildAudioHighlightsFromRms(rms, 180)

    expect(highlights).toHaveLength(1)
    expect(highlights[0].startTime).toBeGreaterThanOrEqual(0)
    expect(highlights[0].endTime).toBeLessThanOrEqual(180)
    expect(highlights[0].endTime - highlights[0].startTime).toBeGreaterThanOrEqual(15)
    expect(highlights[0].reason).toContain('audio')
  })

  it('does not produce clips shorter than the minimum duration', () => {
    const rms = Array(20).fill(0.01)
    rms[10] = 0.2
    expect(buildAudioHighlightsFromRms(rms, 20)).toEqual([])
  })
})
