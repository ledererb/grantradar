import { describe, it, expect, vi } from 'vitest'
import { logScraperRun, runWithMonitoring } from '@/lib/scrapers/monitor'

describe('logScraperRun', () => {
  it('logs a success run without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logScraperRun({
      source: 'test',
      status: 'success',
      grantsFound: 5,
      errors: [],
      durationMs: 100,
      timestamp: new Date(),
    })
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[scraper]'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('✅'))
    spy.mockRestore()
  })

  it('logs errors to console.error when present', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logScraperRun({
      source: 'boom',
      status: 'error',
      grantsFound: 0,
      errors: ['timeout', '500'],
      durationMs: 50,
      timestamp: new Date(),
    })
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('boom'), expect.any(String))
    logSpy.mockRestore()
    errSpy.mockRestore()
  })
})

describe('runWithMonitoring', () => {
  it('reports success when scraper returns grants', async () => {
    const { result, run } = await runWithMonitoring('src', async () => ({
      grantsFound: 7,
    }))
    expect(result).toEqual({ grantsFound: 7 })
    expect(run.status).toBe('success')
    expect(run.grantsFound).toBe(7)
    expect(run.errors).toHaveLength(0)
    expect(run.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('reports noop when scraper finds nothing', async () => {
    const { run } = await runWithMonitoring('src', async () => ({ grantsFound: 0 }))
    expect(run.status).toBe('noop')
    expect(run.grantsFound).toBe(0)
  })

  it('reports error and captures message when scraper throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { result, run } = await runWithMonitoring('src', async () => {
      throw new Error('boom')
    })
    expect(result).toBeNull()
    expect(run.status).toBe('error')
    expect(run.errors).toContain('boom')
    errSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('derives grantsFound from enriched/processed keys', async () => {
    const { run } = await runWithMonitoring('deep', async () => ({
      processed: 10,
      enriched: 3,
      skipped: 7,
    }))
    expect(run.grantsFound).toBe(13)
    expect(run.status).toBe('success')
  })
})
