export interface ScraperRun {
  source: string
  status: 'success' | 'error' | 'noop'
  grantsFound: number
  errors: string[]
  durationMs: number
  timestamp: Date
}

/**
 * Log the outcome of a scraper run.
 *
 * Currently console-based; structured for future forwarding to
 * Sentry / Slack / webhook when those are wired up.
 */
export function logScraperRun(run: ScraperRun) {
  const emoji = run.status === 'error' ? '❌' : run.status === 'success' ? '✅' : '⏭️'
  console.log(
    `[scraper] ${emoji} ${run.source}: ${run.grantsFound} grants in ${run.durationMs}ms`
  )

  if (run.errors.length > 0) {
    console.error(`[scraper] ${run.source} errors:`, run.errors.join('; '))
    // TODO: forward to alerting when available
    // if (process.env.SENTRY_DSN) Sentry.captureMessage(...)
    // if (process.env.SLACK_WEBHOOK_URL) await postToSlack(run)
  }
}

/**
 * Wrap a scraper invocation with timing, error capture, and logging.
 * Returns the scraper's own result plus the computed run metadata.
 *
 * `result` is loosely typed so any scraper payload works; grantsFound is
 * derived from common keys (grantsFound | grantsCreated | enriched | processed).
 */
export async function runWithMonitoring<T>(
  source: string,
  fn: () => Promise<T>
): Promise<{ result: T | null; run: ScraperRun }> {
  const start = Date.now()
  const errors: string[] = []
  let result: T | null = null

  try {
    result = await fn()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    errors.push(message)
    console.error(`[scraper] ${source} threw:`, e)
  }

  const countKeys = ['grantsFound', 'grantsCreated', 'enriched', 'processed']
  const found =
    result && typeof result === 'object'
      ? countKeys.reduce((sum, k) => {
          const v = (result as Record<string, unknown>)?.[k]
          return sum + (typeof v === 'number' ? v : 0)
        }, 0)
      : 0

  const status: ScraperRun['status'] =
    errors.length > 0 ? 'error' : found > 0 ? 'success' : 'noop'

  const run: ScraperRun = {
    source,
    status,
    grantsFound: found,
    errors,
    durationMs: Date.now() - start,
    timestamp: new Date(),
  }

  logScraperRun(run)
  return { result, run }
}
