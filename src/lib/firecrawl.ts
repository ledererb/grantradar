import Firecrawl from '@mendable/firecrawl-js'

const globalForFirecrawl = globalThis as unknown as {
  firecrawl: Firecrawl | undefined
}

export const firecrawl = globalForFirecrawl.firecrawl ?? new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
})

if (process.env.NODE_ENV !== 'production') globalForFirecrawl.firecrawl = firecrawl

/**
 * Scrape a single URL and extract structured grant data using LLM.
 */
export async function scrapeGrantPage(url: string) {
  const result = await firecrawl.scrape(url, {
    formats: ['markdown'],
  })

  return result
}

/**
 * Crawl a website and discover all grant-related pages.
 */
export async function crawlGrantSite(url: string, options?: {
  maxPages?: number
  includePaths?: string[]
  excludePaths?: string[]
}) {
  const result = await firecrawl.crawl(url, {
    limit: options?.maxPages || 50,
    includePaths: options?.includePaths,
    excludePaths: options?.excludePaths,
    scrapeOptions: {
      formats: ['markdown'],
    },
  })

  return result
}
